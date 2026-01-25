// Billing routes for Stripe integration
import express from "express";
import Stripe from "stripe";
import { supabase } from "../lib/supabase.js";
import { getUserFromToken } from "../lib/auth-utils.js";

const router = express.Router();

// Initialize Stripe
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
	console.warn(
		"Warning: STRIPE_SECRET_KEY not found in environment variables"
	);
}

const stripe = stripeSecretKey
	? new Stripe(stripeSecretKey, {
			apiVersion: "2024-12-18.acacia",
	  })
	: null;

// Helper function to get organization subscription status
async function getOrganizationSubscriptionStatus(organizationId) {
	// Get subscription from database
	const { data: subscription, error } = await supabase
		.from("subscriptions")
		.select("*")
		.eq("IdOrganization", organizationId)
		.order("CreatedAt", { ascending: false })
		.limit(1)
		.single();

	if (error && error.code !== "PGRST116") {
		// PGRST116 = no rows returned
		console.error("Error fetching subscription:", error);
		return null;
	}

	// Get organization info for free reports
	const { data: org, error: orgError } = await supabase
		.from("organizations")
		.select("FreeReportsUsed, FreeReportsLimit")
		.eq("IdOrganization", organizationId)
		.single();

	const freeReportsUsed = org?.FreeReportsUsed || 0;
	const freeReportsLimit = org?.FreeReportsLimit || 2;

	// If no subscription exists, return none status with free reports info
	if (!subscription) {
		return {
			status: "none",
			plan: "free",
			trialEndsAt: null,
			currentPeriodEnd: null,
			cancelAtPeriodEnd: false,
			freeReportsUsed: freeReportsUsed,
			freeReportsLimit: freeReportsLimit,
			subscription: null,
		};
	}

	// Return subscription status
	return {
		status: subscription.Status,
		plan: subscription.StripePriceId, // You might want to map this to a plan name
		trialEndsAt: subscription.TrialEndsAt,
		currentPeriodEnd: subscription.CurrentPeriodEnd,
		cancelAtPeriodEnd: subscription.CancelAtPeriodEnd || false,
		freeReportsUsed: freeReportsUsed, // Still track even with subscription
		freeReportsLimit: freeReportsLimit,
		subscription: subscription,
	};
}

// GET /api/billing/subscription-status
// Get current subscription status for the organization (all users can see this)
router.get("/subscription-status", async (req, res) => {
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

		const subscriptionStatus = await getOrganizationSubscriptionStatus(
			userData.IdOrganization
		);

		if (!subscriptionStatus) {
			return res.status(500).json({
				status: "error",
				message: "Failed to fetch subscription status",
			});
		}

		res.json({
			status: "success",
			subscription: subscriptionStatus,
		});
	} catch (error) {
		console.error("Error fetching subscription status:", error);
		res.status(500).json({
			status: "error",
			message: "Error fetching subscription status",
			error: error.message,
		});
	}
});

// GET /api/billing/products
// Get available pricing plans from Stripe (owner only)
router.get("/products", async (req, res) => {
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

		// Only owners can view products
		if (userData.Role !== "Owner") {
			return res.status(403).json({
				status: "error",
				message: "Only organization owners can view pricing plans",
			});
		}

		if (!stripe) {
			return res.status(500).json({
				status: "error",
				message: "Stripe is not configured",
			});
		}

		// Fetch products and prices from Stripe
		const products = await stripe.products.list({
			active: true,
		});

		// Fetch all prices for each product
		const productsWithPrices = await Promise.all(
			products.data.map(async (product) => {
				const prices = await stripe.prices.list({
					product: product.id,
					active: true,
				});

				// Format prices
				const formattedPrices = prices.data.map((price) => ({
					priceId: price.id,
					amount: price.unit_amount,
					currency: price.currency,
					interval: price.recurring?.interval || null,
				}));

				return {
					id: product.id,
					name: product.name,
					description: product.description,
					prices: formattedPrices,
				};
			})
		);

		// Flatten to return each price as a separate product option
		const formattedProducts = productsWithPrices.flatMap((product) =>
			product.prices.map((price) => ({
				id: product.id,
				name: product.name,
				description: product.description,
				priceId: price.priceId,
				amount: price.amount,
				currency: price.currency,
				interval: price.interval,
			}))
		);

		res.json({
			status: "success",
			products: formattedProducts,
		});
	} catch (error) {
		console.error("Error fetching products:", error);
		res.status(500).json({
			status: "error",
			message: "Error fetching products",
			error: error.message,
		});
	}
});

