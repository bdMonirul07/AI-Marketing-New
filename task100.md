# Task 100: Multi-Tenant AI-Marketing Platform - Complete Task List

> **Objective:** Transform the current single-tenant AI-Marketing platform into a multi-company, multi-tenant SaaS system with Super Admin oversight, structured campaign workflows inspired by Facebook/Google Ads, and full role-based access control per company.

---

## System Architecture Overview

```
                          +========================+
                          |      SUPER ADMIN       |
                          |  (Cross-Company View)  |
                          +========================+
                                     |
                    Full visibility & control over all companies
                                     |
            +------------------------+------------------------+
            |                        |                        |
    +=============+          +=============+          +=============+
    | Company A   |          | Company B   |          | Company C   |
    +=============+          +=============+          +=============+
    | Admin       |          | Admin       |          | Admin       |
    | CMO         |          | CMO         |          | CMO         |
    | PPP         |          | PPP         |          | PPP         |
    | Expert      |          | Expert      |          | Expert      |
    +-------------+          +-------------+          +-------------+
    | Campaigns   |          | Campaigns   |          | Campaigns   |
    | Assets      |          | Assets      |          | Assets      |
    | Guidelines  |          | Guidelines  |          | Guidelines  |
    | Deployments |          | Deployments |          | Deployments |
    +-------------+          +-------------+          +-------------+
```

## Campaign Lifecycle Flowchart (Inspired by Facebook/Google Ads)

```
+=======================================================================+
|                    CAMPAIGN LIFECYCLE FLOWCHART                        |
+=======================================================================+

[1. CAMPAIGN CREATION] (Expert)
    |
    +-- Define Campaign Name & Objective
    |     |-- Awareness (Reach, Brand Awareness, Video Views)
    |     |-- Consideration (Traffic, Engagement, App Installs, Lead Gen)
    |     +-- Conversion (Sales, Store Visits, Catalog Sales)
    |
    +-- Set Campaign Budget & Schedule
    |     |-- Daily Budget / Lifetime Budget
    |     |-- Start Date / End Date
    |     +-- Bid Strategy (Lowest Cost / Cost Cap / Bid Cap)
    |
    v
[2. AUDIENCE TARGETING] (Expert)
    |
    +-- Demographics (Age, Gender, Location, Language)
    +-- Interests & Behaviors
    +-- Custom Audiences (Upload, Website, App Activity)
    +-- Lookalike Audiences
    +-- Exclusion Rules
    |
    v
[3. AI STRATEGY RESEARCH] (Expert)
    |
    +-- Phase 1: Campaign Brief Analysis (Gemini AI)
    |     +-- Generate 5 conceptual strategy questions
    +-- Phase 2: Deep-Dive Probe (Gemini AI)
    |     +-- Generate 5 psychological diagnostic questions
    +-- Phase 3: Strategy Profile Compilation
    |     +-- AI-generated campaign strategy document
    |
    v
[4. AD SET CONFIGURATION] (Expert)
    |
    +-- Placement Selection
    |     |-- Facebook (Feed, Stories, Reels, Right Column, Marketplace)
    |     |-- TikTok (For You, Pangle, Automatic)
    |     |-- YouTube (In-Stream, Discovery, Shorts, Bumper)
    |     +-- Google Ads (Search, Display, Shopping, Performance Max)
    |
    +-- Optimization Goal
    |     |-- Link Clicks / Landing Page Views
    |     |-- Impressions / Reach
    |     |-- Conversions / Value
    |     +-- App Events / Lead Generation
    |
    +-- Scheduling & Dayparting
    |     +-- Run ads on specific days/hours
    |
    v
[5. CREATIVE PRODUCTION] (Expert)
    |
    +-- Style Preset Selection (Cinematic/Minimalism/Cyberpunk/Vintage)
    +-- Aspect Ratio (1:1 / 16:9 / 9:16 / 4:5)
    +-- Upload/Generate Creative Assets
    |     |-- Images (Static, Carousel)
    |     |-- Videos (Single, Slideshow)
    |     +-- Text Variations (Headlines, Descriptions, CTAs)
    +-- Brand Guideline Compliance Check
    +-- A/B Variant Generation
    |
    v
[6. CREATIVE REVIEW & APPROVAL] (Expert -> CMO)
    |
    +-- Expert reviews in Creative Studio
    +-- Expert approves -> CMO Queue
    +-- CMO reviews all pending creatives
    |     |-- Approve -> moves to PPP Queue
    |     |-- Reject -> returns to Expert with feedback
    |     +-- Request Changes -> returns with annotations
    |
    v
[7. PLATFORM CONFIGURATION & DEPLOYMENT] (PPP)
    |
    +-- Select target platforms
    |     |-- Facebook/Instagram
    |     |-- TikTok
    |     |-- YouTube
    |     +-- Google Ads
    |
    +-- Configure platform-specific parameters
    +-- Preview ad (mockup per platform)
    +-- Submit for deployment
    |
    +-- Deployment Execution:
    |     |-- Media Upload (image/video to platform CDN)
    |     |-- Campaign Creation (platform API)
    |     |-- Ad Set/Ad Group Creation (targeting + budget)
    |     |-- Creative Linking (media + copy + CTA)
    |     +-- Ad Activation (status: PAUSED or ACTIVE)
    |
    v
[8. MONITORING & OPTIMIZATION] (CMO + PPP + Admin)
    |
    +-- Real-Time Dashboard
    |     |-- Impressions, Clicks, CTR, CPC, CPM
    |     |-- Conversions, ROAS, Spend
    |     +-- Platform-by-platform breakdown
    |
    +-- AI Auto-Actions
    |     |-- Budget Reallocation (shift spend to top performers)
    |     |-- Pause underperformers
    |     |-- Scale winners
    |     +-- Alert on anomalies
    |
    +-- Reporting
    |     |-- Daily/Weekly/Monthly reports
    |     |-- Export (CSV, PDF)
    |     +-- Cross-platform comparison
    |
    v
[9. CAMPAIGN COMPLETION]
    |
    +-- Final performance summary
    +-- Asset archival
    +-- Learnings & recommendations for next campaign
    +-- ROI report generation

+=======================================================================+
```

---

## Complete Task List

### PHASE 1: Database & Multi-Tenancy Foundation

---

#### Task 1: Create `companies` Table
**File:** `backend/Models.cs`
**Action:** Add new `Company` entity model
```
Table: companies
- id (int, PK, auto-increment)
- name (string, required) — Company display name
- slug (string, unique) — URL-friendly identifier
- industry (string)
- website (string)
- logo_url (string)
- status (string) — active / suspended / archived
- created_at (DateTime)
- updated_at (DateTime)
```

---

#### Task 2: Add `company_id` Foreign Key to `users` Table
**File:** `backend/Models.cs`
**Action:** Modify `User` entity to include `CompanyId` FK
- Add `company_id (int, FK -> companies.id, nullable)` to User model
- Super Admin users will have `company_id = null` (not bound to any company)
- All other users must have a valid `company_id`
- Add navigation property `public Company? Company { get; set; }`

---

#### Task 3: Add `company_id` Foreign Key to All Tenant-Scoped Tables
**Files:** `backend/Models.cs`
**Action:** Add `company_id` column to:
- `campaigns` table — each campaign belongs to one company
- `brand_guidelines` table — each guideline belongs to one company
- `cmo_queue` table — queue items scoped to company
- `roles` table — allow company-specific custom roles
- `role_screens` table — company-specific permission mappings
- Add FK constraints and navigation properties for all

---

