"use client";

import { useRouter } from "next/navigation";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import {
	FileText,
	Eye,
	TrendingUp,
	AlertCircle,
	XCircle,
	MapPin,
	Building2,
	Sparkles,
} from "lucide-react";

// Dummy data for demo reports
const demoReports = [
	{
		id: "demo-1",
		address: "2847 Broadway, Manhattan, NY 10025",
		clientName: "Sarah Johnson",
		status: "ready",
		createdAt: "2024-01-15T10:30:00Z",
		zoning: "R7-2",
	},
	{
		id: "demo-2",
		address: "456 Atlantic Ave, Brooklyn, NY 11217",
		clientName: "Michael Chen",
		status: "ready",
		createdAt: "2024-01-14T14:20:00Z",
		zoning: "R6B",
	},
	{
		id: "demo-3",
		address: "789 Broadway, Manhattan, NY 10003",
		clientName: "Emily Rodriguez",
		status: "ready",
		createdAt: "2024-01-13T09:15:00Z",
		zoning: "R8A",
	},
	{
		id: "demo-4",
		address: "321 5th Ave, Brooklyn, NY 11215",
		clientName: "David Kim",
		status: "pending",
		createdAt: "2024-01-12T16:45:00Z",
		zoning: "R7-2",
	},
	{
		id: "demo-5",
		address: "654 Lexington Ave, Manhattan, NY 10022",
		clientName: "Jennifer Martinez",
		status: "ready",
		createdAt: "2024-01-11T11:00:00Z",
		zoning: "R10",
	},
	{
		id: "demo-6",
		address: "987 Court St, Brooklyn, NY 11231",
		clientName: "Robert Taylor",
		status: "ready",
		createdAt: "2024-01-10T13:30:00Z",
		zoning: "R6A",
	},
];

function getStatusColor(status: string) {
	switch (status) {
		case "ready":
			return "bg-green-100 text-green-700 border-green-200";
		case "pending":
			return "bg-yellow-100 text-yellow-700 border-yellow-200";
		case "failed":
			return "bg-red-100 text-red-700 border-red-200";
		default:
			return "bg-gray-100 text-gray-700 border-gray-200";
	}
}

