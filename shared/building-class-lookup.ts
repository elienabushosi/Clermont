/**
 * NYC Building Class Code to Description Mapping
 * 
 * This file provides a canonical mapping of NYC building class codes
 * to their human-readable descriptions. Used by both frontend and backend.
 * 
 * Source: NYC Department of Buildings (DOB) Building Classification System
 * 
 * The data is stored in building-class-lookup.json in a nested structure
 * and flattened here for easy lookup.
 */

import buildingClassData from "./building-class-lookup.json";

export interface BuildingClassInfo {
	code: string;
	description: string;
	category?: string; // High-level category description
}

// Flatten the nested JSON structure into a flat lookup
export const BUILDING_CLASS_LOOKUP: Record<string, BuildingClassInfo> = {};

// Build flattened lookup from nested JSON structure
Object.entries(buildingClassData).forEach(([categoryKey, categoryData]: [string, any]) => {
	if (categoryData.codes) {
		Object.entries(categoryData.codes).forEach(([code, description]: [string, string]) => {
			BUILDING_CLASS_LOOKUP[code] = {
				code,
				description,
				category: categoryData.category,
			};
		});
	}
});

/**
 * Get building class description by code
 * @param code - Building class code (e.g., "C7", "A1")
 * @returns Building class info or null if not found
 */
export function getBuildingClassDescription(
	code: string | null | undefined
): BuildingClassInfo | null {
	if (!code) return null;
	
	const normalizedCode = String(code).trim().toUpperCase();
	return BUILDING_CLASS_LOOKUP[normalizedCode] || null;
}

/**
 * Get building class description text with code in parentheses
 * @param code - Building class code
 * @returns Description string with code in parentheses, or the code itself if not found
 */
export function getBuildingClassDescriptionText(
	code: string | null | undefined
): string {
	if (!code) return "Unknown";
	
	const normalizedCode = String(code).trim().toUpperCase();
	const info = BUILDING_CLASS_LOOKUP[normalizedCode];
	
	if (info) {
		return `${info.description} (${normalizedCode})`;
	}
	
	return normalizedCode;
}
