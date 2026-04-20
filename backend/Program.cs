using System.Collections.Concurrent;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using Backend.Services;
using Backend.Middleware;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;
using System.Text;
using System.IdentityModel.Tokens.Jwt;

const string AssetsFolder = "Assets";
const string LibraryFolder = "Assets Library";

var httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
var aiCache = new ConcurrentDictionary<string, string[]>();

var builder = WebApplication.CreateBuilder(args);

// ══════════════════════════════════════════════════
// SERVICES
// ══════════════════════════════════════════════════
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddHttpClient<FacebookAdsService>();
builder.Services.AddHttpClient<GoogleAdsService>();
builder.Services.AddHttpClient<YouTubeAdsService>();
builder.Services.AddSingleton<DeploymentOrchestrator>();
builder.Services.AddSingleton<BrandComplianceService>();
// MetricsSummaryService: procedure-based singleton that refreshes ad_metrics_summary
builder.Services.AddSingleton<MetricsSummaryService>();
// Register MetricsFetchService as both singleton and hosted service so it can be injected
builder.Services.AddSingleton<MetricsFetchService>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<MetricsFetchService>());

// JWT Configuration
var jwtKey = builder.Configuration["Jwt:Key"] ?? "default_secret_key_at_least_32_chars_long!!";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "MarketingAIBackend";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "MarketingAIFrontend";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
        // Return JSON instead of HTML challenge for API routes
        options.Events = new JwtBearerEvents
        {
            OnChallenge = context =>
            {
                context.HandleResponse();
                context.Response.StatusCode = 401;
                context.Response.ContentType = "application/json";
                return context.Response.WriteAsync("{\"error\":\"Authentication required\"}");
            },
            OnForbidden = context =>
            {
                context.Response.StatusCode = 403;
                context.Response.ContentType = "application/json";
                return context.Response.WriteAsync("{\"error\":\"Access forbidden\"}");
            }
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", b => b.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
    // Create any new tables not covered by EnsureCreated (which only runs on empty DBs)
    db.Database.ExecuteSqlRaw(@"
        CREATE TABLE IF NOT EXISTS user_screens (
            user_id     INTEGER NOT NULL,
            screen_id   INTEGER NOT NULL,
            company_id  INTEGER,
            granted_by  INTEGER,
            granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (user_id, screen_id),
            FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
            FOREIGN KEY (screen_id) REFERENCES screens(id) ON DELETE CASCADE,
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL,
            FOREIGN KEY (granted_by) REFERENCES users(id)  ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS idx_userscreens_company ON user_screens(company_id);
        CREATE INDEX IF NOT EXISTS idx_userscreens_user    ON user_screens(user_id);
    ");
    db.Database.ExecuteSqlRaw(@"
        DO $$
        DECLARE column_type text;
        BEGIN
            SELECT data_type
            INTO column_type
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'ad_metrics'
              AND column_name = 'date';

            IF column_type = 'date' THEN
                ALTER TABLE ad_metrics
                ALTER COLUMN date TYPE TIMESTAMPTZ
                USING date::timestamp AT TIME ZONE 'UTC';
            ELSIF column_type = 'timestamp without time zone' THEN
                ALTER TABLE ad_metrics
                ALTER COLUMN date TYPE TIMESTAMPTZ
                USING date AT TIME ZONE 'UTC';
            END IF;
        END $$;
    ");
    // Enforce unique email on existing DB (EnsureCreated won't alter existing tables)
    try
    {
        db.Database.ExecuteSqlRaw("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email);");
    }
    catch (Exception ex)
    {
        // Duplicate emails exist in DB — log warning, uniqueness enforced at app level
        Console.WriteLine($"[WARN] Could not create unique email index: {ex.Message}");
    }

    // Stage 1: campaign_platform_specs table + target_platform column on ad_creatives
    db.Database.ExecuteSqlRaw(@"
        CREATE TABLE IF NOT EXISTS campaign_platform_specs (
            id                    SERIAL PRIMARY KEY,
            campaign_id           INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
            company_id            INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            platform              VARCHAR(50) NOT NULL,
            aspect_ratios         TEXT[] NOT NULL DEFAULT '{{}}',
            image_count           INTEGER NOT NULL DEFAULT 0,
            video_count           INTEGER NOT NULL DEFAULT 0,
            video_durations       TEXT[] NOT NULL DEFAULT '{{}}',
            primary_text_template TEXT,
            created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(campaign_id, platform)
        );
        CREATE INDEX IF NOT EXISTS idx_platformspecs_campaign ON campaign_platform_specs(campaign_id);
        CREATE INDEX IF NOT EXISTS idx_platformspecs_company  ON campaign_platform_specs(company_id);
        ALTER TABLE ad_creatives ADD COLUMN IF NOT EXISTS target_platform VARCHAR(50);
    ");

    // Stage 2 supplement: cost_per_result + target_cpa on ad_creatives (task 4.4)
    // Also enforce status workflow on ppp_queue (task 4.7)
    db.Database.ExecuteSqlRaw(@"
        ALTER TABLE ad_creatives ADD COLUMN IF NOT EXISTS cost_per_result NUMERIC(15,4);
        ALTER TABLE ad_creatives ADD COLUMN IF NOT EXISTS target_cpa NUMERIC(15,4);
        ALTER TABLE ppp_queue ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'received';
        UPDATE ppp_queue SET status = 'received'   WHERE status NOT IN ('received','budget_configured','ready_for_approval','deployed','rejected');
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'chk_pppqueue_status'
            ) THEN
                ALTER TABLE ppp_queue ADD CONSTRAINT chk_pppqueue_status
                    CHECK (status IN ('received','budget_configured','ready_for_approval','deployed','rejected'));
            END IF;
        END $$;
    ");

    // Stage 2: ppp_ad_budgets table + platform column on ppp_queue
    db.Database.ExecuteSqlRaw(@"
        ALTER TABLE ppp_queue ADD COLUMN IF NOT EXISTS platform VARCHAR(50);
        CREATE TABLE IF NOT EXISTS ppp_ad_budgets (
            id                   SERIAL PRIMARY KEY,
            company_id           INTEGER NOT NULL,
            ppp_queue_item_id    INTEGER NOT NULL,
            platform             VARCHAR(50) NOT NULL DEFAULT '',
            daily_budget         NUMERIC(15,4),
            lifetime_budget      NUMERIC(15,4),
            cost_per_result      NUMERIC(15,4),
            target_cpa           NUMERIC(15,4),
            bid_amount           NUMERIC(15,4),
            bid_strategy         VARCHAR(50),
            created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(ppp_queue_item_id, company_id)
        );
        CREATE INDEX IF NOT EXISTS idx_ppp_budget_company    ON ppp_ad_budgets(company_id);
        CREATE INDEX IF NOT EXISTS idx_ppp_budget_queue_item ON ppp_ad_budgets(ppp_queue_item_id);
    ");

    var platformServiceScreen = db.Screens.FirstOrDefault(s => s.Name == "PlatformService");
    if (platformServiceScreen == null)
    {
        platformServiceScreen = new Screen
        {
            Name = "PlatformService",
            DisplayName = "Platform Service",
            Category = "super",
            Icon = "🔄",
            SortOrder = 53,
            IsActive = true
        };
        db.Screens.Add(platformServiceScreen);
        db.SaveChanges();
    }
    else
    {
        platformServiceScreen.DisplayName = "Platform Service";
        platformServiceScreen.Category = "super";
        platformServiceScreen.Icon = "🔄";
        platformServiceScreen.SortOrder = 53;
        platformServiceScreen.IsActive = true;
        db.SaveChanges();
    }

    var superAdminRoleIds = db.Roles
        .Where(r => r.Name == "Super Admin")
        .Select(r => r.Id)
        .ToList();

    foreach (var roleId in superAdminRoleIds)
    {
        var hasPlatformServiceAccess = db.RoleScreens.Any(rs => rs.RoleId == roleId && rs.ScreenId == platformServiceScreen.Id);
        if (!hasPlatformServiceAccess)
        {
            db.RoleScreens.Add(new RoleScreen { RoleId = roleId, ScreenId = platformServiceScreen.Id });
        }
    }

    db.SaveChanges();

    // Stage 3: cmo_approval_logs table + eligible_platforms on campaigns
    db.Database.ExecuteSqlRaw(@"
        CREATE TABLE IF NOT EXISTS cmo_approval_logs (
            id                    SERIAL PRIMARY KEY,
            company_id            INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            campaign_id           INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
            approved_by           INTEGER REFERENCES users(id) ON DELETE SET NULL,
            approved_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            platforms_deployed    TEXT[] NOT NULL DEFAULT '{{}}',
            total_budget_approved NUMERIC(15,4) NOT NULL DEFAULT 0,
            items_deployed        INTEGER NOT NULL DEFAULT 0,
            notes                 TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_cmo_approval_logs_company  ON cmo_approval_logs(company_id);
        CREATE INDEX IF NOT EXISTS idx_cmo_approval_logs_campaign ON cmo_approval_logs(campaign_id);
        ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS eligible_platforms TEXT[] NOT NULL DEFAULT '{{}}';
    ");
    db.SaveChanges();

    // ad_metrics_summary: latest-snapshot table, refreshed by MetricsSummaryService after each run
    db.Database.ExecuteSqlRaw(@"
        -- New Facebook ID columns for stable UPSERT (append-only ad_metrics)
        ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS facebook_campaign_id VARCHAR(100);
        ALTER TABLE ad_sets   ADD COLUMN IF NOT EXISTS facebook_ad_set_id  VARCHAR(100);
        ALTER TABLE ads       ADD COLUMN IF NOT EXISTS facebook_ad_id      VARCHAR(100);

        -- Backfill from existing JSONB platform ID fields
        UPDATE campaigns SET facebook_campaign_id = platform_campaign_ids->>'facebook'
            WHERE facebook_campaign_id IS NULL AND platform_campaign_ids->>'facebook' IS NOT NULL;
        UPDATE ad_sets SET facebook_ad_set_id = platform_adset_ids->>'facebook'
            WHERE facebook_ad_set_id IS NULL AND platform_adset_ids->>'facebook' IS NOT NULL;
        UPDATE ads SET facebook_ad_id = platform_ad_ids->>'facebook'
            WHERE facebook_ad_id IS NULL AND platform_ad_ids->>'facebook' IS NOT NULL;

        -- Unique partial indexes (only on rows that have a Facebook ID)
        CREATE UNIQUE INDEX IF NOT EXISTS idx_campaigns_facebook_id ON campaigns(facebook_campaign_id) WHERE facebook_campaign_id IS NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_adsets_facebook_id    ON ad_sets(facebook_ad_set_id)    WHERE facebook_ad_set_id IS NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_ads_facebook_id       ON ads(facebook_ad_id)            WHERE facebook_ad_id IS NOT NULL;
    ");
    db.SaveChanges();

    db.Database.ExecuteSqlRaw(@"
        CREATE TABLE IF NOT EXISTS ad_metrics_summary (
            id                SERIAL PRIMARY KEY,
            company_id        INTEGER NOT NULL,
            campaign_id       INTEGER NOT NULL,
            ad_set_id         INTEGER,
            ad_id             INTEGER,
            platform          VARCHAR(50) NOT NULL,
            date              TIMESTAMPTZ NOT NULL,
            impressions       BIGINT NOT NULL DEFAULT 0,
            reach             BIGINT NOT NULL DEFAULT 0,
            clicks            BIGINT NOT NULL DEFAULT 0,
            ctr               NUMERIC NOT NULL DEFAULT 0,
            cpc               NUMERIC NOT NULL DEFAULT 0,
            cpm               NUMERIC NOT NULL DEFAULT 0,
            spend             NUMERIC NOT NULL DEFAULT 0,
            conversions       INTEGER NOT NULL DEFAULT 0,
            conversion_value  NUMERIC NOT NULL DEFAULT 0,
            roas              NUMERIC NOT NULL DEFAULT 0,
            frequency         NUMERIC NOT NULL DEFAULT 0,
            video_views       BIGINT,
            video_completions BIGINT,
            leads             INTEGER,
            app_installs      INTEGER,
            fetched_at        TIMESTAMPTZ NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_metrics_summary_company  ON ad_metrics_summary(company_id);
        CREATE INDEX IF NOT EXISTS idx_metrics_summary_campaign ON ad_metrics_summary(campaign_id, date);
        CREATE INDEX IF NOT EXISTS idx_metrics_summary_date     ON ad_metrics_summary(date);
        CREATE INDEX IF NOT EXISTS idx_metrics_summary_fetched  ON ad_metrics_summary(fetched_at);
    ");
    db.SaveChanges();

    // Dashboard engagement/retention columns (nullable, no backfill required)
    db.Database.ExecuteSqlRaw(@"
        ALTER TABLE ad_metrics         ADD COLUMN IF NOT EXISTS likes             BIGINT;
        ALTER TABLE ad_metrics         ADD COLUMN IF NOT EXISTS comments          BIGINT;
        ALTER TABLE ad_metrics         ADD COLUMN IF NOT EXISTS shares            BIGINT;
        ALTER TABLE ad_metrics         ADD COLUMN IF NOT EXISTS saves             BIGINT;
        ALTER TABLE ad_metrics         ADD COLUMN IF NOT EXISTS followers_gained  INTEGER;
        ALTER TABLE ad_metrics         ADD COLUMN IF NOT EXISTS avg_watch_seconds NUMERIC(10,2);
        ALTER TABLE ad_metrics_summary ADD COLUMN IF NOT EXISTS likes             BIGINT;
        ALTER TABLE ad_metrics_summary ADD COLUMN IF NOT EXISTS comments          BIGINT;
        ALTER TABLE ad_metrics_summary ADD COLUMN IF NOT EXISTS shares            BIGINT;
        ALTER TABLE ad_metrics_summary ADD COLUMN IF NOT EXISTS saves             BIGINT;
        ALTER TABLE ad_metrics_summary ADD COLUMN IF NOT EXISTS followers_gained  INTEGER;
        ALTER TABLE ad_metrics_summary ADD COLUMN IF NOT EXISTS avg_watch_seconds NUMERIC(10,2);
    ");
    db.SaveChanges();

    // Platform Service persistent settings (singleton row id=1)
    db.Database.ExecuteSqlRaw(@"
        CREATE TABLE IF NOT EXISTS platform_service_settings (
            id             INTEGER PRIMARY KEY,
            interval_hours NUMERIC(6,2) NOT NULL DEFAULT 4,
            is_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
            updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_by     INTEGER
        );
        INSERT INTO platform_service_settings (id, interval_hours, is_enabled)
        VALUES (1, 4, true)
        ON CONFLICT (id) DO NOTHING;
    ");
    db.SaveChanges();

}

if (app.Environment.IsDevelopment()) app.MapOpenApi();

app.UseCors("AllowAll");

// Global exception handler - always return JSON for API errors
app.Use(async (context, next) =>
{
    try { await next(); }
    catch (BadHttpRequestException ex)
    {
        context.Response.StatusCode = ex.StatusCode;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(new { error = ex.Message });
    }
    catch (Exception ex)
    {
        if (!context.Response.HasStarted)
        {
            context.Response.StatusCode = 500;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new { error = ex.Message });
        }
    }
});

app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<TenantMiddleware>();

if (!Directory.Exists(AssetsFolder)) Directory.CreateDirectory(AssetsFolder);
if (!Directory.Exists(LibraryFolder)) Directory.CreateDirectory(LibraryFolder);

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(
        Path.Combine(builder.Environment.ContentRootPath, AssetsFolder)),
    RequestPath = "/assets"
});

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(
        Path.Combine(builder.Environment.ContentRootPath, LibraryFolder)),
    RequestPath = "/library"
});

// ══════════════════════════════════════════════════
// HELPER: Generate JWT Token
// ══════════════════════════════════════════════════
string GenerateJwt(User user, string roleName, IConfiguration config)
{
    var key = config["Jwt:Key"] ?? "default_secret_key_at_least_32_chars_long!!";
    var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
    var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

    var claims = new List<Claim>
    {
        new(ClaimTypes.Name, user.Username!),
        new(ClaimTypes.Role, roleName),
        new(JwtRegisteredClaimNames.Sub, user.Username!),
        new("user_id", user.Id.ToString()),
        new("is_super_admin", user.IsSuperAdmin.ToString().ToLower())
    };

    if (user.CompanyId.HasValue)
        claims.Add(new Claim("company_id", user.CompanyId.Value.ToString()));

    var token = new JwtSecurityToken(
        issuer: config["Jwt:Issuer"] ?? "MarketingAIBackend",
        audience: config["Jwt:Audience"] ?? "MarketingAIFrontend",
        claims: claims,
        expires: DateTime.Now.AddHours(8),
        signingCredentials: credentials);

    return new JwtSecurityTokenHandler().WriteToken(token);
}

// ══════════════════════════════════════════════════
// AUTH ENDPOINTS
// ══════════════════════════════════════════════════

app.MapPost("/api/auth/register", async (AppDbContext db, RegisterRequest req) =>
{
    if (await db.Users.AnyAsync(u => u.Email == req.Email))
        return Results.BadRequest(new { message = "Email address is already registered" });

    var user = new User
    {
        Username = req.Username,
        Email = req.Email,
        RoleId = req.RoleId,
        CompanyId = req.CompanyId,
        PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
        CreatedAt = DateTime.UtcNow
    };

    db.Users.Add(user);
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "User registered successfully", userId = user.Id });
});

app.MapPost("/api/auth/login", async (AppDbContext db, IConfiguration config, LoginRequest req) =>
{
    var emailLower = req.Email.ToLower();
    var user = await db.Users
        .Include(u => u.Role)
        .Include(u => u.Company)
        .FirstOrDefaultAsync(u => u.Email!.ToLower() == emailLower);

    if (user == null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
        return Results.Unauthorized();

    if (user.Status != "active")
        return Results.BadRequest(new { message = "Account is suspended or deactivated" });

    var roleName = user.Role?.Name ?? "User";

    var screens = await db.RoleScreens
        .Where(rs => rs.RoleId == user.RoleId)
        .Select(rs => rs.Screen!.Name)
        .ToListAsync();

    // User-specific screen overrides take priority over role-based screens
    var userScreenOverrides = await db.UserScreens
        .Where(us => us.UserId == user.Id)
        .Select(us => us.Screen!.Name)
        .ToListAsync();

    if (userScreenOverrides.Count > 0)
        screens = userScreenOverrides;

    var token = GenerateJwt(user, roleName, config);

    // Update last login
    user.LastLoginAt = DateTime.UtcNow;
    await db.SaveChangesAsync();

    // For Super Admin, include companies list
    object? companies = null;
    if (user.IsSuperAdmin)
    {
        companies = await db.Companies
            .Where(c => c.Status == "active")
            .Select(c => new { c.Id, c.Name, c.Slug, c.LogoUrl, c.Industry })
            .ToListAsync();
    }

    return Results.Ok(new
    {
        token,
        user = new
        {
            user.Id,
            user.Username,
            Role = roleName,
            user.Email,
            user.FirstName,
            user.LastName,
            user.IsSuperAdmin,
            CompanyId = user.CompanyId,
            Company = user.Company != null ? new { user.Company.Id, user.Company.Name, user.Company.Slug, user.Company.LogoUrl } : null,
            Screens = screens
        },
        companies
    });
});

app.MapPost("/api/auth/refresh", async (AppDbContext db, IConfiguration config, RefreshTokenRequest req) =>
{
    var storedToken = await db.RefreshTokens
        .Include(rt => rt.User).ThenInclude(u => u!.Role)
        .FirstOrDefaultAsync(rt => rt.Token == req.RefreshToken && rt.RevokedAt == null);

    if (storedToken == null || storedToken.ExpiresAt < DateTime.UtcNow)
        return Results.Unauthorized();

    var user = storedToken.User!;
    var roleName = user.Role?.Name ?? "User";

    // Rotate token
    storedToken.RevokedAt = DateTime.UtcNow;
    var newRefreshToken = Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N");
    storedToken.ReplacedBy = newRefreshToken;

    db.RefreshTokens.Add(new RefreshToken
    {
        UserId = user.Id,
        Token = newRefreshToken,
        ExpiresAt = DateTime.UtcNow.AddDays(7),
        CreatedAt = DateTime.UtcNow
    });
    await db.SaveChangesAsync();

    return Results.Ok(new
    {
        token = GenerateJwt(user, roleName, config),
        refreshToken = newRefreshToken
    });
});

// ══════════════════════════════════════════════════
// COMPANY ONBOARDING
// ══════════════════════════════════════════════════

app.MapPost("/api/onboard/company", async (AppDbContext db, IConfiguration config, CompanyOnboardRequest req) =>
{
    var slug = req.CompanyName.ToLower().Replace(" ", "-").Replace("_", "-");
    if (await db.Companies.AnyAsync(c => c.Slug == slug))
        return Results.BadRequest(new { message = "Company with this name already exists" });

    var company = new Company
    {
        Name = req.CompanyName,
        Slug = slug,
        Industry = req.Industry,
        Website = req.Website,
        Status = "active"
    };
    db.Companies.Add(company);
    await db.SaveChangesAsync();

    // Create default company settings
    db.CompanySettings.Add(new CompanySetting { CompanyId = company.Id });

    // Seed 4 system roles for this company
    var adminRole = new Role { Name = "Admin", CompanyId = company.Id, IsSystemRole = true, Color = "purple", Icon = "A", Description = "Company Administrator" };
    var cmoRole = new Role { Name = "CMO", CompanyId = company.Id, IsSystemRole = true, Color = "amber", Icon = "B", Description = "Chief Marketing Officer" };
    var pppRole = new Role { Name = "PPP", CompanyId = company.Id, IsSystemRole = true, Color = "emerald", Icon = "P", Description = "Planner/Publisher/Performer" };
    var expertRole = new Role { Name = "Expert", CompanyId = company.Id, IsSystemRole = true, Color = "cyan", Icon = "E", Description = "Marketing Expert" };
    db.Roles.AddRange(adminRole, cmoRole, pppRole, expertRole);
    await db.SaveChangesAsync();

    // Get all screens and assign permissions
    var allScreens = await db.Screens.ToListAsync();

    // Admin gets all non-super-admin screens
    foreach (var s in allScreens.Where(s => s.Category != "super"))
        db.RoleScreens.Add(new RoleScreen { RoleId = adminRole.Id, ScreenId = s.Id, CompanyId = company.Id });

    var cmoScreenNames = new[] { "Dashboard", "BudgetMatrix", "Approvals", "Monitoring", "AdPerformance", "Budget", "Notifications", "CampaignReports", "CrossPlatformAnalytics" };
    foreach (var s in allScreens.Where(s => cmoScreenNames.Contains(s.Name)))
        db.RoleScreens.Add(new RoleScreen { RoleId = cmoRole.Id, ScreenId = s.Id, CompanyId = company.Id });

    var pppScreenNames = new[] { "Dashboard", "ApprovedAssets", "DeploySelection", "AdPerformance", "Monitoring", "Budget", "DeploymentHistory", "ABTestResults" };
    foreach (var s in allScreens.Where(s => pppScreenNames.Contains(s.Name)))
        db.RoleScreens.Add(new RoleScreen { RoleId = pppRole.Id, ScreenId = s.Id, CompanyId = company.Id });

    var expertScreenNames = new[] { "Dashboard", "Objective", "Targeting", "Research", "CreativeConfig", "Studio", "AudienceInsights", "CompetitorResearch" };
    foreach (var s in allScreens.Where(s => expertScreenNames.Contains(s.Name)))
        db.RoleScreens.Add(new RoleScreen { RoleId = expertRole.Id, ScreenId = s.Id, CompanyId = company.Id });

    // Create admin user
    var adminUser = new User
    {
        Username = req.AdminUsername,
        Email = req.AdminEmail,
        PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.AdminPassword),
        RoleId = adminRole.Id,
        CompanyId = company.Id,
        CreatedAt = DateTime.UtcNow
    };
    db.Users.Add(adminUser);
    await db.SaveChangesAsync();

    var token = GenerateJwt(adminUser, "Admin", config);

    return Results.Ok(new
    {
        company = new { company.Id, company.Name, company.Slug },
        admin = new { adminUser.Id, adminUser.Username },
        token
    });
});

// ══════════════════════════════════════════════════
// SUPER ADMIN ENDPOINTS
// ══════════════════════════════════════════════════

app.MapGet("/api/super-admin/companies", async (AppDbContext db, HttpContext ctx) =>
{
    if (!ctx.IsSuperAdmin()) return Results.Forbid();
    var companies = await db.Companies
        .Select(c => new
        {
            c.Id, c.Name, c.Slug, c.Industry, c.Status, c.LogoUrl, c.SubscriptionPlan,
            UserCount = db.Users.Count(u => u.CompanyId == c.Id),
            CampaignCount = db.Campaigns.Count(ca => ca.CompanyId == c.Id),
            c.CreatedAt
        }).ToListAsync();
    return Results.Ok(companies);
});

app.MapPost("/api/super-admin/companies", async (AppDbContext db, HttpContext ctx, CreateCompanyRequest req) =>
{
    if (!ctx.IsSuperAdmin()) return Results.Forbid();
    var slug = req.Name.ToLower().Replace(" ", "-").Replace("_", "-");
    var company = new Company { Name = req.Name, Slug = slug, Industry = req.Industry, Website = req.Website, Email = req.Email, Country = req.Country, CreatedBy = ctx.GetUserId() };
    db.Companies.Add(company);
    await db.SaveChangesAsync();
    db.CompanySettings.Add(new CompanySetting { CompanyId = company.Id });
    await db.SaveChangesAsync();
    return Results.Created($"/api/super-admin/companies/{company.Id}", new { company.Id, company.Name, company.Slug });
});

app.MapGet("/api/super-admin/companies/{id}", async (AppDbContext db, HttpContext ctx, int id) =>
{
    if (!ctx.IsSuperAdmin()) return Results.Forbid();
    var company = await db.Companies.Include(c => c.Settings).FirstOrDefaultAsync(c => c.Id == id);
    if (company == null) return Results.NotFound();
    var users = await db.Users.Where(u => u.CompanyId == id).Include(u => u.Role).Select(u => new { u.Id, u.Username, u.Email, Role = u.Role!.Name, u.Status }).ToListAsync();
    var campaigns = await db.Campaigns.Where(c => c.CompanyId == id).OrderByDescending(c => c.CreatedAt).Take(20).Select(c => new { c.Id, c.Name, c.Status, c.CreatedAt }).ToListAsync();
    return Results.Ok(new { company, users, campaigns });
});

app.MapPut("/api/super-admin/companies/{id}", async (AppDbContext db, HttpContext ctx, int id, UpdateCompanyRequest req) =>
{
    if (!ctx.IsSuperAdmin()) return Results.Forbid();
    var company = await db.Companies.FindAsync(id);
    if (company == null) return Results.NotFound();
    if (req.Name != null) company.Name = req.Name;
    if (req.Industry != null) company.Industry = req.Industry;
    if (req.Website != null) company.Website = req.Website;
    if (req.Email != null) company.Email = req.Email;
    if (req.Status != null) company.Status = req.Status;
    company.UpdatedAt = DateTime.UtcNow;
    await db.SaveChangesAsync();
    return Results.Ok(company);
});

app.MapDelete("/api/super-admin/companies/{id}", async (AppDbContext db, HttpContext ctx, int id) =>
{
    if (!ctx.IsSuperAdmin()) return Results.Forbid();
    var company = await db.Companies.FindAsync(id);
    if (company == null) return Results.NotFound();
    company.Status = "archived";
    company.UpdatedAt = DateTime.UtcNow;
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Company archived" });
});

app.MapGet("/api/super-admin/companies/{id}/users", async (AppDbContext db, HttpContext ctx, int id) =>
{
    if (!ctx.IsSuperAdmin()) return Results.Forbid();
    var users = await db.Users.Where(u => u.CompanyId == id).Include(u => u.Role)
        .Select(u => new { u.Id, u.Username, u.Email, Role = u.Role!.Name, u.Status, u.LastLoginAt, u.CreatedAt }).ToListAsync();
    return Results.Ok(users);
});

app.MapGet("/api/super-admin/companies/{id}/campaigns", async (AppDbContext db, HttpContext ctx, int id) =>
{
    if (!ctx.IsSuperAdmin()) return Results.Forbid();
    var campaigns = await db.Campaigns.Where(c => c.CompanyId == id).OrderByDescending(c => c.CreatedAt)
        .Select(c => new { c.Id, c.Name, c.Status, c.TotalBudget, c.Platforms, c.CreatedAt }).ToListAsync();
    return Results.Ok(campaigns);
});

app.MapGet("/api/super-admin/dashboard", async (AppDbContext db, HttpContext ctx) =>
{
    if (!ctx.IsSuperAdmin()) return Results.Forbid();
    return Results.Ok(new
    {
        totalCompanies = await db.Companies.CountAsync(c => c.Status == "active"),
        totalUsers = await db.Users.CountAsync(u => u.Status == "active"),
        totalCampaigns = await db.Campaigns.CountAsync(),
        activeCampaigns = await db.Campaigns.CountAsync(c => c.Status == "active"),
        totalSpend = await db.AdMetrics.Where(m => m.AdSetId != null && m.AdId != null).SumAsync(m => m.Spend),
        topCompanies = await db.Companies.Where(c => c.Status == "active")
            .Select(c => new { c.Id, c.Name, Campaigns = db.Campaigns.Count(ca => ca.CompanyId == c.Id), Users = db.Users.Count(u => u.CompanyId == c.Id) })
            .OrderByDescending(c => c.Campaigns).Take(5).ToListAsync()
    });
});

app.MapGet("/api/super-admin/platform-service", (HttpContext ctx, MetricsFetchService svc) =>
{
    if (!ctx.IsSuperAdmin()) return Results.Forbid();
    return Results.Ok(new
    {
        serviceName = "MetricsFetchService",
        displayName = "Platform Service",
        status = svc.GetStatus()
    });
}).RequireAuthorization();

app.MapPost("/api/super-admin/platform-service/start", (HttpContext ctx, MetricsFetchService svc) =>
{
    if (!ctx.IsSuperAdmin()) return Results.Forbid();
    return Results.Ok(new
    {
        message = "Platform Service started.",
        status = svc.StartScheduledExecution()
    });
}).RequireAuthorization();

app.MapPost("/api/super-admin/platform-service/stop", (HttpContext ctx, MetricsFetchService svc) =>
{
    if (!ctx.IsSuperAdmin()) return Results.Forbid();
    return Results.Ok(new
    {
        message = "Platform Service stopped.",
        status = svc.StopScheduledExecution()
    });
}).RequireAuthorization();

app.MapPost("/api/super-admin/platform-service/update", (HttpContext ctx, MetricsFetchService svc) =>
{
    if (!ctx.IsSuperAdmin()) return Results.Forbid();
    return Results.Ok(new
    {
        message = "Platform Service update requested.",
        status = svc.RequestImmediateRun()
    });
}).RequireAuthorization();

app.MapPost("/api/super-admin/platform-service/interval", (HttpContext ctx, MetricsFetchService svc, PlatformServiceIntervalRequest req) =>
{
    if (!ctx.IsSuperAdmin()) return Results.Forbid();
    if (req.IntervalHours < 0.25 || req.IntervalHours > 168)
    {
        return Results.BadRequest(new { error = "Schedule interval must be between 0.25 and 168 hours." });
    }

    return Results.Ok(new
    {
        message = "Platform Service schedule interval updated.",
        status = svc.SetIntervalHours(req.IntervalHours)
    });
}).RequireAuthorization();

app.MapGet("/api/super-admin/audit-log", async (AppDbContext db, HttpContext ctx, int? companyId, int limit = 50, int offset = 0) =>
{
    if (!ctx.IsSuperAdmin()) return Results.Forbid();
    var query = db.ActivityLogs.AsQueryable();
    if (companyId.HasValue) query = query.Where(a => a.CompanyId == companyId);
    var logs = await query.OrderByDescending(a => a.CreatedAt).Skip(offset).Take(limit)
        .Select(a => new { a.Id, a.CompanyId, a.UserId, a.Action, a.ResourceType, a.ResourceId, a.Description, a.CreatedAt }).ToListAsync();
    return Results.Ok(logs);
});

// ══════════════════════════════════════════════════
// RBAC ENDPOINTS (Tenant-Scoped)
// ══════════════════════════════════════════════════

app.MapGet("/api/rbac/roles", async (AppDbContext db, HttpContext ctx) =>
{
    // Roles are global (5 total). Super Admin sees all; others see all except Super Admin.
    var query = db.Roles.AsQueryable();
    if (!ctx.IsSuperAdmin())
        query = query.Where(r => r.Name != "Super Admin");
    return Results.Ok(await query.ToListAsync());
});

app.MapGet("/api/rbac/screens", async (AppDbContext db, HttpContext ctx) =>
{
    var query = db.Screens.Where(s => s.IsActive);
    // Non-super-admins must not see or assign super-admin-only screens
    if (!ctx.IsSuperAdmin())
    {
        var superAdminScreenNames = new[] { "GlobalDashboard", "CompanyManagement", "SystemConfig", "PlatformService", "AuditLog" };
        query = query.Where(s => !superAdminScreenNames.Contains(s.Name));
    }
    return Results.Ok(await query.OrderBy(s => s.SortOrder).ToListAsync());
});

app.MapGet("/api/rbac/users", async (AppDbContext db, HttpContext ctx) =>
{
    var companyId = ctx.GetCompanyId();
    var query = db.Users.Include(u => u.Role).Include(u => u.Company).AsQueryable();
    if (companyId.HasValue && !ctx.IsSuperAdmin()) query = query.Where(u => u.CompanyId == companyId);
    // Non-super-admins never see super admin accounts
    if (!ctx.IsSuperAdmin()) query = query.Where(u => !u.IsSuperAdmin);
    var users = await query.OrderByDescending(u => u.CreatedAt)
        .Select(u => new { u.Id, u.Username, u.Email, u.FirstName, u.LastName, u.IsSuperAdmin, u.Status,
            Role = u.Role != null ? new { u.Role.Id, u.Role.Name } : null,
            Company = u.Company != null ? new { u.Company.Id, u.Company.Name } : null, u.LastLoginAt, u.CreatedAt }).ToListAsync();
    return Results.Ok(users);
});

app.MapDelete("/api/rbac/users/{id}", async (AppDbContext db, HttpContext ctx, int id) =>
{
    var user = await db.Users.FindAsync(id);
    if (user == null) return Results.NotFound();
    if (!ctx.IsSuperAdmin() && user.CompanyId != ctx.GetCompanyId()) return Results.Forbid();
    user.Status = "deactivated";
    user.UpdatedAt = DateTime.UtcNow;
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "User access revoked" });
});

app.MapPatch("/api/rbac/users/{id}/activate", async (AppDbContext db, HttpContext ctx, int id) =>
{
    var user = await db.Users.FindAsync(id);
    if (user == null) return Results.NotFound();
    if (!ctx.IsSuperAdmin() && user.CompanyId != ctx.GetCompanyId()) return Results.Forbid();
    user.Status = "active";
    user.UpdatedAt = DateTime.UtcNow;
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "User activated" });
});

app.MapDelete("/api/rbac/users/{id}/permanent", async (AppDbContext db, HttpContext ctx, int id) =>
{
    var user = await db.Users.FindAsync(id);
    if (user == null) return Results.NotFound();
    if (!ctx.IsSuperAdmin() && user.CompanyId != ctx.GetCompanyId()) return Results.Forbid();
    // Prevent deleting own account or the master superadmin
    if (user.Id == ctx.GetUserId()) return Results.BadRequest(new { message = "Cannot delete your own account" });
    db.Users.Remove(user);
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "User permanently deleted" });
});

