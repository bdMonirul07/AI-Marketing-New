# Creative Process with Permission Flow
> AI-Marketing Platform — Creative Asset Lifecycle
> Roles: CMO (Business Admin) · Marketing Expert · PPP Specialist

---

## 1. System Flow

```
+=======================================================================+
|               CREATIVE ASSET SYSTEM FLOW (END-TO-END)                 |
+=======================================================================+

  ┌─────────────────────────────────────────────────────────────────┐
  │  PHASE 0 — PLATFORM & BUDGET SETUP (CMO / Business Admin)       │
  └─────────────────────────────────────────────────────────────────┘
         │
         │  CMO opens Budget & Matrix page
         │  → Defines allowed ad platforms per campaign
         │    (e.g., Facebook ✓  TikTok ✓  YouTube ✗  Instagram ✓)
         │  → Sets total campaign budget & platform-level allocations
         │
         ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  PHASE 1 — CREATIVE HUB SETUP (Marketing Expert)                │
  └─────────────────────────────────────────────────────────────────┘
         │
         │  Expert opens Creative Hub
         │  → Selects platforms (from CMO-approved list)
         │  → Per platform, defines:
         │       • Aspect Ratio   (1:1 / 16:9 / 9:16 / 4:5)
         │       • Number of Images
         │       • Number of Videos
         │       • Video Duration (seconds)
         │
         ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  PHASE 2 — ASSET GENERATION (System / AI Engine)                │
  └─────────────────────────────────────────────────────────────────┘
         │
         │  System auto-generates assets based on inputs:
         │  For EACH (platform × aspect_ratio × quantity):
         │       • Image → download/generate image at specified ratio
         │       • Video → generate/fetch video clip at ratio + duration
         │
         │  Each asset record contains:
         │  ┌──────────────────────────────────────────────┐
         │  │  content_text   — copy / caption              │
         │  │  platform       — facebook / tiktok / etc.    │
         │  │  aspect_ratio   — 1:1 / 16:9 / 9:16 / 4:5    │
         │  │  asset_url      — hosted file URL             │
         │  │  duration_sec   — (video only, else null)     │
         │  │  status         — draft                       │
         │  └──────────────────────────────────────────────┘
         │
         ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  PHASE 3 — EXPERT REVIEW & SUBMIT TO PPP                        │
  └─────────────────────────────────────────────────────────────────┘
         │
         │  Expert reviews generated assets in Creative Hub
         │  → Accepts / discards individual assets
         │  → Adds/edits copy text per asset
         │  → Submits approved selection → PPP Queue
         │
         ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  PHASE 4 — PPP REVIEW, BUDGET ENTRY & APPROVAL                  │
  └─────────────────────────────────────────────────────────────────┘
         │
         │  PPP Specialist opens PPP Queue
         │  → Reviews each asset
         │  → Enters ad-wise budget (budget entry per individual ad)
         │  → Approves or rejects each asset
         │
         │  On PPP Approval → assets move to CMO Queue
         │
         ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  PHASE 5 — CMO FINAL APPROVAL                                   │
  └─────────────────────────────────────────────────────────────────┘
         │
         │  CMO opens CMO Approval Queue
         │  → Reviews assets with PPP-defined budgets
         │  → Approves or rejects each ad
         │
         │  On CMO Approval → ads are READY FOR DEPLOYMENT
         │
         ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  PHASE 6 — DEPLOYMENT (PPP Specialist)                          │
  └─────────────────────────────────────────────────────────────────┘
         │
         │  PPP Specialist deploys CMO-approved ads
         │  → Selects platform (Facebook / TikTok / etc.)
         │  → Triggers deployment API
         │  → System records deployment log
         │
         ▼
                        [ LIVE AD CAMPAIGNS ]
```

---

## 2. Permission Flow

