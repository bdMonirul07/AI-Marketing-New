using Backend.Data;
using Backend.Models;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Backend.Tests
{
    // Task 87: Backend Unit Tests
    public class AuthTests
    {
        private AppDbContext CreateInMemoryDb()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
            return new AppDbContext(options);
        }

        [Fact]
        public async Task Users_BelongToCompany()
        {
            using var db = CreateInMemoryDb();
            var company = new Company { Name = "Test Co", Slug = "test-co" };
            db.Companies.Add(company);
            await db.SaveChangesAsync();

            var role = new Role { Name = "Admin", CompanyId = company.Id };
            db.Roles.Add(role);
            await db.SaveChangesAsync();

            var user = new User { Username = "testuser", PasswordHash = "hash", RoleId = role.Id, CompanyId = company.Id };
            db.Users.Add(user);
            await db.SaveChangesAsync();

            var result = await db.Users.Include(u => u.Company).FirstAsync(u => u.Username == "testuser");
            Assert.Equal("Test Co", result.Company!.Name);
            Assert.Equal(company.Id, result.CompanyId);
        }

        [Fact]
        public async Task SuperAdmin_HasNoCompany()
        {
            using var db = CreateInMemoryDb();
            var role = new Role { Name = "Super Admin", CompanyId = null, IsSystemRole = true };
            db.Roles.Add(role);
            await db.SaveChangesAsync();

            var user = new User { Username = "superadmin", PasswordHash = "hash", RoleId = role.Id, CompanyId = null, IsSuperAdmin = true };
            db.Users.Add(user);
            await db.SaveChangesAsync();

            var result = await db.Users.FirstAsync(u => u.IsSuperAdmin);
            Assert.Null(result.CompanyId);
            Assert.True(result.IsSuperAdmin);
        }

        [Fact]
        public async Task TenantIsolation_UsersFilteredByCompany()
        {
            using var db = CreateInMemoryDb();
            var companyA = new Company { Name = "Company A", Slug = "company-a" };
            var companyB = new Company { Name = "Company B", Slug = "company-b" };
            db.Companies.AddRange(companyA, companyB);
            await db.SaveChangesAsync();

            var role = new Role { Name = "Expert" };
            db.Roles.Add(role);
            await db.SaveChangesAsync();

            db.Users.Add(new User { Username = "userA", PasswordHash = "h", RoleId = role.Id, CompanyId = companyA.Id });
            db.Users.Add(new User { Username = "userB", PasswordHash = "h", RoleId = role.Id, CompanyId = companyB.Id });
            await db.SaveChangesAsync();

            var companyAUsers = await db.Users.Where(u => u.CompanyId == companyA.Id).ToListAsync();
            Assert.Single(companyAUsers);
            Assert.Equal("userA", companyAUsers[0].Username);
        }

        [Fact]
        public async Task Campaign_FullLifecycle()
        {
            using var db = CreateInMemoryDb();
            var company = new Company { Name = "Test", Slug = "test" };
            db.Companies.Add(company);
            await db.SaveChangesAsync();

            var campaign = new Campaign { CompanyId = company.Id, Name = "Test Campaign", Status = "draft" };
            db.Campaigns.Add(campaign);
            await db.SaveChangesAsync();

            Assert.Equal("draft", campaign.Status);

            campaign.Status = "pending_review";
            await db.SaveChangesAsync();
            Assert.Equal("pending_review", campaign.Status);

            campaign.Status = "approved";
            campaign.ApprovedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            Assert.Equal("approved", campaign.Status);
            Assert.NotNull(campaign.ApprovedAt);

            campaign.Status = "active";
            campaign.DeployedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            Assert.Equal("active", campaign.Status);
        }

        [Fact]
        public async Task AdHierarchy_CampaignAdSetAd()
        {
            using var db = CreateInMemoryDb();
            var company = new Company { Name = "Test", Slug = "test" };
            db.Companies.Add(company);
            await db.SaveChangesAsync();

            var campaign = new Campaign { CompanyId = company.Id, Name = "Campaign" };
            db.Campaigns.Add(campaign);
            await db.SaveChangesAsync();

            var adSet = new AdSet { CompanyId = company.Id, CampaignId = campaign.Id, Name = "Ad Set 1" };
            db.AdSets.Add(adSet);
            await db.SaveChangesAsync();

            var ad = new Ad { CompanyId = company.Id, AdSetId = adSet.Id, Name = "Ad 1", Headline = "Buy Now" };
            db.Ads.Add(ad);
            await db.SaveChangesAsync();

            var creative = new AdCreative { CompanyId = company.Id, AdId = ad.Id, CreativeType = "image", AssetUrl = "/test.jpg" };
            db.AdCreatives.Add(creative);
            await db.SaveChangesAsync();

            var loaded = await db.Campaigns
                .Include(c => c.AdSets).ThenInclude(a => a.Ads).ThenInclude(a => a.Creatives)
                .FirstAsync(c => c.Id == campaign.Id);

            Assert.Single(loaded.AdSets);
            Assert.Single(loaded.AdSets.First().Ads);
            Assert.Single(loaded.AdSets.First().Ads.First().Creatives);
        }

        [Fact]
        public async Task Notifications_CreatedAndRead()
        {
            using var db = CreateInMemoryDb();
            var company = new Company { Name = "Test", Slug = "test" };
            db.Companies.Add(company);
            await db.SaveChangesAsync();

            db.Notifications.Add(new Notification { CompanyId = company.Id, UserId = 1, Type = "test", Title = "Test", Message = "Hello" });
            await db.SaveChangesAsync();

            var notif = await db.Notifications.FirstAsync();
            Assert.False(notif.IsRead);

            notif.IsRead = true;
            notif.ReadAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            Assert.True(notif.IsRead);
        }
    }
}