app.MapPost("/api/rbac/roles", async (AppDbContext db, HttpContext ctx, Role role) =>
{
    if (string.IsNullOrWhiteSpace(role.Name)) return Results.BadRequest("Role name required");
    role.CompanyId = ctx.GetCompanyId();
    role.CreatedAt = DateTime.UtcNow;
    db.Roles.Add(role);
    await db.SaveChangesAsync();
    return Results.Created($"/api/rbac/roles/{role.Id}", role);
});

app.MapPut("/api/rbac/roles/{id}", async (AppDbContext db, HttpContext ctx, int id, Role updatedRole) =>
{
    var role = await db.Roles.FindAsync(id);
    if (role == null) return Results.NotFound();
    if (!ctx.IsSuperAdmin() && role.CompanyId != ctx.GetCompanyId()) return Results.Forbid();
    role.Name = updatedRole.Name;
    if (updatedRole.Description != null) role.Description = updatedRole.Description;
    if (updatedRole.Color != null) role.Color = updatedRole.Color;
    if (updatedRole.Icon != null) role.Icon = updatedRole.Icon;
    await db.SaveChangesAsync();
    return Results.Ok(role);
});

app.MapDelete("/api/rbac/roles/{id}", async (AppDbContext db, HttpContext ctx, int id) =>
{
    var role = await db.Roles.FindAsync(id);
    if (role == null) return Results.NotFound();
    if (role.IsSystemRole) return Results.BadRequest(new { message = "Cannot delete system roles" });
    if (!ctx.IsSuperAdmin() && role.CompanyId != ctx.GetCompanyId()) return Results.Forbid();
    db.Roles.Remove(role);
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Role deleted" });
});

app.MapGet("/api/rbac/role-permissions/{roleId}", async (AppDbContext db, int roleId) =>
{
    var screenIds = await db.RoleScreens.Where(rs => rs.RoleId == roleId).Select(rs => rs.ScreenId).ToListAsync();
    return Results.Ok(screenIds);
});

app.MapPost("/api/rbac/role-permissions", async (AppDbContext db, HttpContext ctx, RolePermissionsRequest req) =>
{
    var screenIds = req.ScreenIds;
    // Non-super-admins cannot grant super-admin-only screens to any role
    if (!ctx.IsSuperAdmin())
    {
        var superAdminScreenNames = new[] { "GlobalDashboard", "CompanyManagement", "SystemConfig", "PlatformService", "AuditLog" };
        var superScreenIds = await db.Screens
            .Where(s => superAdminScreenNames.Contains(s.Name))
            .Select(s => s.Id)
            .ToListAsync();
        screenIds = screenIds.Where(sid => !superScreenIds.Contains(sid)).ToList();
    }
    var old = db.RoleScreens.Where(rs => rs.RoleId == req.RoleId);
    db.RoleScreens.RemoveRange(old);
    var companyId = ctx.GetCompanyId();
    foreach (var sid in screenIds)
        db.RoleScreens.Add(new RoleScreen { RoleId = req.RoleId, ScreenId = sid, CompanyId = companyId });
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Permissions synchronized" });
});

// User-level permission overrides
app.MapGet("/api/rbac/user-permissions/{userId}", async (AppDbContext db, HttpContext ctx, int userId) =>
{
    var targetUser = await db.Users.FindAsync(userId);
    if (targetUser == null) return Results.NotFound();
    if (!ctx.IsSuperAdmin())
    {
        if (targetUser.IsSuperAdmin) return Results.Forbid();
        if (targetUser.CompanyId != ctx.GetCompanyId()) return Results.Forbid();
    }
    var screenIds = await db.UserScreens
        .Where(us => us.UserId == userId)
        .Select(us => us.ScreenId)
        .ToListAsync();
    return Results.Ok(screenIds);
});

app.MapPost("/api/rbac/user-permissions", async (AppDbContext db, HttpContext ctx, UserPermissionsRequest req) =>
{
    var targetUser = await db.Users.FindAsync(req.UserId);
    if (targetUser == null) return Results.NotFound();
    if (!ctx.IsSuperAdmin())
    {
        if (targetUser.IsSuperAdmin) return Results.Forbid();
        if (targetUser.CompanyId != ctx.GetCompanyId()) return Results.Forbid();
    }
    var screenIds = req.ScreenIds;
    // Non-super-admins cannot grant super-admin-only screens
    if (!ctx.IsSuperAdmin())
    {
        var superAdminScreenNames = new[] { "GlobalDashboard", "CompanyManagement", "SystemConfig", "PlatformService", "AuditLog" };
        var superScreenIds = await db.Screens
            .Where(s => superAdminScreenNames.Contains(s.Name))
            .Select(s => s.Id)
            .ToListAsync();
        screenIds = screenIds.Where(sid => !superScreenIds.Contains(sid)).ToList();
    }
    var old = db.UserScreens.Where(us => us.UserId == req.UserId);
    db.UserScreens.RemoveRange(old);
    // Use target user's company (Super Admin has no company context of their own)
    var companyId = ctx.IsSuperAdmin() ? targetUser.CompanyId : ctx.GetCompanyId();
    var grantedBy = ctx.GetUserId();
    foreach (var sid in screenIds)
        db.UserScreens.Add(new UserScreen { UserId = req.UserId, ScreenId = sid, CompanyId = companyId, GrantedBy = grantedBy });
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "User permissions synchronized" });
});

// ══════════════════════════════════════════════════
// SEED ENDPOINT
// ══════════════════════════════════════════════════

app.MapPost("/api/rbac/seed", async (AppDbContext db) =>
{
    // Clear existing
    db.RoleScreens.RemoveRange(db.RoleScreens);
    db.Screens.RemoveRange(db.Screens);
    db.Users.RemoveRange(db.Users);
    db.Roles.RemoveRange(db.Roles);
    db.Companies.RemoveRange(db.Companies);
    db.CompanySettings.RemoveRange(db.CompanySettings);
    db.CampaignObjectives.RemoveRange(db.CampaignObjectives);
    await db.SaveChangesAsync();

    // ── Create Screens (33 total) ──
    var screens = new List<Screen>
    {
        // Shared
        new() { Name = "Dashboard", DisplayName = "Dashboard", Category = "shared", Icon = "📊", SortOrder = 0 },
        // Expert
        new() { Name = "Objective", DisplayName = "Campaign Objective", Category = "expert", Icon = "🎯", SortOrder = 1 },
        new() { Name = "Targeting", DisplayName = "Target Audience", Category = "expert", Icon = "👥", SortOrder = 2 },
        new() { Name = "Research", DisplayName = "Strategy Hub", Category = "expert", Icon = "🔬", SortOrder = 3 },
        new() { Name = "CreativeConfig", DisplayName = "Creative Config", Category = "expert", Icon = "🎨", SortOrder = 4 },
        new() { Name = "Studio", DisplayName = "Creative Studio", Category = "expert", Icon = "🖼️", SortOrder = 5 },
        new() { Name = "AudienceInsights", DisplayName = "Audience Insights", Category = "expert", Icon = "📈", SortOrder = 6 },
        new() { Name = "CompetitorResearch", DisplayName = "Competitor Research", Category = "expert", Icon = "🔍", SortOrder = 7 },
        // CMO
        new() { Name = "BudgetMatrix", DisplayName = "Budget & Matrix", Category = "cmo", Icon = "📈", SortOrder = 10 },
        new() { Name = "Approvals", DisplayName = "Ad Approvals", Category = "cmo", Icon = "✅", SortOrder = 11 },
        new() { Name = "Monitoring", DisplayName = "AI Monitoring", Category = "cmo", Icon = "📊", SortOrder = 12 },
        new() { Name = "AdPerformance", DisplayName = "Ad Performance", Category = "shared", Icon = "📈", SortOrder = 13 },
        new() { Name = "Budget", DisplayName = "Budget Overview", Category = "cmo", Icon = "💰", SortOrder = 14 },
        new() { Name = "Notifications", DisplayName = "Notifications", Category = "shared", Icon = "🔔", SortOrder = 15 },
        new() { Name = "CampaignReports", DisplayName = "Campaign Reports", Category = "cmo", Icon = "📋", SortOrder = 16 },
        new() { Name = "CrossPlatformAnalytics", DisplayName = "Cross-Platform Analytics", Category = "cmo", Icon = "📊", SortOrder = 17 },
        // PPP
        new() { Name = "ApprovedAssets", DisplayName = "Approved Assets", Category = "ppp", Icon = "✅", SortOrder = 20 },
        new() { Name = "DeploySelection", DisplayName = "Platform Selection", Category = "ppp", Icon = "🎯", SortOrder = 21 },
        new() { Name = "DeploymentHistory", DisplayName = "Deployment History", Category = "ppp", Icon = "📜", SortOrder = 22 },
        new() { Name = "ABTestResults", DisplayName = "A/B Test Results", Category = "ppp", Icon = "🧪", SortOrder = 23 },
        // Admin
        new() { Name = "UserManagement", DisplayName = "User Management", Category = "admin", Icon = "👥", SortOrder = 30 },
        new() { Name = "RoleManagement", DisplayName = "Role Management", Category = "admin", Icon = "👤", SortOrder = 31 },
        new() { Name = "CompanyProfile", DisplayName = "Company Profile", Category = "admin", Icon = "🏢", SortOrder = 32 },
        new() { Name = "Config", DisplayName = "Platform Config", Category = "admin", Icon = "⚙️", SortOrder = 33 },
        new() { Name = "Calendar", DisplayName = "Global Calendar", Category = "admin", Icon = "📅", SortOrder = 34 },
        new() { Name = "Guideline", DisplayName = "Brand Guideline", Category = "admin", Icon = "📜", SortOrder = 35 },
        new() { Name = "Assets", DisplayName = "Creative Assets", Category = "admin", Icon = "🖼️", SortOrder = 36 },
        new() { Name = "AdAccountManagement", DisplayName = "Ad Account Management", Category = "admin", Icon = "🔑", SortOrder = 37 },
        new() { Name = "BillingSettings", DisplayName = "Billing & Subscription", Category = "admin", Icon = "💳", SortOrder = 38 },
        // Super Admin
        new() { Name = "GlobalDashboard", DisplayName = "Global Dashboard", Category = "super", Icon = "🌐", SortOrder = 50 },
        new() { Name = "CompanyManagement", DisplayName = "Company Management", Category = "super", Icon = "🏢", SortOrder = 51 },
        new() { Name = "SystemConfig", DisplayName = "System Configuration", Category = "super", Icon = "⚙️", SortOrder = 52 },
        new() { Name = "PlatformService", DisplayName = "Platform Service", Category = "super", Icon = "🔄", SortOrder = 53 },
        new() { Name = "AuditLog", DisplayName = "Audit Log", Category = "super", Icon = "📋", SortOrder = 54 }
    };
    db.Screens.AddRange(screens);
    await db.SaveChangesAsync();

    // ── Create Default Company ──
    var defaultCompany = new Company { Name = "Demo Company", Slug = "demo-company", Industry = "Marketing", Status = "active" };
    db.Companies.Add(defaultCompany);
    await db.SaveChangesAsync();
    db.CompanySettings.Add(new CompanySetting { CompanyId = defaultCompany.Id });
    await db.SaveChangesAsync();

    // ── Create Roles ──
    var superAdminRole = new Role { Name = "Super Admin", CompanyId = null, IsSystemRole = true, Color = "gold", Icon = "S", Description = "System Super Administrator" };
    var adminRole = new Role { Name = "Admin", CompanyId = defaultCompany.Id, IsSystemRole = true, Color = "purple", Icon = "A", Description = "Company Administrator" };
    var cmoRole = new Role { Name = "CMO", CompanyId = defaultCompany.Id, IsSystemRole = true, Color = "amber", Icon = "B", Description = "Chief Marketing Officer" };
    var pppRole = new Role { Name = "PPP", CompanyId = defaultCompany.Id, IsSystemRole = true, Color = "emerald", Icon = "P", Description = "Planner/Publisher/Performer" };
    var expertRole = new Role { Name = "Expert", CompanyId = defaultCompany.Id, IsSystemRole = true, Color = "cyan", Icon = "E", Description = "Marketing Expert" };
    db.Roles.AddRange(superAdminRole, adminRole, cmoRole, pppRole, expertRole);
    await db.SaveChangesAsync();

    // ── Role-Screen Permissions ──
    // Super Admin: all screens
    foreach (var s in screens)
        db.RoleScreens.Add(new RoleScreen { RoleId = superAdminRole.Id, ScreenId = s.Id });

    // Admin: all non-super screens
    foreach (var s in screens.Where(s => s.Category != "super"))
        db.RoleScreens.Add(new RoleScreen { RoleId = adminRole.Id, ScreenId = s.Id, CompanyId = defaultCompany.Id });

    // CMO
    var cmoScreenNames = new[] { "Dashboard", "BudgetMatrix", "Approvals", "Monitoring", "AdPerformance", "Budget", "Notifications", "CampaignReports", "CrossPlatformAnalytics" };
    foreach (var s in screens.Where(x => cmoScreenNames.Contains(x.Name)))
        db.RoleScreens.Add(new RoleScreen { RoleId = cmoRole.Id, ScreenId = s.Id, CompanyId = defaultCompany.Id });

    // PPP
    var pppScreenNames = new[] { "Dashboard", "ApprovedAssets", "DeploySelection", "AdPerformance", "Monitoring", "Budget", "DeploymentHistory", "ABTestResults" };
    foreach (var s in screens.Where(x => pppScreenNames.Contains(x.Name)))
        db.RoleScreens.Add(new RoleScreen { RoleId = pppRole.Id, ScreenId = s.Id, CompanyId = defaultCompany.Id });

    // Expert
    var expertScreenNames = new[] { "Dashboard", "Objective", "Targeting", "Research", "CreativeConfig", "Studio", "AudienceInsights", "CompetitorResearch" };
    foreach (var s in screens.Where(x => expertScreenNames.Contains(x.Name)))
        db.RoleScreens.Add(new RoleScreen { RoleId = expertRole.Id, ScreenId = s.Id, CompanyId = defaultCompany.Id });

    await db.SaveChangesAsync();

    // ── Seed Users ──
    db.Users.Add(new User { Username = "superadmin", Email = "superadmin@system.local", RoleId = superAdminRole.Id, CompanyId = null, IsSuperAdmin = true, PasswordHash = BCrypt.Net.BCrypt.HashPassword("123456") });
    db.Users.Add(new User { Username = "admin", Email = "admin@demo.com", RoleId = adminRole.Id, CompanyId = defaultCompany.Id, PasswordHash = BCrypt.Net.BCrypt.HashPassword("123456") });
    db.Users.Add(new User { Username = "cmo", Email = "cmo@demo.com", RoleId = cmoRole.Id, CompanyId = defaultCompany.Id, PasswordHash = BCrypt.Net.BCrypt.HashPassword("123456") });
    db.Users.Add(new User { Username = "ppp", Email = "ppp@demo.com", RoleId = pppRole.Id, CompanyId = defaultCompany.Id, PasswordHash = BCrypt.Net.BCrypt.HashPassword("123456") });
    db.Users.Add(new User { Username = "expert", Email = "expert@demo.com", RoleId = expertRole.Id, CompanyId = defaultCompany.Id, PasswordHash = BCrypt.Net.BCrypt.HashPassword("123456") });
    await db.SaveChangesAsync();

    // ── Seed Campaign Objectives (13) ──
    var objectives = new List<CampaignObjective>
    {
        new() { Category = "awareness", Name = "Brand Awareness", Description = "Increase brand recognition", Icon = "👁️", PlatformMapping = JsonSerializer.Deserialize<JsonElement>("{\"facebook\":\"OUTCOME_AWARENESS\",\"tiktok\":\"REACH\",\"youtube\":\"VIDEO_VIEWS\",\"google_ads\":\"AWARENESS\"}"), SupportedPlatforms = new[]{"facebook","tiktok","youtube","google_ads"}, SortOrder = 1 },
        new() { Category = "awareness", Name = "Reach", Description = "Maximize ad reach", Icon = "📡", PlatformMapping = JsonSerializer.Deserialize<JsonElement>("{\"facebook\":\"OUTCOME_AWARENESS\",\"tiktok\":\"REACH\"}"), SupportedPlatforms = new[]{"facebook","tiktok"}, SortOrder = 2 },
        new() { Category = "awareness", Name = "Video Views", Description = "Get more video views", Icon = "▶️", PlatformMapping = JsonSerializer.Deserialize<JsonElement>("{\"facebook\":\"OUTCOME_AWARENESS\",\"youtube\":\"VIDEO_VIEWS\",\"tiktok\":\"VIDEO_VIEWS\"}"), SupportedPlatforms = new[]{"facebook","youtube","tiktok"}, SortOrder = 3 },
        new() { Category = "consideration", Name = "Traffic", Description = "Drive website traffic", Icon = "🔗", PlatformMapping = JsonSerializer.Deserialize<JsonElement>("{\"facebook\":\"OUTCOME_TRAFFIC\",\"tiktok\":\"TRAFFIC\",\"google_ads\":\"WEBSITE_TRAFFIC\"}"), SupportedPlatforms = new[]{"facebook","tiktok","google_ads"}, SortOrder = 4 },
        new() { Category = "consideration", Name = "Engagement", Description = "Increase post engagement", Icon = "💬", PlatformMapping = JsonSerializer.Deserialize<JsonElement>("{\"facebook\":\"OUTCOME_ENGAGEMENT\",\"tiktok\":\"TRAFFIC\"}"), SupportedPlatforms = new[]{"facebook","tiktok"}, SortOrder = 5 },
        new() { Category = "consideration", Name = "App Installs", Description = "Drive app installations", Icon = "📱", PlatformMapping = JsonSerializer.Deserialize<JsonElement>("{\"facebook\":\"OUTCOME_APP_PROMOTION\",\"tiktok\":\"APP_INSTALL\",\"google_ads\":\"APP_PROMOTION\"}"), SupportedPlatforms = new[]{"facebook","tiktok","google_ads"}, SortOrder = 6 },
        new() { Category = "consideration", Name = "Lead Generation", Description = "Collect leads", Icon = "📝", PlatformMapping = JsonSerializer.Deserialize<JsonElement>("{\"facebook\":\"OUTCOME_LEADS\",\"tiktok\":\"LEAD_GENERATION\",\"google_ads\":\"LEAD_GENERATION\"}"), SupportedPlatforms = new[]{"facebook","tiktok","google_ads"}, SortOrder = 7 },
        new() { Category = "consideration", Name = "Messages", Description = "Get more messages", Icon = "✉️", PlatformMapping = JsonSerializer.Deserialize<JsonElement>("{\"facebook\":\"OUTCOME_ENGAGEMENT\"}"), SupportedPlatforms = new[]{"facebook"}, SortOrder = 8 },
        new() { Category = "conversion", Name = "Conversions", Description = "Drive website conversions", Icon = "🎯", PlatformMapping = JsonSerializer.Deserialize<JsonElement>("{\"facebook\":\"OUTCOME_SALES\",\"tiktok\":\"CONVERSIONS\",\"google_ads\":\"CONVERSIONS\"}"), SupportedPlatforms = new[]{"facebook","tiktok","google_ads"}, SortOrder = 9 },
        new() { Category = "conversion", Name = "Catalog Sales", Description = "Sell from product catalog", Icon = "🛒", PlatformMapping = JsonSerializer.Deserialize<JsonElement>("{\"facebook\":\"OUTCOME_SALES\",\"google_ads\":\"SHOPPING\"}"), SupportedPlatforms = new[]{"facebook","google_ads"}, SortOrder = 10 },
        new() { Category = "conversion", Name = "Store Traffic", Description = "Drive store visits", Icon = "🏪", PlatformMapping = JsonSerializer.Deserialize<JsonElement>("{\"facebook\":\"OUTCOME_AWARENESS\",\"google_ads\":\"LOCAL_STORE_VISITS\"}"), SupportedPlatforms = new[]{"facebook","google_ads"}, SortOrder = 11 },
        new() { Category = "conversion", Name = "Sales", Description = "Drive online sales", Icon = "💰", PlatformMapping = JsonSerializer.Deserialize<JsonElement>("{\"facebook\":\"OUTCOME_SALES\",\"tiktok\":\"SALES\",\"google_ads\":\"SALES\"}"), SupportedPlatforms = new[]{"facebook","tiktok","google_ads"}, SortOrder = 12 },
        new() { Category = "consideration", Name = "Website Traffic", Description = "Drive website visits via search/display", Icon = "🌐", PlatformMapping = JsonSerializer.Deserialize<JsonElement>("{\"google_ads\":\"SEARCH\"}"), SupportedPlatforms = new[]{"google_ads"}, SortOrder = 13 }
    };
    db.CampaignObjectives.AddRange(objectives);
    await db.SaveChangesAsync();

    return Results.Ok("Multi-tenant seed completed successfully");
});

// ══════════════════════════════════════════════════
// CAMPAIGN ENDPOINTS (Tenant-Scoped)
// ══════════════════════════════════════════════════

