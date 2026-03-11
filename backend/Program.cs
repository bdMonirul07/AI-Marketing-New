using System.Collections.Concurrent;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using Backend.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;
using System.Text;
using System.IdentityModel.Tokens.Jwt;

const string GuidelinesFile = "brand_guidelines.json";
const string CampaignsFile = "campaigns.json";
const string CmoQueueFile = "cmo_queue.json";
const string PpcQueueFile = "ppc_queue.json";
const string AssetsFolder = "Assets";
const string LibraryFolder = "Assets Library";

// Singleton HttpClient and Cache for AI responses
var httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
var aiCache = new ConcurrentDictionary<string, string[]>();

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddHttpClient<FacebookAdsService>();

// JWT Configuration
var jwtKey = builder.Configuration["Jwt:Key"] ?? "default_secret_key_at_least_32_chars_long";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "MarketingAIBackend";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "MarketingAIFronend";

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
    });

builder.Services.AddAuthorization();
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll",
        builder =>
        {
            builder.AllowAnyOrigin()
                   .AllowAnyMethod()
                   .AllowAnyHeader();
        });
});

var app = builder.Build();

// Ensure database is created
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("AllowAll");
app.UseAuthentication();
app.UseAuthorization();

if (!Directory.Exists(AssetsFolder))
{
    Directory.CreateDirectory(AssetsFolder);
}

if (!Directory.Exists(LibraryFolder))
{
    Directory.CreateDirectory(LibraryFolder);
}

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
// app.UseHttpsRedirection();

// --- Auth Endpoints ---
app.MapPost("/api/auth/register", async (AppDbContext db, RegisterRequest req) =>
{
    if (await db.Users.AnyAsync(u => u.Username == req.Username))
        return Results.BadRequest(new { message = "Username already exists" });

    var user = new User
    {
        Username = req.Username,
        Email = req.Email,
        RoleId = req.RoleId,
        PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
        CreatedAt = DateTime.UtcNow
    };

    db.Users.Add(user);
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "User registered successfully" });
});

app.MapPost("/api/auth/login", async (AppDbContext db, IConfiguration config, LoginRequest req) =>
{
    var user = await db.Users
        .Include(u => u.Role)
        .FirstOrDefaultAsync(u => u.Username!.ToLower() == req.Username.ToLower());

    if (user == null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
        return Results.Unauthorized();

    var roleName = user.Role?.Name ?? "User";
    
    // Fetch screens for this role
    var screens = await db.RoleScreens
        .Where(rs => rs.RoleId == user.RoleId)
        .Select(rs => rs.Screen!.Name)
        .ToListAsync();

    var jwtKey = config["Jwt:Key"] ?? "default_secret_key_at_least_32_chars_long";
    var jwtIssuer = config["Jwt:Issuer"] ?? "MarketingAIBackend";
    var jwtAudience = config["Jwt:Audience"] ?? "MarketingAIFronend";

    var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
    var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

    var claims = new[]
    {
        new Claim(ClaimTypes.Name, user.Username!),
        new Claim(ClaimTypes.Role, roleName),
        new Claim(JwtRegisteredClaimNames.Sub, user.Username!)
    };

    var token = new JwtSecurityToken(
        issuer: jwtIssuer,
        audience: jwtAudience,
        claims: claims,
        expires: DateTime.Now.AddHours(8),
        signingCredentials: credentials);

    return Results.Ok(new { 
        token = new JwtSecurityTokenHandler().WriteToken(token),
        user = new { 
            user.Username, 
            Role = roleName, 
            user.Email,
            Screens = screens
        }
    });
});



// --- RBAC Endpoints ---
app.MapGet("/api/rbac/roles", async (AppDbContext db) => await db.Roles.ToListAsync());

app.MapGet("/api/rbac/screens", async (AppDbContext db) => await db.Screens.ToListAsync());

app.MapGet("/api/rbac/users", async (AppDbContext db) => 
{
    var users = await db.Users
        .Include(u => u.Role)
        .OrderByDescending(u => u.CreatedAt)
        .Select(u => new { 
            u.Id, 
            u.Username, 
            u.Email, 
            Role = u.Role != null ? new { u.Role.Id, u.Role.Name } : null,
            u.CreatedAt 
        })
        .ToListAsync();
    return Results.Ok(users);
});

app.MapDelete("/api/rbac/users/{id}", async (AppDbContext db, int id) =>
{
    var user = await db.Users.FindAsync(id);
    if (user == null) return Results.NotFound();

    db.Users.Remove(user);
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "User access revoked" });
});

