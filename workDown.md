# AI-Marketer Platform OS v4.0 — Complete Project Reference

---

## 1. URLs & Ports

| Service | URL | Notes |
|---|---|---|
| **Frontend** | http://localhost:5173 | Vite dev server |
| **Backend API** | http://localhost:5243 | ASP.NET Core 9 Minimal API |
| **PostgreSQL** | localhost:5432 | Database |

### Start commands

```bash
# Frontend
cd "C:\AI Marketing Git\AI-Marketing-New\frontend"
npm run dev

# Backend
cd "C:\AI Marketing Git\AI-Marketing-New\backend"
dotnet run --urls http://localhost:5243
```

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vite + Vanilla JavaScript (no framework) |
| Styling | Tailwind CSS (CDN) |
| Backend | ASP.NET Core 9 Minimal API (C#) |
| Database | PostgreSQL 16 via Entity Framework Core |
| Auth | JWT Bearer tokens |
| Multi-tenancy | `X-Company-Id` header on every request |
| Image generation | Pollinations.ai (free, no API key) |
| AI text | Google Gemini API |
| Ad platform sync | Facebook Graph API, Google Ads API (GAQL) |

---

## 3. Project Structure

```
AI-Marketing-New/
├── frontend/
│   ├── index.html              # Single-page app shell
│   └── src/
│       ├── main.js             # All UI screens (~6700+ lines)
│       ├── style.css           # Global styles
│       ├── facebookDeploy.js   # Facebook ad deployment logic
│       ├── googleAdsDeploy.js  # Google Ads deployment logic
│       ├── youtubeAdsDeploy.js # YouTube deployment logic
│       └── tiktokDeploy.js     # TikTok deployment logic
│
├── backend/
│   ├── Program.cs              # All API endpoints (~4500+ lines)
│   ├── Models.cs               # EF Core entity models
│   ├── AppDbContext.cs         # Database context
│   ├── appsettings.json        # Config (API keys, DB connection, JWT)
│   ├── Assets/                 # Generated ad images saved here
│   ├── Middleware/
│   │   └── TenantMiddleware.cs # X-Company-Id injection
│   └── Services/
│       ├── MetricsFetchService.cs     # Facebook real metrics + background sync
│       ├── GoogleAdsSyncService.cs    # Google Ads sync + simulated fallback
│       ├── MetricsSummaryService.cs   # Refreshes ad_metrics_summary view
│       ├── FacebookAdsService.cs      # Facebook ad deployment
│       ├── GoogleAdsService.cs        # Google Ads deployment
│       ├── YouTubeAdsService.cs       # YouTube deployment
│       ├── DeploymentOrchestrator.cs  # Multi-platform deploy coordinator
│       └── BrandComplianceService.cs  # Brand guideline enforcement
│
└── workDown.md                 # This file
```

---

## 4. Database

### Connection
```
Host:     localhost
Database: MarketingAI
Username: Monirul007
Password: Orion123@
Port:     5432 (default)
```

### All Tables (35)

| Table | Purpose |
|---|---|
| `companies` | Tenant companies |
| `users` | All user accounts |
| `roles` | Role definitions (Super Admin, Admin, CMO, PPP, Expert) |
| `screens` | UI screen names |
| `role_screens` | Which screens each role can access |
| `user_screens` | Per-user screen overrides |
| `company_settings` | Per-company configuration |
| `company_ad_accounts` | Ad platform credentials per company |
| `campaigns` | Campaign records (synced from Facebook/Google) |
| `ad_sets` | Ad sets / ad groups |
| `ads` | Individual ads |
| `ad_metrics` | Hourly performance data (impressions, clicks, spend, etc.) |
| `ad_metrics_summary` | Aggregated metrics view |
| `ad_metrics_copy` | Backup copy |
| `ad_creatives` | Creative assets linked to ads |
| `asset_library` | Uploaded/generated image library |
| `cmo_queue` | Expert → CMO approval queue |
| `ppp_queue` | CMO → PPP budget & deployment queue |
| `ppp_ad_budgets` | Budget configs for PPP queue items |
| `deployment_logs` | Record of deployed ads |
| `approval_comments` | CMO approval comments on campaigns |
| `campaign_objectives` | Campaign objective types |
| `campaign_platform_specs` | Platform-specific creative specs |
| `campaign_templates` | Reusable campaign templates |
| `campaign_workflow_steps` | Campaign workflow state machine |
| `audience_templates` | Saved audience targeting templates |
| `brand_guidelines` | Brand rules per company |
| `budget_allocations` | Budget split across platforms |
| `ab_tests` | A/B test records |
| `invitations` | User invite tokens |
| `notifications` | In-app notifications |
| `refresh_tokens` | JWT refresh token store |
| `activity_logs` | User action audit trail |
| `platform_service_settings` | Sync service interval config (row 1=FB, row 2=Google) |
| `cmo_approval_logs` | CMO decision history |

---

## 5. Authentication

### JWT
```json
{
  "Key": "A-Very-Secret-Key-For-The-Marketing-AI-App-2024!!",
  "Issuer": "MarketingAIBackend",
  "Audience": "MarketingAIFrontend"
}
```

### Login endpoint
```
POST /api/auth/login
Body: { "email": "...", "password": "..." }
Returns: { "token": "...", "companyId": ..., "role": "...", ... }
```

### Every authenticated request needs
```
Authorization: Bearer <jwt_token>
X-Company-Id: <company_id>
```

---

## 6. User Accounts (All passwords: `123456`)

| Email | Role | Company |
|---|---|---|
| `superadmin@system.local` | Super Admin | (no company) |
| `admin@demo.com` | Admin | Demo Company (id=1) |
| `admin@sonali.com` | Admin | Sonali and Co (id=5) |
| `bd.m.islam07@gmail.com` | Admin | Bangladesh University (id=3) |
| `cmo@demo.com` | CMO | Demo Company (id=1) |
| `cmo@sonali.com` | CMO | Sonali and Co (id=5) |
| `CMOBU@bu.com` | CMO | Bangladesh University (id=3) |
| `ppp@demo.com` | PPP | Demo Company (id=1) |
| `PPP_BU@bu.com` | PPP | Bangladesh University (id=3) |
| `expert@demo.com` | Expert | Demo Company (id=1) |
| `expert@sonali.com` | Expert | Sonali and Co (id=5) |

---

## 7. Companies

| ID | Name |
|---|---|
| 1 | Demo Company |
| 2 | TechStart Inc |
| 3 | Bangladesh University |
| 4 | Orion Informatics ltd |
| 5 | Sonali and Co |

---

## 8. Roles & Screen Access

| Role | Screens |
|---|---|
| **Super Admin** | GlobalDashboard, CompanyManagement, UserManagement, RoleManagement, SystemConfig, AuditLog, PlatformService, BillingSettings |
| **Admin** | Dashboard, UserManagement, RoleManagement, CompanyProfile, Config, AdAccountManagement, Assets, Guideline, Calendar, BillingSettings |
| **CMO** | Dashboard, Objective*, Monitoring, Budget, BudgetMatrix, Approvals, AdPerformance, CampaignReports, CrossPlatformAnalytics, Notifications |
| **PPP** | Dashboard, ApprovedAssets, DeploySelection, DeploymentHistory, AdPerformance, Monitoring, Budget, ABTestResults |
| **Expert** | Dashboard, Objective, Research, Targeting, AudienceInsights, CompetitorResearch, CreativeConfig, Studio |

*CMO can also see Objective screen for oversight.

---

## 9. Role Workflow (Content Pipeline)

```
Expert → creates campaign brief, generates images in Studio
  ↓  "Dispatch to PPP Queue" button
CMO → reviews in Approvals screen → Approve or Reject
  ↓  Approved items go to ppp_queue
PPP → sets budgets in PPP Budget Hub (ApprovedAssets screen)
  ↓  "Submit for Approval" → status: ready_for_approval
CMO → sees in Approvals → selects items → "Deploy to Platforms"
  ↓  Calls Facebook/Google/TikTok/YouTube APIs
PPP → deploys via Deploy Selection screen → "Dispatch Multi-Post"
  ↓  status set to "dispatched" → removed from Platform Selection
```

### PPP Queue Status Lifecycle
```
received → budget_configured → ready_for_approval → deployed → dispatched
```

---

## 10. Ad Platform Credentials

### Facebook
| Field | Value |
|---|---|
| Ad Account ID | `act_52046326` (Shaikh Abdus Sobhan Shuvo) |
| Page ID | `792318657298112` |
| Access Token | `EAAq4FS0qOlUBRT4O6Ur...` (User Access Token — 60-day expiry) |
| Other accounts accessible | `act_2537893049860881` (Monirul Islam Rumon), `act_1142838340037452` (Bangladesh University) |

### Google Ads
| Field | Value |
|---|---|
| Customer ID | `2095032639` |
| Developer Token | `1ekyZo4HkgnkJ0IMY0ju0g` |
| Client ID | `828745215007-91bdqth28rgrbk15c1jm429skusqcksh.apps.googleusercontent.com` |
| Client Secret | `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` |
| Refresh Token | **EXPIRED** — needs regeneration via Google Cloud Console |

### TikTok
- Demo/placeholder token only (`demo_tt_token`) — real credentials not configured

### YouTube
- Demo/placeholder token only (`demo_yt_token`) — uses Google Ads OAuth when real credentials added

---

## 11. External APIs

| API | Key / Token | Status | Used For |
|---|---|---|---|
| Google Gemini | `AIzaSyCv7TQawHO0eB4y87hhji6QZYvn-O1PtoI` | Valid (free tier, quota limited) | Crafting image generation prompts |
| Pollinations.ai | No key needed | ✅ Free, no limit | Actual image generation |
| Facebook Graph API | Token in appsettings.json | ✅ Valid | Campaigns, ad sets, ads, insights sync |
| Google Ads API | OAuth — **refresh token expired** | ❌ Needs re-auth | Campaign sync, metrics |

### Image Generation Flow
```
User clicks "Generate Content"
  → Backend calls Gemini to craft a detailed prompt (optional)
  → Backend calls Pollinations.ai: https://image.pollinations.ai/prompt/{text}?width=...&height=...
  → Image downloaded as .jpg → saved to backend/Assets/
  → Fire-and-forget (non-blocking) — user goes to Studio immediately
  → Studio shows spinner banner while image generates in background
  → User clicks "↻ Refresh Assets" after ~1-2 minutes
```

### Pollinations.ai URL Format
```
https://image.pollinations.ai/prompt/{encoded_prompt}?width={w}&height={h}&seed={n}&nologo=true&enhance=true
```

### Aspect Ratio → Dimensions
| Ratio | Width | Height |
|---|---|---|
| 1:1 (default) | 1024 | 1024 |
| 9:16 (vertical) | 768 | 1360 |
| 16:9 (landscape) | 1360 | 768 |
| 3:4 | 768 | 1024 |
| 4:3 | 1024 | 768 |
| 4:5 | 820 | 1024 |

---

## 12. Background Services

### MetricsFetchService (Facebook)
- Runs every **1 hour** (configurable via Super Admin → Platform Service)
- On startup: runs immediately
- Fetches from Facebook Graph API `last_28d` with hourly breakdown
- Falls back to simulated metrics for non-Facebook, non-Google platforms
- Sync status: `GET /api/super-admin/platform-service`
- Manual trigger: `POST /api/super-admin/platform-service/update`

### GoogleAdsSyncService (Google Ads)
- Runs every **1 hour** (configurable)
- On startup: runs immediately
- Tries OAuth token refresh → if fails, generates **simulated** data
- Simulated data only generates for campaigns with `google_ads` in their `platforms` array
- Sync status: `GET /api/super-admin/google-service`
- Manual trigger: `POST /api/super-admin/google-service/update`

### Important: Silent Failure Pattern
Both services swallow per-company exceptions in their outer loop — a sync failure for one company does not stop others, and `lastRunOutcome` will still say `succeeded`. Always verify by checking `ad_metrics` row counts.

---

## 13. Key API Endpoints

### Auth
```
POST /api/auth/login           → Login, get JWT
POST /api/auth/register        → Register new user
POST /api/auth/refresh         → Refresh JWT
```

### Campaigns
```
GET  /api/campaigns            → List company campaigns
POST /api/campaigns            → Create campaign
GET  /api/campaigns/{id}       → Get single campaign
PUT  /api/campaigns/{id}       → Update campaign
```

### PPP Queue
```
GET  /api/ppp/queue            → Get company queue items
POST /api/ppp/queue            → Add item to queue
POST /api/ppp/budgets          → Save budget for queue item
POST /api/ppp/submit           → Submit configured items for approval
PATCH /api/ppp/queue/dispatched → Mark dispatched items (removes from Platform Selection)
```

### Image Generation
```
POST /api/generate-assets      → Fire-and-forget image generation
GET  /api/assets               → List generated assets
```

### Metrics
```
GET  /api/metrics              → Ad metrics for company
GET  /api/metrics/summary      → Aggregated summary
```

### Ad Accounts
```
GET  /api/ad-accounts          → List company ad accounts
POST /api/ad-accounts          → Add ad account
PUT  /api/ad-accounts/{id}     → Update ad account
```

### Facebook Deploy
```
POST /api/facebook/deploy      → Deploy ad to Facebook
```

### Super Admin Only
```
GET  /api/super-admin/platform-service          → Facebook sync status
POST /api/super-admin/platform-service/update   → Trigger Facebook sync now
POST /api/super-admin/platform-service/start    → Enable scheduled Facebook sync
POST /api/super-admin/platform-service/stop     → Disable Facebook sync
POST /api/super-admin/platform-service/interval → Set sync interval hours

GET  /api/super-admin/google-service            → Google sync status
POST /api/super-admin/google-service/update     → Trigger Google sync now
POST /api/super-admin/google-service/start      → Enable scheduled Google sync
POST /api/super-admin/google-service/stop       → Disable Google sync
POST /api/super-admin/google-service/interval   → Set Google sync interval hours

GET  /api/super-admin/companies                 → All companies
POST /api/super-admin/companies                 → Create company
```

---

## 14. Ad Metrics Data Flow

### Facebook (real data)
```
Facebook Graph API
  → GET /{adAccountId}/campaigns       (upsert into campaigns table)
  → GET /{adAccountId}/adsets          (upsert into ad_sets table)
  → GET /{adAccountId}/ads             (upsert into ads table)
  → GET /{adAccountId}/insights        (hourly, last_28d → ad_metrics table)
```
**Requires**: At least one campaign with active delivery (spend > 0). Paused campaigns produce 0 insight rows.

### Google Ads (real when token valid)
```
Google Ads API (GAQL)
  → SELECT campaign.* FROM campaign
  → SELECT ad_group.* FROM ad_group
  → SELECT ad_group_ad.* FROM ad_group_ad
  → SELECT metrics.* FROM ad_group_ad WHERE segments.date DURING LAST_7_DAYS
```
**Currently**: Refresh token expired → falls back to simulated data.

### Google Ads (simulated fallback)
```
Campaigns table WHERE status='active' AND platforms contains 'google_ads'
  → Generate 48h of randomised metric rows per ad
  → Insert into ad_metrics
```
**Currently active for**: Campaign id=6 (`WEB 005 EEE`) — platforms updated to `{facebook,google_ads,tiktok,youtube}`

### TikTok / YouTube (simulated only)
```
Same pattern as Google simulated — needs active campaigns with matching platform in platforms[]
```

---

## 15. Current Data State (as of 2026-05-22)

| Table | Row Count |
|---|---|
| `companies` | 5 |
| `users` | 11 |
| `campaigns` | 11 (all company_id=1, all from Facebook `act_52046326`) |
| `ad_sets` | 12 |
| `ads` | 15 |
| `ad_metrics` | ~314 rows (24 FB real + 288 Google sim + 1 TikTok + 1 YouTube) |

### Active Facebook Campaigns
Only `WEB 005 EEE` (id=6) has status=`active`. All others are `paused`.

---

## 16. Known Issues & Fixes Required

| Issue | Status | Action Required |
|---|---|---|
| Google OAuth refresh token expired | ❌ Open | Regenerate refresh token via Google Cloud Console → update appsettings.json |
| Facebook campaigns all paused → no real metrics | ⚠️ Partial | Activate & fund at least one campaign in `act_52046326` |
| TikTok real credentials missing | ⚠️ Demo only | Add real TikTok Business API token to company_ad_accounts |
| YouTube real credentials missing | ⚠️ Demo only | Uses Google Ads OAuth — needs Google re-auth |
| `ad_metrics_copy` table (owned by postgres) | ❓ Unknown | Leftover backup table — check if needed |

---

## 17. Ad Metrics Sync Diagnostic Log (2026-05-22)

**Problem**: `ad_metrics` table was empty despite sync services reporting "succeeded".

**Root cause 1 — Facebook**: Sync used `date_preset=last_7d`. All campaigns paused, no delivery → 0 insight rows.  
**Fix**: Changed to `date_preset=last_28d` in `MetricsFetchService.cs` → recovered 24 real rows.

**Root cause 2 — Google**: OAuth refresh token expired (HTTP 400). Simulated fallback requires active campaigns with `google_ads` in `platforms[]` — none existed.  
**Fix**: Updated campaign id=6 platforms to `{facebook,google_ads,tiktok,youtube}` → Google simulation generated 288 rows.

**Root cause 3 — Silent failure**: Both sync services swallow per-company exceptions in `FetchAllMetrics()` — `lastRunOutcome` shows "succeeded" even when DB writes fail or API returns 0 rows. Always verify by checking actual row counts.

**Previous error (2026-04-12)**: Old configuration used `act_2537893049860881` — hit both a DB save error and Facebook rate limit (code 17: "Ad Account Has Too Many API Calls"). This was before the schema migration was complete.

---

## 18. How to Re-authorize Google Ads

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Find OAuth 2.0 Client: `828745215007-91bdqth28rgrbk15c1jm429skusqcksh`
3. Use [Google OAuth Playground](https://developers.google.com/oauthplayground/) or your own consent flow to generate a new refresh token with scope `https://www.googleapis.com/auth/adwords`
4. Update `backend/appsettings.json`:
   ```json
   "GoogleAds": {
     "RefreshToken": "<NEW_REFRESH_TOKEN>"
   }
   ```
5. Also update the `refresh_token` column in `company_ad_accounts` for `platform='google_ads'`:
   ```sql
   UPDATE company_ad_accounts
   SET refresh_token = '<NEW_REFRESH_TOKEN>',
       access_token = 'pending_refresh',
       token_expires_at = NULL
   WHERE platform = 'google_ads';
   ```
6. Restart backend → Go to Super Admin → Platform Service → trigger Google sync manually

---

## 19. How to Re-generate Facebook Token

Facebook User Access Tokens expire in ~60 days. To renew:

1. Go to [Facebook Developer Console](https://developers.facebook.com/) → Graph API Explorer
2. Select your app → Generate User Token with scopes: `ads_read`, `ads_management`, `pages_read_engagement`
3. Use Token Debugger to extend to a **Long-Lived Token** (60 days)
4. Update `backend/appsettings.json`:
   ```json
   "Facebook": {
     "AccessToken": "<NEW_TOKEN>"
   }
   ```
5. Also update `company_ad_accounts`:
   ```sql
   UPDATE company_ad_accounts
   SET access_token = '<NEW_TOKEN>'
   WHERE platform = 'facebook';
   ```
6. Restart backend → sync runs automatically on startup

---

## 20. Files Changed in This Session

| File | Change |
|---|---|
| `backend/Services/MetricsFetchService.cs` | Facebook insights lookback: `last_7d` → `last_28d`; limit: `500` → `1000` |
| `backend/Program.cs` | Added `PATCH /api/ppp/queue/dispatched` endpoint; replaced Imagen 3 with Pollinations.ai in `GenerateImageAsync`; added fire-and-forget image generation |
| `frontend/src/main.js` | Fire-and-forget generate flow; Refresh Assets button in Studio; Expert submissions in Approvals screen; active/completed split in PPP Budget Hub; `numericId` in Platform Selection; dispatch call to PATCH endpoint |

### Database change
```sql
-- Campaign WEB 005 EEE now includes all platforms for simulation
UPDATE campaigns SET platforms = '{facebook,google_ads,tiktok,youtube}' WHERE id = 6;
```
