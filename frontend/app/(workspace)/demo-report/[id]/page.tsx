"use client";

import { useParams, useRouter } from "next/navigation";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
	MapPin,
	Ruler,
	Building,
	FileText,
	CheckCircle2,
	XCircle,
	AlertCircle,
	ArrowLeft,
	Send,
} from "lucide-react";

export default function DemoReportPage() {
	const params = useParams();
	const router = useRouter();
	const reportId = params.id as string;

	// Dummy data for demonstration
	const propertyData = {
		address: "2847 Broadway, Manhattan, NY 10025",
		lotDetails: {
			block: "1892",
			lot: "15",
			taxLot: "1001892015",
			lotArea: "2,500 sq ft",
			lotDepth: "100 ft",
			lotFrontage: "25 ft",
			lotType: "Interior",
		},
		zoning: {
			classification: "R7-2",
			description:
				"Residential district with contextual zoning regulations",
			floorAreaRatio: "3.44",
			maximumBuildingHeight: "70 ft",
			requiredYards: "Front: 15 ft, Rear: 30 ft",
		},
		zoningDetails: {
			maximumFAR: "3.44",
			densityRequirements: "Maximum 1 dwelling unit per 400 sq ft of lot area",
			minimumBaseHeight: "40 ft",
			maximumBaseHeight: "60 ft",
			maximumBuildingHeight: "70 ft",
			yardRequirements: {
				front: "15 ft minimum",
				side: "0 ft (interior lot)",
				rear: "30 ft minimum",
			},
			parkingRequirements: "1 space per 2 dwelling units (if parking provided)",
			streetTreeRequirements: "1 tree per 25 ft of street frontage",
		},
		buildingInfo: {
			yearBuilt: "1925",
			numberOfStories: "4",
			numberOfUnits: "8",
			buildingClass: "C1 - Walk-up apartments",
			totalBuildingArea: "8,600 sq ft",
			residentialUnits: "8",
			commercialUnits: "0",
		},
		landUse: {
			designation: "Residential Multi-Unit",
			primaryUse: "Residential",
			secondaryUse: "None",
			zoningMap: "12a",
		},
		allowedUses: [
			"Residential buildings (apartments, condominiums)",
			"Community facilities (schools, places of worship)",
			"Accessory parking (with restrictions)",
			"Home occupations (with limitations)",
		],
		restrictedUses: [
			"Commercial retail (ground floor commercial requires special permit)",
			"Industrial uses",
			"Warehouses",
			"Automotive repair shops",
		],
		feasibleOptions: [
			{
				title: "Build on Currently Unused Land",
				description:
					"The rear yard area (approximately 500 sq ft) could accommodate a small accessory structure or expansion, subject to zoning regulations and setback requirements.",
				feasibility: "Moderate",
				considerations: [
					"Must maintain required rear yard of 30 ft",
					"Accessory structure limited to 25% of lot coverage",
					"May require special permit for certain uses",
				],
			},
			{
				title: "Convert Single-Family to Multi-Residential",
				description:
					"Not applicable - property is already multi-residential (8 units). However, the building could potentially be expanded or reconfigured within zoning limits.",
				feasibility: "N/A",
				considerations: [
					"Current FAR of 3.44 allows for potential vertical expansion",
					"Maximum height of 70 ft provides room for additional stories",
					"Would require careful analysis of existing structure",
				],
			},
			{
				title: "Convert Multi-Residential to Single-Family",
				description:
					"Technically feasible but economically challenging. The 8-unit building could be converted to a single-family residence, though this would reduce income potential significantly.",
				feasibility: "Low",
				considerations: [
					"Zoning allows single-family use in R7-2 district",
					"Would require significant renovation and loss of rental income",
					"May require variance for certain modifications",
				],
			},
			{
				title: "Vertical Expansion",
				description:
					"The building currently has 4 stories. With a maximum height of 70 ft and current FAR of 3.44, there may be potential to add 1-2 additional stories, subject to structural analysis and code compliance.",
				feasibility: "Moderate to High",
				considerations: [
					"Must comply with 70 ft height limit",
					"Structural engineering required",
					"May require elevator installation for accessibility",
					"Setback requirements must be maintained",
				],
			},
			{
				title: "Ground Floor Commercial Conversion",
				description:
					"R7-2 zoning allows ground floor commercial with special permit. The ground floor could potentially be converted to retail or office space, subject to DOB approval and special permit process.",
				feasibility: "Moderate",
				considerations: [
					"Requires special permit from City Planning Commission",
					"Must maintain residential units above",
					"Parking requirements may apply",
					"Accessibility compliance required",
				],
			},
		],
	};

	return (
		<div className="p-8 bg-[#F7F5F3] min-h-screen">
			<div className="max-w-5xl mx-auto space-y-6">
				{/* Header with Back Button and Share */}
				<div className="flex items-start justify-between mb-4">
					<div className="flex-1">
						<Button
							variant="ghost"
							onClick={() => router.push("/demo-report-list")}
							className="mb-4"
						>
							<ArrowLeft className="size-4 mr-2" />
							Back to Demo Reports
						</Button>
						<div>
							<h1 className="text-3xl font-semibold text-[#37322F] mb-2">
								Property Feasibility Report
							</h1>
							<div className="flex items-center gap-2 text-[#605A57]">
								<MapPin className="size-4" />
								<span className="text-lg">{propertyData.address}</span>
							</div>
							<Badge
								variant="outline"
								className="mt-3 bg-green-100 text-green-700 border-green-200"
							>
								Report Generated: {new Date().toLocaleDateString()}
							</Badge>
						</div>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							// Share functionality - can be enhanced later
							if (navigator.share) {
								navigator.share({
									title: "Property Feasibility Report",
									text: `Feasibility report for ${propertyData.address}`,
									url: window.location.href,
								});
							} else {
								// Fallback: copy to clipboard
								navigator.clipboard.writeText(window.location.href);
								alert("Report link copied to clipboard!");
							}
						}}
						className="flex items-center gap-2"
					>
						<Send className="size-4" />
						Share
					</Button>
				</div>

				{/* Property Map/Location Image */}
				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<MapPin className="size-5 text-[#4090C2]" />
							<CardTitle>Property Location</CardTitle>
						</div>
						<CardDescription>
							Map and location visualization
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="w-full flex justify-center">
							<div className="w-full max-w-2xl rounded-lg overflow-hidden border border-[rgba(55,50,47,0.12)] bg-gray-100">
								<img
									src="/demo-reports/2847Broadway.png"
									alt={`Property map for ${propertyData.address}`}
									className="w-full h-auto object-contain"
									onError={(e) => {
										// Fallback if image doesn't exist
										const target = e.target as HTMLImageElement;
										target.style.display = "none";
										if (target.parentElement) {
											target.parentElement.innerHTML =
												'<div class="w-full h-64 flex items-center justify-center text-[#605A57] bg-gray-100">Map image not found</div>';
										}
									}}
								/>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Lot Details */}
				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<Ruler className="size-5 text-[#4090C2]" />
							<CardTitle>Lot Details</CardTitle>
						</div>
						<CardDescription>
							Property identification and lot specifications
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-2 md:grid-cols-3 gap-4">
							<div>
								<p className="text-sm text-[#605A57] mb-1">Block</p>
								<p className="font-medium text-[#37322F]">
									{propertyData.lotDetails.block}
								</p>
							</div>
							<div>
								<p className="text-sm text-[#605A57] mb-1">Lot</p>
								<p className="font-medium text-[#37322F]">
									{propertyData.lotDetails.lot}
								</p>
							</div>
							<div>
								<p className="text-sm text-[#605A57] mb-1">
									Tax Lot
								</p>
								<p className="font-medium text-[#37322F]">
									{propertyData.lotDetails.taxLot}
								</p>
							</div>
							<div>
								<p className="text-sm text-[#605A57] mb-1">
									Lot Area
								</p>
								<p className="font-medium text-[#37322F]">
									{propertyData.lotDetails.lotArea}
								</p>
							</div>
							<div>
								<p className="text-sm text-[#605A57] mb-1">
									Lot Depth
								</p>
								<p className="font-medium text-[#37322F]">
									{propertyData.lotDetails.lotDepth}
								</p>
							</div>
							<div>
								<p className="text-sm text-[#605A57] mb-1">
									Lot Frontage
								</p>
								<p className="font-medium text-[#37322F]">
									{propertyData.lotDetails.lotFrontage}
								</p>
							</div>
							<div>
								<p className="text-sm text-[#605A57] mb-1">
									Lot Type
								</p>
								<p className="font-medium text-[#37322F]">
									{propertyData.lotDetails.lotType}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Zoning Classification */}
				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<FileText className="size-5 text-[#4090C2]" />
							<CardTitle>Zoning Classification</CardTitle>
						</div>
						<CardDescription>
							Zoning district regulations and requirements
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							<div>
								<Badge
									variant="outline"
									className="mb-3 bg-[#4090C2] text-white border-[#4090C2]"
								>
									{propertyData.zoning.classification}
								</Badge>
								<p className="text-[#37322F] mb-4">
									{propertyData.zoning.description}
								</p>
							</div>
							<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
								<div>
									<p className="text-sm text-[#605A57] mb-1">
										Floor Area Ratio (FAR)
									</p>
									<p className="font-medium text-[#37322F]">
										{propertyData.zoning.floorAreaRatio}
									</p>
								</div>
								<div>
									<p className="text-sm text-[#605A57] mb-1">
										Max Building Height
									</p>
									<p className="font-medium text-[#37322F]">
										{propertyData.zoning.maximumBuildingHeight}
									</p>
								</div>
								<div className="md:col-span-2">
									<p className="text-sm text-[#605A57] mb-1">
										Required Yards
									</p>
									<p className="font-medium text-[#37322F]">
										{propertyData.zoning.requiredYards}
									</p>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Building Lot Information */}
				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<Building className="size-5 text-[#4090C2]" />
							<CardTitle>Building Lot Information</CardTitle>
						</div>
						<CardDescription>
							Current building characteristics and specifications
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-2 md:grid-cols-3 gap-4">
							<div>
								<p className="text-sm text-[#605A57] mb-1">
									Year Built
								</p>
								<p className="font-medium text-[#37322F]">
									{propertyData.buildingInfo.yearBuilt}
								</p>
							</div>
							<div>
								<p className="text-sm text-[#605A57] mb-1">
									Number of Stories
								</p>
								<p className="font-medium text-[#37322F]">
									{propertyData.buildingInfo.numberOfStories}
								</p>
							</div>
							<div>
								<p className="text-sm text-[#605A57] mb-1">
									Number of Units
								</p>
								<p className="font-medium text-[#37322F]">
									{propertyData.buildingInfo.numberOfUnits}
								</p>
							</div>
							<div>
								<p className="text-sm text-[#605A57] mb-1">
									Building Class
								</p>
								<p className="font-medium text-[#37322F]">
									{propertyData.buildingInfo.buildingClass}
								</p>
							</div>
							<div>
								<p className="text-sm text-[#605A57] mb-1">
									Total Building Area
								</p>
								<p className="font-medium text-[#37322F]">
									{propertyData.buildingInfo.totalBuildingArea}
								</p>
							</div>
							<div>
								<p className="text-sm text-[#605A57] mb-1">
									Residential Units
								</p>
								<p className="font-medium text-[#37322F]">
									{propertyData.buildingInfo.residentialUnits}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Land Use Designation */}
				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<MapPin className="size-5 text-[#4090C2]" />
							<CardTitle>Land Use Designation</CardTitle>
						</div>
						<CardDescription>
							Official land use classification
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
							<div>
								<p className="text-sm text-[#605A57] mb-1">
									Designation
								</p>
								<p className="font-medium text-[#37322F]">
									{propertyData.landUse.designation}
								</p>
							</div>
							<div>
								<p className="text-sm text-[#605A57] mb-1">
									Primary Use
								</p>
								<p className="font-medium text-[#37322F]">
									{propertyData.landUse.primaryUse}
								</p>
							</div>
							<div>
								<p className="text-sm text-[#605A57] mb-1">
									Secondary Use
								</p>
								<p className="font-medium text-[#37322F]">
									{propertyData.landUse.secondaryUse || "None"}
								</p>
							</div>
							<div>
								<p className="text-sm text-[#605A57] mb-1">
									Zoning Map
								</p>
								<p className="font-medium text-[#37322F]">
									{propertyData.landUse.zoningMap}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Zoning Constraints & Requirements */}
				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<FileText className="size-5 text-[#4090C2]" />
							<CardTitle>Zoning Constraints & Requirements</CardTitle>
						</div>
						<CardDescription>
							Detailed zoning regulations affecting development feasibility
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-6">
							{/* Maximum F.A.R. */}
							<div>
								<p className="text-sm font-medium text-[#605A57] mb-1">
									Maximum F.A.R. (Floor Area Ratio)
								</p>
								<p className="text-base text-[#37322F] font-semibold">
									{propertyData.zoningDetails.maximumFAR}
								</p>
								<p className="text-xs text-[#605A57] mt-1">
									Limits total buildable floor area — often the primary
									economic constraint.
								</p>
							</div>

							<Separator />

							{/* Density Requirements */}
							<div>
								<p className="text-sm font-medium text-[#605A57] mb-1">
									Density Requirements
								</p>
								<p className="text-base text-[#37322F] font-semibold">
									{propertyData.zoningDetails.densityRequirements}
								</p>
								<p className="text-xs text-[#605A57] mt-1">
									Controls number of dwelling units, affecting layout,
									circulation, and feasibility.
								</p>
							</div>

							<Separator />

							{/* Height Requirements */}
							<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
								<div>
									<p className="text-sm font-medium text-[#605A57] mb-1">
										Minimum Base Height
									</p>
									<p className="text-base text-[#37322F] font-semibold">
										{propertyData.zoningDetails.minimumBaseHeight}
									</p>
									<p className="text-xs text-[#605A57] mt-1">
										Defines required streetwall height for contextual
										zoning districts.
									</p>
								</div>
								<div>
									<p className="text-sm font-medium text-[#605A57] mb-1">
										Maximum Base Height
									</p>
									<p className="text-base text-[#37322F] font-semibold">
										{propertyData.zoningDetails.maximumBaseHeight}
									</p>
									<p className="text-xs text-[#605A57] mt-1">
										Caps the streetwall before setbacks are required.
									</p>
								</div>
								<div>
									<p className="text-sm font-medium text-[#605A57] mb-1">
										Maximum Building Height
									</p>
									<p className="text-base text-[#37322F] font-semibold">
										{propertyData.zoningDetails.maximumBuildingHeight}
									</p>
									<p className="text-xs text-[#605A57] mt-1">
										Absolute vertical limit; often the final constraint on
										massing.
									</p>
								</div>
							</div>

							<Separator />

							{/* Yard Requirements */}
							<div>
								<p className="text-sm font-medium text-[#605A57] mb-3">
									Yard Requirements
								</p>
								<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
									<div>
										<p className="text-xs text-[#605A57] mb-1">Front</p>
										<p className="text-base text-[#37322F] font-semibold">
											{propertyData.zoningDetails.yardRequirements.front}
										</p>
									</div>
									<div>
										<p className="text-xs text-[#605A57] mb-1">Side</p>
										<p className="text-base text-[#37322F] font-semibold">
											{propertyData.zoningDetails.yardRequirements.side}
										</p>
									</div>
									<div>
										<p className="text-xs text-[#605A57] mb-1">Rear</p>
										<p className="text-base text-[#37322F] font-semibold">
											{propertyData.zoningDetails.yardRequirements.rear}
										</p>
									</div>
								</div>
								<p className="text-xs text-[#605A57] mt-3">
									Controls setbacks, light, air, and spatial relationships
									to neighbors.
								</p>
							</div>

							<Separator />

							{/* Parking Requirements */}
							<div>
								<p className="text-sm font-medium text-[#605A57] mb-1">
									Parking Requirements
								</p>
								<p className="text-base text-[#37322F] font-semibold">
									{propertyData.zoningDetails.parkingRequirements}
								</p>
								<p className="text-xs text-[#605A57] mt-1">
									May affect site planning, building footprint, and overall
									development costs.
								</p>
							</div>

							<Separator />

							{/* Street Tree Requirements */}
							<div>
								<p className="text-sm font-medium text-[#605A57] mb-1">
									Street Tree Requirements
								</p>
								<p className="text-base text-[#37322F] font-semibold">
									{propertyData.zoningDetails.streetTreeRequirements}
								</p>
								<p className="text-xs text-[#605A57] mt-1">
									Affects site planning, sidewalk design, and DOB approval.
								</p>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Allowed vs. Restricted Uses */}
				<div className="grid md:grid-cols-2 gap-6">
					<Card>
						<CardHeader>
							<div className="flex items-center gap-2">
								<CheckCircle2 className="size-5 text-green-600" />
								<CardTitle>Allowed Uses</CardTitle>
							</div>
							<CardDescription>
								Permitted uses under current zoning
							</CardDescription>
						</CardHeader>
						<CardContent>
							<ul className="space-y-2">
								{propertyData.allowedUses.map((use, index) => (
									<li
										key={index}
										className="flex items-start gap-2 text-[#37322F]"
									>
										<CheckCircle2 className="size-4 text-green-600 mt-0.5 flex-shrink-0" />
										<span>{use}</span>
									</li>
								))}
							</ul>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<div className="flex items-center gap-2">
								<XCircle className="size-5 text-red-600" />
								<CardTitle>Restricted Uses</CardTitle>
							</div>
							<CardDescription>
								Uses not permitted or requiring special permits
							</CardDescription>
						</CardHeader>
						<CardContent>
							<ul className="space-y-2">
								{propertyData.restrictedUses.map((use, index) => (
									<li
										key={index}
										className="flex items-start gap-2 text-[#37322F]"
									>
										<XCircle className="size-4 text-red-600 mt-0.5 flex-shrink-0" />
										<span>{use}</span>
									</li>
								))}
							</ul>
						</CardContent>
					</Card>
				</div>

				{/* Feasible Development Options */}
				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<AlertCircle className="size-5 text-[#4090C2]" />
							<CardTitle>Feasible Development Options</CardTitle>
						</div>
						<CardDescription>
							Analysis of potential development scenarios
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-6">
							{propertyData.feasibleOptions.map((option, index) => (
								<div key={index}>
									<div className="flex items-start justify-between mb-2">
										<h3 className="text-lg font-semibold text-[#37322F]">
											{option.title}
										</h3>
										{option.feasibility !== "N/A" && (
											<Badge
												variant="outline"
												className={
													option.feasibility === "High"
														? "bg-green-100 text-green-700 border-green-200"
														: option.feasibility ===
														  "Moderate"
														? "bg-yellow-100 text-yellow-700 border-yellow-200"
														: "bg-red-100 text-red-700 border-red-200"
												}
											>
												{option.feasibility} Feasibility
											</Badge>
										)}
									</div>
									<p className="text-[#605A57] mb-3">
										{option.description}
									</p>
									{option.considerations.length > 0 && (
										<div className="bg-[#F7F5F3] rounded-lg p-4 border border-[rgba(55,50,47,0.12)]">
											<p className="text-sm font-medium text-[#37322F] mb-2">
												Key Considerations:
											</p>
											<ul className="space-y-1">
												{option.considerations.map(
													(consideration, idx) => (
														<li
															key={idx}
															className="text-sm text-[#605A57] flex items-start gap-2"
														>
															<span className="text-[#4090C2] mt-1">
																•
															</span>
															<span>
																{consideration}
															</span>
														</li>
													)
												)}
											</ul>
										</div>
									)}
									{index <
										propertyData.feasibleOptions.length -
											1 && (
										<Separator className="mt-6" />
									)}
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