// POST /api/billing/create-checkout-session
// Create Stripe Checkout session (owner only)
router.post("/create-checkout-session", async (req, res) => {
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

		// Only owners can create checkout sessions
		if (userData.Role !== "Owner") {
			return res.status(403).json({
				status: "error",
				message: "Only organization owners can start subscriptions",
			});
		}

		const { priceId } = req.body;

		if (!priceId) {
			return res.status(400).json({
				status: "error",
				message: "Price ID is required",
			});
		}

		if (!stripe) {
			return res.status(500).json({
				status: "error",
				message: "Stripe is not configured",
			});
		}

		// Get or create Stripe customer for organization
		let customerId = null;

		// Check if organization already has a customer ID
		const { data: existingSubscription } = await supabase
			.from("subscriptions")
			.select("StripeCustomerId")
			.eq("IdOrganization", userData.IdOrganization)
			.order("CreatedAt", { ascending: false })
			.limit(1)
			.single();

		if (existingSubscription?.StripeCustomerId) {
			customerId = existingSubscription.StripeCustomerId;
		} else {
			// Create new Stripe customer
			const customer = await stripe.customers.create({
				email: userData.Email,
				metadata: {
					organizationId: userData.IdOrganization,
					organizationName: userData.Name, // You might want to fetch org name
				},
			});
			customerId = customer.id;
		}

		// Create checkout session
		const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
		console.log("Creating checkout session with metadata:", {
			organizationId: userData.IdOrganization,
			userId: userData.IdUser,
		});
		const session = await stripe.checkout.sessions.create({
			customer: customerId,
			payment_method_types: ["card"],
			line_items: [
				{
					price: priceId,
					quantity: 1,
				},
			],
			mode: "subscription",
			success_url: `${frontendUrl}/settings?session_id={CHECKOUT_SESSION_ID}`,
			cancel_url: `${frontendUrl}/settings?canceled=true`,
			metadata: {
				organizationId: userData.IdOrganization,
				userId: userData.IdUser,
			},
			subscription_data: {
				metadata: {
					organizationId: userData.IdOrganization,
					userId: userData.IdUser,
				},
			},
		});
		console.log("Checkout session created:", session.id);
		console.log("Session metadata:", session.metadata);

		res.json({
			status: "success",
			sessionId: session.id,
			url: session.url,
		});
	} catch (error) {
		console.error("Error creating checkout session:", error);
		res.status(500).json({
			status: "error",
			message: "Error creating checkout session",
			error: error.message,
		});
	}
});

