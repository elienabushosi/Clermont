# Assemblage Reports

Assemblage (multiparcel) reports combine **exactly two addresses** into one report: Geoservice and Zola run per address, then we aggregate lot area, buildable square footage, density (DUF), zoning consistency, and contamination risk. This doc summarizes how we set it up, which data points we use, and the math/calculations.

---

## What Changed to Enable Assemblage

### Backend

1. **Schema**
   - **reports:** Added `ReportType` (`'single'` | `'assemblage'`). Migration: `migration-add-report-type.sql`. Assemblage reports store the combined address as `Address` (e.g. `"807 9th Ave, New York, NY 10019; 10 Columbus Cir, New York, NY"`).
   - **report_sources:** Same table as single reports. Assemblage uses multiple rows per `SourceKey` (e.g. two `geoservice` rows, two `zola` rows), disambiguated by `ContentJson.childIndex` (0 and 1).

2. **Orchestration**
   - **`orchestration/assemblage-orchestrator.js`** — New. Runs in sequence: create report → Geoservice per address → Zola per address → aggregation (lot area, FAR, density) → zoning consistency → contamination risk → store all and set status `ready`.

3. **Services**
   - **`services/assemblage-zoning-consistency.js`** — Compares zoning across lots (primary district, normalized profile, same block; overlays/special districts).
   - **`services/assemblage-contamination-risk.js`** — Flags landmark, historic district, special district, overlays; outputs risk level and confidence.

4. **Routes**
   - **`routes/assemblage-reports.js`** — `POST /api/assemblage-reports/generate`. Same auth and subscription/free-report checks as single reports. Sends admin **attempt** and **generation** emails (production only), same as single reports (address line: `Assemblage: addr1; addr2`).

5. **Report service**
   - **`services/report-service.js`** — `createReport()` accepts `reportType: 'assemblage'` and sets `ReportType`. List/get report responses include `ReportType` so the frontend can route to assemblage vs single view.

### Frontend

- **Land Assemblage page** — Two address fields; calls `POST /api/assemblage-reports/generate`; then redirects to `/assemblagereportview/[id]`.
- **Assemblage report view** — `/assemblagereportview/[id]` shows per-lot property cards, combined calculations (lot area, buildable sq ft, FAR method, density), zoning consistency, contamination risk, map(s).
- **Reports list** — Type column shows "Assemblage" vs "Single"; "View Report" goes to `/assemblagereportview/[id]` when `ReportType === 'assemblage'`, else `/viewreport/[id]`.

---

## API

- **Endpoint:** `POST /api/assemblage-reports/generate`
- **Auth:** Bearer token; subscription/free-report rules same as single reports.
- **Body:** `{ "addresses": ["addr1", "addr2"] }`
- **Validation:** Exactly 2 addresses; each non-empty string (no whitespace-only).

### Example (curl)

```bash
curl -X POST http://localhost:3002/api/assemblage-reports/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"addresses":["807 9th Ave, New York, NY 10019","10 Columbus Cir, New York, NY"]}'
```

---

## External API Calls (per assemblage report)

| Service | Calls | Purpose |
|--------|-------|--------|
| **Geoservice** (NYC Planning) | **2** | One per address: resolve address → BBL, normalized address, lat/lng. |
| **Zola** (CARTO MapPLUTO) | **2** | One per BBL: fetch parcel data (lot area, zoning, building class, landmark, overlays, etc.). |

Zoning resolution and aggregation use in-memory logic on Zola payloads; no extra external calls.

---

## Data Sources and Stored Results

### report_sources (per report)

| SourceKey | Description |
|-----------|-------------|
| `assemblage_input` | Input addresses and version (e.g. v1). |
| `geoservice` | Two rows: `ContentJson.childIndex` 0 and 1; each has `extracted` (bbl, normalizedAddress, lat, lng). |
| `zola` | Two rows: `ContentJson.childIndex` 0 and 1; each has MapPLUTO payload (see below). |
| `assemblage_aggregation` | `lots`, `combinedLotAreaSqft`, `totalBuildableSqft`, `farMethod`, `density`, `flags`, `assumptions`. |
| `assemblage_zoning_consistency` | Per-lot zoning, same-primary-district / same-normalized-profile / same-block, overlays/special districts, confidence, `requires_manual_review`. |
| `assemblage_contamination_risk` | Per-lot flags (landmark, historic district, special district, overlays), `contaminationRisk`, `confidence`, `requires_manual_review`. |

### Zola/MapPLUTO fields we use (per lot)

- **Identifiers:** `bbl`, `block`, `lot`, `borough` / `borocode`, `address`, `zipcode`
- **Area / bulk:** `lotarea`, `bldgarea`, `lotfront`, `lotdepth`, `numfloors`, `numbldgs`
- **Zoning:** `zonedist1`–`zonedist4`, `zonemap`, `overlay1`, `overlay2`, `spdist1`–`spdist3`
- **Use / type:** `landuse`, `bldgclass`, `unitsres`, `unitstotal`
- **Contamination / review:** `landmark`, `histdist`
- **Other:** `yearbuilt`, `yearalter1`, `yearalter2`, `ownername`, `ownertype`, etc.

---

## Math and Calculations

### 1. Combined lot area

- **Source:** `lotarea` from each lot’s Zola payload (MapPLUTO).
- **Rule:** Sum only lots with valid `lotarea` (number > 0). Invalid or missing lot area is treated as 0 for the sum and sets flags `missingLotArea` and `partialTotal`.

```
combinedLotAreaSqft = Σ lotarea (over lots where lotarea is a valid number > 0)
```

