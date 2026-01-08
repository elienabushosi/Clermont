-- Add BBL, Latitude, and Longitude columns to reports table
-- Run this SQL in your Supabase SQL Editor to update the existing table

-- Add BBL column (BIGINT to store numeric BBL, or TEXT if you prefer)
ALTER TABLE reports 
ADD COLUMN IF NOT EXISTS "BBL" TEXT;

-- Add Latitude and Longitude columns (NUMERIC for precision)
ALTER TABLE reports 
ADD COLUMN IF NOT EXISTS "Latitude" NUMERIC(10, 8);

ALTER TABLE reports 
ADD COLUMN IF NOT EXISTS "Longitude" NUMERIC(11, 8);

-- Add index on BBL for faster lookups
CREATE INDEX IF NOT EXISTS idx_reports_bbl ON reports("BBL");

-- Add index on organization and BBL for common queries
CREATE INDEX IF NOT EXISTS idx_reports_org_bbl ON reports("IdOrganization", "BBL");