```
+=======================================================================+
|                        PERMISSION MATRIX                               |
+=======================================================================+

  ACTION / SCREEN                     CMO     EXPERT    PPP     ADMIN
  ─────────────────────────────────────────────────────────────────────
  Budget & Matrix Page                 ✅       ❌        ❌       ✅
  ├─ Define allowed platforms          ✅       ❌        ❌       ❌
  ├─ Set total campaign budget         ✅       ❌        ❌       ❌
  └─ Set platform budget allocations   ✅       ❌        ❌       ❌

  Creative Hub Page                    ❌       ✅        ❌       ❌
  ├─ View CMO-approved platforms       ❌       ✅(read)  ❌       ❌
  ├─ Select platforms for campaign     ❌       ✅        ❌       ❌
  ├─ Define aspect ratios              ❌       ✅        ❌       ❌
  ├─ Set image/video counts            ❌       ✅        ❌       ❌
  ├─ Set video durations               ❌       ✅        ❌       ❌
  ├─ Trigger asset generation          ❌       ✅        ❌       ❌
  ├─ Edit asset copy/text              ❌       ✅        ❌       ❌
  └─ Submit assets to PPP Queue        ❌       ✅        ❌       ❌

  PPP Queue Page                       ❌       ❌        ✅       ❌
  ├─ View submitted assets             ❌       ❌        ✅       ❌
  ├─ Review asset details              ❌       ❌        ✅       ❌
  ├─ Enter ad-wise budget              ❌       ❌        ✅       ❌
  ├─ Approve asset → CMO Queue         ❌       ❌        ✅       ❌
  └─ Reject asset → back to Expert     ❌       ❌        ✅       ❌

  CMO Approval Queue Page              ✅       ❌        ❌       ❌
  ├─ View PPP-approved assets          ✅       ❌        ❌       ❌
  ├─ View per-ad budgets (set by PPP)  ✅       ❌        ❌       ❌
  ├─ Final Approve → Deployment Ready  ✅       ❌        ❌       ❌
  └─ Final Reject → PPP notified       ✅       ❌        ❌       ❌

  Deployment Page                      ❌       ❌        ✅       ❌
  ├─ View CMO-approved ads             ❌       ❌        ✅       ❌
  ├─ Select platform & deploy          ❌       ❌        ✅       ❌
  └─ View deployment logs              ❌       ❌        ✅       ✅

  ─────────────────────────────────────────────────────────────────────
  Legend:  ✅ = Permitted   ❌ = No Access   ✅(read) = Read-only
```

### Permission Guards (Backend Rules)

```
┌─────────────────────────────────────────────────────────────────────┐
│  RULE 1 — Platform Selection Guard                                   │
│  Expert can only pick platforms the CMO enabled on Budget & Matrix   │
│  backend validates: selected_platform ∈ campaign.allowed_platforms   │
├─────────────────────────────────────────────────────────────────────┤
│  RULE 2 — Budget Entry Guard                                         │
│  Only PPP can write budget fields on assets in the PPP Queue         │
│  budget fields are write-locked for all other roles                  │
├─────────────────────────────────────────────────────────────────────┤
│  RULE 3 — CMO Queue Gate                                             │
│  An asset can only enter the CMO Queue after PPP sets budget + approves│
│  backend rejects CMO Queue insert if ppp_budget IS NULL              │
├─────────────────────────────────────────────────────────────────────┤
│  RULE 4 — Deployment Gate                                            │
│  An ad can only be deployed if cmo_status = 'approved'               │
│  backend rejects deploy calls for any other status                   │
├─────────────────────────────────────────────────────────────────────┤
│  RULE 5 — Company Isolation                                          │
│  All actions scoped to company_id from JWT token                     │
│  cross-company data access returns 403                               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Job Flow (Per Role)

```
+=======================================================================+
|                   JOB FLOW — CMO (Business Admin)                     |
+=======================================================================+

  START OF CAMPAIGN
       │
       ▼
  [Budget & Matrix Page]
  ┌─────────────────────────────────────────────────┐
  │  JOB 1 — Enable Platforms                        │
  │  ► Toggle ON/OFF: Facebook / TikTok /            │
  │    Instagram / YouTube                           │
  │                                                  │
  │  JOB 2 — Allocate Budget                         │
  │  ► Set total campaign budget                     │
  │  ► Optionally cap per-platform spend             │
  │                                                  │
  │  JOB 3 — Save & Notify Expert                    │
  │  ► POST /api/campaigns/{id}/platform-config      │
  │  ► System notifies Marketing Expert              │
  └─────────────────────────────────────────────────┘
       │
       │  (waits for PPP-approved assets)
       │
       ▼
  [CMO Approval Queue]
  ┌─────────────────────────────────────────────────┐
  │  JOB 4 — Final Review                            │
  │  ► View each asset: creative + copy + platform   │
  │  ► View PPP-assigned budget per ad               │
  │                                                  │
  │  JOB 5 — Approve or Reject                       │
  │  ► Approve → ad status: 'cmo_approved'           │
  │  ► Reject  → ad returns to PPP with notes        │
  └─────────────────────────────────────────────────┘


