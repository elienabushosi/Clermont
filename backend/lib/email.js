/**
 * Email service via Resend.
 * Uses RESEND_API_KEY from env – .env.development for dev, .env.production for prod (same pattern as Stripe).
 */
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL || "Clermont <onboarding@resend.dev>";

const resend = apiKey ? new Resend(apiKey) : null;

/**
 * Send a simple test email.
 * @param {string} to - Recipient email address
 * @returns {{ success: boolean, id?: string, error?: string }}
 */
export async function sendTestEmail(to) {
	if (!resend) {
		return { success: false, error: "Resend not configured (missing RESEND_API_KEY)" };
	}
	const { data, error } = await resend.emails.send({
		from: fromEmail,
		to: [to],
		subject: "Clermont – Test Email",
		html: "<p>This is a test email from your Clermont backend. Resend is working.</p>",
	});
	if (error) return { success: false, error: error.message };
	return { success: true, id: data?.id };
}

/**
 * Send password reset email with link and code (for use when wiring forgot-password to Resend).
 * @param {string} to - User email
 * @param {string} resetLink - Full URL e.g. FRONTEND_URL/login?resetCode=123456
 * @param {string} code - 6-digit code (for display in body)
 * @returns {{ success: boolean, id?: string, error?: string }}
 */
export async function sendPasswordResetEmail(to, resetLink, code) {
	if (!resend) {
		return { success: false, error: "Resend not configured (missing RESEND_API_KEY)" };
	}
	const html = `
		<p>You requested to reset your password.</p>
		<p>Your code: <strong>${code}</strong></p>
		<p><a href="${resetLink}">Reset password</a></p>
		<p>If you didn't request this, you can ignore this email.</p>
	`;
	const { data, error } = await resend.emails.send({
		from: fromEmail,
		to: [to],
		subject: "Clermont – Reset your password",
		html,
	});
	if (error) return { success: false, error: error.message };
	return { success: true, id: data?.id };
}

/**
 * Send admin a "new signup" notification. Only sends when NODE_ENV === 'production'.
 * @param {string} userEmail - New user's email
 * @param {string} userName - New user's name
 * @param {string} orgName - Organization name they signed up with
 * @param {string} [signupAt] - ISO timestamp of signup (e.g. user.CreatedAt)
 * @returns {{ success: boolean, id?: string, error?: string }}
 */
export async function sendAdminNewSignupNotification(userEmail, userName, orgName, signupAt) {
	if (process.env.NODE_ENV !== "production") {
		return { success: true };
	}
	const adminEmail = process.env.ADMIN_EMAIL;
	if (!adminEmail || !resend) {
		return { success: true };
	}
	const signupEst = signupAt
		? new Date(signupAt).toLocaleString("en-US", { timeZone: "America/New_York" }) + " EST"
		: "—";
	const html = `
		<p>A new user signed up for Clermont.</p>
		<ul>
			<li><strong>Email:</strong> ${userEmail}</li>
			<li><strong>Name:</strong> ${userName}</li>
			<li><strong>Organization:</strong> ${orgName}</li>
			<li><strong>Signed up:</strong> ${signupEst}</li>
		</ul>
	`;
	const { data, error } = await resend.emails.send({
		from: fromEmail,
		to: [adminEmail],
		subject: "Clermont – New signup",
		html,
	});
	if (error) return { success: false, error: error.message };
	return { success: true, id: data?.id };
}

/**
 * Send admin a "report attempted" notification (user clicked Generate). Only sends when NODE_ENV === 'production'.
 * @param {string} attemptedAtEst - Date/time of attempt in EST (formatted string)
 * @param {string} userName - User who started the report
 * @param {string} orgName - Organization name
 * @param {string} address - Address they entered
 * @returns {{ success: boolean, id?: string, error?: string }}
 */
export async function sendAdminReportAttemptedNotification(
	attemptedAtEst,
	userName,
	orgName,
	address
) {
	if (process.env.NODE_ENV !== "production") {
		return { success: true };
	}
	const adminEmail = process.env.ADMIN_EMAIL;
	if (!adminEmail || !resend) {
		return { success: true };
	}
	const safeName = (userName && String(userName).trim()) ? userName : "—";
	const html = `
		<p>A report was attempted in Clermont.</p>
		<ul>
			<li><strong>Date/Time (EST):</strong> ${attemptedAtEst}</li>
			<li><strong>User name:</strong> ${safeName}</li>
			<li><strong>Organization:</strong> ${orgName}</li>
			<li><strong>Address:</strong> ${address}</li>
		</ul>
	`;
	const { data, error } = await resend.emails.send({
		from: fromEmail,
		to: [adminEmail],
		subject: `Clermont – ${safeName} report attempted`,
		html,
	});
	if (error) return { success: false, error: error.message };
	return { success: true, id: data?.id };
}

/**
 * Send admin a "report created" notification (result). Only sends when NODE_ENV === 'production'.
 * @param {string} createdAtEst - Date/time of report completion in EST (formatted string)
 * @param {string} userName - User who created the report
 * @param {string} orgName - Organization name
 * @param {string} address - Report address
 * @param {string|null} borough - NYC borough from first service that provides it (e.g. Geoservice)
 * @param {string} reportStatus - "ready" or "failed"
 * @returns {{ success: boolean, id?: string, error?: string }}
 */
export async function sendAdminReportCreatedNotification(
	createdAtEst,
	userName,
	orgName,
	address,
	borough,
	reportStatus
) {
	if (process.env.NODE_ENV !== "production") {
		return { success: true };
	}
	const adminEmail = process.env.ADMIN_EMAIL;
	if (!adminEmail || !resend) {
		return { success: true };
	}
	const boroughDisplay = borough && String(borough).trim() ? borough : "—";
	const safeName = (userName && String(userName).trim()) ? userName : "—";
	const html = `
		<p>Report result in Clermont.</p>
		<ul>
			<li><strong>Date/Time (EST):</strong> ${createdAtEst}</li>
			<li><strong>User name:</strong> ${safeName}</li>
			<li><strong>Organization:</strong> ${orgName}</li>
			<li><strong>Address:</strong> ${address}</li>
			<li><strong>NYC Borough:</strong> ${boroughDisplay}</li>
			<li><strong>Report Status:</strong> ${reportStatus}</li>
		</ul>
	`;
	const { data, error } = await resend.emails.send({
		from: fromEmail,
		to: [adminEmail],
		subject: `Clermont – ${safeName} report result`,
		html,
	});
	if (error) return { success: false, error: error.message };
	return { success: true, id: data?.id };
}

export { resend };
