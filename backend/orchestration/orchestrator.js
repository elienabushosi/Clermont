// Orchestration layer - coordinates agent execution and report generation
import { getEnabledAgents } from "./agents/index.js";
import {
	createReport,
	storeAgentResult,
	updateReportStatus,
} from "../services/report-service.js";

/**
 * Generate a report by orchestrating all agents
 * @param {Object} addressData - Address information from frontend
 * @param {string} addressData.address - Full address string
 * @param {string} addressData.normalizedAddress - Normalized address
 * @param {Object} addressData.location - Location coordinates
 * @param {string} addressData.placeId - Google Places ID
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
	try {
		// 1. Create report record with 'pending' status
		console.log(`Creating report for address: ${addressData.address}`);
		const report = await createReport({
			address: addressData.address,
			normalizedAddress: addressData.normalizedAddress,
			organizationId: organizationId,
			clientId: clientId,
			name: addressData.address,
		});

		console.log(`Report created with ID: ${report.IdReport}`);

		// 2. Get enabled agents
		const agents = getEnabledAgents();
		console.log(`Executing ${agents.length} enabled agent(s)`);

		// 3. Execute agents in parallel
		const agentPromises = agents.map(async (agent) => {
			try {
				const result = await agent.execute(addressData, report.IdReport);
				// Store result in database
				await storeAgentResult(
					report.IdReport,
					agent.sourceKey,
					result
				);
				return { agent: agent.sourceKey, result, success: true };
			} catch (error) {
				console.error(`Error executing ${agent.sourceKey}:`, error);
				// Store error result
				await storeAgentResult(report.IdReport, agent.sourceKey, {
					status: "failed",
					data: null,
					error: error.message,
				});
				return {
					agent: agent.sourceKey,
					result: {
						status: "failed",
						error: error.message,
					},
					success: false,
				};
			}
		});

		// Wait for all agents to complete (using allSettled to handle failures gracefully)
		const results = await Promise.allSettled(agentPromises);

		// Process results
		const agentResults = results.map((result) => {
			if (result.status === "fulfilled") {
				return result.value;
			} else {
				return {
					agent: "unknown",
					result: { status: "failed", error: result.reason },
					success: false,
				};
			}
		});

		// 4. Determine final report status
		const allSucceeded = agentResults.every((r) => r.success);
		const anySucceeded = agentResults.some((r) => r.success);

		let finalStatus = "failed";
		if (allSucceeded) {
			finalStatus = "ready";
		} else if (anySucceeded) {
			// If at least one agent succeeded, mark as ready (partial success)
			finalStatus = "ready";
		}

		// 5. Update report status
		await updateReportStatus(report.IdReport, finalStatus);

		console.log(
			`Report ${report.IdReport} completed with status: ${finalStatus}`
		);

		// 6. TODO: Generate report summary if status is 'ready'
		// This will be implemented later with AI summary generation

		return {
			reportId: report.IdReport,
			status: finalStatus,
			agentResults: agentResults.map((r) => ({
				agent: r.agent,
				status: r.result.status,
			})),
		};
	} catch (error) {
		console.error("Error in orchestration:", error);
		throw error;
	}
}

