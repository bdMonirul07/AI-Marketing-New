# Google Ads Service — Full Process Documentation

## Overview

The **Google Ads Service** (`GoogleAdsSyncService`) is a background service that runs alongside the Facebook Ads Service on the Platform Service screen. It syncs Google Ads campaign data, ad groups, ads, and performance metrics into the local database on a configurable schedule.

Both services are controlled from **Super Admin → Platform Service** and operate independently with their own start/stop/interval controls.

---

## Architecture

| Item | Detail |
|------|--------|
| Class | `GoogleAdsSyncService : BackgroundService` |
| Service Row | `platform_service_settings` id=2 (Facebook uses id=1) |
| Default Interval | 4 hours |
| API | Google Ads API **v20** — GAQL (Google Ads Query Language) |
| Auth | OAuth2 with Refresh Token → Access Token |
| Fallback | Simulated metrics when credentials are placeholder |

---

## Full Sync Cycle (Step by Step)

```
Startup
  └─ Load interval from platform_service_settings WHERE id=2
  └─ Run first cycle immediately (trigger = "scheduled")

Main Loop:
  1. Check if manual run requested → run immediately
  2. Check if enabled → wait for interval or wake signal
  3. On trigger:
     └─ FOR EACH company with active google_ads account:
         a. Get access token (refresh via OAuth2 if needed)
         b. If credentials are placeholder → use simulated metrics
         c. GAQL: Sync Campaigns
            → campaigns table by google_campaign_id
         d. GAQL: Sync Ad Groups
            → ad_sets table by google_ad_group_id
         e. GAQL: Sync Ads
            → ads table by google_ad_id
         f. GAQL: Sync Metrics (last 7 days)
            → ad_metrics table (upsert by campaign+adset+ad+date)
     └─ Call MetricsSummaryService.RefreshAsync()
         → Rebuild ad_metrics_summary with latest snapshot
  4. Sleep until next interval or wake signal
```

---

## Authentication Flow

```
1. Check company_ad_accounts for stored access_token
   → If valid and not expired (> 5 min remaining) → use it

2. If expired or missing → OAuth2 Refresh Token flow:
   POST https://oauth2.googleapis.com/token
   {
     grant_type: "refresh_token",
     client_id: {GoogleAds:ClientId},
     client_secret: {GoogleAds:ClientSecret},
     refresh_token: {account.RefreshToken or GoogleAds:RefreshToken}
   }
   → Extract access_token from response

3. If refresh fails → use simulated metrics (no crash)
```

**Credential Validation:** Rejects tokens that are empty, start with `YOUR_`, `demo_`, or `mock_`, or are shorter than 10 characters.

---

## Google Ads API Calls (GAQL)

All queries use:
- **Endpoint:** `POST https://googleads.googleapis.com/v20/customers/{customerId}/googleAds:searchStream`
- **Headers:** `Authorization: Bearer {accessToken}`, `developer-token: {developerToken}`
- **Body:** `{ "query": "GAQL query string" }`

### 1. Campaign Sync
```sql
SELECT campaign.id, campaign.name, campaign.status,
       campaign.advertising_channel_type,
       campaign_budget.amount_micros,
       campaign.start_date, campaign.end_date
FROM campaign
WHERE campaign.status != 'REMOVED'
LIMIT 200
```
→ Upserts into `campaigns` by `google_campaign_id`
→ Soft-deletes campaigns not returned (status = "archived")

### 2. Ad Group Sync
```sql
SELECT ad_group.id, ad_group.name, ad_group.status,
       campaign.id,
       ad_group.cpc_bid_micros
FROM ad_group
WHERE ad_group.status != 'REMOVED'
LIMIT 500
```
→ Upserts into `ad_sets` by `google_ad_group_id`
→ Linked to parent campaign via `google_campaign_id` → `campaign_id`

