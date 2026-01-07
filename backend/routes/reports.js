// Reports routes
import express from "express";
import { generateReport } from "../orchestration/orchestrator.js";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

/**
 * POST /api/reports/generate
 * Generate a new report for an address
 */
router.post("/generate", async (req, res) => {
	try {
		// Get auth token from header
		const authHeader = req.headers.authorization;

		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return res.status(401).json({
				status: "error",
				message: "No token provided",
			});
		}

		const token = authHeader.substring(7);

		// Verify token and get user
		const {
			data: { user },
			error: authError,
		} = await supabase.auth.getUser(token);

		if (authError || !user) {
			return res.status(401).json({
				status: "error",
				message: "Invalid or expired token",
			});
		}

		// Get user details from our custom users table
		const { data: userData, error: userError } = await supabase
			.from("users")
			.select("IdUser, IdOrganization")
			.eq("Email", user.email)
			.single();

		if (userError || !userData) {
			return res.status(401).json({
				status: "error",
				message: "User not found",
			});
		}

		// Validate request body
		const { address, normalizedAddress, location, placeId } = req.body;

		if (!address) {
			return res.status(400).json({
				status: "error",
				message: "Address is required",
			});
		}

		// Prepare address data
		const addressData = {
			address: address,
			normalizedAddress: normalizedAddress || address,
			location: location || { lat: null, lng: null },
			placeId: placeId || null,
		};

		// Generate report
		const result = await generateReport(
			addressData,
			userData.IdOrganization,
			userData.IdUser,
			req.body.clientId || null
		);

		res.json({
			status: "success",
			message: "Report generation started",
			reportId: result.reportId,
			status: result.status,
			agentResults: result.agentResults,
		});
	} catch (error) {
		console.error("Error generating report:", error);
		res.status(500).json({
			status: "error",
			message: "Failed to generate report",
			error: error.message,
		});
	}
});

export default router;

