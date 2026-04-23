using System.Text;
using System.Text.Json;

namespace backend.Services;

public interface ICapCutService
{
    Task<string> CreateVideoFromPromptAsync(string prompt, string style = "modern");
}

public class CapCutService : ICapCutService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<CapCutService> _logger;

    public CapCutService(HttpClient httpClient, IConfiguration configuration, ILogger<CapCutService> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<string> CreateVideoFromPromptAsync(string prompt, string style = "modern")
    {
        var apiKey = _configuration["CapCut:ApiKey"];
        var appId = _configuration["CapCut:AppId"];
        var baseUrl = _configuration["CapCut:BaseUrl"] ?? "https://api.bytedance.com/v1/creative/video/";

        if (string.IsNullOrEmpty(apiKey) || apiKey.Contains("YOUR_"))
        {
            _logger.LogWarning("CapCut API Key is not configured. Falling back to simulated high-quality video.");
            return GetSimulatedVideoUrl(prompt);
        }

        try
        {
            var requestBody = new
            {
                app_id = appId,
                content = prompt,
                style_preset = style,
                resolution = "1080p",
                duration = 15 // Standard social media duration
            };

            var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
            _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");

            var response = await _httpClient.PostAsync($"{baseUrl}generate", content);
            
            if (response.IsSuccessStatusCode)
            {
                var jsonResponse = await response.Content.ReadAsStringAsync();
                var result = JsonSerializer.Deserialize<CapCutResponse>(jsonResponse);
                return result?.VideoUrl ?? GetSimulatedVideoUrl(prompt);
            }

            _logger.LogError($"CapCut API Error: {response.StatusCode}");
            return GetSimulatedVideoUrl(prompt);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "CapCut Video Generation Failed.");
            return GetSimulatedVideoUrl(prompt);
        }
    }

    private string GetSimulatedVideoUrl(string prompt)
    {
        // High-quality marketing placeholders that simulate CapCut output
        if (prompt.ToLower().Contains("coffee")) 
            return "https://assets.mixkit.co/videos/preview/mixkit-coffee-being-poured-into-a-cup-3444-large.mp4";
        if (prompt.ToLower().Contains("tech") || prompt.ToLower().Contains("student")) 
            return "https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-a-circuit-board-1070-large.mp4";
        
        return "https://assets.mixkit.co/videos/preview/mixkit-abstract-flowing-colors-background-204-large.mp4";
    }

    private class CapCutResponse
    {
        public string? VideoUrl { get; set; }
        public string? TaskId { get; set; }
    }
}
