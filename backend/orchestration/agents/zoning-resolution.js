// Zoning Resolution agent - computes max FAR and max lot coverage for residential districts
import { BaseAgent } from "./base-agent.js";
import { getReportSources } from "../../services/report-service.js";

export class ZoningResolutionAgent extends BaseAgent {
	constructor() {
		super("Zoning Resolution", "zoning_resolution");
		this.enabled = true; // Enable for V1
	}

	/**
	 * Get max FAR for residential district (hardcoded lookup)
	 * @param {string} district - Zoning district code (e.g., "R6", "R7-2", "R8A")
	 * @returns {Object} FAR data with value, profile, and assumptions
	 */
	getMaxFAR(district) {
		if (!district || typeof district !== "string") {
			return null;
		}

		const normalized = district.trim().toUpperCase();

		// Hardcoded FAR lookup for common residential districts
		// Format: { district: { far: number, profile: string, contextual: boolean } }
		const farLookup = {
			// R1-R5 (low density)
			R1: { far: 0.5, profile: "R1", contextual: false },
			R1A: { far: 0.5, profile: "R1A", contextual: false },
			R1B: { far: 0.5, profile: "R1B", contextual: false },
			R2: { far: 0.5, profile: "R2", contextual: false },
			R2A: { far: 0.5, profile: "R2A", contextual: false },
			R2B: { far: 0.5, profile: "R2B", contextual: false },
			R2X: { far: 0.5, profile: "R2X", contextual: false },
			R3: { far: 0.5, profile: "R3", contextual: false },
			R3A: { far: 0.5, profile: "R3A", contextual: false },
			R3B: { far: 0.5, profile: "R3B", contextual: false },
			R3X: { far: 0.5, profile: "R3X", contextual: false },
			R4: { far: 0.75, profile: "R4", contextual: false },
			R4A: { far: 0.75, profile: "R4A", contextual: false },
			R4B: { far: 0.75, profile: "R4B", contextual: false },
			R4X: { far: 0.75, profile: "R4X", contextual: false },
			R5: { far: 1.25, profile: "R5", contextual: false },
			R5A: { far: 1.25, profile: "R5A", contextual: false },
			R5B: { far: 1.25, profile: "R5B", contextual: false },
			R5D: { far: 1.25, profile: "R5D", contextual: false },
			R5X: { far: 1.25, profile: "R5X", contextual: false },

			// R6 (medium density)
			R6: { far: 2.43, profile: "R6", contextual: false },
			R6A: { far: 3.0, profile: "R6A", contextual: true },
			R6B: { far: 2.0, profile: "R6B", contextual: true },
			R6X: { far: 2.43, profile: "R6X", contextual: false },

			// R7 (medium-high density)
			R7: { far: 3.44, profile: "R7", contextual: false },
			R7A: { far: 4.0, profile: "R7A", contextual: true },
			R7B: { far: 3.0, profile: "R7B", contextual: true },
			R7D: { far: 3.44, profile: "R7D", contextual: false },
			R7X: { far: 3.44, profile: "R7X", contextual: false },

			// R8 (high density)
			R8: { far: 6.02, profile: "R8", contextual: false },
			R8A: { far: 7.2, profile: "R8A", contextual: true },
			R8B: { far: 4.0, profile: "R8B", contextual: true },
			R8X: { far: 6.02, profile: "R8X", contextual: false },

			// R9 (very high density)
			R9: { far: 7.52, profile: "R9", contextual: false },
			R9A: { far: 8.0, profile: "R9A", contextual: true },
			R9X: { far: 7.52, profile: "R9X", contextual: false },

			// R10 (very high density)
			R10: { far: 10.0, profile: "R10", contextual: false },
			R10A: { far: 10.0, profile: "R10A", contextual: true },
			R10X: { far: 10.0, profile: "R10X", contextual: false },

			// R11 (very high density)
			R11: { far: 12.0, profile: "R11", contextual: false },
			R11A: { far: 12.0, profile: "R11A", contextual: true },
			R11X: { far: 12.0, profile: "R11X", contextual: false },

			// R12 (very high density)
			R12: { far: 12.0, profile: "R12", contextual: false },
			R12A: { far: 12.0, profile: "R12A", contextual: true },
			R12X: { far: 12.0, profile: "R12X", contextual: false },
		};

		// Check exact match first
		if (farLookup[normalized]) {
			return {
				far: farLookup[normalized].far,
				profile: farLookup[normalized].profile,
				contextual: farLookup[normalized].contextual,
			};
		}

		// Try to match base district (e.g., "R7-2" -> "R7", "R8A" -> "R8")
		// Match pattern: R followed by digits, optionally followed by dash and more chars
		const baseMatch = normalized.match(/^(R\d+)[-A-ZX]*/);
		if (baseMatch && farLookup[baseMatch[1]]) {
			const base = farLookup[baseMatch[1]];
			return {
				far: base.far,
				profile: base.profile,
				contextual: base.contextual,
				assumption: `District ${normalized} not in lookup; using base ${baseMatch[1]} FAR`,
			};
		}

		return null; // Not supported
	}

