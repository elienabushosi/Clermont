// Unit tests for yard requirements in ZoningResolutionAgent
// Run with: node backend/orchestration/agents/zoning-resolution-yards.test.js

import { ZoningResolutionAgent } from "./zoning-resolution.js";

const agent = new ZoningResolutionAgent();

// Test helper
function assert(condition, message) {
	if (!condition) {
		throw new Error(`Test failed: ${message}`);
	}
	console.log(`✓ ${message}`);
}

// Test 1: R4B front yard should return 5 ft with modifiers notes
console.log("\n=== Test 1: R4B Front Yard ===");
const r4bFront = agent.calculateFrontYard("R4B", "R4");
assert(r4bFront.kind === "fixed", "R4B front yard kind is 'fixed'");
assert(r4bFront.value_ft === 5, "R4B front yard value is 5 ft");
assert(
	r4bFront.source_section === "ZR §23-321",
	"R4B front yard cites §23-321"
);
assert(
	r4bFront.notes.length > 0,
	"R4B front yard has modifier notes"
);
assert(
	r4bFront.requires_manual_review === true,
	"R4B front yard requires manual review"
);
assert(
	r4bFront.notes.some((n) => n.includes("R4B") || n.includes("line-up")),
	"R4B front yard includes special line-up rule note"
);

// Test 2: R7-2 front yard should return 0 ft (R6-R12: none)
console.log("\n=== Test 2: R7-2 Front Yard (R6-R12) ===");
const r72Front = agent.calculateFrontYard("R7-2", "R7");
assert(r72Front.kind === "fixed", "R7-2 front yard kind is 'fixed'");
assert(r72Front.value_ft === 0, "R7-2 front yard value is 0 ft");
assert(
	r72Front.source_section === "ZR §23-322",
	"R7-2 front yard cites §23-322"
);
assert(
	r72Front.requires_manual_review === false,
	"R7-2 front yard does not require manual review"
);

// Test 3: R1 side yard default should return 8 ft (detached assumption) for A* bldgclass
console.log("\n=== Test 3: R1 Side Yard (Single/Two Family) ===");
const r1Side = agent.calculateSideYard("R1", "R1", "single_or_two_family");
assert(r1Side.kind === "fixed", "R1 side yard kind is 'fixed'");
assert(r1Side.value_ft === 8, "R1 side yard value is 8 ft");
assert(
	r1Side.source_section === "ZR §23-332",
	"R1 side yard cites §23-332"
);
assert(
	r1Side.notes.some((n) => n.includes("detached")),
	"R1 side yard notes mention detached building"
);
assert(
	r1Side.requires_manual_review === true,
	"R1 side yard requires manual review"
);

// Test 4: R8 side yard default should return 0 ft for C* bldgclass
console.log("\n=== Test 4: R8 Side Yard (Multiple Dwelling) ===");
const r8Side = agent.calculateSideYard("R8", "R8", "multiple_dwelling");
assert(r8Side.kind === "fixed", "R8 side yard kind is 'fixed'");
assert(r8Side.value_ft === 0, "R8 side yard value is 0 ft");
assert(
	r8Side.source_section === "ZR §23-335",
	"R8 side yard cites §23-335"
);
assert(
	r8Side.notes.length > 0,
	"R8 side yard has notes"
);
assert(
	r8Side.requires_manual_review === true,
	"R8 side yard requires manual review"
);

// Test 5: Rear yard always returns 20 ft with conditional notes; if lotdepth < 95 includes shallow-lot note
console.log("\n=== Test 5: Rear Yard (Standard) ===");
const rearStandard = agent.calculateRearYard("R4", 50, 100);
assert(rearStandard.kind === "fixed", "Rear yard kind is 'fixed'");
assert(rearStandard.value_ft === 20, "Rear yard value is 20 ft");
assert(
	rearStandard.source_section === "ZR §23-342",
	"Rear yard cites §23-342"
);
assert(
	rearStandard.notes.length > 0,
	"Rear yard has notes"
);
assert(
	rearStandard.requires_manual_review === true,
	"Rear yard requires manual review"
);

console.log("\n=== Test 6: Rear Yard (Shallow Lot) ===");
const rearShallow = agent.calculateRearYard("R4", 30, 85);
assert(rearShallow.kind === "fixed", "Shallow lot rear yard kind is 'fixed'");
assert(rearShallow.value_ft === 20, "Shallow lot rear yard default value is 20 ft");
assert(
	rearShallow.notes.some((n) => n.includes("Shallow lot") || n.includes("85")),
	"Shallow lot rear yard includes shallow lot condition note"
);
assert(
	rearShallow.notes.some((n) => n.includes("Dec 15, 1961")),
	"Shallow lot rear yard mentions Dec 15, 1961 condition"
);

// Test 7: Rear yard with lot frontage < 40 ft
console.log("\n=== Test 7: Rear Yard (Narrow Lot) ===");
const rearNarrow = agent.calculateRearYard("R4", 35, 100);
assert(
	rearNarrow.notes.some((n) => n.includes("35") || n.includes("40 ft")),
	"Narrow lot rear yard includes lot frontage note"
);
assert(
	rearNarrow.notes.some((n) => n.includes("< 40 ft") || n.includes("30 ft")),
	"Narrow lot rear yard mentions < 40 ft condition"
);

// Test 8: Complete yard requirements calculation
console.log("\n=== Test 8: Complete Yard Requirements (R4B) ===");
const yardsR4B = agent.calculateYardRequirements(
	"R4B",
	"single_or_two_family",
	45,
	90
);
assert(yardsR4B.front !== undefined, "Yards object has front property");
assert(yardsR4B.side !== undefined, "Yards object has side property");
assert(yardsR4B.rear !== undefined, "Yards object has rear property");
assert(yardsR4B.flags !== undefined, "Yards object has flags property");
assert(yardsR4B.front.value_ft === 5, "R4B front yard is 5 ft");
assert(
	yardsR4B.flags.shallowLotCandidate === true,
	"Shallow lot candidate flag is true (90 < 95)"
);
assert(
	yardsR4B.flags.lotfrontMissing === false,
	"Lot frontage missing flag is false"
);

// Test 9: Non-residential district returns unsupported
console.log("\n=== Test 9: Non-Residential District ===");
const yardsNonRes = agent.calculateYardRequirements(
	"C1-2",
	"multiple_dwelling",
	50,
	100
);
assert(
	yardsNonRes.front.kind === "unsupported",
	"Non-residential front yard is unsupported"
);
assert(
	yardsNonRes.front.notes.some((n) => n.includes("residential districts only")),
	"Non-residential front yard has appropriate note"
);

// Test 10: Missing district returns unsupported
console.log("\n=== Test 10: Missing District ===");
const yardsNoDistrict = agent.calculateYardRequirements(
	null,
	"single_or_two_family",
	50,
	100
);
assert(
	yardsNoDistrict.front.kind === "unsupported",
	"Missing district front yard is unsupported"
);
assert(
	yardsNoDistrict.flags.lotfrontMissing === false,
	"Lot frontage missing flag is false when provided"
);

console.log("\n✅ All tests passed!");
