// Orchestration layer - coordinates agent execution and report generation
import {
	getAgentBySourceKey,
} from "./agents/index.js";
import {
	createReport,
	storeAgentResult,
	updateReportStatus,
	updateReportWithGeoserviceData,
	getReportSources,
} from "../services/report-service.js";

/**
 * Generate a report by orchestrating agents sequentially
 * Flow: GeoserviceAgent (first) → ZolaAgent (using BBL from Geoservice)
 * @param {Object} addressData - Address information from frontend
 * @param {string} addressData.address - Full address string (required)
 * @param {string} organizationId - Organization ID
 * @param {string} userId - User ID
 * @param {string} clientId - Client ID (optional)
 * @returns {Promise<Object>} Generated report
 */
export async function generateReport(
	addressData,
	organizationId,
	userId,
	clientId = null
) {
	let report = null;

	try {
		// 1. Create report record with 'pending' status
		console.log(`Creating report for address: ${addressData.address}`);
		report = await createReport({
			address: addressData.address,
			normalizedAddress: addressData.normalizedAddress || null, // Optional hint from frontend
			organizationId: organizationId,
			clientId: clientId,
			createdBy: userId,
			name: addressData.address,
		});

		console.log(`Report created with ID: ${report.IdReport}`);

		// 2. Run GeoserviceAgent FIRST (required - must succeed)
		const geoserviceAgent = getAgentBySourceKey("geoservice");
		if (!geoserviceAgent) {
			throw new Error("GeoserviceAgent not found");
		}

		console.log("Executing GeoserviceAgent...");
		// Pass same shape as assemblage; prefer normalizedAddress when frontend sends it
		const geoserviceResult = await geoserviceAgent.execute(
			{
				address: addressData.address,
				normalizedAddress: addressData.normalizedAddress || null,
			},
			report.IdReport
		);

		// Store Geoservice result
		await storeAgentResult(
			report.IdReport,
			"geoservice",
			geoserviceResult
		);

		// If Geoservice failed, mark report as failed and return
		if (geoserviceResult.status !== "succeeded") {
			console.error("GeoserviceAgent failed:", geoserviceResult.error);
			await updateReportStatus(report.IdReport, "failed");
			return {
				reportId: report.IdReport,
				status: "failed",
				borough: null,
				landUse: null,
				zoningDistricts: null,
				error: `Geoservice failed: ${geoserviceResult.error}`,
				agentResults: [
					{
						agent: "geoservice",
						status: "failed",
						error: geoserviceResult.error,
					},
				],
			};
		}

		// 3. Extract BBL and location data from Geoservice result
		const geoserviceData = geoserviceResult.data;
		if (!geoserviceData || !geoserviceData.extracted) {
			throw new Error("GeoserviceAgent did not return extracted data");
		}

		const { bbl, normalizedAddress, lat, lng, borough } = geoserviceData.extracted;

		if (!bbl) {
			throw new Error("GeoserviceAgent did not return BBL");
		}

		// Update report with Geoservice data (BBL, normalized address, coordinates)
		await updateReportWithGeoserviceData(report.IdReport, {
			bbl,
			normalizedAddress,
			lat,
			lng,
		});

		console.log(`Geoservice succeeded. BBL: ${bbl}, Address: ${normalizedAddress}`);

		// 3.5. Run TransitZonesAgent and FemaFloodAgent in parallel using lat/lng from Geoservice (non-critical)
		const transitZonesAgent = getAgentBySourceKey("transit_zones");
		const femaFloodAgent = getAgentBySourceKey("fema_flood");

		// Execute both agents in parallel
		const parallelAgentPromises = [];

		if (transitZonesAgent) {
			console.log("Executing TransitZonesAgent with lat/lng:", lat, lng);
			parallelAgentPromises.push(
				transitZonesAgent
					.execute(
						{
							address: addressData.address,
							bbl: bbl,
							normalizedAddress: normalizedAddress,
							location: { lat, lng },
						},
						report.IdReport
					)
					.then(async (transitZonesResult) => {
						// Store TransitZones result (non-critical - failure doesn't fail report)
						await storeAgentResult(
							report.IdReport,
							"transit_zones",
							transitZonesResult
						);
					})
					.catch(async (transitZonesError) => {
						console.error(
							"TransitZonesAgent failed (non-critical):",
							transitZonesError
						);
						// Store failed result but don't fail the report
						await storeAgentResult(report.IdReport, "transit_zones", {
							status: "failed",
							data: null,
							error:
								transitZonesError.message ||
								"Unknown error in TransitZonesAgent",
						});
					})
			);
		} else {
			console.warn("TransitZonesAgent not found, skipping...");
		}

		if (femaFloodAgent) {
			console.log("Executing FemaFloodAgent with lat/lng:", lat, lng);
			parallelAgentPromises.push(
				femaFloodAgent
					.execute(
						{
							address: addressData.address,
							bbl: bbl,
							normalizedAddress: normalizedAddress,
							location: { lat, lng },
						},
						report.IdReport
					)
					.then(async (femaFloodResult) => {
						// Store FEMA Flood result (non-critical - failure doesn't fail report)
						await storeAgentResult(
							report.IdReport,
							"fema_flood",
							femaFloodResult
						);
					})
					.catch(async (femaFloodError) => {
						console.error(
							"FemaFloodAgent failed (non-critical):",
							femaFloodError
						);
						// Store failed result but don't fail the report
						await storeAgentResult(report.IdReport, "fema_flood", {
							status: "failed",
							data: null,
							error:
								femaFloodError.message ||
								"Unknown error in FemaFloodAgent",
						});
					})
			);
		} else {
			console.warn("FemaFloodAgent not found, skipping...");
		}

		// Wait for both agents to complete (or fail)
		await Promise.all(parallelAgentPromises);

		// 4. Run ZolaAgent using BBL from Geoservice
		const zolaAgent = getAgentBySourceKey("zola");
		if (!zolaAgent) {
			console.warn("ZolaAgent not found, skipping...");
		} else {
			console.log("Executing ZolaAgent with BBL:", bbl);
			const zolaResult = await zolaAgent.execute(
				{
					address: addressData.address,
					bbl: bbl,
					normalizedAddress: normalizedAddress,
					location: { lat, lng },
				},
				report.IdReport
			);

			// Store Zola result
			await storeAgentResult(report.IdReport, "zola", zolaResult);
		}

		// 5. Run ZoningResolutionAgent (non-critical - runs after Zola to compute FAR and lot coverage)
		const zoningAgent = getAgentBySourceKey("zoning_resolution");
		if (!zoningAgent) {
			console.warn("ZoningResolutionAgent not found, skipping...");
		} else if (zoningAgent.enabled) {
			console.log("Executing ZoningResolutionAgent...");
			try {
				const zoningResult = await zoningAgent.execute(
					{
						address: addressData.address,
						bbl: bbl,
						normalizedAddress: normalizedAddress,
						location: { lat, lng },
					},
					report.IdReport
				);

				// Store ZoningResolution result (non-critical - failure doesn't fail report)
				await storeAgentResult(
					report.IdReport,
					"zoning_resolution",
					zoningResult
				);
			} catch (zoningError) {
				console.error("ZoningResolutionAgent failed (non-critical):", zoningError);
				// Store failed result but don't fail the report
				await storeAgentResult(report.IdReport, "zoning_resolution", {
					status: "failed",
					data: null,
					error: zoningError.message || "Unknown error in ZoningResolutionAgent",
				});
			}
		}

		// 6. Determine final report status
		// For V1, if Geoservice succeeded, mark as 'ready'
		// (ZolaAgent and ZoningResolutionAgent failures are non-critical for now)
		const finalStatus = "ready";

		// Update report status
		await updateReportStatus(report.IdReport, finalStatus);

		console.log(
			`Report ${report.IdReport} completed with status: ${finalStatus}`
		);

		// Get all sources to build agent results
		const allSources = await getReportSources(report.IdReport);

		// Build agent results array
		const agentResults = [
			{
				agent: "geoservice",
				status: geoserviceResult.status,
			},
		];

		// Add Zola result if it exists
		const zolaSource = allSources.find((s) => s.SourceKey === "zola");
		if (zolaSource) {
			agentResults.push({
				agent: "zola",
				status: zolaSource.Status === "succeeded" ? "succeeded" : "failed",
			});
		}

		// Add TransitZones result if it exists
		const transitZonesSource = allSources.find(
			(s) => s.SourceKey === "transit_zones"
		);
		if (transitZonesSource) {
			agentResults.push({
				agent: "transit_zones",
				status:
					transitZonesSource.Status === "succeeded"
						? "succeeded"
						: "failed",
			});
		}

		// Add FEMA Flood result if it exists
		const femaFloodSource = allSources.find(
			(s) => s.SourceKey === "fema_flood"
		);
		if (femaFloodSource) {
			agentResults.push({
				agent: "fema_flood",
				status:
					femaFloodSource.Status === "succeeded"
						? "succeeded"
						: "failed",
			});
		}

		// Add ZoningResolution result if it exists
		const zoningSource = allSources.find((s) => s.SourceKey === "zoning_resolution");
		if (zoningSource) {
			agentResults.push({
				agent: "zoning_resolution",
				status: zoningSource.Status === "succeeded" ? "succeeded" : "failed",
			});
		}

		// Extract Land Use and Zoning Districts from Zola source for admin email
		// Zola agent stores data as ContentJson.contentJson (see zola.js return shape)
		let landUse = null;
		let zoningDistricts = null;
		if (zolaSource?.ContentJson) {
			const raw = zolaSource.ContentJson;
			const z = raw?.contentJson ?? raw;
			landUse = z?.landuse ?? null;
			const districts = [z?.zonedist1, z?.zonedist2, z?.zonedist3, z?.zonedist4].filter(Boolean);
			zoningDistricts = districts.length > 0 ? districts.join(", ") : null;
		}

		return {
			reportId: report.IdReport,
			status: finalStatus,
			bbl: bbl,
			normalizedAddress: normalizedAddress,
			borough: borough || null,
			landUse: landUse || null,
			zoningDistricts: zoningDistricts || null,
			agentResults: agentResults,
		};
	} catch (error) {
		console.error("Error in orchestration:", error);

		// If report was created, mark it as failed
		if (report && report.IdReport) {
			try {
				await updateReportStatus(report.IdReport, "failed");
			} catch (updateError) {
				console.error("Error updating report status:", updateError);
			}
		}

		throw error;
	}
}
