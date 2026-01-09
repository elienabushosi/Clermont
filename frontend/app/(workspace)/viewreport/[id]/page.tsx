"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { getReportWithSources, type ReportWithSources } from "@/lib/reports";
import { getBuildingClassDescriptionText } from "@/lib/building-class";
import {
	ArrowLeft,
	MapPin,
	Send,
	Home,
	Grid2x2Check,
	LandPlot,
} from "lucide-react";
import { GoogleMap, Marker, useLoadScript } from "@react-google-maps/api";

function getStatusColor(status: string) {
	switch (status) {
		case "pending":
			return "bg-yellow-100 text-yellow-700 border-yellow-200";
		case "ready":
			return "bg-green-100 text-green-700 border-green-200";
		case "failed":
			return "bg-red-100 text-red-700 border-red-200";
		case "succeeded":
			return "bg-green-100 text-green-700 border-green-200";
		default:
			return "bg-gray-100 text-gray-700 border-gray-200";
	}
}

export default function ViewReportPage() {
	const params = useParams();
	const router = useRouter();
	const reportId = params.id as string;

	const [reportData, setReportData] = useState<ReportWithSources | null>(
		null
	);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showDebugMode, setShowDebugMode] = useState(false); // false = pretty mode (default), true = debug mode

	useEffect(() => {
		const fetchReport = async () => {
			if (!reportId) return;

			try {
				setIsLoading(true);
				setError(null);
				const data = await getReportWithSources(reportId);
				setReportData(data);
			} catch (err) {
				console.error("Error fetching report:", err);
				setError(
					err instanceof Error ? err.message : "Failed to load report"
				);
			} finally {
				setIsLoading(false);
			}
		};

		fetchReport();
	}, [reportId]);

	if (isLoading) {
		return (
			<div className="p-8">
				<div className="max-w-4xl mx-auto">
					<Skeleton className="h-8 w-32 mb-6" />
					<Skeleton className="h-64 w-full" />
				</div>
			</div>
		);
	}

	if (error || !reportData) {
		return (
			<div className="p-8">
				<div className="max-w-4xl mx-auto">
					<Button
						variant="ghost"
						onClick={() => router.push("/reports")}
						className="mb-4"
					>
						<ArrowLeft className="size-4 mr-2" />
						Back to Reports
					</Button>
					<Card>
						<CardContent className="pt-6">
							<p className="text-red-600">
								{error || "Report not found"}
							</p>
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	const { report, client, sources } = reportData;

	// Extract formatted data from sources for pretty view
	const getFormattedData = () => {
		const geoserviceSource = sources.find(
			(s) => s.SourceKey === "geoservice"
		);
		const zolaSource = sources.find((s) => s.SourceKey === "zola");

		// Handle different possible structures
		const geoserviceData =
			geoserviceSource?.ContentJson?.extracted ||
			geoserviceSource?.ContentJson ||
			{};
		const zolaData =
			zolaSource?.ContentJson?.contentJson ||
			zolaSource?.ContentJson ||
			{};

		// Merge data, with Zola taking precedence for overlapping fields
		return {
			address:
				zolaData.address ||
				geoserviceData.normalizedAddress ||
				report.Address,
			borough:
				zolaData.borough ||
				(geoserviceData.borough === "1"
					? "Manhattan"
					: geoserviceData.borough === "2"
					? "Bronx"
					: geoserviceData.borough === "3"
					? "Brooklyn"
					: geoserviceData.borough === "4"
					? "Queens"
					: geoserviceData.borough === "5"
					? "Staten Island"
					: geoserviceData.borough || null),
			block: zolaData.block?.toString() || geoserviceData.block || null,
			lot: zolaData.lot?.toString() || geoserviceData.lot || null,
			owner: zolaData.ownername || null,
			zoningDistricts:
				[
					zolaData.zonedist1,
					zolaData.zonedist2,
					zolaData.zonedist3,
					zolaData.zonedist4,
				]
					.filter(Boolean)
					.join(", ") || null,
			landUse: zolaData.landuse || null,
			lotArea: zolaData.lotarea
				? `${zolaData.lotarea.toLocaleString()} sq ft`
				: null,
			lotFrontage: zolaData.lotfront ? `${zolaData.lotfront} ft` : null,
			lotDepth: zolaData.lotdepth ? `${zolaData.lotdepth} ft` : null,
			yearBuilt: zolaData.yearbuilt || null,
			buildingClass:
				zolaData.bldgclass || geoserviceData.buildingClass || null,
			numberOfBuildings: zolaData.numbldgs || null,
			numberOfFloors: zolaData.numfloors || null,
			grossFloorArea: zolaData.bldgarea
				? `${zolaData.bldgarea.toLocaleString()} sq ft`
				: null,
			totalUnits: zolaData.unitstotal || null,
			residentialUnits: zolaData.unitsres || null,
			communityDistrict:
				zolaData.cd || geoserviceData.communityDistrict || null,
			cityCouncilDistrict:
				zolaData.council || geoserviceData.cityCouncilDistrict || null,
			schoolDistrict:
				zolaData.schooldist || geoserviceData.schoolDistrict || null,
			policePrecinct:
				zolaData.policeprct || geoserviceData.policePrecinct || null,
			fireCompany:
				zolaData.firecomp || geoserviceData.fireCompany || null,
			sanitationBorough: geoserviceData.sanitationBorough || null,
			sanitationDistrict:
				zolaData.sanitdistr ||
				geoserviceData.sanitationDistrict ||
				null,
			sanitationSubsection:
				zolaData.sanitsub ||
				geoserviceData.sanitationSubsection ||
				null,
			lat: zolaData.lat || geoserviceData.lat || null,
			lng: zolaData.lon || zolaData.lng || geoserviceData.lng || null,
		};
	};

	const formattedData = getFormattedData();

	return (
		<div className="p-8 bg-[#F7F5F3] min-h-screen">
			<div className="max-w-4xl mx-auto">
				{/* Top Navigation Bar */}
				<div className="flex items-center justify-between mb-6">
					<Button
						variant="ghost"
						onClick={() => router.push("/reports")}
					>
						<ArrowLeft className="size-4 mr-2" />
						Back to Your Reports
					</Button>
					<Button variant="outline">
						<Send className="size-4 mr-2" />
						Share
					</Button>
				</div>

				{/* Report Header */}
				<div className="mb-6">
					<h1 className="text-3xl font-semibold text-[#37322F] mb-3">
						{report.Name}
					</h1>
					<div className="flex items-center justify-between">
						<Badge className="bg-green-100 text-green-700 border-green-200">
							Report Generated:{" "}
							{format(new Date(report.CreatedAt), "M/d/yyyy")}
						</Badge>
						<div className="flex items-center gap-2">
							<Label
								htmlFor="debug-toggle"
								className="text-sm text-[#605A57] cursor-pointer"
							>
								{showDebugMode ? "Debug" : "Pretty"}
							</Label>
							<Switch
								id="debug-toggle"
								checked={showDebugMode}
								onCheckedChange={setShowDebugMode}
								className={
									showDebugMode
										? "data-[state=checked]:bg-blue-600"
										: "data-[state=unchecked]:bg-[#37322F] data-[state=unchecked]:border-[#37322F]"
								}
							/>
						</div>
					</div>
				</div>

				{/* Report Sources - Only show in Debug mode */}
				{showDebugMode && (
					<div className="space-y-4">
						<h2 className="text-xl font-semibold text-[#37322F]">
							Report Sources
						</h2>

						{sources.length === 0 ? (
							<Card>
								<CardContent className="pt-6">
									<p className="text-[#605A57] text-center">
										No sources found for this report
									</p>
								</CardContent>
							</Card>
						) : (
							// Debug Mode: Show raw JSON
							sources.map((source) => (
								<Card key={source.IdReportSource}>
									<CardHeader>
										<div className="flex items-center justify-between">
											<CardTitle className="text-lg">
												{source.SourceKey}
											</CardTitle>
											<Badge
												variant="outline"
												className={`text-xs ${getStatusColor(
													source.Status
												)}`}
											>
												{source.Status}
											</Badge>
										</div>
									</CardHeader>
									<CardContent className="space-y-4">
										<div className="grid grid-cols-2 gap-4 text-sm">
											<div>
												<p className="text-[#605A57] mb-1">
													Created At
												</p>
												<p className="text-[#37322F]">
													{format(
														new Date(
															source.CreatedAt
														),
														"MMM d, yyyy 'at' h:mm a"
													)}
												</p>
											</div>
											{source.SourceUrl && (
												<div>
													<p className="text-[#605A57] mb-1">
														Source URL
													</p>
													<a
														href={source.SourceUrl}
														target="_blank"
														rel="noopener noreferrer"
														className="text-[#4090C2] hover:underline"
													>
														{source.SourceUrl}
													</a>
												</div>
											)}
										</div>

										{source.ErrorMessage && (
											<div className="bg-red-50 border border-red-200 rounded-lg p-3">
												<p className="text-red-700 text-sm">
													<strong>Error:</strong>{" "}
													{source.ErrorMessage}
												</p>
											</div>
										)}

										{source.ContentText && (
											<div>
												<p className="text-[#605A57] text-sm mb-2 font-medium">
													Content Text:
												</p>
												<div className="bg-[#F7F5F3] rounded-lg p-4 border border-[rgba(55,50,47,0.12)]">
													<pre className="text-sm text-[#37322F] whitespace-pre-wrap">
														{source.ContentText}
													</pre>
												</div>
											</div>
										)}

										{source.ContentJson && (
											<div>
												<p className="text-[#605A57] text-sm mb-2 font-medium">
													Content JSON:
												</p>
												<div className="bg-[#F7F5F3] rounded-lg p-4 border border-[rgba(55,50,47,0.12)]">
													<pre className="text-sm text-[#37322F] overflow-x-auto">
														{JSON.stringify(
															source.ContentJson,
															null,
															2
														)}
													</pre>
												</div>
											</div>
										)}
									</CardContent>
								</Card>
							))
						)}
					</div>
				)}

				{/* Pretty Mode: Show formatted data - Only show when NOT in debug mode */}
				{!showDebugMode && (
					<>
						{/* Property Location Map */}
						{formattedData.lat && formattedData.lng && (
							<Card className="mb-6">
								<CardContent className="pt-6">
									<div className="mb-4">
										<div className="flex items-center gap-2 mb-1">
											<MapPin className="size-5 text-[#4090C2]" />
											<h3 className="text-lg font-semibold text-[#37322F]">
												Property Location
											</h3>
										</div>
										<p className="text-sm text-[#605A57]">
											Map and location visualization
										</p>
									</div>
									<PropertyMap
										lat={formattedData.lat}
										lng={formattedData.lng}
										address={
											formattedData.address ||
											report.Address
										}
									/>
								</CardContent>
							</Card>
						)}

						<Card className="mb-6">
							<CardContent className="space-y-6 pt-6">
								{/* Basic Property Information */}
								<div>
									<div className="flex items-center gap-2 mb-4">
										<Home className="size-5 text-[#4090C2]" />
										<h3 className="text-lg font-semibold text-[#37322F]">
											Property Level Information
										</h3>
									</div>
									<div className="grid grid-cols-2 gap-4">
										{formattedData.address && (
											<div>
												<p className="text-sm text-[#605A57] mb-1">
													Address
												</p>
												<p className="text-[#37322F] font-medium">
													{formattedData.address}
												</p>
											</div>
										)}
										{formattedData.borough && (
											<div>
												<p className="text-sm text-[#605A57] mb-1">
													Borough
												</p>
												<p className="text-[#37322F] font-medium">
													{formattedData.borough}
												</p>
											</div>
										)}
										{formattedData.owner && (
											<div>
												<p className="text-sm text-[#605A57] mb-1">
													Owner
												</p>
												<p className="text-[#37322F] font-medium">
													{formattedData.owner}
												</p>
											</div>
										)}
										{formattedData.landUse && (
											<div>
												<p className="text-sm text-[#605A57] mb-1">
													Land Use
												</p>
												<p className="text-[#37322F] font-medium">
													{formattedData.landUse}
												</p>
											</div>
										)}
										{formattedData.yearBuilt && (
											<div>
												<p className="text-sm text-[#605A57] mb-1">
													Year Built
												</p>
												<p className="text-[#37322F] font-medium">
													{formattedData.yearBuilt}
												</p>
											</div>
										)}
										{formattedData.buildingClass && (
											<div>
												<p className="text-sm text-[#605A57] mb-1">
													Building Class
												</p>
												<p className="text-[#37322F] font-medium">
													{getBuildingClassDescriptionText(
														formattedData.buildingClass
													)}
												</p>
											</div>
										)}
										{formattedData.numberOfBuildings !==
											null && (
											<div>
												<p className="text-sm text-[#605A57] mb-1">
													Number of Buildings
												</p>
												<p className="text-[#37322F] font-medium">
													{
														formattedData.numberOfBuildings
													}
												</p>
											</div>
										)}
										{formattedData.numberOfFloors !==
											null && (
											<div>
												<p className="text-sm text-[#605A57] mb-1">
													Number of Floors
												</p>
												<p className="text-[#37322F] font-medium">
													{
														formattedData.numberOfFloors
													}
												</p>
											</div>
										)}
										{formattedData.grossFloorArea && (
											<div>
												<p className="text-sm text-[#605A57] mb-1">
													Gross Floor Area
												</p>
												<p className="text-[#37322F] font-medium">
													{
														formattedData.grossFloorArea
													}
												</p>
											</div>
										)}
										{formattedData.totalUnits !== null && (
											<div>
												<p className="text-sm text-[#605A57] mb-1">
													Total # of Units
												</p>
												<p className="text-[#37322F] font-medium">
													{formattedData.totalUnits}
												</p>
											</div>
										)}
										{formattedData.residentialUnits !==
											null && (
											<div>
												<p className="text-sm text-[#605A57] mb-1">
													Residential Units
												</p>
												<p className="text-[#37322F] font-medium">
													{
														formattedData.residentialUnits
													}
												</p>
											</div>
										)}
									</div>
								</div>
							</CardContent>
						</Card>

						{/* Lot Details Section */}
						<Card className="mb-6">
							<CardContent className="pt-6">
								<div className="mb-4">
									<div className="flex items-center gap-2 mb-1">
										<Grid2x2Check className="size-5 text-[#4090C2]" />
										<h3 className="text-lg font-semibold text-[#37322F]">
											Lot Details
										</h3>
									</div>
									<p className="text-sm text-[#605A57]">
										Property identification and lot
										specifications
									</p>
								</div>
								<div className="grid grid-cols-2 gap-4">
									{formattedData.block && (
										<div>
											<p className="text-sm text-[#605A57] mb-1">
												Block
											</p>
											<p className="text-[#37322F] font-medium">
												{formattedData.block}
											</p>
										</div>
									)}
									{formattedData.lot && (
										<div>
											<p className="text-sm text-[#605A57] mb-1">
												Lot
											</p>
											<p className="text-[#37322F] font-medium">
												{formattedData.lot}
											</p>
										</div>
									)}
									{formattedData.lotArea && (
										<div>
											<p className="text-sm text-[#605A57] mb-1">
												Lot Area
											</p>
											<p className="text-[#37322F] font-medium">
												{formattedData.lotArea}
											</p>
										</div>
									)}
									{formattedData.lotFrontage && (
										<div>
											<p className="text-sm text-[#605A57] mb-1">
												Lot Frontage
											</p>
											<p className="text-[#37322F] font-medium">
												{formattedData.lotFrontage}
											</p>
										</div>
									)}
									{formattedData.lotDepth && (
										<div>
											<p className="text-sm text-[#605A57] mb-1">
												Lot Depth
											</p>
											<p className="text-[#37322F] font-medium">
												{formattedData.lotDepth}
											</p>
										</div>
									)}
								</div>
							</CardContent>
						</Card>

						{/* Zoning Classification Section */}
						<Card className="mb-6">
							<CardContent className="pt-6">
								<div className="mb-4">
									<div className="flex items-center gap-2 mb-1">
										<LandPlot className="size-5 text-[#4090C2]" />
										<h3 className="text-lg font-semibold text-[#37322F]">
											Zoning Classification
										</h3>
									</div>
									<p className="text-sm text-[#605A57]">
										Zoning district regulations and
										requirements
									</p>
								</div>
								<div className="grid grid-cols-2 gap-4">
									{formattedData.zoningDistricts && (
										<div>
											<p className="text-sm text-[#605A57] mb-2">
												Zoning Districts
											</p>
											<Badge className="bg-blue-100 text-blue-700 border-blue-200">
												{formattedData.zoningDistricts}
											</Badge>
										</div>
									)}
									<div>
										<p className="text-sm text-[#605A57] mb-2">
											Floor Area Ratio (FAR)
										</p>
										<Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">
											Pending Zoning Agent
										</Badge>
									</div>
									<div>
										<p className="text-sm text-[#605A57] mb-2">
											Max Building Height
										</p>
										<Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">
											Pending Zoning Agent
										</Badge>
									</div>
									<div>
										<p className="text-sm text-[#605A57] mb-2">
											Required Yards
										</p>
										<Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">
											Pending Zoning Agent
										</Badge>
									</div>
								</div>
							</CardContent>
						</Card>

						{/* Neighborhood Information */}
						<Card>
							<CardContent className="pt-6">
								<div>
									<h3 className="text-lg font-semibold text-[#37322F] mb-4">
										Neighborhood Information
									</h3>
									<div className="grid grid-cols-2 gap-4">
										{formattedData.communityDistrict && (
											<div>
												<p className="text-sm text-[#605A57] mb-1">
													Community District
												</p>
												<p className="text-[#37322F] font-medium">
													{
														formattedData.communityDistrict
													}
												</p>
											</div>
										)}
										{formattedData.cityCouncilDistrict && (
											<div>
												<p className="text-sm text-[#605A57] mb-1">
													City Council District
												</p>
												<p className="text-[#37322F] font-medium">
													{
														formattedData.cityCouncilDistrict
													}
												</p>
											</div>
										)}
										{formattedData.schoolDistrict && (
											<div>
												<p className="text-sm text-[#605A57] mb-1">
													School District
												</p>
												<p className="text-[#37322F] font-medium">
													{
														formattedData.schoolDistrict
													}
												</p>
											</div>
										)}
										{formattedData.policePrecinct && (
											<div>
												<p className="text-sm text-[#605A57] mb-1">
													Police Precinct
												</p>
												<p className="text-[#37322F] font-medium">
													{
														formattedData.policePrecinct
													}
												</p>
											</div>
										)}
										{formattedData.fireCompany && (
											<div>
												<p className="text-sm text-[#605A57] mb-1">
													Fire Company
												</p>
												<p className="text-[#37322F] font-medium">
													{formattedData.fireCompany}
												</p>
											</div>
										)}
										{formattedData.sanitationBorough && (
											<div>
												<p className="text-sm text-[#605A57] mb-1">
													Sanitation Borough
												</p>
												<p className="text-[#37322F] font-medium">
													{
														formattedData.sanitationBorough
													}
												</p>
											</div>
										)}
										{formattedData.sanitationDistrict && (
											<div>
												<p className="text-sm text-[#605A57] mb-1">
													Sanitation District
												</p>
												<p className="text-[#37322F] font-medium">
													{
														formattedData.sanitationDistrict
													}
												</p>
											</div>
										)}
										{formattedData.sanitationSubsection && (
											<div>
												<p className="text-sm text-[#605A57] mb-1">
													Sanitation Subsection
												</p>
												<p className="text-[#37322F] font-medium">
													{
														formattedData.sanitationSubsection
													}
												</p>
											</div>
										)}
									</div>
								</div>
							</CardContent>
						</Card>
					</>
				)}
			</div>
		</div>
	);
}

// Property Map Component
function PropertyMap({
	lat,
	lng,
	address,
}: {
	lat: number;
	lng: number;
	address: string;
}) {
	const GOOGLE_MAPS_API_KEY =
		process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

	const { isLoaded, loadError } = useLoadScript({
		googleMapsApiKey: GOOGLE_MAPS_API_KEY || "",
		libraries: ["places"],
	});

	const mapContainerStyle = {
		width: "100%",
		height: "400px",
	};

	if (loadError) {
		return (
			<div className="w-full h-[400px] bg-gray-100 rounded-lg flex items-center justify-center border border-[rgba(55,50,47,0.12)]">
				<p className="text-[#605A57]">Error loading map</p>
			</div>
		);
	}

	if (!isLoaded) {
		return (
			<div className="w-full h-[400px] bg-gray-100 rounded-lg flex items-center justify-center border border-[rgba(55,50,47,0.12)]">
				<p className="text-[#605A57]">Loading map...</p>
			</div>
		);
	}

	return (
		<div className="w-full rounded-lg overflow-hidden border border-[rgba(55,50,47,0.12)] shadow-sm">
			<GoogleMap
				mapContainerStyle={mapContainerStyle}
				center={{ lat, lng }}
				zoom={18}
				options={{
					mapTypeId: "hybrid",
					tilt: 60,
					streetViewControl: false,
					mapTypeControl: true,
					mapTypeControlOptions: {
						mapTypeIds: [
							"roadmap",
							"satellite",
							"hybrid",
							"terrain",
						],
					},
					fullscreenControl: true,
					styles: [
						{
							featureType: "poi",
							elementType: "all",
							stylers: [{ visibility: "off" }],
						},
					],
				}}
			>
				<Marker position={{ lat, lng }} />
			</GoogleMap>
		</div>
	);
}
