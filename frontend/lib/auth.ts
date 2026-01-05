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

