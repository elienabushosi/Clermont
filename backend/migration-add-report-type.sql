-- Add report_type to reports table for single vs assemblage
-- Run in Supabase SQL Editor. Existing rows get default 'single'.

ALTER TABLE reports
ADD COLUMN IF NOT EXISTS "ReportType" TEXT NOT NULL DEFAULT 'single';

-- Optional: index for filtering by type
CREATE INDEX IF NOT EXISTS idx_reports_report_type ON reports("ReportType");

COMMENT ON COLUMN reports."ReportType" IS 'single | assemblage';
