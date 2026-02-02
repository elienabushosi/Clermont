// Unit tests for assemblage contamination risk (Feature 8)
// Run with: node backend/services/assemblage-contamination-risk.test.js

import {
	computeAssemblageContaminationRisk,
	normalizeLandmark,
} from "./assemblage-contamination-risk.js";

function assert(condition, message) {
	if (!condition) {
		throw new Error(`Test failed: ${message}`);
	}
	console.log(`✓ ${message}`);
}

// --- Test 1: Clean lots — landmark null, histdist null, spdist empty, overlay empty -> risk none, confidence high
console.log("\n=== Test 1: Clean lots (risk none, confidence high) ===");
const cleanLot1 = {
	bbl: "3012340010",
	block: 1234,
	lot: 10,
	borough: "MN",
	landmark: null,
	histdist: null,
	spdist1: null,
	spdist2: null,
	spdist3: null,
	overlay1: null,
	overlay2: null,
};
const cleanLot2 = {
	bbl: "3012340020",
	block: 1234,
	lot: 20,
	borough: "MN",
	landmark: "",
	histdist: "",
	spdist1: "",
	spdist2: "",
	spdist3: "",
	overlay1: "",
	overlay2: "",
};
const resultClean = computeAssemblageContaminationRisk([cleanLot1, cleanLot2]);
assert(resultClean.summary.contaminationRisk === "none", "Clean lots -> contaminationRisk none");
assert(resultClean.summary.confidence === "high", "Clean lots -> confidence high");
assert(resultClean.summary.requires_manual_review === false, "Clean lots -> requires_manual_review false");
assert(resultClean.lots.length === 2, "Clean lots -> 2 lots in output");
assert(resultClean.summary.counts.landmarkLots === 0, "Clean lots -> landmarkLots 0");
assert(resultClean.summary.counts.historicDistrictLots === 0, "Clean lots -> historicDistrictLots 0");

// --- Test 2: Historic district present on one lot -> risk moderate, requires_manual_review true
console.log("\n=== Test 2: Historic district on one lot (risk moderate) ===");
const histLot = {
	bbl: "3012340030",
	block: 1234,
	lot: 30,
	borough: "BK",
	landmark: null,
	histdist: "Carroll Gardens Historic District",
	spdist1: null,
	spdist2: null,
	spdist3: null,
	overlay1: null,
	overlay2: null,
};
const resultHist = computeAssemblageContaminationRisk([cleanLot1, histLot]);
assert(resultHist.summary.contaminationRisk === "moderate", "Historic district -> contaminationRisk moderate");
assert(resultHist.summary.requires_manual_review === true, "Historic district -> requires_manual_review true");
assert(resultHist.summary.anyHistoricDistrict === true, "Historic district -> anyHistoricDistrict true");
assert(resultHist.summary.counts.historicDistrictLots === 1, "Historic district -> historicDistrictLots 1");
assert(
	resultHist.lots.some((l) => l.flags?.historicDistrictName === "Carroll Gardens Historic District"),
	"Historic district name stored on lot"
);

// --- Test 3: Landmark true on one lot -> risk high
console.log("\n=== Test 3: Landmark on one lot (risk high) ===");
const landmarkLot = {
	bbl: "3012340040",
	block: 1234,
	lot: 40,
	borough: "MN",
	landmark: "Y",
	histdist: null,
	spdist1: null,
	spdist2: null,
	spdist3: null,
	overlay1: null,
	overlay2: null,
};
const resultLandmark = computeAssemblageContaminationRisk([cleanLot1, landmarkLot]);
assert(resultLandmark.summary.contaminationRisk === "high", "Landmark -> contaminationRisk high");
assert(resultLandmark.summary.requires_manual_review === true, "Landmark -> requires_manual_review true");
assert(resultLandmark.summary.anyLandmark === true, "Landmark -> anyLandmark true");
assert(resultLandmark.summary.counts.landmarkLots === 1, "Landmark -> landmarkLots 1");
assert(
	resultLandmark.lots.some((l) => l.flags?.isLandmarked === true),
	"Landmark flag true on lot"
);

// --- normalizeLandmark helper (sanity)
console.log("\n=== normalizeLandmark helper ===");
assert(normalizeLandmark("Y") === true, "normalizeLandmark('Y') -> true");
assert(normalizeLandmark("YES") === true, "normalizeLandmark('YES') -> true");
assert(normalizeLandmark("LANDMARK") === true, "normalizeLandmark('LANDMARK') -> true");
assert(normalizeLandmark(1) === true, "normalizeLandmark(1) -> true");
assert(normalizeLandmark("N") === false, "normalizeLandmark('N') -> false");
assert(normalizeLandmark("") === false, "normalizeLandmark('') -> false");
assert(normalizeLandmark(null) === false, "normalizeLandmark(null) -> false");
assert(normalizeLandmark("UNKNOWN_VALUE") === null, "normalizeLandmark('UNKNOWN_VALUE') -> null");

console.log("\nAll contamination risk tests passed.\n");
