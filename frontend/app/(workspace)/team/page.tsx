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
import { Users, Shield, UserPlus, Copy, Check, Trash2 } from "lucide-react";
import {
	getTeamMembers,
	generateJoinCode,
	getJoinCodes,
	removeUser,
	type TeamMember,
	type JoinCode,
} from "@/lib/team";
import { getCurrentUser } from "@/lib/auth";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function TeamPage() {
	const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [currentUserId, setCurrentUserId] = useState<string | null>(null);
	const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
	const [joinCodes, setJoinCodes] = useState<JoinCode[]>([]);
	const [isGeneratingCode, setIsGeneratingCode] = useState(false);
	const [generatedCode, setGeneratedCode] = useState<string | null>(null);
	const [copiedCode, setCopiedCode] = useState<string | null>(null);
	const [showJoinCodes, setShowJoinCodes] = useState(false);
	const [userToRemove, setUserToRemove] = useState<TeamMember | null>(null);
	const [isRemoving, setIsRemoving] = useState(false);

	const isOwner = currentUserRole === "Owner";

	useEffect(() => {
		const fetchData = async () => {
			try {
				setIsLoading(true);
				setError(null);

				// Get current user to identify them in the list
				const currentUser = await getCurrentUser();
				if (currentUser) {
					setCurrentUserId(currentUser.user.IdUser);
					setCurrentUserRole(currentUser.user.Role);
				}

				// Fetch team members
				const members = await getTeamMembers();
				setTeamMembers(members);

				// Fetch join codes if user is owner
				if (currentUser?.user.Role === "Owner") {
					try {
						const codes = await getJoinCodes();
						setJoinCodes(codes);
					} catch (err) {
						console.error("Error fetching join codes:", err);
					}
				}
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

	const handleGenerateCode = async () => {
		setIsGeneratingCode(true);
		setError(null);
		try {
			const code = await generateJoinCode();
			setGeneratedCode(code.Code);
			setCopiedCode(null);
			// Refresh join codes list
			const codes = await getJoinCodes();
			setJoinCodes(codes);
			setShowJoinCodes(true);
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Failed to generate join code"
			);
		} finally {
			setIsGeneratingCode(false);
		}
	};

	const handleCopyCode = async (code: string) => {
		try {
			await navigator.clipboard.writeText(code);
			setCopiedCode(code);
			setTimeout(() => setCopiedCode(null), 2000);
		} catch (err) {
			console.error("Failed to copy code:", err);
		}
	};

	const handleRemoveUser = async () => {
		if (!userToRemove) return;

		setIsRemoving(true);
		setError(null);
		try {
			await removeUser(userToRemove.IdUser);
			// Refresh team members list
			const members = await getTeamMembers();
			setTeamMembers(members);
			setUserToRemove(null);
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Failed to remove user"
			);
		} finally {
			setIsRemoving(false);
		}
	};

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
					{isOwner && (
						<Button onClick={handleGenerateCode} disabled={isGeneratingCode}>
							<UserPlus className="size-4 mr-2" />
							{isGeneratingCode ? "Generating..." : "Invite Member"}
						</Button>
					)}
				</div>

				{/* Generated Code Display */}
				{generatedCode && (
					<div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm font-medium text-green-800 mb-1">
									Join code generated!
								</p>
								<p className="text-sm text-green-700 mb-2">
									Share this code with team members to invite them:
								</p>
								<div className="flex items-center gap-2">
									<code className="px-3 py-1.5 bg-white border border-green-300 rounded text-sm font-mono text-green-900">
										{generatedCode}
									</code>
									<Button
										variant="outline"
										size="sm"
										onClick={() => handleCopyCode(generatedCode)}
										className="h-8"
									>
										{copiedCode === generatedCode ? (
											<>
												<Check className="size-3 mr-1" />
												Copied!
											</>
										) : (
											<>
												<Copy className="size-3 mr-1" />
												Copy
											</>
										)}
									</Button>
								</div>
								<p className="text-xs text-green-600 mt-2">
									This code expires in 7 days and can only be used once.
								</p>
							</div>
						</div>
					</div>
				)}

				{/* Active Join Codes (Owner only) */}
				{isOwner && joinCodes.length > 0 && (
					<div className="mb-6">
						<div className="flex items-center justify-between mb-3">
							<h2 className="text-lg font-semibold text-[#37322F]">
								Active Join Codes
							</h2>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setShowJoinCodes(!showJoinCodes)}
							>
								{showJoinCodes ? "Hide" : "Show"} ({joinCodes.length})
							</Button>
						</div>
						{showJoinCodes && (
							<div className="border border-[rgba(55,50,47,0.12)] rounded-md overflow-hidden">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead className="text-[#37322F]">Code</TableHead>
											<TableHead className="text-[#37322F]">Created</TableHead>
											<TableHead className="text-[#37322F]">Expires</TableHead>
											<TableHead className="text-[#37322F]">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{joinCodes.map((code) => (
											<TableRow key={code.IdJoinCode}>
												<TableCell className="font-mono text-sm">
													{code.Code}
												</TableCell>
												<TableCell className="text-[#605A57]">
													{format(new Date(code.CreatedAt), "MMM d, yyyy")}
												</TableCell>
												<TableCell className="text-[#605A57]">
													{format(new Date(code.ExpiresAt), "MMM d, yyyy")}
												</TableCell>
												<TableCell>
													<Button
														variant="ghost"
														size="sm"
														onClick={() => handleCopyCode(code.Code)}
														className="h-8"
													>
														{copiedCode === code.Code ? (
															<>
																<Check className="size-3 mr-1" />
																Copied!
															</>
														) : (
															<>
																<Copy className="size-3 mr-1" />
																Copy
															</>
														)}
													</Button>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						)}
					</div>
				)}

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
								{isOwner && (
									<TableHead className="text-[#37322F] w-[50px]">
										Actions
									</TableHead>
								)}
							</TableRow>
						</TableHeader>
						<TableBody>
							{teamMembers.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={isOwner ? 5 : 4}
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
											{isOwner && (
												<TableCell>
													{!isCurrentUser && member.Role !== "Owner" && (
														<Button
															type="button"
															variant="outline"
															size="sm"
															onClick={() => setUserToRemove(member)}
															className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
														>
															<Trash2 className="h-4 w-4 mr-2" />
															Remove
														</Button>
													)}
												</TableCell>
											)}
										</TableRow>
									);
								})
							)}
						</TableBody>
					</Table>
				</div>

				{/* Remove User Confirmation Dialog */}
				<AlertDialog
					open={userToRemove !== null}
					onOpenChange={(open) => {
						if (!open) setUserToRemove(null);
					}}
				>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Remove team member</AlertDialogTitle>
							<AlertDialogDescription>
								Are you sure you want to remove{" "}
								<strong>{userToRemove?.Name}</strong> from your team? They will
								no longer have access to the organization, but their reports will
								be preserved.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel disabled={isRemoving}>
								Cancel
							</AlertDialogCancel>
							<AlertDialogAction
								onClick={handleRemoveUser}
								disabled={isRemoving}
								className="bg-red-600 hover:bg-red-700"
							>
								{isRemoving ? "Removing..." : "Remove"}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</div>
		</div>
	);
}