	/**
	 * Determine lot type (corner vs interior/through)
	 * @param {Object} zolaData - Zola source data
	 * @returns {Object} Lot type with flag and assumption
	 */
	determineLotType(zolaData) {
		// V1: Default to interior/through if no reliable indicator
		// In future, could check for corner lot indicators in PLUTO
		return {
			lotType: "interior_or_through",
			assumption: "Lot type unknown; assumed interior/through",
		};
	}

	/**
	 * Determine building type (single/two-family vs multiple dwelling)
	 * @param {string} bldgclass - Building class code
	 * @returns {Object} Building type with flag and assumption
	 */
	determineBuildingType(bldgclass) {
		if (!bldgclass || typeof bldgclass !== "string") {
			return {
				buildingType: "unknown",
				assumption:
					"Building class unknown; defaulting to single/two-family for lot coverage rules",
			};
		}

		const normalized = bldgclass.trim().toUpperCase();
		const prefix = normalized.charAt(0);

		// A* or B* => single/two-family
		if (prefix === "A" || prefix === "B") {
			return {
				buildingType: "single_or_two_family",
				assumption: null,
			};
		}

		// C* or D* => multiple dwelling
		if (prefix === "C" || prefix === "D") {
			return {
				buildingType: "multiple_dwelling",
				assumption: null,
			};
		}

		// Unknown - default to single/two-family for conservative lot coverage
		return {
			buildingType: "single_or_two_family",
			assumption: `Building class ${normalized} not recognized; defaulting to single/two-family`,
		};
	}

	/**
	 * Calculate max lot coverage for R1-R5 districts (Section 23-361)
	 * @param {string} district - Zoning district
	 * @param {string} lotType - "corner" or "interior_or_through"
	 * @param {string} buildingType - "single_or_two_family" or "multiple_dwelling"
	 * @returns {Object} Max lot coverage with assumptions
	 */
	getMaxLotCoverageR1R5(district, lotType, buildingType) {
		const normalized = district.trim().toUpperCase();
		const baseMatch = normalized.match(/^(R[1-5])/);
		if (!baseMatch) {
			return null;
		}

		const baseDistrict = baseMatch[1];
		const isCorner = lotType === "corner";
		const isMultipleDwelling = buildingType === "multiple_dwelling";

		// Check for special districts (R2X, R3A, R3X) - yard-based, not implemented
		if (
			normalized === "R2X" ||
			normalized === "R3A" ||
			normalized === "R3X"
		) {
			return {
				maxLotCoverage: null,
				assumption:
					"Yard-based lot coverage (Section 23-361 exception); not implemented in V1",
			};
		}

		// Multiple dwelling (where permitted) in R1-R5
		if (isMultipleDwelling) {
			return {
				maxLotCoverage: isCorner ? 1.0 : 0.8,
				assumption: "Multiple dwelling in R1-R5 (Section 23-361(b))",
			};
		}

		// Single- or two-family residences (Section 23-361(a))
		if (baseDistrict === "R1" || baseDistrict === "R2") {
			return {
				maxLotCoverage: isCorner ? 0.8 : 0.4,
				assumption:
					"Single- or two-family in R1/R2 (Section 23-361(a))",
			};
		}

		if (baseDistrict === "R3") {
			return {
				maxLotCoverage: isCorner ? 0.8 : 0.5,
				assumption: "Single- or two-family in R3 (Section 23-361(a))",
			};
		}

		if (baseDistrict === "R4" || baseDistrict === "R5") {
			return {
				maxLotCoverage: isCorner ? 0.8 : 0.6,
				assumption:
					"Single- or two-family in R4/R5 (Section 23-361(a))",
			};
		}

		return null;
	}

	/**
	 * Calculate max lot coverage for R6-R12 districts (Section 23-362)
	 * @param {string} district - Zoning district
	 * @param {string} lotType - "corner" or "interior_or_through"
	 * @param {number} lotArea - Lot area in square feet
	 * @returns {Object} Max lot coverage with assumptions
	 */
	getMaxLotCoverageR6R12(district, lotType, lotArea) {
		const normalized = district.trim().toUpperCase();
		const baseMatch = normalized.match(/^(R[6-9]|R1[0-2])/);
		if (!baseMatch) {
			return null;
		}

		const isCorner = lotType === "corner";

		// Standard lots (Section 23-362(a))
		// V1: Default to standard rule unless we have reliable eligibility signals
		return {
			maxLotCoverage: isCorner ? 1.0 : 0.8,
			assumption:
				"Standard lot in R6-R12 (Section 23-362(a)); eligible site rules not evaluated in V1",
			eligibleSiteNotEvaluated: true,
		};
	}

