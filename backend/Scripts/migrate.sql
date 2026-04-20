-- ══════════════════════════════════════════════════════════
-- Task 7 & 92: Multi-Tenant Migration Script for MarketingAI
-- Run against existing PostgreSQL database to add new schema
-- This script is IDEMPOTENT (safe to run multiple times)
-- ══════════════════════════════════════════════════════════

-- Step 1: Create new independent tables
CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    industry VARCHAR(100),
    website VARCHAR(500),
    logo_url VARCHAR(500),
    email VARCHAR(200),
    phone VARCHAR(50),
    address TEXT,
    country VARCHAR(100),
    timezone VARCHAR(50) DEFAULT 'UTC',
    currency VARCHAR(10) DEFAULT 'USD',
    status VARCHAR(20) DEFAULT 'active',
    subscription_plan VARCHAR(50) DEFAULT 'free',
    max_users INT DEFAULT 10,
    max_campaigns INT DEFAULT 50,
    created_by INT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_objectives (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(10),
    platform_mapping JSONB NOT NULL DEFAULT '{}',
    supported_platforms TEXT[] DEFAULT '{"facebook","tiktok"}',
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true
);

-- Step 2: Create default company if not exists
INSERT INTO companies (name, slug, industry, status)
SELECT 'Default Company', 'default-company', 'Marketing', 'active'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE slug = 'default-company');

-- Step 3: Add columns to existing tables
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

ALTER TABLE roles ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id);
ALTER TABLE roles ADD COLUMN IF NOT EXISTS description VARCHAR(500);
ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_system_role BOOLEAN DEFAULT false;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS color VARCHAR(50);
ALTER TABLE roles ADD COLUMN IF NOT EXISTS icon VARCHAR(10);
ALTER TABLE roles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

ALTER TABLE screens ADD COLUMN IF NOT EXISTS category VARCHAR(50);
ALTER TABLE screens ADD COLUMN IF NOT EXISTS icon VARCHAR(20);
ALTER TABLE screens ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;
ALTER TABLE screens ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE screens ADD COLUMN IF NOT EXISTS description VARCHAR(500);

ALTER TABLE role_screens ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id);
ALTER TABLE role_screens ADD COLUMN IF NOT EXISTS granted_by INT;
ALTER TABLE role_screens ADD COLUMN IF NOT EXISTS granted_at TIMESTAMP DEFAULT NOW();

ALTER TABLE brand_guidelines ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id);
ALTER TABLE brand_guidelines ADD COLUMN IF NOT EXISTS tagline VARCHAR(500);
ALTER TABLE brand_guidelines ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500);
ALTER TABLE brand_guidelines ADD COLUMN IF NOT EXISTS voice_examples TEXT;
ALTER TABLE brand_guidelines ADD COLUMN IF NOT EXISTS do_list TEXT;
ALTER TABLE brand_guidelines ADD COLUMN IF NOT EXISTS dont_list TEXT;
ALTER TABLE brand_guidelines ADD COLUMN IF NOT EXISTS created_by INT;
ALTER TABLE brand_guidelines ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id);
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS name VARCHAR(200);
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS objective_id INT REFERENCES campaign_objectives(id);
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS campaign_type VARCHAR(50) DEFAULT 'standard';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS total_budget DECIMAL;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS daily_budget DECIMAL;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS lifetime_budget DECIMAL;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS bid_strategy VARCHAR(50);
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'USD';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS start_date TIMESTAMP;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS end_date TIMESTAMP;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS platforms TEXT[] DEFAULT '{}';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS targeting JSONB;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS created_by INT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS approved_by INT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS deployed_by INT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS deployed_at TIMESTAMP;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

ALTER TABLE cmo_queue ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id);
ALTER TABLE cmo_queue ADD COLUMN IF NOT EXISTS campaign_id INT;
ALTER TABLE cmo_queue ADD COLUMN IF NOT EXISTS ad_id INT;
ALTER TABLE cmo_queue ADD COLUMN IF NOT EXISTS priority INT DEFAULT 0;
ALTER TABLE cmo_queue ADD COLUMN IF NOT EXISTS submitted_by INT;
ALTER TABLE cmo_queue ADD COLUMN IF NOT EXISTS reviewed_by INT;
ALTER TABLE cmo_queue ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;
ALTER TABLE cmo_queue ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- Step 4: Assign existing data to default company
UPDATE users SET company_id = (SELECT id FROM companies WHERE slug = 'default-company') WHERE company_id IS NULL;
UPDATE roles SET company_id = (SELECT id FROM companies WHERE slug = 'default-company') WHERE company_id IS NULL;
UPDATE brand_guidelines SET company_id = (SELECT id FROM companies WHERE slug = 'default-company') WHERE company_id IS NULL;
UPDATE campaigns SET company_id = (SELECT id FROM companies WHERE slug = 'default-company') WHERE company_id IS NULL;
UPDATE cmo_queue SET company_id = (SELECT id FROM companies WHERE slug = 'default-company') WHERE company_id IS NULL;