// Role Management
app.MapPost("/api/rbac/roles", async (AppDbContext db, Role role) =>
{
    if (string.IsNullOrWhiteSpace(role.Name)) return Results.BadRequest("Role name required");
    db.Roles.Add(role);
    await db.SaveChangesAsync();
    return Results.Created($"/api/rbac/roles/{role.Id}", role);
});

app.MapPut("/api/rbac/roles/{id}", async (AppDbContext db, int id, Role updatedRole) =>
{
    var role = await db.Roles.FindAsync(id);
    if (role == null) return Results.NotFound();
    role.Name = updatedRole.Name;
    await db.SaveChangesAsync();
    return Results.Ok(role);
});

app.MapDelete("/api/rbac/roles/{id}", async (AppDbContext db, int id) =>
{
    var role = await db.Roles.FindAsync(id);
    if (role == null) return Results.NotFound();
    
    // Prevent deleting system roles if needed, or handle cascade
    db.Roles.Remove(role);
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Role decommissioning complete" });
});

// Permission Matrix
app.MapGet("/api/rbac/role-permissions/{roleId}", async (AppDbContext db, int roleId) =>
{
    var screenIds = await db.RoleScreens
        .Where(rs => rs.RoleId == roleId)
        .Select(rs => rs.ScreenId)
        .ToListAsync();
    return Results.Ok(screenIds);
});

app.MapPost("/api/rbac/role-permissions", async (AppDbContext db, RolePermissionsRequest req) =>
{
    // Clear old perms
    var old = db.RoleScreens.Where(rs => rs.RoleId == req.RoleId);
    db.RoleScreens.RemoveRange(old);
    
    // Add new ones
    foreach (var sid in req.ScreenIds)
    {
        db.RoleScreens.Add(new RoleScreen { RoleId = req.RoleId, ScreenId = sid });
    }
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Permissions synchronized" });
});




