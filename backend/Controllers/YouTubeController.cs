using backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class YouTubeController : ControllerBase
{
    private readonly IYouTubeUploader _uploader;

    public YouTubeController(IYouTubeUploader uploader)
    {
        _uploader = uploader;
    }

    [HttpPost("connect")]
    public async Task<IActionResult> Connect()
    {
        try
        {
            var result = await _uploader.AuthorizeAsync();
            return Ok(new { message = result, status = "Connected" });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("upload")]
    public async Task<IActionResult> Upload([FromBody] VideoUploadRequest request)
    {
        try
        {
            if (string.IsNullOrEmpty(request.FilePath))
            {
                 // Mocking for testing if file doesn't exist
                 return BadRequest("File path is required.");
            }

            // Basic check if it looks like an image
            if (request.FilePath.EndsWith(".jpg") || request.FilePath.EndsWith(".png"))
            {
                return BadRequest("YouTube API only accepts video files. Please convert your image to video first.");
            }

            string uploadPath = request.FilePath;
            bool isRemote = request.FilePath.StartsWith("http", StringComparison.OrdinalIgnoreCase);

            if (isRemote)
            {
                // Download the file to a temporary location
                using var httpClient = new HttpClient();
                var response = await httpClient.GetAsync(request.FilePath);
                if (!response.IsSuccessStatusCode)
                    return BadRequest($"Failed to download video from {request.FilePath}");

                string tempFile = Path.Combine(Path.GetTempPath(), $"youtube_upload_{Guid.NewGuid():N}.mp4");
                await using var fs = new FileStream(tempFile, FileMode.Create);
                await response.Content.CopyToAsync(fs);
                uploadPath = tempFile;
            }

            var videoId = await _uploader.UploadVideoAsync(
                uploadPath, 
                request.Title, 
                request.Description, 
                request.Tags ?? new string[] { "AI Marketing" },
                request.PrivacyStatus
            );

            // Cleanup temp file if it was downloaded
            if (isRemote && System.IO.File.Exists(uploadPath))
            {
                try { System.IO.File.Delete(uploadPath); } catch { /* Ignore */ }
            }

            return Ok(new { videoId = videoId, url = $"https://youtu.be/{videoId}" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }
}

public class VideoUploadRequest
{
    public string FilePath { get; set; }
    public string Title { get; set; }
    public string Description { get; set; }
    public string[] Tags { get; set; }
    public string PrivacyStatus { get; set; } = "private";
}