### 3. Ad Sync
```sql
SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.status,
       ad_group.id
FROM ad_group_ad
WHERE ad_group_ad.status != 'REMOVED'
LIMIT 500
```
→ Upserts into `ads` by `google_ad_id`
→ Linked to parent ad group via `google_ad_group_id` → `ad_set_id`

### 4. Metrics Sync (last 7 days)
```sql
SELECT campaign.id, ad_group.id, ad_group_ad.ad.id,
       metrics.impressions, metrics.clicks, metrics.cost_micros,
       metrics.ctr, metrics.average_cpc, metrics.average_cpm,
       metrics.conversions, metrics.video_views,
       segments.date
FROM ad_group_ad
WHERE segments.date DURING LAST_7_DAYS
  AND ad_group_ad.status != 'REMOVED'
LIMIT 1000
```
→ Upserts into `ad_metrics` by `(campaign_id, ad_set_id, ad_id, date)`
→ `cost_micros` is divided by 1,000,000 to get currency value
→ ROAS calculated as `conversion_value / spend` when both > 0

---

## Database Tables

### Columns Added (new)

| Table | Column | Type | Purpose |
|-------|--------|------|---------|
| `campaigns` | `google_campaign_id` | VARCHAR(100) | Stable upsert key |
| `ad_sets` | `google_ad_group_id` | VARCHAR(100) | Stable upsert key |
| `ads` | `google_ad_id` | VARCHAR(100) | Stable upsert key |

### Unique Indexes (partial — only non-NULL rows)
```sql
CREATE UNIQUE INDEX idx_campaigns_google_id ON campaigns(google_campaign_id) WHERE google_campaign_id IS NOT NULL;
CREATE UNIQUE INDEX idx_adsets_google_id    ON ad_sets(google_ad_group_id)   WHERE google_ad_group_id IS NOT NULL;
CREATE UNIQUE INDEX idx_ads_google_id       ON ads(google_ad_id)             WHERE google_ad_id IS NOT NULL;
```

### Tables Read/Written

| Table | Operations | Purpose |
|-------|-----------|---------|
| `platform_service_settings` (id=2) | SELECT / UPSERT | Persist Google service interval |
| `company_ad_accounts` | SELECT | Get Google Ads credentials per company |
| `campaigns` | SELECT / INSERT / UPDATE | Upsert campaigns by google_campaign_id |
| `ad_sets` | SELECT / INSERT / UPDATE | Upsert ad groups by google_ad_group_id |
| `ads` | SELECT / INSERT / UPDATE | Upsert ads by google_ad_id |
| `ad_metrics` | SELECT / INSERT / UPDATE | Upsert metrics by (campaign+adset+ad+date) |
| `ad_metrics_summary` | DELETE / INSERT | Rebuild latest-snapshot summary after each cycle |

---

## Metrics Fields Populated (from Google Ads API)

| Field | Source | Notes |
|-------|--------|-------|
| `impressions` | `metrics.impressions` | Direct |
| `reach` | Estimated as 85% of impressions | No direct reach in Google Ads |
| `clicks` | `metrics.clicks` | Direct |
| `spend` | `metrics.cost_micros / 1,000,000` | Converted from micros |
| `ctr` | `metrics.ctr` | Direct (0.0–1.0) |
| `cpc` | `metrics.average_cpc / 1,000,000` | Converted from micros |
| `cpm` | `metrics.average_cpm / 1,000,000` | Converted from micros |
| `conversions` | `metrics.conversions` | Cast to int |
| `video_views` | `metrics.video_views` | Direct |
| `conversion_value` | `conversions × 10` | Estimated |
| `roas` | `conversion_value / spend` | Calculated |

---

## Simulated Metrics (Fallback Mode)

When Google Ads credentials are placeholder/invalid, the service generates realistic simulated metrics for active campaigns that include `google_ads` in their platforms array:

