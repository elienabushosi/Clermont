"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getReportWithSourcesPublic } from "@/lib/reports";
import type { ReportWithSources } from "@/lib/reports";
import { ReportViewContent } from "@/app/(workspace)/viewreport/[id]/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";

export default function ViewReportPublicPage() {
	const params = useParams();
	const router = useRouter();
	const reportId = params.id as string;

	const [reportData, setReportData] = useState<(ReportWithSources & { massingOverrides?: unknown }) | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchReport = async () => {
			if (!reportId) return;
			try {
				setIsLoading(true);
				setError(null);
				const data = await getReportWithSourcesPublic(reportId);
				setReportData(data);
			} catch (err) {
				console.error("Error fetching public report:", err);
				setError(err instanceof Error ? err.message : "Failed to load report");
			} finally {
				setIsLoading(false);
			}
		};
		fetchReport();
	}, [reportId]);

	if (isLoading) {
		return (
			<div className="p-8 bg-[#F7F5F3] min-h-screen">
				<div className="max-w-4xl mx-auto">
					<Skeleton className="h-8 w-32 mb-6" />
					<Skeleton className="h-64 w-full" />
				</div>
			</div>
		);
	}

	if (error || !reportData) {
		return (
			<div className="p-8 bg-[#F7F5F3] min-h-screen">
				<div className="max-w-4xl mx-auto">
					<Button
						variant="ghost"
						onClick={() => router.push("/")}
						className="mb-4"
					>
						<ArrowLeft className="size-4 mr-2" />
						Back
					</Button>
					<Card>
						<CardContent className="pt-6">
							<p className="text-red-600">{error || "Report not found"}</p>
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	return (
		<ReportViewContent
			reportData={reportData}
			reportId={reportId}
			isPublic={true}
		/>
	);
}
