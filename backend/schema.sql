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
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

