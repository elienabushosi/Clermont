"use client";

import { useEffect, useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Users, Shield, UserPlus } from "lucide-react";
import { getTeamMembers, type TeamMember } from "@/lib/team";
import { getCurrentUser } from "@/lib/auth";

export default function TeamPage() {
	const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [currentUserId, setCurrentUserId] = useState<string | null>(null);

	useEffect(() => {
		const fetchData = async () => {
			try {
				setIsLoading(true);
				setError(null);

				// Get current user to identify them in the list
				const currentUser = await getCurrentUser();
				if (currentUser) {
					setCurrentUserId(currentUser.user.IdUser);
				}

				// Fetch team members
				const members = await getTeamMembers();
				setTeamMembers(members);
			} catch (err) {
				console.error("Error fetching team data:", err);
				setError(
					err instanceof Error
						? err.message
						: "Failed to load team members"
				);
			} finally {
				setIsLoading(false);
			}
		};

		fetchData();
	}, []);

	function getRoleBadgeColor(role: string) {
		if (role === "Owner" || role === "Admin") {
			return "bg-purple-100 text-purple-700 border-purple-200";
		}
		return "bg-blue-100 text-blue-700 border-blue-200";
	}

	if (isLoading) {
		return (
			<div className="p-8">
				<div className="max-w-6xl mx-auto">
					<h1 className="text-2xl font-semibold text-[#37322F] mb-6">
						Team
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
						Team
					</h1>
					<div className="text-red-600">{error}</div>
				</div>
			</div>
		);
	}

	return (
		<div className="p-8">
			<div className="max-w-6xl mx-auto">
				{/* Header */}
				<div className="flex items-center justify-between mb-6">
					<div>
						<h1 className="text-2xl font-semibold text-[#37322F] mb-2">
							Team
						</h1>
						<p className="text-sm text-[#605A57]">
							View your team members and their roles
						</p>
					</div>
					<Button>
						<UserPlus className="size-4 mr-2" />
						Invite Member
					</Button>
				</div>

				{/* Team Members Table */}
				<div className="border border-[rgba(55,50,47,0.12)] rounded-md overflow-hidden">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="text-[#37322F]">
									Name
								</TableHead>
								<TableHead className="text-[#37322F]">
									Email
								</TableHead>
								<TableHead className="text-[#37322F]">
									Role
								</TableHead>
								<TableHead className="text-[#37322F]">
									Joined
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{teamMembers.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={4}
										className="text-center py-12"
									>
										<Users className="size-12 text-[#605A57] mx-auto mb-4 opacity-50" />
										<p className="text-[#605A57]">
											No team members found
										</p>
									</TableCell>
								</TableRow>
							) : (
								teamMembers.map((member) => {
									const isCurrentUser =
										member.IdUser === currentUserId;
									return (
										<TableRow
											key={member.IdUser}
											className={
												isCurrentUser
													? "bg-[rgba(64,144,194,0.05)]"
													: ""
											}
										>
											<TableCell className="font-medium text-[#37322F]">
												<div className="flex items-center gap-2">
													{member.Name}
													{isCurrentUser && (
														<Badge className="bg-[#4090C2] text-white border-[#4090C2] text-xs">
															You
														</Badge>
													)}
												</div>
											</TableCell>
											<TableCell className="text-[#605A57]">
												{member.Email}
											</TableCell>
											<TableCell>
												<Badge
													className={getRoleBadgeColor(
														member.Role
													)}
												>
													<Shield className="size-3 mr-1" />
													{member.Role}
												</Badge>
											</TableCell>
											<TableCell className="text-[#605A57]">
												{format(
													new Date(member.CreatedAt),
													"MMM d, yyyy"
												)}
											</TableCell>
										</TableRow>
									);
								})
							)}
						</TableBody>
					</Table>
				</div>
			</div>
		</div>
	);
}