app.MapPost("/api/campaigns", async (AppDbContext db, HttpContext ctx, CreateCampaignRequest req) =>
{
    var companyId = ctx.GetRequiredCompanyId();
    var campaign = new Campaign
    {
        CompanyId = companyId, Name = req.Name, ObjectiveId = req.ObjectiveId, Brief = req.Brief,
        StylePreset = req.StylePreset, AspectRatio = req.AspectRatio, TotalBudget = req.TotalBudget,
        DailyBudget = req.DailyBudget, BidStrategy = req.BidStrategy, Platforms = req.Platforms ?? Array.Empty<string>(),
        Status = "draft", CreatedBy = ctx.GetUserId(), CreatedAt = DateTime.UtcNow
    };
    db.Campaigns.Add(campaign);
    await db.SaveChangesAsync();

    // Create workflow steps
    var steps = new[] { "objective", "targeting", "strategy", "adset_config", "creative", "review", "deploy" };
    for (int i = 0; i < steps.Length; i++)
        db.CampaignWorkflowSteps.Add(new CampaignWorkflowStep { CampaignId = campaign.Id, StepName = steps[i], StepOrder = i + 1 });
    await db.SaveChangesAsync();

    return Results.Created($"/api/campaigns/{campaign.Id}", new { campaign.Id, campaign.Name, campaign.Status });
});

app.MapGet("/api/campaigns", async (AppDbContext db, HttpContext ctx, string? status) =>
{
    var companyId = ctx.GetCompanyId();
    var query = db.Campaigns.AsQueryable();
    if (companyId.HasValue) query = query.Where(c => c.CompanyId == companyId);
    if (!string.IsNullOrEmpty(status)) query = query.Where(c => c.Status == status);
    var campaigns = await query.OrderByDescending(c => c.CreatedAt)
        .Select(c => new { c.Id, c.Name, c.Status, c.TotalBudget, c.DailyBudget, c.Platforms, c.EligiblePlatforms, c.CampaignType, c.Brief, c.StylePreset, c.AspectRatio, c.CreatedAt, c.StartDate, c.EndDate,
            Cost = db.AdMetrics
                .Where(m => m.CampaignId == c.Id && (m.Platform != "facebook" || (m.AdSetId != null && m.AdId != null)))
                .Sum(m => (decimal?)m.Spend) ?? 0,
            Objective = c.Objective != null ? new { c.Objective.Name, c.Objective.Category } : null,
            AdSetCount = c.AdSets.Count }).ToListAsync();
    return Results.Ok(campaigns);
});

app.MapGet("/api/campaigns/{id}", async (AppDbContext db, HttpContext ctx, int id) =>
{
    var campaign = await db.Campaigns
        .Include(c => c.Objective).Include(c => c.AdSets).ThenInclude(a => a.Ads).ThenInclude(a => a.Creatives)
        .Include(c => c.WorkflowSteps).Include(c => c.CreatedByUser).Include(c => c.ApprovedByUser)
        .FirstOrDefaultAsync(c => c.Id == id);
    if (campaign == null) return Results.NotFound();
    if (!ctx.IsSuperAdmin() && campaign.CompanyId != ctx.GetCompanyId()) return Results.Forbid();
    return Results.Ok(campaign);
});

app.MapPut("/api/campaigns/{id}", async (AppDbContext db, HttpContext ctx, int id, UpdateCampaignRequest req) =>
{
    var campaign = await db.Campaigns.FindAsync(id);
    if (campaign == null) return Results.NotFound();
    if (!ctx.IsSuperAdmin() && campaign.CompanyId != ctx.GetCompanyId()) return Results.Forbid();
    if (req.Name != null) campaign.Name = req.Name;
    if (req.ObjectiveId.HasValue) campaign.ObjectiveId = req.ObjectiveId;
    if (req.Brief != null) campaign.Brief = req.Brief;
    if (req.StylePreset != null) campaign.StylePreset = req.StylePreset;
    if (req.AspectRatio != null) campaign.AspectRatio = req.AspectRatio;
    if (req.TotalBudget.HasValue) campaign.TotalBudget = req.TotalBudget;
    if (req.DailyBudget.HasValue) campaign.DailyBudget = req.DailyBudget;
    if (req.BidStrategy != null) campaign.BidStrategy = req.BidStrategy;
    if (req.Status != null) campaign.Status = req.Status;
    if (req.Platforms != null) campaign.Platforms = req.Platforms;
    if (req.EligiblePlatforms != null) campaign.EligiblePlatforms = req.EligiblePlatforms;
    if (req.StartDate.HasValue) campaign.StartDate = req.StartDate;
    if (req.EndDate.HasValue) campaign.EndDate = req.EndDate;
    campaign.UpdatedAt = DateTime.UtcNow;
    await db.SaveChangesAsync();
    return Results.Ok(campaign);
});

app.MapDelete("/api/campaigns/{id}", async (AppDbContext db, HttpContext ctx, int id) =>
{
    var campaign = await db.Campaigns.FindAsync(id);
    if (campaign == null) return Results.NotFound();
    if (!ctx.IsSuperAdmin() && campaign.CompanyId != ctx.GetCompanyId()) return Results.Forbid();
    campaign.Status = "archived";
    campaign.UpdatedAt = DateTime.UtcNow;
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Campaign archived" });
});

app.MapPost("/api/campaigns/{id}/submit", async (AppDbContext db, HttpContext ctx, int id) =>
{
    var campaign = await db.Campaigns.FindAsync(id);
    if (campaign == null) return Results.NotFound();
    campaign.Status = "pending_review";
    campaign.UpdatedAt = DateTime.UtcNow;
    await db.SaveChangesAsync();
    // Create notification for CMO
    var cmoUsers = await db.Users.Include(u => u.Role).Where(u => u.CompanyId == campaign.CompanyId && u.Role!.Name == "CMO").ToListAsync();
    foreach (var cmo in cmoUsers)
        db.Notifications.Add(new Notification { CompanyId = campaign.CompanyId, UserId = cmo.Id, Type = "campaign_submitted", Title = "Campaign Submitted for Review", Message = $"Campaign '{campaign.Name}' needs your approval", ResourceType = "campaign", ResourceId = campaign.Id });
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Campaign submitted for review" });
});

app.MapPost("/api/campaigns/{id}/approve", async (AppDbContext db, HttpContext ctx, int id) =>
{
    var campaign = await db.Campaigns.FindAsync(id);
    if (campaign == null) return Results.NotFound();
    campaign.Status = "approved";
    campaign.ApprovedBy = ctx.GetUserId();
    campaign.ApprovedAt = DateTime.UtcNow;
    campaign.UpdatedAt = DateTime.UtcNow;
    await db.SaveChangesAsync();

    // Add campaign's ads to PPP queue so PPP specialist can post them
    var adSets = await db.AdSets.Where(a => a.CampaignId == id).ToListAsync();
    var adSetIds = adSets.Select(a => a.Id).ToList();
    var ads = await db.Ads.Where(a => adSetIds.Contains(a.AdSetId)).ToListAsync();
    var approvedById = ctx.GetUserId();
    var queueIdx = await db.PppQueue.Where(q => q.CompanyId == campaign.CompanyId).CountAsync();
    foreach (var ad in ads)
    {
        var creative = await db.AdCreatives.FirstOrDefaultAsync(c => c.AdId == ad.Id);
        var alreadyQueued = await db.PppQueue.AnyAsync(q => q.CompanyId == campaign.CompanyId && q.AdId == ad.Id);
        if (!alreadyQueued)
        {
            db.PppQueue.Add(new PppQueueItem
            {
                CompanyId = campaign.CompanyId,
                CampaignId = campaign.Id,
                AdId = ad.Id,
                AssetFilename = creative?.AssetFilename ?? creative?.AssetUrl ?? $"ad_{ad.Id}",
                AssetUrl = creative?.AssetUrl ?? "",
                AssetType = creative?.CreativeType == "video" ? "video" : "image",
                Title = ad.Name ?? campaign.Name,
                Status = "received",
                QueueIndex = queueIdx++,
                ApprovedBy = approvedById,
                ApprovedAt = DateTime.UtcNow
            });
        }
    }

    // Notify Expert and PPP
    var users = await db.Users.Include(u => u.Role).Where(u => u.CompanyId == campaign.CompanyId && (u.Role!.Name == "Expert" || u.Role!.Name == "PPP")).ToListAsync();
    foreach (var u in users)
        db.Notifications.Add(new Notification { CompanyId = campaign.CompanyId, UserId = u.Id, Type = "campaign_approved", Title = "Campaign Approved", Message = $"Campaign '{campaign.Name}' has been approved and is ready for posting", ResourceType = "campaign", ResourceId = campaign.Id });
    await db.SaveChangesAsync();

    // Task 3.5: trigger deployment orchestration — if all ads already have budgets (re-approval flow),
    // write deployment logs and activate the campaign immediately
    var pppItems = await db.PppQueue.Where(q => q.CampaignId == id && q.CompanyId == campaign.CompanyId).ToListAsync();
    var budgetedIds = await db.PppAdBudgets.Where(b => b.CompanyId == campaign.CompanyId).Select(b => b.PppQueueItemId).ToListAsync();
    var allBudgeted = pppItems.Count > 0 && pppItems.All(p => budgetedIds.Contains(p.Id));
    if (allBudgeted)
    {
        foreach (var pppItem in pppItems)
        {
            pppItem.Status = "deployed";
            pppItem.DeployedAt = DateTime.UtcNow;
            db.DeploymentLogs.Add(new DeploymentLog
            {
                CompanyId = campaign.CompanyId,
                CampaignId = campaign.Id,
                Platform = (pppItem.Platform ?? "unknown").ToLower().Replace(" ", "_"),
                Action = "deploy",
                Status = "success",
                ExecutedBy = ctx.GetUserId(),
                ExecutedAt = DateTime.UtcNow,
                DurationMs = Random.Shared.Next(800, 3000),
                PlatformResourceId = $"mock_{pppItem.Platform ?? "unknown"}_{pppItem.Id}_{Guid.NewGuid().ToString()[..8]}"
            });
        }
        campaign.Status = "active";
        campaign.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
    }

    return Results.Ok(new { message = "Campaign approved and sent to posting process", deployedImmediately = allBudgeted });
});

app.MapPost("/api/campaigns/{id}/reject", async (AppDbContext db, HttpContext ctx, int id, CampaignRejectRequest req) =>
{
    var campaign = await db.Campaigns.FindAsync(id);
    if (campaign == null) return Results.NotFound();
    campaign.Status = "rejected";
    campaign.RejectionReason = req.Reason;
    campaign.UpdatedAt = DateTime.UtcNow;
    await db.SaveChangesAsync();
    if (campaign.CreatedBy.HasValue)
        db.Notifications.Add(new Notification { CompanyId = campaign.CompanyId, UserId = campaign.CreatedBy.Value, Type = "campaign_rejected", Title = "Campaign Rejected", Message = $"Campaign '{campaign.Name}' was rejected: {req.Reason}", ResourceType = "campaign", ResourceId = campaign.Id });
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Campaign rejected" });
});

app.MapPost("/api/campaigns/{id}/pause", async (AppDbContext db, int id) =>
{
    var c = await db.Campaigns.FindAsync(id);
    if (c == null) return Results.NotFound();
    c.Status = "paused"; c.UpdatedAt = DateTime.UtcNow;
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Campaign paused" });
});

app.MapPost("/api/campaigns/{id}/resume", async (AppDbContext db, int id) =>
{
    var c = await db.Campaigns.FindAsync(id);
    if (c == null) return Results.NotFound();
    c.Status = "active"; c.UpdatedAt = DateTime.UtcNow;
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Campaign resumed" });
});

app.MapGet("/api/campaigns/{id}/workflow", async (AppDbContext db, int id) =>
{
    var steps = await db.CampaignWorkflowSteps.Where(w => w.CampaignId == id).OrderBy(w => w.StepOrder).ToListAsync();
    return Results.Ok(steps);
});

app.MapPut("/api/campaigns/{id}/workflow/{stepName}", async (AppDbContext db, HttpContext ctx, int id, string stepName) =>
{
    var step = await db.CampaignWorkflowSteps.FirstOrDefaultAsync(w => w.CampaignId == id && w.StepName == stepName);
    if (step == null) return Results.NotFound();
    step.Status = "completed"; step.CompletedBy = ctx.GetUserId(); step.CompletedAt = DateTime.UtcNow;
    await db.SaveChangesAsync();
    return Results.Ok(step);
});

// ══════════════════════════════════════════════════
// PLATFORM SPEC ENDPOINTS (Stage 1 — Expert config)
// ══════════════════════════════════════════════════

app.MapGet("/api/campaigns/{id}/platform-specs", async (AppDbContext db, HttpContext ctx, int id) =>
{
    var campaign = await db.Campaigns.FindAsync(id);
    if (campaign == null) return Results.NotFound();
    if (!ctx.IsSuperAdmin() && campaign.CompanyId != ctx.GetCompanyId()) return Results.Forbid();
    var specs = await db.CampaignPlatformSpecs.Where(s => s.CampaignId == id).ToListAsync();
    return Results.Ok(specs);
});

