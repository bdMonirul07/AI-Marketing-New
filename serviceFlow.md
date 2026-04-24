# Service Flow — Metrics Data Architecture (v2)

## Overview

The metrics system is split into **two independent services**:

1. **`MetricsFetchService`** — downloads ad metrics from platforms and appends them to `ad_metrics`. Historical data is never deleted from this table.
2. **`MetricsSummaryService`** — a procedure-based service that reads `ad_metrics`, extracts only the latest data per logical key, and rebuilds `ad_metrics_summary` as a clean snapshot.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MetricsFetchService                          │
│  (runs every 4 hours — appends new rows, never deletes old ones)    │
└─────────────────────────────────────────────────────────────────────┘
           │                              │
    Facebook Graph API             Other Platforms (simulated)
    GET /campaigns                 1 row per campaign per day
    GET /adsets                    skip if today already exists
    GET /ads
    GET /insights
           │                              │
           ▼                              ▼
  ┌────────────────────────────────────────────────────────┐
  │                      ad_metrics                        │
  │  Append-only historical store — never truncated        │
  │  Every download adds new rows with current fetched_at  │
  │  Row count grows over time (full audit trail)          │
  └────────────────────────────────────────────────────────┘
                              │
                              │  (read by summary service)
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       MetricsSummaryService                         │
│  (procedure-based — runs on schedule or on demand)                  │
│                                                                     │
│  Step 1:  DELETE FROM ad_metrics_summary  (wipe all existing data)  │
│  Step 2:  INSERT DISTINCT ON (campaign_id, ad_set_id, ad_id,        │
│                               platform, date)                       │
│           FROM ad_metrics                                           │
│           ORDER BY fetched_at DESC       ← keeps latest per key     │
│  → wrapped in a single transaction (atomic replace)                 │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
  ┌────────────────────────────────────────────────────────┐
  │                   ad_metrics_summary                   │
  │  Latest snapshot only — one row per                    │
  │  (campaign_id, ad_set_id, ad_id, platform, date)       │
  │  Always reflects most recent fetched data              │
  └────────────────────────────────────────────────────────┘
```

---

## Service 1: MetricsFetchService (Append-Only Fetch)

### Startup & Loop

```
App Startup
    │
    ▼
BackgroundService.ExecuteAsync() starts
    │
    ├─► [Immediate] RunFetchCycleAsync("scheduled")   ← runs once on startup
    │
    └─► Loop forever:
            │
            ├─ Manual run requested? ──► RunFetchCycleAsync("manual")
            │
            ├─ Service disabled? ──────► Wait for wake signal
            │
            └─ Wait 4 hours (or until woken) ──► RunFetchCycleAsync("scheduled")
```

### RunFetchCycleAsync(trigger)

```
RunFetchCycleAsync(trigger)
    │
    ├─ Lock state: isRunning=true, record start time, create CancellationTokenSource
    │
    ├─► FetchAllMetrics()
    │       │
    │       ├─ Query DB: all Campaigns WHERE status = "active"
    │       │
    │       ├─► FACEBOOK PATH (per company with facebook campaigns)
    │       │       │
    │       │       └─► SyncFacebookDataForCompany(companyId)
    │       │               │
    │       │               ├─ Get active Facebook ad account + access token
    │       │               │
    │       │               ├─► Facebook Graph API: GET /campaigns
    │       │               │       → UPSERT Campaign rows (insert or update by Facebook ID)
    │       │               │         *** NO DELETE — existing campaigns are updated in place ***
    │       │               │
    │       │               ├─► Facebook Graph API: GET /adsets
    │       │               │       → UPSERT AdSet rows
    │       │               │
    │       │               ├─► Facebook Graph API: GET /ads
    │       │               │       → UPSERT Ad rows
    │       │               │
    │       │               └─► Facebook Graph API: GET /insights (ad level)
    │       │                       → INSERT new AdMetric rows (FetchedAt = now)
    │       │                         *** ALWAYS INSERT — never update or delete old metrics ***
    │       │
    │       ├─► NON-FACEBOOK PATH (per active campaign × per platform ad account)
    │       │       │
    │       │       └─► FetchPlatformMetrics(campaign, account)
    │       │               │
    │       │               ├─ Already have metrics for today? ──► SKIP
    │       │               │
    │       │               └─► GenerateSimulatedMetrics()
    │       │                       → INSERT AdMetric row (random values, FetchedAt = now)
    │       │
    │       └─ SaveChangesAsync()
    │
    ├─ [On success] Lock state: outcome="succeeded", record timestamps
    ├─ [On OperationCanceled] outcome="cancelled"
    ├─ [On Exception]         outcome="failed"
    └─ finally: isRunning=false, dispose CTS
