// Authentication utilities

export function getAuthToken(): string | null {
	if (typeof window === "undefined") return null;
	return localStorage.getItem("auth_token");
}

export function setAuthToken(token: string): void {
	if (typeof window === "undefined") return;
	localStorage.setItem("auth_token", token);
}

export function removeAuthToken(): void {
	if (typeof window === "undefined") return;
	localStorage.removeItem("auth_token");
}

export function isAuthenticated(): boolean {
	return getAuthToken() !== null;
}

// Verify token with backend
export async function verifyToken(token: string): Promise<boolean> {
	try {
		const response = await fetch("http://localhost:3002/api/auth/verify", {
			method: "GET",
			headers: {
				Authorization: `Bearer ${token}`,
			},
		});

		return response.ok;
	} catch (error) {
		console.error("Token verification error:", error);
		return false;
	}
}

// Get current user data with organization
export async function getCurrentUser(): Promise<{
	user: {
		IdUser: string;
		Name: string;
		Email: string;
		Role: string;
		IdOrganization: string | null;
	};
	organization: {
		IdOrganization: string;
		Name: string;
		Type: string | null;
	} | null;
} | null> {
	try {
		const token = getAuthToken();
		if (!token) return null;

		const response = await fetch("http://localhost:3002/api/auth/verify", {
			method: "GET",
			headers: {
				Authorization: `Bearer ${token}`,
			},
		});

		if (!response.ok) return null;

		const data = await response.json();
		return {
			user: data.user,
			organization: data.organization || null,
		};
	} catch (error) {
		console.error("Error fetching user data:", error);
		return null;
	}
}
