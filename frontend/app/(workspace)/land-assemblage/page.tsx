"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import AddressAutocomplete, {
	AddressData,
} from "@/components/address-autocomplete";
import { HeartHandshake } from "lucide-react";
import { config } from "@/lib/config";
import { getReports, type Report } from "@/lib/reports";
import { getCurrentUser } from "@/lib/auth";

export default function LandAssemblagePage() {
	const router = useRouter();
	const [address1, setAddress1] = useState<AddressData | null>(null);
	const [address2, setAddress2] = useState<AddressData | null>(null);
	const [address3, setAddress3] = useState<AddressData | null>(null);
	const [isGenerating, setIsGenerating] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [recentReports, setRecentReports] = useState<Report[]>([]);
	const [isLoadingReports, setIsLoadingReports] = useState(true);

	useEffect(() => {
		const fetchRecentReports = async () => {
			try {
				setIsLoadingReports(true);
				const currentUser = await getCurrentUser();
				if (!currentUser) {
					setIsLoadingReports(false);
					return;
				}
				const reports = await getReports();
				const userAssemblageReports = reports.filter(
					(r) => r.CreatedBy === currentUser.user.IdUser && r.ReportType === "assemblage"
				);
				const sorted = userAssemblageReports
					.sort((a, b) => new Date(b.CreatedAt).getTime() - new Date(a.CreatedAt).getTime())
					.slice(0, 6);
				setRecentReports(sorted);
			} catch (err) {
				console.error("Error fetching recent assemblage reports:", err);
			} finally {
				setIsLoadingReports(false);
			}
		};
		fetchRecentReports();
	}, []);

	const handleAddress1Select = (data: AddressData) => {
		setAddress1(data);
		setAddress2(null);
		setAddress3(null);
		setError(null);
	};

	const handleAddress2Select = (data: AddressData) => {
		setAddress2(data);
		setAddress3(null);
		setError(null);
	};

	const handleAddress3Select = (data: AddressData) => {
		setAddress3(data);
		setError(null);
	};

	const canGenerate = address1 != null && address2 != null && !isGenerating;

	const handleGenerate = async () => {
		if (!address1 || !address2) return;
		setIsGenerating(true);
		setError(null);
		const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
		if (!token) {
			setError("Please sign in to generate reports.");
			setIsGenerating(false);
			return;
		}
		const addresses = [
			address1.normalizedAddress || address1.address,
			address2.normalizedAddress || address2.address,
			...(address3 ? [address3.normalizedAddress || address3.address] : []),
		];
		try {
			const res = await fetch(`${config.apiUrl}/api/assemblage-reports/generate`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ addresses }),
			});
			const data = await res.json();
			if (!res.ok) {
				setError(data.message || "Failed to generate assemblage report");
				setIsGenerating(false);
				return;
			}
			if (data.reportId) {
				// Refresh recent assemblage reports so the new one appears
				const currentUser = await getCurrentUser();
				if (currentUser) {
					const reports = await getReports();
					const userAssemblageReports = reports.filter(
						(r) => r.CreatedBy === currentUser.user.IdUser && r.ReportType === "assemblage"
					);
					const sorted = userAssemblageReports
						.sort((a, b) => new Date(b.CreatedAt).getTime() - new Date(a.CreatedAt).getTime())
						.slice(0, 6);
					setRecentReports(sorted);
				}
				router.push(`/assemblagereportview/${data.reportId}`);
				return;
			}
			setError("No report ID returned");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Request failed");
		} finally {
			setIsGenerating(false);
		}
	};

	return (
		<div className="w-full max-w-4xl mr-auto ml-0 p-6 space-y-8 text-left">
			<div>
				<h1 className="text-2xl font-semibold text-[#37322F]">
					Land Assemblage
				</h1>
				<p className="text-[#605A57] text-sm mt-1">
					Multi-property projects. Add two or three addresses to generate a combined report
					according to zoning laws.
				</p>
			</div>

			<div className="space-y-6">
				<div className="space-y-2">
					<label className="text-sm font-medium text-[#37322F]">
						Add the first address
					</label>
					<AddressAutocomplete
						onAddressSelect={handleAddress1Select}
						placeholder="Add the First Address: must be residential & within the 5 boroughs"
						className="w-full"
					/>
					{address1 && (
						<p className="text-sm text-[#605A57] mt-1">
							{address1.normalizedAddress || address1.address}
						</p>
					)}
				</div>

				{address1 && (
					<div className="space-y-2">
						<label className="text-sm font-medium text-[#37322F]">
							Second address
						</label>
						<AddressAutocomplete
							onAddressSelect={handleAddress2Select}
							placeholder="Add the Second Address: must be residential & within the 5 boroughs"
							className="w-full"
						/>
						{address2 && (
							<p className="text-sm text-[#605A57] mt-1">
								{address2.normalizedAddress || address2.address}
							</p>
						)}
					</div>
				)}

				{address1 && address2 && (
					<div className="space-y-2">
						<label className="text-sm font-medium text-[#37322F]">
							Add third address <span className="font-normal text-[#605A57]">(optional)</span>
						</label>
						<AddressAutocomplete
							onAddressSelect={handleAddress3Select}
							placeholder="Add the Third Address: must be residential & within the 5 boroughs"
							className="w-full"
						/>
						{address3 && (
							<p className="text-sm text-[#605A57] mt-1">
								{address3.normalizedAddress || address3.address}
							</p>
						)}
					</div>
				)}

				{error && (
					error.includes("design partner") || error.includes("test reports") ? (
						<div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
							<HeartHandshake className="size-5 shrink-0 text-amber-600 mt-0.5" aria-hidden />
							<p className="leading-relaxed">{error}</p>
						</div>
					) : (
						<p className="text-sm text-red-600">{error}</p>
					)
				)}
				<Button
					className="w-full bg-[#37322F] hover:bg-[#37322F]/90 text-white disabled:opacity-50 disabled:pointer-events-none"
					disabled={!canGenerate}
					onClick={handleGenerate}
				>
					{isGenerating ? "Generating…" : "Generate report"}
				</Button>
			</div>

			{/* Your recent assemblage searches */}
			<div>
				<h2 className="text-xl font-semibold text-[#37322F] mb-4">
					Your Recent Assemblage Searches
				</h2>
				{isLoadingReports ? (
					<div className="space-y-3">
						{Array.from({ length: 4 }).map((_, i) => (
							<Skeleton key={i} className="h-16 w-full rounded-lg" />
						))}
					</div>
				) : recentReports.length === 0 ? (
					<div className="bg-white rounded-lg border border-[rgba(55,50,47,0.12)] p-6 text-center">
						<p className="text-[#605A57] text-sm">
							No recent assemblage reports
						</p>
					</div>
				) : (
					<div className="space-y-3">
						{recentReports.map((report) => {
							const addresses = report.Address
								? report.Address.split(";").map((a) => a.trim()).filter(Boolean)
								: [];
							return (
								<div
									key={report.IdReport}
									className="flex items-center justify-between p-4 bg-white rounded-lg border border-[rgba(55,50,47,0.12)] hover:shadow-sm transition-shadow"
								>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-3 mb-2 flex-wrap">
											{addresses.length > 1 ? (
												<div className="flex flex-col gap-1">
													{addresses.map((addr, i) => (
														<span key={i} className="text-sm font-medium text-[#37322F]">
															{addr}
														</span>
													))}
												</div>
											) : (
												<span className="text-sm font-medium text-[#37322F] truncate">
													{report.Address}
												</span>
											)}
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
											{format(new Date(report.CreatedAt), "MMM d, yyyy 'at' h:mm a")}
										</p>
									</div>
									<Button
										variant="outline"
										size="sm"
										onClick={() => router.push(`/assemblagereportview/${report.IdReport}`)}
										className="ml-4 shrink-0"
									>
										View Report
									</Button>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