### 2. Per-lot FAR and buildable square footage

- **Source:** Zoning Resolution agent’s `computeControllingFARFromZola(zolaPayload)` (same logic as single-parcel). Uses Zola’s `zonedist1`–`zonedist4`, `zonemap`, etc., to pick controlling FAR (e.g. lowest in multi-district).
- **Formulas:**

```
lotBuildableSqft = maxFar × lotarea   (when maxFar and lotarea are valid)
totalBuildableSqft = Σ lotBuildableSqft (over lots with valid FAR and lot area)
```

- **FAR method per lot:** `single_district`, `lowest_of_multi`, or `unknown`; plus `requires_manual_review` when multiple districts or ambiguous.

### 3. Assemblage FAR method

- **shared_district:** All lots have the same normalized zoning profile and none require manual review → we treat the assemblage as one zoning context.
- **per_lot_sum:** Otherwise (different profiles or any lot needs review) → we sum per-lot buildable sq ft and set `assemblageRequiresManualReview = true`.

```
allSameProfile = (lots.length >= 2) && every lot has same normalizedProfile
noneRequireReview = every lot has requires_manual_review === false
assemblageFarMethod = allSameProfile && noneRequireReview ? "shared_district" : "per_lot_sum"
```

### 4. Density (DUF – dwelling units per floor area)

- **Source:** NYC Zoning Resolution §23-52. Default DUF = **680** sq ft per dwelling unit.
- **Rounding:** Fractions **≥ 0.75** round **up**; otherwise round **down** (ZR §23-52).
- **Applicability:** DUF applies when the building is “multiple dwelling” (from `bldgclass` or `unitsres > 2`).

**Rounding (used in zoning-resolution agent and assemblage):**

```
units_raw = floorAreaSqft / 680
fractionalPart = units_raw - floor(units_raw)
units_rounded = fractionalPart >= 0.75 ? ceil(units_raw) : floor(units_raw)
```

**Two ways we use it for assemblage:**

- **Method 1 – Combined area then DUF once:**  
  `maxUnitsCombined = roundDwellingUnitsByZR(totalBuildableSqft, 680).units_rounded`  
  Used when `assemblageFarMethod === "shared_district"` and no overlays/special districts and no missing inputs.

- **Method 2 – Per-lot DUF then sum:**  
  For each lot: `units_rounded = roundDwellingUnitsByZR(lotBuildableSqft, 680).units_rounded`  
  `maxUnitsPerLotSum = Σ units_rounded` (only lots with valid inputs).  
  Used when zoning differs, overlays/special districts present, or any lot has missing inputs or manual review.

- **defaultMethod:** `combined_area_then_duf` vs `per_lot_duf_sum`; `densityRequiresManualReview` is set when we use per-lot method or when inputs are missing or overlays/special districts are present.

### 5. Zoning consistency (assemblage-zoning-consistency.js)

- **Inputs:** Per-lot Zola payloads (`zonedist1`–`zonedist4`, `overlay1`/`overlay2`, `spdist1`–`spdist3`, `block`, etc.).
- **Outputs:**
  - **samePrimaryDistrict** — Every lot has same non-null `zonedist1`.
  - **sameNormalizedProfile** — Every lot has same normalized district profile (e.g. R7-2 → R7).
  - **sameBlock** — Every lot has same non-null `block`.
  - **hasAnyOverlay**, **hasAnySpecialDistrict**, **multiDistrictLotsCount** (lots with more than one district).
- **confidence / requires_manual_review:** High when same primary district, no overlays/special districts, no multi-district lots; otherwise medium/low and `requires_manual_review` true.

### 6. Contamination risk (assemblage-contamination-risk.js)

- **Inputs:** Per-lot Zola payloads (`landmark`, `histdist`, `spdist1`–`spdist3`, `overlay1`, `overlay2`).
- **Landmark:** Normalized from MapPLUTO (Y/YES/1/true → true; N/NO/0/false → false; else null → lowers confidence).
- **Risk levels (conservative):**
  - **high:** Any lot is landmarked.
  - **moderate:** Any historic district, any special district, or any overlay (and no landmark).
  - **none:** No landmark, historic district, special district, or overlay.
- **confidence:** High by default; medium if one lot missing Zola or landmark parsed null; low if multiple lots missing Zola or all missing.
- **requires_manual_review:** True when `contaminationRisk !== "none"` or `confidence !== "high"`.

---

## DB Verification

After a successful run:

- **reports:** One row with `ReportType = 'assemblage'`, `Status = 'ready'` (or `'failed'` if Geoservice failed for either address).
- **report_sources:** `assemblage_input`; two `geoservice` rows (childIndex 0, 1); two `zola` rows (childIndex 0, 1); `assemblage_aggregation`; `assemblage_zoning_consistency`; `assemblage_contamination_risk`.

---

## Behavior Summary

- **Validation:** Exactly 2 non-empty addresses; otherwise 400.
- **Geoservice fails for one address:** Report status = `failed`; no Zola for that address.
- **Zola fails for one lot:** Report can stay `ready`; aggregation uses valid lot areas; flags `partialTotal` / `missingLotArea` when lot area is missing.
- **Zoning consistency / contamination risk:** Non-fatal; failures stored in report_sources but do not set report status to failed.

---

## References

- ZR §23-52 (Maximum Number of Dwelling Units): https://zr.planning.nyc.gov/article-ii/chapter-3#23-52  
- Geoservice: `README-GEOSERVICE.md`  
- Zoning Resolution agent (FAR, DUF, rounding): `README-ZONING-RESOLUTION.md`  
- Single-report orchestration: `README-ORCHESTRATION.md`
