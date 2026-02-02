"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format, isWithinInterval, subDays, subHours } from "date-fns";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getReports, type Report } from "@/lib/reports";
import { getBuildingClassDescriptionText } from "@/lib/building-class";
import { getLandUseDescriptionText } from "@/lib/land-use";
import {
	FileText,
	Calendar,
	User,
	Building2,
	LandPlot,
	Grid2x2Check,
	Ruler,
	Home,
	Search,
	SquareDashed,
	SquareStack,
} from "lucide-react";

function getStatusColor(status: string) {
	switch (status) {
		case "pending":
			return "bg-yellow-100 text-yellow-700 border-yellow-200";
		case "ready":
			return "bg-green-100 text-green-700 border-green-200";
		case "failed":
			return "bg-red-100 text-red-700 border-red-200";
		default:
			return "bg-gray-100 text-gray-700 border-gray-200";
	}
}

function formatLotArea(lotArea: number | null): string {
	if (!lotArea) return "—";
	return `${lotArea.toLocaleString()} sq ft`;
}

function formatFAR(far: number | null): string {
	if (!far) return "—";
	return far.toFixed(2);
}

function formatLotCoverage(coverage: number | null): string {
	if (!coverage) return "—";
	return `${(coverage * 100).toFixed(0)}%`;
}

