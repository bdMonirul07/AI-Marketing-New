# Memory Model File — AI Marketing Project

## Project Overview

- **Name:** AI-Marketing-New
- **Stack:** ASP.NET Core 9 Minimal API (C# 13) + Vite 7 Vanilla JS + PostgreSQL 16 + EF Core 9
- **Auth:** JWT Bearer HS256
- **Frontend:** `http://localhost:5173` (Vite dev server)
- **Backend:** `http://localhost:5000` (dotnet run)
- **API Base:** `const API_BASE = 'http://localhost:5000/api'` (fixed from :5243)

---

## User Profile

- **Name:** Monirul Islam (git config)
- **Email:** shafqat.ahmed.gplay@gmail.com
- **Role:** Full-stack developer / project owner
- **Experience:** Comfortable with C#, JS, PostgreSQL; delegates architecture decisions to Claude
- **Preference:** Wants concise responses, direct action, minimal back-and-forth

---

## Architecture

### Backend (`/backend`)
- `Program.cs` — Minimal API, DI registration, raw SQL migrations on startup
- `AppDbContext.cs` — EF Core DbContext
- `Models.cs` — All entity models (Campaign, AdSet, Ad, AdMetric, etc.)
- `Services/MetricsFetchService.cs` — Facebook Ads background sync (BackgroundService)
- `Services/GoogleAdsSyncService.cs` — Google Ads background sync (BackgroundService)
- `Services/MetricsSummaryService.cs` — Rebuilds `ad_metrics_summary` after each sync
- `Services/FacebookAdsService.cs` — Facebook ad deployment
- `Services/GoogleAdsService.cs` — Google Ads campaign/ad creation
- `Services/YouTubeAdsService.cs` — YouTube Ads
- `Services/BrandComplianceService.cs` — Brand compliance checks
- `Services/DeploymentOrchestrator.cs` — Orchestrates multi-platform ad deployment
- `appsettings.json` — Real credentials (DO NOT commit publicly)
- `appsettings.example.json` — Placeholder template for public use

### Frontend (`/frontend/src`)
- `main.js` — All screen rendering logic, API calls, UI state
- `style.css` — Tailwind CSS 4
- `facebookDeploy.js` — Facebook deploy flow
- `googleAdsDeploy.js` — Google Ads deploy flow
- `youtubeAdsDeploy.js` — YouTube deploy flow

---

## Database

- **Host:** localhost
- **DB:** MarketingAI
- **User:** Monirul007 / Password: Orion123@
- **Migrations:** Raw SQL executed on startup in `Program.cs`

### Key Tables
| Table | Purpose |
|-------|---------|
| `campaigns` | Ad campaigns (FB + Google) |
| `ad_sets` | Ad sets / ad groups |
| `ads` | Individual ads |
| `ad_metrics` | Daily metrics per ad |
| `ad_metrics_summary` | Latest snapshot (rebuilt after each sync) |
| `platform_service_settings` | Service config (id=1 Facebook, id=2 Google) |
| `company_ad_accounts` | Per-company platform credentials |

### Google Columns (added via migration)
```sql
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS google_campaign_id VARCHAR(100);
ALTER TABLE ad_sets   ADD COLUMN IF NOT EXISTS google_ad_group_id VARCHAR(100);
ALTER TABLE ads       ADD COLUMN IF NOT EXISTS google_ad_id        VARCHAR(100);
CREATE UNIQUE INDEX idx_campaigns_google_id ON campaigns(google_campaign_id) WHERE google_campaign_id IS NOT NULL;
CREATE UNIQUE INDEX idx_adsets_google_id    ON ad_sets(google_ad_group_id)   WHERE google_ad_group_id IS NOT NULL;
CREATE UNIQUE INDEX idx_ads_google_id       ON ads(google_ad_id)             WHERE google_ad_id IS NOT NULL;
```

---

## Platform Services

### Facebook Ads Service (MetricsFetchService)
- `platform_service_settings` row `id=1`
- API: Facebook Graph API v19.0
- Auth: Long-lived access token
- Default interval: 1 hour

### Google Ads Service (GoogleAdsSyncService)
- `platform_service_settings` row `id=2`
- API: Google Ads API **v19** (GAQL — Google Ads Query Language)
- Auth: OAuth2 refresh token → access token
- Default interval: 4 hours
- Endpoint: `POST https://googleads.googleapis.com/v19/customers/{customerId}/googleAds:searchStream`
- Fallback: Simulated metrics when credentials are placeholder/invalid

### Platform Service UI (frontend)
- Two service cards side-by-side on Platform Service screen
- Each card: status, interval, last run, timeline, Start/Stop/Update buttons
- Wired independently via `wireService()` helper in `main.js`

---

## Google Ads Credentials (appsettings.json)

```json
"GoogleAds": {
  "DeveloperToken": "1ekyZo4HkgnkJ0IMY0ju0g",
  "ClientId": "828745215007-91bdqth28rgrbk15c1jm429skusqcksh.apps.googleusercontent.com",
  "ClientSecret": "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",
  "RefreshToken": "1//04CVa1GbuTiTACgYIARAAGAQSNwF-L9IrLSmZtqyPmaITMAIxn_DagfwZcWskU85ZHSxgGxjIIBXX2gsbwkIzvreSl_X3RTDDpM0",
  "CustomerId": "8709881354"
}
```

**IMPORTANT:** Developer token `1ekyZo4HkgnkJ0IMY0ju0g` is in **TEST MODE**.
- OAuth2 refresh works (returns valid `ya29...` access token)
- All Google Ads API calls return 404 because test-mode tokens cannot access production account `8709881354`
- Fix: Apply for Standard Access at https://ads.google.com/aw/apicenter OR use a test account Customer ID

---

## Facebook Credentials (appsettings.json)

```json
"Facebook": {
  "AccessToken": "EAAq4FS0qOlUBRT4O6Urboi2joB9pNUjcEJUOczu5uVWsIkfMkKWrZAm4zDQ70h2tbEyYHrzDenPrI0zoonVbUMlyuijorT5BhPaZAsY3b5lAMjOYxOyXZBkjYy3Fcg3sOUyV5K2gTYcnQbaTmh4DUrDLmjWOOyISz6d04jvW1mNqfbNuX2MbWHEH2yu1AZDZD",
  "AdAccountId": "act_52046326",
  "AccountName": "BUAds Facebook",
  "PageId": "792318557298112"
}
```

---

## Known Issues & Fixes Applied

| Issue | Fix |
|-------|-----|
| Login failure | `API_BASE` was `:5243` → changed to `:5000` in `main.js` line 5 |
| DB crash on restart (duplicate key `idx_campaigns_facebook_id`) | Wrapped migration in `DO $$ BEGIN IF NOT EXISTS (index check) THEN ... END IF; END $$;` |
| Google Ads API 404 (all versions) | Root cause: developer token in TEST MODE. Code is correct. |
| `access_token NOT NULL` constraint | Used `'pending_refresh'` placeholder to trigger OAuth2 refresh flow |
| Process lock on restart | Kill via PowerShell: `Get-Process dotnet | Stop-Process -Force` |

---

## API Endpoints

### Google Service (Super Admin only)
| Method | Endpoint | Action |
|--------|----------|--------|
| GET | `/api/super-admin/google-service` | Get status |
| POST | `/api/super-admin/google-service/start` | Enable |
| POST | `/api/super-admin/google-service/stop` | Disable |
| POST | `/api/super-admin/google-service/update` | Trigger immediate run |
| POST | `/api/super-admin/google-service/interval` | Change interval |

### Facebook Service (Super Admin only)
| Method | Endpoint | Action |
|--------|----------|--------|
| GET | `/api/super-admin/platform-service` | Get status |
| POST | `/api/super-admin/platform-service/start` | Enable |
| POST | `/api/super-admin/platform-service/stop` | Disable |
| POST | `/api/super-admin/platform-service/update` | Trigger immediate run |
| POST | `/api/super-admin/platform-service/interval` | Change interval |

---

## Key Files Modified This Session

- `frontend/src/main.js` — Fixed API_BASE, rewrote Platform Service screen (two cards)
- `backend/Services/GoogleAdsSyncService.cs` — NEW: Full Google Ads background sync service
- `backend/Services/GoogleAdsService.cs` — Updated API URLs from v17 to v19
- `backend/Models.cs` — Added GoogleCampaignId, GoogleAdGroupId, GoogleAdId fields
- `backend/Program.cs` — Registered GoogleAdsSyncService, added DB migrations, added 5 Google endpoints
- `backend/appsettings.json` — Added real Google Ads credentials
- `googleAd.md` — NEW: Full Google Ads Service process documentation

---

## Pending Tasks

1. **Google Ads API Access** — Developer token needs Standard Access approval at Google Ads API Center. Once approved, real campaign data will sync automatically.
2. No other pending issues.

---

*Written: 2026-04-23*