```

> ⚠️ **Key change from previous design:** `ClearFacebookDataAsync` (which deleted all campaigns/adsets/ads/metrics) is **removed**. Campaigns and adsets are now upserted using their Facebook-assigned IDs as the conflict key. The `ad_metrics` table is never cleared — only appended to.

---

## Service 2: MetricsSummaryService (Procedure-Based Snapshot)

This is a **separate service** — fully independent from `MetricsFetchService`. It implements a stored-procedure-style operation:

### Procedure Logic

```sql
-- Step 1: Wipe the current snapshot
DELETE FROM ad_metrics_summary;

-- Step 2: Rebuild from latest records in ad_metrics
INSERT INTO ad_metrics_summary
    (company_id, campaign_id, ad_set_id, ad_id, platform, date,
     impressions, reach, clicks, ctr, cpc, cpm, spend,
     conversions, conversion_value, roas, frequency,
     video_views, video_completions, leads, app_installs, fetched_at)
SELECT DISTINCT ON (campaign_id, COALESCE(ad_set_id, -1), COALESCE(ad_id, -1), platform)
    company_id, campaign_id, ad_set_id, ad_id, platform, date,
    impressions, reach, clicks, ctr, cpc, cpm, spend,
    conversions, conversion_value, roas, frequency,
    video_views, video_completions, leads, app_installs, fetched_at