	/**
	 * Calculate max lot coverage
	 * @param {string} district - Zoning district
	 * @param {string} lotType - Lot type
	 * @param {string} buildingType - Building type
	 * @param {number} lotArea - Lot area in square feet
	 * @returns {Object} Max lot coverage result
	 */
	calculateMaxLotCoverage(district, lotType, buildingType, lotArea) {
		if (!district) {
			return {
				maxLotCoverage: null,
				assumption: "Zoning district not available",
			};
		}

		const normalized = district.trim().toUpperCase();

		// Check if residential district
		if (!normalized.startsWith("R")) {
			return {
				maxLotCoverage: null,
				assumption: `Non-residential district ${normalized}; not supported in V1`,
			};
		}

		// R1-R5
		const r1r5Result = this.getMaxLotCoverageR1R5(
			district,
			lotType,
			buildingType
		);
		if (r1r5Result) {
			return r1r5Result;
		}

		// R6-R12
		const r6r12Result = this.getMaxLotCoverageR6R12(
			district,
			lotType,
			lotArea
		);
		if (r6r12Result) {
			return r6r12Result;
		}

		return {
			maxLotCoverage: null,
			assumption: `District ${normalized} not supported for lot coverage calculation`,
		};
	}

	/**
	 * Normalize district for height lookups (keep hyphens intact)
	 * @param {string} district - Zoning district code
	 * @returns {string} Normalized district
	 */
	normalizeDistrictForHeights(district) {
		if (!district || typeof district !== "string") {
			return null;
		}
		return district.trim().toUpperCase();
	}

	/**
	 * Get minimum base height for residential district (R6-R12 only, ZR §23-432)
	 * @param {string} district - Zoning district code
	 * @returns {Object} Minimum base height data
	 */
	getMinBaseHeight(district) {
		const normalized = this.normalizeDistrictForHeights(district);
		if (!normalized) {
			return {
				kind: "unsupported",
				value_ft: null,
				candidates: null,
				source_url: null,
				source_section: null,
				notes: "District not provided",
				requires_manual_review: false,
			};
		}

		// Check if R1-R5 (URL-only, no numeric values)
		const r1r5Match = normalized.match(/^R[1-5]/);
		if (r1r5Match) {
			// R3-2, R4, R4B, R5, R5B, R5D use 23-422
			if (
				normalized === "R3-2" ||
				normalized === "R4" ||
				normalized === "R4B" ||
				normalized === "R5" ||
				normalized === "R5B" ||
				normalized === "R5D"
			) {
				return {
					kind: "see_section",
					value_ft: null,
					candidates: null,
					source_url:
						"https://zr.planning.nyc.gov/article-ii/chapter-3/23-422",
					source_section: "ZR §23-422",
					notes: "Min base height not a single value for this district; see ZR section.",
					requires_manual_review: true,
				};
			}
			// Other R1-R5 use 23-421
			return {
				kind: "see_section",
				value_ft: null,
				candidates: null,
				source_url:
					"https://zr.planning.nyc.gov/article-ii/chapter-3/23-421",
				source_section: "ZR §23-421",
				notes: "Min base height not a single value for this district; see ZR section.",
				requires_manual_review: true,
			};
		}

		// R6-R12 minimum base height mapping (ZR §23-432)
		// Special case: R6 has conflicting values (40 vs 30), so handle it separately
		if (normalized === "R6") {
			return {
				kind: "conditional",
				value_ft: null,
				candidates: [
					{
						value_ft: 40,
						when: "Depends on applicable zoning conditions; see citation.",
						source_url:
							"https://zr.planning.nyc.gov/article-ii/chapter-3/23-432",
						source_section: "ZR §23-432",
					},
					{
						value_ft: 30,
						when: "Depends on applicable zoning conditions; see citation.",
						source_url:
							"https://zr.planning.nyc.gov/article-ii/chapter-3/23-432",
						source_section: "ZR §23-432",
					},
				],
				source_url:
					"https://zr.planning.nyc.gov/article-ii/chapter-3/23-432",
				source_section: "ZR §23-432",
				notes: "Multiple values apply; manual review required.",
				requires_manual_review: true,
			};
		}

		const minBaseHeightLookup = {
			// R6 districts (excluding base R6 which is handled above)
			R6A: 40,
			"R6-1": 40,
			R6B: 30,
			R6D: 30,
			"R6-2": 30,
			// R7 districts
			R7A: 40,
			"R7-1": 40,
			"R7-21": 40,
			"R7-2": 40,
			R7B: 40,
			R7D: 60,
			R7X: 60,
			"R7-3": 60,
			// R8 districts
			R8: 60,
			R8A: 60,
			R8B: 55,
			R8X: 60,
			// R9 districts
			R9: 60,
			R9A: 60,
			R9D: 60,
			"R9-1": 60,
			R9X: 105,
			// R10 districts
			R10: 60,
			R10X: 60,
			R10A: 125,
			// R11 districts
			R11: 60,
			R11A: 60,
			// R12 districts
			R12: 60,
		};

		// Check for exact match
		if (minBaseHeightLookup[normalized] !== undefined) {
			return {
				kind: "fixed",
				value_ft: minBaseHeightLookup[normalized],
				candidates: null,
				source_url:
					"https://zr.planning.nyc.gov/article-ii/chapter-3/23-432",
				source_section: "ZR §23-432",
				notes: null,
				requires_manual_review: false,
			};
		}

		// Not found in R6-R12 lookup
		return {
			kind: "unsupported",
			value_ft: null,
			candidates: null,
			source_url: null,
			source_section: null,
			notes: `District ${normalized} not supported for minimum base height lookup.`,
			requires_manual_review: false,
		};
	}