| Field | Generated Value |
|-------|----------------|
| `impressions` | Random 2,000 – 80,000 |
| `reach` | Random 1,500 – 60,000 |
| `clicks` | Random 100 – 5,000 |
| `spend` | Random % of campaign daily_budget |
| `conversions` | Random 0 – 100 |
| `ctr` | clicks / impressions |
| `cpm` | (spend / impressions) × 1000 |
| `cpc` | spend / clicks |
| `roas` | conversion_value / spend |
| `likes` | 65% of (impressions × 0.03) |
| `comments` | 10% of (impressions × 0.03) |
| `shares` | 15% of (impressions × 0.03) |
| `saves` | 10% of (impressions × 0.03) |
| `followers_gained` | Random 0 – 150 |

One simulated row per campaign per day (prevents duplicates).

---

## Backend API Endpoints

All endpoints require Super Admin authorization.

| Method | Endpoint | Action |
|--------|----------|--------|
| GET | `/api/super-admin/google-service` | Get service status |
| POST | `/api/super-admin/google-service/start` | Enable service |
| POST | `/api/super-admin/google-service/stop` | Disable + cancel active run |
| POST | `/api/super-admin/google-service/update` | Trigger immediate run |
| POST | `/api/super-admin/google-service/interval` | Change interval (0.25–168 hrs) |

### Status Response Schema
```json
{
  "serviceName": "GoogleAdsSyncService",
  "displayName": "Google Ads Service",
  "status": {
    "isEnabled": true,
    "isRunning": false,
    "hasPendingManualRun": false,
    "intervalHours": 4,
    "lastEnabledAt": "2026-04-23T01:00:00Z",
    "lastDisabledAt": null,
    "lastRunStartedAt": "2026-04-23T01:00:00Z",
    "lastRunCompletedAt": "2026-04-23T01:00:05Z",
    "lastSuccessfulRunAt": "2026-04-23T01:00:05Z",
    "lastFailedRunAt": null,
    "lastRunTrigger": "scheduled",
    "lastRunOutcome": "succeeded",
    "lastError": null
  }
}
```

---

## Frontend — Platform Service Screen

The Platform Service screen now shows **two service cards side by side**:

```
┌─────────────────────────────────────────────────────────────────────┐
│  PLATFORM SERVICE                                                   │
│  Control background metrics sync services                           │
├─────────────────────────┬───────────────────────────────────────────┤
│  📘 Facebook Ads Service │  🔍 Google Ads Service                    │
│  MetricsFetchService     │  GoogleAdsSyncService                     │
│  [RUNNING] [IDLE]        │  [RUNNING] [IDLE]                         │
│                          │                                           │
│  Interval: 1h            │  Interval: 4h                             │
│  Last Run: 1:00 AM       │  Last Run: 1:00 AM                        │
│  Outcome: SUCCEEDED      │  Outcome: SUCCEEDED                       │
│                          │                                           │
│  Timeline:               │  Timeline:                                │
│  Last Success: 1:00 AM   │  Last Success: 1:00 AM                    │
│  Last Failure: —         │  Last Failure: —                          │
│                          │                                           │
│  [Hours: 1] [Save]       │  [Hours: 4] [Save]                        │
│                          │                                           │
│  [Start] [Stop] [Update] │  [Start] [Stop] [Update]                  │
└─────────────────────────┴───────────────────────────────────────────┘
```

Each card is fully independent — starting/stopping/updating one service does not affect the other.

---

## Company Ad Account Setup

To enable real Google Ads sync for a company, create a record in `company_ad_accounts`:

| Column | Value |
|--------|-------|
| `platform` | `google_ads` |
| `status` | `active` |
| `customer_id` | Google Ads Customer ID (e.g., `123-456-7890` without dashes) |
| `developer_token` | Google Ads Developer Token |
| `access_token` | OAuth2 access token (short-lived) |
| `refresh_token` | OAuth2 refresh token (long-lived, used to refresh access) |
| `token_expires_at` | Access token expiry timestamp |