app.MapPost("/api/rbac/seed", async (AppDbContext db) =>
{
    // Clear existing to ensure clean seed
    db.RoleScreens.RemoveRange(db.RoleScreens);
    db.Screens.RemoveRange(db.Screens);
    db.Users.RemoveRange(db.Users);
    db.Roles.RemoveRange(db.Roles);
    await db.SaveChangesAsync();

    var roles = new List<Role>
    {
        new Role { Name = "Admin" },
        new Role { Name = "CMO" },
        new Role { Name = "PPC" },
        new Role { Name = "Expert" }
    };
    db.Roles.AddRange(roles);
    await db.SaveChangesAsync();

    var screens = new List<Screen>
    {
        new Screen { Name = "Dashboard", DisplayName = "Dashboard" },
        // Marketing Expert Screens
        new Screen { Name = "Objective", DisplayName = "Campaign Objective" },
        new Screen { Name = "Targeting", DisplayName = "Target Audience" },
        new Screen { Name = "Research", DisplayName = "Strategy Hub" },
        new Screen { Name = "CreativeConfig", DisplayName = "Creative Config" },
        new Screen { Name = "Studio", DisplayName = "Creative Studio" },
        // CMO Screens
        new Screen { Name = "BudgetMatrix", DisplayName = "Budget & Matrix" },
        new Screen { Name = "Approvals", DisplayName = "Ad Approvals" },
        new Screen { Name = "Monitoring", DisplayName = "AI Monitoring" },
        new Screen { Name = "Budget", DisplayName = "Budget Overview" },
        new Screen { Name = "Notifications", DisplayName = "Notifications" },
        // PPC Screens
        new Screen { Name = "ApprovedAssets", DisplayName = "Approved Assets" },
        new Screen { Name = "DeploySelection", DisplayName = "Platform Selection" },
        // Admin Screens
        new Screen { Name = "UserManagement", DisplayName = "User Management" },
        new Screen { Name = "RoleManagement", DisplayName = "Role Management" },
        new Screen { Name = "CompanyProfile", DisplayName = "Company Profile" },
        new Screen { Name = "Config", DisplayName = "Platform Config" },
        new Screen { Name = "Calendar", DisplayName = "Global Calendar" },
        new Screen { Name = "Guideline", DisplayName = "Brand Guideline" },
        new Screen { Name = "Assets", DisplayName = "Creative Assets" }
    };
    db.Screens.AddRange(screens);
    await db.SaveChangesAsync();

    // Map Roles to Screens (Initial Setup)
    // Admin gets everything
    foreach (var s in screens) {
        db.RoleScreens.Add(new RoleScreen { RoleId = roles[0].Id, ScreenId = s.Id });
    }

    // CMO
    var cmoScreens = new[] { "Dashboard", "BudgetMatrix", "Approvals", "Monitoring", "Budget", "Notifications" };
    foreach (var s in screens.Where(x => cmoScreens.Contains(x.Name))) {
        db.RoleScreens.Add(new RoleScreen { RoleId = roles[1].Id, ScreenId = s.Id });
    }

    // PPC
    var ppcScreens = new[] { "Dashboard", "ApprovedAssets", "DeploySelection", "Monitoring", "Budget" };
    foreach (var s in screens.Where(x => ppcScreens.Contains(x.Name))) {
        db.RoleScreens.Add(new RoleScreen { RoleId = roles[2].Id, ScreenId = s.Id });
    }

    // Expert
    var expertScreens = new[] { "Dashboard", "Objective", "Targeting", "Research", "CreativeConfig", "Studio" };
    foreach (var s in screens.Where(x => expertScreens.Contains(x.Name))) {
        db.RoleScreens.Add(new RoleScreen { RoleId = roles[3].Id, ScreenId = s.Id });
    }

    await db.SaveChangesAsync();

    // Seed initial users
    db.Users.Add(new User { Username = "admin", RoleId = roles[0].Id, PasswordHash = BCrypt.Net.BCrypt.HashPassword("123456") });
    db.Users.Add(new User { Username = "cmo", RoleId = roles[1].Id, PasswordHash = BCrypt.Net.BCrypt.HashPassword("123456") });
    db.Users.Add(new User { Username = "ppc", RoleId = roles[2].Id, PasswordHash = BCrypt.Net.BCrypt.HashPassword("123456") });
    db.Users.Add(new User { Username = "expert", RoleId = roles[3].Id, PasswordHash = BCrypt.Net.BCrypt.HashPassword("123456") });
    await db.SaveChangesAsync();

    return Results.Ok("Seeding successful and synchronized");
});

app.MapGet("/api/guidelines", async (AppDbContext db) =>
{

    var guideline = await db.BrandGuidelines.OrderByDescending(g => g.UpdatedAt).FirstOrDefaultAsync();
    if (guideline == null) return Results.NotFound();
    return Results.Ok(guideline);
});

app.MapPost("/api/guidelines", async (AppDbContext db, HttpRequest request) =>
{
    using var reader = new StreamReader(request.Body);
    var json = await reader.ReadToEndAsync();
    var newGuideline = JsonSerializer.Deserialize<BrandGuideline>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
    
    if (newGuideline == null) return Results.BadRequest("Invalid data");
    
    newGuideline.UpdatedAt = DateTime.UtcNow;
    db.BrandGuidelines.Add(newGuideline);
    await db.SaveChangesAsync();
    return Results.Ok();
});

app.MapPost("/api/campaigns", async (AppDbContext db, HttpRequest request) =>
{
    using var reader = new StreamReader(request.Body);
    var json = await reader.ReadToEndAsync();
    var campaign = JsonSerializer.Deserialize<Campaign>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
    
    if (campaign == null) return Results.BadRequest("Invalid data");
    
    campaign.Timestamp = DateTime.UtcNow;
    db.Campaigns.Add(campaign);
    await db.SaveChangesAsync();
    return Results.Ok();
});

