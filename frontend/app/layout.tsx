import type React from "react";
import type { Metadata } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
	subsets: ["latin"],
	variable: "--font-inter",
	display: "swap",
	preload: true,
});

const instrumentSerif = Instrument_Serif({
	subsets: ["latin"],
	variable: "--font-instrument-serif",
	weight: ["400"],
	display: "swap",
	preload: true,
});

export const metadata: Metadata = {
	title: "Clermont - Property Zoning Reports for Developers & Architects",
	description:
		"Property zoning snapshots and asset-analysis tool for developers & architects that automatically generates property zoning reports using just a client's address.",
	generator: "v0.app",
	icons: {
		icon: "/favicon-32x32.png",
		apple: "/favicon-32x32.png",
		shortcut: "/favicon-32x32.png",
	},
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html
			lang="en"
			className={`${inter.variable} ${instrumentSerif.variable} antialiased`}
		>
			<body className="font-sans antialiased">
				{children}
				<Toaster />
			</body>
		</html>
	);
}
