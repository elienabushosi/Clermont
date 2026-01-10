/**
 * Backend utility for land use lookups
 * 
 * Uses the shared JSON file for land use code to description mapping.
 */

const path = require("path");
const landUseData = require(path.join(__dirname, "../../shared/land-use-lookup.json"));

// Create lookup from JSON
const LAND_USE_LOOKUP = {};

Object.entries(landUseData).forEach(([code, description]) => {
	LAND_USE_LOOKUP[code] = {
		code,
		description,
	};
});

/**
 * Get land use description by code
 * @param {string|null|undefined} code - Land use code (e.g., "04", "11")
 * @returns {Object|null} Land use info or null if not found
 */
function getLandUseDescription(code) {
	if (!code) return null;
	
	const normalizedCode = String(code).trim();
	return LAND_USE_LOOKUP[normalizedCode] || null;
}

/**
 * Get land use description text with code in parentheses
 * @param {string|null|undefined} code - Land use code
 * @returns {string} Description string with code in parentheses, or the code itself if not found
 */
function getLandUseDescriptionText(code) {
	if (!code) return "Unknown";
	
	const normalizedCode = String(code).trim();
	const info = getLandUseDescription(normalizedCode);
	
	if (info) {
		return `${info.description} (${normalizedCode})`;
	}
	
	return normalizedCode;
}

module.exports = {
	getLandUseDescription,
	getLandUseDescriptionText,
};

