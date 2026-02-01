/**
 * Email routes – test and (later) password reset via Resend.
 */
import express from "express";
import { sendTestEmail } from "../lib/email.js";

const router = express.Router();

/**
 * POST /api/email/send-test
 * Send a test email to the given address (for verifying Resend setup).
 * Body: { "email": "you@example.com" }
 */
router.post("/send-test", async (req, res) => {
	try {
		const { email } = req.body;
		if (!email || typeof email !== "string") {
			return res.status(400).json({
				status: "error",
				message: "Body must include 'email' (string)",
			});
		}
		const trimmed = email.trim().toLowerCase();
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(trimmed)) {
			return res.status(400).json({
				status: "error",
				message: "Invalid email format",
			});
		}
		const result = await sendTestEmail(trimmed);
		if (!result.success) {
			return res.status(500).json({
				status: "error",
				message: "Failed to send test email",
				error: result.error,
			});
		}
		res.json({
			status: "success",
			message: "Test email sent",
			id: result.id,
		});
	} catch (error) {
		console.error("Error sending test email:", error);
		res.status(500).json({
			status: "error",
			message: "Error sending test email",
			error: error.message,
		});
	}
});

export default router;
