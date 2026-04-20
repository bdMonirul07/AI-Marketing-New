# Database & Screens — Completed Implementation
> AI-Marketing-New Platform
> Source: Verified from `backend/Models.cs`, `backend/AppDbContext.cs`, `backend/Program.cs`, `frontend/src/main.js`

---

## Table of Contents

1. [Screens Completed (Frontend)](#1-screens-completed-frontend)
2. [Database Tables — Complete Reference](#2-database-tables--complete-reference)
3. [API Endpoints — Complete Reference](#3-api-endpoints--complete-reference)
4. [Database Indexes & Constraints](#4-database-indexes--constraints)
5. [Summary Counts](#5-summary-counts)

---

## 1. Screens Completed (Frontend)

All screens are implemented as render functions inside `frontend/src/main.js`.
The router dispatches via `renderScreen(screenId)`.

### 1.1 Screen Inventory (36 Screens)

| # | Screen ID | Render Function | Role | Status |
|---|-----------|----------------|------|--------|
| 1 | `Login` | `renderLoginScreen()` | All | ✅ Done |
| 2 | `Dashboard` | `renderDashboardScreen()` | All | ✅ Done |
| 3 | `CampaignBuilder` | `renderCampaignBuilderWizard(step, campaignId)` | Expert | ✅ Done |
| 4 | `Objective` | `renderObjectiveScreen()` | Expert | ✅ Done |
| 5 | `Targeting` | `renderTargetingScreen()` | Expert | ✅ Done |
| 6 | `Research` | `renderStrategyHub()` | Expert | ✅ Done |
| 7 | `CreativeConfig` | `renderCreativeConfigScreen()` | Expert | ✅ Done |
| 8 | `Studio` | `renderStudioScreen()` | Expert | ✅ Done |
| 9 | `Monitoring` | `renderMonitoringScreen()` | CMO / PPP | ✅ Done |
| 10 | `Budget` | `renderBudgetScreen()` | CMO | ✅ Done |
| 11 | `ApprovedAssets` | `renderApprovedAssetsScreen()` | PPP | ✅ Done |
| 12 | `Config` | `renderConfigScreen()` | Admin | ✅ Done |
| 13 | `RoleManagement` | `renderRoleManagementScreen()` | Admin | ✅ Done |
| 14 | `UserManagement` | `renderUserManagementScreen()` | Admin | ✅ Done |
| 15 | `CompanyProfile` | `renderCompanyProfileScreen()` | Admin | ✅ Done |
| 16 | `Calendar` | `renderCalendarScreen()` | Admin | ✅ Done |
| 17 | `Guideline` | `renderGuidelineScreen()` | Admin | ✅ Done |
| 18 | `Assets` | `renderAssetsScreen()` | Expert / Admin | ✅ Done |
| 19 | `BudgetMatrix` | `renderBudgetMatrixScreen()` | CMO | ✅ Done |
| 20 | `Approvals` | `renderRedesignedApprovalsScreen()` | CMO | ✅ Done |
| 21 | `Notifications` | `renderNotificationsScreen()` | All | ✅ Done |
| 22 | `DeploySelection` | `renderEnhancedDeploySelectionScreen()` | PPP | ✅ Done |
| 23 | `AdPerformance` | `renderRealAdPerformanceScreen()` | CMO / PPP | ✅ Done |
| 24 | `GlobalDashboard` | `renderGlobalDashboard()` | Super Admin | ✅ Done |
| 25 | `CompanyManagement` | `renderCompanyManagementScreen()` | Super Admin | ✅ Done |
| 26 | `AuditLog` | `renderAuditLogScreen()` | Super Admin | ✅ Done |
| 27 | `SystemConfig` | `renderSystemConfigScreen()` | Super Admin | ✅ Done |
| 28 | `AdAccountManagement` | `renderAdAccountManagementScreen()` | Admin | ✅ Done |
| 29 | `BillingSettings` | `renderBillingSettingsScreen()` | Admin | ✅ Done |
| 30 | `CampaignReports` | `renderCampaignReportsScreen()` | CMO | ✅ Done |
| 31 | `CrossPlatformAnalytics` | `renderCrossPlatformAnalyticsScreen()` | CMO | ✅ Done |
| 32 | `DeploymentHistory` | `renderDeploymentHistoryScreen()` | PPP | ✅ Done |
| 33 | `ABTestResults` | `renderABTestResultsScreen()` | PPP / CMO | ✅ Done |
| 34 | `AudienceInsights` | `renderAudienceInsightsScreen()` | Expert | ✅ Done |
| 35 | `CompetitorResearch` | `renderCompetitorResearchScreen()` | Expert | ✅ Done |
| 36 | *(onboarding)* | `renderOnboardingWizard()` | Admin | ✅ Done |

---

### 1.2 Screen Details by Role

#### Super Admin Screens (4)

| Screen | Description | Backend API Used |
|--------|-------------|-----------------|
| **GlobalDashboard** | Platform-wide stats: total companies, users, campaigns, revenue | `GET /api/super-admin/dashboard` |
| **CompanyManagement** | List, create, edit, suspend companies; view per-company users & campaigns | `GET/POST/PUT/DELETE /api/super-admin/companies` |
| **AuditLog** | Full activity log across all tenants, filterable by company | `GET /api/super-admin/audit-log` |
| **SystemConfig** | System-level configuration (platform settings) | Local state |

---

#### Admin Screens (7)

| Screen | Description | Backend API Used |
|--------|-------------|-----------------|
| **Config** (Platform Config) | Manage Facebook/TikTok API keys, Gemini API key | `GET/PUT /api/company-settings` |
| **AdAccountManagement** | Add/edit/delete ad platform accounts (tokens, account IDs, page IDs) | `GET/POST/PUT/DELETE /api/ad-accounts` |
| **UserManagement** | View users, revoke/activate/permanently delete; manage invitations | `GET /api/rbac/users`, `DELETE/PATCH /api/rbac/users/{id}`, `POST /api/invitations` |
| **RoleManagement** | Create/edit/delete roles; assign screen permissions per role; user-level overrides | `GET/POST/PUT/DELETE /api/rbac/roles`, `GET/POST /api/rbac/role-permissions`, `GET/POST /api/rbac/user-permissions` |
| **CompanyProfile** | Edit company name, logo, industry, website, contact details | Local/settings |
| **Calendar** | Global operations calendar with campaign events | Local state |
| **Guideline** (Brand DNA) | Configure brand tone, language, palette, typography, whitelist/blacklist | `GET/POST /api/guidelines` |
| **BillingSettings** | Subscription plan and billing configuration | Local state |

---

#### Marketing Expert Screens (8)

| Screen | Description | Backend API Used |
|--------|-------------|-----------------|
| **Objective** | Select campaign objective (Awareness / Traffic / Engagement / Conversions) | `GET /api/campaign-objectives` |
| **Targeting** | Define target audience: country, language, age range, gender; multiple target sets | Local state → campaign |
| **Research** (Strategy Hub) | 3-phase AI strategy: brief → L1 questions → L2 questions via Gemini | `POST /api/gemini/questions`, `POST /api/gemini/follow-up` |
| **CreativeConfig** (Creative Hub) | Define platform, aspect ratio, image/video counts, video duration | `POST /api/campaigns` |
| **Studio** (Creative Studio) | Review generated assets, edit copy, approve/discard, submit to PPP queue | `GET /api/assets`, `POST /api/assets/approve`, `POST /api/cmo/queue` |
| **Assets** | Browse all working assets in `/Assets` folder | `GET /api/assets` |
| **AudienceInsights** | Audience analysis and insights dashboard | `GET /api/analytics/overview` |
| **CompetitorResearch** | Competitor research tools | Local state |
| **CampaignBuilder** | Multi-step campaign creation wizard | `POST /api/campaigns`, workflow APIs |

---

#### CMO (Business Admin) Screens (6)

| Screen | Description | Backend API Used |
|--------|-------------|-----------------|
| **BudgetMatrix** (Budget & Matrix) | Set total budget, platform allocations, weight sliders; define allowed platforms | `GET/POST /api/budgets` |
| **Approvals** (CMO Queue) | Review PPP-approved assets; final approve/reject each ad with notes | `GET/POST /api/cmo/queue` |
| **Monitoring** (AI Monitoring) | Active ads, total spend, efficiency metrics, auto-action recommendations | `GET /api/analytics/overview` |
| **AdPerformance** | Real performance metrics: impressions, CTR, CPC, ROAS, conversions | `GET /api/analytics/campaigns/{id}/metrics` |
| **CampaignReports** | Campaign-level reporting with platform breakdown | `GET /api/analytics/overview`, `GET /api/analytics/top-performers` |
| **CrossPlatformAnalytics** | Cross-platform comparison analytics | `GET /api/analytics/platforms` |
| **Budget** | Budget overview and spend tracking | `GET /api/budgets/current` |
| **ABTestResults** | View A/B test results with statistical significance | `GET /api/ab-tests/{id}/results` |

---

#### PPP Specialist Screens (5)

| Screen | Description | Backend API Used |
|--------|-------------|-----------------|
| **ApprovedAssets** (PPP Queue) | Review submitted assets; enter per-ad budget; approve/reject | `GET/POST /api/ppp/queue` |
| **DeploySelection** | Select CMO-approved ads, choose platform, configure deployment | `GET /api/ppp/queue` |
| **Deploy** (via DeploySelection) | Execute Facebook / TikTok deployment with full API orchestration | `POST /api/deploy/facebook`, `POST /api/deploy/tiktok-adgroup`, `POST /api/deploy/unified` |
| **AdPerformance** | Ad performance monitoring post-deployment | `GET /api/analytics/campaigns/{id}/metrics` |
| **DeploymentHistory** | Full history of all deployment actions and logs | `GET /api/deployment-logs` |
| **Monitoring** | AI monitoring dashboard (shared with CMO) | `GET /api/analytics/overview` |

---

## 2. Database Tables — Complete Reference

**Total Tables Implemented: 29**
(28 planned + `user_screens` for user-level permission overrides)

---

### DOMAIN 1 — Multi-Tenancy (3 Tables)

---

#### Table 1: `companies`
**C# Model:** `Company` | **Purpose:** Core multi-tenancy — every company's data is isolated

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INT | PK, auto-increment | |
| `name` | VARCHAR(200) | NOT NULL | |
| `slug` | VARCHAR(100) | NOT NULL, UNIQUE | URL-friendly identifier |
| `industry` | VARCHAR(100) | NULLABLE | |
| `website` | VARCHAR(500) | NULLABLE | |
| `logo_url` | VARCHAR(500) | NULLABLE | |
| `email` | VARCHAR(200) | NULLABLE | |
| `phone` | VARCHAR(50) | NULLABLE | |
| `address` | TEXT | NULLABLE | |
| `country` | VARCHAR(100) | NULLABLE | |
| `timezone` | VARCHAR(50) | DEFAULT 'UTC' | |
| `currency` | VARCHAR(10) | DEFAULT 'USD' | |
| `status` | VARCHAR(20) | DEFAULT 'active' | active / suspended / archived |
| `subscription_plan` | VARCHAR(50) | DEFAULT 'free' | free / starter / pro / enterprise |
| `max_users` | INT | DEFAULT 10 | |
| `max_campaigns` | INT | DEFAULT 50 | |
| `created_by` | INT | NULLABLE | FK → users.id (Super Admin) |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | |

**Indexes:** `uq_companies_slug` (UNIQUE)
**Navigation:** → CompanySetting (1:1), → Users, Roles, AdAccounts, Campaigns

---

#### Table 2: `company_settings`
**C# Model:** `CompanySetting` | **Purpose:** Per-company configuration

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INT | PK | |
| `company_id` | INT | FK → companies.id, UNIQUE | 1:1 with company |
| `default_language` | VARCHAR(10) | DEFAULT 'en' | |
| `notification_email` | VARCHAR(200) | NULLABLE | |
| `max_daily_budget` | DECIMAL | NULLABLE | |
| `auto_approve_below` | DECIMAL | NULLABLE | auto-approve threshold |
| `require_cmo_approval` | BOOL | DEFAULT true | |
| `require_brand_check` | BOOL | DEFAULT false | |
| `default_bid_strategy` | VARCHAR(50) | DEFAULT 'lowest_cost' | |
| `default_platforms` | TEXT[] | DEFAULT '{facebook}' | |
| `gemini_api_key` | VARCHAR(500) | NULLABLE | encrypted |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | |

**Indexes:** `uq_settings_company` (UNIQUE on company_id)

---

#### Table 3: `company_ad_accounts`
**C# Model:** `CompanyAdAccount` | **Purpose:** Per-company ad platform credentials (replaces hardcoded appsettings.json)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INT | PK | |
| `company_id` | INT | FK → companies.id | |
| `platform` | VARCHAR(50) | NOT NULL | facebook / tiktok / youtube / google_ads |
| `account_name` | VARCHAR(200) | NULLABLE | friendly name |
| `account_id` | VARCHAR(200) | NOT NULL | e.g. act_2537893049860881 |
| `access_token` | TEXT | NOT NULL | encrypted |
| `refresh_token` | TEXT | NULLABLE | encrypted |
| `token_expires_at` | TIMESTAMP | NULLABLE | |
| `page_id` | VARCHAR(200) | NULLABLE | Facebook page |
| `pixel_id` | VARCHAR(200) | NULLABLE | tracking pixel |
| `developer_token` | VARCHAR(200) | NULLABLE | Google Ads |
| `customer_id` | VARCHAR(200) | NULLABLE | Google Ads |
| `status` | VARCHAR(20) | DEFAULT 'active' | active / expired / revoked / error |
| `last_tested_at` | TIMESTAMP | NULLABLE | |
| `last_error` | TEXT | NULLABLE | |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | |

**Indexes:** `idx_adaccounts_company`, `uq_adaccounts_platform` (company_id + platform + account_id UNIQUE)

---

### DOMAIN 2 — Auth & RBAC (6 Tables)

---

#### Table 4: `users`
**C# Model:** `User` | **Purpose:** User accounts and credentials

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INT | PK | |
| `username` | VARCHAR(50) | NULLABLE | |
| `password_hash` | TEXT | NULLABLE | BCrypt hash |
| `email` | VARCHAR(200) | NULLABLE, UNIQUE | |
| `first_name` | VARCHAR(100) | NULLABLE | |
| `last_name` | VARCHAR(100) | NULLABLE | |
| `avatar_url` | VARCHAR(500) | NULLABLE | |
| `phone` | VARCHAR(50) | NULLABLE | |
| `role_id` | INT | FK → roles.id | |
| `company_id` | INT | FK → companies.id, NULLABLE | NULL = Super Admin |
| `is_super_admin` | BOOL | DEFAULT false | |
| `status` | VARCHAR(20) | DEFAULT 'active' | active / suspended / deactivated |
| `last_login_at` | TIMESTAMP | NULLABLE | |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | |

**Indexes:** `idx_users_company`, `idx_users_email` (UNIQUE)

---

#### Table 5: `roles`
**C# Model:** `Role` | **Purpose:** Role definitions per company

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INT | PK | |
| `name` | VARCHAR(100) | NOT NULL | |
| `company_id` | INT | FK → companies.id, NULLABLE | NULL = system role |
| `description` | VARCHAR(500) | NULLABLE | |
| `is_system_role` | BOOL | DEFAULT false | Admin/CMO/PPP/Expert cannot be deleted |
| `color` | VARCHAR(50) | NULLABLE | role badge color |
| `icon` | VARCHAR(10) | NULLABLE | display icon |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |

**Indexes:** `idx_roles_company`

---

#### Table 6: `screens`
**C# Model:** `Screen` | **Purpose:** UI screen/page definitions for RBAC

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INT | PK | |
| `name` | VARCHAR(100) | NOT NULL, UNIQUE | screen identifier |
| `display_name` | VARCHAR(200) | | human-readable name |
| `category` | VARCHAR(50) | NULLABLE | expert / cmo / ppp / admin / super / shared |
| `icon` | VARCHAR(20) | NULLABLE | emoji or icon class |
| `sort_order` | INT | DEFAULT 0 | |
| `is_active` | BOOL | DEFAULT true | |
| `description` | VARCHAR(500) | NULLABLE | |

---

#### Table 7: `role_screens`
**C# Model:** `RoleScreen` | **Purpose:** Role-to-screen permission mapping (RBAC matrix)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `role_id` | INT | CPK, FK → roles.id | |
| `screen_id` | INT | CPK, FK → screens.id | |
| `company_id` | INT | FK → companies.id, NULLABLE | |
| `granted_by` | INT | FK → users.id, NULLABLE | |
| `granted_at` | TIMESTAMP | DEFAULT NOW() | |

**Key:** Composite primary key (role_id + screen_id)
**Indexes:** `idx_rolescreens_company`

---

#### Table 8: `user_screens`
**C# Model:** `UserScreen` | **Purpose:** Per-user screen permission overrides (independent of role)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `user_id` | INT | CPK, FK → users.id | CASCADE on delete |
| `screen_id` | INT | CPK, FK → screens.id | |
| `company_id` | INT | FK → companies.id, NULLABLE | |
| `granted_by` | INT | FK → users.id, NULLABLE | SET NULL on delete |
| `granted_at` | TIMESTAMP | DEFAULT NOW() | |

**Key:** Composite primary key (user_id + screen_id)
**Indexes:** `idx_userscreens_company`, `idx_userscreens_user`

---

#### Table 9: `refresh_tokens`
**C# Model:** `RefreshToken` | **Purpose:** JWT refresh token storage for secure token rotation

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INT | PK | |
| `user_id` | INT | FK → users.id | |
| `token` | VARCHAR(500) | NOT NULL, UNIQUE | |
| `expires_at` | TIMESTAMP | NOT NULL | |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |
| `revoked_at` | TIMESTAMP | NULLABLE | |
| `replaced_by` | VARCHAR(500) | NULLABLE | token rotation chain |
| `ip_address` | VARCHAR(50) | NULLABLE | |
| `user_agent` | VARCHAR(500) | NULLABLE | |

**Indexes:** `uq_refresh_token` (UNIQUE), `idx_refresh_user`

---

### DOMAIN 3 — Campaign Core (6 Tables)

---

#### Table 10: `campaign_objectives`
**C# Model:** `CampaignObjective` | **Purpose:** Standardized objective lookup mapped to each platform's API enum

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INT | PK | |
| `category` | VARCHAR(50) | NOT NULL | awareness / consideration / conversion |
| `name` | VARCHAR(100) | NOT NULL | e.g. "Brand Awareness", "Traffic" |
| `description` | TEXT | NULLABLE | |
| `icon` | VARCHAR(10) | NULLABLE | |
| `platform_mapping` | JSONB | NOT NULL | {facebook, tiktok, youtube, google_ads} enums |
| `supported_platforms` | TEXT[] | DEFAULT '{facebook,tiktok}' | |
| `sort_order` | INT | DEFAULT 0 | |
| `is_active` | BOOL | DEFAULT true | |

---

#### Table 11: `campaigns`
**C# Model:** `Campaign` | **Purpose:** Core campaign entity — full lifecycle from draft to completed

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INT | PK | |
| `company_id` | INT | FK → companies.id | |
| `name` | VARCHAR(200) | NULLABLE | |
| `objective_id` | INT | FK → campaign_objectives.id, NULLABLE | |
| `campaign_type` | VARCHAR(50) | DEFAULT 'standard' | standard / ab_test / dynamic |
| `brief` | TEXT | NULLABLE | AI strategy brief |
| `style_preset` | VARCHAR | NULLABLE | Cinematic / Minimalism / Cyberpunk / Vintage |
| `aspect_ratio` | VARCHAR | NULLABLE | 1:1 / 16:9 / 9:16 |
| `total_budget` | DECIMAL | NULLABLE | |
| `daily_budget` | DECIMAL | NULLABLE | |
| `lifetime_budget` | DECIMAL | NULLABLE | |
| `bid_strategy` | VARCHAR(50) | NULLABLE | lowest_cost / cost_cap / bid_cap |
| `currency` | VARCHAR(10) | DEFAULT 'USD' | |
| `start_date` | TIMESTAMP | NULLABLE | |
| `end_date` | TIMESTAMP | NULLABLE | |
| `platforms` | TEXT[] | DEFAULT '{}' | facebook / tiktok / youtube / google |
| `targeting` | JSONB | NULLABLE | full targeting spec |
| `status` | VARCHAR(30) | DEFAULT 'draft' | draft→pending_review→approved→deploying→active→paused→completed→archived |
| `rejection_reason` | TEXT | NULLABLE | |
| `created_by` | INT | FK → users.id, SET NULL | |
| `approved_by` | INT | FK → users.id, SET NULL | |
| `deployed_by` | INT | FK → users.id, SET NULL | |
| `approved_at` | TIMESTAMP | NULLABLE | |
| `deployed_at` | TIMESTAMP | NULLABLE | |
| `completed_at` | TIMESTAMP | NULLABLE | |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | |

**Indexes:** `idx_campaigns_company`, `idx_campaigns_status`, `idx_campaigns_dates`

---

#### Table 12: `ad_sets`
**C# Model:** `AdSet` | **Purpose:** Ad group level — targeting, budget, placements between Campaign and Ad

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INT | PK | |
| `company_id` | INT | FK → companies.id | |
| `campaign_id` | INT | FK → campaigns.id | |
| `name` | VARCHAR(200) | NOT NULL | |
| `status` | VARCHAR(20) | DEFAULT 'draft' | |
| `daily_budget` | DECIMAL | NULLABLE | |
| `lifetime_budget` | DECIMAL | NULLABLE | |
| `bid_strategy` | VARCHAR(50) | NULLABLE | |
| `bid_amount` | DECIMAL | NULLABLE | |
| `optimization_goal` | VARCHAR(50) | NULLABLE | link_clicks / impressions / conversions |
| `billing_event` | VARCHAR(50) | DEFAULT 'IMPRESSIONS' | |
| `start_time` | TIMESTAMP | NULLABLE | |
| `end_time` | TIMESTAMP | NULLABLE | |
| `targeting` | JSONB | NULLABLE | geo, age, gender, interests, audiences |
| `placements` | JSONB | NULLABLE | per-platform placement config |
| `schedule` | JSONB | NULLABLE | dayparting rules |
| `platform_adset_ids` | JSONB | NULLABLE | {facebook: "123", tiktok: "456"} |
| `created_by` | INT | FK → users.id | |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | |

**Indexes:** `idx_adsets_campaign`, `idx_adsets_company`

---

#### Table 13: `ads`
**C# Model:** `Ad` | **Purpose:** Individual ad entity — specific creative + copy combination within an ad set

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INT | PK | |
| `company_id` | INT | FK → companies.id | |
| `ad_set_id` | INT | FK → ad_sets.id | |
| `name` | VARCHAR(200) | NOT NULL | |
| `status` | VARCHAR(20) | DEFAULT 'draft' | draft / pending_review / approved / rejected / active / paused / archived |
| `headline` | VARCHAR(500) | NULLABLE | |
| `description` | TEXT | NULLABLE | |
| `cta_type` | VARCHAR(50) | NULLABLE | LEARN_MORE / SHOP_NOW / SIGN_UP / BOOK_NOW / DOWNLOAD / CONTACT_US |
| `cta_link` | VARCHAR(1000) | NULLABLE | |
| `platform_ad_ids` | JSONB | NULLABLE | {facebook: "ad_123", tiktok: "ad_456"} |
| `review_status` | VARCHAR(20) | DEFAULT 'pending' | pending / approved / rejected |
| `created_by` | INT | FK → users.id, SET NULL | |
| `reviewed_by` | INT | FK → users.id, SET NULL | |
| `reviewed_at` | TIMESTAMP | NULLABLE | |
| `review_notes` | TEXT | NULLABLE | |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | |

**Indexes:** `idx_ads_adset`, `idx_ads_company`, `idx_ads_status`

---

#### Table 14: `ad_creatives`
**C# Model:** `AdCreative` | **Purpose:** Creative assets linked to individual ads (one ad can have multiple for carousel)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INT | PK | |
| `company_id` | INT | FK → companies.id | |
| `ad_id` | INT | FK → ads.id | |
| `creative_type` | VARCHAR(30) | NOT NULL | image / video / carousel / slideshow |
| `asset_url` | VARCHAR(1000) | NOT NULL | |
| `asset_filename` | VARCHAR(500) | NULLABLE | |
| `thumbnail_url` | VARCHAR(1000) | NULLABLE | |
| `primary_text` | TEXT | NULLABLE | main ad copy |
| `headline` | VARCHAR(500) | NULLABLE | |
| `description` | TEXT | NULLABLE | |
| `cta_type` | VARCHAR(50) | NULLABLE | |
| `cta_link` | VARCHAR(1000) | NULLABLE | |
| `platform_creative_ids` | JSONB | NULLABLE | {facebook: "cr_123"} |
| `file_size_bytes` | BIGINT | NULLABLE | |
| `width` | INT | NULLABLE | |
| `height` | INT | NULLABLE | |
| `duration_seconds` | INT | NULLABLE | video only |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |

**Indexes:** `idx_creatives_ad`, `idx_creatives_company`

---

#### Table 15: `campaign_workflow_steps`
**C# Model:** `CampaignWorkflowStep` | **Purpose:** Tracks campaign creation wizard progress (7 steps per campaign)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INT | PK | |
| `campaign_id` | INT | FK → campaigns.id | |
| `step_name` | VARCHAR(50) | NOT NULL | objective / targeting / strategy / adset_config / creative / review / deploy |
| `step_order` | INT | NOT NULL | |
| `status` | VARCHAR(20) | DEFAULT 'not_started' | not_started / in_progress / completed / skipped |
| `data` | JSONB | NULLABLE | step payload snapshot |
| `notes` | TEXT | NULLABLE | |
| `completed_by` | INT | FK → users.id, NULLABLE | |
| `started_at` | TIMESTAMP | NULLABLE | |
| `completed_at` | TIMESTAMP | NULLABLE | |

**Indexes:** `idx_workflow_campaign`, `uq_workflow_step` (campaign_id + step_name UNIQUE)

---

### DOMAIN 4 — Workflow Queues (4 Tables)

---

#### Table 16: `cmo_queue`
**C# Model:** `CmoQueueItem` | **Purpose:** CMO approval queue — assets submitted by Expert, reviewed by CMO

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | VARCHAR | PK | asset filename |
| `company_id` | INT | FK → companies.id | |
| `campaign_id` | INT | FK → campaigns.id, NULLABLE | |
| `ad_id` | INT | FK → ads.id, NULLABLE | |
| `url` | VARCHAR | NULLABLE | asset URL |
| `title` | VARCHAR | NULLABLE | |
| `type` | VARCHAR | NULLABLE | image / video |
| `status` | VARCHAR | DEFAULT 'pending' | pending / approved / rejected |
| `priority` | INT | DEFAULT 0 | 0=normal / 1=high / 2=urgent |
| `submitted_by` | INT | FK → users.id, SET NULL | |
| `reviewed_by` | INT | FK → users.id, SET NULL | |
| `reviewed_at` | TIMESTAMP | NULLABLE | |
| `review_notes` | TEXT | NULLABLE | |
| `added_at` | TIMESTAMP | DEFAULT NOW() | |

**Indexes:** `idx_cmoqueue_company`, `idx_cmoqueue_status`

---

#### Table 17: `ppp_queue`
**C# Model:** `PppQueueItem` | **Purpose:** PPP dispatch queue — replaces `ppc_queue.json` file

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INT | PK | |
| `company_id` | INT | FK → companies.id | |
| `campaign_id` | INT | FK → campaigns.id, NULLABLE | |
| `ad_id` | INT | FK → ads.id, NULLABLE | |
| `asset_filename` | VARCHAR(500) | NOT NULL | |
| `asset_url` | VARCHAR(1000) | NOT NULL | |
| `asset_type` | VARCHAR(20) | NOT NULL | image / video |
| `title` | VARCHAR(500) | NULLABLE | |
| `status` | VARCHAR(20) | DEFAULT 'pending' | pending / selected / deploying / deployed / failed |
| `queue_index` | INT | DEFAULT 0 | |
| `approved_by` | INT | FK → users.id, SET NULL | CMO who approved |
| `approved_at` | TIMESTAMP | NULLABLE | |
| `deployed_by` | INT | FK → users.id, SET NULL | PPP who deployed |
| `deployed_at` | TIMESTAMP | NULLABLE | |
| `deploy_platforms` | TEXT[] | NULLABLE | platforms deployed to |
| `added_at` | TIMESTAMP | DEFAULT NOW() | |

**Indexes:** `idx_pppqueue_company`, `idx_pppqueue_status`

---

#### Table 18: `approval_comments`
**C# Model:** `ApprovalComment` | **Purpose:** Review feedback during approval workflow

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INT | PK | |
| `company_id` | INT | FK → companies.id | |
| `campaign_id` | INT | FK → campaigns.id | |
| `ad_id` | INT | FK → ads.id, NULLABLE | |
| `user_id` | INT | FK → users.id | |
| `comment` | TEXT | NOT NULL | |
| `action` | VARCHAR(30) | NOT NULL | approve / reject / request_changes / comment |
| `attachment_url` | VARCHAR(1000) | NULLABLE | |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |

**Indexes:** `idx_comments_campaign`, `idx_comments_ad`

---

#### Table 19: `brand_guidelines`
**C# Model:** `BrandGuideline` | **Purpose:** Brand identity configuration per company

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | |
| `company_id` | INT FK | |
| `brand_label` | VARCHAR | |
| `tone` | VARCHAR | |
| `language` | VARCHAR | |
| `description` | VARCHAR | |
| `tagline` | VARCHAR(500) | |
| `logo_url` | VARCHAR(500) | |
| `whitelist` | TEXT | approved words |
| `blacklist` | TEXT | banned words |
| `voice_examples` | TEXT | example copy |
| `do_list` | TEXT | brand dos |
| `dont_list` | TEXT | brand don'ts |
| `typography` | JSONB | font config |
| `palette` | TEXT[] | color array |
| `created_by` | INT FK | SET NULL |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

**Indexes:** `idx_guidelines_company`

---

### DOMAIN 5 — Analytics (2 Tables)

---

#### Table 20: `ad_metrics`
**C# Model:** `AdMetric` | **Purpose:** Daily performance metrics fetched from each ad platform

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | |
| `company_id` | INT FK | |
| `campaign_id` | INT FK | |
| `ad_set_id` | INT FK NULLABLE | |
| `ad_id` | INT FK NULLABLE | |
| `platform` | VARCHAR(50) | facebook / tiktok / youtube |
| `date` | DATE | |
| `impressions` | BIGINT | DEFAULT 0 |
| `reach` | BIGINT | DEFAULT 0 |
| `clicks` | BIGINT | DEFAULT 0 |
| `ctr` | DECIMAL(8,4) | click-through rate % |
| `cpc` | DECIMAL(10,4) | cost per click |
| `cpm` | DECIMAL(10,4) | cost per 1000 impressions |
| `spend` | DECIMAL(12,2) | |
| `conversions` | INT | |
| `conversion_value` | DECIMAL(12,2) | |
| `roas` | DECIMAL(10,4) | return on ad spend |
| `frequency` | DECIMAL(8,2) | |
| `video_views` | BIGINT NULLABLE | |
| `video_completions` | BIGINT NULLABLE | |
| `leads` | INT NULLABLE | |
| `app_installs` | INT NULLABLE | |
| `fetched_at` | TIMESTAMP | |

**Indexes:** `idx_metrics_company`, `idx_metrics_campaign`, `idx_metrics_date`
**Unique:** `uq_metrics_daily` (campaign_id + ad_set_id + ad_id + platform + date)

---

#### Table 21: `deployment_logs`
**C# Model:** `DeploymentLog` | **Purpose:** Audit trail for every API call made during deployment

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | |
| `company_id` | INT FK | |
| `campaign_id` | INT FK | |
| `ad_set_id` | INT FK NULLABLE | |
| `ad_id` | INT FK NULLABLE | |
| `platform` | VARCHAR(50) | |
| `action` | VARCHAR(50) | upload_media / create_campaign / create_adset / create_creative / create_ad / pause / resume / delete |
| `platform_resource_id` | VARCHAR(200) NULLABLE | ID returned by platform API |
| `status` | VARCHAR(20) | success / failed / pending / simulated |
| `request_payload` | JSONB NULLABLE | what was sent |
| `response_payload` | JSONB NULLABLE | what was received |
| `error_message` | TEXT NULLABLE | |
| `duration_ms` | INT NULLABLE | |
| `executed_by` | INT FK | RESTRICT delete |
| `executed_at` | TIMESTAMP | |

**Indexes:** `idx_deplogs_company`, `idx_deplogs_campaign`, `idx_deplogs_date`

---

### DOMAIN 6 — Features (4 Tables)

---

#### Table 22: `ab_tests`
**C# Model:** `AbTest` | **Purpose:** A/B testing framework with statistical significance tracking

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | |
| `company_id` | INT FK | |
| `campaign_id` | INT FK | |
| `name` | VARCHAR(200) | |
| `variant_a_ad_id` | INT FK → ads.id | RESTRICT delete |
| `variant_b_ad_id` | INT FK → ads.id | RESTRICT delete |
| `metric` | VARCHAR(50) | ctr / cpc / conversion_rate / roas |
| `traffic_split` | INT | DEFAULT 50 (% for variant A) |
| `status` | VARCHAR(20) | draft / running / completed / cancelled |
| `winner` | VARCHAR(5) NULLABLE | A / B / inconclusive |
| `confidence_level` | DECIMAL(5,2) NULLABLE | statistical significance % |
| `variant_a_result` | DECIMAL(12,4) NULLABLE | |
| `variant_b_result` | DECIMAL(12,4) NULLABLE | |
| `created_by` | INT FK NULLABLE | |
| `started_at` | TIMESTAMP NULLABLE | |
| `ended_at` | TIMESTAMP NULLABLE | |
| `created_at` | TIMESTAMP | |

**Indexes:** `idx_abtests_company`, `idx_abtests_campaign`

---

#### Table 23: `budget_allocations`
**C# Model:** `BudgetAllocation` | **Purpose:** Budget planning & spend tracking per platform per period

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | |
| `company_id` | INT FK | |
| `period_type` | VARCHAR(20) | monthly / quarterly / yearly |
| `period_start` | DATE | |
| `period_end` | DATE | |
| `total_budget` | DECIMAL(14,2) | |
| `facebook_allocation` | DECIMAL(14,2) | DEFAULT 0 |
| `tiktok_allocation` | DECIMAL(14,2) | DEFAULT 0 |
| `youtube_allocation` | DECIMAL(14,2) | DEFAULT 0 |
| `google_allocation` | DECIMAL(14,2) | DEFAULT 0 |
| `spent_to_date` | DECIMAL(14,2) | DEFAULT 0 |
| `status` | VARCHAR(20) | active / closed / exceeded |
| `created_by` | INT FK NULLABLE | |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

**Indexes:** `idx_budgets_company`, `idx_budgets_period`

---

#### Table 24: `campaign_templates`
**C# Model:** `CampaignTemplate` | **Purpose:** Reusable campaign configuration templates

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | |
| `company_id` | INT FK NULLABLE | NULL = global (Super Admin template) |
| `name` | VARCHAR(200) | |
| `description` | TEXT NULLABLE | |
| `objective_id` | INT FK NULLABLE | |
| `targeting` | JSONB NULLABLE | |
| `budget_config` | JSONB NULLABLE | {daily_budget, bid_strategy} |
| `creative_specs` | JSONB NULLABLE | {style_preset, aspect_ratio, formats} |
| `platforms` | TEXT[] NULLABLE | |
| `is_global` | BOOL | DEFAULT false |
| `created_by` | INT FK NULLABLE | |
| `use_count` | INT | DEFAULT 0 |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

**Indexes:** `idx_templates_company`

---

#### Table 25: `audience_templates`
**C# Model:** `AudienceTemplate` | **Purpose:** Saved reusable audience targeting configurations

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | |
| `company_id` | INT FK | |
| `name` | VARCHAR(200) | |
| `description` | TEXT NULLABLE | |
| `targeting` | JSONB NOT NULL | full targeting spec |
| `estimated_size` | BIGINT NULLABLE | estimated audience size |
| `created_by` | INT FK NULLABLE | |
| `use_count` | INT | DEFAULT 0 |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

**Indexes:** `idx_audiences_company`

---

### DOMAIN 7 — System (3 Tables)

---

#### Table 26: `notifications`
**C# Model:** `Notification` | **Purpose:** In-app notification system for all workflow events

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | |
| `company_id` | INT FK | |
| `user_id` | INT FK | recipient |
| `type` | VARCHAR(50) | campaign_submitted / campaign_approved / deploy_success / budget_alert / etc. |
| `title` | VARCHAR(200) | |
| `message` | TEXT | |
| `resource_type` | VARCHAR(50) NULLABLE | campaign / ad / deployment / user / company |
| `resource_id` | INT NULLABLE | |
| `action_url` | VARCHAR(500) NULLABLE | deep link |
| `is_read` | BOOL | DEFAULT false |
| `read_at` | TIMESTAMP NULLABLE | |
| `created_at` | TIMESTAMP | |

**Indexes:** `idx_notif_user` (user_id + is_read), `idx_notif_company`

---

#### Table 27: `activity_logs`
**C# Model:** `ActivityLog` | **Purpose:** Full audit trail — every significant action for compliance

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | |
| `company_id` | INT FK NULLABLE | NULL = super admin action |
| `user_id` | INT FK | |
| `action` | VARCHAR(50) | login / logout / created / updated / deleted / approved / deployed / invited / role_changed |
| `resource_type` | VARCHAR(50) | user / campaign / ad / company / role / deployment |
| `resource_id` | VARCHAR(50) NULLABLE | |
| `description` | TEXT NULLABLE | |
| `details` | JSONB NULLABLE | before/after snapshot |
| `ip_address` | VARCHAR(50) NULLABLE | |
| `user_agent` | VARCHAR(500) NULLABLE | |
| `created_at` | TIMESTAMP | |

**Indexes:** `idx_activity_company` (company_id + created_at), `idx_activity_user`, `idx_activity_date`

---

#### Table 28: `invitations`
**C# Model:** `Invitation` | **Purpose:** Team member invitation via email with pre-assigned role

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | |
| `company_id` | INT FK | |
| `email` | VARCHAR(200) NOT NULL | |
| `role_id` | INT FK → roles.id | |
| `invited_by` | INT FK → users.id | |
| `token` | VARCHAR(200) NOT NULL UNIQUE | |
| `status` | VARCHAR(20) | DEFAULT 'pending' — pending / accepted / expired / revoked |
| `accepted_at` | TIMESTAMP NULLABLE | |
| `expires_at` | TIMESTAMP NOT NULL | |
| `created_at` | TIMESTAMP | |

**Indexes:** `uq_invitation_token` (UNIQUE), `idx_invitation_company`, `idx_invitation_email`

---

### DOMAIN 8 — Assets (1 Table)

---

#### Table 29: `asset_library`
**C# Model:** `AssetLibraryItem` | **Purpose:** Database-tracked asset management with metadata and tagging

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | |
| `company_id` | INT FK | |
| `filename` | VARCHAR(500) NOT NULL | |
| `original_name` | VARCHAR(500) NULLABLE | |
| `file_path` | VARCHAR(1000) NOT NULL | |
| `file_url` | VARCHAR(1000) NOT NULL | |
| `file_type` | VARCHAR(20) NOT NULL | image / video |
| `mime_type` | VARCHAR(100) NULLABLE | |
| `file_size_bytes` | BIGINT NULLABLE | |
| `width` | INT NULLABLE | |
| `height` | INT NULLABLE | |
| `duration_seconds` | INT NULLABLE | video only |
| `folder` | VARCHAR(50) | DEFAULT 'assets' — assets / library |
| `tags` | TEXT[] NULLABLE | |
| `status` | VARCHAR(20) | DEFAULT 'active' — active / archived / deleted |
| `uploaded_by` | INT FK | |
| `uploaded_at` | TIMESTAMP | |

**Indexes:** `idx_assetlib_company`, `idx_assetlib_folder` (company_id + folder)

---

## 3. API Endpoints — Complete Reference

**Total Implemented: 95+ endpoints**

### Auth (3)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create user account |
| POST | `/api/auth/login` | Authenticate → JWT + screens list |
| POST | `/api/auth/refresh` | Refresh JWT token |
| POST | `/api/onboard/company` | Company + admin onboarding wizard |

### Super Admin (8)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/super-admin/dashboard` | Platform-wide stats |
| GET | `/api/super-admin/companies` | List all companies |
| POST | `/api/super-admin/companies` | Create company |
| GET | `/api/super-admin/companies/{id}` | Get company details |
| PUT | `/api/super-admin/companies/{id}` | Update company |
| DELETE | `/api/super-admin/companies/{id}` | Delete company |
| GET | `/api/super-admin/companies/{id}/users` | Company users |
| GET | `/api/super-admin/companies/{id}/campaigns` | Company campaigns |
| GET | `/api/super-admin/audit-log` | Full audit log |

### RBAC (12)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rbac/roles` | List roles |
| POST | `/api/rbac/roles` | Create role |
| PUT | `/api/rbac/roles/{id}` | Update role |
| DELETE | `/api/rbac/roles/{id}` | Delete role |
| GET | `/api/rbac/screens` | List screens (filtered by role) |
| GET | `/api/rbac/users` | List users |
| DELETE | `/api/rbac/users/{id}` | Revoke user |
| PATCH | `/api/rbac/users/{id}/activate` | Re-activate user |
| DELETE | `/api/rbac/users/{id}/permanent` | Permanently delete user |
| GET | `/api/rbac/role-permissions/{roleId}` | Get role screen list |
| POST | `/api/rbac/role-permissions` | Save role-screen matrix |
| GET | `/api/rbac/user-permissions/{userId}` | Get user-level overrides |
| POST | `/api/rbac/user-permissions` | Save user-level overrides |
| POST | `/api/rbac/seed` | Seed default roles/screens |

### Campaigns (13)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/campaigns` | List campaigns (filter by status) |
| POST | `/api/campaigns` | Create campaign |
| GET | `/api/campaigns/{id}` | Get campaign |
| PUT | `/api/campaigns/{id}` | Update campaign |
| DELETE | `/api/campaigns/{id}` | Delete campaign |
| POST | `/api/campaigns/{id}/submit` | Submit for review |
| POST | `/api/campaigns/{id}/approve` | Approve campaign |
| POST | `/api/campaigns/{id}/reject` | Reject campaign |
| POST | `/api/campaigns/{id}/pause` | Pause campaign |
| POST | `/api/campaigns/{id}/resume` | Resume campaign |
| GET | `/api/campaigns/{id}/workflow` | Get workflow steps |
| PUT | `/api/campaigns/{id}/workflow/{stepName}` | Update workflow step |
| POST | `/api/campaigns/{id}/comments` | Add approval comment |
| GET | `/api/campaigns/{id}/comments` | List comments |
| GET | `/api/campaign-objectives` | List all objectives |

### Ad Sets & Ads (11)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/campaigns/{id}/adsets` | Create ad set |
| GET | `/api/campaigns/{id}/adsets` | List ad sets |
| GET | `/api/campaigns/{id}/adsets/{id}` | Get ad set |
| PUT | `/api/campaigns/{id}/adsets/{id}` | Update ad set |
| DELETE | `/api/campaigns/{id}/adsets/{id}` | Delete ad set |
| POST | `/api/adsets/{id}/ads` | Create ad |
| GET | `/api/adsets/{id}/ads` | List ads |
| GET | `/api/adsets/{id}/ads/{id}` | Get ad |
| PUT | `/api/adsets/{id}/ads/{id}` | Update ad |
| DELETE | `/api/adsets/{id}/ads/{id}` | Delete ad |
| POST | `/api/adsets/{id}/ads/{id}/review` | Review/approve ad |

### Queues (6)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cmo/queue` | CMO approval queue |
| POST | `/api/cmo/queue` | Update CMO queue item |
| GET | `/api/ppp/queue` | PPP dispatch queue (DB-backed) |
| POST | `/api/ppp/queue` | Update PPP queue item |
| GET | `/api/ppc/queue` | Legacy PPC queue (file-based) |
| POST | `/api/ppc/queue` | Legacy PPC queue update |

### Assets (8)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/assets` | List /Assets working files |
| POST | `/api/assets/save-url` | Download image from URL to /Assets |
| DELETE | `/api/assets/{filename}` | Delete asset |
| POST | `/api/assets/approve` | Copy to /Assets Library |
| GET | `/api/assets-library` | List /Assets Library files |
| GET | `/api/assets/company/{companyId}` | Company-scoped assets |
| GET | `/api/assets-library/company/{companyId}` | Company-scoped library |
| POST | `/api/compliance/check` | Brand compliance check on asset |

### Deploy (3)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/deploy/facebook` | Deploy to Facebook (Campaign→AdSet→Creative→Ad) |
| POST | `/api/deploy/tiktok-adgroup` | Deploy to TikTok (AdGroup→Creative) |
| POST | `/api/deploy/unified` | Unified multi-platform deployment orchestrator |

### AI / Gemini (2)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/gemini/questions` | Generate 5 Level-1 strategy questions |
| POST | `/api/gemini/follow-up` | Generate 5 Level-2 deep-dive questions |

### Analytics (6)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/overview` | Platform analytics overview |
| GET | `/api/analytics/campaigns/{id}/metrics` | Campaign metrics by platform/date |
| GET | `/api/analytics/platforms` | Cross-platform comparison |
| GET | `/api/analytics/top-performers` | Top performing campaigns/ads |
| GET | `/api/deployment-logs` | Deployment audit logs |
| GET | `/api/activity-logs` | User activity logs |

### A/B Tests (5)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ab-tests` | Create A/B test |
| GET | `/api/ab-tests` | List A/B tests |
| GET | `/api/ab-tests/{id}/results` | Get test results |
| POST | `/api/ab-tests/{id}/end` | End A/B test |
| POST | `/api/ab-tests/{id}/optimize` | Apply winner optimization |

### Budgets (3)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/budgets` | Create budget allocation |
| GET | `/api/budgets` | List budget allocations |
| GET | `/api/budgets/current` | Get current period budget |

### Templates & Audiences (5)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/templates` | Create campaign template |
| GET | `/api/templates` | List campaign templates |
| DELETE | `/api/templates/{id}` | Delete template |
| POST | `/api/audience-templates` | Create audience template |
| GET | `/api/audience-templates` | List audience templates |

### Notifications & Invitations (7)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | List notifications for user |
| PUT | `/api/notifications/{id}/read` | Mark as read |
| POST | `/api/notifications/read-all` | Mark all as read |
| POST | `/api/invitations` | Create invitation |
| GET | `/api/invitations` | List invitations |
| POST | `/api/invitations/{token}/accept` | Accept invitation |
| DELETE | `/api/invitations/{id}` | Revoke invitation |

### Ad Accounts & Settings (6)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ad-accounts` | List company ad accounts |
| POST | `/api/ad-accounts` | Add ad account |
| PUT | `/api/ad-accounts/{id}` | Update ad account |
| DELETE | `/api/ad-accounts/{id}` | Remove ad account |
| GET | `/api/company-settings` | Get company settings |
| PUT | `/api/company-settings` | Update company settings |

### Brand Guidelines (2)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/guidelines` | Fetch brand guideline |
| POST | `/api/guidelines` | Save brand guideline |

### Utilities (4)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/search` | Global search across campaigns/assets |
| GET | `/api/test/facebook-connection` | Test Facebook API connection |
| POST | `/api/seed/dummy-data` | Seed dummy data for testing |
| POST | `/api/rbac/seed` | Seed roles, screens, super admin |

---

## 4. Database Indexes & Constraints

### Unique Constraints (8)
| Index Name | Table | Columns |
|-----------|-------|---------|
| `uq_companies_slug` | companies | slug |
| `uq_settings_company` | company_settings | company_id |
| `uq_refresh_token` | refresh_tokens | token |
| `uq_invitation_token` | invitations | token |
| `idx_users_email` | users | email |
| `uq_adaccounts_platform` | company_ad_accounts | company_id + platform + account_id |
| `uq_workflow_step` | campaign_workflow_steps | campaign_id + step_name |
| `uq_metrics_daily` | ad_metrics | campaign_id + ad_set_id + ad_id + platform + date |

### Composite Primary Keys (2)
| Table | Keys |
|-------|------|
| `role_screens` | role_id + screen_id |
| `user_screens` | user_id + screen_id |

### Foreign Key Delete Behaviors
| Relationship | Behavior |
|-------------|----------|
| campaign → created_by / approved_by / deployed_by | SET NULL |
| ad → created_by / reviewed_by | SET NULL |
| ab_test → variant_a / variant_b | RESTRICT |
| cmo_queue → submitted_by / reviewed_by | SET NULL |
| ppp_queue → approved_by / deployed_by | SET NULL |
| role_screen → granted_by | SET NULL |
| user_screen → user | CASCADE |
| user_screen → granted_by | SET NULL |
| brand_guideline → created_by | SET NULL |
| deployment_log → executed_by | RESTRICT |
| company → company_settings | CASCADE |

---

## 5. Summary Counts

```
┌══════════════════════════════════════════════════════╗
│              IMPLEMENTATION SUMMARY                   │
╠══════════════════════════════════════════════════════╣
│  Frontend Screens         36 screens                  │
│  ── Super Admin screens    4                          │
│  ── Admin screens          8                          │
│  ── CMO screens            8                          │
│  ── Expert screens         9                          │
│  ── PPP screens            6                          │
│  ── Shared screens         1 (Notifications)          │
├──────────────────────────────────────────────────────┤
│  Database Tables          29 tables                   │
│  ── Multi-Tenancy          3                          │
│  ── Auth & RBAC            6                          │
│  ── Campaign Core          6                          │
│  ── Workflow Queues        4                          │
│  ── Analytics              2                          │
│  ── Features               4                          │
│  ── System                 3                          │
│  ── Assets                 1                          │
├──────────────────────────────────────────────────────┤
│  API Endpoints            95+ endpoints               │
│  ── Auth & Onboard         4                          │
│  ── Super Admin            9                          │
│  ── RBAC                  14                          │
│  ── Campaigns             15                          │
│  ── Ad Sets & Ads         11                          │
│  ── Queues                 6                          │
│  ── Assets                 8                          │
│  ── Deploy                 3                          │
│  ── AI / Gemini            2                          │
│  ── Analytics              6                          │
│  ── A/B Tests              5                          │
│  ── Budgets                3                          │
│  ── Templates              5                          │
│  ── Notifications          7                          │
│  ── Ad Accounts            6                          │
│  ── Utilities              4                          │
├──────────────────────────────────────────────────────┤
│  DB Indexes               35+ indexes                 │
│  DB Unique Constraints     8                          │
│  DB Foreign Keys          50+                         │
│  DB Composite PKs          2                          │
╚══════════════════════════════════════════════════════╝
```

---

*Document: database_and_screens.md*
*Source: `backend/Models.cs` · `backend/AppDbContext.cs` · `backend/Program.cs` · `frontend/src/main.js`*
*All entries verified from actual project code*
