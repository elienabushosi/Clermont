// Orchestration layer - coordinates agent execution and report generation
import {
	getAgentBySourceKey,
} from "./agents/index.js";
import {
	createReport,
	storeAgentResult,
	updateReportStatus,
	updateReportWithGeoserviceData,
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
			name: addressData.address,
		});

		console.log(`Report created with ID: ${report.IdReport}`);

		// 2. Run GeoserviceAgent FIRST (required - must succeed)
		const geoserviceAgent = getAgentBySourceKey("geoservice");
		if (!geoserviceAgent) {
			throw new Error("GeoserviceAgent not found");
		}

		console.log("Executing GeoserviceAgent...");
		const geoserviceResult = await geoserviceAgent.execute(
			{ address: addressData.address },
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

		const { bbl, normalizedAddress, lat, lng } = geoserviceData.extracted;

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

		// 5. Determine final report status
		// For V1, if Geoservice succeeded, mark as 'ready'
		// (ZolaAgent failure is non-critical for now)
		const finalStatus = "ready";

		// Update report status
		await updateReportStatus(report.IdReport, finalStatus);

		console.log(
			`Report ${report.IdReport} completed with status: ${finalStatus}`
		);

		return {
			reportId: report.IdReport,
			status: finalStatus,
			bbl: bbl,
			normalizedAddress: normalizedAddress,
			agentResults: [
				{
					agent: "geoservice",
					status: geoserviceResult.status,
				},
			],
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
