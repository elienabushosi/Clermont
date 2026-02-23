"use client";

import { useEffect, useState, useRef } from "react";
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
import { getLandUseDescriptionText } from "@/lib/land-use";
import {
	ArrowLeft,
	Box,
	MapPin,
	Send,
	Home,
	Grid2x2Check,
	LandPlot,
	Building2,
	ExternalLink,
	Ruler,
	MapPinCheck,
	Share2,
	FileDown,
} from "lucide-react";
import { GoogleMap, Marker, useLoadScript } from "@react-google-maps/api";
import { config } from "@/lib/config";
import { toast } from "sonner";
import FemaFloodMap, { type FemaFloodMapHandle } from "@/components/fema-flood-map";
import TransitZoneMap, { type TransitZoneMapHandle } from "@/components/transit-zone-map";
import ReportMassingSection from "@/components/report-massing-section";

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

/** Extract numeric lot area (sq ft) from formatted string like "5,000 sq ft" */
function extractLotAreaSqft(lotAreaStr: string | null | undefined): number | null {
	if (!lotAreaStr) return null;
	const match = lotAreaStr.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
	return match ? parseFloat(match[1]) : null;
}

/** Extract numeric frontage (ft) from formatted string like "25 ft" */
function extractLotFrontageFt(frontageStr: string | null | undefined): number | null {
	if (!frontageStr) return null;
	const match = frontageStr.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
	return match ? parseFloat(match[1]) : null;
}

/** Extract min base height (ft) from zoning resolution height data */
function extractMinBaseHeightFt(height: { min_base_height?: { kind?: string; value_ft?: number; candidates?: { value_ft: number }[] } } | null | undefined): number | null {
	if (!height?.min_base_height) return null;
	const h = height.min_base_height;
	if (h.kind === "fixed" && h.value_ft != null) return h.value_ft;
	if (h.kind === "conditional" && h.candidates?.length) {
		const values = h.candidates.map((c) => c.value_ft).filter((v) => v != null);
		return values.length > 0 ? Math.min(...values) : null;
	}
	return null;
}

/** Extract max base height (ft) from zoning resolution envelope */
function extractMaxBaseHeightFt(height: { envelope?: { candidates?: { max_base_height_ft?: number }[] } } | null | undefined): number | null {
	const candidate = height?.envelope?.candidates?.[0];
	return candidate?.max_base_height_ft ?? null;
}

/** Extract max building height (ft) from zoning resolution envelope */
function extractMaxBuildingHeightFt(height: { envelope?: { candidates?: { max_building_height_ft?: number }[] } } | null | undefined): number | null {
	const candidate = height?.envelope?.candidates?.[0];
	return candidate?.max_building_height_ft ?? null;
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

	return (
		<ReportViewContent
			reportData={reportData}
			reportId={reportId}
			isPublic={false}
		/>
	);
}

