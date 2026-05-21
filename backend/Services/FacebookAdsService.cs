using System.Net.Http;
using System.Net.Http.Headers;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Text.Json;
using System.IO;

namespace Backend.Services
{
    public class FacebookAdsService
    {
        private readonly HttpClient _httpClient;
        private readonly string _accessToken;
        private readonly string _adAccountId;

        public FacebookAdsService(HttpClient httpClient, IConfiguration config)
        {
            _httpClient = httpClient;
            _accessToken = config["Facebook:AccessToken"] ?? "";
            _adAccountId = config["Facebook:AdAccountId"] ?? "";
        }

        public async Task<string> GetAdAccountInfoAsync()
        {
            Console.WriteLine($"[FACEBOOK] Testing connection to Ad Account: {_adAccountId}");
            var url = $"https://graph.facebook.com/v19.0/{_adAccountId}?fields=name,account_status,currency&access_token={_accessToken}";
            
            var response = await _httpClient.GetAsync(url);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine($"[FACEBOOK ERROR] Connection Test Failed: {responseBody}");
                throw new Exception($"Facebook API Error (Account Info): {response.StatusCode} | {responseBody}");
            }

            Console.WriteLine($"[FACEBOOK SUCCESS] Connected to Account: {responseBody}");
            return responseBody;
        }

        public async Task<string> CreateCampaignAsync(string campaignName, string objective, string status)
        {
            Console.WriteLine($"[FACEBOOK] Creating campaign: {campaignName}");
            var url = $"https://graph.facebook.com/v19.0/{_adAccountId}/campaigns";
            var content = new FormUrlEncodedContent(new[]
            {
                new KeyValuePair<string, string>("name", campaignName),
                new KeyValuePair<string, string>("objective", objective),
                new KeyValuePair<string, string>("status", status),
                new KeyValuePair<string, string>("is_adset_budget_sharing_enabled", "false"), 
                new KeyValuePair<string, string>("special_ad_categories", "[]"), // Explicitly empty array
                new KeyValuePair<string, string>("access_token", _accessToken)
            });
            
            var response = await _httpClient.PostAsync(url, content);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine($"[FACEBOOK ERROR] Campaign Creation Failed: {responseBody}");
                throw new Exception($"Facebook API Error (Campaign): {response.StatusCode} | {responseBody}");
            }

