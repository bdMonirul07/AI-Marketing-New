# Unified Hourly Analytics — Implementation Tasks

Source: prototype HTML (Unified Hourly Analytics — FB / YouTube / TikTok).
Target: wire the dashboard to `ad_metrics` + `ad_metrics_summary` in `AI-Marketing-New`. Keep schema changes minimal.

---

## Key design decisions

1. **Use existing `ad_metrics` as the sole backing store.** Do not create `organic_posts` / `organic_post_metrics` tables in Phase 1.
2. **`date` column is already `TIMESTAMPTZ`** → hourly granularity is native. No schema change to support "hourly." Just pass hourly timestamps.
3. **Add 6 columns** (engagement + retention fields) to `ad_metrics` and `ad_metrics_summary`. Everything else the prototype shows is derivable.
4. **"Post" in the UI = `ads` row.** Post title = `ads.name`, platform = `ads.platform` (via parent `ad_set` / `campaign`), age = `ads.created_at`, type = inferred from `ad_creatives`.
5. **"Views" = `video_views` for videos, `impressions` for non-video.** No `views` column needed.
6. **Organic posts are Phase 2.** Wire the dashboard to paid ads first. Add organic ingestion later (new column `ads.source_type = 'organic'|'paid'`).

---

## 1. Schema changes — add 6 columns to `ad_metrics` and `ad_metrics_summary`

### 1.1 Columns
| Column | Type | Why |
|---|---|---|
| `likes` | `BIGINT NULL` | engagement rate numerator |
| `comments` | `BIGINT NULL` | engagement rate numerator |
| `shares` | `BIGINT NULL` | virality (shares/impressions), engagement |
| `saves` | `BIGINT NULL` | engagement numerator (FB `action_type=onsite_conversion.save`, TT `saves`) |
| `followers_gained` | `INTEGER NULL` | KPI tile "Followers gained (1h)" |
| `avg_watch_seconds` | `NUMERIC(10,2) NULL` | deep-insights avg watch + completion % |

All nullable — no backfill, no data migration. Existing daily rows stay as-is.

### 1.2 Migration
- [ ] Add columns to `ad_metrics` and `ad_metrics_summary` (Program.cs DB init block or a new migration file)
- [ ] Update `Models.cs::AdMetric` and `AdMetricSummary` C# classes — add nullable `long? Likes`, `long? Comments`, `long? Shares`, `long? Saves`, `int? FollowersGained`, `decimal? AvgWatchSeconds`
- [ ] `MetricsSummaryService.cs:39` — extend the INSERT column list in the refresh SQL

### 1.3 No other schema changes
- ❌ No `organic_posts` table (Phase 2)
- ❌ No `organic_post_metrics` table (Phase 2)
- ❌ No `hour` column (timestamp handles it)
- ❌ No changes to `campaigns` / `ad_sets` / `ads`

---

## 2. Backend — Facebook sync: daily → hourly + engagement fields

Everything in `MetricsFetchService.SyncAccountInsightsAsync` (MetricsFetchService.cs:739).

### 2.1 Switch insights fetch to hourly
- [ ] Change URL from `date_preset=maximum` to `date_preset=today,yesterday` + `time_increment=1`
- [ ] Use `date_start` from each returned row as the row's `date` (already hour-aligned on FB side)

### 2.2 Request engagement fields
- [ ] Add to `fields=`: `actions` (filter for `post_reaction`, `comment`, `post` (share), `onsite_conversion.save`), `video_avg_time_watched_actions`, `page_fans_add` (for `followers_gained`)
- [ ] Parse via helpers similar to the existing `SumFilteredActions` (MetricsFetchService.cs:908)

