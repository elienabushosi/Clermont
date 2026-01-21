# Agent Orchestration Documentation

## Project Structure

```
backend/
├── routes/
│   └── reports.js              # API endpoint for report generation
├── orchestration/
│   ├── orchestrator.js         # Main orchestration controller
│   └── agents/
│       ├── index.js            # Agent registry/configuration
│       ├── base-agent.js       # Abstract base class for all agents
│       ├── geoservice.js        # Geoservice agent (NYC Planning Geoservice API)
│       ├── transit-zones.js    # Transit Zones agent (ArcGIS Transit Zones API)
│       ├── zola.js             # Zola agent (CARTO MapPLUTO API)
│       ├── tax-lot-finder.js   # Tax lot finder (placeholder/disabled)
│       └── zoning-resolution.js # Zoning resolution
└── services/
    └── report-service.js       # Database operations for reports
```

## Data Flow

### Frontend → POST /api/reports/generate

**Sends:**

```json
{
	"address": "807 9th Ave, New York, NY 10019, USA"
}
```

-   Minimal payload: only `address` string is required
-   Backend handles address normalization via Geoservice
-   Optional hints (normalizedAddress, location, placeId) can be provided but Geoservice is source of truth
-   Includes auth token in headers: `Authorization: Bearer <token>`

### Route Handler (routes/reports.js)

1. Validates request (requires non-empty address string)
2. Extracts user/organization from auth token
3. Prepares address data object
4. Calls orchestrator with address data

### Orchestrator (orchestration/orchestrator.js)

**Sequential Execution Flow:**

1. **Create Report Record**

    - Creates report in `reports` table with Status: `'pending'`
    - Initial fields: Address, IdOrganization, IdClient (optional), Name

2. **Execute GeoserviceAgent (Sequential - Required)**

    - **Purpose**: Resolve NYC address to BBL (Borough-Block-Lot) identifier
    - **API**: NYC Planning Geoservice Function_1B
    - **Input**: `{ address: string }`
    - **Output**:
        - `bbl`: Borough-Block-Lot identifier (10 digits)
        - `normalizedAddress`: Standardized address format
        - `lat`/`lng`: Coordinates
        - `borough`, `block`, `lot`: Parsed components
        - `buildingClass`: Building classification code
        - `bin`: Building Identification Number
        - `communityDistrict`, `cityCouncilDistrict`, `schoolDistrict`
        - `policePrecinct`, `fireCompany`, `fireDivision`
        - `sanitationBorough`, `sanitationDistrict`, `sanitationSubsection`
        - `zoningMap`: DCP zoning map reference
    - **Storage**: Result stored in `report_sources` table with SourceKey: `'geoservice'`
    - **Critical**: If Geoservice fails, report status set to `'failed'` and process stops
    - **Update Report**: Extracts BBL, normalizedAddress, lat, lng and updates main `reports` record

3. **Execute TransitZonesAgent (Sequential - Uses lat/lng from Geoservice)**

    - **Purpose**: Determine transit zone classification for parking requirements
    - **API**: ArcGIS Transit Zones FeatureServer (point-in-polygon query)
    - **Input**: `{ address, bbl, normalizedAddress, location: { lat, lng } }` (lat/lng from Geoservice)
    - **Endpoint**: `https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/ArcGIS/rest/services/Transit_Zones/FeatureServer/0/query`
    - **Query Method**: Point-in-polygon spatial query using lat/lng coordinates
    - **Output**:
        - `transitZone`: Normalized enum (`"inner"`, `"outer"`, `"manhattan_core_lic"`, `"beyond_gtz"`, `"unknown"`)
        - `transitZoneLabel`: Human-readable label
        - `matched`: Boolean indicating if polygon match was found
        - `input`: Original lat/lng coordinates used
        - `sourceUrl`: Full ArcGIS query URL
        - `notes`: Error messages or special notes (if any)
    - **Storage**: Result stored in `report_sources` table with SourceKey: `'transit_zones'`
    - **Non-Critical**: TransitZonesAgent failure does not fail the report; returns `transitZone: "unknown"` on failure
    - **Normalization**: Maps ArcGIS string values to internal enum:
        - "Inner Transit Zone" → `"inner"`
        - "Outer Transit Zone" → `"outer"`
        - "Manhattan Core and Long Island City Parking Areas" → `"manhattan_core_lic"`
        - No features found → `"beyond_gtz"`
        - Error/timeout → `"unknown"`