#### Task 4: Create `company_ad_accounts` Table
**File:** `backend/Models.cs`
**Action:** New entity for per-company ad platform credentials
```
Table: company_ad_accounts
- id (int, PK)
- company_id (int, FK -> companies.id)
- platform (string) — facebook / tiktok / youtube / google_ads
- account_id (string) — platform-specific account ID
- access_token (string, encrypted)
- refresh_token (string, encrypted)
- token_expires_at (DateTime, nullable)
- page_id (string, nullable) — Facebook page ID
- pixel_id (string, nullable) — tracking pixel
- status (string) — active / expired / revoked
- created_at (DateTime)
- updated_at (DateTime)
```

---

#### Task 5: Create `company_settings` Table
**File:** `backend/Models.cs`
**Action:** New entity for company-wide configuration
```
Table: company_settings
- id (int, PK)
- company_id (int, FK -> companies.id, unique)
- timezone (string, default UTC)
- currency (string, default USD)
- default_language (string, default en)
- notification_email (string)
- max_daily_budget (decimal, nullable)
- auto_approve_threshold (decimal, nullable)
- created_at (DateTime)
- updated_at (DateTime)
```

---

#### Task 6: Update `AppDbContext` for Multi-Tenancy
**File:** `backend/AppDbContext.cs`
**Action:**
- Add `DbSet<Company>`, `DbSet<CompanyAdAccount>`, `DbSet<CompanySetting>`
- Add global query filter for tenant isolation: `.HasQueryFilter(x => x.CompanyId == _currentCompanyId)`
- Configure composite indexes on `(company_id, ...)` for all tenant-scoped tables
- Add `OnModelCreating` relationships and cascading rules

---

#### Task 7: Create EF Core Migration for Multi-Tenancy Schema
**File:** `backend/Migrations/` (new)
**Action:**
- Generate migration: `dotnet ef migrations add MultiTenancy`
- Include all new tables and FK columns
- Add data migration script to assign existing data to a default company
- Add index on `company_id` for all tenant-scoped tables

---

#### Task 8: Move PPC Queue from JSON File to Database
**File:** `backend/Models.cs`, `backend/Program.cs`
**Action:**
- Create `PpcQueueItem` entity with same structure as `CmoQueueItem` + `company_id`
- Add `DbSet<PpcQueueItem>` to `AppDbContext`
- Replace file-based `ppc_queue.json` read/write endpoints with database queries
- Remove `PpcQueueFile` constant and file I/O logic from Program.cs

---

### PHASE 2: Super Admin Role & Authentication

---

#### Task 9: Create Super Admin Role & Seed Data
**File:** `backend/Program.cs` (seed endpoint)
**Action:**
- Add "Super Admin" role to seed data
- Create a `super_admin` user in seed with `company_id = null`
- Super Admin gets ALL screens + new Super Admin-specific screens
- Add new screens to seed: `CompanyManagement`, `GlobalDashboard`, `SystemConfig`, `AuditLog`

---

#### Task 10: Update JWT Token to Include Company Context
**File:** `backend/Program.cs` (login endpoint)
**Action:**
- Add `company_id` claim to JWT token payload
- Add `company_slug` claim to JWT token payload
- Add `is_super_admin` claim (boolean)
- Update token validation to extract company context
- Example claims:
  ```
  { name, role, sub, company_id, company_slug, is_super_admin, iss, aud, exp }
  ```

---

#### Task 11: Create Tenant Resolution Middleware
**File:** `backend/Middleware/TenantMiddleware.cs` (new)
**Action:**
- Extract `company_id` from JWT claims on each request
- Set `HttpContext.Items["CompanyId"]` for downstream use
- For Super Admin: accept `X-Company-Id` header to impersonate/enter a company
- Block non-Super-Admin users from accessing data outside their company
- Skip tenant check for `/api/auth/*` and `/api/super-admin/*` endpoints

---

#### Task 12: Create Super Admin API Endpoints
**File:** `backend/Program.cs`
**Action:** Add new endpoint group `/api/super-admin/`:
```
GET    /api/super-admin/companies              — List all companies
POST   /api/super-admin/companies              — Create new company
GET    /api/super-admin/companies/{id}          — Get company details
PUT    /api/super-admin/companies/{id}          — Update company
DELETE /api/super-admin/companies/{id}          — Deactivate company
GET    /api/super-admin/companies/{id}/users    — List company users
GET    /api/super-admin/companies/{id}/campaigns — List company campaigns
POST   /api/super-admin/companies/{id}/enter    — Enter company context (impersonate)
GET    /api/super-admin/dashboard               — Global cross-company metrics
GET    /api/super-admin/audit-log               — System-wide activity log
```

---

#### Task 13: Add Super Admin Authorization Guard
**File:** `backend/Program.cs`
**Action:**
- Create authorization policy: `RequireSuperAdmin`
- Apply `[Authorize(Policy = "RequireSuperAdmin")]` to all `/api/super-admin/*` endpoints
- Validate `is_super_admin` claim in JWT
- Return 403 Forbidden for non-Super-Admin access attempts

---

#### Task 14: Update Registration Endpoint for Company Context
**File:** `backend/Program.cs` (`/api/auth/register`)
**Action:**
- Add `companyId` to `RegisterRequest` record
- Validate that `companyId` exists and is active
- Only Admin of that company or Super Admin can register new users
- Validate that assigned role exists within that company's role set
- Update `RegisterRequest` record: `RegisterRequest(string Username, string Password, string Email, int RoleId, int CompanyId)`

---

#### Task 15: Update Login Endpoint for Multi-Tenant Response
**File:** `backend/Program.cs` (`/api/auth/login`)
**Action:**
- Include `company` object in login response: `{ id, name, slug, logo_url }`
- For Super Admin: return `company = null` with flag `isSuperAdmin = true`
- Include company-scoped screens only
- Return `companies` list for Super Admin (so they can pick which to enter)

---

### PHASE 3: Tenant-Scoped Data Access

---

#### Task 16: Add Company Filtering to All Existing Endpoints
**Files:** `backend/Program.cs` (all existing endpoints)
**Action:** Update every data endpoint to filter by `company_id`:
- `GET /api/campaigns` → `WHERE company_id = currentCompanyId`
- `GET /api/guidelines` → `WHERE company_id = currentCompanyId`
- `GET /api/cmo/queue` → `WHERE company_id = currentCompanyId`
- `GET /api/ppc/queue` → `WHERE company_id = currentCompanyId`
- `GET /api/rbac/users` → `WHERE company_id = currentCompanyId`
- `GET /api/rbac/roles` → `WHERE company_id = currentCompanyId`
- `POST` endpoints → auto-set `company_id` from JWT context
- Super Admin bypass: when `X-Company-Id` header is set, use that instead

---

#### Task 17: Tenant-Scoped Asset Storage
**Files:** `backend/Program.cs` (asset endpoints)
**Action:**
- Change asset folder structure: `/Assets/{company_id}/` and `/Assets Library/{company_id}/`
- Update `GET /api/assets` to read from company-specific folder
- Update `GET /api/assets-library` to read from company-specific folder
- Update `POST /api/assets/save-url` to save to company folder
- Update `POST /api/assets/approve` to copy within company folder
- Update `DELETE /api/assets/{filename}` to delete from company folder
- Update static file serving to support company-scoped paths
- Ensure users cannot access another company's assets via URL manipulation

---

#### Task 18: Tenant-Scoped Ad Platform Credentials
**File:** `backend/Services/FacebookAdsService.cs`, `backend/Program.cs`
**Action:**
- Modify `FacebookAdsService` constructor to accept company-specific credentials instead of `appsettings.json`
- Load credentials from `company_ad_accounts` table at runtime
- Create `AdPlatformCredentialService` to resolve credentials per company + platform
- Update TikTok deploy endpoint to load company-specific token from DB
- Remove hard-coded tokens from `appsettings.json` (keep as fallback for dev only)

---

