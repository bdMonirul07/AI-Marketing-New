using Backend.Data;
using Backend.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend.Services
{
    // Task 74: Brand Compliance Checker
    public class BrandComplianceService
    {
        private readonly IServiceProvider _serviceProvider;

        public BrandComplianceService(IServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider;
        }

        public async Task<ComplianceResult> CheckCompliance(int companyId, string? headline, string? description, string? primaryText)
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var guideline = await db.BrandGuidelines
                .Where(g => g.CompanyId == companyId)
                .OrderByDescending(g => g.UpdatedAt)
                .FirstOrDefaultAsync();

            if (guideline == null)
                return new ComplianceResult { Score = 100, Violations = new List<string>(), Message = "No brand guidelines configured" };

            var allText = $"{headline} {description} {primaryText}".ToLower();
            var violations = new List<string>();
            int score = 100;

            // Check blacklisted words
            if (!string.IsNullOrEmpty(guideline.Blacklist))
            {
                var blackWords = guideline.Blacklist.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                foreach (var word in blackWords)
                {
                    if (allText.Contains(word.ToLower()))
                    {
                        violations.Add($"Blacklisted word found: \"{word}\"");
                        score -= 15;
                    }
                }
            }

            // Check whitelisted terms (should be present)
            if (!string.IsNullOrEmpty(guideline.Whitelist))
            {
                var whiteWords = guideline.Whitelist.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                int found = 0;
                foreach (var word in whiteWords)
                {
                    if (allText.Contains(word.ToLower())) found++;
                }
                if (whiteWords.Length > 0 && found == 0)
                {
                    violations.Add("No whitelisted brand terms found in copy");
                    score -= 10;
                }
            }

            // Tone check (basic heuristic)
            if (!string.IsNullOrEmpty(guideline.Tone))
            {
                var tone = guideline.Tone.ToLower();
                if (tone == "professional" && (allText.Contains("!!!") || allText.Contains("omg") || allText.Contains("lol")))
                {
                    violations.Add("Tone violation: informal language detected in professional brand");
                    score -= 10;
                }
                if (tone == "casual" && allText.Length > 500)
                {
                    violations.Add("Tone suggestion: casual brands typically use shorter copy");
                    score -= 5;
                }
            }

            // Length checks
            if (!string.IsNullOrEmpty(headline) && headline.Length > 200)
            {
                violations.Add("Headline exceeds 200 characters");
                score -= 5;
            }

            score = Math.Max(0, score);

            return new ComplianceResult
            {
                Score = score,
                Violations = violations,
                Message = score >= 80 ? "Compliant" : score >= 50 ? "Needs Review" : "Non-Compliant",
                BrandLabel = guideline.BrandLabel,
                Tone = guideline.Tone
            };
        }
    }

    public class ComplianceResult
    {
        public int Score { get; set; }
        public List<string> Violations { get; set; } = new();
        public string Message { get; set; } = string.Empty;
        public string? BrandLabel { get; set; }
        public string? Tone { get; set; }
    }
}
