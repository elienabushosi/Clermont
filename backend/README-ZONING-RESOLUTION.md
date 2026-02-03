# Zoning Resolution Agent - Documentation

## Overview

The ZoningResolutionAgent computes maximum Floor Area Ratio (FAR), maximum lot coverage, height constraints (minimum base height, maximum base height, and maximum building height), density requirements (Dwelling Unit Factor / DUF), residential parking requirements, and yard requirements (front, side, rear) for residential zoning districts in NYC. It implements hardcoded lookup tables and rule-based calculations based on the NYC Zoning Resolution (Article II - Residential Districts, Chapter 5 - Parking and Loading).

## Architecture

### Flow

1. **GeoserviceAgent** resolves address → BBL + normalized address + coordinates
2. **TransitZonesAgent** uses lat/lng from Geoservice → determines transit zone classification via ArcGIS
3. **ZolaAgent** uses BBL → fetches MapPLUTO parcel data from CARTO
4. **ZoningResolutionAgent** reads Zola, TransitZones, and Geoservice data → computes max FAR, max lot coverage, height constraints, density requirements (DUF), parking requirements, and yard requirements
5. Results stored in `report_sources` table with `SourceKey: "zoning_resolution"`
6. Report status remains 'ready' (ZoningResolutionAgent is non-critical)

### Agent Details

#### ZoningResolutionAgent (`zoning_resolution`)

-   **Purpose**: Compute maximum FAR, maximum lot coverage, height constraints, density requirements (DUF), residential parking requirements, and yard requirements for residential districts
-   **Data Source**: Reads from stored source data (no external API calls)
-   **Input**: Reads from `report_sources` where `SourceKey` in `["zola", "transit_zones", "geoservice"]`
-   **Output**: Computed zoning constraints (max FAR, max lot coverage, height constraints, density requirements, parking requirements, yard requirements, derived calculations)
-   **Status**: Non-critical - failure does not fail the report
-   **Scope**: Residential districts only (R1-R12) - Article II, Chapter 5

## Data Sources

The agent reads data from multiple stored sources:

### Zola Source (`SourceKey: "zola"`)

**Required Fields:**
-   `zonedist1` - Primary zoning district (e.g., "R8", "R7-2", "R6B")
-   `lotarea` - Lot area in square feet
-   `bldgarea` - Existing building area in square feet (for remaining FAR calculation)
-   `bldgclass` - Building class code (for building type inference)

**Optional Fields:**
-   `zonedist2`, `zonedist3`, `zonedist4` - Additional zoning districts (multi-district lots)
-   `overlay1`, `overlay2` - Zoning overlays
-   `spdist1`, `spdist2`, `spdist3` - Special purpose districts
-   `lotdepth`, `lotfront` - Lot dimensions (for parking requirements, yard requirements, and special rules)
-   `unitsres` - Number of residential units (for density and parking requirements)
-   `borough` - Borough code (MN/BK/QN/BX/SI) (for parking special provisions)

### TransitZones Source (`SourceKey: "transit_zones"`)

**Required Fields:**
-   `transitZone` - Normalized transit zone enum (`"inner"`, `"outer"`, `"manhattan_core_lic"`, `"beyond_gtz"`, `"unknown"`)

**Optional Fields:**
-   `transitZoneLabel` - Human-readable transit zone label
-   `matched` - Boolean indicating if polygon match was found
-   `notes` - Error messages or special notes

### Geoservice Source (`SourceKey: "geoservice"`)

**Optional Fields (for parking special provisions):**
-   `communityDistrict` - Community district number (for Section 25-24 special provisions)

## Calculations

### Maximum FAR (Floor Area Ratio)

**Method**: Hardcoded lookup table per NYC Zoning Resolution **standard** zoning lots (R1–R5) and **standard** residences (R6–R12) only.

