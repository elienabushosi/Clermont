# Zoning Resolution Agent - Documentation

## Overview

The ZoningResolutionAgent computes maximum Floor Area Ratio (FAR), maximum lot coverage, and height constraints (minimum base height, maximum base height, and maximum building height) for residential zoning districts in NYC. It implements hardcoded lookup tables and rule-based calculations based on the NYC Zoning Resolution (Article II - Residential Districts).

## Architecture

### Flow

1. **GeoserviceAgent** resolves address → BBL + normalized address + coordinates
2. **ZolaAgent** uses BBL → fetches MapPLUTO parcel data from CARTO
3. **ZoningResolutionAgent** reads Zola data → computes max FAR and max lot coverage
4. Results stored in `report_sources` table with `SourceKey: "zoning_resolution"`
5. Report status remains 'ready' (ZoningResolutionAgent is non-critical)

### Agent Details

#### ZoningResolutionAgent (`zoning_resolution`)

-   **Purpose**: Compute maximum FAR, maximum lot coverage, and height constraints for residential districts
-   **Data Source**: Reads from stored Zola source data (no external API calls)
-   **Input**: Reads from `report_sources` where `SourceKey = "zola"`
-   **Output**: Computed zoning constraints (max FAR, max lot coverage, height constraints, derived calculations)
-   **Status**: Non-critical - failure does not fail the report
-   **Scope**: Residential districts only (R1-R12) - Article II

## Data Sources

The agent reads the following fields from the Zola source data:

### Required Fields

-   `zonedist1` - Primary zoning district (e.g., "R8", "R7-2", "R6B")
-   `lotarea` - Lot area in square feet
-   `bldgarea` - Existing building area in square feet (for remaining FAR calculation)
-   `bldgclass` - Building class code (for building type inference)

### Optional Fields

-   `zonedist2`, `zonedist3`, `zonedist4` - Additional zoning districts (multi-district lots)
-   `overlay1`, `overlay2` - Zoning overlays
-   `spdist1`, `spdist2`, `spdist3` - Special purpose districts
-   `lotdepth`, `lotfront` - Lot dimensions (for future special rules)

## Calculations

### Maximum FAR (Floor Area Ratio)

**Method**: Hardcoded lookup table for residential districts

**Supported Districts**:

-   **R1-R5** (Low density): 0.5 - 1.25 FAR
-   **R6** (Medium density): 2.43 FAR (contextual variants: R6A = 3.0, R6B = 2.0)
-   **R7** (Medium-high density): 3.44 FAR (contextual variants: R7A = 4.0, R7B = 3.0)
-   **R8** (High density): 6.02 FAR (contextual variants: R8A = 7.2, R8B = 4.0)
-   **R9-R12** (Very high density): 7.52 - 12.0 FAR

**Matching Logic**:

1. Exact match (e.g., "R8" → 6.02)
2. Base district match (e.g., "R7-2" → matches "R7" → 3.44)
3. Returns `null` if district not supported

### Maximum Lot Coverage

**Method**: Rule-based calculation using NYC Zoning Resolution Sections 23-361 and 23-362

#### R1-R5 Districts (Section 23-361)

**Single- or Two-Family Residences**:

-   R1/R2: Interior/through = 40%, Corner = 80%
-   R3: Interior/through = 50%, Corner = 80%
-   R4/R5: Interior/through = 60%, Corner = 80%

**Multiple Dwelling Residences** (where permitted):

-   Interior/through = 80%, Corner = 100%

**Special Cases** (not implemented in V1):

-   R2X, R3A, R3X: Yard-based lot coverage → returns `null` with explanation

#### R6-R12 Districts (Section 23-362)

**Standard Lots**:

-   Interior/through = 80%, Corner = 100%

**Eligible Sites** (not evaluated in V1):

-   Section 23-434 eligible sites → flagged as "not evaluated"

#### Special Rules (Section 23-363)

**Shallow Lots** (not implemented in V1):

-   Special rules for shallow zoning lots → flagged as "not evaluated"

### Derived Calculations

If `maxFAR` and `lotArea` exist:

-   `maxBuildableFloorAreaSqft = maxFAR × lotArea`

If `bldgarea` exists:

-   `remainingBuildableFloorAreaSqft = maxBuildableFloorAreaSqft - bldgarea`
-   Clamped at 0; if 0, message: "FAR limit reached already"

If `maxLotCoverage` and `lotArea` exist:

-   `maxBuildingFootprintSqft = maxLotCoverage × lotArea`

### Height Constraints

The agent calculates three height-related metrics for residential districts:

#### Minimum Base Height

**Method**: Hardcoded lookup table based on NYC Zoning Resolution Section 23-432

**Supported Districts**:

-   **R1-R5**: Returns `"see_section"` kind with citation to ZR §23-421 or §23-422 (no single fixed value)
-   **R6**: Conditional district with two possible values:
    -   40 ft (depends on zoning conditions)
    -   30 ft (depends on zoning conditions)
