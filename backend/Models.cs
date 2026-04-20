using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;

namespace Backend.Models
{
    // ========================================================================
    // TABLE 1: companies (NEW - Multi-Tenancy Core)
    // ========================================================================
    [Table("companies")]
    public class Company
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("name")]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [Column("slug")]
        [MaxLength(100)]
        public string Slug { get; set; } = string.Empty;

        [Column("industry")]
        [MaxLength(100)]
        public string? Industry { get; set; }

        [Column("website")]
        [MaxLength(500)]
        public string? Website { get; set; }

        [Column("logo_url")]
        [MaxLength(500)]
        public string? LogoUrl { get; set; }

        [Column("email")]
        [MaxLength(200)]
        public string? Email { get; set; }

        [Column("phone")]
        [MaxLength(50)]
        public string? Phone { get; set; }

        [Column("address")]
        public string? Address { get; set; }

        [Column("country")]
        [MaxLength(100)]
        public string? Country { get; set; }

        [Column("timezone")]
        [MaxLength(50)]
        public string Timezone { get; set; } = "UTC";

        [Column("currency")]
        [MaxLength(10)]
        public string Currency { get; set; } = "USD";

        [Column("status")]
        [MaxLength(20)]
        public string Status { get; set; } = "active";

        [Column("subscription_plan")]
        [MaxLength(50)]
        public string SubscriptionPlan { get; set; } = "free";

        [Column("max_users")]
        public int MaxUsers { get; set; } = 10;

        [Column("max_campaigns")]
        public int MaxCampaigns { get; set; } = 50;

        [Column("created_by")]
        public int? CreatedBy { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        public CompanySetting? Settings { get; set; }
        public ICollection<User> Users { get; set; } = new List<User>();
        public ICollection<Role> Roles { get; set; } = new List<Role>();
        public ICollection<CompanyAdAccount> AdAccounts { get; set; } = new List<CompanyAdAccount>();
        public ICollection<Campaign> Campaigns { get; set; } = new List<Campaign>();
    }

    // ========================================================================
    // TABLE 2: company_settings (NEW)
    // ========================================================================
    [Table("company_settings")]
    public class CompanySetting
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("company_id")]
        public int CompanyId { get; set; }

        [Column("default_language")]
        [MaxLength(10)]
        public string DefaultLanguage { get; set; } = "en";

        [Column("notification_email")]
        [MaxLength(200)]
        public string? NotificationEmail { get; set; }

        [Column("max_daily_budget")]
        public decimal? MaxDailyBudget { get; set; }

        [Column("auto_approve_below")]
        public decimal? AutoApproveBelow { get; set; }

        [Column("require_cmo_approval")]
        public bool RequireCmoApproval { get; set; } = true;

        [Column("require_brand_check")]
        public bool RequireBrandCheck { get; set; } = false;

        [Column("default_bid_strategy")]
        [MaxLength(50)]
        public string DefaultBidStrategy { get; set; } = "lowest_cost";

        [Column("default_platforms", TypeName = "text[]")]
        public string[] DefaultPlatforms { get; set; } = new[] { "facebook" };

        [Column("gemini_api_key")]
        [MaxLength(500)]
        public string? GeminiApiKey { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("CompanyId")]
        public Company? Company { get; set; }
    }

    // ========================================================================
    // TABLE 3: company_ad_accounts (NEW)
    // ========================================================================
    [Table("company_ad_accounts")]
    public class CompanyAdAccount
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("company_id")]
        public int CompanyId { get; set; }

        [Required]
        [Column("platform")]
        [MaxLength(50)]
        public string Platform { get; set; } = string.Empty;

        [Column("account_name")]
        [MaxLength(200)]
        public string? AccountName { get; set; }

        [Required]
        [Column("account_id")]
        [MaxLength(200)]
        public string AccountId { get; set; } = string.Empty;

        [Required]
        [Column("access_token")]
        public string AccessToken { get; set; } = string.Empty;

        [Column("refresh_token")]
        public string? RefreshToken { get; set; }

        [Column("token_expires_at")]
        public DateTime? TokenExpiresAt { get; set; }

        [Column("page_id")]
        [MaxLength(200)]
        public string? PageId { get; set; }

        [Column("pixel_id")]
        [MaxLength(200)]
        public string? PixelId { get; set; }

        [Column("developer_token")]
        [MaxLength(200)]
        public string? DeveloperToken { get; set; }

        [Column("customer_id")]
        [MaxLength(200)]
        public string? CustomerId { get; set; }

        [Column("status")]
        [MaxLength(20)]
        public string Status { get; set; } = "active";

        [Column("last_tested_at")]
        public DateTime? LastTestedAt { get; set; }

        [Column("last_error")]
        public string? LastError { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("CompanyId")]
        public Company? Company { get; set; }
    }

    // ========================================================================
    // TABLE 4: users (MODIFIED)
    // ========================================================================
    [Table("users")]
    public class User
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("username")]
        [MaxLength(50)]
        public string? Username { get; set; }

        [Column("password_hash")]
        public string? PasswordHash { get; set; }

        [Column("email")]
        [MaxLength(200)]
        public string? Email { get; set; }

        [Column("first_name")]
        [MaxLength(100)]
        public string? FirstName { get; set; }

        [Column("last_name")]
        [MaxLength(100)]
        public string? LastName { get; set; }

        [Column("avatar_url")]
        [MaxLength(500)]
        public string? AvatarUrl { get; set; }

        [Column("phone")]
        [MaxLength(50)]
        public string? Phone { get; set; }

        [Column("role_id")]
        public int RoleId { get; set; }

        [Column("company_id")]
        public int? CompanyId { get; set; }

        [Column("is_super_admin")]
        public bool IsSuperAdmin { get; set; } = false;

        [Column("status")]
        [MaxLength(20)]
        public string Status { get; set; } = "active";

        [Column("last_login_at")]
        public DateTime? LastLoginAt { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("RoleId")]
        public Role? Role { get; set; }

        [ForeignKey("CompanyId")]
        public Company? Company { get; set; }
    }

    // ========================================================================
    // TABLE 5: roles (MODIFIED)
    // ========================================================================
    [Table("roles")]
    public class Role
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("name")]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        [Column("company_id")]
        public int? CompanyId { get; set; }

        [Column("description")]
        [MaxLength(500)]
        public string? Description { get; set; }

        [Column("is_system_role")]
        public bool IsSystemRole { get; set; } = false;

        [Column("color")]
        [MaxLength(50)]
        public string? Color { get; set; }

        [Column("icon")]
        [MaxLength(10)]
        public string? Icon { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("CompanyId")]
        public Company? Company { get; set; }
    }

    // ========================================================================
    // TABLE 6: screens (MODIFIED)
    // ========================================================================
    [Table("screens")]
    public class Screen
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("name")]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        [Column("display_name")]
        [MaxLength(200)]
        public string DisplayName { get; set; } = string.Empty;

        [Column("category")]
        [MaxLength(50)]
        public string? Category { get; set; }

        [Column("icon")]
        [MaxLength(20)]
        public string? Icon { get; set; }

        [Column("sort_order")]
        public int SortOrder { get; set; } = 0;

        [Column("is_active")]
        public bool IsActive { get; set; } = true;

        [Column("description")]
        [MaxLength(500)]
        public string? Description { get; set; }
    }

    // ========================================================================
    // TABLE 7: role_screens (MODIFIED)
    // ========================================================================
    [Table("role_screens")]
    public class RoleScreen
    {
        [Column("role_id")]
        public int RoleId { get; set; }

        [Column("screen_id")]
        public int ScreenId { get; set; }

        [Column("company_id")]
        public int? CompanyId { get; set; }

        [Column("granted_by")]
        public int? GrantedBy { get; set; }

        [Column("granted_at")]
        public DateTime GrantedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        public Role? Role { get; set; }
        public Screen? Screen { get; set; }

        [ForeignKey("CompanyId")]
        public Company? Company { get; set; }

        [ForeignKey("GrantedBy")]
        public User? GrantedByUser { get; set; }
    }

    // ========================================================================
    // TABLE 8b: user_screens (User-level permission overrides)
    // ========================================================================
    [Table("user_screens")]
    public class UserScreen
    {
        [Column("user_id")]
        public int UserId { get; set; }

        [Column("screen_id")]
        public int ScreenId { get; set; }

        [Column("company_id")]
        public int? CompanyId { get; set; }

        [Column("granted_by")]
        public int? GrantedBy { get; set; }

        [Column("granted_at")]
        public DateTime GrantedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("UserId")]
        public User? User { get; set; }

        public Screen? Screen { get; set; }

        [ForeignKey("CompanyId")]
        public Company? Company { get; set; }

        [ForeignKey("GrantedBy")]
        public User? GrantedByUser { get; set; }
    }

    // ========================================================================
    // TABLE 8: brand_guidelines (MODIFIED)
    // ========================================================================
    [Table("brand_guidelines")]
    public class BrandGuideline
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("company_id")]
        public int CompanyId { get; set; }

        [Column("brand_label")]
        public string? BrandLabel { get; set; }

        [Column("tone")]
        public string? Tone { get; set; }

        [Column("language")]
        public string? Language { get; set; }

        [Column("description")]
        public string? Description { get; set; }

        [Column("tagline")]
        [MaxLength(500)]
        public string? Tagline { get; set; }

        [Column("logo_url")]
        [MaxLength(500)]
        public string? LogoUrl { get; set; }

        [Column("whitelist")]
        public string? Whitelist { get; set; }

        [Column("blacklist")]
        public string? Blacklist { get; set; }

        [Column("voice_examples")]
        public string? VoiceExamples { get; set; }

        [Column("do_list")]
        public string? DoList { get; set; }

        [Column("dont_list")]
        public string? DontList { get; set; }

        [Column("typography", TypeName = "jsonb")]
        public JsonElement Typography { get; set; }

        [Column("palette")]
        public string[]? Palette { get; set; }

        [Column("created_by")]
        public int? CreatedBy { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("CompanyId")]
        public Company? Company { get; set; }

        [ForeignKey("CreatedBy")]
        public User? CreatedByUser { get; set; }
    }

    // ========================================================================
    // TABLE 9: campaign_objectives (NEW - Lookup)
    // ========================================================================
    [Table("campaign_objectives")]
    public class CampaignObjective
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("category")]
        [MaxLength(50)]
        public string Category { get; set; } = string.Empty;

        [Required]
        [Column("name")]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        [Column("description")]
        public string? Description { get; set; }

        [Column("icon")]
        [MaxLength(10)]
        public string? Icon { get; set; }

        [Column("platform_mapping", TypeName = "jsonb")]
        public JsonElement PlatformMapping { get; set; }

        [Column("supported_platforms", TypeName = "text[]")]
        public string[] SupportedPlatforms { get; set; } = new[] { "facebook", "tiktok" };

        [Column("sort_order")]
        public int SortOrder { get; set; } = 0;

        [Column("is_active")]
        public bool IsActive { get; set; } = true;
    }

    // ========================================================================
    // TABLE 10: campaigns (MODIFIED - Major)
    // ========================================================================
    [Table("campaigns")]
    public class Campaign
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("company_id")]
        public int CompanyId { get; set; }

        [Column("name")]
        [MaxLength(200)]
        public string? Name { get; set; }

        [Column("objective_id")]
        public int? ObjectiveId { get; set; }

        [Column("campaign_type")]
        [MaxLength(50)]
        public string CampaignType { get; set; } = "standard";

        [Column("brief")]
        public string? Brief { get; set; }

        [Column("style_preset")]
        public string? StylePreset { get; set; }

        [Column("aspect_ratio")]
        public string? AspectRatio { get; set; }

        [Column("total_budget")]
        public decimal? TotalBudget { get; set; }

        [Column("daily_budget")]
        public decimal? DailyBudget { get; set; }

        [Column("lifetime_budget")]
        public decimal? LifetimeBudget { get; set; }

        [Column("bid_strategy")]
        [MaxLength(50)]
        public string? BidStrategy { get; set; }

        [Column("currency")]
        [MaxLength(10)]
        public string Currency { get; set; } = "USD";

        [Column("start_date")]
        public DateTime? StartDate { get; set; }

        [Column("end_date")]
        public DateTime? EndDate { get; set; }

        [Column("platforms", TypeName = "text[]")]
        public string[] Platforms { get; set; } = Array.Empty<string>();

        [Column("targeting", TypeName = "jsonb")]
        public JsonElement? Targeting { get; set; }

        [Column("status")]
        [MaxLength(30)]
        public string Status { get; set; } = "draft";

        [Column("rejection_reason")]
        public string? RejectionReason { get; set; }

        [Column("created_by")]
        public int? CreatedBy { get; set; }

        [Column("approved_by")]
        public int? ApprovedBy { get; set; }

        [Column("deployed_by")]
        public int? DeployedBy { get; set; }

        [Column("approved_at")]
        public DateTime? ApprovedAt { get; set; }

        [Column("deployed_at")]
        public DateTime? DeployedAt { get; set; }

        [Column("completed_at")]
        public DateTime? CompletedAt { get; set; }

        // Dedicated Facebook campaign ID for stable UPSERT (also stored in platform_campaign_ids JSON)
        [Column("facebook_campaign_id")]
        [MaxLength(100)]
        public string? FacebookCampaignId { get; set; }

        // Stores platform-specific campaign IDs: {"facebook":"120240...","tiktok":"..."}
        [Column("platform_campaign_ids", TypeName = "jsonb")]
        public JsonElement? PlatformCampaignIds { get; set; }

        // CMO selects which platforms are eligible for live deployment (Stage 3 — task 3.2)
        [Column("eligible_platforms", TypeName = "text[]")]
        public string[] EligiblePlatforms { get; set; } = Array.Empty<string>();

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("CompanyId")]
        public Company? Company { get; set; }

        [ForeignKey("ObjectiveId")]
        public CampaignObjective? Objective { get; set; }

        [ForeignKey("CreatedBy")]
        public User? CreatedByUser { get; set; }

        [ForeignKey("ApprovedBy")]
        public User? ApprovedByUser { get; set; }

        [ForeignKey("DeployedBy")]
        public User? DeployedByUser { get; set; }

        public ICollection<AdSet> AdSets { get; set; } = new List<AdSet>();
        public ICollection<CampaignWorkflowStep> WorkflowSteps { get; set; } = new List<CampaignWorkflowStep>();
    }

    // ========================================================================
    // TABLE 11: ad_sets (NEW)
    // ========================================================================
    [Table("ad_sets")]
    public class AdSet
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("company_id")]
        public int CompanyId { get; set; }

        [Column("campaign_id")]
        public int CampaignId { get; set; }

        [Required]
        [Column("name")]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [Column("status")]
        [MaxLength(20)]
        public string Status { get; set; } = "draft";

        [Column("daily_budget")]
        public decimal? DailyBudget { get; set; }

        [Column("lifetime_budget")]
        public decimal? LifetimeBudget { get; set; }

        [Column("bid_strategy")]
        [MaxLength(50)]
        public string? BidStrategy { get; set; }

        [Column("bid_amount")]
        public decimal? BidAmount { get; set; }

        [Column("optimization_goal")]
        [MaxLength(50)]
        public string? OptimizationGoal { get; set; }

        [Column("billing_event")]
        [MaxLength(50)]
        public string BillingEvent { get; set; } = "IMPRESSIONS";

        [Column("start_time")]
        public DateTime? StartTime { get; set; }

        [Column("end_time")]
        public DateTime? EndTime { get; set; }

        [Column("targeting", TypeName = "jsonb")]
        public JsonElement? Targeting { get; set; }

        [Column("placements", TypeName = "jsonb")]
        public JsonElement? Placements { get; set; }

        [Column("schedule", TypeName = "jsonb")]
        public JsonElement? Schedule { get; set; }

        [Column("platform_adset_ids", TypeName = "jsonb")]
        public JsonElement? PlatformAdSetIds { get; set; }

        // Dedicated Facebook ad set ID for stable UPSERT
        [Column("facebook_ad_set_id")]
        [MaxLength(100)]
        public string? FacebookAdSetId { get; set; }

        [Column("created_by")]
        public int? CreatedBy { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("CompanyId")]
        public Company? Company { get; set; }

        [ForeignKey("CampaignId")]
        public Campaign? Campaign { get; set; }

        [ForeignKey("CreatedBy")]
        public User? CreatedByUser { get; set; }

        public ICollection<Ad> Ads { get; set; } = new List<Ad>();
    }

    // ========================================================================
    // TABLE 12: ads (NEW)
    // ========================================================================
    [Table("ads")]
    public class Ad
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("company_id")]
        public int CompanyId { get; set; }

        [Column("ad_set_id")]
        public int AdSetId { get; set; }

        [Required]
        [Column("name")]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [Column("status")]
        [MaxLength(20)]
        public string Status { get; set; } = "draft";

        [Column("headline")]
        [MaxLength(500)]
        public string? Headline { get; set; }

        [Column("description")]
        public string? Description { get; set; }

        [Column("cta_type")]
        [MaxLength(50)]
        public string? CtaType { get; set; }

        [Column("cta_link")]
        [MaxLength(1000)]
        public string? CtaLink { get; set; }

        [Column("platform_ad_ids", TypeName = "jsonb")]
        public JsonElement? PlatformAdIds { get; set; }

        // Dedicated Facebook ad ID for stable UPSERT
        [Column("facebook_ad_id")]
        [MaxLength(100)]
        public string? FacebookAdId { get; set; }

        [Column("review_status")]
        [MaxLength(20)]
        public string ReviewStatus { get; set; } = "pending";

        [Column("created_by")]
        public int? CreatedBy { get; set; }

        [Column("reviewed_by")]
        public int? ReviewedBy { get; set; }

        [Column("reviewed_at")]
        public DateTime? ReviewedAt { get; set; }

        [Column("review_notes")]
        public string? ReviewNotes { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("CompanyId")]
        public Company? Company { get; set; }

        [ForeignKey("AdSetId")]
        public AdSet? AdSet { get; set; }

        [ForeignKey("CreatedBy")]
        public User? CreatedByUser { get; set; }

        [ForeignKey("ReviewedBy")]
        public User? ReviewedByUser { get; set; }

        public ICollection<AdCreative> Creatives { get; set; } = new List<AdCreative>();
    }

    // ========================================================================
    // TABLE 13: ad_creatives (NEW)
    // ========================================================================
    [Table("ad_creatives")]
    public class AdCreative
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("company_id")]
        public int CompanyId { get; set; }

        [Column("ad_id")]
        public int AdId { get; set; }

        [Required]
        [Column("creative_type")]
        [MaxLength(30)]
        public string CreativeType { get; set; } = "image";

        [Required]
        [Column("asset_url")]
        [MaxLength(1000)]
        public string AssetUrl { get; set; } = string.Empty;

        [Column("asset_filename")]
        [MaxLength(500)]
        public string? AssetFilename { get; set; }

        [Column("thumbnail_url")]
        [MaxLength(1000)]
        public string? ThumbnailUrl { get; set; }

        [Column("primary_text")]
        public string? PrimaryText { get; set; }

        [Column("headline")]
        [MaxLength(500)]
        public string? Headline { get; set; }

        [Column("description")]
        public string? Description { get; set; }

        [Column("cta_type")]
        [MaxLength(50)]
        public string? CtaType { get; set; }

        [Column("cta_link")]
        [MaxLength(1000)]
        public string? CtaLink { get; set; }

        [Column("platform_creative_ids", TypeName = "jsonb")]
        public JsonElement? PlatformCreativeIds { get; set; }

        [Column("file_size_bytes")]
        public long? FileSizeBytes { get; set; }

        [Column("width")]
        public int? Width { get; set; }

        [Column("height")]
        public int? Height { get; set; }

        [Column("duration_seconds")]
        public int? DurationSeconds { get; set; }

        [Column("target_platform")]
        [MaxLength(50)]
        public string? TargetPlatform { get; set; }

        // Ad-level financial targets (Stage 2 — task 2.7)
        [Column("cost_per_result")]
        public decimal? CostPerResult { get; set; }

        [Column("target_cpa")]
        public decimal? TargetCpa { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("CompanyId")]
        public Company? Company { get; set; }

        [ForeignKey("AdId")]
        public Ad? Ad { get; set; }
    }

    // ========================================================================
    // TABLE 14: campaign_workflow_steps (NEW)
    // ========================================================================
    [Table("campaign_workflow_steps")]
    public class CampaignWorkflowStep
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("campaign_id")]
        public int CampaignId { get; set; }

        [Required]
        [Column("step_name")]
        [MaxLength(50)]
        public string StepName { get; set; } = string.Empty;

        [Column("step_order")]
        public int StepOrder { get; set; }

        [Column("status")]
        [MaxLength(20)]
        public string Status { get; set; } = "not_started";

        [Column("data", TypeName = "jsonb")]
        public JsonElement? Data { get; set; }

        [Column("notes")]
        public string? Notes { get; set; }

        [Column("completed_by")]
        public int? CompletedBy { get; set; }

        [Column("started_at")]
        public DateTime? StartedAt { get; set; }

        [Column("completed_at")]
        public DateTime? CompletedAt { get; set; }

        // Navigation
        [ForeignKey("CampaignId")]
        public Campaign? Campaign { get; set; }

        [ForeignKey("CompletedBy")]
        public User? CompletedByUser { get; set; }
    }

    // ========================================================================
    // TABLE 15: cmo_queue (MODIFIED)
    // ========================================================================
    [Table("cmo_queue")]
    public class CmoQueueItem
    {
        [Key]
        [Column("id")]
        public string Id { get; set; } = string.Empty;

        [Column("company_id")]
        public int CompanyId { get; set; }

        [Column("campaign_id")]
        public int? CampaignId { get; set; }

        [Column("ad_id")]
        public int? AdId { get; set; }

        [Column("url")]
        public string? Url { get; set; }

        [Column("title")]
        public string? Title { get; set; }

        [Column("type")]
        public string? Type { get; set; }

        [Column("status")]
        public string Status { get; set; } = "pending";

        [Column("priority")]
        public int Priority { get; set; } = 0;

        [Column("submitted_by")]
        public int? SubmittedBy { get; set; }

        [Column("reviewed_by")]
        public int? ReviewedBy { get; set; }

        [Column("reviewed_at")]
        public DateTime? ReviewedAt { get; set; }

        [Column("review_notes")]
        public string? ReviewNotes { get; set; }

        [Column("added_at")]
        public DateTime AddedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("CompanyId")]
        public Company? Company { get; set; }

        [ForeignKey("CampaignId")]
        public Campaign? Campaign { get; set; }

        [ForeignKey("SubmittedBy")]
        public User? SubmittedByUser { get; set; }

        [ForeignKey("ReviewedBy")]
        public User? ReviewedByUser { get; set; }
    }

    // ========================================================================
    // TABLE 16: ppp_queue (NEW - replaces ppc_queue.json)
    // ========================================================================
    [Table("ppp_queue")]
    public class PppQueueItem
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("company_id")]
        public int CompanyId { get; set; }

        [Column("campaign_id")]
        public int? CampaignId { get; set; }

        [Column("ad_id")]
        public int? AdId { get; set; }

        [Required]
        [Column("asset_filename")]
        [MaxLength(500)]
        public string AssetFilename { get; set; } = string.Empty;

        [Required]
        [Column("asset_url")]
        [MaxLength(1000)]
        public string AssetUrl { get; set; } = string.Empty;

        [Column("asset_type")]
        [MaxLength(20)]
        public string AssetType { get; set; } = "image";

        [Column("title")]
        [MaxLength(500)]
        public string? Title { get; set; }

        [Column("status")]
        [MaxLength(20)]
        public string Status { get; set; } = "pending";

        [Column("platform")]
        [MaxLength(50)]
        public string? Platform { get; set; }

        [Column("queue_index")]
        public int QueueIndex { get; set; } = 0;

        [Column("approved_by")]
        public int? ApprovedBy { get; set; }

        [Column("approved_at")]
        public DateTime? ApprovedAt { get; set; }

        [Column("deployed_by")]
        public int? DeployedBy { get; set; }

        [Column("deployed_at")]
        public DateTime? DeployedAt { get; set; }

        [Column("deploy_platforms", TypeName = "text[]")]
        public string[]? DeployPlatforms { get; set; }

        [Column("added_at")]
        public DateTime AddedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("CompanyId")]
        public Company? Company { get; set; }

        [ForeignKey("CampaignId")]
        public Campaign? Campaign { get; set; }

        [ForeignKey("ApprovedBy")]
        public User? ApprovedByUser { get; set; }

        [ForeignKey("DeployedBy")]
        public User? DeployedByUser { get; set; }
    }

    // ========================================================================
    // TABLE PPP_BUDGETS: ppp_ad_budgets (Stage 2)
    // ========================================================================
    [Table("ppp_ad_budgets")]
    public class PppAdBudget
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("company_id")]
        public int CompanyId { get; set; }

        [Column("ppp_queue_item_id")]
        public int PppQueueItemId { get; set; }

        [Column("platform")]
        [MaxLength(50)]
        public string Platform { get; set; } = string.Empty;

        [Column("daily_budget")]
        public decimal? DailyBudget { get; set; }

        [Column("lifetime_budget")]
        public decimal? LifetimeBudget { get; set; }

        [Column("cost_per_result")]
        public decimal? CostPerResult { get; set; }

        [Column("target_cpa")]
        public decimal? TargetCpa { get; set; }

        [Column("bid_amount")]
        public decimal? BidAmount { get; set; }

        [Column("bid_strategy")]
        [MaxLength(50)]
        public string? BidStrategy { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("CompanyId")]
        public Company? Company { get; set; }

        [ForeignKey("PppQueueItemId")]
        public PppQueueItem? PppQueueItem { get; set; }
    }

    // ========================================================================
    // TABLE 17: ad_metrics (NEW)
    // ========================================================================
    [Table("ad_metrics")]
    public class AdMetric
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("company_id")]
        public int CompanyId { get; set; }

        [Column("campaign_id")]
        public int CampaignId { get; set; }

        [Column("ad_set_id")]
        public int? AdSetId { get; set; }

        [Column("ad_id")]
        public int? AdId { get; set; }

        [Required]
        [Column("platform")]
        [MaxLength(50)]
        public string Platform { get; set; } = string.Empty;

        [Column("date", TypeName = "timestamp with time zone")]
        public DateTime Date { get; set; } = DateTime.UtcNow;

        [Column("impressions")]
        public long Impressions { get; set; } = 0;

        [Column("reach")]
        public long Reach { get; set; } = 0;

        [Column("clicks")]
        public long Clicks { get; set; } = 0;

        [Column("ctr")]
        public decimal Ctr { get; set; } = 0;

        [Column("cpc")]
        public decimal Cpc { get; set; } = 0;

        [Column("cpm")]
        public decimal Cpm { get; set; } = 0;

        [Column("spend")]
        public decimal Spend { get; set; } = 0;

        [Column("conversions")]
        public int Conversions { get; set; } = 0;

        [Column("conversion_value")]
        public decimal ConversionValue { get; set; } = 0;

        [Column("roas")]
        public decimal Roas { get; set; } = 0;

        [Column("frequency")]
        public decimal Frequency { get; set; } = 0;

        [Column("video_views")]
        public long? VideoViews { get; set; }

        [Column("video_completions")]
        public long? VideoCompletions { get; set; }

        [Column("leads")]
        public int? Leads { get; set; }

        [Column("app_installs")]
        public int? AppInstalls { get; set; }

        [Column("likes")]
        public long? Likes { get; set; }

        [Column("comments")]
        public long? Comments { get; set; }

        [Column("shares")]
        public long? Shares { get; set; }

        [Column("saves")]
        public long? Saves { get; set; }

        [Column("followers_gained")]
        public int? FollowersGained { get; set; }

        [Column("avg_watch_seconds")]
        public decimal? AvgWatchSeconds { get; set; }

        [Column("fetched_at")]
        public DateTime FetchedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("CompanyId")]
        public Company? Company { get; set; }

        [ForeignKey("CampaignId")]
        public Campaign? Campaign { get; set; }

        [ForeignKey("AdSetId")]
        public AdSet? AdSet { get; set; }

        [ForeignKey("AdId")]
        public Ad? Ad { get; set; }
    }

    // ========================================================================
    // TABLE: ad_metrics_summary — latest snapshot, refreshed after each fetch
    // ========================================================================
    [Table("ad_metrics_summary")]
    public class AdMetricSummary
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("company_id")]
        public int CompanyId { get; set; }

        [Column("campaign_id")]
        public int CampaignId { get; set; }

        [Column("ad_set_id")]
        public int? AdSetId { get; set; }

        [Column("ad_id")]
        public int? AdId { get; set; }

        [Required]
        [Column("platform")]
        [MaxLength(50)]
        public string Platform { get; set; } = string.Empty;

        [Column("date", TypeName = "timestamp with time zone")]
        public DateTime Date { get; set; } = DateTime.UtcNow;

        [Column("impressions")]
        public long Impressions { get; set; } = 0;

        [Column("reach")]
        public long Reach { get; set; } = 0;

        [Column("clicks")]
        public long Clicks { get; set; } = 0;

        [Column("ctr")]
        public decimal Ctr { get; set; } = 0;

        [Column("cpc")]
        public decimal Cpc { get; set; } = 0;

        [Column("cpm")]
        public decimal Cpm { get; set; } = 0;

        [Column("spend")]
        public decimal Spend { get; set; } = 0;

        [Column("conversions")]
        public int Conversions { get; set; } = 0;

        [Column("conversion_value")]
        public decimal ConversionValue { get; set; } = 0;

        [Column("roas")]
        public decimal Roas { get; set; } = 0;

        [Column("frequency")]
        public decimal Frequency { get; set; } = 0;

        [Column("video_views")]
        public long? VideoViews { get; set; }

        [Column("video_completions")]
        public long? VideoCompletions { get; set; }

        [Column("leads")]
        public int? Leads { get; set; }

        [Column("app_installs")]
        public int? AppInstalls { get; set; }

        [Column("likes")]
        public long? Likes { get; set; }

        [Column("comments")]
        public long? Comments { get; set; }

        [Column("shares")]
        public long? Shares { get; set; }

        [Column("saves")]
        public long? Saves { get; set; }

        [Column("followers_gained")]
        public int? FollowersGained { get; set; }

        [Column("avg_watch_seconds")]
        public decimal? AvgWatchSeconds { get; set; }

        [Column("fetched_at")]
        public DateTime FetchedAt { get; set; } = DateTime.UtcNow;
    }

    // ========================================================================
    // TABLE: platform_service_settings — persistent singleton row (id=1)
    // ========================================================================
    [Table("platform_service_settings")]
    public class PlatformServiceSetting
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("interval_hours")]
        public decimal IntervalHours { get; set; } = 4m;

        [Column("is_enabled")]
        public bool IsEnabled { get; set; } = true;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_by")]
        public int? UpdatedBy { get; set; }
    }

    // ========================================================================
    // TABLE 18: deployment_logs (NEW)
    // ========================================================================
    [Table("deployment_logs")]
    public class DeploymentLog
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("company_id")]
        public int CompanyId { get; set; }

        [Column("campaign_id")]
        public int CampaignId { get; set; }

        [Column("ad_set_id")]
        public int? AdSetId { get; set; }

        [Column("ad_id")]
        public int? AdId { get; set; }

        [Required]
        [Column("platform")]
        [MaxLength(50)]
        public string Platform { get; set; } = string.Empty;

        [Required]
        [Column("action")]
        [MaxLength(50)]
        public string Action { get; set; } = string.Empty;

        [Column("platform_resource_id")]
        [MaxLength(200)]
        public string? PlatformResourceId { get; set; }

        [Required]
        [Column("status")]
        [MaxLength(20)]
        public string Status { get; set; } = "pending";

        [Column("request_payload", TypeName = "jsonb")]
        public JsonElement? RequestPayload { get; set; }

        [Column("response_payload", TypeName = "jsonb")]
        public JsonElement? ResponsePayload { get; set; }

        [Column("error_message")]
        public string? ErrorMessage { get; set; }

        [Column("duration_ms")]
        public int? DurationMs { get; set; }

        [Column("executed_by")]
        public int ExecutedBy { get; set; }

        [Column("executed_at")]
        public DateTime ExecutedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("CompanyId")]
        public Company? Company { get; set; }

        [ForeignKey("CampaignId")]
        public Campaign? Campaign { get; set; }

        [ForeignKey("ExecutedBy")]
        public User? ExecutedByUser { get; set; }
    }

    // ========================================================================
    // TABLE 19: approval_comments (NEW)
    // ========================================================================
    [Table("approval_comments")]
    public class ApprovalComment
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("company_id")]
        public int CompanyId { get; set; }

        [Column("campaign_id")]
        public int CampaignId { get; set; }

        [Column("ad_id")]
        public int? AdId { get; set; }

        [Column("user_id")]
        public int UserId { get; set; }

        [Required]
        [Column("comment")]
        public string Comment { get; set; } = string.Empty;

        [Required]
        [Column("action")]
        [MaxLength(30)]
        public string Action { get; set; } = "comment";

        [Column("attachment_url")]
        [MaxLength(1000)]
        public string? AttachmentUrl { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("CompanyId")]
        public Company? Company { get; set; }

        [ForeignKey("CampaignId")]
        public Campaign? Campaign { get; set; }

        [ForeignKey("AdId")]
        public Ad? Ad { get; set; }

        [ForeignKey("UserId")]
        public User? User { get; set; }
    }

    // ========================================================================
    // TABLE 20: notifications (NEW)
    // ========================================================================
    [Table("notifications")]
    public class Notification
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("company_id")]
        public int CompanyId { get; set; }

        [Column("user_id")]
        public int UserId { get; set; }

        [Required]
        [Column("type")]
        [MaxLength(50)]
        public string Type { get; set; } = string.Empty;

        [Required]
        [Column("title")]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [Required]
        [Column("message")]
        public string Message { get; set; } = string.Empty;

        [Column("resource_type")]
        [MaxLength(50)]
        public string? ResourceType { get; set; }

        [Column("resource_id")]
        public int? ResourceId { get; set; }

        [Column("action_url")]
        [MaxLength(500)]
        public string? ActionUrl { get; set; }

        [Column("is_read")]
        public bool IsRead { get; set; } = false;

        [Column("read_at")]
        public DateTime? ReadAt { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("CompanyId")]
        public Company? Company { get; set; }

        [ForeignKey("UserId")]
        public User? User { get; set; }
    }

    // ========================================================================
    // TABLE 21: refresh_tokens (NEW)
    // ========================================================================
    [Table("refresh_tokens")]
    public class RefreshToken
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("user_id")]
        public int UserId { get; set; }

        [Required]
        [Column("token")]
        [MaxLength(500)]
        public string Token { get; set; } = string.Empty;

        [Column("expires_at")]
        public DateTime ExpiresAt { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("revoked_at")]
        public DateTime? RevokedAt { get; set; }

        [Column("replaced_by")]
        [MaxLength(500)]
        public string? ReplacedBy { get; set; }

        [Column("ip_address")]
        [MaxLength(50)]
        public string? IpAddress { get; set; }

        [Column("user_agent")]
        [MaxLength(500)]
        public string? UserAgent { get; set; }

        // Navigation
        [ForeignKey("UserId")]
        public User? User { get; set; }
    }

    // ========================================================================
    // TABLE 22: invitations (NEW)
    // ========================================================================
    [Table("invitations")]
    public class Invitation
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("company_id")]
        public int CompanyId { get; set; }

        [Required]
        [Column("email")]
        [MaxLength(200)]
        public string Email { get; set; } = string.Empty;

        [Column("role_id")]
        public int RoleId { get; set; }

        [Column("invited_by")]
        public int InvitedBy { get; set; }

        [Required]
        [Column("token")]
        [MaxLength(200)]
        public string Token { get; set; } = string.Empty;

        [Column("status")]
        [MaxLength(20)]
        public string Status { get; set; } = "pending";

        [Column("accepted_at")]
        public DateTime? AcceptedAt { get; set; }

        [Column("expires_at")]
        public DateTime ExpiresAt { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("CompanyId")]
        public Company? Company { get; set; }

        [ForeignKey("RoleId")]
        public Role? Role { get; set; }

        [ForeignKey("InvitedBy")]
        public User? InvitedByUser { get; set; }
    }

    // ========================================================================
    // TABLE 23: ab_tests (NEW)
    // ========================================================================
    [Table("ab_tests")]
    public class AbTest
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("company_id")]
        public int CompanyId { get; set; }

        [Column("campaign_id")]
        public int CampaignId { get; set; }

        [Required]
        [Column("name")]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [Column("variant_a_ad_id")]
        public int VariantAAdId { get; set; }

        [Column("variant_b_ad_id")]
        public int VariantBAdId { get; set; }

        [Required]
        [Column("metric")]
        [MaxLength(50)]
        public string Metric { get; set; } = "ctr";

        [Column("traffic_split")]
        public int TrafficSplit { get; set; } = 50;

        [Column("status")]
        [MaxLength(20)]
        public string Status { get; set; } = "draft";

        [Column("winner")]
        [MaxLength(5)]
        public string? Winner { get; set; }

        [Column("confidence_level")]
        public decimal? ConfidenceLevel { get; set; }

        [Column("variant_a_result")]
        public decimal? VariantAResult { get; set; }

        [Column("variant_b_result")]
        public decimal? VariantBResult { get; set; }

        [Column("created_by")]
        public int? CreatedBy { get; set; }

        [Column("started_at")]
        public DateTime? StartedAt { get; set; }

        [Column("ended_at")]
        public DateTime? EndedAt { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("CompanyId")]
        public Company? Company { get; set; }

        [ForeignKey("CampaignId")]
        public Campaign? Campaign { get; set; }

        [ForeignKey("VariantAAdId")]
        public Ad? VariantA { get; set; }

        [ForeignKey("VariantBAdId")]
        public Ad? VariantB { get; set; }

        [ForeignKey("CreatedBy")]
        public User? CreatedByUser { get; set; }
    }

    // ========================================================================
    // TABLE 24: budget_allocations (NEW)
    // ========================================================================
    [Table("budget_allocations")]
    public class BudgetAllocation
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("company_id")]
        public int CompanyId { get; set; }

        [Required]
        [Column("period_type")]
        [MaxLength(20)]
        public string PeriodType { get; set; } = "monthly";

        [Column("period_start")]
        public DateOnly PeriodStart { get; set; }

        [Column("period_end")]
        public DateOnly PeriodEnd { get; set; }

        [Column("total_budget")]
        public decimal TotalBudget { get; set; }

        [Column("facebook_allocation")]
        public decimal FacebookAllocation { get; set; } = 0;

        [Column("tiktok_allocation")]
        public decimal TiktokAllocation { get; set; } = 0;

        [Column("youtube_allocation")]
        public decimal YoutubeAllocation { get; set; } = 0;

        [Column("google_allocation")]
        public decimal GoogleAllocation { get; set; } = 0;

        [Column("spent_to_date")]
        public decimal SpentToDate { get; set; } = 0;

        [Column("status")]
        [MaxLength(20)]
        public string Status { get; set; } = "active";

        [Column("created_by")]
        public int? CreatedBy { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("CompanyId")]
        public Company? Company { get; set; }

        [ForeignKey("CreatedBy")]
        public User? CreatedByUser { get; set; }
    }

    // ========================================================================
    // TABLE 25: activity_logs (NEW)
    // ========================================================================
    [Table("activity_logs")]
    public class ActivityLog
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("company_id")]
        public int? CompanyId { get; set; }

        [Column("user_id")]
        public int UserId { get; set; }

        [Required]
        [Column("action")]
        [MaxLength(50)]
        public string Action { get; set; } = string.Empty;

        [Required]
        [Column("resource_type")]
        [MaxLength(50)]
        public string ResourceType { get; set; } = string.Empty;

        [Column("resource_id")]
        [MaxLength(50)]
        public string? ResourceId { get; set; }

        [Column("description")]
        public string? Description { get; set; }

        [Column("details", TypeName = "jsonb")]
        public JsonElement? Details { get; set; }

        [Column("ip_address")]
        [MaxLength(50)]
        public string? IpAddress { get; set; }

        [Column("user_agent")]
        [MaxLength(500)]
        public string? UserAgent { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("CompanyId")]
        public Company? Company { get; set; }

        [ForeignKey("UserId")]
        public User? User { get; set; }
    }

    // ========================================================================
    // TABLE 26: campaign_templates (NEW)
    // ========================================================================
    [Table("campaign_templates")]
    public class CampaignTemplate
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("company_id")]
        public int? CompanyId { get; set; }

        [Required]
        [Column("name")]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [Column("description")]
        public string? Description { get; set; }

        [Column("objective_id")]
        public int? ObjectiveId { get; set; }

        [Column("targeting", TypeName = "jsonb")]
        public JsonElement? Targeting { get; set; }

        [Column("budget_config", TypeName = "jsonb")]
        public JsonElement? BudgetConfig { get; set; }

        [Column("creative_specs", TypeName = "jsonb")]
        public JsonElement? CreativeSpecs { get; set; }

        [Column("platforms", TypeName = "text[]")]
        public string[]? Platforms { get; set; }

        [Column("is_global")]
        public bool IsGlobal { get; set; } = false;

        [Column("created_by")]
        public int? CreatedBy { get; set; }

        [Column("use_count")]
        public int UseCount { get; set; } = 0;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("CompanyId")]
        public Company? Company { get; set; }

        [ForeignKey("ObjectiveId")]
        public CampaignObjective? Objective { get; set; }

        [ForeignKey("CreatedBy")]
        public User? CreatedByUser { get; set; }
    }

    // ========================================================================
    // TABLE 27: audience_templates (NEW)
    // ========================================================================
    [Table("audience_templates")]
    public class AudienceTemplate
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("company_id")]
        public int CompanyId { get; set; }

        [Required]
        [Column("name")]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [Column("description")]
        public string? Description { get; set; }

        [Required]
        [Column("targeting", TypeName = "jsonb")]
        public JsonElement Targeting { get; set; }

        [Column("estimated_size")]
        public long? EstimatedSize { get; set; }

        [Column("created_by")]
        public int? CreatedBy { get; set; }

        [Column("use_count")]
        public int UseCount { get; set; } = 0;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("CompanyId")]
        public Company? Company { get; set; }

        [ForeignKey("CreatedBy")]
        public User? CreatedByUser { get; set; }
    }

    // ========================================================================
    // TABLE 28: asset_library (NEW)
    // ========================================================================
    [Table("asset_library")]
    public class AssetLibraryItem
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("company_id")]
        public int CompanyId { get; set; }

        [Required]
        [Column("filename")]
        [MaxLength(500)]
        public string Filename { get; set; } = string.Empty;

        [Column("original_name")]
        [MaxLength(500)]
        public string? OriginalName { get; set; }

        [Required]
        [Column("file_path")]
        [MaxLength(1000)]
        public string FilePath { get; set; } = string.Empty;

        [Required]
        [Column("file_url")]
        [MaxLength(1000)]
        public string FileUrl { get; set; } = string.Empty;

        [Required]
        [Column("file_type")]
        [MaxLength(20)]
        public string FileType { get; set; } = "image";

        [Column("mime_type")]
        [MaxLength(100)]
        public string? MimeType { get; set; }

        [Column("file_size_bytes")]
        public long? FileSizeBytes { get; set; }

        [Column("width")]
        public int? Width { get; set; }

        [Column("height")]
        public int? Height { get; set; }

        [Column("duration_seconds")]
        public int? DurationSeconds { get; set; }

        [Column("folder")]
        [MaxLength(50)]
        public string Folder { get; set; } = "assets";

        [Column("tags", TypeName = "text[]")]
        public string[]? Tags { get; set; }

        [Column("status")]
        [MaxLength(20)]
        public string Status { get; set; } = "active";

        [Column("uploaded_by")]
        public int? UploadedBy { get; set; }

        [Column("uploaded_at")]
        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("CompanyId")]
        public Company? Company { get; set; }

        [ForeignKey("UploadedBy")]
        public User? UploadedByUser { get; set; }
    }

    // ========================================================================
    // TABLE 29: cmo_approval_logs (Stage 3 — audit trail)
    // ========================================================================
    [Table("cmo_approval_logs")]
    public class CmoApprovalLog
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("company_id")]
        public int CompanyId { get; set; }

        [Column("campaign_id")]
        public int? CampaignId { get; set; }

        [Column("approved_by")]
        public int? ApprovedBy { get; set; }

        [Column("approved_at")]
        public DateTime ApprovedAt { get; set; } = DateTime.UtcNow;

        [Column("platforms_deployed", TypeName = "text[]")]
        public string[] PlatformsDeployed { get; set; } = Array.Empty<string>();

        [Column("total_budget_approved")]
        public decimal TotalBudgetApproved { get; set; }

        [Column("items_deployed")]
        public int ItemsDeployed { get; set; }

        [Column("notes")]
        public string? Notes { get; set; }

        [ForeignKey("CompanyId")]
        public Company? Company { get; set; }

        [ForeignKey("CampaignId")]
        public Campaign? Campaign { get; set; }

        [ForeignKey("ApprovedBy")]
        public User? ApprovedByUser { get; set; }
    }

    // ========================================================================
    // TABLE: campaign_platform_specs — per-platform asset strategy (Stage 1)
    // ========================================================================
    [Table("campaign_platform_specs")]
    public class CampaignPlatformSpec
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("campaign_id")]
        public int CampaignId { get; set; }

        [Column("company_id")]
        public int CompanyId { get; set; }

        [Required]
        [Column("platform")]
        [MaxLength(50)]
        public string Platform { get; set; } = string.Empty;

        [Column("aspect_ratios", TypeName = "text[]")]
        public string[] AspectRatios { get; set; } = Array.Empty<string>();

        [Column("image_count")]
        public int ImageCount { get; set; }

        [Column("video_count")]
        public int VideoCount { get; set; }

        [Column("video_durations", TypeName = "text[]")]
        public string[] VideoDurations { get; set; } = Array.Empty<string>();

        [Column("primary_text_template")]
        public string? PrimaryTextTemplate { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("CampaignId")]
        public Campaign? Campaign { get; set; }
    }

    // ========================================================================
    // REQUEST / RESPONSE RECORDS
    // ========================================================================

    // Auth
    public record RegisterRequest(string Username, string Password, string Email, int RoleId, int? CompanyId = null);
    public record LoginRequest(string Email, string Password);
    public record RefreshTokenRequest(string RefreshToken);

    // Super Admin
    public record CreateCompanyRequest(string Name, string? Industry, string? Website, string? Email, string? Country);
    public record UpdateCompanyRequest(string? Name, string? Industry, string? Website, string? Email, string? Status);
    public record CompanyOnboardRequest(string CompanyName, string? Industry, string? Website, string AdminUsername, string AdminPassword, string AdminEmail);
    public record PlatformServiceIntervalRequest(double IntervalHours);

    // RBAC
    public record RolePermissionsRequest(int RoleId, List<int> ScreenIds);
    public record UserPermissionsRequest(int UserId, List<int> ScreenIds);

    // Campaigns
    public record CreateCampaignRequest(string Name, int? ObjectiveId, string? Brief, string? StylePreset, string? AspectRatio, decimal? TotalBudget, decimal? DailyBudget, string? BidStrategy, string[]? Platforms);
    public record UpdateCampaignRequest(string? Name, int? ObjectiveId, string? Brief, string? StylePreset, string? AspectRatio, decimal? TotalBudget, decimal? DailyBudget, string? BidStrategy, string? Status, string[]? Platforms, string[]? EligiblePlatforms, DateTime? StartDate, DateTime? EndDate);
    public record CampaignRejectRequest(string Reason);

    // Ad Sets
    public record CreateAdSetRequest(string Name, decimal? DailyBudget, decimal? LifetimeBudget, string? BidStrategy, decimal? BidAmount, string? OptimizationGoal, DateTime? StartTime, DateTime? EndTime);
    public record UpdateAdSetRequest(string? Name, decimal? DailyBudget, decimal? LifetimeBudget, string? BidStrategy, decimal? BidAmount, string? OptimizationGoal, string? Status, DateTime? StartTime, DateTime? EndTime);

    // Ads
    public record CreateAdRequest(string Name, string? Headline, string? Description, string? CtaType, string? CtaLink);
    public record UpdateAdRequest(string? Name, string? Headline, string? Description, string? CtaType, string? CtaLink, string? Status);
    public record AdReviewRequest(string Action, string? Notes);

    // Approval Comments
    public record CreateCommentRequest(int CampaignId, int? AdId, string Comment, string Action);

    // Notifications
    public record MarkReadRequest(int[] NotificationIds);

    // Invitations
    public record CreateInvitationRequest(string Email, int RoleId);
    public record AcceptInvitationRequest(string Username, string Password);

    // A/B Tests
    public record CreateAbTestRequest(int CampaignId, string Name, int VariantAAdId, int VariantBAdId, string Metric, int TrafficSplit);

    // Budget
    public record CreateBudgetRequest(string PeriodType, DateOnly PeriodStart, DateOnly PeriodEnd, decimal TotalBudget, decimal FacebookAllocation, decimal TiktokAllocation, decimal YoutubeAllocation, decimal GoogleAllocation);

    // Templates
    public record CreateTemplateRequest(string Name, string? Description, int? ObjectiveId, string[]? Platforms);
    public record CreateAudienceTemplateRequest(string Name, string? Description);

    // Assets
    public record SaveAssetRequest(string Url, string Filename);
    public record ApproveAssetRequest(string Filename);

    // Deploy
    public record UnifiedDeployRequest(int CampaignId, string[] Platforms, bool DryRun);

    public record TikTokDeployRequest(TikTokAdGroupRequest group, TikTokCreativeRequest creative);
    public record TikTokAdGroupRequest(string advertiser_id, string campaign_id, string adgroup_name, string placement_type, string[] placement, string promotion_type, string budget_mode, decimal budget, string schedule_type, string schedule_start_time, string schedule_end_time, string billing_event, string optimization_goal, string pacing, string bid_type, decimal bid, TikTokTargeting targeting, string? pixel_id, string status);
    public record TikTokCreativeRequest(string ad_name, string display_name, string video_id, string ad_text, string? identity_id, string call_to_action);
    public record TikTokTargeting(GeoLocations geo_locations, string[] age_groups, string[] genders, string[] languages);
    public record GeoLocations(string[] countries);

    public record FacebookDeployRequest(FacebookCampaignPayload campaign, FacebookAdSetPayload adSet, FacebookCreativePayload creative, string assetId, int? campaignDbId = null);
    public record FacebookCampaignPayload(string name, string objective, string status, string[] special_ad_categories);
    public record FacebookAdSetPayload(string name, long daily_budget, string billing_event, string optimization_goal, string start_time, string end_time, object targeting, string status);
    public record FacebookCreativePayload(string name, FacebookObjectStorySpec object_story_spec, string status);
    public record FacebookObjectStorySpec(string page_id, FacebookLinkData link_data);
    public record FacebookLinkData(string message, string link, string image_hash, string name);

    // Gemini
    public record GeminiRequest(string Brief);
    public record GeminiFollowUpRequest(string OriginalBrief, string[] PreviousQuestions, string[] PreviousAnswers);

    // Platform Specs (Stage 1)
    public record SavePlatformSpecRequest(string Platform, string[] AspectRatios, int ImageCount, int VideoCount, string[] VideoDurations, string? PrimaryTextTemplate);
    public record GenerateAssetsRequest(string? Brief);

    // Stage 2 — PPP Budget Allocation
    public record SavePppBudgetRequest(int PppQueueItemId, decimal? DailyBudget, decimal? LifetimeBudget, decimal? CostPerResult, decimal? TargetCpa, decimal? BidAmount, string? BidStrategy);
    public record SubmitForApprovalRequest(int[] QueueItemIds);

    // Stage 3 — CMO Approve & Deploy
    public record CmoApproveDeployRequest(int[] PppQueueItemIds, bool DryRun = false);

    // Search
    public record SearchRequest(string Query);
}
