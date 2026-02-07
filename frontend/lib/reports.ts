// Reports API utilities
import { config } from "./config";

export interface Report {
	IdReport: string;
	Address: string;
	AddressNormalized: string | null;
	Status: "pending" | "ready" | "failed";
	ReportType?: "single" | "assemblage";
	CreatedAt: string;
	UpdatedAt: string;
	ClientName: string | null;
	ClientEmail: string | null;
	CreatedBy: string | null;
	CreatedByName: string | null;
	CreatedByEmail: string | null;
	// Source data fields
	LandUse: string | null;
	BuildingClass: string | null;
	ZoningDistricts: string | null;
	LotArea: number | null;
	MaxFAR: number | null;
	MaxLotCoverage: number | null;
	NumberOfFloors: number | null;
	ResidentialUnits: number | null;
}

/**
 * Fetch all reports for the current user's organization
 * @returns {Promise<Report[]>} Array of reports
 */
export async function getReports(): Promise<Report[]> {
	const token = localStorage.getItem("auth_token");

	if (!token) {
		throw new Error("No authentication token found");
	}

	const response = await fetch(`${config.apiUrl}/api/reports`, {
		method: "GET",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
	});

	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.message || "Failed to fetch reports");
	}

	const data = await response.json();
	return data.reports || [];
}

export interface ReportSource {
	IdReportSource: string;
	SourceKey: string;
	ContentText: string | null;
	ContentJson: any | null;
	SourceUrl: string | null;
	Status: "succeeded" | "failed";
	ErrorMessage: string | null;
	CreatedAt: string;
	UpdatedAt: string;
}

export interface ReportWithSources {
	report: {
		IdReport: string;
		Address: string;
		AddressNormalized: string | null;
		Name: string;
		Description: string | null;
		Status: "pending" | "ready" | "failed";
		ReportType?: "single" | "assemblage";
		CreatedAt: string;
		UpdatedAt: string;
		CreatedBy: string | null;
	};
	client: {
		IdClient: string;
		Name: string;
		Email: string | null;
		PhoneNumber: string | null;
	} | null;
	creator: {
		IdUser: string;
		Name: string;
		Email: string | null;
	} | null;
	sources: ReportSource[];
}

/**
 * Fetch a single report with all its sources
 * @param {string} reportId - Report ID
 * @returns {Promise<ReportWithSources>} Report with sources
 */
export async function getReportWithSources(
	reportId: string
): Promise<ReportWithSources> {
	const token = localStorage.getItem("auth_token");

	if (!token) {
		throw new Error("No authentication token found");
	}

	const response = await fetch(
		`${config.apiUrl}/api/reports/${reportId}`,
		{
			method: "GET",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
		}
	);

	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.message || "Failed to fetch report");
	}

	const data = await response.json();
	return {
		report: data.report,
		client: data.client || null,
		creator: data.creator || null,
		sources: data.sources || [],
	};
}

/**
 * Fetch a single report with all its sources (no auth – for public share link)
 * @param reportId - Report ID
 * @returns Report with sources and optional massingOverrides
 */
export async function getReportWithSourcesPublic(
	reportId: string
): Promise<ReportWithSources & { massingOverrides?: MassingOverrides | null }> {
	const response = await fetch(
		`${config.apiUrl}/api/reports/public/${reportId}`,
		{ method: "GET", headers: { "Content-Type": "application/json" } }
	);
	if (!response.ok) {
		const err = await response.json();
		throw new Error(err.message || "Failed to fetch report");
	}
	const data = await response.json();
	return {
		report: data.report,
		client: data.client || null,
		creator: data.creator || null,
		sources: data.sources || [],
		massingOverrides: data.massingOverrides ?? null,
	};
}

/** Massing overrides shape stored per report (same fields as sandbox + inputsPanelHidden) */
export interface MassingOverrides {
	lotLengthFt?: number;
	lotWidthFt?: number;
	frontWallFt?: number;
	backWallFt?: number;
	leftWallFt?: number;
	rightWallFt?: number;
	baseHeightFt?: number;
	buildingHeightFt?: number;
	setbackStartFt?: number;
	frontSetbackFt?: number;
	maxHeightFt?: number;
	showMaxHeightCage?: boolean;
	xAlign?: "left" | "center" | "right";
	zAlign?: "front" | "center" | "back";
	inputsPanelHidden?: boolean;
}

export async function getReportMassing(reportId: string): Promise<MassingOverrides | null> {
	const token = localStorage.getItem("auth_token");
	if (!token) throw new Error("No authentication token found");
	const response = await fetch(`${config.apiUrl}/api/reports/${reportId}/massing`, {
		method: "GET",
		headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
	});
	if (!response.ok) {
		const err = await response.json();
		throw new Error(err.message || "Failed to fetch report massing");
	}
	const data = await response.json();
	return data.massingOverrides ?? null;
}

export async function patchReportMassing(
	reportId: string,
	massingOverrides: MassingOverrides
): Promise<MassingOverrides> {
	const token = localStorage.getItem("auth_token");
	if (!token) throw new Error("No authentication token found");
	const response = await fetch(`${config.apiUrl}/api/reports/${reportId}/massing`, {
		method: "PATCH",
		headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
		body: JSON.stringify({ massingOverrides }),
	});
	if (!response.ok) {
		const err = await response.json();
		throw new Error(err.message || "Failed to save report massing");
	}
	const data = await response.json();
	return data.massingOverrides;
}
