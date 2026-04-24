using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<CampaignBrief> Campaigns { get; set; }
    public DbSet<TargetingProfile> Targetings { get; set; }
    public DbSet<CreativeAsset> CreativeAssets { get; set; }
    public DbSet<DistributionPlan> DistributionPlans { get; set; }
    public DbSet<ExecutionRun> ExecutionRuns { get; set; }
}