-   **R6A, R6-1**: 40 ft
-   **R6B, R6D, R6-2**: 30 ft
-   **R7 districts**: 40-60 ft (varies by variant)
-   **R8 districts**: 55-60 ft (varies by variant)
-   **R9 districts**: 60-105 ft (varies by variant)
-   **R10 districts**: 60-125 ft (varies by variant)
-   **R11, R12**: 60 ft

**Output Types**:

-   `"fixed"`: Single value in feet (e.g., R8 → 60 ft)
-   `"conditional"`: Multiple possible values with `candidates` array (e.g., R6 → 30-40 ft range)
-   `"see_section"`: No single value; requires manual review of ZR section (R1-R5)
-   `"unsupported"`: District not in lookup table

#### Maximum Base Height and Maximum Building Height

**Method**: Hardcoded lookup table based on NYC Zoning Resolution Section 23-432

**Supported Districts**:

-   **R1-R5**: Returns `"unsupported"` (height regulations vary by specific conditions)
-   **R6**: Conditional - multiple candidate pairs:
    -   Base: 40 ft, Building: 40 ft
    -   Base: 30 ft, Building: 45 ft
-   **R7-1**: Conditional - multiple candidate pairs:
    -   Base: 35 ft, Building: 35 ft
    -   Base: 35 ft, Building: 45 ft
-   **R7-2, R7-21**: Fixed - Base: 35 ft, Building: 35 ft
-   **R7A, R7B**: Fixed - Base: 35 ft, Building: 45 ft
-   **R7D, R7X, R7-3**: Fixed - Base: 60 ft, Building: 80 ft
-   **R8**: Conditional - multiple candidate pairs:
    -   Base: 85 ft, Building: 115 ft
    -   Base: 95 ft, Building: 135 ft
-   **R8A**: Fixed - Base: 95 ft, Building: 135 ft
-   **R8B**: Fixed - Base: 55 ft, Building: 75 ft
-   **R8X**: Fixed - Base: 85 ft, Building: 115 ft
-   **R9, R9A**: Conditional - multiple candidate pairs:
    -   Base: 105 ft, Building: 145 ft
    -   Base: 95 ft, Building: 135 ft
-   **R9D, R9-1**: Fixed - Base: 125 ft, Building: 175 ft
-   **R9X**: Conditional - multiple candidate pairs:
    -   Base: 125 ft, Building: 175 ft
    -   Base: 125 ft, Building: 165 ft
-   **R10, R10X**: Conditional - multiple candidate pairs:
    -   Base: 125 ft, Building: 175 ft
    -   Base: 125 ft, Building: 165 ft
-   **R10A**: Fixed - Base: 125 ft, Building: 175 ft
-   **R11, R11A**: Fixed - Base: 125 ft, Building: 175 ft
-   **R12**: Fixed - Base: 125 ft, Building: 175 ft

**Output Structure**:

-   `"fixed"`: Single candidate with `max_base_height_ft` and `max_building_height_ft`
-   `"conditional"`: Array of candidates, each with:
    -   `max_base_height_ft`: Maximum base height in feet
    -   `max_building_height_ft`: Maximum building height in feet
    -   `when`: Description of conditions (if applicable)
    -   `source_url`: Link to ZR section
    -   `source_section`: ZR section reference (e.g., "ZR §23-432")
-   `"unsupported"`: District not supported

**Citations**: All height values include source URLs and section references to the NYC Zoning Resolution.

### Inferences

**Lot Type**:

-   Default: `"interior_or_through"` (V1 - no reliable corner lot indicator)
-   Assumption: "Lot type unknown; assumed interior/through"

**Building Type**:

-   Based on `bldgclass` prefix:
    -   `A*` or `B*` → `"single_or_two_family"`
    -   `C*` or `D*` → `"multiple_dwelling"`
    -   Unknown → defaults to `"single_or_two_family"` with assumption

## Output Structure

The agent stores results in `report_sources` with the following structure:

```json
{
	"district": "R8",
	"profile": "R8",
	"contextual": false,
	"lotType": "interior_or_through",
	"buildingType": "multiple_dwelling",
	"maxFar": 6.02,
	"maxLotCoverage": 0.8,
	"derived": {
		"maxBuildableFloorAreaSqft": 18812.5,
		"remainingBuildableFloorAreaSqft": 7662.5,
		"maxBuildingFootprintSqft": 2500
	},
	"height": {
		"min_base_height": {
			"kind": "fixed",
			"value_ft": 60,
			"candidates": null,
			"source_url": "https://zr.planning.nyc.gov/article-ii/chapter-3/23-432",
			"source_section": "ZR §23-432",
			"notes": null,
			"requires_manual_review": false
		},
		"envelope": {
			"kind": "conditional",
			"candidates": [
				{
					"max_base_height_ft": 85,
					"max_building_height_ft": 115,
					"when": "Depends on applicable zoning conditions; see citation.",
					"source_url": "https://zr.planning.nyc.gov/article-ii/chapter-3/23-432",
					"source_section": "ZR §23-432"
				},
				{
					"max_base_height_ft": 95,
					"max_building_height_ft": 135,
					"when": "Depends on applicable zoning conditions; see citation.",
					"source_url": "https://zr.planning.nyc.gov/article-ii/chapter-3/23-432",
					"source_section": "ZR §23-432"
				}
			],
			"notes": "Multiple values apply; manual review required.",
			"requires_manual_review": true
		}
	},
	"assumptions": [
		"Lot type unknown; assumed interior/through",
		"Single- or two-family in R1/R2 (Section 23-361(a))"
	],
	"flags": {
		"hasOverlay": false,
		"hasSpecialDistrict": false,
		"multiDistrictLot": false,
		"lotTypeInferred": true,
		"buildingTypeInferred": false,
		"eligibleSiteNotEvaluated": false,
		"specialLotCoverageRulesNotEvaluated": true
	}
}
```

