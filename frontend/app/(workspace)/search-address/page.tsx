"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const recentAddresses = [
	"123 Park Ave, Manhattan, NY 10017",
	"456 Atlantic Ave, Brooklyn, NY 11217",
	"789 Broadway, Manhattan, NY 10003",
	"321 5th Ave, Brooklyn, NY 11215",
	"654 Lexington Ave, Manhattan, NY 10022",
	"987 Court St, Brooklyn, NY 11231",
];

export default function SearchAddressPage() {
	return (
		<div className="p-8">
			<div className="max-w-2xl">
				<div className="flex gap-4 mb-8">
					<Input
						type="text"
						placeholder="Add Address"
						className="flex-1"
					/>
					<Button>Generate Report</Button>
				</div>

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