-- Step 5: Create all new tables
CREATE TABLE IF NOT EXISTS company_settings (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) UNIQUE,
    default_language VARCHAR(10) DEFAULT 'en',
    notification_email VARCHAR(200),
    max_daily_budget DECIMAL,
    auto_approve_below DECIMAL,
    require_cmo_approval BOOLEAN DEFAULT true,
    require_brand_check BOOLEAN DEFAULT false,
    default_bid_strategy VARCHAR(50) DEFAULT 'lowest_cost',
    default_platforms TEXT[] DEFAULT '{"facebook"}',
    gemini_api_key VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS company_ad_accounts (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id),
    platform VARCHAR(50) NOT NULL,
    account_name VARCHAR(200),
    account_id VARCHAR(200) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,
    page_id VARCHAR(200),
    pixel_id VARCHAR(200),
    developer_token VARCHAR(200),
    customer_id VARCHAR(200),
    status VARCHAR(20) DEFAULT 'active',
    last_tested_at TIMESTAMP,
    last_error TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ppp_queue (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id),
    campaign_id INT,
    ad_id INT,
    asset_filename VARCHAR(500) NOT NULL,
    asset_url VARCHAR(1000) NOT NULL,
    asset_type VARCHAR(20) DEFAULT 'image',
    title VARCHAR(500),
    status VARCHAR(20) DEFAULT 'pending',
    queue_index INT DEFAULT 0,
    approved_by INT,
    approved_at TIMESTAMP,
    deployed_by INT,
    deployed_at TIMESTAMP,
    deploy_platforms TEXT[],
    added_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ad_sets (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id),
    campaign_id INT NOT NULL REFERENCES campaigns(id),
    name VARCHAR(200) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft',
    daily_budget DECIMAL,
    lifetime_budget DECIMAL,
    bid_strategy VARCHAR(50),
    bid_amount DECIMAL,
    optimization_goal VARCHAR(50),
    billing_event VARCHAR(50) DEFAULT 'IMPRESSIONS',
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    targeting JSONB,
    placements JSONB,
    schedule JSONB,
    platform_adset_ids JSONB,
    created_by INT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ads (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id),
    ad_set_id INT NOT NULL REFERENCES ad_sets(id),
    name VARCHAR(200) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft',
    headline VARCHAR(500),
    description TEXT,
    cta_type VARCHAR(50),
    cta_link VARCHAR(1000),
    platform_ad_ids JSONB,
    review_status VARCHAR(20) DEFAULT 'pending',
    created_by INT,
    reviewed_by INT,
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ad_creatives (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id),
    ad_id INT NOT NULL REFERENCES ads(id),
    creative_type VARCHAR(30) NOT NULL DEFAULT 'image',
    asset_url VARCHAR(1000) NOT NULL,
    asset_filename VARCHAR(500),
    thumbnail_url VARCHAR(1000),
    primary_text TEXT,
    headline VARCHAR(500),
    description TEXT,
    cta_type VARCHAR(50),
    cta_link VARCHAR(1000),
    platform_creative_ids JSONB,
    file_size_bytes BIGINT,
    width INT,
    height INT,
    duration_seconds INT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_workflow_steps (
    id SERIAL PRIMARY KEY,
    campaign_id INT NOT NULL REFERENCES campaigns(id),
    step_name VARCHAR(50) NOT NULL,
    step_order INT NOT NULL,
    status VARCHAR(20) DEFAULT 'not_started',
    data JSONB,
    notes TEXT,
    completed_by INT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    UNIQUE(campaign_id, step_name)
);

CREATE TABLE IF NOT EXISTS ad_metrics (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id),
    campaign_id INT NOT NULL REFERENCES campaigns(id),
    ad_set_id INT,
    ad_id INT,
    platform VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    impressions BIGINT DEFAULT 0,
    reach BIGINT DEFAULT 0,
    clicks BIGINT DEFAULT 0,
    ctr DECIMAL(8,4) DEFAULT 0,
    cpc DECIMAL(10,4) DEFAULT 0,
    cpm DECIMAL(10,4) DEFAULT 0,
    spend DECIMAL(12,2) DEFAULT 0,
    conversions INT DEFAULT 0,
    conversion_value DECIMAL(12,2) DEFAULT 0,
    roas DECIMAL(10,4) DEFAULT 0,
    frequency DECIMAL(8,2) DEFAULT 0,
    video_views BIGINT,
    video_completions BIGINT,
    leads INT,
    app_installs INT,
    fetched_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(campaign_id, ad_set_id, ad_id, platform, date)
);