export default function DemoReportListPage() {
	const router = useRouter();

	return (
		<div className="p-8">
			<div className="max-w-6xl mx-auto">
				{/* Greeting */}
				<div className="mb-6">
					<h1 className="text-2xl font-semibold text-[#37322F]">
						Hi Elie
					</h1>
				</div>

				{/* Dashboard Section 1: Report Complexity */}
				<div className="mb-6">
					<h2 className="text-lg font-semibold text-[#37322F] mb-4">
						Report Dashboard
					</h2>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<Card className="bg-[#FEE2A9]/20 border-[#4090C2]/30">
							<CardHeader className="pb-0 pt-1.5 px-4">
								<CardTitle className="text-xs font-medium text-[#605A57] flex items-center gap-1.5">
									<TrendingUp className="size-3 text-[#4090C2]" />
									Low Effort
								</CardTitle>
							</CardHeader>
							<CardContent className="pt-0 pb-1.5 px-4">
								<p className="text-xl font-semibold text-[#37322F]">
									23
								</p>
								<p className="text-xs text-[#605A57] mt-0">
									addresses appear to be low effort
								</p>
							</CardContent>
						</Card>
						<Card className="bg-[#FEE2A9]/20 border-[#D59285]/30">
							<CardHeader className="pb-0 pt-1.5 px-4">
								<CardTitle className="text-xs font-medium text-[#605A57] flex items-center gap-1.5">
									<AlertCircle className="size-3 text-[#D59285]" />
									High Complexity
								</CardTitle>
							</CardHeader>
							<CardContent className="pt-0 pb-1.5 px-4">
								<p className="text-xl font-semibold text-[#37322F]">
									15
								</p>
								<p className="text-xs text-[#605A57] mt-0">
									addresses with high complexity
								</p>
							</CardContent>
						</Card>
						<Card className="bg-[#FEE2A9]/20 border-[#D59285]/40">
							<CardHeader className="pb-0 pt-1.5 px-4">
								<CardTitle className="text-xs font-medium text-[#605A57] flex items-center gap-1.5">
									<XCircle className="size-3 text-[#D59285]" />
									Not Feasible
								</CardTitle>
							</CardHeader>
							<CardContent className="pt-0 pb-1.5 px-4">
								<p className="text-xl font-semibold text-[#37322F]">
									3
								</p>
								<p className="text-xs text-[#605A57] mt-0">
									addresses that aren't feasible
								</p>
							</CardContent>
						</Card>
					</div>
				</div>

				{/* Dashboard Section 2: Insights */}
				<div className="mb-6">
					<h2 className="text-lg font-semibold text-[#37322F] mb-4">
						Insights
					</h2>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<Card className="bg-[#ADCCD3]/15 border-[#ADCCD3]/30">
							<CardHeader className="pb-0 pt-1.5 px-4">
								<CardTitle className="text-xs font-medium text-[#605A57] flex items-center gap-1.5">
									<MapPin className="size-3 text-[#4090C2]" />
									Most Popular Borough
								</CardTitle>
							</CardHeader>
							<CardContent className="pt-0 pb-1.5 px-4">
								<p className="text-base font-semibold text-[#37322F]">
									Manhattan
								</p>
							</CardContent>
						</Card>
						<Card className="bg-[#ADCCD3]/15 border-[#ADCCD3]/30">
							<CardHeader className="pb-0 pt-1.5 px-4">
								<CardTitle className="text-xs font-medium text-[#605A57] flex items-center gap-1.5">
									<Building2 className="size-3 text-[#4090C2]" />
									Most Common Zones
								</CardTitle>
							</CardHeader>
							<CardContent className="pt-0 pb-1.5 px-4">
								<p className="text-base font-semibold text-[#37322F]">
									R7-2
								</p>
							</CardContent>
						</Card>
						<Card className="bg-[#ADCCD3]/15 border-[#ADCCD3]/30">
							<CardHeader className="pb-0 pt-1.5 px-4">
								<CardTitle className="text-xs font-medium text-[#605A57] flex items-center gap-1.5">
									<Sparkles className="size-3 text-[#4090C2]" />
									Summarize Inquiries
								</CardTitle>
							</CardHeader>
							<CardContent className="pt-0 pb-1.5 px-4">
								<p className="text-xs text-[#37322F]">
									Converting Single Family to Multi family
								</p>
							</CardContent>
						</Card>
					</div>
				</div>

				{/* Table Section */}
				<div className="flex items-center gap-2 mb-6">
					<FileText className="size-6 text-[#4090C2]" />
					<h2 className="text-xl font-semibold text-[#37322F]">
						Reports
					</h2>
				</div>

				{demoReports.length === 0 ? (
					<div className="bg-white rounded-lg border border-[rgba(55,50,47,0.12)] p-8 text-center">
						<p className="text-[#605A57]">No demo reports found</p>
					</div>
				) : (
					<div className="bg-white rounded-lg border border-[rgba(55,50,47,0.12)] overflow-hidden">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="text-[#37322F]">
										Address
									</TableHead>
									<TableHead className="text-[#37322F]">
										Client
									</TableHead>
									<TableHead className="text-[#37322F]">
										Zoning
									</TableHead>
									<TableHead className="text-[#37322F]">
										Created At
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
								{demoReports.map((report) => (
									<TableRow key={report.id}>
										<TableCell className="text-[#37322F]">
											{report.address}
										</TableCell>
										<TableCell className="text-[#37322F]">
											{report.clientName}
										</TableCell>
										<TableCell className="text-[#37322F]">
											<Badge
												variant="outline"
												className="bg-[#4090C2]/10 text-[#4090C2] border-[#4090C2]"
											>
												{report.zoning}
											</Badge>
										</TableCell>
										<TableCell className="text-[#37322F]">
											{format(
												new Date(report.createdAt),
												"MMM d, yyyy 'at' h:mm a"
											)}
										</TableCell>
										<TableCell>
											<Badge
												variant="outline"
												className={`text-xs ${getStatusColor(
													report.status
												)}`}
											>
												{report.status}
											</Badge>
										</TableCell>
										<TableCell>
											<Button
												variant="outline"
												size="sm"
												onClick={() =>
													router.push(
														`/demo-report/${report.id}`
													)
												}
												className="flex items-center gap-2"
											>
												<Eye className="size-4" />
												View Report
											</Button>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}
			</div>
		</div>
	);
}
