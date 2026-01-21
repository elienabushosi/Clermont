// Reports API utilities

export interface Report {
	IdReport: string;
	Address: string;
	AddressNormalized: string | null;
	Status: "pending" | "ready" | "failed";
	CreatedAt: string;
	UpdatedAt: string;
	ClientName: string | null;
	ClientEmail: string | null;
	District: string | null;
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

	const response = await fetch("http://localhost:3002/api/reports", {
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
		CreatedAt: string;
		UpdatedAt: string;
	};
	client: {
		IdClient: string;
		Name: string;
		Email: string | null;
		PhoneNumber: string | null;
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
		`http://localhost:3002/api/reports/${reportId}`,
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
		client: data.client,
		sources: data.sources || [],
	};
}
