# Database Integration Plan — AI-Marketer Platform OS V3.5

## Objective
Replace the current flat JSON file persistence layer (`brand_guidelines.json`, `campaigns.json`, `cmo_queue.json`) with a proper **PostgreSQL** relational database, connected via **Npgsql + Entity Framework Core** in the ASP.NET Core backend.

---

## Technology Choice: PostgreSQL + Entity Framework Core (Npgsql)

**Why PostgreSQL?**
- Production-grade, open-source relational database
- Excellent support for JSON/JSONB columns (useful for palette array storage)
- Native array types, full-text search, and advanced indexing for future scaling
- First-class EF Core support via `Npgsql.EntityFrameworkCore.PostgreSQL`
- Industry standard — easy to host on Supabase, Railway, AWS RDS, Azure, etc.
- Robust transaction support and ACID compliance

**Prerequisites — PostgreSQL must be installed and running:**
- Install PostgreSQL 15+ (local or Docker: `docker run --name marketingai-pg -e POSTGRES_PASSWORD=Orion123@ -p 5432:5432 -d postgres`)
- Create a database named `MarketingAI`: `CREATE DATABASE "MarketingAI";`
- Default connection assumes: host=`localhost`, port=`5432`, user=`Monirul007`, password=`Orion123@`
- Update `appsettings.json` connection string if credentials differ

---

## Current JSON Files Being Replaced

| File | Current Role | Records In File |
|------|-------------|-----------------|
| `brand_guidelines.json` | Single brand identity config | 1 row |
| `campaigns.json` | Latest campaign config/brief | 1 row |
| `cmo_queue.json` | Assets pending CMO approval | 3 assets |
| `ppc_queue.json` | Assets authorized for PPC dispatch | *(does not exist yet)* |

---

## Database Schema Design

### Table 1: `brand_guidelines`
Stores the brand DNA configuration. Single-row singleton (always `id = 1`, upserted on save).