4. **Execute ZolaAgent (Sequential - Uses BBL from Geoservice)**

    - **Purpose**: Fetch property parcel data from NYC Planning Labs CARTO MapPLUTO
    - **API**: Planning Labs CARTO SQL API (`planninglabs.carto.com/api/v2/sql`)
    - **Input**: `{ address, bbl, normalizedAddress, location }` (BBL from Geoservice)
    - **Query**: SQL query to `dcp_mappluto` table filtered by BBL
    - **Output**: MapPLUTO property data including:
        - Core identifiers: address, bbl, block, lot, borough, zipcode
        - Community/district: cd, council
        - Zoning: zonedist1-4, overlay1-2, spdist1-3, zonemap
        - Landmarks/historic: landmark, histdist
        - Land use: landuse
        - Lot dimensions: lotarea, lotfront, lotdepth
        - Building info: bldgarea, numbldgs, numfloors, unitsres, unitstotal, yearbuilt, yearalter1-2, bldgclass
        - Coordinates: lon, lat
    - **Storage**: Result stored in `report_sources` table with SourceKey: `'zola'`
    - **Non-Critical**: ZolaAgent failure does not fail the report (for V1)

5. **Update Report Status**
    - If Geoservice succeeded: Status set to `'ready'`
    - If Geoservice failed: Status set to `'failed'`

### Agent Execution (orchestration/agents/\*.js)

**Base Agent Interface (base-agent.js):**

-   All agents extend `BaseAgent` class
-   Implements common error handling and logging
-   Each agent must implement `fetchData(addressData, reportId)` method

**Agent Input Contract:**

```javascript
{
  address: string,              // Original address from frontend
  bbl?: string,                  // BBL from Geoservice (for agents after Geoservice)
  normalizedAddress?: string,    // Normalized address from Geoservice
  location?: { lat: number, lng: number }  // Coordinates from Geoservice
}
```

**Agent Output Contract:**

```javascript
{
  status: 'succeeded' | 'failed' | 'skipped',
  data: {
    contentJson: object,         // Structured JSON data from API
    contentText?: string,         // Optional text content
    sourceUrl?: string,           // API endpoint URL
    extracted?: object            // Extracted/parsed data (for Geoservice)
  },
  error?: string                 // Error message if failed
}
```

**GeoserviceAgent (geoservice.js):**

-   **Data Source**: NYC Planning Geoservice API
-   **Endpoint**: `https://geoservice.planning.nyc.gov/geoservice/geoservice.svc/Function_1B`
-   **Method**: GET request with query params (Borough, AddressNo, StreetName, Key)
-   **Borough Detection**:
    -   Primary: ZIP code-based mapping (10001-10299 Manhattan, 10451-10475 Bronx, etc.)
    -   Fallback: Text-based detection (MANHATTAN, BROOKLYN, etc.)
-   **Response Parsing**: Extracts nested response structure to get BBL, coordinates, and district information
-   **API Key**: Stored in `process.env.GEOSERVICE_API_KEY`

**TransitZonesAgent (transit-zones.js):**

-   **Data Source**: ArcGIS Transit Zones FeatureServer
-   **Endpoint**: `https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/ArcGIS/rest/services/Transit_Zones/FeatureServer/0/query`
-   **Method**: GET request with point-in-polygon spatial query
-   **Query Parameters**:
    -   `geometryType`: `"esriGeometryPoint"`
    -   `geometry`: JSON point with `{ x: lng, y: lat, spatialReference: { wkid: 4326 } }`
    -   `inSR`: `"4326"` (WGS84)
    -   `spatialRel`: `"esriSpatialRelIntersects"`
    -   `outFields`: `"TranstZone"`
    -   `returnGeometry`: `"false"`
-   **Response Format**: GeoJSON with `features` array containing `attributes.TranstZone`
-   **Lat/Lng Requirement**: Must receive `lat` and `lng` from GeoserviceAgent (cannot run without coordinates)
-   **Normalization**: Converts ArcGIS string values to internal enum for consistent use by ZoningResolutionAgent

**ZolaAgent (zola.js):**