app.MapPost("/api/campaigns/{id}/platform-specs", async (AppDbContext db, HttpContext ctx, int id, SavePlatformSpecRequest req) =>
{
    var companyId = ctx.GetRequiredCompanyId();
    var campaign = await db.Campaigns.FindAsync(id);
    if (campaign == null) return Results.NotFound();
    if (!ctx.IsSuperAdmin() && campaign.CompanyId != companyId) return Results.Forbid();

    var existing = await db.CampaignPlatformSpecs.FirstOrDefaultAsync(s => s.CampaignId == id && s.Platform == req.Platform);
    if (existing != null)
    {
        existing.AspectRatios = req.AspectRatios;
        existing.ImageCount = req.ImageCount;
        existing.VideoCount = req.VideoCount;
        existing.VideoDurations = req.VideoDurations;
        existing.PrimaryTextTemplate = req.PrimaryTextTemplate;
        existing.UpdatedAt = DateTime.UtcNow;
    }
    else
    {
        db.CampaignPlatformSpecs.Add(new CampaignPlatformSpec
        {
            CampaignId = id,
            CompanyId = companyId,
            Platform = req.Platform,
            AspectRatios = req.AspectRatios,
            ImageCount = req.ImageCount,
            VideoCount = req.VideoCount,
            VideoDurations = req.VideoDurations,
            PrimaryTextTemplate = req.PrimaryTextTemplate,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
    }
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Platform spec saved", platform = req.Platform });
});

app.MapDelete("/api/campaigns/{id}/platform-specs/{platform}", async (AppDbContext db, HttpContext ctx, int id, string platform) =>
{
    var companyId = ctx.GetRequiredCompanyId();
    var spec = await db.CampaignPlatformSpecs.FirstOrDefaultAsync(s => s.CampaignId == id && s.Platform == platform);
    if (spec == null) return Results.NotFound();
    if (!ctx.IsSuperAdmin() && spec.CompanyId != companyId) return Results.Forbid();
    db.CampaignPlatformSpecs.Remove(spec);
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Platform spec deleted" });
});

app.MapPost("/api/campaigns/{id}/generate-assets", async (AppDbContext db, HttpContext ctx, int id, GenerateAssetsRequest? req, IConfiguration config) =>
{
    var companyId = ctx.GetRequiredCompanyId();
    var campaign = await db.Campaigns.FindAsync(id);
    if (campaign == null) return Results.NotFound();
    if (!ctx.IsSuperAdmin() && campaign.CompanyId != companyId) return Results.Forbid();

    var specs = await db.CampaignPlatformSpecs.Where(s => s.CampaignId == id).ToListAsync();
    if (specs.Count == 0) return Results.BadRequest(new { error = "No platform specs configured for this campaign." });

    // Get or create a default AdSet for generated assets
    var adSet = await db.AdSets.FirstOrDefaultAsync(a => a.CampaignId == id && a.Name == "Auto-Generated Assets");
    if (adSet == null)
    {
        adSet = new AdSet
        {
            CompanyId = companyId,
            CampaignId = id,
            Name = "Auto-Generated Assets",
            Status = "active",
            CreatedBy = ctx.GetUserId()
        };
        db.AdSets.Add(adSet);
        await db.SaveChangesAsync();
    }

    var geminiApiKey = config["Gemini:ApiKey"] ?? "";
    var imagenClient = new HttpClient { Timeout = TimeSpan.FromSeconds(90) };

    // Maps our aspect ratios to Imagen 3 supported values
    static string MapToImagenAspectRatio(string ratio) => ratio switch
    {
        "9:16" => "9:16",
        "16:9" => "16:9",
        "3:4"  => "3:4",
        "4:3"  => "4:3",
        "4:5"  => "4:3",
        _      => "1:1"
    };

    async Task<string> GenerateImageAsync(string platform, string brief, string style, string aspectRatio)
    {
        if (string.IsNullOrEmpty(geminiApiKey) || geminiApiKey == "YOUR_GEMINI_API_KEY_HERE")
            return "";
        try
        {
            // Step 1: Use Gemini to build a rich creative prompt
            var platformContext = platform switch
            {
                "facebook" => "Facebook feed or story ad",
                "tiktok"   => "TikTok vertical short-form ad",
                "youtube"  => "YouTube video thumbnail or banner ad",
                "google"   => "Google Display Network ad",
                _          => "social media advertisement"
            };
            var promptUrl = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={geminiApiKey}";
            var promptBody = new
            {
                contents = new[] { new { parts = new[] { new { text =
                    $"Create a vivid, detailed image generation prompt for a {platformContext}. " +
                    $"Campaign brief: \"{brief}\". Visual style: {style}. " +
                    $"Make it photorealistic, professional, and visually striking. " +
                    $"Output only the image prompt, no explanation, max 150 words." } } } }
            };
            var promptRes = await imagenClient.PostAsJsonAsync(promptUrl, promptBody);
            string imagePrompt = $"Professional {style} marketing ad for {platform}: {brief}";
            if (promptRes.IsSuccessStatusCode)
            {
                var promptData = await promptRes.Content.ReadFromJsonAsync<JsonElement>();
                var generated = promptData.GetProperty("candidates")[0]
                    .GetProperty("content").GetProperty("parts")[0]
                    .GetProperty("text").GetString();
                if (!string.IsNullOrWhiteSpace(generated))
                    imagePrompt = generated.Trim();
            }

            // Step 2: Generate image with Imagen 3
            var imagenUrl = $"https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key={geminiApiKey}";
            var imagenBody = new
            {
                instances = new[] { new { prompt = imagePrompt } },
                parameters = new { sampleCount = 1, aspectRatio = MapToImagenAspectRatio(aspectRatio) }
            };
            var imagenRes = await imagenClient.PostAsJsonAsync(imagenUrl, imagenBody);
            if (!imagenRes.IsSuccessStatusCode) return "";

            var imagenData = await imagenRes.Content.ReadFromJsonAsync<JsonElement>();
            var predictions = imagenData.GetProperty("predictions");
            if (predictions.GetArrayLength() == 0) return "";
            var base64Image = predictions[0].GetProperty("bytesBase64Encoded").GetString();
            if (string.IsNullOrEmpty(base64Image)) return "";

            // Save generated image to Assets folder
            var bytes = Convert.FromBase64String(base64Image);
            var filename = $"gen_{platform}_{Guid.NewGuid():N}.png";
            var filePath = Path.Combine(AssetsFolder, filename);
            await File.WriteAllBytesAsync(filePath, bytes);
            return $"/assets/{filename}";
        }
        catch
        {
            return "";
        }
    }

    var createdCreatives = new List<object>();

    foreach (var spec in specs)
    {
        var primaryAspectRatio = spec.AspectRatios.Length > 0 ? spec.AspectRatios[0] : "1:1";
        var brief = spec.PrimaryTextTemplate ?? req?.Brief ?? campaign.Brief ?? "";
        var style = campaign.StylePreset ?? "modern professional";

        // Create Ad entries for images — AI-generate each one
        for (int i = 0; i < spec.ImageCount; i++)
        {
            var assetUrl = await GenerateImageAsync(spec.Platform, brief, style, primaryAspectRatio);
            var ad = new Ad
            {
                CompanyId = companyId,
                AdSetId = adSet.Id,
                Name = $"{spec.Platform} Image {i + 1}",
                Status = "draft",
                CreatedBy = ctx.GetUserId()
            };
            db.Ads.Add(ad);
            await db.SaveChangesAsync();

            var creative = new AdCreative
            {
                CompanyId = companyId,
                AdId = ad.Id,
                CreativeType = "image",
                AssetUrl = assetUrl,
                TargetPlatform = spec.Platform,
                PrimaryText = brief,
                CreatedAt = DateTime.UtcNow
            };
            db.AdCreatives.Add(creative);
            createdCreatives.Add(new { creative.Id, Platform = spec.Platform, Type = "image", Ratio = primaryAspectRatio, AssetUrl = assetUrl, AdId = ad.Id });
        }

        // Video slots remain as placeholders (no video generation API available)
        for (int i = 0; i < spec.VideoCount; i++)
        {
            var duration = spec.VideoDurations.Length > i ? spec.VideoDurations[i] : (spec.VideoDurations.Length > 0 ? spec.VideoDurations[0] : "30s");
            var ad = new Ad
            {
                CompanyId = companyId,
                AdSetId = adSet.Id,
                Name = $"{spec.Platform} Video {i + 1} ({duration})",
                Status = "draft",
                CreatedBy = ctx.GetUserId()
            };
            db.Ads.Add(ad);
            await db.SaveChangesAsync();

            var durationSeconds = int.TryParse(duration.Replace("s", ""), out var ds) ? ds : 30;
            var creative = new AdCreative
            {
                CompanyId = companyId,
                AdId = ad.Id,
                CreativeType = "video",
                AssetUrl = "",
                TargetPlatform = spec.Platform,
                DurationSeconds = durationSeconds,
                PrimaryText = brief,
                CreatedAt = DateTime.UtcNow
            };
            db.AdCreatives.Add(creative);
            createdCreatives.Add(new { creative.Id, Platform = spec.Platform, Type = "video", Ratio = primaryAspectRatio, Duration = duration, AdId = ad.Id });
        }
    }

    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Assets generated", count = createdCreatives.Count, assets = createdCreatives });
});

// ══════════════════════════════════════════════════
// AD SET ENDPOINTS
// ══════════════════════════════════════════════════

app.MapPost("/api/campaigns/{campaignId}/adsets", async (AppDbContext db, HttpContext ctx, int campaignId, CreateAdSetRequest req) =>
{
    var companyId = ctx.GetRequiredCompanyId();
    var adSet = new AdSet { CompanyId = companyId, CampaignId = campaignId, Name = req.Name, DailyBudget = req.DailyBudget, LifetimeBudget = req.LifetimeBudget, BidStrategy = req.BidStrategy, BidAmount = req.BidAmount, OptimizationGoal = req.OptimizationGoal, StartTime = req.StartTime, EndTime = req.EndTime, CreatedBy = ctx.GetUserId() };
    db.AdSets.Add(adSet);
    await db.SaveChangesAsync();
    return Results.Created($"/api/campaigns/{campaignId}/adsets/{adSet.Id}", adSet);
});

app.MapGet("/api/campaigns/{campaignId}/adsets", async (AppDbContext db, int campaignId) =>
    Results.Ok(await db.AdSets.Where(a => a.CampaignId == campaignId).Include(a => a.Ads).ToListAsync()));

app.MapGet("/api/campaigns/{campaignId}/adsets/{id}", async (AppDbContext db, int campaignId, int id) =>
{
    var adSet = await db.AdSets.Include(a => a.Ads).ThenInclude(a => a.Creatives).FirstOrDefaultAsync(a => a.Id == id && a.CampaignId == campaignId);
    return adSet == null ? Results.NotFound() : Results.Ok(adSet);
});

app.MapPut("/api/campaigns/{campaignId}/adsets/{id}", async (AppDbContext db, int campaignId, int id, UpdateAdSetRequest req) =>
{
    var adSet = await db.AdSets.FirstOrDefaultAsync(a => a.Id == id && a.CampaignId == campaignId);
    if (adSet == null) return Results.NotFound();
    if (req.Name != null) adSet.Name = req.Name;
    if (req.DailyBudget.HasValue) adSet.DailyBudget = req.DailyBudget;
    if (req.LifetimeBudget.HasValue) adSet.LifetimeBudget = req.LifetimeBudget;
    if (req.BidStrategy != null) adSet.BidStrategy = req.BidStrategy;
    if (req.BidAmount.HasValue) adSet.BidAmount = req.BidAmount;
    if (req.OptimizationGoal != null) adSet.OptimizationGoal = req.OptimizationGoal;
    if (req.Status != null) adSet.Status = req.Status;
    adSet.UpdatedAt = DateTime.UtcNow;
    await db.SaveChangesAsync();
    return Results.Ok(adSet);
});

app.MapDelete("/api/campaigns/{campaignId}/adsets/{id}", async (AppDbContext db, int campaignId, int id) =>
{
    var adSet = await db.AdSets.FirstOrDefaultAsync(a => a.Id == id && a.CampaignId == campaignId);
    if (adSet == null) return Results.NotFound();
    db.AdSets.Remove(adSet);
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Ad set deleted" });
});

// ══════════════════════════════════════════════════
// AD ENDPOINTS
// ══════════════════════════════════════════════════

app.MapPost("/api/adsets/{adSetId}/ads", async (AppDbContext db, HttpContext ctx, int adSetId, CreateAdRequest req) =>
{
    var companyId = ctx.GetRequiredCompanyId();
    var ad = new Ad { CompanyId = companyId, AdSetId = adSetId, Name = req.Name, Headline = req.Headline, Description = req.Description, CtaType = req.CtaType, CtaLink = req.CtaLink, CreatedBy = ctx.GetUserId() };
    db.Ads.Add(ad);
    await db.SaveChangesAsync();
    return Results.Created($"/api/adsets/{adSetId}/ads/{ad.Id}", ad);
});

app.MapGet("/api/adsets/{adSetId}/ads", async (AppDbContext db, int adSetId) =>
    Results.Ok(await db.Ads.Where(a => a.AdSetId == adSetId).Include(a => a.Creatives).ToListAsync()));

app.MapGet("/api/adsets/{adSetId}/ads/{id}", async (AppDbContext db, int adSetId, int id) =>
{
    var ad = await db.Ads.Include(a => a.Creatives).FirstOrDefaultAsync(a => a.Id == id && a.AdSetId == adSetId);
    return ad == null ? Results.NotFound() : Results.Ok(ad);
});

app.MapPut("/api/adsets/{adSetId}/ads/{id}", async (AppDbContext db, int adSetId, int id, UpdateAdRequest req) =>
{
    var ad = await db.Ads.FirstOrDefaultAsync(a => a.Id == id && a.AdSetId == adSetId);
    if (ad == null) return Results.NotFound();
    if (req.Name != null) ad.Name = req.Name;
    if (req.Headline != null) ad.Headline = req.Headline;
    if (req.Description != null) ad.Description = req.Description;
    if (req.CtaType != null) ad.CtaType = req.CtaType;
    if (req.CtaLink != null) ad.CtaLink = req.CtaLink;
    if (req.Status != null) ad.Status = req.Status;
    ad.UpdatedAt = DateTime.UtcNow;
    await db.SaveChangesAsync();
    return Results.Ok(ad);
});

app.MapDelete("/api/adsets/{adSetId}/ads/{id}", async (AppDbContext db, int adSetId, int id) =>
{
    var ad = await db.Ads.FirstOrDefaultAsync(a => a.Id == id && a.AdSetId == adSetId);
    if (ad == null) return Results.NotFound();
    db.Ads.Remove(ad);
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Ad deleted" });
});

app.MapPost("/api/adsets/{adSetId}/ads/{id}/review", async (AppDbContext db, HttpContext ctx, int adSetId, int id, AdReviewRequest req) =>
{
    var ad = await db.Ads.FirstOrDefaultAsync(a => a.Id == id && a.AdSetId == adSetId);
    if (ad == null) return Results.NotFound();
    ad.ReviewStatus = req.Action == "approve" ? "approved" : "rejected";
    ad.ReviewedBy = ctx.GetUserId();
    ad.ReviewedAt = DateTime.UtcNow;
    ad.ReviewNotes = req.Notes;
    ad.UpdatedAt = DateTime.UtcNow;
    await db.SaveChangesAsync();
    return Results.Ok(ad);
});

// ══════════════════════════════════════════════════
// BRAND GUIDELINES (Tenant-Scoped)
// ══════════════════════════════════════════════════

app.MapGet("/api/guidelines", async (AppDbContext db, HttpContext ctx) =>
{
    var companyId = ctx.GetCompanyId();
    var query = db.BrandGuidelines.AsQueryable();
    if (companyId.HasValue) query = query.Where(g => g.CompanyId == companyId);
    var guideline = await query.OrderByDescending(g => g.UpdatedAt).FirstOrDefaultAsync();
    return guideline == null ? Results.NotFound() : Results.Ok(guideline);
});

app.MapPost("/api/guidelines", async (AppDbContext db, HttpContext ctx, HttpRequest request) =>
{
    using var reader = new StreamReader(request.Body);
    var json = await reader.ReadToEndAsync();
    var newGuideline = JsonSerializer.Deserialize<BrandGuideline>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
    if (newGuideline == null) return Results.BadRequest("Invalid data");
    newGuideline.CompanyId = ctx.GetRequiredCompanyId();
    newGuideline.CreatedBy = ctx.GetUserId();
    newGuideline.UpdatedAt = DateTime.UtcNow;
    db.BrandGuidelines.Add(newGuideline);
    await db.SaveChangesAsync();
    return Results.Ok(newGuideline);
});

// ══════════════════════════════════════════════════
// CAMPAIGN OBJECTIVES
// ══════════════════════════════════════════════════

app.MapGet("/api/campaign-objectives", async (AppDbContext db) =>
    Results.Ok(await db.CampaignObjectives.Where(o => o.IsActive).OrderBy(o => o.SortOrder).ToListAsync()));

// ══════════════════════════════════════════════════
// QUEUES (Tenant-Scoped)
// ══════════════════════════════════════════════════

app.MapGet("/api/cmo/queue", async (AppDbContext db, HttpContext ctx) =>
{
    var companyId = ctx.GetCompanyId();
    var query = db.CmoQueue.AsQueryable();
    if (companyId.HasValue) query = query.Where(q => q.CompanyId == companyId);
    return Results.Ok(await query.OrderByDescending(q => q.AddedAt).ToListAsync());
});

app.MapPost("/api/cmo/queue", async (AppDbContext db, HttpContext ctx, HttpRequest request) =>
{
    var companyId = ctx.GetRequiredCompanyId();
    using var reader = new StreamReader(request.Body);
    var json = await reader.ReadToEndAsync();
    var items = JsonSerializer.Deserialize<List<CmoQueueItem>>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
    if (items == null) return Results.BadRequest("Invalid data");
    var currentQueue = await db.CmoQueue.Where(q => q.CompanyId == companyId).ToListAsync();
    db.CmoQueue.RemoveRange(currentQueue);
    foreach (var item in items) { item.CompanyId = companyId; }
    db.CmoQueue.AddRange(items);
    await db.SaveChangesAsync();
    return Results.Ok();
});

app.MapGet("/api/ppp/queue", async (AppDbContext db, HttpContext ctx) =>
{
    var companyId = ctx.GetCompanyId();
    var query = db.PppQueue.AsQueryable();
    if (companyId.HasValue) query = query.Where(q => q.CompanyId == companyId);
    var items = await query.OrderBy(q => q.QueueIndex).ToListAsync();
    // Load budgets for all items
    var itemIds = items.Select(i => i.Id).ToList();
    var budgets = await db.PppAdBudgets
        .Where(b => itemIds.Contains(b.PppQueueItemId))
        .ToDictionaryAsync(b => b.PppQueueItemId);
    return Results.Ok(items.Select(i => {
        budgets.TryGetValue(i.Id, out var budget);
        return new {
            id = i.AssetFilename,
            numericId = i.Id,
            url = i.AssetUrl,
            type = i.AssetType,
            title = i.Title ?? i.AssetFilename,
            platform = i.Platform,
            status = i.Status,
            addedAt = i.AddedAt,
            budget = budget == null ? null : new {
                dailyBudget = budget.DailyBudget,
                lifetimeBudget = budget.LifetimeBudget,
                costPerResult = budget.CostPerResult,
                targetCpa = budget.TargetCpa,
                bidAmount = budget.BidAmount,
                bidStrategy = budget.BidStrategy
            }
        };
    }));
});

app.MapPost("/api/ppp/queue", async (AppDbContext db, HttpContext ctx, HttpRequest request) =>
{
    var companyId = ctx.GetRequiredCompanyId();
    using var reader = new StreamReader(request.Body);
    var json = await reader.ReadToEndAsync();
    // Accept frontend format: [{ id, url, type, title }]
    List<JsonElement>? rawItems;
    try { rawItems = JsonSerializer.Deserialize<List<JsonElement>>(json); }
    catch { return Results.BadRequest("Invalid JSON"); }
    if (rawItems == null) return Results.BadRequest("Invalid data");

    static string? GetStr(JsonElement el, string key) =>
        el.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

    // Upsert items — preserve existing status/budget data
    var existingItems = await db.PppQueue.Where(q => q.CompanyId == companyId).ToListAsync();
    var existingByFilename = existingItems.ToDictionary(e => e.AssetFilename, e => e);

    int queueIdx = 0;
    foreach (var el in rawItems)
    {
        var filename = GetStr(el, "id") ?? GetStr(el, "assetFilename") ?? "";
        if (string.IsNullOrEmpty(filename)) continue;
        var url     = GetStr(el, "url") ?? GetStr(el, "assetUrl") ?? "";
        var type    = GetStr(el, "type") ?? GetStr(el, "assetType") ?? "image";
        var title   = GetStr(el, "title");
        var platform = GetStr(el, "platform");

        if (existingByFilename.TryGetValue(filename, out var existing2))
        {
            // Update non-lifecycle fields only
            existing2.AssetUrl   = url;
            existing2.AssetType  = type;
            existing2.Title      = title ?? existing2.Title;
            existing2.Platform   = platform ?? existing2.Platform;
            existing2.QueueIndex = queueIdx;
        }
        else
        {
            db.PppQueue.Add(new PppQueueItem
            {
                CompanyId    = companyId,
                AssetFilename = filename,
                AssetUrl     = url,
                AssetType    = type,
                Title        = title,
                Platform     = platform,
                Status       = "pending",
                QueueIndex   = queueIdx
            });
        }
        queueIdx++;
    }
    await db.SaveChangesAsync();
    return Results.Ok();
});

// Legacy alias
app.MapGet("/api/ppc/queue", async (AppDbContext db, HttpContext ctx) =>
{
    var companyId = ctx.GetCompanyId();
    var query = db.PppQueue.AsQueryable();
    if (companyId.HasValue) query = query.Where(q => q.CompanyId == companyId);
    var items = await query.OrderBy(q => q.QueueIndex).ToListAsync();
    return Results.Ok(items.Select(i => new { id = i.AssetFilename, url = i.AssetUrl, type = i.AssetType, title = i.Title ?? i.AssetFilename }));
});

app.MapPost("/api/ppc/queue", async (AppDbContext db, HttpContext ctx, HttpRequest request) =>
{
    var companyId = ctx.GetRequiredCompanyId();
    using var reader = new StreamReader(request.Body);
    var json = await reader.ReadToEndAsync();
    List<JsonElement>? rawItems;
    try { rawItems = JsonSerializer.Deserialize<List<JsonElement>>(json); }
    catch { return Results.BadRequest("Invalid JSON"); }
    if (rawItems == null) return Results.BadRequest("Invalid data");

    static string? GetStr2(JsonElement el, string key) =>
        el.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

    // Upsert items — preserve existing status/budget data
    var existingItems2 = await db.PppQueue.Where(q => q.CompanyId == companyId).ToListAsync();
    var existingByFilename2 = existingItems2.ToDictionary(e => e.AssetFilename, e => e);

    int queueIdx2 = 0;
    foreach (var el in rawItems)
    {
        var filename2 = GetStr2(el, "id") ?? GetStr2(el, "assetFilename") ?? "";
        if (string.IsNullOrEmpty(filename2)) continue;
        var url2      = GetStr2(el, "url") ?? GetStr2(el, "assetUrl") ?? "";
        var type2     = GetStr2(el, "type") ?? GetStr2(el, "assetType") ?? "image";
        var title2    = GetStr2(el, "title");
        var platform2 = GetStr2(el, "platform");

        if (existingByFilename2.TryGetValue(filename2, out var exist2))
        {
            exist2.AssetUrl   = url2;
            exist2.AssetType  = type2;
            exist2.Title      = title2 ?? exist2.Title;
            exist2.Platform   = platform2 ?? exist2.Platform;
            exist2.QueueIndex = queueIdx2;
        }
        else
        {
            db.PppQueue.Add(new PppQueueItem
            {
                CompanyId     = companyId,
                AssetFilename = filename2,
                AssetUrl      = url2,
                AssetType     = type2,
                Title         = title2,
                Platform      = platform2,
                Status        = "pending",
                QueueIndex    = queueIdx2
            });
        }
        queueIdx2++;
    }
    await db.SaveChangesAsync();
    return Results.Ok();
});

// ══════════════════════════════════════════════════
// STAGE 2: PPP BUDGET ALLOCATION ENDPOINTS
// ══════════════════════════════════════════════════

// GET /api/ppp/budgets — list all budget allocations for company
app.MapGet("/api/ppp/budgets", async (AppDbContext db, HttpContext ctx) =>
{
    var companyId = ctx.GetCompanyId();
    var query = db.PppAdBudgets.AsQueryable();
    if (companyId.HasValue) query = query.Where(b => b.CompanyId == companyId);
    return Results.Ok(await query.ToListAsync());
}).RequireAuthorization();

// POST /api/ppp/budgets — upsert budget for a PPP queue item
app.MapPost("/api/ppp/budgets", async (AppDbContext db, HttpContext ctx, SavePppBudgetRequest req) =>
{
    var companyId = ctx.GetRequiredCompanyId();

    var queueItem = await db.PppQueue.FirstOrDefaultAsync(q => q.Id == req.PppQueueItemId && q.CompanyId == companyId);
    if (queueItem == null) return Results.NotFound(new { error = "Queue item not found" });

    var existing = await db.PppAdBudgets.FirstOrDefaultAsync(b => b.PppQueueItemId == req.PppQueueItemId && b.CompanyId == companyId);
    if (existing != null)
    {
        existing.DailyBudget    = req.DailyBudget;
        existing.LifetimeBudget = req.LifetimeBudget;
        existing.CostPerResult  = req.CostPerResult;
        existing.TargetCpa      = req.TargetCpa;
        existing.BidAmount      = req.BidAmount;
        existing.BidStrategy    = req.BidStrategy;
        existing.UpdatedAt      = DateTime.UtcNow;
    }
    else
    {
        db.PppAdBudgets.Add(new PppAdBudget
        {
            CompanyId       = companyId,
            PppQueueItemId  = req.PppQueueItemId,
            Platform        = queueItem.Platform ?? "unknown",
            DailyBudget     = req.DailyBudget,
            LifetimeBudget  = req.LifetimeBudget,
            CostPerResult   = req.CostPerResult,
            TargetCpa       = req.TargetCpa,
            BidAmount       = req.BidAmount,
            BidStrategy     = req.BidStrategy
        });
    }

    // Advance lifecycle from received → budget_configured
    if (queueItem.Status == "received" || queueItem.Status == "pending") queueItem.Status = "budget_configured";
    await db.SaveChangesAsync();

    return Results.Ok(new { message = "Budget saved", status = queueItem.Status });
}).RequireAuthorization();

// PUT /api/ppp/budgets/{id} — update an existing budget allocation by ppp_queue_item_id (task 2.3)
app.MapPut("/api/ppp/budgets/{id:int}", async (AppDbContext db, HttpContext ctx, int id, SavePppBudgetRequest req) =>
{
    var companyId = ctx.GetRequiredCompanyId();

    var existing = await db.PppAdBudgets.FirstOrDefaultAsync(b => b.PppQueueItemId == id && b.CompanyId == companyId);
    if (existing == null) return Results.NotFound(new { error = "Budget allocation not found. Use POST /api/ppp/budgets to create one." });

    existing.DailyBudget    = req.DailyBudget;
    existing.LifetimeBudget = req.LifetimeBudget;
    existing.CostPerResult  = req.CostPerResult;
    existing.TargetCpa      = req.TargetCpa;
    existing.BidAmount      = req.BidAmount;
    existing.BidStrategy    = req.BidStrategy;
    existing.UpdatedAt      = DateTime.UtcNow;

    var queueItem = await db.PppQueue.FirstOrDefaultAsync(q => q.Id == id && q.CompanyId == companyId);
    if (queueItem != null && (queueItem.Status == "received" || queueItem.Status == "pending"))
        queueItem.Status = "budget_configured";

    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Budget updated", status = queueItem?.Status });
}).RequireAuthorization();

// POST /api/ppp/submit-for-approval — submit items to CMO queue
app.MapPost("/api/ppp/submit-for-approval", async (AppDbContext db, HttpContext ctx, SubmitForApprovalRequest req) =>
{
    var companyId = ctx.GetRequiredCompanyId();
    var userId = ctx.GetUserId();

    var queueItems = await db.PppQueue
        .Where(q => req.QueueItemIds.Contains(q.Id) && q.CompanyId == companyId)
        .ToListAsync();

    if (queueItems.Count == 0) return Results.BadRequest(new { error = "No matching queue items found" });

    var budgetMap = await db.PppAdBudgets
        .Where(b => req.QueueItemIds.Contains(b.PppQueueItemId) && b.CompanyId == companyId)
        .ToDictionaryAsync(b => b.PppQueueItemId);

    foreach (var item in queueItems)
    {
        item.Status = "ready_for_approval";

        // Add to CMO queue if not already there
        var cmoId = $"ppp_{item.Id}";
        var alreadyInCmo = await db.CmoQueue.AnyAsync(c => c.Id == cmoId && c.CompanyId == companyId);
        if (!alreadyInCmo)
        {
            budgetMap.TryGetValue(item.Id, out var bud);
            var budgetLabel = bud?.DailyBudget.HasValue == true
                ? $" [${bud.DailyBudget:0.00}/day]"
                : "";
            db.CmoQueue.Add(new CmoQueueItem
            {
                Id          = cmoId,
                CompanyId   = companyId,
                CampaignId  = item.CampaignId,
                AdId        = item.AdId,
                Url         = item.AssetUrl,
                Title       = $"[{item.Platform ?? "Multi"}] {item.Title ?? item.AssetFilename}{budgetLabel}",
                Type        = item.AssetType,
                Status      = "pending",
                SubmittedBy = userId
            });
        }
    }

    await db.SaveChangesAsync();

    // Notify CMO users
    var cmoUsers = await db.Users
        .Include(u => u.Role)
        .Where(u => u.CompanyId == companyId && u.Role!.Name == "CMO")
        .ToListAsync();
    foreach (var cmo in cmoUsers)
    {
        db.Notifications.Add(new Notification
        {
            UserId       = cmo.Id,
            CompanyId    = companyId,
            Type         = "approval_requested",
            Title        = "Campaign Ready for Review",
            Message      = $"PPP submitted {queueItems.Count} asset(s) with budget plans for your approval.",
            ResourceType = "campaign"
        });
    }
    await db.SaveChangesAsync();

    return Results.Ok(new { message = $"{queueItems.Count} items submitted for CMO approval.", count = queueItems.Count });
}).RequireAuthorization();

// ══════════════════════════════════════════════════
// STAGE 3: CMO APPROVE & DEPLOY ENDPOINTS
// ══════════════════════════════════════════════════

// GET /api/cmo/dashboard — consolidated CMO overview
app.MapGet("/api/cmo/dashboard", async (AppDbContext db, HttpContext ctx) =>
{
    var companyId = ctx.GetCompanyId();

    var cmoQueueQuery = db.CmoQueue.Where(q => q.Status == "pending");
    if (companyId.HasValue) cmoQueueQuery = cmoQueueQuery.Where(q => q.CompanyId == companyId);
    var cmoQueueItems = await cmoQueueQuery.OrderByDescending(q => q.AddedAt).Take(20).ToListAsync();

    var pppQuery = db.PppQueue.Where(q => q.Status == "ready_for_approval");
    if (companyId.HasValue) pppQuery = pppQuery.Where(q => q.CompanyId == companyId);
    var pppItems = await pppQuery.OrderByDescending(q => q.AddedAt).ToListAsync();
    var pppItemIds = pppItems.Select(i => i.Id).ToList();
    var budgets = await db.PppAdBudgets
        .Where(b => pppItemIds.Contains(b.PppQueueItemId))
        .ToDictionaryAsync(b => b.PppQueueItemId);

    // Campaigns with pending review
    var pendingQuery = db.Campaigns.Where(c => c.Status == "pending_review");
    if (companyId.HasValue) pendingQuery = pendingQuery.Where(c => c.CompanyId == companyId);
    var pendingCampaigns = await pendingQuery.Select(c => new { c.Id, c.Name, c.Status, c.Platforms, c.TotalBudget }).ToListAsync();

    // Budget summary per platform from ppp items
    var platformBudgets = pppItems
        .GroupBy(i => i.Platform ?? "unknown")
        .Select(g => {
            var platBudgets = g.Select(i => { budgets.TryGetValue(i.Id, out var b); return b; }).Where(b => b != null).ToList();
            return new {
                platform = g.Key,
                adCount = g.Count(),
                totalDailyBudget = platBudgets.Sum(b => b!.DailyBudget ?? 0),
                totalLifetimeBudget = platBudgets.Sum(b => b!.LifetimeBudget ?? 0)
            };
        }).ToList();

    var totalLifetime = platformBudgets.Sum(p => p.totalLifetimeBudget);
    var totalDaily = platformBudgets.Sum(p => p.totalDailyBudget);

    return Results.Ok(new {
        cmoQueue = cmoQueueItems.Select(q => new { q.Id, q.Title, q.Type, q.Status, q.CampaignId, q.AddedAt }),
        pppSubmissions = pppItems.Select(i => {
            budgets.TryGetValue(i.Id, out var bud);
            return new {
                id = i.AssetFilename,
                numericId = i.Id,
                title = i.Title ?? i.AssetFilename,
                platform = i.Platform,
                status = i.Status,
                budget = bud == null ? null : new {
                    dailyBudget = bud.DailyBudget,
                    lifetimeBudget = bud.LifetimeBudget,
                    bidStrategy = bud.BidStrategy
                }
            };
        }),
        pendingCampaigns,
        platformBudgets,
        totals = new {
            cmoQueueCount = cmoQueueItems.Count,
            pppSubmissionsCount = pppItems.Count,
            pendingCampaignsCount = pendingCampaigns.Count,
            totalDailyBudget = totalDaily,
            totalLifetimeBudget = totalLifetime
        }
    });
}).RequireAuthorization();

// GET /api/cmo/budget-matrix — budget distribution + performance projections per platform
app.MapGet("/api/cmo/budget-matrix", async (AppDbContext db, HttpContext ctx) =>
{
    var companyId = ctx.GetCompanyId();

    var pppQuery = db.PppQueue.Where(q => q.Status == "ready_for_approval" || q.Status == "deployed");
    if (companyId.HasValue) pppQuery = pppQuery.Where(q => q.CompanyId == companyId);
    var pppItems = await pppQuery.ToListAsync();
    var pppItemIds = pppItems.Select(i => i.Id).ToList();
    var budgets = await db.PppAdBudgets
        .Where(b => pppItemIds.Contains(b.PppQueueItemId))
        .ToDictionaryAsync(b => b.PppQueueItemId);

    var totalLifetime = budgets.Values.Sum(b => b.LifetimeBudget ?? 0);

    var platforms = pppItems
        .GroupBy(i => i.Platform ?? "unknown")
        .Select(g => {
            var platBudgets = g.Select(i => { budgets.TryGetValue(i.Id, out var b); return b; }).Where(b => b != null).ToList();
            var platLifetime = platBudgets.Sum(b => b!.LifetimeBudget ?? 0);
            var platDaily = platBudgets.Sum(b => b!.DailyBudget ?? 0);
            var sharePercent = totalLifetime > 0 ? Math.Round((double)(platLifetime / totalLifetime) * 100, 1) : 0;

            // Performance projections based on industry benchmarks per platform
            var (cpm, ctr, convRate) = (g.Key?.ToLower()) switch {
                "facebook"   => (7.0, 0.9, 2.5),
                "instagram"  => (8.0, 1.0, 2.0),
                "tiktok"     => (6.0, 1.5, 1.8),
                "youtube"    => (10.0, 0.5, 1.2),
                "google_ads" => (5.0, 2.0, 4.0),
                _            => (8.0, 0.8, 2.0)
            };

            var impressions = platLifetime > 0 ? (long)(((double)platLifetime / cpm) * 1000) : 0;
            var clicks = (long)(impressions * (ctr / 100));
            var sales = (long)(clicks * (convRate / 100));

            return new {
                platform = g.Key,
                adCount = g.Count(),
                totalDailyBudget = platDaily,
                totalLifetimeBudget = platLifetime,
                budgetSharePercent = sharePercent,
                projections = new {
                    estimatedImpressions = impressions,
                    estimatedClicks = clicks,
                    estimatedConversions = sales,
                    cpm,
                    ctr,
                    conversionRate = convRate
                }
            };
        }).ToList();

    return Results.Ok(new {
        platforms,
        totals = new {
            totalLifetimeBudget = totalLifetime,
            totalDailyBudget = budgets.Values.Sum(b => b.DailyBudget ?? 0),
            totalAds = pppItems.Count,
            totalImpressions = platforms.Sum(p => p.projections.estimatedImpressions),
            totalClicks = platforms.Sum(p => p.projections.estimatedClicks),
            totalConversions = platforms.Sum(p => p.projections.estimatedConversions)
        }
    });
}).RequireAuthorization();

// GET /api/cmo/ppp-submissions — all PPP items with ready_for_approval status
app.MapGet("/api/cmo/ppp-submissions", async (AppDbContext db, HttpContext ctx) =>
{
    var companyId = ctx.GetCompanyId();
    var query = db.PppQueue.Where(q => q.Status == "ready_for_approval");
    if (companyId.HasValue) query = query.Where(q => q.CompanyId == companyId);
    var items = await query.OrderByDescending(q => q.AddedAt).ToListAsync();
    var itemIds = items.Select(i => i.Id).ToList();
    var budgets = await db.PppAdBudgets
        .Where(b => itemIds.Contains(b.PppQueueItemId))
        .ToDictionaryAsync(b => b.PppQueueItemId);
    return Results.Ok(items.Select(i => {
        budgets.TryGetValue(i.Id, out var bud);
        return new {
            id = i.AssetFilename,
            numericId = i.Id,
            url = i.AssetUrl,
            type = i.AssetType,
            title = i.Title ?? i.AssetFilename,
            platform = i.Platform,
            status = i.Status,
            campaignId = i.CampaignId,
            addedAt = i.AddedAt,
            budget = bud == null ? null : new {
                dailyBudget = bud.DailyBudget,
                lifetimeBudget = bud.LifetimeBudget,
                costPerResult = bud.CostPerResult,
                targetCpa = bud.TargetCpa,
                bidAmount = bud.BidAmount,
                bidStrategy = bud.BidStrategy
            }
        };
    }));
}).RequireAuthorization();

// GET /api/cmo/campaign-package/{campaignId} — full campaign package for CMO review
app.MapGet("/api/cmo/campaign-package/{campaignId}", async (AppDbContext db, HttpContext ctx, int campaignId) =>
{
    var companyId = ctx.GetCompanyId();
    var campaign = await db.Campaigns.FindAsync(campaignId);
    if (campaign == null || (companyId.HasValue && campaign.CompanyId != companyId))
        return Results.NotFound(new { error = "Campaign not found" });

    var platformSpecs = await db.CampaignPlatformSpecs
        .Where(s => s.CampaignId == campaignId)
        .ToListAsync();

    var pppItems = await db.PppQueue
        .Where(q => q.CampaignId == campaignId && q.Status == "ready_for_approval")
        .OrderBy(q => q.QueueIndex)
        .ToListAsync();

    var pppItemIds = pppItems.Select(i => i.Id).ToList();
    var budgets = await db.PppAdBudgets
        .Where(b => pppItemIds.Contains(b.PppQueueItemId))
        .ToDictionaryAsync(b => b.PppQueueItemId);

    var budgetByPlatform = pppItems
        .GroupBy(i => i.Platform ?? "unknown")
        .Select(g => {
            var platBudgets = g.Select(i => { budgets.TryGetValue(i.Id, out var b); return b; }).Where(b => b != null).ToList();
            return new {
                platform = g.Key,
                assetCount = g.Count(),
                totalDailyBudget = platBudgets.Sum(b => b!.DailyBudget ?? 0),
                totalLifetimeBudget = platBudgets.Sum(b => b!.LifetimeBudget ?? 0)
            };
        }).ToList();

    var itemsWithBudgets = pppItems.Select(i => {
        budgets.TryGetValue(i.Id, out var bud);
        return new {
            id = i.AssetFilename,
            numericId = i.Id,
            url = i.AssetUrl,
            type = i.AssetType,
            title = i.Title ?? i.AssetFilename,
            platform = i.Platform,
            status = i.Status,
            budget = bud == null ? null : new {
                dailyBudget = bud.DailyBudget,
                lifetimeBudget = bud.LifetimeBudget,
                costPerResult = bud.CostPerResult,
                targetCpa = bud.TargetCpa,
                bidAmount = bud.BidAmount,
                bidStrategy = bud.BidStrategy
            }
        };
    }).ToList();

    return Results.Ok(new {
        campaign = new {
            campaign.Id,
            campaign.Name,
            campaign.Status,
            campaign.Platforms,
            campaign.TotalBudget,
            campaign.DailyBudget,
            campaign.Brief,
            campaign.CreatedAt
        },
        platformSpecs = platformSpecs.Select(s => new {
            s.Platform,
            s.AspectRatios,
            s.ImageCount,
            s.VideoCount,
            s.VideoDurations
        }),
        items = itemsWithBudgets,
        budgetByPlatform,
        totals = new {
            totalItems = pppItems.Count,
            totalDailyBudget = budgetByPlatform.Sum(b => b.totalDailyBudget),
            totalLifetimeBudget = budgetByPlatform.Sum(b => b.totalLifetimeBudget)
        }
    });
}).RequireAuthorization();

// POST /api/cmo/approve-and-deploy — approve PPP items and trigger deployment
app.MapPost("/api/cmo/approve-and-deploy", async (AppDbContext db, HttpContext ctx, CmoApproveDeployRequest req) =>
{
    var companyId = ctx.GetRequiredCompanyId();
    var userId = ctx.GetUserId();

    var queueItems = await db.PppQueue
        .Where(q => req.PppQueueItemIds.Contains(q.Id) && q.CompanyId == companyId)
        .ToListAsync();

    if (queueItems.Count == 0) return Results.BadRequest(new { error = "No matching queue items found" });

    var budgetMap = await db.PppAdBudgets
        .Where(b => req.PppQueueItemIds.Contains(b.PppQueueItemId) && b.CompanyId == companyId)
        .ToDictionaryAsync(b => b.PppQueueItemId);

    var deployResults = new List<object>();
    foreach (var item in queueItems)
    {
        item.Status = "deployed";
        item.DeployedBy = userId;
        item.DeployedAt = DateTime.UtcNow;

        var cmoId = $"ppp_{item.Id}";
        var cmoItem = await db.CmoQueue.FirstOrDefaultAsync(c => c.Id == cmoId && c.CompanyId == companyId);
        if (cmoItem != null)
        {
            cmoItem.Status = "approved";
            cmoItem.ReviewedBy = userId;
            cmoItem.ReviewedAt = DateTime.UtcNow;
        }

        budgetMap.TryGetValue(item.Id, out var bud);
        var platform = (item.Platform ?? "unknown").ToLower().Replace(" ", "_");
        if (item.CampaignId.HasValue)
        {
            db.DeploymentLogs.Add(new DeploymentLog
            {
                CompanyId = companyId,
                CampaignId = item.CampaignId.Value,
                Platform = platform,
                Action = "deploy",
                Status = "success",
                ExecutedBy = userId,
                ExecutedAt = DateTime.UtcNow,
                DurationMs = Random.Shared.Next(800, 3000),
                PlatformResourceId = $"mock_{platform}_{item.Id}_{Guid.NewGuid().ToString()[..8]}"
            });
        }

        deployResults.Add(new {
            itemId = item.Id,
            title = item.Title ?? item.AssetFilename,
            platform = item.Platform,
            status = "deployed",
            deployedAt = DateTime.UtcNow,
            mockResourceId = $"mock_{platform}_{item.Id}"
        });
    }

    var campaignIds = queueItems.Where(i => i.CampaignId.HasValue).Select(i => i.CampaignId!.Value).Distinct().ToList();
    foreach (var campaignId in campaignIds)
    {
        var camp = await db.Campaigns.FindAsync(campaignId);
        if (camp != null && camp.CompanyId == companyId)
        {
            camp.Status = "active";
            camp.UpdatedAt = DateTime.UtcNow;
        }
    }
    await db.SaveChangesAsync();

    // Record CMO approval audit log per campaign
    var platformsDeployed = queueItems.Select(i => i.Platform ?? "unknown").Distinct().ToArray();
    var totalBudgetApproved = budgetMap.Values.Sum(b => (b.LifetimeBudget ?? 0) + (b.DailyBudget ?? 0));
    foreach (var campaignId in campaignIds)
    {
        db.CmoApprovalLogs.Add(new CmoApprovalLog
        {
            CompanyId = companyId,
            CampaignId = campaignId,
            ApprovedBy = userId,
            ApprovedAt = DateTime.UtcNow,
            PlatformsDeployed = platformsDeployed,
            TotalBudgetApproved = totalBudgetApproved,
            ItemsDeployed = queueItems.Count
        });
    }

    var pppUsers = await db.Users.Include(u => u.Role)
        .Where(u => u.CompanyId == companyId && u.Role!.Name == "PPP")
        .ToListAsync();
    foreach (var ppp in pppUsers)
    {
        db.Notifications.Add(new Notification
        {
            UserId = ppp.Id,
            CompanyId = companyId,
            Type = "deploy_success",
            Title = "Ads Deployed by CMO",
            Message = $"CMO approved and deployed {queueItems.Count} ad(s) to live platforms.",
            ResourceType = "deployment"
        });
    }
    await db.SaveChangesAsync();

    return Results.Ok(new {
        message = $"{queueItems.Count} ads approved and deployed successfully.",
        deployed = deployResults,
        campaignsActivated = campaignIds
    });
}).RequireAuthorization();

// ══════════════════════════════════════════════════
// APPROVAL COMMENTS
// ══════════════════════════════════════════════════

app.MapPost("/api/campaigns/{id}/comments", async (AppDbContext db, HttpContext ctx, int id, CreateCommentRequest req) =>
{
    var companyId = ctx.GetRequiredCompanyId();
    db.ApprovalComments.Add(new ApprovalComment { CompanyId = companyId, CampaignId = id, AdId = req.AdId, UserId = ctx.GetUserId(), Comment = req.Comment, Action = req.Action });
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Comment added" });
});

app.MapGet("/api/campaigns/{id}/comments", async (AppDbContext db, int id) =>
    Results.Ok(await db.ApprovalComments.Where(c => c.CampaignId == id).OrderBy(c => c.CreatedAt).Include(c => c.User).ToListAsync()));

// ══════════════════════════════════════════════════
// NOTIFICATIONS
// ══════════════════════════════════════════════════

app.MapGet("/api/notifications", async (AppDbContext db, HttpContext ctx) =>
{
    var userId = ctx.GetUserId();
    return Results.Ok(await db.Notifications.Where(n => n.UserId == userId).OrderByDescending(n => n.CreatedAt).Take(50).ToListAsync());
});

app.MapPut("/api/notifications/{id}/read", async (AppDbContext db, int id) =>
{
    var n = await db.Notifications.FindAsync(id);
    if (n == null) return Results.NotFound();
    n.IsRead = true; n.ReadAt = DateTime.UtcNow;
    await db.SaveChangesAsync();
    return Results.Ok();
});

app.MapPost("/api/notifications/read-all", async (AppDbContext db, HttpContext ctx) =>
{
    var userId = ctx.GetUserId();
    var unread = await db.Notifications.Where(n => n.UserId == userId && !n.IsRead).ToListAsync();
    foreach (var n in unread) { n.IsRead = true; n.ReadAt = DateTime.UtcNow; }
    await db.SaveChangesAsync();
    return Results.Ok(new { marked = unread.Count });
});

// ══════════════════════════════════════════════════
// INVITATIONS
// ══════════════════════════════════════════════════

app.MapPost("/api/invitations", async (AppDbContext db, HttpContext ctx, CreateInvitationRequest req) =>
{
    var companyId = ctx.GetRequiredCompanyId();
    var invitation = new Invitation { CompanyId = companyId, Email = req.Email, RoleId = req.RoleId, InvitedBy = ctx.GetUserId(), Token = Guid.NewGuid().ToString("N"), ExpiresAt = DateTime.UtcNow.AddDays(7) };
    db.Invitations.Add(invitation);
    await db.SaveChangesAsync();
    return Results.Ok(new { invitation.Id, invitation.Token, invitation.ExpiresAt });
});

app.MapGet("/api/invitations", async (AppDbContext db, HttpContext ctx) =>
{
    var companyId = ctx.GetRequiredCompanyId();
    return Results.Ok(await db.Invitations.Where(i => i.CompanyId == companyId).OrderByDescending(i => i.CreatedAt).ToListAsync());
});

app.MapPost("/api/invitations/{token}/accept", async (AppDbContext db, IConfiguration config, string token, AcceptInvitationRequest req) =>
{
    var invitation = await db.Invitations.FirstOrDefaultAsync(i => i.Token == token && i.Status == "pending");
    if (invitation == null || invitation.ExpiresAt < DateTime.UtcNow) return Results.BadRequest(new { message = "Invalid or expired invitation" });
    var user = new User { Username = req.Username, Email = invitation.Email, PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password), RoleId = invitation.RoleId, CompanyId = invitation.CompanyId };
    db.Users.Add(user);
    invitation.Status = "accepted"; invitation.AcceptedAt = DateTime.UtcNow;
    await db.SaveChangesAsync();
    var role = await db.Roles.FindAsync(invitation.RoleId);
    var jwt = GenerateJwt(user, role?.Name ?? "User", config);
    return Results.Ok(new { token = jwt, user = new { user.Id, user.Username, Role = role?.Name, user.CompanyId } });
});

app.MapDelete("/api/invitations/{id}", async (AppDbContext db, int id) =>
{
    var inv = await db.Invitations.FindAsync(id);
    if (inv == null) return Results.NotFound();
    inv.Status = "revoked";
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Invitation revoked" });
});

// ══════════════════════════════════════════════════
// AD ACCOUNT MANAGEMENT (Tenant-Scoped)
// ══════════════════════════════════════════════════

app.MapGet("/api/ad-accounts", async (AppDbContext db, HttpContext ctx) =>
{
    var companyId = ctx.GetRequiredCompanyId();
    return Results.Ok(await db.CompanyAdAccounts.Where(a => a.CompanyId == companyId).Select(a => new { a.Id, a.Platform, a.AccountName, a.AccountId, a.Status, a.PageId, a.PixelId, a.LastTestedAt, a.LastError, a.CreatedAt }).ToListAsync());
});

app.MapPost("/api/ad-accounts", async (AppDbContext db, HttpContext ctx, CompanyAdAccount account) =>
{
    account.CompanyId = ctx.GetRequiredCompanyId();
    account.CreatedAt = DateTime.UtcNow;
    db.CompanyAdAccounts.Add(account);
    await db.SaveChangesAsync();
    return Results.Created($"/api/ad-accounts/{account.Id}", new { account.Id, account.Platform, account.AccountId });
});

app.MapPut("/api/ad-accounts/{id}", async (AppDbContext db, HttpContext ctx, int id, CompanyAdAccount updated) =>
{
    var account = await db.CompanyAdAccounts.FindAsync(id);
    if (account == null) return Results.NotFound();
    if (account.CompanyId != ctx.GetRequiredCompanyId()) return Results.Forbid();
    if (updated.AccessToken != null) account.AccessToken = updated.AccessToken;
    if (updated.RefreshToken != null) account.RefreshToken = updated.RefreshToken;
    if (updated.PageId != null) account.PageId = updated.PageId;
    if (updated.PixelId != null) account.PixelId = updated.PixelId;
    if (updated.AccountName != null) account.AccountName = updated.AccountName;
    account.UpdatedAt = DateTime.UtcNow;
    await db.SaveChangesAsync();
    return Results.Ok(account);
});

app.MapDelete("/api/ad-accounts/{id}", async (AppDbContext db, HttpContext ctx, int id) =>
{
    var account = await db.CompanyAdAccounts.FindAsync(id);
    if (account == null) return Results.NotFound();
    if (account.CompanyId != ctx.GetRequiredCompanyId()) return Results.Forbid();
    db.CompanyAdAccounts.Remove(account);
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Ad account removed" });
});

// ══════════════════════════════════════════════════
// ANALYTICS ENDPOINTS
// ══════════════════════════════════════════════════

app.MapGet("/api/analytics/overview", async (AppDbContext db, HttpContext ctx) =>
{
    var companyId = ctx.GetRequiredCompanyId();
    var metrics = db.AdMetricsSummary.Where(m => m.CompanyId == companyId && (m.Platform != "facebook" || (m.AdSetId != null && m.AdId != null)));
    var totalSpend = await metrics.SumAsync(m => (decimal?)m.Spend) ?? 0;
    var totalImpressions = await metrics.SumAsync(m => (long?)m.Impressions) ?? 0;
    var totalClicks = await metrics.SumAsync(m => (long?)m.Clicks) ?? 0;
    var totalConversions = await metrics.SumAsync(m => (int?)m.Conversions) ?? 0;
    var totalConversionValue = await metrics.SumAsync(m => (decimal?)m.ConversionValue) ?? 0;
    return Results.Ok(new
    {
        totalSpend,
        totalImpressions,
        totalClicks,
        totalConversions,
        avgCtr = totalImpressions > 0 ? Math.Round((decimal)totalClicks / totalImpressions, 6) : 0,
        avgCpc = totalClicks > 0 ? Math.Round(totalSpend / totalClicks, 4) : 0,
        avgRoas = totalSpend > 0 ? Math.Round(totalConversionValue / totalSpend, 4) : 0,
        activeCampaigns = await db.Campaigns.CountAsync(c => c.CompanyId == companyId && c.Status == "active")
    });
});

app.MapGet("/api/analytics/campaigns/{id}/metrics", async (AppDbContext db, HttpContext ctx, int id, string? platform, int days = 30) =>
{
    var since = DateTime.UtcNow.Date.AddDays(-days);
    var query = db.AdMetrics.Where(m => m.CampaignId == id && m.AdSetId != null && m.AdId != null && m.Date >= since);
    if (!string.IsNullOrEmpty(platform)) query = query.Where(m => m.Platform == platform);
    return Results.Ok(await query.OrderBy(m => m.Date).ToListAsync());
});

app.MapGet("/api/analytics/platforms", async (AppDbContext db, HttpContext ctx) =>
{
    var companyId = ctx.GetRequiredCompanyId();
    var data = await db.AdMetricsSummary.Where(m => m.CompanyId == companyId && (m.Platform != "facebook" || (m.AdSetId != null && m.AdId != null)))
        .GroupBy(m => m.Platform)
        .Select(g => new {
            Platform = g.Key,
            TotalSpend = g.Sum(m => m.Spend),
            TotalClicks = g.Sum(m => m.Clicks),
            TotalImpressions = g.Sum(m => m.Impressions),
            TotalConversions = g.Sum(m => m.Conversions),
            AvgCtr = g.Sum(m => m.Impressions) > 0 ? (decimal)g.Sum(m => m.Clicks) / g.Sum(m => m.Impressions) : 0,
            AvgCpc = g.Sum(m => m.Clicks) > 0 ? g.Sum(m => m.Spend) / g.Sum(m => m.Clicks) : 0,
            AvgRoas = g.Sum(m => m.Spend) > 0 ? g.Sum(m => m.ConversionValue) / g.Sum(m => m.Spend) : 0,
            CampaignCount = g.Select(m => m.CampaignId).Distinct().Count()
        })
        .ToListAsync();
    return Results.Ok(data);
});

app.MapGet("/api/analytics/top-performers", async (AppDbContext db, HttpContext ctx) =>
{
    var companyId = ctx.GetRequiredCompanyId();
    var data = await db.AdMetricsSummary.Where(m => m.CompanyId == companyId && m.AdSetId != null && m.AdId != null)
        .GroupBy(m => m.CampaignId)
        .Select(g => new {
            CampaignId = g.Key,
            TotalSpend = g.Sum(m => m.Spend),
            TotalConversions = g.Sum(m => m.Conversions),
            AvgRoas = g.Sum(m => m.Spend) > 0 ? g.Sum(m => m.ConversionValue) / g.Sum(m => m.Spend) : 0
        })
        .OrderByDescending(x => x.AvgRoas).Take(10).ToListAsync();
    return Results.Ok(data);
});

// ══════════════════════════════════════════════════
// A/B TESTS
// ══════════════════════════════════════════════════

app.MapPost("/api/ab-tests", async (AppDbContext db, HttpContext ctx, CreateAbTestRequest req) =>
{
    var companyId = ctx.GetRequiredCompanyId();
    var test = new AbTest { CompanyId = companyId, CampaignId = req.CampaignId, Name = req.Name, VariantAAdId = req.VariantAAdId, VariantBAdId = req.VariantBAdId, Metric = req.Metric, TrafficSplit = req.TrafficSplit, CreatedBy = ctx.GetUserId() };
    db.AbTests.Add(test);
    await db.SaveChangesAsync();
    return Results.Created($"/api/ab-tests/{test.Id}", test);
});

app.MapGet("/api/ab-tests", async (AppDbContext db, HttpContext ctx) =>
{
    var companyId = ctx.GetRequiredCompanyId();
    return Results.Ok(await db.AbTests.Where(t => t.CompanyId == companyId).OrderByDescending(t => t.CreatedAt).ToListAsync());
});

app.MapGet("/api/ab-tests/{id}/results", async (AppDbContext db, int id) =>
{
    var test = await db.AbTests.FindAsync(id);
    if (test == null) return Results.NotFound();
    var metricsA = await db.AdMetrics.Where(m => m.AdId == test.VariantAAdId).ToListAsync();
    var metricsB = await db.AdMetrics.Where(m => m.AdId == test.VariantBAdId).ToListAsync();
    return Results.Ok(new { test, variantAMetrics = new { clicks = metricsA.Sum(m => m.Clicks), impressions = metricsA.Sum(m => m.Impressions), spend = metricsA.Sum(m => m.Spend) }, variantBMetrics = new { clicks = metricsB.Sum(m => m.Clicks), impressions = metricsB.Sum(m => m.Impressions), spend = metricsB.Sum(m => m.Spend) } });
});

app.MapPost("/api/ab-tests/{id}/end", async (AppDbContext db, int id) =>
{
    var test = await db.AbTests.FindAsync(id);
    if (test == null) return Results.NotFound();
    test.Status = "completed"; test.EndedAt = DateTime.UtcNow;
    await db.SaveChangesAsync();
    return Results.Ok(test);
});

app.MapPost("/api/ab-tests/{id}/optimize", async (AppDbContext db, int id) =>
{
    var test = await db.AbTests.FindAsync(id);
    if (test == null) return Results.NotFound();
    
    // 1. Determine winner based on metrics if not already set
    // For now, if winner is null, we pick one randomly for simulation purposes
    if (string.IsNullOrEmpty(test.Winner)) {
        test.Winner = Random.Shared.Next(0, 2) == 0 ? "A" : "B";
    }

    // 2. Pause the loser
    var loserAdId = test.Winner == "A" ? test.VariantBAdId : test.VariantAAdId;
    var loserAd = await db.Ads.FindAsync(loserAdId);
    if (loserAd != null) {
        loserAd.Status = "paused";
    }

    // 3. Mark test as completed
    test.Status = "completed";
    test.EndedAt = DateTime.UtcNow;
    
    await db.SaveChangesAsync();
    return Results.Ok(new { test, message = $"Optimized: Variant {test.Winner} is now active. Variant {(test.Winner == "A" ? "B" : "A")} has been paused." });
});


// ══════════════════════════════════════════════════
// BUDGET ALLOCATIONS
// ══════════════════════════════════════════════════

app.MapPost("/api/budgets", async (AppDbContext db, HttpContext ctx, CreateBudgetRequest req) =>
{
    var companyId = ctx.GetRequiredCompanyId();
    var budget = new BudgetAllocation { CompanyId = companyId, PeriodType = req.PeriodType, PeriodStart = req.PeriodStart, PeriodEnd = req.PeriodEnd, TotalBudget = req.TotalBudget, FacebookAllocation = req.FacebookAllocation, TiktokAllocation = req.TiktokAllocation, YoutubeAllocation = req.YoutubeAllocation, GoogleAllocation = req.GoogleAllocation, CreatedBy = ctx.GetUserId() };
    db.BudgetAllocations.Add(budget);
    await db.SaveChangesAsync();
    return Results.Created($"/api/budgets/{budget.Id}", budget);
});

app.MapGet("/api/budgets", async (AppDbContext db, HttpContext ctx) =>
{
    var companyId = ctx.GetRequiredCompanyId();
    return Results.Ok(await db.BudgetAllocations.Where(b => b.CompanyId == companyId).OrderByDescending(b => b.PeriodStart).ToListAsync());
});

app.MapGet("/api/budgets/current", async (AppDbContext db, HttpContext ctx) =>
{
    var companyId = ctx.GetRequiredCompanyId();
    var today = DateOnly.FromDateTime(DateTime.UtcNow);
    var budget = await db.BudgetAllocations.FirstOrDefaultAsync(b => b.CompanyId == companyId && b.PeriodStart <= today && b.PeriodEnd >= today && b.Status == "active");
    return budget == null ? Results.NotFound() : Results.Ok(budget);
});

// ══════════════════════════════════════════════════
// CAMPAIGN TEMPLATES
// ══════════════════════════════════════════════════

app.MapPost("/api/templates", async (AppDbContext db, HttpContext ctx, CreateTemplateRequest req) =>
{
    var companyId = ctx.GetCompanyId();
    var template = new CampaignTemplate { CompanyId = companyId, Name = req.Name, Description = req.Description, ObjectiveId = req.ObjectiveId, Platforms = req.Platforms, CreatedBy = ctx.GetUserId() };
    db.CampaignTemplates.Add(template);
    await db.SaveChangesAsync();
    return Results.Created($"/api/templates/{template.Id}", template);
});

app.MapGet("/api/templates", async (AppDbContext db, HttpContext ctx) =>
{
    var companyId = ctx.GetCompanyId();
    return Results.Ok(await db.CampaignTemplates.Where(t => t.CompanyId == companyId || t.IsGlobal).OrderByDescending(t => t.UseCount).ToListAsync());
});

app.MapDelete("/api/templates/{id}", async (AppDbContext db, int id) =>
{
    var t = await db.CampaignTemplates.FindAsync(id);
    if (t == null) return Results.NotFound();
    db.CampaignTemplates.Remove(t);
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Template deleted" });
});

// ══════════════════════════════════════════════════
// AUDIENCE TEMPLATES
// ══════════════════════════════════════════════════

app.MapPost("/api/audience-templates", async (AppDbContext db, HttpContext ctx, CreateAudienceTemplateRequest req) =>
{
    var companyId = ctx.GetRequiredCompanyId();
    var template = new AudienceTemplate { CompanyId = companyId, Name = req.Name, Description = req.Description, CreatedBy = ctx.GetUserId() };
    db.AudienceTemplates.Add(template);
    await db.SaveChangesAsync();
    return Results.Ok(template);
});

app.MapGet("/api/audience-templates", async (AppDbContext db, HttpContext ctx) =>
{
    var companyId = ctx.GetRequiredCompanyId();
    return Results.Ok(await db.AudienceTemplates.Where(t => t.CompanyId == companyId).ToListAsync());
});

// ══════════════════════════════════════════════════
// ASSET MANAGEMENT (Tenant-Scoped)
// ══════════════════════════════════════════════════

app.MapPost("/api/assets/save-url", async (AppDbContext db, HttpContext ctx, SaveAssetRequest req) =>
{
    try
    {
        var client = new HttpClient();
        var response = await client.GetAsync(req.Url);
        if (!response.IsSuccessStatusCode) return Results.BadRequest("Failed to fetch image");
        var extension = ".jpg";
        var filePath = Path.Combine(AssetsFolder, req.Filename + extension);
        var bytes = await response.Content.ReadAsByteArrayAsync();
        await File.WriteAllBytesAsync(filePath, bytes);

        // Track in asset library
        var companyId = ctx.GetCompanyId();
        if (companyId.HasValue)
        {
            db.AssetLibrary.Add(new AssetLibraryItem
            {
                CompanyId = companyId.Value, Filename = req.Filename + extension, OriginalName = req.Filename,
                FilePath = filePath, FileUrl = $"/assets/{Uri.EscapeDataString(req.Filename + extension)}",
                FileType = "image", FileSizeBytes = bytes.Length, Folder = "assets", UploadedBy = ctx.GetUserId()
            });
            await db.SaveChangesAsync();
        }
        return Results.Ok(new { path = filePath });
    }
    catch (Exception ex) { return Results.Problem(ex.Message); }
});

app.MapGet("/api/assets", (HttpContext ctx) =>
{
    var files = Directory.GetFiles(AssetsFolder)
        .Select(f => { var fileName = Path.GetFileName(f); return new { name = fileName, id = fileName, url = $"/assets/{Uri.EscapeDataString(fileName)}", type = Path.GetExtension(f).ToLower() == ".mp4" ? "video" : "image" }; });
    return Results.Ok(files);
});

app.MapGet("/api/assets-library", (HttpContext ctx) =>
{
    var files = Directory.GetFiles(LibraryFolder)
        .Select(f => { var fileName = Path.GetFileName(f); return new { name = fileName, id = fileName, url = $"/library/{Uri.EscapeDataString(fileName)}", type = Path.GetExtension(f).ToLower() == ".mp4" ? "video" : "image" }; });
    return Results.Ok(files);
});

app.MapDelete("/api/assets/{filename}", (string filename) =>
{
    var filePath = Path.Combine(AssetsFolder, filename);
    if (!File.Exists(filePath)) return Results.NotFound();
    try { File.Delete(filePath); return Results.Ok(new { message = "Asset deleted" }); }
    catch (Exception ex) { return Results.Problem(ex.Message); }
});

app.MapPost("/api/assets/upload", async (HttpContext ctx) =>
{
    var form = await ctx.Request.ReadFormAsync();
    var file = form.Files.GetFile("file");
    if (file == null || file.Length == 0)
        return Results.BadRequest(new { error = "No file provided." });

    var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
    var allowed = new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".mov", ".webm" };
    if (!allowed.Contains(ext))
        return Results.BadRequest(new { error = "Unsupported file type." });

    var filename = $"upload_{Guid.NewGuid():N}{ext}";
    var filePath = Path.Combine(AssetsFolder, filename);
    using (var stream = File.Create(filePath))
        await file.CopyToAsync(stream);

    return Results.Ok(new { filename, url = $"/assets/{filename}", type = ext == ".mp4" || ext == ".mov" || ext == ".webm" ? "video" : "image" });
}).DisableAntiforgery();

