/**
 * NYC Land Use Code to Description Mapping
 *
 * This file provides a canonical mapping of NYC land use codes
 * to their human-readable descriptions. Used by both frontend and backend.
 *
 * Source: NYC Department of City Planning (DCP) Land Use Classification
 */

import landUseData from "./land-use-lookup.json";

export interface LandUseInfo {
	code: string;
	description: string;
}

// Create lookup from JSON
export const LAND_USE_LOOKUP: Record<string, LandUseInfo> = {};

Object.entries(landUseData).forEach(([code, description]: [string, string]) => {
	LAND_USE_LOOKUP[code] = {
		code,
		description,
	};
});

/**
 * Get land use description by code
 * @param code - Land use code (e.g., "04", "11")
 * @returns Land use info or null if not found
 */
export function getLandUseDescription(
	code: string | null | undefined
): LandUseInfo | null {
	if (!code) return null;

	const normalizedCode = String(code).trim();
	return LAND_USE_LOOKUP[normalizedCode] || null;
}

/**
 * Get land use description text with code in parentheses
 * @param code - Land use code
 * @returns Description string with code in parentheses, or the code itself if not found
 */
export function getLandUseDescriptionText(
	code: string | null | undefined
): string {
	if (!code) return "Unknown";

	const normalizedCode = String(code).trim();
	const info = LAND_USE_LOOKUP[normalizedCode];

	if (info) {
		return `${info.description} (${normalizedCode})`;
	}

	return normalizedCode;
}
