"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getReportWithSources, type ReportWithSources } from "@/lib/reports";
import { ArrowLeft } from "lucide-react";

function getStatusColor(status: string) {
	switch (status) {
		case "pending":
			return "bg-yellow-100 text-yellow-700 border-yellow-200";
		case "ready":
			return "bg-green-100 text-green-700 border-green-200";
		case "failed":
			return "bg-red-100 text-red-700 border-red-200";
		case "succeeded":
			return "bg-green-100 text-green-700 border-green-200";
		default:
			return "bg-gray-100 text-gray-700 border-gray-200";
	}
}

export default function ViewReportPage() {
	const params = useParams();
	const router = useRouter();
	const reportId = params.id as string;

	const [reportData, setReportData] = useState<ReportWithSources | null>(
		null
	);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchReport = async () => {
			if (!reportId) return;

			try {
				setIsLoading(true);
				setError(null);
				const data = await getReportWithSources(reportId);
				setReportData(data);
			} catch (err) {
				console.error("Error fetching report:", err);
				setError(
					err instanceof Error ? err.message : "Failed to load report"
				);
			} finally {
				setIsLoading(false);
			}
		};

		fetchReport();
	}, [reportId]);

	if (isLoading) {
		return (
			<div className="p-8">
				<div className="max-w-4xl mx-auto">
					<Skeleton className="h-8 w-32 mb-6" />
					<Skeleton className="h-64 w-full" />
				</div>
			</div>
		);
	}

	if (error || !reportData) {
		return (
			<div className="p-8">
				<div className="max-w-4xl mx-auto">
					<Button
						variant="ghost"
						onClick={() => router.push("/reports")}
						className="mb-4"
					>
						<ArrowLeft className="size-4 mr-2" />
						Back to Reports
					</Button>
					<Card>
						<CardContent className="pt-6">
							<p className="text-red-600">
								{error || "Report not found"}
							</p>
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	const { report, client, sources } = reportData;

	return (
		<div className="p-8">
			<div className="max-w-4xl mx-auto">
				<Button
					variant="ghost"
					onClick={() => router.push("/reports")}
					className="mb-6"
				>
					<ArrowLeft className="size-4 mr-2" />
					Back to Reports
				</Button>

				{/* Report Header */}
				<Card className="mb-6">
					<CardHeader>
						<div className="flex items-start justify-between">
							<div>
								<CardTitle className="text-2xl mb-2">
									{report.Name}
								</CardTitle>
								<p className="text-[#605A57] text-sm">
									{report.Address}
								</p>
							</div>
							<Badge
								variant="outline"
								className={`${getStatusColor(report.Status)}`}
							>
								{report.Status}
							</Badge>
						</div>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-2 gap-4 text-sm">
							<div>
								<p className="text-[#605A57] mb-1">
									Created At
								</p>
								<p className="text-[#37322F] font-medium">
									{format(
										new Date(report.CreatedAt),
										"MMM d, yyyy 'at' h:mm a"
									)}
								</p>
							</div>
							{client && (
								<div>
									<p className="text-[#605A57] mb-1">
										Client
									</p>
									<p className="text-[#37322F] font-medium">
										{client.Name}
									</p>
								</div>
							)}
						</div>
					</CardContent>
				</Card>

				{/* Report Sources */}
				<div className="space-y-4">
					<h2 className="text-xl font-semibold text-[#37322F]">
						Report Sources
					</h2>

					{sources.length === 0 ? (
						<Card>
							<CardContent className="pt-6">
								<p className="text-[#605A57] text-center">
									No sources found for this report
								</p>
							</CardContent>
						</Card>
					) : (
						sources.map((source) => (
							<Card key={source.IdReportSource}>
								<CardHeader>
									<div className="flex items-center justify-between">
										<CardTitle className="text-lg">
											{source.SourceKey}
										</CardTitle>
										<Badge
											variant="outline"
											className={`text-xs ${getStatusColor(
												source.Status
											)}`}
										>
											{source.Status}
										</Badge>
									</div>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="grid grid-cols-2 gap-4 text-sm">
										<div>
											<p className="text-[#605A57] mb-1">
												Created At
											</p>
											<p className="text-[#37322F]">
												{format(
													new Date(source.CreatedAt),
													"MMM d, yyyy 'at' h:mm a"
												)}
											</p>
										</div>
										{source.SourceUrl && (
											<div>
												<p className="text-[#605A57] mb-1">
													Source URL
												</p>
												<a
													href={source.SourceUrl}
													target="_blank"
													rel="noopener noreferrer"
													className="text-[#4090C2] hover:underline"
												>
													{source.SourceUrl}
												</a>
											</div>
										)}
									</div>

									{source.ErrorMessage && (
										<div className="bg-red-50 border border-red-200 rounded-lg p-3">
											<p className="text-red-700 text-sm">
												<strong>Error:</strong>{" "}
												{source.ErrorMessage}
											</p>
										</div>
									)}

									{source.ContentText && (
										<div>
											<p className="text-[#605A57] text-sm mb-2 font-medium">
												Content Text:
											</p>
											<div className="bg-[#F7F5F3] rounded-lg p-4 border border-[rgba(55,50,47,0.12)]">
												<pre className="text-sm text-[#37322F] whitespace-pre-wrap">
													{source.ContentText}
												</pre>
											</div>
										</div>
									)}

									{source.ContentJson && (
										<div>
											<p className="text-[#605A57] text-sm mb-2 font-medium">
												Content JSON:
											</p>
											<div className="bg-[#F7F5F3] rounded-lg p-4 border border-[rgba(55,50,47,0.12)]">
												<pre className="text-sm text-[#37322F] overflow-x-auto">
													{JSON.stringify(
														source.ContentJson,
														null,
														2
													)}
												</pre>
											</div>
										</div>
									)}
								</CardContent>
							</Card>
						))
					)}
				</div>
			</div>
		</div>
	);
}
