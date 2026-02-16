# 3D Massing: Inputs, Outputs & Options

Quick reference for where data comes from, how it drives the 3D view, and what you can adjust.

---

## 1. Data flow (where inputs come from)

```
Report API (getReportWithSources)
    → reportData.sources (geoservice, zola, zoning_resolution)
    → getFormattedData() in viewreport/[id]/page.tsx
    → formattedData (strings + nested zoning object)
    → extract* helper functions (parse strings / pluck numbers)
    → PropertyMassing3D props (numbers only)
```

| Input to 3D | Source in report | Where it’s set in code |
|-------------|------------------|------------------------|
| **Lot Area (sq ft)** | Zola (MapPLUTO) `lotarea` | `formattedData.lotArea` → `extractLotAreaSqft()` in **viewreport/[id]/page.tsx** |
| **Lot Frontage (ft)** | Zola `lotfront` | `formattedData.lotFrontage` → `extractLotFrontageFt()` in **viewreport/[id]/page.tsx** |
| **Lot Depth (ft)** | Not stored directly | **Computed** in `property-massing-3d.tsx`: `lotAreaSqft / lotFrontageFt` |
| **Min Base Height (ft)** | Zoning agent `height.min_base_height` (fixed or min of candidates) | `extractMinBaseHeightFt()` in **viewreport/[id]/page.tsx** |
| **Max Base Height (ft)** | Zoning agent `height.envelope.candidates[0].max_base_height_ft` | `extractMaxBaseHeightFt()` in **viewreport/[id]/page.tsx** |
| **Max Building Height (ft)** | Zoning agent `height.envelope.candidates[0].max_building_height_ft` | `extractMaxBuildingHeightFt()` in **viewreport/[id]/page.tsx** |

The 3D block only renders when **lotArea**, **lotFrontage**, and **maxBaseHeightFt** are all present (see “When does the 3D show?” below).

---

## 2. How inputs affect the 3D output

All dimensions are in **feet** when they enter the component. Inside the 3D scene they are scaled so the scene fits nicely on screen.

| Input | Effect in 3D |
|-------|----------------|
| **lotFrontageFt** | Width of the lot (and of both boxes) in the horizontal X direction. |
| **lotAreaSqft / lotFrontageFt** | Depth of the lot (and of both boxes) in the horizontal Z direction. |
| **maxBaseHeightFt** | Height of the **solid blue box** (“base” massing). |
| **maxBuildingHeightFt** | Total allowed height. If &gt; maxBaseHeightFt, the **wireframe box** sits on top of the solid box; its height = maxBuildingHeightFt − maxBaseHeightFt. |
| **minBaseHeightFt** | Passed in but **not used** in the current 3D geometry (reserved for future use, e.g. a different base height). |

So:

- **Footprint** = frontage × depth (from area ÷ frontage).
- **Solid box** = base massing up to **Max Base Height**.
- **Wireframe box** = optional “tower” from **Max Base Height** up to **Max Building Height**.

---

## 3. Where to change behavior (your options)

### A. **When does the 3D show?**

**File:** `frontend/app/(workspace)/viewreport/[id]/page.tsx`  
**Location:** The block that conditionally renders the 3D Card (search for “3D Massing Visualization”).

- **Current rule:** Renders only if `formattedData.zoningResolution?.height`, `formattedData.lotArea`, and `formattedData.lotFrontage` exist, and after extraction you have `lotAreaSqft`, `lotFrontageFt`, and `maxBaseHeightFt`.
- **To relax:** e.g. require only `lotArea` and `lotFrontage` and use a fallback height when zoning height is missing (you’d add that fallback in the same place you call `extractMaxBaseHeightFt` / pass props into `PropertyMassing3D`).
- **To tighten:** add more checks (e.g. require `maxBuildingHeightFt` or a minimum lot size) before rendering the Card.

### B. **Scale (size of the 3D scene)**

**File:** `frontend/components/property-massing-3d.tsx`  
**Location:** Inside `MassingScene`, the `scale` constant (around line 99).

```ts
const scale = 0.1; // 1 Three.js unit = 10 feet
```

- **Increase** (e.g. `0.2`) → building appears **larger** in the canvas.
- **Decrease** (e.g. `0.05`) → building appears **smaller**, more context around it.

All 3D dimensions (frontage, depth, base height, building height) are multiplied by this before being used in the scene.

### C. **Camera (initial view)**

**File:** `frontend/components/property-massing-3d.tsx`  
**Location:** `<Canvas camera={{ position: [10, 10, 10], fov: 50 }}>` (around line 201).