+=======================================================================+
|                JOB FLOW — MARKETING EXPERT                            |
+=======================================================================+

  (notified after CMO sets up platforms)
       │
       ▼
  [Creative Hub Page]
  ┌─────────────────────────────────────────────────┐
  │  JOB 1 — Platform & Format Setup                 │
  │  ► Select platforms (CMO-approved only)          │
  │  ► Per platform:                                 │
  │      • Choose aspect ratio (1:1 / 16:9 / 9:16)  │
  │      • Set number of images                      │
  │      • Set number of videos                      │
  │      • Set video duration (sec)                  │
  │                                                  │
  │  JOB 2 — Asset Generation                        │
  │  ► Click "Generate Assets"                       │
  │  ► System creates image + video assets           │
  │    for each platform × ratio × quantity          │
  │                                                  │
  │  JOB 3 — Asset Review & Edit                     │
  │  ► Preview each generated asset                  │
  │  ► Edit copy/caption text                        │
  │  ► Discard unwanted variations                   │
  │                                                  │
  │  JOB 4 — Submit to PPP                           │
  │  ► Select final assets                           │
  │  ► POST /api/ppp/queue                           │
  │  ► PPP Specialist is notified                    │
  └─────────────────────────────────────────────────┘


+=======================================================================+
|                  JOB FLOW — PPP SPECIALIST                            |
+=======================================================================+

  (notified when Expert submits assets)
       │
       ▼
  [PPP Queue Page]
  ┌─────────────────────────────────────────────────┐
  │  JOB 1 — Asset Review                            │
  │  ► View each submitted asset                     │
  │  ► Check: platform / aspect ratio / copy / URL   │
  │  ► Preview image or video                        │
  │                                                  │
  │  JOB 2 — Budget Entry (per ad)                   │
  │  ► Enter budget amount for each individual ad    │
  │  ► Required before approval is possible          │
  │                                                  │
  │  JOB 3 — Approve or Reject                       │
  │  ► Approve → asset moves to CMO Queue            │
  │  ► Reject  → asset returned to Expert with notes │
  └─────────────────────────────────────────────────┘
       │
       │  (waits for CMO to approve)
       │
       ▼
  [Deployment Page]
  ┌─────────────────────────────────────────────────┐
  │  JOB 4 — Deploy CMO-Approved Ads                 │
  │  ► View CMO-approved ads list                    │
  │  ► Select ad(s) for deployment                   │
  │  ► Choose target platform                        │
  │  ► Trigger deployment API                        │
  │  ► Monitor deployment log                        │
  └─────────────────────────────────────────────────┘
```

---

## 4. Status State Machine

```
  ASSET STATUS TRANSITIONS
  ─────────────────────────────────────────────────────────────

  [draft]
     │
     │  Expert submits to PPP
     ▼
  [pending_ppp]
     │                    │
     │ PPP approves        │ PPP rejects
     ▼                    ▼
  [ppp_approved]       [rejected_by_ppp]
     │                    │
     │                    └──► Expert revises → [draft]
     │ CMO approves / rejects
     ├──────────────────────────────────────┐
     ▼                                      ▼
  [cmo_approved]                        [rejected_by_cmo]
     │                                      │
     │                                      └──► PPP notified → [pending_ppp]
     │ PPP deploys
     ▼
  [deploying]
     │
     ▼
  [active]  ──► [paused] ──► [active]
     │
     ▼
  [completed] / [archived]
