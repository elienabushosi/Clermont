import type { Metadata } from "next";

const apiUrl =
	process.env.NEXT_PUBLIC_API_URL ||
	(process.env.NODE_ENV === "production" ? "https://api.yourdomain.com" : "http://localhost:3002");

export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}): Promise<Metadata> {
	const { id } = await params;
	try {
		const res = await fetch(`${apiUrl}/api/reports/public/${id}`, {
			next: { revalidate: 60 },
		});
		if (!res.ok) return { title: "Report" };
		const data = await res.json();
		const report = data.report;
		const title =
			report?.Address?.trim() || report?.Name?.trim() || "Report";
		return {
			title,
			openGraph: { title },
			twitter: { card: "summary", title },
		};
	} catch {
		return { title: "Report" };
	}
}

export default function ViewReportPublicLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
