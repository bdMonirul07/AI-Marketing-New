using Microsoft.EntityFrameworkCore;
using Backend.Models;

namespace Backend.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        // ── Multi-Tenancy ──
        public DbSet<Company> Companies { get; set; }
        public DbSet<CompanySetting> CompanySettings { get; set; }
        public DbSet<CompanyAdAccount> CompanyAdAccounts { get; set; }

        // ── Auth & RBAC ──
        public DbSet<User> Users { get; set; }
        public DbSet<Role> Roles { get; set; }
        public DbSet<Screen> Screens { get; set; }
        public DbSet<RoleScreen> RoleScreens { get; set; }
        public DbSet<UserScreen> UserScreens { get; set; }
        public DbSet<RefreshToken> RefreshTokens { get; set; }

        // ── Campaign Core ──
        public DbSet<CampaignObjective> CampaignObjectives { get; set; }
        public DbSet<Campaign> Campaigns { get; set; }
        public DbSet<AdSet> AdSets { get; set; }
        public DbSet<Ad> Ads { get; set; }
        public DbSet<AdCreative> AdCreatives { get; set; }
        public DbSet<CampaignWorkflowStep> CampaignWorkflowSteps { get; set; }
        public DbSet<CampaignPlatformSpec> CampaignPlatformSpecs { get; set; }

        // ── Workflow Queues ──
        public DbSet<CmoQueueItem> CmoQueue { get; set; }
        public DbSet<PppQueueItem> PppQueue { get; set; }
        public DbSet<PppAdBudget> PppAdBudgets { get; set; } = null!;
        public DbSet<ApprovalComment> ApprovalComments { get; set; }

        // ── Analytics ──
        public DbSet<AdMetric> AdMetrics { get; set; }
        public DbSet<AdMetricSummary> AdMetricsSummary { get; set; }
        public DbSet<DeploymentLog> DeploymentLogs { get; set; }

        // ── Features ──
        public DbSet<BrandGuideline> BrandGuidelines { get; set; }
        public DbSet<AbTest> AbTests { get; set; }
        public DbSet<BudgetAllocation> BudgetAllocations { get; set; }
        public DbSet<CampaignTemplate> CampaignTemplates { get; set; }
        public DbSet<AudienceTemplate> AudienceTemplates { get; set; }

        // ── System ──
        public DbSet<Notification> Notifications { get; set; }
        public DbSet<ActivityLog> ActivityLogs { get; set; }
        public DbSet<Invitation> Invitations { get; set; }

        // ── Assets ──
        public DbSet<AssetLibraryItem> AssetLibrary { get; set; }

        // ── Stage 3 Audit ──
        public DbSet<CmoApprovalLog> CmoApprovalLogs { get; set; } = null!;

        // ── Platform Service persistent settings (singleton row id=1) ──
        public DbSet<PlatformServiceSetting> PlatformServiceSettings { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // ════════════════════════════════════════════
            // COMPOSITE KEYS
            // ════════════════════════════════════════════
            modelBuilder.Entity<RoleScreen>()
                .HasKey(rs => new { rs.RoleId, rs.ScreenId });

            modelBuilder.Entity<UserScreen>()
                .HasKey(us => new { us.UserId, us.ScreenId });

            // ════════════════════════════════════════════
            // UNIQUE CONSTRAINTS
            // ════════════════════════════════════════════
            modelBuilder.Entity<Company>()
                .HasIndex(c => c.Slug)
                .IsUnique()
                .HasDatabaseName("uq_companies_slug");

            modelBuilder.Entity<CompanySetting>()
                .HasIndex(cs => cs.CompanyId)
                .IsUnique()
                .HasDatabaseName("uq_settings_company");

            modelBuilder.Entity<RefreshToken>()
                .HasIndex(rt => rt.Token)
                .IsUnique()
                .HasDatabaseName("uq_refresh_token");

            modelBuilder.Entity<Invitation>()
                .HasIndex(i => i.Token)
                .IsUnique()
                .HasDatabaseName("uq_invitation_token");

            // ════════════════════════════════════════════
            // INDEXES — Multi-Tenancy (company_id on every tenant table)
            // ════════════════════════════════════════════
            modelBuilder.Entity<User>()
                .HasIndex(u => u.CompanyId)
                .HasDatabaseName("idx_users_company");

            modelBuilder.Entity<User>()
                .HasIndex(u => u.Email)
                .IsUnique()
                .HasDatabaseName("idx_users_email");

            modelBuilder.Entity<Role>()
                .HasIndex(r => r.CompanyId)
                .HasDatabaseName("idx_roles_company");

            modelBuilder.Entity<RoleScreen>()
                .HasIndex(rs => rs.CompanyId)
                .HasDatabaseName("idx_rolescreens_company");

            modelBuilder.Entity<UserScreen>()
                .HasIndex(us => us.CompanyId)
                .HasDatabaseName("idx_userscreens_company");

            modelBuilder.Entity<UserScreen>()
                .HasIndex(us => us.UserId)
                .HasDatabaseName("idx_userscreens_user");

            modelBuilder.Entity<BrandGuideline>()
                .HasIndex(bg => bg.CompanyId)
                .HasDatabaseName("idx_guidelines_company");

            modelBuilder.Entity<Campaign>()
                .HasIndex(c => c.CompanyId)
                .HasDatabaseName("idx_campaigns_company");

            modelBuilder.Entity<Campaign>()
                .HasIndex(c => c.Status)
                .HasDatabaseName("idx_campaigns_status");

            modelBuilder.Entity<Campaign>()
                .HasIndex(c => new { c.StartDate, c.EndDate })
                .HasDatabaseName("idx_campaigns_dates");

            modelBuilder.Entity<CmoQueueItem>()
                .HasIndex(q => q.CompanyId)
                .HasDatabaseName("idx_cmoqueue_company");

            modelBuilder.Entity<CmoQueueItem>()
                .HasIndex(q => new { q.CompanyId, q.Status })
                .HasDatabaseName("idx_cmoqueue_status");

            modelBuilder.Entity<PppQueueItem>()
                .HasIndex(q => q.CompanyId)
                .HasDatabaseName("idx_pppqueue_company");

            modelBuilder.Entity<PppQueueItem>()
                .HasIndex(q => new { q.CompanyId, q.Status })
                .HasDatabaseName("idx_pppqueue_status");

            modelBuilder.Entity<CompanyAdAccount>()
                .HasIndex(a => a.CompanyId)
                .HasDatabaseName("idx_adaccounts_company");

            modelBuilder.Entity<CompanyAdAccount>()
                .HasIndex(a => new { a.CompanyId, a.Platform, a.AccountId })
                .IsUnique()
                .HasDatabaseName("uq_adaccounts_platform");

            modelBuilder.Entity<AdSet>()
                .HasIndex(a => a.CampaignId)
                .HasDatabaseName("idx_adsets_campaign");

            modelBuilder.Entity<AdSet>()
                .HasIndex(a => a.CompanyId)
                .HasDatabaseName("idx_adsets_company");

            modelBuilder.Entity<Ad>()
                .HasIndex(a => a.AdSetId)
                .HasDatabaseName("idx_ads_adset");

            modelBuilder.Entity<Ad>()
                .HasIndex(a => a.CompanyId)
                .HasDatabaseName("idx_ads_company");

            modelBuilder.Entity<Ad>()
                .HasIndex(a => new { a.CompanyId, a.Status })
                .HasDatabaseName("idx_ads_status");

            modelBuilder.Entity<AdCreative>()
                .HasIndex(ac => ac.AdId)
                .HasDatabaseName("idx_creatives_ad");

            modelBuilder.Entity<AdCreative>()
                .HasIndex(ac => ac.CompanyId)
                .HasDatabaseName("idx_creatives_company");

            modelBuilder.Entity<CampaignWorkflowStep>()
                .HasIndex(w => w.CampaignId)
                .HasDatabaseName("idx_workflow_campaign");

            modelBuilder.Entity<CampaignWorkflowStep>()
                .HasIndex(w => new { w.CampaignId, w.StepName })
                .IsUnique()
                .HasDatabaseName("uq_workflow_step");

            modelBuilder.Entity<CampaignPlatformSpec>()
                .HasIndex(p => p.CampaignId)
                .HasDatabaseName("idx_platformspecs_campaign");

            modelBuilder.Entity<CampaignPlatformSpec>()
                .HasIndex(p => p.CompanyId)
                .HasDatabaseName("idx_platformspecs_company");

            modelBuilder.Entity<CampaignPlatformSpec>()
                .HasIndex(p => new { p.CampaignId, p.Platform })
                .IsUnique()
                .HasDatabaseName("uq_platformspecs_campaign_platform");

            // PppAdBudget indexes
            modelBuilder.Entity<PppAdBudget>()
                .HasIndex(b => b.CompanyId)
                .HasDatabaseName("idx_ppp_budget_company");
            modelBuilder.Entity<PppAdBudget>()
                .HasIndex(b => b.PppQueueItemId)
                .HasDatabaseName("idx_ppp_budget_queue_item");
            modelBuilder.Entity<PppAdBudget>()
                .HasIndex(b => new { b.PppQueueItemId, b.CompanyId })
                .IsUnique()
                .HasDatabaseName("idx_ppp_budget_unique");

            // ── Analytics indexes ──
            modelBuilder.Entity<AdMetric>()
                .HasIndex(m => m.CompanyId)
                .HasDatabaseName("idx_metrics_company");

            modelBuilder.Entity<AdMetric>()
                .HasIndex(m => new { m.CampaignId, m.Date })
                .HasDatabaseName("idx_metrics_campaign");

            modelBuilder.Entity<AdMetric>()
                .HasIndex(m => m.Date)
                .HasDatabaseName("idx_metrics_date");

            modelBuilder.Entity<AdMetric>()
                .HasIndex(m => new { m.CampaignId, m.AdSetId, m.AdId, m.Platform, m.Date })
                .IsUnique()
                .HasDatabaseName("uq_metrics_daily");

            modelBuilder.Entity<AdMetricSummary>()
                .HasIndex(m => m.CompanyId)
                .HasDatabaseName("idx_metrics_summary_company");

            modelBuilder.Entity<AdMetricSummary>()
                .HasIndex(m => new { m.CampaignId, m.Date })
                .HasDatabaseName("idx_metrics_summary_campaign");

            modelBuilder.Entity<AdMetricSummary>()
                .HasIndex(m => m.Date)
                .HasDatabaseName("idx_metrics_summary_date");

            modelBuilder.Entity<AdMetricSummary>()
                .HasIndex(m => m.FetchedAt)
                .HasDatabaseName("idx_metrics_summary_fetched");

            modelBuilder.Entity<DeploymentLog>()
                .HasIndex(d => d.CompanyId)
                .HasDatabaseName("idx_deplogs_company");

            modelBuilder.Entity<DeploymentLog>()
                .HasIndex(d => d.CampaignId)
                .HasDatabaseName("idx_deplogs_campaign");

            modelBuilder.Entity<DeploymentLog>()
                .HasIndex(d => d.ExecutedAt)
                .HasDatabaseName("idx_deplogs_date");

            // ── Approval & Notification indexes ──
            modelBuilder.Entity<ApprovalComment>()
                .HasIndex(ac => ac.CampaignId)
                .HasDatabaseName("idx_comments_campaign");

            modelBuilder.Entity<ApprovalComment>()
                .HasIndex(ac => ac.AdId)
                .HasDatabaseName("idx_comments_ad");

            modelBuilder.Entity<Notification>()
                .HasIndex(n => new { n.UserId, n.IsRead })
                .HasDatabaseName("idx_notif_user");

            modelBuilder.Entity<Notification>()
                .HasIndex(n => n.CompanyId)
                .HasDatabaseName("idx_notif_company");

            // ── System indexes ──
            modelBuilder.Entity<ActivityLog>()
                .HasIndex(a => new { a.CompanyId, a.CreatedAt })
                .HasDatabaseName("idx_activity_company");

            modelBuilder.Entity<ActivityLog>()
                .HasIndex(a => a.UserId)
                .HasDatabaseName("idx_activity_user");

            modelBuilder.Entity<ActivityLog>()
                .HasIndex(a => a.CreatedAt)
                .HasDatabaseName("idx_activity_date");

            modelBuilder.Entity<RefreshToken>()
                .HasIndex(rt => rt.UserId)
                .HasDatabaseName("idx_refresh_user");

            modelBuilder.Entity<Invitation>()
                .HasIndex(i => i.CompanyId)
                .HasDatabaseName("idx_invitation_company");

            modelBuilder.Entity<Invitation>()
                .HasIndex(i => i.Email)
                .HasDatabaseName("idx_invitation_email");

            // ── Feature indexes ──
            modelBuilder.Entity<AbTest>()
                .HasIndex(t => t.CompanyId)
                .HasDatabaseName("idx_abtests_company");

            modelBuilder.Entity<AbTest>()
                .HasIndex(t => t.CampaignId)
                .HasDatabaseName("idx_abtests_campaign");

            modelBuilder.Entity<BudgetAllocation>()
                .HasIndex(b => b.CompanyId)
                .HasDatabaseName("idx_budgets_company");

            modelBuilder.Entity<BudgetAllocation>()
                .HasIndex(b => new { b.PeriodStart, b.PeriodEnd })
                .HasDatabaseName("idx_budgets_period");

            modelBuilder.Entity<CampaignTemplate>()
                .HasIndex(t => t.CompanyId)
                .HasDatabaseName("idx_templates_company");

            modelBuilder.Entity<AudienceTemplate>()
                .HasIndex(t => t.CompanyId)
                .HasDatabaseName("idx_audiences_company");

            modelBuilder.Entity<AssetLibraryItem>()
                .HasIndex(a => a.CompanyId)
                .HasDatabaseName("idx_assetlib_company");

            modelBuilder.Entity<AssetLibraryItem>()
                .HasIndex(a => new { a.CompanyId, a.Folder })
                .HasDatabaseName("idx_assetlib_folder");

            // ════════════════════════════════════════════
            // RELATIONSHIPS — Disable cascading deletes for multiple FK paths
            // ════════════════════════════════════════════

            // Campaign -> multiple User FKs
            modelBuilder.Entity<Campaign>()
                .HasOne(c => c.CreatedByUser)
                .WithMany()
                .HasForeignKey(c => c.CreatedBy)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<Campaign>()
                .HasOne(c => c.ApprovedByUser)
                .WithMany()
                .HasForeignKey(c => c.ApprovedBy)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<Campaign>()
                .HasOne(c => c.DeployedByUser)
                .WithMany()
                .HasForeignKey(c => c.DeployedBy)
                .OnDelete(DeleteBehavior.SetNull);

            // Ad -> multiple User FKs
            modelBuilder.Entity<Ad>()
                .HasOne(a => a.CreatedByUser)
                .WithMany()
                .HasForeignKey(a => a.CreatedBy)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<Ad>()
                .HasOne(a => a.ReviewedByUser)
                .WithMany()
                .HasForeignKey(a => a.ReviewedBy)
                .OnDelete(DeleteBehavior.SetNull);

            // AbTest -> multiple Ad FKs
            modelBuilder.Entity<AbTest>()
                .HasOne(t => t.VariantA)
                .WithMany()
                .HasForeignKey(t => t.VariantAAdId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<AbTest>()
                .HasOne(t => t.VariantB)
                .WithMany()
                .HasForeignKey(t => t.VariantBAdId)
                .OnDelete(DeleteBehavior.Restrict);

            // CmoQueue -> multiple User FKs
            modelBuilder.Entity<CmoQueueItem>()
                .HasOne(q => q.SubmittedByUser)
                .WithMany()
                .HasForeignKey(q => q.SubmittedBy)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<CmoQueueItem>()
                .HasOne(q => q.ReviewedByUser)
                .WithMany()
                .HasForeignKey(q => q.ReviewedBy)
                .OnDelete(DeleteBehavior.SetNull);

            // PppQueue -> multiple User FKs
            modelBuilder.Entity<PppQueueItem>()
                .HasOne(q => q.ApprovedByUser)
                .WithMany()
                .HasForeignKey(q => q.ApprovedBy)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<PppQueueItem>()
                .HasOne(q => q.DeployedByUser)
                .WithMany()
                .HasForeignKey(q => q.DeployedBy)
                .OnDelete(DeleteBehavior.SetNull);

            // RoleScreen -> User FK
            modelBuilder.Entity<RoleScreen>()
                .HasOne(rs => rs.GrantedByUser)
                .WithMany()
                .HasForeignKey(rs => rs.GrantedBy)
                .OnDelete(DeleteBehavior.SetNull);

            // UserScreen -> User FKs
            modelBuilder.Entity<UserScreen>()
                .HasOne(us => us.User)
                .WithMany()
                .HasForeignKey(us => us.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<UserScreen>()
                .HasOne(us => us.GrantedByUser)
                .WithMany()
                .HasForeignKey(us => us.GrantedBy)
                .OnDelete(DeleteBehavior.SetNull);

            // BrandGuideline -> User FK
            modelBuilder.Entity<BrandGuideline>()
                .HasOne(bg => bg.CreatedByUser)
                .WithMany()
                .HasForeignKey(bg => bg.CreatedBy)
                .OnDelete(DeleteBehavior.SetNull);

            // DeploymentLog -> User FK
            modelBuilder.Entity<DeploymentLog>()
                .HasOne(d => d.ExecutedByUser)
                .WithMany()
                .HasForeignKey(d => d.ExecutedBy)
                .OnDelete(DeleteBehavior.Restrict);

            // Company 1:1 Settings
            modelBuilder.Entity<Company>()
                .HasOne(c => c.Settings)
                .WithOne(s => s.Company)
                .HasForeignKey<CompanySetting>(s => s.CompanyId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
