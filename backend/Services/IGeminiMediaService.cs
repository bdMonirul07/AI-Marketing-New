namespace backend.Services;

public interface IGeminiMediaService
{
    Task<GeneratedMediaResult> GenerateImageAsync(string prompt, CancellationToken cancellationToken = default);
    Task<GeneratedMediaResult> GenerateVideoAsync(string prompt, CancellationToken cancellationToken = default);
    Task<GeneratedMediaResult> GeneratePostAsync(string prompt, CancellationToken cancellationToken = default);
}

public class GeneratedMediaResult
{
    public string RelativeUrl { get; set; } = string.Empty;
    public string Source { get; set; } = string.Empty;
    public string? ContentText { get; set; }
}
