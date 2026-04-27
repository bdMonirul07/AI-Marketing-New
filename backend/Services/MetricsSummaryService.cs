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
        /// Atomically wipes ad_metrics_summary and repopulates it with aggregated totals
        /// per (campaign_id, ad_set_id, ad_id, platform). Rate metrics (ctr, cpc, cpm, roas,
        /// frequency) are recomputed from the aggregated sums so dashboard totals are accurate.
        /// Concurrent calls are serialised — a second call will wait for the first to finish.
        /// </summary>
        public async Task RefreshAsync(CancellationToken ct = default)
        {
            await _lock.WaitAsync(ct);
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                await using var tx = await db.Database.BeginTransactionAsync(ct);

                // Delete all existing summary rows so the table always contains
                // exactly one fresh aggregated record per (campaign, ad_set, ad, platform).
                await db.Database.ExecuteSqlRawAsync("DELETE FROM ad_metrics_summary", ct);

                // Re-insert aggregated totals from the raw ad_metrics table.
                // Rate metrics (ctr, cpc, cpm, roas, frequency) are recomputed from
                // the aggregated sums so they are accurate across all historical rows.
                await db.Database.ExecuteSqlRawAsync(@"
                    INSERT INTO ad_metrics_summary
                        (company_id, campaign_id, ad_set_id, ad_id, platform, date,
                         impressions, reach, clicks, ctr, cpc, cpm, spend,
                         conversions, conversion_value, roas, frequency,
                         video_views, video_completions, leads, app_installs,
                         likes, comments, shares, saves, followers_gained, avg_watch_seconds,
                         fetched_at)
                    SELECT
                        company_id, campaign_id, ad_set_id, ad_id, platform,
                        MAX(date)                                                        AS date,
                        SUM(impressions)                                                 AS impressions,
                        SUM(reach)                                                       AS reach,
                        SUM(clicks)                                                      AS clicks,
                        CASE WHEN SUM(impressions) > 0
                             THEN ROUND(SUM(clicks)::numeric / SUM(impressions), 6)
                             ELSE 0 END                                                  AS ctr,
                        CASE WHEN SUM(clicks) > 0
                             THEN ROUND(SUM(spend) / SUM(clicks), 4)
                             ELSE 0 END                                                  AS cpc,
                        CASE WHEN SUM(impressions) > 0
                             THEN ROUND(SUM(spend) / (SUM(impressions) / 1000.0), 4)
                             ELSE 0 END                                                  AS cpm,
                        SUM(spend)                                                       AS spend,
                        SUM(COALESCE(conversions, 0))                                   AS conversions,
                        SUM(COALESCE(conversion_value, 0))                              AS conversion_value,
                        CASE WHEN SUM(spend) > 0
                             THEN ROUND(SUM(COALESCE(conversion_value, 0)) / SUM(spend), 4)
                             ELSE 0 END                                                  AS roas,
                        CASE WHEN SUM(reach) > 0
                             THEN ROUND(SUM(impressions)::numeric / SUM(reach), 2)
                             ELSE 0 END                                                  AS frequency,
                        SUM(COALESCE(video_views, 0))                                   AS video_views,
                        NULL::bigint                                                     AS video_completions,
                        NULL::integer                                                    AS leads,
                        NULL::integer                                                    AS app_installs,
                        SUM(COALESCE(likes, 0))                                         AS likes,
                        SUM(COALESCE(comments, 0))                                      AS comments,
                        SUM(COALESCE(shares, 0))                                        AS shares,
                        SUM(COALESCE(saves, 0))                                         AS saves,
                        SUM(COALESCE(followers_gained, 0))                              AS followers_gained,
                        AVG(avg_watch_seconds)                                           AS avg_watch_seconds,
                        MAX(fetched_at)                                                  AS fetched_at
                    FROM ad_metrics
                    GROUP BY company_id, campaign_id, ad_set_id, ad_id, platform
                ", ct);

                await tx.CommitAsync(ct);
                _logger.LogInformation("ad_metrics_summary rebuilt from ad_metrics");
            }
            finally
            {
                _lock.Release();
            }
        }
    }
}
