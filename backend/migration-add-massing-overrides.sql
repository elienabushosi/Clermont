-- Add massing overrides JSON blob to reports (single-parcel 3D massing inputs + panel state)
ALTER TABLE reports
ADD COLUMN IF NOT EXISTS "MassingOverridesJson" JSONB NULL;

COMMENT ON COLUMN reports."MassingOverridesJson" IS 'User-saved 3D massing inputs and UI state (inputsPanelHidden) for viewreport; null = use hardcoded defaults';
