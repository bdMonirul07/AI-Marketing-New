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
builder.Services.AddHostedService<MetricsFetchService>();

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
    var user = await db.Users
        .Include(u => u.Role)
        .Include(u => u.Company)
        .FirstOrDefaultAsync(u => u.Email!.ToLower() == req.Email.ToLower());

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
        totalSpend = await db.AdMetrics.SumAsync(m => m.Spend),
        topCompanies = await db.Companies.Where(c => c.Status == "active")
            .Select(c => new { c.Id, c.Name, Campaigns = db.Campaigns.Count(ca => ca.CompanyId == c.Id), Users = db.Users.Count(u => u.CompanyId == c.Id) })
            .OrderByDescending(c => c.Campaigns).Take(5).ToListAsync()
    });
});

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
        var superAdminScreenNames = new[] { "GlobalDashboard", "CompanyManagement", "SystemConfig", "AuditLog" };
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
        var superAdminScreenNames = new[] { "GlobalDashboard", "CompanyManagement", "SystemConfig", "AuditLog" };
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
    if (!ctx.IsSuperAdmin())
    {
        var targetUser = await db.Users.FindAsync(userId);
        if (targetUser == null) return Results.NotFound();
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
    if (!ctx.IsSuperAdmin() && targetUser.CompanyId != ctx.GetCompanyId()) return Results.Forbid();
    var screenIds = req.ScreenIds;
    // Non-super-admins cannot grant super-admin-only screens
    if (!ctx.IsSuperAdmin())
    {
        var superAdminScreenNames = new[] { "GlobalDashboard", "CompanyManagement", "SystemConfig", "AuditLog" };
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
        new() { Name = "AuditLog", DisplayName = "Audit Log", Category = "super", Icon = "📋", SortOrder = 53 }
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
        .Select(c => new { c.Id, c.Name, c.Status, c.TotalBudget, c.DailyBudget, c.Platforms, c.CampaignType, c.Brief, c.StylePreset, c.AspectRatio, c.CreatedAt, c.StartDate, c.EndDate,
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
    // Notify Expert and PPP
    var users = await db.Users.Include(u => u.Role).Where(u => u.CompanyId == campaign.CompanyId && (u.Role!.Name == "Expert" || u.Role!.Name == "PPP")).ToListAsync();
    foreach (var u in users)
        db.Notifications.Add(new Notification { CompanyId = campaign.CompanyId, UserId = u.Id, Type = "campaign_approved", Title = "Campaign Approved", Message = $"Campaign '{campaign.Name}' has been approved", ResourceType = "campaign", ResourceId = campaign.Id });
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Campaign approved" });
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
    // Return in frontend-friendly format: { id, url, type, title }
    return Results.Ok(items.Select(i => new {
        id = i.AssetFilename,
        url = i.AssetUrl,
        type = i.AssetType,
        title = i.Title ?? i.AssetFilename
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

    // Replace entire queue for this company
    var existing = await db.PppQueue.Where(q => q.CompanyId == companyId).ToListAsync();
    db.PppQueue.RemoveRange(existing);

    var newItems = rawItems.Select((el, i) => new PppQueueItem
    {
        CompanyId = companyId,
        AssetFilename = GetStr(el, "id") ?? GetStr(el, "assetFilename") ?? "",
        AssetUrl = GetStr(el, "url") ?? GetStr(el, "assetUrl") ?? "",
        AssetType = GetStr(el, "type") ?? GetStr(el, "assetType") ?? "image",
        Title = GetStr(el, "title"),
        QueueIndex = i
    }).Where(i => !string.IsNullOrEmpty(i.AssetFilename)).ToList();

    db.PppQueue.AddRange(newItems);
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

    var existing = await db.PppQueue.Where(q => q.CompanyId == companyId).ToListAsync();
    db.PppQueue.RemoveRange(existing);

    var newItems = rawItems.Select((el, i) => new PppQueueItem
    {
        CompanyId = companyId,
        AssetFilename = GetStr2(el, "id") ?? GetStr2(el, "assetFilename") ?? "",
        AssetUrl = GetStr2(el, "url") ?? GetStr2(el, "assetUrl") ?? "",
        AssetType = GetStr2(el, "type") ?? GetStr2(el, "assetType") ?? "image",
        Title = GetStr2(el, "title"),
        QueueIndex = i
    }).Where(i => !string.IsNullOrEmpty(i.AssetFilename)).ToList();

    db.PppQueue.AddRange(newItems);
    await db.SaveChangesAsync();
    return Results.Ok();
});

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
    var metrics = db.AdMetrics.Where(m => m.CompanyId == companyId);
    return Results.Ok(new
    {
        totalSpend = await metrics.SumAsync(m => m.Spend),
        totalImpressions = await metrics.SumAsync(m => m.Impressions),
        totalClicks = await metrics.SumAsync(m => m.Clicks),
        totalConversions = await metrics.SumAsync(m => m.Conversions),
        avgCtr = await metrics.AverageAsync(m => (decimal?)m.Ctr) ?? 0,
        avgCpc = await metrics.AverageAsync(m => (decimal?)m.Cpc) ?? 0,
        avgRoas = await metrics.AverageAsync(m => (decimal?)m.Roas) ?? 0,
        activeCampaigns = await db.Campaigns.CountAsync(c => c.CompanyId == companyId && c.Status == "active")
    });
});

app.MapGet("/api/analytics/campaigns/{id}/metrics", async (AppDbContext db, HttpContext ctx, int id, string? platform, int days = 30) =>
{
    var since = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-days));
    var query = db.AdMetrics.Where(m => m.CampaignId == id && m.Date >= since);
    if (!string.IsNullOrEmpty(platform)) query = query.Where(m => m.Platform == platform);
    return Results.Ok(await query.OrderBy(m => m.Date).ToListAsync());
});

app.MapGet("/api/analytics/platforms", async (AppDbContext db, HttpContext ctx) =>
{
    var companyId = ctx.GetRequiredCompanyId();
    var data = await db.AdMetrics.Where(m => m.CompanyId == companyId)
        .GroupBy(m => m.Platform)
        .Select(g => new { Platform = g.Key, TotalSpend = g.Sum(m => m.Spend), TotalClicks = g.Sum(m => m.Clicks), TotalImpressions = g.Sum(m => m.Impressions), AvgCtr = g.Average(m => m.Ctr), AvgRoas = g.Average(m => m.Roas) })
        .ToListAsync();
    return Results.Ok(data);
});

app.MapGet("/api/analytics/top-performers", async (AppDbContext db, HttpContext ctx) =>
{
    var companyId = ctx.GetRequiredCompanyId();
    var data = await db.AdMetrics.Where(m => m.CompanyId == companyId)
        .GroupBy(m => m.CampaignId)
        .Select(g => new { CampaignId = g.Key, TotalSpend = g.Sum(m => m.Spend), TotalConversions = g.Sum(m => m.Conversions), AvgRoas = g.Average(m => m.Roas) })
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

app.MapPost("/api/deploy/facebook", async (FacebookDeployRequest req, FacebookAdsService fbService) =>
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

        string campaignId = "", adSetId = "", creativeId = "", adId = "";
        string? campaignError = null, adSetError = null, creativeError = null, adError = null;
        bool campaignReal = false, adSetReal = false, creativeReal = false, adReal = false;

        try { var s = await fbService.CreateCampaignAsync(req.campaign.name, req.campaign.objective, req.campaign.status); campaignId = ExtractId(JsonSerializer.Deserialize<JsonElement>(s)); campaignReal = true; } catch (Exception ex) { campaignError = ex.Message; campaignId = $"mock_camp_{Guid.NewGuid().ToString()[..8]}"; }
        if (campaignReal) { try { var s = await fbService.CreateAdSetAsync(campaignId, req.adSet.name, req.adSet.daily_budget, req.adSet.status, JsonSerializer.Serialize(req.adSet.targeting)); adSetId = ExtractId(JsonSerializer.Deserialize<JsonElement>(s)); adSetReal = true; } catch (Exception ex) { adSetError = ex.Message; adSetId = $"mock_adset_{Guid.NewGuid().ToString()[..8]}"; } }
        try { var s = await fbService.CreateAdCreativeAsync(req.creative.name, req.creative.object_story_spec.page_id, req.creative.object_story_spec.link_data.message, req.creative.object_story_spec.link_data.link, mediaId, isVideo, req.creative.object_story_spec.link_data.name); creativeId = ExtractId(JsonSerializer.Deserialize<JsonElement>(s)); creativeReal = true; } catch (Exception ex) { creativeError = ex.Message; creativeId = $"mock_creative_{Guid.NewGuid().ToString()[..8]}"; }
        if (adSetReal && creativeReal) { try { var s = await fbService.CreateAdAsync($"Ad_{req.campaign.name}", adSetId, creativeId, req.campaign.status ?? "PAUSED"); adId = ExtractId(JsonSerializer.Deserialize<JsonElement>(s)); adReal = true; } catch (Exception ex) { adError = ex.Message; adId = $"mock_ad_{Guid.NewGuid().ToString()[..8]}"; } }

        return Results.Ok(new { success = mediaReal && campaignReal && adSetReal && creativeReal && adReal, network = "Facebook",
            steps = new[] { new { label = isVideo ? "Video Upload" : "Image Upload", id = mediaId, real = mediaReal, error = mediaError }, new { label = "Campaign", id = campaignId, real = campaignReal, error = campaignError }, new { label = "Ad Set", id = adSetId, real = adSetReal, error = adSetError }, new { label = "Creative", id = creativeId, real = creativeReal, error = creativeError }, new { label = "Ad", id = adId, real = adReal, error = adError } } });
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

app.MapPost("/api/seed/dummy-data", async (AppDbContext db) =>
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
            new CompanyAdAccount { CompanyId = company.Id, Platform = "facebook", AccountName = "Demo FB Ads", AccountId = "act_2537893049860881", AccessToken = "demo_fb_token", PageId = "792318557298112", Status = "active", LastTestedAt = DateTime.UtcNow.AddHours(-2) },
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
            var date = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-dayOffset));
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