	/**
	 * Get height envelope (max base height + max building height paired)
	 * @param {string} district - Zoning district code
	 * @returns {Object} Height envelope data
	 */
	getHeightEnvelope(district) {
		const normalized = this.normalizeDistrictForHeights(district);
		if (!normalized) {
			return {
				kind: "unsupported",
				candidates: null,
				notes: "District not provided",
				requires_manual_review: false,
			};
		}

		// R1-R3 districts (ZR §23-424)
		const r1r3Districts = [
			"R1-1",
			"R1-2",
			"R1-2A",
			"R2",
			"R2A",
			"R2X",
			"R3-1",
			"R3-2",
			"R3A",
			"R3X",
		];
		if (r1r3Districts.includes(normalized)) {
			return {
				kind: "fixed",
				candidates: [
					{
						max_base_height_ft: 35,
						max_building_height_ft: 35,
						when: null,
						source_url:
							"https://zr.planning.nyc.gov/article-ii/chapter-3/23-424",
						source_section: "ZR §23-424",
					},
				],
				notes: null,
				requires_manual_review: false,
			};
		}

		// R4 districts (ZR §23-424)
		const r4Districts = ["R4", "R4-1", "R4A", "R4B"];
		if (r4Districts.includes(normalized)) {
			return {
				kind: "fixed",
				candidates: [
					{
						max_base_height_ft: 35,
						max_building_height_ft: 45,
						when: null,
						source_url:
							"https://zr.planning.nyc.gov/article-ii/chapter-3/23-424",
						source_section: "ZR §23-424",
					},
				],
				notes: null,
				requires_manual_review: false,
			};
		}

		// R5 districts (ZR §23-424)
		const r5Districts = ["R5", "R5A", "R5B", "R5D"];
		if (r5Districts.includes(normalized)) {
			return {
				kind: "fixed",
				candidates: [
					{
						max_base_height_ft: 45,
						max_building_height_ft: 55,
						when: null,
						source_url:
							"https://zr.planning.nyc.gov/article-ii/chapter-3/23-424",
						source_section: "ZR §23-424",
					},
				],
				notes: null,
				requires_manual_review: false,
			};
		}

		// R6 districts (ZR §23-432) - CONDITIONAL for base R6
		if (normalized === "R6A" || normalized === "R6-1") {
			return {
				kind: "fixed",
				candidates: [
					{
						max_base_height_ft: 65,
						max_building_height_ft: 75,
						when: null,
						source_url:
							"https://zr.planning.nyc.gov/article-ii/chapter-3/23-432",
						source_section: "ZR §23-432",
					},
				],
				notes: null,
				requires_manual_review: false,
			};
		}
		if (normalized === "R6") {
			return {
				kind: "conditional",
				candidates: [
					{
						max_base_height_ft: 65,
						max_building_height_ft: 75,
						when: "Depends on applicable zoning conditions; see citation.",
						source_url:
							"https://zr.planning.nyc.gov/article-ii/chapter-3/23-432",
						source_section: "ZR §23-432",
					},
					{
						max_base_height_ft: 45,
						max_building_height_ft: 55,
						when: "Depends on applicable zoning conditions; see citation.",
						source_url:
							"https://zr.planning.nyc.gov/article-ii/chapter-3/23-432",
						source_section: "ZR §23-432",
					},
				],
				notes: "Multiple values apply; manual review required.",
				requires_manual_review: true,
			};
		}
		if (normalized === "R6B") {
			return {
				kind: "fixed",
				candidates: [
					{
						max_base_height_ft: 45,
						max_building_height_ft: 55,
						when: null,
						source_url:
							"https://zr.planning.nyc.gov/article-ii/chapter-3/23-432",
						source_section: "ZR §23-432",
					},
				],
				notes: null,
				requires_manual_review: false,
			};
		}
		if (normalized === "R6D" || normalized === "R6-2") {
			return {
				kind: "fixed",
				candidates: [
					{
						max_base_height_ft: 45,
						max_building_height_ft: 65,
						when: null,
						source_url:
							"https://zr.planning.nyc.gov/article-ii/chapter-3/23-432",
						source_section: "ZR §23-432",
					},
				],
				notes: null,
				requires_manual_review: false,
			};
		}

		// R7 districts (ZR §23-432)
		if (normalized === "R7A" || normalized === "R7-21") {
			return {
				kind: "fixed",
				candidates: [
					{
						max_base_height_ft: 75,
						max_building_height_ft: 85,
						when: null,
						source_url:
							"https://zr.planning.nyc.gov/article-ii/chapter-3/23-432",
						source_section: "ZR §23-432",
					},
				],
				notes: null,
				requires_manual_review: false,
			};
		}
		if (normalized === "R7-1") {
			// R7-1 appears in multiple mappings, so it's conditional
			return {
				kind: "conditional",
				candidates: [
					{
						max_base_height_ft: 75,
						max_building_height_ft: 85,
						when: "Depends on applicable zoning conditions; see citation.",
						source_url:
							"https://zr.planning.nyc.gov/article-ii/chapter-3/23-432",
						source_section: "ZR §23-432",
					},
					{
						max_base_height_ft: 65,
						max_building_height_ft: 75,
						when: "Depends on applicable zoning conditions; see citation.",
						source_url:
							"https://zr.planning.nyc.gov/article-ii/chapter-3/23-432",
						source_section: "ZR §23-432",
					},
				],
				notes: "Multiple values apply; manual review required.",
				requires_manual_review: true,
			};
		}
		if (normalized === "R7-2") {
			return {
				kind: "fixed",
				candidates: [
					{
						max_base_height_ft: 65,
						max_building_height_ft: 75,
						when: null,
						source_url:
							"https://zr.planning.nyc.gov/article-ii/chapter-3/23-432",
						source_section: "ZR §23-432",
					},
				],
				notes: null,
				requires_manual_review: false,
			};
		}
		if (normalized === "R7B") {
			return {
				kind: "fixed",
				candidates: [
					{
						max_base_height_ft: 65,
						max_building_height_ft: 75,
						when: null,
						source_url:
							"https://zr.planning.nyc.gov/article-ii/chapter-3/23-432",
						source_section: "ZR §23-432",
					},
				],
				notes: null,
				requires_manual_review: false,
			};
		}
		if (normalized === "R7D") {
			return {
				kind: "fixed",
				candidates: [
					{
						max_base_height_ft: 85,
						max_building_height_ft: 105,
						when: null,
						source_url:
							"https://zr.planning.nyc.gov/article-ii/chapter-3/23-432",
						source_section: "ZR §23-432",
					},
				],
				notes: null,
				requires_manual_review: false,
			};
		}
		if (normalized === "R7X" || normalized === "R7-3") {
			return {
				kind: "fixed",
				candidates: [
					{
						max_base_height_ft: 95,
						max_building_height_ft: 125,
						when: null,
						source_url:
							"https://zr.planning.nyc.gov/article-ii/chapter-3/23-432",
						source_section: "ZR §23-432",
					},
				],
				notes: null,
				requires_manual_review: false,
			};
		}

		// R8 districts (ZR §23-432) - CONDITIONAL for base R8
		if (normalized === "R8A") {
			return {
				kind: "fixed",
				candidates: [
					{
						max_base_height_ft: 95,
						max_building_height_ft: 125,
						when: null,
						source_url:
							"https://zr.planning.nyc.gov/article-ii/chapter-3/23-432",
						source_section: "ZR §23-432",
					},
				],
				notes: null,
				requires_manual_review: false,
			};
		}
		if (normalized === "R8B") {
			return {
				kind: "fixed",
				candidates: [
					{
						max_base_height_ft: 65,
						max_building_height_ft: 75,
						when: null,
						source_url:
							"https://zr.planning.nyc.gov/article-ii/chapter-3/23-432",
						source_section: "ZR §23-432",
					},
				],
				notes: null,
				requires_manual_review: false,
			};
		}
		if (normalized === "R8X") {
			return {
				kind: "fixed",
				candidates: [
					{
						max_base_height_ft: 95,
						max_building_height_ft: 155,
						when: null,
						source_url:
							"https://zr.planning.nyc.gov/article-ii/chapter-3/23-432",
						source_section: "ZR §23-432",
					},
				],
				notes: null,
				requires_manual_review: false,
			};
		}
		if (normalized === "R8") {
			return {
				kind: "conditional",
				candidates: [
					{
						max_base_height_ft: 85,
						max_building_height_ft: 115,
						when: "Depends on applicable zoning conditions; see citation.",
						source_url:
							"https://zr.planning.nyc.gov/article-ii/chapter-3/23-432",
						source_section: "ZR §23-432",
					},
					{
						max_base_height_ft: 95,
						max_building_height_ft: 135,
						when: "Depends on applicable zoning conditions; see citation.",
						source_url:
							"https://zr.planning.nyc.gov/article-ii/chapter-3/23-432",
						source_section: "ZR §23-432",
					},
				],
				notes: "Multiple values apply; manual review required.",
				requires_manual_review: true,
			};
		}

		// R9 districts (ZR §23-432) - CONDITIONAL
		if (normalized === "R9" || normalized === "R9A") {
			return {
				kind: "conditional",
				candidates: [
					{
						max_base_height_ft: 105,
						max_building_height_ft: 145,
						when: "Depends on applicable zoning conditions; see citation.",
						source_url:
							"https://zr.planning.nyc.gov/article-ii/chapter-3/23-432",
						source_section: "ZR §23-432",
					},
					{
						max_base_height_ft: 95,
						max_building_height_ft: 135,
						when: "Depends on applicable zoning conditions; see citation.",
						source_url:
							"https://zr.planning.nyc.gov/article-ii/chapter-3/23-432",
						source_section: "ZR §23-432",
					},
				],
				notes: "Multiple values apply; manual review required.",
				requires_manual_review: true,
			};
		}
		if (normalized === "R9D" || normalized === "R9-1") {
			return {
				kind: "fixed",
				candidates: [
					{
						max_base_height_ft: 125,
						max_building_height_ft: 175,
						when: null,
						source_url:
							"https://zr.planning.nyc.gov/article-ii/chapter-3/23-432",
						source_section: "ZR §23-432",
					},
				],
				notes: null,
				requires_manual_review: false,
			};
		}
		if (normalized === "R9X") {
			return {
				kind: "conditional",
				candidates: [
					{
						max_base_height_ft: 125,
						max_building_height_ft: 175,
						when: "Depends on applicable zoning conditions; see citation.",
						source_url:
							"https://zr.planning.nyc.gov/article-ii/chapter-3/23-432",
						source_section: "ZR §23-432",
					},
					{
						max_base_height_ft: 125,
						max_building_height_ft: 165,
						when: "Depends on applicable zoning conditions; see citation.",
						source_url:
							"https://zr.planning.nyc.gov/article-ii/chapter-3/23-432",
						source_section: "ZR §23-432",
					},
				],
				notes: "Multiple values apply; manual review required.",
				requires_manual_review: true,
			};
		}

		// R10 districts (ZR §23-432) - CONDITIONAL
		if (normalized === "R10" || normalized === "R10X") {
			return {
				kind: "conditional",
				candidates: [
					{
						max_base_height_ft: 155,
						max_building_height_ft: 215,
						when: "Depends on applicable zoning conditions; see citation.",
						source_url:
							"https://zr.planning.nyc.gov/article-ii/chapter-3/23-432",
						source_section: "ZR §23-432",
					},
					{
						max_base_height_ft: 125,
						max_building_height_ft: 185,
						when: "Depends on applicable zoning conditions; see citation.",
						source_url:
							"https://zr.planning.nyc.gov/article-ii/chapter-3/23-432",
						source_section: "ZR §23-432",
					},
				],
				notes: "Multiple values apply; manual review required.",
				requires_manual_review: true,
			};
		}
		if (normalized === "R10A") {
			return {
				kind: "conditional",
				candidates: [
					{
						max_base_height_ft: 155,
						max_building_height_ft: 215,
						when: "Depends on applicable zoning conditions; see citation.",
						source_url:
							"https://zr.planning.nyc.gov/article-ii/chapter-3/23-432",
						source_section: "ZR §23-432",
					},
					{
						max_base_height_ft: 125,
						max_building_height_ft: 185,
						when: "Depends on applicable zoning conditions; see citation.",
						source_url:
							"https://zr.planning.nyc.gov/article-ii/chapter-3/23-432",
						source_section: "ZR §23-432",
					},
				],
				notes: "Multiple values apply; manual review required.",
				requires_manual_review: true,
			};
		}

		// R11 districts (ZR §23-432)
		if (normalized === "R11" || normalized === "R11A") {
			return {
				kind: "fixed",
				candidates: [
					{
						max_base_height_ft: 155,
						max_building_height_ft: 255,
						when: null,
						source_url:
							"https://zr.planning.nyc.gov/article-ii/chapter-3/23-432",
						source_section: "ZR §23-432",
					},
				],
				notes: null,
				requires_manual_review: false,
			};
		}

		// R12 districts (ZR §23-432)
		if (normalized === "R12") {
			return {
				kind: "fixed",
				candidates: [
					{
						max_base_height_ft: 155,
						max_building_height_ft: 325,
						when: null,
						source_url:
							"https://zr.planning.nyc.gov/article-ii/chapter-3/23-432",
						source_section: "ZR §23-432",
					},
				],
				notes: null,
				requires_manual_review: false,
			};
		}

		// Not found
		return {
			kind: "unsupported",
			candidates: null,
			notes: `District ${normalized} not supported for height envelope lookup.`,
			requires_manual_review: false,
		};
	}