FROM ad_metrics
ORDER BY campaign_id, COALESCE(ad_set_id, -1), COALESCE(ad_id, -1), platform, fetched_at DESC;
```

Both steps execute inside a **single database transaction** — so `ad_metrics_summary` is never observed as empty by readers.

### What "latest" means

For each unique `(campaign_id, ad_set_id, ad_id, platform)` combination, the procedure picks the **single row with the highest `fetched_at`** — the most recently downloaded record. The `date` and all metric values come from that most recent fetch, so they are always the latest available data. `date` is **not** part of the distinct key — there is exactly one row per (campaign, adset, ad, platform), not one per day.

### Trigger modes

| Trigger | Description |
|---|---|
| **Scheduled** | Runs automatically after every successful `MetricsFetchService` cycle |
| **On-demand** | Can be called directly via API endpoint |
| **Manual** | Can be triggered independently at any time without running a fetch cycle |

---

## Control API

### MetricsFetchService controls

| Method | Effect |
|---|---|
| `RequestImmediateRun()` | Sets flag → wakes loop → runs fetch now |
| `StopScheduledExecution()` | Disables service + cancels active run |
| `StartScheduledExecution()` | Re-enables service |
| `SetIntervalHours(n)` | Changes the 4h default interval |
| `FetchMetricsForCampaign(id)` | Force-refresh one campaign |

### MetricsSummaryService controls

| Method | Effect |
|---|---|
| `RefreshSummaryAsync()` | Runs the DELETE + INSERT procedure immediately |

---

## `ad_metrics` Table Behaviour

| Aspect | Behaviour |
|---|---|
| **Insert** | Always INSERT new rows — one row per ad per date per download cycle |
| **Delete** | **Never** — rows are permanent |
| **Growth** | Table grows with every fetch cycle; rows are distinguished by `fetched_at` |
| **Uniqueness** | Multiple rows for the same `(campaign, adset, ad, platform, date)` are normal — each represents a different point-in-time snapshot |
| **Audit trail** | Full history of every download is preserved |

---

## `ad_metrics_summary` Table Behaviour

| Aspect | Behaviour |
|---|---|
| **Content** | Always one row per `(campaign_id, ad_set_id, ad_id, platform, date)` |
| **Freshness** | Each row = the most recently downloaded data for that key |
| **Rebuild** | Atomically wiped and repopulated by `MetricsSummaryService` |
| **Dependencies** | Reads from `ad_metrics` only — no FK constraints (safe from cascade deletes) |

---

## Key Behaviours

| Behaviour | Detail |
|---|---|
| **Facebook is append-only** | Campaigns/adsets/ads are upserted; metrics are always inserted. Nothing is deleted during sync. |
| **Non-Facebook is additive** | One simulated row per campaign per day — skips if today's record already exists |
| **Summary is a clean snapshot** | `ad_metrics_summary` always contains exactly one row per logical key, rebuilt transactionally by `MetricsSummaryService` |
| **Two services are independent** | `MetricsFetchService` and `MetricsSummaryService` have no shared state. Either can run without the other. |
| **Per-company failure isolation** | A failure syncing one company is caught and logged; other companies continue |
| **Cancellation support** | Each fetch run gets its own `CancellationTokenSource` |

---

## State Tracking

`MetricsFetchService` exposes `GetStatus()` → `MetricsFetchServiceStatus`:

| Field | Description |
|---|---|
| `IsEnabled` | Whether scheduled runs are active |
| `IsRunning` | Whether a fetch cycle is currently in progress |
| `HasPendingManualRun` | Whether a manual run is queued |
| `IntervalHours` | Current polling interval (default: 4h) |
| `LastRunStartedAt` | Timestamp of the most recent run start |
| `LastRunCompletedAt` | Timestamp of the most recent run end |
| `LastSuccessfulRunAt` | Timestamp of the last run that succeeded |
| `LastFailedRunAt` | Timestamp of the last run that failed |
| `LastRunTrigger` | `"scheduled"` or `"manual"` |
| `LastRunOutcome` | `"succeeded"`, `"failed"`, or `"cancelled"` |
| `LastError` | Error message if the last run failed |

---

## Database Tables Involved

| Table | Role | Grows? |
|---|---|---|
| `campaigns` | Upserted each Facebook run — same rows updated in place | Stable |
| `ad_sets` | Upserted each Facebook run | Stable |
| `ads` | Upserted each Facebook run | Stable |
| `ad_metrics` | **Append-only** — every download adds new timestamped rows | ✅ Grows forever |
| `ad_metrics_summary` | Latest snapshot only — atomically rebuilt by `MetricsSummaryService` | Fixed (1 row per key) |
| `company_ad_accounts` | Provides access tokens and account IDs per platform per company | Stable |

---

## Implementation Changes Required

The following changes are needed to implement this architecture (pending approval):

### 1. MetricsFetchService — make `ad_metrics` append-only for Facebook
- Remove the `ClearFacebookDataAsync()` call from `SyncFacebookDataForCompany`
- Replace `INSERT Campaign / INSERT AdSet / INSERT Ad` with UPSERT (`ON CONFLICT` on Facebook's own ID) so existing rows are updated in place and FK references in `ad_metrics` remain valid
- Facebook metrics (`ad_metrics` rows) are always **INSERT** — never updated or deleted

### 2. Schema — add Facebook ID columns for UPSERT conflict keys
- Add `facebook_campaign_id TEXT` column + unique index to `campaigns`
- Add `facebook_ad_set_id TEXT` column + unique index to `ad_sets`
- Add `facebook_ad_id TEXT` column + unique index to `ads`
- Remove `ON DELETE CASCADE` from `ad_metrics → campaigns / ad_sets / ads` FK constraints so historical metrics survive if a campaign is ever removed

### 3. MetricsSummaryService — separate procedure-based service
- New `BackgroundService` class: `backend/Services/MetricsSummaryService.cs`
- Implements the `DELETE → INSERT DISTINCT ON` procedure in a single transaction
- Registered in `Program.cs` as a hosted service
- Exposed via a new API endpoint (e.g. `POST /api/metrics/refresh-summary`)
- Remove `RefreshSummaryTableAsync()` from `MetricsFetchService` (it moves here)

### 4. PostgreSQL stored procedure (optional)
- `CREATE OR REPLACE PROCEDURE refresh_ad_metrics_summary()` added to startup SQL in `Program.cs`
- `MetricsSummaryService` calls it via `CALL refresh_ad_metrics_summary()`
