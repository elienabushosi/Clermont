"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import AddressAutocomplete, {
	AddressData,
} from "@/components/address-autocomplete";
import AddressMap from "@/components/address-map";
import { getAuthToken, getCurrentUser } from "@/lib/auth";
import { getReports, type Report, getReportWithSources } from "@/lib/reports";
import {
	getSubscriptionStatus,
	createCheckoutSession,
	getProducts,
	formatPrice,
	type SubscriptionStatus,
	type StripeProduct,
} from "@/lib/billing";
import {
	Loader2,
	AlertTriangle,
	Check,
	HeartHandshake,
	Gem,
} from "lucide-react";
import Image from "next/image";
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
import { isAddressInFiveBoroughs } from "@/lib/nyc-bounds";

const STRIPE_PRODUCT_ID = process.env.NEXT_PUBLIC_STRIPE_PRODUCT_ID ?? "";
const STRIPE_ANNUAL_PRICE_ID =
	process.env.NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID ?? "";
const STRIPE_MONTHLY_PRICE_ID =
	process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID ?? "";

export default function SearchAddressPage() {
	const router = useRouter();
	const [addressData, setAddressData] = useState<AddressData | null>(null);
	const [recentReports, setRecentReports] = useState<Report[]>([]);
	const [isLoadingReports, setIsLoadingReports] = useState(true);
	const [pollingReportId, setPollingReportId] = useState<string | null>(null);
	const [subscriptionStatus, setSubscriptionStatus] =
		useState<SubscriptionStatus | null>(null);
	const [isLoadingSubscription, setIsLoadingSubscription] = useState(true);
	const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
	const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
	const [currentUser, setCurrentUser] = useState<{
		user: { Role: string };
	} | null>(null);
	const [products, setProducts] = useState<StripeProduct[]>([]);
	const [selectedPriceId, setSelectedPriceId] = useState<string | null>(null);

	const handleAddressSelect = (data: AddressData) => {
		setAddressData(data);
	};

	// Fetch subscription status and user info
	useEffect(() => {
		const fetchSubscriptionAndUser = async () => {
			try {
				const user = await getCurrentUser();
				setCurrentUser(user);

				const status = await getSubscriptionStatus();
				setSubscriptionStatus(status);

				// Fetch products if user is owner
				if (user?.user.Role === "Owner") {
					try {
						const productsList = await getProducts();
						setProducts(productsList);

						// Auto-select annual Pro plan by default
						const annualProPrice = productsList.find(
							(p) =>
								p.id === STRIPE_PRODUCT_ID &&
								p.priceId === STRIPE_ANNUAL_PRICE_ID,
						);
						if (annualProPrice) {
							setSelectedPriceId(annualProPrice.priceId);
						}
					} catch (err) {
						console.error("Error fetching products:", err);
					}
				}
			} catch (err) {
				console.error("Error fetching subscription status:", err);
			} finally {
				setIsLoadingSubscription(false);
			}
		};

		fetchSubscriptionAndUser();
	}, []);

	// Auto-select annual Pro plan when modal opens and products are loaded
	useEffect(() => {
		if (
			showSubscriptionModal &&
			currentUser?.user.Role === "Owner" &&
			products.length > 0 &&
			!selectedPriceId
		) {
			const annualProPrice = products.find(
				(p) =>
					p.id === STRIPE_PRODUCT_ID &&
					p.priceId === STRIPE_ANNUAL_PRICE_ID,
			);
			if (annualProPrice) {
				setSelectedPriceId(annualProPrice.priceId);
			}
		}
	}, [showSubscriptionModal, currentUser, products, selectedPriceId]);

	// Fetch recent reports for the logged-in user
	useEffect(() => {
		const fetchRecentReports = async () => {
			try {
				setIsLoadingReports(true);

				// Get current user to filter reports
				const currentUser = await getCurrentUser();
				if (!currentUser) {
					setIsLoadingReports(false);
					return;
				}

				const reports = await getReports();

				// Filter to only show single-property reports created by the current user (exclude assemblage)
				const userReports = reports.filter(
					(report) =>
						report.CreatedBy === currentUser.user.IdUser &&
						report.ReportType !== "assemblage",
				);

				// Sort by CreatedAt descending and take the 6 most recent
				const sortedReports = userReports
					.sort(
						(a, b) =>
							new Date(b.CreatedAt).getTime() -
							new Date(a.CreatedAt).getTime(),
					)
					.slice(0, 6);
				setRecentReports(sortedReports);
			} catch (err) {
				console.error("Error fetching recent reports:", err);
				// Don't show error toast, just log it - this is a non-critical feature
			} finally {
				setIsLoadingReports(false);
			}
		};

		fetchRecentReports();
	}, []);

	// Poll report status when a report is being generated
	useEffect(() => {
		if (!pollingReportId) return;

		let pollInterval: NodeJS.Timeout | null = null;
		let pollTimeout: NodeJS.Timeout | null = null;
		let pollCount = 0;
		let isPolling = true;
		const maxPolls = 120; // Poll for up to 2 minutes (120 * 1 second)
		const pollIntervalMs = 2000; // Poll every 2 seconds

		const pollReportStatus = async () => {
			if (!isPolling) return;

			pollCount++;

			// Stop polling after max attempts
			if (pollCount > maxPolls) {
				if (pollInterval) clearInterval(pollInterval);
				toast.error(
					"Report is taking longer than expected. Please check back later.",
					{
						id: `report-timeout-${pollingReportId}`,
					},
				);
				setPollingReportId(null);
				return;
			}

			try {
				const reportData = await getReportWithSources(pollingReportId);
				const status = reportData.report.Status;

				if (status === "ready") {
					isPolling = false;
					if (pollInterval) clearInterval(pollInterval);

					// Report is ready - show success toast with button
					toast.success("Your report is ready!", {
						id: `report-ready-${pollingReportId}`,
						duration: 10000, // Show for 10 seconds
						action: {
							label: "View Report",
							onClick: () => {
								router.push(`/viewreport/${pollingReportId}`);
							},
						},
					});
					setPollingReportId(null);

					// Refresh recent reports to show the new one (single only)
					const currentUser = await getCurrentUser();
					if (currentUser) {
						const reports = await getReports();
						const userReports = reports.filter(
							(report) =>
								report.CreatedBy === currentUser.user.IdUser &&
								report.ReportType !== "assemblage",
						);
						const sortedReports = userReports
							.sort(
								(a, b) =>
									new Date(b.CreatedAt).getTime() -
									new Date(a.CreatedAt).getTime(),
							)
							.slice(0, 6);
						setRecentReports(sortedReports);
					}
				} else if (status === "failed") {
					isPolling = false;
					if (pollInterval) clearInterval(pollInterval);

					// Report failed
					toast.error("Report generation failed", {
						id: `report-failed-${pollingReportId}`,
					});
					setPollingReportId(null);
				}
				// If still pending, continue polling
			} catch (error) {
				console.error("Error polling report status:", error);
				// Don't show error toast for polling errors, just continue polling
				// Only stop if we've exceeded max polls
			}
		};

		// Start polling
		pollInterval = setInterval(pollReportStatus, pollIntervalMs);

		// Also poll immediately
		pollReportStatus();

		// Cleanup function
		return () => {
			isPolling = false;
			if (pollInterval) clearInterval(pollInterval);
			if (pollTimeout) clearTimeout(pollTimeout);
		};
	}, [pollingReportId, router]);

	const handleGenerateReport = async () => {
		if (!addressData) {
			toast.error("Please select an address first");
			return;
		}

		if (!isAddressInFiveBoroughs(addressData)) {
			// Same flow as requiresSubscription: show subscription modal
			const annualProPrice = products.find(
				(p) =>
					p.id === STRIPE_PRODUCT_ID &&
					p.priceId === STRIPE_ANNUAL_PRICE_ID,
			);
			if (annualProPrice && !selectedPriceId) {
				setSelectedPriceId(annualProPrice.priceId);
			}
			setShowSubscriptionModal(true);
			return;
		}

		const token = getAuthToken();
		if (!token) {
			toast.error("Please log in to generate reports");
			return;
		}

		// Backend will handle the subscription check and return requiresSubscription: true if needed

		try {
			toast.loading("Generating report...", { id: "generate-report" });

			const response = await fetch(
				`${config.apiUrl}/api/reports/generate`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({
						address: addressData.address,
						normalizedAddress: addressData.normalizedAddress,
						location: addressData.location,
						placeId: addressData.placeId,
					}),
				},
			);

			const result = await response.json();

			if (!response.ok) {
				// Check if subscription is required
				if (result.requiresSubscription) {
					toast.dismiss("generate-report");
					// Auto-select annual Pro plan when opening modal
					const annualProPrice = products.find(
						(p) =>
							p.id === STRIPE_PRODUCT_ID &&
							p.priceId === STRIPE_ANNUAL_PRICE_ID,
					);
					if (annualProPrice && !selectedPriceId) {
						setSelectedPriceId(annualProPrice.priceId);
					}
					setShowSubscriptionModal(true);
					return;
				}

				toast.error(result.message || "Failed to generate report", {
					id: "generate-report",
				});
				return;
			}

			toast.success("Report generation started successfully!", {
				id: "generate-report",
			});

			console.log("Report generated:", result);

			// Refresh subscription status to update free reports count
			if (isOwner && !hasActiveSubscription) {
				const status = await getSubscriptionStatus();
				setSubscriptionStatus(status);
			}

			// Start polling for report status
			if (result.reportId) {
				setPollingReportId(result.reportId);
			}
		} catch (error) {
			console.error("Error generating report:", error);
			toast.error("Network error. Please try again later.", {
				id: "generate-report",
			});
		}
	};

	const handleSelectPlan = async () => {
		// Use selected price or default to annual Pro
		const priceIdToUse =
			selectedPriceId ||
			products.find(
				(p) =>
					p.id === STRIPE_PRODUCT_ID &&
					p.priceId === STRIPE_ANNUAL_PRICE_ID,
			)?.priceId;

		if (!priceIdToUse) {
			toast.error("Please select a plan");
			return;
		}

		setIsCreatingCheckout(true);
		try {
			const { url } = await createCheckoutSession(priceIdToUse);
			// Redirect to Stripe Checkout
			window.location.href = url;
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to start checkout",
			);
			setIsCreatingCheckout(false);
		}
	};

	// Check subscription and user info
	const hasActiveSubscription = subscriptionStatus?.status === "active";
	const isOwner = currentUser?.user.Role === "Owner";

	// Calculate remaining free reports (only for owners without subscription)
	const freeReportsRemaining =
		hasActiveSubscription || !isOwner
			? null
			: (subscriptionStatus?.freeReportsLimit || 2) -
				(subscriptionStatus?.freeReportsUsed || 0);

	// Check if button should be disabled
	const isButtonDisabled =
		!addressData || isLoadingSubscription || isLoadingReports;

	return (
		<div className="p-8">
			<div className="max-w-4xl">
				{/* Free Reports Indicator */}
				{isLoadingSubscription ? (
					<div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
						<div className="flex items-center gap-2">
							<Loader2 className="h-4 w-4 animate-spin text-[#605A57]" />
							<p className="text-sm text-[#605A57]">
								Loading subscription status...
							</p>
						</div>
					</div>
				) : (
					!hasActiveSubscription &&
					freeReportsRemaining !== null && (
						<div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
							<p className="text-sm text-blue-700">
								<strong>Test Reports:</strong>{" "}
								{freeReportsRemaining} of{" "}
								{subscriptionStatus?.freeReportsLimit || 2}{" "}
								remaining
							</p>
						</div>
					)
				)}

				<div className="flex gap-4 mb-8">
					<AddressAutocomplete
						onAddressSelect={handleAddressSelect}
						placeholder="Address must be residential & within the 5 boroughs"
						className="flex-1"
					/>
					<Button
						onClick={handleGenerateReport}
						disabled={isButtonDisabled}
					>
						Generate Report
					</Button>
				</div>

				{/* Map display when address is selected */}
				{addressData && (
					<div className="mb-8">
						<AddressMap addressData={addressData} />
						<p className="text-sm text-[#605A57] mt-2">
							{addressData.address}
						</p>
					</div>
				)}

				<div>
					<h2 className="text-xl font-semibold text-[#37322F] mb-4">
						Your Recent Searches
					</h2>
					{isLoadingReports ? (
						<div className="space-y-3">
							{Array.from({ length: 6 }).map((_, index) => (
								<Skeleton
									key={index}
									className="h-16 w-full rounded-lg"
								/>
							))}
						</div>
					) : recentReports.length === 0 ? (
						<div className="bg-white rounded-lg border border-[rgba(55,50,47,0.12)] p-6 text-center">
							<p className="text-[#605A57]">
								No recent reports found
							</p>
						</div>
					) : (
						<div className="space-y-3">
							{recentReports.map((report) => (
								<div
									key={report.IdReport}
									className="flex items-center justify-between p-4 bg-white rounded-lg border border-[rgba(55,50,47,0.12)] hover:shadow-sm transition-shadow"
								>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-3 mb-2 flex-wrap">
											<span className="text-sm font-medium text-[#37322F] truncate">
												{report.Address}
											</span>
											{report.ZoningDistricts && (
												<Badge
													variant="outline"
													className="bg-blue-100 text-blue-700 border-blue-300 text-xs shrink-0"
												>
													{report.ZoningDistricts}
												</Badge>
											)}
										</div>
										<p className="text-xs text-[#605A57]">
											{format(
												new Date(report.CreatedAt),
												"MMM d, yyyy 'at' h:mm a",
											)}
										</p>
									</div>
									<Button
										variant="outline"
										size="sm"
										onClick={() =>
											router.push(
												`/viewreport/${report.IdReport}`,
											)
										}
										className="ml-4 shrink-0"
									>
										View Report
									</Button>
								</div>
							))}
						</div>
					)}
				</div>
			</div>

			{/* Subscription Required Modal */}
			<AlertDialog
				open={showSubscriptionModal}
				onOpenChange={setShowSubscriptionModal}
			>
				<AlertDialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
					{isOwner ? (
						// Owner view: Upgrade to Pro modal
						<>
							<AlertDialogHeader>
								<div className="flex flex-col items-center text-center mb-4">
									<Image
										src="/logos/clermontpaymentmodallogo.png"
										alt="Clermont"
										width={120}
										height={40}
										className="mb-3"
									/>
									<AlertDialogTitle className="text-2xl font-bold text-[#37322F]">
										Become a Design Partner
									</AlertDialogTitle>
									<AlertDialogDescription className="text-base mt-2">
										Pilot Clermont with full access and
										direct influence on the product
									</AlertDialogDescription>
								</div>
							</AlertDialogHeader>

							{/* Friendly design-partner message with icon */}
							<div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 mb-4">
								<HeartHandshake
									className="size-5 shrink-0 text-amber-600 mt-0.5"
									aria-hidden
								/>
								<p className="leading-relaxed">
									You’ve reached the end of your test reports.
									Join the paid pilot to continue generating
									reports and help shape Clermont.
								</p>
							</div>

							<div className="py-4">
								{/* Features List */}
								<div className="mb-6 space-y-3">
									{[
										"Unlimited reports",
										"Residential NYC addresses(only)",
										"Single Parcel",
										"Assemblage",
										"Zoning Restriction Insights",
										"High Requirement Data",
										"Zone Lot Coverage Data",
										"Yard Requirements",
									].map((feature) => (
										<div
											key={feature}
											className="flex items-center gap-3"
										>
											<div
												className="h-6 w-6 rounded-full flex items-center justify-center shrink-0"
												style={{
													backgroundColor: "#6f9f6b",
												}}
											>
												<Check className="h-4 w-4 text-white" />
											</div>
											<span className="text-sm text-[#37322F]">
												{feature}
											</span>
										</div>
									))}
								</div>

								{/* Additional Benefits Section */}
								<div className="mb-6 space-y-3 pt-4 border-t border-[rgba(55,50,47,0.12)]">
									{[
										"Early Access",
										"Priority support",
										"Weekly feedback session (30–45 min)",
										"Ability to influence roadmap priorities",
									].map((benefit) => (
										<div
											key={benefit}
											className="flex items-center gap-3"
										>
											<Gem className="h-4 w-4 shrink-0 text-[#6f9f6b]" />
											<span className="text-sm text-[#37322F]">
												{benefit}
											</span>
										</div>
									))}
								</div>

								{/* Pricing Options */}
								{products.length > 0 ? (
									<div className="space-y-3">
										{(() => {
											// Filter for the specific product and group prices
											const proProduct = products.find(
												(p) =>
													p.id === STRIPE_PRODUCT_ID,
											);

											// Calculate savings for fallback case (when product not found)
											const fallbackMonthlyPrice =
												products.find(
													(p) =>
														p.id ===
															STRIPE_PRODUCT_ID &&
														p.priceId ===
															STRIPE_MONTHLY_PRICE_ID,
												);
											const fallbackAnnualPrice =
												products.find(
													(p) =>
														p.id ===
															STRIPE_PRODUCT_ID &&
														p.priceId ===
															STRIPE_ANNUAL_PRICE_ID,
												);
											const fallbackMonthlyAnnualCost =
												fallbackMonthlyPrice?.amount
													? fallbackMonthlyPrice.amount *
														12
													: 0;
											const fallbackAnnualCost =
												fallbackAnnualPrice?.amount ||
												0;
											const fallbackSavings =
												fallbackMonthlyAnnualCost -
												fallbackAnnualCost;
											const fallbackSavingsFormatted =
												fallbackSavings > 0 &&
												fallbackAnnualPrice?.currency
													? new Intl.NumberFormat(
															"en-US",
															{
																style: "currency",
																currency:
																	fallbackAnnualPrice.currency.toUpperCase(),
																minimumFractionDigits: 0,
																maximumFractionDigits: 0,
															},
														).format(
															Math.floor(
																fallbackSavings /
																	100,
															),
														)
													: null;

											if (!proProduct) {
												// If product not found, show all products
												return products.map(
													(product) => {
														const isSelected =
															selectedPriceId ===
															product.priceId;
														return (
															<div
																key={product.id}
																className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
																	isSelected
																		? "border-blue-600 bg-blue-50"
																		: "border-gray-200 hover:bg-gray-50"
																}`}
																onClick={() =>
																	setSelectedPriceId(
																		product.priceId ||
																			null,
																	)
																}
															>
																<div className="flex items-center justify-between">
																	<div className="flex items-center gap-3">
																		<input
																			type="radio"
																			name="plan"
																			checked={
																				isSelected
																			}
																			onChange={() =>
																				setSelectedPriceId(
																					product.priceId ||
																						null,
																				)
																			}
																			className="h-4 w-4"
																		/>
																		<div>
																			<div className="font-semibold text-[#37322F]">
																				Pilot
																				Access
																			</div>
																			<div className="text-xs text-[#605A57] mt-1">
																				{product.interval ===
																				"month"
																					? "billed monthly"
																					: "billed annually"}
																			</div>
																		</div>
																	</div>
																	<div className="text-right">
																		<div className="font-bold text-lg text-[#37322F]">
																			{formatPrice(
																				product.amount,
																				product.currency,
																			)}
																		</div>
																		{product.interval ===
																			"year" &&
																			fallbackSavingsFormatted && (
																				<div className="text-xs text-green-600 font-medium mt-1">
																					Save{" "}
																					{
																						fallbackSavingsFormatted
																					}{" "}
																					annually
																				</div>
																			)}
																	</div>
																</div>
															</div>
														);
													},
												);
											}

											// Group prices for the Pro product
											const monthlyPrice = products.find(
												(p) =>
													p.id ===
														STRIPE_PRODUCT_ID &&
													p.priceId ===
														STRIPE_MONTHLY_PRICE_ID,
											);
											const annualPrice = products.find(
												(p) =>
													p.id ===
														STRIPE_PRODUCT_ID &&
													p.priceId ===
														STRIPE_ANNUAL_PRICE_ID,
											);

											// Calculate savings for annual plan
											const monthlyAnnualCost =
												monthlyPrice?.amount
													? monthlyPrice.amount * 12
													: 0;
											const annualCost =
												annualPrice?.amount || 0;
											const savings =
												monthlyAnnualCost - annualCost;
											const savingsFormatted =
												savings > 0 &&
												annualPrice?.currency
													? new Intl.NumberFormat(
															"en-US",
															{
																style: "currency",
																currency:
																	annualPrice.currency.toUpperCase(),
																minimumFractionDigits: 0,
																maximumFractionDigits: 0,
															},
														).format(
															Math.floor(
																savings / 100,
															),
														)
													: null;

											// Use annual as default if no selection
											const defaultPriceId =
												selectedPriceId ||
												annualPrice?.priceId ||
												monthlyPrice?.priceId;

											return (
												<>
													{monthlyPrice && (
														<div
															className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
																(selectedPriceId ||
																	defaultPriceId) ===
																monthlyPrice.priceId
																	? "border-blue-600 bg-blue-50"
																	: "border-gray-200 hover:bg-gray-50"
															}`}
															onClick={() =>
																setSelectedPriceId(
																	monthlyPrice.priceId,
																)
															}
														>
															<div className="flex items-center justify-between">
																<div className="flex items-center gap-3">
																	<input
																		type="radio"
																		name="plan"
																		checked={
																			(selectedPriceId ||
																				defaultPriceId) ===
																			monthlyPrice.priceId
																		}
																		onChange={() =>
																			setSelectedPriceId(
																				monthlyPrice.priceId,
																			)
																		}
																		className="h-4 w-4"
																	/>
																	<div>
																		<div className="font-semibold text-[#37322F]">
																			Pilot
																			Access
																		</div>
																		<div className="text-xs text-[#605A57] mt-1">
																			billed
																			monthly
																			&{" "}
																			<span className="italic">
																				cancel
																				anytime
																			</span>
																		</div>
																	</div>
																</div>
																<div className="text-right">
																	<div className="font-bold text-lg text-[#37322F]">
																		{formatPrice(
																			monthlyPrice.amount,
																			monthlyPrice.currency,
																			monthlyPrice.priceId,
																		)}
																	</div>
																	<div className="text-xs text-[#605A57] mt-0.5">
																		per
																		month
																	</div>
																</div>
															</div>
														</div>
													)}
													{annualPrice && (
														<div
															className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
																(selectedPriceId ||
																	defaultPriceId) ===
																annualPrice.priceId
																	? "border-blue-600 bg-blue-50"
																	: "border-gray-200 hover:bg-gray-50"
															}`}
															onClick={() =>
																setSelectedPriceId(
																	annualPrice.priceId,
																)
															}
														>
															<div className="flex items-center justify-between">
																<div className="flex items-center gap-3">
																	<input
																		type="radio"
																		name="plan"
																		checked={
																			(selectedPriceId ||
																				defaultPriceId) ===
																			annualPrice.priceId
																		}
																		onChange={() =>
																			setSelectedPriceId(
																				annualPrice.priceId,
																			)
																		}
																		className="h-4 w-4"
																	/>
																	<div>
																		<div className="font-semibold text-[#37322F]">
																			Pilot
																			Access
																		</div>
																		<div className="text-xs text-[#605A57] mt-1">
																			billed
																			annually
																		</div>
																	</div>
																</div>
																<div className="text-right">
																	<div className="font-bold text-lg text-[#37322F]">
																		{annualPrice.amount !=
																		null
																			? new Intl.NumberFormat(
																					"en-US",
																					{
																						style: "currency",
																						currency:
																							(
																								annualPrice.currency ||
																								"usd"
																							).toUpperCase(),
																						minimumFractionDigits: 0,
																						maximumFractionDigits: 0,
																					},
																				).format(
																					Math.floor(
																						annualPrice.amount /
																							1200,
																					),
																				)
																			: "—"}
																	</div>
																	<div className="text-xs text-[#605A57] mt-0.5">
																		per
																		month
																	</div>
																	{savingsFormatted && (
																		<div className="text-xs text-green-600 font-medium mt-1">
																			Save{" "}
																			{
																				savingsFormatted
																			}{" "}
																			annually
																		</div>
																	)}
																</div>
															</div>
														</div>
													)}
												</>
											);
										})()}
									</div>
								) : (
									<div className="text-center py-8 text-[#605A57]">
										Loading pricing plans...
									</div>
								)}
							</div>
						</>
					) : (
						// Team member view: Show alert message
						<>
							<AlertDialogHeader>
								<AlertDialogTitle>
									Subscription Required
								</AlertDialogTitle>
								<AlertDialogDescription>
									Contact your admin to subscribe. A
									subscription from your organization is
									required to generate reports.
								</AlertDialogDescription>
							</AlertDialogHeader>
							<div className="py-4">
								<div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
									<AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
									<p className="text-sm text-yellow-800">
										Contact your admin to subscribe. A
										subscription from your organization is
										required to generate reports.
									</p>
								</div>
							</div>
						</>
					)}

					<AlertDialogFooter>
						{isOwner ? (
							<>
								<AlertDialogCancel
									disabled={isCreatingCheckout}
								>
									Cancel
								</AlertDialogCancel>
								<AlertDialogAction
									onClick={handleSelectPlan}
									disabled={
										(!selectedPriceId &&
											!products.find(
												(p) =>
													p.id ===
														STRIPE_PRODUCT_ID &&
													p.priceId ===
														STRIPE_ANNUAL_PRICE_ID,
											)?.priceId) ||
										isCreatingCheckout
									}
									className="bg-[#37322F] hover:bg-[#37322F]/90"
								>
									{isCreatingCheckout ? (
										<>
											<Loader2 className="h-4 w-4 mr-2 animate-spin" />
											Processing...
										</>
									) : (
										"Continue to Checkout"
									)}
								</AlertDialogAction>
							</>
						) : (
							<AlertDialogCancel>Close</AlertDialogCancel>
						)}
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
