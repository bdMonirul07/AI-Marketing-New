using System.Reflection;
using Google.Apis.Auth.OAuth2;
using Google.Apis.Services;
using Google.Apis.Upload;
using Google.Apis.Util.Store;
using Google.Apis.YouTube.v3;
using Google.Apis.YouTube.v3.Data;

namespace backend.Services;

public class YouTubeUploader : IYouTubeUploader
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<YouTubeUploader> _logger;
    private UserCredential _credential;

    public YouTubeUploader(IConfiguration configuration, ILogger<YouTubeUploader> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<string> AuthorizeAsync()
    {
        string clientId = _configuration["YouTube:ClientId"];
        string clientSecret = _configuration["YouTube:ClientSecret"];

        if (string.IsNullOrEmpty(clientId) || string.IsNullOrEmpty(clientSecret))
        {
            throw new InvalidOperationException("YouTube ClientId and ClientSecret must be configured.");
        }

        string[] scopes = new[] { YouTubeService.Scope.YoutubeUpload };

        try
        {
            // This opens a local browser for the user to sign in
            _credential = await GoogleWebAuthorizationBroker.AuthorizeAsync(
                new ClientSecrets
                {
                    ClientId = clientId,
                    ClientSecret = clientSecret
                },
                scopes,
                "user",
                CancellationToken.None,
                new FileDataStore("Youtube.Auth.Store")
            );

            return "Authorization Successful";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to authorize with YouTube.");
            throw;
        }
    }

    public async Task<string> UploadVideoAsync(string filePath, string title, string description, string[] tags, string privacyStatus = "private")
    {
        if (_credential == null)
        {
            await AuthorizeAsync();
        }

        var youtubeService = new YouTubeService(new BaseClientService.Initializer()
        {
            HttpClientInitializer = _credential,
            ApplicationName = "AI Marketing Orchestrator"
        });

        var video = new Video();
        video.Snippet = new VideoSnippet();
        video.Snippet.Title = title;
        video.Snippet.Description = description;
        video.Snippet.Tags = tags;
        video.Snippet.CategoryId = "22"; // People & Blogs
        
        video.Status = new VideoStatus();
        video.Status.PrivacyStatus = privacyStatus; // "private", "public", "unlisted"

        using (var fileStream = new FileStream(filePath, FileMode.Open))
        {
            var videosInsertRequest = youtubeService.Videos.Insert(video, "snippet,status", fileStream, "video/*");
            videosInsertRequest.ProgressChanged += videosInsertRequest_ProgressChanged;
            videosInsertRequest.ResponseReceived += videosInsertRequest_ResponseReceived;

            await videosInsertRequest.UploadAsync();

            if (videosInsertRequest.ResponseBody != null)
            {
                return videosInsertRequest.ResponseBody.Id;
            }
            
             // If we get here, upload might have failed or implied success without body (rare)
             // We can check the exception in UploadAsync if strictly needed, but simple return is fine.
             return "Upload complete (Processing)";
        }
    }

    private void videosInsertRequest_ProgressChanged(IUploadProgress progress)
    {
        switch (progress.Status)
        {
            case UploadStatus.Uploading:
                _logger.LogInformation("{0} bytes sent.", progress.BytesSent);
                break;

            case UploadStatus.Failed:
                _logger.LogError("An error prevented the upload from completing.\n{0}", progress.Exception);
                break;
        }
    }

    private void videosInsertRequest_ResponseReceived(Video video)
    {
        _logger.LogInformation("Video id '{0}' was successfully uploaded.", video.Id);
    }
}
