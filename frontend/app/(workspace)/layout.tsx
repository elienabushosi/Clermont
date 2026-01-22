"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
	getAuthToken,
	verifyToken,
	removeAuthToken,
	getCurrentUser,
} from "@/lib/auth";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarFooter,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarInset,
	SidebarTrigger,
	useSidebar,
} from "@/components/ui/sidebar";
import {
	Home,
	Search,
	FileText,
	Settings,
	LogOut,
	User,
	FileCheck,
	Users,
} from "lucide-react";

function SidebarHeaderContent({
	organizationName,
}: {
	organizationName: string | null;
}) {
	const { state } = useSidebar();
	const isCollapsed = state === "collapsed";

	return (
		<div className="flex flex-col items-center gap-3 p-4">
			{/* Logo */}
			<div
				className={`flex items-center justify-center ${
					isCollapsed ? "w-10" : "w-full max-w-[140px]"
				}`}
			>
				<img
					src="/logos/linderoworkspacelogo.png"
					alt="Logo"
					className={`object-contain ${
						isCollapsed ? "h-8" : "h-auto w-full"
					}`}
				/>
			</div>
			{/* Company name - hidden when collapsed */}
			{!isCollapsed && (
				<div className="text-center">
					<h2 className="text-lg font-semibold text-[#37322F]">
						{organizationName || "Organization"}
					</h2>
				</div>
			)}
		</div>
	);
}

function getPageTitle(pathname: string): string {
	if (pathname === "/home" || pathname === "/") {
		return "Home";
	} else if (pathname === "/search-address") {
		return "Search Address";
	} else if (pathname === "/reports") {
		return "Live Reports";
	} else if (pathname === "/team") {
		return "Team";
	} else if (pathname === "/demo-report-list") {
		return "Sample Reports";
	} else if (pathname.startsWith("/demo-report")) {
		return "Report Details";
	} else if (pathname === "/settings") {
		return "Settings";
	}
	return "Home";
}

export default function WorkspaceLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const pathname = usePathname();
	const router = useRouter();
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [isChecking, setIsChecking] = useState(true);
	const [userData, setUserData] = useState<{
		user: {
			IdUser: string;
			Name: string;
			Email: string;
			Role: string;
			IdOrganization: string | null;
		};
		organization: {
			IdOrganization: string;
			Name: string;
			Type: string | null;
		} | null;
	} | null>(null);
	const pageTitle = getPageTitle(pathname);

	useEffect(() => {
		const checkAuth = async () => {
			const token = getAuthToken();

			if (!token) {
				router.push("/login");
				return;
			}

			// Verify token with backend and get user data
			const isValid = await verifyToken(token);

			if (!isValid) {
				// Remove invalid token
				localStorage.removeItem("auth_token");
				router.push("/login");
				return;
			}

			// Fetch user data with organization
			const userInfo = await getCurrentUser();
			if (userInfo) {
				setUserData(userInfo);
			}

			setIsAuthenticated(true);
			setIsChecking(false);
		};

		checkAuth();
	}, [router]);

	// Show loading state while checking authentication
	if (isChecking || !isAuthenticated) {
		return (
			<div className="w-full min-h-screen bg-[#F7F5F3] flex items-center justify-center">
				<div className="text-[#37322F]">Loading...</div>
			</div>
		);
	}

	return (
		<SidebarProvider>
			<Sidebar collapsible="icon">
				<SidebarHeader>
					<SidebarHeaderContent
						organizationName={userData?.organization?.Name || null}
					/>
				</SidebarHeader>
				<SidebarContent>
					<SidebarGroup>
						<SidebarGroupContent>
							<SidebarMenu>
								<SidebarMenuItem>
									<SidebarMenuButton
										tooltip="Home"
										isActive={
											pathname === "/home" ||
											pathname === "/"
										}
										asChild
									>
										<Link href="/home">
											<Home className="size-4" />
											<span>Home</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
								<SidebarMenuItem>
									<SidebarMenuButton
										tooltip="Search Address"
										isActive={
											pathname === "/search-address"
										}
										asChild
									>
										<Link href="/search-address">
											<Search className="size-4" />
											<span>Search Address</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
								<SidebarMenuItem>
									<SidebarMenuButton
										tooltip="Live Reports"
										isActive={pathname === "/reports"}
										asChild
									>
										<Link href="/reports">
											<FileText className="size-4" />
											<span>Live Reports</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
								<SidebarMenuItem>
									<SidebarMenuButton
										tooltip="Team"
										isActive={pathname === "/team"}
										asChild
									>
										<Link href="/team">
											<Users className="size-4" />
											<span>Team</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
								<SidebarMenuItem>
									<SidebarMenuButton
										tooltip="Settings"
										isActive={pathname === "/settings"}
										asChild
									>
										<Link href="/settings">
											<Settings className="size-4" />
											<span>Settings</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
								<SidebarMenuItem>
									<SidebarMenuButton
										tooltip="Sample Reports"
										isActive={
											pathname === "/demo-report-list" ||
											pathname.startsWith("/demo-report")
										}
										asChild
									>
										<Link href="/demo-report-list">
											<FileCheck className="size-4" />
											<span>Sample Reports</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarContent>
				<SidebarFooter>
					<SidebarMenu>
						{/* User info section */}
						{userData && (
							<SidebarMenuItem>
								<SidebarMenuButton
									tooltip={userData.user.Name}
									className="w-full cursor-default"
									disabled
								>
									<User className="size-4" />
									<span className="truncate">
										{userData.user.Name}
									</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
						)}
						<SidebarMenuItem>
							<SidebarMenuButton
								tooltip="Sign out"
								onClick={() => {
									removeAuthToken();
									router.push("/login");
								}}
								className="w-full"
							>
								<LogOut className="size-4" />
								<span>Sign out</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarFooter>
			</Sidebar>
			<SidebarInset>
				{/* Header with toggle button */}
				<header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
					<SidebarTrigger className="-ml-1" />
					<h1 className="text-lg font-semibold text-[#37322F]">
						{pageTitle}
					</h1>
				</header>
				{/* Main content area */}
				{children}
			</SidebarInset>
		</SidebarProvider>
	);
}