## Error Handling

-   **Zola source not found**: Returns error - "Zola source data not found. ZolaAgent must run before ZoningResolutionAgent."
-   **District not found**: Returns `null` for maxFar/maxLotCoverage with assumption explaining why
-   **Non-residential district**: Returns `null` with assumption: "District X is not residential; V1 supports R\* districts only"
-   **Agent failure**: Stored in `report_sources` with `Status: "failed"` and `ErrorMessage`, but does not fail the report

## Limitations (V1)

1. **Residential districts only**: Commercial (Article III), Non-conforming (Article V), Special regs (Article VI) not supported
2. **Hardcoded FAR lookup**: Limited set of districts; unknown districts return `null`
3. **Lot type inference**: Defaults to interior/through (no corner lot detection)
4. **Special rules not implemented**:
    - Yard-based lot coverage (R2X, R3A, R3X)
    - Eligible site rules (Section 23-434)
    - Shallow lot rules (Section 23-363)
5. **Height constraints limitations**:
    - R1-R5 minimum base height returns `"see_section"` (no fixed values)
    - R1-R5 maximum base/building heights return `"unsupported"` (not implemented)
    - Conditional districts require manual review to determine which candidate applies
    - Some district variants may not be in lookup tables
6. **No AI or web scraping**: All calculations are deterministic and rule-based

## Testing

1. Generate a report with a residential address:

```bash
curl -X POST http://localhost:3002/api/reports/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"address": "807 9th Ave, Manhattan, NY 10019"}'
```

2. Check the `report_sources` table for `SourceKey = "zoning_resolution"`:

```sql
SELECT ContentJson, Status, ErrorMessage
FROM report_sources
WHERE SourceKey = 'zoning_resolution'
ORDER BY CreatedAt DESC
LIMIT 1;
```

3. View in frontend: Navigate to `/viewreport/[reportId]` and check the "Zoning Constraints" section

## Example Output

For a property in R8 district with:

-   Lot area: 3,125 sq ft
-   Building area: 11,150 sq ft
-   Building class: C7 (multiple dwelling)

**Result**:

```json
{
	"district": "R8",
	"maxFar": 6.02,
	"maxLotCoverage": 0.8,
	"lotType": "interior_or_through",
	"buildingType": "multiple_dwelling",
	"derived": {
		"maxBuildableFloorAreaSqft": 18812.5,
		"remainingBuildableFloorAreaSqft": 7662.5,
		"maxBuildingFootprintSqft": 2500
	},
	"height": {
		"min_base_height": {
			"kind": "fixed",
			"value_ft": 60,
			"source_url": "https://zr.planning.nyc.gov/article-ii/chapter-3/23-432",
			"source_section": "ZR §23-432"
		},
		"envelope": {
			"kind": "conditional",
			"candidates": [
				{
					"max_base_height_ft": 85,
					"max_building_height_ft": 115,
					"source_url": "https://zr.planning.nyc.gov/article-ii/chapter-3/23-432",
					"source_section": "ZR §23-432"
				},
				{
					"max_base_height_ft": 95,
					"max_building_height_ft": 135,
					"source_url": "https://zr.planning.nyc.gov/article-ii/chapter-3/23-432",
					"source_section": "ZR §23-432"
				}
			],
			"requires_manual_review": true
		}
	}
}
```

## Future Enhancements

-   [ ] Expand FAR lookup to cover all residential district variants
-   [ ] Implement corner lot detection from PLUTO or Geoservice data
-   [ ] Add yard-based lot coverage calculation (R2X, R3A, R3X)
-   [ ] Implement eligible site rules (Section 23-434)
-   [ ] Add shallow lot rules (Section 23-363)
-   [ ] Support commercial districts (Article III)
-   [ ] Add required yards calculations
-   [ ] Expand height constraints to R1-R5 districts (currently returns "see_section" or "unsupported")
-   [ ] Add logic to automatically determine which candidate applies for conditional height districts
-   [ ] Cache calculations by district + lot type + building type

## References

-   NYC Zoning Resolution Article II - Residential Districts
-   Section 23-361 - Maximum lot coverage in R1 through R5 Districts
-   Section 23-362 - Maximum lot coverage in R6 through R12 Districts
-   Section 23-363 - Special rules for certain interior or through lots
-   Section 23-421 - Minimum base height in R1 through R3 Districts
-   Section 23-422 - Minimum base height in R4 and R5 Districts
-   Section 23-432 - Height and setback regulations in R6 through R12 Districts
-   NYC Department of City Planning - Zoning Handbook
