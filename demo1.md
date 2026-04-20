# AI-Marketing Platform — Project Overview & Design Document

> **Prepared for:** Project Review
> **Project Name:** AI-Marketing New
> **Purpose:** Complete reference for all flows, roles, design, and architecture

---

## Table of Contents

1. [Project Summary](#1-project-summary)
2. [Technology Stack](#2-technology-stack)
3. [System Architecture](#3-system-architecture)
4. [User Roles & Responsibilities](#4-user-roles--responsibilities)
5. [Platform Screens by Role](#5-platform-screens-by-role)
6. [Complete System Flow — Campaign Lifecycle](#6-complete-system-flow--campaign-lifecycle)
7. [Creative Asset Flow — Detailed](#7-creative-asset-flow--detailed)
8. [Approval & Permission Flow](#8-approval--permission-flow)
9. [Authentication & Security Flow](#9-authentication--security-flow)
10. [Database Design Overview](#10-database-design-overview)
11. [API Design Overview](#11-api-design-overview)
12. [Notification System](#12-notification-system)
13. [Deployment Architecture](#13-deployment-architecture)
14. [Key Business Rules](#14-key-business-rules)

---

## 1. Project Summary

**AI-Marketing New** is a multi-tenant, enterprise SaaS platform that orchestrates AI-driven marketing campaigns across major ad platforms — Facebook, TikTok, Instagram, and YouTube.

The platform guides a marketing team through the complete campaign lifecycle:
from strategy and creative asset generation, through internal review and budget approval,
to live ad deployment and performance monitoring — all in one integrated system.

### Core Value Propositions

| # | Value | Description |
|---|-------|-------------|
| 1 | **AI-Assisted Strategy** | Google Gemini 2.0 generates campaign strategies through a structured 3-phase Q&A |
| 2 | **Automated Asset Generation** | System generates images and videos per platform, aspect ratio, and quantity |
| 3 | **Role-Based Workflows** | Each team member sees only their relevant screens and actions |
| 4 | **Multi-Platform Deployment** | Single interface to deploy ads to Facebook, TikTok, Instagram, YouTube |
| 5 | **Multi-Tenant Architecture** | Each company's data is fully isolated; Super Admin oversees all |
| 6 | **Full Audit Trail** | Every action is logged — approvals, deployments, budget changes |

---

## 2. Technology Stack

```
┌════════════════════════════════════════════════════════════════════┐
│                      TECHNOLOGY STACK                               │
╠════════════════════════════════════════════════════════════════════╣
│                                                                    │
│  FRONTEND                                                          │
│  ─────────────────────────────────────────────────────────────    │
│  • Vanilla JavaScript SPA (Single Page Application)               │
│  • Vite 7.2.4           — build tool & dev server                  │
│  • Tailwind CSS 4.x     — utility-first styling                    │
│  • ~3,200+ lines        — main.js handles all 19+ screens          │
│                                                                    │
│  BACKEND                                                           │
│  ─────────────────────────────────────────────────────────────    │
│  • ASP.NET Core 9.0     — REST Web API                            │
│  • Entity Framework Core 9.0 — ORM for PostgreSQL                 │
│  • BCrypt.NET           — password hashing                        │
│  • JWT Bearer Tokens    — HS256, 8-hour expiry                     │
│                                                                    │
│  DATABASE                                                          │
│  ─────────────────────────────────────────────────────────────    │
│  • PostgreSQL 16        — primary database                        │
│  • 28 tables (7 existing + 21 new)                                │
│  • EF Core auto-migration on startup                              │
│                                                                    │
│  AI ENGINE                                                         │
│  ─────────────────────────────────────────────────────────────    │
│  • Google Gemini 2.0 Flash API — strategy question generation      │
│                                                                    │
│  AD PLATFORMS                                                      │
│  ─────────────────────────────────────────────────────────────    │
│  • Facebook Graph API v19.0   — campaigns, ads, metrics           │
│  • TikTok Business API v1.3   — ad groups, creatives              │
│  • Instagram (via Facebook)   — integrated deployment             │
│  • YouTube Ads                — planned                            │
│  • Google Ads                 — planned                            │
│                                                                    │
│  INFRASTRUCTURE                                                    │
│  ─────────────────────────────────────────────────────────────    │
│  • Docker Compose — 3 containers: db / backend / frontend         │
│  • Nginx — serves frontend SPA on port 80                         │
│                                                                    │
└════════════════════════════════════════════════════════════════════┘
```

---

## 3. System Architecture

```
┌═══════════════════════════════════════════════════════════════════════┐
│                        DOCKER COMPOSE STACK                           │
│                                                                       │
│   ┌─────────────────┐    ┌──────────────────────┐   ┌─────────────┐  │
│   │    FRONTEND      │    │       BACKEND         │   │  DATABASE   │  │
│   │  ─────────────  │    │  ──────────────────   │   │  ─────────  │  │
│   │  Nginx  : 80    │───▶│  ASP.NET Core : 5243  │──▶│ PostgreSQL  │  │
│   │  Vite SPA       │    │  REST API             │   │  Port: 5432 │  │
│   │  main.js        │◀───│  Program.cs           │◀──│  28 Tables  │  │
│   │  19+ screens    │    │  EF Core ORM          │   │  pgdata vol │  │
│   └─────────────────┘    └──────────┬────────────┘   └─────────────┘  │
│                                     │                                  │
│              ┌──────────────────────┼──────────────────┐              │
│              ▼                      ▼                   ▼              │
│     ┌──────────────┐     ┌──────────────────┐  ┌─────────────────┐    │
│     │ Google Gemini│     │  Facebook Graph  │  │ TikTok Business │    │
│     │ 2.0 Flash    │     │  API v19.0       │  │ API v1.3        │    │
│     │ (AI Strategy)│     │  (Ad Deployment) │  │ (Ad Deployment) │    │
│     └──────────────┘     └──────────────────┘  └─────────────────┘    │
│                                                                       │
│   Volumes:  pgdata (DB)  |  /Assets (working)  |  /Assets Library    │
└═══════════════════════════════════════════════════════════════════════┘
```

---

## 4. User Roles & Responsibilities

The platform has **5 roles**, each with a distinct job in the campaign workflow:

```
┌══════════════════════════════════════════════════════════════════════┐
│                          USER ROLES                                   │
╠══════════╦═══════════════════════════════════════════════════════════╣
│  ROLE     │  RESPONSIBILITIES                                         │
╠══════════╬═══════════════════════════════════════════════════════════╣
│          │  • Manages all companies on the platform                  │
│  SUPER   │  • Creates / suspends / manages company accounts          │
│  ADMIN   │  • Accesses all data across all tenants                   │
│          │  • Sets system-wide configuration                         │
│          │  • Not tied to any company (company_id = NULL)            │
╠══════════╬═══════════════════════════════════════════════════════════╣
│          │  • Manages platform API credentials (Facebook, TikTok)    │
│  ADMIN   │  • Manages users and their roles within the company       │
│  (Admin) │  • Configures brand guidelines                            │
│          │  • Views all screens within their company                 │
╠══════════╬═══════════════════════════════════════════════════════════╣
│          │  • Defines which platforms the campaign can run on        │
│  CMO     │  • Sets overall campaign budget & per-platform allocation  │
│ (Business│  • Reviews PPP-approved ads in CMO Approval Queue         │
│  Admin)  │  • Gives final approval or rejection before deployment    │
│          │  • Monitors AI performance dashboard                      │
╠══════════╬═══════════════════════════════════════════════════════════╣
│ MARKETING│  • Builds campaign strategy with AI assistance (Gemini)   │
│ EXPERT   │  • Defines target audience and campaign objective         │
│          │  • Configures Creative Hub (platforms, ratios, counts)    │
│          │  • Reviews and submits generated assets to PPP            │
╠══════════╬═══════════════════════════════════════════════════════════╣
│   PPP    │  • Reviews assets submitted by Expert                     │
│ (PPC     │  • Sets ad-wise budget for each individual ad             │
│ Speciali-│  • Approves assets → forwards to CMO                     │
│  st)     │  • Deploys CMO-approved ads to Facebook / TikTok          │
│          │  • Monitors deployment logs and performance               │
└══════════╩═══════════════════════════════════════════════════════════┘
```

---

## 5. Platform Screens by Role

```
┌══════════════════════════════════════════════════════════════════════┐
│  SCREEN NAME                  │ SUPER │ ADMIN │  CMO  │EXPERT │  PPP │
╠═══════════════════════════════╪═══════╪═══════╪═══════╪═══════╪══════╣
│  Login                        │   ✅  │   ✅  │   ✅  │   ✅  │  ✅  │
│  Dashboard (Global)           │   ✅  │   ❌  │   ❌  │   ❌  │  ❌  │
│  Company Management           │   ✅  │   ❌  │   ❌  │   ❌  │  ❌  │
│  System Configuration         │   ✅  │   ❌  │   ❌  │   ❌  │  ❌  │
│  Audit Log                    │   ✅  │   ❌  │   ❌  │   ❌  │  ❌  │
├───────────────────────────────┼───────┼───────┼───────┼───────┼──────┤
│  Platform Config (API Keys)   │   ❌  │   ✅  │   ❌  │   ❌  │  ❌  │
│  User Management              │   ❌  │   ✅  │   ❌  │   ❌  │  ❌  │
│  Role Management              │   ❌  │   ✅  │   ❌  │   ❌  │  ❌  │
│  Brand Guidelines             │   ❌  │   ✅  │   ❌  │   ❌  │  ❌  │
│  Ad Account Management        │   ❌  │   ✅  │   ❌  │   ❌  │  ❌  │
├───────────────────────────────┼───────┼───────┼───────┼───────┼──────┤
│  Budget & Matrix              │   ❌  │   ❌  │   ✅  │   ❌  │  ❌  │
│  CMO Approval Queue           │   ❌  │   ❌  │   ✅  │   ❌  │  ❌  │
│  AI Monitoring Dashboard      │   ❌  │   ❌  │   ✅  │   ❌  │  ❌  │
│  Ad Performance               │   ❌  │   ❌  │   ✅  │   ❌  │  ✅  │
│  Budget Overview              │   ❌  │   ❌  │   ✅  │   ❌  │  ❌  │
├───────────────────────────────┼───────┼───────┼───────┼───────┼──────┤
│  Campaign Objective           │   ❌  │   ❌  │   ❌  │   ✅  │  ❌  │
│  Target Audience              │   ❌  │   ❌  │   ❌  │   ✅  │  ❌  │
│  Strategy Hub (AI — 3 phases) │   ❌  │   ❌  │   ❌  │   ✅  │  ❌  │
│  Creative Hub                 │   ❌  │   ❌  │   ❌  │   ✅  │  ❌  │
│  Creative Studio (review)     │   ❌  │   ❌  │   ❌  │   ✅  │  ❌  │
├───────────────────────────────┼───────┼───────┼───────┼───────┼──────┤
│  PPP Queue (asset review)     │   ❌  │   ❌  │   ❌  │   ❌  │  ✅  │
│  Platform Selection           │   ❌  │   ❌  │   ❌  │   ❌  │  ✅  │
│  Deploy (Facebook / TikTok)   │   ❌  │   ❌  │   ❌  │   ❌  │  ✅  │
│  Deployment History           │   ❌  │   ❌  │   ❌  │   ❌  │  ✅  │
└═══════════════════════════════╧═══════╧═══════╧═══════╧═══════╧══════┘
```

---

## 6. Complete System Flow — Campaign Lifecycle

```
┌═══════════════════════════════════════════════════════════════════════════┐
│                    FULL CAMPAIGN LIFECYCLE FLOW                           │
└═══════════════════════════════════════════════════════════════════════════┘

  ┌──────────────────────────────────────────────────────────────────────┐
  │  STAGE 1 — PLATFORM & BUDGET SETUP                    [CMO]          │
  └──────────────────────────────────────────────────────────────────────┘
    CMO opens Budget & Matrix
     ├─ Selects which platforms are approved for the campaign
     │    (Facebook / TikTok / Instagram / YouTube)
     ├─ Sets total campaign budget
     ├─ Optionally allocates budget per platform
     └─ Saves → system notifies Marketing Expert
                │
                ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │  STAGE 2 — CAMPAIGN STRATEGY                        [EXPERT]         │
  └──────────────────────────────────────────────────────────────────────┘
    Expert opens Campaign Objective screen
     ├─ Selects objective: Awareness / Traffic / Engagement / Conversions
     │
    Expert opens Target Audience screen
     ├─ Sets: Country, Language, Age Range, Gender
     │
    Expert opens Strategy Hub — Phase 1
     ├─ Enters campaign brief (what the campaign is about)
     ├─ POST /api/gemini/questions ──▶ Google Gemini API
     └─ Receives 5 Level-1 Conceptual Questions
                │
    Strategy Hub — Phase 2
     ├─ Expert answers Level-1 questions
     ├─ POST /api/gemini/follow-up ──▶ Google Gemini API
     └─ Receives 5 Level-2 Psychological Questions
                │
    Strategy Hub — Phase 3
     ├─ Expert answers Level-2 questions
     └─ Full strategy profile complete (stored in session)
                │
                ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │  STAGE 3 — CREATIVE HUB (Asset Configuration)       [EXPERT]         │
  └──────────────────────────────────────────────────────────────────────┘
    Expert opens Creative Hub
     ├─ Sees only CMO-approved platforms
     ├─ Per platform, defines:
     │    • Aspect Ratio    (1:1 / 16:9 / 9:16 / 4:5)
     │    • Number of Images
     │    • Number of Videos
     │    • Video Duration (seconds)
     └─ Clicks "Generate Assets"
                │
    System generates assets:
     ├─ Image assets   → downloaded at specified ratio & count
     ├─ Video assets   → generated at ratio + duration
     └─ Each asset stored with: text, platform, ratio, URL, duration
                │
                ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │  STAGE 4 — CREATIVE STUDIO (Expert Review)          [EXPERT]         │
  └──────────────────────────────────────────────────────────────────────┘
    Expert reviews all generated assets
     ├─ Previews each image / video
     ├─ Edits copy / caption text
     ├─ Discards unwanted variations
     └─ Submits selected assets ──▶ PPP Queue
                │
                ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │  STAGE 5 — PPP REVIEW & BUDGET ENTRY               [PPP SPECIALIST]  │
  └──────────────────────────────────────────────────────────────────────┘
    PPP Specialist opens PPP Queue
     ├─ Reviews each submitted asset (platform / ratio / copy / media)
     ├─ Enters budget for each individual ad
     └─ Decision per asset:
          ✅ Approve  → asset forwarded to CMO Approval Queue
          ❌ Reject   → asset returned to Expert with notes
                │
                ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │  STAGE 6 — CMO FINAL APPROVAL                       [CMO]            │
  └──────────────────────────────────────────────────────────────────────┘
    CMO opens CMO Approval Queue
     ├─ Reviews assets with PPP-assigned budgets
     └─ Decision per ad:
          ✅ Approve  → ad status set to "cmo_approved" (deploy-ready)
          ❌ Reject   → PPP notified with rejection notes
                │
                ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │  STAGE 7 — DEPLOYMENT                              [PPP SPECIALIST]  │
  └──────────────────────────────────────────────────────────────────────┘
    PPP Specialist opens Deployment screen
     ├─ Views all CMO-approved ads
     ├─ Selects ads for deployment
     ├─ Chooses target platform (Facebook / TikTok)
     │
     ├─ FACEBOOK deployment:
     │    1. Upload media (image/video)
     │    2. Create Campaign
     │    3. Create Ad Set (targeting, budget, placement)
     │    4. Create Ad Creative
     │    5. Create Ad
     │    Returns: Campaign ID, Ad Set ID, Ad ID
     │
     ├─ TIKTOK deployment:
     │    1. Create Ad Group (budget, placement, targeting)
     │    2. Create Ad Creative (video, text, CTA)
     │    Returns: Ad Group ID, Ad ID
     │
     └─ Deployment log recorded in database
                │
                ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │  STAGE 8 — MONITORING & PERFORMANCE                [CMO + PPP]       │
  └──────────────────────────────────────────────────────────────────────┘
    AI Monitoring Dashboard shows:
     ├─ Active ads count & total spend
     ├─ Efficiency metrics (CTR, CPC, ROAS)
     └─ Auto-action recommendations:
          • Scale Up / Monitor / Shut Down / Budget Reallocation
```

---

## 7. Creative Asset Flow — Detailed

```
┌═══════════════════════════════════════════════════════════════════════┐
│                    CREATIVE ASSET PIPELINE                             │
└═══════════════════════════════════════════════════════════════════════┘

  CMO sets allowed platforms
  e.g.  Facebook ✅   TikTok ✅   YouTube ❌
          │
          ▼
  Expert configures Creative Hub
  ┌────────────────────────────────────────────────────────────┐
  │  Platform: Facebook        Platform: TikTok                │
  │  ─────────────────         ───────────────                 │
  │  Aspect Ratio: 1:1         Aspect Ratio: 9:16              │
  │  Images: 3                 Images: 2                       │
  │  Videos: 2                 Videos: 3                       │
  │  Video Duration: 15s       Video Duration: 30s             │
  └────────────────────────────────────────────────────────────┘
          │
          ▼
  System generates assets
  ┌──────────────────────────────────────────────────────────────┐
  │  Asset #1  platform:facebook  ratio:1:1  type:image  url:…   │
  │  Asset #2  platform:facebook  ratio:1:1  type:image  url:…   │
  │  Asset #3  platform:facebook  ratio:1:1  type:image  url:…   │
  │  Asset #4  platform:facebook  ratio:1:1  type:video  dur:15s │
  │  Asset #5  platform:facebook  ratio:1:1  type:video  dur:15s │
  │  Asset #6  platform:tiktok    ratio:9:16 type:image  url:…   │
  │  Asset #7  platform:tiktok    ratio:9:16 type:image  url:…   │
  │  Asset #8  platform:tiktok    ratio:9:16 type:video  dur:30s │
  │  Asset #9  platform:tiktok    ratio:9:16 type:video  dur:30s │
  │  Asset #10 platform:tiktok    ratio:9:16 type:video  dur:30s │
  └──────────────────────────────────────────────────────────────┘
          │
          │  Expert reviews → edits text → removes unwanted → submits
          ▼
  PPP Queue  (status: pending_ppp)
  ┌──────────────────────────────────────────────────────────────┐
  │  PPP reviews each asset                                      │
  │  PPP enters budget: Asset #1 → $50/day, Asset #4 → $80/day  │
  │  PPP approves ──▶ moves to CMO Queue                         │
  └──────────────────────────────────────────────────────────────┘
          │
          ▼
  CMO Queue  (status: ppp_approved)
  ┌──────────────────────────────────────────────────────────────┐
  │  CMO sees assets with PPP-set budgets                        │
  │  CMO approves ──▶ status: cmo_approved                       │
  └──────────────────────────────────────────────────────────────┘
          │
          ▼
  Deployment  (PPP deploys)
  ──▶  Facebook Ad / TikTok Ad goes LIVE
```

---

## 8. Approval & Permission Flow

```
┌═══════════════════════════════════════════════════════════════════════┐
│                   ASSET STATUS STATE MACHINE                          │
└═══════════════════════════════════════════════════════════════════════┘

  [draft]
     │ Expert submits
     ▼
  [pending_ppp]
     │                           │
     │ PPP approves              │ PPP rejects
     ▼                           ▼
  [ppp_approved]           [rejected_by_ppp]
     │                           │
     │                           └─▶ Expert revises ──▶ [draft]
     │ CMO approves / rejects
     ├─────────────────────────────────────┐
     ▼                                     ▼
  [cmo_approved]                     [rejected_by_cmo]
     │                                     │
     │                                     └─▶ PPP notified ──▶ [pending_ppp]
     │ PPP deploys
     ▼
  [deploying]
     │
     ▼
  [active]
     │
     ├──▶ [paused] ──▶ [active]
     │
     ▼
  [completed] / [archived]


┌═══════════════════════════════════════════════════════════════════════┐
│                     PERMISSION RULES (Backend Guards)                 │
└═══════════════════════════════════════════════════════════════════════┘

  RULE 1 — Platform Lock
   Expert can only select platforms the CMO enabled.
   Backend validates: selected platform ∈ campaign.allowed_platforms

  RULE 2 — Budget Write Lock
   Only PPP can write ad-level budget fields.
   Budget fields are write-locked for Expert and CMO.

  RULE 3 — CMO Queue Gate
   An asset enters the CMO Queue ONLY after:
    • PPP has set budget (ppp_budget IS NOT NULL)
    • PPP has approved (status = ppp_approved)

  RULE 4 — Deployment Gate
   An ad can only be deployed if: status = 'cmo_approved'
   Backend rejects deploy calls for any other status.

  RULE 5 — Company Isolation (Multi-Tenancy)
   Every API call is scoped to company_id extracted from JWT.
   Cross-company data access returns HTTP 403 Forbidden.

  RULE 6 — Super Admin Exclusion
   Super Admin users never appear in the user selector dropdown.
   Non-super-admin callers cannot grant super-admin-only screens.
```

---

## 9. Authentication & Security Flow

```
┌═══════════════════════════════════════════════════════════════════════┐
│                        AUTHENTICATION FLOW                             │
└═══════════════════════════════════════════════════════════════════════┘

  CLIENT                        BACKEND                      DATABASE
    │                              │                              │
    │  POST /api/auth/login         │                              │
    │  { username, password }       │                              │
    │─────────────────────────────▶│                              │
    │                              │  SELECT user by username     │
    │                              │─────────────────────────────▶│
    │                              │◀──── user record ────────────│
    │                              │                              │
    │                              │  BCrypt.Verify(password)     │
    │                              │                              │
    │                              │  SELECT role + screens       │
    │                              │─────────────────────────────▶│
    │                              │◀──── role + screen list ─────│
    │                              │                              │
    │                              │  Generate JWT (HS256, 8hr)   │
    │                              │  { name, role, company_id,   │
    │                              │    sub, iss, aud, exp }       │
    │                              │                              │
    │◀─────────────────────────────│                              │
    │  { token,                    │                              │
    │    user: {                   │                              │
    │      username, role,         │                              │
    │      email, screens[] } }    │                              │
    │                              │                              │
    │  Stored in localStorage      │                              │
    │  Renders role-specific UI    │                              │

  Security Controls:
  ─────────────────────────────────────────────────────────────
  • Passwords hashed with BCrypt (salt rounds: 12)
  • JWT expiry: 8 hours (short-lived access token)
  • All API endpoints require Bearer token in Authorization header
  • Role + company_id embedded in JWT claims (no DB call per request)
  • Screen list in JWT controls which menu items render in frontend
  • Per-user screen overrides supported via UserScreen table
```

---

## 10. Database Design Overview

```
┌═══════════════════════════════════════════════════════════════════════┐
│                    DATABASE STRUCTURE (28 TABLES)                      │
└═══════════════════════════════════════════════════════════════════════┘

  ┌─────────────────────────────────────────────────────────────────┐
  │  DOMAIN: MULTI-TENANCY (3 tables)                               │
  │  companies · company_settings · company_ad_accounts             │
  │  → Every company's data is fully isolated                       │
  │  → Ad platform credentials stored per company (encrypted)       │
  └─────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────┐
  │  DOMAIN: AUTH & RBAC (5 tables)                                 │
  │  users · roles · screens · role_screens · refresh_tokens        │
  │  → Role-based screen permissions                                │
  │  → User-level permission overrides (UserScreen)                 │
  └─────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────┐
  │  DOMAIN: CAMPAIGN CORE (5 tables)                               │
  │  campaigns · campaign_objectives · ad_sets · ads · ad_creatives │
  │  → Full campaign hierarchy: Campaign → Ad Set → Ad → Creative   │
  │  → Status lifecycle: draft→pending→approved→deploying→active    │
  └─────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────┐
  │  DOMAIN: WORKFLOW (4 tables)                                    │
  │  campaign_workflow_steps · cmo_queue · ppp_queue                │
  │  · approval_comments                                            │
  │  → Tracks each step of the campaign wizard                      │
  │  → Approval queues for PPP and CMO review stages                │
  └─────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────┐
  │  DOMAIN: ANALYTICS (2 tables)                                   │
  │  ad_metrics · deployment_logs                                   │
  │  → Daily metrics per platform (impressions, clicks, spend,ROAS) │
  │  → Full audit trail of every deployment API call                │
  └─────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────┐
  │  DOMAIN: FEATURES (4 tables)                                    │
  │  ab_tests · budget_allocations · campaign_templates             │
  │  · audience_templates                                           │
  │  → A/B testing with statistical significance tracking           │
  │  → Budget planning & spend tracking per platform                │
  └─────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────┐
  │  DOMAIN: SYSTEM (3 tables)                                      │
  │  notifications · activity_logs · invitations                    │
  │  → In-app notification system for all workflow events           │
  │  → Full audit trail: every login, approval, deployment          │
  │  → Team member invitation via email with pre-assigned role      │
  └─────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────┐
  │  DOMAIN: ASSETS (2 tables)                                      │
  │  asset_library · brand_guidelines                               │
  │  → Database-tracked asset management with metadata & tagging    │
  │  → Brand identity: tone, palette, typography, whitelist         │
  └─────────────────────────────────────────────────────────────────┘

  KEY RELATIONSHIPS
  ─────────────────────────────────────────────────────────────────
  companies   1 ──▶ N   users, roles, campaigns, brand_guidelines,
                         cmo_queue, ppp_queue, ad_sets, ads,
                         notifications, budget_allocations, ...

  campaigns   1 ──▶ N   ad_sets ──▶ ads ──▶ ad_creatives
                         campaign_workflow_steps, ad_metrics,
                         deployment_logs, ab_tests

  users       1 ──▶ N   refresh_tokens, activity_logs, notifications
                         campaigns (created/approved/deployed by)
```

---

## 11. API Design Overview

```
/api
  │
  ├── /auth
  │     ├── POST /register           Create user account
  │     └── POST /login              Authenticate → JWT + screen list
  │
  ├── /rbac
  │     ├── GET  /roles              List roles
  │     ├── POST /roles              Create role
  │     ├── PUT  /roles/{id}         Update role
  │     ├── DELETE /roles/{id}       Delete role
  │     ├── GET  /screens            List screens (filtered by role)
  │     ├── GET  /users              List users
  │     ├── DELETE /users/{id}       Revoke user
  │     ├── GET  /role-permissions/{roleId}
  │     ├── POST /role-permissions   Save role-screen matrix
  │     ├── GET  /user-permissions/{userId}   ← per-user overrides
  │     └── POST /user-permissions            ← save user-screen overrides
  │
  ├── /campaigns/{id}/platform-config
  │     ├── GET                      CMO gets allowed platforms
  │     └── POST                     CMO saves platform config + budget
  │
  ├── /creative-hub
  │     ├── GET  /platforms/{id}     Expert gets CMO-allowed platforms
  │     ├── POST /generate           Trigger asset generation
  │     └── PUT  /asset/{id}         Expert edits copy text
  │
  ├── /campaigns
  │     ├── GET  /                   List campaigns
  │     └── POST /                   Create campaign
  │
  ├── /assets
  │     ├── GET  /                   List /Assets files
  │     ├── DELETE /{filename}       Delete asset
  │     ├── POST /save-url           Download image from URL
  │     └── POST /approve            Copy to /Assets Library
  │
  ├── /ppp/queue
  │     ├── GET  /                   PPP lists pending assets
  │     ├── PUT  /{id}/budget        PPP sets ad-wise budget
  │     ├── POST /{id}/approve       PPP approves → CMO Queue
  │     └── POST /{id}/reject        PPP rejects → Expert
  │
  ├── /cmo/queue
  │     ├── GET  /                   CMO lists PPP-approved assets
  │     ├── POST /{id}/approve       CMO final approval
  │     └── POST /{id}/reject        CMO rejects → PPP notified
  │
  ├── /gemini
  │     ├── POST /questions          Generate Level-1 strategy questions
  │     └── POST /follow-up          Generate Level-2 questions
  │
  ├── /deploy
  │     ├── GET  /ready              PPP lists CMO-approved ads
  │     ├── POST /facebook           Deploy to Facebook
  │     └── POST /tiktok-adgroup     Deploy to TikTok
  │
  ├── /guidelines
  │     ├── GET  /                   Fetch brand guideline
  │     └── POST /                   Save brand guideline
  │
  └── /test
        └── GET  /facebook-connection   Test platform API connection
```

---

## 12. Notification System

```
  Every key workflow event triggers an in-app notification:

  EVENT                              →  NOTIFIED
  ────────────────────────────────────────────────────────────
  CMO saves platform config          →  Marketing Expert
  Expert submits assets to PPP       →  PPP Specialist
  PPP rejects an asset               →  Marketing Expert
  PPP approves asset (→ CMO Queue)   →  CMO (Business Admin)
  CMO rejects an asset               →  PPP Specialist
  CMO approves an asset              →  PPP Specialist (deploy signal)
  PPP deploys successfully           →  CMO + Admin
  Deployment fails                   →  PPP Specialist + Admin
  Campaign completed                 →  All stakeholders
  Budget alert threshold reached     →  CMO + Admin
  User invited to company            →  Invited user (email)

  Notification record fields:
   type · title · message · resource_type · resource_id
   action_url (deep link) · is_read · created_at
```

---

## 13. Deployment Architecture

```
  HOST MACHINE
    │
    ├─ :80   ──▶  FRONTEND CONTAINER
    │              Nginx serving Vite-built SPA
    │              All /api/* requests proxied to backend
    │
    ├─ :5243 ──▶  BACKEND CONTAINER
    │              ASP.NET Core 9.0 REST API
    │              EF Core → PostgreSQL
    │              Connects to: Gemini API, Facebook API, TikTok API
    │
    └─ :5432 ──▶  DATABASE CONTAINER
                   PostgreSQL 16-alpine
                   Volume: pgdata (persistent across restarts)

  VOLUMES
  ─────────────────────────────────────────
  pgdata         →  PostgreSQL data files
  /Assets        →  Working asset files (images/videos in progress)
  /Assets Library→  Approved assets ready for deployment

  EXTERNAL SERVICES
  ─────────────────────────────────────────
  Google Gemini 2.0 Flash  →  AI strategy question generation
  Facebook Graph API v19.0 →  Ad upload, campaign, ad set, creative, ad
  TikTok Business API v1.3 →  Ad group creation, creative, deployment
  (YouTube Ads — planned)
  (Google Ads  — planned)
```

---

## 14. Key Business Rules

```
  1. PLATFORM CONTROL
     CMO controls which ad platforms are available per campaign.
     Experts cannot select platforms outside this approved list.

  2. SEQUENTIAL APPROVAL — NO SHORTCUTS
     Expert → PPP → CMO → Deploy
     No ad can skip a stage. Each stage gate is enforced by the backend.

  3. BUDGET OWNERSHIP
     PPP sets the budget for each individual ad.
     CMO sees and approves these budgets at the final review stage.
     No ad deploys without a budget assigned by PPP and approved by CMO.

  4. ASSET TRACEABILITY
     Every asset carries: platform, aspect ratio, content text, URL,
     duration, and who created / approved / deployed it.
     Full audit trail in activity_logs and deployment_logs.

  5. MULTI-TENANCY ISOLATION
     Each company's data is completely isolated.
     A user from Company A can never see or touch Company B's data.
     Super Admin is the only role with cross-company visibility.

  6. BRAND COMPLIANCE
     Brand guidelines (tone, language, whitelist, blacklist, palette)
     are defined per company by the Admin.
     The BrandComplianceService enforces these on creative assets.

  7. ROLE HIERARCHY
     Super Admin > Admin > CMO > Expert / PPP
     Higher roles cannot bypass lower-role workflow stages
     (CMO cannot approve without PPP budget entry).

  8. USER-LEVEL PERMISSION OVERRIDES
     Beyond role permissions, individual users can be granted
     specific screen access independently of their role.
     This is managed by Admin via the Role Management screen.
```

---

## Summary — Project at a Glance

```
┌══════════════════════════════════════════════════════════════════════┐
│                      PROJECT SNAPSHOT                                 │
╠══════════════════════════════════════════════════════════════════════╣
│  Type              Multi-tenant Enterprise SaaS                       │
│  Frontend          Vanilla JS SPA (Vite + Tailwind)                   │
│  Backend           ASP.NET Core 9.0 REST API                          │
│  Database          PostgreSQL — 28 tables                             │
│  AI Engine         Google Gemini 2.0 Flash                            │
│  Ad Platforms      Facebook, TikTok (Instagram & YouTube planned)     │
│  Roles             Super Admin / Admin / CMO / Expert / PPP           │
│  Screens           25+ role-gated screens                             │
│  Infrastructure    Docker Compose (3 containers)                      │
│  Auth              JWT HS256 (8hr) + BCrypt password hashing          │
╠══════════════════════════════════════════════════════════════════════╣
│  WORKFLOW STAGES                                                       │
│  1. CMO sets platforms & budget                                        │
│  2. Expert runs AI strategy (Gemini 3-phase Q&A)                      │
│  3. Expert configures Creative Hub (format, count, duration)          │
│  4. System auto-generates image & video assets                        │
│  5. Expert reviews assets → submits to PPP                            │
│  6. PPP reviews → sets ad budget → approves → sends to CMO            │
│  7. CMO final review → approves → deploy-ready                        │
│  8. PPP deploys to Facebook / TikTok via platform APIs                │
│  9. AI Monitoring Dashboard tracks performance & spend                 │
└══════════════════════════════════════════════════════════════════════┘
```

---

*Document: demo1.md*
*Project: AI-Marketing-New*
*Covers: System Flow · Roles · Screens · Creative Pipeline · Approval Flow · Auth · Database · APIs · Business Rules*
