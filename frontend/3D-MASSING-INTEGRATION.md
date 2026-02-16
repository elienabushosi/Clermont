# 3D Massing Visualization - Integration Guide

## Step 1: Install Dependencies

```bash
cd frontend
npm install three @react-three/fiber @react-three/drei
npm install --save-dev @types/three
```

## Step 2: Helper Functions

Add these helper functions to `viewreport/[id]/page.tsx` (or create a separate utils file):

```typescript
/**
 * Extract numeric lot area from formatted string like "5,000 sq ft"
 */
function extractLotAreaSqft(lotAreaStr: string | null | undefined): number | null {
	if (!lotAreaStr) return null;
	const match = lotAreaStr.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
	return match ? parseFloat(match[1]) : null;
}

/**
 * Extract numeric frontage from formatted string like "25 ft"
 */
function extractLotFrontageFt(frontageStr: string | null | undefined): number | null {
	if (!frontageStr) return null;
	const match = frontageStr.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
	return match ? parseFloat(match[1]) : null;
}

/**
 * Extract min base height from zoning resolution height data
 */
function extractMinBaseHeightFt(
	height: typeof formattedData.zoningResolution?.height
): number | null {
	if (!height?.min_base_height) return null;
	if (height.min_base_height.kind === "fixed" && height.min_base_height.value_ft != null) {
		return height.min_base_height.value_ft;
	}
	if (height.min_base_height.kind === "conditional" && height.min_base_height.candidates) {
		const values = height.min_base_height.candidates
			.map((c: any) => c.value_ft)
			.filter((v: any) => v != null);
		return values.length > 0 ? Math.min(...values) : null;
	}
	return null;
}

/**
 * Extract max base height from zoning resolution height data
 */
function extractMaxBaseHeightFt(
	height: typeof formattedData.zoningResolution?.height
): number | null {
	if (!height?.envelope?.candidates || height.envelope.candidates.length === 0) {
		return null;
	}
	const candidate = height.envelope.candidates[0];
	return candidate.max_base_height_ft ?? null;
}

/**
 * Extract max building height from zoning resolution height data
 */
function extractMaxBuildingHeightFt(
	height: typeof formattedData.zoningResolution?.height
): number | null {
	if (!height?.envelope?.candidates || height.envelope.candidates.length === 0) {
		return null;
	}
	const candidate = height.envelope.candidates[0];
	return candidate.max_building_height_ft ?? null;
}
```

## Step 3: Import Component

Add to the imports section of `viewreport/[id]/page.tsx`:

```typescript
import PropertyMassing3D from "@/components/property-massing-3d";
```

## Step 4: Integration Point

Insert the 3D component **after** the "Zoning Constraints (Height)" Card closes (around line 1311), **before** the "Zoning Constraints" section:

```typescript
{/* Zoning Constraints (Height) */}
{formattedData.zoningResolution?.height && (
	<Card id="zoning-constraints-height" className="mb-6 scroll-mt-8">
		{/* ... existing height content ... */}
	</CardContent>
</Card>
)}

{/* 3D Massing Visualization */}
{formattedData.zoningResolution?.height &&
	formattedData.lotArea &&
	formattedData.lotFrontage && (() => {
		const lotAreaSqft = extractLotAreaSqft(formattedData.lotArea);
		const lotFrontageFt = extractLotFrontageFt(formattedData.lotFrontage);
		const minBaseHeightFt = extractMinBaseHeightFt(formattedData.zoningResolution.height);
		const maxBaseHeightFt = extractMaxBaseHeightFt(formattedData.zoningResolution.height);
		const maxBuildingHeightFt = extractMaxBuildingHeightFt(formattedData.zoningResolution.height);

		// Only render if we have minimum required data
		if (lotAreaSqft && lotFrontageFt && maxBaseHeightFt) {
			return (
				<Card id="property-massing-3d" className="mb-6 scroll-mt-8">
					<CardContent className="pt-6">
						<div className="mb-4">
							<div className="flex items-center gap-2 mb-1">
								<Box className="size-5 text-[#4090C2]" />
								<h3 className="text-lg font-semibold text-[#37322F]">
									3D Massing Visualization
								</h3>
							</div>
							<p className="text-sm text-[#605A57]">
								Interactive 3D representation of zoning height constraints
							</p>
						</div>
						<PropertyMassing3D
							lotAreaSqft={lotAreaSqft}
							lotFrontageFt={lotFrontageFt}
							minBaseHeightFt={minBaseHeightFt}
							maxBaseHeightFt={maxBaseHeightFt}
							maxBuildingHeightFt={maxBuildingHeightFt}
						/>
					</CardContent>
				</Card>
			);
		}
		return null;
	})()}

{/* Zoning Constraints Section */}
{formattedData.zoningResolution &&
	formattedData.zoningResolution.maxFar != null && (
		<Card id="zoning-constraints" className="mb-6 scroll-mt-8">
			{/* ... existing FAR/lot coverage content ... */}
		</Card>
	)}
```

**Note:** Don't forget to import `Box` icon from `lucide-react` if not already imported:
```typescript
import { Box } from "lucide-react";
```

## Step 5: Update TOC (Table of Contents)

If you want the 3D section in the TOC, add it to the `sectionIds` array in the `useEffect` hook (around line 68):

```typescript
const sectionIds = [
	"property-location",
	"property-level-information",
	"lot-details",
	"zoning-classification",
	"zoning-constraints-height",
	"property-massing-3d", // Add this
	"zoning-constraints",
	"fema-flood-map",
	"transit-zone-map",
	"neighborhood-information",
];
```

And add it to the TOC rendering section (around line 2523):

```typescript
{!showDebugMode && (
	<aside className="w-56 shrink-0 hidden lg:block">
		{/* ... existing TOC code ... */}
		{/* Add this link */}
		<a href="#property-massing-3d" onClick={(e) => handleTocClick(e, "property-massing-3d")}>
			3D Massing Visualization
		</a>
	</aside>
)}
```

## Testing Checklist

- [ ] Install dependencies successfully
- [ ] Component renders without errors when data is available
- [ ] Component gracefully hides when data is missing
- [ ] Error boundary catches any R3F/Three.js errors
- [ ] Report page still loads if 3D component crashes
- [ ] Camera controls work (orbit, zoom, pan)
- [ ] Dimensions display correctly
- [ ] Component doesn't block page rendering