	/**
	 * Calculate derived values (max buildable floor area, remaining, etc.)
	 * @param {number} maxFAR - Maximum FAR
	 * @param {number} lotArea - Lot area in square feet
	 * @param {number} bldgarea - Existing building area in square feet
	 * @param {number} maxLotCoverage - Maximum lot coverage (fraction 0-1)
	 * @returns {Object} Derived calculations
	 */
	calculateDerivedValues(maxFAR, lotArea, bldgarea, maxLotCoverage) {
		const derived = {};

		// Max buildable floor area
		if (maxFAR !== null && lotArea !== null && lotArea > 0) {
			derived.maxBuildableFloorAreaSqft = maxFAR * lotArea;
		}

		// Remaining buildable floor area
		if (
			derived.maxBuildableFloorAreaSqft !== undefined &&
			bldgarea !== null &&
			bldgarea !== undefined
		) {
			const remaining = derived.maxBuildableFloorAreaSqft - bldgarea;
			derived.remainingBuildableFloorAreaSqft = Math.max(0, remaining);
			if (derived.remainingBuildableFloorAreaSqft === 0) {
				derived.remainingFloorAreaMessage = "FAR limit reached already";
			}
		}

		// Max building footprint
		if (maxLotCoverage !== null && lotArea !== null && lotArea > 0) {
			derived.maxBuildingFootprintSqft = maxLotCoverage * lotArea;
		}

		return derived;
	}