#### Task 19: Update RBAC Endpoints for Company Scope
**File:** `backend/Program.cs` (RBAC endpoints)
**Action:**
- `GET /api/rbac/roles` → return only roles for current company
- `POST /api/rbac/roles` → create role under current company
- `PUT /api/rbac/roles/{id}` → verify role belongs to current company before update
- `DELETE /api/rbac/roles/{id}` → verify ownership + prevent deleting system roles
- `GET /api/rbac/users` → return only users for current company
- `DELETE /api/rbac/users/{id}` → verify user belongs to current company
- `GET /api/rbac/role-permissions/{roleId}` → verify role belongs to company
- `POST /api/rbac/role-permissions` → verify role belongs to company
- `POST /api/rbac/seed` → create default roles for a specific company (not global)

---

#### Task 20: Update Seed Endpoint for Multi-Tenant Bootstrap
**File:** `backend/Program.cs` (`/api/rbac/seed`)
**Action:**
- Create a default company during seed (e.g., "Demo Company")
- Assign all seeded users to that company
- Create Super Admin user with `company_id = null`
- Seed default roles per company: Admin, CMO (Business Admin), PPP (PPC), Expert
- Seed company-specific screen permissions
- Create `POST /api/super-admin/companies/{id}/seed` for bootstrapping new companies

---

### PHASE 4: Rename PPC to PPP & Role Restructuring

---

#### Task 21: Rename "PPC" Role to "PPP" (Planner/Publisher/Performer)
**Files:** `backend/Program.cs`, `frontend/src/main.js`
**Action:**
- Update seed data: role name from "PPC" to "PPP"
- Update all frontend references from "PPC" to "PPP"
- Update `ppcQueue` references to `pppQueue` in state and API
- Rename API endpoints: `/api/ppc/queue` -> `/api/ppp/queue` (keep old as alias temporarily)
- Update all variable names, comments, and display labels

---

#### Task 22: Rename "Business Admin" Role to "CMO"
**Files:** `backend/Program.cs`, `frontend/src/main.js`
**Action:**
- Update seed data: role name from "Business Admin" to "CMO"
- Update all frontend role references
- Update `cmoQueue` labels and display names
- Ensure backward compatibility during transition

---

#### Task 23: Define Expanded Screen Permissions per Role
**File:** `backend/Program.cs` (seed), `frontend/src/main.js`
**Action:** Define comprehensive screen sets:

**Super Admin Screens:**
- GlobalDashboard, CompanyManagement, SystemConfig, AuditLog
- Can also access ANY company's Admin screens when "entered"

**Admin (per company):**
- Dashboard, CompanyProfile, UserManagement, RoleManagement
- PlatformConfig, BrandGuideline, CreativeAssets, GlobalCalendar
- BillingSettings, AdAccountManagement

**CMO (per company):**
- Dashboard, BudgetMatrix, AdApprovals, AIMonitoring
- AdPerformance, BudgetOverview, Notifications, CampaignReports
- CrossPlatformAnalytics

**PPP (per company):**
- Dashboard, ApprovedAssets, PlatformSelection, AdPerformance
- AIMonitoring, BudgetOverview, DeploymentHistory, ABTestResults

**Expert (per company):**
- Dashboard, CampaignObjective, TargetAudience, StrategyHub
- CreativeConfig, CreativeStudio, AudienceInsights, CompetitorResearch

---

### PHASE 5: Enhanced Campaign Workflow (Facebook/Google Ads Inspired)

---

#### Task 24: Create `campaign_objectives` Lookup Table
**File:** `backend/Models.cs`
**Action:**
```
Table: campaign_objectives
- id (int, PK)
- category (string) — Awareness / Consideration / Conversion
- name (string) — e.g., "Brand Awareness", "Traffic", "Conversions"
- platform_mapping (jsonb) — maps to each platform's objective enum
  { "facebook": "OUTCOME_AWARENESS", "tiktok": "REACH", "google": "AWARENESS", "youtube": "VIDEO_VIEWS" }
- description (string)
- icon (string)
```

---

#### Task 25: Create `ad_sets` Table (Ad Group Level)
**File:** `backend/Models.cs`
**Action:**
```
Table: ad_sets
- id (int, PK)
- company_id (int, FK)
- campaign_id (int, FK -> campaigns.id)
- name (string)
- status (string) — draft / pending_review / active / paused / completed
- daily_budget (decimal)
- lifetime_budget (decimal, nullable)
- bid_strategy (string) — lowest_cost / cost_cap / bid_cap
- bid_amount (decimal, nullable)
- optimization_goal (string)
- billing_event (string)
- start_time (DateTime)
- end_time (DateTime, nullable)
- targeting (jsonb) — full targeting spec
- placements (jsonb) — platform-specific placement config
- schedule (jsonb) — dayparting rules
- created_at (DateTime)
- updated_at (DateTime)
```

---

#### Task 26: Create `ads` Table (Individual Ad Level)
**File:** `backend/Models.cs`
**Action:**
```
Table: ads
- id (int, PK)
- company_id (int, FK)
- ad_set_id (int, FK -> ad_sets.id)
- name (string)
- status (string) — draft / pending_review / approved / rejected / active / paused
- creative_asset_id (string, FK) — reference to asset
- headline (string)
- description (string)
- cta_type (string) — LEARN_MORE / SHOP_NOW / SIGN_UP / etc.
- cta_link (string)
- platform_ad_ids (jsonb) — { "facebook": "123", "tiktok": "456" }
- review_status (string) — pending / approved / rejected
- reviewer_id (int, nullable, FK -> users.id)
- review_notes (string, nullable)
- created_by (int, FK -> users.id)
- created_at (DateTime)
- updated_at (DateTime)
```

---

#### Task 27: Create `ad_creatives` Table
**File:** `backend/Models.cs`
**Action:**
```
Table: ad_creatives
- id (int, PK)
- company_id (int, FK)
- ad_id (int, FK -> ads.id)
- type (string) — image / video / carousel / slideshow
- asset_url (string)
- thumbnail_url (string, nullable)
- primary_text (string)
- headline (string)
- description (string)
- cta_type (string)
- cta_link (string)
- platform_creative_ids (jsonb) — IDs returned from each platform after upload
- created_at (DateTime)
```

---

#### Task 28: Enhance `campaigns` Table with Full Lifecycle Fields
**File:** `backend/Models.cs`
**Action:** Add columns to existing `Campaign` entity:
```
Additional columns:
- company_id (int, FK)
- name (string) — human-readable campaign name
- objective_id (int, FK -> campaign_objectives.id)
- campaign_type (string) — standard / ab_test / dynamic
- total_budget (decimal)
- daily_budget (decimal)
- lifetime_budget (decimal, nullable)
- bid_strategy (string)
- start_date (DateTime)
- end_date (DateTime, nullable)
- status (string) — draft / pending_review / approved / active / paused / completed / archived
- platforms (string[]) — ["facebook", "tiktok", "youtube", "google"]
- created_by (int, FK -> users.id)
- approved_by (int, nullable, FK -> users.id)
- approved_at (DateTime, nullable)
- deployed_at (DateTime, nullable)
- completed_at (DateTime, nullable)
```

---

#### Task 29: Create `campaign_workflow_steps` Table
**File:** `backend/Models.cs`
**Action:** Track the state machine of each campaign
```
Table: campaign_workflow_steps
- id (int, PK)
- campaign_id (int, FK -> campaigns.id)
- step_name (string) — objective / targeting / strategy / creative / review / deploy / monitoring
- step_order (int)
- status (string) — not_started / in_progress / completed / skipped
- completed_by (int, nullable, FK -> users.id)
- completed_at (DateTime, nullable)
- data (jsonb) — step-specific payload snapshot
- notes (string, nullable)
```

---

