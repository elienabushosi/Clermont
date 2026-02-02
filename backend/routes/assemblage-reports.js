// Assemblage reports routes - generate combined reports for two addresses
import express from "express";
import { generateAssemblageReport } from "../orchestration/assemblage-orchestrator.js";
import { getUserFromToken } from "../lib/auth-utils.js";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

/**
 * POST /api/assemblage-reports/generate
 * Generate an assemblage report for exactly two addresses
 * Body: { addresses: ["addr1", "addr2"] }
 */
router.post("/generate", async (req, res) => {
	try {
		const authHeader = req.headers.authorization;
		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return res.status(401).json({
				status: "error",
				message: "No token provided",
			});
		}

		const token = authHeader.substring(7);
		const userData = await getUserFromToken(token);

		if (!userData) {
			return res.status(401).json({
				status: "error",
				message: "Invalid or expired token",
			});
		}

		// Subscription / free reports check (mirror reports.js)
		const { data: subscription, error: subError } = await supabase
			.from("subscriptions")
			.select("Status")
			.eq("IdOrganization", userData.IdOrganization)
			.eq("Status", "active")
			.order("CreatedAt", { ascending: false })
			.limit(1)
			.single();

		const hasActiveSubscription = !subError && subscription;

		if (userData.Role !== "Owner") {
			if (!hasActiveSubscription) {
				return res.status(403).json({
					status: "error",
					message:
						"Reports are only available to subscribers. Please contact your organization owner to subscribe.",
					requiresSubscription: true,
				});
			}
		} else {
			if (!hasActiveSubscription) {
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
				if (freeReportsUsed >= freeReportsLimit) {
					return res.status(403).json({
						status: "error",
						message:
							"You've used your free reports. Please subscribe to continue generating reports.",
						requiresSubscription: true,
						freeReportsUsed,
						freeReportsLimit,
					});
				}
			}
		}

		// Validate request body
		const { addresses } = req.body;

		if (!addresses || !Array.isArray(addresses)) {
			return res.status(400).json({
				status: "error",
				message: "Request body must include an 'addresses' array",
			});
		}

		if (addresses.length !== 2) {
			return res.status(400).json({
				status: "error",
				message: "V1 requires exactly 2 addresses",
			});
		}

		const trimmed = addresses.map((a) => (typeof a === "string" ? a.trim() : ""));
		const invalid = trimmed.some((a) => !a);
		if (invalid) {
			return res.status(400).json({
				status: "error",
				message: "Each address must be a non-empty string (whitespace-only is invalid)",
			});
		}

		const result = await generateAssemblageReport(
			trimmed,
			userData.IdOrganization,
			userData.IdUser,
			req.body.clientId || null
		);

		// If owner and no subscription, increment free reports (mirror reports.js)
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
			message: "Assemblage report generation completed",
			reportId: result.reportId,
			reportStatus: result.status,
			combinedLotAreaSqft: result.combinedLotAreaSqft,
			totalBuildableSqft: result.totalBuildableSqft,
			farMethod: result.farMethod,
			requires_manual_review: result.requires_manual_review,
			lots: result.lots,
			flags: result.flags,
		});
	} catch (error) {
		console.error("Error generating assemblage report:", error);
		res.status(500).json({
			status: "error",
			message: "Failed to generate assemblage report",
			error: error.message,
		});
	}
});

export default router;
