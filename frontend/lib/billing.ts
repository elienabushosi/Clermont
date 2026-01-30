// Billing API utilities
import { config } from "./config";

export interface SubscriptionStatus {
	status: "active" | "past_due" | "canceled" | "none";
	plan: string;
	trialEndsAt: string | null;
	currentPeriodEnd?: string | null;
	cancelAtPeriodEnd?: boolean;
	freeReportsUsed?: number;
	freeReportsLimit?: number;
	quantity?: number; // Number of seats
	subscription?: any;
}

export interface StripeProduct {
	id: string;
	name: string;
	description: string | null;
	priceId: string | null;
	amount: number | null;
	currency: string | null;
	interval: string | null;
}

/**
 * Get subscription status for the current user's organization
 */
export async function getSubscriptionStatus(): Promise<SubscriptionStatus | null> {
	try {
		const token = localStorage.getItem("auth_token");
		if (!token) {
			throw new Error("No authentication token");
		}

		const response = await fetch(`${config.apiUrl}/api/billing/subscription-status`, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.message || "Failed to fetch subscription status");
		}

		const data = await response.json();
		return data.subscription;
	} catch (error) {
		console.error("Error fetching subscription status:", error);
		throw error;
	}
}

/**
 * Get available pricing plans from Stripe (owner only)
 */
export async function getProducts(): Promise<StripeProduct[]> {
	try {
		const token = localStorage.getItem("auth_token");
		if (!token) {
			throw new Error("No authentication token");
		}

		const response = await fetch(`${config.apiUrl}/api/billing/products`, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.message || "Failed to fetch products");
		}

		const data = await response.json();
		return data.products;
	} catch (error) {
		console.error("Error fetching products:", error);
		throw error;
	}
}

/**
 * Create Stripe Checkout session (owner only)
 */
export async function createCheckoutSession(priceId: string): Promise<{ sessionId: string; url: string }> {
	try {
		const token = localStorage.getItem("auth_token");
		if (!token) {
			throw new Error("No authentication token");
		}

		const response = await fetch(`${config.apiUrl}/api/billing/create-checkout-session`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ priceId }),
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.message || "Failed to create checkout session");
		}

		const data = await response.json();
		return data;
	} catch (error) {
		console.error("Error creating checkout session:", error);
		throw error;
	}
}

/**
 * Process checkout session manually (fallback if webhook didn't fire)
 */
export async function processCheckoutSession(sessionId: string): Promise<void> {
	try {
		const token = localStorage.getItem("auth_token");
		if (!token) {
			throw new Error("No authentication token");
		}

		const response = await fetch(`${config.apiUrl}/api/billing/process-checkout-session`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ sessionId }),
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.message || "Failed to process checkout session");
		}
	} catch (error) {
		console.error("Error processing checkout session:", error);
		throw error;
	}
}

/**
 * Cancel subscription (owner only)
 */
export async function cancelSubscription(): Promise<void> {
	try {
		const token = localStorage.getItem("auth_token");
		if (!token) {
			throw new Error("No authentication token");
		}

		const response = await fetch(`${config.apiUrl}/api/billing/cancel-subscription`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.message || "Failed to cancel subscription");
		}
	} catch (error) {
		console.error("Error canceling subscription:", error);
		throw error;
	}
}

/**
 * Preview upgrade prorated amount
 */
export async function previewUpgrade(newPriceId: string): Promise<{
	proratedAmount: number;
	currency: string;
	formattedAmount: string;
}> {
	try {
		const token = localStorage.getItem("auth_token");
		if (!token) {
			throw new Error("No authentication token");
		}

		const response = await fetch(
			`${config.apiUrl}/api/billing/upgrade-preview?newPriceId=${encodeURIComponent(newPriceId)}`,
			{
				method: "GET",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
			}
		);

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.message || "Failed to preview upgrade");
		}

		const data = await response.json();
		return data;
	} catch (error) {
		console.error("Error previewing upgrade:", error);
		throw error;
	}
}

/**
 * Upgrade subscription with proration
 */
export async function upgradeSubscription(newPriceId: string): Promise<void> {
	try {
		const token = localStorage.getItem("auth_token");
		if (!token) {
			throw new Error("No authentication token");
		}

		const response = await fetch(`${config.apiUrl}/api/billing/upgrade-subscription`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ newPriceId }),
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.message || "Failed to upgrade subscription");
		}
	} catch (error) {
		console.error("Error upgrading subscription:", error);
		throw error;
	}
}

/**
 * Preview cost of adding a seat
 */
export async function previewAddSeat(): Promise<{
	proratedAmount: number;
	currency: string;
	formattedAmount: string;
	currentQuantity: number;
	newQuantity: number;
}> {
	try {
		const token = localStorage.getItem("auth_token");
		if (!token) {
			throw new Error("No authentication token");
		}

		const response = await fetch(`${config.apiUrl}/api/billing/preview-add-seat`, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.message || "Failed to preview add seat");
		}

		const data = await response.json();
		return data;
	} catch (error) {
		console.error("Error previewing add seat:", error);
		throw error;
	}
}

/**
 * Format price for display
 */
export function formatPrice(amount: number | null, currency: string | null, priceId?: string | null): string {
	if (!amount || !currency) return "—";
	
	// For monthly price ID, don't show decimals
	const isMonthlyPrice = priceId === (process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID ?? "");
	
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: currency.toUpperCase(),
		minimumFractionDigits: isMonthlyPrice ? 0 : 2,
		maximumFractionDigits: isMonthlyPrice ? 0 : 2,
	}).format(amount / 100);
}