- **position:** `[x, y, z]` — where the camera starts. Increase values to pull back, change ratio to change angle.
- **fov:** Field of view in degrees. Higher = more wide‑angle; lower = more zoomed-in look.

OrbitControls (rotate/zoom/pan) still work from this initial camera.

### D. **Container size**

**File:** `frontend/components/property-massing-3d.tsx`  
**Location:** The wrapper div around `<Canvas>` (around line 196).

```tsx
<div className="w-full h-[400px] ...">
```

- Change `h-[400px]` to e.g. `h-[300px]` or `h-[500px]` to make the 3D view shorter or taller.
- You can also use a prop (e.g. `heightPx={400}`) and set the class from that if you want it configurable from the report page.

### E. **Colors and materials**

**File:** `frontend/components/property-massing-3d.tsx`  
**Location:** Inside `MassingScene`.

| Element | Where | What to change |
|--------|--------|-----------------|
| Ground plane | `<meshStandardMaterial color="#E5E7EB" />` | `color` hex (e.g. lighter/darker gray). |
| Solid base box | `<meshStandardMaterial color="#4090C2" opacity={0.8} transparent />` | `color`, `opacity` (0–1). |
| Wireframe “tower” | `color="#60A5FA" wireframe opacity={0.6}` | `color`, `opacity`, or remove `wireframe` for a solid tower. |

### F. **Labels (dimensions in the 3D view)**

**File:** `frontend/components/property-massing-3d.tsx`  
**Location:** The `<Html>` blocks that show “Base: X ft”, “Frontage: X ft”, “Depth: X ft”.

- **Position:** Each `<Html position={[x, y, z]} ...>`. Adjust `[x, y, z]` to move labels (e.g. avoid overlap or move off the building).
- **Content:** Edit the text inside the inner `<div>` (e.g. add units, change “Base” / “Max” wording).
- **Visibility:** You can wrap any `<Html>...</Html>` in a condition (e.g. only show depth when depth &gt; X).

### G. **Zoom / orbit limits**

**File:** `frontend/components/property-massing-3d.tsx`  
**Location:** `<OrbitControls minDistance={...} maxDistance={...} target={...} />`.

- **minDistance:** Prevents zooming in past this (stops camera getting inside the building).
- **maxDistance:** Prevents zooming out past this.
- **target:** Point the camera orbits around; currently center of the base at half its height.

Adjust these if the default feels too tight or too loose for your typical lot sizes.

### H. **Extraction rules (report → numbers)**

**File:** `frontend/app/(workspace)/viewreport/[id]/page.tsx`  
**Location:** Functions `extractLotAreaSqft`, `extractLotFrontageFt`, `extractMinBaseHeightFt`, `extractMaxBaseHeightFt`, `extractMaxBuildingHeightFt`.

- **Lot area / frontage:** Currently parse the **first number** from strings like `"5,000 sq ft"` or `"25 ft"`. If your report format changes (e.g. “5,000 sq. ft.” or “25ft”), update the regex or parsing in these helpers.
- **Heights:** Min base uses `min_base_height` (fixed value or min of candidates). Max base and max building use the **first** envelope candidate. If you need a different candidate or rule (e.g. max of candidates), change it in the corresponding `extract*` function.

---

## 4. One-place summary of “knobs”

| What you want to change | File | What to edit |
|-------------------------|------|-----------------------------|
| When 3D section appears | viewreport/[id]/page.tsx | Condition around “3D Massing Visualization” Card and extractors. |
| Lot/depth logic | viewreport/[id]/page.tsx | `extractLotAreaSqft`, `extractLotFrontageFt`. |
| Height values used for 3D | viewreport/[id]/page.tsx | `extractMinBaseHeightFt`, `extractMaxBaseHeightFt`, `extractMaxBuildingHeightFt`. |
| Size of building on screen | property-massing-3d.tsx | `scale` in `MassingScene`. |
| Initial camera | property-massing-3d.tsx | `<Canvas camera={{ ... }}>`. |
| Container height | property-massing-3d.tsx | Wrapper div `h-[400px]` (or equivalent). |
| Colors / materials | property-massing-3d.tsx | `meshStandardMaterial` and ground plane material. |
| Labels and position | property-massing-3d.tsx | `<Html position={...}>` and label text. |
| Zoom/orbit limits | property-massing-3d.tsx | `<OrbitControls ...>`. |

If you tell me what you want to adjust (e.g. “use a default height when zoning is missing” or “make the box smaller and the container 300px”), I can give exact code changes next.