#### Task 30: Create Campaign CRUD API Endpoints
**File:** `backend/Program.cs`
**Action:**
```
POST   /api/campaigns                    — Create new campaign (draft)
GET    /api/campaigns                    — List campaigns for company
GET    /api/campaigns/{id}               — Get full campaign detail with ad sets, ads
PUT    /api/campaigns/{id}               — Update campaign
DELETE /api/campaigns/{id}               — Archive campaign (soft delete)
POST   /api/campaigns/{id}/submit        — Submit for CMO review
POST   /api/campaigns/{id}/approve       — CMO approves campaign
POST   /api/campaigns/{id}/reject        — CMO rejects with feedback
POST   /api/campaigns/{id}/deploy        — PPP triggers deployment
POST   /api/campaigns/{id}/pause         — Pause live campaign
POST   /api/campaigns/{id}/resume        — Resume paused campaign
GET    /api/campaigns/{id}/workflow       — Get workflow step status
PUT    /api/campaigns/{id}/workflow/{step} — Update workflow step
```

---

#### Task 31: Create Ad Set CRUD API Endpoints
**File:** `backend/Program.cs`
**Action:**
```
POST   /api/campaigns/{campaignId}/adsets           — Create ad set
GET    /api/campaigns/{campaignId}/adsets           — List ad sets
GET    /api/campaigns/{campaignId}/adsets/{id}      — Get ad set detail
PUT    /api/campaigns/{campaignId}/adsets/{id}      — Update ad set
DELETE /api/campaigns/{campaignId}/adsets/{id}      — Delete ad set
```

---

#### Task 32: Create Ad CRUD API Endpoints
**File:** `backend/Program.cs`
**Action:**
```
POST   /api/adsets/{adSetId}/ads           — Create ad
GET    /api/adsets/{adSetId}/ads           — List ads in ad set
GET    /api/adsets/{adSetId}/ads/{id}      — Get ad detail
PUT    /api/adsets/{adSetId}/ads/{id}      — Update ad
DELETE /api/adsets/{adSetId}/ads/{id}      — Delete ad
POST   /api/adsets/{adSetId}/ads/{id}/submit — Submit ad for review
POST   /api/adsets/{adSetId}/ads/{id}/approve — Approve ad
POST   /api/adsets/{adSetId}/ads/{id}/reject  — Reject ad
```

---

### PHASE 6: Enhanced Ad Platform Integrations

---

#### Task 33: Add YouTube Ads Integration
**File:** `backend/Services/YouTubeAdsService.cs` (new)
**Action:**
- Create `YouTubeAdsService` class using Google Ads API
- Methods: `CreateCampaign`, `CreateAdGroup`, `CreateVideoAd`, `UploadVideo`
- Support ad formats: In-Stream, Discovery, Shorts, Bumper
- Handle OAuth2 authentication with refresh tokens
- Add to DI container in Program.cs

---

#### Task 34: Add Google Ads Integration
**File:** `backend/Services/GoogleAdsService.cs` (new)
**Action:**
- Create `GoogleAdsService` class using Google Ads API v17
- Methods: `CreateCampaign`, `CreateAdGroup`, `CreateResponsiveSearchAd`, `CreateDisplayAd`
- Support campaign types: Search, Display, Shopping, Performance Max
- Handle OAuth2 + developer token authentication
- Add to DI container in Program.cs

---

#### Task 35: Create Unified Deployment Orchestrator
**File:** `backend/Services/DeploymentOrchestrator.cs` (new)
**Action:**
- Create `DeploymentOrchestrator` that coordinates multi-platform deployment
- Interface: `IAdPlatformService` with methods `Deploy`, `Pause`, `Resume`, `GetMetrics`
- Implement for each platform: Facebook, TikTok, YouTube, Google Ads
- Handle parallel deployment to multiple platforms
- Return consolidated results with per-platform status
- Log each deployment step to `deployment_logs` table

---

#### Task 36: Create `deployment_logs` Table
**File:** `backend/Models.cs`
**Action:**
```
Table: deployment_logs
- id (int, PK)
- company_id (int, FK)
- campaign_id (int, FK)
- ad_id (int, FK)
- platform (string) — facebook / tiktok / youtube / google_ads
- action (string) — create_campaign / create_adset / upload_media / create_ad / pause / resume
- platform_resource_id (string) — ID returned by platform
- status (string) — success / failed / pending
- request_payload (jsonb)
- response_payload (jsonb)
- error_message (string, nullable)
- executed_by (int, FK -> users.id)
- executed_at (DateTime)
```

---

#### Task 37: Create `POST /api/deploy/unified` Endpoint
**File:** `backend/Program.cs`
**Action:**
- Accept: `{ campaignId, platforms: ["facebook", "tiktok"], dryRun: false }`
- Load campaign, ad sets, and ads from database
- Load company-specific credentials from `company_ad_accounts`
- Deploy to each selected platform via `DeploymentOrchestrator`
- Save results to `deployment_logs`
- Update `ads.platform_ad_ids` with returned IDs
- Return consolidated success/failure report

---

### PHASE 7: Frontend - Super Admin UI

---

#### Task 38: Create Super Admin Login Detection
**File:** `frontend/src/main.js`
**Action:**
- On login response, check `isSuperAdmin` flag
- If Super Admin: show company selection screen before entering dashboard
- Store `currentCompanyId` in state for API calls
- Add `X-Company-Id` header to all API requests when Super Admin is in a company context

---

#### Task 39: Create Super Admin Dashboard Screen
**File:** `frontend/src/main.js`
**Action:** New `renderSuperAdminDashboard()` function:
- Total companies count with status breakdown (active/suspended)
- Total users across all companies
- Total active campaigns across all companies
- Total ad spend (all companies combined)
- Top 5 companies by spend / performance
- System health indicators (API status for each platform)
- Quick-enter buttons for each company

---

#### Task 40: Create Company Management Screen
**File:** `frontend/src/main.js`
**Action:** New `renderCompanyManagementScreen()` function:
- Table listing all companies with: name, industry, status, user count, campaign count
- Create Company form (name, industry, website, logo upload)
- Edit Company modal
- Suspend/Activate company toggle
- "Enter Company" button that switches Super Admin context
- Company detail view with users, campaigns, and ad account status

---

#### Task 41: Create Company Selector in Header for Super Admin
**File:** `frontend/index.html`, `frontend/src/main.js`
**Action:**
- When Super Admin is logged in, show company dropdown in header
- Dropdown shows: "Global View" + list of all companies
- Selecting a company sets `X-Company-Id` header and reloads data
- Visual indicator showing which company context is active (e.g., colored banner)
- "Exit Company" button to return to global Super Admin view

---

#### Task 42: Create Audit Log Screen
**File:** `frontend/src/main.js`
**Action:** New `renderAuditLogScreen()` function:
- Filterable table of all system actions
- Columns: timestamp, user, company, action, resource, details
- Filters: by company, by user, by action type, by date range
- Export to CSV
- Real-time update (polling or WebSocket)

---

### PHASE 8: Frontend - Multi-Tenant Awareness

---

#### Task 43: Update Frontend State for Multi-Tenancy
**File:** `frontend/src/main.js`
**Action:**
- Add `company` object to state: `{ id, name, slug, logo_url }`
- Add `isSuperAdmin` boolean to state
- Add `viewingCompanyId` for Super Admin company context
- Update `localStorage` persistence to include company context
- Update all API calls to include `Authorization` header (already done) and `X-Company-Id` when applicable

---

#### Task 44: Update Sidebar to Show Company Branding
**File:** `frontend/src/main.js`, `frontend/index.html`
**Action:**
- Display company logo and name at top of sidebar
- Show role badge below company name
- Different sidebar color per role (keep existing behavior)
- Super Admin gets a unique purple/gold theme
- Add company switcher for Super Admin in sidebar footer

---

#### Task 45: Update User Management Screen for Company Context
**File:** `frontend/src/main.js` (`renderUserManagementScreen`)
**Action:**
- Show only users belonging to current company
- Admin can create users within their company only
- Role dropdown shows only roles available in this company
- Super Admin can see all users across companies (with company column)
- Add "Company" column when viewing as Super Admin

---

