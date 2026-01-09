/**
 * Backend utility for building class lookups
 * 
 * Uses the shared JSON file for building class code to description mapping.
 */

const path = require("path");
const buildingClassData = require(path.join(__dirname, "../../shared/building-class-lookup.json"));

// Flatten the nested JSON structure into a flat lookup
const BUILDING_CLASS_LOOKUP = {};

Object.entries(buildingClassData).forEach(([categoryKey, categoryData]) => {
	if (categoryData.codes) {
		Object.entries(categoryData.codes).forEach(([code, description]) => {
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
 * @param {string|null|undefined} code - Building class code (e.g., "C7", "A1")
 * @returns {Object|null} Building class info or null if not found
 */
function getBuildingClassDescription(code) {
	if (!code) return null;
	
	const normalizedCode = String(code).trim().toUpperCase();
	return BUILDING_CLASS_LOOKUP[normalizedCode] || null;
}

/**
 * Get building class description text with code in parentheses
 * @param {string|null|undefined} code - Building class code
 * @returns {string} Description string with code in parentheses, or the code itself if not found
 */
function getBuildingClassDescriptionText(code) {
	if (!code) return "Unknown";
	
	const normalizedCode = String(code).trim().toUpperCase();
	const info = getBuildingClassDescription(normalizedCode);
	
	if (info) {
		return `${info.description} (${normalizedCode})`;
	}
	
	return normalizedCode;
}

module.exports = {
	getBuildingClassDescription,
	getBuildingClassDescriptionText,
};