app.MapGet("/api/campaigns", async (AppDbContext db) =>
{
    var campaigns = await db.Campaigns.OrderByDescending(c => c.Timestamp).ToListAsync();
    return Results.Ok(campaigns);
});

app.MapGet("/api/cmo/queue", async (AppDbContext db) =>
{
    var queue = await db.CmoQueue.ToListAsync();
    return Results.Ok(queue);
});

app.MapPost("/api/cmo/queue", async (AppDbContext db, HttpRequest request) =>
{
    using var reader = new StreamReader(request.Body);
    var json = await reader.ReadToEndAsync();
    var items = JsonSerializer.Deserialize<List<CmoQueueItem>>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
    
    if (items == null) return Results.BadRequest("Invalid data");

    // Replace entire queue for now (Sync logic)
    var currentQueue = await db.CmoQueue.ToListAsync();
    db.CmoQueue.RemoveRange(currentQueue);
    db.CmoQueue.AddRange(items);
    
    await db.SaveChangesAsync();
    return Results.Ok();
});

app.MapGet("/api/ppc/queue", async () =>
{
    // For now, PPC queue remains in JSON or just return empty if not fully transitioned
    if (!File.Exists(PpcQueueFile))
    {
        return Results.Ok(new List<object>());
    }
    var json = await File.ReadAllTextAsync(PpcQueueFile);
    return Results.Text(json, "application/json");
});

app.MapPost("/api/ppc/queue", async (HttpRequest request) =>
{
    using var reader = new StreamReader(request.Body);
    var json = await reader.ReadToEndAsync();
    await File.WriteAllTextAsync(PpcQueueFile, json);
    return Results.Ok();
});



app.MapPost("/api/assets/save-url", async (SaveAssetRequest req) =>
{
    try 
    {
        var httpClient = new HttpClient();
        var response = await httpClient.GetAsync(req.Url);
        if (!response.IsSuccessStatusCode) return Results.BadRequest("Failed to fetch image");

        var extension = ".jpg"; // Simplified default
        var filePath = Path.Combine(AssetsFolder, req.Filename + extension);
        
        var bytes = await response.Content.ReadAsByteArrayAsync();
        await File.WriteAllBytesAsync(filePath, bytes);
        
        return Results.Ok(new { path = filePath });
    }
    catch (Exception ex)
    {
        return Results.Problem(ex.Message);
    }
});

app.MapGet("/api/assets", () =>
{
    var files = Directory.GetFiles(AssetsFolder)
                         .Select(f => {
                             var fileName = Path.GetFileName(f);
                             return new { 
                                 name = fileName,
                                 id = fileName,
                                 url = $"/assets/{Uri.EscapeDataString(fileName)}",
                                 type = Path.GetExtension(f).ToLower() == ".mp4" ? "video" : "image"
                             };
                         });
    return Results.Ok(files);
});

app.MapGet("/api/assets-library", () =>
{
    var files = Directory.GetFiles(LibraryFolder)
                         .Select(f => {
                             var fileName = Path.GetFileName(f);
                             return new { 
                                 name = fileName,
                                 id = fileName,
                                 url = $"/library/{Uri.EscapeDataString(fileName)}",
                                 type = Path.GetExtension(f).ToLower() == ".mp4" ? "video" : "image"
                             };
                         });
    return Results.Ok(files);
});

app.MapDelete("/api/assets/{filename}", (string filename) =>
{
    var filePath = Path.Combine(AssetsFolder, filename);
    if (!File.Exists(filePath))
    {
        return Results.NotFound();
    }

    try
    {
        File.Delete(filePath);
        return Results.Ok(new { message = "Asset deleted successfully" });
    }
    catch (Exception ex)
    {
        return Results.Problem(ex.Message);
    }
});

app.MapPost("/api/assets/approve", (ApproveAssetRequest req) =>
{
    var sourcePath = Path.Combine(AssetsFolder, req.Filename);
    var destPath = Path.Combine(LibraryFolder, req.Filename);

    if (!File.Exists(sourcePath))
    {
        return Results.NotFound(new { error = "Source asset not found." });
    }

    try
    {
        // Copy to permanent library (Assets Library folder)
        File.Copy(sourcePath, destPath, true);
        return Results.Ok(new { message = "Asset approved and saved to library." });
    }
    catch (Exception ex)
    {
        return Results.Problem(ex.Message);
    }
});

