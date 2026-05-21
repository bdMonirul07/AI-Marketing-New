using System.Text.Json;

namespace Backend.Services
{
    public class YouTubeAdsService
    {
        private readonly HttpClient _httpClient;

        public YouTubeAdsService(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        public async Task<string> CreateVideoCampaignAsync(string accessToken, string customerId, string developerToken, string campaignName, string adFormat, decimal budget, string status)
        {
            Console.WriteLine($"[YOUTUBE] Creating video campaign: {campaignName} (format: {adFormat})");

            // adFormat: IN_STREAM_SKIPPABLE, IN_STREAM_NON_SKIPPABLE, DISCOVERY, SHORTS, BUMPER

            var url = $"https://googleads.googleapis.com/v17/customers/{customerId}/campaigns:mutate";

            var requestBody = new
            {
                operations = new[]
                {
                    new
                    {
                        create = new
                        {
                            name = campaignName,
                            advertisingChannelType = "VIDEO",
                            advertisingChannelSubType = adFormat switch
                            {
                                "BUMPER" => "VIDEO_BUMPER",
                                "DISCOVERY" => "VIDEO_DISCOVERY",
                                "SHORTS" => "VIDEO_RESPONSIVE",
                                _ => "VIDEO_RESPONSIVE"
                            },
                            status = status,
                            campaignBudget = new { amountMicros = (long)(budget * 1_000_000) }
                        }
                    }
                }
            };

            try
            {
                var request = new HttpRequestMessage(HttpMethod.Post, url);
                request.Headers.Add("Authorization", $"Bearer {accessToken}");
                request.Headers.Add("developer-token", developerToken);
                request.Content = JsonContent.Create(requestBody);

                var response = await _httpClient.SendAsync(request);
                var responseBody = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                    throw new Exception($"YouTube Ads API Error: {response.StatusCode} | {responseBody}");

                Console.WriteLine($"[YOUTUBE SUCCESS] Video Campaign Created: {responseBody}");
                return responseBody;
            }
            catch (Exception ex) when (ex is not Exception { Message: var m } || !m.StartsWith("YouTube Ads API"))
            {
                Console.WriteLine($"[YOUTUBE] Simulating video campaign: {campaignName}");
                await Task.Delay(500);
                var mockResult = new
                {
                    resourceName = $"customers/{customerId}/campaigns/YT_SIM_{Guid.NewGuid().ToString()[..8]}",
                    campaignName,
                    adFormat,
                    status = "simulated"
                };
                return JsonSerializer.Serialize(mockResult);
            }
        }

        public async Task<string> CreateVideoAdGroupAsync(string accessToken, string customerId, string developerToken, string campaignResourceName, string adGroupName, string adFormat, decimal cpmBid)
        {
            Console.WriteLine($"[YOUTUBE] Creating video ad group: {adGroupName}");

            // Simulation
            await Task.Delay(300);
            var mockResult = new
            {
                resourceName = $"{campaignResourceName}/adGroups/YT_SIM_{Guid.NewGuid().ToString()[..8]}",
                adGroupName,
                adFormat,
                cpmBid
            };

            Console.WriteLine($"[YOUTUBE SUCCESS] Video Ad Group Created (simulated)");
            return JsonSerializer.Serialize(mockResult);
        }

        public async Task<string> CreateVideoAdAsync(string accessToken, string customerId, string developerToken, string adGroupResourceName, string videoId, string headline, string description, string displayUrl, string finalUrl, string companionBannerUrl)
        {
            Console.WriteLine($"[YOUTUBE] Creating video ad with video: {videoId}");

            // Simulation
            await Task.Delay(500);
            var mockResult = new
            {
                resourceName = $"{adGroupResourceName}/ads/YT_AD_SIM_{Guid.NewGuid().ToString()[..8]}",
                videoId,
                headline,
                description,
                finalUrl,
                status = "simulated"
            };

            Console.WriteLine($"[YOUTUBE SUCCESS] Video Ad Created (simulated)");
            return JsonSerializer.Serialize(mockResult);
        }

        public async Task<string> UploadVideoAsync(string accessToken, string videoPath, string title, string description)
        {
            Console.WriteLine($"[YOUTUBE] Uploading video: {videoPath}");

            // Simulation
            await Task.Delay(1000);
            var videoId = $"YT_VID_{Guid.NewGuid().ToString()[..8]}";
            var mockResult = new
            {
                id = videoId,
                title,
                status = "uploaded_simulated"
            };

            Console.WriteLine($"[YOUTUBE SUCCESS] Video Uploaded (simulated): {videoId}");
            return JsonSerializer.Serialize(mockResult);
        }
    }
}
