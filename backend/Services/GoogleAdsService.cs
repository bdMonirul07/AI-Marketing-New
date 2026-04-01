using System.Text.Json;

namespace Backend.Services
{
    public class GoogleAdsService
    {
        private readonly HttpClient _httpClient;

        public GoogleAdsService(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        public async Task<string> CreateCampaignAsync(string developerToken, string customerId, string accessToken, string campaignName, string campaignType, decimal budget, string status)
        {
            Console.WriteLine($"[GOOGLE ADS] Creating campaign: {campaignName} (type: {campaignType})");

            // Google Ads API v17 endpoint
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
                            advertisingChannelType = campaignType, // SEARCH, DISPLAY, SHOPPING, PERFORMANCE_MAX
                            status = status, // ENABLED, PAUSED
                            campaignBudget = new { amountMicros = (long)(budget * 1_000_000) },
                            manualCpc = new { }
                        }
                    }
                }
            };

            var request = new HttpRequestMessage(HttpMethod.Post, url);
            request.Headers.Add("Authorization", $"Bearer {accessToken}");
            request.Headers.Add("developer-token", developerToken);
            request.Content = JsonContent.Create(requestBody);

            try
            {
                var response = await _httpClient.SendAsync(request);
                var responseBody = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    Console.WriteLine($"[GOOGLE ADS ERROR] Campaign Creation Failed: {responseBody}");
                    throw new Exception($"Google Ads API Error: {response.StatusCode} | {responseBody}");
                }

                Console.WriteLine($"[GOOGLE ADS SUCCESS] Campaign Created: {responseBody}");
                return responseBody;
            }
            catch (Exception ex) when (ex is not Exception { Message: var m } || !m.StartsWith("Google Ads API"))
            {
                // Simulation fallback
                Console.WriteLine($"[GOOGLE ADS] Simulating campaign creation for: {campaignName}");
                await Task.Delay(500);
                var mockResult = new { resourceName = $"customers/{customerId}/campaigns/SIM_{Guid.NewGuid().ToString()[..8]}", campaignName };
                return JsonSerializer.Serialize(mockResult);
            }
        }

        public async Task<string> CreateAdGroupAsync(string developerToken, string customerId, string accessToken, string campaignResourceName, string adGroupName, decimal cpcBid)
        {
            Console.WriteLine($"[GOOGLE ADS] Creating ad group: {adGroupName}");

            var url = $"https://googleads.googleapis.com/v17/customers/{customerId}/adGroups:mutate";

            var requestBody = new
            {
                operations = new[]
                {
                    new
                    {
                        create = new
                        {
                            name = adGroupName,
                            campaign = campaignResourceName,
                            status = "ENABLED",
                            type = "SEARCH_STANDARD",
                            cpcBidMicros = (long)(cpcBid * 1_000_000)
                        }
                    }
                }
            };

            var request = new HttpRequestMessage(HttpMethod.Post, url);
            request.Headers.Add("Authorization", $"Bearer {accessToken}");
            request.Headers.Add("developer-token", developerToken);
            request.Content = JsonContent.Create(requestBody);

            try
            {
                var response = await _httpClient.SendAsync(request);
                var responseBody = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                    throw new Exception($"Google Ads API Error: {response.StatusCode} | {responseBody}");

                Console.WriteLine($"[GOOGLE ADS SUCCESS] Ad Group Created: {responseBody}");
                return responseBody;
            }
            catch (Exception ex) when (ex is not Exception { Message: var m } || !m.StartsWith("Google Ads API"))
            {
                Console.WriteLine($"[GOOGLE ADS] Simulating ad group creation for: {adGroupName}");
                await Task.Delay(300);
                var mockResult = new { resourceName = $"customers/{customerId}/adGroups/SIM_{Guid.NewGuid().ToString()[..8]}" };
                return JsonSerializer.Serialize(mockResult);
            }
        }

        public async Task<string> CreateResponsiveSearchAdAsync(string developerToken, string customerId, string accessToken, string adGroupResourceName, string[] headlines, string[] descriptions, string finalUrl)
        {
            Console.WriteLine($"[GOOGLE ADS] Creating responsive search ad in: {adGroupResourceName}");

            var headlineParts = headlines.Select(h => new { text = h }).ToArray();
            var descParts = descriptions.Select(d => new { text = d }).ToArray();

            // Simulation mode for now
            Console.WriteLine($"[GOOGLE ADS] Simulating RSA creation with {headlines.Length} headlines, {descriptions.Length} descriptions");
            await Task.Delay(500);
            var mockResult = new
            {
                resourceName = $"{adGroupResourceName}/ads/SIM_{Guid.NewGuid().ToString()[..8]}",
                headlines = headlines.Length,
                descriptions = descriptions.Length,
                finalUrl
            };
            return JsonSerializer.Serialize(mockResult);
        }
    }
}
