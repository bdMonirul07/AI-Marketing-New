using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace backend.Services;

public interface IGroqService
{
    Task<string> GetChatCompletionAsync(string prompt, string systemMessage = "");
}

public class GroqService : IGroqService
{
    private readonly HttpClient _httpClient;
    private readonly string _apiKey;
    private const string Model = "openai/gpt-oss-120b";

    public GroqService(HttpClient httpClient, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _apiKey = configuration["Groq:ApiKey"]
            ?? Environment.GetEnvironmentVariable("GROQ_API_KEY")
            ?? throw new InvalidOperationException("Groq:ApiKey is missing.");

        if (string.IsNullOrWhiteSpace(_apiKey) || _apiKey == "YOUR_GROQ_API_KEY")
        {
            throw new InvalidOperationException("Groq:ApiKey is missing or invalid.");
        }
        _httpClient.BaseAddress = new Uri("https://api.groq.com/openai/v1/");
    }

    public async Task<string> GetChatCompletionAsync(string prompt, string systemMessage = "")
    {
        var requestBody = new
        {
            model = Model,
            messages = new[]
            {
                new { role = "system", content = string.IsNullOrEmpty(systemMessage) ? "You are a helpful AI assistant." : systemMessage },
                new { role = "user", content = prompt }
            },
            temperature = 0.7
        };

        var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");

        // Add Authorization header manually for each request to ensure it's fresh/thread-safe if using shared client
        var request = new HttpRequestMessage(HttpMethod.Post, "chat/completions")
        {
            Content = content
        };
        request.Headers.Add("Authorization", $"Bearer {_apiKey}");

        var response = await _httpClient.SendAsync(request);
        var jsonResponse = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"Groq API request failed: {(int)response.StatusCode} {response.ReasonPhrase}. {jsonResponse}");
        }

        var result = JsonSerializer.Deserialize<GroqResponse>(jsonResponse);

        return result?.Choices?.FirstOrDefault()?.Message?.Content ?? string.Empty;
    }

    // Helper classes for deserialization
    private class GroqResponse
    {
        [JsonPropertyName("choices")]
        public List<Choice>? Choices { get; set; }
    }

    private class Choice
    {
        [JsonPropertyName("message")]
        public Message? Message { get; set; }
    }

    private class Message
    {
        [JsonPropertyName("content")]
        public string? Content { get; set; }
    }
}
