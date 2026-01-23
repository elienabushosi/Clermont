// Authentication utilities
import { config } from "./config";

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
		const response = await fetch(`${config.apiUrl}/api/auth/verify`, {
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

		const response = await fetch(`${config.apiUrl}/api/auth/verify`, {
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

// Request password reset code
export async function requestPasswordReset(): Promise<void> {
	try {
		const token = getAuthToken();
		if (!token) {
			throw new Error("No authentication token");
		}

		const response = await fetch(
			`${config.apiUrl}/api/auth/password/request-reset`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
			}
		);

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.message || "Failed to request password reset");
		}
	} catch (error) {
		console.error("Error requesting password reset:", error);
		throw error;
	}
}

// Reset password with code
export async function resetPassword(
	code: string,
	newPassword: string
): Promise<void> {
	try {
		const token = getAuthToken();
		if (!token) {
			throw new Error("No authentication token");
		}

		const response = await fetch(
			`${config.apiUrl}/api/auth/password/reset`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ code, newPassword }),
			}
		);

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.message || "Failed to reset password");
		}
	} catch (error) {
		console.error("Error resetting password:", error);
		throw error;
	}
}
