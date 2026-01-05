"use client";

import { useState } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
	User,
	MapPin,
	Mail,
	Target,
	Phone,
	FileText,
} from "lucide-react";

type ActivityItem = {
	id: string;
	type:
		| "new-prospect"
		| "great-fit"
		| "feasibility-ready"
		| "likely-to-close"
		| "incomplete"
		| "ai-priority";
	name: string;
	email?: string;
	phone?: string;
	address?: string;
	goals?: string[];
	reason?: string;
	requestSummary?: string;
	timestamp: string;
	status: "Report Ready" | "In Progress" | "Need More Information";
	leadQuality: "Good lead" | "Okay lead" | "Bad Lead";
};

// Mock data - in production this would come from an API
const mockActivities: ActivityItem[] = [
	{
		id: "1",
		type: "new-prospect",
		name: "Sarah Johnson",
		email: "sarah.johnson@email.com",
		phone: "(212) 555-0123",
		address: "123 Park Ave, Manhattan, NY 10017",
		requestSummary: "Single Family Occupancy to Multifamily Occupancy",
		timestamp: "2 hours ago",
		status: "In Progress",
		leadQuality: "Good lead",
	},
	{
		id: "2",
		type: "ai-priority",
		name: "Michael Chen",
		email: "mchen@email.com",
		phone: "(718) 555-0456",
		address: "456 Atlantic Ave, Brooklyn, NY 11217",
		requestSummary: "Residential Renovation and Backyard Redesign",
		timestamp: "3 hours ago",
		status: "Report Ready",
		leadQuality: "Good lead",
	},
	{
		id: "3",
		type: "feasibility-ready",
		name: "Emily Rodriguez",
		email: "emily.r@email.com",
		phone: "(212) 555-0789",
		address: "789 Broadway, Manhattan, NY 10003",
		requestSummary: "Office to Residential Conversion",
		timestamp: "5 hours ago",
		status: "Report Ready",
		leadQuality: "Okay lead",
	},
	{
		id: "4",
		type: "great-fit",
		name: "David Kim",
		email: "david.kim@email.com",
		phone: "(718) 555-0321",
		address: "321 5th Ave, Brooklyn, NY 11215",
		requestSummary: "Exterior Patio and Dining Room",
		timestamp: "1 day ago",
		status: "In Progress",
		leadQuality: "Good lead",
	},
	{
		id: "5",
		type: "likely-to-close",
		name: "Jennifer Martinez",
		email: "j.martinez@email.com",
		phone: "(212) 555-0654",
		address: "654 Lexington Ave, Manhattan, NY 10022",
		requestSummary: "Cellar Renovation",
		timestamp: "1 day ago",
		status: "In Progress",
		leadQuality: "Good lead",
	},
	{
		id: "6",
		type: "incomplete",
		name: "Robert Taylor",
		email: "rtaylor@email.com",
		phone: "(718) 555-0987",
		address: "987 Court St, Brooklyn, NY 11231",
		requestSummary: "Flexibility Exploration within Existing Apartment Layout",
		timestamp: "2 days ago",
		status: "Need More Information",
		leadQuality: "Bad Lead",
	},
];

function getActivityTypeConfig(type: ActivityItem["type"]) {
	switch (type) {
		case "new-prospect":
			return {
				icon: User,
				label: "New Prospect",
				color: "bg-blue-100 text-blue-700 border-blue-200",
				badgeVariant: "default" as const,
			};
		case "great-fit":
			return {
				icon: User,
				label: "Great Fit",
				color: "bg-yellow-100 text-yellow-700 border-yellow-200",
				badgeVariant: "secondary" as const,
			};
		case "feasibility-ready":
			return {
				icon: User,
				label: "Report Ready",
				color: "bg-green-100 text-green-700 border-green-200",
				badgeVariant: "default" as const,
			};
		case "likely-to-close":
			return {
				icon: User,
				label: "Likely to Close",
				color: "bg-purple-100 text-purple-700 border-purple-200",
				badgeVariant: "secondary" as const,
			};
		case "incomplete":
			return {
				icon: User,
				label: "Incomplete",
				color: "bg-orange-100 text-orange-700 border-orange-200",
				badgeVariant: "outline" as const,
			};
		case "ai-priority":
			return {
				icon: User,
				label: "AI Priority",
				color: "bg-indigo-100 text-indigo-700 border-indigo-200",
				badgeVariant: "default" as const,
			};
	}
}

