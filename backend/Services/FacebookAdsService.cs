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
        //private const string AccessToken = "EAAq4FS0qOlUBQ7P4MHufALG7ufEuIcbbfc1d448xsW4bSVwkqYPZApISJ8M0d7MslbDa1I0cI1igzQGIVoNi4SQetm3u6e0suXrkJrV5cLLuJNo2vyOmiLOZAZBcBgqMFOfXaVmh4ySNGvnECPD6ZCq9SSJxMujHBNUoGO2KX7H3uKmQPWhMcdFrHsZA6lAUrAnYZD"; // Facebook Sandbox Token
        private const string AccessToken = "EAAq4FS0qOlUBQ1ZBewZAURA6r9mGvxnIAoblZBYIV97ez8UfTxWUZAYsxH6QENtHJj1YlBZCrTBlddZC9SKRyMiXclutTCPwSsgUFwHbdcV6EGrXxfH1iRapjYIwiqZAOhxzgZAKt5vGYvx75dTetUZB4ZBStGY1liPs1eXRaiJ6KCQgeuP0Gcb0FMtJ3AP494XfjYM1g7yJ269GoZAU6hIIJiiDPAn337LLvz9jtAh4EF2D9jZCUxZAIPA7nC6ZBc10QrJS5CLbBzHx18TJmPqQZDZD"; // Facebook Sandbox Token
        private const string AdAccountId = "act_1284757253504222"; // আপনার স্যান্ডবক্স আইডি

        public FacebookAdsService(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        public async Task<string> CreateCampaignAsync(string campaignName, string objective, string status)
        {
            var url = $"https://graph.facebook.com/v19.0/{AdAccountId}/campaigns";
            var content = new FormUrlEncodedContent(new[]
            {
                new KeyValuePair<string, string>("name", campaignName),
                new KeyValuePair<string, string>("objective", objective),
                new KeyValuePair<string, string>("status", status),
                new KeyValuePair<string, string>("special_ad_categories", "[]"),
                new KeyValuePair<string, string>("access_token", AccessToken)
            });
            var response = await _httpClient.PostAsync(url, content);
            return await response.Content.ReadAsStringAsync();
        }

        public async Task<string> CreateAdSetAsync(string campaignId, string adSetName, long dailyBudget, string status)
        {
            var url = $"https://graph.facebook.com/v19.0/{AdAccountId}/adsets";
            
            // User feedback: optimization_goal should be LINK_CLICKS and targeting should be BD
            var content = new FormUrlEncodedContent(new[]
            {
                new KeyValuePair<string, string>("name", adSetName),
                new KeyValuePair<string, string>("campaign_id", campaignId),
                new KeyValuePair<string, string>("daily_budget", dailyBudget.ToString()),
                new KeyValuePair<string, string>("billing_event", "IMPRESSIONS"),
                new KeyValuePair<string, string>("optimization_goal", "LINK_CLICKS"),
                new KeyValuePair<string, string>("targeting", "{\"geo_locations\":{\"countries\":[\"BD\"]}}"),
                new KeyValuePair<string, string>("status", status),
                new KeyValuePair<string, string>("access_token", AccessToken)
            });
            var response = await _httpClient.PostAsync(url, content);
            return await response.Content.ReadAsStringAsync();
        }

        public async Task<string> UploadImageAsync(string imagePath)
        {
            var url = $"https://graph.facebook.com/v19.0/{AdAccountId}/adimages";
            
            if (!File.Exists(imagePath))
                throw new FileNotFoundException($"Image file not found: {imagePath}");

            using var content = new MultipartFormDataContent();
            var fileBytes = await File.ReadAllBytesAsync(imagePath);
            var fileContent = new ByteArrayContent(fileBytes);
            
            // Detect content type or default to image/jpeg
            string contentType = Path.GetExtension(imagePath).ToLower() == ".png" ? "image/png" : "image/jpeg";
            fileContent.Headers.ContentType = MediaTypeHeaderValue.Parse(contentType);
            
            content.Add(fileContent, "filename", Path.GetFileName(imagePath));
            content.Add(new StringContent(AccessToken), "access_token");

            var response = await _httpClient.PostAsync(url, content);
            return await response.Content.ReadAsStringAsync();
        }

        public async Task<string> CreateAdCreativeAsync(string creativeName, string pageId, string message, string link, string imageHash, string status)
        {
            var url = $"https://graph.facebook.com/v19.0/{AdAccountId}/adcreatives";
            
            // User requested explicit CTA and Link Data integration
            var objectStorySpec = new 
            {
                page_id = pageId,
                link_data = new 
                { 
                    message, 
                    link, 
                    image_hash = imageHash,
                    call_to_action = new 
                    { 
                        type = "LEARN_MORE",
                        value = new { link }
                    }
                }
            };
            
            var content = new FormUrlEncodedContent(new[]
            {
                new KeyValuePair<string, string>("name", creativeName),
                new KeyValuePair<string, string>("object_story_spec", JsonSerializer.Serialize(objectStorySpec)),
                new KeyValuePair<string, string>("status", status),
                new KeyValuePair<string, string>("access_token", AccessToken)
            });
            var response = await _httpClient.PostAsync(url, content);
            return await response.Content.ReadAsStringAsync();
        }

        public async Task<string> CreateAdAsync(string adName, string adSetId, string creativeId, string status)
        {
            var url = $"https://graph.facebook.com/v19.0/{AdAccountId}/ads";
            var content = new FormUrlEncodedContent(new[]
            {
                new KeyValuePair<string, string>("name", adName),
                new KeyValuePair<string, string>("adset_id", adSetId),
                new KeyValuePair<string, string>("creative", $"{{\"creative_id\":\"{creativeId}\"}}"),
                new KeyValuePair<string, string>("status", status),
                new KeyValuePair<string, string>("access_token", AccessToken)
            });
            var response = await _httpClient.PostAsync(url, content);
            return await response.Content.ReadAsStringAsync();
        }
    }
}
