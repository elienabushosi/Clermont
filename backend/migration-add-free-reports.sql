-- Migration: Add free reports tracking to organizations table
-- Run this in your Supabase SQL Editor

ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS "FreeReportsUsed" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "FreeReportsLimit" INTEGER DEFAULT 2;