// POST /api/billing/process-checkout-session
// Manually process a checkout session (fallback if webhook didn't fire)
router.post("/process-checkout-session", async (req, res) => {
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

		const { sessionId } = req.body;

		if (!sessionId) {
			return res.status(400).json({
				status: "error",
				message: "Session ID is required",
			});
		}

		if (!stripe) {
			return res.status(500).json({
				status: "error",
				message: "Stripe is not configured",
			});
		}

		console.log("Manually processing checkout session:", sessionId);
		
		// Retrieve the checkout session from Stripe
		const session = await stripe.checkout.sessions.retrieve(sessionId, {
			expand: ['subscription', 'customer']
		});

		console.log("Retrieved session:", session.id);
		console.log("Session metadata:", session.metadata);
		console.log("Session subscription:", session.subscription);
		console.log("Session payment status:", session.payment_status);

		// Only process if payment was successful
		if (session.payment_status !== 'paid') {
			return res.status(400).json({
				status: "error",
				message: "Payment not completed",
			});
		}

		const organizationId = session.metadata?.organizationId;
		const subscriptionId = session.subscription;

		if (!organizationId) {
			return res.status(400).json({
				status: "error",
				message: "No organizationId in session metadata",
			});
		}

		if (!subscriptionId) {
			return res.status(400).json({
				status: "error",
				message: "No subscription in checkout session",
			});
		}

		// Verify user belongs to this organization
		if (userData.IdOrganization !== organizationId) {
			return res.status(403).json({
				status: "error",
				message: "You don't have access to this organization",
			});
		}

		// Retrieve subscription from Stripe
		const subscription = await stripe.subscriptions.retrieve(
			typeof subscriptionId === 'string' ? subscriptionId : subscriptionId.id,
			{
				expand: ["default_payment_method"],
			}
		);

		// Create or update subscription in database
		const subscriptionData = {
			IdOrganization: organizationId,
			StripeCustomerId: subscription.customer,
			StripeSubscriptionId: subscription.id,
			StripePriceId: subscription.items.data[0]?.price.id || null,
			Status: subscription.status,
			TrialEndsAt: subscription.trial_end
				? new Date(subscription.trial_end * 1000).toISOString()
				: null,
			CurrentPeriodStart: subscription.current_period_start
				? new Date(subscription.current_period_start * 1000).toISOString()
				: null,
			CurrentPeriodEnd: subscription.current_period_end
				? new Date(subscription.current_period_end * 1000).toISOString()
				: null,
			CancelAtPeriodEnd: subscription.cancel_at_period_end,
			UpdatedAt: new Date().toISOString(),
		};

		// Check if subscription already exists
		const { data: existingSub, error: checkError } = await supabase
			.from("subscriptions")
			.select("IdSubscription")
			.eq("StripeSubscriptionId", subscription.id)
			.single();

		if (checkError && checkError.code !== "PGRST116") {
			console.error("Error checking for existing subscription:", checkError);
			return res.status(500).json({
				status: "error",
				message: "Error checking subscription",
			});
		}

		if (existingSub) {
			// Update existing
			const { error: updateError } = await supabase
				.from("subscriptions")
				.update(subscriptionData)
				.eq("IdSubscription", existingSub.IdSubscription);
			if (updateError) {
				console.error("Error updating subscription:", updateError);
				return res.status(500).json({
					status: "error",
					message: "Error updating subscription",
				});
			}
		} else {
			// Create new
			subscriptionData.CreatedAt = new Date().toISOString();
			const { data: newSub, error: insertError } = await supabase
				.from("subscriptions")
				.insert(subscriptionData)
				.select();
			if (insertError) {
				console.error("Error inserting subscription:", insertError);
				return res.status(500).json({
					status: "error",
					message: "Error creating subscription",
				});
			}
		}

		// Update organization subscription status
		const { error: orgUpdateError } = await supabase
			.from("organizations")
			.update({
				SubscriptionStatus: subscription.status === "trialing" || subscription.status === "active" ? "active" : subscription.status,
				UpdatedAt: new Date().toISOString(),
			})
			.eq("IdOrganization", organizationId);

		if (orgUpdateError) {
			console.error("Error updating organization:", orgUpdateError);
			return res.status(500).json({
				status: "error",
				message: "Error updating organization",
			});
		}

		console.log("Successfully processed checkout session manually");

		res.json({
			status: "success",
			message: "Checkout session processed successfully",
			subscription: {
				status: subscription.status,
				id: subscription.id,
			},
		});
	} catch (error) {
		console.error("Error processing checkout session:", error);
		res.status(500).json({
			status: "error",
			message: "Error processing checkout session",
			error: error.message,
		});
	}
});

// POST /api/billing/cancel-subscription
// Cancel subscription (owner only)
router.post("/cancel-subscription", async (req, res) => {
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

		// Only owners can cancel subscriptions
		if (userData.Role !== "Owner") {
			return res.status(403).json({
				status: "error",
				message: "Only organization owners can cancel subscriptions",
			});
		}

		if (!stripe) {
			return res.status(500).json({
				status: "error",
				message: "Stripe is not configured",
			});
		}

		// Get current subscription
		const { data: subscription, error: subError } = await supabase
			.from("subscriptions")
			.select("*")
			.eq("IdOrganization", userData.IdOrganization)
			.eq("Status", "active")
			.order("CreatedAt", { ascending: false })
			.limit(1)
			.single();

		if (subError || !subscription || !subscription.StripeSubscriptionId) {
			return res.status(404).json({
				status: "error",
				message: "No active subscription found",
			});
		}

		// Cancel subscription in Stripe (cancel at period end)
		const canceledSubscription = await stripe.subscriptions.update(
			subscription.StripeSubscriptionId,
			{
				cancel_at_period_end: true,
			}
		);

		// Update subscription in database
		await supabase
			.from("subscriptions")
			.update({
				CancelAtPeriodEnd: true,
				Status: canceledSubscription.status,
				UpdatedAt: new Date().toISOString(),
			})
			.eq("IdSubscription", subscription.IdSubscription);

		// Update organization status
		await supabase
			.from("organizations")
			.update({
				SubscriptionStatus: "canceled",
				UpdatedAt: new Date().toISOString(),
			})
			.eq("IdOrganization", userData.IdOrganization);

		res.json({
			status: "success",
			message: "Subscription will be canceled at the end of the current period",
			subscription: {
				status: canceledSubscription.status,
				currentPeriodEnd: canceledSubscription.current_period_end
					? new Date(canceledSubscription.current_period_end * 1000).toISOString()
					: null,
				cancelAtPeriodEnd: canceledSubscription.cancel_at_period_end,
			},
		});
	} catch (error) {
		console.error("Error canceling subscription:", error);
		res.status(500).json({
			status: "error",
			message: "Error canceling subscription",
			error: error.message,
		});
	}
});