**Required credentials from Google Cloud Console:**
1. Create OAuth 2.0 Client ID (Web application)
2. Enable Google Ads API in Google Cloud project
3. Apply for a Google Ads Developer Token at [ads.google.com/home/tools/manager-accounts/](https://ads.google.com/home/tools/manager-accounts/)
4. Generate refresh token via OAuth2 authorization flow

---

## Status Normalization

| Google Ads Status | Normalized Status |
|------------------|-------------------|
| `ENABLED` | `active` |
| `PAUSED` | `paused` |
| `REMOVED` | `archived` |
| Other | `paused` |

---

## Comparison: Facebook vs Google Service

| Feature | Facebook Ads Service | Google Ads Service |
|---------|---------------------|-------------------|
| Service class | `MetricsFetchService` | `GoogleAdsSyncService` |
| Settings row | `id=1` | `id=2` |
| API | Facebook Graph API v19.0 | Google Ads API v20 (GAQL) |
| Auth | Long-lived access token | OAuth2 refresh token flow |
| Hierarchy | Campaign → Ad Set → Ad | Campaign → Ad Group → Ad |
| DB IDs | `facebook_campaign_id` etc. | `google_campaign_id` etc. |
| Metrics granularity | Hourly (last 7 days) | Daily (last 7 days) |
| Fallback | Simulated | Simulated |
| Soft-delete | Yes (status = archived) | Yes (status = archived) |
| Summary refresh | Yes (after each cycle) | Yes (after each cycle) |

---

## Investigation & Bug Fixes (2026-04-27)

This section documents all bugs found during live debugging of the Google Ads Service and the exact fixes applied.

---

### Bug 1 — API Version v19 Was Sunset → 404 HTML Response

**Symptom:** Every GAQL request returned a 404 HTML page instead of JSON. The service fell through to simulated metrics.

**Root cause:** The `GoogleAdsApiBase` constant was set to `v19`, which Google sunset.

**Fix — `GoogleAdsSyncService.cs`:**
```csharp
// Before:
private const string GoogleAdsApiBase = "https://googleads.googleapis.com/v19";

// After:
private const string GoogleAdsApiBase = "https://googleads.googleapis.com/v20";
```

---

### Bug 2 — Wrong Customer ID Returning No Campaigns

**Symptom:** GAQL returned 0 campaigns even after the v19→v20 fix.

**Root cause:** The Customer ID configured was `8709881354`, which did not match the active Bangladesh University account. The correct Customer ID is `2095032639`.

**Fix — `appsettings.json`:**
```json
"GoogleAds": {
  "CustomerId": "2095032639"
}
```

**Fix — database `company_ad_accounts` row:**
```sql
UPDATE company_ad_accounts
SET customer_id   = '2095032639',
    account_id    = '2095032639',
    access_token  = 'pending_refresh',
    updated_at    = NOW()
WHERE platform = 'google_ads';
```
(`access_token` cannot be NULL due to a NOT NULL constraint; `pending_refresh` triggers a fresh OAuth2 token refresh on the next cycle.)

---

### Bug 3 — `REQUESTED_METRICS_FOR_MANAGER` Error on Metrics Query

**Symptom:** Campaign sync (no metrics fields) succeeded, but the metrics GAQL query failed with:
```
"REQUESTED_METRICS_FOR_MANAGER":
"Metrics cannot be requested for a manager account.
 To retrieve metrics, issue separate requests against each client account."
```

**Investigation:**
- Account `2095032639` ("Bangladesh University") returned `customer.manager = false` in a direct check, yet the metrics query still threw this error.
- The developer token `1ekyZo4HkgnkJ0IMY0ju0g` is linked to an MCC (Manager Account). Without a `login-customer-id` header, Google's API can interpret requests as coming from the MCC context, triggering this error.
- Structural queries (campaigns, ad groups, ads) have no `metrics.*` fields and pass through; metric queries require explicit client-account context.

**Fix added to `ExecuteGaqlAsync`:** Accept and forward optional `login-customer-id` header.
```csharp
private async Task<List<JsonElement>> ExecuteGaqlAsync(
    string customerId, string developerToken, string accessToken,
    string query, CancellationToken ct, string? loginCustomerId = null)
{
    ...
    // When accessing a sub-account via a manager, Google requires this header.
    if (!string.IsNullOrWhiteSpace(loginCustomerId) && loginCustomerId != customerId)
        request.Headers.Add("login-customer-id", loginCustomerId.Replace("-", ""));
```

**Fix added to `SyncGoogleAdsForCompany`:** Catch the manager error, discover sub-accounts, and re-run metrics per sub-account with the manager as `login-customer-id`.
```csharp
try
{
    summary.MetricRows = await SyncMetricsAsync(..., loginCustomerId: null, ct);
}
catch (InvalidOperationException ex) when (ex.Message.Contains("REQUESTED_METRICS_FOR_MANAGER"))
{
    var clientIds = await GetClientAccountIdsAsync(customerId, developerToken!, accessToken, ct);
    foreach (var clientId in clientIds)
    {
        var rows = await SyncMetricsAsync(..., clientId, ..., loginCustomerId: customerId, ct);
        summary.MetricRows += rows;
    }
}
```

**New method `GetClientAccountIdsAsync`:** Enumerates non-manager sub-accounts using `customer_client`:
```sql
SELECT customer_client.id, customer_client.manager,
       customer_client.level, customer_client.descriptive_name
FROM customer_client
WHERE customer_client.manager = false
  AND customer_client.status = 'ENABLED'
LIMIT 100
```

---

### Bug 4 — Metrics Silently Returning 0 Rows (Critical — Root Cause)

**Symptom:** After all the above fixes, the service reported "succeeded" with `0 campaigns, 0 ad groups, 0 ads, 0 metric rows`. No errors in the log. Token refresh showed as successful.

**Investigation:** Added debug logging to `ExecuteGaqlAsync` to print the raw response body. The GAQL call was returning HTTP 200 with a valid JSON payload, but the parser was silently discarding all content.

**Root cause — the response parser:**

The original parser split the response body by newlines and tried to parse each line individually:
```csharp
foreach (var line in responseBody.Split('\n', StringSplitOptions.RemoveEmptyEntries))
{
    var trimmed = line.Trim().TrimStart('[').TrimEnd(']').Trim().TrimEnd(',');
    try { var chunk = JsonSerializer.Deserialize<JsonElement>(trimmed); ... }
    catch { /* skip malformed lines */ }   // ← silently discarded all errors
}
```

Google's `searchStream` API returns **pretty-printed multi-line JSON**:
```json
[
  {
    "results": [
      { "campaign": { "id": "23680746858", "name": "BU LECTURE SERIES 003", ... } },
      ...
    ],
    "fieldMask": "campaign.id,campaign.name,...",
    "requestId": "..."
  }
]
```

When split by `\n`, lines like `{`, `"results": [...]`, `}` are incomplete JSON fragments. Each fragment throws a `JsonException` that was **silently swallowed** by the empty `catch { }` block — resulting in 0 rows every time, even when Google returned valid data.

**Fix — replace line-by-line parser with whole-document parse:**
```csharp
var results = new List<JsonElement>();
try
{
    // Parse the entire response as one JSON document.
    // searchStream returns [{results: [...]}, ...] — a JSON array of stream chunks.
    var doc = JsonSerializer.Deserialize<JsonElement>(responseBody);
    if (doc.ValueKind == JsonValueKind.Array)
    {
        foreach (var chunk in doc.EnumerateArray())
        {
            if (chunk.TryGetProperty("results", out var inner) && inner.ValueKind == JsonValueKind.Array)
                foreach (var row in inner.EnumerateArray()) results.Add(row.Clone());
        }
    }
    else if (doc.TryGetProperty("results", out var directResults) && directResults.ValueKind == JsonValueKind.Array)
    {
        foreach (var row in directResults.EnumerateArray()) results.Add(row.Clone());
    }
}
catch (JsonException)
{
    // Fallback for non-standard NDJSON responses
    foreach (var line in responseBody.Split('\n', StringSplitOptions.RemoveEmptyEntries))
    {
        var trimmed = line.Trim().TrimStart('[').TrimEnd(']').Trim().TrimEnd(',');
        if (string.IsNullOrWhiteSpace(trimmed)) continue;
        try {
            var chunk = JsonSerializer.Deserialize<JsonElement>(trimmed);
            if (chunk.TryGetProperty("results", out var inner) && inner.ValueKind == JsonValueKind.Array)
                foreach (var row in inner.EnumerateArray()) results.Add(row.Clone());
        } catch { }
    }
}
```

---

### Bug 5 — Silent Token Refresh Failure (Observability Gap)

**Symptom:** If the OAuth2 token refresh returned HTTP 4xx (e.g., `invalid_grant` for an expired refresh token), the code returned `null` with no log message about why.

**Fix — log the failure reason before returning null:**
```csharp
if (!response.IsSuccessStatusCode)
{
    _logger.LogWarning("[GOOGLE SYNC] Token refresh failed ({Status}): {Body}", response.StatusCode, body);
    return null;
}
// On success:
_logger.LogInformation("[GOOGLE SYNC] Token refresh succeeded, token length: {Len}", token?.Length ?? 0);
```

---

### Verified Final State (2026-04-27)

After all fixes, a full sync run produced:

| Item | Result |
|------|--------|
| Token refresh | Succeeded (token length: 254 chars) |
| Campaigns synced | 2 (`BU LECTURE SERIES 003`, `WEB004 LAW001 REEL001`) |
| Ad groups synced | 2 |
| Ads synced | 2 |
| Metric rows written | 3 (Apr 23, Apr 24, Apr 25 — real data from Google) |
| Summary rebuild | 1 aggregated row: 30,352 impressions / 2,311 clicks / $20.39 spend |

Real data is now flowing from the Google Ads API into `ad_metrics` and aggregated into `ad_metrics_summary`.

---

### Files Changed

| File | Change |
|------|--------|
| `backend/Services/GoogleAdsSyncService.cs` | API v19→v20; fixed response parser; added `login-customer-id` header support; added `GetClientAccountIdsAsync`; added manager-account fallback in `SyncGoogleAdsForCompany`; improved token refresh logging |
| `backend/appsettings.json` | Updated `GoogleAds:CustomerId` from `8709881354` to `2095032639` |
| DB `company_ad_accounts` | Updated `customer_id`, `account_id` to `2095032639`; set `access_token = 'pending_refresh'` |

---

## Platform Service Screen Error & Fix (2026-04-27)

This section documents a follow-up failure where the Platform Service screen showed **"Failed to load Platform Service: Failed to fetch"** after the earlier session's work.

---

### Symptom

Navigating to **Super Admin → Platform Service** showed:
```
Failed to load Platform Service: Failed to fetch
```

`renderPlatformServiceScreen()` calls two endpoints in parallel:
```js
const [fbRes, googleRes] = await Promise.all([
  apiFetch('/super-admin/platform-service'),
  apiFetch('/super-admin/google-service')
])
```
`API_BASE = 'http://localhost:5243/api'`. "Failed to fetch" is a **network-level error** — the browser could not reach the host at all, meaning the backend was not running.

---

### Root Cause 1 — Backend Process Was Down

The backend was killed during the earlier build cycle (`Stop-Process`) and was not restarted before the user navigated to the screen.

**Fix:** Restart the backend with `dotnet run --no-build`.

---

### Root Cause 2 — Facebook Service Crashing on Every Sync Cycle

After the backend was restarted, checking the service status via the API revealed:
```
Facebook: outcome=failed | error=An error occurred while saving the entity changes.
```

Backend logs showed:
```
Npgsql.PostgresException (0x80004005): 23502:
null value in column "ad_set_id" of relation "ad_metrics" violates not-null constraint
```

**Investigation:**

`MetricsFetchService.FetchAllMetrics` loops over all active campaigns and all their non-Facebook ad accounts:
```csharp
var activeCampaigns = await db.Campaigns.Where(c => c.Status == "active").ToListAsync(ct);
foreach (var campaign in activeCampaigns)
{
    var adAccounts = await db.CompanyAdAccounts
        .Where(a => a.CompanyId == campaign.CompanyId && a.Status == "active" && a.Platform != "facebook")
        .ToListAsync(ct);
    foreach (var account in adAccounts)
    {
        if (!campaign.Platforms.Contains(account.Platform)) continue;
        await FetchPlatformMetrics(db, campaign, account, ct);
    }
}
```

`FetchPlatformMetrics` calls `GenerateSimulatedMetrics`, which creates a campaign-level `AdMetric` row **without setting `AdSetId` or `AdId`**:
```csharp
var metric = new AdMetric
{
    CompanyId = campaign.CompanyId,
    CampaignId = campaign.Id,
    Platform = account.Platform,
    // AdSetId ← NOT SET (null)
    // AdId    ← NOT SET (null)
    ...
};
db.AdMetrics.Add(metric);
```

The database had `ad_set_id` and `ad_id` as `NOT NULL`, so every attempt to insert a simulated row failed. This was triggered by the two Google Ads campaigns (`BU LECTURE SERIES 003`, `WEB004 LAW001 REEL001`) that `GoogleAdsSyncService` had just synced — they are now active in the `campaigns` table with `Platforms = ["google_ads"]`, so `MetricsFetchService` picked them up and tried to generate simulated rows for them.

**Schema mismatch:** The C# model (`AdMetric`) already declares both as `int?` (nullable), but the actual database column had `NOT NULL` — likely set during an early migration before nullable was intended.

---

### Fix 1 — DB Schema Aligned to C# Model

Added a startup migration in `Program.cs` to:
1. Drop the `NOT NULL` constraint from `ad_set_id` and `ad_id`
2. Rebuild the `uq_metrics_daily` unique index using `COALESCE` so null values still deduplicate correctly

```sql
-- Drop NOT NULL if still present
ALTER TABLE ad_metrics ALTER COLUMN ad_set_id DROP NOT NULL;
ALTER TABLE ad_metrics ALTER COLUMN ad_id     DROP NOT NULL;

-- Rebuild unique index: COALESCE(null, 0) so nulls don't bypass dedup
DROP INDEX uq_metrics_daily;
CREATE UNIQUE INDEX uq_metrics_daily
    ON ad_metrics(campaign_id, COALESCE(ad_set_id, 0), COALESCE(ad_id, 0), platform, date);
```

**Why `COALESCE` in the index:**
PostgreSQL treats `NULL != NULL` in unique indexes — without COALESCE, two rows with `(campaign_id=1, ad_set_id=NULL, ad_id=NULL, date='...')` would both pass the uniqueness check, causing duplicate campaign-level rows to pile up on every sync cycle.

---

### Fix 2 — `MetricsFetchService` No Longer Handles `google_ads`

`GoogleAdsSyncService` is the dedicated owner of Google Ads data (real API, real metrics). `MetricsFetchService` should not also process `google_ads` accounts — that causes both a crash (null AdSetId) and a data conflict (simulated rows overwriting real data).

Added a guard in `MetricsFetchService.FetchAllMetrics`:
```csharp
// GoogleAdsSyncService owns google_ads — skip here to avoid double-handling.
if (account.Platform == "google_ads")
    continue;
```

---

### Verified Final State

After both fixes, on next startup:

```
Facebook: outcome=succeeded | error=
Google:   outcome=succeeded | error=
```

Platform Service screen loads correctly, both service cards display with live status.

---

### Files Changed (Platform Service Fix)

| File | Change |
|------|--------|
| `backend/Program.cs` | Added startup migration: drop NOT NULL from `ad_set_id`/`ad_id`, rebuild `uq_metrics_daily` with COALESCE |
| `backend/Services/MetricsFetchService.cs` | Skip `google_ads` accounts in `FetchAllMetrics` — `GoogleAdsSyncService` is the sole owner |