function getStatusColor(status: ActivityItem["status"]) {
	switch (status) {
		case "Report Ready":
			return "bg-green-100 text-green-700 border-green-200";
		case "In Progress":
			return "bg-blue-100 text-blue-700 border-blue-200";
		case "Need More Information":
			return "bg-orange-100 text-orange-700 border-orange-200";
	}
}

function getLeadQualityColor(quality: ActivityItem["leadQuality"]) {
	switch (quality) {
		case "Good lead":
			return "bg-green-100 text-green-700 border-green-200";
		case "Okay lead":
			return "bg-yellow-100 text-yellow-700 border-yellow-200";
		case "Bad Lead":
			return "bg-red-100 text-red-700 border-red-200";
	}
}

function ActivityCard({ activity }: { activity: ActivityItem }) {
	const config = getActivityTypeConfig(activity.type);
	const Icon = config.icon;

	return (
		<Card className="hover:shadow-md transition-shadow">
			<CardHeader>
				<div className="flex items-start justify-between">
					<div className="flex items-start gap-3 flex-1">
						<div
							className={`p-2 rounded-lg border ${config.color} flex-shrink-0`}
						>
							<Icon className="size-4" />
						</div>
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-2 mb-1 flex-wrap">
								<CardTitle className="text-base font-semibold">
									{activity.name}
								</CardTitle>
								<Badge
									variant="outline"
									className={`text-xs ${getLeadQualityColor(activity.leadQuality)}`}
								>
									{activity.leadQuality}
								</Badge>
							</div>
							<CardDescription className="text-sm text-[#605A57]">
								{activity.timestamp}
							</CardDescription>
						</div>
					</div>
					<Badge
						variant="outline"
						className={`text-xs ${getStatusColor(activity.status)}`}
					>
						{activity.status}
					</Badge>
				</div>
			</CardHeader>
			<CardContent className="space-y-3">
				{activity.email && (
					<div className="flex items-center gap-2 text-sm text-[#37322F]">
						<Mail className="size-4 text-[#605A57]" />
						<span>{activity.email}</span>
					</div>
				)}
				{activity.phone && (
					<div className="flex items-center gap-2 text-sm text-[#37322F]">
						<Phone className="size-4 text-[#605A57]" />
						<span>{activity.phone}</span>
					</div>
				)}
				{activity.address && (
					<div className="flex items-start gap-2 text-sm text-[#37322F]">
						<MapPin className="size-4 text-[#605A57] mt-0.5 flex-shrink-0" />
						<span>{activity.address}</span>
					</div>
				)}
				{activity.requestSummary && (
					<div className="pt-2 border-t border-[#E0DEDB]">
						<p className="text-sm text-[#37322F]">
							<span className="font-medium">Request: </span>
							{activity.requestSummary}
						</p>
					</div>
				)}
			</CardContent>
			{activity.status === "Report Ready" && (
				<CardFooter className="border-t border-[#E0DEDB] pt-4">
					<Button className="w-full" variant="default">
						<FileText className="size-4" />
						View Report
					</Button>
				</CardFooter>
			)}
		</Card>
	);
}

export default function HomePage() {
	const [viewMode, setViewMode] = useState<"Lead" | "Address">("Lead");

	return (
		<div className="p-8">
			<div className="max-w-4xl mx-auto">
				<div className="mb-6 flex items-start justify-between">
					<div>
						<h2 className="text-2xl font-semibold text-[#37322F] mb-2">
							Activity Feed
						</h2>
						<p className="text-sm text-[#605A57]">
							Quick triage and prioritization of new client activity
						</p>
					</div>
					<ToggleGroup
						type="single"
						value={viewMode}
						onValueChange={(value) => {
							if (value) setViewMode(value as "Lead" | "Address");
						}}
						variant="outline"
						size="lg"
					>
						<ToggleGroupItem value="Lead" aria-label="Lead view">
							Lead
						</ToggleGroupItem>
						<ToggleGroupItem value="Address" aria-label="Address view">
							Address
						</ToggleGroupItem>
					</ToggleGroup>
				</div>

				<div className="space-y-4">
					{mockActivities.length === 0 ? (
						<Card>
							<CardContent className="py-12 text-center">
								<p className="text-[#605A57]">No activity to display</p>
							</CardContent>
						</Card>
					) : (
						mockActivities.map((activity) => (
							<ActivityCard key={activity.id} activity={activity} />
						))
					)}
				</div>
			</div>
		</div>
	);
}

