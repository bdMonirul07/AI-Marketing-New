# 🧠 Session Memory — AI Marketing Platform
**Last Updated:** 2026-04-10  
**Purpose:** Load this file at the start of every new session to resume without losing context.

---

## 📌 Project Overview

**AI Marketing Platform** — Full-stack SaaS for managing multi-platform ad campaigns.

| Layer | Tech |
|-------|------|
| Backend | ASP.NET Core 9 (C#), minimal API style in `Program.cs` |
| Frontend | Vanilla JS (Vite), single `main.js` (~5000+ lines) |
| Database | PostgreSQL 16 — DB: `MarketingAI` |
| Container | Docker + docker-compose |
| Proxy | Nginx |

---

## 🔑 Credentials & Secrets

| Item | Value |
|------|-------|
| DB Host | `localhost:5432` |
| DB Name | `MarketingAI` |
| DB User | `Monirul007` |
| DB Password | `Orion123@` |
| psql path | `C:\Program Files\PostgreSQL\16\bin\psql.exe` |
| Backend port | `5243` — MUST use `--launch-profile http` |
| Frontend dev | Vite on `http://localhost:5173` |
| Demo password (all users) | `123456` |

### User Accounts
| Email | Role |
|-------|------|
| `superadmin@system.local` | Super Admin |
| `admin@demo.com` | Business Admin |
| `expert@demo.com` | Marketing Expert |
| `cmo@demo.com` | CMO |
| `ppp@demo.com` | PPP Specialist |

### Facebook API
| Item | Value |
|------|-------|
| App Name | BUAds |
| App ID | `3017150858672725` |
| Ad Account | `act_2537893049860881` |
| Page ID | `792318557298112` (Bangladesh University) |
| Access Token | `EAAq4FS0qOlUBQZCq3J9wvK44zweEdfG2X4dNX6LaqUjlwBnWb6OeJiQrE9FEASehXhXFeVGuYsvEch0MpYnXLmpRwDjcKClQVcxtXZCGKmoBvanCUl5cEk6mXIwsTejzo0V4ZCzHxe0eZCzC1Gx2NBc3nQs595mQ6PLvw2oGhPfX8mEv07hrg6190OjfXgZDZD` |
| Token valid until | May 2026 |

---

## 🚀 How to Run

### Backend
```powershell
cd "C:\AI Marketing Git\AI-Marketing-New\backend"
dotnet run --launch-profile http
# Listens on http://localhost:5243
```

### Frontend
```powershell
cd "C:\AI Marketing Git\AI-Marketing-New\frontend"
npm run dev
# Listens on http://localhost:5173
```

### Quick Login Test
```powershell
Invoke-RestMethod -Uri "http://localhost:5243/api/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"admin@demo.com","password":"123456"}'
```

---

## 🗂️ Key Files

| File | Description |
|------|-------------|
| `backend/Program.cs` | ALL API endpoints (~2700+ lines). Minimal API style. |
| `backend/Models.cs` | All EF Core entity models (~1200+ lines) |
| `backend/AppDbContext.cs` | EF Core DbContext with 29 DbSet declarations |
| `backend/Services/MetricsFetchService.cs` | Background service (every 4h) — fetches real FB metrics |
| `backend/appsettings.json` | FB token, DB connection, JWT config |
| `frontend/src/main.js` | Entire frontend (~5000+ lines), single-page app |
| `work_done.md` | Full log of all implementation work done |
| `memory.md` | This file — session context for next run |

---

## ✅ Work Completed (All Sessions)

### Session 1 — Login Fix + Facebook App Live Mode
- Fixed EF Core 9 login bug: `.ToLower()` on non-entity params must be pre-computed **before** LINQ query
- Facebook App "BUAds" published to **Live** mode (was in Dev mode, blocking ad creation)
- Successfully deployed live test ad via API:
  - Campaign FB ID: `120240170513140788`
  - Ad FB ID: `120240170514430788`

### Session 2 — Deploy DB Persistence
- `/api/deploy/facebook` was calling FB API but **never saving to DB** — fixed
- Now persists: `Campaign`, `AdSet`, `Ad`, `AdCreative`, `DeploymentLog` (×5 steps)
- `Campaign.PlatformCampaignIds` jsonb column added: `{"facebook":"<fb_campaign_id>"}`
- DB migration: `ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS platform_campaign_ids jsonb`

### Session 3 — Real Facebook Metrics
- `MetricsFetchService.cs` fully rewritten — calls real FB Graph API instead of simulation
- Registered as **singleton + hosted service** (required for DI injection into endpoints):
  ```csharp
  builder.Services.AddSingleton<MetricsFetchService>();
  builder.Services.AddHostedService(sp => sp.GetRequiredService<MetricsFetchService>());
  ```
- `POST /api/campaigns/{id}/metrics/fetch` — manual trigger, deletes today's metrics and re-fetches
- `GET /api/campaigns/{id}/report` — full report: summary, per-platform, daily metrics, live insights

### Session 4 — Full Facebook Sync + Global Report
- `POST /api/facebook/sync` — deletes all company campaign data, imports ALL 12 FB campaigns + lifetime metrics
- `GET /api/facebook/report` — aggregate report across all campaigns, per-campaign breakdown
- **FK delete order** (required to avoid FK violations):
  `ad_metrics → approval_comments → ab_tests → ad_creatives → ads → ad_sets → cmo_queue → ppp_queue → deployment_logs → campaign_workflow_steps → campaigns`
- **Sync result (as of 2026-04-10):**
  - 12 campaigns imported from `act_2537893049860881`
  - Only 2 have real spend data (older 2024 campaigns)
  - 10 are paused with 0 delivery — no metrics, this is correct

### Session 5 — Ad Approvals Screen Fixed
- **Bug:** Task 55 redesign of "Ad Approvals" screen broke the asset approval → PPP dispatch workflow
- **Frontend fix** (`renderRedesignedApprovalsScreen` in `main.js`):
  - Assets tab restored: select/deselect per asset, reject button, "AUTHORIZE FOR PPC DISPATCH" sticky button
  - Dispatching moves assets from CMO queue → PPP queue, archives to library
- **Backend fix** (`/api/campaigns/{id}/approve` in `Program.cs`):
  - After campaign approval, ads are automatically added to PPP queue
  - PPP specialist now sees ads ready for posting after CMO approval
  - Skips duplicate queue entries

---

## 🧱 Architecture — Database Tables (Key ones)

| Table | Purpose |
|-------|---------|
| `companies` | Multi-tenant root |
| `users` | All users, linked to company + role |
| `roles` | Admin, CMO, PPP, Expert, Super Admin, Business Admin |
| `campaigns` | Core campaign entity — has `platform_campaign_ids` jsonb |
| `ad_sets` | Linked to campaign, has `platform_adset_ids` jsonb |
| `ads` | Linked to ad_set (NOT directly to campaign), has `platform_ad_ids` jsonb |
| `ad_creatives` | Linked to ad (NOT to campaign), has `platform_creative_ids` jsonb |
| `ad_metrics` | Daily metrics rows per campaign per platform |
| `deployment_logs` | One row per deployment step |
| `cmo_queue` | Assets pending CMO approval |
| `ppp_queue` | Assets approved by CMO, pending PPP posting |
| `campaign_workflow_steps` | Workflow checklist per campaign |
| `company_ad_accounts` | FB/TikTok/Google account credentials per company |
| `approval_comments` | CMO approval/rejection notes |

---

## ⚠️ Critical Technical Gotchas

| Issue | Solution |
|-------|---------|
| EF Core 9 `.ToLower()` in LINQ | Pre-compute the lowercased string variable BEFORE the `.Where()` call |
| FB `date_preset=lifetime` | **Invalid** in Graph API v19.0. Use `time_range={"since":"...","until":"..."}` or `date_preset=maximum` |
| FB budget from API | Returned in **cents** (e.g. `10000` = 100 MYR). Divide by 100 before saving to DB |
| PostgreSQL DateTime | `DateTime.Parse()` from FB API returns `DateTimeKind.Local` — PostgreSQL rejects non-UTC. Fix: `DateTime.SpecifyKind(dt, DateTimeKind.Utc)` |
| `Ad`/`AdCreative` have no `CampaignId` | `Ad` links via `AdSetId`. `AdCreative` links via `AdId`. Must traverse the chain. |
| `CmoQueueItem.CampaignId` | Nullable `int?` |
| `ApprovalComment.CampaignId` | Non-nullable `int` |
| Backend port | Must use `--launch-profile http` to get port `5243`. Without it defaults to `5000` and frontend breaks |
| MetricsFetchService DI | Register as singleton + hosted service (not just `AddHostedService<T>()`) so it can be injected into endpoints |
| `decimal?` Average in LINQ | `Average(m => m.Frequency ?? 0)` fails — use explicit cast: `(decimal)m.Frequency` |

---

## 📡 Facebook API Endpoints Used

```
GET  https://graph.facebook.com/v19.0/{fb_campaign_id}/insights
     ?fields=impressions,reach,clicks,spend,ctr,cpc,cpm,frequency,actions,video_30_sec_watched_actions
     &time_range={"since":"YYYY-MM-DD","until":"YYYY-MM-DD"}
     &access_token=...

GET  https://graph.facebook.com/v19.0/act_{ad_account}/campaigns
     ?fields=id,name,status,objective,start_time,stop_time,daily_budget,lifetime_budget
     &access_token=...
```

---

## 🌐 Our API Endpoints (Key ones added this session)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/deploy/facebook` | Deploy ad to FB + save to DB |
| `POST` | `/api/campaigns/{id}/metrics/fetch` | Manual FB metrics fetch for one campaign |
| `GET` | `/api/campaigns/{id}/report` | Full report: summary + daily + live insights |
| `POST` | `/api/facebook/sync` | Delete all campaign data, re-import all 12 FB campaigns + metrics |
| `GET` | `/api/facebook/report` | Aggregate report across all FB campaigns |
| `POST` | `/api/campaigns/{id}/approve` | CMO approves campaign → sends to PPP queue |
| `POST` | `/api/campaigns/{id}/reject` | CMO rejects campaign with reason |
| `GET` | `/api/campaigns` | List campaigns (supports `?status=pending_review`) |
| `GET` | `/api/cmo/queue` | CMO asset queue |
| `POST` | `/api/cmo/queue` | Save CMO asset queue |
| `GET` | `/api/ppp/queue` | PPP posting queue |
| `POST` | `/api/ppp/queue` | Save PPP posting queue |
| `POST` | `/api/assets/approve` | Archive asset to library |
| `POST` | `/api/seed/dummy-data` | Re-seed demo data (uses real FB credentials) |

---

## 🔄 Approval Workflow (How it works)

```
Marketing Expert
  → Creates ad variation in Studio
  → Clicks "Approval" → adds to CMO Queue

CMO (Ad Approvals screen)
  Tab 1: Campaigns
    → Sees pending_review campaigns
    → Approve → campaign.status = "approved", ads added to PPP Queue
    → Reject → campaign.status = "rejected", creator notified

  Tab 2: Assets
    → Sees CMO queue items
    → Select/Approve individual assets
    → "AUTHORIZE FOR PPC DISPATCH" → moves to PPP Queue

PPP Specialist (Approved Assets screen)
  → Sees items in PPP Queue
  → Selects platforms
  → Deploys to Facebook/TikTok/Google
```

---

## 🧪 Live Facebook Data (as of 2026-04-10)

| Campaign | FB ID | Impressions | Clicks | Spend |
|----------|-------|-------------|--------|-------|
| Post: "" | (older 2024) | 25,655 | 51 | 30 MYR |
| [02/01/2024] Promoting Monirul Islam Rumon | (2024) | 5,291 | 514 | 24.78 MYR |
| All other 10 campaigns | various | 0 | 0 | 0 (paused) |

**Live test ad still running:**
- Campaign: `120240170513140788`
- Ad: `120240170514430788`

---

## 📦 Current DB State (after last sync on 2026-04-10)

- 12 campaigns (imported from FB)
- 2 `ad_metrics` rows (the 2 campaigns with real spend data)
- Users, roles, companies intact
- PPP queue: populated from seed data
- CMO queue: populated from seed data

---

## 🔧 Next Potential Work Items

- [ ] Test full ad posting flow end-to-end via PPP screen
- [ ] Add pagination to `GET /api/campaigns` for large datasets
- [ ] TikTok / Google Ads real metric integration (same pattern as FB)
- [ ] Dashboard widgets showing real aggregated metrics
- [ ] Campaign wizard → auto-submit for CMO review on completion
