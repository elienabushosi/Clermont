"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import AddressAutocomplete, {
	AddressData,
} from "@/components/address-autocomplete";
import { TriangleAlert, HeartHandshake } from "lucide-react";
import { config } from "@/lib/config";

const ROTATING_DISCLAIMERS = [
	"Clermont currently supports 2 address max. We're hard at work to support more than 3.",
];

export default function LandAssemblagePage() {
	const router = useRouter();
	const [address1, setAddress1] = useState<AddressData | null>(null);
	const [address2, setAddress2] = useState<AddressData | null>(null);
	const [isGenerating, setIsGenerating] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [disclaimerIndex, setDisclaimerIndex] = useState(0);

	useEffect(() => {
		if (ROTATING_DISCLAIMERS.length <= 1) return;
		const id = setInterval(() => {
			setDisclaimerIndex((i) => (i + 1) % ROTATING_DISCLAIMERS.length);
		}, 5000);
		return () => clearInterval(id);
	}, []);

	const handleAddress1Select = (data: AddressData) => {
		setAddress1(data);
		setAddress2(null);
		setError(null);
	};

	const handleAddress2Select = (data: AddressData) => {
		setAddress2(data);
		setError(null);
	};

	const canGenerate = address1 != null && address2 != null && !isGenerating;

	const handleGenerate = async () => {
		if (!address1 || !address2) return;
		setIsGenerating(true);
		setError(null);
		const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
		if (!token) {
			setError("Please sign in to generate reports.");
			setIsGenerating(false);
			return;
		}
		const addresses = [
			address1.normalizedAddress || address1.address,
			address2.normalizedAddress || address2.address,
		];
		try {
			const res = await fetch(`${config.apiUrl}/api/assemblage-reports/generate`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ addresses }),
			});
			const data = await res.json();
			if (!res.ok) {
				setError(data.message || "Failed to generate assemblage report");
				setIsGenerating(false);
				return;
			}
			if (data.reportId) {
				router.push(`/assemblagereportview/${data.reportId}`);
				return;
			}
			setError("No report ID returned");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Request failed");
		} finally {
			setIsGenerating(false);
		}
	};

	return (
		<div className="w-full max-w-4xl mx-auto p-6 space-y-8">
			{/* Yellow rotating disclaimer banner — above heading */}
			<div
				className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 w-full"
				role="status"
				aria-live="polite"
			>
				<TriangleAlert className="size-5 shrink-0 text-amber-600" aria-hidden />
				<span>{ROTATING_DISCLAIMERS[disclaimerIndex]}</span>
			</div>

			<div>
				<h1 className="text-2xl font-semibold text-[#37322F]">
					Land Assemblage
				</h1>
				<p className="text-[#605A57] text-sm mt-1">
					Multi-property projects. Add two addresses to generate a combined report
					according to zoning laws.
				</p>
			</div>

			<div className="space-y-6">
				<div className="space-y-2">
					<label className="text-sm font-medium text-[#37322F]">
						Add the first address
					</label>
					<AddressAutocomplete
						onAddressSelect={handleAddress1Select}
						placeholder="Add the first address"
						className="w-full"
					/>
					{address1 && (
						<p className="text-sm text-[#605A57] mt-1">
							{address1.normalizedAddress || address1.address}
						</p>
					)}
				</div>

				{address1 && (
					<div className="space-y-2">
						<label className="text-sm font-medium text-[#37322F]">
							Second address
						</label>
						<AddressAutocomplete
							onAddressSelect={handleAddress2Select}
							placeholder="Add your second address"
							className="w-full"
						/>
						{address2 && (
							<p className="text-sm text-[#605A57] mt-1">
								{address2.normalizedAddress || address2.address}
							</p>
						)}
					</div>
				)}

				{error && (
					error.includes("design partner") || error.includes("test reports") ? (
						<div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
							<HeartHandshake className="size-5 shrink-0 text-amber-600 mt-0.5" aria-hidden />
							<p className="leading-relaxed">{error}</p>
						</div>
					) : (
						<p className="text-sm text-red-600">{error}</p>
					)
				)}
				<Button
					className="w-full bg-[#37322F] hover:bg-[#37322F]/90 text-white disabled:opacity-50 disabled:pointer-events-none"
					disabled={!canGenerate}
					onClick={handleGenerate}
				>
					{isGenerating ? "Generating…" : "Generate report"}
				</Button>
			</div>
		</div>
	);
}
