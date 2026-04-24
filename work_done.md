# Work Done — AI Marketing Platform
**Date:** 2026-04-10  
**Session:** Facebook Ad Deployment + DB Persistence + Real Metrics

---

## Summary

End-to-end implementation connecting Facebook ad deployment to the database and replacing simulated metrics with real Facebook Graph API data.

---

## Prior Sessions (Checkpoints 001–002)

### Checkpoint 001 — Facebook Ad Deployment Fixed
- Fixed login bug caused by EF Core 9 breaking change — `.ToLower()` on non-entity params inside LINQ must be pre-computed before the query
- Diagnosed Facebook App Development Mode blocking ad creatives from being created
- Published Facebook App **"BUAds"** (App ID: `3017150858672725`) to Live mode
- Successfully deployed a live test ad via PowerShell API calls:
  - Campaign ID: `120240170513140788`
  - Ad ID: `120240170514430788`
  - Ad Account: `act_2537893049860881`
  - Page: Bangladesh University (`792318557298112`)

### Checkpoint 002 — Facebook Deploy DB Persistence
- Confirmed live ad existed on Facebook but was **not** saved to the local database
- Identified gap: `/api/deploy/facebook` was calling FB API but never calling `db.Campaigns.Add()`
- Read all relevant files: `Models.cs`, `AppDbContext.cs`, `Program.cs`, `MetricsFetchService.cs`, `FacebookAdsService.cs`, `DeploymentOrchestrator.cs`

---

## This Session — Full Implementation

### 1. Campaign Model — `PlatformCampaignIds` Column
**File:** `backend/Models.cs`

- Added `JsonElement? PlatformCampaignIds` property to `Campaign` class with `[Column("platform_campaign_ids", TypeName = "jsonb")]`
- Mirrors existing pattern: `AdSet.PlatformAdSetIds`, `Ad.PlatformAdIds`, `AdCreative.PlatformCreativeIds`
- Added optional `int? campaignDbId = null` parameter to `FacebookDeployRequest` record so callers can link deployment to an existing campaign

**DB Migration:**
```sql
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS platform_campaign_ids jsonb;
```

---

### 2. Deploy Endpoint — Save to Database
**File:** `backend/Program.cs` — `/api/deploy/facebook`

Rewrote endpoint to persist all deployment data after Facebook API calls:

| Entity | Fields saved |
|--------|-------------|
| `Campaign` | name, objective, platforms, budget, dates, status=`active`, `PlatformCampaignIds={"facebook":"<id>"}` |
| `AdSet` | name, daily budget (/100 for cents→MYR), status, targeting JSON, `PlatformAdSetIds` |
| `Ad` | name, status, adset link, `PlatformAdIds` |
| `AdCreative` | name, format, body, link, `PlatformCreativeIds` |
| `DeploymentLog` ×5 | One log per step: `create_campaign`, `create_adset`, `upload_media`, `create_creative`, `create_ad` |

- If `campaignDbId` is provided → updates existing campaign instead of creating new
- Campaign status set to `"active"` only when the real ad is successfully created
- Response now includes `dbCampaignId`, `dbAdSetId`, `dbAdId`

---

### 3. MetricsFetchService — Real Facebook Metrics
**File:** `backend/Services/MetricsFetchService.cs`

Full rewrite replacing random simulation with real Facebook Graph API calls:

**Logic flow:**
1. Every 4 hours, finds all `active` campaigns
2. For each campaign, looks up `CompanyAdAccounts` for that company
3. For **Facebook** platform:
   - Extracts FB campaign ID from `PlatformCampaignIds["facebook"]`
   - Falls back to `deployment_logs` if not on campaign model
   - Skips and falls back to simulation if ID is mock (`mock_*`) or missing
   - Calls: `GET https://graph.facebook.com/v19.0/{fb_campaign_id}/insights`
   - Fields: `impressions, reach, clicks, spend, ctr, cpc, cpm, frequency, actions, video_30_sec_watched_actions`
   - Time range: today's date (not `date_preset` — avoids v19.0 "lifetime" bug)
4. Parses response and stores real `AdMetric` record
5. Falls back to simulated data on any API error

**Access token priority:** `CompanyAdAccount.AccessToken` → `appsettings.json Facebook:AccessToken`

**New public method:** `FetchMetricsForCampaign(int campaignId)` — called by manual API trigger below

---

### 4. Manual Metrics Fetch Endpoint
**File:** `backend/Program.cs`

```
POST /api/campaigns/{id}/metrics/fetch
```
- Requires auth
- Deletes today's existing metrics for the campaign (force-refresh)
- Calls `MetricsFetchService.FetchMetricsForCampaign(id)`
- Returns `{ message, count, metrics[] }`

**Service registration change** (so endpoint can inject `MetricsFetchService`):
```csharp
builder.Services.AddSingleton<MetricsFetchService>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<MetricsFetchService>());
```

---

### 5. Campaign Report Endpoint
**File:** `backend/Program.cs`

```
GET /api/campaigns/{id}/report
```
- Requires auth
- Returns full structured report:
  - **`campaign`** — id, name, status, objective, platforms, budget, dates, `platformCampaignIds`
  - **`summary`** — totalImpressions, totalReach, totalClicks, totalSpend, totalConversions, avgCtr, avgCpc, avgCpm, daysWithData
  - **`byPlatform`** — per-platform aggregates (impressions, reach, clicks, spend, conversions, CTR, CPC, CPM, ROAS)
  - **`dailyMetrics`** — all `ad_metrics` rows ordered by date
  - **`liveInsights`** — real-time `last_7d` insights pulled directly from FB Graph API (if FB campaign ID exists)
  - **`generatedAt`** — UTC timestamp

---

### 6. Seed Fix — Real Facebook Ad Account
**File:** `backend/Program.cs` — `/api/seed/dummy-data`

- Changed seed to inject `IConfiguration config` so it can read `Facebook:AccessToken`
- Facebook ad account now seeds with **real credentials** instead of `demo_fb_token`:
  - Account name: `BUAds Facebook`
  - Account ID: `act_2537893049860881`
  - Page ID: `792318557298112`
  - AccessToken: read from `config["Facebook:AccessToken"]`

---

## Build Result

```
Build succeeded.
0 Warning(s)
0 Error(s)
```

---

## Key Technical Details

| Detail | Value |
|--------|-------|
| Backend port | `5243` (use `--launch-profile http`) |
| FB App | BUAds, App ID `3017150858672725` |
| FB Ad Account | `act_2537893049860881` |
| FB Page | Bangladesh University, `792318557298112` |
| FB Token valid until | May 2026 |
| DB | PostgreSQL `localhost:5432`, DB `MarketingAI`, User `Monirul007` |
| Demo password (all accounts) | `123456` |
| EF Core 9 fix | `.ToLower()` must be pre-computed before LINQ query |
| FB Insights date preset | Use `time_range` not `date_preset=lifetime` (invalid in v19.0) |
| FB budget in API | Cents — divide by 100 to get MYR for DB |

---

## Files Modified

| File | Change |
|------|--------|
| `backend/Models.cs` | Added `PlatformCampaignIds` (jsonb) to `Campaign`; added `campaignDbId` to `FacebookDeployRequest` |
| `backend/Program.cs` | Rewrote `/api/deploy/facebook`; added metrics fetch + report endpoints; fixed seed to use real FB token |
| `backend/Services/MetricsFetchService.cs` | Full rewrite — real FB Graph API metrics instead of random simulation |
| PostgreSQL `campaigns` table | `ALTER TABLE campaigns ADD COLUMN platform_campaign_ids jsonb` |