```sql
CREATE TABLE brand_guidelines (
    id            INTEGER PRIMARY KEY,         -- Always 1 (singleton)
    brand_label   TEXT    NOT NULL DEFAULT '',
    tone          TEXT    NOT NULL DEFAULT 'Professional',
    language      TEXT    NOT NULL DEFAULT 'English',
    description   TEXT    NOT NULL DEFAULT '',
    whitelist     TEXT    NOT NULL DEFAULT '',
    blacklist     TEXT    NOT NULL DEFAULT '',
    heading_font  TEXT    NOT NULL DEFAULT 'Montserrat Bold',
    heading_size  TEXT    NOT NULL DEFAULT '32px',
    body_font     TEXT    NOT NULL DEFAULT 'Roboto Regular',
    body_size     TEXT    NOT NULL DEFAULT '16px',
    palette_json  TEXT    NOT NULL DEFAULT '[]',   -- JSON array of hex strings stored as TEXT
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**JSON → Column Mapping:**
```
brandLabel        → brand_label
tone              → tone
language          → language
description       → description
whitelist         → whitelist
blacklist         → blacklist
typography.headingFont → heading_font
typography.headingSize → heading_size
typography.bodyFont    → body_font
typography.bodySize    → body_size
palette (array)   → palette_json (serialized JSON string)
```

---

### Table 2: `campaigns`
Stores campaign creative configurations. Append-only history (new row on each save).

```sql
CREATE TABLE campaigns (
    id         SERIAL      PRIMARY KEY,
    brief      TEXT        NOT NULL DEFAULT '',   -- Full consolidated brief text
    preset     TEXT        NOT NULL DEFAULT '',   -- Style preset (Cinematic, etc.)
    ratio      TEXT        NOT NULL DEFAULT '',   -- Aspect ratio (1:1, 16:9, 9:16)
    timestamp  TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Original session timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()  -- DB insertion time
);
```

**JSON → Column Mapping:**
```
brief     → brief
preset    → preset
ratio     → ratio
timestamp → timestamp
(auto)    → created_at
```

---

### Table 3: `assets`
Unified asset table tracking all assets through the full pipeline lifecycle.

```sql
CREATE TABLE assets (
    id         SERIAL      PRIMARY KEY,
    file_id    TEXT        NOT NULL UNIQUE,        -- Filename used as identifier (e.g. "variation_4_xxx.jpg")
    url        TEXT        NOT NULL DEFAULT '',    -- Relative URL path (/assets/filename)
    title      TEXT        NOT NULL DEFAULT '',    -- Display name
    type       TEXT        NOT NULL DEFAULT '',    -- "image" | "video"
    status     TEXT        NOT NULL DEFAULT 'studio', -- See lifecycle below
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Asset Status Lifecycle:**
```
studio
  │  (Expert approves in Studio screen)
  ▼
cmo_pending
  │  (CMO authorizes for PPC)
  ▼
ppc_pending
  │  (PPC dispatches to ad network)
  ▼
deployed
  OR
rejected   (CMO rejects)
```

**JSON → Column Mapping (from cmo_queue.json):**
```
id    → file_id
url   → url
title → title
type  → type
(from cmo_queue) → status = 'cmo_pending'
(from ppc_queue) → status = 'ppc_pending'
```

---

## Implementation Steps

### Phase 1: PostgreSQL Installation & Database Setup

- [ ] **Step 1.1** — Install PostgreSQL 15+:
  - **Option A (Local):** Download installer from https://www.postgresql.org/download/windows/ and run setup
  - **Option B (Docker):** `docker run --name marketingai-pg -e POSTGRES_PASSWORD=Orion123@ -p 5432:5432 -d postgres`
- [ ] **Step 1.2** — Verify PostgreSQL is running: connect via pgAdmin or `psql -U postgres`
- [ ] **Step 1.3** — Create the dedicated database user:
  ```sql
  CREATE USER "Monirul007" WITH PASSWORD 'Orion123@';
  ```
- [ ] **Step 1.4** — Create the database:
  ```sql
  CREATE DATABASE "MarketingAI";
  ```
- [ ] **Step 1.5** — Grant all privileges to the user:
  ```sql
  GRANT ALL PRIVILEGES ON DATABASE "MarketingAI" TO "Monirul007";
  ```
- [ ] **Step 1.6** — Verify connection works:
  ```
  psql -h localhost -U Monirul007 -d MarketingAI
  ```

---

### Phase 2: NuGet Package Installation

- [ ] **Step 2.1** — Add NuGet package: `Npgsql.EntityFrameworkCore.PostgreSQL` to `backend.csproj` ✅ *(already done)*
- [ ] **Step 2.2** — Add NuGet package: `Microsoft.EntityFrameworkCore.Design` to `backend.csproj` ✅ *(already done)*
- [ ] **Step 2.3** — Add NuGet package: `Microsoft.EntityFrameworkCore` to `backend.csproj` ✅ *(already done)*
- [ ] **Step 2.4** — Run `dotnet restore` to download and install all packages

---

### Phase 3: EF Core Entity Models & DbContext

- [ ] **Step 3.1** — Create `Data/` folder inside `backend/`
- [ ] **Step 3.2** — Create `Data/Entities/BrandGuideline.cs` — C# entity class mapping to `brand_guidelines` table
- [ ] **Step 3.3** — Create `Data/Entities/Campaign.cs` — C# entity class mapping to `campaigns` table
- [ ] **Step 3.4** — Create `Data/Entities/Asset.cs` — C# entity class mapping to `assets` table
- [ ] **Step 3.5** — Create `Data/AppDbContext.cs` — EF Core `DbContext` registering all three entities, configuring table names and constraints

---

### Phase 4: Service Registration & Connection String

- [ ] **Step 4.1** — Add PostgreSQL connection string to `appsettings.json`:
  ```json
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=MarketingAI;Username=Monirul007;Password=Orion123@"
  }
  ```
- [ ] **Step 4.2** — Register `AppDbContext` in `Program.cs` using `builder.Services.AddDbContext<AppDbContext>(...)` with the Npgsql provider:
  ```csharp
  builder.Services.AddDbContext<AppDbContext>(options =>
      options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));
  ```
- [ ] **Step 4.3** — Add `db.Database.EnsureCreated()` call at app startup to auto-create tables from entity model

---

### Phase 5: Database Migration & Table Creation

- [ ] **Step 5.1** — Run `dotnet ef migrations add InitialCreate` to generate migration files
- [ ] **Step 5.2** — Run `dotnet ef database update` to apply migrations and create all tables in the `MarketingAI` PostgreSQL database
- [ ] **Step 5.3** — Verify tables exist by connecting to psql: `\dt` should list `brand_guidelines`, `campaigns`, `assets`

---

### Phase 6: Seed Existing JSON Data

- [ ] **Step 6.1** — Seed `brand_guidelines` table from `brand_guidelines.json`:
  - Parse existing JSON
  - Flatten `typography` object into individual columns
  - Serialize `palette` array to JSON string
  - Insert as `id = 1` (singleton)
  
- [ ] **Step 6.2** — Seed `campaigns` table from `campaigns.json`:
  - Parse existing JSON
  - Insert as first campaign record

- [ ] **Step 6.3** — Seed `assets` table from `cmo_queue.json`:
  - Parse each asset object
  - Insert with `status = 'cmo_pending'`
  - Set `created_at` and `updated_at` to current time

- [ ] **Step 6.4** — Verify seeded data by connecting to psql and running `SELECT * FROM brand_guidelines; SELECT * FROM campaigns; SELECT * FROM assets;`

---

### Phase 7: Update Backend API Endpoints

Replace all `File.ReadAllTextAsync` / `File.WriteAllTextAsync` calls with EF Core database operations.

- [ ] **Step 7.1** — Update `GET /api/guidelines`:
  - Replace: `File.ReadAllTextAsync(GuidelinesFile)`
  - With: `db.BrandGuidelines.FindAsync(1)` → reconstruct nested JSON response

- [ ] **Step 7.2** — Update `POST /api/guidelines`:
  - Replace: `File.WriteAllTextAsync(GuidelinesFile, json)`
  - With: Parse incoming JSON → upsert `BrandGuideline` entity with `id = 1`

- [ ] **Step 7.3** — Update `GET /api/campaigns`:
  - Replace: `File.ReadAllTextAsync(CampaignsFile)`
  - With: `db.Campaigns.OrderByDescending(c => c.CreatedAt).FirstOrDefaultAsync()` → return latest campaign

- [ ] **Step 7.4** — Update `POST /api/campaigns`:
  - Replace: `File.WriteAllTextAsync(CampaignsFile, json)`
  - With: Parse incoming JSON → insert new `Campaign` entity (keep history)

- [ ] **Step 7.5** — Update `GET /api/cmo/queue`:
  - Replace: `File.ReadAllTextAsync(CmoQueueFile)`
  - With: `db.Assets.Where(a => a.Status == "cmo_pending").ToListAsync()` → return as JSON array matching original shape

- [ ] **Step 7.6** — Update `POST /api/cmo/queue`:
  - Replace: full file overwrite
  - With: Sync operation — compare incoming array with DB:
    - Items in incoming but not in DB → insert with `status = 'cmo_pending'`
    - Items in DB but not in incoming → mark as `rejected` or delete

- [ ] **Step 7.7** — Update `GET /api/ppc/queue`:
  - Replace: `File.ReadAllTextAsync(PpcQueueFile)`
  - With: `db.Assets.Where(a => a.Status == "ppc_pending").ToListAsync()`

- [ ] **Step 7.8** — Update `POST /api/ppc/queue`:
  - Replace: full file overwrite
  - With: Sync operation — update asset statuses from `cmo_pending` to `ppc_pending` for authorized items

- [ ] **Step 7.9** — Update `POST /api/assets/approve` (copy to library):
  - Keep file copy logic
  - Additionally: update `Asset.Status` to `'deployed'` in DB

- [ ] **Step 7.10** — Update `DELETE /api/assets/{filename}`:
  - Keep file delete logic
  - Additionally: delete or mark asset row as `rejected` in DB

---

### Phase 8: Update `.gitignore`

- [ ] **Step 8.1** — Add `backend/appsettings.json` to `.gitignore` to prevent committing the PostgreSQL password (currently NOT gitignored — security risk)
- [ ] **Step 8.2** — Create `backend/appsettings.Example.json` with placeholder credentials so developers know what fields are required:
  ```json
  {
    "ConnectionStrings": {
      "DefaultConnection": "Host=localhost;Port=5432;Database=MarketingAI;Username=YOUR_PG_USER;Password=YOUR_PG_PASSWORD"
    },
    "Gemini": { "ApiKey": "YOUR_GEMINI_API_KEY_HERE" },
    "TikTok": { "AccessToken": "YOUR_TIKTOK_ACCESS_TOKEN_HERE" }
  }
  ```

---

### Phase 9: Frontend API Response Compatibility Check

Ensure the updated endpoints return JSON in the **same shape** as the original file-based responses so the frontend `main.js` requires zero changes.

- [ ] **Step 9.1** — Verify `GET /api/guidelines` response shape matches what frontend expects:
  ```json
  { "brandLabel", "tone", "language", "description", "whitelist", "blacklist",
    "typography": { "headingFont", "headingSize", "bodyFont", "bodySize" },
    "palette": ["#hex", ...] }
  ```

- [ ] **Step 9.2** — Verify `GET /api/cmo/queue` response shape matches frontend expectation:
  ```json
  [{ "id", "url", "title", "type" }, ...]
  ```

- [ ] **Step 9.3** — Verify `GET /api/ppc/queue` response shape matches frontend expectation:
  ```json
  [{ "id", "url", "title", "type" }, ...]
  ```

- [ ] **Step 9.4** — Verify `GET /api/campaigns` response shape matches frontend expectation:
  ```json
  { "brief", "preset", "ratio", "timestamp" }
  ```

---

### Phase 10: Clean Up Legacy File References

- [ ] **Step 10.1** — Remove `const string GuidelinesFile = "brand_guidelines.json"` from `Program.cs`
- [ ] **Step 10.2** — Remove `const string CampaignsFile = "campaigns.json"` from `Program.cs`
- [ ] **Step 10.3** — Remove `const string CmoQueueFile = "cmo_queue.json"` from `Program.cs`
- [ ] **Step 10.4** — Remove `const string PpcQueueFile = "ppc_queue.json"` from `Program.cs`
- [ ] **Step 10.5** — Keep the original `.json` files as backup until testing is complete, then delete them

---

### Phase 11: Verification & Testing

- [ ] **Step 11.1** — Start backend (`dotnet run`) and confirm no startup errors
- [ ] **Step 11.2** — Test `GET /api/guidelines` → should return Bangladesh University brand data from DB
- [ ] **Step 11.3** — Test `POST /api/guidelines` with new data → confirm DB row updated, response 200 OK
- [ ] **Step 11.4** — Test `GET /api/cmo/queue` → should return 3 assets from DB
- [ ] **Step 11.5** — Test `POST /api/cmo/queue` with modified array → confirm DB sync
- [ ] **Step 11.6** — Test `GET /api/ppc/queue` → should return empty array (no ppc_pending assets yet)
- [ ] **Step 11.7** — Test `GET /api/campaigns` → should return the existing campaign record
- [ ] **Step 11.8** — Start frontend (`npm run dev`) and walk through full workflow:
  - Admin saves Brand Guidelines → verify DB row updated
  - Expert sets Objective/Targeting/Research/Config → reaches Studio
  - Studio: approve an asset → verify CMO queue updated in DB
  - CMO: authorize for PPC → verify asset status changes in DB
  - PPC: dispatch → verify asset status = 'deployed' in DB

---

## Summary: Files to Create or Modify

| Action | File |
|--------|------|
| **CREATE** | `backend/Data/AppDbContext.cs` |
| **CREATE** | `backend/Data/Entities/BrandGuideline.cs` |
| **CREATE** | `backend/Data/Entities/Campaign.cs` |
| **CREATE** | `backend/Data/Entities/Asset.cs` |
| **CREATE** | `backend/appsettings.Example.json` |
| **MODIFY** | `backend/backend.csproj` (add Npgsql + EF Core NuGet packages) |
| **MODIFY** | `backend/appsettings.json` (add PostgreSQL connection string) |
| **MODIFY** | `backend/Program.cs` (replace file I/O with EF Core, register DbContext) |
| **MODIFY** | `.gitignore` (protect appsettings.json with credentials) |

---

## Notes & Decisions

- **EF Core Migrations vs. EnsureCreated**: We will use `EnsureCreated()` on startup for simplicity — it auto-creates tables from entity models. EF Migrations can be layered on later for production schema evolution.
- **No ORM overhead for queues**: The CMO/PPC queue endpoints currently do a full array overwrite (POST replaces everything). We replicate this with a "delete all matching status + re-insert" strategy in the DB to keep frontend logic unchanged.
- **JSON response shape must not change**: The frontend makes hard-coded assumptions about the API response shape. All DB-backed endpoints must return identical JSON structures as the file-based versions.
- **`ppc_queue.json` does not exist**: It is created dynamically by the backend. The DB handles this naturally — an empty query result returns `[]` just like the original `Results.Ok(new List<object>())` fallback.
- **PostgreSQL datetime**: EF Core with Npgsql maps `DateTime` to `TIMESTAMPTZ`. The C# entities will use `DateTime` typed as UTC.
- **NuGet provider**: `Npgsql.EntityFrameworkCore.PostgreSQL` replaces `Microsoft.EntityFrameworkCore.Sqlite` — no other code changes needed beyond the provider registration line.
- **Credentials security**: The PostgreSQL password lives in `appsettings.json`. It must be added to `.gitignore` immediately. Use environment variables or `dotnet user-secrets` for team/production setups.