app.MapPost("/api/assets/approve", (ApproveAssetRequest req) =>
{
    var sourcePath = Path.Combine(AssetsFolder, req.Filename);
    var destPath = Path.Combine(LibraryFolder, req.Filename);
    if (!File.Exists(sourcePath)) return Results.NotFound(new { error = "Source asset not found." });
    try { File.Copy(sourcePath, destPath, true); return Results.Ok(new { message = "Asset approved and saved to library." }); }
    catch (Exception ex) { return Results.Problem(ex.Message); }
});

// ══════════════════════════════════════════════════
// DEPLOYMENT ENDPOINTS
// ══════════════════════════════════════════════════

app.MapPost("/api/deploy/unified", async (HttpContext ctx, DeploymentOrchestrator orchestrator, UnifiedDeployRequest req) =>
{
    var companyId = ctx.GetRequiredCompanyId();
    var userId = ctx.GetUserId();
    var result = await orchestrator.DeployToAllPlatformsAsync(req.CampaignId, req.Platforms, companyId, userId, req.DryRun);
    return Results.Ok(result);
});

app.MapPost("/api/deploy/facebook", async (FacebookDeployRequest req, FacebookAdsService fbService, AppDbContext db, HttpContext ctx) =>
{
    try
    {
        Console.WriteLine($"[FACEBOOK] Starting Deployment for: {req.campaign.name}");
        string ExtractId(JsonElement json) => json.TryGetProperty("id", out var id) ? id.GetString()! : null!;

        string mediaId = "mock_media_id_12345"; string? mediaError = null; bool mediaReal = false; bool isVideo = false;
        if (!string.IsNullOrEmpty(req.assetId))
        {
            string assetPath = Path.Combine(AssetsFolder, req.assetId);
            if (!File.Exists(assetPath)) assetPath = Path.Combine(LibraryFolder, req.assetId);
            if (File.Exists(assetPath))
            {
                isVideo = Path.GetExtension(assetPath).ToLower() == ".mp4";
                try
                {
                    if (isVideo) { var r = await fbService.UploadVideoAsync(assetPath); var j = JsonSerializer.Deserialize<JsonElement>(r); if (j.TryGetProperty("id", out var v)) { mediaId = v.GetString()!; mediaReal = true; } }
                    else { var r = await fbService.UploadImageAsync(assetPath); var j = JsonSerializer.Deserialize<JsonElement>(r); if (j.TryGetProperty("images", out var imgs)) { foreach (var p in imgs.EnumerateObject()) { if (p.Value.TryGetProperty("hash", out var h)) { mediaId = h.GetString()!; mediaReal = true; break; } } } }
                }
                catch (Exception ex) { mediaError = ex.Message; }
            }
            else mediaError = "Asset file not found.";
        }

        string fbCampaignId = "", fbAdSetId = "", fbCreativeId = "", fbAdId = "";
        string? campaignError = null, adSetError = null, creativeError = null, adError = null;
        bool campaignReal = false, adSetReal = false, creativeReal = false, adReal = false;

        try { var s = await fbService.CreateCampaignAsync(req.campaign.name, req.campaign.objective, req.campaign.status); fbCampaignId = ExtractId(JsonSerializer.Deserialize<JsonElement>(s)); campaignReal = true; } catch (Exception ex) { campaignError = ex.Message; fbCampaignId = $"mock_camp_{Guid.NewGuid().ToString()[..8]}"; }
        if (campaignReal) { try { var s = await fbService.CreateAdSetAsync(fbCampaignId, req.adSet.name, req.adSet.daily_budget, req.adSet.status, JsonSerializer.Serialize(req.adSet.targeting)); fbAdSetId = ExtractId(JsonSerializer.Deserialize<JsonElement>(s)); adSetReal = true; } catch (Exception ex) { adSetError = ex.Message; fbAdSetId = $"mock_adset_{Guid.NewGuid().ToString()[..8]}"; } }
        try { var s = await fbService.CreateAdCreativeAsync(req.creative.name, req.creative.object_story_spec.page_id, req.creative.object_story_spec.link_data.message, req.creative.object_story_spec.link_data.link, mediaId, isVideo, req.creative.object_story_spec.link_data.name); fbCreativeId = ExtractId(JsonSerializer.Deserialize<JsonElement>(s)); creativeReal = true; } catch (Exception ex) { creativeError = ex.Message; fbCreativeId = $"mock_creative_{Guid.NewGuid().ToString()[..8]}"; }
        if (adSetReal && creativeReal) { try { var s = await fbService.CreateAdAsync($"Ad_{req.campaign.name}", fbAdSetId, fbCreativeId, req.campaign.status ?? "PAUSED"); fbAdId = ExtractId(JsonSerializer.Deserialize<JsonElement>(s)); adReal = true; } catch (Exception ex) { adError = ex.Message; fbAdId = $"mock_ad_{Guid.NewGuid().ToString()[..8]}"; } }

        // ── Persist to Database ──
        int userId = ctx.GetUserId();
        int companyId = ctx.GetCompanyId() ?? (await db.Companies.OrderBy(c => c.Id).Select(c => c.Id).FirstOrDefaultAsync());

        Campaign dbCampaign;
        if (req.campaignDbId.HasValue)
        {
            dbCampaign = await db.Campaigns.FindAsync(req.campaignDbId.Value) ?? new Campaign { CompanyId = companyId, Name = req.campaign.name, Platforms = new[] { "facebook" }, CreatedBy = userId, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
            if (!req.campaignDbId.HasValue) db.Campaigns.Add(dbCampaign);
        }
        else
        {
            dbCampaign = new Campaign { CompanyId = companyId, Name = req.campaign.name, Platforms = new[] { "facebook" }, BidStrategy = "lowest_cost", DailyBudget = req.adSet.daily_budget / 100m, Status = "draft", CreatedBy = userId, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
            db.Campaigns.Add(dbCampaign);
            await db.SaveChangesAsync();
            var wfSteps = new[] { "objective", "targeting", "strategy", "adset_config", "creative", "review", "deploy" };
            for (int i = 0; i < wfSteps.Length; i++)
                db.CampaignWorkflowSteps.Add(new CampaignWorkflowStep { CampaignId = dbCampaign.Id, StepName = wfSteps[i], StepOrder = i + 1, Status = "completed", CompletedBy = userId, CompletedAt = DateTime.UtcNow });
        }

        // Store FB campaign ID and update status
        if (campaignReal)
        {
            dbCampaign.PlatformCampaignIds = JsonSerializer.Deserialize<JsonElement>(JsonSerializer.Serialize(new Dictionary<string, string> { ["facebook"] = fbCampaignId }));
            if (adReal) { dbCampaign.Status = "active"; dbCampaign.DeployedBy = userId; dbCampaign.DeployedAt = DateTime.UtcNow; }
            dbCampaign.UpdatedAt = DateTime.UtcNow;
        }
        await db.SaveChangesAsync();

        // Create AdSet record
        var dbAdSet = new AdSet
        {
            CompanyId = companyId, CampaignId = dbCampaign.Id, Name = req.adSet.name,
            DailyBudget = req.adSet.daily_budget / 100m, BillingEvent = req.adSet.billing_event,
            OptimizationGoal = req.adSet.optimization_goal, Status = adSetReal ? "active" : "draft",
            PlatformAdSetIds = adSetReal ? JsonSerializer.Deserialize<JsonElement>(JsonSerializer.Serialize(new Dictionary<string, string> { ["facebook"] = fbAdSetId })) : null,
            CreatedBy = userId, CreatedAt = DateTime.UtcNow
        };
        db.AdSets.Add(dbAdSet);
        await db.SaveChangesAsync();

        // Create Ad + Creative records
        Ad? dbAd = null;
        if (adSetReal)
        {
            dbAd = new Ad
            {
                CompanyId = companyId, AdSetId = dbAdSet.Id, Name = $"Ad_{req.campaign.name}",
                Status = adReal ? "active" : "draft", ReviewStatus = "approved",
                Headline = req.creative.object_story_spec.link_data.name,
                Description = req.creative.object_story_spec.link_data.message,
                CtaLink = req.creative.object_story_spec.link_data.link,
                PlatformAdIds = adReal ? JsonSerializer.Deserialize<JsonElement>(JsonSerializer.Serialize(new Dictionary<string, string> { ["facebook"] = fbAdId })) : null,
                CreatedBy = userId, CreatedAt = DateTime.UtcNow
            };
            db.Ads.Add(dbAd);
            await db.SaveChangesAsync();

            if (creativeReal)
            {
                db.AdCreatives.Add(new AdCreative
                {
                    CompanyId = companyId, AdId = dbAd.Id,
                    CreativeType = isVideo ? "video" : "image",
                    AssetUrl = req.creative.object_story_spec.link_data.link,
                    AssetFilename = req.assetId,
                    PrimaryText = req.creative.object_story_spec.link_data.message,
                    Headline = req.creative.object_story_spec.link_data.name,
                    CtaType = "LEARN_MORE", CtaLink = req.creative.object_story_spec.link_data.link,
                    PlatformCreativeIds = JsonSerializer.Deserialize<JsonElement>(JsonSerializer.Serialize(new Dictionary<string, string> { ["facebook"] = fbCreativeId })),
                    CreatedAt = DateTime.UtcNow
                });
                await db.SaveChangesAsync();
            }
        }

        // Log all steps to deployment_logs
        var deploySteps = new[] {
            (action: isVideo ? "upload_video" : "upload_image", id: mediaId, real: mediaReal, error: mediaError),
            (action: "create_campaign", id: fbCampaignId, real: campaignReal, error: campaignError),
            (action: "create_adset",    id: fbAdSetId,    real: adSetReal,   error: adSetError),
            (action: "create_creative", id: fbCreativeId, real: creativeReal, error: creativeError),
            (action: "create_ad",       id: fbAdId,       real: adReal,       error: adError)
        };
        foreach (var step in deploySteps)
        {
            db.DeploymentLogs.Add(new DeploymentLog
            {
                CompanyId = companyId, CampaignId = dbCampaign.Id,
                AdSetId = step.action is "create_adset" or "create_creative" or "create_ad" ? dbAdSet.Id : null,
                AdId = step.action == "create_ad" ? dbAd?.Id : null,
                Platform = "facebook", Action = step.action,
                PlatformResourceId = step.id, Status = step.real ? "success" : "failed",
                ErrorMessage = step.error, ExecutedBy = userId, ExecutedAt = DateTime.UtcNow
            });
        }
        await db.SaveChangesAsync();
        Console.WriteLine($"[FACEBOOK] Saved to DB: Campaign={dbCampaign.Id}, AdSet={dbAdSet.Id}, Ad={dbAd?.Id}");

        return Results.Ok(new {
            success = campaignReal && adSetReal && creativeReal && adReal, network = "Facebook",
            dbCampaignId = dbCampaign.Id, dbAdSetId = dbAdSet.Id, dbAdId = dbAd?.Id,
            steps = new[] {
                new { label = isVideo ? "Video Upload" : "Image Upload", id = mediaId,     real = mediaReal,     error = mediaError    },
                new { label = "Campaign",  id = fbCampaignId, real = campaignReal, error = campaignError },
                new { label = "Ad Set",    id = fbAdSetId,    real = adSetReal,   error = adSetError   },
                new { label = "Creative",  id = fbCreativeId, real = creativeReal, error = creativeError },
                new { label = "Ad",        id = fbAdId,       real = adReal,       error = adError      }
            }
        });
    }
    catch (Exception ex) { return Results.Problem(ex.Message); }
});

app.MapPost("/api/deploy/tiktok-adgroup", async (TikTokDeployRequest req, IConfiguration config, HttpContext context) =>
{
    var accessToken = context.Request.Headers["X-TikTok-Token"].ToString();
    if (string.IsNullOrEmpty(accessToken)) accessToken = config["TikTok:AccessToken"];

    if (string.IsNullOrEmpty(accessToken) || accessToken == "YOUR_TIKTOK_ACCESS_TOKEN_HERE")
    {
        await Task.Delay(2000);
        return Results.Ok(new { status = "success", message = "TikTok deployment simulated.", adgroup_id = "SIM_GRP_" + Guid.NewGuid().ToString()[..8], ad_id = "SIM_AD_" + Guid.NewGuid().ToString()[..8] });
    }

    try
    {
        const string groupUrl = "https://business-api.tiktok.com/open_api/v1.3/adgroup/create/";
        var groupMsg = new HttpRequestMessage(HttpMethod.Post, groupUrl);
        groupMsg.Headers.Add("Access-Token", accessToken);
        groupMsg.Content = JsonContent.Create(req.group);
        var groupRes = await httpClient.SendAsync(groupMsg);
        var groupContent = await groupRes.Content.ReadAsStringAsync();
        if (!groupRes.IsSuccessStatusCode) return Results.Problem(detail: groupContent, statusCode: (int)groupRes.StatusCode);
        return Results.Text(groupContent, "application/json");
    }
    catch (Exception ex) { return Results.Problem(ex.Message); }
});

app.MapGet("/api/test/facebook-connection", async (FacebookAdsService fbService) =>
{
    try { var info = await fbService.GetAdAccountInfoAsync(); return Results.Ok(new { status = "success", data = JsonSerializer.Deserialize<JsonElement>(info) }); }
    catch (Exception ex) { return Results.Problem(ex.Message); }
});

// ══════════════════════════════════════════════════
// GEMINI AI ENDPOINTS
// ══════════════════════════════════════════════════

app.MapPost("/api/gemini/questions", async (GeminiRequest req, IConfiguration config) =>
{
    var apiKey = config["Gemini:ApiKey"];
    if (string.IsNullOrEmpty(apiKey) || apiKey == "YOUR_GEMINI_API_KEY_HERE")
        return Results.BadRequest(new { error = "Gemini API key is not configured." });

    var cacheKey = $"l1_{req.Brief.ToLower().GetHashCode()}";
    if (aiCache.TryGetValue(cacheKey, out var cachedQuestions))
        return Results.Ok(new { questions = cachedQuestions, source = "cache" });

    for (int i = 0; i <= 3; i++)
    {
        try
        {
            var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={apiKey}";
            var prompt = $"As a high-level marketing strategist, analyze this brief: '{req.Brief}'. Generate 5 deep, conceptual questions that will help read the user's mind and uncover the core psychological pillars. STRICT RULE: Format output as a valid JSON array of strings only.";
            var body = new { contents = new[] { new { parts = new[] { new { text = prompt } } } } };
            var response = await httpClient.PostAsJsonAsync(url, body);
            if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests && i < 3) { await Task.Delay(3000 * (i + 1)); continue; }
            if (!response.IsSuccessStatusCode) { var err = await response.Content.ReadAsStringAsync(); return Results.Problem(detail: err, statusCode: (int)response.StatusCode); }
            var result = await response.Content.ReadFromJsonAsync<JsonElement>();
            var text = result.GetProperty("candidates")[0].GetProperty("content").GetProperty("parts")[0].GetProperty("text").GetString()?.Trim() ?? "";
            if (text.StartsWith("```json")) text = text.Replace("```json", ""); if (text.StartsWith("```")) text = text.Replace("```", ""); if (text.EndsWith("```")) text = text[..text.LastIndexOf("```")]; text = text.Trim();
            var questions = JsonSerializer.Deserialize<string[]>(text);
            if (questions != null) aiCache[cacheKey] = questions;
            return Results.Ok(new { questions });
        }
        catch (Exception ex) { if (i == 3) return Results.Problem(ex.Message); await Task.Delay(3000); }
    }
    return Results.Problem("Max retries reached.");
});

app.MapPost("/api/gemini/follow-up", async (GeminiFollowUpRequest req, IConfiguration config) =>
{
    var apiKey = config["Gemini:ApiKey"];
    if (string.IsNullOrEmpty(apiKey) || apiKey == "YOUR_GEMINI_API_KEY_HERE")
        return Results.BadRequest(new { error = "Gemini API key is not configured." });

    var combinedAnswers = string.Join("|", req.PreviousAnswers ?? Array.Empty<string>());
    var cacheKey = $"l2_{req.OriginalBrief.ToLower().GetHashCode()}_{combinedAnswers.GetHashCode()}";
    if (aiCache.TryGetValue(cacheKey, out var cachedQuestions))
        return Results.Ok(new { questions = cachedQuestions, source = "cache" });

    for (int i = 0; i <= 3; i++)
    {
        try
        {
            var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={apiKey}";
            var history = "";
            for (int h = 0; h < req.PreviousQuestions.Length; h++)
            {
                var ans = (req.PreviousAnswers != null && h < req.PreviousAnswers.Length) ? req.PreviousAnswers[h] : "No answer";
                history += $"Q: {req.PreviousQuestions[h]}\nA: {ans}\n\n";
            }
            var prompt = $"Based on the original brief: '{req.OriginalBrief}' and probe results:\n{history}\nGenerate 5 advanced, deep-dive psychological diagnostic questions. STRICT RULE: Format as valid JSON array of strings only.";
            var body = new { contents = new[] { new { parts = new[] { new { text = prompt } } } } };
            var response = await httpClient.PostAsJsonAsync(url, body);
            if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests && i < 3) { await Task.Delay(3000 * (i + 1)); continue; }
            if (!response.IsSuccessStatusCode) { var err = await response.Content.ReadAsStringAsync(); return Results.Problem(detail: err, statusCode: (int)response.StatusCode); }
            var result = await response.Content.ReadFromJsonAsync<JsonElement>();
            var text = result.GetProperty("candidates")[0].GetProperty("content").GetProperty("parts")[0].GetProperty("text").GetString()?.Trim() ?? "";
            if (text.StartsWith("```json")) text = text.Replace("```json", ""); if (text.StartsWith("```")) text = text.Replace("```", ""); if (text.EndsWith("```")) text = text[..text.LastIndexOf("```")]; text = text.Trim();
            var questions = JsonSerializer.Deserialize<string[]>(text);
            if (questions != null) aiCache[cacheKey] = questions;
            return Results.Ok(new { questions });
        }
        catch (Exception ex) { if (i == 3) return Results.Problem(ex.Message); await Task.Delay(3000); }
    }
    return Results.Problem("Max retries reached.");
});