	/**
	 * Fetch data from stored Zola source and compute zoning constraints
	 * @param {Object} addressData - Address information
	 * @param {string} reportId - Report ID
	 * @returns {Promise<Object>} Zoning resolution result
	 */
	async fetchData(addressData, reportId) {
		try {
			// Get all report sources to find Zola data
			const sources = await getReportSources(reportId);
			const zolaSource = sources.find((s) => s.SourceKey === "zola");

			if (!zolaSource || !zolaSource.ContentJson) {
				throw new Error(
					"Zola source data not found. ZolaAgent must run before ZoningResolutionAgent."
				);
			}

			// ZolaAgent returns { contentJson: {...}, sourceUrl: ... }
			// This gets stored as ContentJson in the database
			// So we need to access ContentJson.contentJson to get the actual data
			const zolaData =
				zolaSource.ContentJson.contentJson || zolaSource.ContentJson;

			console.log(
				"ZoningResolutionAgent - Zola source ContentJson structure:",
				{
					hasContentJson: !!zolaSource.ContentJson.contentJson,
					hasDirectProperties: !!zolaSource.ContentJson.zonedist1,
					topLevelKeys: Object.keys(zolaSource.ContentJson || {}),
				}
			);
			console.log(
				"ZoningResolutionAgent - Extracted zolaData keys:",
				Object.keys(zolaData || {})
			);
			console.log(
				"ZoningResolutionAgent - District from zolaData:",
				zolaData?.zonedist1
			);

			// Extract required fields
			const district = zolaData?.zonedist1 || null;
			const overlay1 = zolaData.overlay1 || null;
			const overlay2 = zolaData.overlay2 || null;
			const spdist1 = zolaData.spdist1 || null;
			const spdist2 = zolaData.spdist2 || null;
			const spdist3 = zolaData.spdist3 || null;
			const lotArea = zolaData.lotarea || null;
			const lotDepth = zolaData.lotdepth || null;
			const lotFront = zolaData.lotfront || null;
			const bldgarea = zolaData.bldgarea || null;
			const bldgclass = zolaData.bldgclass || null;

			// Check if residential district
			if (!district) {
				console.error(
					"ZoningResolutionAgent - District is null or undefined"
				);
				return {
					contentJson: {
						district: null,
						maxFar: null,
						maxLotCoverage: null,
						assumptions: [
							"District not found in Zola data. Zonedist1 field is missing or null.",
						],
						flags: {
							hasOverlay: !!(overlay1 || overlay2),
							hasSpecialDistrict: !!(
								spdist1 ||
								spdist2 ||
								spdist3
							),
							multiDistrictLot: !!(
								zolaData?.zonedist2 ||
								zolaData?.zonedist3 ||
								zolaData?.zonedist4
							),
							districtNotFound: true,
						},
					},
					sourceUrl: null,
				};
			}

			const districtUpper = district.toString().trim().toUpperCase();
			if (!districtUpper.startsWith("R")) {
				return {
					contentJson: {
						district: district,
						maxFar: null,
						maxLotCoverage: null,
						assumptions: [
							`District ${
								district || "unknown"
							} is not residential; V1 supports R* districts only`,
						],
						flags: {
							hasOverlay: !!(overlay1 || overlay2),
							hasSpecialDistrict: !!(
								spdist1 ||
								spdist2 ||
								spdist3
							),
							multiDistrictLot: !!(
								zolaData?.zonedist2 ||
								zolaData?.zonedist3 ||
								zolaData?.zonedist4
							),
							nonResidential: true,
						},
					},
					sourceUrl: null,
				};
			}

			// Determine lot type and building type
			const lotTypeResult = this.determineLotType(zolaData);
			const buildingTypeResult = this.determineBuildingType(bldgclass);

			// Get max FAR (use the normalized district)
			const farResult = this.getMaxFAR(districtUpper);
			const maxFAR = farResult ? farResult.far : null;

			console.log("ZoningResolutionAgent - FAR calculation:", {
				district: districtUpper,
				farResult: farResult,
				maxFAR: maxFAR,
			});

			// Get max lot coverage (use the normalized district)
			const lotCoverageResult = this.calculateMaxLotCoverage(
				districtUpper,
				lotTypeResult.lotType,
				buildingTypeResult.buildingType,
				lotArea
			);
			const maxLotCoverage = lotCoverageResult.maxLotCoverage;

			console.log("ZoningResolutionAgent - Lot coverage calculation:", {
				district: districtUpper,
				lotType: lotTypeResult.lotType,
				buildingType: buildingTypeResult.buildingType,
				lotArea: lotArea,
				lotCoverageResult: lotCoverageResult,
				maxLotCoverage: maxLotCoverage,
			});

			// Calculate derived values
			const derived = this.calculateDerivedValues(
				maxFAR,
				lotArea,
				bldgarea,
				maxLotCoverage
			);

			// Get height constraints
			const minBaseHeight = this.getMinBaseHeight(districtUpper);
			const heightEnvelope = this.getHeightEnvelope(districtUpper);

			console.log("ZoningResolutionAgent - Height calculations:", {
				district: districtUpper,
				minBaseHeight: minBaseHeight,
				heightEnvelope: heightEnvelope,
			});

			// Build assumptions array
			const assumptions = [];
			if (farResult && farResult.assumption) {
				assumptions.push(farResult.assumption);
			}
			if (lotTypeResult.assumption) {
				assumptions.push(lotTypeResult.assumption);
			}
			if (buildingTypeResult.assumption) {
				assumptions.push(buildingTypeResult.assumption);
			}
			if (lotCoverageResult.assumption) {
				assumptions.push(lotCoverageResult.assumption);
			}
			// Add height assumptions
			if (minBaseHeight.kind === "see_section") {
				assumptions.push(
					"Min base height not a single value for this district; see ZR section."
				);
			}
			if (minBaseHeight.kind === "conditional") {
				assumptions.push(
					"Multiple minimum base height values possible; depends on zoning conditions; see citation."
				);
			}
			if (minBaseHeight.kind === "unsupported") {
				assumptions.push(
					`Height lookup not implemented for district ${districtUpper}.`
				);
			}
			if (heightEnvelope.kind === "conditional") {
				assumptions.push(
					"Multiple height limits possible; depends on zoning conditions; see citation."
				);
			}
			if (heightEnvelope.kind === "unsupported") {
				assumptions.push(
					`Height envelope lookup not implemented for district ${districtUpper}.`
				);
			}

			// Build flags
			const flags = {
				hasOverlay: !!(overlay1 || overlay2),
				hasSpecialDistrict: !!(spdist1 || spdist2 || spdist3),
				multiDistrictLot: !!(
					zolaData.zonedist2 ||
					zolaData.zonedist3 ||
					zolaData.zonedist4
				),
				lotTypeInferred: true,
				buildingTypeInferred: !!buildingTypeResult.assumption,
				eligibleSiteNotEvaluated:
					lotCoverageResult.eligibleSiteNotEvaluated || false,
				specialLotCoverageRulesNotEvaluated: true, // V1: Section 23-363 not implemented
			};

			// Build result object
			const result = {
				district: district,
				profile: farResult ? farResult.profile : null,
				contextual: farResult ? farResult.contextual : null,
				lotType: lotTypeResult.lotType,
				buildingType: buildingTypeResult.buildingType,
				maxFar: maxFAR,
				maxLotCoverage: maxLotCoverage,
				derived: derived,
				height: {
					min_base_height: minBaseHeight,
					envelope: heightEnvelope,
				},
				assumptions: assumptions,
				flags: flags,
			};

			return {
				contentJson: result,
				sourceUrl: null, // No external API call
			};
		} catch (error) {
			console.error("Error in ZoningResolutionAgent:", error);
			throw error;
		}
	}
}
