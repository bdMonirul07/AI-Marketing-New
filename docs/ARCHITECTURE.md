# System Architecture - AI Marketing Platform v4.0

## Multi-Tenant Architecture

```
                    +========================+
                    |      SUPER ADMIN       |
                    |  (Cross-Company View)  |
                    +========================+
                               |
              Full visibility & control over all companies
                               |
          +--------------------+--------------------+
          |                    |                    |
   +=============+     +=============+     +=============+
   | Company A   |     | Company B   |     | Company C   |
   +=============+     +=============+     +=============+
   | Admin       |     | Admin       |     | Admin       |
   | CMO         |     | CMO         |     | CMO         |
   | PPP         |     | PPP         |     | PPP         |
   | Expert      |     | Expert      |     | Expert      |
   +-------------+     +-------------+     +-------------+
```

## Technology Stack

| Layer       | Technology                                        |
|-------------|--------------------------------------------------|
| Frontend    | Vanilla JS SPA, Vite 7.x, Tailwind CSS 4.x      |
| Backend     | ASP.NET Core 9.0 (Minimal API)                   |
| Database    | PostgreSQL 16 + Entity Framework Core 9.0         |
| Auth        | JWT Bearer (HS256) + Refresh Tokens              |
| AI          | Google Gemini 2.0 Flash                           |
| Ad Platforms| Facebook Graph API v19, TikTok Business API v1.3, |
|             | YouTube Data API, Google Ads API v17              |
| DevOps      | Docker, GitHub Actions CI/CD                     |

## Database: 28 Tables

### By Domain
- **Multi-Tenancy (3):** companies, company_settings, company_ad_accounts
- **Auth & RBAC (5):** users, roles, screens, role_screens, refresh_tokens
- **Campaign Core (5):** campaigns, campaign_objectives, ad_sets, ads, ad_creatives
- **Workflow (4):** campaign_workflow_steps, cmo_queue, ppp_queue, approval_comments
- **Analytics (2):** ad_metrics, deployment_logs
- **Features (4):** ab_tests, budget_allocations, campaign_templates, audience_templates
- **System (3):** notifications, activity_logs, invitations
- **Assets (2):** asset_library, brand_guidelines

## User Roles (5)

| Role | Scope | Key Screens |
|------|-------|-------------|
| Super Admin | Global | Global Dashboard, Company Management, Audit Log |
| Admin | Company | User/Role Mgmt, Config, Brand Guidelines, Ad Accounts |
| CMO | Company | Approvals, Budget, Analytics, Campaign Reports |
| PPP | Company | Deploy, A/B Tests, Deployment History, Performance |
| Expert | Company | Campaign Builder, Strategy Hub, Creative Studio |

## Campaign Lifecycle

```
Draft -> Pending Review -> Approved -> Deploying -> Active -> Paused -> Completed
                       -> Rejected (back to Expert)
```

## API Endpoint Groups

- `/api/auth/*` - Authentication (login, register, refresh)
- `/api/onboard/*` - Company onboarding
- `/api/super-admin/*` - Super Admin operations
- `/api/rbac/*` - Roles, users, permissions
- `/api/campaigns/*` - Campaign CRUD + lifecycle
- `/api/campaigns/{id}/adsets/*` - Ad Set management
- `/api/adsets/{id}/ads/*` - Ad management
- `/api/cmo/queue` & `/api/ppp/queue` - Approval queues
- `/api/deploy/*` - Platform deployment (unified + per-platform)
- `/api/analytics/*` - Metrics and reporting
- `/api/notifications` - In-app notifications
- `/api/ad-accounts` - Platform credential management
- `/api/ab-tests` - A/B testing
- `/api/budgets` - Budget allocation
- `/api/templates` - Campaign templates
- `/api/gemini/*` - AI strategy questions
- `/api/compliance/*` - Brand compliance checking
