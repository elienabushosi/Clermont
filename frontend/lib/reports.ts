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

