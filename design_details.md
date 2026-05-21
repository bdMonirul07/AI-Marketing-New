# AI-Marketing New — Design Details

> Comprehensive system design documentation covering architecture, roles, features, flows, data, security, and deployment.

---

## Table of Contents

1. [System Overview / High-Level Architecture](#1-system-overview--high-level-architecture)
2. [User Roles & Permissions](#2-user-roles--permissions)
3. [Feature Breakdown (Core Modules)](#3-feature-breakdown-core-modules)
4. [UI/UX Flow (Screen Flow)](#4-uiux-flow-screen-flow)
5. [System Flow (End-to-End Process)](#5-system-flow-end-to-end-process)
6. [Data Flow Diagram (DFD)](#6-data-flow-diagram-dfd)
7. [Database Design (Data Structure)](#7-database-design-data-structure)
8. [Technical Architecture (Deep Level)](#8-technical-architecture-deep-level)
9. [Security Plan](#9-security-plan)
10. [Deployment & DevOps](#10-deployment--devops)

---

## 1. System Overview / High-Level Architecture

### What Is This System?

**AI-Marketing New** is an enterprise SaaS platform for orchestrating AI-driven marketing campaigns across multiple advertising platforms. It enables marketing teams to plan, create, approve, deploy, and monitor ad campaigns — all within a single multi-tenant application.

### Core Capabilities

| Capability | Description |
|---|---|
| **AI Strategy** | Google Gemini 2.0 Flash generates 2-phase campaign strategy questions |
| **Multi-Platform Deployment** | Deploy ads to Facebook, TikTok, YouTube, and Google Ads via official APIs |
| **Approval Workflows** | Expert → CMO → PPP pipeline ensures brand & budget compliance |
| **Multi-Tenancy** | Each company operates in an isolated tenant with its own users, roles, and data |
| **Role-Based Access Control** | 5 system roles with 33 granular screen-level permissions |
| **Creative Asset Management** | Upload, review, approve, and deploy creative assets with lifecycle tracking |
| **Real-Time Analytics** | Background metrics polling aggregates performance data per campaign/platform |
| **Budget Management** | Period-based budget allocation with per-platform spend tracking |

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT BROWSER                               │
│                  Vanilla JS SPA (Vite 7 + Tailwind 4)               │
│                  http://localhost:5173 (dev) / :80 (prod)           │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTP/REST (JSON)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          NGINX REVERSE PROXY                        │
│   /        → serves SPA index.html (SPA routing)                   │
│   /api/*   → proxy_pass → backend:5243                             │
│   /assets/ → proxy_pass → backend:5243                             │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    ASP.NET CORE 9 BACKEND (Minimal APIs)            │
│                       http://localhost:5243                         │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Auth (JWT)   │  │ RBAC / CORS  │  │  TenantMiddleware        │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    BUSINESS SERVICES                          │  │
│  │  DeploymentOrchestrator │ FacebookAdsService                  │  │
│  │  TikTokAdsService       │ GoogleAdsService                    │  │
│  │  YouTubeAdsService      │ BrandComplianceService              │  │
│  │  MetricsFetchService (Background Hosted Service)              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              ENTITY FRAMEWORK CORE 9 (ORM)                   │  │
│  └──────────────────────────┬─────────────────────────────────  ┘  │
└─────────────────────────────┼───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  POSTGRESQL 16 DATABASE                             │
│                  28 Tables | JSONB | Indexed Multi-tenancy          │
└─────────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼───────────────────────┐
         ▼                    ▼                        ▼
┌─────────────────┐  ┌────────────────┐  ┌────────────────────────┐
│  GOOGLE GEMINI  │  │  FACEBOOK ADS  │  │  TIKTOK BUSINESS API   │
│  2.0 Flash API  │  │  Graph API v19 │  │  v1.3                  │
└─────────────────┘  └────────────────┘  └────────────────────────┘
```

### Multi-Tenancy Model

Every tenant (company) is isolated by `company_id`. The `TenantMiddleware` reads the JWT claim and automatically scopes all queries. Super Admins can switch context via the `X-Company-Id` custom header.

```
System (Super Admin)
├── Company A (Admin, CMO, Expert, PPP)
│   ├── Campaigns
│   ├── Users
│   ├── Assets
│   └── Ad Accounts
├── Company B (...)
└── Company N (...)
```

---

## 2. User Roles & Permissions

### Role Hierarchy

```
Super Admin  ←──── system-wide, across all companies
     │
   Admin  ←──────── company-level management
     │
   CMO  ←────────── budget & approval authority
     │
 Expert  ←────────── campaign creation & AI research
     │
   PPP  ←───────────── deployment & performance monitoring
```

### Role Definitions

#### Super Admin
**Scope**: Global (all companies)

| Permission | Details |
|---|---|
| View all companies | GlobalDashboard with system-wide KPIs |
| Manage companies | Create, update, archive companies |
| View all users | Across all tenants |
| Audit system activity | Full AuditLog access |
| System configuration | SystemConfig screen |

**Exclusive Screens**: `GlobalDashboard`, `CompanyManagement`, `SystemConfig`, `AuditLog`

---

#### Admin
**Scope**: Own company

| Permission | Details |
|---|---|
| User Management | Create, invite, activate/deactivate users |
| Role Management | Create/edit custom roles; assign screen permissions |
| Company Profile | Edit company info (name, industry, website, logo) |
| Platform Config | Store API tokens for Facebook, TikTok, Google, TikTok |
| Brand Guidelines | Define brand DNA (tone, palette, whitelist/blacklist) |
| Asset Library | Browse and manage creative assets |
| Ad Account Management | Connect/update/remove ad platform accounts |
| Billing Settings | Subscription plan and billing info |

**Screens**: `Dashboard`, `UserManagement`, `RoleManagement`, `CompanyProfile`, `Config`, `Calendar`, `Guideline`, `Assets`, `AdAccountManagement`, `BillingSettings` + shared

---

#### CMO (Chief Marketing Officer)
**Scope**: Own company — approval & financial authority

| Permission | Details |
|---|---|
| Campaign Approval | Review, approve, or reject submitted campaigns |
| Ad Creative Approval | Review CMO queue items (assets sent by Experts) |
| Budget Allocation | Set per-platform budget via BudgetMatrix |
| Monitoring | AI Monitoring of active/killed ads |
| Analytics | Cross-platform analytics, campaign reports |

**Screens**: `Dashboard`, `BudgetMatrix`, `Approvals`, `Monitoring`, `AdPerformance`, `Budget`, `Notifications`, `CampaignReports`, `CrossPlatformAnalytics`

---

#### Expert (Marketing Expert)
**Scope**: Own company — campaign creation & AI research

| Permission | Details |
|---|---|
| Create Campaigns | Define objective, targeting, strategy |
| AI Research | Run Gemini-powered 2-phase strategy research |
| Creative Config | Set style preset, aspect ratio, generation counts |
| Creative Studio | Upload, review, approve assets; push to CMO queue |
| Audience Insights | View demographic & behavioral data |
| Competitor Research | Competitor analysis tools |

**Screens**: `Dashboard`, `Objective`, `Targeting`, `Research`, `CreativeConfig`, `Studio`, `AudienceInsights`, `CompetitorResearch`

---

#### PPP (Planner/Publisher/Performer)
**Scope**: Own company — deployment & performance

| Permission | Details |
|---|---|
| View Approved Assets | Browse CMO-approved queue items |
| Platform Selection | Choose deployment platforms (Facebook, TikTok, YouTube, Google) |
| Deploy Ads | Execute ad deployments with full platform configuration |
| Monitor Performance | View live ad performance metrics |
| Deployment History | View past deployment logs |
| A/B Test Results | Review A/B test results and winners |

**Screens**: `Dashboard`, `ApprovedAssets`, `DeploySelection`, `AdPerformance`, `Monitoring`, `Budget`, `DeploymentHistory`, `ABTestResults`

---

### Permission Enforcement Rules

```
1. Role-level permissions: defined in role_screens (role_id ↔ screen_id)
2. User-level overrides: defined in user_screens (user_id ↔ screen_id)
3. User-level permissions ALWAYS take priority over role permissions
4. Super Admin screens are hardware-filtered — only is_super_admin=true users see them
5. System roles (Super Admin, Admin, CMO, PPP, Expert) cannot be deleted
6. All screens are visible only if screen.is_active = true
```

### Screen Categories (33 Total)

| Category | Screens |
|---|---|
| **shared** | Dashboard, AdPerformance, Notifications |
| **expert** | Objective, Targeting, Research, CreativeConfig, Studio, AudienceInsights, CompetitorResearch |
| **cmo** | BudgetMatrix, Approvals, Monitoring, Budget, CampaignReports, CrossPlatformAnalytics |
| **ppp** | ApprovedAssets, DeploySelection, DeploymentHistory, ABTestResults |
| **admin** | UserManagement, RoleManagement, CompanyProfile, Config, Calendar, Guideline, Assets, AdAccountManagement, BillingSettings |
| **super** | GlobalDashboard, CompanyManagement, SystemConfig, AuditLog |

---

## 3. Feature Breakdown (Core Modules)

### Module 1 — Authentication & Session Management

- **JWT Bearer Tokens**: HS256 algorithm, 8-hour access token expiry
- **Password Hashing**: BCrypt.NET-Next v4.0.3 with salt
- **Token Rotation**: 7-day refresh tokens stored in `refresh_tokens` table with revocation tracking
- **Session Storage**: Token + user profile stored in browser localStorage
- **Sidebar Rendering**: After login, `screens[]` array from JWT response drives which menu items appear

**Endpoints**:
```
POST /api/auth/register   — Create user account
POST /api/auth/login      — Authenticate, return JWT + screens list
POST /api/auth/refresh    — Rotate refresh token
```

---

### Module 2 — Multi-Tenancy & Company Management

- Each company is an isolated tenant with its own users, campaigns, assets, roles, and API credentials
- `TenantMiddleware` auto-injects `company_id` from JWT claims into every DB query
- Super Admins use `X-Company-Id` header to switch tenant context
- Company onboarding seeds default roles, screens, users, and campaign objectives

**Key Tables**: `companies`, `company_settings`, `company_ad_accounts`

**Endpoints**:
```
POST /api/onboard/company                          — Full company setup with role seeding
GET  /api/super-admin/companies                    — List all companies
POST /api/super-admin/companies                    — Create company
GET  /api/super-admin/dashboard                    — System-wide KPI metrics
```

---

### Module 3 — Campaign Lifecycle Management

Campaigns follow a strict state machine:

```
draft → pending_review → approved → active ⇄ paused → completed
                       ↘ rejected → (revised) → pending_review
                                             ↘ archived
```

**Campaign Components**:
- **Campaign**: Master record (objectives, budgets, platforms, status)
- **Ad Set**: Audience/targeting/placement/schedule container
- **Ad**: Individual ad with headline, description, CTA
- **Ad Creative**: Media assets attached to an ad

**Key Fields**: `objective_id`, `brief`, `platforms[]`, `total_budget`, `daily_budget`, `bid_strategy`, `style_preset`, `aspect_ratio`, `targeting (JSONB)`

**Endpoints**:
```
POST   /api/campaigns                         — Create
GET    /api/campaigns                         — List (filtered by company/status)
GET    /api/campaigns/{id}                    — Details + workflow steps
PUT    /api/campaigns/{id}                    — Update
POST   /api/campaigns/{id}/submit             — Send for CMO review
POST   /api/campaigns/{id}/approve            — CMO approves
POST   /api/campaigns/{id}/reject             — CMO rejects with reason
POST   /api/campaigns/{id}/pause              — Pause active campaign
POST   /api/campaigns/{id}/resume             — Resume paused campaign
```

---

### Module 4 — AI Strategy Generation (Gemini)

Integrates **Google Gemini 2.0 Flash** in a structured 3-phase research flow:

```
Phase 1: Expert enters campaign brief
         ↓
         POST /api/gemini/questions
         ↓
         Returns 5 Level-1 conceptual questions

Phase 2: Expert answers Level-1 questions
         ↓
         POST /api/gemini/follow-up
         ↓
         Returns 5 Level-2 psychological/behavioral questions

Phase 3: Expert answers Level-2 → Complete strategy profile built
```

**Implementation Details**:
- Responses cached in `ConcurrentDictionary<string, string[]>` (in-memory)
- Retry logic with exponential backoff on API failures
- Graceful fallback if Gemini API is unavailable
- API key stored in `Gemini__ApiKey` environment variable

---

### Module 5 — Creative Asset Management

Full lifecycle from upload to deployment:

```
Upload → Review → Expert Approve → CMO Queue → CMO Approve → PPP Queue → Deploy
```

**Storage Layout**:
```
/Assets          — Working directory (uploaded, in-review assets)
/Assets Library  — Approved assets ready for deployment
```

**Supported Formats**: Images (JPG, PNG, GIF), Videos (MP4, MOV, WebM)

**Endpoints**:
```
GET    /api/assets                — List /Assets directory
POST   /api/assets/save-url       — Download image from URL (e.g. Unsplash)
DELETE /api/assets/{filename}     — Delete asset
POST   /api/assets/approve        — Copy asset to /Assets Library
GET    /api/assets-library        — List /Assets Library directory
```

---

### Module 6 — Approval Workflow Queues

**CMO Queue** (`cmo_queue` table):
- Expert submits assets with priority
- CMO reviews: `pending → approved | rejected`
- On approval: asset moves to PPP queue automatically

**PPP Queue** (`ppp_queue` table):
- CMO-approved assets land here
- PPP selects deploy platforms, configures parameters
- Status: `pending → deployed`
- Ordered by `queue_index`

**Endpoints**:
```
GET  /api/cmo/queue    — Fetch CMO queue
POST /api/cmo/queue    — Update CMO queue item (approve/reject)
GET  /api/ppp/queue    — Fetch PPP deployment queue
POST /api/ppp/queue    — Update PPP queue item (mark deployed)
```

---

### Module 7 — Multi-Platform Ad Deployment

#### Facebook (Graph API v19.0)
Full campaign hierarchy creation:
```
1. Create Campaign (objective, special categories)
2. Create Ad Set (budget, schedule, targeting, optimization)
3. Upload Media (image/video)
4. Create Ad Creative (page_id, link_data, image/video hash)
5. Create Ad (link creative → ad set)
```

#### TikTok (Business API v1.3)
```
1. Create Ad Group (budget mode, bid, placement, targeting, schedule)
2. Create Ad Creative (video_id, ad text, CTA)
```

#### Google Ads & YouTube
- Services implemented: `GoogleAdsService`, `YouTubeAdsService`
- Full deployment support planned/in progress

**Unified Deployment**:
```
POST /api/deploy/unified   — Deploy to multiple platforms simultaneously (DryRun mode supported)
```

`DeploymentOrchestrator` service coordinates multi-platform deployment and writes full audit trail to `deployment_logs`.

---

### Module 8 — RBAC System

Fully dynamic permission system:

```
Screen (33 screens, categorized)
   ↕ role_screens (role ↔ screen mapping)
Role (system + custom roles per company)
   ↕ user_screens (user-level overrides)
User
```

**Endpoints**:
```
GET    /api/rbac/roles                      — List roles
POST   /api/rbac/roles                      — Create custom role
PUT    /api/rbac/roles/{id}                 — Update role
DELETE /api/rbac/roles/{id}                 — Delete (non-system roles only)
GET    /api/rbac/screens                    — List screens
GET    /api/rbac/role-permissions/{roleId}  — Get screen IDs for role
POST   /api/rbac/role-permissions           — Assign screens to role
GET    /api/rbac/user-permissions/{userId}  — Get user-level overrides
POST   /api/rbac/user-permissions           — Set user-level overrides
POST   /api/rbac/seed                       — Initialize default data
```

---

### Module 9 — Analytics & Metrics

- **MetricsFetchService**: ASP.NET Core `IHostedService` (background)
  - Runs on startup, then every **4 hours**
  - Fetches metrics for all `active` campaigns from connected ad platform APIs
  - Writes daily aggregations to `ad_metrics` table

**Tracked Metrics**: Impressions, Reach, Clicks, CTR, CPC, CPM, Spend, Conversions, Conversion Value, ROAS, Frequency, Video Views, Video Completions, Leads, App Installs

**Endpoints**:
```
GET /api/analytics/overview              — Company-wide KPI summary
GET /api/analytics/campaigns/{id}/metrics — Campaign metrics (date range + platform filter)
GET /api/analytics/platforms             — Metrics grouped by platform
GET /api/analytics/top-performers        — Top 10 campaigns by ROAS
```

---

### Module 10 — Brand Guidelines

Enforces brand identity across all creatives:

- **Fields**: `brand_label`, `tone`, `language`, `description`, `tagline`, `logo_url`
- **Content Control**: `whitelist[]`, `blacklist[]` terms
- **Voice**: `voiceExamples`, `doList[]`, `dontList[]`
- **Typography**: `headings` & `body` (font family + size)
- **Color Palette**: Array of hex colors (5+ entries)

`BrandComplianceService` validates creative content against these guidelines before dispatch.

---

### Module 11 — Notifications & Activity Logging

**Notification Types**: `campaign_submitted`, `campaign_approved`, `campaign_rejected`, `asset_approved`, `asset_rejected`

- Per-user notification feed (last 50)
- Read/unread state tracking
- Action URLs for deep-linking to resources

**Activity Log**: Every CREATE, UPDATE, DELETE writes to `activity_logs` with user ID, IP address, action, resource type/ID, and JSONB details payload.

---

### Module 12 — Budget Management & A/B Testing

**Budget Allocations**:
- Period types: `monthly`, `quarterly`
- Per-platform allocation: `facebook_allocation`, `tiktok_allocation`, `youtube_allocation`, `google_allocation`
- Status tracking: `active`, `paused`, `completed`

**A/B Testing**:
- Variant A vs Variant B ad selection
- Metric: `ctr`, `roas`, or `conversions`
- Traffic split configuration
- Confidence level tracking
- Automatic winner determination

---

## 4. UI/UX Flow (Screen Flow)

### Authentication Flow

```
[Login Page]
    │
    ├─ Enter email + password
    │
    ▼
[POST /api/auth/login]
    │
    ├─ Success → store JWT + user + screens[] in localStorage
    │
    ▼
[Role-Specific Dashboard]
    │
    └─ Sidebar renders only screens[] user is permitted to see
```

### Expert Screen Flow

```
[Dashboard] → [Objective Screen]
                  │ select objective (Conversions, Reach, Traffic, etc.)
                  ▼
             [Targeting Screen]
                  │ country, language, age, gender, interests
                  ▼
             [Research / Strategy Hub]
                  │ Phase 1: Enter brief → Gemini Level-1 questions
                  │ Phase 2: Answer Level-1 → Gemini Level-2 questions
                  │ Phase 3: Complete strategy profile
                  ▼
             [Creative Config]
                  │ style preset, aspect ratio, generation counts
                  ▼
             [Creative Studio]
                  │ Upload/review assets
                  │ Approve asset → /Assets Library
                  │ Push to CMO Queue
                  ▼
             [Ad Performance] ← monitor own campaigns
```

### CMO Screen Flow

```
[Dashboard] (pending approvals badge)
    │
    ▼
[Ad Approvals]
    │ Review CMO Queue
    │ Approve → assets go to PPP Queue
    │ Reject → asset returned to Expert with notes
    ▼
[Budget Matrix]
    │ Set per-platform budget allocation
    │ Adjust spend sliders
    ▼
[AI Monitoring]
    │ Active ads, killed ads, efficiency
    ▼
[Budget Overview]
    │ Spend vs allocation per platform
    ▼
[Campaign Reports] → [Cross-Platform Analytics]
```

### PPP Screen Flow

```
[Dashboard] (approved assets ready badge)
    │
    ▼
[Approved Assets]
    │ Browse CMO-approved queue
    ▼
[Platform Selection]
    │ Select: Facebook | TikTok | YouTube | Google
    │ Configure platform-specific parameters
    │ Preview JSON payload
    │ Execute deployment
    ▼
[Deployment History]
    │ View past deployments, status, platform IDs
    ▼
[Ad Performance] → [A/B Test Results]
```

### Admin Screen Flow

```
[Dashboard]
    │
    ├─ [User Management] → Invite/Create/Activate/Deactivate users
    ├─ [Role Management] → Create roles, assign screen permissions
    ├─ [Company Profile] → Edit company info
    ├─ [Platform Config] → Store API keys & tokens
    ├─ [Brand Guidelines] → Define brand DNA
    ├─ [Creative Assets] → Browse asset library
    ├─ [Ad Account Management] → Connect platform accounts
    ├─ [Global Calendar] → Operations calendar
    └─ [Billing Settings] → Subscription plan
```

### Super Admin Screen Flow

```
[Global Dashboard] → System-wide: companies count, users, campaigns, total spend
    │
    ├─ [Company Management] → Create/edit/archive companies
    ├─ [System Config] → System-level settings
    └─ [Audit Log] → All activity across all tenants (paginated)
```

---

## 5. System Flow (End-to-End Process)

### Phase 1: Company Onboarding

```
POST /api/onboard/company
    │
    ▼
Create Company Record
    │
    ▼
Seed Default Roles → (Super Admin, Admin, CMO, PPP, Expert)
    │
    ▼
Seed Screens (33 screens across 6 categories)
    │
    ▼
Seed Role-Screen Permissions Matrix
    │
    ▼
Seed Campaign Objectives (13 types)
    │
    ▼
Create Initial Admin User
```

### Phase 2: Campaign Creation (Expert)

```
Expert logs in
    │
    ▼
Select Objective (e.g., "Conversions")
    │
    ▼
Define Targeting (country, age, gender, language, interests)
    │
    ▼
Enter Campaign Brief
    │
    ▼
POST /api/gemini/questions → 5 Level-1 AI strategy questions
    │
    ▼
Expert answers Level-1 questions
    │
    ▼
POST /api/gemini/follow-up → 5 Level-2 psychological questions
    │
    ▼
Expert answers Level-2 → Full strategy profile complete
    │
    ▼
Configure Creative (style preset, aspect ratio, counts)
    │
    ▼
POST /api/campaigns → Campaign created (status: draft)
    │
    ▼
Upload / Review Creative Assets in Studio
    │
    ▼
Approve assets → Copied to /Assets Library
    │
    ▼
POST /api/cmo/queue → Assets pushed to CMO approval queue
    │
    ▼
POST /api/campaigns/{id}/submit → Campaign status: pending_review
                                   → Notification sent to all CMOs
```

### Phase 3: CMO Approval

```
CMO receives notification → Dashboard shows pending count
    │
    ▼
GET /api/cmo/queue → Load CMO approval queue
    │
    ▼
CMO reviews each asset (preview + metadata + brand compliance)
    │
    ├─ Approve →
    │       POST /api/cmo/queue (status: approved)
    │       Asset copied to PPP Queue
    │       POST /api/campaigns/{id}/approve → campaign status: approved
    │       Notification sent to Expert + PPP
    │
    └─ Reject →
            POST /api/cmo/queue (status: rejected, review_notes)
            POST /api/campaigns/{id}/reject (rejection_reason)
            Notification sent to Expert
```

### Phase 4: Ad Deployment (PPP)

```
PPP receives notification → Dashboard shows approved assets count
    │
    ▼
GET /api/ppp/queue → Load PPP deployment queue
    │
    ▼
Select asset(s) for deployment
    │
    ▼
Select platform(s): Facebook | TikTok | YouTube | Google
    │
    ▼
Configure platform-specific parameters:
    ├─ Facebook: campaign name, objective, budget, dates, page_id, pixel_id
    └─ TikTok: advertiser_id, campaign_id, budget, bid, placement, targeting, CTA
    │
    ▼
Preview JSON payload (dry-run available)
    │
    ▼
POST /api/deploy/facebook | /api/deploy/tiktok-adgroup | /api/deploy/unified
    │
    ▼
DeploymentOrchestrator.DeployToAllPlatformsAsync()
    ├─ Upload media to platform (get media hash/ID)
    ├─ Create Campaign resource on platform
    ├─ Create Ad Set / Ad Group
    ├─ Create Ad Creative
    ├─ Create Ad
    └─ Return platform resource IDs
    │
    ▼
deployment_logs record written (full request/response payload)
    │
    ▼
campaign.status → active
ppp_queue.status → deployed
```

### Phase 5: Monitoring & Optimization

```
MetricsFetchService (background, every 4 hours)
    │
    ▼
SELECT active campaigns from DB
    │
    ▼
For each active campaign:
    ├─ GET platform API metrics (Facebook Insights, TikTok Analytics)
    ├─ Aggregate: impressions, clicks, CTR, CPC, CPM, spend, ROAS, etc.
    └─ UPSERT into ad_metrics (daily granularity per campaign/platform)
    │
    ▼
CMO views dashboards:
    ├─ AI Monitoring → active/killed ads, efficiency scores
    ├─ Budget Overview → spend vs allocation per platform
    ├─ Campaign Reports → detailed performance per campaign
    └─ Cross-Platform Analytics → comparative view across platforms
    │
    ▼
CMO reallocates budget → Updates budget_allocations table
    │
    ▼
PPP monitors Ad Performance → Individual ad metrics, trends
```

---

## 6. Data Flow Diagram (DFD)

### Level 0 — Context Diagram

```
                    ┌─────────────────┐
  [Expert]  ───────►│                 │◄──── Campaign Strategy Data
  [CMO]     ───────►│   AI-MARKETING  │────► Approval Decisions
  [PPP]     ───────►│   SYSTEM        │────► Deployment Results
  [Admin]   ───────►│                 │◄──── Ad Performance Metrics
  [SuperAdmin]─────►│                 │────► Notifications
                    └───────┬─────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        [Gemini AI]  [Facebook API]  [TikTok API]
```

### Level 1 — Main Processes

```
┌──────────────────────────────────────────────────────────────────────┐
│                         MAIN DATA FLOWS                              │
│                                                                      │
│  User Input ──► [1. Auth] ──► JWT Token ──► All subsequent requests │
│                                                                      │
│  Brief + Objectives ──► [2. AI Research] ──► Gemini API            │
│                              │                    │                  │
│                              │◄── Questions ──────┘                  │
│                              │                                       │
│                              ▼                                       │
│                     Strategy Profile ──► [3. Campaign DB]           │
│                                                                      │
│  Assets ──► [4. Asset Pipeline] ──► CMO Queue ──► PPP Queue        │
│                                                                      │
│  PPP Config ──► [5. Deployment] ──► Facebook/TikTok APIs           │
│                     │                                                │
│                     ▼                                                │
│             deployment_logs ──► ad_metrics (via background poll)    │
│                                                                      │
│  ad_metrics ──► [6. Analytics] ──► Dashboards / Reports            │
└──────────────────────────────────────────────────────────────────────┘
```

### Level 2 — Detailed Data Flows

#### Authentication Flow
```
[Browser] ──(email, password)──► [Auth Service]
                                      │
                          ┌───────────┴──────────────┐
                          ▼                           ▼
                  [users table]              [BCrypt verify]
                          │                           │
                          └───────────┬──────────────┘
                                      ▼
                              [JWT Generator]
                                      │
                          ┌───────────┴──────────────┐
                          ▼                           ▼
                    [JWT Token]              [Refresh Token]
                          │                 (stored in DB)
                          ▼
                   [Browser localStorage]
```

#### Campaign & Approval Flow
```
[Expert] ──(campaign data)──► [campaigns table]
                                     │
                              (submit action)
                                     │
                                     ▼
                         [notifications table] ──► [CMO inbox]
                                     │
[CMO] ──(review decision)──► [cmo_queue table]
                                     │
                          ┌──────────┴──────────┐
                          ▼                     ▼
                    (approved)             (rejected)
                          │                     │
                          ▼                     ▼
               [ppp_queue table]    [notification to Expert]
                          │
[PPP] ──(deploy config)──► [DeploymentOrchestrator]
                                     │
                         ┌───────────┴──────────────┐
                         ▼                           ▼
               [Facebook Graph API]       [TikTok Business API]
                         │                           │
                         └───────────┬──────────────┘
                                     ▼
                        [deployment_logs table]
                                     │
                              (background poll)
                                     ▼
                          [ad_metrics table]
```

---

## 7. Database Design (Data Structure)

### Overview

- **Database**: PostgreSQL 16
- **ORM**: Entity Framework Core 9
- **Total Tables**: 28
- **Design Patterns**: Multi-tenancy via `company_id`, JSONB for flexible complex types, composite primary keys for join tables, soft-delete via `status` fields

---

### Multi-Tenancy Tables

#### `companies`
| Column | Type | Constraints | Description |
|---|---|---|---|
| id | SERIAL | PK | Company identifier |
| slug | VARCHAR | UNIQUE NOT NULL | URL-safe company identifier |
| name | VARCHAR | NOT NULL | Company name |
| email | VARCHAR | | Company contact email |
| phone | VARCHAR | | Phone number |
| website | VARCHAR | | Company website URL |
| industry | VARCHAR | | Industry type |
| country | VARCHAR | | Country of operation |
| address | TEXT | | Full address |
| logo_url | VARCHAR | | Logo image URL |
| subscription_plan | VARCHAR | DEFAULT 'free' | free / pro / enterprise |
| max_users | INT | DEFAULT 10 | User seat limit |
| max_campaigns | INT | DEFAULT 5 | Campaign limit |
| timezone | VARCHAR | DEFAULT 'UTC' | Company timezone |
| currency | VARCHAR | DEFAULT 'USD' | Billing currency |
| status | VARCHAR | DEFAULT 'active' | active / suspended / archived |
| created_by | INT | FK → users.id | Created by user |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | | Last update timestamp |

#### `company_settings`
| Column | Type | Description |
|---|---|---|
| id | SERIAL PK | Settings identifier |
| company_id | INT FK | Reference to companies |
| default_language | VARCHAR | Default campaign language |
| max_daily_budget | DECIMAL | Maximum allowed daily budget |
| require_cmo_approval | BOOL | Enforce CMO approval step |
| require_brand_check | BOOL | Enforce brand guideline validation |
| default_bid_strategy | VARCHAR | Default bid strategy |
| gemini_api_key | VARCHAR | Gemini API key (encrypted) |
| notification_email | VARCHAR | Alert email address |

#### `company_ad_accounts`
| Column | Type | Description |
|---|---|---|
| id | SERIAL PK | Account identifier |
| company_id | INT FK | Reference to companies |
| platform | VARCHAR | facebook / tiktok / youtube / google |
| account_id | VARCHAR | Platform account ID |
| account_name | VARCHAR | Display name |
| access_token | TEXT | OAuth access token |
| refresh_token | TEXT | OAuth refresh token |
| token_expires_at | TIMESTAMPTZ | Token expiry |
| page_id | VARCHAR | Facebook Page ID |
| pixel_id | VARCHAR | Facebook Pixel ID |
| developer_token | VARCHAR | Google Ads developer token |
| customer_id | VARCHAR | Google Ads customer ID |
| status | VARCHAR | active / inactive / error |
| last_tested_at | TIMESTAMPTZ | Last connection test timestamp |
| last_error | TEXT | Last error message |

**Unique Index**: `(company_id, platform, account_id)`

---

### Auth & RBAC Tables

#### `users`
| Column | Type | Description |
|---|---|---|
| id | SERIAL PK | User identifier |
| username | VARCHAR NOT NULL | Display name |
| email | VARCHAR UNIQUE NOT NULL | Login email |
| password_hash | VARCHAR NOT NULL | BCrypt hash |
| role_id | INT FK → roles.id | Assigned role |
| company_id | INT FK → companies.id | Tenant scope |
| is_super_admin | BOOL DEFAULT false | Super admin flag |
| status | VARCHAR DEFAULT 'active' | active / inactive |
| last_login_at | TIMESTAMPTZ | Last login timestamp |
| created_at | TIMESTAMPTZ | Creation timestamp |

#### `roles`
| Column | Type | Description |
|---|---|---|
| id | SERIAL PK | Role identifier |
| name | VARCHAR NOT NULL | Role name |
| company_id | INT FK nullable | NULL = system role |
| is_system_role | BOOL DEFAULT false | Protected from deletion |
| color | VARCHAR | UI display color |
| icon | VARCHAR | UI icon name |

#### `screens`
| Column | Type | Description |
|---|---|---|
| id | SERIAL PK | Screen identifier |
| name | VARCHAR NOT NULL | Programmatic name (e.g., "Dashboard") |
| display_name | VARCHAR | Human-readable label |
| category | VARCHAR | shared / expert / cmo / ppp / admin / super |
| icon | VARCHAR | UI icon |
| sort_order | INT | Display ordering |
| is_active | BOOL DEFAULT true | Enable/disable screen |

#### `role_screens`
| Column | Type | Description |
|---|---|---|
| role_id | INT FK | Composite PK part 1 |
| screen_id | INT FK | Composite PK part 2 |

#### `user_screens`
| Column | Type | Description |
|---|---|---|
| user_id | INT FK | Composite PK part 1 |
| screen_id | INT FK | Composite PK part 2 |
| company_id | INT FK nullable | Tenant scope |
| granted_by | INT FK nullable | Who granted this override |
| granted_at | TIMESTAMPTZ | When override was granted |

#### `refresh_tokens`
| Column | Type | Description |
|---|---|---|
| id | SERIAL PK | Token identifier |
| user_id | INT FK | Token owner |
| token | VARCHAR UNIQUE | Token value (hashed) |
| expires_at | TIMESTAMPTZ | Expiry |
| revoked_at | TIMESTAMPTZ | Revocation timestamp |
| ip_address | VARCHAR | Client IP |

#### `invitations`
| Column | Type | Description |
|---|---|---|
| id | SERIAL PK | Invitation identifier |
| company_id | INT FK | Target company |
| email | VARCHAR | Invitee email |
| role_id | INT FK | Assigned role on accept |
| token | VARCHAR UNIQUE | Invitation token (7-day expiry) |
| status | VARCHAR | pending / accepted / revoked |
| expires_at | TIMESTAMPTZ | Token expiry |

---

### Campaign Core Tables

#### `campaign_objectives`
| Column | Type | Description |
|---|---|---|
| id | SERIAL PK | Objective identifier |
| category | VARCHAR | Awareness / Consideration / Conversion |
| name | VARCHAR | e.g., "Brand Awareness", "Traffic", "Conversions" |
| platform_mapping | JSONB | Platform-specific objective code mappings |
| supported_platforms | TEXT[] | Supported platforms array |

**13 Objectives**: Brand Awareness, Reach, Traffic, Engagement, App Installs, Video Views, Lead Generation, Messages, Conversions, Catalog Sales, Store Traffic, Product Catalog, Post Engagement

#### `campaigns`
| Column | Type | Description |
|---|---|---|
| id | SERIAL PK | Campaign identifier |
| company_id | INT FK | Tenant scope |
| name | VARCHAR NOT NULL | Campaign name |
| objective_id | INT FK | Campaign objective |
| brief | TEXT | Campaign brief / description |
| status | VARCHAR | draft / pending_review / approved / active / paused / completed / rejected / archived |
| campaign_type | VARCHAR | Paid / Organic / etc. |
| total_budget | DECIMAL | Total campaign budget |
| daily_budget | DECIMAL | Daily spend cap |
| lifetime_budget | DECIMAL | Lifetime spend cap |
| platforms | TEXT[] | Target platforms array |
| targeting | JSONB | Audience targeting config |
| style_preset | VARCHAR | Cinematic / Minimalism / Cyberpunk / Vintage |
| aspect_ratio | VARCHAR | 1:1 / 16:9 / 9:16 |
| bid_strategy | VARCHAR | Lowest Cost / Target Cost / etc. |
| currency | VARCHAR | Campaign currency |
| start_date | DATE | Campaign start |
| end_date | DATE | Campaign end |
| rejection_reason | TEXT | CMO rejection notes |
| created_by | INT FK | Creating user |
| approved_by | INT FK | Approving CMO |
| approved_at | TIMESTAMPTZ | Approval timestamp |
| deployed_by | INT FK | Deploying PPP user |
| deployed_at | TIMESTAMPTZ | Deployment timestamp |
| completed_at | TIMESTAMPTZ | Completion timestamp |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update |

#### `ad_sets`
| Column | Type | Description |
|---|---|---|
| id | SERIAL PK | Ad set identifier |
| campaign_id | INT FK | Parent campaign |
| name | VARCHAR | Ad set name |
| status | VARCHAR | active / paused / completed |
| daily_budget | DECIMAL | Ad set daily budget |
| bid_strategy | VARCHAR | Bid strategy |
| optimization_goal | VARCHAR | e.g., CONVERSIONS, CLICKS |
| targeting | JSONB | Audience targeting (geo, demographic, interests) |
| placements | JSONB | Platform placement options |
| schedule | JSONB | Run schedule config |

#### `ads`
| Column | Type | Description |
|---|---|---|
| id | SERIAL PK | Ad identifier |
| ad_set_id | INT FK | Parent ad set |
| name | VARCHAR | Ad name |
| headline | VARCHAR | Ad headline |
| description | TEXT | Ad body text |
| cta_type | VARCHAR | LEARN_MORE / SHOP_NOW / SIGN_UP / etc. |
| cta_link | VARCHAR | CTA destination URL |
| review_status | VARCHAR | pending / approved / rejected |
| reviewed_by | INT FK | Reviewing user |
| review_notes | TEXT | Review feedback |

#### `ad_creatives`
| Column | Type | Description |
|---|---|---|
| id | SERIAL PK | Creative identifier |
| ad_id | INT FK | Parent ad |
| creative_type | VARCHAR | image / video / carousel |
| asset_url | VARCHAR | URL to creative file |
| thumbnail_url | VARCHAR | Thumbnail for preview |
| headline | VARCHAR | Creative headline |
| description | TEXT | Creative description |
| platform_creative_ids | JSONB | Platform-side resource IDs |

#### `campaign_workflow_steps`
| Column | Type | Description |
|---|---|---|
| id | SERIAL PK | Step identifier |
| campaign_id | INT FK | Parent campaign |
| step_name | VARCHAR | objective / targeting / strategy / adset_config / creative / review / deploy |
| status | VARCHAR | not_started / in_progress / completed |
| data | JSONB | Step-specific data payload |
| completed_by | INT FK | Completing user |
| completed_at | TIMESTAMPTZ | Completion timestamp |

---

### Approval & Deployment Tables

#### `cmo_queue`
| Column | Type | Description |
|---|---|---|
| id | SERIAL PK | Queue entry identifier |
| campaign_id | INT FK | Associated campaign |
| ad_id | INT FK | Associated ad |
| url | VARCHAR | Asset URL |
| title | VARCHAR | Asset title |
| type | VARCHAR | image / video |
| status | VARCHAR | pending / approved / rejected |
| priority | INT | Priority ordering |
| submitted_by | INT FK | Submitting Expert |
| reviewed_by | INT FK | Reviewing CMO |
| review_notes | TEXT | CMO feedback |

#### `ppp_queue`
| Column | Type | Description |
|---|---|---|
| id | SERIAL PK | Queue entry identifier |
| campaign_id | INT FK | Associated campaign |
| ad_id | INT FK | Associated ad |
| asset_filename | VARCHAR | File reference |
| asset_url | VARCHAR | Asset URL |
| asset_type | VARCHAR | image / video |
| status | VARCHAR | pending / approved / deployed |
| queue_index | INT | Display/deployment ordering |
| approved_by | INT FK | Approving CMO |
| deployed_by | INT FK | Deploying PPP user |
| deploy_platforms | TEXT[] | Target platforms |

#### `deployment_logs`
| Column | Type | Description |
|---|---|---|
| id | SERIAL PK | Log entry identifier |
| campaign_id | INT FK | Associated campaign |
| ad_set_id | INT FK | Associated ad set |
| ad_id | INT FK | Associated ad |
| platform | VARCHAR | facebook / tiktok / youtube / google |
| action | VARCHAR | create_campaign / create_adset / create_creative / create_ad |
| platform_resource_id | VARCHAR | Platform-returned resource ID |
| status | VARCHAR | pending / success / failed |
| request_payload | JSONB | Full request payload sent to platform |
| response_payload | JSONB | Full platform response |
| error_message | TEXT | Error details on failure |
| duration_ms | INT | Execution time in milliseconds |
| executed_by | INT FK | PPP user who executed |
| executed_at | TIMESTAMPTZ | Execution timestamp |

---

### Analytics & Optimization Tables

#### `ad_metrics`
| Column | Type | Description |
|---|---|---|
| id | SERIAL PK | Metric record identifier |
| campaign_id | INT FK | Associated campaign |
| ad_set_id | INT FK nullable | Ad set scope |
| ad_id | INT FK nullable | Ad scope |
| company_id | INT | Tenant scope |
| platform | VARCHAR | Source platform |
| date | DATE | Metric date (daily granularity) |
| impressions | BIGINT | Total impressions |
| reach | BIGINT | Unique reach |
| clicks | BIGINT | Total clicks |
| ctr | DECIMAL | Click-through rate |
| cpc | DECIMAL | Cost per click |
| cpm | DECIMAL | Cost per thousand impressions |
| spend | DECIMAL | Amount spent |
| conversions | INT | Conversion count |
| conversion_value | DECIMAL | Total conversion value |
| roas | DECIMAL | Return on ad spend |
| frequency | DECIMAL | Average frequency |
| video_views | BIGINT | Video view count |
| video_completions | BIGINT | Video completion count |
| leads | INT | Lead count |
| app_installs | INT | App install count |
| fetched_at | TIMESTAMPTZ | When metrics were fetched |

#### `ab_tests`
| Column | Type | Description |
|---|---|---|
| id | SERIAL PK | Test identifier |
| campaign_id | INT FK | Associated campaign |
| name | VARCHAR | Test name |
| variant_a_ad_id | INT FK | Ad A |
| variant_b_ad_id | INT FK | Ad B |
| metric | VARCHAR | ctr / roas / conversions |
| traffic_split | DECIMAL | e.g., 50.0 (50/50) |
| status | VARCHAR | draft / active / completed |
| winner | VARCHAR | A / B / null |
| confidence_level | DECIMAL | Statistical confidence % |
| variant_a_result | DECIMAL | Metric value for A |
| variant_b_result | DECIMAL | Metric value for B |

#### `budget_allocations`
| Column | Type | Description |
|---|---|---|
| id | SERIAL PK | Allocation identifier |
| company_id | INT FK | Tenant scope |
| period_type | VARCHAR | monthly / quarterly |
| total_budget | DECIMAL | Total allocated budget |
| facebook_allocation | DECIMAL | Facebook budget allocation |
| tiktok_allocation | DECIMAL | TikTok budget allocation |
| youtube_allocation | DECIMAL | YouTube budget allocation |
| google_allocation | DECIMAL | Google budget allocation |
| spent_to_date | DECIMAL | Total spent so far |
| status | VARCHAR | active / paused / completed |

---

### Features & Configuration Tables

#### `brand_guidelines`
| Column | Type | Description |
|---|---|---|
| id | SERIAL PK | Guideline identifier |
| company_id | INT FK | Tenant scope |
| brand_label | VARCHAR | Brand name/label |
| tone | VARCHAR | Communication tone |
| language | VARCHAR | Brand language |
| description | TEXT | Brand description |
| tagline | VARCHAR | Brand tagline |
| logo_url | VARCHAR | Logo URL |
| whitelist | TEXT[] | Approved terms |
| blacklist | TEXT[] | Prohibited terms |
| typography | JSONB | Font specs (headings, body) |
| palette | TEXT[] | HEX color palette |
| voiceExamples | TEXT[] | Brand voice example texts |
| doList | TEXT[] | Brand DOs |
| dontList | TEXT[] | Brand DON'Ts |

#### `campaign_templates`
| Column | Type | Description |
|---|---|---|
| id | SERIAL PK | Template identifier |
| company_id | INT FK nullable | NULL = global template |
| name | VARCHAR | Template name |
| objective_id | INT FK | Campaign objective |
| targeting | JSONB | Default targeting |
| budget_config | JSONB | Default budget settings |
| creative_specs | JSONB | Creative specifications |
| is_global | BOOL | Available to all companies |
| use_count | INT | Usage tracking |

#### `audience_templates`
| Column | Type | Description |
|---|---|---|
| id | SERIAL PK | Template identifier |
| company_id | INT FK | Tenant scope |
| name | VARCHAR | Audience name |
| targeting | JSONB | Full targeting config |
| estimated_size | BIGINT | Estimated audience size |
| use_count | INT | Usage tracking |

#### `asset_library_items`
| Column | Type | Description |
|---|---|---|
| id | SERIAL PK | Asset identifier |
| company_id | INT FK | Tenant scope |
| filename | VARCHAR | Stored filename |
| original_name | VARCHAR | Original upload filename |
| file_path | VARCHAR | Server file path |
| file_url | VARCHAR | Public URL |
| file_type | VARCHAR | image / video |
| mime_type | VARCHAR | MIME type |
| file_size_bytes | BIGINT | File size |
| width | INT | Image/video width (px) |
| height | INT | Image/video height (px) |
| duration_seconds | DECIMAL | Video duration |
| folder | VARCHAR | assets / library |
| tags | TEXT[] | Metadata tags |
| status | VARCHAR | active / archived |
| uploaded_by | INT FK | Uploading user |

---

### User Experience Tables

#### `notifications`
| Column | Type | Description |
|---|---|---|
| id | SERIAL PK | Notification identifier |
| user_id | INT FK | Recipient |
| type | VARCHAR | campaign_submitted / campaign_approved / campaign_rejected / etc. |
| title | VARCHAR | Notification title |
| message | TEXT | Notification body |
| resource_type | VARCHAR | campaign / asset / etc. |
| resource_id | INT | Resource identifier |
| action_url | VARCHAR | Deep-link URL |
| is_read | BOOL DEFAULT false | Read state |
| read_at | TIMESTAMPTZ | Read timestamp |
| created_at | TIMESTAMPTZ | Creation timestamp |

#### `approval_comments`
| Column | Type | Description |
|---|---|---|
| id | SERIAL PK | Comment identifier |
| campaign_id | INT FK | Campaign scope |
| ad_id | INT FK nullable | Ad scope |
| user_id | INT FK | Comment author |
| comment | TEXT | Comment body |
| action | VARCHAR | comment / approve / reject |
| attachment_url | VARCHAR | Optional attachment |
| created_at | TIMESTAMPTZ | Creation timestamp |

#### `activity_logs`
| Column | Type | Description |
|---|---|---|
| id | SERIAL PK | Log identifier |
| company_id | INT FK | Tenant scope |
| user_id | INT FK | Acting user |
| action | VARCHAR | CREATE / UPDATE / DELETE / APPROVE / REJECT / DEPLOY |
| resource_type | VARCHAR | campaign / user / role / asset / etc. |
| resource_id | INT | Resource identifier |
| description | TEXT | Human-readable action description |
| details | JSONB | Detailed change data |
| ip_address | VARCHAR | Client IP address |
| user_agent | TEXT | Client user agent string |
| created_at | TIMESTAMPTZ | Log timestamp |

---

### Key Relationships Summary

```
companies (1) ──── (N) users
companies (1) ──── (N) campaigns
companies (1) ──── (1) company_settings
companies (1) ──── (N) company_ad_accounts
companies (1) ──── (N) roles (custom roles)
companies (1) ──── (1) brand_guidelines
companies (1) ──── (N) budget_allocations

roles (1) ──── (N) role_screens ──── (N) screens
users (1) ──── (N) user_screens ──── (N) screens

campaigns (1) ──── (N) ad_sets ──── (N) ads ──── (N) ad_creatives
campaigns (1) ──── (N) campaign_workflow_steps
campaigns (1) ──── (N) cmo_queue
campaigns (1) ──── (N) ppp_queue
campaigns (1) ──── (N) deployment_logs
campaigns (1) ──── (N) ad_metrics
campaigns (1) ──── (N) ab_tests
campaigns (1) ──── (N) approval_comments
```

---

## 8. Technical Architecture (Deep Level)

### Technology Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| **Frontend** | Vanilla JavaScript | ES6+ | SPA with custom state management |
| | Vite | 7.2.4 | Build tool & dev server |
| | Tailwind CSS | 4.1.18 | Utility-first CSS framework |
| | Autoprefixer | 10.4.24 | CSS vendor prefix generation |
| **Backend** | ASP.NET Core | 9.0 | REST API framework (Minimal APIs) |
| | C# | .NET 9 | Backend language |
| **Database** | PostgreSQL | 16-alpine | Relational database with JSONB |
| | Entity Framework Core | 9.0.4 | ORM + schema management |
| **Authentication** | JWT Bearer | HS256 | Stateless token auth |
| | BCrypt.NET-Next | 4.0.3 | Password hashing |
| **AI** | Google Gemini | 2.0 Flash | Campaign strategy generation |
| **Platforms** | Facebook Graph API | v19.0 | Ad deployment |
| | TikTok Business API | v1.3 | Ad deployment |
| | YouTube Data API | v3 | Video ads (in progress) |
| | Google Ads API | v16 | Search/display ads (in progress) |
| **Infrastructure** | Docker | Desktop | Containerization |
| | Docker Compose | 3.8 | Multi-container orchestration |
| | Nginx | alpine | Reverse proxy + static serving |

### Backend Architecture

```
backend/
├── Program.cs                     — All endpoints (984 lines, Minimal APIs)
├── Models.cs                      — 28 DB models + request/response records (1,925 lines)
├── AppDbContext.cs                — EF Core configuration + schema (420 lines)
├── backend.csproj                 — Dependencies
├── appsettings.json               — Configuration (JWT, DB connection string)
├── Services/
│   ├── DeploymentOrchestrator.cs  — Multi-platform deployment coordination
│   ├── FacebookAdsService.cs      — Facebook Graph API v19.0 integration
│   ├── TikTokAdsService.cs        — TikTok Business API v1.3 integration
│   ├── GoogleAdsService.cs        — Google Ads API integration
│   ├── YouTubeAdsService.cs       — YouTube API integration
│   ├── BrandComplianceService.cs  — Brand guideline validation
│   └── MetricsFetchService.cs     — Background metrics polling (IHostedService)
├── Middleware/
│   └── TenantMiddleware.cs        — Multi-tenancy enforcement
├── Assets/                        — Working asset storage
└── Assets Library/                — Approved asset storage
```

### Minimal APIs Pattern

All routes are defined inline in `Program.cs` using .NET 9 Minimal APIs:

```csharp
// Example route pattern
app.MapPost("/api/campaigns", async (CreateCampaignRequest req, AppDbContext db, HttpContext ctx) => {
    var companyId = ctx.Items["CompanyId"];
    // ... business logic
    return Results.Created($"/api/campaigns/{campaign.Id}", campaign);
}).RequireAuthorization();
```

### Middleware Pipeline

```
Request
  │
  ▼
[CORS Middleware]          — AllowAll in dev; restricted in prod
  │
  ▼
[Authentication Middleware] — JWT Bearer token validation
  │
  ▼
[TenantMiddleware]          — Extracts company_id from JWT, sets ctx.Items["CompanyId"]
  │                           Super Admin: reads X-Company-Id header
  ▼
[Authorization Middleware]  — RequireAuthorization() check
  │
  ▼
[Endpoint Handler]          — Business logic + DB operations
  │
  ▼
[Global Exception Handler]  — JSON error response, no stack trace exposed
  │
  ▼
Response
```

### Frontend Architecture

```
frontend/src/
├── main.js          — Single-file SPA: 3,277 lines
│                      - State management (client-side state object)
│                      - localStorage persistence for JWT + user data
│                      - 33 screen render functions
│                      - API call layer (fetch wrappers)
│                      - Sidebar generation from screens[] array
│
├── facebookDeploy.js — Facebook deployment UI module
├── tiktokDeploy.js   — TikTok deployment UI module
├── style.css         — Tailwind + custom CSS
└── index.html        — SPA root (single div#app entry point)
```

**State Management Pattern**:
```javascript
const state = {
  token: localStorage.getItem('token'),
  user: JSON.parse(localStorage.getItem('user')),
  screens: JSON.parse(localStorage.getItem('screens')),
  currentScreen: 'Dashboard',
  // ...
};
```

**Screen Rendering Pattern**:
```javascript
function renderScreen(screenName) {
  const screens = {
    'Dashboard': renderDashboard,
    'Campaigns': renderCampaigns,
    // ...33 screens
  };
  screens[screenName]?.();
}
```

### Service Layer

#### DeploymentOrchestrator
Central service that coordinates cross-platform deployments:
```
DeployToAllPlatformsAsync(campaignId, platforms[], config)
  ├── foreach platform:
  │   ├── Validate ad account credentials
  │   ├── Upload media file → get media hash/ID
  │   ├── CreateCampaign() → platform_campaign_id
  │   ├── CreateAdSet() → platform_adset_id
  │   ├── CreateCreative() → platform_creative_id
  │   ├── CreateAd() → platform_ad_id
  │   └── Write deployment_log record
  └── Return aggregated results
```

#### MetricsFetchService (Background Service)
```
OnApplicationStarted:
  └── Execute immediately
  └── Loop with 4-hour interval:
      ├── SELECT active campaigns
      ├── foreach campaign:
      │   ├── GET ad account credentials
      │   ├── Call platform metrics API
      │   └── UPSERT into ad_metrics (date-keyed)
      └── Log completion
```

### Database Configuration

Entity Framework Core manages schema with `EnsureCreated()` + raw SQL for custom DDL:

```csharp
// EF Core models for standard tables
// Raw SQL for cross-table joins and custom indexes
await db.Database.ExecuteSqlRawAsync(@"
    CREATE TABLE IF NOT EXISTS user_screens (
        user_id INTEGER NOT NULL,
        screen_id INTEGER NOT NULL,
        ...
        PRIMARY KEY (user_id, screen_id)
    );
    CREATE INDEX IF NOT EXISTS idx_userscreens_company ON user_screens(company_id);
");
```

### API Response Patterns

All endpoints return consistent JSON structures:

```json
// Success (single resource)
{ "id": 1, "name": "...", "status": "active", ... }

// Success (list)
[{ "id": 1, ... }, { "id": 2, ... }]

// Error
{ "error": "Description of what went wrong" }

// Created
HTTP 201 + Location header + resource body
```

### NuGet Dependencies

```xml
<PackageReference Include="BCrypt.Net-Next" Version="4.0.3" />
<PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="9.0.4" />
<PackageReference Include="Microsoft.EntityFrameworkCore.Design" Version="9.0.4" />
<PackageReference Include="Npgsql.EntityFrameworkCore.PostgreSQL" Version="9.0.4" />
<PackageReference Include="System.IdentityModel.Tokens.Jwt" Version="8.9.0" />
```

---

## 9. Security Plan

### Authentication Security

| Measure | Implementation | Details |
|---|---|---|
| **JWT Tokens** | HS256 signing | 8-hour access token expiry |
| **Refresh Tokens** | 7-day rotation | Stored hashed in `refresh_tokens` table with revocation tracking |
| **Password Hashing** | BCrypt | Adaptive work factor, per-user salt |
| **Token Validation** | Middleware | Issuer, Audience, Lifetime, and Key Signature verified on every request |

### Authorization Security

| Measure | Implementation |
|---|---|
| **Role-Based Access** | 5 system roles + custom roles via `role_screens` join table |
| **Screen-Level Permissions** | 33 screens, access controlled per role and per user |
| **User-Level Overrides** | `user_screens` overrides role defaults — takes full priority |
| **Super Admin Isolation** | `is_super_admin` flag; Super Admin screens hardware-filtered in screen list |
| **System Role Protection** | `is_system_role = true` prevents deletion of core roles |
| **Multi-Tenant Scoping** | `TenantMiddleware` enforces `company_id` on all queries; no cross-tenant data leakage |

### API Security

| Measure | Implementation |
|---|---|
| **CORS** | `AllowAll` in development; restrict to frontend domain in production |
| **HTTPS** | Configured via Kestrel (SSL termination via Nginx in Docker) |
| **Custom Headers** | `X-Company-Id` only respected for authenticated Super Admin users |
| **Input Validation** | Request DTOs with type checking; EF parameterized queries prevent SQL injection |
| **Error Handling** | Global exception handler returns JSON `{ "error": "..." }` — no stack traces exposed |
| **Payload Validation** | JSONB fields validated before DB insertion |

### Data Security

| Measure | Implementation |
|---|---|
| **SQL Injection Prevention** | Entity Framework Core parameterized queries throughout |
| **Sensitive Config** | API keys stored in environment variables, not source code |
| **Token Storage** | Refresh tokens stored (hashed) in DB; access tokens stateless |
| **Soft Deletes** | Users deactivated (`status = inactive`) before optional hard delete |
| **Audit Trail** | Every user action logged to `activity_logs` with IP + user agent |
| **Deployment Audit** | Full request/response payloads stored in `deployment_logs` |

### Infrastructure Security

| Measure | Implementation |
|---|---|
| **Container Isolation** | Docker network isolates DB from public internet; only ports 80/5243/5432 exposed |
| **DB Port** | Port 5432 exposed only within Docker network in production |
| **Nginx Proxy** | Backend not directly exposed; all traffic proxied via Nginx |
| **IP Logging** | Client IP stored with refresh tokens and activity logs for forensic use |
| **Session Tracking** | `last_login_at` tracked per user |

### Security Considerations for Production

The following should be hardened before production deployment:

1. **CORS**: Restrict `AllowAll` to specific frontend domain
2. **HTTPS**: Enable TLS certificates (Let's Encrypt via Nginx)
3. **JWT Key**: Use cryptographically random 256-bit key (not hardcoded)
4. **DB Password**: Use secrets manager (AWS Secrets Manager / Azure Key Vault)
5. **API Keys**: Store platform API keys encrypted at rest
6. **Rate Limiting**: Add request throttling middleware (protect auth endpoints)
7. **Two-Factor Auth**: Implement TOTP for admin accounts
8. **CSP Headers**: Add Content-Security-Policy headers via Nginx
9. **Dependency Scanning**: Regular `dotnet audit` + `npm audit`

---

## 10. Deployment & DevOps

### Docker Architecture

```
docker-compose.yml
├── db          — PostgreSQL 16-alpine  (port 5432, internal)
├── backend     — ASP.NET Core 9        (port 5243)
└── frontend    — Nginx + Vite Build    (port 80)
```

### Service Definitions

#### Database Service
```yaml
db:
  image: postgres:16-alpine
  environment:
    POSTGRES_DB: MarketingAI
    POSTGRES_USER: Monirul007
    POSTGRES_PASSWORD: ${DB_PASSWORD}
  ports:
    - "5432:5432"
  volumes:
    - pgdata:/var/lib/postgresql/data
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U Monirul007 -d MarketingAI"]
    interval: 5s
    timeout: 5s
    retries: 5
```

#### Backend Service
```yaml
backend:
  build:
    context: .
    dockerfile: Dockerfile
  ports:
    - "5243:5243"
  environment:
    ConnectionStrings__DefaultConnection: "Host=db;Database=MarketingAI;..."
    Jwt__Key: "${JWT_KEY}"
    Jwt__Issuer: "MarketingAIBackend"
    Jwt__Audience: "MarketingAIFrontend"
    Gemini__ApiKey: "${GEMINI_API_KEY}"
  depends_on:
    db:
      condition: service_healthy
  volumes:
    - assets:/app/Assets
    - library:/app/Assets Library
```

#### Frontend Service
```yaml
frontend:
  build:
    context: .
    dockerfile: Dockerfile.frontend
  ports:
    - "80:80"
  depends_on:
    - backend
```

### Backend Dockerfile (Multi-Stage)

```dockerfile
# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY backend/backend.csproj ./backend/
RUN dotnet restore ./backend/backend.csproj
COPY backend/ ./backend/
RUN dotnet publish ./backend/backend.csproj -c Release -o /app/publish

# Stage 2: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app
RUN mkdir -p "Assets" "Assets Library"
COPY --from=build /app/publish .
EXPOSE 5243
ENV ASPNETCORE_URLS=http://+:5243
ENTRYPOINT ["dotnet", "backend.dll"]
```

### Frontend Dockerfile (Multi-Stage)

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Nginx Configuration

```nginx
server {
    listen 80;

    # SPA routing — all paths fall back to index.html
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }

    # API proxy → backend
    location /api/ {
        proxy_pass http://backend:5243;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Asset proxy → backend static files
    location /assets/ {
        proxy_pass http://backend:5243;
    }

    location /library/ {
        proxy_pass http://backend:5243;
    }
}
```

### Port Mapping

| Service | Internal Port | External Port | Access |
|---|---|---|---|
| Frontend (Nginx) | 80 | 80 | Public |
| Backend (Kestrel) | 5243 | 5243 | Public (dev) / Internal (prod) |
| PostgreSQL | 5432 | 5432 | Internal only (prod) |

### Volume Persistence

| Volume Name | Mount Path | Purpose |
|---|---|---|
| `pgdata` | `/var/lib/postgresql/data` | Database persistence across restarts |
| `assets` | `/app/Assets` | Working creative assets |
| `library` | `/app/Assets Library` | CMO-approved assets |

### Startup Sequence

```
1. Docker Compose starts PostgreSQL
        │
        ▼
2. PostgreSQL health check passes (pg_isready)
        │
        ▼
3. Backend starts
   ├── EF Core EnsureCreated() — creates schema
   ├── Raw SQL — creates custom tables + indexes
   ├── Seed data — screens, roles, objectives
   └── MetricsFetchService starts (background polling)
        │
        ▼
4. Frontend Nginx starts (depends_on backend)
        │
        ▼
5. Nginx serves SPA at port 80
   └── /api/* proxied to backend:5243
```

### Environment Variables

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Google Gemini 2.0 Flash API key |
| `JWT_KEY` | JWT signing secret (min 256-bit) |
| `DB_PASSWORD` | PostgreSQL password |
| `ConnectionStrings__DefaultConnection` | Full PostgreSQL connection string |
| `Jwt__Issuer` | JWT issuer claim value |
| `Jwt__Audience` | JWT audience claim value |
| `ASPNETCORE_URLS` | Kestrel listening URL |
| `ASPNETCORE_ENVIRONMENT` | Development / Production |

### Local Development Setup

```bash
# Backend (port 5243)
cd backend
dotnet run

# Frontend (port 5173 via Vite)
cd frontend
npm run dev
```

### Production Deployment

```bash
# Set environment variables
export GEMINI_API_KEY=your_key
export JWT_KEY=your_256bit_secret
export DB_PASSWORD=your_secure_password

# Build and start all services
docker-compose up --build -d

# Check service health
docker-compose ps
docker-compose logs backend --tail=50

# Seed initial data (first run only)
curl -X POST http://localhost:5243/api/rbac/seed
curl -X POST http://localhost:5243/api/onboard/company \
  -H "Content-Type: application/json" \
  -d '{"name":"My Company","email":"admin@example.com",...}'
```

### CI/CD Considerations

Recommended pipeline (GitHub Actions):

```
Push to main
    │
    ▼
[Test] dotnet test + npm test
    │
    ▼
[Build] docker build backend + frontend
    │
    ▼
[Push] Push images to registry (ECR / Docker Hub)
    │
    ▼
[Deploy] docker-compose pull + up on target server
```

### Scaling Considerations

| Concern | Current | Recommended for Scale |
|---|---|---|
| Backend | Single instance | Horizontal scaling behind load balancer |
| Database | Single PostgreSQL | Read replicas + connection pooling (PgBouncer) |
| Assets | Local filesystem | Object storage (S3 / Azure Blob) |
| Metrics Fetch | In-process background service | Separate worker service / message queue |
| Sessions | JWT stateless | No change needed |
| Cache | In-memory ConcurrentDictionary | Redis for distributed caching |

---

*Design document generated from live codebase analysis — AI-Marketing New, April 2026.*
