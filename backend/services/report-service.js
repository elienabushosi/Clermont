// Report service - handles database operations for reports
import { supabase } from "../lib/supabase.js";

/**
 * Create a new report record
 * @param {Object} reportData - Report data
 * @param {string} reportData.address - Address string
 * @param {string} reportData.normalizedAddress - Normalized address (optional)
 * @param {string} reportData.organizationId - Organization ID
 * @param {string} reportData.clientId - Client ID (optional)
 * @param {string} reportData.createdBy - User ID who created the report (optional)
 * @param {string} reportData.name - Report name
 * @param {string} reportData.reportType - Report type: "single" (default) or "assemblage"
 * @param {string} reportData.bbl - BBL identifier (optional, will be set by Geoservice)
 * @param {number} reportData.latitude - Latitude (optional)
 * @param {number} reportData.longitude - Longitude (optional)
 * @returns {Promise<Object>} Created report
 */
export async function createReport(reportData) {
	const reportType = reportData.reportType === "assemblage" ? "assemblage" : "single";
	const { data, error } = await supabase
		.from("reports")
		.insert({
			IdOrganization: reportData.organizationId,
			IdClient: reportData.clientId || null,
			CreatedBy: reportData.createdBy || null,
			Name: reportData.name || reportData.address,
			Address: reportData.address,
			AddressNormalized: reportData.normalizedAddress || null,
			BBL: reportData.bbl || null,
			Latitude: reportData.latitude || null,
			Longitude: reportData.longitude || null,
			Status: "pending",
			Enabled: true,
			ReportType: reportType,
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
 * Update report with BBL and location data from Geoservice
 * @param {string} reportId - Report ID
 * @param {Object} geoserviceData - Geoservice extracted data
 * @param {string} geoserviceData.bbl - BBL identifier
 * @param {string} geoserviceData.normalizedAddress - Normalized address
 * @param {number} geoserviceData.lat - Latitude
 * @param {number} geoserviceData.lng - Longitude
 * @returns {Promise<Object>} Updated report
 */
export async function updateReportWithGeoserviceData(
	reportId,
	geoserviceData
) {
	const updateData = {};

	if (geoserviceData.bbl) {
		updateData.BBL = geoserviceData.bbl;
	}
	if (geoserviceData.normalizedAddress) {
		updateData.AddressNormalized = geoserviceData.normalizedAddress;
	}
	if (geoserviceData.lat !== null && geoserviceData.lat !== undefined) {
		updateData.Latitude = geoserviceData.lat;
	}
	if (geoserviceData.lng !== null && geoserviceData.lng !== undefined) {
		updateData.Longitude = geoserviceData.lng;
	}

	if (Object.keys(updateData).length === 0) {
		return null; // Nothing to update
	}

	const { data, error } = await supabase
		.from("reports")
		.update(updateData)
		.eq("IdReport", reportId)
		.select()
		.single();

	if (error) {
		console.error("Error updating report with Geoservice data:", error);
		throw new Error(
			`Failed to update report with Geoservice data: ${error.message}`
		);
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
		throw new Error(`Failed to fetch report sources: ${error.message}`);
	}

	return data || [];
}

/**
 * Get a single report with all its sources
 * @param {string} reportId - Report ID
 * @param {string} organizationId - Organization ID (for security check)
 * @returns {Promise<Object>} Report with sources
 */
export async function getReportWithSources(reportId, organizationId) {
	// First, get the report and verify it belongs to the organization
	const { data: report, error: reportError } = await supabase
		.from("reports")
		.select("*")
		.eq("IdReport", reportId)
		.eq("IdOrganization", organizationId)
		.single();

	if (reportError || !report) {
		throw new Error("Report not found or access denied");
	}

	// Get client information if report has a client
	let clientData = null;
	if (report.IdClient) {
		const { data: client, error: clientError } = await supabase
			.from("clients")
			.select("IdClient, Name, Email, PhoneNumber")
			.eq("IdClient", report.IdClient)
			.single();

		if (!clientError && client) {
			clientData = client;
		}
	}

	// Get creator information if report has a creator
	let creatorData = null;
	if (report.CreatedBy) {
		const { data: creator, error: creatorError } = await supabase
			.from("users")
			.select("IdUser, Name, Email")
			.eq("IdUser", report.CreatedBy)
			.single();

		if (!creatorError && creator) {
			creatorData = creator;
		}
	}

	// Get all report sources
	const { data: sources, error: sourcesError } = await supabase
		.from("report_sources")
		.select(
			"IdReportSource, SourceKey, ContentText, ContentJson, SourceUrl, Status, ErrorMessage, CreatedAt, UpdatedAt"
		)
		.eq("IdReport", reportId)
		.order("CreatedAt", { ascending: true });

	if (sourcesError) {
		console.error("Error fetching report sources:", sourcesError);
		// Don't throw - return report without sources if sources fail
	}

	return {
		report: {
			IdReport: report.IdReport,
			Address: report.Address,
			AddressNormalized: report.AddressNormalized,
			Name: report.Name,
			Description: report.Description,
			Status: report.Status,
			ReportType: report.ReportType ?? "single",
			CreatedAt: report.CreatedAt,
			UpdatedAt: report.UpdatedAt,
			CreatedBy: report.CreatedBy || null,
		},
		client: clientData,
		creator: creatorData,
		sources: sources || [],
	};
}

/**
 * Get all reports for an organization with client information
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Array>} Array of reports with client names
 */
export async function getReportsByOrganization(organizationId) {
	// First, get all reports
	const { data: reports, error: reportsError } = await supabase
		.from("reports")
		.select(
			"IdReport, Address, AddressNormalized, Status, CreatedAt, UpdatedAt, IdClient, CreatedBy, ReportType"
		)
		.eq("IdOrganization", organizationId)
		.eq("Enabled", true)
		.order("CreatedAt", { ascending: false });

	if (reportsError) {
		console.error("Error fetching reports:", reportsError);
		throw new Error(`Failed to fetch reports: ${reportsError.message}`);
	}

	if (!reports || reports.length === 0) {
		return [];
	}

	// Get client IDs that exist
	const clientIds = reports
		.map((r) => r.IdClient)
		.filter((id) => id !== null);

	// Fetch clients if there are any
	let clientsMap = {};
	if (clientIds.length > 0) {
		const { data: clients, error: clientsError } = await supabase
			.from("clients")
			.select("IdClient, Name, Email")
			.in("IdClient", clientIds);

		if (!clientsError && clients) {
			clientsMap = clients.reduce((acc, client) => {
				acc[client.IdClient] = client;
				return acc;
			}, {});
		}
	}

	// Get user IDs that created reports
	const userIds = reports
		.map((r) => r.CreatedBy)
		.filter((id) => id !== null);

	// Fetch users if there are any
	let usersMap = {};
	if (userIds.length > 0) {
		const { data: users, error: usersError } = await supabase
			.from("users")
			.select("IdUser, Name, Email")
			.in("IdUser", userIds);

		if (!usersError && users) {
			usersMap = users.reduce((acc, user) => {
				acc[user.IdUser] = user;
				return acc;
			}, {});
		}
	}

	// Get report IDs to fetch source data
	const reportIds = reports.map((r) => r.IdReport);

	// Fetch zola sources to get property data
	let zolaDataMap = {};
	if (reportIds.length > 0) {
		const { data: zolaSources, error: zolaError } = await supabase
			.from("report_sources")
			.select("IdReport, ContentJson")
			.eq("SourceKey", "zola")
			.in("IdReport", reportIds)
			.eq("Status", "succeeded");

		if (!zolaError && zolaSources) {
			zolaSources.forEach((source) => {
				if (source.ContentJson) {
					const zolaData =
						source.ContentJson.contentJson ||
						source.ContentJson;
					zolaDataMap[source.IdReport] = zolaData;
				}
			});
		}
	}

	// Fetch zoning-resolution sources to get zoning calculations
	let zoningDataMap = {};
	if (reportIds.length > 0) {
		const { data: zoningSources, error: zoningError } = await supabase
			.from("report_sources")
			.select("IdReport, ContentJson")
			.eq("SourceKey", "zoning-resolution")
			.in("IdReport", reportIds)
			.eq("Status", "succeeded");

		if (!zoningError && zoningSources) {
			zoningSources.forEach((source) => {
				if (source.ContentJson) {
					zoningDataMap[source.IdReport] = source.ContentJson;
				}
			});
		}
	}

	// Combine reports with client information, creator information, and source data
	return reports.map((report) => {
		const client = report.IdClient ? clientsMap[report.IdClient] : null;
		const creator = report.CreatedBy ? usersMap[report.CreatedBy] : null;
		const zolaData = zolaDataMap[report.IdReport] || {};
		const zoningData = zoningDataMap[report.IdReport] || {};

		// Extract zoning districts
		const zoningDistricts = [
			zolaData.zonedist1,
			zolaData.zonedist2,
			zolaData.zonedist3,
			zolaData.zonedist4,
		]
			.filter(Boolean)
			.join(", ") || null;

		return {
			IdReport: report.IdReport,
			Address: report.Address,
			AddressNormalized: report.AddressNormalized,
			Status: report.Status,
			ReportType: report.ReportType ?? "single",
			CreatedAt: report.CreatedAt,
			UpdatedAt: report.UpdatedAt,
			ClientName: client?.Name || null,
			ClientEmail: client?.Email || null,
			CreatedBy: report.CreatedBy || null,
			CreatedByName: creator?.Name || null,
			CreatedByEmail: creator?.Email || null,
			// Source data fields
			LandUse: zolaData.landuse || null,
			BuildingClass: zolaData.bldgclass || null,
			ZoningDistricts: zoningDistricts,
			LotArea: zolaData.lotarea || null,
			MaxFAR: zoningData.maxFar || null,
			MaxLotCoverage: zoningData.maxLotCoverage || null,
			NumberOfFloors: zolaData.numfloors || null,
			ResidentialUnits: zolaData.unitsres || null,
		};
	});
}