#### Task 46: Update Role Management Screen for Company Context
**File:** `frontend/src/main.js` (`renderRoleManagementScreen`)
**Action:**
- Show only roles belonging to current company
- Allow Admin to create custom roles for their company
- Permission matrix shows company-available screens only
- Prevent deletion of the 4 system roles (Admin, CMO, PPP, Expert)
- Super Admin can manage global/system roles

---

#### Task 47: Create Ad Account Management Screen (Admin)
**File:** `frontend/src/main.js`
**Action:** New `renderAdAccountManagementScreen()` function:
- List connected ad accounts per platform (Facebook, TikTok, YouTube, Google)
- Add Account button with OAuth flow per platform
- Show account status (active / expired / error)
- Token refresh button for expired tokens
- Test Connection button per account
- Remove Account button with confirmation

---

### PHASE 9: Enhanced Campaign Builder UI

---

#### Task 48: Create Campaign Builder Wizard
**File:** `frontend/src/main.js`
**Action:** New multi-step wizard replacing current linear flow:
- Step indicator bar at top (1. Objective -> 2. Audience -> 3. Strategy -> 4. Ad Set -> 5. Creative -> 6. Review)
- Navigation: Next/Back buttons + step click for completed steps
- Auto-save draft on each step transition
- Progress saved to `campaign_workflow_steps` via API
- Validation before proceeding to next step

---

#### Task 49: Redesign Objective Screen (Step 1)
**File:** `frontend/src/main.js` (`renderObjectiveScreen`)
**Action:**
- Three-category layout (like Facebook Ads Manager):
  - **Awareness:** Reach, Brand Awareness, Video Views
  - **Consideration:** Traffic, Engagement, App Installs, Lead Generation, Messages
  - **Conversion:** Conversions, Catalog Sales, Store Traffic
- Each objective shows description, recommended platforms, expected results
- Platform compatibility indicators (which platforms support this objective)
- Campaign name input and schedule date picker

---

#### Task 50: Redesign Targeting Screen (Step 2)
**File:** `frontend/src/main.js` (`renderTargetingScreen`)
**Action:**
- Enhanced audience builder:
  - **Location:** Country, State/Region, City, Radius targeting
  - **Demographics:** Age range slider, Gender, Language, Education, Income
  - **Interests:** Searchable interest categories with nested subcategories
  - **Behaviors:** Purchase behavior, Device usage, Travel
  - **Custom Audiences:** Upload customer list, Website visitors, App users
  - **Lookalike:** Create lookalike from custom audience, similarity %
  - **Exclusions:** Exclude specific audiences
