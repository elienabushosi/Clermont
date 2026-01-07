-- Update report_status_enum to include 'pending'
-- Run this SQL in your Supabase SQL Editor to update the existing enum

-- Note: PostgreSQL doesn't support adding enum values in a specific position
-- This will add 'pending' to the enum (order doesn't matter for functionality)
ALTER TYPE report_status_enum ADD VALUE IF NOT EXISTS 'pending';

