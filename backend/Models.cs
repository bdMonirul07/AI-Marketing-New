using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;

namespace Backend.Models
{
    [Table("brand_guidelines")]
    public class BrandGuideline
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("brand_label")]
        public string? BrandLabel { get; set; }

        [Column("tone")]
        public string? Tone { get; set; }

        [Column("language")]
        public string? Language { get; set; }

        [Column("description")]
        public string? Description { get; set; }

        [Column("whitelist")]
        public string? Whitelist { get; set; }

        [Column("blacklist")]
        public string? Blacklist { get; set; }

        [Column("typography", TypeName = "jsonb")]
        public JsonElement Typography { get; set; }

        [Column("palette")]
        public string[]? Palette { get; set; }

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }

    [Table("campaigns")]
    public class Campaign
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("brief")]
        public string? Brief { get; set; }

        [Column("style_preset")]
        public string? StylePreset { get; set; }

        [Column("aspect_ratio")]
        public string? AspectRatio { get; set; }

        [Column("timestamp")]
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;

        [Column("status")]
        public string Status { get; set; } = "pending";
    }

    [Table("cmo_queue")]
    public class CmoQueueItem
    {
        [Key]
        [Column("id")]
        public string Id { get; set; } = string.Empty;

        [Column("url")]
        public string? Url { get; set; }

        [Column("title")]
        public string? Title { get; set; }

        [Column("type")]
        public string? Type { get; set; }

        [Column("status")]
        public string Status { get; set; } = "pending";

        [Column("added_at")]
        public DateTime AddedAt { get; set; } = DateTime.UtcNow;
    }

    [Table("users")]
    public class User
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("username")]
        public string? Username { get; set; }

        [Column("role")]
        public string? Role { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