// GET /api/billing/upgrade-preview
// Preview prorated amount for upgrading subscription (owner only)
router.get("/upgrade-preview", async (req, res) => {
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

		// Only owners can preview upgrades
		if (userData.Role !== "Owner") {
			return res.status(403).json({
				status: "error",
				message: "Only organization owners can preview upgrades",
			});
		}

		const { newPriceId } = req.query;

		if (!newPriceId) {
			return res.status(400).json({
				status: "error",
				message: "newPriceId is required",
			});
		}

		if (!stripe) {
			return res.status(500).json({
				status: "error",
				message: "Stripe is not configured",
			});
		}

		// Get current subscription
		const { data: subscription, error: subError } = await supabase
			.from("subscriptions")
			.select("*")
			.eq("IdOrganization", userData.IdOrganization)
			.eq("Status", "active")
			.order("CreatedAt", { ascending: false })
			.limit(1)
			.single();

		if (subError || !subscription || !subscription.StripeSubscriptionId) {
			return res.status(404).json({
				status: "error",
				message: "No active subscription found",
			});
		}

		// Get the subscription from Stripe to access items
		const stripeSubscription = await stripe.subscriptions.retrieve(
			subscription.StripeSubscriptionId,
			{
				expand: ["items.data.price"],
			}
		);

		// Get the new price details
		const newPrice = await stripe.prices.retrieve(newPriceId);

		// Calculate prorated amount using Stripe's invoice preview
		// We'll use the upcoming invoice to see what would be charged
		const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
			customer: stripeSubscription.customer,
			subscription: subscription.StripeSubscriptionId,
			subscription_items: [
				{
					id: stripeSubscription.items.data[0].id,
					price: newPriceId,
				},
			],
			subscription_proration_behavior: "always_invoice",
		});

		// Calculate the prorated amount (total - amount_due from current subscription)
		const proratedAmount = upcomingInvoice.amount_due;

		res.json({
			status: "success",
			proratedAmount: proratedAmount, // Amount in cents
			currency: upcomingInvoice.currency,
			currentPrice: subscription.StripePriceId,
			newPrice: newPriceId,
			formattedAmount: new Intl.NumberFormat("en-US", {
				style: "currency",
				currency: upcomingInvoice.currency.toUpperCase(),
			}).format(proratedAmount / 100),
		});
	} catch (error) {
		console.error("Error previewing upgrade:", error);
		res.status(500).json({
			status: "error",
			message: "Error previewing upgrade",
			error: error.message,
		});
	}
});

