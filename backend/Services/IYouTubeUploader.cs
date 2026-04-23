using Microsoft.AspNetCore.Http;

namespace backend.Services;

public interface IYouTubeUploader
{
    Task<string> AuthorizeAsync();
    Task<string> UploadVideoAsync(string filePath, string title, string description, string[] tags, string privacyStatus = "private");
}