**Source**: [ZR § 23-20](https://zr.planning.nyc.gov/index.php/article-ii/chapter-3/23-20) (intro), [ZR § 23-21](https://zr.planning.nyc.gov/index.php/article-ii/chapter-3/23-21) (R1–R5), [ZR § 23-22](https://zr.planning.nyc.gov/index.php/article-ii/chapter-3/23-22) (R6–R12).

**Supported Districts** (representative; many sub-districts listed explicitly):

-   **R1–R5**: 0.75–2.0 FAR (e.g. R1/R1-1/R1-2 = 0.75; R4/R4-1 = 1.5; R5/R5D = 2.0)
-   **R6**: 2.2 base; R6A/R61/R6-1/R7B = 3.0; R6B = 2.0; R6D/R6-2 = 2.5
-   **R7**: R7/R7-1/R7-2 = 3.44; R7A/R7-11/R7-21 = 4.0; R7D = 4.66; R7X/R7-3 = 5.0
-   **R8**: 6.02 (R8/R8A/R8X); R8B = 4.0
-   **R9–R12**: R9/R9A = 7.52; R9D/R9X/R9-1 = 9.0; R10 = 10; R11 = 12; R12 = 15

**Matching Logic**:

1. Exact match (e.g. "R7-2" → 3.44, "R9X" → 9.0)
2. Base district fallback for minor variants not in lookup
3. Returns `null` if district not supported

**FAR assumptions & limitations** (see report view for user-facing citations):

-   We use the **standard** FAR column only. Higher FAR may apply for qualifying residential sites (R1–R5), qualifying affordable or senior housing (R6–R12), or lots within 100 ft of a wide street; we do not have data to apply those.
-   For lots with multiple zoning districts (zonedist1–4), we use the **lowest** applicable FAR and flag for manual review.
-   Special floor area exemptions (ZR § 23-23: amenities, corridors, refuse, elevated ground floor) are not applied to the buildable calculation. We optionally expose a **refuse exemption** (up to 3 sq ft per dwelling unit per [ZR § 23-233](https://zr.planning.nyc.gov/index.php/article-ii/chapter-3/23-233)) as informational only.

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

### Density Requirements (Dwelling Unit Factor / DUF)

**Method**: Rule-based calculation using NYC Zoning Resolution Section 23-52

**Purpose**: Calculate maximum number of dwelling units for multiple dwelling residences based on the Dwelling Unit Factor (DUF) rule.

**Calculation Formula**:

-   Maximum dwelling units = (Maximum residential floor area permitted) / DUF
-   Default DUF value: 680 square feet per unit
-   Uses `maxBuildableFloorAreaSqft` (derived from `maxFAR × lotArea`) as the maximum residential floor area permitted

**Rounding Rule**:

-   Fractions >= 0.75 → round up to next unit
-   Fractions < 0.75 → round down

**Applicability**:

-   Only applies to multiple dwelling residences
-   Determined by: `buildingType === "multiple_dwelling"` OR `unitsres > 2`
-   Single- or two-family residences: DUF not applicable (returns null with explanatory note)

**Output Structure**:
The density requirements are returned as a toggle with two candidates:

1. **"DUF applies" (default)**:

    - `duf_applicable: true`
    - `duf_value: 680`
    - `max_dwelling_units`: Calculated integer (or null if missing inputs)
    - `max_res_floor_area_sqft`: The maxBuildableFloorAreaSqft used in calculation
    - `rounding_rule`: "Fractions >= 0.75 round up; otherwise round down"
    - `source_url`: "https://zr.planning.nyc.gov/article-ii/chapter-3#23-52"
    - `source_section`: "ZR §23-52"
    - `requires_manual_review`: true if overlays/special districts present

2. **"DUF not applicable"**:
    - `duf_applicable: false`
    - `duf_value: null`
    - `max_dwelling_units: null`
    - `notes`: "No DUF-based unit cap; unit count governed by other constraints."
    - `source_url`: "https://zr.planning.nyc.gov/article-ii/chapter-3#23-52"
    - `source_section`: "ZR §23-52"
    - `requires_manual_review: true`

**Exception Cases** (V1 approach):

-   V1 does NOT automatically determine senior/affordable/conversion eligibility
-   Instead, provides both scenarios as toggle candidates
-   Frontend allows users to switch between "DUF applies" and "DUF not applicable" scenarios
-   Manual review required for special cases (overlays, special districts, conversions, etc.)

**Missing Inputs**:

-   If `maxFAR` or `lotArea` is missing → `max_dwelling_units` returns `null` with note: "Missing required inputs (max FAR or lot area) for DUF calculation"

**Frontend Display**:

-   Toggle switch between the two candidates
-   Default selection: "DUF applies"
-   Displays max dwelling units when DUF applies
-   Shows explanatory notes when DUF not applicable
-   Citation link to ZR §23-52

### Residential Parking Requirements

**Method**: Rule-based calculation using NYC Zoning Resolution Chapter 5 (Sections 25-21, 25-22, 25-23, 25-24)

**Purpose**: Calculate required parking spaces for multiple dwelling residences based on transit zone classification, zoning district, dwelling unit count, and lot characteristics.

**Applicability**:

-   Only computes parking if:
    -   `buildingType === "multiple_dwelling"` AND
    -   `unitsres > 2`
-   Otherwise returns `kind: "not_applicable"` with explanatory note

**Transit Zone Regimes**:

Parking requirements are determined by transit zone classification (from TransitZonesAgent):

1. **Regime 25-21** (Inner Transit Zone - existing buildings):
    -   Applies when `transitZone === "inner"`
    -   Lookup table by district: R1-R12 with standard percentage per dwelling unit and waiver maximum spaces
    -   Source: ZR §25-21

2. **Regime 25-22** (Outer Transit Zone):
    -   Applies when `transitZone === "outer"`
    -   Lookup table by district groups: R1-R12 with standard percentage and waiver maximum spaces
    -   Source: ZR §25-22

3. **Regime 25-23** (Beyond Greater Transit Zone):
    -   Applies when `transitZone === "beyond_gtz"`
    -   Lookup table by district with separate percentages for:
        -   Standard units
        -   Affordable income-restricted units
        -   Qualifying senior units
        -   Ancillary dwelling units (ADUs)
    -   Includes footnote logic that modifies standard percentages based on `lotarea` and `lotfront`
    -   Source: ZR §25-23

4. **Manhattan Core & LIC** (`transitZone === "manhattan_core_lic"`):
    -   Returns both Regime 25-21 and 25-22 candidates
    -   Sets `requires_manual_review: true` with note: "Manhattan Core & LIC has special parking areas; confirm which section applies."

5. **Unknown Transit Zone** (`transitZone === "unknown"`):
    -   Returns all three regime candidates (25-21, 25-22, 25-23)
    -   Sets `requires_manual_review: true` and `transit_zone_unknown: true`

**Special Provisions (Section 25-24)**:

-   **Bronx CD12**: Flags `special_provisions_may_apply: true` and includes both Outer and Beyond-GTZ regime candidates
-   **Queens CD3, CD4, CD14**: Flags `special_provisions_may_apply: true` and includes both Outer and Beyond-GTZ regime candidates
-   Note: V1 does not evaluate exact boundary geometry (e.g., "east of Junction Blvd" for Queens CD3/CD4)

**Calculation Formula** (per scenario):

For each scenario (standard, affordable, senior, ADU):

1.   `raw_spaces = units × (percent / 100)`
2.   `rounded_spaces = round halves up` (fraction >= 0.5 → ceil, else floor)
3.   If `rounded_spaces <= waiverMaxSpaces` → `required_spaces = 0`
4.   Else → `required_spaces = rounded_spaces`

**Footnote Logic (Regime 25-23 only)**:

Applies to "standard" scenario percentages:

-   **R7-1, R7A, R7B, R7D, R7X**: Standard percent reduced to 30% where `lotarea <= 10,000 sqft`
-   **R7-2, R7-3**: 
    -   Standard percent reduced to 30% where `lotarea` is 10,001-15,000 sqft
    -   Standard percent waived (0%) where `lotarea <= 10,000 sqft`
-   **R8, R9, R10, R11, R12**:
    -   Standard percent reduced to 20% where `lotarea` is 10,001-15,000 sqft
    -   Standard percent waived (0%) where `lotarea <= 10,000 sqft`
-   **Lot width <= 25 ft** (V1 assumption):
    -   If `lotfront <= 25`, produces override candidate with 0 spaces
    -   Sets `requires_manual_review: true` with note about "lot existed on Dec 5, 2024" assumption
    -   For R4B districts: applies "waive 1 space" rule if required_spaces > 0

**Output Structure**:

```json
{
  "parking": {
    "kind": "fixed" | "candidates" | "not_applicable" | "unsupported",
    "transit_zone": "inner" | "outer" | "manhattan_core_lic" | "beyond_gtz" | "unknown",
    "regimes": [
      {
        "regime_key": "existing_inner_transit_25_21" | "outer_transit_25_22" | "beyond_gtz_25_23",
        "scenarios": [
          {
            "scenario_key": "standard" | "affordable_income_restricted" | "qualifying_senior" | "ancillary_dwelling_unit",
            "percent_per_dwelling_unit": number,
            "waiver_max_spaces": number,
            "computed": {
              "units": number,
              "raw_spaces": number,
              "rounded_spaces": number,
              "required_spaces_after_waiver": number
            },
            "notes": string[],
            "requires_manual_review": boolean
          }
        ],
        "source_section": "ZR §25-21" | "ZR §25-22" | "ZR §25-23",
        "source_url": string | null
      }
    ],
    "flags": {
      "requires_manual_review": boolean,
      "transit_zone_unknown": boolean,
      "affordability_unknown": boolean,
      "senior_unknown": boolean,
      "adu_unknown": boolean,
      "conversion_unknown": boolean,
      "unit_creation_date_unknown": boolean,
      "special_provisions_may_apply": boolean
    },
    "assumptions": string[]
  }
}
```

**Disclaimers** (always included in output):

-   `affordability_unknown: true` - Cannot reliably infer qualifying affordable housing status
-   `senior_unknown: true` - Cannot reliably infer qualifying senior housing status
-   `adu_unknown: true` - Cannot reliably infer ancillary dwelling unit status
-   `conversion_unknown: true` - Cannot reliably infer conversion status
-   `unit_creation_date_unknown: true` - Cannot reliably determine if units existed prior to Dec 5, 2024

**Frontend Display**:

-   Shows transit zone classification
-   Displays each applicable regime with its scenarios
-   For each scenario, shows computed spaces, percentages, waivers, and notes
-   Citation links to ZR §25-21, §25-22, §25-23
-   Flags and assumptions displayed as badges

### Residential Yard Requirements

**Method**: Rule-based calculation using NYC Zoning Resolution Article II, Chapter 3 (Sections 23-321, 23-322, 23-332, 23-335, 23-342)

**Purpose**: Calculate required front, side, and rear yard dimensions for residential districts based on zoning district, building type, and lot characteristics.

**Applicability**:

-   **Residential districts only**: R1-R12
-   **Non-residential districts**: Returns `kind: "unsupported"` with note "V1 supports residential districts only"
-   **Missing district**: Returns `kind: "unsupported"` with note "District not provided"

**Output Structure**:

```json
{
	"yards": {
		"front": {
			"kind": "fixed" | "unsupported",
			"value_ft": number | null,
			"source_url": "https://zr.planning.nyc.gov/article-ii/chapter-3/23-321",
			"source_section": "ZR §23-321",
			"notes": ["Possible exceptions..."],
			"requires_manual_review": boolean
		},
		"side": {
			"kind": "fixed" | "unsupported",
			"value_ft": number | null,
			"source_url": "https://zr.planning.nyc.gov/article-ii/chapter-3/23-332",
			"source_section": "ZR §23-332",
			"notes": ["Possible exceptions..."],
			"requires_manual_review": boolean
		},
		"rear": {
			"kind": "fixed" | "unsupported",
			"value_ft": number | null,
			"source_url": "https://zr.planning.nyc.gov/article-ii/chapter-3/23-342",
			"source_section": "ZR §23-342",
			"notes": ["Possible exceptions..."],
			"requires_manual_review": boolean
		},
		"flags": {
			"buildingTypeInferred": boolean,
			"lotfrontMissing": boolean,
			"lotdepthMissing": boolean,
			"shallowLotCandidate": boolean,
			"districtVariantUsed": boolean
		}
	}
}
```

**Front Yard Requirements** (§23-321 for R1-R5, §23-322 for R6-R12):

-   **R6-R12**: No front yard required (`value_ft: 0`, cites §23-322)
-   **R1-R5**: Hardcoded lookup table with default values:
    -   R1 → 20 ft
    -   R2/R2A/R2X → 15 ft
    -   R3-1/R3-2 → 15 ft
    -   R3A/R3X → 10 ft
    -   R4/R4-1/R4A → 10 ft
    -   R4B → 5 ft
    -   R5/R5A → 10 ft
    -   R5B/R5D → 5 ft
    -   Generic base fallback (R1-R5) → 20 ft
-   **Possible exceptions** (always included in notes):
    -   Qualifying residential site with lot width >=150 ft may reduce by 5 ft (min 5 ft)
    -   Corner lot may reduce one front yard by 5 ft (min 5 ft)
    -   May match shallowest adjacent front yard (min 5 ft)
    -   Special line-up rule for R4B/R5B: no deeper than deepest adjacent, no shallower than shallowest; need not exceed 15 ft; does not apply if no prevailing street wall frontage
    -   Facade articulation encroachments up to 50% width, max 3 ft
-   **Manual review**: Always `true` for R1-R5 (modifiers depend on facts not available)

**Side Yard Requirements** (§23-332 for R1-R5, §23-335 for R6-R12):

-   **R1-R5** (§23-332):
    -   **Single/two-family** (A*/B* building class):
        -   Default assumes detached: R1 = 8 ft per side, R2-R5 = 5 ft per side
        -   Notes mention: if semi-detached/zero-lot-line (R3-R5), only one 5 ft side yard applies
        -   Notes mention: 8 ft total open area condition may apply when adjacent lot has 1-2 family
    -   **Multiple dwelling** (C*/D* building class):
        -   For R3-2, R4, R4B, R5, R5B, R5D: `value_ft: 0` (no required side yards per §23-332(c))
        -   For other R1-R5: `value_ft: 5` (conservative default)
        -   Notes mention: if any open area provided along side lot line, min width is 5 ft
-   **R6-R12** (§23-335):
    -   **Single/two-family**: Default assumes detached → `value_ft: 5` (two side yards, each 5 ft)
    -   **Multiple dwelling/unknown**: `value_ft: 0` (no required side yards)
    -   Notes mention: if open area along side lot line is provided at any level, min width is 5 ft
    -   Notes mention: permitted obstructions in side yards are described in ZR §23-331 and §§23-311/23-312
-   **Manual review**: Always `true` (building form cannot be reliably determined)

**Rear Yard Requirements** (§23-342):

-   **Default value**: `value_ft: 20` (standard lots at/below 75 ft baseline)
-   **Possible exceptions** (always included in notes):
    -   For detached and zero-lot-line: >=20 ft at/below 75 ft; 30 ft above 75 ft
    -   For semi-detached/attached:
        -   If lot width < 40 ft → 30 ft
        -   If lot width >=40 ft → 20 ft at/below 75 ft; 30 ft above 75 ft
    -   If `lotfront` exists, includes observed value and whether it crosses 40 ft threshold
    -   **Shallow lot condition**: If `lotdepth < 95`, adds note about possible reduction by 0.5 ft per 1 ft under 95 (min 10 ft) only if shallow condition existed on Dec 15, 1961 and did not change
-   **Manual review**: Always `true` (cannot determine lot type, building form, or height)

**Flags**:

-   `buildingTypeInferred: true` - Building type was inferred from building class (not explicitly provided)
-   `lotfrontMissing: true` - Lot frontage not available (affects rear yard conditional notes)
-   `lotdepthMissing: true` - Lot depth not available (affects shallow lot condition)
-   `shallowLotCandidate: true` - Lot depth < 95 ft (shallow lot condition may apply)
-   `districtVariantUsed: true` - Had to use base district fallback (e.g., R7-2 → R7)

**Frontend Display**:

-   Shows default `value_ft` for each yard type
-   Displays notes describing possible exceptions and modifiers
-   Citation links to ZR §23-321, §23-322, §23-332, §23-335, §23-342
-   Flags displayed as badges
-   Manual review badge shown when `requires_manual_review: true`

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
	"density": {
		"kind": "toggle",
		"candidates": [
			{
				"id": "duf_applies",
				"label": "Standard (DUF applies)",
				"duf_applicable": true,
				"duf_value": 680,
				"max_dwelling_units": 27,
				"max_res_floor_area_sqft": 18812.5,
				"rounding_rule": "Fractions >= 0.75 round up; otherwise round down",
				"source_url": "https://zr.planning.nyc.gov/article-ii/chapter-3#23-52",
				"source_section": "ZR §23-52",
				"notes": null,
				"requires_manual_review": false
			},
			{
				"id": "duf_not_applicable",
				"label": "Affordable/Senior/Conversion (DUF not applicable)",
				"duf_applicable": false,
				"duf_value": null,
				"max_dwelling_units": null,
				"notes": "No DUF-based unit cap; unit count governed by other constraints.",
				"source_url": "https://zr.planning.nyc.gov/article-ii/chapter-3#23-52",
				"source_section": "ZR §23-52",
				"requires_manual_review": true
			}
		]
	},
	"parking": {
		"kind": "candidates",
		"transit_zone": "outer",
		"regimes": [
			{
				"regime_key": "outer_transit_25_22",
				"scenarios": [
					{
						"scenario_key": "standard",
						"percent_per_dwelling_unit": 12,
						"waiver_max_spaces": 30,
						"computed": {
							"units": 12,
							"raw_spaces": 1.44,
							"rounded_spaces": 1,
							"required_spaces_after_waiver": 0
						},
						"notes": [],
						"requires_manual_review": false
					}
				],
				"source_section": "ZR §25-22",
				"source_url": "https://zr.planning.nyc.gov/article-ii/chapter-5/25-22"
			}
		],
		"flags": {
			"requires_manual_review": false,
			"transit_zone_unknown": false,
			"affordability_unknown": true,
			"senior_unknown": true,
			"adu_unknown": true,
			"conversion_unknown": true,
			"unit_creation_date_unknown": true,
			"special_provisions_may_apply": false
		},
		"assumptions": []
	},
	"assumptions": [
		"Lot type unknown; assumed interior/through",
		"Single- or two-family in R1/R2 (Section 23-361(a))",
		"Density requirements computed using DUF=680 scenario; alternate scenario provided for DUF-not-applicable cases."
	],
	"flags": {
		"hasOverlay": false,
		"hasSpecialDistrict": false,
		"multiDistrictLot": false,
		"lotTypeInferred": true,
		"buildingTypeInferred": false,
		"eligibleSiteNotEvaluated": false,
		"specialLotCoverageRulesNotEvaluated": true,
		"densityComputed": true,
		"densityMultipleDwelling": true,
		"densityMissingInputs": false
	}
}
```

## Error Handling

-   **Zola source not found**: Returns error - "Zola source data not found. ZolaAgent must run before ZoningResolutionAgent."
-   **TransitZones source not found**: Parking requirements computed with `transitZone: "unknown"` and all three regime candidates returned
-   **Geoservice source not found**: Parking special provisions (Section 25-24) not evaluated
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
6. **Density requirements limitations**:
    - DUF exceptions (senior housing, affordable housing, conversions, special density areas) not automatically determined
    - Provides toggle between "DUF applies" and "DUF not applicable" scenarios for user selection
    - Requires manual review when overlays or special districts are present
    - Single- or two-family residences return "not applicable" (DUF only applies to multiple dwellings)
7. **Parking requirements limitations**:
    - Only applies to multiple dwelling residences with `unitsres > 2`
    - Cannot reliably determine affordable/senior/ADU/conversion status - provides all scenarios
    - Cannot determine if units existed prior to Dec 5, 2024 - lot width <= 25 ft override marked for manual review
    - Special provisions (Section 25-24) flagged but exact boundary geometry not evaluated (e.g., "east of Junction Blvd")
    - Some district variants may not be in lookup tables (marked as unsupported)
    - R4-1, R4A, R4B, R5A in Regime 25-22 marked as unsupported (values not available in source)
8. **Yard requirements limitations**:
    - Only supports residential districts (R1-R12)
    - Returns default values with "possible exceptions" notes; does not compute conditional values
    - Cannot reliably determine detached vs semi-detached vs attached vs zero-lot-line building form
    - Cannot determine interior lot vs corner lot (affects front yard modifiers)
    - Cannot determine building height (affects rear yard requirements above 75 ft)
    - Cannot determine if shallow lot condition existed on Dec 15, 1961 (affects rear yard reduction)
    - Building type inferred from building class (A*/B* = single/two-family, C*/D* = multiple dwelling)
    - All yard requirements marked for manual review due to conditional modifiers
9. **No AI or web scraping**: All calculations are deterministic and rule-based

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
	},
	"density": {
		"kind": "toggle",
		"candidates": [
			{
				"id": "duf_applies",
				"label": "Standard (DUF applies)",
				"duf_applicable": true,
				"duf_value": 680,
				"max_dwelling_units": 27,
				"max_res_floor_area_sqft": 18812.5,
				"rounding_rule": "Fractions >= 0.75 round up; otherwise round down",
				"source_url": "https://zr.planning.nyc.gov/article-ii/chapter-3#23-52",
				"source_section": "ZR §23-52",
				"notes": null,
				"requires_manual_review": false
			},
			{
				"id": "duf_not_applicable",
				"label": "Affordable/Senior/Conversion (DUF not applicable)",
				"duf_applicable": false,
				"duf_value": null,
				"max_dwelling_units": null,
				"notes": "No DUF-based unit cap; unit count governed by other constraints.",
				"source_url": "https://zr.planning.nyc.gov/article-ii/chapter-3#23-52",
				"source_section": "ZR §23-52",
				"requires_manual_review": true
			}
		]
	}
}
```

**Density Calculation Details**:

-   Max buildable floor area: 18,812.5 sq ft (6.02 FAR × 3,125 sq ft lot area)
-   DUF calculation: 18,812.5 / 680 = 27.665 units
-   Rounding: 0.665 < 0.75 → round down to **27 units**

## Future Enhancements

-   [ ] Expand FAR lookup to cover all residential district variants
-   [ ] Implement corner lot detection from PLUTO or Geoservice data
-   [ ] Add yard-based lot coverage calculation (R2X, R3A, R3X)
-   [ ] Implement eligible site rules (Section 23-434)
-   [ ] Add shallow lot rules (Section 23-363)
-   [ ] Support commercial districts (Article III)
-   [x] Add required yards calculations (V1 implemented)
-   [ ] Expand height constraints to R1-R5 districts (currently returns "see_section" or "unsupported")
-   [ ] Add logic to automatically determine which candidate applies for conditional height districts
-   [ ] Cache calculations by district + lot type + building type
-   [ ] Automatically determine DUF exception eligibility (senior housing, affordable housing, conversions)
-   [ ] Add logic to detect special density areas for DUF exceptions
-   [ ] Support variable DUF values (currently hardcoded to 680)
-   [ ] Expand parking lookup tables to cover all district variants (R4-1, R4A, R4B, R5A in Regime 25-22)
-   [ ] Implement exact boundary geometry evaluation for Section 25-24 special provisions (Queens CD3/CD4 "east of Junction Blvd")
-   [ ] Automatically determine affordable/senior/ADU/conversion status for parking scenarios
-   [ ] Determine if units existed prior to Dec 5, 2024 for lot width <= 25 ft override
-   [ ] Cache parking calculations by district + transit zone + units + lot characteristics

## References

-   NYC Zoning Resolution Article II - Residential Districts
-   Section 23-361 - Maximum lot coverage in R1 through R5 Districts
-   Section 23-362 - Maximum lot coverage in R6 through R12 Districts
-   Section 23-363 - Special rules for certain interior or through lots
-   Section 23-421 - Minimum base height in R1 through R3 Districts
-   Section 23-422 - Minimum base height in R4 and R5 Districts
-   Section 23-432 - Height and setback regulations in R6 through R12 Districts
-   Section 23-52 - Maximum Number of Dwelling Units (Density Regulations) - [https://zr.planning.nyc.gov/article-ii/chapter-3#23-52](https://zr.planning.nyc.gov/article-ii/chapter-3#23-52)
-   Chapter 5 - Parking and Loading
-   Section 25-21 - Required Accessory Off-Street Parking Spaces in Inner Transit Zones (Existing Buildings) - [https://zr.planning.nyc.gov/article-ii/chapter-5/25-21](https://zr.planning.nyc.gov/article-ii/chapter-5/25-21)
-   Section 25-22 - Required Accessory Off-Street Parking Spaces in Outer Transit Zones - [https://zr.planning.nyc.gov/article-ii/chapter-5/25-22](https://zr.planning.nyc.gov/article-ii/chapter-5/25-22)
-   Section 25-23 - Required Accessory Off-Street Parking Spaces Beyond the Greater Transit Zone - [https://zr.planning.nyc.gov/article-ii/chapter-5/25-23](https://zr.planning.nyc.gov/article-ii/chapter-5/25-23)
-   Section 25-24 - Special Provisions for Required Accessory Off-Street Parking Spaces - [https://zr.planning.nyc.gov/article-ii/chapter-5/25-24](https://zr.planning.nyc.gov/article-ii/chapter-5/25-24)
-   Section 23-321 - Front yard requirements in R1 through R5 Districts - [https://zr.planning.nyc.gov/article-ii/chapter-3/23-321](https://zr.planning.nyc.gov/article-ii/chapter-3/23-321)
-   Section 23-322 - Front yard requirements in R6 through R12 Districts - [https://zr.planning.nyc.gov/article-ii/chapter-3/23-322](https://zr.planning.nyc.gov/article-ii/chapter-3/23-322)
-   Section 23-331 - Permitted obstructions in side yards - [https://zr.planning.nyc.gov/article-ii/chapter-3/23-331](https://zr.planning.nyc.gov/article-ii/chapter-3/23-331)
-   Section 23-332 - Side yard requirements in R1 through R5 Districts - [https://zr.planning.nyc.gov/article-ii/chapter-3/23-332](https://zr.planning.nyc.gov/article-ii/chapter-3/23-332)
-   Section 23-335 - Side yard requirements in R6 through R12 Districts - [https://zr.planning.nyc.gov/article-ii/chapter-3/23-335](https://zr.planning.nyc.gov/article-ii/chapter-3/23-335)
-   Section 23-342 - Rear yard requirements - [https://zr.planning.nyc.gov/article-ii/chapter-3/23-342](https://zr.planning.nyc.gov/article-ii/chapter-3/23-342)
-   ArcGIS Transit Zones FeatureServer - [https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/ArcGIS/rest/services/Transit_Zones/FeatureServer](https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/ArcGIS/rest/services/Transit_Zones/FeatureServer)
-   NYC Department of City Planning - Zoning Handbook
