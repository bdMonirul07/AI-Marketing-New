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
| API | Google Ads API v17 — GAQL (Google Ads Query Language) |
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
- **Endpoint:** `POST https://googleads.googleapis.com/v17/customers/{customerId}/googleAds:searchStream`
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
| API | Facebook Graph API v19.0 | Google Ads API v17 (GAQL) |
| Auth | Long-lived access token | OAuth2 refresh token flow |
| Hierarchy | Campaign → Ad Set → Ad | Campaign → Ad Group → Ad |
| DB IDs | `facebook_campaign_id` etc. | `google_campaign_id` etc. |
| Metrics granularity | Hourly (last 7 days) | Daily (last 7 days) |
| Fallback | Simulated | Simulated |
| Soft-delete | Yes (status = archived) | Yes (status = archived) |
| Summary refresh | Yes (after each cycle) | Yes (after each cycle) |
