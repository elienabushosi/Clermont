// Team utilities

export interface TeamMember {
	IdUser: string;
	Name: string;
	Email: string;
	Role: string;
	CreatedAt: string;
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
