// Authentication routes
import express from "express";
import { supabase } from "../lib/supabase.js";
import { getUserFromToken } from "../lib/auth-utils.js";

const router = express.Router();

// Signup endpoint
router.post("/signup", async (req, res) => {
	try {
		const { email, firstName, password, organizationName, joinCode } = req.body;

		// Validate required fields
		if (!email || !firstName || !password) {
			return res.status(400).json({
				status: "error",
				message: "Email, first name, and password are required",
			});
		}

		// Must have either organizationName (new org) or joinCode (existing org)
		if (!organizationName && !joinCode) {
			return res.status(400).json({
				status: "error",
				message: "Either organization name or join code is required",
			});
		}

		// Cannot have both
		if (organizationName && joinCode) {
			return res.status(400).json({
				status: "error",
				message: "Cannot provide both organization name and join code",
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

		// Normalize email to lowercase for case-insensitive checking
		const normalizedEmail = email.toLowerCase().trim();

		// Check if user already exists (case-insensitive)
		const { data: existingUsers, error: checkError } = await supabase
			.from("users")
			.select("IdUser")
			.ilike("Email", normalizedEmail);

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

		let organization;
		let userRole = "Owner"; // Default for new orgs

		// Handle join code (existing organization)
		if (joinCode) {
			// Find and validate the join code
			const { data: codeData, error: codeError } = await supabase
				.from("joincodes")
				.select("IdJoinCode, Code, IdOrganization, ExpiresAt, UsedAt")
				.eq("Code", joinCode.toUpperCase())
				.single();

			if (codeError || !codeData) {
				return res.status(400).json({
					status: "error",
					message: "Invalid join code",
				});
			}

			// Check if code is expired
			const now = new Date();
			const expiresAt = new Date(codeData.ExpiresAt);
			if (now > expiresAt) {
				return res.status(400).json({
					status: "error",
					message: "Join code has expired",
				});
			}

			// Check if code is already used
			if (codeData.UsedAt) {
				return res.status(400).json({
					status: "error",
					message: "Join code has already been used",
				});
			}

			// Get organization
			const { data: orgData, error: orgError } = await supabase
				.from("organizations")
				.select("IdOrganization, Name")
				.eq("IdOrganization", codeData.IdOrganization)
				.single();

			if (orgError || !orgData) {
				return res.status(404).json({
					status: "error",
					message: "Organization not found",
				});
			}

			organization = orgData;
			userRole = "Member"; // Users joining via code are Members, not Owners
		} else {
			// Create new organization
			if (!organizationName || organizationName.trim().length === 0) {
				return res.status(400).json({
					status: "error",
					message: "Organization name is required",
				});
			}

			const { data: orgData, error: orgError } = await supabase
				.from("organizations")
				.insert({
					Name: organizationName.trim(),
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

			organization = orgData;
		}

		// Create user with organization ID (store email in lowercase)
		const { data: user, error: userError } = await supabase
			.from("users")
			.insert({
				IdOrganization: organization.IdOrganization,
				Name: firstName,
				Email: normalizedEmail,
				Password: password, // Note: In production, this should be hashed!
				Role: userRole,
				CreatedAt: new Date().toISOString(),
				UpdatedAt: new Date().toISOString(),
			})
			.select()
			.single();

		if (userError) {
			console.error("User creation error:", userError);
			return res.status(500).json({
				status: "error",
				message: "Failed to create user",
				error: userError.message,
			});
		}

		// If using a join code, mark it as used
		if (joinCode) {
			const { error: updateCodeError } = await supabase
				.from("joincodes")
				.update({
					UsedAt: new Date().toISOString(),
					UsedBy: user.IdUser,
				})
				.eq("Code", joinCode.toUpperCase());

			if (updateCodeError) {
				console.error("Error marking join code as used:", updateCodeError);
				// Don't fail the signup, just log the error
			}
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

		// Normalize email to lowercase for case-insensitive comparison
		const normalizedEmail = email.toLowerCase().trim();

		// First, check if user exists in our custom users table (case-insensitive)
		const { data: user, error: userError } = await supabase
			.from("users")
			.select("IdUser, Email, Password, Name, IdOrganization, Role, Enabled")
			.ilike("Email", normalizedEmail)
			.single();

		if (userError || !user) {
			return res.status(401).json({
				status: "error",
				message: "Invalid email or password",
			});
		}

		// Check if user is enabled
		if (user.Enabled === false) {
			return res.status(403).json({
				status: "error",
				message: "Your account has been removed from this organization",
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
				email: normalizedEmail,
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
						email: normalizedEmail,
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
						email: normalizedEmail,
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

		// Get user from token (handles both custom and Supabase Auth tokens)
		const userData = await getUserFromToken(token);

		if (!userData) {
			return res.status(401).json({
				status: "error",
				message: "Invalid or expired token",
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

// Get team members (users in the same organization)
router.get("/team", async (req, res) => {
	try {
		const authHeader = req.headers.authorization;

		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return res.status(401).json({
				status: "error",
				message: "No token provided",
			});
		}

		const token = authHeader.substring(7);

		// Get user from token (handles both custom and Supabase Auth tokens)
		const userData = await getUserFromToken(token);

		if (!userData) {
			return res.status(401).json({
				status: "error",
				message: "Invalid or expired token",
			});
		}

		// Get all enabled users in the same organization
		const { data: teamMembers, error: teamError } = await supabase
			.from("users")
			.select("IdUser, Name, Email, Role, CreatedAt")
			.eq("IdOrganization", userData.IdOrganization)
			.eq("Enabled", true)
			.order("CreatedAt", { ascending: false });

		if (teamError) {
			return res.status(500).json({
				status: "error",
				message: "Failed to fetch team members",
				error: teamError.message,
			});
		}

		res.json({
			status: "success",
			teamMembers: teamMembers || [],
		});
	} catch (error) {
		console.error("Error fetching team members:", error);
		res.status(500).json({
			status: "error",
			message: "Error fetching team members",
			error: error.message,
		});
	}
});

// Generate a join code (owner only)
router.post("/joincode/generate", async (req, res) => {
	try {
		const authHeader = req.headers.authorization;

		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return res.status(401).json({
				status: "error",
				message: "No token provided",
			});
		}

		const token = authHeader.substring(7);

		// Get user from token (handles both custom and Supabase Auth tokens)
		const userData = await getUserFromToken(token);

		if (!userData) {
			return res.status(401).json({
				status: "error",
				message: "Invalid or expired token",
			});
		}

		// Check if user is Owner
		if (userData.Role !== "Owner") {
			return res.status(403).json({
				status: "error",
				message: "Only organization owners can generate join codes",
			});
		}

		// Generate a unique code (format: LINDERO-XXXXXX)
		const generateCode = () => {
			const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Excluding confusing chars
			let code = "LINDERO-";
			for (let i = 0; i < 6; i++) {
				code += chars.charAt(Math.floor(Math.random() * chars.length));
			}
			return code;
		};

		// Ensure code is unique (retry up to 10 times)
		let code;
		let attempts = 0;
		do {
			code = generateCode();
			const { data: existing } = await supabase
				.from("joincodes")
				.select("IdJoinCode")
				.eq("Code", code)
				.single();
			if (!existing) break;
			attempts++;
		} while (attempts < 10);

		if (attempts >= 10) {
			return res.status(500).json({
				status: "error",
				message: "Failed to generate unique code",
			});
		}

		// Set expiration to 7 days from now
		const expiresAt = new Date();
		expiresAt.setDate(expiresAt.getDate() + 7);

		// Create join code
		const { data: joinCode, error: codeError } = await supabase
			.from("joincodes")
			.insert({
				Code: code,
				IdOrganization: userData.IdOrganization,
				CreatedBy: userData.IdUser,
				ExpiresAt: expiresAt.toISOString(),
			})
			.select()
			.single();

		if (codeError) {
			console.error("Join code creation error:", codeError);
			return res.status(500).json({
				status: "error",
				message: "Failed to create join code",
				error: codeError.message,
			});
		}

		res.status(201).json({
			status: "success",
			message: "Join code generated successfully",
			joinCode: {
				IdJoinCode: joinCode.IdJoinCode,
				Code: joinCode.Code,
				ExpiresAt: joinCode.ExpiresAt,
				CreatedAt: joinCode.CreatedAt,
			},
		});
	} catch (error) {
		console.error("Error generating join code:", error);
		res.status(500).json({
			status: "error",
			message: "Error generating join code",
			error: error.message,
		});
	}
});

// Validate a join code and return org info
router.get("/joincode/validate/:code", async (req, res) => {
	try {
		const { code } = req.params;

		if (!code) {
			return res.status(400).json({
				status: "error",
				message: "Join code is required",
			});
		}

		// Find the join code
		const { data: joinCode, error: codeError } = await supabase
			.from("joincodes")
			.select("IdJoinCode, Code, IdOrganization, ExpiresAt, UsedAt")
			.eq("Code", code.toUpperCase())
			.single();

		if (codeError || !joinCode) {
			return res.status(404).json({
				status: "error",
				message: "Invalid join code",
			});
		}

		// Check if code is expired
		const now = new Date();
		const expiresAt = new Date(joinCode.ExpiresAt);
		if (now > expiresAt) {
			return res.status(400).json({
				status: "error",
				message: "Join code has expired",
			});
		}

		// Check if code is already used
		if (joinCode.UsedAt) {
			return res.status(400).json({
				status: "error",
				message: "Join code has already been used",
			});
		}

		// Get organization info
		const { data: organization, error: orgError } = await supabase
			.from("organizations")
			.select("IdOrganization, Name")
			.eq("IdOrganization", joinCode.IdOrganization)
			.single();

		if (orgError || !organization) {
			return res.status(404).json({
				status: "error",
				message: "Organization not found",
			});
		}

		res.json({
			status: "success",
			message: "Join code is valid",
			organization: {
				IdOrganization: organization.IdOrganization,
				Name: organization.Name,
			},
			expiresAt: joinCode.ExpiresAt,
		});
	} catch (error) {
		console.error("Error validating join code:", error);
		res.status(500).json({
			status: "error",
			message: "Error validating join code",
			error: error.message,
		});
	}
});

// List active join codes for an organization (owner only)
router.get("/joincode/list", async (req, res) => {
	try {
		const authHeader = req.headers.authorization;

		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return res.status(401).json({
				status: "error",
				message: "No token provided",
			});
		}

		const token = authHeader.substring(7);

		// Get user from token (handles both custom and Supabase Auth tokens)
		const userData = await getUserFromToken(token);

		if (!userData) {
			return res.status(401).json({
				status: "error",
				message: "Invalid or expired token",
			});
		}

		// Check if user is Owner
		if (userData.Role !== "Owner") {
			return res.status(403).json({
				status: "error",
				message: "Only organization owners can view join codes",
			});
		}

		// Get all active (unused and not expired) join codes for this organization
		const now = new Date().toISOString();
		const { data: joinCodes, error: codesError } = await supabase
			.from("joincodes")
			.select("IdJoinCode, Code, CreatedAt, ExpiresAt, UsedAt")
			.eq("IdOrganization", userData.IdOrganization)
			.is("UsedAt", null)
			.gt("ExpiresAt", now)
			.order("CreatedAt", { ascending: false });

		if (codesError) {
			return res.status(500).json({
				status: "error",
				message: "Failed to fetch join codes",
				error: codesError.message,
			});
		}

		res.json({
			status: "success",
			joinCodes: joinCodes || [],
		});
	} catch (error) {
		console.error("Error fetching join codes:", error);
		res.status(500).json({
			status: "error",
			message: "Error fetching join codes",
			error: error.message,
		});
	}
});

// Remove user from organization (soft delete - owner only)
router.delete("/team/:userId", async (req, res) => {
	try {
		const authHeader = req.headers.authorization;

		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return res.status(401).json({
				status: "error",
				message: "No token provided",
			});
		}

		const token = authHeader.substring(7);
		const { userId } = req.params;

		if (!userId) {
			return res.status(400).json({
				status: "error",
				message: "User ID is required",
			});
		}

		// Get current user from token (handles both custom and Supabase Auth tokens)
		const currentUserData = await getUserFromToken(token);

		if (!currentUserData) {
			return res.status(401).json({
				status: "error",
				message: "Invalid or expired token",
			});
		}

		// Check if user is Owner
		if (currentUserData.Role !== "Owner") {
			return res.status(403).json({
				status: "error",
				message: "Only organization owners can remove team members",
			});
		}

		// Prevent owner from removing themselves
		if (currentUserData.IdUser === userId) {
			return res.status(400).json({
				status: "error",
				message: "You cannot remove yourself from the organization",
			});
		}

		// Get the user to be removed
		const { data: userToRemove, error: targetUserError } = await supabase
			.from("users")
			.select("IdUser, IdOrganization, Role")
			.eq("IdUser", userId)
			.single();

		if (targetUserError || !userToRemove) {
			return res.status(404).json({
				status: "error",
				message: "User not found",
			});
		}

		// Verify the user belongs to the same organization
		if (userToRemove.IdOrganization !== currentUserData.IdOrganization) {
			return res.status(403).json({
				status: "error",
				message: "User does not belong to your organization",
			});
		}

		// Prevent removing another owner (optional - you may want to allow this)
		if (userToRemove.Role === "Owner") {
			return res.status(400).json({
				status: "error",
				message: "Cannot remove another owner",
			});
		}

		// Soft delete: Set Enabled to false
		const { data: updatedUser, error: updateError } = await supabase
			.from("users")
			.update({ Enabled: false })
			.eq("IdUser", userId)
			.select()
			.single();

		if (updateError) {
			console.error("Error removing user:", updateError);
			return res.status(500).json({
				status: "error",
				message: "Failed to remove user",
				error: updateError.message,
			});
		}

		res.json({
			status: "success",
			message: "User removed successfully",
			user: {
				IdUser: updatedUser.IdUser,
				Name: updatedUser.Name,
				Email: updatedUser.Email,
			},
		});
	} catch (error) {
		console.error("Error removing user:", error);
		res.status(500).json({
			status: "error",
			message: "Error removing user",
			error: error.message,
		});
	}
});

export default router;
