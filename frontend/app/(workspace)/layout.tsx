"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarInset,
	SidebarTrigger,
	useSidebar,
} from "@/components/ui/sidebar";
import { Home, Search, FileText, Settings } from "lucide-react";

function SidebarHeaderContent() {
	const { state } = useSidebar();
	const isCollapsed = state === "collapsed";

	return (
		<div className="flex flex-col items-center gap-3 p-4">
			{/* Logo */}
			<div className={`flex items-center justify-center ${isCollapsed ? "w-10" : "w-full max-w-[140px]"}`}>
				<img
					src="/logos/ArcNoma_Logo.png"
					alt="Arcnoma, LLC Logo"
					className={`object-contain ${isCollapsed ? "h-8" : "h-auto w-full"}`}
				/>
			</div>
			{/* Company name - hidden when collapsed */}
			{!isCollapsed && (
				<div className="text-center">
					<h2 className="text-lg font-semibold text-[#37322F]">
						Arcnoma, LLC
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
		return "Reports";
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
	const pageTitle = getPageTitle(pathname);

	return (
		<SidebarProvider>
			<Sidebar collapsible="icon">
				<SidebarHeader>
					<SidebarHeaderContent />
				</SidebarHeader>
				<SidebarContent>
					<SidebarGroup>
						<SidebarGroupContent>
							<SidebarMenu>
								<SidebarMenuItem>
									<SidebarMenuButton
										tooltip="Home"
										isActive={pathname === "/home" || pathname === "/"}
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
										isActive={pathname === "/search-address"}
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
										tooltip="Reports"
										isActive={pathname === "/reports"}
										asChild
									>
										<Link href="/reports">
											<FileText className="size-4" />
											<span>Reports</span>
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
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarContent>
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

