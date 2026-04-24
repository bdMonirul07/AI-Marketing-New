using backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/cmo")]
public class CmoController : ControllerBase
{
    private readonly IGroqService _groqService;

    public CmoController(IGroqService groqService)
    {
        _groqService = groqService;
    }

    [HttpPost("chat")]
    public async Task<ActionResult<CmoChatResponse>> Chat([FromBody] CmoChatRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Question))
        {
            return BadRequest("Question is required.");
        }

        var systemMessage =
            "You are a CMO dashboard assistant. Answer strictly using the provided dashboard data. " +
            "If the data does not contain the answer, say so. Keep responses concise (1-3 sentences).";

        var prompt = $"DASHBOARD DATA:\n{request.Context}\n\nQUESTION:\n{request.Question}";

        try
        {
            var reply = await _groqService.GetChatCompletionAsync(prompt, systemMessage);
            return Ok(new CmoChatResponse { Answer = reply });
        }
        catch (InvalidOperationException ex)
        {
            return StatusCode(502, ex.Message);
        }
    }
}

public class CmoChatRequest
{
    public string Question { get; set; } = string.Empty;
    public string Context { get; set; } = string.Empty;
}

public class CmoChatResponse
{
    public string Answer { get; set; } = string.Empty;
}