- Estimated audience size indicator (like Facebook's dial)
- Save audience as template for reuse

---

#### Task 51: Enhance Strategy Hub (Step 3)
**File:** `frontend/src/main.js` (`renderStrategyHub`)
**Action:**
- Keep existing 3-phase AI research flow
- Add: AI-generated strategy summary document after completion
- Add: Competitive analysis section (optional)
- Add: "Skip AI Strategy" option for experienced users
- Add: Save strategy as template for future campaigns
- Show strategy recommendations based on selected objective

---

#### Task 52: Create Ad Set Configuration Screen (Step 4)
**File:** `frontend/src/main.js`
**Action:** New `renderAdSetConfigScreen()` function:
- Budget section: Daily budget / Lifetime budget toggle, amount input
- Bid strategy: Lowest Cost / Cost Cap / Bid Cap (with explanation tooltips)
- Schedule: Start/End date pickers, dayparting grid (hour x day matrix)
- Placement: Platform-specific placement checkboxes
  - Facebook: Feed, Stories, Reels, Right Column, Marketplace, Audience Network
  - TikTok: For You Page, Pangle, Automatic
  - YouTube: In-Stream, Discovery, Shorts, Bumper
  - Google: Search, Display Network, Shopping, Gmail
- Optimization goal: Dropdown based on selected objective
- Multiple ad sets support (add/remove ad sets within campaign)

---

#### Task 53: Enhance Creative Studio (Step 5)
**File:** `frontend/src/main.js` (`renderStudioScreen`)
**Action:**
- Split into sub-tabs: Upload / Generate / Variations / Text
- **Upload tab:** Drag-and-drop media upload, URL import (existing)
- **Generate tab:** AI-generated creative suggestions (future integration)
- **Variations tab:** A/B variants, auto-generate size variants per platform
- **Text tab:** Headline variations, Description variations, CTA selection
- Ad preview: Show how ad will look on each selected platform
- Brand compliance indicator (check against brand guidelines)
- Assign creatives to specific ad sets

---

#### Task 54: Create Campaign Review & Submit Screen (Step 6)
**File:** `frontend/src/main.js`
**Action:** New `renderCampaignReviewScreen()` function:
- Full campaign summary: objective, audience, budget, schedule, platforms
- Ad set summary cards with targeting details
- Creative preview gallery
- Estimated results panel (reach, clicks, spend forecast)
- Cost breakdown per platform
- "Save as Draft" button
- "Submit for Approval" button (sends to CMO queue)
- JSON payload inspector (expandable, for advanced users)

---

### PHASE 10: Enhanced Approval Workflow

---

#### Task 55: Redesign CMO Approval Screen
**File:** `frontend/src/main.js` (`renderApprovalsScreen`)
**Action:**
- Replace simple asset queue with full campaign approval view
- Show campaign cards with: name, objective, budget, platform, creator, date
- Click to expand: full campaign detail (ad sets, creatives, targeting)
- Action buttons per campaign: Approve All / Reject / Request Changes
- Per-ad approval: approve/reject individual ads within a campaign
- Rejection requires notes/feedback (mandatory text field)
- Approval auto-moves campaign to PPP deployment queue
- Filter tabs: Pending / Approved / Rejected / All

---

#### Task 56: Create Approval Comments & Feedback System
**File:** `backend/Models.cs`, `backend/Program.cs`
**Action:**
```
Table: approval_comments
- id (int, PK)
- campaign_id (int, FK)
- ad_id (int, nullable, FK)
- user_id (int, FK)
- comment (text)
- action (string) — approve / reject / request_changes / comment
- created_at (DateTime)
```
API:
```
POST /api/campaigns/{id}/comments     — Add comment
GET  /api/campaigns/{id}/comments     — List comments
```

---

#### Task 57: Create Notification System
**File:** `backend/Models.cs`, `backend/Program.cs`, `frontend/src/main.js`
**Action:**
```
Table: notifications
- id (int, PK)
- company_id (int, FK)
- user_id (int, FK) — recipient
- type (string) — campaign_submitted / campaign_approved / campaign_rejected / deploy_success / deploy_failed / budget_alert
- title (string)
- message (string)
- resource_type (string) — campaign / ad / deployment
- resource_id (int)
- is_read (boolean, default false)
- created_at (DateTime)
```
API:
```
GET  /api/notifications                — List user's notifications
PUT  /api/notifications/{id}/read     — Mark as read
POST /api/notifications/read-all      — Mark all as read
```
Frontend: notification bell with unread count badge, dropdown panel

---

### PHASE 11: Monitoring & Analytics

---

#### Task 58: Create `ad_metrics` Table
**File:** `backend/Models.cs`
**Action:**
```
Table: ad_metrics
- id (int, PK)
- company_id (int, FK)
- campaign_id (int, FK)
- ad_set_id (int, FK)
- ad_id (int, FK)
- platform (string)
- date (DateOnly)
- impressions (long)
- clicks (long)
- ctr (decimal) — click-through rate
- cpc (decimal) — cost per click
- cpm (decimal) — cost per 1000 impressions
- spend (decimal)
- conversions (int)
- conversion_value (decimal)
- roas (decimal) — return on ad spend
- reach (long)
- frequency (decimal)
- video_views (long, nullable)
- video_completions (long, nullable)
- fetched_at (DateTime)
```

---

#### Task 59: Create Metrics Fetch Scheduler
**File:** `backend/Services/MetricsFetchService.cs` (new)
**Action:**
- Background service (`IHostedService`) that runs on a schedule
- Fetch metrics from each platform API for all active campaigns
- Store in `ad_metrics` table
- Handle rate limiting and API quotas
- Log fetch status and errors
- Configurable interval (default: every 4 hours)

---

#### Task 60: Create Analytics API Endpoints
**File:** `backend/Program.cs`
**Action:**
```
GET /api/analytics/campaigns/{id}/metrics       — Metrics for one campaign
GET /api/analytics/overview                      — Company-wide performance summary
GET /api/analytics/platforms                      — Per-platform comparison
GET /api/analytics/trends?range=7d|30d|90d       — Time-series data
GET /api/analytics/top-performers                 — Best performing ads/campaigns
GET /api/analytics/budget-utilization             — Budget spend vs allocation
```

---

#### Task 61: Redesign Dashboard Screen with Real Analytics
**File:** `frontend/src/main.js` (`renderDashboard`)
**Action:**
- Replace hard-coded mock data with real API data
- KPI cards: Total Spend, Impressions, Clicks, Conversions, ROAS
- Line chart: spend/performance trend over time
- Pie chart: spend distribution by platform
- Bar chart: top 5 campaigns by performance
- Table: active campaigns with status and key metrics
- Quick action buttons: Create Campaign, View Approvals, Deploy
- Role-specific dashboard variants (Expert sees creative metrics, CMO sees budget, PPP sees deployment status)

---

#### Task 62: Create Ad Performance Screen with Real Data
**File:** `frontend/src/main.js` (`renderAdPerformanceScreen`)
**Action:**
- Replace mock data with `GET /api/analytics/campaigns/{id}/metrics`
- Filterable by: date range, platform, campaign, ad set
- Table columns: Campaign, Platform, Impressions, Clicks, CTR, CPC, Spend, Conversions, ROAS
- Sortable columns
- Export to CSV
- Platform comparison view (side-by-side)
- Sparkline mini-charts in each row

---

#### Task 63: Create Cross-Platform Analytics Screen (CMO)
**File:** `frontend/src/main.js`
**Action:** New `renderCrossPlatformAnalyticsScreen()` function:
- Side-by-side platform comparison for same campaign
- Unified metrics normalized across platforms
- Platform allocation recommendations (AI-suggested)
- Budget efficiency score per platform
- Audience overlap analysis

---

### PHASE 12: Google Ads & YouTube Specific Features

---

#### Task 64: Create Google Ads Deploy Module
**File:** `frontend/src/googleAdsDeploy.js` (new)
**Action:**
- Payload builder for Google Ads campaigns
- Support: Search campaigns (keywords, ad groups, responsive search ads)
- Support: Display campaigns (audience targeting, responsive display ads)
- Support: Performance Max campaigns
- Keyword planner integration (suggest keywords)
- Ad preview for Search and Display formats

---

#### Task 65: Create YouTube Ads Deploy Module
**File:** `frontend/src/youtubeAdsDeploy.js` (new)
**Action:**
- Payload builder for YouTube ad campaigns
- Support formats: In-Stream (skippable/non-skippable), Discovery, Shorts, Bumper
- Video upload to YouTube via API
- Video ad preview component
- Targeting: topics, keywords, placements, demographics

---

#### Task 66: Add Google/YouTube Config to Platform Selection Screen
**File:** `frontend/src/main.js` (`renderDeploySelectionScreen`)
**Action:**
- Add Google Ads platform card with config modal:
  - Campaign type: Search / Display / Shopping / Performance Max
  - Keywords (for Search)
  - Bid strategy, budget
  - Ad copy: Headlines (up to 15), Descriptions (up to 4)
- Add YouTube platform card with config modal:
  - Video ad format selection
  - Video asset selection from library
  - Companion banner upload (optional)
  - Targeting options

---

### PHASE 13: Company Onboarding Flow

---

#### Task 67: Create Company Registration/Onboarding API
**File:** `backend/Program.cs`
**Action:**
```
POST /api/onboard/company — Create company + admin user in one step
Request: {
  companyName, industry, website,
  adminUsername, adminPassword, adminEmail
}
Response: {
  company: { id, name, slug },
  admin: { id, username },
  token: JWT
}
```
- Auto-creates company record
- Auto-creates Admin user for that company
- Seeds default roles (Admin, CMO, PPP, Expert)
- Seeds default screen permissions
- Returns JWT so admin can immediately start configuring

---

#### Task 68: Create Company Onboarding Wizard (Frontend)
**File:** `frontend/src/main.js`
**Action:** New `renderOnboardingWizard()` function:
- Step 1: Company Info (name, industry, website, logo)
- Step 2: Brand Guidelines (quick setup — colors, fonts, tone)
- Step 3: Connect Ad Platforms (Facebook, TikTok, YouTube, Google OAuth)
- Step 4: Invite Team Members (email invites with role assignment)
- Step 5: Create First Campaign (optional quick-start)
- Progress bar, skip buttons, "Complete Later" option

---

#### Task 69: Create Team Invitation System
**File:** `backend/Models.cs`, `backend/Program.cs`
**Action:**
```
Table: invitations
- id (int, PK)
- company_id (int, FK)
- email (string)
- role_id (int, FK)
- invited_by (int, FK -> users.id)
- token (string, unique) — invitation link token
- status (string) — pending / accepted / expired
- created_at (DateTime)
- expires_at (DateTime)
```
API:
```
POST /api/invitations              — Send invitation
GET  /api/invitations              — List company invitations
POST /api/invitations/{token}/accept — Accept invitation & create account
DELETE /api/invitations/{id}       — Revoke invitation
```

---

### PHASE 14: Advanced Features

---

#### Task 70: Create A/B Testing Framework
**File:** `backend/Models.cs`, `backend/Program.cs`
**Action:**
```
Table: ab_tests
- id (int, PK)
- company_id (int, FK)
- campaign_id (int, FK)
- name (string)
- variant_a_ad_id (int, FK -> ads.id)
- variant_b_ad_id (int, FK -> ads.id)
- metric (string) — ctr / cpc / conversion_rate / roas
- traffic_split (int) — percentage for variant A (e.g., 50)
- status (string) — running / completed / cancelled
- winner (string, nullable) — A / B / inconclusive
- confidence_level (decimal, nullable)
- started_at (DateTime)
- ended_at (DateTime, nullable)
```
API:
```
POST /api/ab-tests              — Create A/B test
GET  /api/ab-tests              — List tests
GET  /api/ab-tests/{id}/results — Get test results with statistical significance
POST /api/ab-tests/{id}/end     — End test and declare winner
```

---

#### Task 71: Create Budget Management System
**File:** `backend/Models.cs`, `backend/Program.cs`
**Action:**
```
Table: budget_allocations
- id (int, PK)
- company_id (int, FK)
- period (string) — monthly / quarterly / yearly
- period_start (DateOnly)
- period_end (DateOnly)
- total_budget (decimal)
- facebook_allocation (decimal)
- tiktok_allocation (decimal)
- youtube_allocation (decimal)
- google_allocation (decimal)
- spent_to_date (decimal)
- status (string) — active / closed
- created_by (int, FK -> users.id)
- created_at (DateTime)
```
API:
```
POST /api/budgets                — Create budget allocation
GET  /api/budgets                — List budgets
GET  /api/budgets/current        — Get current period budget with spend
PUT  /api/budgets/{id}           — Update allocation
GET  /api/budgets/forecast       — Predict end-of-period spend based on current pace
```

---

#### Task 72: Create Activity/Audit Log System
**File:** `backend/Models.cs`, `backend/Program.cs`
**Action:**
```
Table: activity_logs
- id (int, PK)
- company_id (int, nullable, FK)
- user_id (int, FK)
- action (string) — created / updated / deleted / approved / rejected / deployed / logged_in
- resource_type (string) — campaign / ad / user / role / company / deployment
- resource_id (string)
- details (jsonb) — additional context
- ip_address (string)
- created_at (DateTime)
```
- Add logging middleware that auto-captures actions on POST/PUT/DELETE endpoints
- Super Admin can view all logs; Company Admin sees company logs only

---

#### Task 73: Create Campaign Templates System
**File:** `backend/Models.cs`, `backend/Program.cs`
**Action:**
```
Table: campaign_templates
- id (int, PK)
- company_id (int, FK)
- name (string)
- description (string)
- objective_id (int, FK)
- targeting_template (jsonb)
- budget_template (jsonb)
- creative_specs (jsonb)
- platforms (string[])
- is_global (boolean) — Super Admin can create global templates
- created_by (int, FK -> users.id)
- created_at (DateTime)
```
API:
```
POST /api/templates              — Save campaign as template
GET  /api/templates              — List available templates
POST /api/templates/{id}/use     — Create new campaign from template
DELETE /api/templates/{id}       — Delete template
```

---

#### Task 74: Add Brand Compliance Checker
**File:** `backend/Program.cs`, `frontend/src/main.js`
**Action:**
- `POST /api/compliance/check` endpoint
- Input: ad text (headline, description), creative asset URL
- Check against company's brand guidelines:
  - Tone match (via Gemini AI analysis)
  - Blacklisted words detection
  - Whitelisted terms presence
  - Color palette compliance (extract colors from image)
  - Typography check (if text overlays)
- Return compliance score (0-100) with specific violations listed
- Show compliance badge on each ad in Creative Studio

---

### PHASE 15: Frontend Polish & UX

---

#### Task 75: Create Loading States & Skeleton Screens
**File:** `frontend/src/main.js`, `frontend/src/style.css`
**Action:**
- Add skeleton loading placeholders for all data-loading screens
- Pulse animation for placeholder cards
- Proper loading spinners for async operations
- Disable buttons during API calls (prevent double-submit)
- Toast notifications for success/error feedback on all actions

---

#### Task 76: Add Responsive Design for Mobile/Tablet
**File:** `frontend/src/style.css`, `frontend/index.html`
**Action:**
- Collapsible sidebar for mobile (hamburger menu)
- Responsive grid layouts for dashboard cards
- Touch-friendly buttons and form inputs
- Mobile-optimized table views (horizontal scroll or card view)
- Media queries for: mobile (<768px), tablet (768-1024px), desktop (>1024px)

---

#### Task 77: Create Global Search
**File:** `frontend/src/main.js`
**Action:**
- Search bar in header
- Search across: campaigns, ads, users, assets
- Keyboard shortcut: Ctrl+K / Cmd+K to focus search
- Dropdown results with category grouping
- Navigate to result on click
- Backend: `GET /api/search?q=term` endpoint that searches across entities

---

#### Task 78: Add Theme System Enhancement
**File:** `frontend/src/style.css`, `frontend/src/main.js`
**Action:**
- Keep existing 4 themes (Dark, Light, Blue, Red)
- Add company-branded theme option (uses company's brand palette)
- Super Admin gets a unique "Platinum" theme
- Per-user theme preference saved to profile
- Smooth theme transition animations

---

#### Task 79: Create Breadcrumb Navigation
**File:** `frontend/src/main.js`
**Action:**
- Show breadcrumb trail below header: Home > Campaigns > Campaign Name > Ad Set > Ad
- Clickable breadcrumb segments for quick navigation
- Dynamic based on current screen and context depth
- Especially important in campaign builder wizard

---

#### Task 80: Create Help & Onboarding Tooltips
**File:** `frontend/src/main.js`
**Action:**
- First-time-use tooltips highlighting key features
- "?" icons next to complex form fields with explanatory tooltips
- Guided tour for new users (step-by-step overlay)
- Context-sensitive help panel (collapsible sidebar)
- Dismiss and "Don't show again" options

---

### PHASE 16: Security & Infrastructure

---

#### Task 81: Implement Refresh Token System
**File:** `backend/Program.cs`, `backend/Models.cs`
**Action:**
```
Table: refresh_tokens
- id (int, PK)
- user_id (int, FK)
- token (string, unique)
- expires_at (DateTime)
- created_at (DateTime)
- revoked_at (DateTime, nullable)
- replaced_by (string, nullable) — for token rotation
```
- Shorten JWT expiry to 15 minutes
- Issue refresh token (7-day expiry) alongside JWT
- `POST /api/auth/refresh` endpoint for token rotation
- Auto-refresh on frontend when JWT expires
- Revoke all tokens on password change or logout

---

#### Task 82: Add Rate Limiting
**File:** `backend/Program.cs`
**Action:**
- Add `AspNetCoreRateLimit` NuGet package
- Rate limit per IP: 100 requests/minute (general)
- Rate limit per user: 200 requests/minute
- Stricter limits on auth endpoints: 10 requests/minute per IP
- Stricter limits on deploy endpoints: 20 requests/minute per company
- Return `429 Too Many Requests` with `Retry-After` header

---

#### Task 83: Encrypt Sensitive Data at Rest
**File:** `backend/Services/EncryptionService.cs` (new)
**Action:**
- Create `EncryptionService` using AES-256 encryption
- Encrypt: ad platform access tokens, refresh tokens, API keys in `company_ad_accounts`
- Encrypt: user email addresses (optional, for GDPR)
- Store encryption key in environment variable (not appsettings.json)
- Decrypt on read, encrypt on write

---

#### Task 84: Add Request Validation & Input Sanitization
**File:** `backend/Program.cs`, all endpoints
**Action:**
- Add FluentValidation NuGet package
- Validate all request DTOs:
  - Campaign: name length (3-200), budget > 0, valid dates
  - User: username (3-50, alphanumeric), email format, password strength
  - Company: name (2-100), valid URL for website
- Sanitize HTML/script injection in all text inputs
- Return structured validation error responses

---

#### Task 85: Add CORS Configuration for Production
**File:** `backend/Program.cs`
**Action:**
- Replace `AllowAll` CORS policy with specific origins
- Environment-based CORS: dev allows localhost, production allows specific domains
- Allow credentials for cookie-based refresh tokens
- Configure allowed headers and methods explicitly

---

#### Task 86: Add API Versioning
**File:** `backend/Program.cs`
**Action:**
- Add `Asp.Versioning.Http` NuGet package
- Version all endpoints: `/api/v1/campaigns`, `/api/v1/auth/login`
- Keep `/api/` as alias for `/api/v1/` (backward compatibility)
- Header-based versioning as alternative: `Api-Version: 1`
- Prepare for future v2 endpoints

---

### PHASE 17: Testing & Quality

---

#### Task 87: Create Backend Unit Tests
**File:** `backend.tests/` (new project)
**Action:**
- Create `backend.tests` xUnit project
- Test auth endpoints: register, login, token validation
- Test RBAC: role creation, permission assignment, access control
- Test campaign CRUD operations
- Test tenant isolation (user A cannot see company B data)
- Test Super Admin cross-company access
- Mock database with in-memory EF Core provider

---

#### Task 88: Create Integration Tests for Ad Platform APIs
**File:** `backend.tests/Integration/` (new)
**Action:**
- Facebook API integration test (sandbox mode)
- TikTok API integration test (sandbox mode)
- Test deployment orchestrator with mock platform services
- Test credential loading per company
- Test error handling and fallback to simulation

---

#### Task 89: Create Frontend E2E Tests
**File:** `frontend/tests/` (new)
**Action:**
- Use Playwright or Cypress
- Test login flow for each role
- Test campaign creation wizard end-to-end
- Test approval workflow (Expert -> CMO -> PPP)
- Test Super Admin company switching
- Test role-based screen access (verify hidden screens are inaccessible)

---

### PHASE 18: DevOps & Deployment

---

#### Task 90: Create Docker Configuration
**Files:** `Dockerfile`, `docker-compose.yml` (new)
**Action:**
- Dockerfile for backend (ASP.NET Core 9.0)
- Dockerfile for frontend (Node + Vite build + nginx serve)
- docker-compose.yml with:
  - Backend service
  - Frontend service
  - PostgreSQL service
  - Volume mounts for assets and database
- Environment variable configuration for all secrets

---

#### Task 91: Create CI/CD Pipeline
**File:** `.github/workflows/ci.yml` (new)
**Action:**
- Trigger on push to main and pull requests
- Steps: restore, build, test (backend), test (frontend), lint
- Build Docker images on merge to main
- Tag images with commit SHA and `latest`
- Optional: deploy to staging on merge to `develop`

---

#### Task 92: Create Database Migration Script for Production
**File:** `backend/Scripts/migrate.sql` (new)
**Action:**
- SQL migration script for existing databases
- Add all new tables (companies, company_ad_accounts, etc.)
- Add `company_id` columns to existing tables
- Create default company and migrate existing data
- Create Super Admin user
- Idempotent (safe to run multiple times)

---

### PHASE 19: Documentation & Cleanup

---

#### Task 93: Refactor `Program.cs` into Controller Classes
**File:** `backend/Controllers/` (new directory)
**Action:**
- Extract endpoints into organized controllers:
  - `AuthController.cs` — auth endpoints
  - `RbacController.cs` — role/user/permission endpoints
  - `CampaignController.cs` — campaign CRUD + workflow
  - `AssetController.cs` — asset management
  - `DeployController.cs` — deployment endpoints
  - `AnalyticsController.cs` — metrics and analytics
  - `SuperAdminController.cs` — super admin endpoints
  - `NotificationController.cs` — notification endpoints
- Keep Program.cs clean with only DI, middleware, and route mapping

---

#### Task 94: Refactor `main.js` into Modules
**File:** `frontend/src/` (split into multiple files)
**Action:**
- Split 3,277-line `main.js` into modular files:
  - `state.js` — state management
  - `api.js` — API client with auth headers
  - `router.js` — screen navigation
  - `screens/dashboard.js` — dashboard rendering
  - `screens/campaign-builder.js` — campaign wizard
  - `screens/approvals.js` — CMO approval screen
  - `screens/deploy.js` — PPP deployment screen
  - `screens/admin.js` — admin screens (users, roles, config)
  - `screens/super-admin.js` — super admin screens
  - `components/sidebar.js` — sidebar rendering
  - `components/header.js` — header rendering
  - `utils/format.js` — formatting helpers
- Use ES module imports/exports
- Vite handles bundling automatically

---

#### Task 95: Create API Documentation
**File:** `backend/` (Swagger/OpenAPI)
**Action:**
- Add Swashbuckle/NSwag NuGet package
- Auto-generate OpenAPI spec from endpoints
- Add XML doc comments to all request/response records
- Enable Swagger UI at `/swagger` in development
- Group endpoints by tag (Auth, RBAC, Campaigns, Deploy, Analytics, SuperAdmin)
- Document authentication requirements per endpoint

---

#### Task 96: Update `appsettings.json` Template
**File:** `backend/appsettings.json`, `backend/appsettings.example.json` (new)
**Action:**
- Create `appsettings.example.json` with placeholder values (no real keys)
- Add new config sections: `Encryption`, `RateLimiting`, `Companies`
- Remove hard-coded API keys from `appsettings.json`
- Add `appsettings.json` to `.gitignore`
- Document all configuration options

---

#### Task 97: Create `.env.example` for Frontend
**File:** `frontend/.env.example` (new)
**Action:**
- `VITE_API_BASE=http://localhost:5243/api`
- `VITE_APP_NAME=AI Marketing Platform`
- `VITE_DEFAULT_THEME=dark`
- Update `main.js` to read from `import.meta.env`

---

#### Task 98: Update `.gitignore`
**File:** `.gitignore`
**Action:**
- Add: `appsettings.json`, `appsettings.Development.json`
- Add: `*.env`, `.env.local`
- Add: `backend/Assets/`, `backend/Assets Library/`
- Add: `ppc_queue.json`, `cmo_queue.json`, `campaigns.json`
- Add: `node_modules/`, `dist/`, `bin/`, `obj/`
- Keep: `appsettings.example.json`

---

#### Task 99: Create System Architecture Documentation
**File:** `docs/ARCHITECTURE.md` (new)
**Action:**
- System architecture diagram (multi-tenant)
- Database ER diagram (complete schema)
- API endpoint reference table
- Authentication & authorization flow
- Campaign lifecycle state machine diagram
- Deployment sequence diagrams per platform
- Role & permission matrix table
- Data flow diagrams (Level 0, 1, 2)

---

#### Task 100: Final Integration Testing & Launch Checklist
**File:** `docs/LAUNCH_CHECKLIST.md` (new)
**Action:**
- [ ] All database migrations applied successfully
- [ ] Super Admin can create and manage companies
- [ ] Super Admin can enter any company and see its full data
- [ ] Company Admin can manage users only within their company
- [ ] CMO can approve/reject campaigns only within their company
- [ ] PPP can deploy only approved campaigns within their company
- [ ] Expert can create campaigns only within their company
- [ ] Cross-company data isolation verified (company A cannot see company B)
- [ ] JWT tokens include company context
- [ ] All 4 ad platform integrations working (Facebook, TikTok, YouTube, Google)
- [ ] Campaign lifecycle workflow complete (draft -> review -> approve -> deploy -> monitor)
- [ ] Real-time analytics dashboard with real data
- [ ] Notification system working for all workflow events
- [ ] A/B testing framework functional
- [ ] Budget management system functional
- [ ] Rate limiting active on all endpoints
- [ ] Sensitive data encrypted at rest
- [ ] Docker deployment working
- [ ] CI/CD pipeline passing
- [ ] API documentation accessible via Swagger
- [ ] All unit and integration tests passing
- [ ] Performance tested with multiple companies (10+ simultaneous)
- [ ] Security audit: no SQL injection, XSS, CSRF vulnerabilities
- [ ] Mobile responsive design verified on iOS and Android browsers

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| Phase 1  | Tasks 1-8   | Database & Multi-Tenancy Foundation |
| Phase 2  | Tasks 9-15  | Super Admin Role & Authentication |
| Phase 3  | Tasks 16-20 | Tenant-Scoped Data Access |
| Phase 4  | Tasks 21-23 | Role Renaming (PPC->PPP, Business Admin->CMO) |
| Phase 5  | Tasks 24-32 | Enhanced Campaign Workflow |
| Phase 6  | Tasks 33-37 | Ad Platform Integrations (YouTube, Google) |
| Phase 7  | Tasks 38-42 | Frontend: Super Admin UI |
| Phase 8  | Tasks 43-47 | Frontend: Multi-Tenant Awareness |
| Phase 9  | Tasks 48-54 | Enhanced Campaign Builder UI |
| Phase 10 | Tasks 55-57 | Approval Workflow & Notifications |
| Phase 11 | Tasks 58-63 | Monitoring & Analytics |
| Phase 12 | Tasks 64-66 | Google Ads & YouTube Features |
| Phase 13 | Tasks 67-69 | Company Onboarding Flow |
| Phase 14 | Tasks 70-74 | Advanced Features (A/B, Budget, Templates) |
| Phase 15 | Tasks 75-80 | Frontend Polish & UX |
| Phase 16 | Tasks 81-86 | Security & Infrastructure |
| Phase 17 | Tasks 87-89 | Testing & Quality |
| Phase 18 | Tasks 90-92 | DevOps & Deployment |
| Phase 19 | Tasks 93-100| Documentation, Refactoring & Launch |

**Total: 100 Tasks across 19 Phases**
