using Microsoft.EntityFrameworkCore;
using Backend.Models;

namespace Backend.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<BrandGuideline> BrandGuidelines { get; set; }
        public DbSet<Campaign> Campaigns { get; set; }
        public DbSet<CmoQueueItem> CmoQueue { get; set; }
        public DbSet<User> Users { get; set; }
        public DbSet<Role> Roles { get; set; }
        public DbSet<Screen> Screens { get; set; }
        public DbSet<RoleScreen> RoleScreens { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            
            modelBuilder.Entity<RoleScreen>()
                .HasKey(rs => new { rs.RoleId, rs.ScreenId });
        }
    }
}
