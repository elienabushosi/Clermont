-- Lindero Database Schema
-- Run this SQL in your Supabase SQL Editor to create the tables

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
    "IdOrganization" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Name" TEXT NOT NULL,
    "Type" TEXT,
    "SubscriptionStatus" TEXT DEFAULT 'none', -- 'active', 'past_due', 'canceled', 'none'
    "TrialEndsAt" TIMESTAMP WITH TIME ZONE, -- Optional, can be configured later
    "FreeReportsUsed" INTEGER DEFAULT 0, -- Track free reports used (only for owners)
    "FreeReportsLimit" INTEGER DEFAULT 2, -- Maximum free reports allowed
    "CreatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "UpdatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    "IdUser" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "IdOrganization" UUID NOT NULL REFERENCES organizations("IdOrganization") ON DELETE CASCADE,
    "Name" TEXT NOT NULL,
    "Email" TEXT NOT NULL UNIQUE,
    "Password" TEXT NOT NULL,
    "Role" TEXT NOT NULL DEFAULT 'Owner',
    "Enabled" BOOLEAN NOT NULL DEFAULT TRUE,
    "CreatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "UpdatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users("Email");
CREATE INDEX IF NOT EXISTS idx_users_organization ON users("IdOrganization");
CREATE INDEX IF NOT EXISTS idx_organizations_name ON organizations("Name");

