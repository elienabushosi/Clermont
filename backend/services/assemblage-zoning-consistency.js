/**
 * Assemblage Zoning Consistency - evaluates whether multiple lots are compatible from a zoning standpoint.
 * Uses Zola/MapPLUTO data and existing district normalization. Does not change single-report flow.
 *
 * @param {Array<Object>} lotsZolaData - Array of per-lot Zola payloads (from report_sources SourceKey="zola" ContentJson).
 *   Each item may have: bbl, block, lot, borough, borocode, zonedist1-4, overlay1-2, spdist1-2-3, zonemap, landmark, histdist.
 * @param {function(string): string|null} normalizeDistrictProfile - Function that returns normalized profile for a district (e.g. "R7-2" -> "R7").
 * @returns {Object} Computed consistency object for SourceKey "assemblage_zoning_consistency".
 */
export function computeAssemblageZoningConsistency(lotsZolaData, normalizeDistrictProfile) {
	const BORO_CODE_TO_LETTER = {
		1: "MN",
		2: "BX",
		3: "BK",
		4: "QN",
		5: "SI",
	};

	function toBoroughLetter(boroughOrCode) {
		if (boroughOrCode == null) return null;
		const s = String(boroughOrCode).trim().toUpperCase();
		if (["MN", "BK", "BX", "QN", "SI"].includes(s)) return s;
		const code = parseInt(boroughOrCode, 10);
		if (!Number.isNaN(code) && BORO_CODE_TO_LETTER[code]) return BORO_CODE_TO_LETTER[code];
		return s || null;
	}

	function nonEmpty(val) {
		return val != null && String(val).trim() !== "";
	}

	const lots = [];
	const primaryDistricts = [];
	const normalizedProfiles = [];
	let anyBlockMissing = false;
	let hasAnyOverlay = false;
	let hasAnySpecialDistrict = false;
	let multiDistrictLotsCount = 0;

	for (const z of lotsZolaData) {
		const zonedist = [
			z?.zonedist1 != null ? String(z.zonedist1).trim() : null,
			z?.zonedist2 != null ? String(z.zonedist2).trim() : null,
			z?.zonedist3 != null ? String(z.zonedist3).trim() : null,
			z?.zonedist4 != null ? String(z.zonedist4).trim() : null,
		];
		const primaryDistrict = nonEmpty(z?.zonedist1) ? String(z.zonedist1).trim() : null;
		const normalizedProfile = primaryDistrict
			? (normalizeDistrictProfile(primaryDistrict) ?? null)
			: null;

		const overlays = [
			nonEmpty(z?.overlay1) ? String(z.overlay1).trim() : null,
			nonEmpty(z?.overlay2) ? String(z.overlay2).trim() : null,
		];
		const specialDistricts = [
			nonEmpty(z?.spdist1) ? String(z.spdist1).trim() : null,
			nonEmpty(z?.spdist2) ? String(z.spdist2).trim() : null,
			nonEmpty(z?.spdist3) ? String(z.spdist3).trim() : null,
		];

		if (overlays.some(Boolean)) hasAnyOverlay = true;
		if (specialDistricts.some(Boolean)) hasAnySpecialDistrict = true;
		if (zonedist[1] || zonedist[2] || zonedist[3]) multiDistrictLotsCount += 1;

		const block = z?.block != null ? (typeof z.block === "number" ? z.block : parseInt(z.block, 10)) : null;
		const lotNum = z?.lot != null ? (typeof z.lot === "number" ? z.lot : parseInt(z.lot, 10)) : null;
		if (block == null || Number.isNaN(block)) anyBlockMissing = true;

		primaryDistricts.push(primaryDistrict);
		normalizedProfiles.push(normalizedProfile);

		lots.push({
			bbl: z?.bbl != null ? String(z.bbl) : null,
			block: !Number.isNaN(block) ? block : null,
			lot: !Number.isNaN(lotNum) ? lotNum : null,
			borough: toBoroughLetter(z?.borough ?? z?.borocode),
			zonedist,
			primaryDistrict,
			normalizedProfile,
			overlays,
			specialDistricts,
			flags: {
				missingZonedist1: !primaryDistrict,
				hasOverlay: overlays.some(Boolean),
				hasSpecialDistrict: specialDistricts.some(Boolean),
			},
		});
	}

	// samePrimaryDistrict: every lot has non-null zonedist1 and all identical
	const samePrimaryDistrict =
		lots.length > 0 &&
		primaryDistricts.every(Boolean) &&
		primaryDistricts.every((p) => p === primaryDistricts[0]);

	// sameNormalizedProfile: every lot has non-null normalizedProfile and all identical
	const sameNormalizedProfile =
		lots.length > 0 &&
		normalizedProfiles.every(Boolean) &&
		normalizedProfiles.every((p) => p === normalizedProfiles[0]);

	// sameBlock: every lot has non-null block and all identical; false if any block missing
	const blocks = lots.map((l) => l.block).filter((b) => b != null);
	const sameBlock =
		!anyBlockMissing &&
		lots.length > 1 &&
		blocks.length === lots.length &&
		blocks.every((b) => b === blocks[0]);

	const notes = [];
	if (!samePrimaryDistrict || !sameNormalizedProfile) {
		notes.push(
			"If districts differ across lots, assemblage calculations should use per-lot method and require manual review."
		);
	}
	if (hasAnyOverlay || hasAnySpecialDistrict) {
		notes.push(
			"Overlays or Special Districts can change applicable rules; verify on NYC Zoning Map / ZR."
		);
	}
	if (anyBlockMissing) {
		notes.push("Block is missing for at least one lot; same-block check could not be confirmed.");
	}

	// Confidence + requires_manual_review
	let confidence = "high";
	let requires_manual_review = false;

	if (primaryDistricts.some((p) => !p)) {
		confidence = "low";
		requires_manual_review = true;
	} else if (
		samePrimaryDistrict &&
		!hasAnyOverlay &&
		!hasAnySpecialDistrict &&
		multiDistrictLotsCount === 0
	) {
		confidence = "high";
		requires_manual_review = false;
	} else if (
		sameNormalizedProfile &&
		(!samePrimaryDistrict || hasAnyOverlay || hasAnySpecialDistrict)
	) {
		confidence = "medium";
		requires_manual_review = true;
	} else {
		confidence = "low";
		requires_manual_review = true;
	}

	const summary = {
		primaryDistricts: [...primaryDistricts],
		normalizedProfiles: [...normalizedProfiles],
		samePrimaryDistrict,
		sameNormalizedProfile,
		sameBlock: anyBlockMissing ? false : sameBlock,
		hasAnyOverlay,
		hasAnySpecialDistrict,
		multiDistrictLotsCount,
		confidence,
		requires_manual_review,
	};

	return {
		lots,
		summary,
		notes,
	};
}
