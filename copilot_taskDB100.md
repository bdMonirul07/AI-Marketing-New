# TaskDB100: Complete Database Design for Multi-Tenant AI-Marketing Platform

---

## Table of Contents

1. [Current Database Audit](#1-current-database-audit)
2. [Modification Summary](#2-modification-summary)
3. [Tables to Modify (Existing)](#3-tables-to-modify-existing---7-tables)
4. [Tables to Create (New)](#4-tables-to-create-new---21-tables)
5. [Complete Table Count](#5-complete-table-count)
6. [Full Entity-Relationship Diagram](#6-full-entity-relationship-diagram)
7. [Detailed Table Definitions](#7-detailed-table-definitions)
8. [Indexes & Constraints](#8-indexes--constraints)
9. [Migration Strategy](#9-migration-strategy)
10. [Seed Data Plan](#10-seed-data-plan)

---

## 1. Current Database Audit

### Existing Tables (7 tables currently in PostgreSQL)

| # | Table Name         | Entity Class    | Rows (est.) | Purpose                        |
|---|--------------------|-----------------|-----------  |--------------------------------|
| 1 | `users`            | `User`          | ~4          | User accounts & credentials    |
| 2 | `roles`            | `Role`          | ~4          | Role definitions               |
| 3 | `screens`          | `Screen`        | ~20         | UI screen/page definitions     |
| 4 | `role_screens`     | `RoleScreen`    | ~30         | RBAC permission matrix         |
| 5 | `brand_guidelines` | `BrandGuideline`| ~1          | Brand identity config          |
| 6 | `campaigns`        | `Campaign`      | ~5          | Campaign records               |
| 7 | `cmo_queue`        | `CmoQueueItem`  | ~10         | CMO approval queue items       |

### Current File-Based Storage (to be migrated to DB)

| File                | Purpose                     | Migration Target       |
|---------------------|-----------------------------|------------------------|
| `ppc_queue.json`    | PPP deployment queue        | New `ppp_queue` table  |
| `campaigns.json`    | Legacy campaign backup      | Merge into `campaigns` |
| `brand_guidelines.json` | Legacy guideline backup | Already in DB          |
| `cmo_queue.json`    | Legacy CMO queue            | Already in DB          |

---

## 2. Modification Summary

```
+=================================================================+
|               DATABASE MODIFICATION OVERVIEW                     |
+=================================================================+
|                                                                  |
|  EXISTING TABLES TO MODIFY:  7 tables                           |
|  ----------------------------------------                       |
|  1. users             -> Add company_id, is_super_admin          |
|  2. roles             -> Add company_id, is_system_role          |
|  3. screens           -> Add category, icon, sort_order          |
|  4. role_screens      -> Add company_id                          |
|  5. brand_guidelines  -> Add company_id                          |
|  6. campaigns         -> Add 15+ new columns (full lifecycle)    |
|  7. cmo_queue         -> Add company_id, reviewer fields         |
|                                                                  |
|  NEW TABLES TO CREATE:  21 tables                                |
|  ----------------------------------------                       |
|   8. companies               (multi-tenancy core)               |
|   9. company_settings        (per-company config)               |
|  10. company_ad_accounts     (platform credentials)             |
|  11. ppp_queue               (replaces ppc_queue.json)          |
|  12. campaign_objectives     (objective lookup)                 |
|  13. ad_sets                 (ad group level)                   |
|  14. ads                     (individual ads)                   |
|  15. ad_creatives            (creative assets per ad)           |
|  16. campaign_workflow_steps (workflow state machine)            |
|  17. ad_metrics              (performance data)                 |
|  18. deployment_logs         (deployment audit trail)           |
|  19. approval_comments       (review feedback)                  |
|  20. notifications           (in-app notifications)             |
|  21. refresh_tokens          (JWT refresh tokens)               |
|  22. invitations             (team member invites)              |
|  23. ab_tests                (A/B testing framework)            |
|  24. budget_allocations      (budget management)                |
|  25. activity_logs           (audit trail)                      |
|  26. campaign_templates      (reusable templates)               |
|  27. audience_templates      (saved audiences)                  |
|  28. asset_library           (DB-tracked assets)                |
|                                                                  |
|  TOTAL TABLES AFTER MIGRATION:  28 tables                       |
|                                                                  |
+=================================================================+
```

---

## 3. Tables to Modify (Existing - 7 Tables)

### 3.1 `users` Table - MODIFY

**Current columns:**
```sql
id              INT         PK, auto-increment
username        VARCHAR
password_hash   VARCHAR
email           VARCHAR
role_id         INT         FK -> roles.id
created_at      TIMESTAMP
```

**Columns to ADD:**
```sql
company_id      INT         FK -> companies.id, NULLABLE (null = Super Admin)
is_super_admin  BOOLEAN     DEFAULT false
first_name      VARCHAR     NULLABLE
last_name       VARCHAR     NULLABLE
avatar_url      VARCHAR     NULLABLE
phone           VARCHAR     NULLABLE
status          VARCHAR     DEFAULT 'active'  -- active / suspended / deactivated
last_login_at   TIMESTAMP   NULLABLE
updated_at      TIMESTAMP   DEFAULT NOW()
```

**After modification:**
```
+-------------------------------------------------------------------+
|                          users (MODIFIED)                           |
+-------------------------------------------------------------------+
| PK  id              INT           auto-increment                   |
|     username         VARCHAR       NOT NULL, UNIQUE per company     |
|     password_hash    VARCHAR       NOT NULL                         |
|     email            VARCHAR       NOT NULL                         |
|     first_name       VARCHAR       NULLABLE                    NEW |
|     last_name        VARCHAR       NULLABLE                    NEW |
|     avatar_url       VARCHAR       NULLABLE                    NEW |
|     phone            VARCHAR       NULLABLE                    NEW |
| FK  role_id          INT           -> roles.id                     |
| FK  company_id       INT NULLABLE  -> companies.id             NEW |
|     is_super_admin   BOOLEAN       DEFAULT false               NEW |
|     status           VARCHAR       DEFAULT 'active'            NEW |
|     last_login_at    TIMESTAMP     NULLABLE                    NEW |
|     created_at       TIMESTAMP     DEFAULT NOW()                   |
|     updated_at       TIMESTAMP     DEFAULT NOW()               NEW |
+-------------------------------------------------------------------+
| INDEX: idx_users_company  (company_id)                         NEW |
| INDEX: idx_users_email    (email)                              NEW |
| UNIQUE: uq_users_username_company (username, company_id)       NEW |
+-------------------------------------------------------------------+
```

---

### 3.2 `roles` Table - MODIFY

**Current columns:**
```sql
id              INT         PK
name            VARCHAR     NOT NULL
```

**Columns to ADD:**
```sql
company_id      INT         FK -> companies.id, NULLABLE (null = system/global role)
description     VARCHAR     NULLABLE
is_system_role  BOOLEAN     DEFAULT false  -- true for Admin/CMO/PPP/Expert (cannot delete)
color           VARCHAR     NULLABLE       -- theme color for role badge
icon            VARCHAR     NULLABLE       -- display icon/letter
created_at      TIMESTAMP   DEFAULT NOW()
```

**After modification:**
```
+-------------------------------------------------------------------+
|                          roles (MODIFIED)                           |
+-------------------------------------------------------------------+
| PK  id              INT           auto-increment                   |
|     name             VARCHAR       NOT NULL                         |
| FK  company_id       INT NULLABLE  -> companies.id             NEW |
|     description      VARCHAR       NULLABLE                    NEW |
|     is_system_role   BOOLEAN       DEFAULT false               NEW |
|     color            VARCHAR       NULLABLE                    NEW |
|     icon             VARCHAR       NULLABLE                    NEW |
|     created_at       TIMESTAMP     DEFAULT NOW()               NEW |
+-------------------------------------------------------------------+
| INDEX: idx_roles_company  (company_id)                         NEW |
| UNIQUE: uq_roles_name_company (name, company_id)              NEW |
+-------------------------------------------------------------------+
```

---

### 3.3 `screens` Table - MODIFY

**Current columns:**
```sql
id              INT         PK
name            VARCHAR     NOT NULL
display_name    VARCHAR
```

**Columns to ADD:**
```sql
category        VARCHAR     -- expert / cmo / ppp / admin / super_admin / shared
icon            VARCHAR     NULLABLE  -- emoji or icon class
sort_order      INT         DEFAULT 0
is_active       BOOLEAN     DEFAULT true
description     VARCHAR     NULLABLE
```

**After modification:**
```
+-------------------------------------------------------------------+
|                         screens (MODIFIED)                          |
+-------------------------------------------------------------------+
| PK  id              INT           auto-increment                   |
|     name             VARCHAR       NOT NULL, UNIQUE                 |
|     display_name     VARCHAR                                        |
|     category         VARCHAR       NULLABLE                    NEW |
|     icon             VARCHAR       NULLABLE                    NEW |
|     sort_order       INT           DEFAULT 0                   NEW |
|     is_active        BOOLEAN       DEFAULT true                NEW |
|     description      VARCHAR       NULLABLE                    NEW |
+-------------------------------------------------------------------+
```

---

### 3.4 `role_screens` Table - MODIFY

**Current columns:**
```sql
role_id         INT         FK -> roles.id  (Composite PK)
screen_id       INT         FK -> screens.id (Composite PK)
```

**Columns to ADD:**
```sql
company_id      INT         FK -> companies.id, NULLABLE
granted_at      TIMESTAMP   DEFAULT NOW()
granted_by      INT         FK -> users.id, NULLABLE
```

**After modification:**
```
+-------------------------------------------------------------------+
|                      role_screens (MODIFIED)                        |
+-------------------------------------------------------------------+
| CPK role_id          INT           FK -> roles.id                   |
| CPK screen_id        INT           FK -> screens.id                 |
| FK  company_id       INT NULLABLE  -> companies.id             NEW |
| FK  granted_by       INT NULLABLE  -> users.id                 NEW |
|     granted_at       TIMESTAMP     DEFAULT NOW()               NEW |
+-------------------------------------------------------------------+
| INDEX: idx_rolescreens_company (company_id)                    NEW |
+-------------------------------------------------------------------+
```

---

### 3.5 `brand_guidelines` Table - MODIFY

**Current columns:**
```sql
id              INT         PK
brand_label     VARCHAR
tone            VARCHAR
language        VARCHAR
description     VARCHAR
whitelist       TEXT
blacklist       TEXT
typography      JSONB
palette         TEXT[]
updated_at      TIMESTAMP
```

**Columns to ADD:**
```sql
company_id      INT         FK -> companies.id, NOT NULL
logo_url        VARCHAR     NULLABLE
tagline         VARCHAR     NULLABLE
voice_examples  TEXT        NULLABLE  -- example copy in brand voice
do_list         TEXT        NULLABLE  -- brand dos
dont_list       TEXT        NULLABLE  -- brand don'ts
created_by      INT         FK -> users.id, NULLABLE
created_at      TIMESTAMP   DEFAULT NOW()
```

**After modification:**
```
+-------------------------------------------------------------------+
|                   brand_guidelines (MODIFIED)                       |
+-------------------------------------------------------------------+
| PK  id              INT           auto-increment                   |
| FK  company_id       INT          -> companies.id              NEW |
|     brand_label      VARCHAR                                        |
|     tone             VARCHAR                                        |
|     language         VARCHAR                                        |
|     description      VARCHAR                                        |
|     tagline          VARCHAR       NULLABLE                    NEW |
|     logo_url         VARCHAR       NULLABLE                    NEW |
|     whitelist        TEXT                                           |
|     blacklist        TEXT                                           |
|     voice_examples   TEXT          NULLABLE                    NEW |
|     do_list          TEXT          NULLABLE                    NEW |
|     dont_list        TEXT          NULLABLE                    NEW |
|     typography       JSONB                                         |
|     palette          TEXT[]                                        |
| FK  created_by       INT NULLABLE  -> users.id                 NEW |
|     created_at       TIMESTAMP     DEFAULT NOW()               NEW |
|     updated_at       TIMESTAMP     DEFAULT NOW()                   |
+-------------------------------------------------------------------+
| INDEX: idx_guidelines_company (company_id)                     NEW |
+-------------------------------------------------------------------+
```

---

### 3.6 `campaigns` Table - MAJOR MODIFY

**Current columns:**
```sql
id              INT         PK
brief           TEXT
style_preset    VARCHAR
aspect_ratio    VARCHAR
timestamp       TIMESTAMP
status          VARCHAR     DEFAULT 'pending'
```

**Columns to ADD:**
```sql
company_id          INT         FK -> companies.id, NOT NULL
name                VARCHAR     NOT NULL  -- human-readable campaign name
objective_id        INT         FK -> campaign_objectives.id, NULLABLE
campaign_type       VARCHAR     DEFAULT 'standard'  -- standard / ab_test / dynamic
total_budget        DECIMAL     NULLABLE
daily_budget        DECIMAL     NULLABLE
lifetime_budget     DECIMAL     NULLABLE
bid_strategy        VARCHAR     NULLABLE  -- lowest_cost / cost_cap / bid_cap
currency            VARCHAR     DEFAULT 'USD'
start_date          TIMESTAMP   NULLABLE
end_date            TIMESTAMP   NULLABLE
platforms           TEXT[]      DEFAULT '{}'  -- {"facebook","tiktok","youtube","google"}
targeting           JSONB       NULLABLE  -- full targeting spec
created_by          INT         FK -> users.id
approved_by         INT         FK -> users.id, NULLABLE
deployed_by         INT         FK -> users.id, NULLABLE
approved_at         TIMESTAMP   NULLABLE
deployed_at         TIMESTAMP   NULLABLE
completed_at        TIMESTAMP   NULLABLE
rejection_reason    TEXT        NULLABLE
created_at          TIMESTAMP   DEFAULT NOW()  (replaces timestamp)
updated_at          TIMESTAMP   DEFAULT NOW()
```

**Status values expanded:** `draft -> pending_review -> approved -> rejected -> deploying -> active -> paused -> completed -> archived`

**After modification:**
```
+-------------------------------------------------------------------+
|                       campaigns (MODIFIED)                          |
+-------------------------------------------------------------------+
| PK  id                INT           auto-increment                  |
| FK  company_id        INT           -> companies.id            NEW |
|     name              VARCHAR       NOT NULL                   NEW |
| FK  objective_id      INT NULLABLE  -> campaign_objectives.id  NEW |
|     campaign_type     VARCHAR       DEFAULT 'standard'         NEW |
|     brief             TEXT                                          |
|     style_preset      VARCHAR                                       |
|     aspect_ratio      VARCHAR                                       |
|     total_budget       DECIMAL      NULLABLE                   NEW |
|     daily_budget       DECIMAL      NULLABLE                   NEW |
|     lifetime_budget    DECIMAL      NULLABLE                   NEW |
|     bid_strategy       VARCHAR      NULLABLE                   NEW |
|     currency           VARCHAR      DEFAULT 'USD'              NEW |
|     start_date         TIMESTAMP    NULLABLE                   NEW |
|     end_date           TIMESTAMP    NULLABLE                   NEW |
|     platforms          TEXT[]       DEFAULT '{}'                NEW |
|     targeting          JSONB        NULLABLE                   NEW |
|     status             VARCHAR      DEFAULT 'draft'        CHANGED |
|     rejection_reason   TEXT         NULLABLE                   NEW |
| FK  created_by         INT          -> users.id                NEW |
| FK  approved_by        INT NULLABLE -> users.id                NEW |
| FK  deployed_by        INT NULLABLE -> users.id                NEW |
|     approved_at        TIMESTAMP    NULLABLE                   NEW |
|     deployed_at        TIMESTAMP    NULLABLE                   NEW |
|     completed_at       TIMESTAMP    NULLABLE                   NEW |
|     created_at         TIMESTAMP    DEFAULT NOW()          RENAMED |
|     updated_at         TIMESTAMP    DEFAULT NOW()              NEW |
+-------------------------------------------------------------------+
| INDEX: idx_campaigns_company (company_id)                      NEW |
| INDEX: idx_campaigns_status  (status)                          NEW |
| INDEX: idx_campaigns_dates   (start_date, end_date)            NEW |
+-------------------------------------------------------------------+
```

---

### 3.7 `cmo_queue` Table - MODIFY

**Current columns:**
```sql
id              VARCHAR     PK
url             VARCHAR
title           VARCHAR
type            VARCHAR
status          VARCHAR     DEFAULT 'pending'
added_at        TIMESTAMP
```

**Columns to ADD:**
```sql
company_id      INT         FK -> companies.id, NOT NULL
campaign_id     INT         FK -> campaigns.id, NULLABLE
ad_id           INT         FK -> ads.id, NULLABLE
submitted_by    INT         FK -> users.id, NULLABLE
reviewed_by     INT         FK -> users.id, NULLABLE
reviewed_at     TIMESTAMP   NULLABLE
review_notes    TEXT        NULLABLE
priority        INT         DEFAULT 0  -- 0=normal, 1=high, 2=urgent
```

**After modification:**
```
+-------------------------------------------------------------------+
|                       cmo_queue (MODIFIED)                          |
+-------------------------------------------------------------------+
| PK  id              VARCHAR       (asset filename)                  |
| FK  company_id       INT          -> companies.id              NEW |
| FK  campaign_id      INT NULLABLE -> campaigns.id              NEW |
| FK  ad_id            INT NULLABLE -> ads.id                    NEW |
|     url              VARCHAR                                        |
|     title            VARCHAR                                        |
|     type             VARCHAR       -- image / video                 |
|     status           VARCHAR       DEFAULT 'pending'                |
|     priority         INT           DEFAULT 0                   NEW |
| FK  submitted_by     INT NULLABLE  -> users.id                 NEW |
| FK  reviewed_by      INT NULLABLE  -> users.id                 NEW |
|     reviewed_at      TIMESTAMP     NULLABLE                    NEW |
|     review_notes     TEXT          NULLABLE                    NEW |
|     added_at         TIMESTAMP     DEFAULT NOW()                    |
+-------------------------------------------------------------------+
| INDEX: idx_cmoqueue_company (company_id)                       NEW |
| INDEX: idx_cmoqueue_status  (company_id, status)               NEW |
+-------------------------------------------------------------------+
```

---

## 4. Tables to Create (New - 21 Tables)

### 4.1 `companies` Table - NEW (Core Multi-Tenancy)

```
+===================================================================+
|                     TABLE 8: companies (NEW)                       |
+===================================================================+
| PK  id              INT           auto-increment                   |
|     name             VARCHAR(200)  NOT NULL                         |
|     slug             VARCHAR(100)  NOT NULL, UNIQUE                 |
|     industry         VARCHAR(100)  NULLABLE                        |
|     website          VARCHAR(500)  NULLABLE                        |
|     logo_url         VARCHAR(500)  NULLABLE                        |
|     email            VARCHAR(200)  NULLABLE                        |
|     phone            VARCHAR(50)   NULLABLE                        |
|     address          TEXT          NULLABLE                        |
|     country          VARCHAR(100)  NULLABLE                        |
|     timezone         VARCHAR(50)   DEFAULT 'UTC'                   |
|     currency         VARCHAR(10)   DEFAULT 'USD'                   |
|     status           VARCHAR(20)   DEFAULT 'active'                |
|                                    -- active / suspended / archived |
|     subscription_plan VARCHAR(50)  DEFAULT 'free'                  |
|                                    -- free / starter / pro / enterprise |
|     max_users        INT           DEFAULT 10                      |
|     max_campaigns    INT           DEFAULT 50                      |
| FK  created_by       INT NULLABLE  -> users.id (Super Admin)       |
|     created_at       TIMESTAMP     DEFAULT NOW()                   |
|     updated_at       TIMESTAMP     DEFAULT NOW()                   |
+===================================================================+
| UNIQUE: uq_companies_slug (slug)                                   |
| INDEX:  idx_companies_status (status)                              |
+===================================================================+
```

**Purpose:** Central multi-tenancy table. Every company gets isolated data. Super Admin manages all companies.

---

### 4.2 `company_settings` Table - NEW

```
+===================================================================+
|                  TABLE 9: company_settings (NEW)                   |
+===================================================================+
| PK  id                    INT           auto-increment              |
| FK  company_id            INT           -> companies.id, UNIQUE     |
|     default_language      VARCHAR(10)   DEFAULT 'en'                |
|     notification_email    VARCHAR(200)  NULLABLE                    |
|     max_daily_budget      DECIMAL(12,2) NULLABLE                   |
|     auto_approve_below    DECIMAL(12,2) NULLABLE                   |
|                           -- auto-approve campaigns below this $    |
|     require_cmo_approval  BOOLEAN       DEFAULT true                |
|     require_brand_check   BOOLEAN       DEFAULT false               |
|     default_bid_strategy  VARCHAR(50)   DEFAULT 'lowest_cost'       |
|     default_platforms     TEXT[]        DEFAULT '{"facebook"}'       |
|     gemini_api_key        VARCHAR(500)  NULLABLE (encrypted)        |
|     created_at            TIMESTAMP     DEFAULT NOW()               |
|     updated_at            TIMESTAMP     DEFAULT NOW()               |
+===================================================================+
| UNIQUE: uq_settings_company (company_id)                           |
+===================================================================+
```

**Purpose:** Per-company configuration. Decouples settings from hard-coded `appsettings.json`.

---

### 4.3 `company_ad_accounts` Table - NEW

```
+===================================================================+
|                TABLE 10: company_ad_accounts (NEW)                  |
+===================================================================+
| PK  id                INT           auto-increment                  |
| FK  company_id        INT           -> companies.id                 |
|     platform          VARCHAR(50)   NOT NULL                        |
|                       -- facebook / tiktok / youtube / google_ads    |
|     account_name      VARCHAR(200)  NULLABLE (friendly name)        |
|     account_id        VARCHAR(200)  NOT NULL                        |
|                       -- e.g., act_2537893049860881                  |
|     access_token      TEXT          NOT NULL (encrypted)             |
|     refresh_token     TEXT          NULLABLE (encrypted)             |
|     token_expires_at  TIMESTAMP     NULLABLE                        |
|     page_id           VARCHAR(200)  NULLABLE (Facebook page)         |
|     pixel_id          VARCHAR(200)  NULLABLE (tracking pixel)        |
|     developer_token   VARCHAR(200)  NULLABLE (Google Ads)            |
|     customer_id       VARCHAR(200)  NULLABLE (Google Ads)            |
|     status            VARCHAR(20)   DEFAULT 'active'                 |
|                       -- active / expired / revoked / error          |
|     last_tested_at    TIMESTAMP     NULLABLE                         |
|     last_error        TEXT          NULLABLE                         |
|     created_at        TIMESTAMP     DEFAULT NOW()                    |
|     updated_at        TIMESTAMP     DEFAULT NOW()                    |
+===================================================================+
| INDEX:  idx_adaccounts_company (company_id)                         |
| UNIQUE: uq_adaccounts_platform (company_id, platform, account_id)  |
+===================================================================+
```

**Purpose:** Replaces hard-coded tokens in `appsettings.json`. Each company stores its own ad platform credentials.

---

### 4.4 `ppp_queue` Table - NEW (Replaces ppc_queue.json)

```
+===================================================================+
|                     TABLE 11: ppp_queue (NEW)                      |
+===================================================================+
| PK  id              INT           auto-increment                    |
| FK  company_id      INT           -> companies.id                   |
| FK  campaign_id     INT NULLABLE  -> campaigns.id                   |
| FK  ad_id           INT NULLABLE  -> ads.id                         |
|     asset_filename  VARCHAR(500)  NOT NULL                          |
|     asset_url       VARCHAR(1000) NOT NULL                          |
|     asset_type      VARCHAR(20)   NOT NULL -- image / video          |
|     title           VARCHAR(500)  NULLABLE                          |
|     status          VARCHAR(20)   DEFAULT 'pending'                  |
|                     -- pending / selected / deploying / deployed / failed |
|     queue_index     INT           DEFAULT 0                          |
| FK  approved_by     INT NULLABLE  -> users.id (CMO who approved)     |
|     approved_at     TIMESTAMP     NULLABLE                           |
| FK  deployed_by     INT NULLABLE  -> users.id (PPP who deployed)     |
|     deployed_at     TIMESTAMP     NULLABLE                           |
|     deploy_platforms TEXT[]       NULLABLE -- platforms deployed to   |
|     added_at        TIMESTAMP     DEFAULT NOW()                      |
+===================================================================+
| INDEX: idx_pppqueue_company (company_id)                            |
| INDEX: idx_pppqueue_status  (company_id, status)                    |
+===================================================================+
```

**Purpose:** Replaces file-based `ppc_queue.json`. Now database-backed with company isolation.

---

### 4.5 `campaign_objectives` Table - NEW (Lookup)

```
+===================================================================+
|                TABLE 12: campaign_objectives (NEW)                  |
+===================================================================+
| PK  id              INT           auto-increment                    |
|     category        VARCHAR(50)   NOT NULL                          |
|                     -- awareness / consideration / conversion        |
|     name            VARCHAR(100)  NOT NULL                          |
|                     -- e.g., "Brand Awareness", "Traffic", "Sales"   |
|     description     TEXT          NULLABLE                          |
|     icon            VARCHAR(10)   NULLABLE                          |
|     platform_mapping JSONB        NOT NULL                          |
|                     -- {                                             |
|                     --   "facebook": "OUTCOME_AWARENESS",            |
|                     --   "tiktok": "REACH",                          |
|                     --   "youtube": "VIDEO_VIEWS",                   |
|                     --   "google_ads": "AWARENESS"                   |
|                     -- }                                             |
|     supported_platforms TEXT[]    DEFAULT '{"facebook","tiktok"}'    |
|     sort_order      INT          DEFAULT 0                          |
|     is_active       BOOLEAN      DEFAULT true                       |
+===================================================================+
```

**Purpose:** Standardized objectives across all platforms. Maps our objectives to each platform's API enum.

---

### 4.6 `ad_sets` Table - NEW

```
+===================================================================+
|                      TABLE 13: ad_sets (NEW)                       |
+===================================================================+
| PK  id                INT           auto-increment                  |
| FK  company_id        INT           -> companies.id                 |
| FK  campaign_id       INT           -> campaigns.id                 |
|     name              VARCHAR(200)  NOT NULL                        |
|     status            VARCHAR(20)   DEFAULT 'draft'                 |
|                       -- draft / active / paused / completed / deleted |
|     daily_budget      DECIMAL(12,2) NULLABLE                       |
|     lifetime_budget   DECIMAL(12,2) NULLABLE                       |
|     bid_strategy      VARCHAR(50)   NULLABLE                       |
|     bid_amount        DECIMAL(12,2) NULLABLE                       |
|     optimization_goal VARCHAR(50)   NULLABLE                       |
|                       -- link_clicks / impressions / conversions     |
|     billing_event     VARCHAR(50)   DEFAULT 'IMPRESSIONS'           |
|     start_time        TIMESTAMP     NULLABLE                        |
|     end_time          TIMESTAMP     NULLABLE                        |
|     targeting         JSONB         NULLABLE                        |
|                       -- {                                           |
|                       --   "geo_locations": {"countries":["US"]},    |
|                       --   "age_min": 18, "age_max": 65,            |
|                       --   "genders": [1,2],                         |
|                       --   "interests": [...],                       |
|                       --   "custom_audiences": [...],                |
|                       --   "excluded_audiences": [...]               |
|                       -- }                                           |
|     placements        JSONB         NULLABLE                        |
|                       -- {                                           |
|                       --   "facebook": ["feed","stories","reels"],   |
|                       --   "tiktok": ["for_you","pangle"],           |
|                       --   "youtube": ["in_stream","shorts"]         |
|                       -- }                                           |
|     schedule          JSONB         NULLABLE -- dayparting rules     |
|     platform_adset_ids JSONB        NULLABLE                        |
|                       -- {"facebook":"123","tiktok":"456"}           |
| FK  created_by        INT           -> users.id                     |
|     created_at        TIMESTAMP     DEFAULT NOW()                   |
|     updated_at        TIMESTAMP     DEFAULT NOW()                   |
+===================================================================+
| INDEX: idx_adsets_campaign (campaign_id)                            |
| INDEX: idx_adsets_company  (company_id)                             |
+===================================================================+
```

**Purpose:** Ad group level - sits between Campaign and Ad. Holds targeting, budget, and placement config.

---

### 4.7 `ads` Table - NEW

```
+===================================================================+
|                        TABLE 14: ads (NEW)                          |
+===================================================================+
| PK  id                INT           auto-increment                  |
| FK  company_id        INT           -> companies.id                 |
| FK  ad_set_id         INT           -> ad_sets.id                   |
|     name              VARCHAR(200)  NOT NULL                        |
|     status            VARCHAR(20)   DEFAULT 'draft'                 |
|                       -- draft / pending_review / approved /         |
|                       -- rejected / active / paused / archived       |
|     headline          VARCHAR(500)  NULLABLE                        |
|     description       TEXT          NULLABLE                        |
|     cta_type          VARCHAR(50)   NULLABLE                        |
|                       -- LEARN_MORE / SHOP_NOW / SIGN_UP /           |
|                       -- BOOK_NOW / DOWNLOAD / CONTACT_US            |
|     cta_link          VARCHAR(1000) NULLABLE                        |
|     platform_ad_ids   JSONB         NULLABLE                        |
|                       -- {"facebook":"ad_123","tiktok":"ad_456"}     |
|     review_status     VARCHAR(20)   DEFAULT 'pending'               |
|                       -- pending / approved / rejected               |
| FK  created_by        INT           -> users.id                     |
| FK  reviewed_by       INT NULLABLE  -> users.id                     |
|     reviewed_at       TIMESTAMP     NULLABLE                        |
|     review_notes      TEXT          NULLABLE                        |
|     created_at        TIMESTAMP     DEFAULT NOW()                   |
|     updated_at        TIMESTAMP     DEFAULT NOW()                   |
+===================================================================+
| INDEX: idx_ads_adset   (ad_set_id)                                  |
| INDEX: idx_ads_company (company_id)                                 |
| INDEX: idx_ads_status  (company_id, status)                         |
+===================================================================+
```

**Purpose:** Individual ad entity. Maps to a specific creative + copy combination within an ad set.

---

### 4.8 `ad_creatives` Table - NEW

```
+===================================================================+
|                    TABLE 15: ad_creatives (NEW)                     |
+===================================================================+
| PK  id                  INT           auto-increment                |
| FK  company_id          INT           -> companies.id               |
| FK  ad_id               INT           -> ads.id                     |
|     creative_type       VARCHAR(30)   NOT NULL                      |
|                         -- image / video / carousel / slideshow      |
|     asset_url           VARCHAR(1000) NOT NULL                      |
|     asset_filename      VARCHAR(500)  NULLABLE                      |
|     thumbnail_url       VARCHAR(1000) NULLABLE                      |
|     primary_text        TEXT          NULLABLE -- main ad copy       |
|     headline            VARCHAR(500)  NULLABLE                      |
|     description         TEXT          NULLABLE                      |
|     cta_type            VARCHAR(50)   NULLABLE                      |
|     cta_link            VARCHAR(1000) NULLABLE                      |
|     platform_creative_ids JSONB       NULLABLE                      |
|                         -- {"facebook":"cr_123","tiktok":"cr_456"}   |
|     file_size_bytes     BIGINT        NULLABLE                      |
|     width               INT           NULLABLE                      |
|     height              INT           NULLABLE                      |
|     duration_seconds    INT           NULLABLE (for video)           |
|     created_at          TIMESTAMP     DEFAULT NOW()                 |
+===================================================================+
| INDEX: idx_creatives_ad      (ad_id)                                |
| INDEX: idx_creatives_company (company_id)                           |
+===================================================================+
```

**Purpose:** Stores creative assets linked to individual ads. One ad can have multiple creatives (carousel).

---

### 4.9 `campaign_workflow_steps` Table - NEW

```
+===================================================================+
|              TABLE 16: campaign_workflow_steps (NEW)                |
+===================================================================+
| PK  id              INT           auto-increment                    |
| FK  campaign_id     INT           -> campaigns.id                   |
|     step_name       VARCHAR(50)   NOT NULL                          |
|                     -- objective / targeting / strategy /             |
|                     -- adset_config / creative / review / deploy      |
|     step_order      INT           NOT NULL                          |
|     status          VARCHAR(20)   DEFAULT 'not_started'              |
|                     -- not_started / in_progress / completed / skipped|
|     data            JSONB         NULLABLE -- step payload snapshot  |
|     notes           TEXT          NULLABLE                          |
| FK  completed_by    INT NULLABLE  -> users.id                       |
|     started_at      TIMESTAMP     NULLABLE                          |
|     completed_at    TIMESTAMP     NULLABLE                          |
+===================================================================+
| INDEX: idx_workflow_campaign (campaign_id)                           |
| UNIQUE: uq_workflow_step (campaign_id, step_name)                   |
+===================================================================+
```

**Purpose:** Tracks campaign creation wizard progress. Each campaign has 7 steps.

---

### 4.10 `ad_metrics` Table - NEW

```
+===================================================================+
|                    TABLE 17: ad_metrics (NEW)                      |
+===================================================================+
| PK  id                INT           auto-increment                  |
| FK  company_id        INT           -> companies.id                 |
| FK  campaign_id       INT           -> campaigns.id                 |
| FK  ad_set_id         INT NULLABLE  -> ad_sets.id                   |
| FK  ad_id             INT NULLABLE  -> ads.id                       |
|     platform          VARCHAR(50)   NOT NULL                        |
|     date              DATE          NOT NULL                        |
|     impressions       BIGINT        DEFAULT 0                       |
|     reach             BIGINT        DEFAULT 0                       |
|     clicks            BIGINT        DEFAULT 0                       |
|     ctr               DECIMAL(8,4)  DEFAULT 0  -- click-through %   |
|     cpc               DECIMAL(10,4) DEFAULT 0  -- cost per click    |
|     cpm               DECIMAL(10,4) DEFAULT 0  -- cost per 1000     |
|     spend             DECIMAL(12,2) DEFAULT 0                       |
|     conversions       INT           DEFAULT 0                       |
|     conversion_value  DECIMAL(12,2) DEFAULT 0                       |
|     roas              DECIMAL(10,4) DEFAULT 0  -- return on ad spend|
|     frequency         DECIMAL(8,2)  DEFAULT 0                       |
|     video_views       BIGINT        NULLABLE                        |
|     video_completions BIGINT        NULLABLE                        |
|     leads             INT           NULLABLE                        |
|     app_installs      INT           NULLABLE                        |
|     fetched_at        TIMESTAMP     DEFAULT NOW()                   |
+===================================================================+
| INDEX: idx_metrics_company   (company_id)                           |
| INDEX: idx_metrics_campaign  (campaign_id, date)                    |
| INDEX: idx_metrics_date      (date)                                 |
| UNIQUE: uq_metrics_daily (campaign_id, ad_set_id, ad_id, platform, date) |
+===================================================================+
```

**Purpose:** Stores daily performance metrics fetched from each ad platform. Core of the analytics system.

---

### 4.11 `deployment_logs` Table - NEW

```
+===================================================================+
|                  TABLE 18: deployment_logs (NEW)                   |
+===================================================================+
| PK  id                  INT           auto-increment                |
| FK  company_id          INT           -> companies.id               |
| FK  campaign_id         INT           -> campaigns.id               |
| FK  ad_set_id           INT NULLABLE  -> ad_sets.id                 |
| FK  ad_id               INT NULLABLE  -> ads.id                     |
|     platform            VARCHAR(50)   NOT NULL                      |
|     action              VARCHAR(50)   NOT NULL                      |
|                         -- upload_media / create_campaign /          |
|                         -- create_adset / create_creative /          |
|                         -- create_ad / pause / resume / delete       |
|     platform_resource_id VARCHAR(200) NULLABLE                      |
|     status              VARCHAR(20)   NOT NULL                      |
|                         -- success / failed / pending / simulated    |
|     request_payload     JSONB         NULLABLE                      |
|     response_payload    JSONB         NULLABLE                      |
|     error_message       TEXT          NULLABLE                      |
|     duration_ms         INT           NULLABLE                      |
| FK  executed_by         INT           -> users.id                   |
|     executed_at         TIMESTAMP     DEFAULT NOW()                 |
+===================================================================+
| INDEX: idx_deplogs_company  (company_id)                            |
| INDEX: idx_deplogs_campaign (campaign_id)                           |
| INDEX: idx_deplogs_date     (executed_at)                           |
+===================================================================+
```

**Purpose:** Audit trail for every deployment action. Debug failures, track what was sent to platforms.

---

### 4.12 `approval_comments` Table - NEW

```
+===================================================================+
|                 TABLE 19: approval_comments (NEW)                  |
+===================================================================+
| PK  id              INT           auto-increment                    |
| FK  company_id      INT           -> companies.id                   |
| FK  campaign_id     INT           -> campaigns.id                   |
| FK  ad_id           INT NULLABLE  -> ads.id                         |
| FK  user_id         INT           -> users.id                       |
|     comment         TEXT          NOT NULL                          |
|     action          VARCHAR(30)   NOT NULL                          |
|                     -- approve / reject / request_changes / comment  |
|     attachment_url  VARCHAR(1000) NULLABLE                          |
|     created_at      TIMESTAMP     DEFAULT NOW()                     |
+===================================================================+
| INDEX: idx_comments_campaign (campaign_id)                          |
| INDEX: idx_comments_ad       (ad_id)                                |
+===================================================================+
```

**Purpose:** CMO and team members can leave feedback during the approval workflow.

---

### 4.13 `notifications` Table - NEW

```
+===================================================================+
|                   TABLE 20: notifications (NEW)                    |
+===================================================================+
| PK  id              INT           auto-increment                    |
| FK  company_id      INT           -> companies.id                   |
| FK  user_id         INT           -> users.id (recipient)           |
|     type            VARCHAR(50)   NOT NULL                          |
|                     -- campaign_submitted / campaign_approved /       |
|                     -- campaign_rejected / deploy_success /           |
|                     -- deploy_failed / budget_alert /                 |
|                     -- invitation_received / system_alert             |
|     title           VARCHAR(200)  NOT NULL                          |
|     message         TEXT          NOT NULL                          |
|     resource_type   VARCHAR(50)   NULLABLE                          |
|                     -- campaign / ad / deployment / user / company    |
|     resource_id     INT           NULLABLE                          |
|     action_url      VARCHAR(500)  NULLABLE -- deep link to resource  |
|     is_read         BOOLEAN       DEFAULT false                     |
|     read_at         TIMESTAMP     NULLABLE                          |
|     created_at      TIMESTAMP     DEFAULT NOW()                     |
+===================================================================+
| INDEX: idx_notif_user   (user_id, is_read)                          |
| INDEX: idx_notif_company (company_id)                               |
+===================================================================+
```

**Purpose:** In-app notification system for workflow events, alerts, and team communication.

---

### 4.14 `refresh_tokens` Table - NEW

```
+===================================================================+
|                   TABLE 21: refresh_tokens (NEW)                   |
+===================================================================+
| PK  id              INT           auto-increment                    |
| FK  user_id         INT           -> users.id                       |
|     token           VARCHAR(500)  NOT NULL, UNIQUE                  |
|     expires_at      TIMESTAMP     NOT NULL                          |
|     created_at      TIMESTAMP     DEFAULT NOW()                     |
|     revoked_at      TIMESTAMP     NULLABLE                          |
|     replaced_by     VARCHAR(500)  NULLABLE -- token rotation chain   |
|     ip_address      VARCHAR(50)   NULLABLE                          |
|     user_agent      VARCHAR(500)  NULLABLE                          |
+===================================================================+
| INDEX: idx_refresh_user  (user_id)                                  |
| INDEX: idx_refresh_token (token)                                    |
+===================================================================+
```

**Purpose:** Secure token refresh system. Short-lived JWTs (15 min) + long-lived refresh tokens (7 days).

---

### 4.15 `invitations` Table - NEW

```
+===================================================================+
|                    TABLE 22: invitations (NEW)                     |
+===================================================================+
| PK  id              INT           auto-increment                    |
| FK  company_id      INT           -> companies.id                   |
|     email           VARCHAR(200)  NOT NULL                          |
| FK  role_id         INT           -> roles.id                       |
| FK  invited_by      INT           -> users.id                       |
|     token           VARCHAR(200)  NOT NULL, UNIQUE                  |
|     status          VARCHAR(20)   DEFAULT 'pending'                 |
|                     -- pending / accepted / expired / revoked        |
|     accepted_at     TIMESTAMP     NULLABLE                          |
|     expires_at      TIMESTAMP     NOT NULL                          |
|     created_at      TIMESTAMP     DEFAULT NOW()                     |
+===================================================================+
| UNIQUE: uq_invitation_token (token)                                 |
| INDEX:  idx_invitation_company (company_id)                         |
| INDEX:  idx_invitation_email   (email)                              |
+===================================================================+
```

**Purpose:** Team invitation system. Admins invite users via email with pre-assigned role.

---

### 4.16 `ab_tests` Table - NEW

```
+===================================================================+
|                      TABLE 23: ab_tests (NEW)                      |
+===================================================================+
| PK  id                INT           auto-increment                  |
| FK  company_id        INT           -> companies.id                 |
| FK  campaign_id       INT           -> campaigns.id                 |
|     name              VARCHAR(200)  NOT NULL                        |
| FK  variant_a_ad_id   INT           -> ads.id                       |
| FK  variant_b_ad_id   INT           -> ads.id                       |
|     metric            VARCHAR(50)   NOT NULL                        |
|                       -- ctr / cpc / conversion_rate / roas          |
|     traffic_split     INT           DEFAULT 50 -- % for variant A    |
|     status            VARCHAR(20)   DEFAULT 'draft'                  |
|                       -- draft / running / completed / cancelled      |
|     winner            VARCHAR(5)    NULLABLE -- A / B / inconclusive |
|     confidence_level  DECIMAL(5,2)  NULLABLE -- statistical sig %    |
|     variant_a_result  DECIMAL(12,4) NULLABLE                        |
|     variant_b_result  DECIMAL(12,4) NULLABLE                        |
| FK  created_by        INT           -> users.id                     |
|     started_at        TIMESTAMP     NULLABLE                        |
|     ended_at          TIMESTAMP     NULLABLE                        |
|     created_at        TIMESTAMP     DEFAULT NOW()                   |
+===================================================================+
| INDEX: idx_abtests_company  (company_id)                            |
| INDEX: idx_abtests_campaign (campaign_id)                           |
+===================================================================+
```

**Purpose:** A/B testing framework. Compare two ad variants on a chosen metric with statistical significance.

---

### 4.17 `budget_allocations` Table - NEW

```
+===================================================================+
|                 TABLE 24: budget_allocations (NEW)                  |
+===================================================================+
| PK  id                    INT           auto-increment              |
| FK  company_id            INT           -> companies.id             |
|     period_type           VARCHAR(20)   NOT NULL                    |
|                           -- monthly / quarterly / yearly            |
|     period_start          DATE          NOT NULL                    |
|     period_end            DATE          NOT NULL                    |
|     total_budget          DECIMAL(14,2) NOT NULL                    |
|     facebook_allocation   DECIMAL(14,2) DEFAULT 0                  |
|     tiktok_allocation     DECIMAL(14,2) DEFAULT 0                  |
|     youtube_allocation    DECIMAL(14,2) DEFAULT 0                  |
|     google_allocation     DECIMAL(14,2) DEFAULT 0                  |
|     spent_to_date         DECIMAL(14,2) DEFAULT 0                  |
|     status                VARCHAR(20)   DEFAULT 'active'           |
|                           -- active / closed / exceeded             |
| FK  created_by            INT           -> users.id                 |
|     created_at            TIMESTAMP     DEFAULT NOW()               |
|     updated_at            TIMESTAMP     DEFAULT NOW()               |
+===================================================================+
| INDEX: idx_budgets_company (company_id)                             |
| INDEX: idx_budgets_period  (period_start, period_end)               |
+===================================================================+
```

**Purpose:** Budget planning and tracking per company. Allocate budget across platforms and track spend.

---

### 4.18 `activity_logs` Table - NEW

```
+===================================================================+
|                   TABLE 25: activity_logs (NEW)                    |
+===================================================================+
| PK  id              INT           auto-increment                    |
| FK  company_id      INT NULLABLE  -> companies.id                   |
| FK  user_id         INT           -> users.id                       |
|     action          VARCHAR(50)   NOT NULL                          |
|                     -- login / logout / created / updated /          |
|                     -- deleted / approved / rejected / deployed /     |
|                     -- invited / role_changed / impersonated         |
|     resource_type   VARCHAR(50)   NOT NULL                          |
|                     -- user / campaign / ad / company / role /        |
|                     -- deployment / budget / guideline / setting      |
|     resource_id     VARCHAR(50)   NULLABLE                          |
|     description     TEXT          NULLABLE                          |
|     details         JSONB         NULLABLE -- before/after snapshot  |
|     ip_address      VARCHAR(50)   NULLABLE                          |
|     user_agent      VARCHAR(500)  NULLABLE                          |
|     created_at      TIMESTAMP     DEFAULT NOW()                     |
+===================================================================+
| INDEX: idx_activity_company (company_id, created_at)                |
| INDEX: idx_activity_user    (user_id)                               |
| INDEX: idx_activity_date    (created_at)                            |
+===================================================================+
```

**Purpose:** Full audit trail. Tracks every significant action for compliance and debugging.

---

### 4.19 `campaign_templates` Table - NEW

```
+===================================================================+
|                 TABLE 26: campaign_templates (NEW)                  |
+===================================================================+
| PK  id              INT           auto-increment                    |
| FK  company_id      INT NULLABLE  -> companies.id (null = global)   |
|     name            VARCHAR(200)  NOT NULL                          |
|     description     TEXT          NULLABLE                          |
| FK  objective_id    INT NULLABLE  -> campaign_objectives.id          |
|     targeting       JSONB         NULLABLE                          |
|     budget_config   JSONB         NULLABLE                          |
|                     -- {daily_budget, lifetime_budget, bid_strategy}  |
|     creative_specs  JSONB         NULLABLE                          |
|                     -- {style_preset, aspect_ratio, formats}         |
|     platforms       TEXT[]        NULLABLE                          |
|     is_global       BOOLEAN       DEFAULT false                     |
|                     -- true = Super Admin template, all companies     |
| FK  created_by      INT           -> users.id                       |
|     use_count       INT           DEFAULT 0                         |
|     created_at      TIMESTAMP     DEFAULT NOW()                     |
|     updated_at      TIMESTAMP     DEFAULT NOW()                     |
+===================================================================+
| INDEX: idx_templates_company (company_id)                           |
+===================================================================+
```

**Purpose:** Save campaign configurations as reusable templates. Speed up campaign creation.

---

### 4.20 `audience_templates` Table - NEW

```
+===================================================================+
|                 TABLE 27: audience_templates (NEW)                  |
+===================================================================+
| PK  id              INT           auto-increment                    |
| FK  company_id      INT           -> companies.id                   |
|     name            VARCHAR(200)  NOT NULL                          |
|     description     TEXT          NULLABLE                          |
|     targeting       JSONB         NOT NULL                          |
|                     -- full targeting spec (same as ad_sets.targeting)|
|     estimated_size  BIGINT        NULLABLE -- estimated audience size|
| FK  created_by      INT           -> users.id                       |
|     use_count       INT           DEFAULT 0                         |
|     created_at      TIMESTAMP     DEFAULT NOW()                     |
|     updated_at      TIMESTAMP     DEFAULT NOW()                     |
+===================================================================+
| INDEX: idx_audiences_company (company_id)                           |
+===================================================================+
```

**Purpose:** Save and reuse audience targeting configurations across campaigns.

---

### 4.21 `asset_library` Table - NEW

```
+===================================================================+
|                   TABLE 28: asset_library (NEW)                    |
+===================================================================+
| PK  id              INT           auto-increment                    |
| FK  company_id      INT           -> companies.id                   |
|     filename        VARCHAR(500)  NOT NULL                          |
|     original_name   VARCHAR(500)  NULLABLE                          |
|     file_path       VARCHAR(1000) NOT NULL                          |
|     file_url        VARCHAR(1000) NOT NULL                          |
|     file_type       VARCHAR(20)   NOT NULL -- image / video          |
|     mime_type       VARCHAR(100)  NULLABLE                          |
|     file_size_bytes BIGINT        NULLABLE                          |
|     width           INT           NULLABLE                          |
|     height          INT           NULLABLE                          |
|     duration_seconds INT          NULLABLE (video only)              |
|     folder          VARCHAR(50)   DEFAULT 'assets'                  |
|                     -- assets / library (working vs approved)        |
|     tags            TEXT[]        NULLABLE                          |
|     status          VARCHAR(20)   DEFAULT 'active'                  |
|                     -- active / archived / deleted                   |
| FK  uploaded_by     INT           -> users.id                       |
|     uploaded_at     TIMESTAMP     DEFAULT NOW()                     |
+===================================================================+
| INDEX: idx_assetlib_company (company_id)                            |
| INDEX: idx_assetlib_folder  (company_id, folder)                    |
+===================================================================+
```

**Purpose:** Database-tracked asset management. Replaces filesystem-only listing. Enables metadata, tagging, and search.

---

## 5. Complete Table Count

```
+=================================================================+
|                    COMPLETE TABLE INVENTORY                       |
+=================================================================+
|                                                                  |
|  EXISTING TABLES (MODIFIED):          7                          |
|  -------------------------------------------------------        |
|   1. users                  + 9 new columns                     |
|   2. roles                  + 5 new columns                     |
|   3. screens                + 4 new columns                     |
|   4. role_screens           + 3 new columns                     |
|   5. brand_guidelines       + 6 new columns                     |
|   6. campaigns              + 17 new columns (MAJOR)            |
|   7. cmo_queue              + 7 new columns                     |
|                                                                  |
|  NEW TABLES:                         21                          |
|  -------------------------------------------------------        |
|   8.  companies              (multi-tenancy core)               |
|   9.  company_settings       (per-company config)               |
|  10.  company_ad_accounts    (platform credentials)             |
|  11.  ppp_queue              (replaces ppc_queue.json)          |
|  12.  campaign_objectives    (objective lookup)                 |
|  13.  ad_sets                (ad group level)                   |
|  14.  ads                    (individual ads)                   |
|  15.  ad_creatives           (creative assets per ad)           |
|  16.  campaign_workflow_steps(workflow state machine)            |
|  17.  ad_metrics             (performance analytics)            |
|  18.  deployment_logs        (deployment audit trail)           |
|  19.  approval_comments      (review feedback)                  |
|  20.  notifications          (in-app alerts)                    |
|  21.  refresh_tokens         (JWT refresh system)               |
|  22.  invitations            (team member invites)              |
|  23.  ab_tests               (A/B testing)                      |
|  24.  budget_allocations     (budget planning)                  |
|  25.  activity_logs          (full audit trail)                 |
|  26.  campaign_templates     (reusable templates)               |
|  27.  audience_templates     (saved audiences)                  |
|  28.  asset_library          (DB-tracked assets)                |
|                                                                  |
|  ===============================================                 |
|  GRAND TOTAL:                28 TABLES                           |
|  ===============================================                 |
|                                                                  |
|  New columns added to existing tables:  ~51 columns              |
|  New indexes:                           ~35 indexes              |
|  New foreign key constraints:           ~50 FKs                  |
|                                                                  |
+=================================================================+
```

---

## 6. Full Entity-Relationship Diagram

```
+=====================================================================+
|                  COMPLETE ER DIAGRAM (28 TABLES)                     |
+=====================================================================+


                          +==================+
                          |    companies     |  <--- CENTRAL TENANT TABLE
                          +==================+
                          | PK id            |
                          |    name          |
                          |    slug (unique) |
                          |    status        |
                          +========+=========+
                                   |
          +------------------------+---------------------------+
          |            |           |           |               |
          |1:1         |1:N        |1:N        |1:N            |1:N
          v            v           v           v               v
  +-----------+ +-----------+ +--------+ +-----------+ +----------------+
  | company_  | | company_  | | users  | |  roles    | | brand_         |
  | settings  | | ad_       | |        | |           | | guidelines     |
  |           | | accounts  | |        | |           | |                |
  +-----------+ +-----------+ +---+----+ +-----+-----+ +----------------+
                                  |            |
                                  |            |
                                  v            v
                            +====================+
                            |   role_screens     |
                            | (Permission Matrix)|
                            +====================+
                                  |
                                  v
                            +===========+
                            |  screens  |
                            +===========+


  users ----+----> refresh_tokens (1:N)
            |----> invitations (invited_by) (1:N)
            |----> activity_logs (1:N)
            |----> notifications (1:N)
            |
            +----> campaigns (created_by, approved_by, deployed_by)
                       |
                       +---> campaign_workflow_steps (1:N)
                       |
                       +---> ad_sets (1:N)
                       |        |
                       |        +---> ads (1:N)
                       |                |
                       |                +---> ad_creatives (1:N)
                       |                |
                       |                +---> approval_comments (1:N)
                       |
                       +---> ad_metrics (1:N)
                       |
                       +---> deployment_logs (1:N)
                       |
                       +---> ab_tests (1:N)
                       |
                       +---> cmo_queue (1:N)
                       |
                       +---> ppp_queue (1:N)


  companies --+--> budget_allocations (1:N)
              +--> campaign_templates (1:N)
              +--> audience_templates (1:N)
              +--> asset_library (1:N)

  campaign_objectives (standalone lookup - no FK to companies)


=====================================================================
     RELATIONSHIP DETAILS
=====================================================================

  companies  1 ---< N  users
  companies  1 ---< N  roles
  companies  1 ---< N  campaigns
  companies  1 ---< N  brand_guidelines
  companies  1 ---< N  cmo_queue
  companies  1 ---< N  ppp_queue
  companies  1 ---< N  ad_sets
  companies  1 ---< N  ads
  companies  1 ---< N  ad_creatives
  companies  1 ---< N  ad_metrics
  companies  1 ---< N  deployment_logs
  companies  1 ---< N  approval_comments
  companies  1 ---< N  notifications
  companies  1 ---< N  budget_allocations
  companies  1 ---< N  campaign_templates
  companies  1 ---< N  audience_templates
  companies  1 ---< N  asset_library
  companies  1 ---< N  ab_tests
  companies  1 ---< N  activity_logs
  companies  1 ---< N  invitations
  companies  1 ---1 1  company_settings
  companies  1 ---< N  company_ad_accounts

  roles      1 ---< N  users
  roles      1 ---< N  role_screens
  roles      1 ---< N  invitations

  screens    1 ---< N  role_screens

  users      1 ---< N  refresh_tokens
  users      1 ---< N  activity_logs
  users      1 ---< N  notifications
  users      1 ---< N  campaigns (created_by)
  users      1 ---< N  campaigns (approved_by)
  users      1 ---< N  ads (created_by)
  users      1 ---< N  ads (reviewed_by)
  users      1 ---< N  approval_comments
  users      1 ---< N  deployment_logs (executed_by)
  users      1 ---< N  invitations (invited_by)

  campaigns  1 ---< N  ad_sets
  campaigns  1 ---< N  campaign_workflow_steps
  campaigns  1 ---< N  ad_metrics
  campaigns  1 ---< N  deployment_logs
  campaigns  1 ---< N  approval_comments
  campaigns  1 ---< N  ab_tests
  campaigns  1 ---< N  cmo_queue
  campaigns  1 ---< N  ppp_queue

  campaign_objectives 1 ---< N campaigns

  ad_sets    1 ---< N  ads
  ad_sets    1 ---< N  ad_metrics

  ads        1 ---< N  ad_creatives
  ads        1 ---< N  ad_metrics
  ads        1 ---< N  approval_comments
```

---

## 7. Detailed Table Definitions

### Table Grouping by Domain

```
+=================================================================+
|  DOMAIN            | TABLES                        | COUNT       |
+=================================================================+
|  Multi-Tenancy     | companies, company_settings,  |   3         |
|                    | company_ad_accounts           |             |
+-----------------------------------------------------------------+
|  Auth & RBAC       | users, roles, screens,        |   5         |
|                    | role_screens, refresh_tokens   |             |
+-----------------------------------------------------------------+
|  Campaign Core     | campaigns, campaign_objectives,|   5         |
|                    | ad_sets, ads, ad_creatives     |             |
+-----------------------------------------------------------------+
|  Workflow          | campaign_workflow_steps,       |   4         |
|                    | cmo_queue, ppp_queue,          |             |
|                    | approval_comments              |             |
+-----------------------------------------------------------------+
|  Analytics         | ad_metrics, deployment_logs    |   2         |
+-----------------------------------------------------------------+
|  Features          | ab_tests, budget_allocations,  |   4         |
|                    | campaign_templates,            |             |
|                    | audience_templates             |             |
+-----------------------------------------------------------------+
|  System            | notifications, activity_logs,  |   3         |
|                    | invitations                    |             |
+-----------------------------------------------------------------+
|  Assets            | asset_library,                 |   2         |
|                    | brand_guidelines               |             |
+=================================================================+
|  TOTAL             |                                |  28         |
+=================================================================+
```

---

## 8. Indexes & Constraints

### Foreign Key Constraints Summary

```
+=================================================================+
|  TABLE                  | FOREIGN KEYS                           |
+=================================================================+
|  users                  | role_id -> roles.id                    |
|                         | company_id -> companies.id             |
+-----------------------------------------------------------------+
|  roles                  | company_id -> companies.id             |
+-----------------------------------------------------------------+
|  role_screens           | role_id -> roles.id                    |
|                         | screen_id -> screens.id                |
|                         | company_id -> companies.id             |
|                         | granted_by -> users.id                 |
+-----------------------------------------------------------------+
|  company_settings       | company_id -> companies.id             |
+-----------------------------------------------------------------+
|  company_ad_accounts    | company_id -> companies.id             |
+-----------------------------------------------------------------+
|  brand_guidelines       | company_id -> companies.id             |
|                         | created_by -> users.id                 |
+-----------------------------------------------------------------+
|  campaigns              | company_id -> companies.id             |
|                         | objective_id -> campaign_objectives.id |
|                         | created_by -> users.id                 |
|                         | approved_by -> users.id                |
|                         | deployed_by -> users.id                |
+-----------------------------------------------------------------+
|  campaign_workflow_steps| campaign_id -> campaigns.id            |
|                         | completed_by -> users.id               |
+-----------------------------------------------------------------+
|  ad_sets                | company_id -> companies.id             |
|                         | campaign_id -> campaigns.id            |
|                         | created_by -> users.id                 |
+-----------------------------------------------------------------+
|  ads                    | company_id -> companies.id             |
|                         | ad_set_id -> ad_sets.id                |
|                         | created_by -> users.id                 |
|                         | reviewed_by -> users.id                |
+-----------------------------------------------------------------+
|  ad_creatives           | company_id -> companies.id             |
|                         | ad_id -> ads.id                        |
+-----------------------------------------------------------------+
|  ad_metrics             | company_id -> companies.id             |
|                         | campaign_id -> campaigns.id            |
|                         | ad_set_id -> ad_sets.id                |
|                         | ad_id -> ads.id                        |
+-----------------------------------------------------------------+
|  deployment_logs        | company_id -> companies.id             |
|                         | campaign_id -> campaigns.id            |
|                         | ad_set_id -> ad_sets.id                |
|                         | ad_id -> ads.id                        |
|                         | executed_by -> users.id                |
+-----------------------------------------------------------------+
|  cmo_queue              | company_id -> companies.id             |
|                         | campaign_id -> campaigns.id            |
|                         | ad_id -> ads.id                        |
|                         | submitted_by -> users.id               |
|                         | reviewed_by -> users.id                |
+-----------------------------------------------------------------+
|  ppp_queue              | company_id -> companies.id             |
|                         | campaign_id -> campaigns.id            |
|                         | ad_id -> ads.id                        |
|                         | approved_by -> users.id                |
|                         | deployed_by -> users.id                |
+-----------------------------------------------------------------+
|  approval_comments      | company_id -> companies.id             |
|                         | campaign_id -> campaigns.id            |
|                         | ad_id -> ads.id                        |
|                         | user_id -> users.id                    |
+-----------------------------------------------------------------+
|  notifications          | company_id -> companies.id             |
|                         | user_id -> users.id                    |
+-----------------------------------------------------------------+
|  refresh_tokens         | user_id -> users.id                    |
+-----------------------------------------------------------------+
|  invitations            | company_id -> companies.id             |
|                         | role_id -> roles.id                    |
|                         | invited_by -> users.id                 |
+-----------------------------------------------------------------+
|  ab_tests               | company_id -> companies.id             |
|                         | campaign_id -> campaigns.id            |
|                         | variant_a_ad_id -> ads.id              |
|                         | variant_b_ad_id -> ads.id              |
|                         | created_by -> users.id                 |
+-----------------------------------------------------------------+
|  budget_allocations     | company_id -> companies.id             |
|                         | created_by -> users.id                 |
+-----------------------------------------------------------------+
|  activity_logs          | company_id -> companies.id             |
|                         | user_id -> users.id                    |
+-----------------------------------------------------------------+
|  campaign_templates     | company_id -> companies.id             |
|                         | objective_id -> campaign_objectives.id |
|                         | created_by -> users.id                 |
+-----------------------------------------------------------------+
|  audience_templates     | company_id -> companies.id             |
|                         | created_by -> users.id                 |
+-----------------------------------------------------------------+
|  asset_library          | company_id -> companies.id             |
|                         | uploaded_by -> users.id                |
+-----------------------------------------------------------------+
|  TOTAL FOREIGN KEYS:    ~50                                      |
+=================================================================+
```

### Performance Indexes

```
+=================================================================+
|  CRITICAL INDEXES FOR PERFORMANCE                                |
+=================================================================+
|                                                                  |
|  -- Every tenant-scoped table gets company_id index              |
|  CREATE INDEX idx_{table}_company ON {table} (company_id);       |
|                                                                  |
|  -- High-query tables get composite indexes                      |
|  CREATE INDEX idx_campaigns_company_status                       |
|    ON campaigns (company_id, status);                            |
|                                                                  |
|  CREATE INDEX idx_metrics_campaign_date                          |
|    ON ad_metrics (campaign_id, date);                            |
|                                                                  |
|  CREATE INDEX idx_metrics_company_date                           |
|    ON ad_metrics (company_id, date);                             |
|                                                                  |
|  CREATE INDEX idx_notif_user_unread                              |
|    ON notifications (user_id) WHERE is_read = false;             |
|                                                                  |
|  CREATE INDEX idx_activity_company_date                          |
|    ON activity_logs (company_id, created_at DESC);               |
|                                                                  |
|  CREATE INDEX idx_deplogs_campaign_date                          |
|    ON deployment_logs (campaign_id, executed_at DESC);           |
|                                                                  |
|  -- Unique constraints                                           |
|  CREATE UNIQUE INDEX uq_companies_slug                           |
|    ON companies (slug);                                          |
|                                                                  |
|  CREATE UNIQUE INDEX uq_users_username_company                   |
|    ON users (username, company_id);                              |
|                                                                  |
|  CREATE UNIQUE INDEX uq_roles_name_company                       |
|    ON roles (name, company_id);                                  |
|                                                                  |
|  CREATE UNIQUE INDEX uq_metrics_daily                            |
|    ON ad_metrics (campaign_id, ad_set_id, ad_id, platform, date);|
|                                                                  |
|  CREATE UNIQUE INDEX uq_settings_company                         |
|    ON company_settings (company_id);                             |
|                                                                  |
|  CREATE UNIQUE INDEX uq_adaccount_platform                       |
|    ON company_ad_accounts (company_id, platform, account_id);    |
|                                                                  |
+=================================================================+
```

---

## 9. Migration Strategy

### Step-by-Step Migration Plan

```
+=================================================================+
|                    MIGRATION EXECUTION ORDER                     |
+=================================================================+
|                                                                  |
|  STEP 1: Create new independent tables (no FK dependencies)      |
|  -------------------------------------------------------        |
|    1.1  CREATE TABLE companies                                  |
|    1.2  CREATE TABLE campaign_objectives                        |
|    1.3  CREATE TABLE screens (add new columns)                  |
|                                                                  |
|  STEP 2: Create default company & migrate existing data          |
|  -------------------------------------------------------        |
|    2.1  INSERT default company ("Default Company")              |
|    2.2  Save default_company_id for subsequent steps             |
|                                                                  |
|  STEP 3: Modify existing tables (add company_id + new cols)      |
|  -------------------------------------------------------        |
|    3.1  ALTER TABLE roles ADD company_id, is_system_role, ...    |
|    3.2  UPDATE roles SET company_id = default_company_id         |
|    3.3  ALTER TABLE users ADD company_id, is_super_admin, ...    |
|    3.4  UPDATE users SET company_id = default_company_id         |
|    3.5  CREATE super_admin user (company_id = NULL)              |
|    3.6  ALTER TABLE role_screens ADD company_id, ...             |
|    3.7  UPDATE role_screens SET company_id = default_company_id  |
|    3.8  ALTER TABLE brand_guidelines ADD company_id, ...         |
|    3.9  UPDATE brand_guidelines SET company_id = default_co_id   |
|    3.10 ALTER TABLE campaigns ADD all new columns                |
|    3.11 UPDATE campaigns SET company_id = default_company_id     |
|    3.12 ALTER TABLE cmo_queue ADD company_id, ...                |
|    3.13 UPDATE cmo_queue SET company_id = default_company_id     |
|                                                                  |
|  STEP 4: Create tables with FK to companies                      |
|  -------------------------------------------------------        |
|    4.1  CREATE TABLE company_settings                            |
|    4.2  CREATE TABLE company_ad_accounts                         |
|    4.3  CREATE TABLE ppp_queue                                   |
|    4.4  Migrate ppc_queue.json data -> ppp_queue table           |
|                                                                  |
|  STEP 5: Create campaign hierarchy tables                        |
|  -------------------------------------------------------        |
|    5.1  CREATE TABLE ad_sets                                     |
|    5.2  CREATE TABLE ads                                         |
|    5.3  CREATE TABLE ad_creatives                                |
|    5.4  CREATE TABLE campaign_workflow_steps                     |
|                                                                  |
|  STEP 6: Create analytics & logging tables                       |
|  -------------------------------------------------------        |
|    6.1  CREATE TABLE ad_metrics                                  |
|    6.2  CREATE TABLE deployment_logs                             |
|    6.3  CREATE TABLE approval_comments                           |
|    6.4  CREATE TABLE activity_logs                               |
|                                                                  |
|  STEP 7: Create feature tables                                   |
|  -------------------------------------------------------        |
|    7.1  CREATE TABLE notifications                               |
|    7.2  CREATE TABLE refresh_tokens                              |
|    7.3  CREATE TABLE invitations                                 |
|    7.4  CREATE TABLE ab_tests                                    |
|    7.5  CREATE TABLE budget_allocations                          |
|    7.6  CREATE TABLE campaign_templates                          |
|    7.7  CREATE TABLE audience_templates                          |
|    7.8  CREATE TABLE asset_library                               |
|                                                                  |
|  STEP 8: Create all indexes and constraints                      |
|  -------------------------------------------------------        |
|    8.1  Add all foreign key constraints                          |
|    8.2  Add all performance indexes                              |
|    8.3  Add all unique constraints                               |
|                                                                  |
|  STEP 9: Seed initial data                                       |
|  -------------------------------------------------------        |
|    9.1  Seed campaign_objectives (13 objectives)                 |
|    9.2  Seed new screens (Super Admin screens)                   |
|    9.3  Seed Super Admin role + role_screens                     |
|    9.4  Create company_settings for default company              |
|    9.5  Migrate existing file-based assets to asset_library      |
|                                                                  |
+=================================================================+
```

### EF Core Migration Command

```bash
# Generate migration
cd backend
dotnet ef migrations add MultiTenancyAndFullPlatform

# Apply migration
dotnet ef database update
```

---

## 10. Seed Data Plan

### Campaign Objectives Seed (13 records)

```
+----+----------------+---------------------+----------------------------------+
| ID | Category       | Name                | Platform Mapping (JSONB)         |
+----+----------------+---------------------+----------------------------------+
|  1 | awareness      | Brand Awareness     | fb:OUTCOME_AWARENESS, tt:REACH   |
|  2 | awareness      | Reach               | fb:OUTCOME_AWARENESS, tt:REACH   |
|  3 | awareness      | Video Views         | fb:OUTCOME_AWARENESS, yt:VIDEO   |
|  4 | consideration  | Traffic             | fb:OUTCOME_TRAFFIC, tt:TRAFFIC   |
|  5 | consideration  | Engagement          | fb:OUTCOME_ENGAGEMENT, tt:TRAFFIC|
|  6 | consideration  | App Installs        | fb:OUTCOME_APP_PROMOTION         |
|  7 | consideration  | Lead Generation     | fb:OUTCOME_LEADS, tt:LEAD_GEN    |
|  8 | consideration  | Messages            | fb:OUTCOME_ENGAGEMENT            |
|  9 | conversion     | Conversions         | fb:OUTCOME_SALES, tt:CONVERSIONS |
| 10 | conversion     | Catalog Sales       | fb:OUTCOME_SALES, g:SHOPPING     |
| 11 | conversion     | Store Traffic       | fb:OUTCOME_AWARENESS             |
| 12 | conversion     | Sales               | fb:OUTCOME_SALES, tt:SALES       |
| 13 | consideration  | Website Traffic     | g:SEARCH, g:DISPLAY              |
+----+----------------+---------------------+----------------------------------+
```

### New Screens Seed (add to existing 20)

```
+----+---------------------------+----------------------------+-----------+
| #  | Name                      | Display Name               | Category  |
+----+---------------------------+----------------------------+-----------+
| 21 | GlobalDashboard           | Global Dashboard           | super     |
| 22 | CompanyManagement         | Company Management         | super     |
| 23 | SystemConfig              | System Configuration       | super     |
| 24 | AuditLog                  | Audit Log                  | super     |
| 25 | AdAccountManagement       | Ad Account Management      | admin     |
| 26 | BillingSettings           | Billing & Subscription     | admin     |
| 27 | CampaignReports           | Campaign Reports           | cmo       |
| 28 | CrossPlatformAnalytics    | Cross-Platform Analytics   | cmo       |
| 29 | DeploymentHistory         | Deployment History         | ppp       |
| 30 | ABTestResults             | A/B Test Results           | ppp       |
| 31 | AudienceInsights          | Audience Insights          | expert    |
| 32 | CompetitorResearch        | Competitor Research        | expert    |
| 33 | AdPerformance             | Ad Performance             | shared    |
+----+---------------------------+----------------------------+-----------+
```

### Default Super Admin User

```
Username:       superadmin
Password Hash:  BCrypt("SuperAdmin@2026")
Email:          superadmin@system.local
company_id:     NULL
is_super_admin: true
Role:           "Super Admin" (new role, all screens)
```

---

## Data Flow Through Tables

```
+=================================================================+
|              DATA FLOW: CAMPAIGN LIFECYCLE                       |
+=================================================================+
|                                                                  |
|  Expert creates campaign                                         |
|    -> INSERT campaigns (status: draft)                           |
|    -> INSERT campaign_workflow_steps (7 steps, not_started)      |
|    -> INSERT activity_logs                                       |
|                                                                  |
|  Expert builds ad sets                                           |
|    -> INSERT ad_sets (targeting, budget, placements)             |
|    -> UPDATE campaign_workflow_steps (adset_config: completed)   |
|                                                                  |
|  Expert creates ads with creatives                               |
|    -> INSERT ads                                                 |
|    -> INSERT ad_creatives                                        |
|    -> INSERT asset_library (if new upload)                       |
|    -> UPDATE campaign_workflow_steps (creative: completed)       |
|                                                                  |
|  Expert submits for review                                       |
|    -> UPDATE campaigns (status: pending_review)                  |
|    -> INSERT cmo_queue (per asset)                               |
|    -> INSERT notifications (to CMO)                              |
|    -> INSERT activity_logs                                       |
|                                                                  |
|  CMO reviews & approves                                          |
|    -> INSERT approval_comments                                   |
|    -> UPDATE cmo_queue (status: approved)                        |
|    -> INSERT ppp_queue (approved assets)                         |
|    -> UPDATE campaigns (status: approved, approved_by, at)       |
|    -> INSERT notifications (to Expert + PPP)                     |
|    -> INSERT activity_logs                                       |
|                                                                  |
|  PPP deploys to platforms                                        |
|    -> READ company_ad_accounts (get credentials)                 |
|    -> INSERT deployment_logs (per API call)                      |
|    -> UPDATE ads (platform_ad_ids)                               |
|    -> UPDATE ad_sets (platform_adset_ids)                        |
|    -> UPDATE campaigns (status: active, deployed_by, at)         |
|    -> UPDATE ppp_queue (status: deployed)                        |
|    -> INSERT notifications (to CMO + Admin)                      |
|    -> INSERT activity_logs                                       |
|                                                                  |
|  Metrics collection (automated)                                  |
|    -> READ company_ad_accounts (get credentials)                 |
|    -> UPSERT ad_metrics (daily per platform)                     |
|                                                                  |
|  Campaign completion                                             |
|    -> UPDATE campaigns (status: completed, completed_at)         |
|    -> INSERT activity_logs                                       |
|    -> INSERT notifications (to all stakeholders)                 |
|                                                                  |
+=================================================================+
```

---

*Generated on 2026-03-31 | AI-Marketing Platform Database Design Document*
*Total: 7 modified tables + 21 new tables = 28 tables*