app.MapPost("/api/deploy/tiktok-adgroup", async (TikTokDeployRequest req, IConfiguration config, HttpContext context) =>
{
    var accessToken = context.Request.Headers["X-TikTok-Token"].ToString();
    if (string.IsNullOrEmpty(accessToken)) 
        accessToken = config["TikTok:AccessToken"];
    
    // Fallback to simulation if no real token is provided
    if (string.IsNullOrEmpty(accessToken) || accessToken == "YOUR_TIKTOK_ACCESS_TOKEN_HERE")
    {
        await Task.Delay(2000); // Simulate slightly longer for dual-step
        Console.WriteLine("--- SIMULATING TIKTOK FULL DEPLOYMENT ---");
        Console.WriteLine("LAYER 1: AD GROUP");
        Console.WriteLine(JsonSerializer.Serialize(req.group, new JsonSerializerOptions { WriteIndented = true }));
        Console.WriteLine("LAYER 2: AD CREATIVE");
        Console.WriteLine(JsonSerializer.Serialize(req.creative, new JsonSerializerOptions { WriteIndented = true }));
        Console.WriteLine("-----------------------------------------");
        
        return Results.Ok(new { 
            status = "success", 
            message = "Full Campaign (Group + Creative) successfully deployed in simulation mode.", 
            adgroup_id = "SIM_GRP_" + Guid.NewGuid().ToString().Substring(0, 8),
            ad_id = "SIM_AD_" + Guid.NewGuid().ToString().Substring(0, 8)
        });
    }

    try 
    {
        // STEP 1: Create Ad Group
        const string groupUrl = "https://business-api.tiktok.com/open_api/v1.3/adgroup/create/";
        var groupMsg = new HttpRequestMessage(HttpMethod.Post, groupUrl);
        groupMsg.Headers.Add("Access-Token", accessToken);
        groupMsg.Content = JsonContent.Create(req.group);
        var groupRes = await httpClient.SendAsync(groupMsg);
        var groupContent = await groupRes.Content.ReadAsStringAsync();

        if (!groupRes.IsSuccessStatusCode) return Results.Problem(detail: groupContent, statusCode: (int)groupRes.StatusCode);

        // STEP 2: Logic to extract adgroup_id and create Ad would go here in production
        // For now, return the result of the group creation or continue orchestration
        return Results.Text(groupContent, "application/json");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"TikTok Error: {ex.Message}");
        return Results.Problem(ex.Message);
    }
});

app.MapPost("/api/gemini/questions", async (GeminiRequest req, IConfiguration config) =>
{
    var apiKey = config["Gemini:ApiKey"];
    if (string.IsNullOrEmpty(apiKey) || apiKey == "YOUR_GEMINI_API_KEY_HERE")
        return Results.BadRequest(new { error = "Gemini API key is not configured." });

    // Caching check
    var cacheKey = $"l1_{req.Brief.ToLower().GetHashCode()}";
    if (aiCache.TryGetValue(cacheKey, out var cachedQuestions)) {
        Console.WriteLine("Optimizing: Returning cached Level 1 questions.");
        return Results.Ok(new { questions = cachedQuestions, source = "cache" });
    }

    int maxRetries = 3;
    int delayMs = 3000;

    for (int i = 0; i <= maxRetries; i++)
    {
        try 
        {
            var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={apiKey}";
            
            var prompt = $"As a high-level marketing strategist, analyze this brief: '{req.Brief}'. " +
                         "Generate 5 deep, conceptual questions that will help read the user's mind and uncover the core psychological pillars, " +
                         "hidden motivations, or unique market angles of the campaign. " +
                         "STRICT RULE: Format output as a valid JSON array of strings only. No other text.";

            var body = new { contents = new[] { new { parts = new[] { new { text = prompt } } } } };
            var response = await httpClient.PostAsJsonAsync(url, body);
            
            if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests && i < maxRetries)
            {
                Console.WriteLine($"Capacity reached. Retrying in {delayMs * (i + 1) / 1000}s...");
                await Task.Delay(delayMs * (i + 1));
                continue;
            }

            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                return Results.Problem(detail: errorContent, statusCode: (int)response.StatusCode);
            }

            var result = await response.Content.ReadFromJsonAsync<JsonElement>();
            var candidates = result.GetProperty("candidates");
            if (candidates.GetArrayLength() == 0) return Results.Problem("No AI candidates identified.");
            
            var text = candidates[0].GetProperty("content").GetProperty("parts")[0].GetProperty("text").GetString();
            if (string.IsNullOrEmpty(text)) return Results.Problem("AI logic returned null.");
            
            text = text.Trim();
            if (text.StartsWith("```json")) text = text.Replace("```json", "");
            if (text.StartsWith("```")) text = text.Replace("```", "");
            if (text.EndsWith("```")) text = text.Substring(0, text.LastIndexOf("```"));
            text = text.Trim();

            var questions = JsonSerializer.Deserialize<string[]>(text);
            
            // Populate Cache
            if (questions != null) aiCache[cacheKey] = questions;
            
            return Results.Ok(new { questions });
        }
        catch (Exception ex)
        {
            if (i == maxRetries) return Results.Problem(ex.Message);
            await Task.Delay(delayMs);
        }
    }
    return Results.Problem("Maximum capacity retries reached.");
});

