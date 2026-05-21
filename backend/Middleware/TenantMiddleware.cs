using System.Security.Claims;

namespace Backend.Middleware
{
    public class TenantMiddleware
    {
        private readonly RequestDelegate _next;

        public TenantMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            // Skip tenant resolution for auth endpoints, static files, and public endpoints
            var path = context.Request.Path.Value?.ToLower() ?? "";
            if (path.StartsWith("/api/auth/") ||
                path.StartsWith("/api/onboard/") ||
                path.StartsWith("/api/campaign-objectives") ||
                path.StartsWith("/api/rbac/seed") ||
                path.StartsWith("/api/seed/") ||
                (path.StartsWith("/api/invitations/") && context.Request.Method == "POST") ||
                path.StartsWith("/assets/") ||
                path.StartsWith("/library/") ||
                !path.StartsWith("/api/"))
            {
                await _next(context);
                return;
            }

            var user = context.User;
            if (user.Identity?.IsAuthenticated != true)
            {
                context.Response.StatusCode = 401;
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsJsonAsync(new { error = "Authentication required" });
                return;
            }

            if (user.Identity?.IsAuthenticated == true)
            {
                var isSuperAdmin = user.FindFirst("is_super_admin")?.Value == "true";
                var companyIdClaim = user.FindFirst("company_id")?.Value;

                if (isSuperAdmin)
                {
                    // Super Admin can impersonate a company via header
                    var headerCompanyId = context.Request.Headers["X-Company-Id"].FirstOrDefault();
                    if (!string.IsNullOrEmpty(headerCompanyId) && int.TryParse(headerCompanyId, out var cid))
                    {
                        context.Items["CompanyId"] = cid;
                        context.Items["IsSuperAdmin"] = true;
                        context.Items["IsImpersonating"] = true;
                    }
                    else
                    {
                        // Super Admin not impersonating - global context
                        context.Items["CompanyId"] = (int?)null;
                        context.Items["IsSuperAdmin"] = true;
                        context.Items["IsImpersonating"] = false;
                    }
                }
                else if (!string.IsNullOrEmpty(companyIdClaim) && int.TryParse(companyIdClaim, out var companyId))
                {
                    context.Items["CompanyId"] = companyId;
                    context.Items["IsSuperAdmin"] = false;
                    context.Items["IsImpersonating"] = false;
                }
                else
                {
                    context.Response.StatusCode = 403;
                    await context.Response.WriteAsJsonAsync(new { error = "No company context found" });
                    return;
                }

                // Extract user ID
                var userIdClaim = user.FindFirst("user_id")?.Value;
                if (int.TryParse(userIdClaim, out var userId))
                {
                    context.Items["UserId"] = userId;
                }
            }

            await _next(context);
        }
    }

    // Extension methods for easy access in endpoints
    public static class TenantContextExtensions
    {
        public static int? GetCompanyId(this HttpContext context)
        {
            return context.Items.TryGetValue("CompanyId", out var val) ? val as int? : null;
        }

        public static int GetRequiredCompanyId(this HttpContext context)
        {
            return context.GetCompanyId() ?? throw new BadHttpRequestException("Company context required. Login with a company user or set X-Company-Id header.", 403);
        }

        public static bool IsSuperAdmin(this HttpContext context)
        {
            return context.Items.TryGetValue("IsSuperAdmin", out var val) && val is true;
        }

        public static bool IsImpersonating(this HttpContext context)
        {
            return context.Items.TryGetValue("IsImpersonating", out var val) && val is true;
        }

        public static int GetUserId(this HttpContext context)
        {
            return context.Items.TryGetValue("UserId", out var val) && val is int id ? id : 0;
        }
    }
}
