# Zoning Calculation Engine – Audit Summary

## Objective

Audit the zoning calculation engine for logic errors and data inconsistencies between zoning constraints and derived output, and clarify why "Max Lot Coverage 80%" and "Remaining Buildable 0 (FAR limit reached)" can both be correct.

---

## 1. Variable Dependencies

| Variable | Source | Formula / Logic |
|----------|--------|------------------|
| **LotArea** | Zola (MapPLUTO) `lotarea` | Static input; not calculated. |
| **MaxBuildableFloorAreaSqft** | Derived | `maxFAR × lotArea`. |
| **RemainingBuildableFloorAreaSqft** | Derived | `max(0, MaxBuildableFloorAreaSqft - bldgarea)`. `bldgarea` = existing building area from MapPLUTO. |
| **MaxBuildingFootprintSqft** | Derived | `maxLotCoverage × lotArea`. |

**Conclusion:** Dependencies are consistent. `MaxBuildableFloorAreaSqft` equals FAR × LotArea. Remaining equals max buildable minus existing floor area. Lot area is an input, not a derived value.

---

## 2. Two Separate Constraints (Why 80% and “Maxed Out” Can Coexist)

- **FAR** limits **total floor area** (all stories): `Max Buildable Floor Area = FAR × LotArea` (e.g. 2.2 × 4,000 = 8,800 sq ft).
- **Lot coverage** limits **footprint** (ground coverage): `Max Building Footprint = maxLotCoverage × LotArea` (e.g. 0.8 × 4,000 = 3,200 sq ft).

So:

- **“FAR limit reached”** means: existing floor area (`bldgarea`) ≥ max permitted floor area (8,800). No more floor area is allowed under the FAR cap.
- **80% lot coverage** means: you may cover up to 80% of the lot at ground level (3,200 sq ft footprint). That is a different limit.

A property can be at the FAR limit (0 remaining floor area) and still have 80% lot coverage (footprint limit). The derived calculations are not decoupled; they apply two different rules.

**Changes made:**

- Backend: `remainingFloorAreaMessage` now states that the FAR limit is reached (existing floor area meets or exceeds max permitted) and that **lot coverage limits footprint separately**.
- Frontend: Under Derived Calculations, a note explains that remaining buildable is based on FAR and that max lot coverage above limits footprint separately.

---

## 3. Footprint Logic

**MaxBuildingFootprintSqft** is computed in `calculateDerivedValues(maxFAR, lotArea, bldgarea, maxLotCoverage)` as:

```js
derived.maxBuildingFootprintSqft = maxLotCoverage * lotArea;
```

`maxLotCoverage` comes from `calculateMaxLotCoverage(district, lotType, buildingType, lotArea)`, which uses:

- **R1–R5:** `getMaxLotCoverageR1R5(district, lotType, buildingType)` — corner vs interior and building type.
- **R6–R12:** `getMaxLotCoverageR6R12(district, lotType, lotArea)` — corner = 100%, interior = 80%.

**Conclusion:** Footprint is driven by the lot coverage percentage and lot area. No hard-coded footprint; lot type (corner vs interior) is applied correctly.

---

## 4. Refuse Exemption (9 vs 48 sq ft)

**Formula:** `Potential exemption (refuse) = unitsres × 3` (ZR § 23-233).

- 3 dwelling units → 9 sq ft.
- 16 dwelling units → 48 sq ft.

Different values for the same district (e.g. R6) are due to different **unit counts** (`unitsres` from MapPLUTO), not district or calculation bugs.

---

## 5. Remaining Buildable and Exemptions

Remaining buildable is:

`remaining = MaxBuildableFloorAreaSqft - bldgarea`.

Exemptions (refuse, amenities, corridors, elevated entryways) are **not** subtracted from `bldgarea` and are **not** added to remaining. They are shown as “Potential exemption (refuse): up to X sq ft” for information only.

So “FAR limit reached” is triggered when existing floor area (as reported in MapPLUTO) meets or exceeds the max permitted floor area. Exemptions do not change that comparison; they are not applied in the remaining-buildable math.

---

## 6. Building Type and Lot Type

- **Lot type** (corner vs interior/through): from Geoservice `corner_code`; affects only **max lot coverage** (and thus max footprint). Shown in UI as “Lot Type: Interior Or Through” or “Corner”.
- **Building type** (e.g. Multiple Dwelling): from Zola `bldgclass`; affects lot coverage rules in R1–R5 and density/DUF. Shown as “Building Type: Multiple Dwelling”.

Both feed into `calculateMaxLotCoverage` and derived footprint. No hidden modifiers; both are used in the engine and surfaced in the UI.

---

## Summary for Architect / Developer

- **Logic:** The zoning engine correctly applies FAR (floor area) and lot coverage (footprint) as **two separate constraints**. “Maxed out” refers to the FAR limit (no remaining floor area); 80% is the lot coverage limit (max footprint). Both can be true at once.
- **Clarifications added:** (1) Backend message for “FAR limit reached” now states that lot coverage limits footprint separately. (2) Frontend note under Derived Calculations states that remaining buildable is FAR-based and that max lot coverage limits footprint separately.
- **Refuse exemption:** Varies by `unitsres` (9 vs 48 sq ft is expected for different unit counts).
- **Exemptions:** Not applied in remaining-buildable math; shown only as potential (e.g. refuse) for reference.
