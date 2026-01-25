-- Migration: Add Quantity field to subscriptions table for per-seat billing
-- Run this in your Supabase SQL Editor

ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS "Quantity" INTEGER DEFAULT 1;

-- Update existing subscriptions to have quantity 1 (owner only)
UPDATE subscriptions
SET "Quantity" = 1
WHERE "Quantity" IS NULL;
