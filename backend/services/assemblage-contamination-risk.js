/**
 * Assemblage Contamination Risk - flags whether any lot in a multi-lot assemblage
 * introduces extra approval risk (Landmark, Historic District, Special District, Overlays).
 * Conservative: flag > guess. Used in assemblage flow only.
 *
 * @param {Array<Object>} lotsZolaPayloads - Array of per-lot Zola/MapPLUTO payloads (from report_sources SourceKey="zola").
 *   Each item may have: bbl, block, lot, borough, borocode, landmark, histdist, spdist1-3, overlay1-2, zonedist1.
 *   Missing or failed Zola for a lot can be {} or null; computation still runs with partial data and lower confidence.
 * @returns {Object} Computed object for report_sources SourceKey="assemblage_contamination_risk" (lots, summary, notes).
 */

const CONTAMINATION_NOTES = [
	"Landmark designation typically triggers LPC review and can materially affect feasibility and timelines.",
	"Historic district and Special District rules may override base zoning; verify applicable district rules.",
	"Overlays can change use, parking, or bulk rules; manual review recommended when present.",
];

const BORO_CODE_TO_LETTER = {
	1: "MN",
	2: "BX",
	3: "BK",
	4: "QN",
	5: "SI",
};

/**
 * Normalize landmark field from Zola/MapPLUTO (can be boolean, "Y", "YES", "LANDMARK", "1", etc.).
 * @param {*} value - Raw landmark value
 * @returns {boolean|null} true = landmarked, false = not landmarked, null = unrecognized (reduce confidence)
 */
export function normalizeLandmark(value) {
	if (value === true || value === 1) return true;
	if (value === false || value === 0 || value === null || value === undefined) return false;
	const s = typeof value === "string" ? value.trim().toUpperCase() : String(value).trim().toUpperCase();
	if (s === "" || s === "N" || s === "NO" || s === "0") return false;
	if (s === "Y" || s === "YES" || s === "LANDMARK" || s === "1") return true;
	return null; // unrecognized
}

function nonEmpty(val) {
	return val != null && String(val).trim() !== "";
}

function toBoroughLetter(boroughOrCode) {
	if (boroughOrCode == null) return null;
	const s = String(boroughOrCode).trim().toUpperCase();
	if (["MN", "BK", "BX", "QN", "SI"].includes(s)) return s;
	const code = parseInt(boroughOrCode, 10);
	if (!Number.isNaN(code) && BORO_CODE_TO_LETTER[code]) return BORO_CODE_TO_LETTER[code];
	return s || null;
}

/**
 * @param {Array<Object>} lotsZolaPayloads
 * @returns {Object} { lots, summary, notes }
 */
export function computeAssemblageContaminationRisk(lotsZolaPayloads) {
	const lots = [];
	let anyLandmark = false;
	let anyHistoricDistrict = false;
	let anySpecialDistrict = false;
	let anyOverlay = false;
	let landmarkLots = 0;
	let historicDistrictLots = 0;
	let specialDistrictLots = 0;
	let overlayLots = 0;
	let lotsMissingZola = 0;
	let lotsWithMissingKeyFields = 0;
	let anyLandmarkParsedNull = false;

	for (const z of lotsZolaPayloads ?? []) {
		const payload = z && typeof z === "object" ? z : {};
		const hasZola = payload && (payload.bbl != null || payload.block != null);
		if (!hasZola) {
			lotsMissingZola += 1;
		}

		const landmarkRaw = payload.landmark;
		const isLandmarked = normalizeLandmark(landmarkRaw);
		if (isLandmarked === null && (landmarkRaw !== undefined && landmarkRaw !== null && String(landmarkRaw).trim() !== "")) {
			anyLandmarkParsedNull = true;
		}
		if (isLandmarked === true) {
			anyLandmark = true;
			landmarkLots += 1;
		}

		const histdist = nonEmpty(payload.histdist) ? String(payload.histdist).trim() : null;
		if (histdist) {
			anyHistoricDistrict = true;
			historicDistrictLots += 1;
		}

		const spdistList = [
			nonEmpty(payload.spdist1) ? String(payload.spdist1).trim() : null,
			nonEmpty(payload.spdist2) ? String(payload.spdist2).trim() : null,
			nonEmpty(payload.spdist3) ? String(payload.spdist3).trim() : null,
		].filter(Boolean);
		const hasSpecialDistrict = spdistList.length > 0;
		if (hasSpecialDistrict) {
			anySpecialDistrict = true;
			specialDistrictLots += 1;
		}

		const overlayList = [
			nonEmpty(payload.overlay1) ? String(payload.overlay1).trim() : null,
			nonEmpty(payload.overlay2) ? String(payload.overlay2).trim() : null,
		].filter(Boolean);
		const hasOverlay = overlayList.length > 0;
		if (hasOverlay) {
			anyOverlay = true;
			overlayLots += 1;
		}

		const hasKeyFields =
			hasZola &&
			(landmarkRaw !== undefined || payload.histdist !== undefined ||
				payload.spdist1 !== undefined || payload.spdist2 !== undefined || payload.spdist3 !== undefined ||
				payload.overlay1 !== undefined || payload.overlay2 !== undefined);
		if (hasZola && !hasKeyFields) {
			lotsWithMissingKeyFields += 1;
		}

		const bbl = payload.bbl != null ? String(payload.bbl) : null;
		const block = payload.block != null ? (typeof payload.block === "number" ? payload.block : parseInt(payload.block, 10)) : null;
		const lot = payload.lot != null ? (typeof payload.lot === "number" ? payload.lot : parseInt(payload.lot, 10)) : null;
		const borough = toBoroughLetter(payload.borough ?? payload.borocode);

		lots.push({
			bbl: bbl ?? "",
			block: !Number.isNaN(block) ? block : null,
			lot: !Number.isNaN(lot) ? lot : null,
			borough: borough ?? null,
			flags: {
				isLandmarked: isLandmarked === null ? null : !!isLandmarked,
				historicDistrictName: histdist,
				hasSpecialDistrict,
				specialDistricts: spdistList,
				hasOverlay,
				overlays: overlayList,
			},
		});
	}

	// Risk scoring (conservative)
	let contaminationRisk = "none";
	if (anyLandmark) contaminationRisk = "high";
	else if (anyHistoricDistrict || anySpecialDistrict) contaminationRisk = "moderate";
	else if (anyOverlay) contaminationRisk = "moderate";

	// Confidence: high by default; medium if 1 lot missing zola or landmark parsed null; low if multiple lots missing or zola missing entirely
	const totalLots = (lotsZolaPayloads ?? []).length;
	const zolaMissingEntirely = totalLots > 0 && lotsMissingZola >= totalLots;
	let confidence = "high";
	if (lotsMissingZola >= 2 || zolaMissingEntirely) {
		confidence = "low";
	} else if (lotsMissingZola === 1 || lotsWithMissingKeyFields >= 1 || anyLandmarkParsedNull) {
		confidence = "medium";
	}

	// requires_manual_review: true if contaminationRisk !== "none" OR confidence !== "high"
	const requires_manual_review = contaminationRisk !== "none" || confidence !== "high";

	const summary = {
		anyLandmark,
		anyHistoricDistrict,
		anySpecialDistrict,
		anyOverlay,
		contaminationRisk,
		requires_manual_review,
		confidence,
		counts: {
			landmarkLots,
			historicDistrictLots,
			specialDistrictLots,
			overlayLots,
		},
	};

	return {
		lots,
		summary,
		notes: [...CONTAMINATION_NOTES],
	};
}
