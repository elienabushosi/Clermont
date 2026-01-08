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
import { format } from "date-fns";
import { FileText, Eye } from "lucide-react";

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
				<div className="flex items-center gap-2 mb-6">
					<FileText className="size-6 text-[#4090C2]" />
					<h1 className="text-2xl font-semibold text-[#37322F]">
						Demo Reports
					</h1>
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

