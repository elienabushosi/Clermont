// Assemblage report orchestrator - runs Geoservice + Zola per address, then aggregates Combined Lot Area
import { getAgentBySourceKey } from "./agents/index.js";
import {
	createReport,
	storeAgentResult,
	updateReportStatus,
	getReportSources,
} from "../services/report-service.js";
import { computeAssemblageZoningConsistency } from "../services/assemblage-zoning-consistency.js";
import { computeAssemblageContaminationRisk } from "../services/assemblage-contamination-risk.js";

const ASSEMBLAGE_VERSION = "v1";

/**
 * Generate an assemblage report for two addresses
 * @param {string[]} addresses - Exactly 2 address strings
 * @param {string} organizationId - Organization ID
 * @param {string} userId - User ID
 * @param {string|null} clientId - Client ID (optional)
 * @returns {Promise<Object>} { reportId, status, combinedLotAreaSqft?, lots?, flags?, error? }
 */
export async function generateAssemblageReport(
	addresses,
	organizationId,
	userId,
	clientId = null
) {
	let report = null;

	try {
		const addressList = addresses.map((a) => a.trim());
		const combinedAddress = addressList.join("; ");

		// 1. Create parent report record
		console.log(`Creating assemblage report for: ${combinedAddress}`);
		report = await createReport({
			address: combinedAddress,
			organizationId,
			clientId,
			createdBy: userId,
			name: "Assemblage",
			reportType: "assemblage",
		});

		console.log(`Assemblage report created with ID: ${report.IdReport}`);

		// 2. Store assemblage input source
		await storeAgentResult(report.IdReport, "assemblage_input", {
			status: "succeeded",
			data: {
				addresses: addressList,
				requestedAt: new Date().toISOString(),
				version: ASSEMBLAGE_VERSION,
			},
			error: null,
		});

		const geoserviceAgent = getAgentBySourceKey("geoservice");
		const zolaAgent = getAgentBySourceKey("zola");
		const zoningAgent = getAgentBySourceKey("zoning_resolution");

		if (!geoserviceAgent) {
			throw new Error("GeoserviceAgent not found");
		}

		// 3. Run Geoservice for each address (must succeed for both)
		const childContexts = [];

		for (let i = 0; i < addressList.length; i++) {
			const address = addressList[i];
			console.log(`Executing GeoserviceAgent for address[${i}]: ${address}`);
			const geoserviceResult = await geoserviceAgent.execute(
				{ address },
				report.IdReport
			);

			// Store with SourceKey "geoservice", disambiguate by childIndex in ContentJson
			await storeAgentResult(report.IdReport, "geoservice", {
				status: geoserviceResult.status,
				data: {
					childIndex: i,
					address,
					extracted: geoserviceResult.data?.extracted ?? null,
					raw: geoserviceResult.data?.contentJson ?? geoserviceResult.data ?? null,
				},
				error: geoserviceResult.error ?? null,
			});

			if (geoserviceResult.status !== "succeeded") {
				console.error(`GeoserviceAgent failed for address[${i}]:`, geoserviceResult.error);
				await updateReportStatus(report.IdReport, "failed");
				return {
					reportId: report.IdReport,
					status: "failed",
					error: `Geoservice failed for address ${i + 1}: ${geoserviceResult.error}`,
				};
			}

			const extracted = geoserviceResult.data?.extracted;
			if (!extracted || !extracted.bbl) {
				await updateReportStatus(report.IdReport, "failed");
				return {
					reportId: report.IdReport,
					status: "failed",
					error: `Geoservice did not return BBL for address ${i + 1}`,
				};
			}

			childContexts.push({
				childIndex: i,
				address,
				bbl: extracted.bbl,
				normalizedAddress: extracted.normalizedAddress ?? address,
				lat: extracted.lat ?? null,
				lng: extracted.lng ?? null,
			});
		}

		// 4. Run Zola for each child (non-critical; store failure but don't fail report)
		const zolaPayloadsByIndex = {};

		for (const ctx of childContexts) {
			if (!zolaAgent) {
				zolaPayloadsByIndex[ctx.childIndex] = null;
				continue;
			}
			console.log(`Executing ZolaAgent for child[${ctx.childIndex}] BBL: ${ctx.bbl}`);
			try {
				const zolaResult = await zolaAgent.execute(
					{
						address: ctx.address,
						bbl: ctx.bbl,
						normalizedAddress: ctx.normalizedAddress,
						location: { lat: ctx.lat, lng: ctx.lng },
					},
					report.IdReport
				);

				const contentJson = zolaResult.data?.contentJson ?? zolaResult.data ?? null;
				await storeAgentResult(report.IdReport, "zola", {
					status: zolaResult.status,
					data: {
						childIndex: ctx.childIndex,
						address: ctx.address,
						...zolaResult.data,
					},
					error: zolaResult.error ?? null,
				});

				zolaPayloadsByIndex[ctx.childIndex] =
					zolaResult.status === "succeeded" ? contentJson : null;
			} catch (zolaError) {
				console.error(`ZolaAgent failed for child[${ctx.childIndex}] (non-critical):`, zolaError);
				await storeAgentResult(report.IdReport, "zola", {
					status: "failed",
					data: {
						childIndex: ctx.childIndex,
						address: ctx.address,
					},
					error: zolaError.message ?? "Unknown error in ZolaAgent",
				});
				zolaPayloadsByIndex[ctx.childIndex] = null;
			}
		}

		// 5. Aggregation: build lots, combinedLotAreaSqft, totalBuildableSqft, flags
		const lots = [];
		let combinedLotAreaSqft = 0;
		let totalBuildableSqft = 0;
		let missingLotArea = false;
		let partialTotal = false;
		let assemblageRequiresManualReview = false;
		const lotProfiles = [];
		const lotFarRequiresReview = [];

		for (const ctx of childContexts) {
			const zolaPayload = zolaPayloadsByIndex[ctx.childIndex];
			const lotarea =
				zolaPayload != null && typeof zolaPayload.lotarea === "number"
					? zolaPayload.lotarea
					: zolaPayload != null && zolaPayload.lotarea != null
						? Number(zolaPayload.lotarea)
						: null;
			const hasValidLotArea = lotarea != null && !Number.isNaN(lotarea) && lotarea > 0;

			if (!hasValidLotArea && (lotarea === 0 || lotarea == null || Number.isNaN(lotarea))) {
				missingLotArea = true;
				partialTotal = true;
			}
			if (hasValidLotArea) {
				combinedLotAreaSqft += lotarea;
			}

			// Per-lot FAR (multi-district: use lowest FAR; flag for manual review)
			let maxFar = null;
			let lotBuildableSqft = null;
			let farMethod = "unknown";
			let requires_manual_review = true;
			let farCandidates = [];
			let zoningDistrictCandidates = [];
			if (zoningAgent && zolaPayload) {
				const farControl = zoningAgent.computeControllingFARFromZola(zolaPayload);
				maxFar = farControl.maxFar;
				farMethod = farControl.farMethod;
				requires_manual_review = farControl.requires_manual_review;
				farCandidates = farControl.farCandidates || [];
				zoningDistrictCandidates = farControl.zoningDistrictCandidates || [];
				if (maxFar != null && hasValidLotArea) {
					lotBuildableSqft = maxFar * lotarea;
					totalBuildableSqft += lotBuildableSqft;
				}
				const profile =
					farCandidates.length === 1
						? farCandidates[0].profile
						: farCandidates.length > 1
							? null
							: null;
				lotProfiles.push(profile);
				lotFarRequiresReview.push(requires_manual_review);
			} else {
				lotProfiles.push(null);
				lotFarRequiresReview.push(true);
			}

			const zonedist1 = zolaPayload?.zonedist1 ?? null;
			lots.push({
				childIndex: ctx.childIndex,
				address: ctx.address,
				normalizedAddress: ctx.normalizedAddress,
				bbl: ctx.bbl,
				lotarea: hasValidLotArea ? lotarea : (lotarea ?? 0),
				zonedist1,
				status: hasValidLotArea ? "ok" : "missing_lotarea",
				maxFar,
				lotBuildableSqft,
				farMethod,
				requires_manual_review,
				zoningDistrictCandidates,
				farCandidates,
			});
		}

		// Assemblage FAR method: shared_district if all same profile and none require review; else per_lot_sum
		const allSameProfile =
			lotProfiles.length >= 2 &&
			lotProfiles.every((p) => p != null && p === lotProfiles[0]);
		const noneRequireReview = lotFarRequiresReview.every((r) => !r);
		const assemblageFarMethod =
			allSameProfile && noneRequireReview ? "shared_district" : "per_lot_sum";
		if (assemblageFarMethod === "per_lot_sum") {
			assemblageRequiresManualReview = true;
		}

		// 6. Assemblage density (DUF) caps
		const DEFAULT_DUF = 680;
		const ROUNDING_RULE = "Fractions >= 0.75 round up; otherwise round down";
		const SOURCE_URL = "https://zr.planning.nyc.gov/article-ii/chapter-3#23-52";
		const SOURCE_SECTION = "ZR §23-52";

		let dufApplicable = false;
		const perLotBreakdown = [];
		let densityMissingInputs = false;
		let anyLotHasOverlayOrSpecial = false;

		for (const lot of lots) {
			const zolaPayload = zolaPayloadsByIndex[lot.childIndex] || {};
			const buildingTypeResult =
				zoningAgent && zoningAgent.determineBuildingType
					? zoningAgent.determineBuildingType(zolaPayload.bldgclass)
					: { buildingType: "unknown" };
			const unitsres =
				zolaPayload.unitsres != null
					? Number(zolaPayload.unitsres)
					: null;
			const isMultipleDwelling =
				buildingTypeResult.buildingType === "multiple_dwelling" ||
				(unitsres != null && !Number.isNaN(unitsres) && unitsres > 2);
			if (isMultipleDwelling) {
				dufApplicable = true;
			}

			const hasOverlay = !!(zolaPayload.overlay1 || zolaPayload.overlay2);
			const hasSpecialDistrict = !!(
				zolaPayload.spdist1 || zolaPayload.spdist2 || zolaPayload.spdist3
			);
			if (hasOverlay || hasSpecialDistrict) {
				anyLotHasOverlayOrSpecial = true;
			}

			const missingInputs =
				lot.lotarea <= 0 ||
				lot.maxFar == null ||
				(lot.lotBuildableSqft == null && (lot.lotarea <= 0 || lot.maxFar == null));
			if (missingInputs) {
				densityMissingInputs = true;
			}

			const buildableSqft =
				lot.lotBuildableSqft != null && lot.lotBuildableSqft > 0
					? lot.lotBuildableSqft
					: null;
			let unitsRaw = null;
			let unitsRounded = null;
			if (buildableSqft != null && buildableSqft > 0 && zoningAgent?.roundDwellingUnitsByZR) {
				const rounded = zoningAgent.roundDwellingUnitsByZR(buildableSqft, DEFAULT_DUF);
				unitsRaw = rounded.units_raw;
				unitsRounded = rounded.units_rounded;
			}

			let notes = null;
			if (missingInputs) {
				notes = "Missing lot area or max FAR; excluded from density numeric total.";
			} else if (lot.requires_manual_review) {
				notes = "FAR required manual review (e.g. multiple zoning districts).";
			}

			perLotBreakdown.push({
				bbl: lot.bbl,
				childIndex: lot.childIndex,
				lotarea: lot.lotarea,
				maxFar: lot.maxFar,
				buildable_sqft: buildableSqft,
				units_raw: unitsRaw,
				units_rounded: unitsRounded,
				missing_inputs: missingInputs,
				requires_manual_review: lot.requires_manual_review || hasOverlay || hasSpecialDistrict,
				notes,
			});
		}

		// Method 1: combined area then DUF once
		const totalBuildableForDuf = totalBuildableSqft; // already excludes invalid lots
		let maxUnitsCombined = null;
		if (totalBuildableForDuf > 0 && zoningAgent?.roundDwellingUnitsByZR) {
			maxUnitsCombined = zoningAgent.roundDwellingUnitsByZR(
				totalBuildableForDuf,
				DEFAULT_DUF
			).units_rounded;
		}

		// Method 2: per-lot DUF then sum
		let maxUnitsPerLotSum = 0;
		for (const row of perLotBreakdown) {
			if (row.units_rounded != null && !row.missing_inputs) {
				maxUnitsPerLotSum += row.units_rounded;
			}
		}

		const useCombinedDefault =
			assemblageFarMethod === "shared_district" &&
			noneRequireReview &&
			!anyLotHasOverlayOrSpecial &&
			!densityMissingInputs;
		const defaultMethod = useCombinedDefault
			? "combined_area_then_duf"
			: "per_lot_duf_sum";
		const densityRequiresManualReview =
			!useCombinedDefault || densityMissingInputs || anyLotHasOverlayOrSpecial;

		const assemblageAssumptions = [];
		if (!useCombinedDefault && dufApplicable) {
			assemblageAssumptions.push(
				"DUF computed using per-lot method due to mixed zoning or manual-review flags."
			);
		}
		if (densityMissingInputs) {
			assemblageAssumptions.push(
				"Lots with missing lot area or max FAR excluded from numeric cap; partial total shown."
			);
		}

		// Never return misleading 0 when all lots were excluded
		const effectiveMaxUnitsCombined =
			maxUnitsCombined != null && maxUnitsCombined > 0 ? maxUnitsCombined : null;
		const effectiveMaxUnitsPerLot =
			maxUnitsPerLotSum > 0 ? maxUnitsPerLotSum : null;
		const displayMaxUnits =
			densityMissingInputs && effectiveMaxUnitsCombined == null && effectiveMaxUnitsPerLot == null
				? null
				: dufApplicable && defaultMethod === "combined_area_then_duf"
					? effectiveMaxUnitsCombined
					: dufApplicable && defaultMethod === "per_lot_duf_sum"
						? effectiveMaxUnitsPerLot
						: null;

		const density = {
			kind: "toggle",
			duf_value: DEFAULT_DUF,
			default_candidate_id: dufApplicable ? "duf_applies" : "duf_not_applicable",
			candidates: [
				{
					id: "duf_applies",
					label: "Standard (DUF applies)",
					duf_applicable: dufApplicable,
					method_used: defaultMethod,
					max_dwelling_units: dufApplicable ? displayMaxUnits : null,
					max_res_floor_area_sqft: dufApplicable ? totalBuildableSqft : null,
					per_lot_breakdown: perLotBreakdown,
					rounding_rule: ROUNDING_RULE,
					source_url: SOURCE_URL,
					source_section: SOURCE_SECTION,
					notes: densityMissingInputs
						? "Some lots excluded due to missing inputs; see per-lot breakdown."
						: null,
					requires_manual_review: densityRequiresManualReview,
				},
				{
					id: "duf_not_applicable",
					label: "Affordable/Senior/Conversion (DUF not applicable)",
					duf_applicable: false,
					method_used: null,
					max_dwelling_units: null,
					max_res_floor_area_sqft: null,
					per_lot_breakdown: perLotBreakdown,
					rounding_rule: null,
					source_url: SOURCE_URL,
					source_section: SOURCE_SECTION,
					notes:
						"No DUF-based unit cap; unit count governed by other constraints.",
					requires_manual_review: true,
				},
			],
			flags: {
				densityMissingInputs,
				densityComputed: dufApplicable && (maxUnitsCombined != null || maxUnitsPerLotSum > 0),
				defaultMethod,
				requires_manual_review: densityRequiresManualReview,
			},
		};

		const aggregationPayload = {
			lots,
			combinedLotAreaSqft,
			totalBuildableSqft,
			farMethod: assemblageFarMethod,
			requires_manual_review: assemblageRequiresManualReview,
			density,
			assumptions: assemblageAssumptions,
			flags: {
				missingLotArea,
				partialTotal,
			},
		};

		await storeAgentResult(report.IdReport, "assemblage_aggregation", {
			status: "succeeded",
			data: aggregationPayload,
			error: null,
		});

		// 7. Assemblage Zoning Consistency (evaluate compatibility across lots)
		const lotsZolaData = childContexts.map((ctx) => zolaPayloadsByIndex[ctx.childIndex] ?? {});
		const normalizeDistrictProfile =
			zoningAgent && typeof zoningAgent.getNormalizedDistrictProfile === "function"
				? zoningAgent.getNormalizedDistrictProfile.bind(zoningAgent)
				: (d) => (d && typeof d === "string" ? d.trim() : null);
		let zoningConsistency;
		try {
			zoningConsistency = computeAssemblageZoningConsistency(
				lotsZolaData,
				normalizeDistrictProfile
			);
			await storeAgentResult(report.IdReport, "assemblage_zoning_consistency", {
				status: "succeeded",
				data: zoningConsistency,
				error: null,
			});
		} catch (consistencyError) {
			console.error("Assemblage zoning consistency failed (non-fatal):", consistencyError);
			await storeAgentResult(report.IdReport, "assemblage_zoning_consistency", {
				status: "failed",
				data: null,
				error: consistencyError.message || "Zoning consistency computation failed",
			});
		}

		// 8. Assemblage Contamination Risk (Landmark, Historic District, Special District, Overlays)
		const lotsZolaForContamination = childContexts.map((ctx) => zolaPayloadsByIndex[ctx.childIndex] ?? {});
		let contaminationResult;
		try {
			contaminationResult = computeAssemblageContaminationRisk(lotsZolaForContamination);
			await storeAgentResult(report.IdReport, "assemblage_contamination_risk", {
				status: "succeeded",
				data: contaminationResult,
				error: null,
			});
		} catch (contaminationError) {
			console.error("Assemblage contamination risk failed (non-fatal):", contaminationError);
			await storeAgentResult(report.IdReport, "assemblage_contamination_risk", {
				status: "failed",
				data: null,
				error: contaminationError.message || "Contamination risk computation failed",
			});
		}

		await updateReportStatus(report.IdReport, "ready");

		console.log(
			`Assemblage report ${report.IdReport} completed. combinedLotAreaSqft=${combinedLotAreaSqft} totalBuildableSqft=${totalBuildableSqft}`
		);

		return {
			reportId: report.IdReport,
			status: "ready",
			combinedLotAreaSqft,
			totalBuildableSqft,
			farMethod: aggregationPayload.farMethod,
			requires_manual_review: aggregationPayload.requires_manual_review,
			lots,
			flags: aggregationPayload.flags,
		};
	} catch (error) {
		console.error("Error in assemblage orchestration:", error);
		if (report?.IdReport) {
			try {
				await updateReportStatus(report.IdReport, "failed");
			} catch (updateError) {
				console.error("Error updating report status:", updateError);
			}
		}
		throw error;
	}
}