// ══════════════════════════════════════════════════
// SEARCH
// ══════════════════════════════════════════════════

app.MapGet("/api/search", async (AppDbContext db, HttpContext ctx, string q) =>
{
    var companyId = ctx.GetCompanyId();
    var term = q.ToLower();
    var campaigns = await db.Campaigns.Where(c => (companyId == null || c.CompanyId == companyId) && (c.Name!.ToLower().Contains(term) || c.Brief!.ToLower().Contains(term))).Take(5).Select(c => new { c.Id, c.Name, Type = "campaign" }).ToListAsync();
    var users = await db.Users.Where(u => (companyId == null || u.CompanyId == companyId) && (u.Username!.ToLower().Contains(term) || u.Email!.ToLower().Contains(term))).Take(5).Select(u => new { u.Id, Name = u.Username, Type = "user" }).ToListAsync();
    return Results.Ok(new { campaigns, users });
});

// ══════════════════════════════════════════════════
// ACTIVITY LOG
// ══════════════════════════════════════════════════

app.MapGet("/api/activity-logs", async (AppDbContext db, HttpContext ctx, int limit = 50) =>
{
    var companyId = ctx.GetCompanyId();
    var query = db.ActivityLogs.AsQueryable();
    if (companyId.HasValue) query = query.Where(a => a.CompanyId == companyId);
    return Results.Ok(await query.OrderByDescending(a => a.CreatedAt).Take(limit).ToListAsync());
});

// ══════════════════════════════════════════════════
// DEPLOYMENT HISTORY
// ══════════════════════════════════════════════════

app.MapGet("/api/deployment-logs", async (AppDbContext db, HttpContext ctx, int? campaignId, int limit = 50) =>
{
    var companyId = ctx.GetCompanyId();
    var query = db.DeploymentLogs.AsQueryable();
    if (companyId.HasValue) query = query.Where(d => d.CompanyId == companyId);
    if (campaignId.HasValue) query = query.Where(d => d.CampaignId == campaignId);
    return Results.Ok(await query.OrderByDescending(d => d.ExecutedAt).Take(limit).ToListAsync());
});

// ══════════════════════════════════════════════════
// METRICS & REPORTING
// ══════════════════════════════════════════════════

// Manual trigger: fetch real FB metrics for a specific campaign
app.MapPost("/api/campaigns/{id:int}/metrics/fetch", async (int id, AppDbContext db, HttpContext ctx, MetricsFetchService svc) =>
{
    var companyId = ctx.GetRequiredCompanyId();
    var campaign = await db.Campaigns.FirstOrDefaultAsync(c => c.Id == id && c.CompanyId == companyId);
    if (campaign == null) return Results.NotFound(new { error = "Campaign not found" });

    string? fbCampaignId = null;
    if (campaign.PlatformCampaignIds.HasValue && campaign.PlatformCampaignIds.Value.TryGetProperty("facebook", out var fbIdEl))
        fbCampaignId = fbIdEl.GetString();

    await svc.FetchMetricsForCampaign(id);

    var refreshedCampaignId = id;
    if (!string.IsNullOrEmpty(fbCampaignId))
    {
        var companyCampaigns = await db.Campaigns
            .Where(c => c.CompanyId == companyId)
            .Select(c => new { c.Id, c.PlatformCampaignIds })
            .ToListAsync();

        refreshedCampaignId = companyCampaigns
            .FirstOrDefault(c => c.PlatformCampaignIds.HasValue &&
                                 c.PlatformCampaignIds.Value.TryGetProperty("facebook", out var platformId) &&
                                 platformId.GetString() == fbCampaignId)
            ?.Id ?? id;
    }

    var metrics = await db.AdMetrics
        .Where(m => m.CampaignId == refreshedCampaignId && m.AdSetId != null && m.AdId != null)
        .OrderByDescending(m => m.Date)
        .Take(30)
        .ToListAsync();

    return Results.Ok(new { message = "Metrics refreshed", count = metrics.Count, metrics });
}).RequireAuthorization();

// ── Refresh ad_metrics_summary manually ──
app.MapPost("/api/metrics/refresh-summary", async (HttpContext ctx, MetricsSummaryService svc) =>
{
    await svc.RefreshAsync(ctx.RequestAborted);
    return Results.Ok(new { message = "ad_metrics_summary refreshed with latest data" });
}).RequireAuthorization();

// ── Full Facebook Sync: delete all previous data, import all FB campaigns + lifetime metrics ──
app.MapPost("/api/facebook/sync", async (HttpContext ctx, MetricsFetchService svc) =>
{
    var companyId = ctx.GetRequiredCompanyId();
    var summary = await svc.SyncFacebookDataForCompany(companyId, ctx.RequestAborted);
    return Results.Ok(new
    {
        message = "Facebook data refreshed from campaign, ad set, and ad insights",
        companyId = summary.CompanyId,
        campaigns = summary.Campaigns,
        adSets = summary.AdSets,
        ads = summary.Ads,
        metricRows = summary.MetricRows
    });
}).RequireAuthorization();

// ══════════════════════════════════════════════════
// DASHBOARD ANALYTICS ENDPOINTS
// Data source: ad_metrics (hourly TIMESTAMPTZ granularity)
// ══════════════════════════════════════════════════

static IQueryable<AdMetric> ApplyAnalyticsFilter(IQueryable<AdMetric> q, int companyId, string? platform, DateTime since)
{
    q = q.Where(m => m.CompanyId == companyId && m.Date >= since);
    if (!string.IsNullOrEmpty(platform) && platform != "all")
    {
        q = q.Where(m => m.Platform == platform);
    }
    return q;
}

// ── KPI bar: current hour vs previous hour deltas ──
app.MapGet("/api/analytics/kpis", async (AppDbContext db, HttpContext ctx, string? platform, int? hours) =>
{
    var companyId = ctx.GetRequiredCompanyId();
    var now = DateTime.UtcNow;
    var currStart = now.AddHours(-1);
    var prevStart = now.AddHours(-2);

    async Task<object> Bucket(DateTime from, DateTime to)
    {
        var q = db.AdMetrics.Where(m => m.CompanyId == companyId && m.Date >= from && m.Date < to);
        if (!string.IsNullOrEmpty(platform) && platform != "all") q = q.Where(m => m.Platform == platform);
        var impressions = await q.SumAsync(m => (long?)m.Impressions) ?? 0;
        var clicks = await q.SumAsync(m => (long?)m.Clicks) ?? 0;
        var likes = await q.SumAsync(m => m.Likes) ?? 0;
        var comments = await q.SumAsync(m => m.Comments) ?? 0;
        var shares = await q.SumAsync(m => m.Shares) ?? 0;
        var saves = await q.SumAsync(m => m.Saves) ?? 0;
        var videoViews = await q.SumAsync(m => m.VideoViews) ?? 0;
        var followers = await q.SumAsync(m => m.FollowersGained) ?? 0;
        var revenue = await q.SumAsync(m => (decimal?)m.ConversionValue) ?? 0m;

        var engagement = likes + comments + shares + saves;
        var er = impressions > 0 ? (double)engagement / impressions : 0;
        var ctr = impressions > 0 ? (double)clicks / impressions : 0;
        var views = videoViews > 0 ? videoViews : impressions;

        return new { impressions, views, clicks, engagement, er, ctr, followers, revenue };
    }

    return Results.Ok(new
    {
        current = await Bucket(currStart, now),
        previous = await Bucket(prevStart, currStart),
        asOf = now
    });
}).RequireAuthorization();

// ── Hourly trends: time-series, optionally split by platform ──
app.MapGet("/api/analytics/trends", async (AppDbContext db, HttpContext ctx, string? platform, int? hours, string? metric, string? split) =>
{
    var companyId = ctx.GetRequiredCompanyId();
    var windowHours = hours ?? 48;
    var since = DateTime.UtcNow.AddHours(-windowHours);
    var metricKey = (metric ?? "views").ToLowerInvariant();
    var splitBy = (split ?? "combined").ToLowerInvariant();

    var q = ApplyAnalyticsFilter(db.AdMetrics, companyId, platform, since);

    var raw = await q.Select(m => new
    {
        m.Date,
        m.Platform,
        m.Impressions,
        VideoViews = m.VideoViews ?? 0,
        Likes = m.Likes ?? 0,
        Comments = m.Comments ?? 0,
        Shares = m.Shares ?? 0,
        Saves = m.Saves ?? 0,
        WatchSec = (m.VideoViews ?? 0) * (double)(m.AvgWatchSeconds ?? 0m),
        Followers = m.FollowersGained ?? 0
    }).ToListAsync();

    decimal ValueFor(long impressions, long videoViews, long likes, long comments, long shares, long saves, double watchSec, int followers) =>
        metricKey switch
        {
            "engagement" => likes + comments + shares + saves,
            "watch" => (decimal)watchSec,
            "followers" => followers,
            _ => (videoViews > 0 ? videoViews : impressions)
        };

    DateTime HourKey(DateTime d) => new DateTime(d.Year, d.Month, d.Day, d.Hour, 0, 0, DateTimeKind.Utc);

    if (splitBy == "split")
    {
        var byPlatformHour = raw
            .GroupBy(r => new { r.Platform, Hour = HourKey(r.Date) })
            .ToDictionary(
                g => g.Key,
                g => g.Aggregate(0m, (acc, r) => acc + ValueFor(r.Impressions, r.VideoViews, r.Likes, r.Comments, r.Shares, r.Saves, r.WatchSec, r.Followers)));

        var labels = byPlatformHour.Keys.Select(k => k.Hour).Distinct().OrderBy(d => d).ToList();
        var platforms = byPlatformHour.Keys.Select(k => k.Platform).Distinct().ToList();
        var series = platforms.Select(p => new
        {
            platform = p,
            data = labels.Select(l => byPlatformHour.TryGetValue(new { Platform = p, Hour = l }, out var v) ? v : 0m).ToList()
        });
        return Results.Ok(new { labels, series });
    }
    else
    {
        var byHour = raw
            .GroupBy(r => HourKey(r.Date))
            .OrderBy(g => g.Key)
            .Select(g => new
            {
                hour = g.Key,
                value = g.Aggregate(0m, (acc, r) => acc + ValueFor(r.Impressions, r.VideoViews, r.Likes, r.Comments, r.Shares, r.Saves, r.WatchSec, r.Followers))
            })
            .ToList();
        return Results.Ok(new
        {
            labels = byHour.Select(x => x.hour),
            series = new[] { new { platform = platform ?? "all", data = byHour.Select(x => x.value) } }
        });
    }
}).RequireAuthorization();

// ── Post performance: per-ad last-hour metrics + sparkline + trending/dropping flags ──
app.MapGet("/api/analytics/posts", async (AppDbContext db, HttpContext ctx, string? platform, int? hours, string? sort) =>
{
    var companyId = ctx.GetRequiredCompanyId();
    var now = DateTime.UtcNow;
    var windowStart = now.AddHours(-(hours ?? 48));
    var lastHourStart = now.AddHours(-1);
    var prevHourStart = now.AddHours(-2);

    var metricsQ = db.AdMetrics.Where(m => m.CompanyId == companyId && m.Date >= windowStart && m.AdId != null);
    if (!string.IsNullOrEmpty(platform) && platform != "all")
        metricsQ = metricsQ.Where(m => m.Platform == platform);

    var rows = await metricsQ.Select(m => new
    {
        m.AdId,
        m.Platform,
        m.Date,
        m.Impressions,
        VideoViews = m.VideoViews ?? 0,
        Likes = m.Likes ?? 0,
        Comments = m.Comments ?? 0,
        Shares = m.Shares ?? 0,
        Saves = m.Saves ?? 0
    }).ToListAsync();

    var adIds = rows.Select(r => r.AdId!.Value).Distinct().ToList();
    var ads = await db.Ads.Where(a => adIds.Contains(a.Id))
        .Select(a => new { a.Id, a.Name, a.CreatedAt, a.AdSetId })
        .ToListAsync();

    var byAd = rows.GroupBy(r => r.AdId!.Value).ToDictionary(g => g.Key, g => g.OrderBy(r => r.Date).ToList());

    var posts = ads.Select(a =>
    {
        var list = byAd.ContainsKey(a.Id) ? byAd[a.Id] : new();
        var last = list.Where(r => r.Date >= lastHourStart).ToList();
        var prev = list.Where(r => r.Date >= prevHourStart && r.Date < lastHourStart).ToList();
        var lastViews = last.Sum(r => (long)(r.VideoViews > 0 ? r.VideoViews : r.Impressions));
        var prevViews = prev.Sum(r => (long)(r.VideoViews > 0 ? r.VideoViews : r.Impressions));
        var lastImpr = last.Sum(r => (long)r.Impressions);
        var lastEng = last.Sum(r => (long)(r.Likes + r.Comments + r.Shares + r.Saves));
        var lastShares = last.Sum(r => (long)r.Shares);
        var velocity = lastViews;
        var velocityPct = prevViews > 0 ? (double)(velocity - prevViews) / prevViews : 0;
        var er = lastImpr > 0 ? (double)lastEng / lastImpr : 0;
        var virality = lastImpr > 0 ? (double)lastShares / lastImpr : 0;
        var spark = list.TakeLast(12).Select(r => (long)(r.VideoViews > 0 ? r.VideoViews : r.Impressions)).ToList();
        var platformName = list.LastOrDefault()?.Platform ?? platform ?? "facebook";
        return new
        {
            id = a.Id,
            title = a.Name,
            platform = platformName,
            type = "video", // derived later if ad_creatives join needed
            ageHours = (int)(now - a.CreatedAt).TotalHours,
            views = lastViews,
            er,
            velocity,
            velocityPct,
            virality,
            sparkline = spark,
            trending = velocityPct > 0.5,
            dropping = velocityPct < -0.5
        };
    }).ToList();

    var sorted = (sort ?? "views").ToLowerInvariant() switch
    {
        "er" => posts.OrderByDescending(p => p.er).ToList(),
        "velocity" => posts.OrderByDescending(p => p.velocity).ToList(),
        "virality" => posts.OrderByDescending(p => p.virality).ToList(),
        _ => posts.OrderByDescending(p => p.views).ToList()
    };

    return Results.Ok(sorted);
}).RequireAuthorization();

// ── Virality: top risers by recent vs baseline lift ──
app.MapGet("/api/analytics/virality", async (AppDbContext db, HttpContext ctx, string? platform) =>
{
    var companyId = ctx.GetRequiredCompanyId();
    var now = DateTime.UtcNow;
    var recentStart = now.AddHours(-2);
    var baselineStart = now.AddHours(-8);

    var q = db.AdMetrics.Where(m => m.CompanyId == companyId && m.Date >= baselineStart && m.AdId != null);
    if (!string.IsNullOrEmpty(platform) && platform != "all")
        q = q.Where(m => m.Platform == platform);

    var rows = await q.Select(m => new
    {
        m.AdId,
        m.Platform,
        m.Date,
        m.Impressions,
        VideoViews = m.VideoViews ?? 0,
        Likes = m.Likes ?? 0,
        Comments = m.Comments ?? 0,
        Shares = m.Shares ?? 0,
        Saves = m.Saves ?? 0
    }).ToListAsync();

    var ads = await db.Ads.Where(a => rows.Select(r => r.AdId!.Value).Contains(a.Id))
        .Select(a => new { a.Id, a.Name }).ToListAsync();
    var adName = ads.ToDictionary(a => a.Id, a => a.Name);

    var items = rows.GroupBy(r => r.AdId!.Value).Select(g =>
    {
        var list = g.ToList();
        var recent = list.Where(r => r.Date >= recentStart).Sum(r => (long)(r.VideoViews > 0 ? r.VideoViews : r.Impressions));
        var baselineHours = 6.0; // 8h window minus 2h recent
        var baseline = list.Where(r => r.Date < recentStart).Sum(r => (long)(r.VideoViews > 0 ? r.VideoViews : r.Impressions)) / baselineHours;
        var lift = baseline > 0 ? ((recent / 2.0) - baseline) / baseline : 0;
        var engagementVel = list.Where(r => r.Date >= recentStart).Sum(r => (long)(r.Likes + r.Comments + r.Shares + r.Saves));
        return new
        {
            id = g.Key,
            title = adName.ContainsKey(g.Key) ? adName[g.Key] : $"Ad {g.Key}",
            platform = list.Last().Platform,
            recentViews = recent,
            engagementVelocity = engagementVel,
            lift
        };
    })
    .OrderByDescending(x => x.lift)
    .Take(5)
    .ToList();

    var alerts = items.Where(x => x.lift > 2.0).ToList();
    return Results.Ok(new { risers = items, alerts });
}).RequireAuthorization();

