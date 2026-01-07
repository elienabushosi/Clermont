"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import AddressAutocomplete, {
	AddressData,
} from "@/components/address-autocomplete";
import AddressMap from "@/components/address-map";
import { getAuthToken } from "@/lib/auth";

const recentAddresses = [
	"123 Park Ave, Manhattan, NY 10017",
	"456 Atlantic Ave, Brooklyn, NY 11217",
	"789 Broadway, Manhattan, NY 10003",
	"321 5th Ave, Brooklyn, NY 11215",
	"654 Lexington Ave, Manhattan, NY 10022",
	"987 Court St, Brooklyn, NY 11231",
];

export default function SearchAddressPage() {
	const [addressData, setAddressData] = useState<AddressData | null>(null);

	const handleAddressSelect = (data: AddressData) => {
		setAddressData(data);
	};

	const handleGenerateReport = async () => {
		if (!addressData) {
			toast.error("Please select an address first");
			return;
		}

		const token = getAuthToken();
		if (!token) {
			toast.error("Please log in to generate reports");
			return;
		}

		try {
			toast.loading("Generating report...", { id: "generate-report" });

			const response = await fetch(
				"http://localhost:3002/api/reports/generate",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({
						address: addressData.address,
						normalizedAddress: addressData.normalizedAddress,
						location: addressData.location,
						placeId: addressData.placeId,
					}),
				}
			);

			const result = await response.json();

			if (!response.ok) {
				toast.error(result.message || "Failed to generate report", {
					id: "generate-report",
				});
				return;
			}

			toast.success("Report generation started successfully!", {
				id: "generate-report",
			});

			console.log("Report generated:", result);
			// TODO: Navigate to report page or update UI to show report status
		} catch (error) {
			console.error("Error generating report:", error);
			toast.error("Network error. Please try again later.", {
				id: "generate-report",
			});
		}
	};

	return (
		<div className="p-8">
			<div className="max-w-4xl">
				<div className="flex gap-4 mb-8">
					<AddressAutocomplete
						onAddressSelect={handleAddressSelect}
						placeholder="Add Address"
						className="flex-1"
					/>
					<Button
						onClick={handleGenerateReport}
						disabled={!addressData}
					>
						Generate Report
					</Button>
				</div>

				{/* Map display when address is selected */}
				{addressData && (
					<div className="mb-8">
						<AddressMap addressData={addressData} />
						<p className="text-sm text-[#605A57] mt-2">
							{addressData.address}
						</p>
					</div>
				)}

				<div>
					<h2 className="text-xl font-semibold text-[#37322F] mb-4">
						Recent Addresses
					</h2>
					<div className="space-y-3">
						{recentAddresses.map((address, index) => (
							<div
								key={index}
								className="flex items-center justify-between p-3 bg-white rounded-lg border border-[rgba(55,50,47,0.12)] hover:shadow-sm transition-shadow"
							>
								<span className="text-sm text-[#37322F]">
									{address}
								</span>
								<Badge
									variant="outline"
									className="bg-green-100 text-green-700 border-green-200"
								>
									Report Ready
								</Badge>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
