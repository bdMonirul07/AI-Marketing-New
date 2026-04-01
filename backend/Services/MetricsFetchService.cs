using Backend.Data;
using Backend.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend.Services
{
    // Task 59: Background service to fetch metrics from ad platforms
    public class MetricsFetchService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<MetricsFetchService> _logger;
        private readonly TimeSpan _interval = TimeSpan.FromHours(4);

        public MetricsFetchService(IServiceProvider serviceProvider, ILogger<MetricsFetchService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("MetricsFetchService started. Interval: {Interval}h", _interval.TotalHours);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await FetchAllMetrics(stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error fetching metrics");
                }

                await Task.Delay(_interval, stoppingToken);
            }
        }

        private async Task FetchAllMetrics(CancellationToken ct)
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var activeCampaigns = await db.Campaigns
                .Where(c => c.Status == "active")
                .Include(c => c.Company)
                .ToListAsync(ct);

            if (activeCampaigns.Count == 0)
            {
                _logger.LogInformation("No active campaigns to fetch metrics for");
                return;
            }

            _logger.LogInformation("Fetching metrics for {Count} active campaigns", activeCampaigns.Count);

            foreach (var campaign in activeCampaigns)
            {
                var adAccounts = await db.CompanyAdAccounts
                    .Where(a => a.CompanyId == campaign.CompanyId && a.Status == "active")
                    .ToListAsync(ct);

                foreach (var account in adAccounts)
                {
                    if (!campaign.Platforms.Contains(account.Platform)) continue;

                    try
                    {
                        await FetchPlatformMetrics(db, campaign, account, ct);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to fetch {Platform} metrics for campaign {CampaignId}",
                            account.Platform, campaign.Id);
                    }
                }
            }

            await db.SaveChangesAsync(ct);
            _logger.LogInformation("Metrics fetch cycle completed");
        }

        private async Task FetchPlatformMetrics(AppDbContext db, Campaign campaign, CompanyAdAccount account, CancellationToken ct)
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);

            // Check if we already have metrics for today
            var existing = await db.AdMetrics
                .FirstOrDefaultAsync(m =>
                    m.CampaignId == campaign.Id &&
                    m.Platform == account.Platform &&
                    m.Date == today, ct);

            if (existing != null)
            {
                _logger.LogDebug("Metrics already fetched today for campaign {Id} on {Platform}", campaign.Id, account.Platform);
                return;
            }

            // In production, this would call each platform's API
            // For now, generate simulated metrics for active campaigns
            var metric = new AdMetric
            {
                CompanyId = campaign.CompanyId,
                CampaignId = campaign.Id,
                Platform = account.Platform,
                Date = today,
                Impressions = Random.Shared.Next(1000, 50000),
                Reach = Random.Shared.Next(800, 40000),
                Clicks = Random.Shared.Next(50, 2000),
                Spend = Math.Round((decimal)(Random.Shared.NextDouble() * (double)(campaign.DailyBudget ?? 100)), 2),
                Conversions = Random.Shared.Next(0, 50),
                FetchedAt = DateTime.UtcNow
            };

            // Calculate derived metrics
            if (metric.Impressions > 0)
            {
                metric.Ctr = Math.Round((decimal)metric.Clicks / metric.Impressions, 4);
                metric.Cpm = Math.Round(metric.Spend / metric.Impressions * 1000, 4);
            }
            if (metric.Clicks > 0)
                metric.Cpc = Math.Round(metric.Spend / metric.Clicks, 4);
            if (metric.Spend > 0 && metric.Conversions > 0)
            {
                metric.ConversionValue = metric.Conversions * Random.Shared.Next(10, 100);
                metric.Roas = Math.Round(metric.ConversionValue / metric.Spend, 4);
            }
            if (metric.Reach > 0)
                metric.Frequency = Math.Round((decimal)metric.Impressions / metric.Reach, 2);

            db.AdMetrics.Add(metric);
            _logger.LogDebug("Added metrics for campaign {Id} on {Platform}: {Impressions} imp, {Clicks} clicks, ${Spend}",
                campaign.Id, account.Platform, metric.Impressions, metric.Clicks, metric.Spend);
        }
    }
}
