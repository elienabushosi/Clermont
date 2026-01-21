// Reports routes
import express from "express";
import { generateReport } from "../orchestration/orchestrator.js";
import { getReportsByOrganization } from "../services/report-service.js";
import { getUserFromToken } from "../lib/auth-utils.js";

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

		// Get user from token (handles both custom and Supabase Auth tokens)
		const userData = await getUserFromToken(token);

		if (!userData) {
			return res.status(401).json({
				status: "error",
				message: "Invalid or expired token",
			});
		}

		// Validate request body
		// V1: Accept only address string (backend will resolve via Geoservice)
		const { address } = req.body;

		if (
			!address ||
			typeof address !== "string" ||
			address.trim().length === 0
		) {
			return res.status(400).json({
				status: "error",
				message: "Address is required and must be a non-empty string",
			});
		}

		// Prepare address data (minimal - backend will resolve via Geoservice)
		const addressData = {
			address: address.trim(),
			// Optional hints from frontend (if provided, will be used but Geoservice is source of truth)
			normalizedAddress: req.body.normalizedAddress || null,
			location: req.body.location || null,
			placeId: req.body.placeId || null,
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

/**
 * GET /api/reports
 * Get all reports for the authenticated user's organization
 */
router.get("/", async (req, res) => {
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

		// Get user from token (handles both custom and Supabase Auth tokens)
		const userData = await getUserFromToken(token);

		if (!userData) {
			return res.status(401).json({
				status: "error",
				message: "Invalid or expired token",
			});
		}

		// Get reports for the organization
		const reports = await getReportsByOrganization(userData.IdOrganization);

		res.json({
			status: "success",
			reports: reports,
		});
	} catch (error) {
		console.error("Error fetching reports:", error);
		res.status(500).json({
			status: "error",
			message: "Failed to fetch reports",
			error: error.message,
		});
	}
});

/**
 * GET /api/reports/:reportId
 * Get a single report with all its sources
 */
router.get("/:reportId", async (req, res) => {
	try {
		const { reportId } = req.params;

		// Get auth token from header
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

		// Get report with sources
		const { getReportWithSources } = await import(
			"../services/report-service.js"
		);
		const reportData = await getReportWithSources(
			reportId,
			userData.IdOrganization
		);

		res.json({
			status: "success",
			...reportData,
		});
	} catch (error) {
		console.error("Error fetching report:", error);
		res.status(500).json({
			status: "error",
			message: "Failed to fetch report",
			error: error.message,
		});
	}
});

export default router;