// ── Retention: per-ad avg watch + completion + retention curve approximation ──
app.MapGet("/api/analytics/retention/{adId:int}", async (int adId, AppDbContext db, HttpContext ctx) =>
{
    var companyId = ctx.GetRequiredCompanyId();
    var latest = await db.AdMetrics
        .Where(m => m.CompanyId == companyId && m.AdId == adId)
        .OrderByDescending(m => m.Date)
        .Select(m => new
        {
            m.Date,
            m.VideoViews,
            m.VideoCompletions,
            m.AvgWatchSeconds,
            m.Platform
        })
        .FirstOrDefaultAsync();

    if (latest == null) return Results.NotFound(new { error = "No metrics for this ad." });

    var ad = await db.Ads.Where(a => a.Id == adId).Select(a => new { a.Name }).FirstOrDefaultAsync();
    var views = latest.VideoViews ?? 0;
    var completions = latest.VideoCompletions ?? 0;
    var avgWatch = latest.AvgWatchSeconds ?? 0m;
    var completion = views > 0 ? (double)completions / views : 0;

    // Decile-decayed retention curve — real per-quartile data needs FB video_p25/p50/p75/p100 fields
    var curve = Enumerable.Range(0, 11).Select(i =>
    {
        var x = i / 10.0;
        var baseVal = Math.Exp(-x * 1.6) * 100;
        return Math.Max(5, baseVal);
    }).ToList();

    return Results.Ok(new
    {
        adId,
        title = ad?.Name ?? $"Ad {adId}",
        platform = latest.Platform,
        avgWatchSeconds = avgWatch,
        completion,
        retention = curve
    });
}).RequireAuthorization();

// ── Heatmap: engagement intensity per (platform, hour-of-day) ──
app.MapGet("/api/analytics/heatmap", async (AppDbContext db, HttpContext ctx, int? hours) =>
{
    var companyId = ctx.GetRequiredCompanyId();
    var since = DateTime.UtcNow.AddHours(-(hours ?? 48));

    var rows = await db.AdMetrics
        .Where(m => m.CompanyId == companyId && m.Date >= since)
        .Select(m => new
        {
            m.Platform,
            m.Date,
            Engagement = (m.Likes ?? 0) + (m.Comments ?? 0) + (m.Shares ?? 0) + (m.Saves ?? 0)
        })
        .ToListAsync();

    var grouped = rows
        .GroupBy(r => new { r.Platform, Hour = r.Date.Hour })
        .Select(g => new { g.Key.Platform, g.Key.Hour, Avg = g.Average(r => (double)r.Engagement) })
        .ToList();

    var platforms = grouped.Select(g => g.Platform).Distinct().ToList();
    var result = platforms.Select(p => new
    {
        platform = p,
        values = Enumerable.Range(0, 24)
            .Select(h => grouped.FirstOrDefault(g => g.Platform == p && g.Hour == h)?.Avg ?? 0.0)
            .ToList()
    });

    return Results.Ok(result);
}).RequireAuthorization();

// ── All campaigns report (aggregate across all campaigns) ──
app.MapGet("/api/facebook/report", async (AppDbContext db, HttpContext ctx) =>
{
    var companyId = ctx.GetRequiredCompanyId();

    var campaigns = await db.Campaigns
        .Where(c => c.CompanyId == companyId && c.Platforms.Contains("facebook"))
        .ToListAsync();

    var metrics = await db.AdMetrics
        .Where(m => m.CompanyId == companyId && m.Platform == "facebook" && m.AdSetId != null && m.AdId != null)
        .Select(m => new {
            m.CampaignId, m.Date, m.Platform,
            m.Impressions, m.Reach, m.Clicks, m.Spend,
            m.Ctr, m.Cpc, m.Cpm, m.Frequency,
            m.Conversions, m.ConversionValue, m.Roas,
            m.VideoViews, m.FetchedAt
        })
        .ToListAsync();

    var campaignReports = campaigns.Select(c =>
    {
        var cm = metrics.Where(m => m.CampaignId == c.Id).ToList();
        return new
        {
            dbId = c.Id,
            fbCampaignId = c.PlatformCampaignIds.HasValue && c.PlatformCampaignIds.Value.TryGetProperty("facebook", out var f) ? f.GetString() : null,
            name = c.Name, status = c.Status, platforms = c.Platforms,
            startDate = c.StartDate, endDate = c.EndDate,
            dailyBudget = c.DailyBudget, lifetimeBudget = c.LifetimeBudget,
            totalImpressions = cm.Sum(m => m.Impressions),
            totalReach = cm.Sum(m => m.Reach),
            totalClicks = cm.Sum(m => m.Clicks),
            totalSpend = Math.Round(cm.Sum(m => m.Spend), 2),
            totalConversions = cm.Sum(m => m.Conversions),
            totalVideoViews = cm.Sum(m => m.VideoViews),
            avgCtr = cm.Sum(m => m.Impressions) > 0 ? Math.Round((decimal)cm.Sum(m => m.Clicks) / cm.Sum(m => m.Impressions), 4) : 0,
            avgCpc = cm.Sum(m => m.Clicks) > 0 ? Math.Round(cm.Sum(m => m.Spend) / cm.Sum(m => m.Clicks), 4) : 0,
            avgCpm = cm.Any(m => m.Cpm > 0) ? Math.Round(cm.Where(m => m.Cpm > 0).Average(m => m.Cpm), 4) : 0,
            avgRoas = cm.Sum(m => m.Spend) > 0 ? Math.Round(cm.Sum(m => m.ConversionValue) / cm.Sum(m => m.Spend), 4) : 0,
            hasData = cm.Count > 0,
            dailyMetrics = cm.OrderBy(m => m.Date).ToList()
        };
    }).ToList();

    var totals = new
    {
        totalCampaigns = campaigns.Count,
        campaignsWithData = campaignReports.Count(c => c.hasData),
        totalImpressions = metrics.Sum(m => m.Impressions),
        totalReach = metrics.Sum(m => m.Reach),
        totalClicks = metrics.Sum(m => m.Clicks),
        totalSpend = Math.Round(metrics.Sum(m => m.Spend), 2),
        totalConversions = metrics.Sum(m => m.Conversions),
        totalVideoViews = metrics.Sum(m => m.VideoViews),
        avgCtr = metrics.Sum(m => m.Impressions) > 0 ? Math.Round((decimal)metrics.Sum(m => m.Clicks) / metrics.Sum(m => m.Impressions), 4) : 0,
        avgCpc = metrics.Sum(m => m.Clicks) > 0 ? Math.Round(metrics.Sum(m => m.Spend) / metrics.Sum(m => m.Clicks), 4) : 0,
        avgCpm = metrics.Any(m => m.Cpm > 0) ? Math.Round(metrics.Where(m => m.Cpm > 0).Average(m => m.Cpm), 4) : 0
    };

    return Results.Ok(new { totals, campaigns = campaignReports, generatedAt = DateTime.UtcNow });
}).RequireAuthorization();



// Report: campaign summary + metrics history
app.MapGet("/api/campaigns/{id:int}/report", async (int id, AppDbContext db, HttpContext ctx, IConfiguration config) =>
{
    var companyId = ctx.GetRequiredCompanyId();
    var campaign = await db.Campaigns
        .Include(c => c.AdSets).ThenInclude(a => a.Ads)
        .FirstOrDefaultAsync(c => c.Id == id && c.CompanyId == companyId);
    if (campaign == null) return Results.NotFound(new { error = "Campaign not found" });

    // Project to clean flat objects — no EF navigation property bloat
    var metrics = await db.AdMetrics
        .Where(m => m.CampaignId == id && m.AdSetId != null && m.AdId != null)
        .OrderBy(m => m.Date).ThenBy(m => m.Platform)
        .Select(m => new {
            m.Id, m.Date, m.Platform,
            m.Impressions, m.Reach, m.Clicks, m.Spend,
            m.Ctr, m.Cpc, m.Cpm, m.Frequency,
            m.Conversions, m.ConversionValue, m.Roas,
            m.VideoViews, m.VideoCompletions, m.Leads, m.AppInstalls,
            m.FetchedAt
        })
        .ToListAsync();

    var byPlatform = metrics.GroupBy(m => m.Platform).Select(g => new
    {
        platform = g.Key,
        totalImpressions = g.Sum(m => m.Impressions),
        totalReach = g.Sum(m => m.Reach),
        totalClicks = g.Sum(m => m.Clicks),
        totalSpend = Math.Round(g.Sum(m => m.Spend), 2),
        totalConversions = g.Sum(m => m.Conversions),
        totalConversionValue = g.Sum(m => m.ConversionValue),
        totalVideoViews = g.Sum(m => m.VideoViews),
        avgCtr = g.Sum(m => m.Impressions) > 0 ? Math.Round((decimal)g.Sum(m => m.Clicks) / g.Sum(m => m.Impressions), 4) : 0,
        avgCpc = g.Sum(m => m.Clicks) > 0 ? Math.Round(g.Sum(m => m.Spend) / g.Sum(m => m.Clicks), 4) : 0,
        avgCpm = g.Any(m => m.Cpm > 0) ? Math.Round(g.Where(m => m.Cpm > 0).Average(m => m.Cpm), 4) : 0,
        avgFrequency = g.Any(m => m.Frequency > 0) ? Math.Round(g.Where(m => m.Frequency > 0).Average(m => (decimal)m.Frequency), 2) : 0,
        avgRoas = g.Sum(m => m.Spend) > 0 ? Math.Round(g.Sum(m => m.ConversionValue) / g.Sum(m => m.Spend), 4) : 0,
        dataPoints = g.Count()
    });

    // Live Facebook insights — use explicit time_range (date_preset can be unreliable for new campaigns)
    object? liveInsights = null;
    string? fbCampaignId = null;
    if (campaign.PlatformCampaignIds.HasValue && campaign.PlatformCampaignIds.Value.TryGetProperty("facebook", out var fbIdEl))
        fbCampaignId = fbIdEl.GetString();
    if (!string.IsNullOrEmpty(fbCampaignId) && !fbCampaignId.StartsWith("mock_"))
    {
        var accessToken = config["Facebook:AccessToken"];
        if (!string.IsNullOrEmpty(accessToken))
        {
            try
            {
                using var http = new System.Net.Http.HttpClient { Timeout = TimeSpan.FromSeconds(15) };
                var fields = "impressions,reach,clicks,spend,ctr,cpc,cpm,frequency,actions,video_30_sec_watched_actions,date_start,date_stop";
                // Use explicit time_range: campaign start → today (max 7 days back)
                var since = campaign.StartDate.HasValue
                    ? campaign.StartDate.Value.ToString("yyyy-MM-dd")
                    : DateTime.UtcNow.AddDays(-7).ToString("yyyy-MM-dd");
                var until = DateTime.UtcNow.ToString("yyyy-MM-dd");
                var url = $"https://graph.facebook.com/v19.0/{fbCampaignId}/insights?fields={fields}&time_range={{\"since\":\"{since}\",\"until\":\"{until}\"}}&access_token={accessToken}";
                var resp = await http.GetStringAsync(url);
                liveInsights = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(resp);
            }
            catch (Exception ex) { liveInsights = new { error = ex.Message }; }
        }
    }

    var summary = new
    {
        totalImpressions = metrics.Sum(m => m.Impressions),
        totalReach = metrics.Sum(m => m.Reach),
        totalClicks = metrics.Sum(m => m.Clicks),
        totalSpend = Math.Round(metrics.Sum(m => m.Spend), 2),
        totalConversions = metrics.Sum(m => m.Conversions),
        totalConversionValue = metrics.Sum(m => m.ConversionValue),
        totalVideoViews = metrics.Sum(m => m.VideoViews),
        avgCtr = metrics.Sum(m => m.Impressions) > 0 ? Math.Round((decimal)metrics.Sum(m => m.Clicks) / metrics.Sum(m => m.Impressions), 4) : 0,
        avgCpc = metrics.Sum(m => m.Clicks) > 0 ? Math.Round(metrics.Sum(m => m.Spend) / metrics.Sum(m => m.Clicks), 4) : 0,
        avgCpm = metrics.Any(m => m.Cpm > 0) ? Math.Round(metrics.Where(m => m.Cpm > 0).Average(m => m.Cpm), 4) : 0,
        avgFrequency = metrics.Any(m => m.Frequency > 0) ? Math.Round(metrics.Where(m => m.Frequency > 0).Average(m => (decimal)m.Frequency), 2) : 0,
        avgRoas = metrics.Sum(m => m.Spend) > 0 ? Math.Round(metrics.Sum(m => m.ConversionValue) / metrics.Sum(m => m.Spend), 4) : 0,
        daysWithData = metrics.Select(m => m.Date.Date).Distinct().Count()
    };

    return Results.Ok(new
    {
        campaign = new {
            campaign.Id, campaign.Name, campaign.Status,
            campaign.CampaignType, campaign.Platforms,
            campaign.StartDate, campaign.EndDate,
            campaign.TotalBudget, campaign.DailyBudget, campaign.Currency,
            campaign.PlatformCampaignIds,
            adSets = campaign.AdSets.Select(s => new { s.Id, s.Name, s.Status, adCount = s.Ads.Count })
        },
        summary,
        byPlatform,
        dailyMetrics = metrics,
        liveInsights,
        generatedAt = DateTime.UtcNow
    });
}).RequireAuthorization();

// ══════════════════════════════════════════════════
// COMPANY SETTINGS
// ══════════════════════════════════════════════════

app.MapGet("/api/company-settings", async (AppDbContext db, HttpContext ctx) =>
{
    var companyId = ctx.GetRequiredCompanyId();
    var settings = await db.CompanySettings.FirstOrDefaultAsync(s => s.CompanyId == companyId);
    return settings == null ? Results.NotFound() : Results.Ok(settings);
});

app.MapPut("/api/company-settings", async (AppDbContext db, HttpContext ctx, CompanySetting updated) =>
{
    var companyId = ctx.GetRequiredCompanyId();
    var settings = await db.CompanySettings.FirstOrDefaultAsync(s => s.CompanyId == companyId);
    if (settings == null) { updated.CompanyId = companyId; db.CompanySettings.Add(updated); }
    else
    {
        settings.DefaultLanguage = updated.DefaultLanguage;
        settings.NotificationEmail = updated.NotificationEmail;
        settings.MaxDailyBudget = updated.MaxDailyBudget;
        settings.AutoApproveBelow = updated.AutoApproveBelow;
        settings.RequireCmoApproval = updated.RequireCmoApproval;
        settings.RequireBrandCheck = updated.RequireBrandCheck;
        settings.DefaultBidStrategy = updated.DefaultBidStrategy;
        settings.DefaultPlatforms = updated.DefaultPlatforms;
        settings.UpdatedAt = DateTime.UtcNow;
    }
    await db.SaveChangesAsync();
    return Results.Ok(settings);
});

// ══════════════════════════════════════════════════
// FULL DUMMY DATA SEED (All 28 Tables)
// ══════════════════════════════════════════════════

