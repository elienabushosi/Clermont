// Authentication utility functions
import { supabase } from "./supabase.js";

/**
 * Helper function to get user data from token (handles both custom and Supabase Auth tokens)
 * @param {string} token - Authentication token
 * @returns {Promise<{IdUser: string, IdOrganization: string, Email: string, Role: string, Enabled: boolean} | null>} User data or null
 */
export async function getUserFromToken(token) {
	if (!token) return null;

	// Check if token is a custom token (format: custom_${userId}_${timestamp})
	if (token.startsWith("custom_")) {
		// Extract user ID from custom token
		const parts = token.split("_");
		if (parts.length >= 2) {
			const userId = parts[1];

			// Get user directly by ID from our custom users table
			const { data: user, error: userError } = await supabase
				.from("users")
				.select("IdUser, IdOrganization, Email, Name, Role, Enabled")
				.eq("IdUser", userId)
				.single();

			if (userError || !user) {
				return null;
			}

			// Check if user is enabled
			if (user.Enabled === false) {
				return null;
			}

			return user;
		}
		return null;
	}

	// Verify token with Supabase Auth
	const {
		data: { user },
		error,
	} = await supabase.auth.getUser(token);

	if (error || !user) {
		return null;
	}

	// Get user details from our custom users table (case-insensitive)
	const normalizedEmail = user.email.toLowerCase().trim();
	const { data: userData, error: userError } = await supabase
		.from("users")
		.select("IdUser, IdOrganization, Email, Name, Role, Enabled")
		.ilike("Email", normalizedEmail)
		.single();

	if (userError || !userData) {
		return null;
	}

	// Check if user is enabled
	if (userData.Enabled === false) {
		return null;
	}

	return userData;
}