function ReportCard({ report }: { report: Report }) {
	const router = useRouter();
	const isAssemblage = report.ReportType === "assemblage";
	const addresses = isAssemblage && report.Address
		? report.Address.split(";").map((a) => a.trim()).filter(Boolean)
		: [report.Address];

	return (
		<Card className="hover:shadow-md transition-shadow">
			<CardHeader>
				<div className="flex items-start justify-between">
					<div className="flex-1">
						<div className="flex items-center gap-2 mb-2">
							{isAssemblage ? (
								<SquareStack className="h-5 w-5 text-[#4090C2] shrink-0" />
							) : (
								<SquareDashed className="h-5 w-5 text-[#4090C2] shrink-0" />
							)}
							<CardTitle className="text-lg font-semibold text-[#37322F]">
								{isAssemblage && addresses.length > 1 ? (
									<div className="flex flex-col gap-1">
										{addresses.map((addr, i) => (
											<span key={i} className="text-base">
												{addr}
											</span>
										))}
									</div>
								) : (
									report.Address
								)}
							</CardTitle>
						</div>
						<div className="flex items-center gap-2 flex-wrap">
							<Badge
								variant="outline"
								className={`text-xs ${getStatusColor(report.Status)}`}
							>
								{report.Status}
							</Badge>
							{isAssemblage && (
								<Badge variant="outline" className="text-xs bg-amber-50 text-amber-800 border-amber-200">
									Assemblage
								</Badge>
							)}
							{report.CreatedByName && (
								<Badge variant="outline" className="text-xs">
									<User className="h-3 w-3 mr-1" />
									{report.CreatedByName}
								</Badge>
							)}
							<Badge variant="outline" className="text-xs text-[#605A57]">
								<Calendar className="h-3 w-3 mr-1" />
								{format(new Date(report.CreatedAt), "MMM d, yyyy")}
							</Badge>
						</div>
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
					{report.LandUse && (
						<div className="flex items-start gap-2 text-sm">
							<LandPlot className="h-4 w-4 text-[#605A57] mt-0.5 shrink-0" />
							<div>
								<span className="text-[#605A57]">Land Use: </span>
								<span className="text-[#37322F] font-medium">
									{getLandUseDescriptionText(report.LandUse) || report.LandUse}
								</span>
							</div>
						</div>
					)}
					{report.BuildingClass && (
						<div className="flex items-start gap-2 text-sm">
							<Building2 className="h-4 w-4 text-[#605A57] mt-0.5 shrink-0" />
							<div>
								<span className="text-[#605A57]">Building Class: </span>
								<span className="text-[#37322F] font-medium">
									{getBuildingClassDescriptionText(report.BuildingClass) ||
										report.BuildingClass}
								</span>
							</div>
						</div>
					)}
					{report.ZoningDistricts && (
						<div className="flex items-start gap-2 text-sm">
							<Grid2x2Check className="h-4 w-4 text-[#605A57] mt-0.5 shrink-0" />
							<div>
								<span className="text-[#605A57]">Zoning Districts: </span>
								<span className="text-[#37322F] font-medium">
									{report.ZoningDistricts}
								</span>
							</div>
						</div>
					)}
					{report.LotArea && (
						<div className="flex items-start gap-2 text-sm">
							<Ruler className="h-4 w-4 text-[#605A57] mt-0.5 shrink-0" />
							<div>
								<span className="text-[#605A57]">
									{isAssemblage ? "Combined Lot Area: " : "Lot Area: "}
								</span>
								<span className="text-[#37322F] font-medium">
									{formatLotArea(report.LotArea)}
								</span>
							</div>
						</div>
					)}
					{report.MaxFAR && (
						<div className="flex items-start gap-2 text-sm">
							<Building2 className="h-4 w-4 text-[#605A57] mt-0.5 shrink-0" />
							<div>
								<span className="text-[#605A57]">
									{isAssemblage ? "Combined Max FAR: " : "Max FAR: "}
								</span>
								<span className="text-[#37322F] font-medium">
									{formatFAR(report.MaxFAR)}
								</span>
							</div>
						</div>
					)}
					{report.MaxLotCoverage && (
						<div className="flex items-start gap-2 text-sm">
							<Grid2x2Check className="h-4 w-4 text-[#605A57] mt-0.5 shrink-0" />
							<div>
								<span className="text-[#605A57]">Max Lot Coverage: </span>
								<span className="text-[#37322F] font-medium">
									{formatLotCoverage(report.MaxLotCoverage)}
								</span>
							</div>
						</div>
					)}
					{report.NumberOfFloors && (
						<div className="flex items-start gap-2 text-sm">
							<Building2 className="h-4 w-4 text-[#605A57] mt-0.5 shrink-0" />
							<div>
								<span className="text-[#605A57]">Number of Floors: </span>
								<span className="text-[#37322F] font-medium">
									{report.NumberOfFloors}
								</span>
							</div>
						</div>
					)}
					{report.ResidentialUnits !== null && (
						<div className="flex items-start gap-2 text-sm">
							<Home className="h-4 w-4 text-[#605A57] mt-0.5 shrink-0" />
							<div>
								<span className="text-[#605A57]">Residential Units: </span>
								<span className="text-[#37322F] font-medium">
									{report.ResidentialUnits || 0}
								</span>
							</div>
						</div>
					)}
				</div>
				<div className="pt-3 border-t border-[#E0DEDB]">
					<Button
						onClick={() => router.push(
							isAssemblage
								? `/assemblagereportview/${report.IdReport}`
								: `/viewreport/${report.IdReport}`
						)}
						className="w-full bg-[#37322F] hover:bg-[#37322F]/90 text-white"
					>
						<FileText className="h-4 w-4 mr-2" />
						View Report
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

function ReportSection({
	title,
	reports,
}: {
	title: string;
	reports: Report[];
}) {
	if (reports.length === 0) return null;

	return (
		<div className="mb-8">
			<h3 className="text-xl font-semibold text-[#37322F] mb-4">{title}</h3>
			<div className="space-y-4">
				{reports.map((report) => (
					<ReportCard key={report.IdReport} report={report} />
				))}
			</div>
		</div>
	);
}

export default function HomePage() {
	const router = useRouter();
	const [reports, setReports] = useState<Report[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchReports = async () => {
			try {
				setIsLoading(true);
				setError(null);
				const data = await getReports();
				// Sort by CreatedAt descending (newest first)
				const sorted = data.sort(
					(a, b) =>
						new Date(b.CreatedAt).getTime() -
						new Date(a.CreatedAt).getTime()
				);
				setReports(sorted);
			} catch (err) {
				console.error("Error fetching reports:", err);
				setError(
					err instanceof Error ? err.message : "Failed to load reports"
				);
			} finally {
				setIsLoading(false);
			}
		};

		fetchReports();
	}, []);

	// Organize reports by time periods
	const now = new Date();
	const last24Hours = subHours(now, 24);
	const last7Days = subDays(now, 7);

	const last24HoursReports = reports.filter((report) => {
		const reportDate = new Date(report.CreatedAt);
		return reportDate >= last24Hours;
	});

	const last7DaysReports = reports.filter((report) => {
		const reportDate = new Date(report.CreatedAt);
		return reportDate >= last7Days && reportDate < last24Hours;
	});

	const olderReports = reports.filter((report) => {
		const reportDate = new Date(report.CreatedAt);
		return reportDate < last7Days;
	});

	if (isLoading) {
		return (
			<div className="p-8">
				<div className="max-w-6xl mx-auto">
					<h2 className="text-2xl font-semibold text-[#37322F] mb-6">
						Reports Dashboard
					</h2>
					<div className="space-y-4">
						{[1, 2, 3].map((i) => (
							<Card key={i}>
								<CardHeader>
									<Skeleton className="h-6 w-64" />
								</CardHeader>
								<CardContent>
									<Skeleton className="h-32 w-full" />
								</CardContent>
							</Card>
						))}
					</div>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="p-8">
				<div className="max-w-6xl mx-auto">
					<Card>
						<CardContent className="py-12 text-center">
							<p className="text-red-600 mb-4">{error}</p>
							<Button
								onClick={() => window.location.reload()}
								variant="outline"
							>
								Retry
							</Button>
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	return (
		<div className="p-8">
			<div className="max-w-6xl mx-auto">
				<div className="mb-6 flex items-start justify-between">
					<div>
						<h2 className="text-2xl font-semibold text-[#37322F] mb-2">
							Reports Dashboard
						</h2>
						<p className="text-sm text-[#605A57]">
							Overview of all reports for your organization
						</p>
					</div>
					<Button
						onClick={() => router.push("/search-address")}
						className="bg-[#37322F] hover:bg-[#37322F]/90 text-white"
					>
						<Search className="h-4 w-4 mr-2" />
						Single Parcel
					</Button>
				</div>

				{reports.length === 0 ? (
					<Card>
						<CardContent className="py-12 text-center">
							<MapPin className="h-12 w-12 text-[#605A57] mx-auto mb-4" />
							<p className="text-[#605A57] mb-4">No reports found</p>
							<Button
								onClick={() => router.push("/search-address")}
								className="bg-[#37322F] hover:bg-[#37322F]/90 text-white"
							>
								Create Your First Report
							</Button>
						</CardContent>
					</Card>
				) : (
					<>
						<ReportSection
							title="Last 24 Hours"
							reports={last24HoursReports}
						/>
						<ReportSection
							title="Last 7 Days"
							reports={last7DaysReports}
						/>
						<ReportSection title="Older Reports" reports={olderReports} />
					</>
				)}
			</div>
		</div>
	);
}
