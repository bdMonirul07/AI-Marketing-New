using System.ComponentModel.DataAnnotations;

namespace backend.Models;

public class CampaignBrief
{
    public int Id { get; set; }
    public string Objective { get; set; } = string.Empty; // Reach, Click, Sell
    public List<string> ContentTypes { get; set; } = new(); // Post, Image, Video
    public string Readiness { get; set; } = string.Empty; // Ready, Partially ready, Scratch
    
    // Extracted/Refined Info
    public string ProductServiceInfo { get; set; } = string.Empty;
    public string USP { get; set; } = string.Empty;
    public string CTA { get; set; } = string.Empty;
    public string TargetPersona { get; set; } = string.Empty;
    public string ToneStyle { get; set; } = string.Empty;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class TargetingProfile
{
    public int Id { get; set; }
    public int CampaignBriefId { get; set; }
    public string Location { get; set; } = string.Empty;
    public string AgeRange { get; set; } = string.Empty;
    public string Gender { get; set; } = string.Empty;
    public List<string> Interests { get; set; } = new();
    
    public decimal DailyBudget { get; set; }
    public decimal TotalBudget { get; set; }
    public int DurationDays { get; set; }
    
    public List<string> SelectedPlatforms { get; set; } = new();
}

public class CreativeAsset
{
    public int Id { get; set; }
    public int CampaignBriefId { get; set; }
    public string AssetType { get; set; } = string.Empty; // Image, Video, Copy
    public string Source { get; set; } = string.Empty; // Upload, Generated
    public string ContentUrl { get; set; } = string.Empty; 
    public string PromptUsed { get; set; } = string.Empty;
    public bool IsFinal { get; set; }
}

public class DistributionPlan
{
    public int Id { get; set; }
    public int CampaignBriefId { get; set; }
    public string Platform { get; set; } = string.Empty;
    public decimal AllocatedBudget { get; set; }
    public string Schedule { get; set; } = string.Empty;
}

public class ExecutionRun
{
    public int Id { get; set; }
    public int CampaignBriefId { get; set; }
    public DateTime LaunchDate { get; set; }
    public string Status { get; set; } = string.Empty; // Draft, Live, Completed
}
