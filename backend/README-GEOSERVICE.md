# NYC Geoservice Integration - Setup Guide

## Overview

This backend now integrates with NYC Planning Geoservice and CARTO MapPLUTO APIs to generate property feasibility reports.

## Architecture

### Flow

1. **Frontend** sends `{ address: "2847 Broadway, Manhattan, NY 10025" }`
2. **GeoserviceAgent** resolves address → BBL + normalized address + coordinates
3. **ZolaAgent** uses BBL → fetches MapPLUTO parcel data from CARTO
4. Results stored in `report_sources` table
5. Report status updated to 'ready' or 'failed'

### Agents

#### GeoserviceAgent (`geoservice`)

-   **Purpose**: Resolve NYC address to BBL (Borough-Block-Lot)
-   **API**: NYC Planning Geoservice Function_1B
-   **Input**: `{ address: string }`
-   **Output**: `{ bbl, normalizedAddress, lat, lng, borough, block, lot }`
-   **Required**: Must succeed for report generation to continue

#### ZolaAgent (`zola`)

-   **Purpose**: Fetch property parcel data from MapPLUTO
-   **API**: Planning Labs CARTO SQL API
-   **Input**: `{ bbl: string }` (from GeoserviceAgent)
-   **Output**: MapPLUTO property data (zoning, lot details, building info, etc.)

## Environment Variables

Add to your `backend/.env` file:

```env
GEOSERVICE_API_KEY=TjWnZr4u7xXABCHF
```

**Important**: Never commit API keys to version control. Use environment variables in production.

## Database Schema Updates

Run the SQL migration to add BBL, Latitude, and Longitude columns:

```sql
-- See backend/schema-update-reports-bbl.sql
```

Or update your `reports` table manually:

-   `BBL` (TEXT) - Borough-Block-Lot identifier
-   `Latitude` (NUMERIC(10, 8))
-   `Longitude` (NUMERIC(11, 8))

## API Endpoints

### POST /api/reports/generate

**Request:**

```json
{
	"address": "2847 Broadway, Manhattan, NY 10025"
}
```

**Response:**

```json
{
	"status": "success",
	"message": "Report generation started",
	"reportId": "uuid",
	"status": "ready",
	"bbl": "1001892015",
	"normalizedAddress": "2847 BROADWAY",
	"agentResults": [
		{
			"agent": "geoservice",
			"status": "succeeded"
		}
	]
}
```

## Address Format

The GeoserviceAgent parses addresses automatically, but for best results:

-   Include borough name: "Manhattan", "Brooklyn", "Queens", "Bronx", or "Staten Island"
-   Format: `{Number} {Street Name}, {Borough}, NY {Zip}`

Examples:

-   ✅ "2847 Broadway, Manhattan, NY 10025"
-   ✅ "456 Atlantic Ave, Brooklyn, NY 11217"
-   ❌ "2847 Broadway" (missing borough)

## Error Handling

-   If GeoserviceAgent fails → Report status = 'failed', process stops
-   If ZolaAgent fails → Report status = 'ready' (Geoservice succeeded), but Zola data missing
-   All errors stored in `report_sources` table with `ErrorMessage` field

## Testing

1. Start backend: `npm run dev:backend`
2. Send test request:

```bash
curl -X POST http://localhost:3002/api/reports/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"address": "2847 Broadway, Manhattan, NY 10025"}'
```

## Next Steps (Future)

-   Add more agents (Tax Lot Finder, Zoning Resolution)
-   AI summary generation from `report_sources` data
-   Caching for frequently requested addresses
-   Rate limiting for API calls
