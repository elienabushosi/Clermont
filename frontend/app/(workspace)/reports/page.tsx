"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getReports, type Report } from "@/lib/reports";

function getStatusColor(status: Report["Status"]) {
	switch (status) {
		case "pending":
			return "bg-yellow-100 text-yellow-700 border-yellow-200";
		case "ready":
			return "bg-green-100 text-green-700 border-green-200";
		case "failed":
			return "bg-red-100 text-red-700 border-red-200";
	}
}

export default function ReportsPage() {
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
				setReports(data);
			} catch (err) {
				console.error("Error fetching reports:", err);
				setError(
					err instanceof Error
						? err.message
						: "Failed to load reports"
				);
			} finally {
				setIsLoading(false);
			}
		};

		fetchReports();
	}, []);

	if (isLoading) {
		return (
			<div className="p-8">
				<div className="max-w-6xl mx-auto">
					<h1 className="text-2xl font-semibold text-[#37322F] mb-6">
						Live Reports
					</h1>
					<div className="space-y-2">
						{Array.from({ length: 5 }).map((_, i) => (
							<Skeleton key={i} className="h-12 w-full" />
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
					<h1 className="text-2xl font-semibold text-[#37322F] mb-6">
						Live Reports
					</h1>
					<div className="bg-red-50 border border-red-200 rounded-lg p-4">
						<p className="text-red-700">{error}</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="p-8">
			<div className="max-w-6xl mx-auto">
				<h1 className="text-2xl font-semibold text-[#37322F] mb-6">
					Live Reports
				</h1>

				{reports.length === 0 ? (
					<div className="bg-white rounded-lg border border-[rgba(55,50,47,0.12)] p-8 text-center">
						<p className="text-[#605A57]">No reports found</p>
					</div>
				) : (
					<div className="bg-white rounded-lg border border-[rgba(55,50,47,0.12)] overflow-hidden">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="text-[#37322F]">
										Type
									</TableHead>
									<TableHead className="text-[#37322F]">
										Address
									</TableHead>
									<TableHead className="text-[#37322F]">
										District
									</TableHead>
									<TableHead className="text-[#37322F]">
										Created At
									</TableHead>
									<TableHead className="text-[#37322F]">
										Created By
									</TableHead>
									<TableHead className="text-[#37322F]">
										Status
									</TableHead>
									<TableHead className="text-[#37322F]">
										Actions
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{reports.map((report) => {
									const isAssemblage = report.ReportType === "assemblage";
									const addresses = isAssemblage && report.Address
										? report.Address.split(";").map((a) => a.trim()).filter(Boolean)
										: [report.Address];
									return (
									<TableRow key={report.IdReport}>
										<TableCell className="text-[#37322F] align-top">
											<Badge
												variant="outline"
												className={
													isAssemblage
														? "bg-amber-50 text-amber-800 border-amber-200 text-xs"
														: "bg-slate-50 text-slate-700 border-slate-200 text-xs"
												}
											>
												{isAssemblage ? "Assemblage" : "Single"}
											</Badge>
										</TableCell>
										<TableCell className="text-[#37322F] align-top">
											{addresses.length > 1 ? (
												<div className="flex flex-col gap-1">
													{addresses.map((addr, i) => (
														<span key={i} className="block text-sm">
															{addr}
														</span>
													))}
												</div>
											) : (
												<span>{report.Address}</span>
											)}
										</TableCell>
										<TableCell>
											{report.ZoningDistricts ? (
												<Badge
													variant="outline"
													className="bg-blue-100 text-blue-700 border-blue-300 text-xs"
												>
													{report.ZoningDistricts}
												</Badge>
											) : (
												<span className="text-[#605A57]">
													—
												</span>
											)}
										</TableCell>
										<TableCell className="text-[#37322F]">
											{format(
												new Date(report.CreatedAt),
												"MMM d, yyyy 'at' h:mm a"
											)}
										</TableCell>
										<TableCell className="text-[#605A57]">
											{report.CreatedByName || "—"}
										</TableCell>
										<TableCell>
											<Badge
												variant="outline"
												className={`text-xs ${getStatusColor(
													report.Status
												)}`}
											>
												{report.Status}
											</Badge>
										</TableCell>
										<TableCell>
											<Button
												variant="outline"
												size="sm"
												onClick={() =>
													router.push(
														report.ReportType === "assemblage"
															? `/assemblagereportview/${report.IdReport}`
															: `/viewreport/${report.IdReport}`
													)
												}
											>
												View
											</Button>
										</TableCell>
									</TableRow>
									);
								})}
							</TableBody>
						</Table>
					</div>
				)}
			</div>
		</div>
	);
}
