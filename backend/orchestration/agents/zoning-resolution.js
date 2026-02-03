// Zoning Resolution agent - computes max FAR and max lot coverage for residential districts
import { BaseAgent } from "./base-agent.js";
import { getReportSources } from "../../services/report-service.js";

export class ZoningResolutionAgent extends BaseAgent {
	constructor() {
		super("Zoning Resolution", "zoning_resolution");
		this.enabled = true; // Enable for V1
	}

	/**
	 * Get max FAR for residential district (hardcoded lookup per NYC Zoning Resolution).
	 * Values from ZR § 23-21 (R1–R5) and § 23-22 (R6–R12), standard zoning lots / standard residences only.
	 * @param {string} district - Zoning district code (e.g., "R6", "R7-2", "R8A")
	 * @returns {Object} FAR data with value, profile, and assumptions
	 */
	getMaxFAR(district) {
		if (!district || typeof district !== "string") {
			return null;
		}

		const normalized = district.trim().toUpperCase();

		// FAR lookup per NYC Zoning Resolution § 23-21 (R1–R5) and § 23-22 (R6–R12), standard column only.
		// Format: { district: { far: number, profile: string, contextual: boolean } }
		const farLookup = {
			// R1–R5 per ZR § 23-21 (standard zoning lots)
			R1: { far: 0.75, profile: "R1", contextual: false },
			R1A: { far: 0.75, profile: "R1A", contextual: false },
			R1B: { far: 0.75, profile: "R1B", contextual: false },
			"R1-1": { far: 0.75, profile: "R1-1", contextual: false },
			"R1-2": { far: 0.75, profile: "R1-2", contextual: false },
			"R1-2A": { far: 0.75, profile: "R1-2A", contextual: false },
			R2: { far: 1.0, profile: "R2", contextual: false },
			R2A: { far: 1.0, profile: "R2A", contextual: false },
			R2B: { far: 1.0, profile: "R2B", contextual: false },
			R2X: { far: 1.0, profile: "R2X", contextual: false },
			R3: { far: 1.0, profile: "R3", contextual: false },
			R3A: { far: 1.0, profile: "R3A", contextual: false },
			R3B: { far: 1.0, profile: "R3B", contextual: false },
			R3X: { far: 1.0, profile: "R3X", contextual: false },
			"R3-1": { far: 1.0, profile: "R3-1", contextual: false },
			"R3-2": { far: 1.0, profile: "R3-2", contextual: false },
			R4: { far: 1.5, profile: "R4", contextual: false },
			R4A: { far: 1.5, profile: "R4A", contextual: false },
			R4B: { far: 1.5, profile: "R4B", contextual: false },
			R4X: { far: 1.5, profile: "R4X", contextual: false },
			"R4-1": { far: 1.5, profile: "R4-1", contextual: false },
			R5: { far: 2.0, profile: "R5", contextual: false },
			R5A: { far: 2.0, profile: "R5A", contextual: false },
			R5B: { far: 2.0, profile: "R5B", contextual: false },
			R5D: { far: 2.0, profile: "R5D", contextual: false },
			R5X: { far: 2.0, profile: "R5X", contextual: false },

			// R6–R12 per ZR § 23-22 (standard residences; narrow street where applicable)
			R6: { far: 2.2, profile: "R6", contextual: false },
			R6A: { far: 3.0, profile: "R6A", contextual: true },
			R61: { far: 3.0, profile: "R61", contextual: true },
			"R6-1": { far: 3.0, profile: "R6-1", contextual: true },
			R7B: { far: 3.0, profile: "R7B", contextual: true },
			R6B: { far: 2.0, profile: "R6B", contextual: true },
			R6D: { far: 2.5, profile: "R6D", contextual: false },
			"R6-2": { far: 2.5, profile: "R6-2", contextual: false },
			R6X: { far: 2.2, profile: "R6X", contextual: false },
			R7: { far: 3.44, profile: "R7", contextual: false },
			"R7-1": { far: 3.44, profile: "R7-1", contextual: false },
			"R7-2": { far: 3.44, profile: "R7-2", contextual: false },
			R7A: { far: 4.0, profile: "R7A", contextual: true },
			"R7-11": { far: 4.0, profile: "R7-11", contextual: true },
			"R7-21": { far: 4.0, profile: "R7-21", contextual: true },
			R7D: { far: 4.66, profile: "R7D", contextual: false },
			R7X: { far: 5.0, profile: "R7X", contextual: false },
			"R7-3": { far: 5.0, profile: "R7-3", contextual: false },
			R8: { far: 6.02, profile: "R8", contextual: false },
			R8A: { far: 6.02, profile: "R8A", contextual: true },
			R8X: { far: 6.02, profile: "R8X", contextual: false },
			R8B: { far: 4.0, profile: "R8B", contextual: true },
			R9: { far: 7.52, profile: "R9", contextual: false },
			R9A: { far: 7.52, profile: "R9A", contextual: true },
			R9D: { far: 9.0, profile: "R9D", contextual: false },
			R9X: { far: 9.0, profile: "R9X", contextual: false },
			"R9-1": { far: 9.0, profile: "R9-1", contextual: false },
			R10: { far: 10.0, profile: "R10", contextual: false },
			R10A: { far: 10.0, profile: "R10A", contextual: true },
			R10X: { far: 10.0, profile: "R10X", contextual: false },
			R11: { far: 12.0, profile: "R11", contextual: false },
			R11A: { far: 12.0, profile: "R11A", contextual: true },
			R11X: { far: 12.0, profile: "R11X", contextual: false },
			R12: { far: 15.0, profile: "R12", contextual: false },
			R12A: { far: 15.0, profile: "R12A", contextual: true },
			R12X: { far: 15.0, profile: "R12X", contextual: false },
		};

		// Check exact match first
		if (farLookup[normalized]) {
			return {
				far: farLookup[normalized].far,
				profile: farLookup[normalized].profile,
				contextual: farLookup[normalized].contextual,
			};
		}

		// Fallback: match base district (e.g. unknown suffix) so we don't return null for minor variants
		const baseMatch = normalized.match(/^(R\d+)[-A-ZX]*/);
		if (baseMatch && farLookup[baseMatch[1]]) {
			const base = farLookup[baseMatch[1]];
			return {
				far: base.far,
				profile: base.profile,
				contextual: base.contextual,
				assumption: `District ${normalized} not in lookup; using base ${baseMatch[1]} FAR (ZR § 23-21 / 23-22).`,
			};
		}

		return null; // Not supported
	}

	/**
	 * Normalize district to a profile string for consistency comparison (e.g. "R7-2" -> "R7", "R6B" -> "R6B").
	 * Reuses same logic as getMaxFAR profile resolution. Used by assemblage zoning consistency.
	 * @param {string} district - Zoning district code (e.g. "R6B", "R7-2")
	 * @returns {string|null} Normalized profile or null if not supported
	 */
	getNormalizedDistrictProfile(district) {
		const result = this.getMaxFAR(district);
		return result ? result.profile : null;
	}

	/**
	 * Compute controlling FAR when a lot has multiple zoning districts (zonedist1-4).
	 * Uses LOWEST FAR as controlling; flags multi-district for manual review.
	 * @param {Object} zolaData - Zola/MapPLUTO-like data with zonedist1, zonedist2, zonedist3, zonedist4
	 * @returns {Object} { zoningDistrictCandidates, farCandidates, maxFar, farMethod, requires_manual_review, assumptions }
	 */
	computeControllingFARFromZola(zolaData) {
		const raw = [
			zolaData?.zonedist1,
			zolaData?.zonedist2,
			zolaData?.zonedist3,
			zolaData?.zonedist4,
		]
			.filter((v) => v != null && typeof v === "string" && v.trim().length > 0)
			.map((v) => v.trim());
		const zoningDistrictCandidates = [...new Set(raw)];

		const farCandidates = [];
		const assumptions = [];

		for (const district of zoningDistrictCandidates) {
			const farResult = this.getMaxFAR(district);
			if (farResult && farResult.far != null) {
				farCandidates.push({
					district,
					profile: farResult.profile || district,
					maxFar: farResult.far,
				});
				if (farResult.assumption) {
					assumptions.push(farResult.assumption);
				}
			} else {
				assumptions.push(
					`District "${district}" could not be resolved to a FAR; excluded from comparison.`
				);
			}
		}

		let maxFar = null;
		let farMethod = "unknown";
		let requires_manual_review = true;

		if (farCandidates.length === 0) {
			farMethod = "unknown";
			requires_manual_review = true;
		} else if (farCandidates.length === 1) {
			maxFar = farCandidates[0].maxFar;
			farMethod = "single_district";
			requires_manual_review = false;
		} else {
			const fars = farCandidates.map((c) => c.maxFar).filter((n) => n != null);
			maxFar = fars.length > 0 ? Math.min(...fars) : null;
			farMethod = "multi_district_conservative";
			requires_manual_review = true;
			assumptions.push(
				"Multiple zoning districts mapped to this lot. FAR calculated conservatively using the lowest applicable FAR. Manual zoning review recommended."
			);
		}

		return {
			zoningDistrictCandidates,
			farCandidates,
			maxFar,
			farMethod,
			requires_manual_review,
			assumptions,
		};
	}