### 2.3 Map into new columns
- [ ] `likes` ← sum of `actions[action_type=post_reaction]`
- [ ] `comments` ← sum of `actions[action_type=comment]`
- [ ] `shares` ← sum of `actions[action_type=post]`
- [ ] `saves` ← sum of `actions[action_type=onsite_conversion.save]`
- [ ] `avg_watch_seconds` ← average of `video_avg_time_watched_actions` values
- [ ] `followers_gained` ← fetched separately from `/{page_id}/insights?metric=page_fans_adds&period=day` then distributed hourly (FB doesn't expose hourly page-fan deltas)

### 2.4 Orchestrator fix (known bug)
`FetchAllMetrics` (MetricsFetchService.cs:466) skips the sync when `campaigns` is empty (we hit this earlier — required a bootstrap row).
- [ ] Replace the "derive company IDs from active campaigns" loop with "iterate `CompanyAdAccounts WHERE status='active' AND platform='facebook'`"
- [ ] Remove the need for a bootstrap row

### 2.5 YouTube / TikTok — leave simulated for now
- [ ] Mark `FetchPlatformMetrics` (MetricsFetchService.cs:642) as Phase 2 — dashboard displays real data for FB only initially
- [ ] Ensure simulated rows still populate `likes`/`comments`/`shares`/`saves` with reasonable Random.Shared values so the multi-platform UI isn't blank in demos

---

## 3. Backend — API endpoints (read from `ad_metrics` / `ad_metrics_summary`)

All endpoints:
- Scope by `ctx.GetRequiredCompanyId()`
- Require `RequireAuthorization()`
- Query `ad_metrics` with `WHERE company_id = @X AND date >= NOW() - INTERVAL '@hours hour'`

### 3.1 KPI bar — `GET /api/analytics/kpis?platform={all|facebook|youtube|tiktok}&hours={24|48}`
- [ ] Sum `impressions`, `clicks`, `spend`, `conversion_value`, `followers_gained` for current hour
- [ ] Fetch previous hour for delta calculation
- [ ] Compute `engagement_rate = (likes + comments + shares + saves) / impressions`, `ctr = clicks / impressions`
- [ ] Return `{ current: {...}, previous: {...} }`

### 3.2 Hourly trends — `GET /api/analytics/trends?platform=...&hours=...&metric={views|engagement|watch|followers}&split={combined|byPlatform}`
- [ ] `GROUP BY date_trunc('hour', date), platform`
- [ ] Return `{ labels: [iso hours], series: [{ platform, data: [] }] }`
- [ ] Metric mapping: `views` → `COALESCE(video_views, impressions)`, `engagement` → `likes+comments+shares+saves`, `watch` → `avg_watch_seconds * video_views`, `followers` → `followers_gained`

### 3.3 Post performance — `GET /api/analytics/posts?platform=...&hours=...&sort=...`
- [ ] JOIN `ads` → `ad_metrics` WHERE `ad_metrics.date >= NOW() - INTERVAL '1 hour'`
- [ ] SELECT per ad: last-hour views, ER, `velocity = views_current / views_previous`, `virality = shares / impressions`, last 12 hours of views (for sparkline)
- [ ] `trending = velocity > 1.5`, `dropping = velocity < 0.5`
- [ ] Post title = `ads.name`, type inferred from `ad_creatives` (image/video), age = `EXTRACT(EPOCH FROM NOW() - ads.created_at) / 3600`

### 3.4 Virality — `GET /api/analytics/virality?platform=...`
- [ ] Top 5 ads by `lift = (recent_2h_avg_views - baseline_6h_avg_views) / baseline`
- [ ] Alerts list: ads where `lift > 2.0`

### 3.5 Video deep insights — `GET /api/analytics/retention/{adId}`
- [ ] From latest `ad_metrics` row: `avg_watch_sec`, `completion = video_completions / video_views`
- [ ] Retention curve: approximate from FB `video_p25_watched_actions` / `p50` / `p75` / `p100` if available, else a computed decay curve based on `completion` (document the approximation)

### 3.6 Audience heatmap — `GET /api/analytics/heatmap?hours=...`
- [ ] `GROUP BY platform, EXTRACT(hour FROM date)` across the window
- [ ] Return `[{ platform, values: [24 avg engagement per hour-of-day] }]`
- [ ] Engagement = `likes+comments+shares+saves`

---

## 4. Frontend — port prototype into Vite app

Prototype uses CDN Tailwind + Chart.js inline. Project uses Vite + Tailwind v4.

### 4.1 Structure
- [ ] New page `frontend/src/analytics/` with `analytics.js`, `analytics.css`
- [ ] Add `chart.js` as npm dep
- [ ] Components: `KpiBar.js`, `TrendChart.js`, `PostTable.js`, `ViralityPanel.js`, `RetentionChart.js`, `Heatmap.js`
- [ ] Replace dummy data generator with `fetch()` to `/api/analytics/*`
- [ ] JWT attached via existing auth header pattern (check `frontend/src/main.js`)

### 4.2 State
- [ ] Lightweight state object: `{ platform, rangeHours, metric, split, sortKey, selectedAdId }`
- [ ] Chip/tab handlers → refetch → rerender (not just recompute from cache)

### 4.3 UX polish the prototype skips
- [ ] Loading / empty / error states (prototype has none)
- [ ] Debounce the chip-click handlers so rapid clicks don't fire 5 requests
- [ ] Auto-refresh: `setInterval(60_000)` optional toggle, default off

### 4.4 Style
- [ ] Move inline `<style>` into `analytics.css`
- [ ] Reuse dark theme tokens from existing `frontend/src/style.css`

---

## 5. Background service

- [ ] `MetricsFetchService._interval` default: 4h → 1h (dashboard is hourly)
- [ ] `/api/super-admin/platform-service/run-now?platform=facebook` for targeted manual triggers

---

## 6. Permissions

Already covered by existing `RequireAuthorization()` + `ctx.GetRequiredCompanyId()` pattern. No new RBAC work.

---

## 7. Testing

- [ ] Unit tests: KPI delta math, virality lift, ER/CTR formulas
- [ ] Integration: seed `ad_metrics` fixtures across 48 hours → hit each `/api/analytics/*` endpoint → assert shape matches prototype's expected schema
- [ ] Manual: load page with real FB data, compare against prototype visually

---

## 8. Config

- [ ] No new config for Phase 1 (FB creds already wired: `Facebook:AccessToken`, `AdAccountId`, `PageId`)
- [ ] Document required FB token scopes: `ads_read`, `pages_read_engagement`, `read_insights`

---

## Phase 2 (later, not now)

Only pick up if users ask for organic content in the dashboard:

- [ ] Add `ads.source_type VARCHAR(20) DEFAULT 'paid'` with values `paid` | `organic`
- [ ] New ingestion: `GET /{page_id}/posts` + per-post `/insights` → store as `ads` rows with `source_type='organic'`, skip `ad_set_id` FK (make it nullable — this is the bigger migration)
- [ ] YouTube Analytics API integration (real replacement of `GenerateSimulatedMetrics` for `platform='youtube'`)
- [ ] TikTok Business API integration

---

## Quick-start ordering

1. **Task 1** — add 6 columns (30 min)
2. **Task 2.4** — fix orchestrator chicken-and-egg (15 min)
3. **Task 2.1 + 2.2 + 2.3** — FB hourly + engagement ingestion (2-3 hrs, most of the work)
4. **Task 3.1 + 3.2 + 4.1** — KPI bar + trend chart live (2 hrs)
5. **Task 3.3** — post table (1 hr)
6. **Tasks 3.4–3.6** — virality, retention, heatmap (2-3 hrs)

After step 2 you can demo Phase 1 with real FB data; everything after widens coverage.
