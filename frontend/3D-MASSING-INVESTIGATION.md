# 3D Massing Visualization - Investigation Summary

## Step 1: Investigation Results

### 1. Dependencies Check
**Status:** ❌ Not Installed

The following packages need to be installed:
- `three` - Core Three.js library
- `@react-three/fiber` - React renderer for Three.js
- `@react-three/drei` - Useful helpers and abstractions for R3F

**Install Command:**
```bash
cd frontend && npm install three @react-three/fiber @react-three/drei
```

**TypeScript Types:**
```bash
npm install --save-dev @types/three
```

### 2. Component Location
**File:** `frontend/app/(workspace)/viewreport/[id]/page.tsx`

**Component:** `ViewReportPage` (default export, line 51)

**Data Flow:**
- Report data fetched via `getReportWithSources(reportId)` (line 166)
- Stored in state: `reportData` (type: `ReportWithSources`)
- Formatted via `getFormattedData()` function (line 222)
- Returns `formattedData` object with all property/zoning info

### 3. Data Structure Available

**Lot Dimensions:**
- `formattedData.lotArea` - String: `"5,000 sq ft"` (needs parsing)
- `formattedData.lotFrontage` - String: `"25 ft"` (needs parsing)
- `formattedData.lotDepth` - String: `"200 ft"` (may be available, else calculate)

**Zoning Heights (from `formattedData.zoningResolution.height`):**
- `min_base_height.value_ft` - Number (ft) - when `kind === "fixed"`
- `envelope.candidates[0].max_base_height_ft` - Number (ft)
- `envelope.candidates[0].max_building_height_ft` - Number (ft)

**Note:** Heights may be:
- `kind === "fixed"` → use `value_ft`
- `kind === "conditional"` → use min/max from `candidates[]`
- `kind === "see_section"` → not available

### 4. Best UI Location

**Recommended:** Add a new Card section **immediately after** the "Zoning Constraints (Height)" Card (around line ~1200+), before the "Zoning Constraints" (FAR/Lot Coverage) section.

**Alternative:** Could be placed **inside** the "Zoning Constraints (Height)" Card as a visual enhancement below the grid of height values.

**Container Dimensions:**
- Height: `400px` (as specified)
- Width: Full width of Card
- Background: Match existing Card styling (`bg-[#F9F8F6]`)

### 5. Integration Point

The component should be conditionally rendered:
```tsx
{formattedData.zoningResolution?.height && 
 formattedData.lotArea && 
 formattedData.lotFrontage && (
  <PropertyMassing3D 
    lotAreaSqft={parseLotArea(formattedData.lotArea)}
    lotFrontageFt={parseLotFrontage(formattedData.lotFrontage)}
    minBaseHeightFt={getMinBaseHeight(formattedData.zoningResolution.height)}
    maxBaseHeightFt={getMaxBaseHeight(formattedData.zoningResolution.height)}
    maxBuildingHeightFt={getMaxBuildingHeight(formattedData.zoningResolution.height)}
  />
)}
```

## Step 2: Implementation Plan

### Component Structure
1. **Error Boundary Wrapper** - Catches any R3F/Three.js errors
2. **PropertyMassing3D Component** - Main visualization
3. **Helper Functions** - Parse strings, extract numeric values

### Features
- Ground plane (gray)
- Base massing box (solid, using max_base_height)
- Potential building box (wireframe, stacked on base, using max_building_height)
- HTML labels showing dimensions
- Camera controls (orbit)
- Responsive to container size

### Error Handling
- Error Boundary returns `null` or simple fallback message
- Graceful degradation if data missing
- Non-blocking: report page still renders if 3D fails
