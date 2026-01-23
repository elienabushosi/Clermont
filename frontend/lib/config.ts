// Application configuration based on environment
// Next.js automatically loads .env.development or .env.production based on NODE_ENV

export const config = {
	apiUrl:
		process.env.NEXT_PUBLIC_API_URL ||
		(process.env.NODE_ENV === "production"
			? "https://api.yourdomain.com"
			: "http://localhost:3002"),
	googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
} as const;
