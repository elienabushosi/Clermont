/**
 * NYC 5 boroughs boundary check (client-side, no API).
 * Boundary source: Borough_Boundaries_20260211.geojson (NYC Open Data).
 * We use a bounding box for performance; the GeoJSON is the reference for the extent.
 */

// Bounding box that contains all 5 NYC boroughs (Manhattan, Brooklyn, Queens, Bronx, Staten Island).
// Conservative extent derived from NYC 5-borough boundary data.
const NYC_FIVE_BOROUGHS = {
  latMin: 40.4774,
  latMax: 40.9176,
  lngMin: -74.2591,
  lngMax: -73.7004,
} as const;

export interface LocationLike {
  lat: number;
  lng: number;
}

/**
 * Returns true if the given point (lat, lng) is inside the NYC 5 boroughs bounding box.
 * Use with addressData.location from AddressAutocomplete.
 */
export function isPointInFiveBoroughs(lat: number, lng: number): boolean {
  return (
    lat >= NYC_FIVE_BOROUGHS.latMin &&
    lat <= NYC_FIVE_BOROUGHS.latMax &&
    lng >= NYC_FIVE_BOROUGHS.lngMin &&
    lng <= NYC_FIVE_BOROUGHS.lngMax
  );
}

/** True if state is New York (short or long form from Google). */
function isNewYorkState(state: string | undefined | null): boolean {
  if (!state) return false;
  const s = state.trim().toUpperCase();
  return s === "NY" || s === "NEW YORK";
}

/**
 * Returns true if the address is inside the NYC 5-borough bounding box AND in New York state.
 * Use in handleGenerateReport to block report generation for addresses outside the 5 boroughs.
 * Rectangle + NY state filters out NJ/nearby areas that fall inside the box.
 */
export function isAddressInFiveBoroughs(addressData: {
  location?: LocationLike | null;
  state?: string | null;
} | null): boolean {
  if (!addressData?.location) return false;
  const { lat, lng } = addressData.location;
  if (!isPointInFiveBoroughs(lat, lng)) return false;
  return isNewYorkState(addressData.state);
}