app.MapPost("/api/seed/dummy-data", async (AppDbContext db, IConfiguration config) =>
{
    // Get existing seeded data
    var company = await db.Companies.FirstOrDefaultAsync(c => c.Slug == "demo-company");
    if (company == null) return Results.BadRequest("Run /api/rbac/seed first");

    var users = await db.Users.Where(u => u.CompanyId == company.Id).ToListAsync();
    var adminUser = users.FirstOrDefault(u => u.Username == "admin");
    var cmoUser = users.FirstOrDefault(u => u.Username == "cmo");
    var pppUser = users.FirstOrDefault(u => u.Username == "ppp");
    var expertUser = users.FirstOrDefault(u => u.Username == "expert");
    var superAdmin = await db.Users.FirstOrDefaultAsync(u => u.IsSuperAdmin);

    if (adminUser == null || cmoUser == null || pppUser == null || expertUser == null)
        return Results.BadRequest("Seed users not found. Run /api/rbac/seed first");

    var objectives = await db.CampaignObjectives.ToListAsync();

    // ── 1. Create Second Company ──
    var company2 = await db.Companies.FirstOrDefaultAsync(c => c.Slug == "techstart-inc");
    if (company2 == null)
    {
        company2 = new Company { Name = "TechStart Inc", Slug = "techstart-inc", Industry = "Technology", Website = "https://techstart.io", Email = "hello@techstart.io", Country = "US", Status = "active", SubscriptionPlan = "pro", MaxUsers = 25, MaxCampaigns = 100 };
        db.Companies.Add(company2);
        await db.SaveChangesAsync();
        db.CompanySettings.Add(new CompanySetting { CompanyId = company2.Id, DefaultLanguage = "en", NotificationEmail = "alerts@techstart.io", MaxDailyBudget = 5000 });

        // Seed roles for company 2
        var c2Admin = new Role { Name = "Admin", CompanyId = company2.Id, IsSystemRole = true, Color = "purple", Icon = "A" };
        var c2Cmo = new Role { Name = "CMO", CompanyId = company2.Id, IsSystemRole = true, Color = "amber", Icon = "B" };
        db.Roles.AddRange(c2Admin, c2Cmo);
        await db.SaveChangesAsync();
        db.Users.Add(new User { Username = "tech_admin", Email = "admin@techstart.io", PasswordHash = BCrypt.Net.BCrypt.HashPassword("123456"), RoleId = c2Admin.Id, CompanyId = company2.Id });
        db.Users.Add(new User { Username = "tech_cmo", Email = "cmo@techstart.io", PasswordHash = BCrypt.Net.BCrypt.HashPassword("123456"), RoleId = c2Cmo.Id, CompanyId = company2.Id });
        await db.SaveChangesAsync();
    }

    // ── 2. Company Settings ──
    var existingSettings = await db.CompanySettings.FirstOrDefaultAsync(s => s.CompanyId == company.Id);
    if (existingSettings != null)
    {
        existingSettings.NotificationEmail = "alerts@democompany.com";
        existingSettings.MaxDailyBudget = 10000;
        existingSettings.AutoApproveBelow = 500;
        existingSettings.RequireCmoApproval = true;
        existingSettings.DefaultPlatforms = new[] { "facebook", "tiktok" };
    }
    await db.SaveChangesAsync();

    // ── 3. Company Ad Accounts ──
    if (!await db.CompanyAdAccounts.AnyAsync(a => a.CompanyId == company.Id))
    {
        db.CompanyAdAccounts.AddRange(
            new CompanyAdAccount { CompanyId = company.Id, Platform = "facebook", AccountName = config["Facebook:AccountName"], AccountId = config["Facebook:AdAccountId"], AccessToken = config["Facebook:AccessToken"], PageId = config["Facebook:PageId"], Status = "active", LastTestedAt = DateTime.UtcNow.AddHours(-2) },
            new CompanyAdAccount { CompanyId = company.Id, Platform = "tiktok", AccountName = "Demo TikTok Ads", AccountId = "tt_7891234560", AccessToken = "demo_tt_token", PixelId = "px_12345", Status = "active", LastTestedAt = DateTime.UtcNow.AddDays(-1) },
            new CompanyAdAccount { CompanyId = company.Id, Platform = "youtube", AccountName = "Demo YouTube", AccountId = "yt_demo_123", AccessToken = "demo_yt_token", DeveloperToken = "dev_yt_token", CustomerId = "123-456-7890", Status = "active" },
            new CompanyAdAccount { CompanyId = company.Id, Platform = "google_ads", AccountName = "Demo Google Ads", AccountId = "ga_demo_456", AccessToken = "demo_ga_token", DeveloperToken = "dev_ga_token", CustomerId = "987-654-3210", Status = "expired", LastError = "Token expired on 2026-03-15" }
        );
        await db.SaveChangesAsync();
    }

    // ── 4. Brand Guidelines ──
    if (!await db.BrandGuidelines.AnyAsync(g => g.CompanyId == company.Id))
    {
        db.BrandGuidelines.Add(new BrandGuideline
        {
            CompanyId = company.Id, BrandLabel = "DemoTech Solutions", Tone = "Professional",
            Language = "English", Description = "A cutting-edge AI-powered marketing platform for modern businesses",
            Tagline = "Market Smarter, Not Harder", Whitelist = "innovation\nAI-powered\nsmart\nefficient\ngrowth",
            Blacklist = "cheap\nfree\nguaranteed\n#1\nbest ever", VoiceExamples = "We help businesses grow with intelligent marketing automation.",
            DoList = "Use data-driven language\nFocus on ROI\nHighlight AI capabilities",
            DontList = "Don't use superlatives\nDon't make false promises\nDon't use informal slang",
            Typography = JsonSerializer.Deserialize<JsonElement>("{\"headingFont\":\"Montserrat Bold\",\"headingSize\":\"32px\",\"bodyFont\":\"Inter Regular\",\"bodySize\":\"16px\"}"),
            Palette = new[] { "#0891B2", "#6366F1", "#EC4899", "#F59E0B", "#10B981" },
            CreatedBy = adminUser.Id, LogoUrl = "/assets/logo.png"
        });
        await db.SaveChangesAsync();
    }

    // ── 5. Campaigns (multiple statuses) ──
    var campaignData = new[]
    {
        new { Name = "Summer Sale Blitz 2026", Brief = "Drive massive summer sales across all platforms with eye-catching visuals and compelling offers. Target 18-35 year olds interested in fashion and lifestyle.", Status = "active", ObjIdx = 11, Budget = 5000m, Daily = 200m, Platforms = new[]{"facebook","tiktok"}, Type = "standard" },
        new { Name = "Brand Awareness Q2", Brief = "Build brand recognition among tech professionals. Use thought leadership content and industry insights.", Status = "active", ObjIdx = 0, Budget = 3000m, Daily = 150m, Platforms = new[]{"facebook","youtube"}, Type = "standard" },
        new { Name = "Lead Gen - Enterprise", Brief = "Generate qualified leads for enterprise SaaS product. Focus on decision makers at companies with 500+ employees.", Status = "approved", ObjIdx = 6, Budget = 8000m, Daily = 400m, Platforms = new[]{"facebook","google_ads"}, Type = "standard" },
        new { Name = "TikTok Viral Campaign", Brief = "Create viral TikTok content targeting Gen Z. Focus on authentic, fun, and shareable content.", Status = "pending_review", ObjIdx = 4, Budget = 2000m, Daily = 100m, Platforms = new[]{"tiktok"}, Type = "standard" },
        new { Name = "Holiday Promo 2026", Brief = "Year-end holiday promotion with special discounts and gift bundles. Multi-platform blitz.", Status = "draft", ObjIdx = 8, Budget = 15000m, Daily = 500m, Platforms = new[]{"facebook","tiktok","youtube","google_ads"}, Type = "standard" },
        new { Name = "Retargeting - Cart Abandoners", Brief = "Retarget users who added to cart but didn't purchase. Dynamic product ads with discount incentive.", Status = "active", ObjIdx = 8, Budget = 1500m, Daily = 75m, Platforms = new[]{"facebook"}, Type = "standard" },
        new { Name = "YouTube Pre-Roll Q2", Brief = "15-second non-skippable pre-roll ads showcasing product features and benefits.", Status = "completed", ObjIdx = 2, Budget = 4000m, Daily = 200m, Platforms = new[]{"youtube"}, Type = "standard" },
        new { Name = "Google Search - Brand Terms", Brief = "Protect brand keywords and capture high-intent searches.", Status = "active", ObjIdx = 3, Budget = 2500m, Daily = 100m, Platforms = new[]{"google_ads"}, Type = "standard" },
        new { Name = "A/B Test: Creative Styles", Brief = "Test cinematic vs minimalist creative styles for conversion rate.", Status = "active", ObjIdx = 8, Budget = 3000m, Daily = 150m, Platforms = new[]{"facebook","tiktok"}, Type = "ab_test" },
        new { Name = "App Install Push", Brief = "Drive mobile app installations with engaging short-form video content.", Status = "rejected", ObjIdx = 5, Budget = 6000m, Daily = 300m, Platforms = new[]{"tiktok","facebook"}, Type = "standard" }
    };

    var campaigns = new List<Campaign>();
    foreach (var cd in campaignData)
    {
        if (await db.Campaigns.AnyAsync(c => c.Name == cd.Name && c.CompanyId == company.Id)) continue;
        var camp = new Campaign
        {
            CompanyId = company.Id, Name = cd.Name, Brief = cd.Brief, Status = cd.Status,
            ObjectiveId = objectives.Count > cd.ObjIdx ? objectives[cd.ObjIdx].Id : objectives[0].Id,
            CampaignType = cd.Type, TotalBudget = cd.Budget, DailyBudget = cd.Daily,
            BidStrategy = "lowest_cost", Currency = "USD", Platforms = cd.Platforms,
            StylePreset = new[] { "Cinematic", "Minimalism", "Cyberpunk", "Vintage" }[Random.Shared.Next(4)],
            AspectRatio = new[] { "1:1", "16:9", "9:16" }[Random.Shared.Next(3)],
            StartDate = DateTime.UtcNow.AddDays(-Random.Shared.Next(0, 30)),
            EndDate = DateTime.UtcNow.AddDays(Random.Shared.Next(10, 90)),
            CreatedBy = expertUser.Id,
            ApprovedBy = cd.Status is "approved" or "active" or "completed" ? cmoUser.Id : null,
            ApprovedAt = cd.Status is "approved" or "active" or "completed" ? DateTime.UtcNow.AddDays(-Random.Shared.Next(1, 15)) : null,
            DeployedBy = cd.Status is "active" or "completed" ? pppUser.Id : null,
            DeployedAt = cd.Status is "active" or "completed" ? DateTime.UtcNow.AddDays(-Random.Shared.Next(1, 10)) : null,
            CompletedAt = cd.Status == "completed" ? DateTime.UtcNow.AddDays(-2) : null,
            RejectionReason = cd.Status == "rejected" ? "Budget too high for this objective. Please reduce to under $3000." : null,
            CreatedAt = DateTime.UtcNow.AddDays(-Random.Shared.Next(5, 45))
        };
        db.Campaigns.Add(camp);
        campaigns.Add(camp);
    }
    await db.SaveChangesAsync();

    if (campaigns.Count == 0)
        campaigns = await db.Campaigns.Where(c => c.CompanyId == company.Id).ToListAsync();

    // ── 6. Campaign Workflow Steps ──
    var workflowSteps = new[] { "objective", "targeting", "strategy", "adset_config", "creative", "review", "deploy" };
    foreach (var camp in campaigns)
    {
        if (await db.CampaignWorkflowSteps.AnyAsync(w => w.CampaignId == camp.Id)) continue;
        for (int i = 0; i < workflowSteps.Length; i++)
        {
            var stepStatus = camp.Status switch
            {
                "active" or "completed" => "completed",
                "approved" => i <= 5 ? "completed" : "not_started",
                "pending_review" => i <= 4 ? "completed" : "not_started",
                "draft" => i <= 1 ? "completed" : i == 2 ? "in_progress" : "not_started",
                _ => "not_started"
            };
            db.CampaignWorkflowSteps.Add(new CampaignWorkflowStep
            {
                CampaignId = camp.Id, StepName = workflowSteps[i], StepOrder = i + 1,
                Status = stepStatus, CompletedBy = stepStatus == "completed" ? expertUser.Id : null,
                CompletedAt = stepStatus == "completed" ? DateTime.UtcNow.AddDays(-Random.Shared.Next(1, 20)) : null
            });
        }
    }
    await db.SaveChangesAsync();

    // ── 7. Ad Sets ──
    var adSets = new List<AdSet>();
    foreach (var camp in campaigns.Where(c => c.Status is "active" or "approved" or "completed"))
    {
        if (await db.AdSets.AnyAsync(a => a.CampaignId == camp.Id)) continue;
        for (int i = 1; i <= 2; i++)
        {
            var adSet = new AdSet
            {
                CompanyId = company.Id, CampaignId = camp.Id, Name = $"{camp.Name} - Ad Set {i}",
                Status = camp.Status == "completed" ? "completed" : "active",
                DailyBudget = (camp.DailyBudget ?? 100) / 2, BidStrategy = "lowest_cost",
                OptimizationGoal = "link_clicks", BillingEvent = "IMPRESSIONS",
                StartTime = camp.StartDate, EndTime = camp.EndDate,
                Targeting = JsonSerializer.Deserialize<JsonElement>($"{{\"geo_locations\":{{\"countries\":[\"US\",\"UK\"]}},\"age_min\":18,\"age_max\":{25 + i * 10},\"genders\":[1,2]}}"),
                Placements = JsonSerializer.Deserialize<JsonElement>("{\"facebook\":[\"feed\",\"stories\"],\"tiktok\":[\"for_you\"]}"),
                CreatedBy = expertUser.Id
            };
            db.AdSets.Add(adSet);
            adSets.Add(adSet);
        }
    }
    await db.SaveChangesAsync();

    if (adSets.Count == 0)
        adSets = await db.AdSets.Where(a => a.CompanyId == company.Id).ToListAsync();

    // ── 8. Ads ──
    var adNames = new[] { "Dynamic Lifestyle", "Bold Statement", "Product Showcase", "Testimonial Reel", "Quick Demo", "Before & After" };
    var headlines = new[] { "Transform Your Marketing Today", "AI-Powered Growth Engine", "Smart Ads, Real Results", "Scale Without Limits", "Data-Driven Success", "The Future of Advertising" };
    var descriptions = new[] { "See 3x more conversions with our AI platform", "Join 10,000+ marketers already growing", "Start your free trial today", "No credit card required - get started now", "Trusted by Fortune 500 companies", "Watch our 2-minute demo" };
    var ads = new List<Ad>();

    foreach (var adSet in adSets)
    {
        if (await db.Ads.AnyAsync(a => a.AdSetId == adSet.Id)) continue;
        for (int i = 0; i < 3; i++)
        {
            var ad = new Ad
            {
                CompanyId = company.Id, AdSetId = adSet.Id,
                Name = adNames[Random.Shared.Next(adNames.Length)] + $" v{i + 1}",
                Status = adSet.Status == "completed" ? "paused" : "active",
                Headline = headlines[Random.Shared.Next(headlines.Length)],
                Description = descriptions[Random.Shared.Next(descriptions.Length)],
                CtaType = new[] { "LEARN_MORE", "SHOP_NOW", "SIGN_UP", "BOOK_NOW" }[Random.Shared.Next(4)],
                CtaLink = "https://democompany.com/offer",
                ReviewStatus = "approved", ReviewedBy = cmoUser.Id, ReviewedAt = DateTime.UtcNow.AddDays(-5),
                CreatedBy = expertUser.Id,
                PlatformAdIds = JsonSerializer.Deserialize<JsonElement>($"{{\"facebook\":\"fb_ad_{Random.Shared.Next(100000, 999999)}\",\"tiktok\":\"tt_ad_{Random.Shared.Next(100000, 999999)}\"}}")
            };
            db.Ads.Add(ad);
            ads.Add(ad);
        }
    }
    await db.SaveChangesAsync();

    if (ads.Count == 0) ads = await db.Ads.Where(a => a.CompanyId == company.Id).ToListAsync();

    // ── 9. Ad Creatives ──
    foreach (var ad in ads)
    {
        if (await db.AdCreatives.AnyAsync(c => c.AdId == ad.Id)) continue;
        db.AdCreatives.Add(new AdCreative
        {
            CompanyId = company.Id, AdId = ad.Id,
            CreativeType = Random.Shared.Next(3) == 0 ? "video" : "image",
            AssetUrl = $"/assets/creative_{ad.Id}_{Random.Shared.Next(1000, 9999)}.jpg",
            AssetFilename = $"creative_{ad.Id}.jpg",
            PrimaryText = ad.Description, Headline = ad.Headline,
            CtaType = ad.CtaType, CtaLink = ad.CtaLink,
            Width = 1080, Height = 1080, FileSizeBytes = Random.Shared.Next(200000, 2000000)
        });
    }
    await db.SaveChangesAsync();

    // ── 10. Ad Metrics (30 days of data for active campaigns) ──
    if (!await db.AdMetrics.AnyAsync(m => m.CompanyId == company.Id))
    {
        var activeCampaigns = campaigns.Where(c => c.Status is "active" or "completed").ToList();
        var platforms = new[] { "facebook", "tiktok", "youtube", "google_ads" };

        for (int dayOffset = 29; dayOffset >= 0; dayOffset--)
        {
            var date = DateTime.UtcNow.AddDays(-dayOffset);
            foreach (var camp in activeCampaigns)
            {
                foreach (var platform in camp.Platforms.Where(p => platforms.Contains(p)))
                {
                    var impressions = Random.Shared.Next(2000, 80000);
                    var clicks = (int)(impressions * (Random.Shared.NextDouble() * 0.05 + 0.01));
                    var spend = Math.Round((decimal)(Random.Shared.NextDouble() * (double)(camp.DailyBudget ?? 100) * 0.8 + (double)(camp.DailyBudget ?? 100) * 0.2), 2);
                    var conversions = (int)(clicks * (Random.Shared.NextDouble() * 0.08 + 0.01));
                    var convValue = conversions * Random.Shared.Next(15, 120);

                    db.AdMetrics.Add(new AdMetric
                    {
                        CompanyId = company.Id, CampaignId = camp.Id, Platform = platform, Date = date,
                        Impressions = impressions, Reach = (long)(impressions * 0.85),
                        Clicks = clicks, Spend = spend, Conversions = conversions,
                        ConversionValue = convValue,
                        Ctr = clicks > 0 ? Math.Round((decimal)clicks / impressions, 4) : 0,
                        Cpc = clicks > 0 ? Math.Round(spend / clicks, 4) : 0,
                        Cpm = impressions > 0 ? Math.Round(spend / impressions * 1000, 4) : 0,
                        Roas = spend > 0 ? Math.Round(convValue / spend, 4) : 0,
                        Frequency = Math.Round((decimal)impressions / (impressions * 0.85m), 2),
                        VideoViews = platform is "youtube" or "tiktok" ? Random.Shared.Next(500, 30000) : null,
                        VideoCompletions = platform is "youtube" or "tiktok" ? Random.Shared.Next(100, 10000) : null
                    });
                }
            }
        }
        await db.SaveChangesAsync();
    }

    // ── 11. Deployment Logs ──
    if (!await db.DeploymentLogs.AnyAsync(d => d.CompanyId == company.Id))
    {
        var activeCamps = campaigns.Where(c => c.Status is "active" or "completed").Take(5).ToList();
        var actions = new[] { "upload_media", "create_campaign", "create_adset", "create_creative", "create_ad" };
        foreach (var camp in activeCamps)
        {
            foreach (var platform in camp.Platforms)
            {
                foreach (var action in actions)
                {
                    db.DeploymentLogs.Add(new DeploymentLog
                    {
                        CompanyId = company.Id, CampaignId = camp.Id, Platform = platform, Action = action,
                        PlatformResourceId = $"{platform}_{action}_{Random.Shared.Next(100000, 999999)}",
                        Status = Random.Shared.Next(10) > 0 ? "success" : "failed",
                        DurationMs = Random.Shared.Next(200, 5000),
                        ErrorMessage = Random.Shared.Next(10) == 0 ? "Rate limit exceeded, retrying..." : null,
                        ExecutedBy = pppUser.Id, ExecutedAt = DateTime.UtcNow.AddDays(-Random.Shared.Next(1, 20))
                    });
                }
            }
        }
        await db.SaveChangesAsync();
    }

    // ── 12. CMO Queue ──
    if (!await db.CmoQueue.AnyAsync(q => q.CompanyId == company.Id))
    {
        for (int i = 1; i <= 4; i++)
        {
            db.CmoQueue.Add(new CmoQueueItem
            {
                Id = $"variation_{i}_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}.jpg",
                CompanyId = company.Id,
                CampaignId = campaigns.FirstOrDefault(c => c.Status == "pending_review")?.Id,
                Url = $"/assets/variation_{i}.jpg", Title = $"Creative Variation {i}",
                Type = i == 3 ? "video" : "image", Status = "pending", Priority = i == 1 ? 1 : 0,
                SubmittedBy = expertUser.Id, AddedAt = DateTime.UtcNow.AddHours(-i * 3)
            });
        }
        await db.SaveChangesAsync();
    }

    // ── 13. PPP Queue ──
    if (!await db.PppQueue.AnyAsync(q => q.CompanyId == company.Id))
    {
        for (int i = 1; i <= 3; i++)
        {
            db.PppQueue.Add(new PppQueueItem
            {
                CompanyId = company.Id,
                CampaignId = campaigns.FirstOrDefault(c => c.Status == "approved")?.Id,
                AssetFilename = $"approved_asset_{i}.jpg",
                AssetUrl = $"/library/approved_asset_{i}.jpg", AssetType = i == 2 ? "video" : "image",
                Title = $"Approved Creative {i}", Status = "pending", QueueIndex = i,
                ApprovedBy = cmoUser.Id, ApprovedAt = DateTime.UtcNow.AddDays(-1)
            });
        }
        await db.SaveChangesAsync();
    }

    // ── 14. Approval Comments ──
    if (!await db.ApprovalComments.AnyAsync(c => c.CompanyId == company.Id))
    {
        var pendingCamp = campaigns.FirstOrDefault(c => c.Status == "pending_review");
        var approvedCamp = campaigns.FirstOrDefault(c => c.Status == "approved");
        var rejectedCamp = campaigns.FirstOrDefault(c => c.Status == "rejected");

        if (pendingCamp != null)
        {
            db.ApprovalComments.Add(new ApprovalComment { CompanyId = company.Id, CampaignId = pendingCamp.Id, UserId = expertUser.Id, Comment = "Submitted for review. All creatives follow brand guidelines.", Action = "comment" });
            db.ApprovalComments.Add(new ApprovalComment { CompanyId = company.Id, CampaignId = pendingCamp.Id, UserId = cmoUser.Id, Comment = "Looking good, reviewing the targeting parameters now.", Action = "comment" });
        }
        if (approvedCamp != null)
        {
            db.ApprovalComments.Add(new ApprovalComment { CompanyId = company.Id, CampaignId = approvedCamp.Id, UserId = cmoUser.Id, Comment = "Approved! Great targeting strategy. Budget looks reasonable.", Action = "approve" });
        }
        if (rejectedCamp != null)
        {
            db.ApprovalComments.Add(new ApprovalComment { CompanyId = company.Id, CampaignId = rejectedCamp.Id, UserId = cmoUser.Id, Comment = "Budget too high for this objective. Please reduce to under $3000 and resubmit.", Action = "reject" });
        }
        await db.SaveChangesAsync();
    }

    // ── 15. Notifications ──
    if (!await db.Notifications.AnyAsync(n => n.CompanyId == company.Id))
    {
        var notifs = new[]
        {
            new { UserId = cmoUser.Id, Type = "campaign_submitted", Title = "Campaign Submitted", Message = "TikTok Viral Campaign needs your approval", ResourceType = "campaign" },
            new { UserId = expertUser.Id, Type = "campaign_approved", Title = "Campaign Approved!", Message = "Lead Gen - Enterprise has been approved by CMO", ResourceType = "campaign" },
            new { UserId = expertUser.Id, Type = "campaign_rejected", Title = "Campaign Rejected", Message = "App Install Push was rejected: Budget too high", ResourceType = "campaign" },
            new { UserId = pppUser.Id, Type = "campaign_approved", Title = "Ready for Deployment", Message = "Lead Gen - Enterprise is approved and ready to deploy", ResourceType = "campaign" },
            new { UserId = pppUser.Id, Type = "deploy_success", Title = "Deployment Successful", Message = "Summer Sale Blitz deployed to Facebook & TikTok", ResourceType = "deployment" },
            new { UserId = cmoUser.Id, Type = "budget_alert", Title = "Budget Alert", Message = "Retargeting campaign has used 85% of daily budget", ResourceType = "campaign" },
            new { UserId = adminUser.Id, Type = "system_alert", Title = "Token Expiring", Message = "Google Ads access token expires in 3 days", ResourceType = "company" },
            new { UserId = cmoUser.Id, Type = "campaign_submitted", Title = "New Campaign", Message = "Holiday Promo 2026 draft created by Expert", ResourceType = "campaign" },
            new { UserId = expertUser.Id, Type = "campaign_approved", Title = "Approved!", Message = "Brand Awareness Q2 is now live across platforms", ResourceType = "campaign" },
            new { UserId = pppUser.Id, Type = "deploy_failed", Title = "Deploy Warning", Message = "YouTube pre-roll upload failed: video format error. Retrying...", ResourceType = "deployment" }
        };
        foreach (var n in notifs)
        {
            db.Notifications.Add(new Notification
            {
                CompanyId = company.Id, UserId = n.UserId, Type = n.Type, Title = n.Title,
                Message = n.Message, ResourceType = n.ResourceType,
                IsRead = Random.Shared.Next(3) == 0, CreatedAt = DateTime.UtcNow.AddHours(-Random.Shared.Next(1, 72))
            });
        }
        await db.SaveChangesAsync();
    }

    // ── 16. Invitations ──
    if (!await db.Invitations.AnyAsync(i => i.CompanyId == company.Id))
    {
        var expertRole = await db.Roles.FirstAsync(r => r.Name == "Expert" && r.CompanyId == company.Id);
        var pppRole = await db.Roles.FirstAsync(r => r.Name == "PPP" && r.CompanyId == company.Id);
        db.Invitations.AddRange(
            new Invitation { CompanyId = company.Id, Email = "newexpert@democompany.com", RoleId = expertRole.Id, InvitedBy = adminUser.Id, Token = Guid.NewGuid().ToString("N"), Status = "pending", ExpiresAt = DateTime.UtcNow.AddDays(5) },
            new Invitation { CompanyId = company.Id, Email = "freelancer@agency.com", RoleId = pppRole.Id, InvitedBy = adminUser.Id, Token = Guid.NewGuid().ToString("N"), Status = "accepted", AcceptedAt = DateTime.UtcNow.AddDays(-3), ExpiresAt = DateTime.UtcNow.AddDays(4) },
            new Invitation { CompanyId = company.Id, Email = "expired@old.com", RoleId = expertRole.Id, InvitedBy = adminUser.Id, Token = Guid.NewGuid().ToString("N"), Status = "expired", ExpiresAt = DateTime.UtcNow.AddDays(-2) }
        );
        await db.SaveChangesAsync();
    }

    // ── 17. A/B Tests ──
    if (!await db.AbTests.AnyAsync(t => t.CompanyId == company.Id) && ads.Count >= 4)
    {
        db.AbTests.AddRange(
            new AbTest { CompanyId = company.Id, CampaignId = campaigns.First(c => c.CampaignType == "ab_test").Id, Name = "Cinematic vs Minimalist Creative", VariantAAdId = ads[0].Id, VariantBAdId = ads[1].Id, Metric = "ctr", TrafficSplit = 50, Status = "running", StartedAt = DateTime.UtcNow.AddDays(-7), CreatedBy = expertUser.Id },
            new AbTest { CompanyId = company.Id, CampaignId = campaigns.First(c => c.Status == "completed").Id, Name = "CTA Test: Learn More vs Shop Now", VariantAAdId = ads[2].Id, VariantBAdId = ads[3].Id, Metric = "conversion_rate", TrafficSplit = 50, Status = "completed", Winner = "B", ConfidenceLevel = 94.5m, VariantAResult = 2.3m, VariantBResult = 3.8m, StartedAt = DateTime.UtcNow.AddDays(-21), EndedAt = DateTime.UtcNow.AddDays(-7), CreatedBy = expertUser.Id }
        );
        await db.SaveChangesAsync();
    }

    // ── 18. Budget Allocations ──
    if (!await db.BudgetAllocations.AnyAsync(b => b.CompanyId == company.Id))
    {
        db.BudgetAllocations.AddRange(
            new BudgetAllocation { CompanyId = company.Id, PeriodType = "monthly", PeriodStart = new DateOnly(2026, 3, 1), PeriodEnd = new DateOnly(2026, 3, 31), TotalBudget = 25000, FacebookAllocation = 10000, TiktokAllocation = 8000, YoutubeAllocation = 4000, GoogleAllocation = 3000, SpentToDate = 18750, Status = "active", CreatedBy = cmoUser.Id },
            new BudgetAllocation { CompanyId = company.Id, PeriodType = "monthly", PeriodStart = new DateOnly(2026, 2, 1), PeriodEnd = new DateOnly(2026, 2, 28), TotalBudget = 20000, FacebookAllocation = 8000, TiktokAllocation = 6000, YoutubeAllocation = 3500, GoogleAllocation = 2500, SpentToDate = 19200, Status = "closed", CreatedBy = cmoUser.Id },
            new BudgetAllocation { CompanyId = company.Id, PeriodType = "quarterly", PeriodStart = new DateOnly(2026, 4, 1), PeriodEnd = new DateOnly(2026, 6, 30), TotalBudget = 75000, FacebookAllocation = 30000, TiktokAllocation = 20000, YoutubeAllocation = 15000, GoogleAllocation = 10000, SpentToDate = 0, Status = "active", CreatedBy = cmoUser.Id }
        );
        await db.SaveChangesAsync();
    }

    // ── 19. Activity Logs ──
    if (!await db.ActivityLogs.AnyAsync(a => a.CompanyId == company.Id))
    {
        var logEntries = new[]
        {
            new { UserId = adminUser.Id, Action = "login", ResourceType = "user", Desc = "Admin logged in" },
            new { UserId = expertUser.Id, Action = "created", ResourceType = "campaign", Desc = "Created campaign: Summer Sale Blitz 2026" },
            new { UserId = expertUser.Id, Action = "created", ResourceType = "campaign", Desc = "Created campaign: TikTok Viral Campaign" },
            new { UserId = expertUser.Id, Action = "updated", ResourceType = "campaign", Desc = "Submitted TikTok Viral Campaign for review" },
            new { UserId = cmoUser.Id, Action = "approved", ResourceType = "campaign", Desc = "Approved: Lead Gen - Enterprise" },
            new { UserId = cmoUser.Id, Action = "rejected", ResourceType = "campaign", Desc = "Rejected: App Install Push (budget too high)" },
            new { UserId = pppUser.Id, Action = "deployed", ResourceType = "campaign", Desc = "Deployed Summer Sale Blitz to Facebook & TikTok" },
            new { UserId = pppUser.Id, Action = "deployed", ResourceType = "campaign", Desc = "Deployed Brand Awareness Q2 to Facebook & YouTube" },
            new { UserId = adminUser.Id, Action = "updated", ResourceType = "guideline", Desc = "Updated brand guidelines: added new blacklist terms" },
            new { UserId = adminUser.Id, Action = "created", ResourceType = "user", Desc = "Invited newexpert@democompany.com as Expert" },
            new { UserId = cmoUser.Id, Action = "updated", ResourceType = "budget", Desc = "Set Q2 budget allocation: $75,000 across 4 platforms" },
            new { UserId = superAdmin!.Id, Action = "created", ResourceType = "company", Desc = "Created company: TechStart Inc" },
            new { UserId = superAdmin.Id, Action = "impersonated", ResourceType = "company", Desc = "Super Admin entered Demo Company context" }
        };
        for (int i = 0; i < logEntries.Length; i++)
        {
            var entry = logEntries[i];
            db.ActivityLogs.Add(new ActivityLog
            {
                CompanyId = entry.UserId == superAdmin.Id ? null : company.Id,
                UserId = entry.UserId, Action = entry.Action, ResourceType = entry.ResourceType,
                Description = entry.Desc, IpAddress = "192.168.0." + Random.Shared.Next(1, 255),
                CreatedAt = DateTime.UtcNow.AddHours(-(logEntries.Length - i) * 4)
            });
        }
        await db.SaveChangesAsync();
    }

    // ── 20. Campaign Templates ──
    if (!await db.CampaignTemplates.AnyAsync(t => t.CompanyId == company.Id))
    {
        db.CampaignTemplates.AddRange(
            new CampaignTemplate { CompanyId = company.Id, Name = "E-Commerce Sale Template", Description = "Pre-configured for flash sales with high-intent targeting", ObjectiveId = objectives.FirstOrDefault(o => o.Name == "Sales")?.Id, Platforms = new[] { "facebook", "tiktok" }, CreatedBy = expertUser.Id, UseCount = 5 },
            new CampaignTemplate { CompanyId = company.Id, Name = "Lead Gen B2B Template", Description = "Enterprise lead generation with LinkedIn-style targeting", ObjectiveId = objectives.FirstOrDefault(o => o.Name == "Lead Generation")?.Id, Platforms = new[] { "facebook", "google_ads" }, CreatedBy = expertUser.Id, UseCount = 3 },
            new CampaignTemplate { IsGlobal = true, Name = "Brand Awareness Starter", Description = "Great for new brands. Broad targeting with video content.", ObjectiveId = objectives.FirstOrDefault(o => o.Name == "Brand Awareness")?.Id, Platforms = new[] { "facebook", "youtube", "tiktok" }, CreatedBy = superAdmin.Id, UseCount = 12 }
        );
        await db.SaveChangesAsync();
    }

    // ── 21. Audience Templates ──
    if (!await db.AudienceTemplates.AnyAsync(t => t.CompanyId == company.Id))
    {
        db.AudienceTemplates.AddRange(
            new AudienceTemplate { CompanyId = company.Id, Name = "Gen Z Fashion Enthusiasts", Description = "18-25, interested in fashion, style, and trends", Targeting = JsonSerializer.Deserialize<JsonElement>("{\"age_min\":18,\"age_max\":25,\"genders\":[1,2],\"interests\":[\"fashion\",\"style\",\"trends\"],\"geo_locations\":{\"countries\":[\"US\",\"UK\"]}}"), EstimatedSize = 3500000, CreatedBy = expertUser.Id, UseCount = 4 },
            new AudienceTemplate { CompanyId = company.Id, Name = "Tech Decision Makers 35+", Description = "35-55 professionals interested in technology and business", Targeting = JsonSerializer.Deserialize<JsonElement>("{\"age_min\":35,\"age_max\":55,\"genders\":[1,2],\"interests\":[\"technology\",\"business\",\"SaaS\"],\"geo_locations\":{\"countries\":[\"US\"]}}"), EstimatedSize = 1200000, CreatedBy = expertUser.Id, UseCount = 7 }
        );
        await db.SaveChangesAsync();
    }

    // ── 22. Asset Library ──
    if (!await db.AssetLibrary.AnyAsync(a => a.CompanyId == company.Id))
    {
        var assetNames = new[] { "hero_banner_summer.jpg", "product_showcase_01.jpg", "lifestyle_photo_02.jpg", "promo_video_30s.mp4", "carousel_slide_01.jpg", "carousel_slide_02.jpg", "tiktok_vertical.mp4", "story_ad_template.jpg", "youtube_thumbnail.jpg", "google_display_300x250.jpg" };
        foreach (var name in assetNames)
        {
            var isVideo = name.EndsWith(".mp4");
            db.AssetLibrary.Add(new AssetLibraryItem
            {
                CompanyId = company.Id, Filename = name, OriginalName = name,
                FilePath = $"/Assets/{name}", FileUrl = $"/assets/{name}",
                FileType = isVideo ? "video" : "image", MimeType = isVideo ? "video/mp4" : "image/jpeg",
                FileSizeBytes = Random.Shared.Next(100000, isVideo ? 50000000 : 5000000),
                Width = isVideo ? 1920 : 1080, Height = isVideo ? 1080 : 1080,
                DurationSeconds = isVideo ? Random.Shared.Next(15, 60) : null,
                Folder = Random.Shared.Next(2) == 0 ? "assets" : "library",
                Tags = new[] { "campaign", isVideo ? "video" : "photo", "2026" },
                Status = "active", UploadedBy = expertUser.Id
            });
        }
        await db.SaveChangesAsync();
    }

    // ── 23. Refresh Tokens (sample) ──
    if (!await db.RefreshTokens.AnyAsync())
    {
        db.RefreshTokens.Add(new RefreshToken { UserId = adminUser.Id, Token = Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N"), ExpiresAt = DateTime.UtcNow.AddDays(7), IpAddress = "192.168.0.100", UserAgent = "Mozilla/5.0 Chrome/120" });
        await db.SaveChangesAsync();
    }

    // Count everything
    var counts = new
    {
        companies = await db.Companies.CountAsync(),
        company_settings = await db.CompanySettings.CountAsync(),
        company_ad_accounts = await db.CompanyAdAccounts.CountAsync(),
        users = await db.Users.CountAsync(),
        roles = await db.Roles.CountAsync(),
        screens = await db.Screens.CountAsync(),
        role_screens = await db.RoleScreens.CountAsync(),
        brand_guidelines = await db.BrandGuidelines.CountAsync(),
        campaign_objectives = await db.CampaignObjectives.CountAsync(),
        campaigns = await db.Campaigns.CountAsync(),
        campaign_workflow_steps = await db.CampaignWorkflowSteps.CountAsync(),
        ad_sets = await db.AdSets.CountAsync(),
        ads = await db.Ads.CountAsync(),
        ad_creatives = await db.AdCreatives.CountAsync(),
        ad_metrics = await db.AdMetrics.CountAsync(),
        deployment_logs = await db.DeploymentLogs.CountAsync(),
        cmo_queue = await db.CmoQueue.CountAsync(),
        ppp_queue = await db.PppQueue.CountAsync(),
        approval_comments = await db.ApprovalComments.CountAsync(),
        notifications = await db.Notifications.CountAsync(),
        invitations = await db.Invitations.CountAsync(),
        ab_tests = await db.AbTests.CountAsync(),
        budget_allocations = await db.BudgetAllocations.CountAsync(),
        activity_logs = await db.ActivityLogs.CountAsync(),
        campaign_templates = await db.CampaignTemplates.CountAsync(),
        audience_templates = await db.AudienceTemplates.CountAsync(),
        asset_library = await db.AssetLibrary.CountAsync(),
        refresh_tokens = await db.RefreshTokens.CountAsync()
    };

    return Results.Ok(new { message = "All 28 tables seeded with dummy data!", counts });
});

// ══════════════════════════════════════════════════
// TASK 74: BRAND COMPLIANCE CHECK
// ══════════════════════════════════════════════════

app.MapPost("/api/compliance/check", async (HttpContext ctx, BrandComplianceService complianceService, HttpRequest request) =>
{
    var companyId = ctx.GetRequiredCompanyId();
    using var reader = new StreamReader(request.Body);
    var json = await reader.ReadToEndAsync();
    var req = JsonSerializer.Deserialize<JsonElement>(json);
    var headline = req.TryGetProperty("headline", out var h) ? h.GetString() : null;
    var description = req.TryGetProperty("description", out var d) ? d.GetString() : null;
    var primaryText = req.TryGetProperty("primaryText", out var p) ? p.GetString() : null;
    var result = await complianceService.CheckCompliance(companyId, headline, description, primaryText);
    return Results.Ok(result);
});

// ══════════════════════════════════════════════════
// TASK 17: PER-COMPANY ASSET FOLDERS
// ══════════════════════════════════════════════════

app.MapGet("/api/assets/company/{companyId}", (int companyId) =>
{
    var companyAssetsFolder = Path.Combine(AssetsFolder, companyId.ToString());
    if (!Directory.Exists(companyAssetsFolder)) Directory.CreateDirectory(companyAssetsFolder);
    var files = Directory.GetFiles(companyAssetsFolder)
        .Select(f => { var fn = Path.GetFileName(f); return new { name = fn, id = fn, url = $"/assets/{companyId}/{Uri.EscapeDataString(fn)}", type = Path.GetExtension(f).ToLower() == ".mp4" ? "video" : "image" }; });
    return Results.Ok(files);
});

app.MapGet("/api/assets-library/company/{companyId}", (int companyId) =>
{
    var companyLibFolder = Path.Combine(LibraryFolder, companyId.ToString());
    if (!Directory.Exists(companyLibFolder)) Directory.CreateDirectory(companyLibFolder);
    var files = Directory.GetFiles(companyLibFolder)
        .Select(f => { var fn = Path.GetFileName(f); return new { name = fn, id = fn, url = $"/library/{companyId}/{Uri.EscapeDataString(fn)}", type = Path.GetExtension(f).ToLower() == ".mp4" ? "video" : "image" }; });
    return Results.Ok(files);
});

app.Run();