app.MapPost("/api/deploy/facebook", async (FacebookDeployRequest req, FacebookAdsService fbService) =>
{
    try
    {
        Console.WriteLine($"[FACEBOOK] Starting Deployment Sequence for Campaign: {req.campaign.name}");

        string ExtractId(JsonElement json) =>
            json.TryGetProperty("id", out var id) ? id.GetString()! : null!;

        string ExtractError(JsonElement json) =>
            json.TryGetProperty("error", out var err) && err.TryGetProperty("message", out var msg) ? msg.GetString()! : null!;

        // 1. Image Upload
        string imageHash = "mock_image_hash_12345";
        string? imageError = null;
        bool imageReal = false;

        if (!string.IsNullOrEmpty(req.assetId))
        {
            string assetPath = Path.Combine(AssetsFolder, req.assetId);
            if (!File.Exists(assetPath)) assetPath = Path.Combine(LibraryFolder, req.assetId);

            if (File.Exists(assetPath))
            {
                var imgRespStr = await fbService.UploadImageAsync(assetPath);
                Console.WriteLine($"[FACEBOOK] Image Upload: {imgRespStr}");
                var imgJson = JsonSerializer.Deserialize<JsonElement>(imgRespStr);
                
                if (imgJson.TryGetProperty("images", out var images))
                {
                    foreach (var imgProp in images.EnumerateObject())
                    {
                        if (imgProp.Value.TryGetProperty("hash", out var h))
                        {
                            imageHash = h.GetString()!;
                            imageReal = true;
                            break;
                        }
                    }
                }
                if (!imageReal) imageError = ExtractError(imgJson);
            }
            else
            {
                imageError = "Asset file not found on server.";
            }
        }

        // 2. Create Campaign
        var campStr = await fbService.CreateCampaignAsync(req.campaign.name, req.campaign.objective, req.campaign.status);
        Console.WriteLine($"[FACEBOOK] Campaign: {campStr}");
        var campJson = JsonSerializer.Deserialize<JsonElement>(campStr);
        string campaignId = ExtractId(campJson) ?? $"mock_camp_{Guid.NewGuid().ToString().Substring(0,8)}";
        string? campaignError = ExtractError(campJson);
        bool campaignReal = !campaignId.StartsWith("mock_");

        // 3. Create Ad Set
        var adSetStr = await fbService.CreateAdSetAsync(campaignId, req.adSet.name, req.adSet.daily_budget, req.adSet.status);
        Console.WriteLine($"[FACEBOOK] AdSet: {adSetStr}");
        var adSetJson = JsonSerializer.Deserialize<JsonElement>(adSetStr);
        string adSetId = ExtractId(adSetJson) ?? $"mock_adset_{Guid.NewGuid().ToString().Substring(0,8)}";
        string? adSetError = ExtractError(adSetJson);
        bool adSetReal = !adSetId.StartsWith("mock_");

        // 4. Create Creative
        var creativeStr = await fbService.CreateAdCreativeAsync(req.creative.name, req.creative.object_story_spec.page_id, req.creative.object_story_spec.link_data.message, req.creative.object_story_spec.link_data.link, imageHash, req.creative.status);
        Console.WriteLine($"[FACEBOOK] Creative: {creativeStr}");
        var creativeJson = JsonSerializer.Deserialize<JsonElement>(creativeStr);
        string creativeId = ExtractId(creativeJson) ?? $"mock_creative_{Guid.NewGuid().ToString().Substring(0,8)}";
        string? creativeError = ExtractError(creativeJson);
        bool creativeReal = !creativeId.StartsWith("mock_");

        // 5. Create Ad
        var adStr = await fbService.CreateAdAsync($"Ad_{req.campaign.name}", adSetId, creativeId, req.campaign.status);
        Console.WriteLine($"[FACEBOOK] Ad: {adStr}");
        var adJson = JsonSerializer.Deserialize<JsonElement>(adStr);
        string adId = ExtractId(adJson) ?? $"mock_ad_{Guid.NewGuid().ToString().Substring(0,8)}";
        string? adError = ExtractError(adJson);
        bool adReal = !adId.StartsWith("mock_");

        // Overall: all real = full success (including image)
        bool fullyDeployed = imageReal && campaignReal && adSetReal && creativeReal && adReal;

        return Results.Ok(new
        {
            success = fullyDeployed,
            network = "Facebook",
            steps = new[]
            {
                new { label = "Image Upload", id = imageHash,   real = imageReal,    error = imageError },
                new { label = "Campaign",     id = campaignId,  real = campaignReal, error = campaignError },
                new { label = "Ad Set",       id = adSetId,     real = adSetReal,    error = adSetError },
                new { label = "Creative",     id = creativeId,  real = creativeReal, error = creativeError },
                new { label = "Ad",           id = adId,        real = adReal,       error = adError }
            },
            image_hash   = imageHash,
            campaign_id  = campaignId,
            adset_id     = adSetId,
            creative_id  = creativeId,
            ad_id        = adId,
            status       = fullyDeployed ? "LIVE_PAUSED" : "PARTIAL_OR_MOCK"
        });
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[FACEBOOK ERROR] {ex.Message}");
        return Results.Problem(ex.Message);
    }
});

