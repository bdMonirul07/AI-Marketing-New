using System.Collections.Concurrent;
using System.Text.Json;

const string GuidelinesFile = "brand_guidelines.json";
const string CampaignsFile = "campaigns.json";
const string CmoQueueFile = "cmo_queue.json";
const string AssetsFolder = "Assets";
const string LibraryFolder = "Assets Library";

// Singleton HttpClient and Cache for AI responses
var httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
var aiCache = new ConcurrentDictionary<string, string[]>();

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddOpenApi();
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

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("AllowAll");

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


app.MapGet("/api/guidelines", async () =>
{
    if (!File.Exists(GuidelinesFile))
    {
        return Results.NotFound();
    }
    var json = await File.ReadAllTextAsync(GuidelinesFile);
    return Results.Text(json, "application/json");
});

app.MapPost("/api/guidelines", async (HttpRequest request) =>
{
    using var reader = new StreamReader(request.Body);
    var json = await reader.ReadToEndAsync();
    await File.WriteAllTextAsync(GuidelinesFile, json);
    return Results.Ok();
});

app.MapPost("/api/campaigns", async (HttpRequest request) =>
{
    using var reader = new StreamReader(request.Body);
    var json = await reader.ReadToEndAsync();
    
    // Append or overwrite? User said "save the contact in creative stdio". 
    // Usually means saving the current session's output.
    await File.WriteAllTextAsync(CampaignsFile, json);
    return Results.Ok();
});

app.MapGet("/api/campaigns", async () =>
{
    if (!File.Exists(CampaignsFile))
    {
        return Results.NotFound();
    }
    var json = await File.ReadAllTextAsync(CampaignsFile);
    return Results.Text(json, "application/json");
});

app.MapGet("/api/cmo/queue", async () =>
{
    if (!File.Exists(CmoQueueFile))
    {
        return Results.Ok(new List<object>());
    }
    var json = await File.ReadAllTextAsync(CmoQueueFile);
    return Results.Text(json, "application/json");
});

app.MapPost("/api/cmo/queue", async (HttpRequest request) =>
{
    using var reader = new StreamReader(request.Body);
    var json = await reader.ReadToEndAsync();
    await File.WriteAllTextAsync(CmoQueueFile, json);
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

record GeminiRequest(string Brief);
record GeminiFollowUpRequest(string OriginalBrief, string[] PreviousQuestions, string[] PreviousAnswers);

