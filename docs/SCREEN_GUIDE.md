# AI Marketing Platform - Complete Screen Guide & System Flow

## Table of Contents
1. [All Screens by Role](#1-all-screens-by-role)
2. [Screen Functions Explained](#2-screen-functions-explained)
3. [Screen Sequence & Navigation Flow](#3-screen-sequence--navigation-flow)
4. [Role-Based Access Matrix](#4-role-based-access-matrix)
5. [Complete System Flow](#5-complete-system-flow)
6. [Data Flow Diagram](#6-data-flow-diagram)

---

## 1. All Screens by Role

### Super Admin (5 Screens)
| # | Screen ID | Label | Purpose |
|---|-----------|-------|---------|
| 1 | GlobalDashboard | Global Dashboard | Cross-company KPIs, top companies list, system overview |
| 2 | CompanyManagement | Company Management | Create/edit/suspend companies, view users & campaigns per company |
| 3 | SystemConfig | System Configuration | Platform API status, system info (version, database, stack) |
| 4 | AuditLog | Audit Log | View all activity logs across companies |
| 5 | *(Can enter any company)* | *(Inherits all Admin screens)* | Super Admin can "enter" a company and see everything that company's Admin sees |

### Admin - Company Administrator (9 Screens + Dashboard)
| # | Screen ID | Label | Purpose |
|---|-----------|-------|---------|
| 1 | Dashboard | Dashboard | Company overview with KPIs, recent campaigns |
| 2 | Config | Platform Config | Configure TikTok tokens, API keys, platform settings |
| 3 | CompanyProfile | Company Profile | Edit company name, industry, website, social links, mission/vision |
| 4 | UserManagement | User Management | Create new users, assign roles, revoke access, view personnel directory |
| 5 | RoleManagement | Role Management | Create custom roles, assign screen permissions via checkbox matrix |
| 6 | AdAccountManagement | Ad Accounts | Connect/disconnect Facebook, TikTok, YouTube, Google Ads accounts |
| 7 | Calendar | Global Calendar | Monthly operations calendar (campaign scheduling) |
| 8 | Guideline | Brand Guideline | Set brand tone, typography, color palette, whitelist/blacklist words |
| 9 | Assets | Creative Assets | Browse and manage the approved asset library |
| 10 | BillingSettings | Billing & Subscription | View current plan, upgrade options (Free/Starter/Pro/Enterprise) |

### CMO - Chief Marketing Officer (8 Screens + Dashboard)
| # | Screen ID | Label | Purpose |
|---|-----------|-------|---------|
| 1 | Dashboard | Dashboard | KPIs: spend, clicks, conversions, ROAS, recent campaigns |
| 2 | BudgetMatrix | Budget & Matrix | Set total spend, test cost per creative, budget allocation sliders (Reach/Click/Sales weights) |
| 3 | Approvals | Ad Approvals | Review pending campaigns + assets from Expert. Approve/Reject with comments |
| 4 | Monitoring | AI Monitoring | Live monitoring: active ads, AI-killed ads, total spend, efficiency %, performance matrix |
| 5 | AdPerformance | Ad Performance | Campaign metrics table: spend, conversions, ROAS, status per campaign |
| 6 | Budget | Budget Overview | Total allocated vs remaining budget display |
| 7 | Notifications | Notifications | In-app notifications (campaign submitted, approved, rejected, deploy results) |
| 8 | CampaignReports | Campaign Reports | Full campaign list with status, budget, platforms, dates |
| 9 | CrossPlatformAnalytics | Cross-Platform Analytics | Side-by-side comparison: Facebook vs TikTok vs YouTube vs Google (spend, clicks, CTR, ROAS) |

### PPP - Planner/Publisher/Performer (7 Screens + Dashboard)
| # | Screen ID | Label | Purpose |
|---|-----------|-------|---------|
| 1 | Dashboard | Dashboard | Deployment metrics overview |
| 2 | ApprovedAssets | Approved Assets | View CMO-approved assets in PPP queue, select assets for deployment |
| 3 | DeploySelection | Platform Selection | Choose platforms (Facebook/TikTok/YouTube/Google), configure parameters, preview payload, execute deployment |
| 4 | AdPerformance | Ad Performance | Campaign performance metrics with ROAS tracking |
| 5 | Monitoring | AI Monitoring | Live monitoring dashboard |
| 6 | Budget | Budget Overview | Budget tracking |
| 7 | DeploymentHistory | Deployment History | Audit trail: every API call to ad platforms (timestamp, platform, action, resource ID, status, duration) |
| 8 | ABTestResults | A/B Test Results | View A/B tests: variant A vs B metrics, winner, confidence level, traffic split |

### Expert - Marketing Expert (7 Screens + Dashboard)
| # | Screen ID | Label | Purpose |
|---|-----------|-------|---------|
| 1 | Dashboard | Dashboard | Campaign overview, quick "New Campaign" button |
| 2 | Objective | Campaign Objective | Select campaign goal: Reach / Click / Sell (or use Campaign Builder Wizard with 13 objectives) |
| 3 | Targeting | Target Audience | Define audience: country, language, age range, gender, interests. Multiple targeting sets |
| 4 | Research | Strategy Hub | 3-phase AI research: (1) Enter brief → Gemini generates 5 questions, (2) Answer → 5 deeper questions, (3) Final diagnostics |
| 5 | CreativeConfig | Creative Config | Set style preset (Cinematic/Minimalism/Cyberpunk/Vintage), aspect ratio, generation counts, upload/import assets |
| 6 | Studio | Creative Studio | Review generated variations, approve/delete assets, dispatch approved assets to CMO Queue |
| 7 | AudienceInsights | Audience Insights | View audience demographics, interests, device breakdown (data from deployed campaigns) |
| 8 | CompetitorResearch | Competitor Research | AI-powered competitor analysis (enter brand/URL for strategy analysis) |

---

## 2. Screen Functions Explained

### SUPER ADMIN SCREENS

#### GlobalDashboard
```
WHAT IT DOES:
- Shows total companies, users, campaigns, active campaigns across the entire system
- Lists top 5 companies ranked by campaign count and user count
- Each company has an "ENTER" button to impersonate/view that company

DATA SOURCES:
- GET /api/super-admin/dashboard

WHO USES IT: Super Admin only
```

#### CompanyManagement
```
WHAT IT DOES:
- Table of all companies: name, slug, industry, user count, campaign count, status
- "Create Company" button → prompt for name + industry
- "Enter" button → sets X-Company-Id header, switches to that company's context

DATA SOURCES:
- GET /api/super-admin/companies
- POST /api/super-admin/companies (create)

WHO USES IT: Super Admin only
```

#### AuditLog
```
WHAT IT DOES:
- Filterable table of all system actions
- Columns: time, user, action, resource type, resource ID, details
- Shows login, create, update, delete, approve, reject, deploy events

DATA SOURCES:
- GET /api/super-admin/audit-log (Super Admin)
- GET /api/activity-logs (Company Admin)

WHO USES IT: Super Admin, Admin
```

### EXPERT WORKFLOW SCREENS

#### Objective (Step 1 of Campaign)
```
WHAT IT DOES:
- 3 large cards: Reach (awareness), Click (engagement), Sell (conversion)
- User clicks one to select → highlighted with cyan border
- "CONTINUE TO TARGETING" button (disabled until objective selected)
- Stores selection in state.marketingData.objective

NEXT SCREEN: Targeting
PREVIOUS SCREEN: Dashboard
```

#### Targeting (Step 2 of Campaign)
```
WHAT IT DOES:
- Left panel: input form (country, language, age min/max, gender, area)
- Right panel: list of added targeting sets
- "ADD TARGET" button → pushes new segment to state.marketingData.targeting[]
- Each target shows as a card with delete (X) button
- "PROCEED TO STRATEGY HUB" button

NEXT SCREEN: Research (Strategy Hub)
PREVIOUS SCREEN: Objective
```

#### Research / Strategy Hub (Step 3 of Campaign)
```
WHAT IT DOES - 3 PHASES:

PHASE 1 - BASELINE RESEARCH:
- Text area for campaign brief/goal
- "INITIATE STRATEGIC PROBE" button
- Calls POST /api/gemini/questions with brief
- AI generates 5 conceptual questions about brand psychology
- Loading animation while AI processes

PHASE 2 - PROBE LEVEL 1:
- Displays 5 AI-generated questions with answer fields
- User answers each question (psychological/strategic)
- "ADVANCE TO LEVEL 2" button
- Calls POST /api/gemini/follow-up with brief + previous Q&A
- Generates 5 deeper diagnostic questions

PHASE 3 - FINAL DIAGNOSTICS:
- Displays 5 Level 2 deep-dive questions
- Topics: unspoken truth, controversy, belonging, transformation, brand soul
- "FINALIZE PROFILE" button → navigates to Creative Config

DATA: Uses Gemini AI API with caching + retry logic

NEXT SCREEN: CreativeConfig
PREVIOUS SCREEN: Targeting
```

#### CreativeConfig (Step 4 of Campaign)
```
WHAT IT DOES:
- Auto-generates "Generation Brief" from all previous answers
- Style Preset selector: Cinematic / Minimalism / Cyberpunk / Vintage
- Aspect Ratio selector: 1:1 / 16:9 / 9:16
- Sliders for: Photos to generate, Videos, Posts
- File upload area (drag & drop or URL import)
- "GENERATE CONTENT" button:
  → POST /api/campaigns (save campaign to database)
  → POST /api/assets/save-url (download sample images from Unsplash)
  → Navigate to Studio

NEXT SCREEN: Studio
PREVIOUS SCREEN: Research
```

#### Studio (Step 5 of Campaign)
```
WHAT IT DOES:
- Fetches all assets from GET /api/assets
- Grid of image/video cards with:
  - DELETE button → removes asset
  - APPROVE button → marks for CMO review
- Top bar shows approved count
- "DISPATCH TO CMO" button:
  → Moves approved assets to state.marketingData.cmoQueue
  → POST /api/cmo/queue (sync to server)
  → Creates notifications for CMO users

NEXT SCREEN: (Control passes to CMO role)
PREVIOUS SCREEN: CreativeConfig
```

### CMO WORKFLOW SCREENS

#### BudgetMatrix
```
WHAT IT DOES:
- Section 1: Total budget input + test cost per creative
- Section 2: Reallocation slider (Conservative ← → Aggressive)
- Section 3: Expectation Matrix with 3 sliders:
  - Reach weight (%)
  - Click weight (%)
  - Sales weight (%)
  - Validates total does not exceed 100%
- "APPLY MATRIX" button saves configuration

STANDALONE SCREEN (no forced sequence)
```

#### Approvals (CMO's Main Action Screen)
```
WHAT IT DOES:
- TWO TABS:

  TAB 1 - CAMPAIGNS:
  - Lists campaigns with status "pending_review"
  - Each shows: name, platforms, budget, objective
  - Campaign brief preview (expandable)
  - "Approve" button → POST /api/campaigns/{id}/approve
    → Creates notification for Expert + PPP
    → Campaign moves to "approved" status
  - "Reject" button → prompts for reason
    → POST /api/campaigns/{id}/reject
    → Creates notification for Expert with reason

  TAB 2 - ASSETS:
  - Grid of assets from CMO Queue
  - Image/video thumbnails with status and type
  - Approved assets move to PPP Queue

DATA SOURCES:
- GET /api/campaigns?status=pending_review
- GET /api/cmo/queue

NEXT: Assets move to PPP's ApprovedAssets screen
```

#### CampaignReports
```
WHAT IT DOES:
- Full table of all company campaigns
- Columns: name, status (color-coded badge), budget, platforms, created date
- Shows campaign lifecycle state visually

DATA SOURCE: GET /api/campaigns
```

#### CrossPlatformAnalytics
```
WHAT IT DOES:
- 4 platform cards side-by-side: Facebook, TikTok, YouTube, Google
- Each shows: total spend, clicks, impressions, avg CTR, avg ROAS
- Helps CMO decide budget allocation across platforms

DATA SOURCE: GET /api/analytics/platforms
```

### PPP WORKFLOW SCREENS

#### ApprovedAssets (PPP's Starting Screen)
```
WHAT IT DOES:
- Displays PPP Queue (assets approved by CMO)
- Each asset card has a "SELECT FOR POST" toggle
- Selected assets go to state.marketingData.selectedAssets[]
- Selected count shown in header
- "GO TO DISPATCH HUB" button (disabled until ≥1 selected)
  → Navigates to DeploySelection

DATA SOURCE: GET /api/ppp/queue (or /api/ppc/queue)

NEXT SCREEN: DeploySelection
```

#### DeploySelection (The Deployment Hub)
```
WHAT IT DOES:
- Platform selection cards (4 platforms):
  - Facebook/Instagram (📘) - Feed, Stories, Reels, Marketplace
  - TikTok (🎵) - For You Page, Pangle, Automatic
  - YouTube (▶️) - In-Stream, Discovery, Shorts, Bumper
  - Google Ads (🔍) - Search, Display, Shopping, Performance Max
- Each has Enable checkbox + Configure button
- "Preview Payload" → shows JSON of what will be sent to APIs
- "Deploy Now" → executes deployment:
  1. Upload media to platform
  2. Create Campaign via platform API
  3. Create Ad Set / Ad Group
  4. Create Creative
  5. Create Ad
  6. Log results to deployment_logs table
  7. Remove from queues

NEXT SCREEN: DeploymentHistory (to verify)
PREVIOUS SCREEN: ApprovedAssets
```

#### DeploymentHistory
```
WHAT IT DOES:
- Audit trail table of every deployment API call
- Columns: time, platform, action, resource ID, status (success/failed), duration
- Shows exact what was sent to Facebook/TikTok/YouTube/Google APIs

DATA SOURCE: GET /api/deployment-logs
```

#### ABTestResults
```
WHAT IT DOES:
- Cards for each A/B test showing:
  - Test name, metric being measured (CTR/CPC/ROAS)
  - Traffic split (e.g., 50/50)
  - Status (draft/running/completed)
  - Winner (Variant A or B) + confidence level
  - Variant A vs B result metrics

DATA SOURCE: GET /api/ab-tests
```

### ADMIN SCREENS

#### UserManagement
```
WHAT IT DOES:
- Left panel: Create User form (username, email, password, role dropdown)
  - Role dropdown EXCLUDES "Super Admin" unless logged in as Super Admin
  - Register sends POST /api/auth/register with companyId
- Right panel: Personnel Directory table
  - Shows: username, role badge, email, revoke button
  - Super Admin users HIDDEN from company Admin view
  - "Revoke" button → deactivates user (soft delete)

SPECIAL BEHAVIOR:
- Cannot revoke own account or "admin" master account
- Super Admin sees all users across companies
```

#### RoleManagement
```
WHAT IT DOES:
- Left panel: Create new custom role (name input)
- Right panel: Role cards with permission matrix
  - Each role shows ALL screens as checkboxes
  - Check/uncheck to grant/revoke screen access
  - "Save Sync" button → POST /api/rbac/role-permissions
  - "Delete" button on custom roles (system roles protected)

SPECIAL BEHAVIOR:
- "Super Admin" role HIDDEN from company Admin view
- System roles (Admin, CMO, PPP, Expert) cannot be deleted
```

#### AdAccountManagement
```
WHAT IT DOES:
- 4 platform cards: Facebook, TikTok, YouTube, Google Ads
- Each shows: connection status, account ID, last tested date
- "Connect" button for disconnected platforms
- Credentials stored in company_ad_accounts table (per-company isolation)
```

#### Guideline (Brand Guideline)
```
WHAT IT DOES:
- Brand Label, Tone (Professional/Casual/Aggressive), Language
- Description text area
- Whitelist terms (must include in ads)
- Blacklist terms (must exclude from ads)
- Typography: heading font/size, body font/size
- Color Palette: 5 color pickers
- "SAVE GUIDELINE" → POST /api/guidelines
- Used by BrandComplianceService to validate ad copy

DATA SOURCE: GET /api/guidelines
```

---

## 3. Screen Sequence & Navigation Flow

### Expert Campaign Creation Flow (Linear)
```
Dashboard
    │
    ▼
┌──────────────┐    ┌──────────────┐    ┌─────────────────┐
│  1. Objective │───▶│  2. Targeting │───▶│  3. Strategy Hub │
│  (Reach/     │    │  (Country,   │    │  Phase 1: Brief  │
│   Click/Sell)│    │   Age, etc.) │    │  Phase 2: L1 Qs  │
└──────────────┘    └──────────────┘    │  Phase 3: L2 Qs  │
                                        └────────┬────────┘
                                                 │
                    ┌──────────────┐    ┌────────▼────────┐
                    │  5. Studio   │◀───│ 4. Creative     │
                    │  (Review &   │    │    Config       │
                    │   Approve)   │    │  (Style, Ratio, │
                    └──────┬───────┘    │   Generate)     │
                           │            └─────────────────┘
                           │
               Assets dispatched to CMO Queue
                           │
                           ▼
                    ═══════════════
                    CMO TAKES OVER
                    ═══════════════
```

### CMO Approval Flow
```
                    ┌──────────────────┐
                    │  CMO: Approvals  │
                    │  Review pending  │
                    │  campaigns +     │
                    │  assets          │
                    └────────┬─────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
                    ▼                 ▼
              ┌──────────┐    ┌───────────┐
              │ APPROVE  │    │  REJECT   │
              │→ PPP Queue│   │→ Back to  │
              │→ Notify   │   │  Expert   │
              │  PPP      │   │→ Notify   │
              └─────┬─────┘   │  Expert   │
                    │         └───────────┘
                    ▼
             ═══════════════
             PPP TAKES OVER
             ═══════════════
```

### PPP Deployment Flow
```
              ┌─────────────────────┐
              │ PPP: Approved Assets│
              │ Select assets for   │
              │ deployment          │
              └─────────┬───────────┘
                        │
                        ▼
              ┌─────────────────────┐
              │ PPP: Platform       │
              │ Selection           │
              │                     │
              │ ☑ Facebook          │
              │ ☑ TikTok           │
              │ ☐ YouTube          │
              │ ☐ Google Ads       │
              │                     │
              │ Configure each...   │
              │ Preview payload...  │
              │ DEPLOY NOW          │
              └─────────┬───────────┘
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐
    │ Facebook │  │ TikTok   │  │ YouTube  │
    │ Graph API│  │ Business │  │ Data API │
    │          │  │ API      │  │          │
    └──────────┘  └──────────┘  └──────────┘
          │             │             │
          └─────────────┼─────────────┘
                        ▼
              ┌─────────────────────┐
              │ Deployment History  │
              │ (Audit trail of all │
              │  API calls & IDs)   │
              └─────────────────────┘
```

### Campaign Builder Wizard (Alternative to Linear Flow)
```
┌────────┐   ┌──────────┐   ┌──────────┐   ┌─────────┐   ┌──────────┐   ┌────────┐
│Step 1  │──▶│ Step 2   │──▶│ Step 3   │──▶│Step 4   │──▶│ Step 5   │──▶│Step 6  │
│Objective│   │Audience  │   │Strategy  │   │Ad Sets  │   │Creative  │   │Review  │
│(13 opts)│   │(Location,│   │(AI or    │   │(Budget, │   │(Studio   │   │(Submit │
│         │   │ Age,     │   │ Skip)    │   │ Bid,    │   │ or Skip) │   │ or     │
│         │   │ Gender)  │   │          │   │Platforms│   │          │   │ Draft) │
└────────┘   └──────────┘   └──────────┘   │Schedule)│   └──────────┘   └────────┘
                                            └─────────┘
    Back ◀────────────────────────────────────────────────────────▶ Next
```

---

## 4. Role-Based Access Matrix

```
┌────────────────────────┬───────┬───────┬─────┬─────┬────────┐
│ Screen                 │ Super │ Admin │ CMO │ PPP │ Expert │
│                        │ Admin │       │     │     │        │
├────────────────────────┼───────┼───────┼─────┼─────┼────────┤
│ Dashboard              │  ✓*   │   ✓   │  ✓  │  ✓  │   ✓    │
├────────────────────────┼───────┼───────┼─────┼─────┼────────┤
│ SUPER ADMIN SCREENS    │       │       │     │     │        │
│ GlobalDashboard        │   ✓   │       │     │     │        │
│ CompanyManagement      │   ✓   │       │     │     │        │
│ SystemConfig           │   ✓   │       │     │     │        │
│ AuditLog               │   ✓   │       │     │     │        │
├────────────────────────┼───────┼───────┼─────┼─────┼────────┤
│ ADMIN SCREENS          │       │       │     │     │        │
│ Config                 │  (✓)  │   ✓   │     │     │        │
│ CompanyProfile         │  (✓)  │   ✓   │     │     │        │
│ UserManagement         │  (✓)  │   ✓   │     │     │        │
│ RoleManagement         │  (✓)  │   ✓   │     │     │        │
│ AdAccountManagement    │  (✓)  │   ✓   │     │     │        │
│ Calendar               │  (✓)  │   ✓   │     │     │        │
│ Guideline              │  (✓)  │   ✓   │     │     │        │
│ Assets                 │  (✓)  │   ✓   │     │     │        │
│ BillingSettings        │  (✓)  │   ✓   │     │     │        │
├────────────────────────┼───────┼───────┼─────┼─────┼────────┤
│ CMO SCREENS            │       │       │     │     │        │
│ BudgetMatrix           │  (✓)  │       │  ✓  │     │        │
│ Approvals              │  (✓)  │       │  ✓  │     │        │
│ Monitoring             │  (✓)  │       │  ✓  │  ✓  │        │
│ AdPerformance          │  (✓)  │       │  ✓  │  ✓  │        │
│ Budget                 │  (✓)  │       │  ✓  │  ✓  │        │
│ Notifications          │  (✓)  │       │  ✓  │     │        │
│ CampaignReports        │  (✓)  │       │  ✓  │     │        │
│ CrossPlatformAnalytics │  (✓)  │       │  ✓  │     │        │
├────────────────────────┼───────┼───────┼─────┼─────┼────────┤
│ PPP SCREENS            │       │       │     │     │        │
│ ApprovedAssets         │  (✓)  │       │     │  ✓  │        │
│ DeploySelection        │  (✓)  │       │     │  ✓  │        │
│ DeploymentHistory      │  (✓)  │       │     │  ✓  │        │
│ ABTestResults          │  (✓)  │       │     │  ✓  │        │
├────────────────────────┼───────┼───────┼─────┼─────┼────────┤
│ EXPERT SCREENS         │       │       │     │     │        │
│ Objective              │  (✓)  │       │     │     │   ✓    │
│ Targeting              │  (✓)  │       │     │     │   ✓    │
│ Research               │  (✓)  │       │     │     │   ✓    │
│ CreativeConfig         │  (✓)  │       │     │     │   ✓    │
│ Studio                 │  (✓)  │       │     │     │   ✓    │
│ AudienceInsights       │  (✓)  │       │     │     │   ✓    │
│ CompetitorResearch     │  (✓)  │       │     │     │   ✓    │
└────────────────────────┴───────┴───────┴─────┴─────┴────────┘

✓  = Direct access
(✓) = Super Admin gets ALL screens when entered into a company
*  = Super Admin sees GlobalDashboard instead of regular Dashboard
```

---

## 5. Complete System Flow

```
╔══════════════════════════════════════════════════════════════════════╗
║                    COMPLETE SYSTEM FLOW                              ║
╚══════════════════════════════════════════════════════════════════════╝

                    ┌─────────────────┐
                    │   USER LOGIN    │
                    │ Username + Pass │
                    └────────┬────────┘
                             │
                    POST /api/auth/login
                             │
                    ┌────────┴────────┐
                    │ JWT Token +     │
                    │ Role + Screens  │
                    │ Company Context │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    Super Admin          Company Users       New Company
    (no company)         (with company)      Onboarding
         │                   │                   │
         ▼                   │              POST /api/
    Global Dashboard         │              onboard/company
    Company Mgmt             │                   │
    Audit Log                │              Creates company
    System Config            │              + Admin user
         │                   │              + 4 default roles
         │  "Enter Company"  │              + Screen permissions
         │  (X-Company-Id)   │                   │
         └──────────┬────────┘                   │
                    │                            │
                    ▼                            ▼
    ┌───────────────────────────────────────────────────────┐
    │              COMPANY CONTEXT ACTIVE                    │
    │  (All data filtered by company_id)                    │
    └───────────────────────┬───────────────────────────────┘
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
    ┌────▼─────┐     ┌─────▼──────┐     ┌─────▼──────┐
    │  ADMIN   │     │   EXPERT   │     │    CMO     │
    │  SETUP   │     │  CREATES   │     │  REVIEWS   │
    └────┬─────┘     └─────┬──────┘     └─────┬──────┘
         │                 │                   │
    ● Create Users         │                   │
    ● Assign Roles         │                   │
    ● Set Brand            │                   │
      Guidelines           │                   │
    ● Connect Ad           │                   │
      Accounts             │                   │
    ● Configure            │                   │
      Platforms            │                   │
         │                 │                   │
         │          ┌──────▼──────┐            │
         │          │ 1. OBJECTIVE │            │
         │          │ Reach/Click/ │            │
         │          │ Sell         │            │
         │          └──────┬──────┘            │
         │                 │                   │
         │          ┌──────▼──────┐            │
         │          │ 2. TARGETING │            │
         │          │ Demographics │            │
         │          └──────┬──────┘            │
         │                 │                   │
         │          ┌──────▼──────┐            │
         │          │ 3. STRATEGY  │            │
         │          │ Gemini AI    │            │
         │          │ 3-phase      │            │
         │          │ research     │            │
         │          └──────┬──────┘            │
         │                 │                   │
         │          ┌──────▼──────┐            │
         │          │ 4. CREATIVE  │            │
         │          │ Config +     │            │
         │          │ Generate     │            │
         │          └──────┬──────┘            │
         │                 │                   │
         │          ┌──────▼──────┐            │
         │          │ 5. STUDIO    │            │
         │          │ Review +     │            │
         │          │ Approve      │            │
         │          └──────┬──────┘            │
         │                 │                   │
         │          Dispatch to CMO Queue      │
         │                 │                   │
         │                 └──────────────────▶│
         │                                     │
         │                              ┌──────▼──────┐
         │                              │ APPROVALS   │
         │                              │ Review each │
         │                              │ campaign +  │
         │                              │ asset       │
         │                              └──────┬──────┘
         │                                     │
         │                          ┌──────────┴──────────┐
         │                          │                     │
         │                    ┌─────▼─────┐        ┌──────▼─────┐
         │                    │  APPROVE  │        │   REJECT   │
         │                    │ → PPP Queue│       │ → Expert   │
         │                    └─────┬─────┘        │   notified │
         │                          │              └────────────┘
         │                          │
         │                   ┌──────▼──────┐
         │                   │ PPP TAKES   │
         │                   │ OVER        │
         │                   └──────┬──────┘
         │                          │
         │                   ┌──────▼──────┐
         │                   │ APPROVED    │
         │                   │ ASSETS      │
         │                   │ Select for  │
         │                   │ deployment  │
         │                   └──────┬──────┘
         │                          │
         │                   ┌──────▼──────┐
         │                   │ PLATFORM    │
         │                   │ SELECTION   │
         │                   │             │
         │                   │ ☑ Facebook  │
         │                   │ ☑ TikTok   │
         │                   │ ☑ YouTube  │
         │                   │ ☑ Google   │
         │                   │             │
         │                   │ Configure   │
         │                   │ each...     │
         │                   └──────┬──────┘
         │                          │
         │                   DEPLOY NOW
         │                          │
         │              ┌───────────┼───────────┐
         │              ▼           ▼           ▼
         │         ┌─────────┐ ┌────────┐ ┌─────────┐
         │         │Facebook │ │TikTok  │ │YouTube  │
         │         │Graph API│ │Biz API │ │Data API │
         │         └────┬────┘ └───┬────┘ └────┬────┘
         │              │          │           │
         │              └──────────┼───────────┘
         │                         │
         │                  ┌──────▼──────┐
         │                  │ DEPLOYMENT  │
         │                  │ LOGS SAVED  │
         │                  │ (database)  │
         │                  └──────┬──────┘
         │                         │
         │                  ┌──────▼──────┐
         │                  │ METRICS     │
         │                  │ FETCHED     │
         │                  │ (every 4hr) │
         │                  └──────┬──────┘
         │                         │
         │    ┌────────────────────┼────────────────────┐
         │    │                    │                    │
         │    ▼                    ▼                    ▼
         │  Dashboard          Ad Performance     Cross-Platform
         │  (KPIs)             (per campaign)     Analytics
         │                                        (per platform)
         │
    ALL ROLES can view Dashboard + their permitted analytics screens
```

---

## 6. Data Flow Diagram

```
╔══════════════════════════════════════════════════════════════════════╗
║                         DATA FLOW                                    ║
╚══════════════════════════════════════════════════════════════════════╝

FRONTEND STATE                    BACKEND API                  DATABASE
─────────────                     ───────────                  ────────

state.marketingData
  .objective ──────────────────┐
  .targeting[] ────────────────┤
  .goal (brief) ───────────────┤  POST /api/campaigns ──────▶ campaigns table
  .stylePreset ────────────────┤                               (28 tables)
  .aspectRatio ────────────────┘

  .level1Questions ◀───────────── POST /api/gemini/questions    Gemini AI
  .level1Answers ──────────────▶                                 API
  .level2Questions ◀──────────── POST /api/gemini/follow-up
  .level2Answers ──────────────▶

  .brandGuidelines ◀──────────── GET /api/guidelines ─────────▶ brand_guidelines
                   ──────────────▶ POST /api/guidelines

  .cmoQueue[] ◀────────────────── GET /api/cmo/queue ──────────▶ cmo_queue
              ────────────────────▶ POST /api/cmo/queue

  .pppQueue[] ◀────────────────── GET /api/ppp/queue ──────────▶ ppp_queue
              ────────────────────▶ POST /api/ppp/queue

  .selectedAssets[] ─────────────▶ POST /api/deploy/unified ──▶ deployment_logs
                                   POST /api/deploy/facebook     + External APIs
                                   POST /api/deploy/tiktok

state.user ◀──────────────────── POST /api/auth/login ────────▶ users + roles
state.token (JWT)                                                + role_screens
state.company ◀──────────────── (included in login response)──▶ companies
state.notifications ◀───────── GET /api/notifications ────────▶ notifications

                                  ┌─────────────────────────┐
                                  │  BACKGROUND SERVICES     │
                                  │                          │
                                  │  MetricsFetchService     │
                                  │  (every 4 hours)         │
                                  │  Fetches from FB/TT/YT   │──▶ ad_metrics
                                  │  APIs and stores metrics │
                                  └─────────────────────────┘

                                  ┌─────────────────────────┐
                                  │  APPROVAL WORKFLOW       │
                                  │                          │
                                  │  Expert creates ────────▶│ campaigns (draft)
                                  │  Expert submits ────────▶│ campaigns (pending)
                                  │  CMO approves ──────────▶│ campaigns (approved)
                                  │  PPP deploys ───────────▶│ campaigns (active)
                                  │  Each step creates ─────▶│ notifications
                                  │  Each step logs ────────▶│ activity_logs
                                  └─────────────────────────┘
```

---

*Generated for AI Marketing Platform v4.0 Multi-Tenant*
*33 screens | 5 roles | 28 database tables | 4 ad platforms*
