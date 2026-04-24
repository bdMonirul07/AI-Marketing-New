using backend.Data;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Threading;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CampaignController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IGroqService _groqService;
    private readonly ICapCutService _capCutService;
    private readonly IGeminiMediaService _geminiMediaService;
    private static int _dummyVideoIndex = 0;
    private static int _dummyImageIndex = 0;
    private static readonly string[] DummyImages = { "cse-photo-card.jpeg" };
    private static readonly string[] DummyVideos = { "bu-heart-of-dhaka.mp4", "bu-walk.mp4" };

    public CampaignController(AppDbContext context, IGroqService groqService, ICapCutService capCutService, IGeminiMediaService geminiMediaService)
    {
        _context = context;
        _groqService = groqService;
        _capCutService = capCutService;
        _geminiMediaService = geminiMediaService;
    }

    [HttpPost("brief")]
    public async Task<ActionResult<CampaignBrief>> CreateBrief(CampaignBrief brief)
    {
        _context.Campaigns.Add(brief);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetBrief), new { id = brief.Id }, brief);
    }

    [HttpGet("brief/{id}")]
    public async Task<ActionResult<CampaignBrief>> GetBrief(int id)
    {
        var brief = await _context.Campaigns.FindAsync(id);
        if (brief == null) return NotFound();
        return brief;
    }

    [HttpPost("targeting")]
    public async Task<ActionResult<TargetingProfile>> SaveTargeting(TargetingProfile profile)
    {
        _context.Targetings.Add(profile);
        await _context.SaveChangesAsync();
        return Ok(profile);
    }

    [HttpPost("creative/generate")]
    public async Task<ActionResult<GeneratedCreativeResponse>> GenerateCreative([FromBody] PromptRequest request)
    {
        if (string.IsNullOrEmpty(request.Prompt))
            return BadRequest("Prompt is required.");

        string assetType = request.AssetType?.ToLower() ?? "image";
        GeneratedMediaResult generated;
        generated = GetDummyAsset(assetType, request.Prompt);

        var contentUrl = string.IsNullOrWhiteSpace(generated.RelativeUrl)
            ? string.Empty
            : $"{Request.Scheme}://{Request.Host}{generated.RelativeUrl}";

        var response = new GeneratedCreativeResponse
        {
            AssetType = assetType == "video" ? "Video" : assetType == "post" ? "Post" : "Image",
            Source = generated.Source,
            ContentUrl = contentUrl,
            PromptUsed = request.Prompt,
            ContentText = generated.ContentText
        };

        return Ok(response);
    }

    private static GeneratedMediaResult GetDummyAsset(string assetType, string prompt)
    {
        if (assetType == "video")
        {
            var index = Interlocked.Increment(ref _dummyVideoIndex);
            var file = DummyVideos[index % DummyVideos.Length];
            return new GeneratedMediaResult
            {
                RelativeUrl = $"/genassets/{file}",
                Source = "Dummy Assets"
            };
        }

        if (assetType == "post")
        {
            return new GeneratedMediaResult
            {
                RelativeUrl = string.Empty,
                Source = "Dummy Assets",
                ContentText = "Sample post copy for review. Replace with AI-generated copy when ready."
            };
        }

        var imageIndex = Interlocked.Increment(ref _dummyImageIndex);
        var imageFile = DummyImages[imageIndex % DummyImages.Length];
        return new GeneratedMediaResult
        {
            RelativeUrl = $"/genassets/{imageFile}",
            Source = "Dummy Assets"
        };
    }
}

public class PromptRequest
{
    public string Prompt { get; set; } = string.Empty;
    public string? AssetType { get; set; }
}

public class GeneratedCreativeResponse
{
    public string AssetType { get; set; } = string.Empty;
    public string Source { get; set; } = string.Empty;
    public string ContentUrl { get; set; } = string.Empty;
    public string PromptUsed { get; set; } = string.Empty;
    public string? ContentText { get; set; }
}
