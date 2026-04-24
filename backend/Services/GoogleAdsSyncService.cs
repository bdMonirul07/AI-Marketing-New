using System.Globalization;
using System.Text;
using System.Text.Json;
using Backend.Data;
using Backend.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend.Services
{
    public sealed class GoogleSyncSummary
    {
        public int CompanyId { get; init; }
        public int Campaigns { get; set; }
        public int AdGroups { get; set; }
        public int Ads { get; set; }
        public int MetricRows { get; set; }
    }

    public sealed class GoogleAdsSyncServiceStatus
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

    // Background service that syncs Google Ads campaigns, ad groups, ads, and metrics.
    // Row id=2 in platform_service_settings persists the schedule interval.
    // Falls back to simulated metrics when credentials are placeholder/invalid.
    public class GoogleAdsSyncService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<GoogleAdsSyncService> _logger;
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

        private const int SettingsRowId = 2; // row 1 = Facebook, row 2 = Google

        private const string GoogleAdsApiBase = "https://googleads.googleapis.com/v19";
        private const string GoogleOAuthTokenUrl = "https://oauth2.googleapis.com/token";

        public GoogleAdsSyncService(
            IServiceProvider serviceProvider,
            ILogger<GoogleAdsSyncService> logger,
            IConfiguration config,
            MetricsSummaryService summaryService)
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
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var setting = await db.PlatformServiceSettings.FirstOrDefaultAsync(s => s.Id == SettingsRowId, stoppingToken);
                if (setting != null && setting.IntervalHours > 0)
                    lock (_stateLock) { _interval = TimeSpan.FromHours((double)setting.IntervalHours); }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not load persisted Google Ads Service settings; using default interval.");
            }

            _logger.LogInformation("GoogleAdsSyncService started. Interval: {Interval}h", GetInterval().TotalHours);
            await RunSyncCycleAsync("scheduled", stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                if (ShouldRunManual())
                {
                    await RunSyncCycleAsync("manual", stoppingToken);
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

                await RunSyncCycleAsync("scheduled", stoppingToken);
            }
        }

        public GoogleAdsSyncServiceStatus GetStatus()
        {
            lock (_stateLock)
            {
                return new GoogleAdsSyncServiceStatus
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

        public GoogleAdsSyncServiceStatus StartScheduledExecution()
        {
            lock (_stateLock) { _isEnabled = true; _lastEnabledAt = DateTime.UtcNow; }
            SignalLoop();
            return GetStatus();
        }

        public GoogleAdsSyncServiceStatus StopScheduledExecution()
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

        public GoogleAdsSyncServiceStatus RequestImmediateRun()
        {
            lock (_stateLock) { _manualRunRequested = true; }
            SignalLoop();
            return GetStatus();
        }

        public GoogleAdsSyncServiceStatus SetIntervalHours(double intervalHours)
        {
            lock (_stateLock) { _interval = TimeSpan.FromHours(intervalHours); }
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var setting = db.PlatformServiceSettings.FirstOrDefault(s => s.Id == SettingsRowId);
                if (setting == null)
                {
                    db.PlatformServiceSettings.Add(new PlatformServiceSetting
                    {
                        Id = SettingsRowId,
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
                _logger.LogWarning(ex, "Could not persist Google Ads Service interval; in-memory value still applied.");
            }
            SignalLoop();
            return GetStatus();
        }

        // ── Main sync entry point ────────────────────────────────────────────────
        public async Task<GoogleSyncSummary> SyncGoogleAdsForCompany(int companyId, CancellationToken ct = default)
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var account = await db.CompanyAdAccounts
                .Where(a => a.CompanyId == companyId && a.Platform == "google_ads" && a.Status == "active")
                .OrderByDescending(a => a.UpdatedAt)
                .FirstOrDefaultAsync(ct);

            if (account == null)
            {
                _logger.LogWarning("[GOOGLE SYNC] No active Google Ads account for company {CompanyId}", companyId);
                return new GoogleSyncSummary { CompanyId = companyId };
            }

            var customerId = !string.IsNullOrWhiteSpace(account.CustomerId)
                ? account.CustomerId
                : _config["GoogleAds:CustomerId"];

            var developerToken = !string.IsNullOrWhiteSpace(account.DeveloperToken)
                ? account.DeveloperToken
                : _config["GoogleAds:DeveloperToken"];

            if (string.IsNullOrWhiteSpace(customerId) || !IsUsableGoogleCredential(developerToken))
            {
                _logger.LogWarning("[GOOGLE SYNC] Placeholder credentials for company {CompanyId} — using simulated metrics.", companyId);
                return await GenerateSimulatedGoogleSync(db, companyId, ct);
            }

            // Try to get a fresh access token via OAuth2 refresh token
            var accessToken = await GetAccessTokenAsync(account, ct);
            if (string.IsNullOrWhiteSpace(accessToken))
            {
                _logger.LogWarning("[GOOGLE SYNC] Could not obtain access token for company {CompanyId} — using simulated metrics.", companyId);
                return await GenerateSimulatedGoogleSync(db, companyId, ct);
            }

            var summary = new GoogleSyncSummary { CompanyId = companyId };
            try
            {
                summary.Campaigns = await SyncCampaignsAsync(db, companyId, customerId, developerToken!, accessToken, summary, ct);
                await db.SaveChangesAsync(ct);

                summary.AdGroups = await SyncAdGroupsAsync(db, companyId, customerId, developerToken!, accessToken, summary, ct);
                await db.SaveChangesAsync(ct);

                summary.Ads = await SyncAdsAsync(db, companyId, customerId, developerToken!, accessToken, summary, ct);
                await db.SaveChangesAsync(ct);

                summary.MetricRows = await SyncMetricsAsync(db, companyId, customerId, developerToken!, accessToken, ct);
                await db.SaveChangesAsync(ct);

                _logger.LogInformation("[GOOGLE SYNC] Company {CompanyId}: {Campaigns} campaigns, {AdGroups} ad groups, {Ads} ads, {MetricRows} metric rows",
                    companyId, summary.Campaigns, summary.AdGroups, summary.Ads, summary.MetricRows);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[GOOGLE SYNC] Failed for company {CompanyId}", companyId);
                throw;
            }

            return summary;
        }

        // ── Campaign sync ────────────────────────────────────────────────────────
        private async Task<int> SyncCampaignsAsync(AppDbContext db, int companyId, string customerId,
            string developerToken, string accessToken, GoogleSyncSummary summary, CancellationToken ct)
        {
            const string query = @"
                SELECT campaign.id, campaign.name, campaign.status,
                       campaign.advertising_channel_type,
                       campaign_budget.amount_micros,
                       campaign.start_date, campaign.end_date
                FROM campaign
                WHERE campaign.status != 'REMOVED'
                LIMIT 200";

            var rows = await ExecuteGaqlAsync(customerId, developerToken, accessToken, query, ct);

            var existing = await db.Campaigns
                .Where(c => c.CompanyId == companyId && c.GoogleCampaignId != null)
                .ToDictionaryAsync(c => c.GoogleCampaignId!, ct);

            var seenIds = new HashSet<string>();
            var count = 0;

            foreach (var row in rows)
            {
                var googleId = GetGaqlString(row, "campaign", "id");
                if (string.IsNullOrWhiteSpace(googleId)) continue;
                seenIds.Add(googleId);

                var name = GetGaqlString(row, "campaign", "name") ?? "Untitled";
                var status = NormalizeGoogleStatus(GetGaqlString(row, "campaign", "status"));
                var budgetMicros = GetGaqlLong(row, "campaignBudget", "amountMicros");
                var dailyBudget = budgetMicros > 0 ? (decimal)budgetMicros / 1_000_000m : (decimal?)null;
                var startDate = ParseGaqlDate(GetGaqlString(row, "campaign", "startDate"));
                var endDate = ParseGaqlDate(GetGaqlString(row, "campaign", "endDate"));

                if (existing.TryGetValue(googleId, out var camp))
                {
                    camp.Name = name;
                    camp.Status = status;
                    camp.DailyBudget = dailyBudget;
                    camp.TotalBudget = dailyBudget.HasValue ? dailyBudget * 30 : null;
                    camp.StartDate = startDate;
                    camp.EndDate = endDate;
                    camp.UpdatedAt = DateTime.UtcNow;
                }
                else
                {
                    camp = new Campaign
                    {
                        CompanyId = companyId,
                        GoogleCampaignId = googleId,
                        Name = name,
                        CampaignType = "search",
                        Platforms = new[] { "google_ads" },
                        Status = status,
                        Currency = "MYR",
                        DailyBudget = dailyBudget,
                        TotalBudget = dailyBudget.HasValue ? dailyBudget * 30 : null,
                        StartDate = startDate,
                        EndDate = endDate,
                        PlatformCampaignIds = JsonSerializer.SerializeToElement(new { google_ads = googleId }),
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    db.Campaigns.Add(camp);
                }
                count++;
            }

            // Soft-delete campaigns removed from Google
            foreach (var stale in existing.Values.Where(c => !seenIds.Contains(c.GoogleCampaignId!) && c.Status != "archived"))
            {
                stale.Status = "archived";
                stale.UpdatedAt = DateTime.UtcNow;
            }

            return count;
        }

        // ── Ad Group sync ────────────────────────────────────────────────────────
        private async Task<int> SyncAdGroupsAsync(AppDbContext db, int companyId, string customerId,
            string developerToken, string accessToken, GoogleSyncSummary summary, CancellationToken ct)
        {
            const string query = @"
                SELECT ad_group.id, ad_group.name, ad_group.status,
                       campaign.id,
                       ad_group.cpc_bid_micros
                FROM ad_group
                WHERE ad_group.status != 'REMOVED'
                LIMIT 500";

            var rows = await ExecuteGaqlAsync(customerId, developerToken, accessToken, query, ct);

            var campaignMap = await db.Campaigns
                .Where(c => c.CompanyId == companyId && c.GoogleCampaignId != null)
                .ToDictionaryAsync(c => c.GoogleCampaignId!, c => c.Id, ct);

            var existing = await db.AdSets
                .Where(a => a.CompanyId == companyId && a.GoogleAdGroupId != null)
                .ToDictionaryAsync(a => a.GoogleAdGroupId!, ct);

            var seenIds = new HashSet<string>();
            var count = 0;

            foreach (var row in rows)
            {
                var googleAdGroupId = GetGaqlString(row, "adGroup", "id");
                var googleCampaignId = GetGaqlString(row, "campaign", "id");
                if (string.IsNullOrWhiteSpace(googleAdGroupId) || string.IsNullOrWhiteSpace(googleCampaignId)) continue;
                if (!campaignMap.TryGetValue(googleCampaignId, out var dbCampaignId)) continue;

                seenIds.Add(googleAdGroupId);
                var name = GetGaqlString(row, "adGroup", "name") ?? "Untitled Ad Group";
                var status = NormalizeGoogleStatus(GetGaqlString(row, "adGroup", "status"));
                var cpcMicros = GetGaqlLong(row, "adGroup", "cpcBidMicros");
                var bidAmount = cpcMicros > 0 ? (decimal)cpcMicros / 1_000_000m : (decimal?)null;

                if (existing.TryGetValue(googleAdGroupId, out var adSet))
                {
                    adSet.CampaignId = dbCampaignId;
                    adSet.Name = name;
                    adSet.Status = status;
                    adSet.BidAmount = bidAmount;
                    adSet.UpdatedAt = DateTime.UtcNow;
                }
                else
                {
                    adSet = new AdSet
                    {
                        CompanyId = companyId,
                        CampaignId = dbCampaignId,
                        GoogleAdGroupId = googleAdGroupId,
                        Name = name,
                        Status = status,
                        BidAmount = bidAmount,
                        BidStrategy = "MANUAL_CPC",
                        OptimizationGoal = "CLICKS",
                        BillingEvent = "CLICKS",
                        PlatformAdSetIds = JsonSerializer.SerializeToElement(new { google_ads = googleAdGroupId }),
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    db.AdSets.Add(adSet);
                }
                count++;
            }

            foreach (var stale in existing.Values.Where(a => !seenIds.Contains(a.GoogleAdGroupId!) && a.Status != "archived"))
            {
                stale.Status = "archived";
                stale.UpdatedAt = DateTime.UtcNow;
            }

            return count;
        }

        // ── Ad sync ──────────────────────────────────────────────────────────────
        private async Task<int> SyncAdsAsync(AppDbContext db, int companyId, string customerId,
            string developerToken, string accessToken, GoogleSyncSummary summary, CancellationToken ct)
        {
            const string query = @"
                SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.status,
                       ad_group.id
                FROM ad_group_ad
                WHERE ad_group_ad.status != 'REMOVED'
                LIMIT 500";

            var rows = await ExecuteGaqlAsync(customerId, developerToken, accessToken, query, ct);

            var adGroupMap = await db.AdSets
                .Where(a => a.CompanyId == companyId && a.GoogleAdGroupId != null)
                .ToDictionaryAsync(a => a.GoogleAdGroupId!, a => (a.Id, a.CampaignId), ct);

            var existing = await db.Ads
                .Where(a => a.CompanyId == companyId && a.GoogleAdId != null)
                .ToDictionaryAsync(a => a.GoogleAdId!, ct);

            var seenIds = new HashSet<string>();
            var count = 0;

            foreach (var row in rows)
            {
                var googleAdId = GetGaqlString(row, "adGroupAd", "ad", "id");
                var googleAdGroupId = GetGaqlString(row, "adGroup", "id");
                if (string.IsNullOrWhiteSpace(googleAdId) || string.IsNullOrWhiteSpace(googleAdGroupId)) continue;
                if (!adGroupMap.TryGetValue(googleAdGroupId, out var adSetInfo)) continue;

                seenIds.Add(googleAdId);
                var name = GetGaqlString(row, "adGroupAd", "ad", "name") ?? "Untitled Ad";
                var status = NormalizeGoogleStatus(GetGaqlString(row, "adGroupAd", "status"));

                if (existing.TryGetValue(googleAdId, out var ad))
                {
                    ad.AdSetId = adSetInfo.Id;
                    ad.Name = name;
                    ad.Status = status;
                    ad.UpdatedAt = DateTime.UtcNow;
                }
                else
                {
                    ad = new Ad
                    {
                        CompanyId = companyId,
                        AdSetId = adSetInfo.Id,
                        GoogleAdId = googleAdId,
                        Name = name,
                        Status = status,
                        PlatformAdIds = JsonSerializer.SerializeToElement(new { google_ads = googleAdId }),
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    db.Ads.Add(ad);
                }
                count++;
            }

            foreach (var stale in existing.Values.Where(a => !seenIds.Contains(a.GoogleAdId!) && a.Status != "archived"))
            {
                stale.Status = "archived";
                stale.UpdatedAt = DateTime.UtcNow;
            }

            return count;
        }

        // ── Metrics sync ─────────────────────────────────────────────────────────
        private async Task<int> SyncMetricsAsync(AppDbContext db, int companyId, string customerId,
            string developerToken, string accessToken, CancellationToken ct)
        {
            const string query = @"
                SELECT campaign.id, ad_group.id, ad_group_ad.ad.id,
                       metrics.impressions, metrics.clicks, metrics.cost_micros,
                       metrics.ctr, metrics.average_cpc, metrics.average_cpm,
                       metrics.conversions, metrics.video_views,
                       segments.date
                FROM ad_group_ad
                WHERE segments.date DURING LAST_7_DAYS
                  AND ad_group_ad.status != 'REMOVED'
                LIMIT 1000";

            var rows = await ExecuteGaqlAsync(customerId, developerToken, accessToken, query, ct);
            if (rows.Count == 0) return 0;

            var campaignMap = await db.Campaigns
                .Where(c => c.CompanyId == companyId && c.GoogleCampaignId != null)
                .ToDictionaryAsync(c => c.GoogleCampaignId!, c => c.Id, ct);

            var adGroupMap = await db.AdSets
                .Where(a => a.CompanyId == companyId && a.GoogleAdGroupId != null)
                .ToDictionaryAsync(a => a.GoogleAdGroupId!, a => a.Id, ct);

            var adMap = await db.Ads
                .Where(a => a.CompanyId == companyId && a.GoogleAdId != null)
                .ToDictionaryAsync(a => a.GoogleAdId!, a => a.Id, ct);

            var windowStart = DateTime.UtcNow.AddDays(-14);
            var existingMetrics = await db.AdMetrics
                .Where(m => m.CompanyId == companyId && m.Platform == "google_ads" && m.Date >= windowStart)
                .ToListAsync(ct);
            var existingByKey = existingMetrics.ToDictionary(
                m => (m.CampaignId, m.AdSetId ?? 0, m.AdId ?? 0, m.Date), m => m);

            var count = 0;
            foreach (var row in rows)
            {
                var googleCampaignId = GetGaqlString(row, "campaign", "id");
                var googleAdGroupId = GetGaqlString(row, "adGroup", "id");
                var googleAdId = GetGaqlString(row, "adGroupAd", "ad", "id");
                var dateStr = GetGaqlString(row, "segments", "date");

                if (!campaignMap.TryGetValue(googleCampaignId ?? "", out var dbCampaignId)) continue;
                if (!DateTime.TryParse(dateStr, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal, out var date)) continue;
                date = DateTime.SpecifyKind(date.Date, DateTimeKind.Utc);

                adGroupMap.TryGetValue(googleAdGroupId ?? "", out var dbAdSetId);
                adMap.TryGetValue(googleAdId ?? "", out var dbAdId);

                var impressions = GetGaqlLong(row, "metrics", "impressions");
                var clicks = GetGaqlLong(row, "metrics", "clicks");
                var costMicros = GetGaqlLong(row, "metrics", "costMicros");
                var spend = costMicros / 1_000_000m;
                var ctr = GetGaqlDecimal(row, "metrics", "ctr");
                var avgCpc = GetGaqlDecimal(row, "metrics", "averageCpc") / 1_000_000m;
                var avgCpm = GetGaqlDecimal(row, "metrics", "averageCpm") / 1_000_000m;
                var conversions = (int)GetGaqlDecimal(row, "metrics", "conversions");
                var videoViews = GetGaqlLong(row, "metrics", "videoViews");
                var reach = impressions > 0 ? (long)(impressions * 0.85) : 0;

                var key = (dbCampaignId, dbAdSetId, dbAdId, date);

                if (existingByKey.TryGetValue(key, out var metric))
                {
                    metric.Impressions = impressions;
                    metric.Reach = reach;
                    metric.Clicks = clicks;
                    metric.Spend = spend;
                    metric.Ctr = Math.Round(ctr, 6);
                    metric.Cpc = Math.Round(avgCpc, 4);
                    metric.Cpm = Math.Round(avgCpm, 4);
                    metric.Conversions = conversions;
                    metric.VideoViews = videoViews > 0 ? videoViews : null;
                    metric.FetchedAt = DateTime.UtcNow;
                }
                else
                {
                    metric = new AdMetric
                    {
                        CompanyId = companyId,
                        CampaignId = dbCampaignId,
                        AdSetId = dbAdSetId > 0 ? dbAdSetId : null,
                        AdId = dbAdId > 0 ? dbAdId : null,
                        Platform = "google_ads",
                        Date = date,
                        Impressions = impressions,
                        Reach = reach,
                        Clicks = clicks,
                        Spend = spend,
                        Ctr = Math.Round(ctr, 6),
                        Cpc = Math.Round(avgCpc, 4),
                        Cpm = Math.Round(avgCpm, 4),
                        Conversions = conversions,
                        VideoViews = videoViews > 0 ? videoViews : null,
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

        // ── Simulated sync when credentials are placeholder ───────────────────────
        private async Task<GoogleSyncSummary> GenerateSimulatedGoogleSync(AppDbContext db, int companyId, CancellationToken ct)
        {
            var activeCampaigns = await db.Campaigns
                .Where(c => c.CompanyId == companyId && c.Status == "active" && c.Platforms.Contains("google_ads"))
                .ToListAsync(ct);

            var now = DateTime.UtcNow;
            var count = 0;

            foreach (var campaign in activeCampaigns)
            {
                var todayStart = now.Date;
                var alreadyFetched = await db.AdMetrics.AnyAsync(
                    m => m.CampaignId == campaign.Id && m.Platform == "google_ads" && m.Date >= todayStart, ct);
                if (alreadyFetched) continue;

                var metric = new AdMetric
                {
                    CompanyId = companyId,
                    CampaignId = campaign.Id,
                    Platform = "google_ads",
                    Date = now,
                    Impressions = Random.Shared.Next(2000, 80000),
                    Reach = Random.Shared.Next(1500, 60000),
                    Clicks = Random.Shared.Next(100, 5000),
                    Spend = Math.Round((decimal)(Random.Shared.NextDouble() * (double)(campaign.DailyBudget ?? 100)), 2),
                    Conversions = Random.Shared.Next(0, 100),
                    FetchedAt = now
                };

                if (metric.Impressions > 0)
                {
                    metric.Ctr = Math.Round((decimal)metric.Clicks / metric.Impressions, 4);
                    metric.Cpm = Math.Round(metric.Spend / metric.Impressions * 1000, 4);
                }
                if (metric.Clicks > 0) metric.Cpc = Math.Round(metric.Spend / metric.Clicks, 4);
                if (metric.Spend > 0 && metric.Conversions > 0)
                {
                    metric.ConversionValue = metric.Conversions * Random.Shared.Next(20, 150);
                    metric.Roas = Math.Round(metric.ConversionValue / metric.Spend, 4);
                }
                if (metric.Reach > 0) metric.Frequency = Math.Round((decimal)metric.Impressions / metric.Reach, 2);

                var engBase = (long)(metric.Impressions * 0.03);
                metric.Likes = (long)(engBase * 0.65);
                metric.Comments = (long)(engBase * 0.10);
                metric.Shares = (long)(engBase * 0.15);
                metric.Saves = (long)(engBase * 0.10);
                metric.FollowersGained = Random.Shared.Next(0, 150);
                metric.AvgWatchSeconds = null;

                db.AdMetrics.Add(metric);
                count++;
            }

            await db.SaveChangesAsync(ct);
            _logger.LogInformation("[GOOGLE SYNC] Simulated {Count} metric rows for company {CompanyId}", count, companyId);
            return new GoogleSyncSummary { CompanyId = companyId, MetricRows = count };
        }

        // ── Google Ads API helpers ────────────────────────────────────────────────
        private async Task<string?> GetAccessTokenAsync(CompanyAdAccount account, CancellationToken ct)
        {
            // Use stored access token if it looks valid and not expired
            if (IsUsableGoogleCredential(account.AccessToken) && account.TokenExpiresAt > DateTime.UtcNow.AddMinutes(5))
                return account.AccessToken;

            // Try refresh token flow
            var refreshToken = account.RefreshToken ?? _config["GoogleAds:RefreshToken"];
            var clientId = _config["GoogleAds:ClientId"];
            var clientSecret = _config["GoogleAds:ClientSecret"];

            if (!IsUsableGoogleCredential(refreshToken) || !IsUsableGoogleCredential(clientId) || !IsUsableGoogleCredential(clientSecret))
                return null;

            try
            {
                var formData = new Dictionary<string, string>
                {
                    ["grant_type"] = "refresh_token",
                    ["client_id"] = clientId!,
                    ["client_secret"] = clientSecret!,
                    ["refresh_token"] = refreshToken!
                };

                var response = await _httpClient.PostAsync(GoogleOAuthTokenUrl, new FormUrlEncodedContent(formData), ct);
                var body = await response.Content.ReadAsStringAsync(ct);
                if (!response.IsSuccessStatusCode) return null;

                var json = JsonSerializer.Deserialize<JsonElement>(body);
                return json.TryGetProperty("access_token", out var tok) ? tok.GetString() : null;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[GOOGLE SYNC] Failed to refresh access token");
                return null;
            }
        }

        private async Task<List<JsonElement>> ExecuteGaqlAsync(string customerId, string developerToken, string accessToken, string query, CancellationToken ct)
        {
            var url = $"{GoogleAdsApiBase}/customers/{customerId}/googleAds:searchStream";
            var body = JsonSerializer.Serialize(new { query = query.Trim() });

            var request = new HttpRequestMessage(HttpMethod.Post, url)
            {
                Content = new StringContent(body, Encoding.UTF8, "application/json")
            };
            request.Headers.Add("Authorization", $"Bearer {accessToken}");
            request.Headers.Add("developer-token", developerToken);

            var response = await _httpClient.SendAsync(request, ct);
            var responseBody = await response.Content.ReadAsStringAsync(ct);
            if (!response.IsSuccessStatusCode)
                throw new InvalidOperationException($"Google Ads GAQL error: {response.StatusCode} — {responseBody}");

            var results = new List<JsonElement>();
            // searchStream returns newline-delimited JSON arrays
            foreach (var line in responseBody.Split('\n', StringSplitOptions.RemoveEmptyEntries))
            {
                var trimmed = line.Trim().TrimStart('[').TrimEnd(']').Trim().TrimEnd(',');
                if (string.IsNullOrWhiteSpace(trimmed)) continue;
                try
                {
                    var chunk = JsonSerializer.Deserialize<JsonElement>(trimmed);
                    if (chunk.ValueKind == JsonValueKind.Array)
                        foreach (var row in chunk.EnumerateArray()) results.Add(row.Clone());
                    else if (chunk.TryGetProperty("results", out var inner) && inner.ValueKind == JsonValueKind.Array)
                        foreach (var row in inner.EnumerateArray()) results.Add(row.Clone());
                }
                catch { /* skip malformed lines */ }
            }
            return results;
        }

        // ── FetchAllGoogleMetrics (called each cycle) ─────────────────────────────
        private async Task FetchAllGoogleMetrics(CancellationToken ct)
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var googleCompanyIds = await db.CompanyAdAccounts
                .Where(a => a.Platform == "google_ads" && a.Status == "active")
                .Select(a => a.CompanyId)
                .Distinct()
                .ToListAsync(ct);

            foreach (var companyId in googleCompanyIds)
            {
                try { await SyncGoogleAdsForCompany(companyId, ct); }
                catch (Exception ex) { _logger.LogWarning(ex, "Failed Google Ads sync for company {CompanyId}", companyId); }
            }

            _logger.LogInformation("Google Ads fetch cycle completed — companies: {Count}", googleCompanyIds.Count);
        }

        private async Task RunSyncCycleAsync(string trigger, CancellationToken stoppingToken)
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
                await FetchAllGoogleMetrics(runCts.Token);
                lock (_stateLock)
                {
                    _lastRunCompletedAt = DateTime.UtcNow;
                    _lastSuccessfulRunAt = _lastRunCompletedAt;
                    _lastRunOutcome = "succeeded";
                }

                try { await _summaryService.RefreshAsync(runCts.Token); }
                catch (Exception ex) { _logger.LogError(ex, "Failed to refresh ad_metrics_summary after Google sync cycle"); }
            }
            catch (OperationCanceledException) when (!stoppingToken.IsCancellationRequested)
            {
                lock (_stateLock) { _lastRunCompletedAt = DateTime.UtcNow; _lastFailedRunAt = _lastRunCompletedAt; _lastRunOutcome = "cancelled"; _lastError = "Run cancelled."; }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in Google Ads sync cycle");
                lock (_stateLock) { _lastRunCompletedAt = DateTime.UtcNow; _lastFailedRunAt = _lastRunCompletedAt; _lastRunOutcome = "failed"; _lastError = ex.Message; }
            }
            finally
            {
                lock (_stateLock)
                {
                    _isRunning = false;
                    if (ReferenceEquals(_activeRunCts, runCts)) _activeRunCts = null;
                }
                runCts?.Dispose();
            }
        }

        // ── Utility helpers ───────────────────────────────────────────────────────
        private static bool IsUsableGoogleCredential(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return false;
            if (value.StartsWith("YOUR_", StringComparison.OrdinalIgnoreCase)) return false;
            if (value.StartsWith("demo_", StringComparison.OrdinalIgnoreCase)) return false;
            if (value.StartsWith("mock_", StringComparison.OrdinalIgnoreCase)) return false;
            return value.Length >= 10;
        }

        private static string NormalizeGoogleStatus(string? status) =>
            status?.ToUpperInvariant() switch
            {
                "ENABLED" => "active",
                "PAUSED" => "paused",
                "REMOVED" => "archived",
                _ => "paused"
            };

        private static DateTime? ParseGaqlDate(string? dateStr)
        {
            if (string.IsNullOrWhiteSpace(dateStr)) return null;
            return DateTime.TryParse(dateStr, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal, out var d)
                ? DateTime.SpecifyKind(d.Date, DateTimeKind.Utc)
                : null;
        }

        // GAQL responses nest data: row.campaign.id, row.adGroup.name, etc.
        private static string? GetGaqlString(JsonElement row, params string[] path)
        {
            var current = row;
            foreach (var key in path)
            {
                // Try camelCase first, then original
                if (!current.TryGetProperty(key, out var next) &&
                    !current.TryGetProperty(ToCamel(key), out next)) return null;
                current = next;
            }
            return current.ValueKind == JsonValueKind.String ? current.GetString() : current.ToString();
        }

        private static long GetGaqlLong(JsonElement row, params string[] path)
        {
            var val = GetGaqlString(row, path);
            return long.TryParse(val, NumberStyles.Any, CultureInfo.InvariantCulture, out var n) ? n : 0;
        }

        private static decimal GetGaqlDecimal(JsonElement row, params string[] path)
        {
            var val = GetGaqlString(row, path);
            return decimal.TryParse(val, NumberStyles.Any, CultureInfo.InvariantCulture, out var d) ? d : 0m;
        }

        private static string ToCamel(string s) => s.Length == 0 ? s : char.ToLower(s[0]) + s[1..];

        private bool IsEnabled() { lock (_stateLock) return _isEnabled; }
        private bool ShouldRunManual() { lock (_stateLock) return _manualRunRequested; }
        private TimeSpan GetInterval() { lock (_stateLock) return _interval; }
        private void SignalLoop() { try { _wakeSignal.Release(); } catch (SemaphoreFullException) { } }
        private static async Task ObserveCanceledTaskAsync(Task task) { try { await task; } catch (OperationCanceledException) { } }
    }
}