app.MapPost("/api/gemini/follow-up", async (GeminiFollowUpRequest req, IConfiguration config) =>
{
    var apiKey = config["Gemini:ApiKey"];
    if (string.IsNullOrEmpty(apiKey) || apiKey == "YOUR_GEMINI_API_KEY_HERE")
        return Results.BadRequest(new { error = "Gemini API key is not configured." });

    // Caching check
    var combinedAnswers = string.Join("|", req.PreviousAnswers ?? []);
    var cacheKey = $"l2_{req.OriginalBrief.ToLower().GetHashCode()}_{combinedAnswers.GetHashCode()}";
    if (aiCache.TryGetValue(cacheKey, out var cachedQuestions)) {
        Console.WriteLine("Optimizing: Returning cached Level 2 questions.");
        return Results.Ok(new { questions = cachedQuestions, source = "cache" });
    }

    int maxRetries = 3;
    int delayMs = 3000;

    for (int i = 0; i <= maxRetries; i++)
    {
        try 
        {
            var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={apiKey}";
            
            var history = "";
            for(int i_h=0; i_h<req.PreviousQuestions.Length; i_h++) {
                var ans = (req.PreviousAnswers != null && i_h < req.PreviousAnswers.Length) ? req.PreviousAnswers[i_h] : "No answer provided";
                history += $"Q: {req.PreviousQuestions[i_h]}\nA: {ans}\n\n";
            }

            var prompt = $"Based on the original brief: '{req.OriginalBrief}' and the following initial probe results:\n{history}\n" +
                         "Generate 5 advanced, deep-dive psychological diagnostic questions that uncover the 'soul' of the campaign " +
                         "and find out exactly what makes it important. Focus on high-level strategy over logistics. " +
                         "STRICT RULE: Format output as a valid JSON array of strings only. No other text.";

            var body = new { contents = new[] { new { parts = new[] { new { text = prompt } } } } };
            var response = await httpClient.PostAsJsonAsync(url, body);
            
            if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests && i < maxRetries)
            {
                Console.WriteLine($"Capacity reached (Follow-up). Retrying in {delayMs * (i + 1) / 1000}s...");
                await Task.Delay(delayMs * (i + 1));
                continue;
            }

            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                return Results.Problem(detail: errorContent, statusCode: (int)response.StatusCode);
            }

            var result = await response.Content.ReadFromJsonAsync<JsonElement>();
            var candidates = result.GetProperty("candidates");
            if (candidates.GetArrayLength() == 0) return Results.Problem("No AI candidates identified.");
            
            var text = candidates[0].GetProperty("content").GetProperty("parts")[0].GetProperty("text").GetString();
            if (string.IsNullOrEmpty(text)) return Results.Problem("AI logic returned null.");
            
            text = text.Trim();
            if (text.StartsWith("```json")) text = text.Replace("```json", "");
            if (text.StartsWith("```")) text = text.Replace("```", "");
            if (text.EndsWith("```")) text = text.Substring(0, text.LastIndexOf("```"));
            text = text.Trim();

            var questions = JsonSerializer.Deserialize<string[]>(text);
            
            // Populate Cache
            if (questions != null) aiCache[cacheKey] = questions;

            return Results.Ok(new { questions });
        }
        catch (Exception ex)
        {
            if (i == maxRetries) return Results.Problem(ex.Message);
            await Task.Delay(delayMs);
        }
    }
    return Results.Problem("Maximum capacity retries reached.");
});


