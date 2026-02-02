# Supporting 3 Addresses in Assemblage Reports

This doc walks through what to change to run assemblage reports for **3 addresses** instead of only 2. The backend orchestration and math are already **N-address agnostic** (they loop over `addressList` / `childContexts`); the main work is validation, frontend form, and copy.

---

## 1. Combined Lot Area (no code change)

**Current behavior:** The orchestrator sums **valid** `lotarea` from each lot’s Zola payload and sets flags when any lot is missing lot area:

```js
for (const ctx of childContexts) {
  const lotarea = /* from zolaPayload */;
  const hasValidLotArea = lotarea != null && !Number.isNaN(lotarea) && lotarea > 0;
  if (hasValidLotArea) combinedLotAreaSqft += lotarea;
  if (!hasValidLotArea && ...) { missingLotArea = true; partialTotal = true; }
}
```

- **For 3 addresses:** Same loop runs for 3 `childContexts`. Combined lot area = sum of valid lot areas; flags already reflect missing data. **Nothing to change.**

---

## 2. Backend: What Actually Needs to Change

### 2.1 Route validation (`routes/assemblage-reports.js`)

**Current:** Rejects unless exactly 2 addresses.

```js
if (addresses.length !== 2) {
  return res.status(400).json({
    status: "error",
    message: "V1 requires exactly 2 addresses",
  });
}
```

**Change:** Allow 2 **or** 3 addresses.

- Replace with: accept `addresses.length >= 2 && addresses.length <= 3` (or `=== 2 || addresses.length === 3` if you want only 2 or 3).
- Trim and validate each address as today (non-empty strings).
- Update comment/doc: e.g. "Body: { addresses: [\"addr1\", \"addr2\"] } or 3 addresses."

**No other backend changes:** Orchestrator, aggregation, zoning consistency, contamination risk, and report_sources all iterate over `addressList.length` / `childContexts` / `lots`. They already support 3 (or more) addresses.

---

## 3. Frontend: Land Assemblage Page

**Current:** Two address fields (Address 1, Address 2). State: `address1`, `address2`. Generate enabled when both set. Payload: `[address1, address2]`.

**Changes:**

1. **State**
   - Add `address3: AddressData | null`.
   - When user selects Address 1, you can clear Address 2 and Address 3 (current behavior clears only Address 2); or keep Address 2/3. Typical: clearing only downstream keeps UX simple: "Address 1 → clear 2 and 3; Address 2 → clear 3."

2. **Generate button**
   - Keep: Generate enabled when at least Address 1 and Address 2 are set.
   - Optional: If you want "only 3-address reports" later, you could require all 3; for "2 or 3 addresses" support, current rule (enable when 1 and 2 are set) is enough.

3. **Payload**
   - Build `addresses` from the fields that are set:  
     `[address1, address2].concat(address3 ? [address3] : [])`  
     So you send 2 or 3 strings depending on whether the third field is filled.

4. **UI**
   - Add a **third address block** (label + `AddressAutocomplete` + confirmation line), shown when `address2 != null`, same pattern as the second block.
   - Placeholder: e.g. "Add the Third Address: must be residential & within the 5 boroughs".
   - Copy: Update disclaimer and description, e.g. "Add two or three addresses…" / "Clermont supports up to 3 addresses…" if you change the backend to allow only 2 or 3.

5. **Validation**
   - If backend accepts only 2 or 3: before submit, ensure `addresses.length === 2 || addresses.length === 3` (e.g. if user fills 1 and 3 but not 2, either disable Generate or show a message). Current flow (show field 3 only when field 2 is set) naturally gives 2 or 3 addresses.

---

## 4. Assemblage Report View (assemblagereportview)

**Current:** Uses `aggregation.lots` from the API. Renders:

- One map with markers/labels from `lots.map((l) => getCoordsForLot(l.childIndex))` and `labels={lots.map((_, i) => String(i + 1))}` (e.g. "1", "2").
- Property cards: `lots.map((lot) => { ... <Card key={lot.childIndex}> ... })`.
- Combined calculations, contamination risk, zoning consistency all key off `lots` (array length and `childIndex`).

**For 3 addresses:**

- **No structural change.** Backend will return `aggregation.lots` with 3 elements (`childIndex` 0, 1, 2). The view will:
  - Show 3 markers on the map (labels "1", "2", "3").
  - Show 3 property cards.
  - Show combined lot area (sum of 3 valid lot areas), total buildable sq ft, density, etc.
- **Optional tweaks:**
  - Layout: If 3 cards in one row is tight, use a grid (e.g. 3 columns on large screens) or stack.
  - Map: Already fits bounds to all positions; 3 points will still fit.

**Data fetching:** No change. `getReportWithSources(reportId)` already returns all `report_sources`; Zola/Geoservice are keyed by `childIndex`, so the existing `getZolaPayloadForLot(childIndex)`, `getCoordsForLot(childIndex)` work for the third lot.

---

## 5. Reports List / Recent Searches / Home

**Current:** Assemblage reports show address(es) via `report.Address.split(";").map(...).filter(Boolean)` and render multiple lines when `addresses.length > 1`.

**For 3 addresses:** Same logic; 3 addresses produce 3 entries in the array and can be shown as 3 lines. No change required unless you want different styling for "3 addresses" vs "2 addresses".

---

## 6. Summary Checklist

| Layer | Change |
|-------|--------|
| **Combined lot area** | None. Already sum of valid `lotarea` over all children; flags when missing. |
| **Backend route** | Allow 2 or 3 addresses in validation; update comment. |
| **Backend orchestrator** | None. Already N-address. |
| **Land Assemblage page** | Add `address3` state and third address block; build `addresses` array with 2 or 3 items; update disclaimer/copy. |
| **Assemblage report view** | None required. Optional: layout for 3 property cards (grid/stack). |
| **Reports list / home** | None. Address split already supports N addresses. |

---

## 7. Order of Implementation

1. **Backend:** Relax validation in `assemblage-reports.js` to allow 3 addresses; deploy or run locally and test with 3 addresses (e.g. curl with `addresses: ["addr1","addr2","addr3"]`).
2. **Frontend Land Assemblage:** Add third field and wire into state and payload; test 2-address and 3-address submissions.
3. **Report view:** Load a 3-address report and confirm 3 property cards, 3 map markers, and combined lot area/density correct; adjust layout if needed.

Once this is done, combined lot area (and all other aggregation math) already supports 3 addresses with no extra changes.
