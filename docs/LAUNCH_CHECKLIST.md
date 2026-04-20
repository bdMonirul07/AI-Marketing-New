# Task 100: Launch Checklist

## Database
- [ ] All 28 tables created successfully
- [ ] Migration script tested (backend/Scripts/migrate.sql)
- [ ] Seed endpoint populates default data correctly
- [ ] Indexes created for performance

## Authentication & Authorization
- [ ] Super Admin can log in and see Global Dashboard
- [ ] Company Admin can log in and see company-scoped data only
- [ ] CMO, PPP, Expert roles have correct screen access
- [ ] JWT tokens include company_id and is_super_admin claims
- [ ] Refresh token rotation works
- [ ] Super Admin role hidden from company Admin dropdown

## Multi-Tenancy
- [ ] Super Admin can create and manage companies
- [ ] Super Admin can enter any company context (X-Company-Id header)
- [ ] Company users only see their own company's data
- [ ] Cross-company data isolation verified (Company A cannot see Company B)
- [ ] Per-company ad account credential storage works

## Campaign Lifecycle
- [ ] Expert can create campaign via Campaign Builder Wizard
- [ ] Campaign workflow steps tracked (7 steps)
- [ ] Expert can submit campaign for CMO review
- [ ] CMO can approve/reject campaigns with comments
- [ ] PPP can deploy approved campaigns to platforms
- [ ] Campaign status transitions: draft -> pending_review -> approved -> active

## Ad Platform Integrations
- [ ] Facebook deployment creates Campaign -> AdSet -> Creative -> Ad
- [ ] TikTok deployment creates AdGroup + Creative
- [ ] YouTube deployment (simulated) works
- [ ] Google Ads deployment (simulated) works
- [ ] Unified deploy endpoint coordinates multi-platform deployment
- [ ] Deployment logs saved to database

## Analytics & Monitoring
- [ ] Dashboard shows real KPIs from ad_metrics table
- [ ] Cross-platform analytics compares platform performance
- [ ] MetricsFetchService background job runs on schedule
- [ ] Ad Performance screen shows campaign metrics

## Notifications
- [ ] Notifications created on campaign submit/approve/reject
- [ ] Notification badge shows unread count
- [ ] Mark as read / mark all as read works

## Features
- [ ] A/B testing create and view results
- [ ] Budget allocation per platform per period
- [ ] Campaign templates save and reuse
- [ ] Audience templates save and reuse
- [ ] Brand compliance checker validates ad copy
- [ ] Team invitation system (invite via email token)

## Frontend
- [ ] All 33 screens render correctly
- [ ] Company branding in sidebar
- [ ] Super Admin company switcher works
- [ ] Responsive design on mobile/tablet
- [ ] All 5 themes work (dark, light, blue, red, platinum)
- [ ] Skeleton loading states

## Security
- [ ] Passwords hashed with BCrypt
- [ ] JWT tokens expire after 8 hours
- [ ] Tenant middleware blocks cross-company access
- [ ] No sensitive data in client-side storage

## DevOps
- [ ] Docker build succeeds for backend and frontend
- [ ] docker-compose up brings up full stack
- [ ] CI/CD pipeline passes on GitHub Actions
- [ ] Environment variables documented

## Documentation
- [ ] ARCHITECTURE.md complete
- [ ] appsettings.example.json (no real keys)
- [ ] .env.example for frontend
- [ ] API documentation accessible
- [ ] taskDB100.md database design complete
- [ ] task100.md implementation tasks complete
