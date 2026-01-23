"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
	getCurrentUser,
	requestPasswordReset,
	resetPassword,
} from "@/lib/auth";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock, CreditCard, Mail, CheckCircle2, Loader2, X } from "lucide-react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { config } from "@/lib/config";
import {
	getSubscriptionStatus,
	getProducts,
	createCheckoutSession,
	processCheckoutSession,
	cancelSubscription,
	formatPrice,
	type SubscriptionStatus,
	type StripeProduct,
} from "@/lib/billing";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const passwordResetSchema = z.object({
	code: z.string().min(6, "Code must be at least 6 characters").max(10, "Code must be 10 characters or less"),
	newPassword: z
		.string()
		.min(6, "Password must be at least 6 characters"),
	confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
	message: "Passwords do not match",
	path: ["confirmPassword"],
});

type PasswordResetFormValues = z.infer<typeof passwordResetSchema>;

export default function SettingsPage() {
	const searchParams = useSearchParams();
	const [currentUser, setCurrentUser] = useState<{
		user: {
			IdUser: string;
			Name: string;
			Email: string;
			Role: string;
		};
	} | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isRequestingCode, setIsRequestingCode] = useState(false);
	const [isResetting, setIsResetting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [codeSent, setCodeSent] = useState(false);
	const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
	const [products, setProducts] = useState<StripeProduct[]>([]);
	const [isLoadingBilling, setIsLoadingBilling] = useState(false);
	const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
	const [isCanceling, setIsCanceling] = useState(false);
	const [showCancelDialog, setShowCancelDialog] = useState(false);

	const isOwner = currentUser?.user.Role === "Owner";

	const form = useForm<PasswordResetFormValues>({
		resolver: zodResolver(passwordResetSchema),
		defaultValues: {
			code: "",
			newPassword: "",
			confirmPassword: "",
		},
	});

	useEffect(() => {
		const fetchUser = async () => {
			try {
				const user = await getCurrentUser();
				setCurrentUser(user);
			} catch (err) {
				console.error("Error fetching user:", err);
			} finally {
				setIsLoading(false);
			}
		};

		fetchUser();

		// Check if code is in URL (from email link)
		const codeFromUrl = searchParams.get("resetCode");
		if (codeFromUrl) {
			form.setValue("code", codeFromUrl);
			setCodeSent(true); // Auto-show form if code is in URL
		}

		// Check for Stripe checkout session_id in URL
		const sessionId = searchParams.get("session_id");
		if (sessionId) {
			// Process checkout session manually (fallback if webhook didn't fire)
			const processSession = async () => {
				try {
					console.log("Processing checkout session:", sessionId);
					await processCheckoutSession(sessionId);
					setSuccess("Subscription activated successfully!");
					// Refresh subscription status
					await fetchSubscriptionStatus();
				} catch (err) {
					console.error("Error processing checkout session:", err);
					// Still try to refresh in case webhook processed it
					setTimeout(() => {
						fetchSubscriptionStatus();
					}, 2000);
				}
			};
			processSession();
		}
	}, [searchParams, form]);

	// Fetch subscription status and products
	const fetchSubscriptionStatus = async () => {
		try {
			setIsLoadingBilling(true);
			const status = await getSubscriptionStatus();
			setSubscriptionStatus(status);
		} catch (err) {
			console.error("Error fetching subscription status:", err);
		} finally {
			setIsLoadingBilling(false);
		}
	};

	const fetchProducts = async () => {
		try {
			const productsList = await getProducts();
			setProducts(productsList);
		} catch (err) {
			console.error("Error fetching products:", err);
			setError(err instanceof Error ? err.message : "Failed to load pricing plans");
		}
	};

	useEffect(() => {
		// Fetch subscription status for all users
		fetchSubscriptionStatus();

		// Fetch products only for owners
		if (isOwner) {
			fetchProducts();
		}
	}, [isOwner]);

	const handleRequestCode = async () => {
		setIsRequestingCode(true);
		setError(null);
		setSuccess(null);
		setCodeSent(false);

		try {
			const response = await fetch(
				`${config.apiUrl}/api/auth/password/request-reset`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
						"Content-Type": "application/json",
					},
				}
			);

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.message || "Failed to send password reset code");
			}

			setCodeSent(true);
			setSuccess("Password reset code sent to your email");
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Failed to request password reset code"
			);
		} finally {
			setIsRequestingCode(false);
		}
	};

	const onSubmit = async (data: PasswordResetFormValues) => {
		setIsResetting(true);
		setError(null);
		setSuccess(null);

		try {
			await resetPassword(data.code, data.newPassword);
			setSuccess("Password updated successfully!");
			form.reset();
			setCodeSent(false);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to reset password"
			);
		} finally {
			setIsResetting(false);
		}
	};

	const handleSelectPlan = async (priceId: string) => {
		if (!priceId) return;

		setIsCreatingCheckout(true);
		setError(null);

		try {
			const { url } = await createCheckoutSession(priceId);
			// Redirect to Stripe Checkout
			window.location.href = url;
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to start checkout"
			);
			setIsCreatingCheckout(false);
		}
	};

	const handleCancelSubscription = async () => {
		setIsCanceling(true);
		setError(null);
		setShowCancelDialog(false);

		try {
			await cancelSubscription();
			setSuccess("Subscription will be canceled at the end of the current period");
			// Refresh subscription status to show updated cancelAtPeriodEnd
			await fetchSubscriptionStatus();
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to cancel subscription"
			);
		} finally {
			setIsCanceling(false);
		}
	};

	const getStatusBadgeColor = (status: string) => {
		switch (status) {
			case "active":
				return "bg-green-100 text-green-700 border-green-200";
			case "past_due":
				return "bg-yellow-100 text-yellow-700 border-yellow-200";
			case "canceled":
				return "bg-gray-100 text-gray-700 border-gray-200";
			default:
				return "bg-gray-100 text-gray-700 border-gray-200";
		}
	};

	const getStatusLabel = (status: string) => {
		switch (status) {
			case "active":
				return "Active";
			case "past_due":
				return "Payment Failed";
			case "canceled":
				return "Canceled";
			case "none":
				return "No Subscription";
			default:
				return status;
		}
	};

	if (isLoading) {
		return (
			<div className="p-8">
				<div className="max-w-4xl mx-auto">
					<h1 className="text-2xl font-semibold text-[#37322F] mb-6">
						Settings
					</h1>
					<div className="space-y-6">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Lock className="h-5 w-5" />
									Change Password
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<Skeleton className="h-4 w-full" />
								<Skeleton className="h-4 w-3/4" />
								<Skeleton className="h-10 w-48" />
							</CardContent>
						</Card>
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<CreditCard className="h-5 w-5" />
									Billing
								</CardTitle>
							</CardHeader>
							<CardContent>
								<Skeleton className="h-4 w-full" />
								<Skeleton className="h-4 w-2/3 mt-2" />
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="p-8">
			<div className="max-w-4xl mx-auto">
				<h1 className="text-2xl font-semibold text-[#37322F] mb-6">
					Settings
				</h1>

				<div className="space-y-6">
					{/* Change Password Section */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Lock className="h-5 w-5" />
								Change Password
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							{!codeSent ? (
								<div className="space-y-4">
									<p className="text-sm text-[#605A57]">
										Click the button below to receive a password reset code via
										email. The code will expire in 15 minutes.
									</p>
									<Button
										onClick={handleRequestCode}
										disabled={isRequestingCode}
										className="bg-[#37322F] hover:bg-[#37322F]/90 text-white"
									>
										{isRequestingCode ? (
											"Sending..."
										) : (
											<>
												<Mail className="h-4 w-4 mr-2" />
												Send Password Reset Code
											</>
										)}
									</Button>
								</div>
							) : (
								<Form {...form}>
									<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
										{success && (
											<div className="p-3 bg-green-50 border border-green-200 rounded-md flex items-center gap-2 text-green-700 text-sm">
												<CheckCircle2 className="h-4 w-4" />
												{success}
											</div>
										)}
										{error && (
											<div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
												{error}
											</div>
										)}
										<FormField
											control={form.control}
											name="code"
											render={({ field }) => (
												<FormItem>
													<FormLabel className="text-[#37322F]">
														Reset Code
													</FormLabel>
													<FormControl>
														<Input
															type="text"
															placeholder="Enter reset code"
															maxLength={10}
															{...field}
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
										<FormField
											control={form.control}
											name="newPassword"
											render={({ field }) => (
												<FormItem>
													<FormLabel className="text-[#37322F]">
														New Password
													</FormLabel>
													<FormControl>
														<Input
															type="password"
															placeholder="Enter new password"
															{...field}
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
										<FormField
											control={form.control}
											name="confirmPassword"
											render={({ field }) => (
												<FormItem>
													<FormLabel className="text-[#37322F]">
														Confirm New Password
													</FormLabel>
													<FormControl>
														<Input
															type="password"
															placeholder="Confirm new password"
															{...field}
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
										<div className="flex gap-3">
											<Button
												type="submit"
												disabled={isResetting}
												className="bg-[#37322F] hover:bg-[#37322F]/90 text-white"
											>
												{isResetting ? "Updating..." : "Update Password"}
											</Button>
											<Button
												type="button"
												variant="outline"
											onClick={() => {
												setCodeSent(false);
												form.reset();
												setError(null);
												setSuccess(null);
											}}
											>
												Cancel
											</Button>
										</div>
									</form>
								</Form>
							)}
						</CardContent>
					</Card>

					{/* Billing Section */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<CreditCard className="h-5 w-5" />
								Billing
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-6">
							{/* Current Subscription Status - All users can see */}
							{isLoadingBilling ? (
								<div className="flex items-center gap-2 text-sm text-[#605A57]">
									<Loader2 className="h-4 w-4 animate-spin" />
									Loading subscription status...
								</div>
							) : subscriptionStatus ? (
								<div className="space-y-3">
									<div className="flex items-center justify-between">
										<div>
											<p className="text-sm text-[#605A57] mb-1">
												Current Status
											</p>
											<Badge
												variant="outline"
												className={getStatusBadgeColor(subscriptionStatus.status)}
											>
												{getStatusLabel(subscriptionStatus.status)}
											</Badge>
										</div>
										{subscriptionStatus.status === "active" &&
											subscriptionStatus.currentPeriodEnd && (
												<div className="text-right">
													<p className="text-xs text-[#605A57]">
														{subscriptionStatus.cancelAtPeriodEnd
															? "Active till"
															: "Renews on"}
													</p>
													<p className="text-sm font-medium text-[#37322F]">
														{format(
															new Date(subscriptionStatus.currentPeriodEnd),
															"MMM d, yyyy"
														)}
													</p>
												</div>
											)}
									</div>


									{subscriptionStatus.status === "active" && isOwner && (
										<>
											{subscriptionStatus.cancelAtPeriodEnd && (
												<div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
													<p className="text-sm text-yellow-700">
														<strong>Subscription Canceled</strong> - Active until{" "}
														{subscriptionStatus.currentPeriodEnd
															? format(
																	new Date(subscriptionStatus.currentPeriodEnd),
																	"MMM d, yyyy"
															  )
															: "end of period"}
													</p>
												</div>
											)}
											{!subscriptionStatus.cancelAtPeriodEnd && (
												<>
													<Button
														variant="outline"
														onClick={() => setShowCancelDialog(true)}
														disabled={isCanceling}
														className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
													>
														<X className="h-4 w-4 mr-2" />
														Cancel Subscription
													</Button>

													{/* Cancel Subscription Confirmation Dialog */}
													<AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
														<AlertDialogContent>
															<AlertDialogHeader>
																<AlertDialogTitle>Sorry to see you go!</AlertDialogTitle>
																<AlertDialogDescription>
																	Are you sure you want to cancel your subscription? It will remain active until the end of the current billing period.
																</AlertDialogDescription>
															</AlertDialogHeader>
															<AlertDialogFooter>
																<AlertDialogCancel disabled={isCanceling}>
																	Keep Subscription
																</AlertDialogCancel>
																<AlertDialogAction
																	onClick={handleCancelSubscription}
																	disabled={isCanceling}
																	className="bg-red-600 hover:bg-red-700 text-white"
																>
																	{isCanceling ? (
																		<>
																			<Loader2 className="h-4 w-4 mr-2 animate-spin" />
																			Canceling...
																		</>
																	) : (
																		"Cancel Subscription"
																	)}
																</AlertDialogAction>
															</AlertDialogFooter>
														</AlertDialogContent>
													</AlertDialog>
												</>
											)}
										</>
									)}
								</div>
							) : (
								<p className="text-sm text-[#605A57]">
									Unable to load subscription status
								</p>
							)}

							{/* Pricing Plans - Owner Only */}
							{isOwner && (
								<div className="space-y-4 pt-4 border-t border-[#E0DEDB]">
									<div>
										<h3 className="text-lg font-semibold text-[#37322F] mb-2">
											Available Plans
										</h3>
										<p className="text-sm text-[#605A57] mb-4">
											Choose a plan that works for your organization
										</p>
									</div>

									{products.length === 0 ? (
										<div className="text-sm text-[#605A57]">
											Loading pricing plans...
										</div>
									) : (
										<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
											{products.map((product) => (
												<Card
													key={product.id}
													className="hover:shadow-md transition-shadow"
												>
													<CardHeader>
														<CardTitle className="text-lg">
															{product.name}
														</CardTitle>
														{product.description && (
															<p className="text-sm text-[#605A57]">
																{product.description}
															</p>
														)}
													</CardHeader>
													<CardContent className="space-y-4">
														<div>
															<div className="text-3xl font-bold text-[#37322F]">
																{formatPrice(product.amount, product.currency)}
															</div>
															{product.interval && (
																<p className="text-sm text-[#605A57]">
																	per {product.interval}
																</p>
															)}
														</div>
														<Button
															onClick={() =>
																product.priceId &&
																handleSelectPlan(product.priceId)
															}
															disabled={
																!product.priceId ||
																isCreatingCheckout ||
																subscriptionStatus?.status === "active"
															}
															className="w-full bg-[#37322F] hover:bg-[#37322F]/90 text-white"
														>
															{isCreatingCheckout ? (
																<>
																	<Loader2 className="h-4 w-4 mr-2 animate-spin" />
																	Processing...
																</>
															) : subscriptionStatus?.status === "active" ? (
																"Current Plan"
															) : (
																"Select Plan"
															)}
														</Button>
													</CardContent>
												</Card>
											))}
										</div>
									)}
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}

