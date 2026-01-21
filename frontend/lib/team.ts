// Team utilities

export interface TeamMember {
	IdUser: string;
	Name: string;
	Email: string;
	Role: string;
	CreatedAt: string;
}

export interface JoinCode {
	IdJoinCode: string;
	Code: string;
	CreatedAt: string;
	ExpiresAt: string;
	UsedAt: string | null;
}

export async function getTeamMembers(): Promise<TeamMember[]> {
	try {
		const token = localStorage.getItem("auth_token");
		if (!token) {
			throw new Error("No authentication token");
		}

		const response = await fetch("http://localhost:3002/api/auth/team", {
			method: "GET",
			headers: {
				Authorization: `Bearer ${token}`,
			},
		});

		if (!response.ok) {
			throw new Error("Failed to fetch team members");
		}

		const data = await response.json();
		return data.teamMembers || [];
	} catch (error) {
		console.error("Error fetching team members:", error);
		throw error;
	}
}

export async function generateJoinCode(): Promise<JoinCode> {
	try {
		const token = localStorage.getItem("auth_token");
		if (!token) {
			throw new Error("No authentication token");
		}

		const response = await fetch(
			"http://localhost:3002/api/auth/joincode/generate",
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
				},
			}
		);

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.message || "Failed to generate join code");
		}

		const data = await response.json();
		return data.joinCode;
	} catch (error) {
		console.error("Error generating join code:", error);
		throw error;
	}
}

export async function getJoinCodes(): Promise<JoinCode[]> {
	try {
		const token = localStorage.getItem("auth_token");
		if (!token) {
			throw new Error("No authentication token");
		}

		const response = await fetch(
			"http://localhost:3002/api/auth/joincode/list",
			{
				method: "GET",
				headers: {
					Authorization: `Bearer ${token}`,
				},
			}
		);

		if (!response.ok) {
			throw new Error("Failed to fetch join codes");
		}

		const data = await response.json();
		return data.joinCodes || [];
	} catch (error) {
		console.error("Error fetching join codes:", error);
		throw error;
	}
}
