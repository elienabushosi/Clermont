// Report service - handles database operations for reports
import { supabase } from "../lib/supabase.js";

/**
 * Create a new report record
 * @param {Object} reportData - Report data
 * @param {string} reportData.address - Address string
 * @param {string} reportData.normalizedAddress - Normalized address
 * @param {string} reportData.organizationId - Organization ID
 * @param {string} reportData.clientId - Client ID (optional)
 * @param {string} reportData.name - Report name
 * @returns {Promise<Object>} Created report
 */
export async function createReport(reportData) {
	const { data, error } = await supabase
		.from("reports")
		.insert({
			IdOrganization: reportData.organizationId,
			IdClient: reportData.clientId || null,
			Name: reportData.name || reportData.address,
			Address: reportData.address,
			AddressNormalized: reportData.normalizedAddress || null,
			Status: "pending",
			Enabled: true,
		})
		.select()
		.single();

	if (error) {
		console.error("Error creating report:", error);
		throw new Error(`Failed to create report: ${error.message}`);
	}

	return data;
}

/**
 * Store agent result in report_sources table
 * @param {string} reportId - Report ID
 * @param {string} sourceKey - Source key (e.g., 'zola', 'tax_lot_finder')
 * @param {Object} result - Agent execution result
 * @param {string} result.status - 'succeeded' or 'failed'
 * @param {Object} result.data - Agent data (if succeeded)
 * @param {string} result.error - Error message (if failed)
 * @returns {Promise<Object>} Created report source
 */
export async function storeAgentResult(reportId, sourceKey, result) {
	const { data, error } = await supabase
		.from("report_sources")
		.insert({
			IdReport: reportId,
			SourceKey: sourceKey,
			ContentJson: result.data ? result.data : null,
			ContentText: result.data
				? JSON.stringify(result.data, null, 2)
				: null,
			Status: result.status === "succeeded" ? "succeeded" : "failed",
			ErrorMessage: result.error || null,
		})
		.select()
		.single();

	if (error) {
		console.error(`Error storing ${sourceKey} result:`, error);
		throw new Error(
			`Failed to store ${sourceKey} result: ${error.message}`
		);
	}

	return data;
}

/**
 * Update report status
 * @param {string} reportId - Report ID
 * @param {string} status - New status ('pending', 'ready', 'failed')
 * @returns {Promise<Object>} Updated report
 */
export async function updateReportStatus(reportId, status) {
	const { data, error } = await supabase
		.from("reports")
		.update({ Status: status })
		.eq("IdReport", reportId)
		.select()
		.single();

	if (error) {
		console.error("Error updating report status:", error);
		throw new Error(`Failed to update report status: ${error.message}`);
	}

	return data;
}

/**
 * Get report by ID
 * @param {string} reportId - Report ID
 * @returns {Promise<Object>} Report data
 */
export async function getReportById(reportId) {
	const { data, error } = await supabase
		.from("reports")
		.select("*")
		.eq("IdReport", reportId)
		.single();

	if (error) {
		console.error("Error fetching report:", error);
		throw new Error(`Failed to fetch report: ${error.message}`);
	}

	return data;
}

/**
 * Get all report sources for a report
 * @param {string} reportId - Report ID
 * @returns {Promise<Array>} Array of report sources
 */
export async function getReportSources(reportId) {
	const { data, error } = await supabase
		.from("report_sources")
		.select("*")
		.eq("IdReport", reportId);

	if (error) {
		console.error("Error fetching report sources:", error);
		throw new Error(
			`Failed to fetch report sources: ${error.message}`
		);
	}

	return data || [];
}

