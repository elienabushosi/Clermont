"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const REPORT_OPTIONS = [
	"Building Details",
	"Lot Details",
	"Minimum Base Height",
	"Maximum Base Height",
	"Maximum Building Height",
	"Max FAR",
	"Density Requirements",
	"Yard Requirements",
] as const;

export default function ReportOptionsPage() {
	const router = useRouter();
	const [loading, setLoading] = useState(true);
	const [selected, setSelected] = useState<Record<string, boolean>>(
		REPORT_OPTIONS.reduce((acc, key) => ({ ...acc, [key]: false }), {})
	);

	useEffect(() => {
		const t = setTimeout(() => setLoading(false), 1500);
		return () => clearTimeout(t);
	}, []);

	const toggle = (option: string) => {
		setSelected((prev) => ({ ...prev, [option]: !prev[option] }));
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-[#F7F5F3] flex flex-col items-center justify-center px-4">
				<div className="flex flex-col items-center gap-6">
					<div className="w-10 h-10 border-2 border-[#D09376] border-t-transparent rounded-full animate-spin" />
					<p className="text-[#605A57] text-sm font-medium font-sans">
						Preparing your report...
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-[#F7F5F3] flex flex-col items-center px-4 py-12 sm:py-16">
			<div className="w-full max-w-[560px] flex flex-col gap-8">
				<button
					type="button"
					onClick={() => router.push("/")}
					className="self-start flex items-center gap-2 text-[#37322F] hover:text-[#4090C2] transition-colors text-sm font-medium"
				>
					<ArrowLeft className="w-4 h-4" />
					Back
				</button>
				<h1 className="text-[#37322F] text-2xl sm:text-3xl font-semibold leading-tight font-sans text-center">
					What do you want included on your report?
				</h1>
				<div className="flex flex-col gap-4">
					{REPORT_OPTIONS.map((option) => (
						<label
							key={option}
							className={cn(
								"flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors",
								selected[option]
									? "border-[#D09376] bg-[#D09376]/5"
									: "border-[rgba(55,50,47,0.12)] bg-white hover:border-[rgba(55,50,47,0.2)]"
							)}
						>
							<Checkbox
								checked={selected[option]}
								onCheckedChange={() => toggle(option)}
							/>
							<span className="text-[#37322F] text-sm font-medium font-sans">
								{option}
							</span>
						</label>
					))}
				</div>
				<button
					type="button"
					onClick={() => {
						const selections = REPORT_OPTIONS.filter((opt) => selected[opt]);
						console.log("Report options selected:", selections);
						router.push("/signupsearch");
					}}
					className="w-full h-11 px-6 rounded-md bg-[#D09376] text-white text-sm font-medium font-sans hover:bg-[#D09376]/90 transition-colors flex items-center justify-center"
				>
					Continue
				</button>
			</div>
		</div>
	);
}