	/**
	 * Determine lot type (corner vs interior/through)
	 * Uses corner_code from Geoservice ContentJson: if empty → interior (confident); otherwise → corner.
	 * @param {Object} zolaData - Zola source data (unused; kept for signature)
	 * @param {string|null|undefined} cornerCode - From geoservice ContentJson (e.g. "SE" = corner on that facing)
	 * @returns {Object} Lot type with flag and assumption
	 */
	determineLotType(zolaData, cornerCode) {
		const hasCornerCode =
			cornerCode != null &&
			typeof cornerCode === "string" &&
			cornerCode.trim().length > 0;
		if (hasCornerCode) {
			return {
				lotType: "corner",
				assumption: null,
			};
		}
		// Empty or absent corner_code → confident interior/through
		return {
			lotType: "interior_or_through",
			assumption: null,
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

		// Remaining buildable floor area (FAR-based; independent of lot coverage)
		if (
			derived.maxBuildableFloorAreaSqft !== undefined &&
			bldgarea !== null &&
			bldgarea !== undefined
		) {
			const remaining = derived.maxBuildableFloorAreaSqft - bldgarea;
			derived.remainingBuildableFloorAreaSqft = Math.max(0, remaining);
			if (derived.remainingBuildableFloorAreaSqft === 0) {
				derived.remainingFloorAreaMessage = "FAR limit reached (existing floor area meets or exceeds max permitted); lot coverage limits footprint separately";
			}
		}

		// Max building footprint
		if (maxLotCoverage !== null && lotArea !== null && lotArea > 0) {
			derived.maxBuildingFootprintSqft = maxLotCoverage * lotArea;
		}

		return derived;
	}

	/**
	 * Round dwelling units per ZR §23-52: fractions >= 0.75 round up, else round down.
	 * Reused by single-lot and assemblage density calculations.
	 * @param {number} floorAreaSqft - Residential floor area (sq ft)
	 * @param {number} duf - DUF value (default 680)
	 * @returns {{ units_raw: number, units_rounded: number }} Raw and rounded unit count
	 */
	roundDwellingUnitsByZR(floorAreaSqft, duf = 680) {
		if (floorAreaSqft == null || floorAreaSqft <= 0 || !duf) {
			return { units_raw: 0, units_rounded: 0 };
		}
		const ROUNDING_THRESHOLD = 0.75;
		const unitsRaw = floorAreaSqft / duf;
		const fractionalPart = unitsRaw - Math.floor(unitsRaw);
		const unitsRounded =
			fractionalPart >= ROUNDING_THRESHOLD
				? Math.ceil(unitsRaw)
				: Math.floor(unitsRaw);
		return { units_raw: unitsRaw, units_rounded: Math.max(0, unitsRounded) };
	}

	/**
	 * Calculate density requirements (DUF-based max dwelling units)
	 * @param {string} buildingType - Building type ("multiple_dwelling" or "single_or_two_family")
	 * @param {number} unitsres - Number of residential units (optional, for fallback check)
	 * @param {number} maxBuildableFloorAreaSqft - Maximum residential floor area permitted
	 * @param {boolean} hasOverlay - Whether overlays are present
	 * @param {boolean} hasSpecialDistrict - Whether special districts are present
	 * @returns {Object} Density requirements with toggle candidates
	 */
	calculateDensityRequirements(
		buildingType,
		unitsres,
		maxBuildableFloorAreaSqft,
		hasOverlay,
		hasSpecialDistrict
	) {
		const DEFAULT_DUF = 680;
		const ROUNDING_THRESHOLD = 0.75;

		// Determine if multiple dwelling
		const isMultipleDwelling =
			buildingType === "multiple_dwelling" ||
			(unitsres !== null && unitsres !== undefined && unitsres > 2);

		// If not multiple dwelling, return not applicable
		if (!isMultipleDwelling) {
			return {
				kind: "toggle",
				candidates: [
					{
						id: "duf_applies",
						label: "Standard (DUF applies)",
						duf_applicable: false,
						duf_value: DEFAULT_DUF,
						max_dwelling_units: null,
						max_res_floor_area_sqft: null,
						rounding_rule: "Fractions >= 0.75 round up; otherwise round down",
						source_url: "https://zr.planning.nyc.gov/article-ii/chapter-3#23-52",
						source_section: "ZR §23-52",
						notes: "DUF not applicable to single- or two-family residences",
						requires_manual_review: false,
					},
					{
						id: "duf_not_applicable",
						label: "Affordable/Senior/Conversion (DUF not applicable)",
						duf_applicable: false,
						duf_value: null,
						max_dwelling_units: null,
						notes: "No DUF-based unit cap; unit count governed by other constraints.",
						source_url: "https://zr.planning.nyc.gov/article-ii/chapter-3#23-52",
						source_section: "ZR §23-52",
						requires_manual_review: false,
					},
				],
			};
		}

		// If multiple dwelling but missing required inputs
		if (
			maxBuildableFloorAreaSqft === null ||
			maxBuildableFloorAreaSqft === undefined
		) {
			return {
				kind: "toggle",
				candidates: [
					{
						id: "duf_applies",
						label: "Standard (DUF applies)",
						duf_applicable: true,
						duf_value: DEFAULT_DUF,
						max_dwelling_units: null,
						max_res_floor_area_sqft: null,
						rounding_rule: "Fractions >= 0.75 round up; otherwise round down",
						source_url: "https://zr.planning.nyc.gov/article-ii/chapter-3#23-52",
						source_section: "ZR §23-52",
						notes: "Missing required inputs (max FAR or lot area) for DUF calculation",
						requires_manual_review: true,
					},
					{
						id: "duf_not_applicable",
						label: "Affordable/Senior/Conversion (DUF not applicable)",
						duf_applicable: false,
						duf_value: null,
						max_dwelling_units: null,
						notes: "No DUF-based unit cap; unit count governed by other constraints.",
						source_url: "https://zr.planning.nyc.gov/article-ii/chapter-3#23-52",
						source_section: "ZR §23-52",
						requires_manual_review: true,
					},
				],
			};
		}

		// Calculate max units: maxBuildableFloorAreaSqft / DUF
		const maxUnitsRaw = maxBuildableFloorAreaSqft / DEFAULT_DUF;
		const fractionalPart = maxUnitsRaw - Math.floor(maxUnitsRaw);
		const maxUnits =
			fractionalPart >= ROUNDING_THRESHOLD
				? Math.ceil(maxUnitsRaw)
				: Math.floor(maxUnitsRaw);

		// Determine if manual review needed
		const requiresManualReview = hasOverlay || hasSpecialDistrict;

		return {
			kind: "toggle",
			candidates: [
				{
					id: "duf_applies",
					label: "Standard (DUF applies)",
					duf_applicable: true,
					duf_value: DEFAULT_DUF,
					max_dwelling_units: maxUnits,
					max_res_floor_area_sqft: maxBuildableFloorAreaSqft,
					rounding_rule: "Fractions >= 0.75 round up; otherwise round down",
					source_url: "https://zr.planning.nyc.gov/article-ii/chapter-3#23-52",
					source_section: "ZR §23-52",
					notes: null,
					requires_manual_review: requiresManualReview,
				},
				{
					id: "duf_not_applicable",
					label: "Affordable/Senior/Conversion (DUF not applicable)",
					duf_applicable: false,
					duf_value: null,
					max_dwelling_units: null,
					notes: "No DUF-based unit cap; unit count governed by other constraints.",
					source_url: "https://zr.planning.nyc.gov/article-ii/chapter-3#23-52",
					source_section: "ZR §23-52",
					requires_manual_review: true,
				},
			],
		};
	}

	/**
	 * Get parking regime lookup table for 25-21 (Inner Transit Zone, existing)
	 * @param {string} district - Zoning district code
	 * @returns {Object|null} Parking regime data or null if not found
	 */
	getParkingRegime25_21(district) {
		const normalized = district.trim().toUpperCase();
		const baseMatch = normalized.match(/^(R\d+)/);
		if (!baseMatch) return null;

		const baseDistrict = baseMatch[1];

		// Regime 25-21 lookup table
		const lookup = {
			R1: { standard: 100, senior_affordable: 0, waiver_max: 0 },
			R2: { standard: 100, senior_affordable: 0, waiver_max: 0 },
			R3: { standard: 100, senior_affordable: 0, waiver_max: 0 },
			R4: { standard: 100, senior_affordable: 0, waiver_max: 1 },
			R5: { standard: 85, senior_affordable: 0, waiver_max: 1 },
			R6: { standard: 50, senior_affordable: 0, waiver_max: 5 },
			R7: { standard: 50, senior_affordable: 0, waiver_max: 25 },
			R8: { standard: 40, senior_affordable: 0, waiver_max: 30 },
			R9: { standard: 40, senior_affordable: 0, waiver_max: 40 },
			R10: { standard: 40, senior_affordable: 0, waiver_max: 50 },
			R11: { standard: 40, senior_affordable: 0, waiver_max: 60 },
			R12: { standard: 40, senior_affordable: 0, waiver_max: 75 },
		};

		return lookup[baseDistrict] || null;
	}

	/**
	 * Get parking regime lookup table for 25-22 (Outer Transit Zone)
	 * @param {string} district - Zoning district code
	 * @returns {Object|null} Parking regime data or null if not found
	 */
	getParkingRegime25_22(district) {
		const normalized = district.trim().toUpperCase();

		// Regime 25-22 lookup table (district groups)
		const lookup = {
			// R1 R2
			R1: { standard: 100, combined: 0, waiver_max: 0 },
			R2: { standard: 100, combined: 0, waiver_max: 0 },
			// R3-1 R3A R3X
			"R3-1": { standard: 50, combined: 0, waiver_max: 0, note: "see source footnote marker" },
			R3A: { standard: 50, combined: 0, waiver_max: 0, note: "see source footnote marker" },
			R3X: { standard: 50, combined: 0, waiver_max: 0, note: "see source footnote marker" },
			// R3-2 R4
			"R3-2": { standard: 35, combined: 0, waiver_max: 5 },
			R4: { standard: 35, combined: 0, waiver_max: 5 },
			// R5
			R5: { standard: 35, combined: 0, waiver_max: 10 },
			// R5B R5D
			R5B: { standard: 25, combined: 0, waiver_max: 10 },
			R5D: { standard: 25, combined: 0, waiver_max: 10 },
			// R6 R7-1 R7-2
			R6: { standard: 25, combined: 0, waiver_max: 15 },
			"R7-1": { standard: 25, combined: 0, waiver_max: 15 },
			"R7-2": { standard: 25, combined: 0, waiver_max: 15 },
			// R7A R7B
			R7A: { standard: 15, combined: 0, waiver_max: 15 },
			R7B: { standard: 15, combined: 0, waiver_max: 15 },
			// R7-3 R7D R7X
			"R7-3": { standard: 15, combined: 0, waiver_max: 25 },
			R7D: { standard: 15, combined: 0, waiver_max: 25 },
			R7X: { standard: 15, combined: 0, waiver_max: 25 },
			// R8
			R8: { standard: 12, combined: 0, waiver_max: 30 },
			// R9
			R9: { standard: 12, combined: 0, waiver_max: 40 },
			// R10
			R10: { standard: 12, combined: 0, waiver_max: 50 },
			// R11
			R11: { standard: 12, combined: 0, waiver_max: 60 },
			// R12
			R12: { standard: 12, combined: 0, waiver_max: 75 },
		};

		// Check exact match first
		if (lookup[normalized]) {
			return lookup[normalized];
		}

		// Try base district match for variants
		const baseMatch = normalized.match(/^(R\d+)/);
		if (baseMatch) {
			const baseDistrict = baseMatch[1];
			if (lookup[baseDistrict]) {
				return lookup[baseDistrict];
			}
		}

		return null;
	}

	/**
	 * Get parking regime lookup table for 25-23 (Beyond Greater Transit Zone)
	 * @param {string} district - Zoning district code
	 * @returns {Object|null} Parking regime data or null if not found
	 */
	getParkingRegime25_23(district) {
		const normalized = district.trim().toUpperCase();

		// Regime 25-23 lookup table (with scenario columns)
		const lookup = {
			// R1 R2
			R1: {
				standard: 100,
				affordable: 50,
				senior: 10,
				adu: 0,
				waiver_max: 0,
			},
			R2: {
				standard: 100,
				affordable: 50,
				senior: 10,
				adu: 0,
				waiver_max: 0,
			},
			// R3A R3-1 R3X
			R3A: {
				standard: 100,
				affordable: 50,
				senior: 10,
				adu: 0,
				waiver_max: 0,
				note: "footnote marker exists",
			},
			"R3-1": {
				standard: 100,
				affordable: 50,
				senior: 10,
				adu: 0,
				waiver_max: 0,
				note: "footnote marker exists",
			},
			R3X: {
				standard: 100,
				affordable: 50,
				senior: 10,
				adu: 0,
				waiver_max: 0,
				note: "footnote marker exists",
			},
			// R3-2
			"R3-2": {
				standard: 50,
				affordable: 50,
				senior: 10,
				adu: 0,
				waiver_max: 1,
			},
			// R4
			R4: {
				standard: 50,
				affordable: 50,
				senior: 10,
				adu: 0,
				waiver_max: 3,
			},
			// R5 R5B R5D
			R5: {
				standard: 50,
				affordable: 25,
				senior: 10,
				adu: 0,
				waiver_max: 5,
			},
			R5B: {
				standard: 50,
				affordable: 25,
				senior: 10,
				adu: 0,
				waiver_max: 5,
			},
			R5D: {
				standard: 50,
				affordable: 25,
				senior: 10,
				adu: 0,
				waiver_max: 5,
			},
			// R6
			R6: {
				standard: 50,
				affordable: 25,
				senior: 10,
				adu: 0,
				waiver_max: 10,
			},
			// R7-1 R7B
			"R7-1": {
				standard: 50,
				affordable: 12,
				senior: 10,
				adu: 0,
				waiver_max: 10,
				footnote: 1, // Footnote 1 applies
			},
			R7B: {
				standard: 50,
				affordable: 12,
				senior: 10,
				adu: 0,
				waiver_max: 10,
				footnote: 1,
			},
			// R7A R7D R7X
			R7A: {
				standard: 50,
				affordable: 12,
				senior: 10,
				adu: 0,
				waiver_max: 15,
				footnote: 1,
			},
			R7D: {
				standard: 50,
				affordable: 12,
				senior: 10,
				adu: 0,
				waiver_max: 15,
				footnote: 1,
			},
			R7X: {
				standard: 50,
				affordable: 12,
				senior: 10,
				adu: 0,
				waiver_max: 15,
				footnote: 1,
			},
			// R7-2 R7-3
			"R7-2": {
				standard: 50,
				affordable: 12,
				senior: 10,
				adu: 0,
				waiver_max: 15,
				footnote: 2,
			},
			"R7-3": {
				standard: 50,
				affordable: 12,
				senior: 10,
				adu: 0,
				waiver_max: 15,
				footnote: 2,
			},
			// R8 R9 R10
			R8: {
				standard: 40,
				affordable: 12,
				senior: 10,
				adu: 0,
				waiver_max: 15,
				footnote: 3,
			},
			R9: {
				standard: 40,
				affordable: 12,
				senior: 10,
				adu: 0,
				waiver_max: 15,
				footnote: 3,
			},
			R10: {
				standard: 40,
				affordable: 12,
				senior: 10,
				adu: 0,
				waiver_max: 15,
				footnote: 3,
			},
			// R11 R12
			R11: {
				standard: 40,
				affordable: 12,
				senior: 10,
				adu: 0,
				waiver_max: 15,
				footnote: 3,
				requires_manual_review: true,
				note: "standard % inferred; verify against source",
			},
			R12: {
				standard: 40,
				affordable: 12,
				senior: 10,
				adu: 0,
				waiver_max: 15,
				footnote: 3,
				requires_manual_review: true,
				note: "standard % inferred; verify against source",
			},
		};

		// Check exact match first
		if (lookup[normalized]) {
			return lookup[normalized];
		}

		// Try base district match for variants
		const baseMatch = normalized.match(/^(R\d+)/);
		if (baseMatch) {
			const baseDistrict = baseMatch[1];
			if (lookup[baseDistrict]) {
				return lookup[baseDistrict];
			}
		}

		return null;
	}

	/**
	 * Apply footnote modifiers for regime 25-23
	 * @param {string} district - Zoning district code
	 * @param {number} lotArea - Lot area in square feet
	 * @param {number} standardPercent - Base standard percent from lookup
	 * @param {number} footnote - Footnote number (1, 2, or 3)
	 * @returns {number} Modified standard percent
	 */
	applyFootnoteModifier(district, lotArea, standardPercent, footnote) {
		if (!lotArea || lotArea <= 0) {
			return standardPercent; // Can't apply modifier without lot area
		}

		const normalized = district.trim().toUpperCase();

		// Footnote 1: R7-1, R7A, R7B, R7D, R7X
		// standard percent reduced to 30% where lotarea <= 10,000 sqft
		if (footnote === 1) {
			if (lotArea <= 10000) {
				return 30;
			}
			return standardPercent;
		}

		// Footnote 2: R7-2, R7-3
		// standard percent reduced to 30% where lotarea is 10,001–15,000 sqft
		// standard percent waived (0%) where lotarea <= 10,000 sqft
		if (footnote === 2) {
			if (lotArea <= 10000) {
				return 0;
			}
			if (lotArea >= 10001 && lotArea <= 15000) {
				return 30;
			}
			return standardPercent;
		}

		// Footnote 3: R8, R9, R10, R11, R12
		// standard percent reduced to 20% where lotarea is 10,001–15,000 sqft
		// standard percent waived (0%) where lotarea <= 10,000 sqft
		if (footnote === 3) {
			if (lotArea <= 10000) {
				return 0;
			}
			if (lotArea >= 10001 && lotArea <= 15000) {
				return 20;
			}
			return standardPercent;
		}

		return standardPercent;
	}

	/**
	 * Calculate parking spaces for a scenario
	 * @param {number} units - Number of dwelling units
	 * @param {number} percentPerUnit - Percent requirement per dwelling unit
	 * @param {number} waiverMaxSpaces - Maximum spaces waived
	 * @returns {Object} Computed parking spaces
	 */
	calculateParkingSpaces(units, percentPerUnit, waiverMaxSpaces) {
		if (!units || units <= 0 || !percentPerUnit) {
			return {
				units: units || 0,
				raw_spaces: 0,
				rounded_spaces: 0,
				required_spaces_after_waiver: 0,
			};
		}

		// raw_spaces = units * (percent / 100)
		const rawSpaces = units * (percentPerUnit / 100);

		// Round halves up: fraction >= 0.5 => ceil, else floor
		const fractionalPart = rawSpaces - Math.floor(rawSpaces);
		const roundedSpaces =
			fractionalPart >= 0.5 ? Math.ceil(rawSpaces) : Math.floor(rawSpaces);

		// Apply waiver: if rounded_spaces <= waiverMaxSpaces => required_spaces = 0
		// else required_spaces = rounded_spaces
		const requiredSpacesAfterWaiver =
			roundedSpaces <= waiverMaxSpaces ? 0 : roundedSpaces;

		return {
			units: units,
			raw_spaces: rawSpaces,
			rounded_spaces: roundedSpaces,
			required_spaces_after_waiver: requiredSpacesAfterWaiver,
		};
	}

	/**
	 * Calculate parking requirements
	 * @param {string} buildingType - Building type
	 * @param {number} unitsres - Number of residential units
	 * @param {string} district - Zoning district
	 * @param {number} lotArea - Lot area in square feet
	 * @param {number} lotFront - Lot frontage in feet
	 * @param {string} transitZone - Transit zone classification
	 * @param {string} borough - Borough code (MN/BK/QN/BX/SI)
	 * @param {string} communityDistrict - Community district number
	 * @returns {Object} Parking requirements result
	 */
	calculateParkingRequirements(
		buildingType,
		unitsres,
		district,
		lotArea,
		lotFront,
		transitZone,
		borough,
		communityDistrict
	) {
		// Only compute if multiple dwelling and unitsres > 2
		const isMultipleDwelling =
			buildingType === "multiple_dwelling" ||
			(unitsres !== null && unitsres !== undefined && unitsres > 2);

		if (!isMultipleDwelling) {
			return {
				kind: "not_applicable",
				transit_zone: transitZone || "unknown",
				regimes: [],
				flags: {
					requires_manual_review: false,
					transit_zone_unknown: transitZone === "unknown",
					affordability_unknown: true,
					senior_unknown: true,
					adu_unknown: true,
					conversion_unknown: true,
					unit_creation_date_unknown: true,
					special_provisions_may_apply: false,
				},
				assumptions: [
					"Parking requirements not applicable: not a multiple dwelling residence or unitsres <= 2",
				],
			};
		}

		// Determine which regimes apply based on transit zone
		const regimes = [];
		let requiresManualReview = false;
		const assumptions = [];
		const flags = {
			requires_manual_review: false,
			transit_zone_unknown: transitZone === "unknown",
			affordability_unknown: true,
			senior_unknown: true,
			adu_unknown: true,
			conversion_unknown: true,
			unit_creation_date_unknown: true,
			special_provisions_may_apply: false,
		};

		// Check for special provisions (Section 25-24)
		const boroughUpper = (borough || "").trim().toUpperCase();
		const cdNumber = communityDistrict
			? parseInt(communityDistrict.toString().replace(/\D/g, ""), 10)
			: null;

		if (
			(boroughUpper === "BX" || boroughUpper === "2") &&
			cdNumber === 12
		) {
			flags.special_provisions_may_apply = true;
			assumptions.push(
				"Section 25-24 special provision may apply for Bronx CD12; both Outer and Beyond-GTZ regimes included"
			);
		}

		if (
			(boroughUpper === "QN" || boroughUpper === "4") &&
			cdNumber &&
			[3, 4, 14].includes(cdNumber)
		) {
			flags.special_provisions_may_apply = true;
			assumptions.push(
				`Section 25-24 special provision may apply for Queens CD${cdNumber}; both Outer and Beyond-GTZ regimes included`
			);
		}

		// Determine regimes based on transit zone
		if (transitZone === "inner") {
			// Inner Transit Zone -> Regime 25-21
			const regime25_21 = this.getParkingRegime25_21(district);
			if (regime25_21) {
				regimes.push(
					this.buildRegime25_21(
						regime25_21,
						unitsres,
						district,
						lotArea,
						lotFront
					)
				);
			}
		} else if (transitZone === "outer") {
			// Outer Transit Zone -> Regime 25-22
			const regime25_22 = this.getParkingRegime25_22(district);
			if (regime25_22) {
				regimes.push(
					this.buildRegime25_22(
						regime25_22,
						unitsres,
						district,
						lotArea,
						lotFront
					)
				);
			}

			// If special provisions may apply, also include Beyond-GTZ
			if (flags.special_provisions_may_apply) {
				const regime25_23 = this.getParkingRegime25_23(district);
				if (regime25_23) {
					regimes.push(
						this.buildRegime25_23(
							regime25_23,
							unitsres,
							district,
							lotArea,
							lotFront
						)
					);
					requiresManualReview = true;
				}
			}
		} else if (transitZone === "manhattan_core_lic") {
			// Manhattan Core & LIC -> return BOTH inner and outer regimes
			const regime25_21 = this.getParkingRegime25_21(district);
			const regime25_22 = this.getParkingRegime25_22(district);

			if (regime25_21) {
				regimes.push(
					this.buildRegime25_21(
						regime25_21,
						unitsres,
						district,
						lotArea,
						lotFront
					)
				);
			}
			if (regime25_22) {
				regimes.push(
					this.buildRegime25_22(
						regime25_22,
						unitsres,
						district,
						lotArea,
						lotFront
					)
				);
			}

			requiresManualReview = true;
			assumptions.push(
				"Manhattan Core & LIC has special parking areas; confirm which section applies."
			);
		} else if (transitZone === "beyond_gtz") {
			// Beyond Greater Transit Zone -> Regime 25-23
			const regime25_23 = this.getParkingRegime25_23(district);
			if (regime25_23) {
				regimes.push(
					this.buildRegime25_23(
						regime25_23,
						unitsres,
						district,
						lotArea,
						lotFront
					)
				);
			}

			// If special provisions may apply, also include Outer
			if (flags.special_provisions_may_apply) {
				const regime25_22 = this.getParkingRegime25_22(district);
				if (regime25_22) {
					regimes.push(
						this.buildRegime25_22(
							regime25_22,
							unitsres,
							district,
							lotArea,
							lotFront
						)
					);
					requiresManualReview = true;
				}
			}
		} else {
			// Unknown transit zone -> return all 3 regimes
			const regime25_21 = this.getParkingRegime25_21(district);
			const regime25_22 = this.getParkingRegime25_22(district);
			const regime25_23 = this.getParkingRegime25_23(district);

			if (regime25_21) {
				regimes.push(
					this.buildRegime25_21(
						regime25_21,
						unitsres,
						district,
						lotArea,
						lotFront
					)
				);
			}
			if (regime25_22) {
				regimes.push(
					this.buildRegime25_22(
						regime25_22,
						unitsres,
						district,
						lotArea,
						lotFront
					)
				);
			}
			if (regime25_23) {
				regimes.push(
					this.buildRegime25_23(
						regime25_23,
						unitsres,
						district,
						lotArea,
						lotFront
					)
				);
			}

			requiresManualReview = true;
			assumptions.push(
				"Transit zone unknown; all possible regimes included for manual review."
			);
		}

		// Handle footnote 5: lot width <= 25 ft override
		if (lotFront !== null && lotFront !== undefined && lotFront <= 25) {
			// Add override note to standard scenarios
			regimes.forEach((regime) => {
				regime.scenarios.forEach((scenario) => {
					if (scenario.scenario_key === "standard") {
						scenario.notes = scenario.notes || [];
						scenario.notes.push(
							"Lot width <= 25 ft: footnote (5) may apply (no parking required if lot existed on Dec 5, 2024). Manual review required to verify lot existence date."
						);
						scenario.requires_manual_review = true;
						requiresManualReview = true;
					}
				});
			});

			assumptions.push(
				"Lot width <= 25 ft detected; footnote (5) override may apply (requires verification that lot existed on Dec 5, 2024)."
			);
		}

		// Handle R4B "waive 1 space" special case
		if (
			district &&
			district.trim().toUpperCase() === "R4B" &&
			regimes.length > 0
		) {
			regimes.forEach((regime) => {
				regime.scenarios.forEach((scenario) => {
					if (
						scenario.computed.required_spaces_after_waiver > 0
					) {
						const alternateSpaces = Math.max(
							0,
							scenario.computed.required_spaces_after_waiver - 1
						);
						scenario.notes = scenario.notes || [];
						scenario.notes.push(
							`R4B alternate: waive 1 accessory space (${alternateSpaces} spaces required). Manual review required.`
						);
						requiresManualReview = true;
					}
				});
			});
		}

		flags.requires_manual_review = requiresManualReview;

		if (regimes.length === 0) {
			return {
				kind: "unsupported",
				transit_zone: transitZone || "unknown",
				regimes: [],
				flags: flags,
				assumptions: [
					...assumptions,
					`Parking requirements not supported for district ${district || "unknown"}`,
				],
			};
		}

		return {
			kind: regimes.length === 1 ? "fixed" : "candidates",
			transit_zone: transitZone || "unknown",
			regimes: regimes,
			flags: flags,
			assumptions: assumptions,
		};
	}

	/**
	 * Build regime 25-21 output structure
	 * @param {Object} regimeData - Regime lookup data
	 * @param {number} unitsres - Number of residential units
	 * @param {string} district - Zoning district
	 * @param {number} lotArea - Lot area
	 * @param {number} lotFront - Lot frontage
	 * @returns {Object} Regime output structure
	 */
	buildRegime25_21(regimeData, unitsres, district, lotArea, lotFront) {
		const scenarios = [];

		// Standard scenario
		const standardComputed = this.calculateParkingSpaces(
			unitsres,
			regimeData.standard,
			regimeData.waiver_max
		);
		scenarios.push({
			scenario_key: "standard",
			percent_per_dwelling_unit: regimeData.standard,
			waiver_max_spaces: regimeData.waiver_max,
			computed: standardComputed,
			notes: [],
			requires_manual_review: false,
		});

		// Senior/affordable scenario (if applicable)
		if (regimeData.senior_affordable > 0) {
			const seniorComputed = this.calculateParkingSpaces(
				unitsres,
				regimeData.senior_affordable,
				regimeData.waiver_max
			);
			scenarios.push({
				scenario_key: "qualifying_senior",
				percent_per_dwelling_unit: regimeData.senior_affordable,
				waiver_max_spaces: regimeData.waiver_max,
				computed: seniorComputed,
				notes: ["Also applies to affordable income-restricted units"],
				requires_manual_review: true,
			});
		}

		return {
			regime_key: "existing_inner_transit_25_21",
			scenarios: scenarios,
			source_section: "ZR §25-21",
			source_url:
				"https://zr.planning.nyc.gov/article-ii/chapter-5/25-21",
		};
	}

	/**
	 * Build regime 25-22 output structure
	 * @param {Object} regimeData - Regime lookup data
	 * @param {number} unitsres - Number of residential units
	 * @param {string} district - Zoning district
	 * @param {number} lotArea - Lot area
	 * @param {number} lotFront - Lot frontage
	 * @returns {Object} Regime output structure
	 */
	buildRegime25_22(regimeData, unitsres, district, lotArea, lotFront) {
		const scenarios = [];

		// Standard scenario
		const standardComputed = this.calculateParkingSpaces(
			unitsres,
			regimeData.standard,
			regimeData.waiver_max
		);
		scenarios.push({
			scenario_key: "standard",
			percent_per_dwelling_unit: regimeData.standard,
			waiver_max_spaces: regimeData.waiver_max,
			computed: standardComputed,
			notes: regimeData.note ? [regimeData.note] : [],
			requires_manual_review: !!regimeData.note,
		});

		// Combined scenario (ADU/senior/affordable) - if applicable
		if (regimeData.combined > 0) {
			const combinedComputed = this.calculateParkingSpaces(
				unitsres,
				regimeData.combined,
				regimeData.waiver_max
			);
			scenarios.push({
				scenario_key: "affordable_income_restricted",
				percent_per_dwelling_unit: regimeData.combined,
				waiver_max_spaces: regimeData.waiver_max,
				computed: combinedComputed,
				notes: [
					"Also applies to qualifying senior housing and ancillary dwelling units",
				],
				requires_manual_review: true,
			});
		}

		return {
			regime_key: "outer_transit_25_22",
			scenarios: scenarios,
			source_section: "ZR §25-22",
			source_url:
				"https://zr.planning.nyc.gov/article-ii/chapter-5/25-22",
		};
	}

	/**
	 * Build regime 25-23 output structure
	 * @param {Object} regimeData - Regime lookup data
	 * @param {number} unitsres - Number of residential units
	 * @param {string} district - Zoning district
	 * @param {number} lotArea - Lot area
	 * @param {number} lotFront - Lot frontage
	 * @returns {Object} Regime output structure
	 */
	buildRegime25_23(regimeData, unitsres, district, lotArea, lotFront) {
		const scenarios = [];

		// Apply footnote modifier to standard percent if applicable
		let standardPercent = regimeData.standard;
		if (regimeData.footnote && lotArea) {
			standardPercent = this.applyFootnoteModifier(
				district,
				lotArea,
				regimeData.standard,
				regimeData.footnote
			);
		}

		// Standard scenario
		const standardComputed = this.calculateParkingSpaces(
			unitsres,
			standardPercent,
			regimeData.waiver_max
		);
		const standardNotes = [];
		if (regimeData.footnote) {
			standardNotes.push(
				`Footnote (${regimeData.footnote}) applied based on lot area`
			);
		}
		if (regimeData.note) {
			standardNotes.push(regimeData.note);
		}
		scenarios.push({
			scenario_key: "standard",
			percent_per_dwelling_unit: standardPercent,
			waiver_max_spaces: regimeData.waiver_max,
			computed: standardComputed,
			notes: standardNotes,
			requires_manual_review:
				regimeData.requires_manual_review || !!regimeData.footnote,
		});

		// Affordable income-restricted scenario
		const affordableComputed = this.calculateParkingSpaces(
			unitsres,
			regimeData.affordable,
			regimeData.waiver_max
		);
		scenarios.push({
			scenario_key: "affordable_income_restricted",
			percent_per_dwelling_unit: regimeData.affordable,
			waiver_max_spaces: regimeData.waiver_max,
			computed: affordableComputed,
			notes: [],
			requires_manual_review: true,
		});

		// Qualifying senior scenario
		const seniorComputed = this.calculateParkingSpaces(
			unitsres,
			regimeData.senior,
			regimeData.waiver_max
		);
		scenarios.push({
			scenario_key: "qualifying_senior",
			percent_per_dwelling_unit: regimeData.senior,
			waiver_max_spaces: regimeData.waiver_max,
			computed: seniorComputed,
			notes: [],
			requires_manual_review: true,
		});

		// Ancillary dwelling unit scenario (if applicable)
		if (regimeData.adu > 0) {
			const aduComputed = this.calculateParkingSpaces(
				unitsres,
				regimeData.adu,
				regimeData.waiver_max
			);
			scenarios.push({
				scenario_key: "ancillary_dwelling_unit",
				percent_per_dwelling_unit: regimeData.adu,
				waiver_max_spaces: regimeData.waiver_max,
				computed: aduComputed,
				notes: [],
				requires_manual_review: true,
			});
		}

		return {
			regime_key: "beyond_gtz_25_23",
			scenarios: scenarios,
			source_section: "ZR §25-23",
			source_url:
				"https://zr.planning.nyc.gov/article-ii/chapter-5/25-23",
		};
	}

	/**
	 * Calculate yard requirements (front, side, rear) for residential districts
	 * @param {string} district - Zoning district code
	 * @param {string} buildingType - Building type from determineBuildingType
	 * @param {number|null} lotFront - Lot frontage in feet
	 * @param {number|null} lotDepth - Lot depth in feet
	 * @returns {Object} Yard requirements with front, side, rear, and flags
	 */
	calculateYardRequirements(district, buildingType, lotFront, lotDepth) {
		if (!district || typeof district !== "string") {
			return {
				front: {
					kind: "unsupported",
					value_ft: null,
					source_url: null,
					source_section: null,
					notes: ["District not provided"],
					requires_manual_review: false,
				},
				side: {
					kind: "unsupported",
					value_ft: null,
					source_url: null,
					source_section: null,
					notes: ["District not provided"],
					requires_manual_review: false,
				},
				rear: {
					kind: "unsupported",
					value_ft: null,
					source_url: null,
					source_section: null,
					notes: ["District not provided"],
					requires_manual_review: false,
				},
				flags: {
					buildingTypeInferred: buildingType === "unknown",
					lotfrontMissing: lotFront === null || lotFront === undefined,
					lotdepthMissing: lotDepth === null || lotDepth === undefined,
					shallowLotCandidate: lotDepth !== null && lotDepth < 95,
					districtVariantUsed: false,
				},
			};
		}

		const normalized = district.trim().toUpperCase();
		
		// Check if residential district
		if (!normalized.startsWith("R")) {
			return {
				front: {
					kind: "unsupported",
					value_ft: null,
					source_url: null,
					source_section: null,
					notes: ["V1 supports residential districts only"],
					requires_manual_review: false,
				},
				side: {
					kind: "unsupported",
					value_ft: null,
					source_url: null,
					source_section: null,
					notes: ["V1 supports residential districts only"],
					requires_manual_review: false,
				},
				rear: {
					kind: "unsupported",
					value_ft: null,
					source_url: null,
					source_section: null,
					notes: ["V1 supports residential districts only"],
					requires_manual_review: false,
				},
				flags: {
					buildingTypeInferred: buildingType === "unknown",
					lotfrontMissing: lotFront === null || lotFront === undefined,
					lotdepthMissing: lotDepth === null || lotDepth === undefined,
					shallowLotCandidate: false,
					districtVariantUsed: false,
				},
			};
		}

		// Extract base district for fallback
		const baseMatch = normalized.match(/^(R\d+)/);
		const baseDistrict = baseMatch ? baseMatch[1] : null;
		let districtVariantUsed = false;

		// Calculate each yard type
		const frontYard = this.calculateFrontYard(normalized, baseDistrict);
		if (frontYard.districtVariantUsed) {
			districtVariantUsed = true;
		}

		const sideYard = this.calculateSideYard(
			normalized,
			baseDistrict,
			buildingType
		);
		if (sideYard.districtVariantUsed) {
			districtVariantUsed = true;
		}

		const rearYard = this.calculateRearYard(normalized, lotFront, lotDepth);
		if (rearYard.districtVariantUsed) {
			districtVariantUsed = true;
		}

		return {
			front: {
				kind: frontYard.kind,
				value_ft: frontYard.value_ft,
				source_url: frontYard.source_url,
				source_section: frontYard.source_section,
				notes: frontYard.notes || [],
				requires_manual_review: frontYard.requires_manual_review,
			},
			side: {
				kind: sideYard.kind,
				value_ft: sideYard.value_ft,
				source_url: sideYard.source_url,
				source_section: sideYard.source_section,
				notes: sideYard.notes || [],
				requires_manual_review: sideYard.requires_manual_review,
			},
			rear: {
				kind: rearYard.kind,
				value_ft: rearYard.value_ft,
				source_url: rearYard.source_url,
				source_section: rearYard.source_section,
				notes: rearYard.notes || [],
				requires_manual_review: rearYard.requires_manual_review,
			},
			flags: {
				buildingTypeInferred: buildingType === "unknown",
				lotfrontMissing: lotFront === null || lotFront === undefined,
				lotdepthMissing: lotDepth === null || lotDepth === undefined,
				shallowLotCandidate: lotDepth !== null && lotDepth < 95,
				districtVariantUsed: districtVariantUsed,
			},
		};
	}

	/**
	 * Calculate front yard requirements (§23-321 for R1-R5, §23-322 for R6-R12)
	 * @param {string} normalized - Normalized district code
	 * @param {string|null} baseDistrict - Base district (R1, R2, etc.)
	 * @returns {Object} Front yard data
	 */
	calculateFrontYard(normalized, baseDistrict) {
		// Check if R6-R12 (no front yard required)
		const r6r12Match = normalized.match(/^R([6-9]|1[0-2])/);
		if (r6r12Match) {
			return {
				kind: "fixed",
				value_ft: 0,
				source_url:
					"https://zr.planning.nyc.gov/article-ii/chapter-3/23-322",
				source_section: "ZR §23-322",
				notes: [],
				requires_manual_review: false,
				districtVariantUsed: false,
			};
		}

		// R1-R5: Use lookup table
		const frontYardLookup = {
			R1: 20,
			R2: 15,
			R2A: 15,
			R2X: 15,
			"R3-1": 15,
			"R3-2": 15,
			R3A: 10,
			R3X: 10,
			R4: 10,
			"R4-1": 10,
			R4A: 10,
			R4B: 5,
			R5: 10,
			R5A: 10,
			R5B: 5,
			R5D: 5,
		};

		let value_ft = null;
		let districtVariantUsed = false;

		// Try exact match first
		if (frontYardLookup[normalized] !== undefined) {
			value_ft = frontYardLookup[normalized];
		} else if (baseDistrict && frontYardLookup[baseDistrict] !== undefined) {
			// Fallback to base district
			value_ft = frontYardLookup[baseDistrict];
			districtVariantUsed = true;
		} else if (baseDistrict) {
			// Generic fallback for R1-R5 base districts
			const baseMatch = baseDistrict.match(/^(R[1-5])/);
			if (baseMatch) {
				value_ft = 20; // Conservative default per requirements
				districtVariantUsed = true;
			}
		}

		if (value_ft === null) {
			return {
				kind: "unsupported",
				value_ft: null,
				source_url: null,
				source_section: null,
				notes: [`District ${normalized} not found in front yard lookup`],
				requires_manual_review: false,
				districtVariantUsed: false,
			};
		}

		// Add possible exceptions notes
		const notes = [
			"Qualifying residential site with lot width >=150 ft may reduce by 5 ft (min 5 ft)",
			"Corner lot may reduce one front yard by 5 ft (min 5 ft)",
			"May match shallowest adjacent front yard (min 5 ft)",
		];

		// Special line-up rule for R4B/R5B
		if (normalized === "R4B" || normalized === "R5B") {
			notes.push(
				"Special line-up rule: no deeper than deepest adjacent, no shallower than shallowest; need not exceed 15 ft; does not apply if no prevailing street wall frontage"
			);
		}

		notes.push(
			"Facade articulation encroachments up to 50% width, max 3 ft"
		);

		return {
			kind: "fixed",
			value_ft: value_ft,
			source_url:
				"https://zr.planning.nyc.gov/article-ii/chapter-3/23-321",
			source_section: "ZR §23-321",
			notes: notes,
			requires_manual_review: true, // Always true for R1-R5 per requirements
			districtVariantUsed: districtVariantUsed,
		};
	}

	/**
	 * Calculate side yard requirements (§23-332 for R1-R5, §23-335 for R6-R12)
	 * @param {string} normalized - Normalized district code
	 * @param {string|null} baseDistrict - Base district
	 * @param {string} buildingType - Building type
	 * @returns {Object} Side yard data
	 */
	calculateSideYard(normalized, baseDistrict, buildingType) {
		const isR1R5 = normalized.match(/^R[1-5]/);
		const isR6R12 = normalized.match(/^R([6-9]|1[0-2])/);

		if (!isR1R5 && !isR6R12) {
			return {
				kind: "unsupported",
				value_ft: null,
				source_url: null,
				source_section: null,
				notes: [`District ${normalized} not supported for side yard lookup`],
				requires_manual_review: false,
				districtVariantUsed: false,
			};
		}

		const isSingleOrTwoFamily =
			buildingType === "single_or_two_family";
		const isMultipleDwelling = buildingType === "multiple_dwelling";

		// R1-R5: §23-332
		if (isR1R5) {
			if (isSingleOrTwoFamily) {
				// Default assume detached
				let value_ft = 5; // R2-R5 default
				if (normalized === "R1" || (baseDistrict && baseDistrict === "R1")) {
					value_ft = 8; // R1: two side yards, each 8 ft
				}

				const notes = [
					"Default assumes detached building with two side yards",
					"If semi-detached/zero-lot-line (R3-R5), only one 5 ft side yard applies",
					"8 ft total open area condition may apply when adjacent lot has 1-2 family",
				];

				return {
					kind: "fixed",
					value_ft: value_ft,
					source_url:
						"https://zr.planning.nyc.gov/article-ii/chapter-3/23-332",
					source_section: "ZR §23-332",
					notes: notes,
					requires_manual_review: true,
					districtVariantUsed: false,
				};
			} else {
				// Multiple dwelling or unknown
				// Check if §23-332(c) applies (R3-2, R4, R4B, R5, R5B, R5D)
				const section332cDistricts = [
					"R3-2",
					"R4",
					"R4B",
					"R5",
					"R5B",
					"R5D",
				];
				const baseMatch = normalized.match(/^(R[3-5])/);
				const is332cDistrict =
					section332cDistricts.includes(normalized) ||
					(baseMatch &&
						["R3-2", "R4", "R4B", "R5", "R5B", "R5D"].some((d) =>
							d.startsWith(baseMatch[1])
						));

				let value_ft = 0;
				if (is332cDistrict) {
					value_ft = 0; // No required side yards per §23-332(c)
				} else {
					value_ft = 5; // Conservative default
				}

				const notes = [
					"If any open area provided along side lot line, min width is 5 ft",
					"8 ft total open area condition may apply when adjacent lot has 1-2 family",
				];

				return {
					kind: "fixed",
					value_ft: value_ft,
					source_url:
						"https://zr.planning.nyc.gov/article-ii/chapter-3/23-332",
					source_section: "ZR §23-332",
					notes: notes,
					requires_manual_review: true,
					districtVariantUsed: false,
				};
			}
		}

		// R6-R12: §23-335
		if (isR6R12) {
			let value_ft = 0;
			if (isSingleOrTwoFamily) {
				// Assume detached → two side yards, each 5 ft
				value_ft = 5;
			} else {
				// Multiple dwelling / unknown: no required side yards
				value_ft = 0;
			}

			const notes = [
				"If open area along side lot line is provided at any level, min width is 5 ft",
				"Permitted obstructions in side yards are described in ZR §23-331 and §§23-311/23-312",
			];

			return {
				kind: "fixed",
				value_ft: value_ft,
				source_url:
					"https://zr.planning.nyc.gov/article-ii/chapter-3/23-335",
				source_section: "ZR §23-335",
				notes: notes,
				requires_manual_review: true, // Safe default per requirements
				districtVariantUsed: false,
			};
		}

		// Should not reach here
		return {
			kind: "unsupported",
			value_ft: null,
			source_url: null,
			source_section: null,
			notes: [`District ${normalized} not supported`],
			requires_manual_review: false,
			districtVariantUsed: false,
		};
	}

	/**
	 * Calculate rear yard requirements (§23-342)
	 * @param {string} normalized - Normalized district code
	 * @param {number|null} lotFront - Lot frontage in feet
	 * @param {number|null} lotDepth - Lot depth in feet
	 * @returns {Object} Rear yard data
	 */
	calculateRearYard(normalized, lotFront, lotDepth) {
		// Default: 20 ft for standard lots at/below 75 ft
		const value_ft = 20;

		const notes = [
			"For detached and zero-lot-line: >=20 ft at/below 75 ft; 30 ft above 75 ft",
		];

		// Add lot width conditional notes
		if (lotFront !== null && lotFront !== undefined) {
			if (lotFront < 40) {
				notes.push(
					"For semi-detached/attached: if lot width < 40 ft → 30 ft"
				);
			} else {
				notes.push(
					"For semi-detached/attached: if lot width >=40 ft → 20 ft at/below 75 ft; 30 ft above 75 ft"
				);
			}
			notes.push(`Observed lot frontage: ${lotFront} ft`);
		} else {
			notes.push("Lot frontage not available; conditional rules may apply");
		}

		// Shallow lot condition
		if (lotDepth !== null && lotDepth !== undefined && lotDepth < 95) {
			notes.push(
				`Shallow lot condition: lot depth is ${lotDepth} ft (< 95 ft). Rear yard may be reduced by 0.5 ft per 1 ft under 95 (min 10 ft) only if shallow condition existed on Dec 15, 1961 and did not change`
			);
		}

		return {
			kind: "fixed",
			value_ft: value_ft,
			source_url:
				"https://zr.planning.nyc.gov/article-ii/chapter-3/23-342",
			source_section: "ZR §23-342",
			notes: notes,
			requires_manual_review: true, // Always true per requirements
			districtVariantUsed: false,
		};
	}

	/**
	 * Fetch data from stored Zola source and compute zoning constraints
	 * @param {Object} addressData - Address information
	 * @param {string} reportId - Report ID
	 * @returns {Promise<Object>} Zoning resolution result
	 */
	async fetchData(addressData, reportId) {
		try {
			// Get all report sources to find Zola, transit_zones, and geoservice data
			const sources = await getReportSources(reportId);
			const zolaSource = sources.find((s) => s.SourceKey === "zola");
			const transitZonesSource = sources.find(
				(s) => s.SourceKey === "transit_zones"
			);
			const geoserviceSource = sources.find(
				(s) => s.SourceKey === "geoservice"
			);

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

			// Extract required fields from Zola
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
			const unitsres = zolaData.unitsres || null;
			const borough = zolaData.borough || null;

			// Extract transit zone from transit_zones source
			let transitZone = "unknown";
			if (
				transitZonesSource &&
				transitZonesSource.ContentJson &&
				transitZonesSource.Status === "succeeded"
			) {
				const transitZonesData =
					transitZonesSource.ContentJson.transitZone ||
					transitZonesSource.ContentJson.contentJson?.transitZone;
				if (transitZonesData) {
					transitZone = transitZonesData;
				}
			}

			// Extract community district and corner_code from geoservice
			let communityDistrict = null;
			let cornerCode = null;
			if (geoserviceSource && geoserviceSource.ContentJson) {
				const geoserviceData = geoserviceSource.ContentJson;
				communityDistrict =
					geoserviceData.extracted?.communityDistrict ||
					geoserviceData.communityDistrict ||
					null;
				cornerCode =
					geoserviceData.corner_code ??
					geoserviceData.extracted?.corner_code ??
					null;
			}
			// Fallback to Zola CD field
			if (!communityDistrict && zolaData.cd) {
				communityDistrict = zolaData.cd.toString();
			}

			// Check if residential district
			if (!district) {
				console.error(
					"ZoningResolutionAgent - District is null or undefined"
				);
				// Calculate density and parking even without district (will be not applicable)
				const buildingTypeResult = this.determineBuildingType(bldgclass);
				const densityRequirements = this.calculateDensityRequirements(
					buildingTypeResult.buildingType,
					unitsres,
					null, // No maxBuildableFloorAreaSqft without district/FAR
					!!(overlay1 || overlay2),
					!!(spdist1 || spdist2 || spdist3)
				);
				const parkingRequirements = this.calculateParkingRequirements(
					buildingTypeResult.buildingType,
					unitsres,
					null,
					lotArea,
					lotFront,
					transitZone,
					borough,
					communityDistrict
				);
				const yardRequirements = this.calculateYardRequirements(
					null,
					buildingTypeResult.buildingType,
					lotFront,
					lotDepth
				);
				return {
					contentJson: {
						district: null,
						maxFar: null,
						maxLotCoverage: null,
						density: densityRequirements,
						parking: parkingRequirements,
						yards: yardRequirements,
						assumptions: [
							"District not found in Zola data. Zonedist1 field is missing or null.",
							...(parkingRequirements.assumptions || []),
							"Yard requirements are best-effort defaults; multiple modifications may apply; see notes and citations.",
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
							densityComputed: false,
							densityMultipleDwelling:
								buildingTypeResult.buildingType === "multiple_dwelling" ||
								(unitsres !== null && unitsres !== undefined && unitsres > 2),
							densityMissingInputs: true,
						},
					},
					sourceUrl: null,
				};
			}

			const districtUpper = district.toString().trim().toUpperCase();
			if (!districtUpper.startsWith("R")) {
				// Calculate density and parking even for non-residential (will be not applicable)
				const buildingTypeResult = this.determineBuildingType(bldgclass);
				const densityRequirements = this.calculateDensityRequirements(
					buildingTypeResult.buildingType,
					unitsres,
					null, // No maxBuildableFloorAreaSqft without residential district
					!!(overlay1 || overlay2),
					!!(spdist1 || spdist2 || spdist3)
				);
				const parkingRequirements = this.calculateParkingRequirements(
					buildingTypeResult.buildingType,
					unitsres,
					districtUpper,
					lotArea,
					lotFront,
					transitZone,
					borough,
					communityDistrict
				);
				const yardRequirements = this.calculateYardRequirements(
					districtUpper,
					buildingTypeResult.buildingType,
					lotFront,
					lotDepth
				);
				return {
					contentJson: {
						district: district,
						maxFar: null,
						maxLotCoverage: null,
						density: densityRequirements,
						parking: parkingRequirements,
						yards: yardRequirements,
						assumptions: [
							`District ${
								district || "unknown"
							} is not residential; V1 supports R* districts only`,
							...(parkingRequirements.assumptions || []),
							"Yard requirements are best-effort defaults; multiple modifications may apply; see notes and citations.",
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
							densityComputed: false,
							densityMultipleDwelling:
								buildingTypeResult.buildingType === "multiple_dwelling" ||
								(unitsres !== null && unitsres !== undefined && unitsres > 2),
							densityMissingInputs: true,
						},
					},
					sourceUrl: null,
				};
			}

			// Determine lot type (corner_code from Geoservice: empty → interior, otherwise → corner) and building type
			const lotTypeResult = this.determineLotType(zolaData, cornerCode);
			const buildingTypeResult = this.determineBuildingType(bldgclass);

			// Get controlling FAR (supports multiple zoning districts: use lowest FAR, flag for review)
			const farControl = this.computeControllingFARFromZola(zolaData);
			const maxFAR = farControl.maxFar;
			// Backward compat: farResult-like for profile/assumption when single district
			const farResult =
				farControl.farCandidates.length === 1
					? {
							far: farControl.farCandidates[0].maxFar,
							profile: farControl.farCandidates[0].profile,
							assumption: farControl.assumptions[0] || null,
						}
					: farControl.farCandidates.length > 1
						? {
								far: maxFAR,
								profile: null,
								assumption: farControl.assumptions.find((a) =>
									a.includes("Multiple zoning districts")
								) || null,
							}
						: null;

			console.log("ZoningResolutionAgent - FAR calculation:", {
				district: districtUpper,
				zoningDistrictCandidates: farControl.zoningDistrictCandidates,
				farMethod: farControl.farMethod,
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

			// Calculate density requirements (DUF-based)
			const densityRequirements = this.calculateDensityRequirements(
				buildingTypeResult.buildingType,
				unitsres,
				derived.maxBuildableFloorAreaSqft,
				!!(overlay1 || overlay2),
				!!(spdist1 || spdist2 || spdist3)
			);

			// Calculate parking requirements
			const parkingRequirements = this.calculateParkingRequirements(
				buildingTypeResult.buildingType,
				unitsres,
				districtUpper,
				lotArea,
				lotFront,
				transitZone,
				borough,
				communityDistrict
			);

			console.log("ZoningResolutionAgent - Height calculations:", {
				district: districtUpper,
				minBaseHeight: minBaseHeight,
				heightEnvelope: heightEnvelope,
			});

			// Build assumptions array
			const assumptions = [...(farControl.assumptions || [])];
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
			// Add density assumptions
			if (densityRequirements && densityRequirements.candidates) {
				const dufAppliesCandidate = densityRequirements.candidates.find(
					(c) => c.id === "duf_applies"
				);
				if (
					dufAppliesCandidate &&
					dufAppliesCandidate.duf_applicable &&
					dufAppliesCandidate.max_dwelling_units !== null
				) {
					assumptions.push(
						"Density requirements computed using DUF=680 scenario; alternate scenario provided for DUF-not-applicable cases."
					);
				} else if (
					dufAppliesCandidate &&
					dufAppliesCandidate.notes &&
					dufAppliesCandidate.notes.includes("Missing required inputs")
				) {
					assumptions.push(
						"Density requirements cannot be computed due to missing inputs (max FAR or lot area)."
					);
				} else if (
					dufAppliesCandidate &&
					dufAppliesCandidate.notes &&
					dufAppliesCandidate.notes.includes("not applicable to single")
				) {
					assumptions.push(
						"Density requirements (DUF) not applicable to single- or two-family residences."
					);
				}
			}

			// Build flags (lotTypeInferred = true only when we had no Geoservice corner_code data)
			const hadGeoserviceForLotType = !!(geoserviceSource && geoserviceSource.ContentJson);
			const flags = {
				hasOverlay: !!(overlay1 || overlay2),
				hasSpecialDistrict: !!(spdist1 || spdist2 || spdist3),
				multiDistrictLot: !!(
					zolaData.zonedist2 ||
					zolaData.zonedist3 ||
					zolaData.zonedist4
				),
				farRequiresManualReview: farControl.requires_manual_review,
				lotTypeInferred: !hadGeoserviceForLotType,
				buildingTypeInferred: !!buildingTypeResult.assumption,
				eligibleSiteNotEvaluated:
					lotCoverageResult.eligibleSiteNotEvaluated || false,
				specialLotCoverageRulesNotEvaluated: true, // V1: Section 23-363 not implemented
			};

			// Add density flags (append-only)
			if (densityRequirements && densityRequirements.candidates) {
				const dufAppliesCandidate = densityRequirements.candidates.find(
					(c) => c.id === "duf_applies"
				);
				flags.densityComputed =
					dufAppliesCandidate?.duf_applicable &&
					dufAppliesCandidate?.max_dwelling_units !== null;
				flags.densityMultipleDwelling =
					buildingTypeResult.buildingType === "multiple_dwelling" ||
					(unitsres !== null && unitsres !== undefined && unitsres > 2);
				flags.densityMissingInputs =
					dufAppliesCandidate?.notes?.includes("Missing required inputs") ||
					false;
			}

			// Add parking assumptions to assumptions array
			if (
				parkingRequirements &&
				parkingRequirements.assumptions &&
				parkingRequirements.assumptions.length > 0
			) {
				assumptions.push(...parkingRequirements.assumptions);
			}

			// Calculate yard requirements (residential districts only)
			const yardRequirements = this.calculateYardRequirements(
				districtUpper,
				buildingTypeResult.buildingType,
				lotFront,
				lotDepth
			);

			// Add yard assumptions
			assumptions.push(
				"Yard requirements are best-effort defaults; multiple modifications may apply; see notes and citations."
			);

			// ZR § 23-233: refuse storage/disposal exempt up to 3 sq ft per dwelling unit
			const refuseExemptionMaxSqft =
				unitsres != null && unitsres > 0 ? Math.floor(unitsres) * 3 : null;

			// Build result object (do not remove or rename existing fields)
			const result = {
				district: district,
				profile: farResult ? farResult.profile : (farControl.farCandidates[0]?.profile ?? null),
				contextual: farResult ? farResult.contextual : null,
				lotType: lotTypeResult.lotType,
				buildingType: buildingTypeResult.buildingType,
				maxFar: maxFAR,
				maxLotCoverage: maxLotCoverage,
				refuseExemptionMaxSqft,
				zoningDistrictCandidates: farControl.zoningDistrictCandidates,
				farCandidates: farControl.farCandidates,
				farMethod: farControl.farMethod,
				requires_manual_review: farControl.requires_manual_review,
				derived: derived,
				height: {
					min_base_height: minBaseHeight,
					envelope: heightEnvelope,
				},
				density: densityRequirements,
				parking: parkingRequirements,
				yards: yardRequirements,
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
