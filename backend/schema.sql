-- Lindero Database Schema
-- Run this SQL in your Supabase SQL Editor to create the tables

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
    "IdOrganization" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Name" TEXT NOT NULL,
    "Type" TEXT,
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
        CREATE TYPE report_status_enum AS ENUM ('ready', 'failed');
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS reports (
    "IdReport" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "IdOrganization" UUID NOT NULL REFERENCES organizations("IdOrganization") ON DELETE CASCADE,
    "IdClient" UUID NULL REFERENCES clients("IdClient") ON DELETE SET NULL,
    "Name" TEXT NOT NULL,
    "Address" TEXT NOT NULL,
    "AddressNormalized" TEXT,
    "Description" TEXT,
    "Status" report_status_enum NOT NULL DEFAULT 'ready',
    "CreatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "UpdatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "Enabled" BOOLEAN NOT NULL DEFAULT TRUE
);

-- Indexes for reports
CREATE INDEX IF NOT EXISTS idx_reports_organization ON reports("IdOrganization");
CREATE INDEX IF NOT EXISTS idx_reports_client ON reports("IdClient");
CREATE INDEX IF NOT EXISTS idx_reports_org_createdat ON reports("IdOrganization", "CreatedAt" DESC);

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