var summaries = new[]

{
    "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
};

app.MapGet("/weatherforecast", () =>
{
    var forecast =  Enumerable.Range(1, 5).Select(index =>
        new WeatherForecast
        (
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)]
        ))
        .ToArray();
    return forecast;
})
.WithName("GetWeatherForecast");

app.Run();

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}

record SaveAssetRequest(string Url, string Filename);
record ApproveAssetRequest(string Filename);

record TikTokDeployRequest(TikTokAdGroupRequest group, TikTokCreativeRequest creative);

record TikTokAdGroupRequest(
    string advertiser_id,
    string campaign_id,
    string adgroup_name,
    string placement_type,
    string[] placement,
    string promotion_type,
    string budget_mode,
    decimal budget,
    string schedule_type,
    string schedule_start_time,
    string schedule_end_time,
    string billing_event,
    string optimization_goal,
    string pacing,
    string bid_type,
    decimal bid,
    TikTokTargeting targeting,
    string? pixel_id,
    string status
);

record TikTokCreativeRequest(
    string ad_name,
    string display_name,
    string video_id,
    string ad_text,
    string? identity_id,
    string call_to_action
);

record TikTokTargeting(
    GeoLocations geo_locations,
    string[] age_groups,
    string[] genders,
    string[] languages
);

record GeoLocations(string[] countries);

record FacebookDeployRequest(FacebookCampaignPayload campaign, FacebookAdSetPayload adSet, FacebookCreativePayload creative, string assetId);

record FacebookCampaignPayload(
    string name,
    string objective,
    string status,
    string[] special_ad_categories
);

record FacebookAdSetPayload(
    string name,
    long daily_budget,
    string billing_event,
    string optimization_goal,
    string start_time,
    string end_time,
    object targeting,
    string status
);

record FacebookCreativePayload(
    string name,
    FacebookObjectStorySpec object_story_spec,
    string status
);

record FacebookObjectStorySpec(
    string page_id,
    FacebookLinkData link_data
);

record FacebookLinkData(
    string message,
    string link,
    string image_hash
);

record GeminiRequest(string Brief);
record GeminiFollowUpRequest(string OriginalBrief, string[] PreviousQuestions, string[] PreviousAnswers);
record RolePermissionUpdate(int RoleId, int[] ScreenIds);

public record RolePermissionsRequest(int RoleId, List<int> ScreenIds);

