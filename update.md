# Workflow Implementation Tasks
_Based on 3-Stage Marketing Expert → PPP → CMO Workflow Spec_

---

## Stage 1 — Marketing Expert: Multi-Platform Asset Strategy

### Backend
- [ ] **1.1** Add `CampaignPlatformSpec` table/model with fields:
  - `CampaignId`, `Platform`, `AspectRatios[]`, `ImageCount`, `VideoCount`, `VideoDurations[]`
- [ ] **1.2** Add API endpoint `POST /api/campaigns/{id}/platform-specs` — save per-platform asset specs
- [ ] **1.3** Add API endpoint `GET /api/campaigns/{id}/platform-specs` — retrieve per-platform specs
- [ ] **1.4** Add API endpoint `POST /api/campaigns/{id}/generate-assets` — "Generation Logic" that produces platform-specific `AdCreative` records with metadata:
  - `PrimaryText`, `TargetPlatform`, `Ratio`, `StorageUrl`, `DurationSeconds`
- [ ] **1.5** Update `AdCreative` model to add `TargetPlatform` field (currently missing explicit platform tag on creative level)

### Frontend
- [ ] **1.6** Add per-platform configuration panel in the Expert campaign creation screen:
  - Platform selector (Facebook, TikTok, YouTube, Google)
  - Per-platform: Aspect Ratio picker, Image Count input, Video Count input, Video Duration input
- [ ] **1.7** Add "Generate Assets" trigger button that calls `/api/campaigns/{id}/generate-assets`
- [ ] **1.8** Add Expert asset review screen showing generated creatives grouped by platform
- [ ] **1.9** Add "Dispatch to PPP Queue" action from Expert review screen

---

## Stage 2 — PPP: Granular Budgeting and Financial Allocation

### Backend
- [ ] **2.1** Add `AdCreativeBudgetAllocation` table/model with fields:
  - `AdCreativeId`, `Platform`, `DailyBudget`, `LifetimeBudget`, `CostPerResult`, `TargetCPA`, `BidAmount`
- [ ] **2.2** Add API endpoint `POST /api/ppp/budgets` — assign budget to individual creative
- [ ] **2.3** Add API endpoint `PUT /api/ppp/budgets/{creativeId}` — update per-ad budget
- [ ] **2.4** Add API endpoint `GET /api/ppp/budgets` — list all ad-level budget allocations
- [ ] **2.5** Update `PppQueueItem` status workflow to multi-step:
  - `received` → `budget_configured` → `ready_for_approval` → `deployed`
- [ ] **2.6** Add API endpoint `POST /api/ppp/queue/{id}/submit-for-approval` — PPP promotes to CMO
- [ ] **2.7** Add `CostPerResult` and `TargetCPA` fields to `AdCreative` model

### Frontend
- [ ] **2.8** Add PPP queue dashboard showing incoming assets from Expert
- [ ] **2.9** Add "Ad-wise Budget Entry" form per queue item:
  - Per-creative: Daily Budget, Lifetime Budget, Cost-per-Result, Bid Strategy
- [ ] **2.10** Add asset lifecycle status indicator (received → budget configured → ready for approval)
- [ ] **2.11** Add "Submit for CMO Approval" button that triggers status → `ready_for_approval`

---

## Stage 3 — CMO: Strategic Oversight and API Deployment

### Backend
- [ ] **3.1** Add API endpoint `GET /api/cmo/dashboard` — consolidated view returning:
  - CMO queue items (Expert creatives pending review)
  - PPP queue items with their budget allocations
  - Deployment readiness status per campaign
  - Budget matrix (allocated vs. available per platform)
- [ ] **3.2** Add `EligiblePlatforms` field to Campaign model — CMO selects which platforms go live
- [ ] **3.3** Add API endpoint `GET /api/cmo/budget-matrix` — budget distribution + performance matrices:
  - Platform splits, Reach, Clicks, Sales projections per platform
- [ ] **3.4** Add API endpoint `POST /api/cmo/approve-and-deploy` — CMO final action:
  - Validates budget allocation completeness
  - Marks PPP items as approved
  - Logs CMO approval decision (audit trail)
  - Triggers automated API calls to Facebook / TikTok / YouTube / Google
- [ ] **3.5** Update `POST /api/campaigns/{id}/approve` to also trigger deployment orchestration
- [ ] **3.6** Add CMO approval audit log: `CmoApprovalLog` table with `CampaignId`, `ApprovedBy`, `ApprovedAt`, `PlatformsDeployed[]`, `TotalBudgetApproved`

### Frontend
- [ ] **3.7** Build enhanced CMO Budget & Matrix Page:
  - "Eligible Platforms" section showing selected channels with budget distribution
  - Performance matrix table: Reach / Clicks / Sales per platform
- [ ] **3.8** Build CMO consolidated review view (single page):
  - Expert creatives panel (from CMO queue)
  - PPP budget summary panel (per-ad budget allocations)
  - Deployment readiness checklist
- [ ] **3.9** Add "Approve & Deploy" button with confirmation dialog showing:
  - Total budget being approved
  - Platforms being activated
  - Number of creatives going live
- [ ] **3.10** Add real-time deployment status feed after CMO approves

---

## Database Migrations

- [ ] **4.1** Migration: Create `campaign_platform_specs` table
- [ ] **4.2** Migration: Create `ad_creative_budget_allocations` table
- [ ] **4.3** Migration: Add `target_platform` column to `ad_creatives`
- [ ] **4.4** Migration: Add `cost_per_result`, `target_cpa` columns to `ad_creatives`
- [ ] **4.5** Migration: Add `eligible_platforms` column to `campaigns`
- [ ] **4.6** Migration: Create `cmo_approval_logs` table
- [ ] **4.7** Migration: Update `ppp_queue` status enum to include `budget_configured`, `ready_for_approval`

---

## Priority Order

| Priority | Task IDs | Reason |
|---|---|---|
| 🔴 Critical | 2.1–2.4, 4.2 | Per-creative budget allocation — core PPP feature |
| 🔴 Critical | 3.1, 3.4 | CMO consolidated dashboard + Approve & Deploy |
| 🟠 High | 1.1–1.5, 4.1 | Per-platform asset specs — foundational for Stage 1 |
| 🟠 High | 2.5–2.6, 4.7 | PPP status workflow upgrade |
| 🟡 Medium | 1.6–1.9 | Expert frontend UI |
| 🟡 Medium | 2.8–2.11 | PPP frontend UI |
| 🟡 Medium | 3.7–3.10 | CMO frontend UI |
| 🟢 Low | 3.2, 3.5, 3.6, 4.3–4.6 | Supporting fields and audit logging |
