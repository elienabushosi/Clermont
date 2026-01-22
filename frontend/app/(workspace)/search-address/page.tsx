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

export default function SearchAddressPage() {
	const router = useRouter();
	const [addressData, setAddressData] = useState<AddressData | null>(null);
	const [recentReports, setRecentReports] = useState<Report[]>([]);
	const [isLoadingReports, setIsLoadingReports] = useState(true);
	const [pollingReportId, setPollingReportId] = useState<string | null>(null);

	const handleAddressSelect = (data: AddressData) => {
		setAddressData(data);
	};

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
				
				// Filter to only show reports created by the current user
				const userReports = reports.filter(
					(report) => report.CreatedBy === currentUser.user.IdUser
				);
				
				// Sort by CreatedAt descending and take the 6 most recent
				const sortedReports = userReports
					.sort(
						(a, b) =>
							new Date(b.CreatedAt).getTime() -
							new Date(a.CreatedAt).getTime()
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
					}
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
					
					// Refresh recent reports to show the new one
					const currentUser = await getCurrentUser();
					if (currentUser) {
						const reports = await getReports();
						const userReports = reports.filter(
							(report) => report.CreatedBy === currentUser.user.IdUser
						);
						const sortedReports = userReports
							.sort(
								(a, b) =>
									new Date(b.CreatedAt).getTime() -
									new Date(a.CreatedAt).getTime()
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

		const token = getAuthToken();
		if (!token) {
			toast.error("Please log in to generate reports");
			return;
		}

		try {
			toast.loading("Generating report...", { id: "generate-report" });

			const response = await fetch(
				"http://localhost:3002/api/reports/generate",
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
				}
			);

			const result = await response.json();

			if (!response.ok) {
				toast.error(result.message || "Failed to generate report", {
					id: "generate-report",
				});
				return;
			}

			toast.success("Report generation started successfully!", {
				id: "generate-report",
			});

			console.log("Report generated:", result);
			
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

	return (
		<div className="p-8">
			<div className="max-w-4xl">
				<div className="flex gap-4 mb-8">
					<AddressAutocomplete
						onAddressSelect={handleAddressSelect}
						placeholder="Add Address"
						className="flex-1"
					/>
					<Button
						onClick={handleGenerateReport}
						disabled={!addressData}
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
										<div className="flex items-center gap-3 mb-2">
											<span className="text-sm font-medium text-[#37322F] truncate">
												{report.Address}
											</span>
											{report.District && (
												<Badge
													variant="outline"
													className="bg-blue-100 text-blue-700 border-blue-300 text-xs shrink-0"
												>
													{report.District}
												</Badge>
											)}
										</div>
										<p className="text-xs text-[#605A57]">
											{format(
												new Date(report.CreatedAt),
												"MMM d, yyyy 'at' h:mm a"
											)}
										</p>
									</div>
									<Button
										variant="outline"
										size="sm"
										onClick={() =>
											router.push(
												`/viewreport/${report.IdReport}`
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
		</div>
	);
}