CREATE TABLE IF NOT EXISTS deployment_logs (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id),
    campaign_id INT NOT NULL REFERENCES campaigns(id),
    ad_set_id INT,
    ad_id INT,
    platform VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    platform_resource_id VARCHAR(200),
    status VARCHAR(20) NOT NULL,
    request_payload JSONB,
    response_payload JSONB,
    error_message TEXT,
    duration_ms INT,
    executed_by INT NOT NULL,
    executed_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approval_comments (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id),
    campaign_id INT NOT NULL REFERENCES campaigns(id),
    ad_id INT,
    user_id INT NOT NULL,
    comment TEXT NOT NULL,
    action VARCHAR(30) NOT NULL DEFAULT 'comment',
    attachment_url VARCHAR(1000),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id),
    user_id INT NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    resource_type VARCHAR(50),
    resource_id INT,
    action_url VARCHAR(500),
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(500) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    revoked_at TIMESTAMP,
    replaced_by VARCHAR(500),
    ip_address VARCHAR(50),
    user_agent VARCHAR(500)
);

CREATE TABLE IF NOT EXISTS invitations (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id),
    email VARCHAR(200) NOT NULL,
    role_id INT NOT NULL,
    invited_by INT NOT NULL,
    token VARCHAR(200) NOT NULL UNIQUE,
    status VARCHAR(20) DEFAULT 'pending',
    accepted_at TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ab_tests (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id),
    campaign_id INT NOT NULL REFERENCES campaigns(id),
    name VARCHAR(200) NOT NULL,
    variant_a_ad_id INT NOT NULL,
    variant_b_ad_id INT NOT NULL,
    metric VARCHAR(50) NOT NULL DEFAULT 'ctr',
    traffic_split INT DEFAULT 50,
    status VARCHAR(20) DEFAULT 'draft',
    winner VARCHAR(5),
    confidence_level DECIMAL(5,2),
    variant_a_result DECIMAL(12,4),
    variant_b_result DECIMAL(12,4),
    created_by INT,
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budget_allocations (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id),
    period_type VARCHAR(20) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_budget DECIMAL(14,2) NOT NULL,
    facebook_allocation DECIMAL(14,2) DEFAULT 0,
    tiktok_allocation DECIMAL(14,2) DEFAULT 0,
    youtube_allocation DECIMAL(14,2) DEFAULT 0,
    google_allocation DECIMAL(14,2) DEFAULT 0,
    spent_to_date DECIMAL(14,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    created_by INT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    company_id INT,
    user_id INT NOT NULL,
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(50),
    description TEXT,
    details JSONB,
    ip_address VARCHAR(50),
    user_agent VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_templates (
    id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(id),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    objective_id INT,
    targeting JSONB,
    budget_config JSONB,
    creative_specs JSONB,
    platforms TEXT[],
    is_global BOOLEAN DEFAULT false,
    created_by INT,
    use_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audience_templates (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    targeting JSONB NOT NULL DEFAULT '{}',
    estimated_size BIGINT,
    created_by INT,
    use_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_library (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id),
    filename VARCHAR(500) NOT NULL,
    original_name VARCHAR(500),
    file_path VARCHAR(1000) NOT NULL,
    file_url VARCHAR(1000) NOT NULL,
    file_type VARCHAR(20) NOT NULL DEFAULT 'image',
    mime_type VARCHAR(100),
    file_size_bytes BIGINT,
    width INT,
    height INT,
    duration_seconds INT,
    folder VARCHAR(50) DEFAULT 'assets',
    tags TEXT[],
    status VARCHAR(20) DEFAULT 'active',
    uploaded_by INT,
    uploaded_at TIMESTAMP DEFAULT NOW()
);

-- Step 6: Create indexes
CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_roles_company ON roles(company_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_company ON campaigns(company_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_adsets_campaign ON ad_sets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ads_adset ON ads(ad_set_id);
CREATE INDEX IF NOT EXISTS idx_metrics_campaign ON ad_metrics(campaign_id, date);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_activity_date ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_deplogs_campaign ON deployment_logs(campaign_id);

-- Done!
SELECT 'Migration completed successfully' AS result;