            Console.WriteLine($"[FACEBOOK SUCCESS] Campaign Created: {responseBody}");
            return responseBody;
        }

        public async Task<string> CreateAdSetAsync(string campaignId, string adSetName, long dailyBudget, string status, string? targetingJson = null)
        {
            Console.WriteLine($"[FACEBOOK] Creating ad set: {adSetName}");
            var url = $"https://graph.facebook.com/v19.0/{_adAccountId}/adsets";
            
            var content = new FormUrlEncodedContent(new[]
            {
                new KeyValuePair<string, string>("name", adSetName),
                new KeyValuePair<string, string>("campaign_id", campaignId),
                new KeyValuePair<string, string>("daily_budget", dailyBudget.ToString()),
                new KeyValuePair<string, string>("billing_event", "IMPRESSIONS"),
                new KeyValuePair<string, string>("optimization_goal", "LINK_CLICKS"),
                new KeyValuePair<string, string>("bid_strategy", "LOWEST_COST_WITHOUT_CAP"),
                new KeyValuePair<string, string>("targeting", targetingJson ?? "{\"geo_locations\":{\"countries\":[\"BD\"]}}"),
                new KeyValuePair<string, string>("status", status),
                new KeyValuePair<string, string>("start_time", DateTime.Now.ToString("yyyy-MM-ddTHH:mm:ss+0600")),
                new KeyValuePair<string, string>("access_token", _accessToken)
            });

            var response = await _httpClient.PostAsync(url, content);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine($"[FACEBOOK ERROR] AdSet Creation Failed: {responseBody}");
                throw new Exception($"Facebook API Error (AdSet): {response.StatusCode} | {responseBody}");
            }

            Console.WriteLine($"[FACEBOOK SUCCESS] AdSet Created: {responseBody}");
            return responseBody;
        }

        public async Task<string> UploadVideoAsync(string videoPath)
        {
            Console.WriteLine($"[FACEBOOK] Uploading video: {videoPath}");
            var url = $"https://graph.facebook.com/v19.0/{_adAccountId}/advideos";
            
            if (!File.Exists(videoPath))
                throw new FileNotFoundException($"Video file not found: {videoPath}");

            using var content = new MultipartFormDataContent();
            var fileBytes = await File.ReadAllBytesAsync(videoPath);
            var fileContent = new ByteArrayContent(fileBytes);
            fileContent.Headers.ContentType = MediaTypeHeaderValue.Parse("video/mp4");
            
            content.Add(fileContent, "source", Path.GetFileName(videoPath));
            content.Add(new StringContent(_accessToken), "access_token");

            var response = await _httpClient.PostAsync(url, content);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine($"[FACEBOOK ERROR] Video Upload Failed: {responseBody}");
                throw new Exception($"Facebook API Error (Video Upload): {response.StatusCode} | {responseBody}");
            }

            Console.WriteLine($"[FACEBOOK SUCCESS] Video Uploaded: {responseBody}");
            return responseBody;
        }

        public async Task<string> UploadImageAsync(string imagePath)
        {
            Console.WriteLine($"[FACEBOOK] Uploading image: {imagePath}");
            var url = $"https://graph.facebook.com/v19.0/{_adAccountId}/adimages";
            
            if (!File.Exists(imagePath))
                throw new FileNotFoundException($"Image file not found: {imagePath}");

            using var content = new MultipartFormDataContent();
            var fileBytes = await File.ReadAllBytesAsync(imagePath);
            var fileContent = new ByteArrayContent(fileBytes);
            
            string contentType = Path.GetExtension(imagePath).ToLower() == ".png" ? "image/png" : "image/jpeg";
            fileContent.Headers.ContentType = MediaTypeHeaderValue.Parse(contentType);
            
            content.Add(fileContent, "filename", Path.GetFileName(imagePath));
            content.Add(new StringContent(_accessToken), "access_token");

            var response = await _httpClient.PostAsync(url, content);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine($"[FACEBOOK ERROR] Image Upload Failed: {responseBody}");
                throw new Exception($"Facebook API Error (Image Upload): {response.StatusCode} | {responseBody}");
            }

            Console.WriteLine($"[FACEBOOK SUCCESS] Image Uploaded: {responseBody}");
            return responseBody;
        }

        public async Task<string> CreateAdCreativeAsync(string creativeName, string pageId, string message, string link, string mediaId, bool isVideo, string? linkName = null)
        {
            Console.WriteLine($"[FACEBOOK] Creating ad creative (isVideo={isVideo}): {creativeName}");
            var url = $"https://graph.facebook.com/v19.0/{_adAccountId}/adcreatives";
            
            var cleanPageId = pageId?.Trim();
            object objectStorySpec;

            if (isVideo)
            {
                objectStorySpec = new
                {
                    page_id = cleanPageId,
                    video_data = new
                    {
                        video_id = mediaId,
                        message = message,
                        title = linkName ?? "Admission Open",
                        call_to_action = new { type = "LEARN_MORE", value = new { link } }
                    }
                };
            }
            else
            {
                var linkData = new Dictionary<string, object>
                {
                    { "message", message },
                    { "link", link },
                    { "name", linkName ?? "Admission Open" },
                    { "call_to_action", new { type = "LEARN_MORE", value = new { link } } }
                };

                if (!string.IsNullOrEmpty(mediaId) && mediaId != "YOUR_ACTUAL_IMAGE_HASH" && !mediaId.StartsWith("mock_"))
                {
                    linkData["image_hash"] = mediaId;
                }

                objectStorySpec = new
                {
                    page_id = cleanPageId,
                    link_data = linkData
                };
            }
            
            var content = new FormUrlEncodedContent(new[]
            {
                new KeyValuePair<string, string>("name", creativeName),
                new KeyValuePair<string, string>("object_story_spec", JsonSerializer.Serialize(objectStorySpec)),
                new KeyValuePair<string, string>("access_token", _accessToken)
            });

            var response = await _httpClient.PostAsync(url, content);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine($"[FACEBOOK ERROR] Creative Creation Failed: {responseBody}");
                throw new Exception($"Facebook API Error (Creative): {response.StatusCode} | {responseBody}");
            }

            Console.WriteLine($"[FACEBOOK SUCCESS] Creative Created: {responseBody}");
            return responseBody;
        }

        public async Task<string> CreateAdAsync(string adName, string adSetId, string creativeId, string status)
        {
            Console.WriteLine($"[FACEBOOK] Creating ad: {adName}");
            var url = $"https://graph.facebook.com/v19.0/{_adAccountId}/ads";
            var content = new FormUrlEncodedContent(new[]
            {
                new KeyValuePair<string, string>("name", adName),
                new KeyValuePair<string, string>("adset_id", adSetId),
                new KeyValuePair<string, string>("creative", $"{{\"creative_id\":\"{creativeId}\"}}"),
                new KeyValuePair<string, string>("status", status),
                new KeyValuePair<string, string>("access_token", _accessToken)
            });

            var response = await _httpClient.PostAsync(url, content);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine($"[FACEBOOK ERROR] Ad Creation Failed: {responseBody}");
                throw new Exception($"Facebook API Error (Ad): {response.StatusCode} | {responseBody}");
            }

            Console.WriteLine($"[FACEBOOK SUCCESS] Ad Created: {responseBody}");
            return responseBody;
        }
    }
}
