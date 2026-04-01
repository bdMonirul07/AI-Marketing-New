# AI-Marketing Platform - Project Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [SDLC (Software Development Life Cycle)](#sdlc)
4. [Application Flowchart](#application-flowchart)
5. [Data Flow Diagrams](#data-flow-diagrams)
6. [User Role Flowcharts](#user-role-flowcharts)
7. [API Endpoint Map](#api-endpoint-map)
8. [Database Schema](#database-schema)
9. [Authentication Flow](#authentication-flow)
10. [Deployment Pipeline Flow](#deployment-pipeline-flow)

---

## Project Overview

**AI-Marketing New** is an enterprise SaaS platform for orchestrating AI-driven marketing campaigns across Facebook, TikTok, Instagram, and YouTube. It features role-based access control (RBAC), multi-step AI-assisted campaign strategy, creative asset management, and integrated ad deployment.

### Technology Stack

| Layer       | Technology                                      |
|-------------|------------------------------------------------|
| Frontend    | Vanilla JS SPA, Vite 7.2.4, Tailwind CSS 4.x  |
| Backend     | ASP.NET Core 9.0 (Web API)                     |
| Database    | PostgreSQL + Entity Framework Core 9.0          |
| Auth        | JWT Bearer Tokens (HS256, 8hr expiry)           |
| AI Engine   | Google Gemini 2.0 Flash API                     |
| Ad Platforms| Facebook Graph API v19.0, TikTok Business API v1.3 |
| Hashing     | BCrypt.NET                                      |

---

## SDLC

### Software Development Life Cycle Diagram

```
+------------------+     +------------------+     +------------------+
|   1. PLANNING    |---->|  2. ANALYSIS &   |---->|    3. DESIGN     |
|                  |     |   REQUIREMENTS   |     |                  |
| - Define scope   |     | - User roles     |     | - SPA frontend   |
| - Marketing      |     |   (Admin, BA,    |     | - REST API       |
|   automation     |     |   PPC, Expert)   |     |   backend        |
|   goals          |     | - Multi-platform |     | - PostgreSQL     |
| - Platform       |     |   ad deployment  |     |   schema         |
|   selection      |     | - AI-assisted    |     | - JWT auth       |
|                  |     |   strategy       |     | - RBAC matrix    |
+------------------+     +------------------+     +------------------+
         ^                                                 |
         |                                                 v
+------------------+     +------------------+     +------------------+
|  6. MAINTENANCE  |<----|  5. TESTING &    |<----|4. IMPLEMENTATION |
|                  |     |   DEPLOYMENT     |     |                  |
| - Monitor ad     |     | - API endpoint   |     | - ASP.NET Core   |
|   performance    |     |   testing        |     |   9.0 API        |
| - Update API     |     | - Facebook/      |     | - Vite + JS SPA  |
|   tokens         |     |   TikTok sandbox |     | - EF Core        |
| - Scale infra    |     | - RBAC           |     |   migrations     |
| - Add platforms  |     |   verification   |     | - Gemini AI      |
|   (Instagram,    |     | - JWT auth flow  |     |   integration    |
|    YouTube)      |     |   testing        |     | - Facebook/      |
+------------------+     +------------------+     |   TikTok APIs    |
                                                  +------------------+
```

### SDLC Phases Detail

```
Phase 1: Planning
  |
  |-- Goal: Build AI-powered marketing campaign orchestration platform
  |-- Stakeholders: Marketing teams, PPC specialists, business admins
  |-- Platforms: Facebook, TikTok (Instagram, YouTube planned)
  |
Phase 2: Requirements Analysis
  |
  |-- Functional Requirements:
  |   |-- Multi-role access (Admin, Business Admin, PPC, Expert)
  |   |-- AI-generated campaign strategy questions (Gemini)
  |   |-- Creative asset pipeline (upload -> review -> approve -> deploy)
  |   |-- Multi-platform ad deployment (Facebook, TikTok)
  |   |-- Budget allocation and monitoring
  |   |-- Brand guideline enforcement
  |
  |-- Non-Functional Requirements:
  |   |-- JWT-based stateless authentication
  |   |-- Responsive UI with multiple themes
  |   |-- Graceful API failure handling with fallbacks
  |   |-- Caching for AI-generated responses
  |
Phase 3: Design
  |
  |-- Architecture: Client-Server (SPA + REST API)
  |-- Database: PostgreSQL with EF Core ORM
  |-- Auth: JWT tokens with BCrypt password hashing
  |-- State: Client-side state object + localStorage persistence
  |
Phase 4: Implementation
  |
  |-- Backend: 984-line Program.cs with all endpoints
  |-- Frontend: 3,277-line main.js SPA with 19+ screens
  |-- Services: FacebookAdsService, GeminiService (inline)
  |-- Database: 7 tables (users, roles, screens, role_screens,
  |             brand_guidelines, campaigns, cmo_queue)
  |
Phase 5: Testing & Deployment
  |
  |-- API testing via /api/test/facebook-connection
  |-- Mock/simulation mode for TikTok when token unavailable
  |-- Local dev: HTTP :5243 / HTTPS :7110
  |
Phase 6: Maintenance
  |
  |-- Token renewal for Facebook/TikTok APIs
  |-- New platform integrations (Instagram, YouTube)
  |-- Performance monitoring dashboard updates
```

---

## Application Flowchart

### Main Application Flow

```
                        +=======================+
                        |    APPLICATION START   |
                        +=======================+
                                   |
                                   v
                        +---------------------+
                        |   Login Screen      |
                        |  (Username/Password) |
                        +---------------------+
                                   |
                          POST /api/auth/login
                                   |
                                   v
                        +---------------------+
                        | JWT Token Generated |
                        | User Role Resolved  |
                        | Screens Assigned    |
                        +---------------------+
                                   |
                    +--------------+--------------+----------------+
                    |              |              |                |
                    v              v              v                v
            +-----------+  +-----------+  +-----------+    +-----------+
            |   ADMIN   |  |  EXPERT   |  | BUSINESS  |    |    PPC    |
            |   ROLE    |  |   ROLE    |  |   ADMIN   |    |   ROLE    |
            +-----------+  +-----------+  +-----------+    +-----------+
            |             |              |                  |
            |- Config     |- Objective   |- Budget Matrix   |- Approved
            |- Company    |- Targeting   |- Ad Approvals    |  Assets
            |- Users      |- Strategy    |- AI Monitoring   |- Platform
            |- Roles      |  Hub         |- Ad Performance  |  Selection
            |- Calendar   |- Creative    |- Budget Overview |- Deploy
            |- Brand      |  Config      |- Dashboard       |- Ad Perf
            |  Guidelines |- Creative    |                  |- Dashboard
            |- Assets     |  Studio      |                  |
            |- Dashboard  |- Dashboard   |                  |
            |             |              |                  |
            v             v              v                  v
        [System      [Campaign       [Approval          [Ad
         Config]      Creation]       Workflow]          Deployment]
```

### Campaign Lifecycle Flowchart

```
START
  |
  v
[Expert: Select Objective] -----> Reach / Click / Sell
  |
  v
[Expert: Define Target Audience]
  |  Country, Language, Age Range, Gender
  |  (Multiple targeting sets allowed)
  |
  v
[Expert: Strategy Hub - Phase 1]
  |  Input campaign brief
  |  --> POST /api/gemini/questions
  |  --> Receive 5 Level-1 questions (conceptual)
  |
  v
[Expert: Strategy Hub - Phase 2]
  |  Answer Level-1 questions
  |  --> POST /api/gemini/follow-up
  |  --> Receive 5 Level-2 questions (psychological)
  |
  v
[Expert: Strategy Hub - Phase 3]
  |  Answer Level-2 questions
  |  --> Full strategy profile complete
  |
  v
[Expert: Creative Config]
  |  Select style preset (Cinematic/Minimalism/Cyberpunk/Vintage)
  |  Choose aspect ratio (1:1 / 16:9 / 9:16)
  |  Set generation targets (photos, videos, posts)
  |  --> POST /api/campaigns (save to DB)
  |  --> Download sample variations from Unsplash
  |
  v
[Expert: Creative Studio]
  |  Review generated/uploaded variations
  |  Approve selected assets
  |  --> POST /api/assets/approve (copy to /Assets Library)
  |  --> POST /api/cmo/queue (add to CMO queue)
  |
  v
[Business Admin: Ad Approvals]
  |  Review CMO Queue (all pending assets)
  |  Toggle approve/reject per asset
  |  --> Approved assets move to PPC Queue
  |  --> POST /api/ppc/queue (update PPC queue)
  |
  v
[PPC: Approved Assets]
  |  View PPC Queue
  |  Select assets for deployment
  |
  v
[PPC: Platform Selection]
  |  Choose platforms: Facebook / TikTok
  |  Configure platform parameters:
  |    Facebook: campaign name, objective, budget, dates, page ID
  |    TikTok: campaign ID, budget, placement, bid, targeting, CTA
  |
  v
[PPC: Deploy]
  |
  +-------> Facebook Deployment:
  |           1. Upload media (image/video)
  |           2. Create Campaign
  |           3. Create Ad Set
  |           4. Create Ad Creative
  |           5. Create Ad
  |
  +-------> TikTok Deployment:
  |           1. Create Ad Group (budget + targeting)
  |           2. Create Ad Creative (media + CTA)
  |
  v
[Monitoring Dashboard]
  |  Active Ads count
  |  Total Spend tracking
  |  Efficiency metrics
  |  Auto-actions: Scale Up / Monitor / Shut Down / Budget Realloc
  |
  v
END
```

---

## Data Flow Diagrams

### Level 0 - Context Diagram

```
+----------------+                                    +------------------+
|                |    Campaign Strategy Request        |                  |
|   Marketing    | ---------------------------------> |   AI-Marketing   |
|   Team Users   |    Campaign Reports & Metrics      |   Platform       |
|   (4 Roles)    | <--------------------------------- |                  |
|                |                                    |                  |
+----------------+                                    +--------+---------+
                                                               |
                         +-------------------------------------+-----+
                         |                    |                       |
                         v                    v                       v
                 +---------------+   +-----------------+   +------------------+
                 |  Google       |   |  Facebook       |   |  TikTok          |
                 |  Gemini API   |   |  Graph API      |   |  Business API    |
                 |  (AI Engine)  |   |  (Ad Platform)  |   |  (Ad Platform)   |
                 +---------------+   +-----------------+   +------------------+
```

### Level 1 - System Data Flow

```
+=========================================================================+
|                        AI-MARKETING PLATFORM                            |
+=========================================================================+
|                                                                         |
|  +-----------+    Credentials     +----------------+                    |
|  |  LOGIN    | -----------------> | AUTH SERVICE   |                    |
|  |  SCREEN   | <----------------- | (JWT + BCrypt) |                    |
|  +-----------+    JWT Token       +-------+--------+                    |
|       |                                   |                             |
|       | Token                        Read/Write                         |
|       v                                   v                             |
|  +-----------+                    +----------------+                    |
|  | FRONTEND  |  API Requests      |  POSTGRESQL    |                    |
|  | SPA       | <----------------> |  DATABASE      |                    |
|  | (main.js) |  JSON Responses    |                |                    |
|  +-----------+                    | - users        |                    |
|       |                           | - roles        |                    |
|       |                           | - screens      |                    |
|       |                           | - role_screens |                    |
|       +----------+                | - campaigns    |                    |
|       |          |                | - brand_guide  |                    |
|       v          v                | - cmo_queue    |                    |
|  +---------+ +---------+         +----------------+                    |
|  | GEMINI  | | DEPLOY  |                |                              |
|  | SERVICE | | SERVICE |         +----------------+                    |
|  +---------+ +---------+         | FILE STORAGE   |                    |
|       |          |               | - ppc_queue.json|                   |
|       |          +---+           | - /Assets       |                   |
|       |              |           | - /Assets Library|                  |
|       v              v           +----------------+                    |
|  +---------+   +----------+                                            |
|  | Google  |   | Facebook |                                            |
|  | Gemini  |   | + TikTok |                                            |
|  | API     |   | APIs     |                                            |
|  +---------+   +----------+                                            |
|                                                                         |
+=========================================================================+
```

### Level 2 - Detailed Process Data Flow

```
PROCESS 1: USER AUTHENTICATION
==============================
User Input ──> [Validate Credentials] ──> PostgreSQL (users table)
                      |
                      v
              [Generate JWT Token]
                      |
                      v
              [Load Role & Screens] ──> PostgreSQL (roles, role_screens, screens)
                      |
                      v
              JWT + User Object ──> Frontend localStorage


PROCESS 2: AI STRATEGY GENERATION
==================================
Campaign Brief ──> [Hash & Check Cache]
                          |
              +-----------+-----------+
              | Cache HIT             | Cache MISS
              v                       v
        Return cached           [Call Gemini API]
        questions                     |
                                      v
                              [Parse 5 Questions]
                                      |
                                      v
                              [Store in Cache]
                                      |
                                      v
                              Return questions to frontend


PROCESS 3: ASSET PIPELINE
==========================
Expert uploads/generates assets
         |
         v
[Save to /Assets folder] ──> POST /api/assets/save-url
         |
         v
[Expert reviews in Studio]
         |
    Approve selected
         |
         v
[Copy to /Assets Library] ──> POST /api/assets/approve
         |
         v
[Add to CMO Queue (DB)] ──> POST /api/cmo/queue
         |
         v
[Business Admin reviews]
         |
    Approve selected
         |
         v
[Move to PPC Queue (JSON)] ──> POST /api/ppc/queue
         |
         v
[PPC selects for deployment]
         |
         v
[Deploy to Facebook/TikTok]


PROCESS 4: FACEBOOK AD DEPLOYMENT
===================================
Selected Asset ──> [Read File from /Assets Library]
                          |
                   +------+------+
                   | Image       | Video
                   v             v
            [Upload Image] [Upload Video]
                   |             |
                   +------+------+
                          |
                          v
                  [Create Campaign]
                   POST /act_{ID}/campaigns
                          |
                          v
                  [Create Ad Set]
                   POST /act_{ID}/adsets
                   (targeting, budget, schedule)
                          |
                          v
                  [Create Ad Creative]
                   POST /act_{ID}/adcreatives
                   (media reference + story spec)
                          |
                          v
                  [Create Ad]
                   POST /act_{ID}/ads
                   (link adset + creative)
                          |
                          v
                  Return campaign/ad IDs to frontend


PROCESS 5: TIKTOK AD DEPLOYMENT
=================================
Selected Asset ──> [Read deployment config]
                          |
                          v
                  [Create Ad Group]
                   POST /open_api/v1.3/adgroup/create/
                   (budget, schedule, placement, targeting)
                          |
                          v
                  [Create Ad Creative]
                   (video_id, text, display_name, CTA)
                          |
                          v
                  Return adgroup_id + ad_id to frontend
```

### Data Store Diagram

```
+===========================+     +===========================+
|     POSTGRESQL DATABASE   |     |     FILE-BASED STORAGE    |
+===========================+     +===========================+
|                           |     |                           |
|  [users]                  |     |  ppc_queue.json           |
|  - id, username           |     |  - Approved assets for    |
|  - password_hash          |     |    PPC deployment         |
|  - email, role_id         |     |                           |
|                           |     |  /Assets/                 |
|  [roles]                  |     |  - Working asset files    |
|  - id, name               |     |  - Temporary storage      |
|                           |     |                           |
|  [screens]                |     |  /Assets Library/         |
|  - id, name               |     |  - Approved assets        |
|  - display_name           |     |  - Permanent storage      |
|                           |     |                           |
|  [role_screens]           |     |  campaigns.json (legacy)  |
|  - role_id, screen_id     |     |  brand_guidelines.json    |
|  - (RBAC permission map)  |     |  (legacy backup)          |
|                           |     |                           |
|  [brand_guidelines]       |     +===========================+
|  - tone, language         |
|  - typography (JSONB)     |
|  - palette (array)        |
|  - whitelist/blacklist    |
|                           |
|  [campaigns]              |
|  - brief, style_preset   |
|  - aspect_ratio, status   |
|                           |
|  [cmo_queue]              |
|  - url, title, type       |
|  - status (pending/       |
|    approved/rejected)     |
|                           |
+===========================+
```

---

## User Role Flowcharts

### Admin Role Flow

```
Admin Login
    |
    v
[Dashboard] ──> View platform metrics
    |
    +──> [Platform Config] ──> Set API keys (TikTok, Facebook, Gemini)
    |
    +──> [Company Profile] ──> Name, industry, website, location
    |
    +──> [User Management]
    |       |── View all registered users
    |       |── Delete/revoke user access
    |       └── POST /api/rbac/users (manage)
    |
    +──> [Role Management]
    |       |── Create/edit/delete roles
    |       |── Assign screens to roles (permission matrix)
    |       └── POST /api/rbac/role-permissions
    |
    +──> [Brand Guidelines]
    |       |── Set brand label, tone, language
    |       |── Define whitelist/blacklist terms
    |       |── Configure typography (fonts, sizes)
    |       |── Set color palette
    |       └── POST /api/guidelines
    |
    +──> [Creative Assets] ──> Browse /Assets Library
    |
    +──> [Global Calendar] ──> Monthly operations calendar
    |
    └──> [Logout]
```

### Expert Role Flow

```
Expert Login
    |
    v
[Dashboard] ──> View campaign overview
    |
    +──> [Campaign Objective]
    |       |── Select: Reach / Click / Sell
    |       └── Store in state.marketingData.objective
    |
    +──> [Target Audience]
    |       |── Add targeting sets:
    |       |   Country, Language, Age Min/Max, Gender
    |       └── Store in state.marketingData.targeting[]
    |
    +──> [Strategy Hub] (3-Phase AI Research)
    |       |
    |       |── Phase 1: Enter campaign brief
    |       |   └── POST /api/gemini/questions -> 5 Level-1 Qs
    |       |
    |       |── Phase 2: Answer Level-1 questions
    |       |   └── POST /api/gemini/follow-up -> 5 Level-2 Qs
    |       |
    |       └── Phase 3: Answer Level-2 questions
    |           └── Full strategy profile complete
    |
    +──> [Creative Config]
    |       |── Select style: Cinematic/Minimalism/Cyberpunk/Vintage
    |       |── Select ratio: 1:1 / 16:9 / 9:16
    |       |── Set counts: photos, videos, posts
    |       |── POST /api/campaigns (save)
    |       └── Download sample variations (Unsplash)
    |
    +──> [Creative Studio]
    |       |── Review assets in /Assets
    |       |── Approve -> copy to /Assets Library
    |       |── Dispatch to CMO Queue
    |       └── POST /api/cmo/queue
    |
    └──> [Logout]
```

### Business Admin (CMO) Role Flow

```
Business Admin Login
    |
    v
[Dashboard] ──> View financial metrics
    |
    +──> [Budget & Matrix]
    |       |── Set total budget
    |       |── Allocate: Reach % / Click % / Sales %
    |       └── Set expectation targets
    |
    +──> [Ad Approvals]
    |       |── GET /api/cmo/queue (fetch pending assets)
    |       |── Review each asset (preview + metadata)
    |       |── Toggle: Approve / Reject
    |       |── Approved assets -> PPC Queue
    |       └── POST /api/ppc/queue
    |
    +──> [AI Monitoring]
    |       |── Active ads count
    |       |── AI-killed ads count
    |       |── Auto-actions log
    |       └── Efficiency percentage
    |
    +──> [Ad Performance]
    |       └── Campaign performance table
    |
    +──> [Budget Overview]
    |       └── Spend tracking & allocation view
    |
    └──> [Logout]
```

### PPC Specialist Role Flow

```
PPC Login
    |
    v
[Dashboard] ──> View deployment metrics
    |
    +──> [Approved Assets]
    |       |── GET /api/ppc/queue
    |       |── View all CMO-approved assets
    |       └── Select assets for deployment
    |
    +──> [Platform Selection & Deploy]
    |       |
    |       |── Choose platforms:
    |       |   [x] Facebook  [x] TikTok  [ ] Instagram  [ ] YouTube
    |       |
    |       |── Facebook Config:
    |       |   |── Campaign name, Objective
    |       |   |── Daily budget, Start/end dates
    |       |   └── Page ID
    |       |
    |       |── TikTok Config:
    |       |   |── Campaign ID, Budget mode
    |       |   |── Placement, Pacing, Bid type
    |       |   |── Targeting (country, age, gender, interests)
    |       |   └── CTA (Learn More/Shop Now/Sign Up/Book Now)
    |       |
    |       |── Preview JSON payload
    |       |
    |       └── DEPLOY
    |           |── POST /api/deploy/facebook
    |           |── POST /api/deploy/tiktok-adgroup
    |           └── Display success report with IDs
    |
    +──> [Ad Performance]
    |       └── Live campaign metrics table
    |
    +──> [AI Monitoring]
    |       └── Performance dashboard
    |
    └──> [Logout]
```

---

## API Endpoint Map

```
/api
  |
  +-- /auth
  |     +-- POST /register        (Create user account)
  |     +-- POST /login            (Authenticate, return JWT + screens)
  |
  +-- /rbac
  |     +-- GET  /roles            (List all roles)
  |     +-- POST /roles            (Create role)
  |     +-- PUT  /roles/{id}       (Update role)
  |     +-- DELETE /roles/{id}     (Delete role)
  |     +-- GET  /screens          (List all screens)
  |     +-- GET  /users            (List users with roles)
  |     +-- DELETE /users/{id}     (Revoke user)
  |     +-- GET  /role-permissions/{roleId}   (Get role's screens)
  |     +-- POST /role-permissions            (Update role-screen map)
  |     +-- POST /seed             (Initialize default data)
  |
  +-- /guidelines
  |     +-- GET  /                 (Fetch latest brand guideline)
  |     +-- POST /                 (Save brand guideline)
  |
  +-- /campaigns
  |     +-- GET  /                 (List all campaigns)
  |     +-- POST /                 (Create campaign)
  |
  +-- /assets
  |     +-- GET  /                 (List /Assets files)
  |     +-- DELETE /{filename}     (Delete asset)
  |     +-- POST /save-url         (Download image from URL)
  |     +-- POST /approve          (Copy to /Assets Library)
  |
  +-- /assets-library
  |     +-- GET  /                 (List /Assets Library files)
  |
  +-- /cmo
  |     +-- GET  /queue            (Get CMO approval queue)
  |     +-- POST /queue            (Update CMO queue)
  |
  +-- /ppc
  |     +-- GET  /queue            (Get PPC dispatch queue)
  |     +-- POST /queue            (Update PPC queue)
  |
  +-- /gemini
  |     +-- POST /questions        (Generate Level-1 AI questions)
  |     +-- POST /follow-up        (Generate Level-2 AI questions)
  |
  +-- /deploy
  |     +-- POST /facebook         (Deploy ad to Facebook)
  |     +-- POST /tiktok-adgroup   (Deploy ad to TikTok)
  |
  +-- /test
        +-- GET  /facebook-connection  (Test Facebook API connection)
```

---

## Database Schema

```
+==================+       +==================+       +==================+
|     users        |       |     roles        |       |    screens       |
+==================+       +==================+       +==================+
| PK id       int  |  +--->| PK id       int  |  +-->| PK id       int  |
|    username  str  |  |   |    name      str  |  |  |    name      str  |
|    password  str  |  |   +==================+  |  |    display   str  |
|    email     str  |  |           |              |  +==================+
| FK role_id   int -+--+          |              |
|    created_at dt  |             v              |
+==================+    +==================+     |
                        |   role_screens   |     |
                        +==================+     |
                        | FK role_id   int |-----+
                        | FK screen_id int |-----+
                        +==================+
                         (Composite PK)

+========================+       +==================+
|   brand_guidelines     |       |    campaigns     |
+========================+       +==================+
| PK id           int    |       | PK id       int  |
|    brand_label   str   |       |    brief     str  |
|    tone          str   |       |    style     str  |
|    language      str   |       |    ratio     str  |
|    description   str   |       |    timestamp dt   |
|    whitelist     str   |       |    status    str  |
|    blacklist     str   |       +==================+
|    typography   JSONB  |
|    palette      arr    |       +==================+
|    updated_at    dt    |       |    cmo_queue     |
+========================+       +==================+
                                 | PK id       str  |
                                 |    url       str  |
                                 |    title     str  |
                                 |    type      str  |
                                 |    status    str  |
                                 |    added_at  dt   |
                                 +==================+
```

---

## Authentication Flow

```
CLIENT                           SERVER                          DATABASE
  |                                |                                |
  |  POST /api/auth/login          |                                |
  |  { username, password }        |                                |
  |------------------------------->|                                |
  |                                |  SELECT * FROM users           |
  |                                |  WHERE username = ?            |
  |                                |------------------------------->|
  |                                |         User record            |
  |                                |<-------------------------------|
  |                                |                                |
  |                                |  BCrypt.Verify(password, hash) |
  |                                |  [Password validation]         |
  |                                |                                |
  |                                |  SELECT r.name FROM roles r    |
  |                                |  WHERE r.id = user.role_id     |
  |                                |------------------------------->|
  |                                |         Role name              |
  |                                |<-------------------------------|
  |                                |                                |
  |                                |  SELECT s.name FROM screens s  |
  |                                |  JOIN role_screens rs          |
  |                                |  WHERE rs.role_id = ?          |
  |                                |------------------------------->|
  |                                |         Screen list            |
  |                                |<-------------------------------|
  |                                |                                |
  |                                |  Generate JWT Token:           |
  |                                |  { name, role, sub, iss,       |
  |                                |    aud, exp (8hr) }            |
  |                                |  Sign with HS256               |
  |                                |                                |
  |  { token, user: {             |                                |
  |    username, role, email,      |                                |
  |    screens[] } }               |                                |
  |<-------------------------------|                                |
  |                                |                                |
  |  Store in localStorage:        |                                |
  |  - token                       |                                |
  |  - user object                 |                                |
  |                                |                                |
  |  Render role-specific sidebar  |                                |
  |  based on screens[]            |                                |
```

---

## Deployment Pipeline Flow

### End-to-End Asset Deployment

```
+===========+     +=============+     +===============+     +===========+
|  EXPERT   |     |  BUSINESS   |     |     PPC       |     | AD        |
|  CREATES  | --> |  ADMIN      | --> |  SPECIALIST   | --> | PLATFORMS |
|  ASSETS   |     |  APPROVES   |     |  DEPLOYS      |     |           |
+===========+     +=============+     +===============+     +===========+
     |                  |                    |                    |
     v                  v                    v                    v
 /Assets/          CMO Queue           PPC Queue            Facebook
 (working)         (PostgreSQL)        (JSON file)          TikTok
                                                            Instagram*
                                                            YouTube*
                                                            (* planned)

                    ASSET STATUS TRANSITIONS
                    ========================

    [Created]  -->  [In Review]  -->  [CMO Approved]  -->  [Deployed]
        |               |                  |                   |
    /Assets/        CMO Queue          PPC Queue          /Assets Library/
                   status:pending     (authorized)        (permanent)

                         |
                    [CMO Rejected]
                   status:rejected
```

### Facebook Deployment Sequence

```
  PPC Frontend                    Backend API                Facebook Graph API
       |                              |                              |
       |  POST /api/deploy/facebook   |                              |
       |  { asset, config }           |                              |
       |----------------------------->|                              |
       |                              |  Read asset file             |
       |                              |  from /Assets Library        |
       |                              |                              |
       |                              |  POST /act_{ID}/videos       |
       |                              |  (or /adimages)              |
       |                              |----------------------------->|
       |                              |  { video_id / image_hash }   |
       |                              |<-----------------------------|
       |                              |                              |
       |                              |  POST /act_{ID}/campaigns    |
       |                              |  { name, objective,          |
       |                              |    status, special_cats }    |
       |                              |----------------------------->|
       |                              |  { id: CAMPAIGN_ID }         |
       |                              |<-----------------------------|
       |                              |                              |
       |                              |  POST /act_{ID}/adsets       |
       |                              |  { campaign_id, name,        |
       |                              |    daily_budget, targeting,  |
       |                              |    billing_event, start }    |
       |                              |----------------------------->|
       |                              |  { id: ADSET_ID }           |
       |                              |<-----------------------------|
       |                              |                              |
       |                              |  POST /act_{ID}/adcreatives  |
       |                              |  { object_story_spec:        |
       |                              |    { page_id, video_data     |
       |                              |      OR link_data } }        |
       |                              |----------------------------->|
       |                              |  { id: CREATIVE_ID }         |
       |                              |<-----------------------------|
       |                              |                              |
       |                              |  POST /act_{ID}/ads          |
       |                              |  { adset_id, creative_id,   |
       |                              |    name, status }            |
       |                              |----------------------------->|
       |                              |  { id: AD_ID }              |
       |                              |<-----------------------------|
       |                              |                              |
       |  { campaignId, adSetId,      |                              |
       |    creativeId, adId }        |                              |
       |<-----------------------------|                              |
```

---

## External Integration Points

```
+=====================================================================+
|                    EXTERNAL SERVICE MAP                              |
+=====================================================================+
|                                                                     |
|  +-------------------+    +--------------------+                    |
|  | Google Gemini     |    | Facebook Graph     |                    |
|  | API v2.0 Flash    |    | API v19.0          |                    |
|  +-------------------+    +--------------------+                    |
|  | Endpoint:         |    | Endpoint:          |                    |
|  | generativelanguage|    | graph.facebook.com |                    |
|  | .googleapis.com   |    |                    |                    |
|  |                   |    | Auth: Access Token |                    |
|  | Auth: API Key     |    | Account:           |                    |
|  |                   |    | act_253789304986   |                    |
|  | Used for:         |    |                    |                    |
|  | - Level 1 Qs      |    | Used for:          |                    |
|  | - Level 2 Qs      |    | - Campaign CRUD    |                    |
|  | - Strategy        |    | - AdSet CRUD       |                    |
|  |   generation      |    | - Creative upload  |                    |
|  |                   |    | - Ad deployment    |                    |
|  | Cache: In-memory  |    | Fallback: Mock IDs |                    |
|  | Retry: 3x backoff |    +--------------------+                    |
|  +-------------------+                                              |
|                                                                     |
|  +-------------------+    +--------------------+                    |
|  | TikTok Business   |    | Unsplash           |                    |
|  | API v1.3          |    | (Image Source)      |                    |
|  +-------------------+    +--------------------+                    |
|  | Endpoint:         |    | Used for:          |                    |
|  | business-api      |    | - Sample variation |                    |
|  | .tiktok.com       |    |   downloads during |                    |
|  |                   |    |   creative config  |                    |
|  | Auth: Access Token|    +--------------------+                    |
|  | (via header)      |                                              |
|  |                   |                                              |
|  | Used for:         |                                              |
|  | - Ad Group create |                                              |
|  | - Ad Creative     |                                              |
|  |                   |                                              |
|  | Fallback:         |                                              |
|  | Simulation mode   |                                              |
|  +-------------------+                                              |
|                                                                     |
+=====================================================================+
```

---

*Generated on 2026-03-31 | AI-Marketing Platform Documentation*
