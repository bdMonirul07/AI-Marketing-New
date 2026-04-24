using System.Text;
using System.Text.Json;

namespace backend.Services;

public class GeminiMediaService : IGeminiMediaService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly IWebHostEnvironment _environment;

    public GeminiMediaService(HttpClient httpClient, IConfiguration configuration, IWebHostEnvironment environment)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _environment = environment;
    }

    public async Task<GeneratedMediaResult> GenerateImageAsync(string prompt, CancellationToken cancellationToken = default)
    {
        var apiKey = GetApiKey();
        var baseUrl = GetBaseUrl();
        var model = _configuration["Gemini:ImageModel"] ?? "imagen-4.0-generate-001";
        var sampleCount = _configuration.GetValue("Gemini:ImageSampleCount", 1);

        var requestPayload = new
        {
            instances = new[]
            {
                new { prompt }
            },
            parameters = new
            {
                sampleCount
            }
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/models/{model}:predict");
        request.Headers.Add("x-goog-api-key", apiKey);
        request.Content = new StringContent(JsonSerializer.Serialize(requestPayload), Encoding.UTF8, "application/json");

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"Gemini image generation failed: {response.StatusCode} {responseBody}");
        }

        using var json = JsonDocument.Parse(responseBody);
        var b64 = ExtractBase64FromPredictions(json);
        if (string.IsNullOrWhiteSpace(b64))
        {
            throw new InvalidOperationException("Gemini image response missing base64 data.");
        }

        var bytes = Convert.FromBase64String(b64);
        var fileName = $"image-{DateTime.UtcNow:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}.png";
        var relativeUrl = await SaveFileAsync(bytes, fileName, cancellationToken);

        return new GeneratedMediaResult
        {
            RelativeUrl = relativeUrl,
            Source = $"Gemini AI Studio ({model})"
        };
    }

    public async Task<GeneratedMediaResult> GenerateVideoAsync(string prompt, CancellationToken cancellationToken = default)
    {
        var apiKey = GetApiKey();
        var baseUrl = GetBaseUrl();
        var model = _configuration["Gemini:VideoModel"] ?? "veo-3.1-generate-preview";
        var aspectRatio = _configuration["Gemini:VideoAspectRatio"] ?? "16:9";

        var requestPayload = new Dictionary<string, object>
        {
            ["instances"] = new[]
            {
                new Dictionary<string, string> { ["prompt"] = prompt }
            }
        };

        if (!string.IsNullOrWhiteSpace(aspectRatio))
        {
            requestPayload["parameters"] = new Dictionary<string, string>
            {
                ["aspectRatio"] = aspectRatio
            };
        }

        var requestUrl = $"{baseUrl}/models/{model}:predictLongRunning";
        using var request = new HttpRequestMessage(HttpMethod.Post, requestUrl);
        request.Headers.Add("x-goog-api-key", apiKey);
        request.Content = new StringContent(JsonSerializer.Serialize(requestPayload), Encoding.UTF8, "application/json");

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"Gemini video generation failed: {response.StatusCode} {responseBody}");
        }

        using var json = JsonDocument.Parse(responseBody);
        var operationName = json.RootElement.GetProperty("name").GetString();
        if (string.IsNullOrWhiteSpace(operationName))
        {
            throw new InvalidOperationException("Gemini video generation returned no operation name.");
        }

        var operationUrl = $"{baseUrl}/{operationName}";
        string? videoUri = null;
        for (var attempt = 0; attempt < 60; attempt += 1)
        {
            await Task.Delay(TimeSpan.FromSeconds(2), cancellationToken);
            using var opRequest = new HttpRequestMessage(HttpMethod.Get, operationUrl);
            opRequest.Headers.Add("x-goog-api-key", apiKey);
            using var opResponse = await _httpClient.SendAsync(opRequest, cancellationToken);
            var opBody = await opResponse.Content.ReadAsStringAsync(cancellationToken);
            if (!opResponse.IsSuccessStatusCode)
            {
                throw new InvalidOperationException($"Gemini video poll failed: {opResponse.StatusCode} {opBody}");
            }

            using var opJson = JsonDocument.Parse(opBody);
            var done = opJson.RootElement.TryGetProperty("done", out var doneProp) && doneProp.GetBoolean();
            if (!done)
            {
                continue;
            }

            videoUri = ExtractVideoUri(opJson);

            break;
        }

        if (string.IsNullOrWhiteSpace(videoUri))
        {
            throw new InvalidOperationException("Gemini video generation did not return a download URL.");
        }

        using var downloadRequest = new HttpRequestMessage(HttpMethod.Get, videoUri);
        downloadRequest.Headers.Add("x-goog-api-key", apiKey);
        using var downloadResponse = await _httpClient.SendAsync(downloadRequest, cancellationToken);
        if (!downloadResponse.IsSuccessStatusCode)
        {
            var errorBody = await downloadResponse.Content.ReadAsStringAsync(cancellationToken);
            throw new InvalidOperationException($"Gemini video download failed: {downloadResponse.StatusCode} {errorBody}");
        }
        var videoBytes = await downloadResponse.Content.ReadAsByteArrayAsync(cancellationToken);
        var fileName = $"video-{DateTime.UtcNow:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}.mp4";
        var relativeUrl = await SaveFileAsync(videoBytes, fileName, cancellationToken);

        return new GeneratedMediaResult
        {
            RelativeUrl = relativeUrl,
            Source = $"Gemini AI Studio ({model})"
        };
    }

    public async Task<GeneratedMediaResult> GeneratePostAsync(string prompt, CancellationToken cancellationToken = default)
    {
        var apiKey = GetApiKey();
        var baseUrl = GetBaseUrl();
        var model = _configuration["Gemini:TextModel"] ?? "gemini-2.5-flash";

        var requestPayload = new
        {
            contents = new[]
            {
                new
                {
                    role = "user",
                    parts = new[]
                    {
                        new { text = $"You are a senior marketing copywriter. Provide a concise, high-performing social media post.\\n\\n{prompt}" }
                    }
                }
            }
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/models/{model}:generateContent");
        request.Headers.Add("x-goog-api-key", apiKey);
        request.Content = new StringContent(JsonSerializer.Serialize(requestPayload), Encoding.UTF8, "application/json");

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"Gemini post generation failed: {response.StatusCode} {responseBody}");
        }

        using var json = JsonDocument.Parse(responseBody);
        var content = ExtractTextFromCandidates(json);

        if (string.IsNullOrWhiteSpace(content))
        {
            content = "Post copy unavailable.";
        }

        var fileName = $"post-{DateTime.UtcNow:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}.txt";
        var bytes = Encoding.UTF8.GetBytes(content);
        var relativeUrl = await SaveFileAsync(bytes, fileName, cancellationToken);

        return new GeneratedMediaResult
        {
            RelativeUrl = relativeUrl,
            Source = $"Gemini AI Studio ({model})",
            ContentText = content
        };
    }

    private string GetApiKey()
    {
        var key = _configuration["Gemini:ApiKey"]
            ?? _configuration["GEMINI_API_KEY"]
            ?? Environment.GetEnvironmentVariable("GEMINI_API_KEY");

        if (string.IsNullOrWhiteSpace(key) || key == "YOUR_GEMINI_API_KEY")
        {
            throw new InvalidOperationException("Gemini API key is missing. Set Gemini:ApiKey or GEMINI_API_KEY.");
        }

        return key;
    }

    private string GetBaseUrl()
    {
        return _configuration["Gemini:BaseUrl"] ?? "https://generativelanguage.googleapis.com/v1beta";
    }

    private async Task<string> SaveFileAsync(byte[] bytes, string fileName, CancellationToken cancellationToken)
    {
        var root = Path.Combine(_environment.ContentRootPath, "..", "Images", "generated");
        Directory.CreateDirectory(root);
        var filePath = Path.Combine(root, fileName);
        await File.WriteAllBytesAsync(filePath, bytes, cancellationToken);
        return $"/Images/generated/{fileName}";
    }

    private static string? ExtractBase64FromPredictions(JsonDocument json)
    {
        if (!json.RootElement.TryGetProperty("predictions", out var predictions) || predictions.GetArrayLength() == 0)
        {
            return null;
        }

        var prediction = predictions[0];
        if (prediction.TryGetProperty("bytesBase64Encoded", out var rawBytes))
        {
            return rawBytes.GetString();
        }

        if (prediction.TryGetProperty("image", out var image))
        {
            if (image.TryGetProperty("bytesBase64Encoded", out var bytes))
            {
                return bytes.GetString();
            }

            if (image.TryGetProperty("imageBytes", out var imageBytes))
            {
                return imageBytes.GetString();
            }
        }

        return null;
    }

    private static string ExtractTextFromCandidates(JsonDocument json)
    {
        if (!json.RootElement.TryGetProperty("candidates", out var candidates) || candidates.GetArrayLength() == 0)
        {
            return string.Empty;
        }

        var candidate = candidates[0];
        if (!candidate.TryGetProperty("content", out var content))
        {
            return string.Empty;
        }

        if (!content.TryGetProperty("parts", out var parts) || parts.GetArrayLength() == 0)
        {
            return string.Empty;
        }

        var textPart = parts[0];
        if (textPart.TryGetProperty("text", out var textValue))
        {
            return textValue.GetString() ?? string.Empty;
        }

        return string.Empty;
    }

    private static string? ExtractVideoUri(JsonDocument json)
    {
        if (!json.RootElement.TryGetProperty("response", out var response))
        {
            return null;
        }

        if (!response.TryGetProperty("generateVideoResponse", out var generateVideo))
        {
            return null;
        }

        if (generateVideo.TryGetProperty("generatedSamples", out var samples) && samples.ValueKind == JsonValueKind.Array && samples.GetArrayLength() > 0)
        {
            var video = samples[0].GetProperty("video");
            return video.GetProperty("uri").GetString();
        }

        if (generateVideo.TryGetProperty("generatedVideos", out var videos) && videos.ValueKind == JsonValueKind.Array && videos.GetArrayLength() > 0)
        {
            var video = videos[0].GetProperty("video");
            return video.GetProperty("uri").GetString();
        }

        return null;
    }
}