export function ReportViewContent({
	reportData,
	reportId,
	isPublic = false,
}: {
	reportData: ReportWithSources;
	reportId: string;
	isPublic?: boolean;
}) {
	const router = useRouter();
	const [showDebugMode, setShowDebugMode] = useState(false);
	const [densityCandidateId, setDensityCandidateId] = useState("duf_applies");
	const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
	const femaMapRef = useRef<FemaFloodMapHandle>(null);
	const transitMapRef = useRef<TransitZoneMapHandle>(null);

	useEffect(() => {
		setDensityCandidateId("duf_applies");
	}, [reportData?.report.IdReport]);

	const sectionIds = [
		"property-location",
		"property-level-information",
		"lot-details",
		"zoning-classification",
		"zoning-constraints-height",
		"property-massing-3d",
		"zoning-constraints",
		"fema-flood-map",
		"transit-zone-map",
		"neighborhood-information",
	];
	useEffect(() => {
		if (showDebugMode) return;
		const updateActive = () => {
			const tops = sectionIds
				.map((id) => {
					const el = document.getElementById(id);
					if (!el) return { id, top: Infinity, bottom: -Infinity };
					const rect = el.getBoundingClientRect();
					return { id, top: rect.top, bottom: rect.bottom };
				})
				.filter((x) => Number.isFinite(x.top));
			if (tops.length === 0) return;
			const headerOffset = 100;
			const activeZone = tops.filter((x) => x.top >= headerOffset && x.top <= headerOffset + 200);
			let active: (typeof tops)[0] | null = null;
			if (activeZone.length > 0) {
				active = activeZone.sort((a, b) => Math.abs(a.top - headerOffset) - Math.abs(b.top - headerOffset))[0];
			} else {
				const aboveOrJustEntered = tops.filter((x) => x.top <= headerOffset + 50);
				if (aboveOrJustEntered.length > 0) {
					active = aboveOrJustEntered.sort((a, b) => b.top - a.top)[0];
				} else {
					const visible = tops.filter((x) => x.top < window.innerHeight && x.bottom > 0);
					if (visible.length > 0) active = visible.sort((a, b) => a.top - b.top)[0];
				}
			}
			if (active) setActiveSectionId(active.id);
		};
		let scrollTimeout: NodeJS.Timeout | null = null;
		const handleScroll = () => {
			if (scrollTimeout) return;
			scrollTimeout = setTimeout(() => {
				updateActive();
				scrollTimeout = null;
			}, 50);
		};
		const io = new IntersectionObserver(() => updateActive(), { rootMargin: "-100px 0px -50% 0px", threshold: 0 });
		for (const id of sectionIds) {
			const el = document.getElementById(id);
			if (el) io.observe(el);
		}
		updateActive();
		window.addEventListener("scroll", handleScroll, { passive: true });
		return () => {
			io.disconnect();
			window.removeEventListener("scroll", handleScroll);
			if (scrollTimeout) clearTimeout(scrollTimeout);
		};
	}, [showDebugMode]);

	const handleTocClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
		e.preventDefault();
		setActiveSectionId(id);
		document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
	};

	const { report, client, sources } = reportData;

	// Extract formatted data from sources for pretty view
	const getFormattedData = () => {
		const geoserviceSource = sources.find(
			(s) => s.SourceKey === "geoservice"
		);
		const zolaSource = sources.find((s) => s.SourceKey === "zola");
		const zoningSource = sources.find(
			(s) => s.SourceKey === "zoning_resolution"
		);

		// Handle different possible structures
		const geoserviceData =
			geoserviceSource?.ContentJson?.extracted ||
			geoserviceSource?.ContentJson ||
			{};
		const zolaData =
			zolaSource?.ContentJson?.contentJson ||
			zolaSource?.ContentJson ||
			{};
		// ZoningResolutionAgent returns { contentJson: result, sourceUrl: null }
		// So we need to access ContentJson.contentJson to get the actual data
		const zoningData =
			zoningSource?.ContentJson?.contentJson ||
			zoningSource?.ContentJson ||
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
			// Zoning Resolution data
			zoningResolution: zoningData,
		};
	};

	const formattedData = getFormattedData();

	const handleShare = () => {
		const url = `${typeof window !== "undefined" ? window.location.origin : ""}/viewreportpublic/${reportId}`;
		navigator.clipboard.writeText(url).then(
			() => toast.success("Link copied to clipboard"),
			() => toast.error("Could not copy link")
		);
	};

	const handleDownloadPdf = async () => {
		// Capture FEMA and Transit Zone maps via ArcGIS takeScreenshot for print
		try {
			const [femaDataUrl, transitDataUrl] = await Promise.all([
				femaMapRef.current?.takeScreenshot() ?? Promise.resolve(null),
				transitMapRef.current?.takeScreenshot() ?? Promise.resolve(null),
			]);
			const femaImg = document.getElementById("fema-flood-map-print-image") as HTMLImageElement | null;
			const transitImg = document.getElementById("transit-zone-map-print-image") as HTMLImageElement | null;
			if (femaDataUrl && femaImg) femaImg.src = femaDataUrl;
			if (transitDataUrl && transitImg) transitImg.src = transitDataUrl;
		} catch (err) {
			console.error("Failed to capture maps for PDF:", err);
		}
		// Set document title to address so Save As PDF suggests the address as filename
		const previousTitle = document.title;
		const addressTitle = (report.Address || "Report").replace(/[\\/:*?"<>|]/g, " ").trim() || "Report";
		document.title = addressTitle;
		const onAfterPrint = () => {
			document.title = previousTitle;
			window.removeEventListener("afterprint", onAfterPrint);
		};
		window.addEventListener("afterprint", onAfterPrint);
		setTimeout(() => window.print(), 150);
	};

	const reportSections = [
		{ id: "property-location", label: "Property Location" },
		{ id: "property-level-information", label: "Property Level Information" },
		{ id: "lot-details", label: "Lot Details" },
		{ id: "zoning-classification", label: "Zoning Classification" },
		{ id: "zoning-constraints-height", label: "Zoning Constraints (Height)" },
		{ id: "property-massing-3d", label: "3D Massing" },
		{ id: "zoning-constraints", label: "Zoning Constraints" },
		{ id: "fema-flood-map", label: "FEMA Flood Map" },
		{ id: "transit-zone-map", label: "Transit Zone Map" },
		{ id: "neighborhood-information", label: "Neighborhood Information" },
	];

	return (
		<div className="p-8 bg-[#F7F5F3] min-h-screen" data-report-print-root>
			<div className="max-w-6xl mx-auto flex gap-10">
				{/* Main report content */}
				<main className="flex-1 min-w-0 max-w-4xl">
				{/* Top Navigation Bar */}
				<div className="flex items-center justify-between mb-6 print-hide-top-bar">
					<Button
						variant="ghost"
						onClick={() => router.push(isPublic ? "/" : "/reports")}
					>
						<ArrowLeft className="size-4 mr-2" />
						{isPublic ? "Back" : "Back to Your Reports"}
					</Button>
					{!isPublic && (
						<div className="flex items-center gap-2">
							<Button variant="outline" size="sm" onClick={handleShare} className="gap-1.5">
								<Share2 className="size-4" />
								Share
							</Button>
							<Button variant="outline" size="sm" onClick={handleDownloadPdf} className="gap-1.5">
								<FileDown className="size-4" />
								Download as PDF
							</Button>
						</div>
					)}
				</div>

				{/* Report Header */}
				<div className="mb-6">
					<h1 className="text-3xl font-semibold text-[#37322F] mb-3">
						{report.Name}
					</h1>
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<Badge className="bg-green-100 text-green-700 border-green-200">
								Report Generated:{" "}
								{format(new Date(report.CreatedAt), "M/d/yyyy")}
							</Badge>
							{reportData?.creator && (
								<Badge className="bg-blue-100 text-blue-700 border-blue-200">
									Created by: {reportData.creator.Name}
								</Badge>
							)}
						</div>
						{process.env.NODE_ENV !== "production" && (
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
						)}
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
							<Card id="property-location" className="mb-6 scroll-mt-8">
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

						<Card id="property-level-information" className="mb-6 scroll-mt-8">
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
													{getLandUseDescriptionText(
														formattedData.landUse
													)}
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
						<Card id="lot-details" className="mb-6 scroll-mt-8">
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
						<Card id="zoning-classification" className="mb-6 scroll-mt-8">
							<CardContent className="pt-6">
								<div className="mb-4">
									<div className="flex items-center gap-2 mb-1">
										<LandPlot className="size-5 text-[#4090C2]" />
										<h3 className="text-lg font-semibold text-[#37322F]">
											Zoning Classification
										</h3>
									</div>
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
									{formattedData.zoningResolution?.parking?.transit_zone && (
										<div>
											<p className="text-sm text-[#605A57] mb-2">
												Transit Zone
											</p>
											<Badge className="bg-blue-100 text-blue-700 border-blue-200">
												{formattedData.zoningResolution.parking.transit_zone ===
												"inner"
													? "Inner Transit Zone"
													: formattedData.zoningResolution.parking.transit_zone ===
													  "outer"
													? "Outer Transit Zone"
													: formattedData.zoningResolution.parking.transit_zone ===
													  "manhattan_core_lic"
													? "Manhattan Core & LIC"
													: formattedData.zoningResolution.parking.transit_zone ===
													  "beyond_gtz"
													? "Beyond Greater Transit Zone"
													: "Unknown"}
											</Badge>
										</div>
									)}
								</div>
							</CardContent>
						</Card>

						{/* Zoning Constraints (Height) */}
						{formattedData.zoningResolution?.height && (
							<Card id="zoning-constraints-height" className="mb-6 scroll-mt-8">
								<CardContent className="pt-6">
									<div className="mb-4">
										<div className="flex items-center gap-2 mb-1">
											<Ruler className="size-5 text-[#4090C2]" />
											<h3 className="text-lg font-semibold text-[#37322F]">
												Zoning Constraints (Height)
											</h3>
										</div>
										<p className="text-sm text-[#605A57]">
											Height regulations and constraints
										</p>
									</div>
									<div className="grid grid-cols-3 gap-4">
										{/* Minimum Base Height */}
										{formattedData.zoningResolution.height
											.min_base_height && (
											<div>
												<p className="text-sm text-[#605A57] mb-2">
													Minimum Base Height
												</p>
												{formattedData.zoningResolution
													.height.min_base_height
													.kind === "fixed" &&
												formattedData.zoningResolution
													.height.min_base_height
													.value_ft != null ? (
													<>
														<p className="text-[#37322F] font-medium text-lg">
															{
																formattedData
																	.zoningResolution
																	.height
																	.min_base_height
																	.value_ft
															}{" "}
															ft
														</p>
														{formattedData
															.zoningResolution
															.height
															.min_base_height
															.source_url && (
															<a
																href={
																	formattedData
																		.zoningResolution
																		.height
																		.min_base_height
																		.source_url
																}
																target="_blank"
																rel="noopener noreferrer"
																className="flex items-center gap-1 text-xs text-[#4090C2] hover:underline mt-1"
															>
																{formattedData
																	.zoningResolution
																	.height
																	.min_base_height
																	.source_section || "See citation"}
																<ExternalLink className="size-3" />
															</a>
														)}
														{!formattedData
															.zoningResolution
															.height
															.min_base_height
															.source_url &&
														formattedData
															.zoningResolution
															.height
															.min_base_height
															.source_section && (
															<p className="text-xs text-[#605A57] mt-1">
																{
																	formattedData
																		.zoningResolution
																		.height
																		.min_base_height
																		.source_section
																}
															</p>
														)}
													</>
												) : formattedData
														.zoningResolution.height
														.min_base_height
														.kind ===
														"conditional" &&
												  formattedData.zoningResolution
														.height.min_base_height
														.candidates ? (
													<div>
														<p className="text-[#37322F] font-medium text-lg">
															{Math.min(
																...formattedData.zoningResolution.height.min_base_height.candidates.map(
																	(c: any) =>
																		c.value_ft
																)
															)}
															{" - "}
															{Math.max(
																...formattedData.zoningResolution.height.min_base_height.candidates.map(
																	(c: any) =>
																		c.value_ft
																)
															)}{" "}
															ft
														</p>
														<Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 mt-1">
															Conditional
														</Badge>
														{formattedData
															.zoningResolution
															.height
															.min_base_height
															.source_url && (
															<a
																href={
																	formattedData
																		.zoningResolution
																		.height
																		.min_base_height
																		.source_url
																}
																target="_blank"
																rel="noopener noreferrer"
																className="flex items-center gap-1 text-xs text-[#4090C2] hover:underline mt-2"
															>
																See citation
																<ExternalLink className="size-3" />
															</a>
														)}
														{formattedData
															.zoningResolution
															.height
															.min_base_height
															.source_section && (
															<p className="text-xs text-[#605A57] mt-1">
																{
																	formattedData
																		.zoningResolution
																		.height
																		.min_base_height
																		.source_section
																}
															</p>
														)}
													</div>
												) : formattedData
														.zoningResolution.height
														.min_base_height
														.kind ===
												  "see_section" ? (
													<div>
														<p className="text-[#37322F] font-medium text-sm">
															See Section
														</p>
														{formattedData
															.zoningResolution
															.height
															.min_base_height
															.source_url && (
															<a
																href={
																	formattedData
																		.zoningResolution
																		.height
																		.min_base_height
																		.source_url
																}
																target="_blank"
																rel="noopener noreferrer"
																className="text-xs text-[#4090C2] hover:underline mt-1 block"
															>
																{
																	formattedData
																		.zoningResolution
																		.height
																		.min_base_height
																		.source_section
																}
															</a>
														)}
													</div>
												) : (
													<p className="text-sm text-[#605A57]">
														Not available
													</p>
												)}
											</div>
										)}

										{/* Maximum Base Height */}
										{formattedData.zoningResolution.height
											.envelope &&
											formattedData.zoningResolution
												.height.envelope.candidates &&
											formattedData.zoningResolution
												.height.envelope.candidates
												.length > 0 && (
												<div>
													<p className="text-sm text-[#605A57] mb-2">
														Maximum Base Height
													</p>
													{formattedData
														.zoningResolution.height
														.envelope.kind ===
													"fixed" ? (
														<>
															<p className="text-[#37322F] font-medium text-lg">
																{
																	formattedData
																		.zoningResolution
																		.height
																		.envelope
																		.candidates[0]
																		.max_base_height_ft
																}{" "}
																ft
															</p>
															{formattedData
																.zoningResolution
																.height.envelope
																.candidates[0]
																.source_url && (
																<a
																	href={
																		formattedData
																			.zoningResolution
																			.height
																			.envelope
																			.candidates[0]
																			.source_url
																	}
																	target="_blank"
																	rel="noopener noreferrer"
																	className="flex items-center gap-1 text-xs text-[#4090C2] hover:underline mt-1"
																>
																	{formattedData
																		.zoningResolution
																		.height
																		.envelope
																		.candidates[0]
																		.source_section || "See citation"}
																	<ExternalLink className="size-3" />
																</a>
															)}
															{!formattedData
																.zoningResolution
																.height.envelope
																.candidates[0]
																.source_url &&
															formattedData
																.zoningResolution
																.height.envelope
																.candidates[0]
																.source_section && (
																<p className="text-xs text-[#605A57] mt-1">
																	{
																		formattedData
																			.zoningResolution
																			.height
																			.envelope
																			.candidates[0]
																			.source_section
																	}
																</p>
															)}
														</>
													) : formattedData
															.zoningResolution
															.height.envelope
															.kind ===
													  "conditional" ? (
														<div>
															<p className="text-[#37322F] font-medium text-lg">
																{Math.min(
																	...formattedData.zoningResolution.height.envelope.candidates.map(
																		(
																			c: any
																		) =>
																			c.max_base_height_ft
																	)
																)}
																{" - "}
																{Math.max(
																	...formattedData.zoningResolution.height.envelope.candidates.map(
																		(
																			c: any
																		) =>
																			c.max_base_height_ft
																	)
																)}{" "}
																ft
															</p>
															<Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 mt-1">
																Conditional
															</Badge>
															{formattedData
																.zoningResolution
																.height.envelope
																.candidates[0]
																.source_url && (
																<a
																	href={
																		formattedData
																			.zoningResolution
																			.height
																			.envelope
																			.candidates[0]
																			.source_url
																	}
																	target="_blank"
																	rel="noopener noreferrer"
																	className="flex items-center gap-1 text-xs text-[#4090C2] hover:underline mt-2"
																>
																	See citation
																	<ExternalLink className="size-3" />
																</a>
															)}
															{formattedData
																.zoningResolution
																.height.envelope
																.candidates[0]
																.source_section && (
																<p className="text-xs text-[#605A57] mt-1">
																	{
																		formattedData
																			.zoningResolution
																			.height
																			.envelope
																			.candidates[0]
																			.source_section
																	}
																</p>
															)}
														</div>
													) : (
														<p className="text-sm text-[#605A57]">
															Not available
														</p>
													)}
												</div>
											)}

										{/* Maximum Building Height */}
										{formattedData.zoningResolution.height
											.envelope &&
											formattedData.zoningResolution
												.height.envelope.candidates &&
											formattedData.zoningResolution
												.height.envelope.candidates
												.length > 0 && (
												<div>
													<p className="text-sm text-[#605A57] mb-2">
														Maximum Building Height
													</p>
													{formattedData
														.zoningResolution.height
														.envelope.kind ===
													"fixed" ? (
														<>
															<p className="text-[#37322F] font-medium text-lg">
																{
																	formattedData
																		.zoningResolution
																		.height
																		.envelope
																		.candidates[0]
																		.max_building_height_ft
																}{" "}
																ft
															</p>
															{formattedData
																.zoningResolution
																.height.envelope
																.candidates[0]
																.source_url && (
																<a
																	href={
																		formattedData
																			.zoningResolution
																			.height
																			.envelope
																			.candidates[0]
																			.source_url
																	}
																	target="_blank"
																	rel="noopener noreferrer"
																	className="flex items-center gap-1 text-xs text-[#4090C2] hover:underline mt-1"
																>
																	{formattedData
																		.zoningResolution
																		.height
																		.envelope
																		.candidates[0]
																		.source_section || "See citation"}
																	<ExternalLink className="size-3" />
																</a>
															)}
															{!formattedData
																.zoningResolution
																.height.envelope
																.candidates[0]
																.source_url &&
															formattedData
																.zoningResolution
																.height.envelope
																.candidates[0]
																.source_section && (
																<p className="text-xs text-[#605A57] mt-1">
																	{
																		formattedData
																			.zoningResolution
																			.height
																			.envelope
																			.candidates[0]
																			.source_section
																	}
																</p>
															)}
														</>
													) : formattedData
															.zoningResolution
															.height.envelope
															.kind ===
													  "conditional" ? (
														<div>
															<p className="text-[#37322F] font-medium text-lg">
																{Math.min(
																	...formattedData.zoningResolution.height.envelope.candidates.map(
																		(
																			c: any
																		) =>
																			c.max_building_height_ft
																	)
																)}
																{" - "}
																{Math.max(
																	...formattedData.zoningResolution.height.envelope.candidates.map(
																		(
																			c: any
																		) =>
																			c.max_building_height_ft
																	)
																)}{" "}
																ft
															</p>
															<Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 mt-1">
																Conditional
															</Badge>
															{formattedData
																.zoningResolution
																.height.envelope
																.candidates[0]
																.source_url && (
																<a
																	href={
																		formattedData
																			.zoningResolution
																			.height
																			.envelope
																			.candidates[0]
																			.source_url
																	}
																	target="_blank"
																	rel="noopener noreferrer"
																	className="flex items-center gap-1 text-xs text-[#4090C2] hover:underline mt-2"
																>
																	See citation
																	<ExternalLink className="size-3" />
																</a>
															)}
															{formattedData
																.zoningResolution
																.height.envelope
																.candidates[0]
																.source_section && (
																<p className="text-xs text-[#605A57] mt-1">
																	{
																		formattedData
																			.zoningResolution
																			.height
																			.envelope
																			.candidates[0]
																			.source_section
																	}
																</p>
															)}
														</div>
													) : (
														<p className="text-sm text-[#605A57]">
															Not available
														</p>
													)}
												</div>
											)}
									</div>
								</CardContent>
							</Card>
						)}

						{/* 3D Massing Visualization — inputs below 3D, Save persists to report; no report-derived defaults */}
						{report?.IdReport && report?.ReportType !== "assemblage" && (
							<ReportMassingSection
								reportId={report.IdReport}
								readOnly={isPublic}
								initialMassingOverrides={
									isPublic ? (reportData as { massingOverrides?: MassingOverrides | null }).massingOverrides : undefined
								}
							/>
						)}

						{/* Zoning Constraints Section */}
						{formattedData.zoningResolution &&
							formattedData.zoningResolution.maxFar != null && (
								<Card id="zoning-constraints" className="mb-6 scroll-mt-8">
									<CardContent className="pt-6">
										<div className="mb-4">
											<div className="flex items-center gap-2 mb-1">
												<MapPinCheck className="size-5 text-[#4090C2]" />
												<h3 className="text-lg font-semibold text-[#37322F]">
													Zoning Constraints
												</h3>
											</div>
											<p className="text-sm text-[#605A57]">
												Maximum FAR and lot coverage
												calculations
											</p>
										</div>
										<div className="space-y-4">
											{/* Max FAR */}
											{formattedData.zoningResolution
												.maxFar != null && (
												<div>
													<p className="text-sm text-[#605A57] mb-2">
														Maximum Floor Area Ratio
														(FAR)
													</p>
													<p className="text-[#37322F] font-medium text-lg">
														{
															formattedData
																.zoningResolution
																.maxFar
														}
													</p>
													{formattedData
														.zoningResolution
														.district && (
														<p className="text-xs text-[#605A57] mt-1">
															District:{" "}
															{
																formattedData
																	.zoningResolution
																	.district
															}
															{formattedData
																.zoningResolution
																.contextual && (
																<span className="ml-2">
																	(Contextual)
																</span>
															)}
														</p>
													)}
													{/* FAR assumptions & citations */}
													<div className="mt-3 pt-3 border-t border-[rgba(55,50,47,0.08)]">
														<p className="text-xs text-[#605A57] mb-2">
															We use standard FAR per NYC Zoning Resolution. Higher FAR may apply for qualifying residential sites, qualifying affordable or senior housing, or lots within 100 ft of a wide street. For lots with multiple zoning districts we use the lowest applicable FAR; manual review recommended.
														</p>
														<div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
															<a href="https://zr.planning.nyc.gov/index.php/article-ii/chapter-3/23-20" target="_blank" rel="noopener noreferrer" className="text-[#4090C2] hover:underline">See Citation [ZR § 23-20]</a>
															<a href="https://zr.planning.nyc.gov/index.php/article-ii/chapter-3/23-21" target="_blank" rel="noopener noreferrer" className="text-[#4090C2] hover:underline">See Citation [ZR § 23-21]</a>
															<a href="https://zr.planning.nyc.gov/index.php/article-ii/chapter-3/23-22" target="_blank" rel="noopener noreferrer" className="text-[#4090C2] hover:underline">See Citation [ZR § 23-22]</a>
															<a href="https://zr.planning.nyc.gov/index.php/article-ii/chapter-3/23-23" target="_blank" rel="noopener noreferrer" className="text-[#4090C2] hover:underline">See Citation [ZR § 23-23]</a>
														</div>
														{formattedData.zoningResolution.refuseExemptionMaxSqft != null && formattedData.zoningResolution.refuseExemptionMaxSqft > 0 && (
															<p className="text-xs text-[#605A57] mt-2">
																Potential exemption (refuse): up to {formattedData.zoningResolution.refuseExemptionMaxSqft.toLocaleString()} sq ft{" "}
																<a href="https://zr.planning.nyc.gov/index.php/article-ii/chapter-3/23-233" target="_blank" rel="noopener noreferrer" className="text-[#4090C2] hover:underline">See Citation [ZR § 23-233]</a>
															</p>
														)}
													</div>
												</div>
											)}

											{/* Max Lot Coverage */}
											{formattedData.zoningResolution
												.maxLotCoverage != null && (
												<div>
													<p className="text-sm text-[#605A57] mb-2">
														Maximum Lot Coverage
													</p>
													<p className="text-[#37322F] font-medium text-lg">
														{(
															formattedData
																.zoningResolution
																.maxLotCoverage *
															100
														).toFixed(0)}
														%
													</p>
													<div className="flex items-center gap-4 mt-2">
														{/* Lot Type badge only when corner_code (Geoservice) was used; hide when inferred */}
														{!formattedData.zoningResolution.flags?.lotTypeInferred && (
															<div>
																<p className="text-xs text-[#605A57] mb-1">
																	Lot Type
																</p>
																<Badge className="bg-gray-100 text-gray-700 border-gray-200">
																	{formattedData.zoningResolution.lotType
																		?.replace(
																			/_/g,
																			" "
																		)
																		.replace(
																			/\b\w/g,
																			(
																				l: string
																			) =>
																				l.toUpperCase()
																		) ||
																		"Unknown"}
																</Badge>
															</div>
														)}
														<div>
															<p className="text-xs text-[#605A57] mb-1">
																Building Type
															</p>
															<Badge className="bg-gray-100 text-gray-700 border-gray-200">
																{formattedData.zoningResolution.buildingType
																	?.replace(
																		/_/g,
																		" "
																	)
																	.replace(
																		/\b\w/g,
																		(
																			l: string
																		) =>
																			l.toUpperCase()
																	) ||
																	"Unknown"}
															</Badge>
														</div>
													</div>
												</div>
											)}

											{/* Height Constraints removed - moved to separate section */}

											{/* Derived Calculations */}
											{formattedData.zoningResolution
												.derived && (
												<div className="pt-4 border-t border-[rgba(55,50,47,0.12)]">
													<p className="text-sm font-semibold text-[#37322F] mb-1">
														Derived Calculations
													</p>
													<p className="text-xs text-[#605A57] mb-3">
														Remaining buildable is based on FAR (floor area). Max lot coverage above limits footprint separately.
													</p>
													<div className="grid grid-cols-2 gap-4">
														{formattedData
															.zoningResolution
															.derived
															.maxBuildableFloorAreaSqft !==
															undefined && (
															<div>
																<p className="text-sm text-[#605A57] mb-1">
																	Max
																	Buildable
																	Floor Area
																</p>
																<p className="text-[#37322F] font-medium">
																	{formattedData.zoningResolution.derived.maxBuildableFloorAreaSqft.toLocaleString()}{" "}
																	sq ft
																</p>
															</div>
														)}
														{formattedData
															.zoningResolution
															.derived
															.remainingBuildableFloorAreaSqft !==
															undefined && (
															<div>
																<p className="text-sm text-[#605A57] mb-1">
																	Remaining
																	Buildable
																	Floor Area
																</p>
																<p className="text-[#37322F] font-medium">
																	{formattedData.zoningResolution.derived.remainingBuildableFloorAreaSqft.toLocaleString()}{" "}
																	sq ft
																	{formattedData
																		.zoningResolution
																		.derived
																		.remainingFloorAreaMessage && (
																		<span className="text-xs text-yellow-700 ml-2">
																			(
																			{
																				formattedData
																					.zoningResolution
																					.derived
																					.remainingFloorAreaMessage
																			}
																			)
																		</span>
																	)}
																</p>
															</div>
														)}
														{formattedData
															.zoningResolution
															.derived
															.maxBuildingFootprintSqft !==
															undefined && (
															<div>
																<p className="text-sm text-[#605A57] mb-1">
																	Max Building
																	Footprint
																</p>
																<p className="text-[#37322F] font-medium">
																	{formattedData.zoningResolution.derived.maxBuildingFootprintSqft.toLocaleString()}{" "}
																	sq ft
																</p>
															</div>
														)}
													</div>
												</div>
											)}

											{/* Assumptions */}
											{formattedData.zoningResolution
												.assumptions &&
												formattedData.zoningResolution
													.assumptions.length > 0 && (
													<div className="pt-4 border-t border-[rgba(55,50,47,0.12)]">
														<p className="text-sm font-semibold text-[#37322F] mb-2">
															Assumptions
														</p>
														<ul className="list-disc list-inside space-y-1">
															{formattedData.zoningResolution.assumptions.map(
																(
																	assumption: string,
																	index: number
																) => (
																	<li
																		key={
																			index
																		}
																		className="text-sm text-[#605A57]"
																	>
																		{
																			assumption
																		}
																	</li>
																)
															)}
														</ul>
													</div>
												)}

											{/* Flags */}
											{formattedData.zoningResolution
												.flags && (
												<div className="pt-4 border-t border-[rgba(55,50,47,0.12)]">
													<p className="text-sm font-semibold text-[#37322F] mb-2">
														Flags
													</p>
													<div className="flex flex-wrap gap-2">
														{formattedData
															.zoningResolution
															.flags
															.hasOverlay && (
															<Badge className="bg-purple-100 text-purple-700 border-purple-200">
																Has Overlay
															</Badge>
														)}
														{formattedData
															.zoningResolution
															.flags
															.hasSpecialDistrict && (
															<Badge className="bg-orange-100 text-orange-700 border-orange-200">
																Has Special
																District
															</Badge>
														)}
														{formattedData
															.zoningResolution
															.flags
															.multiDistrictLot && (
															<Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">
																Multi-District
																Lot
															</Badge>
														)}
														{formattedData
															.zoningResolution
															.flags
															.lotTypeInferred && (
															<Badge className="bg-gray-100 text-gray-700 border-gray-200">
																Lot Type
																Inferred
															</Badge>
														)}
														{formattedData
															.zoningResolution
															.flags
															.buildingTypeInferred && (
															<Badge className="bg-gray-100 text-gray-700 border-gray-200">
																Building Type
																Inferred
															</Badge>
														)}
													</div>
												</div>
											)}

											{/* Density Requirements */}
											{formattedData.zoningResolution
												?.density &&
												formattedData.zoningResolution.density
													.candidates &&
												formattedData.zoningResolution.density
													.candidates.length > 0 && (
												<div className="pt-4 border-t border-[rgba(55,50,47,0.12)]">
													<div className="mb-3">
														<p className="text-sm font-semibold text-[#37322F]">
															Density Requirements
														</p>
													</div>
													<div className="mb-3">
														<div className="flex items-center gap-2 mb-2">
															<Label
																htmlFor="density-toggle"
																className="text-sm text-[#605A57] cursor-pointer"
															>
																{
																	formattedData.zoningResolution
																		.density.candidates.find(
																			(c: any) =>
																				c.id ===
																				densityCandidateId
																		)?.label ||
																	"Standard (DUF applies)"
																}
															</Label>
															<Switch
																id="density-toggle"
																checked={
																	densityCandidateId ===
																	"duf_not_applicable"
																}
																onCheckedChange={(checked) => {
																	setDensityCandidateId(
																		checked
																			? "duf_not_applicable"
																			: "duf_applies"
																	);
																}}
																className="data-[state=checked]:bg-blue-600"
															/>
														</div>
														<p className="text-xs text-[#605A57] italic">
															Toggle between DUF-applicable and
															DUF-not-applicable scenarios
														</p>
													</div>
													{(() => {
														const selectedCandidate =
															formattedData.zoningResolution.density.candidates.find(
																(c: any) =>
																	c.id === densityCandidateId
															) ||
															formattedData.zoningResolution.density
																.candidates[0];
														return (
															<div className="space-y-3">
																{selectedCandidate
																	.max_dwelling_units !==
																	null ? (
																	<div>
																		<p className="text-sm text-[#605A57] mb-2">
																			Maximum Dwelling Units
																		</p>
																		<p className="text-[#37322F] font-medium text-lg">
																			{
																				selectedCandidate.max_dwelling_units
																			}{" "}
																			units
																		</p>
																		{selectedCandidate
																			.max_res_floor_area_sqft && (
																			<p className="text-xs text-[#605A57] mt-1">
																				Based on max residential floor
																				area:{" "}
																				{selectedCandidate.max_res_floor_area_sqft.toLocaleString()}{" "}
																				sq ft
																			</p>
																		)}
																		{selectedCandidate.duf_value && (
																			<p className="text-xs text-[#605A57] mt-1">
																				DUF: {selectedCandidate.duf_value}
																				{" • "}
																				{
																					selectedCandidate.rounding_rule
																				}
																			</p>
																		)}
																	</div>
																) : (
																	<div>
																		<p className="text-sm text-[#605A57] mb-2">
																			Maximum Dwelling Units
																		</p>
																		<p className="text-[#37322F] font-medium text-sm">
																			Not determined by DUF
																		</p>
																		{selectedCandidate.notes && (
																			<p className="text-xs text-[#605A57] mt-2">
																				{selectedCandidate.notes}
																			</p>
																		)}
																	</div>
																)}
																{selectedCandidate.notes &&
																	selectedCandidate
																		.max_dwelling_units !==
																		null && (
																		<p className="text-xs text-[#605A57]">
																			{selectedCandidate.notes}
																		</p>
																	)}
																{selectedCandidate.source_section && (
																	<div className="flex items-center gap-2">
																		<p className="text-xs text-[#605A57] mt-1">
																			{selectedCandidate.source_section}
																		</p>
																		{selectedCandidate.source_url && (
																			<a
																				href={
																					selectedCandidate.source_url
																				}
																				target="_blank"
																				rel="noopener noreferrer"
																				className="flex items-center gap-1 text-xs text-[#4090C2] hover:underline"
																			>
																				See citation
																				<ExternalLink className="size-3" />
																			</a>
																		)}
																	</div>
																)}
																{selectedCandidate.requires_manual_review && (
																	<Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 mt-2">
																		Requires Manual Review
																	</Badge>
																)}
															</div>
														);
													})()}
												</div>
											)}

											{/* Parking Requirements */}
											{formattedData.zoningResolution
												?.parking &&
												formattedData.zoningResolution.parking.kind !==
													"not_applicable" &&
												formattedData.zoningResolution.parking.kind !==
													"unsupported" &&
												formattedData.zoningResolution.parking.regimes &&
												formattedData.zoningResolution.parking.regimes.length >
													0 && (
												<div className="pt-4 border-t border-[rgba(55,50,47,0.12)]">
													<div className="mb-3">
														<p className="text-sm font-semibold text-[#37322F]">
															Parking Requirements
														</p>
														{formattedData.zoningResolution.parking
															.transit_zone && (
															<p className="text-xs text-[#605A57] mt-1">
																Transit Zone:{" "}
																{formattedData.zoningResolution.parking.transit_zone ===
																"inner"
																	? "Inner Transit Zone"
																	: formattedData.zoningResolution.parking.transit_zone ===
																	  "outer"
																	? "Outer Transit Zone"
																	: formattedData.zoningResolution.parking.transit_zone ===
																	  "manhattan_core_lic"
																	? "Manhattan Core & LIC"
																	: formattedData.zoningResolution.parking.transit_zone ===
																	  "beyond_gtz"
																	? "Beyond Greater Transit Zone"
																	: "Unknown"}
															</p>
														)}
													</div>

													<div className="space-y-4">
														{formattedData.zoningResolution.parking.regimes.map(
															(
																regime: any,
																regimeIndex: number
															) => (
																<div
																	key={regimeIndex}
																	className="border border-[rgba(55,50,47,0.12)] rounded-md p-3"
																>
																	<div className="mb-2">
																		<p className="text-sm font-medium text-[#37322F]">
																			{regime.regime_key ===
																			"existing_inner_transit_25_21"
																				? "Regime 25-21 (Inner Transit Zone)"
																				: regime.regime_key ===
																				  "outer_transit_25_22"
																				? "Regime 25-22 (Outer Transit Zone)"
																				: regime.regime_key ===
																				  "beyond_gtz_25_23"
																				? "Regime 25-23 (Beyond GTZ)"
																				: regime.regime_key}
																		</p>
																		{regime.source_section && (
																			<div className="flex items-center gap-2 mt-1">
																				<p className="text-xs text-[#605A57]">
																					{regime.source_section}
																				</p>
																				{regime.source_url && (
																					<a
																						href={regime.source_url}
																						target="_blank"
																						rel="noopener noreferrer"
																						className="flex items-center gap-1 text-xs text-[#4090C2] hover:underline"
																					>
																						See citation
																						<ExternalLink className="size-3" />
																					</a>
																				)}
																			</div>
																		)}
																	</div>

																	<div className="space-y-3">
																		{regime.scenarios.map(
																			(
																				scenario: any,
																				scenarioIndex: number
																			) => (
																				<div
																					key={scenarioIndex}
																					className="bg-[rgba(55,50,47,0.03)] rounded p-2"
																				>
																					<p className="text-xs font-medium text-[#37322F] mb-2 capitalize">
																						{scenario.scenario_key.replace(
																							/_/g,
																							" "
																						)}
																					</p>
																					{scenario.computed
																						.required_spaces_after_waiver !==
																						undefined && (
																						<div className="space-y-1">
																							<div className="flex items-baseline gap-2">
																								<p className="text-sm text-[#605A57]">
																									Required Spaces:
																								</p>
																								<p className="text-[#37322F] font-medium text-lg">
																									{
																										scenario.computed
																											.required_spaces_after_waiver
																									}
																								</p>
																							</div>
																							<p className="text-xs text-[#605A57]">
																								{scenario.percent_per_dwelling_unit}% per
																								dwelling unit
																								{scenario.waiver_max_spaces > 0 && (
																									<span>
																										{" "}
																										• Waiver max:{" "}
																										{
																											scenario.waiver_max_spaces
																										}{" "}
																										spaces
																									</span>
																								)}
																							</p>
																							{scenario.computed.units && (
																								<p className="text-xs text-[#605A57]">
																									Based on{" "}
																									{
																										scenario.computed.units
																									}{" "}
																									dwelling units
																								</p>
																							)}
																						</div>
																					)}
																					{scenario.notes &&
																						scenario.notes.length > 0 && (
																							<div className="mt-2">
																								{scenario.notes.map(
																									(
																										note: string,
																										noteIndex: number
																									) => (
																										<p
																											key={noteIndex}
																											className="text-xs text-[#605A57] mt-1"
																										>
																											{note}
																										</p>
																									)
																								)}
																							</div>
																						)}
																					{scenario.requires_manual_review && (
																						<Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 mt-2">
																							Requires Manual Review
																						</Badge>
																					)}
																				</div>
																			)
																		)}
																	</div>
																</div>
															)
														)}
													</div>

													{formattedData.zoningResolution.parking.flags
														?.requires_manual_review && (
														<Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 mt-3">
															Overall Manual Review Required
														</Badge>
													)}

													<div className="mt-3">
														<p className="text-xs font-semibold text-[#37322F] mb-1">
															Notes:
														</p>
														{formattedData.zoningResolution.parking
															.assumptions &&
															formattedData.zoningResolution.parking
																.assumptions.length > 0 && (
																<ul className="list-disc list-inside space-y-1 mb-3">
																	{formattedData.zoningResolution.parking.assumptions.map(
																		(
																			assumption: string,
																			index: number
																		) => (
																			<li
																				key={index}
																				className="text-xs text-[#605A57]"
																			>
																				{assumption}
																			</li>
																		)
																	)}
																</ul>
															)}
														<div className="mt-3">
															<p className="text-xs text-[#605A57] mb-2">
																Transit zone map is now displayed above in the main report view.
															</p>
														</div>
													</div>
												</div>
											)}

											{/* Yard Requirements */}
											{formattedData.zoningResolution?.yards && (
												<div className="pt-4 border-t border-[rgba(55,50,47,0.12)]">
													<div className="mb-3">
														<p className="text-sm font-semibold text-[#37322F]">
															Yard Requirements
														</p>
														<p className="text-xs text-[#605A57] mt-1">
															Required front, side, and rear yard dimensions
														</p>
													</div>

													<div className="space-y-4">
														{/* Front Yard */}
														{formattedData.zoningResolution.yards.front &&
															formattedData.zoningResolution.yards.front.kind !==
																"unsupported" && (
																<div className="border border-[rgba(55,50,47,0.12)] rounded-md p-3">
																	<div className="mb-2">
																		<p className="text-sm font-medium text-[#37322F]">
																			Front Yard
																		</p>
																		{formattedData.zoningResolution.yards.front
																			.source_section && (
																			<div className="flex items-center gap-2 mt-1">
																				<p className="text-xs text-[#605A57]">
																					{
																						formattedData.zoningResolution.yards
																							.front.source_section
																					}
																				</p>
																				{formattedData.zoningResolution.yards.front
																					.source_url && (
																					<a
																						href={
																							formattedData.zoningResolution.yards
																								.front.source_url
																						}
																						target="_blank"
																						rel="noopener noreferrer"
																						className="flex items-center gap-1 text-xs text-[#4090C2] hover:underline"
																					>
																						See citation
																						<ExternalLink className="size-3" />
																					</a>
																				)}
																			</div>
																		)}
																	</div>
																	{formattedData.zoningResolution.yards.front
																		.value_ft !== null && (
																		<div className="flex items-baseline gap-2 mb-2">
																			<p className="text-sm text-[#605A57]">
																				Required:
																			</p>
																			<p className="text-[#37322F] font-medium text-lg">
																				{
																					formattedData.zoningResolution.yards.front
																						.value_ft
																				}{" "}
																				ft
																			</p>
																		</div>
																	)}
																	{formattedData.zoningResolution.yards.front
																		.notes &&
																		formattedData.zoningResolution.yards.front.notes
																			.length > 0 && (
																			<div className="mt-2">
																				<p className="text-xs font-semibold text-[#37322F] mb-1">
																					Possible Exceptions:
																				</p>
																				<ul className="list-disc list-inside space-y-1">
																					{formattedData.zoningResolution.yards.front.notes.map(
																						(
																							note: string,
																							noteIndex: number
																						) => (
																							<li
																								key={noteIndex}
																								className="text-xs text-[#605A57]"
																							>
																								{note}
																							</li>
																						)
																					)}
																				</ul>
																			</div>
																		)}
																	{formattedData.zoningResolution.yards.front
																		.requires_manual_review && (
																		<Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 mt-2">
																			Requires Manual Review
																		</Badge>
																	)}
																</div>
															)}

														{/* Side Yard */}
														{formattedData.zoningResolution.yards.side &&
															formattedData.zoningResolution.yards.side.kind !==
																"unsupported" && (
																<div className="border border-[rgba(55,50,47,0.12)] rounded-md p-3">
																	<div className="mb-2">
																		<p className="text-sm font-medium text-[#37322F]">
																			Side Yard
																		</p>
																		{formattedData.zoningResolution.yards.side
																			.source_section && (
																			<div className="flex items-center gap-2 mt-1">
																				<p className="text-xs text-[#605A57]">
																					{
																						formattedData.zoningResolution.yards
																							.side.source_section
																					}
																				</p>
																				{formattedData.zoningResolution.yards.side
																					.source_url && (
																					<a
																						href={
																							formattedData.zoningResolution.yards
																								.side.source_url
																						}
																						target="_blank"
																						rel="noopener noreferrer"
																						className="flex items-center gap-1 text-xs text-[#4090C2] hover:underline"
																					>
																						See citation
																						<ExternalLink className="size-3" />
																					</a>
																				)}
																			</div>
																		)}
																	</div>
																	{formattedData.zoningResolution.yards.side
																		.value_ft !== null && (
																		<div className="flex items-baseline gap-2 mb-2">
																			<p className="text-sm text-[#605A57]">
																				Required:
																			</p>
																			<p className="text-[#37322F] font-medium text-lg">
																				{
																					formattedData.zoningResolution.yards.side
																						.value_ft
																				}{" "}
																				ft
																			</p>
																		</div>
																	)}
																	{formattedData.zoningResolution.yards.side.notes &&
																		formattedData.zoningResolution.yards.side.notes
																			.length > 0 && (
																			<div className="mt-2">
																				<p className="text-xs font-semibold text-[#37322F] mb-1">
																					Possible Exceptions:
																				</p>
																				<ul className="list-disc list-inside space-y-1">
																					{formattedData.zoningResolution.yards.side.notes.map(
																						(
																							note: string,
																							noteIndex: number
																						) => (
																							<li
																								key={noteIndex}
																								className="text-xs text-[#605A57]"
																							>
																								{note}
																							</li>
																						)
																					)}
																				</ul>
																			</div>
																		)}
																	{formattedData.zoningResolution.yards.side
																		.requires_manual_review && (
																		<Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 mt-2">
																			Requires Manual Review
																		</Badge>
																	)}
																</div>
															)}

														{/* Rear Yard */}
														{formattedData.zoningResolution.yards.rear &&
															formattedData.zoningResolution.yards.rear.kind !==
																"unsupported" && (
																<div className="border border-[rgba(55,50,47,0.12)] rounded-md p-3">
																	<div className="mb-2">
																		<p className="text-sm font-medium text-[#37322F]">
																			Rear Yard
																		</p>
																		{formattedData.zoningResolution.yards.rear
																			.source_section && (
																			<div className="flex items-center gap-2 mt-1">
																				<p className="text-xs text-[#605A57]">
																					{
																						formattedData.zoningResolution.yards
																							.rear.source_section
																					}
																				</p>
																				{formattedData.zoningResolution.yards.rear
																					.source_url && (
																					<a
																						href={
																							formattedData.zoningResolution.yards
																								.rear.source_url
																						}
																						target="_blank"
																						rel="noopener noreferrer"
																						className="flex items-center gap-1 text-xs text-[#4090C2] hover:underline"
																					>
																						See citation
																						<ExternalLink className="size-3" />
																					</a>
																				)}
																			</div>
																		)}
																	</div>
																	{formattedData.zoningResolution.yards.rear
																		.value_ft !== null && (
																		<div className="flex items-baseline gap-2 mb-2">
																			<p className="text-sm text-[#605A57]">
																				Required:
																			</p>
																			<p className="text-[#37322F] font-medium text-lg">
																				{
																					formattedData.zoningResolution.yards.rear
																						.value_ft
																				}{" "}
																				ft
																			</p>
																		</div>
																	)}
																	{formattedData.zoningResolution.yards.rear.notes &&
																		formattedData.zoningResolution.yards.rear.notes
																			.length > 0 && (
																			<div className="mt-2">
																				<p className="text-xs font-semibold text-[#37322F] mb-1">
																					Possible Exceptions:
																				</p>
																				<ul className="list-disc list-inside space-y-1">
																					{formattedData.zoningResolution.yards.rear.notes.map(
																						(
																							note: string,
																							noteIndex: number
																						) => (
																							<li
																								key={noteIndex}
																								className="text-xs text-[#605A57]"
																							>
																								{note}
																							</li>
																						)
																					)}
																				</ul>
																			</div>
																		)}
																	{formattedData.zoningResolution.yards.rear
																		.requires_manual_review && (
																		<Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 mt-2">
																			Requires Manual Review
																		</Badge>
																	)}
																</div>
															)}
													</div>

													{/* Yard Flags */}
													{formattedData.zoningResolution.yards.flags && (
														<div className="mt-4 flex flex-wrap gap-2">
															{formattedData.zoningResolution.yards.flags
																.buildingTypeInferred && (
																<Badge className="bg-gray-100 text-gray-700 border-gray-200">
																	Building Type Inferred
																</Badge>
															)}
															{formattedData.zoningResolution.yards.flags
																.lotfrontMissing && (
																<Badge className="bg-gray-100 text-gray-700 border-gray-200">
																	Lot Frontage Missing
																</Badge>
															)}
															{formattedData.zoningResolution.yards.flags
																.lotdepthMissing && (
																<Badge className="bg-gray-100 text-gray-700 border-gray-200">
																	Lot Depth Missing
																</Badge>
															)}
															{formattedData.zoningResolution.yards.flags
																.shallowLotCandidate && (
																<Badge className="bg-blue-100 text-blue-700 border-blue-200">
																	Shallow Lot Candidate
																</Badge>
															)}
															{formattedData.zoningResolution.yards.flags
																.districtVariantUsed && (
																<Badge className="bg-gray-100 text-gray-700 border-gray-200">
																	District Variant Used
																</Badge>
															)}
														</div>
													)}
												</div>
											)}

											{/* Parking Requirements - Not Applicable */}
											{formattedData.zoningResolution
												?.parking &&
												formattedData.zoningResolution.parking.kind ===
													"not_applicable" && (
												<div className="pt-4 border-t border-[rgba(55,50,47,0.12)]">
													<p className="text-sm font-semibold text-[#37322F] mb-2">
														Parking Requirements
													</p>
													<p className="text-sm text-[#605A57]">
														Not applicable
													</p>
													{formattedData.zoningResolution.parking
														.assumptions &&
														formattedData.zoningResolution.parking
															.assumptions.length > 0 && (
															<p className="text-xs text-[#605A57] mt-2">
																{
																	formattedData.zoningResolution.parking
																		.assumptions[0]
																}
															</p>
														)}
												</div>
											)}
										</div>
									</CardContent>
								</Card>
							)}

						{/* FEMA Flood Map */}
						{(() => {
							const femaFloodSource = sources.find(
								(s) => s.SourceKey === "fema_flood"
							);
							const geoserviceSource = sources.find(
								(s) => s.SourceKey === "geoservice"
							);
							const zolaSource = sources.find((s) => s.SourceKey === "zola");

							const geoserviceData =
								geoserviceSource?.ContentJson?.extracted ||
								geoserviceSource?.ContentJson ||
								{};
							const zolaData =
								zolaSource?.ContentJson?.contentJson ||
								zolaSource?.ContentJson ||
								{};

							// Get coordinates (prefer Zola, fallback to Geoservice)
							const lat = zolaData.lat || geoserviceData.lat || null;
							const lng = zolaData.lon || zolaData.lng || geoserviceData.lng || null;

							// Get FEMA flood data
							const femaFloodData =
								femaFloodSource?.ContentJson?.contentJson ||
								femaFloodSource?.ContentJson ||
								null;

							if (!lat || !lng) {
								return null; // Don't show map if no coordinates
							}

							return (
								<Card id="fema-flood-map" className="mb-6 scroll-mt-8">
									<CardContent className="pt-6">
										<div>
											<h3 className="text-lg font-semibold text-[#37322F] mb-4 flex items-center gap-2">
												<MapPin className="w-5 h-5 text-[#4090C2]" />
												FEMA Flood Map
											</h3>
											<FemaFloodMap
												ref={femaMapRef}
												lat={lat}
												lng={lng}
												address={report.Address}
												printImageId="fema-flood-map-print-image"
												floodZoneData={femaFloodData}
											/>
										</div>
									</CardContent>
								</Card>
							);
						})()}

						{/* Transit Zone Map */}
						{(() => {
							const transitZoneSource = sources.find(
								(s) => s.SourceKey === "transit_zones"
							);
							const geoserviceSource = sources.find(
								(s) => s.SourceKey === "geoservice"
							);
							const zolaSource = sources.find((s) => s.SourceKey === "zola");

							const geoserviceData =
								geoserviceSource?.ContentJson?.extracted ||
								geoserviceSource?.ContentJson ||
								{};
							const zolaData =
								zolaSource?.ContentJson?.contentJson ||
								zolaSource?.ContentJson ||
								{};

							// Get coordinates (prefer Zola, fallback to Geoservice)
							const lat = zolaData.lat || geoserviceData.lat || null;
							const lng = zolaData.lon || zolaData.lng || geoserviceData.lng || null;

							// Get transit zone data
							const transitZoneData =
								transitZoneSource?.ContentJson?.contentJson ||
								transitZoneSource?.ContentJson ||
								null;

							if (!lat || !lng) {
								return null; // Don't show map if no coordinates
							}

							return (
								<Card id="transit-zone-map" className="mb-6 scroll-mt-8">
									<CardContent className="pt-6">
										<div>
											<h3 className="text-lg font-semibold text-[#37322F] mb-4 flex items-center gap-2">
												<MapPinCheck className="w-5 h-5 text-[#4090C2]" />
												Transit Zone Map
											</h3>
											<TransitZoneMap
												ref={transitMapRef}
												lat={lat}
												lng={lng}
												address={report.Address}
												printImageId="transit-zone-map-print-image"
												transitZoneData={transitZoneData}
											/>
										</div>
									</CardContent>
								</Card>
							);
						})()}

						{/* Neighborhood Information */}
						<Card id="neighborhood-information" className="scroll-mt-8">
							<CardContent className="pt-6">
								<div>
									<h3 className="text-lg font-semibold text-[#37322F] mb-4 flex items-center gap-2">
										<Building2 className="w-5 h-5 text-[#4090C2]" />
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
				</main>

				{/* Sticky table of contents - only in Pretty mode */}
				{!showDebugMode && (
					<aside className="w-56 shrink-0 hidden lg:block">
						<div className="sticky top-8 pt-2">
							<p className="text-xs font-semibold text-[#605A57] uppercase tracking-wider mb-3">
								On this report
							</p>
							<nav className="space-y-1">
								{reportSections.map(({ id, label }) => (
									<a
										key={id}
										href={`#${id}`}
										onClick={(e) => handleTocClick(e, id)}
										className={`block text-sm py-0.5 pl-2 -ml-0.5 border-l-2 transition-colors ${
											activeSectionId === id
												? "border-[#4090C2] text-[#4090C2] font-medium"
												: "border-transparent text-[#37322F] hover:text-[#4090C2] hover:underline"
										}`}
									>
										{label}
									</a>
								))}
							</nav>
						</div>
					</aside>
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
	const GOOGLE_MAPS_API_KEY = config.googleMapsApiKey;

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
