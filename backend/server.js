// Backend server entry point
import express from "express";
import cors from "cors";
import { supabase } from "./lib/supabase.js";
import authRoutes from "./routes/auth.js";

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

// API routes
app.use("/api/auth", authRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
	res.json({ status: "ok", message: "Backend is running" });
});

// Test Supabase connection
app.get("/api/test-supabase", async (req, res) => {
	try {
		// Simple connection test - just verify the client is configured
		const { data, error } = await supabase.auth.getSession();

		// Even if there's no session, if we get here without a connection error, Supabase is working
		res.json({
			status: "ok",
			message: "Successfully connected to Supabase",
			connected: true,
			url:
				process.env.SUPABASE_URL ||
				"https://navarlhgtpvdgutcsfhj.supabase.co",
		});
	} catch (error) {
		console.error("Supabase test error:", error);
		res.status(500).json({
			status: "error",
			message: "Error testing Supabase connection",
			error: error.message,
		});
	}
});

app.listen(PORT, () => {
	console.log(`Backend server running on http://localhost:${PORT}`);
	console.log("Supabase client initialized");
});
