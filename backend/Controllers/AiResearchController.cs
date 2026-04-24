using backend.Services;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace backend.Controllers;

[ApiController]
[Route("api/ai")]
public class AiResearchController : ControllerBase
{
    private readonly IGroqService _groqService;

    public AiResearchController(IGroqService groqService)
    {
        _groqService = groqService;
    }

    [HttpPost("research")]
    public async Task<IActionResult> ResearchIntent([FromBody] ResearchRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Intent))
            return BadRequest("Intent cannot be empty.");

        string systemPrompt = @"You are the AI Marketing Orchestrator. 
Your goal is to take a user's raw campaign intent and generate EXACTLY 5 diagnostic, open-ended questions that will help define a winning marketing strategy.

PLATFORM STANDARDS:
1. CUSTOMER PSYCHOLOGY: What drives their target audience's choices?
2. VALUE PROPOSITION: What makes their offer unmissable?
3. MARKET CONTEXT: Where does this fit in the current competitive landscape?
4. EMOTIONAL ANCHOR: What core emotion should the creative evoke?
5. CONVERSION PATH: How will the audience logically move from interest to action?

OUTPUT RULES:
- Return ONLY a valid JSON array of strings containing exactly 5 questions.
- Do NOT include markdown blocks (like ```json).
- Do NOT include any introductory or concluding text.
- Each question must be deeply strategic and provocative.";

        try 
        {
            var resultRaw = await _groqService.GetChatCompletionAsync(request.Intent, systemPrompt);
            
            // Robust extraction for JSON array
            string jsonResult = resultRaw;
            var startIdx = resultRaw.IndexOf('[');
            var endIdx = resultRaw.LastIndexOf(']');
            
            if (startIdx != -1 && endIdx != -1 && endIdx > startIdx)
            {
                jsonResult = resultRaw.Substring(startIdx, endIdx - startIdx + 1);
                return Ok(new { Questions = jsonResult });
            }
        }
        catch (Exception ex)
        {
            // Log the error (in a real app)
            Console.WriteLine($"AI Research Error: {ex.Message}");
        }

        // High-quality fallback questions if AI fails or returns invalid JSON
        var fallbackQuestions = new[]
        {
            "What specific problem does your target audience face that makes them seek your solution?",
            "What is the single most compelling reason a customer should choose you over a competitor right now?",
            "If your brand were a person, what three personality traits would define its voice in this campaign?",
            "What is the immediate action you want a user to take after seeing your primary creative?",
            "Which digital or physical spaces does your ideal customer frequent when they are most likely to convert?"
        };

        return Ok(new { Questions = JsonSerializer.Serialize(fallbackQuestions) });
    }

    [HttpPost("questions")]
    public async Task<IActionResult> GenerateQuestions([FromBody] GenerateQuestionsRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Intent) || string.IsNullOrWhiteSpace(request.ResearchSummary))
            return BadRequest("Intent and Research Summary are required.");

        string systemPrompt = @"You are the AI Marketing Orchestrator. 
Based on the user's initial intent and their answers to the first 5 diagnostic questions, generate an ADDITIONAL 5 deeper, follow-up questions.
These questions should gather the FINAL essential technical and creative details needed to build the advertisement.

CONSOLIDATED CONTEXT:
1. Use the 'Research Summary' (which contains previous Q&A) to avoid repetition.
2. Focus on: Technical specifications, Visual style preferences, Call to action specifics, and Branding constraints.

OUTPUT RULES:
- Return ONLY a valid JSON array of strings containing exactly 5 follow-up questions.
- Do NOT include markdown blocks.
- Do NOT include any introductory or concluding text.";

        string prompt = $"Intent: {request.Intent}\n\nPrevious Q&A: {request.ResearchSummary}";

        try 
        {
            var resultRaw = await _groqService.GetChatCompletionAsync(prompt, systemPrompt);
            
            string jsonResult = resultRaw;
            var startIdx = resultRaw.IndexOf('[');
            var endIdx = resultRaw.LastIndexOf(']');
            
            if (startIdx != -1 && endIdx != -1 && endIdx > startIdx)
            {
                jsonResult = resultRaw.Substring(startIdx, endIdx - startIdx + 1);
                return Ok(new { Questions = jsonResult });
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"AI Refinement Error: {ex.Message}");
        }

        // High-quality fallback follow-up questions
        var fallbackQuestions = new[]
        {
            "What specific color palette or visual aesthetic best represents your brand for this campaign?",
            "Are there any specific technical specs or format requirements (e.g., 9:16 for Reels, 1:1 for feed)?",
            "What is the exact URL or landing page where you want users to go after they click?",
            "Do you have any 'Must-Have' phrases or 'Do-Not-Include' restrictions for the copy?",
            "What is the primary deadline and total budget allocation for this specific creative set?"
        };

        return Ok(new { Questions = JsonSerializer.Serialize(fallbackQuestions) });
    }
}

public class ResearchRequest
{
    public string Intent { get; set; } = string.Empty;
}

public class GenerateQuestionsRequest
{
    public string Intent { get; set; } = string.Empty;
    public string ResearchSummary { get; set; } = string.Empty; // This will hold the combined Q&A from stage 1
}