-   **Data Source**: Planning Labs CARTO MapPLUTO
-   **Endpoint**: `https://planninglabs.carto.com/api/v2/sql`
-   **Method**: GET request with SQL query in `q` parameter
-   **Query Format**: Compact SQL (no extra whitespace) - `SELECT ... FROM dcp_mappluto WHERE bbl=${bblNumber}`
-   **Response Format**: GeoJSON
-   **BBL Requirement**: Must receive BBL from GeoserviceAgent (cannot run without it)

**ZoningResolutionAgent (zoning-resolution.js):**

-   **Data Source**: Reads from stored `zola`, `transit_zones`, and `geoservice` sources (no external API calls)
-   **Purpose**: Computes zoning constraints including FAR, lot coverage, height, density, and parking requirements
-   **Input**: Reads from `report_sources` where `SourceKey` in `["zola", "transit_zones", "geoservice"]`
-   **Output**: Computed zoning metrics stored in `report_sources` with `SourceKey: "zoning_resolution"`
-   **Non-Critical**: Failure does not fail the report

**Placeholder Agents:**

-   `tax-lot-finder.js`: Returns "disabled" message

### Report Service (services/report-service.js)

**Database Operations:**

-   `createReport()`: Creates new report record with Status: `'pending'`
-   `updateReportWithGeoserviceData()`: Updates report with BBL, normalizedAddress, Latitude, Longitude
-   `storeAgentResult()`: Stores agent execution results in `report_sources` table
-   `updateReportStatus()`: Updates report status (`'pending'` → `'ready'` or `'failed'`)
-   `getReportsByOrganization()`: Fetches all reports for an organization
-   `getReportWithSources()`: Fetches single report with all associated sources

**Database Schema:**

-   `reports` table:
    -   `BBL` (TEXT): Borough-Block-Lot identifier
    -   `Latitude` (NUMERIC(10, 8)): Property latitude
    -   `Longitude` (NUMERIC(11, 8)): Property longitude
    -   `AddressNormalized` (TEXT): Standardized address from Geoservice
    -   `Status` (ENUM): `'pending'`, `'ready'`, `'failed'`
-   `report_sources` table:
    -   `SourceKey` (TEXT): Agent identifier (`'geoservice'`, `'zola'`, etc.)
    -   `ContentJson` (JSONB): Structured data from agent
    -   `ContentText` (TEXT): Optional text content
    -   `SourceUrl` (TEXT): API endpoint URL
    -   `Status` (ENUM): `'succeeded'`, `'failed'`, `'skipped'`
    -   `ErrorMessage` (TEXT): Error details if failed

### Response → Frontend

**Returns:**

```json
{
  "status": "success",
  "message": "Report generation started",
  "reportId": "uuid",
  "reportStatus": "ready" | "pending" | "failed",
  "agentResults": [
    {
      "agent": "geoservice",
      "status": "succeeded" | "failed"
    }
  ]
}
```

## Key Design Decisions

1. **Sequential Execution**: 
    - GeoserviceAgent must run first and succeed (provides BBL and coordinates)
    - TransitZonesAgent runs after Geoservice (requires lat/lng)
    - ZolaAgent runs after Geoservice (requires BBL)
    - ZoningResolutionAgent runs after Zola, TransitZones, and Geoservice (reads stored sources)
2. **Minimal Frontend Payload**: Frontend only sends address string; backend handles all normalization
3. **BBL as Canonical Identifier**: BBL is extracted by Geoservice and used for all subsequent data lookups
4. **Coordinates for Transit Zones**: lat/lng from Geoservice used for ArcGIS point-in-polygon queries
5. **Structured Data Extraction**: GeoserviceAgent extracts and structures all available data fields for future use
6. **Non-Critical Agents**: TransitZonesAgent, ZolaAgent, and ZoningResolutionAgent failures don't fail the report (for V1 - may change in future)
7. **Database Storage**: All agent results stored in `report_sources` with full JSON payload for audit/debugging
8. **Agent Independence**: ZoningResolutionAgent reads stored sources rather than calling external APIs directly, keeping it deterministic and testable

## Future Enhancements

-   Parallel execution of non-dependent agents after Geoservice (TransitZonesAgent and ZolaAgent can run in parallel)
-   AI report generator to synthesize agent results into human-readable summary
-   Additional agents: Tax Lot Finder
-   WebSocket/SSE for real-time report generation updates
-   Retry logic for failed agent calls
-   Caching of Geoservice results by address
-   Caching of TransitZones results by lat/lng coordinates