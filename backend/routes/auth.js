// Authentication routes
import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

// Signup endpoint
router.post("/signup", async (req, res) => {
	try {
		const { email, firstName, password, organizationName } = req.body;

		// Validate required fields
		if (!email || !firstName || !password || !organizationName) {
			return res.status(400).json({
				status: "error",
				message: "All fields are required",
			});
		}

		// Validate email format
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			return res.status(400).json({
				status: "error",
				message: "Invalid email format",
			});
		}

		// Validate password length
		if (password.length < 6) {
			return res.status(400).json({
				status: "error",
				message: "Password must be at least 6 characters",
			});
		}

		// Check if user already exists
		const { data: existingUsers, error: checkError } = await supabase
			.from("users")
			.select("IdUser")
			.eq("Email", email);

		// If checkError exists and it's not a "not found" error, return it
		if (checkError && checkError.code !== "PGRST116") {
			console.error("Error checking existing user:", checkError);
			return res.status(500).json({
				status: "error",
				message: "Error checking user existence",
				error: checkError.message,
			});
		}

		// If user exists, return error
		if (existingUsers && existingUsers.length > 0) {
			return res.status(409).json({
				status: "error",
				message: "User with this email already exists",
			});
		}

		// Create organization first
		const { data: organization, error: orgError } = await supabase
			.from("organizations")
			.insert({
				Name: organizationName,
				Type: null, // Can be set later if needed
				CreatedAt: new Date().toISOString(),
				UpdatedAt: new Date().toISOString(),
			})
			.select()
			.single();

		if (orgError) {
			console.error("Organization creation error:", orgError);
			return res.status(500).json({
				status: "error",
				message: "Failed to create organization",
				error: orgError.message,
			});
		}

		// Create user with organization ID
		const { data: user, error: userError } = await supabase
			.from("users")
			.insert({
				IdOrganization: organization.IdOrganization,
				Name: firstName,
				Email: email,
				Password: password, // Note: In production, this should be hashed!
				Role: "Owner", // First user is always Owner
				CreatedAt: new Date().toISOString(),
				UpdatedAt: new Date().toISOString(),
			})
			.select()
			.single();

		if (userError) {
			console.error("User creation error:", userError);
			// If user creation fails, we should ideally rollback organization creation
			// For now, we'll just return an error
			return res.status(500).json({
				status: "error",
				message: "Failed to create user",
				error: userError.message,
			});
		}

		res.status(201).json({
			status: "success",
			message: "User and organization created successfully",
			user: {
				IdUser: user.IdUser,
				Name: user.Name,
				Email: user.Email,
				Role: user.Role,
			},
			organization: {
				IdOrganization: organization.IdOrganization,
				Name: organization.Name,
			},
		});
	} catch (error) {
		console.error("Signup error:", error);
		res.status(500).json({
			status: "error",
			message: "Internal server error",
			error: error.message,
		});
	}
});

