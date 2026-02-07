// Reports routes
import express from "express";
import { generateReport } from "../orchestration/orchestrator.js";
import { getReportsByOrganization } from "../services/report-service.js";
import { getUserFromToken } from "../lib/auth-utils.js";
import { supabase } from "../lib/supabase.js";
import { sendAdminReportAttemptedNotification, sendAdminReportCreatedNotification } from "../lib/email.js";

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

		// Check subscription and free reports access
		// Get organization subscription status
		const { data: subscription, error: subError } = await supabase
			.from("subscriptions")
			.select("Status")
			.eq("IdOrganization", userData.IdOrganization)
			.eq("Status", "active")
			.order("CreatedAt", { ascending: false })
			.limit(1)
			.single();

		const hasActiveSubscription = !subError && subscription;

		// If user is not Owner, check if owner has subscription
		if (userData.Role !== "Owner") {
			if (!hasActiveSubscription) {
				return res.status(403).json({
					status: "error",
					message: "Reports are only available to subscribers. Please contact your organization owner to subscribe.",
					requiresSubscription: true,
				});
			}
			// Member has access, proceed with report generation
		} else {
			// Owner: Check free reports if no subscription
			if (!hasActiveSubscription) {
				// Get organization free reports info
				const { data: org, error: orgError } = await supabase
					.from("organizations")
					.select("FreeReportsUsed, FreeReportsLimit")
					.eq("IdOrganization", userData.IdOrganization)
					.single();

				if (orgError) {
					console.error("Error fetching organization:", orgError);
					return res.status(500).json({
						status: "error",
						message: "Error checking organization status",
					});
				}

				const freeReportsUsed = org?.FreeReportsUsed || 0;
				const freeReportsLimit = org?.FreeReportsLimit || 2;

				// Check if free reports limit reached
				if (freeReportsUsed >= freeReportsLimit) {
					return res.status(403).json({
						status: "error",
						message: "You've used your test reports. Please become a design partner to continue generating reports.",
						requiresSubscription: true,
						freeReportsUsed: freeReportsUsed,
						freeReportsLimit: freeReportsLimit,
					});
				}
			}
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

		// Notify admin of report attempted (production only; before generateReport so we know request was received)
		const attemptedAtEst = new Date().toLocaleString("en-US", { timeZone: "America/New_York" }) + " EST";
		const { data: orgForNotify } = await supabase
			.from("organizations")
			.select("Name")
			.eq("IdOrganization", userData.IdOrganization)
			.single();
		const orgName = orgForNotify?.Name ?? "—";
		const attemptedResult = await sendAdminReportAttemptedNotification(
			attemptedAtEst,
			userData.Name ?? "—",
			orgName,
			addressData.address
		);
		if (!attemptedResult.success) {
			console.error("Admin report-attempted notification failed:", attemptedResult.error);
		}

		// Generate report
		const result = await generateReport(
			addressData,
			userData.IdOrganization,
			userData.IdUser,
			req.body.clientId || null
		);

		// Notify admin of report result (production only; does not block response)
		const createdAtEst = new Date().toLocaleString("en-US", { timeZone: "America/New_York" }) + " EST";
		const notifyResult = await sendAdminReportCreatedNotification(
			createdAtEst,
			userData.Name ?? "—",
			orgName,
			addressData.address,
			result.borough ?? null,
			result.landUse ?? null,
			result.zoningDistricts ?? null,
			result.status ?? "ready"
		);
		if (!notifyResult.success) {
			console.error("Admin report-created notification failed:", notifyResult.error);
		}

		// If owner and no subscription, increment free reports counter after successful generation
		if (userData.Role === "Owner" && !hasActiveSubscription) {
			const { data: orgForFree } = await supabase
				.from("organizations")
				.select("FreeReportsUsed")
				.eq("IdOrganization", userData.IdOrganization)
				.single();

			if (orgForFree) {
				const newCount = (orgForFree.FreeReportsUsed || 0) + 1;
				await supabase
					.from("organizations")
					.update({
						FreeReportsUsed: newCount,
						UpdatedAt: new Date().toISOString(),
					})
					.eq("IdOrganization", userData.IdOrganization);
			}
		}

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
 * GET /api/reports/:reportId/massing
 * Get massing overrides for a report (JSON blob). Returns null if none saved.
 */
router.get("/:reportId/massing", async (req, res) => {
	try {
		const { reportId } = req.params;
		const authHeader = req.headers.authorization;
		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return res.status(401).json({ status: "error", message: "No token provided" });
		}
		const userData = await getUserFromToken(authHeader.substring(7));
		if (!userData) {
			return res.status(401).json({ status: "error", message: "Invalid or expired token" });
		}
		const { data: report, error } = await supabase
			.from("reports")
			.select("IdReport, MassingOverridesJson")
			.eq("IdReport", reportId)
			.eq("IdOrganization", userData.IdOrganization)
			.single();
		if (error || !report) {
			return res.status(404).json({ status: "error", message: "Report not found" });
		}
		res.json({
			status: "success",
			massingOverrides: report.MassingOverridesJson ?? null,
		});
	} catch (err) {
		console.error("Error fetching report massing:", err);
		res.status(500).json({ status: "error", message: err.message });
	}
});

/**
 * PATCH /api/reports/:reportId/massing
 * Save massing overrides for a report (JSON blob).
 */
router.patch("/:reportId/massing", async (req, res) => {
	try {
		const { reportId } = req.params;
		const authHeader = req.headers.authorization;
		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return res.status(401).json({ status: "error", message: "No token provided" });
		}
		const userData = await getUserFromToken(authHeader.substring(7));
		if (!userData) {
			return res.status(401).json({ status: "error", message: "Invalid or expired token" });
		}
		const { massingOverrides } = req.body;
		if (massingOverrides === undefined) {
			return res.status(400).json({ status: "error", message: "massingOverrides required" });
		}
		const { data, error } = await supabase
			.from("reports")
			.update({
				MassingOverridesJson: massingOverrides,
				UpdatedAt: new Date().toISOString(),
			})
			.eq("IdReport", reportId)
			.eq("IdOrganization", userData.IdOrganization)
			.select("IdReport")
			.single();
		if (error || !data) {
			return res.status(404).json({ status: "error", message: "Report not found or update failed" });
		}
		res.json({ status: "success", massingOverrides });
	} catch (err) {
		console.error("Error saving report massing:", err);
		res.status(500).json({ status: "error", message: err.message });
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