// POST /api/billing/upgrade-subscription
// Upgrade subscription with proration (owner only)
router.post("/upgrade-subscription", async (req, res) => {
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

		// Only owners can upgrade subscriptions
		if (userData.Role !== "Owner") {
			return res.status(403).json({
				status: "error",
				message: "Only organization owners can upgrade subscriptions",
			});
		}

		const { newPriceId } = req.body;

		if (!newPriceId) {
			return res.status(400).json({
				status: "error",
				message: "newPriceId is required",
			});
		}

		if (!stripe) {
			return res.status(500).json({
				status: "error",
				message: "Stripe is not configured",
			});
		}

		// Get current subscription
		const { data: subscription, error: subError } = await supabase
			.from("subscriptions")
			.select("*")
			.eq("IdOrganization", userData.IdOrganization)
			.eq("Status", "active")
			.order("CreatedAt", { ascending: false })
			.limit(1)
			.single();

		if (subError || !subscription || !subscription.StripeSubscriptionId) {
			return res.status(404).json({
				status: "error",
				message: "No active subscription found",
			});
		}

		// Get the subscription from Stripe to access items
		const stripeSubscription = await stripe.subscriptions.retrieve(
			subscription.StripeSubscriptionId,
			{
				expand: ["items.data.price"],
			}
		);

		// Update subscription with new price and proration
		const updatedSubscription = await stripe.subscriptions.update(
			subscription.StripeSubscriptionId,
			{
				items: [
					{
						id: stripeSubscription.items.data[0].id,
						price: newPriceId,
					},
				],
				proration_behavior: "always_invoice", // Immediately invoice for prorated amount
			}
		);

		// Update subscription in database
		await supabase
			.from("subscriptions")
			.update({
				StripePriceId: updatedSubscription.items.data[0]?.price.id || newPriceId,
				Status: updatedSubscription.status,
				CurrentPeriodStart: updatedSubscription.current_period_start
					? new Date(updatedSubscription.current_period_start * 1000).toISOString()
					: null,
				CurrentPeriodEnd: updatedSubscription.current_period_end
					? new Date(updatedSubscription.current_period_end * 1000).toISOString()
					: null,
				UpdatedAt: new Date().toISOString(),
			})
			.eq("IdSubscription", subscription.IdSubscription);

		// Update organization status
		await supabase
			.from("organizations")
			.update({
				SubscriptionStatus: updatedSubscription.status === "trialing" || updatedSubscription.status === "active" ? "active" : updatedSubscription.status,
				UpdatedAt: new Date().toISOString(),
			})
			.eq("IdOrganization", userData.IdOrganization);

		res.json({
			status: "success",
			message: "Subscription upgraded successfully",
			subscription: {
				status: updatedSubscription.status,
				priceId: updatedSubscription.items.data[0]?.price.id,
				currentPeriodEnd: updatedSubscription.current_period_end
					? new Date(updatedSubscription.current_period_end * 1000).toISOString()
					: null,
			},
		});
	} catch (error) {
		console.error("Error upgrading subscription:", error);
		res.status(500).json({
			status: "error",
			message: "Error upgrading subscription",
			error: error.message,
		});
	}
});