// Login endpoint using Supabase Auth
router.post("/login", async (req, res) => {
	try {
		const { email, password } = req.body;

		// Validate required fields
		if (!email || !password) {
			return res.status(400).json({
				status: "error",
				message: "Email and password are required",
			});
		}

		// Validate email format
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			return res.status(400).json({
				status: "error",
				message: "Invalid email format",
			});
		}

		// First, check if user exists in our custom users table
		const { data: user, error: userError } = await supabase
			.from("users")
			.select("IdUser, Email, Password, Name, IdOrganization, Role")
			.eq("Email", email)
			.single();

		if (userError || !user) {
			return res.status(401).json({
				status: "error",
				message: "Invalid email or password",
			});
		}

		// Verify password (in production, this should compare hashed passwords)
		if (user.Password !== password) {
			return res.status(401).json({
				status: "error",
				message: "Invalid email or password",
			});
		}

		// Use Supabase Auth to sign in the user
		// This will create a session and return a JWT token
		const { data: authData, error: authError } =
			await supabase.auth.signInWithPassword({
				email: email,
				password: password,
			});

		// If Supabase Auth user doesn't exist, create one
		if (authError) {
			// If user doesn't exist in Supabase Auth, create them
			if (
				authError.message.includes("Invalid login credentials") ||
				authError.status === 400
			) {
				// Create user in Supabase Auth
				const { data: signUpData, error: signUpError } =
					await supabase.auth.signUp({
						email: email,
						password: password,
					});

				if (signUpError) {
					console.error("Supabase Auth signup error:", signUpError);
					// Even if Supabase Auth fails, we can still authenticate with our custom table
					// Return a token based on our custom authentication
					return res.json({
						status: "success",
						message: "Login successful",
						user: {
							IdUser: user.IdUser,
							Name: user.Name,
							Email: user.Email,
							Role: user.Role,
							IdOrganization: user.IdOrganization,
						},
						token: `custom_${user.IdUser}_${Date.now()}`, // Custom token for now
					});
				}

				// Sign in after creating
				const { data: signInData, error: signInError } =
					await supabase.auth.signInWithPassword({
						email: email,
						password: password,
					});

				if (signInError) {
					console.error("Supabase Auth signin error:", signInError);
					return res.json({
						status: "success",
						message: "Login successful",
						user: {
							IdUser: user.IdUser,
							Name: user.Name,
							Email: user.Email,
							Role: user.Role,
							IdOrganization: user.IdOrganization,
						},
						token:
							signInData?.session?.access_token ||
							`custom_${user.IdUser}_${Date.now()}`,
					});
				}

				return res.json({
					status: "success",
					message: "Login successful",
					user: {
						IdUser: user.IdUser,
						Name: user.Name,
						Email: user.Email,
						Role: user.Role,
						IdOrganization: user.IdOrganization,
					},
					token: signInData.session.access_token,
				});
			}

			console.error("Supabase Auth error:", authError);
			return res.status(500).json({
				status: "error",
				message: "Authentication error",
				error: authError.message,
			});
		}

		// Success - return user data and JWT token
		res.json({
			status: "success",
			message: "Login successful",
			user: {
				IdUser: user.IdUser,
				Name: user.Name,
				Email: user.Email,
				Role: user.Role,
				IdOrganization: user.IdOrganization,
			},
			token: authData.session.access_token,
		});
	} catch (error) {
		console.error("Login error:", error);
		res.status(500).json({
			status: "error",
			message: "Internal server error",
			error: error.message,
		});
	}
});

// Verify token endpoint
router.get("/verify", async (req, res) => {
	try {
		const authHeader = req.headers.authorization;

		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return res.status(401).json({
				status: "error",
				message: "No token provided",
			});
		}

		const token = authHeader.substring(7); // Remove "Bearer " prefix

		// Verify token with Supabase
		const {
			data: { user },
			error,
		} = await supabase.auth.getUser(token);

		if (error || !user) {
			return res.status(401).json({
				status: "error",
				message: "Invalid or expired token",
			});
		}

		// Get user details from our custom users table
		const { data: userData, error: userError } = await supabase
			.from("users")
			.select("IdUser, Name, Email, Role, IdOrganization")
			.eq("Email", user.email)
			.single();

		if (userError || !userData) {
			return res.status(401).json({
				status: "error",
				message: "User not found",
			});
		}

		// Get organization details if user has an organization
		let organizationData = null;
		if (userData.IdOrganization) {
			const { data: orgData, error: orgError } = await supabase
				.from("organizations")
				.select("IdOrganization, Name, Type")
				.eq("IdOrganization", userData.IdOrganization)
				.single();

			if (!orgError && orgData) {
				organizationData = orgData;
			}
		}

		res.json({
			status: "success",
			message: "Token is valid",
			user: userData,
			organization: organizationData,
		});
	} catch (error) {
		console.error("Token verification error:", error);
		res.status(500).json({
			status: "error",
			message: "Error verifying token",
			error: error.message,
		});
	}
});

export default router;