```

---

## 5. Data Fields — Asset Record

```
┌══════════════════════════════════════════════════════════════════════┐
│                     ASSET / AD RECORD FIELDS                         │
╠══════════════════════════════════════════════════════════════════════╣
│  CREATED BY EXPERT (at generation)                                   │
│  ─────────────────────────────────────────────────────              │
│  content_text       TEXT      Ad copy / caption                      │
│  platform           VARCHAR   facebook / tiktok / instagram /youtube │
│  aspect_ratio       VARCHAR   1:1 / 16:9 / 9:16 / 4:5               │
│  asset_url          VARCHAR   Hosted URL of image or video           │
│  asset_type         VARCHAR   image / video                          │
│  duration_sec       INT       Video duration in seconds (null=image) │
│  campaign_id        INT       FK -> campaigns                        │
│  submitted_by       INT       FK -> users (Expert)                   │
│  status             VARCHAR   draft → pending_ppp                    │
╠══════════════════════════════════════════════════════════════════════╣
│  ADDED BY PPP (at budget entry & approval)                           │
│  ─────────────────────────────────────────────────────              │
│  ppp_budget         DECIMAL   Ad-level budget set by PPP             │
│  ppp_reviewed_by    INT       FK -> users (PPP Specialist)           │
│  ppp_reviewed_at    TIMESTAMP                                        │
│  ppp_notes          TEXT      Optional rejection notes               │
│  status             VARCHAR   → ppp_approved / rejected_by_ppp       │
╠══════════════════════════════════════════════════════════════════════╣
│  ADDED BY CMO (at final approval)                                    │
│  ─────────────────────────────────────────────────────              │
│  cmo_reviewed_by    INT       FK -> users (CMO)                      │
│  cmo_reviewed_at    TIMESTAMP                                        │
│  cmo_notes          TEXT      Optional rejection notes               │
│  status             VARCHAR   → cmo_approved / rejected_by_cmo       │
╠══════════════════════════════════════════════════════════════════════╣
│  ADDED BY SYSTEM (at deployment)                                     │
│  ─────────────────────────────────────────────────────              │
│  deployed_by        INT       FK -> users (PPP Specialist)           │
│  deployed_at        TIMESTAMP                                        │
│  platform_ad_id     VARCHAR   ID returned from platform API          │
│  status             VARCHAR   → deploying → active                   │
└══════════════════════════════════════════════════════════════════════┘
```

---

## 6. API Endpoint Map (New/Updated)

```
/api
  │
  ├── /campaigns/{id}/platform-config
  │     ├── GET   → CMO gets current platform setup
  │     └── POST  → CMO saves allowed platforms + budget allocations
  │
  ├── /creative-hub
  │     ├── GET  /platforms/{campaignId}  → Expert gets CMO-allowed platforms
  │     ├── POST /generate               → Trigger asset generation
  │     │       Body: { campaignId, platform, aspectRatio,
  │     │               imageCount, videoCount, videoDuration }
  │     └── PUT  /asset/{id}             → Expert edits copy/text
  │
  ├── /ppp/queue
  │     ├── GET  /                → PPP lists pending assets
  │     ├── PUT  /{id}/budget     → PPP sets ad-wise budget
  │     ├── POST /{id}/approve    → PPP approves → moves to CMO Queue
  │     └── POST /{id}/reject     → PPP rejects → returns to Expert
  │
  ├── /cmo/queue
  │     ├── GET  /                → CMO lists PPP-approved assets
  │     ├── POST /{id}/approve    → CMO final approval
  │     └── POST /{id}/reject     → CMO rejects → notifies PPP
  │
  └── /deploy
        ├── GET  /ready           → PPP lists CMO-approved ads
        └── POST /                → PPP deploys ad to platform
```

---

## 7. Notification Triggers

```
  EVENT                          NOTIFIED ROLES
  ──────────────────────────────────────────────────────────
  CMO saves platform config   →  Marketing Expert
  Expert submits to PPP       →  PPP Specialist
  PPP rejects asset           →  Marketing Expert
  PPP approves asset          →  CMO (Business Admin)
  CMO rejects asset           →  PPP Specialist
  CMO approves asset          →  PPP Specialist (deploy-ready)
  PPP deploys successfully    →  CMO + Admin
  Deployment fails            →  PPP Specialist + Admin
```

---

*Document: creative_process_with_permission.md*
*Project: AI-Marketing-New*
*Covers: System Flow · Permission Flow · Job Flow · State Machine · Data Fields · API Map · Notifications*
