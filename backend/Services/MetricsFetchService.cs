using System.Globalization;
using System.Net.Http;
using System.Text.Json;
using Backend.Data;
using Backend.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend.Services
{
    public sealed class FacebookSyncSummary
    {
        public int CompanyId { get; init; }
        public int Campaigns { get; set; }
        public int AdSets { get; set; }
        public int Ads { get; set; }
        public int MetricRows { get; set; }
    }

    public sealed class MetricsFetchServiceStatus
    {
        public bool IsEnabled { get; init; }
        public bool IsRunning { get; init; }
        public bool HasPendingManualRun { get; init; }
        public double IntervalHours { get; init; }
        public DateTime? LastEnabledAt { get; init; }
        public DateTime? LastDisabledAt { get; init; }
        public DateTime? LastRunStartedAt { get; init; }
        public DateTime? LastRunCompletedAt { get; init; }
        public DateTime? LastSuccessfulRunAt { get; init; }
        public DateTime? LastFailedRunAt { get; init; }
        public string? LastRunTrigger { get; init; }
        public string? LastRunOutcome { get; init; }
        public string? LastError { get; init; }
    }

    // Fetches real metrics from ad platforms every 4 hours.
    // Facebook uses a full refresh so local data always matches the latest account state.
    public class MetricsFetchService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<MetricsFetchService> _logger;
        private readonly IConfiguration _config;
        private readonly HttpClient _httpClient;
        private readonly MetricsSummaryService _summaryService;
        private TimeSpan _interval = TimeSpan.FromHours(4);
        private readonly SemaphoreSlim _wakeSignal = new(0);
        private readonly object _stateLock = new();
        private CancellationTokenSource? _activeRunCts;
        private bool _isEnabled = true;
        private bool _isRunning;
        private bool _manualRunRequested;
        private DateTime? _lastEnabledAt;
        private DateTime? _lastDisabledAt;
        private DateTime? _lastRunStartedAt;
        private DateTime? _lastRunCompletedAt;
        private DateTime? _lastSuccessfulRunAt;
        private DateTime? _lastFailedRunAt;
        private string? _lastRunTrigger;
        private string? _lastRunOutcome;
        private string? _lastError;

        public MetricsFetchService(IServiceProvider serviceProvider, ILogger<MetricsFetchService> logger, IConfiguration config, MetricsSummaryService summaryService)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
            _config = config;
            _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
            _summaryService = summaryService;
            _lastEnabledAt = DateTime.UtcNow;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            // Load persisted interval (if table+row exist) before the first cycle.
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var setting = await db.PlatformServiceSettings.FirstOrDefaultAsync(s => s.Id == 1, stoppingToken);
                if (setting != null && setting.IntervalHours > 0)
                {
                    lock (_stateLock) { _interval = TimeSpan.FromHours((double)setting.IntervalHours); }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not load persisted Platform Service settings; using default interval.");
            }

            _logger.LogInformation("MetricsFetchService started. Interval: {Interval}h", GetInterval().TotalHours);
            await RunFetchCycleAsync("scheduled", stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                if (ShouldRunManual())
                {
                    await RunFetchCycleAsync("manual", stoppingToken);
                    continue;
                }

                if (!IsEnabled())
                {
                    await _wakeSignal.WaitAsync(stoppingToken);
                    continue;
                }

                var interval = GetInterval();
                using var waitCts = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
                var delayTask = Task.Delay(interval, waitCts.Token);
                var wakeTask = _wakeSignal.WaitAsync(stoppingToken);
                var completedTask = await Task.WhenAny(delayTask, wakeTask);

                if (completedTask == wakeTask)
                {
                    waitCts.Cancel();
                    await ObserveCanceledTaskAsync(delayTask);
                    continue;
                }

                await RunFetchCycleAsync("scheduled", stoppingToken);
            }
        }

        public MetricsFetchServiceStatus GetStatus()
        {
            lock (_stateLock)
            {
                return new MetricsFetchServiceStatus
                {
                    IsEnabled = _isEnabled,
                    IsRunning = _isRunning,
                    HasPendingManualRun = _manualRunRequested,
                    IntervalHours = _interval.TotalHours,
                    LastEnabledAt = _lastEnabledAt,
                    LastDisabledAt = _lastDisabledAt,
                    LastRunStartedAt = _lastRunStartedAt,
                    LastRunCompletedAt = _lastRunCompletedAt,
                    LastSuccessfulRunAt = _lastSuccessfulRunAt,
                    LastFailedRunAt = _lastFailedRunAt,
                    LastRunTrigger = _lastRunTrigger,
                    LastRunOutcome = _lastRunOutcome,
                    LastError = _lastError
                };
            }
        }

        public MetricsFetchServiceStatus StartScheduledExecution()
        {
            lock (_stateLock)
            {
                _isEnabled = true;
                _lastEnabledAt = DateTime.UtcNow;
            }

            SignalLoop();
            return GetStatus();
        }

        public MetricsFetchServiceStatus StopScheduledExecution()
        {
            CancellationTokenSource? activeRunCts;
            lock (_stateLock)
            {
                _isEnabled = false;
                _manualRunRequested = false;
                _lastDisabledAt = DateTime.UtcNow;
                activeRunCts = _activeRunCts;
            }

            activeRunCts?.Cancel();
            SignalLoop();
            return GetStatus();
        }

        public MetricsFetchServiceStatus RequestImmediateRun()
        {
            lock (_stateLock)
            {
                _manualRunRequested = true;
            }

            SignalLoop();
            return GetStatus();
        }

        public MetricsFetchServiceStatus SetIntervalHours(double intervalHours)
        {
            lock (_stateLock)
            {
                _interval = TimeSpan.FromHours(intervalHours);
            }

            // Persist to platform_service_settings (singleton row id=1).
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var setting = db.PlatformServiceSettings.FirstOrDefault(s => s.Id == 1);
                if (setting == null)
                {
                    db.PlatformServiceSettings.Add(new PlatformServiceSetting
                    {
                        Id = 1,
                        IntervalHours = (decimal)intervalHours,
                        IsEnabled = true,
                        UpdatedAt = DateTime.UtcNow
                    });
                }
                else
                {
                    setting.IntervalHours = (decimal)intervalHours;
                    setting.UpdatedAt = DateTime.UtcNow;
                }
                db.SaveChanges();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not persist Platform Service interval; in-memory value still applied.");
            }

            SignalLoop();
            return GetStatus();
        }

        public async Task<FacebookSyncSummary> SyncFacebookDataForCompany(int companyId, CancellationToken ct = default)
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var account = await db.CompanyAdAccounts
                .Where(a => a.CompanyId == companyId && a.Platform == "facebook" && a.Status == "active")
                .OrderByDescending(a => a.UpdatedAt)
                .FirstOrDefaultAsync(ct);

            if (account == null)
            {
                const string reason = "No active Facebook ad account is configured.";
                _logger.LogWarning("[FB SYNC] {Reason} Company {CompanyId}", reason, companyId);
                await AppendFacebookMetricsLogAsync(companyId, null, null, null, reason, ct);
                return new FacebookSyncSummary { CompanyId = companyId };
            }

            var accessToken = GetUsableFacebookAccessToken(account.AccessToken)
                ?? GetUsableFacebookAccessToken(_config["Facebook:AccessToken"]);

            var adAccountId = !string.IsNullOrWhiteSpace(account.AccountId)
                ? account.AccountId
                : _config["Facebook:AdAccountId"];

            if (string.IsNullOrWhiteSpace(accessToken) || string.IsNullOrWhiteSpace(adAccountId))
            {
                const string reason = "Facebook access token or ad account ID is not configured.";
                _logger.LogWarning("[FB SYNC] {Reason} Company {CompanyId}", reason, companyId);
                await AppendFacebookMetricsLogAsync(companyId, null, null, account.AccountId, reason, ct);
                return new FacebookSyncSummary { CompanyId = companyId };
            }

            var summary = new FacebookSyncSummary { CompanyId = companyId };

            try
            {
                // ── CAMPAIGNS: upsert by facebook_campaign_id ─────────────────────────
                var existingCampaigns = await db.Campaigns
                    .Where(c => c.CompanyId == companyId && c.FacebookCampaignId != null)
                    .ToDictionaryAsync(c => c.FacebookCampaignId!, ct);

                var campaignsUrl = $"https://graph.facebook.com/v19.0/{adAccountId}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time,created_time&limit=200&access_token={accessToken}";
                var fbCampaigns = await FetchGraphCollectionAsync(campaignsUrl, ct);
                var campaignEntities = new List<(string FacebookId, Campaign Entity)>();
                var seenFbCampaignIds = new HashSet<string>();

                foreach (var fbCampaign in fbCampaigns)
                {
                    var fbCampaignId = GetString(fbCampaign, "id");
                    if (string.IsNullOrWhiteSpace(fbCampaignId))
                    {
                        continue;
                    }

                    seenFbCampaignIds.Add(fbCampaignId);
                    Campaign campaign;

                    if (existingCampaigns.TryGetValue(fbCampaignId, out var existingCampaign))
                    {
                        existingCampaign.Name = GetString(fbCampaign, "name") ?? "Untitled";
                        existingCampaign.Status = NormalizeFacebookStatus(GetString(fbCampaign, "status"), "paused");
                        existingCampaign.DailyBudget = ParseBudget(fbCampaign, "daily_budget");
                        existingCampaign.LifetimeBudget = ParseBudget(fbCampaign, "lifetime_budget");
                        existingCampaign.TotalBudget = ParseBudget(fbCampaign, "lifetime_budget") ?? (ParseBudget(fbCampaign, "daily_budget") is decimal d ? d * 7 : null);
                        existingCampaign.StartDate = ParseUtcDateTime(fbCampaign, "start_time");
                        existingCampaign.EndDate = ParseUtcDateTime(fbCampaign, "stop_time");
                        existingCampaign.PlatformCampaignIds = JsonSerializer.SerializeToElement(new { facebook = fbCampaignId });
                        existingCampaign.UpdatedAt = DateTime.UtcNow;
                        campaign = existingCampaign;
                    }
                    else
                    {
                        campaign = new Campaign
                        {
                            CompanyId = companyId,
                            FacebookCampaignId = fbCampaignId,
                            Name = GetString(fbCampaign, "name") ?? "Untitled",
                            CampaignType = "paid_social",
                            Platforms = new[] { "facebook" },
                            Status = NormalizeFacebookStatus(GetString(fbCampaign, "status"), "paused"),
                            Currency = "MYR",
                            DailyBudget = ParseBudget(fbCampaign, "daily_budget"),
                            LifetimeBudget = ParseBudget(fbCampaign, "lifetime_budget"),
                            TotalBudget = ParseBudget(fbCampaign, "lifetime_budget") ?? (ParseBudget(fbCampaign, "daily_budget") is decimal daily ? daily * 7 : null),
                            StartDate = ParseUtcDateTime(fbCampaign, "start_time"),
                            EndDate = ParseUtcDateTime(fbCampaign, "stop_time"),
                            PlatformCampaignIds = JsonSerializer.SerializeToElement(new { facebook = fbCampaignId }),
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        };
                        db.Campaigns.Add(campaign);
                    }

                    campaignEntities.Add((fbCampaignId, campaign));
                }

                // Soft-delete campaigns no longer returned by Facebook
                foreach (var stale in existingCampaigns.Values.Where(c => !seenFbCampaignIds.Contains(c.FacebookCampaignId!) && c.Status != "archived"))
                {
                    stale.Status = "archived";
                    stale.UpdatedAt = DateTime.UtcNow;
                }

                await db.SaveChangesAsync(ct);
                summary.Campaigns = campaignEntities.Count;

                var campaignMap = campaignEntities.ToDictionary(x => x.FacebookId, x => x.Entity.Id);

                // ── AD SETS: upsert by facebook_ad_set_id ────────────────────────────
                var existingAdSets = await db.AdSets
                    .Where(a => a.CompanyId == companyId && a.FacebookAdSetId != null)
                    .ToDictionaryAsync(a => a.FacebookAdSetId!, ct);

                var adSetsUrl = $"https://graph.facebook.com/v19.0/{adAccountId}/adsets?fields=id,name,status,campaign_id,daily_budget,lifetime_budget,bid_strategy,bid_amount,optimization_goal,billing_event,start_time,end_time&limit=200&access_token={accessToken}";
                var fbAdSets = await FetchGraphCollectionAsync(adSetsUrl, ct);
                var adSetEntities = new List<(string FacebookId, string CampaignFacebookId, AdSet Entity)>();
                var seenFbAdSetIds = new HashSet<string>();

                foreach (var fbAdSet in fbAdSets)
                {
                    var fbAdSetId = GetString(fbAdSet, "id");
                    var fbCampaignId = GetString(fbAdSet, "campaign_id");
                    if (string.IsNullOrWhiteSpace(fbAdSetId) || string.IsNullOrWhiteSpace(fbCampaignId) || !campaignMap.TryGetValue(fbCampaignId, out var dbCampaignId))
                    {
                        continue;
                    }

                    seenFbAdSetIds.Add(fbAdSetId);
                    AdSet adSet;

                    if (existingAdSets.TryGetValue(fbAdSetId, out var existingAdSet))
                    {
                        existingAdSet.CampaignId = dbCampaignId;
                        existingAdSet.Name = GetString(fbAdSet, "name") ?? "Untitled Ad Set";
                        existingAdSet.Status = NormalizeFacebookStatus(GetString(fbAdSet, "status"), "paused");
                        existingAdSet.DailyBudget = ParseBudget(fbAdSet, "daily_budget");
                        existingAdSet.LifetimeBudget = ParseBudget(fbAdSet, "lifetime_budget");
                        existingAdSet.BidStrategy = GetString(fbAdSet, "bid_strategy");
                        existingAdSet.BidAmount = ParseBudget(fbAdSet, "bid_amount", divideBy100: false);
                        existingAdSet.OptimizationGoal = GetString(fbAdSet, "optimization_goal");
                        existingAdSet.BillingEvent = GetString(fbAdSet, "billing_event") ?? "IMPRESSIONS";
                        existingAdSet.StartTime = ParseUtcDateTime(fbAdSet, "start_time");
                        existingAdSet.EndTime = ParseUtcDateTime(fbAdSet, "end_time");
                        existingAdSet.PlatformAdSetIds = JsonSerializer.SerializeToElement(new { facebook = fbAdSetId });
                        existingAdSet.UpdatedAt = DateTime.UtcNow;
                        adSet = existingAdSet;
                    }
                    else
                    {
                        adSet = new AdSet
                        {
                            CompanyId = companyId,
                            CampaignId = dbCampaignId,
                            FacebookAdSetId = fbAdSetId,
                            Name = GetString(fbAdSet, "name") ?? "Untitled Ad Set",
                            Status = NormalizeFacebookStatus(GetString(fbAdSet, "status"), "paused"),
                            DailyBudget = ParseBudget(fbAdSet, "daily_budget"),
                            LifetimeBudget = ParseBudget(fbAdSet, "lifetime_budget"),
                            BidStrategy = GetString(fbAdSet, "bid_strategy"),
                            BidAmount = ParseBudget(fbAdSet, "bid_amount", divideBy100: false),
                            OptimizationGoal = GetString(fbAdSet, "optimization_goal"),
                            BillingEvent = GetString(fbAdSet, "billing_event") ?? "IMPRESSIONS",
                            StartTime = ParseUtcDateTime(fbAdSet, "start_time"),
                            EndTime = ParseUtcDateTime(fbAdSet, "end_time"),
                            PlatformAdSetIds = JsonSerializer.SerializeToElement(new { facebook = fbAdSetId }),
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        };
                        db.AdSets.Add(adSet);
                    }

                    adSetEntities.Add((fbAdSetId, fbCampaignId, adSet));
                }

                // Soft-delete ad sets no longer returned by Facebook
                foreach (var stale in existingAdSets.Values.Where(a => !seenFbAdSetIds.Contains(a.FacebookAdSetId!) && a.Status != "archived"))
                {
                    stale.Status = "archived";
                    stale.UpdatedAt = DateTime.UtcNow;
                }

                await db.SaveChangesAsync(ct);
                summary.AdSets = adSetEntities.Count;

                var adSetMap = adSetEntities.ToDictionary(x => x.FacebookId, x => (CampaignId: x.Entity.CampaignId, AdSetId: x.Entity.Id));

                // ── ADS: upsert by facebook_ad_id ─────────────────────────────────────
                var existingAds = await db.Ads
                    .Where(a => a.CompanyId == companyId && a.FacebookAdId != null)
                    .ToDictionaryAsync(a => a.FacebookAdId!, ct);

                var adsUrl = $"https://graph.facebook.com/v19.0/{adAccountId}/ads?fields=id,name,status,effective_status,campaign_id,adset_id&limit=200&access_token={accessToken}";
                var fbAds = await FetchGraphCollectionAsync(adsUrl, ct);
                var adEntities = new List<(string FacebookId, int CampaignId, int AdSetId, Ad Entity)>();
                var seenFbAdIds = new HashSet<string>();

                foreach (var fbAd in fbAds)
                {
                    var fbAdId = GetString(fbAd, "id");
                    var fbAdSetId = GetString(fbAd, "adset_id");
                    if (string.IsNullOrWhiteSpace(fbAdId) || string.IsNullOrWhiteSpace(fbAdSetId) || !adSetMap.TryGetValue(fbAdSetId, out var adSetInfo))
                    {
                        continue;
                    }

                    seenFbAdIds.Add(fbAdId);
                    Ad ad;

                    if (existingAds.TryGetValue(fbAdId, out var existingAd))
                    {
                        existingAd.AdSetId = adSetInfo.AdSetId;
                        existingAd.Name = GetString(fbAd, "name") ?? "Untitled Ad";
                        existingAd.Status = NormalizeFacebookStatus(GetString(fbAd, "effective_status") ?? GetString(fbAd, "status"), "paused");
                        existingAd.PlatformAdIds = JsonSerializer.SerializeToElement(new { facebook = fbAdId });
                        existingAd.UpdatedAt = DateTime.UtcNow;
                        ad = existingAd;
                    }
                    else
                    {
                        ad = new Ad
                        {
                            CompanyId = companyId,
                            AdSetId = adSetInfo.AdSetId,
                            FacebookAdId = fbAdId,
                            Name = GetString(fbAd, "name") ?? "Untitled Ad",
                            Status = NormalizeFacebookStatus(GetString(fbAd, "effective_status") ?? GetString(fbAd, "status"), "paused"),
                            PlatformAdIds = JsonSerializer.SerializeToElement(new { facebook = fbAdId }),
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        };
                        db.Ads.Add(ad);
                    }

                    adEntities.Add((fbAdId, adSetInfo.CampaignId, adSetInfo.AdSetId, ad));
                }

                // Soft-delete ads no longer returned by Facebook
                foreach (var stale in existingAds.Values.Where(a => !seenFbAdIds.Contains(a.FacebookAdId!) && a.Status != "archived"))
                {
                    stale.Status = "archived";
                    stale.UpdatedAt = DateTime.UtcNow;
                }

                await db.SaveChangesAsync(ct);
                summary.Ads = adEntities.Count;

                var adMap = adEntities.ToDictionary(
                    x => x.FacebookId,
                    x => (CampaignId: x.CampaignId, AdSetId: x.AdSetId, AdId: x.Entity.Id));

                summary.MetricRows += await SyncAccountInsightsAsync(
                    db,
                    companyId,
                    adAccountId,
                    accessToken,
                    "ad",
                    $"campaign_id,adset_id,ad_id,ad_name,impressions,reach,clicks,spend,ctr,cpc,cpm,frequency,actions,video_30_sec_watched_actions,video_avg_time_watched_actions,date_start,date_stop",
                    row =>
                    {
                        var fbAdId = GetString(row, "ad_id");
                        return !string.IsNullOrWhiteSpace(fbAdId) && adMap.TryGetValue(fbAdId, out var ids)
                            ? (ids.CampaignId, (int?)ids.AdSetId, (int?)ids.AdId)
                            : ((int?)null, (int?)null, (int?)null);
                    },
                    ct);

                _logger.LogInformation("[FB SYNC] Company {CompanyId}: {Campaigns} campaigns, {AdSets} ad sets, {Ads} ads, {MetricRows} metric rows",
                    companyId, summary.Campaigns, summary.AdSets, summary.Ads, summary.MetricRows);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[FB SYNC] Failed for company {CompanyId}", companyId);
                await AppendFacebookMetricsLogAsync(companyId, null, null, account.AccountId, ex.Message, ct);
                throw;
            }

            return summary;
        }

        private async Task FetchAllMetrics(CancellationToken ct)
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            // Sync Facebook for every company with an active FB ad account — does not
            // require existing active campaigns in DB (the sync imports them from Graph).
            var facebookCompanyIds = await db.CompanyAdAccounts
                .Where(a => a.Platform == "facebook" && a.Status == "active")
                .Select(a => a.CompanyId)
                .Distinct()
                .ToListAsync(ct);

            foreach (var companyId in facebookCompanyIds)
            {
                try
                {
                    await SyncFacebookDataForCompany(companyId, ct);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to sync Facebook data for company {CompanyId}", companyId);
                }
            }

            // Non-Facebook platforms still piggy-back on existing active campaigns
            // (they use simulated metrics; the campaign is the hook).
            var activeCampaigns = await db.Campaigns
                .Where(c => c.Status == "active")
                .ToListAsync(ct);

            foreach (var campaign in activeCampaigns)
            {
                var adAccounts = await db.CompanyAdAccounts
                    .Where(a => a.CompanyId == campaign.CompanyId && a.Status == "active" && a.Platform != "facebook")
                    .ToListAsync(ct);

                foreach (var account in adAccounts)
                {
                    if (!campaign.Platforms.Contains(account.Platform))
                        continue;

                    // GoogleAdsSyncService owns google_ads — skip here to avoid double-handling.
                    if (account.Platform == "google_ads")
                        continue;

                    try
                    {
                        await FetchPlatformMetrics(db, campaign, account, ct);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to fetch {Platform} metrics for campaign {CampaignId}", account.Platform, campaign.Id);
                    }
                }
            }

            await db.SaveChangesAsync(ct);
            _logger.LogInformation("Metrics fetch cycle completed — FB companies: {FbCount}, non-FB campaigns: {CampaignCount}",
                facebookCompanyIds.Count, activeCampaigns.Count);
        }

        private async Task RunFetchCycleAsync(string trigger, CancellationToken stoppingToken)
        {
            CancellationTokenSource? runCts;
            lock (_stateLock)
            {
                _manualRunRequested = false;
                _isRunning = true;
                _lastRunTrigger = trigger;
                _lastRunStartedAt = DateTime.UtcNow;
                _lastRunOutcome = null;
                _lastError = null;
                _activeRunCts = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
                runCts = _activeRunCts;
            }

            try
            {
                await FetchAllMetrics(runCts.Token);
                lock (_stateLock)
                {
                    _lastRunCompletedAt = DateTime.UtcNow;
                    _lastSuccessfulRunAt = _lastRunCompletedAt;
                    _lastRunOutcome = "succeeded";
                }

                try
                {
                    await _summaryService.RefreshAsync(runCts.Token);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to refresh ad_metrics_summary after fetch cycle");
                }
            }
            catch (OperationCanceledException) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogInformation("Metrics fetch cycle was cancelled");
                lock (_stateLock)
                {
                    _lastRunCompletedAt = DateTime.UtcNow;
                    _lastFailedRunAt = _lastRunCompletedAt;
                    _lastRunOutcome = "cancelled";
                    _lastError = "Run cancelled.";
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching metrics");
                lock (_stateLock)
                {
                    _lastRunCompletedAt = DateTime.UtcNow;
                    _lastFailedRunAt = _lastRunCompletedAt;
                    _lastRunOutcome = "failed";
                    _lastError = ex.Message;
                }
            }
            finally
            {
                lock (_stateLock)
                {
                    _isRunning = false;
                    if (ReferenceEquals(_activeRunCts, runCts))
                    {
                        _activeRunCts = null;
                    }
                }

                runCts?.Dispose();
            }
        }

        private bool IsEnabled()
        {
            lock (_stateLock)
            {
                return _isEnabled;
            }
        }

        private bool ShouldRunManual()
        {
            lock (_stateLock)
            {
                return _manualRunRequested;
            }
        }

        private TimeSpan GetInterval()
        {
            lock (_stateLock)
            {
                return _interval;
            }
        }

        private void SignalLoop()
        {
            try
            {
                _wakeSignal.Release();
            }
            catch (SemaphoreFullException)
            {
            }
        }

        private static async Task ObserveCanceledTaskAsync(Task task)
        {
            try
            {
                await task;
            }
            catch (OperationCanceledException)
            {
            }
        }

        private async Task FetchPlatformMetrics(AppDbContext db, Campaign campaign, CompanyAdAccount account, CancellationToken ct)
        {
            var now = DateTime.UtcNow;
            var dayStart = now.Date;
            var dayEnd = dayStart.AddDays(1);
            var existing = await db.AdMetrics.FirstOrDefaultAsync(
                m => m.CampaignId == campaign.Id && m.Platform == account.Platform && m.Date >= dayStart && m.Date < dayEnd,
                ct);

            if (existing != null)
            {
                _logger.LogDebug("Metrics already fetched today for campaign {Id} on {Platform}", campaign.Id, account.Platform);
                return;
            }

            GenerateSimulatedMetrics(db, campaign, account, now);
        }

        // Called manually via API to force-refresh metrics for one campaign.
        public async Task FetchMetricsForCampaign(int campaignId)
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var campaign = await db.Campaigns.FirstOrDefaultAsync(c => c.Id == campaignId);
            if (campaign == null)
            {
                return;
            }

            if (campaign.Platforms.Contains("facebook"))
            {
                await SyncFacebookDataForCompany(campaign.CompanyId, CancellationToken.None);
                return;
            }

            var adAccounts = await db.CompanyAdAccounts.Where(a => a.CompanyId == campaign.CompanyId && a.Status == "active").ToListAsync();
            var now = DateTime.UtcNow;

            foreach (var account in adAccounts)
            {
                if (!campaign.Platforms.Contains(account.Platform))
                {
                    continue;
                }

                if (account.Platform != "facebook")
                {
                    GenerateSimulatedMetrics(db, campaign, account, now);
                }
            }

            await db.SaveChangesAsync();
        }

        private async Task ClearFacebookDataAsync(AppDbContext db, int companyId, CancellationToken ct)
        {
            // ad_metrics and ad_metrics_summary are never deleted — they are historical records.
            var existingCampaigns = await db.Campaigns
                .Where(c => c.CompanyId == companyId && c.Platforms.Contains("facebook"))
                .Select(c => new { c.Id, c.PlatformCampaignIds })
                .ToListAsync(ct);

            var existingCampaignIds = existingCampaigns
                .Where(c => TryGetFacebookPlatformId(c.PlatformCampaignIds) != null)
                .Select(c => c.Id)
                .ToList();

            if (existingCampaignIds.Count == 0) return;

            var existingAdSetIds = await db.AdSets
                .Where(a => existingCampaignIds.Contains(a.CampaignId))
                .Select(a => a.Id)
                .ToListAsync(ct);

            var existingAdIds = await db.Ads
                .Where(a => existingAdSetIds.Contains(a.AdSetId))
                .Select(a => a.Id)
                .ToListAsync(ct);

            db.ApprovalComments.RemoveRange(db.ApprovalComments.Where(a => existingCampaignIds.Contains(a.CampaignId)));
            db.AbTests.RemoveRange(db.AbTests.Where(a => existingCampaignIds.Contains(a.CampaignId)));
            db.AdCreatives.RemoveRange(db.AdCreatives.Where(a => existingAdIds.Contains(a.AdId)));
            db.Ads.RemoveRange(db.Ads.Where(a => existingAdSetIds.Contains(a.AdSetId)));
            db.AdSets.RemoveRange(db.AdSets.Where(a => existingCampaignIds.Contains(a.CampaignId)));
            db.CmoQueue.RemoveRange(db.CmoQueue.Where(q => q.CampaignId != null && existingCampaignIds.Contains(q.CampaignId.Value)));
            db.PppQueue.RemoveRange(db.PppQueue.Where(q => q.CampaignId != null && existingCampaignIds.Contains(q.CampaignId.Value)));
            db.DeploymentLogs.RemoveRange(db.DeploymentLogs.Where(d => d.CompanyId == companyId && d.Platform == "facebook"));
            db.CampaignWorkflowSteps.RemoveRange(db.CampaignWorkflowSteps.Where(s => existingCampaignIds.Contains(s.CampaignId)));
            db.Campaigns.RemoveRange(db.Campaigns.Where(c => existingCampaignIds.Contains(c.Id)));
            await db.SaveChangesAsync(ct);
        }

        private async Task<int> SyncAccountInsightsAsync(
            AppDbContext db,
            int companyId,
            string adAccountId,
            string accessToken,
            string level,
            string fields,
            Func<JsonElement, (int? CampaignId, int? AdSetId, int? AdId)> mapIds,
            CancellationToken ct)
        {
            // Primary: hourly breakdown for last 7 days — real per-hour buckets only.
            var hourlyUrl = $"https://graph.facebook.com/v19.0/{adAccountId}/insights" +
                $"?level={level}&fields={fields}" +
                $"&breakdowns=hourly_stats_aggregated_by_advertiser_time_zone" +
                $"&date_preset=last_7d&limit=500&access_token={accessToken}";

            var hourlyRows = await FetchGraphCollectionAsync(hourlyUrl, ct);

            // date_preset=last_7d excludes the current day — fetch today separately so
            // any ad that delivered today gets its real hourly rows.
            var todayUrl = $"https://graph.facebook.com/v19.0/{adAccountId}/insights" +
                $"?level={level}&fields={fields}" +
                $"&breakdowns=hourly_stats_aggregated_by_advertiser_time_zone" +
                $"&date_preset=today&limit=500&access_token={accessToken}";

            var todayRows = await FetchGraphCollectionAsync(todayUrl, ct);
            var allHourlyRows = hourlyRows.Concat(todayRows).ToList();

            _logger.LogInformation("[FB SYNC] Fetched {Last7d} last_7d + {Today} today rows for {AdAccountId}",
                hourlyRows.Count, todayRows.Count, adAccountId);

            if (allHourlyRows.Count == 0)
            {
                _logger.LogInformation("[FB SYNC] No {Level} insights returned for account {AdAccountId}", level, adAccountId);
                return 0;
            }

            // Preload existing FB rows in a wide window so we can upsert by (campaign, adset, ad, date).
            // Historical rows are never deleted; only matching-key rows are refreshed in place.
            var windowStart = DateTime.UtcNow.AddDays(-14);
            var existingMetrics = await db.AdMetrics
                .Where(m => m.CompanyId == companyId && m.Platform == "facebook" && m.Date >= windowStart)
                .ToListAsync(ct);
            var existingByKey = existingMetrics.ToDictionary(
                m => (m.CampaignId, m.AdSetId ?? 0, m.AdId ?? 0, m.Date),
                m => m);

            var count = 0;

            // Store only real hourly rows — no synthetic lifetime snapshots.
            foreach (var row in allHourlyRows)
            {
                var ids = mapIds(row);
                if (!ids.CampaignId.HasValue)
                {
                    continue;
                }

                var metricDate = ParseHourlyBucket(row);
                if (metricDate == null)
                {
                    continue;
                }

                var impressions = ParseLong(row, "impressions");
                var reach = ParseLong(row, "reach");
                var clicks = ParseLong(row, "clicks");
                var spend = ParseDecimal(row, "spend");
                var ctr = ParseDecimal(row, "ctr");
                var cpc = ParseDecimal(row, "cpc");
                var cpm = ParseDecimal(row, "cpm");
                var frequency = ParseDecimal(row, "frequency");
                var videoViews = SumActionValues(row, "video_30_sec_watched_actions");
                var conversions = SumFilteredActions(row, "actions", "link_click");

                // Engagement fields from the actions array
                var likes = SumFilteredActions(row, "actions", "post_reaction");
                var comments = SumFilteredActions(row, "actions", "comment");
                var shares = SumFilteredActions(row, "actions", "share");
                var saves = SumFilteredActions(row, "actions", "onsite_conversion.post_save");
                var avgWatchSec = AverageActionValue(row, "video_avg_time_watched_actions");

                var key = (ids.CampaignId.Value, ids.AdSetId ?? 0, ids.AdId ?? 0, metricDate.Value);

                // Upsert: refresh existing row if (campaign, adset, ad, date) already present,
                // otherwise insert a new row. Different timestamps = new rows, so history accumulates.
                if (existingByKey.TryGetValue(key, out var metric))
                {
                    metric.Impressions = impressions;
                    metric.Reach = reach;
                    metric.Clicks = clicks;
                    metric.Spend = spend;
                    metric.Ctr = Math.Round(ctr, 6);
                    metric.Cpc = Math.Round(cpc, 4);
                    metric.Cpm = Math.Round(cpm, 4);
                    metric.Frequency = Math.Round(frequency, 2);
                    metric.VideoViews = videoViews > 0 ? videoViews : null;
                    metric.Conversions = conversions;
                    metric.Likes = likes > 0 ? likes : null;
                    metric.Comments = comments > 0 ? comments : null;
                    metric.Shares = shares > 0 ? shares : null;
                    metric.Saves = saves > 0 ? saves : null;
                    metric.AvgWatchSeconds = avgWatchSec > 0 ? Math.Round(avgWatchSec, 2) : null;
                    metric.FetchedAt = DateTime.UtcNow;
                }
                else
                {
                    metric = new AdMetric
                    {
                        CompanyId = companyId,
                        CampaignId = ids.CampaignId.Value,
                        AdSetId = ids.AdSetId,
                        AdId = ids.AdId,
                        Platform = "facebook",
                        Date = metricDate.Value,
                        Impressions = impressions,
                        Reach = reach,
                        Clicks = clicks,
                        Spend = spend,
                        Ctr = Math.Round(ctr, 6),
                        Cpc = Math.Round(cpc, 4),
                        Cpm = Math.Round(cpm, 4),
                        Frequency = Math.Round(frequency, 2),
                        VideoViews = videoViews > 0 ? videoViews : null,
                        Conversions = conversions,
                        Likes = likes > 0 ? likes : null,
                        Comments = comments > 0 ? comments : null,
                        Shares = shares > 0 ? shares : null,
                        Saves = saves > 0 ? saves : null,
                        AvgWatchSeconds = avgWatchSec > 0 ? Math.Round(avgWatchSec, 2) : null,
                        FetchedAt = DateTime.UtcNow
                    };
                    db.AdMetrics.Add(metric);
                    existingByKey[key] = metric;
                }

                if (spend > 0 && conversions > 0)
                {
                    metric.ConversionValue = conversions * 10m;
                    metric.Roas = Math.Round(metric.ConversionValue / spend, 4);
                }

                count++;
            }

            await db.SaveChangesAsync(ct);
            return count;
        }

        // Combine date_start (day) with the hourly_stats breakdown ("HH:MM:SS - HH:MM:SS")
        // into a UTC timestamp for that hour bucket.
        // IMPORTANT: date_start is in the advertiser's local timezone. We must NOT apply
        // any server-local timezone conversion — parse it as a pure calendar date so the
        // stored value always matches what Facebook reported (e.g. "2026-04-26" + hour 8
        // → 2026-04-26 08:00 UTC regardless of server TZ offset).
        private static DateTime? ParseHourlyBucket(JsonElement row)
        {
            var dateStart = GetString(row, "date_start");
            if (string.IsNullOrWhiteSpace(dateStart))
            {
                return null;
            }

            // Parse the calendar date without any timezone shift.
            if (!DateOnly.TryParseExact(dateStart, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var dateOnly))
            {
                return null;
            }

            var day = new DateTime(dateOnly.Year, dateOnly.Month, dateOnly.Day, 0, 0, 0, DateTimeKind.Utc);

            var hourRange = GetString(row, "hourly_stats_aggregated_by_advertiser_time_zone");
            if (string.IsNullOrWhiteSpace(hourRange))
            {
                return day;
            }

            // Format: "HH:MM:SS - HH:MM:SS"
            var separator = hourRange.IndexOf(" - ", StringComparison.Ordinal);
            var startPart = separator > 0 ? hourRange[..separator] : hourRange;
            if (!int.TryParse(startPart.Split(':')[0], out var hour) || hour < 0 || hour > 23)
            {
                return day;
            }

            return day.AddHours(hour);
        }

        private static decimal AverageActionValue(JsonElement row, string propertyName)
        {
            if (!row.TryGetProperty(propertyName, out var actions) || actions.ValueKind != JsonValueKind.Array)
            {
                return 0m;
            }

            decimal total = 0m;
            int n = 0;
            foreach (var action in actions.EnumerateArray())
            {
                if (decimal.TryParse(GetString(action, "value"), NumberStyles.Any, CultureInfo.InvariantCulture, out var parsed))
                {
                    total += parsed;
                    n++;
                }
            }
            return n > 0 ? total / n : 0m;
        }

        private async Task<List<JsonElement>> FetchGraphCollectionAsync(string url, CancellationToken ct)
        {
            var items = new List<JsonElement>();
            string? nextUrl = url;

            while (!string.IsNullOrWhiteSpace(nextUrl))
            {
                var response = await _httpClient.GetAsync(nextUrl, ct);
                var body = await response.Content.ReadAsStringAsync(ct);

                if (!response.IsSuccessStatusCode)
                {
                    throw new InvalidOperationException(body);
                }

                var json = JsonSerializer.Deserialize<JsonElement>(body);
                if (!json.TryGetProperty("data", out var data))
                {
                    break;
                }

                foreach (var item in data.EnumerateArray())
                {
                    items.Add(item.Clone());
                }

                nextUrl = null;
                if (json.TryGetProperty("paging", out var paging) &&
                    paging.TryGetProperty("next", out var nextElement) &&
                    !string.IsNullOrWhiteSpace(nextElement.GetString()))
                {
                    nextUrl = nextElement.GetString();
                }
            }

            return items;
        }

        private static string? GetUsableFacebookAccessToken(string? token)
        {
            if (string.IsNullOrWhiteSpace(token)) return null;
            if (token.StartsWith("YOUR_", StringComparison.OrdinalIgnoreCase)) return null;
            if (token.StartsWith("demo_", StringComparison.OrdinalIgnoreCase)) return null;
            if (token.StartsWith("mock_", StringComparison.OrdinalIgnoreCase)) return null;
            return token.Length >= 30 ? token : null;
        }

        private static string? GetString(JsonElement element, string propertyName)
        {
            return element.TryGetProperty(propertyName, out var property) ? property.GetString() : null;
        }

        private static decimal? ParseBudget(JsonElement element, string propertyName, bool divideBy100 = true)
        {
            var value = ParseDecimal(element, propertyName);
            if (value <= 0) return null;
            return divideBy100 ? value / 100m : value;
        }

        private static decimal ParseDecimal(JsonElement element, string propertyName)
        {
            if (!element.TryGetProperty(propertyName, out var property))
            {
                return 0m;
            }

            var raw = property.GetString();
            return decimal.TryParse(raw, NumberStyles.Any, CultureInfo.InvariantCulture, out var parsed) ? parsed : 0m;
        }

        private static long ParseLong(JsonElement element, string propertyName)
        {
            if (!element.TryGetProperty(propertyName, out var property))
            {
                return 0;
            }

            var raw = property.GetString();
            return long.TryParse(raw, NumberStyles.Any, CultureInfo.InvariantCulture, out var parsed) ? parsed : 0;
        }

        private static DateTime? ParseUtcDateTime(JsonElement element, string propertyName)
        {
            if (!element.TryGetProperty(propertyName, out var property))
            {
                return null;
            }

            return DateTime.TryParse(property.GetString(), CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal, out var parsed)
                ? DateTime.SpecifyKind(parsed, DateTimeKind.Utc)
                : null;
        }

        private static int SumFilteredActions(JsonElement row, string propertyName, string actionType)
        {
            if (!row.TryGetProperty(propertyName, out var actions) || actions.ValueKind != JsonValueKind.Array)
            {
                return 0;
            }

            var total = 0;
            foreach (var action in actions.EnumerateArray())
            {
                if (GetString(action, "action_type") != actionType)
                {
                    continue;
                }

                if (int.TryParse(GetString(action, "value"), NumberStyles.Any, CultureInfo.InvariantCulture, out var parsed))
                {
                    total += parsed;
                }
            }

            return total;
        }

        private static long SumActionValues(JsonElement row, string propertyName)
        {
            if (!row.TryGetProperty(propertyName, out var actions) || actions.ValueKind != JsonValueKind.Array)
            {
                return 0;
            }

            long total = 0;
            foreach (var action in actions.EnumerateArray())
            {
                if (long.TryParse(GetString(action, "value"), NumberStyles.Any, CultureInfo.InvariantCulture, out var parsed))
                {
                    total += parsed;
                }
            }

            return total;
        }

        private static string NormalizeFacebookStatus(string? status, string fallback)
        {
            return status?.ToUpperInvariant() switch
            {
                "ACTIVE" => "active",
                "PAUSED" => "paused",
                "ARCHIVED" => "archived",
                "DELETED" => "deleted",
                "PENDING_REVIEW" => "pending_review",
                "DISAPPROVED" => "rejected",
                _ => fallback
            };
        }

        private static string? TryGetFacebookPlatformId(JsonElement? json)
        {
            if (!json.HasValue)
            {
                return null;
            }

            return json.Value.TryGetProperty("facebook", out var value) ? value.GetString() : null;
        }

        private static string GetFacebookMetricsLogPath()
        {
            var logDirectory = Path.Combine(AppContext.BaseDirectory, "logs");
            Directory.CreateDirectory(logDirectory);
            return Path.Combine(logDirectory, "facebook-metrics.log");
        }

        private static async Task AppendFacebookMetricsLogAsync(
            int companyId,
            int? campaignId,
            int? adSetId,
            string? accountId,
            string reason,
            CancellationToken ct)
        {
            var line = $"[{DateTime.UtcNow:O}] companyId={companyId} campaignId={campaignId?.ToString() ?? "n/a"} adSetId={adSetId?.ToString() ?? "n/a"} accountId={accountId ?? "n/a"} reason={reason}{Environment.NewLine}";
            await File.AppendAllTextAsync(GetFacebookMetricsLogPath(), line, ct);
        }

        private void GenerateSimulatedMetrics(AppDbContext db, Campaign campaign, CompanyAdAccount account, DateTime timestamp)
        {
            var metric = new AdMetric
            {
                CompanyId = campaign.CompanyId,
                CampaignId = campaign.Id,
                Platform = account.Platform,
                Date = timestamp,
                Impressions = Random.Shared.Next(1000, 50000),
                Reach = Random.Shared.Next(800, 40000),
                Clicks = Random.Shared.Next(50, 2000),
                Spend = Math.Round((decimal)(Random.Shared.NextDouble() * (double)(campaign.DailyBudget ?? 100)), 2),
                Conversions = Random.Shared.Next(0, 50),
                FetchedAt = DateTime.UtcNow
            };

            if (metric.Impressions > 0)
            {
                metric.Ctr = Math.Round((decimal)metric.Clicks / metric.Impressions, 4);
                metric.Cpm = Math.Round(metric.Spend / metric.Impressions * 1000, 4);
            }

            if (metric.Clicks > 0)
            {
                metric.Cpc = Math.Round(metric.Spend / metric.Clicks, 4);
            }

            if (metric.Spend > 0 && metric.Conversions > 0)
            {
                metric.ConversionValue = metric.Conversions * Random.Shared.Next(10, 100);
                metric.Roas = Math.Round(metric.ConversionValue / metric.Spend, 4);
            }

            if (metric.Reach > 0)
            {
                metric.Frequency = Math.Round((decimal)metric.Impressions / metric.Reach, 2);
            }

            // Simulated engagement + retention so the dashboard isn't blank on non-FB platforms.
            var engagementBase = (long)(metric.Impressions * 0.04);
            metric.Likes = (long)(engagementBase * 0.72);
            metric.Comments = (long)(engagementBase * 0.09);
            metric.Shares = (long)(engagementBase * 0.13);
            metric.Saves = (long)(engagementBase * 0.06);
            metric.FollowersGained = Random.Shared.Next(0, 200);
            metric.AvgWatchSeconds = Math.Round((decimal)(Random.Shared.NextDouble() * 30 + 5), 2);

            db.AdMetrics.Add(metric);
        }
    }
}
