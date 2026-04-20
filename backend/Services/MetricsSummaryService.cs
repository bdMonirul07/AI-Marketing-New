using Backend.Data;
using Microsoft.EntityFrameworkCore;

namespace Backend.Services
{
    /// <summary>
    /// Procedure-based service that rebuilds ad_metrics_summary from the latest rows in ad_metrics.
    /// Completely independent from MetricsFetchService — can be triggered by it or via API.
    /// </summary>
    public class MetricsSummaryService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<MetricsSummaryService> _logger;
        private readonly SemaphoreSlim _lock = new(1, 1);

        public MetricsSummaryService(IServiceProvider serviceProvider, ILogger<MetricsSummaryService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        /// <summary>
        /// Atomically wipes ad_metrics_summary and repopulates it with the single most recently
        /// fetched row per (campaign_id, ad_set_id, ad_id, platform).
        /// Concurrent calls are serialised — a second call will wait for the first to finish.
        /// </summary>
        public async Task RefreshAsync(CancellationToken ct = default)
        {
            await _lock.WaitAsync(ct);
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                using var tx = await db.Database.BeginTransactionAsync(ct);

                await db.Database.ExecuteSqlRawAsync("DELETE FROM ad_metrics_summary", ct);

                await db.Database.ExecuteSqlRawAsync(@"
                    INSERT INTO ad_metrics_summary
                        (company_id, campaign_id, ad_set_id, ad_id, platform, date,
                         impressions, reach, clicks, ctr, cpc, cpm, spend,
                         conversions, conversion_value, roas, frequency,
                         video_views, video_completions, leads, app_installs,
                         likes, comments, shares, saves, followers_gained, avg_watch_seconds,
                         fetched_at)
                    SELECT DISTINCT ON (campaign_id, COALESCE(ad_set_id, -1), COALESCE(ad_id, -1), platform)
                        company_id, campaign_id, ad_set_id, ad_id, platform, date,
                        impressions, reach, clicks, ctr, cpc, cpm, spend,
                        conversions, conversion_value, roas, frequency,
                        video_views, video_completions, leads, app_installs,
                        likes, comments, shares, saves, followers_gained, avg_watch_seconds,
                        fetched_at
                    FROM ad_metrics
                    ORDER BY campaign_id, COALESCE(ad_set_id, -1), COALESCE(ad_id, -1), platform, fetched_at DESC
                ", ct);

                await tx.CommitAsync(ct);
                _logger.LogInformation("ad_metrics_summary refreshed with latest records");
            }
            finally
            {
                _lock.Release();
            }
        }
    }
}
