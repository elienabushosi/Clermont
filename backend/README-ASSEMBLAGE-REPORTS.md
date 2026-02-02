# Assemblage Reports

Assemblage reports combine two addresses into one report: Geoservice + Zola run per address, then Combined Lot Area is computed and stored.

## API

- **Endpoint:** `POST /api/assemblage-reports/generate`
- **Auth:** Same as single reports (Bearer token, subscription/free-report checks)
- **Body:** `{ "addresses": ["addr1", "addr2"] }`
- **Validation:** Exactly 2 addresses; each must be a non-empty string (no whitespace-only).

## Testing with curl

Replace `YOUR_TOKEN` with a valid auth token:

```bash
curl -X POST http://localhost:3002/api/assemblage-reports/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"addresses":["807 9th Ave, New York, NY 10019","10 Columbus Cir, New York, NY"]}'
```

## DB verification

After a successful run:

- **reports:** One row with `ReportType = 'assemblage'`, `Status = 'ready'` (or `'failed'` if Geoservice failed for either address).
- **report_sources** for that report should include:
  - `assemblage_input` — input addresses and version
  - `geoservice` — two rows (same SourceKey), with `ContentJson.childIndex` 0 and 1
  - `zola` — two rows (same SourceKey), with `ContentJson.childIndex` 0 and 1 (one may be failed)
  - `assemblage_aggregation` — `ContentJson.lots`, `ContentJson.combinedLotAreaSqft`, `ContentJson.flags`

## Behavior

- **One address invalid / missing:** API returns 400 with a clear message.
- **Geoservice fails for one child:** Parent report status = `failed`.
- **Zola fails for one child:** Parent report remains `ready`; aggregation uses valid lot areas; `flags.partialTotal` / `flags.missingLotArea` set when lot area is missing for a lot.

## Frontend

- **Land Assemblage:** `/land-assemblage` — two address fields, calls `POST /api/assemblage-reports/generate`, then redirects to assemblage report view.
- **Assemblage report view:** `/assemblagereportview/[id]` — shows Properties (per-lot cards) and Combined Calculations (Combined Lot Area + partial-total message when applicable).
- **Reports list:** View button routes to `/assemblagereportview/[id]` when `ReportType === 'assemblage'`, else `/viewreport/[id]`.