-- Create a function to automatically update UpdatedAt timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."UpdatedAt" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update UpdatedAt
DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ----------------------------------------------------
-- Clients table
-- ----------------------------------------------------
CREATE TABLE IF NOT EXISTS clients (
    "IdClient" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "IdOrganization" UUID NOT NULL REFERENCES organizations("IdOrganization") ON DELETE CASCADE,
    "Name" TEXT NOT NULL,
    "Email" TEXT,
    "PhoneNumber" TEXT,
    "Enabled" BOOLEAN NOT NULL DEFAULT TRUE,
    "CreatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "UpdatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for clients
CREATE INDEX IF NOT EXISTS idx_clients_organization ON clients("IdOrganization");
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients("Email");

-- Trigger to auto-update UpdatedAt for clients
DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
CREATE TRIGGER update_clients_updated_at
BEFORE UPDATE ON clients
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ----------------------------------------------------
-- Reports table
-- ----------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status_enum') THEN
        CREATE TYPE report_status_enum AS ENUM ('pending', 'ready', 'failed');
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS reports (
    "IdReport" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "IdOrganization" UUID NOT NULL REFERENCES organizations("IdOrganization") ON DELETE CASCADE,
    "IdClient" UUID NULL REFERENCES clients("IdClient") ON DELETE SET NULL,
    "CreatedBy" UUID NULL REFERENCES users("IdUser") ON DELETE SET NULL,
    "Name" TEXT NOT NULL,
    "Address" TEXT NOT NULL,
    "AddressNormalized" TEXT,
    "BBL" TEXT,
    "Latitude" NUMERIC(10, 8),
    "Longitude" NUMERIC(11, 8),
    "Description" TEXT,
    "Status" report_status_enum NOT NULL DEFAULT 'pending',
    "CreatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "UpdatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "Enabled" BOOLEAN NOT NULL DEFAULT TRUE
);

-- Indexes for reports
CREATE INDEX IF NOT EXISTS idx_reports_organization ON reports("IdOrganization");
CREATE INDEX IF NOT EXISTS idx_reports_client ON reports("IdClient");
CREATE INDEX IF NOT EXISTS idx_reports_createdby ON reports("CreatedBy");
CREATE INDEX IF NOT EXISTS idx_reports_org_createdat ON reports("IdOrganization", "CreatedAt" DESC);
CREATE INDEX IF NOT EXISTS idx_reports_bbl ON reports("BBL");
CREATE INDEX IF NOT EXISTS idx_reports_org_bbl ON reports("IdOrganization", "BBL");

-- Trigger to auto-update UpdatedAt for reports
DROP TRIGGER IF EXISTS update_reports_updated_at ON reports;
CREATE TRIGGER update_reports_updated_at
BEFORE UPDATE ON reports
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ----------------------------------------------------
-- Report Sources table
-- ----------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_source_status_enum') THEN
        CREATE TYPE report_source_status_enum AS ENUM ('succeeded', 'failed');
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS report_sources (
    "IdReportSource" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "IdReport" UUID NOT NULL REFERENCES reports("IdReport") ON DELETE CASCADE,
    "SourceKey" TEXT NOT NULL, -- e.g., 'zola', 'tax_lot_finder'
    "ContentText" TEXT,
    "ContentJson" JSONB,
    "SourceUrl" TEXT,
    "Status" report_source_status_enum NOT NULL DEFAULT 'succeeded',
    "ErrorMessage" TEXT,
    "CreatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "UpdatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for report_sources
CREATE INDEX IF NOT EXISTS idx_report_sources_report ON report_sources("IdReport");
CREATE INDEX IF NOT EXISTS idx_report_sources_sourcekey ON report_sources("SourceKey");
CREATE INDEX IF NOT EXISTS idx_report_sources_report_sourcekey ON report_sources("IdReport", "SourceKey");

-- Trigger to auto-update UpdatedAt for report_sources
DROP TRIGGER IF EXISTS update_report_sources_updated_at ON report_sources;
CREATE TRIGGER update_report_sources_updated_at
BEFORE UPDATE ON report_sources
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ----------------------------------------------------
-- Join Codes table
-- ----------------------------------------------------
CREATE TABLE IF NOT EXISTS joincodes (
    "IdJoinCode" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Code" TEXT NOT NULL UNIQUE,
    "IdOrganization" UUID NOT NULL REFERENCES organizations("IdOrganization") ON DELETE CASCADE,
    "CreatedBy" UUID NOT NULL REFERENCES users("IdUser") ON DELETE CASCADE,
    "CreatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "ExpiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "UsedAt" TIMESTAMP WITH TIME ZONE,
    "UsedBy" UUID REFERENCES users("IdUser") ON DELETE SET NULL
);

-- Indexes for joincodes
CREATE INDEX IF NOT EXISTS idx_joincodes_code ON joincodes("Code");
CREATE INDEX IF NOT EXISTS idx_joincodes_organization ON joincodes("IdOrganization");
CREATE INDEX IF NOT EXISTS idx_joincodes_createdby ON joincodes("CreatedBy");
CREATE INDEX IF NOT EXISTS idx_joincodes_expiresat ON joincodes("ExpiresAt");
CREATE INDEX IF NOT EXISTS idx_joincodes_usedat ON joincodes("UsedAt");


-- ----------------------------------------------------
-- Password Reset Codes table
-- ----------------------------------------------------
CREATE TABLE IF NOT EXISTS password_reset_codes (
    "IdPasswordResetCode" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "IdUser" UUID NOT NULL REFERENCES users("IdUser") ON DELETE CASCADE,
    "Code" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "ExpiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "UsedAt" TIMESTAMP WITH TIME ZONE
);

-- Indexes for password_reset_codes
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_user ON password_reset_codes("IdUser");
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_code ON password_reset_codes("Code");
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_expiresat ON password_reset_codes("ExpiresAt");
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_usedat ON password_reset_codes("UsedAt");


-- ----------------------------------------------------
-- Subscriptions table
-- ----------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
    "IdSubscription" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "IdOrganization" UUID NOT NULL REFERENCES organizations("IdOrganization") ON DELETE CASCADE,
    "StripeCustomerId" TEXT,
    "StripeSubscriptionId" TEXT UNIQUE,
    "StripePriceId" TEXT NOT NULL,
    "Status" TEXT NOT NULL, -- 'trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired'
    "TrialEndsAt" TIMESTAMP WITH TIME ZONE,
    "CurrentPeriodStart" TIMESTAMP WITH TIME ZONE,
    "CurrentPeriodEnd" TIMESTAMP WITH TIME ZONE,
    "CancelAtPeriodEnd" BOOLEAN DEFAULT FALSE,
    "CreatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "UpdatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_organization ON subscriptions("IdOrganization");
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions("StripeCustomerId");
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription ON subscriptions("StripeSubscriptionId");
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions("Status");

-- Trigger to auto-update UpdatedAt for subscriptions
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON subscriptions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