// POST /api/billing/webhook
// Stripe webhook endpoint (no auth required - uses Stripe signature verification)
// Note: Raw body parsing is handled in server.js before express.json()
router.post("/webhook", async (req, res) => {
	console.log("\n" + "=".repeat(60));
	console.log("==== WEBHOOK RECEIVED ====");
	console.log("=".repeat(60));

	const sig = req.headers["stripe-signature"];

	if (!stripe) {
		console.error("Stripe is not configured");
		return res.status(500).json({ error: "Stripe is not configured" });
	}

	let event;

	try {
		const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
		if (!webhookSecret) {
			console.error("STRIPE_WEBHOOK_SECRET not configured");
			return res.status(400).json({ error: "Webhook secret not configured" });
		}

		event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
		console.log(`Event Type: ${event.type}`);
		console.log(`Event ID: ${event.id}`);
	} catch (err) {
		console.error("Webhook signature verification failed:", err.message);
		console.log("=".repeat(60) + "\n");
		return res.status(400).json({ error: `Webhook Error: ${err.message}` });
	}

	// Handle the event
	try {
		switch (event.type) {
			case "checkout.session.completed": {
				console.log("Processing: checkout.session.completed");
				const session = event.data.object;
				
				// Always try to get organizationId and subscriptionId, retrieving full session if needed
				let organizationId = session.metadata?.organizationId;
				let subscriptionId = session.subscription;
				
				// If metadata or subscription is missing, retrieve full session from Stripe
				if (!organizationId || !subscriptionId) {
					console.log("  → Retrieving full session from Stripe...");
					try {
						const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
							expand: ['subscription', 'customer']
						});
						
						if (!organizationId && fullSession.metadata?.organizationId) {
							organizationId = fullSession.metadata.organizationId;
						}
						if (!subscriptionId && fullSession.subscription) {
							subscriptionId = fullSession.subscription;
						}
					} catch (retrieveError) {
						console.error("  ✗ Error retrieving session:", retrieveError.message);
					}
				}
				
				if (!organizationId) {
					console.error("  ✗ No organizationId found in checkout session");
					break;
				}
				
				if (!subscriptionId) {
					console.error("  ✗ No subscription ID in checkout session");
					break;
				}
				
				console.log(`  → Organization ID: ${organizationId}`);
				console.log(`  → Subscription ID: ${typeof subscriptionId === 'string' ? subscriptionId : subscriptionId.id}`);

				// Get the subscription from Stripe
				if (!subscriptionId) {
					console.error("No subscription ID in checkout session");
					console.error("This might be a one-time payment, not a subscription");
					break;
				}

				console.log("  → Retrieving subscription details from Stripe...");
				const subscription = await stripe.subscriptions.retrieve(
					typeof subscriptionId === 'string' ? subscriptionId : subscriptionId.id,
					{
						expand: ["default_payment_method"],
					}
				);
				console.log(`  → Subscription Status: ${subscription.status}`);

				// Create or update subscription in database
				const subscriptionData = {
					IdOrganization: organizationId,
					StripeCustomerId: subscription.customer,
					StripeSubscriptionId: subscription.id,
					StripePriceId: subscription.items.data[0]?.price.id || null,
					Status: subscription.status,
					TrialEndsAt: subscription.trial_end
						? new Date(subscription.trial_end * 1000).toISOString()
						: null,
					CurrentPeriodStart: subscription.current_period_start
						? new Date(subscription.current_period_start * 1000).toISOString()
						: null,
					CurrentPeriodEnd: subscription.current_period_end
						? new Date(subscription.current_period_end * 1000).toISOString()
						: null,
					CancelAtPeriodEnd: subscription.cancel_at_period_end,
					UpdatedAt: new Date().toISOString(),
				};

				// Check if subscription already exists
				console.log("Checking for existing subscription:", subscription.id);
				const { data: existingSub, error: checkError } = await supabase
					.from("subscriptions")
					.select("IdSubscription")
					.eq("StripeSubscriptionId", subscription.id)
					.single();

				if (checkError && checkError.code !== "PGRST116") {
					console.error("Error checking for existing subscription:", checkError);
				}

				if (existingSub) {
					// Update existing
					console.log("Updating existing subscription:", existingSub.IdSubscription);
					const { error: updateError } = await supabase
						.from("subscriptions")
						.update(subscriptionData)
						.eq("IdSubscription", existingSub.IdSubscription);
					if (updateError) {
						console.error("Error updating subscription:", updateError);
					} else {
						console.log("Subscription updated successfully");
					}
				} else {
					// Create new
					console.log("  → Creating new subscription in database...");
					subscriptionData.CreatedAt = new Date().toISOString();
					const { error: insertError } = await supabase
						.from("subscriptions")
						.insert(subscriptionData);
					if (insertError) {
						// If duplicate, try to update instead
						if (insertError.code === '23505') {
							console.log("  → Subscription already exists, updating instead...");
							const { error: updateError } = await supabase
								.from("subscriptions")
								.update(subscriptionData)
								.eq("StripeSubscriptionId", subscription.id);
							if (updateError) {
								console.error("  ✗ Error updating:", updateError.message);
							} else {
								console.log("  ✓ Subscription updated (was duplicate)");
							}
						} else {
							console.error("  ✗ Error inserting:", insertError.message);
						}
					} else {
						console.log("  ✓ Subscription created");
					}
				}

				// Update organization subscription status
				console.log("Updating organization subscription status:", organizationId);
				const { error: orgUpdateError } = await supabase
					.from("organizations")
					.update({
						SubscriptionStatus: subscription.status === "trialing" || subscription.status === "active" ? "active" : subscription.status,
						UpdatedAt: new Date().toISOString(),
					})
					.eq("IdOrganization", organizationId);
				if (orgUpdateError) {
					console.error("Error updating organization:", orgUpdateError);
				} else {
					console.log("Organization updated successfully");
				}

				break;
			}

			case "customer.subscription.updated": {
				console.log("Processing: customer.subscription.updated");
				const subscription = event.data.object;
				let organizationId = subscription.metadata?.organizationId;

				if (!organizationId) {
					// Try to find by subscription ID
					const { data: existingSub } = await supabase
						.from("subscriptions")
						.select("IdOrganization")
						.eq("StripeSubscriptionId", subscription.id)
						.single();

					if (!existingSub) {
						console.error("  ✗ Could not find organization for subscription");
						break;
					}
					organizationId = existingSub.IdOrganization;
				}
				
				console.log(`  → Organization ID: ${organizationId}`);
				console.log(`  → Subscription Status: ${subscription.status}`);

				// Update subscription in database
				console.log("  → Updating subscription in database...");
				const { error: updateError } = await supabase
					.from("subscriptions")
					.update({
						Status: subscription.status,
						StripePriceId: subscription.items.data[0]?.price.id || null,
						CurrentPeriodStart: subscription.current_period_start
							? new Date(subscription.current_period_start * 1000).toISOString()
							: null,
						CurrentPeriodEnd: subscription.current_period_end
							? new Date(subscription.current_period_end * 1000).toISOString()
							: null,
						CancelAtPeriodEnd: subscription.cancel_at_period_end,
						UpdatedAt: new Date().toISOString(),
					})
					.eq("StripeSubscriptionId", subscription.id);
				
				if (updateError) {
					console.error("  ✗ Error updating subscription:", updateError.message);
				} else {
					console.log("  ✓ Subscription updated");
				}

				// Update organization status
				let orgStatus = "active";
				if (subscription.status === "trialing" || subscription.status === "active") orgStatus = "active";
				else if (subscription.status === "past_due") orgStatus = "past_due";
				else if (subscription.status === "canceled" || subscription.status === "unpaid")
					orgStatus = "canceled";

				console.log("  → Updating organization status...");
				const { error: orgUpdateError } = await supabase
					.from("organizations")
					.update({
						SubscriptionStatus: orgStatus,
						UpdatedAt: new Date().toISOString(),
					})
					.eq("IdOrganization", orgId);
				
				if (orgUpdateError) {
					console.error("  ✗ Error updating organization:", orgUpdateError.message);
				} else {
					console.log("  ✓ Organization updated");
				}

				break;
			}

			case "customer.subscription.deleted": {
				const subscription = event.data.object;

				// Update subscription status to canceled
				await supabase
					.from("subscriptions")
					.update({
						Status: "canceled",
						UpdatedAt: new Date().toISOString(),
					})
					.eq("StripeSubscriptionId", subscription.id);

				// Get organization ID
				const { data: subData } = await supabase
					.from("subscriptions")
					.select("IdOrganization")
					.eq("StripeSubscriptionId", subscription.id)
					.single();

				if (subData) {
					await supabase
						.from("organizations")
						.update({
							SubscriptionStatus: "canceled",
							UpdatedAt: new Date().toISOString(),
						})
						.eq("IdOrganization", subData.IdOrganization);
				}

				break;
			}

			case "invoice.payment_succeeded": {
				const invoice = event.data.object;
				const subscriptionId = invoice.subscription;

				if (subscriptionId) {
					const subscription = await stripe.subscriptions.retrieve(subscriptionId);

					await supabase
						.from("subscriptions")
						.update({
							CurrentPeriodStart: subscription.current_period_start
								? new Date(subscription.current_period_start * 1000).toISOString()
								: null,
							CurrentPeriodEnd: subscription.current_period_end
								? new Date(subscription.current_period_end * 1000).toISOString()
								: null,
							Status: subscription.status,
							UpdatedAt: new Date().toISOString(),
						})
						.eq("StripeSubscriptionId", subscriptionId);
				}

				break;
			}

			case "invoice.payment_failed": {
				const invoice = event.data.object;
				const subscriptionId = invoice.subscription;

				if (subscriptionId) {
					await supabase
						.from("subscriptions")
						.update({
							Status: "past_due",
							UpdatedAt: new Date().toISOString(),
						})
						.eq("StripeSubscriptionId", subscriptionId);

					// Get organization and update status
					const { data: subData } = await supabase
						.from("subscriptions")
						.select("IdOrganization")
						.eq("StripeSubscriptionId", subscriptionId)
						.single();

					if (subData) {
						await supabase
							.from("organizations")
							.update({
								SubscriptionStatus: "past_due",
								UpdatedAt: new Date().toISOString(),
							})
							.eq("IdOrganization", subData.IdOrganization);
					}
				}

				break;
			}

			default:
				console.log(`  → Unhandled event type: ${event.type} (skipping)`);
		}

		console.log("=".repeat(60));
		console.log("==== WEBHOOK PROCESSED ====");
		console.log("=".repeat(60) + "\n");
		res.json({ received: true });
	} catch (error) {
		console.error("  ✗ ERROR:", error.message);
		console.log("=".repeat(60));
		console.log("==== WEBHOOK ERROR ====");
		console.log("=".repeat(60) + "\n");
		res.status(500).json({ error: error.message });
	}
});

export default router;
