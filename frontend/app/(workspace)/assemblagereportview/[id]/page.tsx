"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Bug, Home, MapPin, MapPinCheck, Share2, FileDown } from "lucide-react";
import { GoogleMap, Marker, useLoadScript } from "@react-google-maps/api";
import { getReportWithSources, type ReportWithSources } from "@/lib/reports";
import type { ReportSource } from "@/lib/reports";
import { getBuildingClassDescriptionText } from "@/lib/building-class";
import { getLandUseDescriptionText } from "@/lib/land-use";
import { config } from "@/lib/config";
import { toast } from "sonner";
import FemaFloodMap from "@/components/fema-flood-map";
import TransitZoneMap from "@/components/transit-zone-map";

interface AssemblageLot {
	childIndex: number;
	address: string;
	normalizedAddress: string;
	bbl: string;
	lotarea: number;
	zonedist1: string | null;
	status: string;
	maxFar?: number | null;
	lotBuildableSqft?: number | null;
	farMethod?: string;
	requires_manual_review?: boolean;
	refuseExemptionMaxSqft?: number | null;
}

interface PerLotDensityBreakdown {
	bbl: string;
	childIndex?: number;
	lotarea?: number;
	maxFar?: number | null;
	buildable_sqft?: number | null;
	units_raw?: number | null;
	units_rounded?: number | null;
	missing_inputs?: boolean;
	requires_manual_review?: boolean;
	notes?: string | null;
}

interface AssemblageDensityCandidate {
	id: string;
	label: string;
	duf_applicable: boolean;
	method_used?: string | null;
	max_dwelling_units?: number | null;
	max_res_floor_area_sqft?: number | null;
	per_lot_breakdown?: PerLotDensityBreakdown[] | null;
	rounding_rule?: string | null;
	source_url?: string | null;
	source_section?: string | null;
	notes?: string | null;
	requires_manual_review?: boolean;
}

interface ContaminationRiskLot {
	bbl: string;
	block?: number | null;
	lot?: number | null;
	borough?: string | null;
	flags?: {
		isLandmarked?: boolean | null;
		historicDistrictName?: string | null;
		hasSpecialDistrict?: boolean;
		specialDistricts?: string[];
		hasOverlay?: boolean;
		overlays?: string[];
	};
}

interface ContaminationRiskData {
	lots?: ContaminationRiskLot[];
	summary?: {
		anyLandmark?: boolean;
		anyHistoricDistrict?: boolean;
		anySpecialDistrict?: boolean;
		anyOverlay?: boolean;
		contaminationRisk?: "none" | "moderate" | "high";
		requires_manual_review?: boolean;
		confidence?: string;
		counts?: {
			landmarkLots?: number;
			historicDistrictLots?: number;
			specialDistrictLots?: number;
			overlayLots?: number;
		};
	};
	notes?: string[];
}

interface AssemblageAggregation {
	lots: AssemblageLot[];
	combinedLotAreaSqft: number;
	totalBuildableSqft?: number;
	farMethod?: string;
	requires_manual_review?: boolean;
	density?: {
		kind: string;
		duf_value?: number;
		default_candidate_id?: string;
		candidates?: AssemblageDensityCandidate[];
		flags?: {
			densityMissingInputs?: boolean;
			densityComputed?: boolean;
			defaultMethod?: string;
			requires_manual_review?: boolean;
		};
	};
	flags?: {
		missingLotArea?: boolean;
		partialTotal?: boolean;
	};
}

function getStatusColor(status: string) {
	switch (status) {
		case "pending":
			return "bg-yellow-100 text-yellow-700 border-yellow-200";
		case "ready":
			return "bg-green-100 text-green-700 border-green-200";
		case "failed":
			return "bg-red-100 text-red-700 border-red-200";
		default:
			return "bg-gray-100 text-gray-700 border-gray-200";
	}
}

// Map above cards: geocode addresses from input (Google) and show one marker per address
function AssemblageMap({ addresses }: { addresses: string[] }) {
	const { isLoaded, loadError } = useLoadScript({
		googleMapsApiKey: config.googleMapsApiKey || "",
		libraries: ["places"],
	});

	type PositionWithAddress = { position: { lat: number; lng: number }; address: string; index: number };
	const [markers, setMarkers] = useState<PositionWithAddress[]>([]);
	const mapRef = useRef<google.maps.Map | null>(null);
	const onLoad = useCallback((map: google.maps.Map) => {
		mapRef.current = map;
	}, []);

	// Geocode each address so we always have a marker for every address; keep (position, address) in sync
	useEffect(() => {
		if (!isLoaded || typeof google === "undefined" || !addresses.length) {
			setMarkers([]);
			return;
		}
		const geocoder = new google.maps.Geocoder();
		let cancelled = false;
		Promise.all(
			addresses.map(
				(addr, index) =>
					new Promise<PositionWithAddress | null>((resolve) => {
						geocoder.geocode({ address: addr }, (results, status) => {
							if (cancelled || status !== "OK" || !results?.[0]) {
								resolve(null);
								return;
							}
							const loc = results[0].geometry.location;
							resolve({ position: { lat: loc.lat(), lng: loc.lng() }, address: addr, index });
						});
					})
			)
		).then((results) => {
			if (!cancelled) setMarkers(results.filter((r): r is PositionWithAddress => r != null));
		});
		return () => {
			cancelled = true;
		};
	}, [isLoaded, addresses]);
	const positions = useMemo(() => markers.map((m) => m.position), [markers]);

	// Fit bounds when geocoded positions arrive (map may have loaded before positions were ready)
	useEffect(() => {
		const map = mapRef.current;
		if (!map || positions.length === 0) return;
		if (positions.length >= 2) {
			const bounds = new google.maps.LatLngBounds();
			positions.forEach((p) => bounds.extend(p));
			map.fitBounds(bounds, { top: 80, right: 80, bottom: 80, left: 80 });
			const listener = google.maps.event.addListener(map, "idle", () => {
				google.maps.event.removeListener(listener);
				const z = map.getZoom();
				if (z != null && z > 14) map.setZoom(Math.max(14, z - 1));
			});
		} else {
			map.setCenter(positions[0]);
			map.setZoom(17);
		}
	}, [positions]);

	const height = 280;

	if (addresses.length === 0) {
		return (
			<div
				className="w-full rounded-lg bg-[#EEECEA] border border-[rgba(55,50,47,0.12)] flex items-center justify-center"
				style={{ height: `${height}px` }}
			>
				<p className="text-sm text-[#605A57]">No addresses to show</p>
			</div>
		);
	}
	if (loadError) {
		return (
			<div
				className="w-full rounded-lg bg-[#EEECEA] border border-[rgba(55,50,47,0.12)] flex items-center justify-center"
				style={{ height: `${height}px` }}
			>
				<p className="text-sm text-[#605A57]">Error loading map</p>
			</div>
		);
	}
	if (!isLoaded) {
		return (
			<div
				className="w-full rounded-lg bg-[#EEECEA] border border-[rgba(55,50,47,0.12)] flex items-center justify-center"
				style={{ height: `${height}px` }}
			>
				<p className="text-sm text-[#605A57]">Loading map…</p>
			</div>
		);
	}

	const center = positions.length >= 1 ? positions[0] : { lat: 40.7128, lng: -74.006 };

	return (
		<div
			className="w-full rounded-lg overflow-hidden border border-[rgba(55,50,47,0.12)] shadow-sm"
			style={{ height: `${height}px` }}
		>
			<GoogleMap
				mapContainerStyle={{ width: "100%", height: `${height}px` }}
				center={center}
				zoom={positions.length >= 2 ? 15 : 18}
				onLoad={onLoad}
				options={{
					mapTypeId: "hybrid",
					streetViewControl: false,
					mapTypeControl: true,
					fullscreenControl: true,
					zoomControl: true,
					scrollwheel: true,
					styles: [
						{ featureType: "poi", elementType: "all", stylers: [{ visibility: "off" }] },
					],
				}}
			>
				{markers.map((m, i) => (
					<Marker
						key={m.index}
						position={m.position}
						title={m.address}
						label={{
							text: String(m.index + 1),
							color: "white",
							fontWeight: "bold",
							fontSize: "14px",
						}}
					/>
				))}
			</GoogleMap>
		</div>
	);
}

export default function AssemblageReportViewPage() {
	const params = useParams();
	const router = useRouter();
	const reportId = params.id as string;

	const [reportData, setReportData] = useState<ReportWithSources | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showDebugMode, setShowDebugMode] = useState(false);

	useEffect(() => {
		const fetchReport = async () => {
			if (!reportId) return;
			try {
				setIsLoading(true);
				setError(null);
				const data = await getReportWithSources(reportId);
				// If not an assemblage report, redirect to single report view
				if (data.report.ReportType !== "assemblage") {
					router.replace(`/viewreport/${reportId}`);
					return;
				}
				setReportData(data);
			} catch (err) {
				console.error("Error fetching assemblage report:", err);
				setError(err instanceof Error ? err.message : "Failed to load report");
			} finally {
				setIsLoading(false);
			}
		};

		fetchReport();
	}, [reportId, router]);

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
							<p className="text-red-600">{error || "Report not found"}</p>
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	const { report, sources, creator } = reportData;
	if (report.ReportType !== "assemblage") {
		return null; // redirect in progress
	}

	// Find assemblage_aggregation source; ContentJson may be nested
	const aggSource = sources.find((s) => s.SourceKey === "assemblage_aggregation");
	const rawAgg = aggSource?.ContentJson;
	const aggregation: AssemblageAggregation | null = rawAgg
		? (typeof rawAgg === "object" && "lots" in rawAgg
				? rawAgg
				: (rawAgg as Record<string, unknown>)?.contentJson ?? rawAgg) as AssemblageAggregation
		: null;

	const lots = aggregation?.lots ?? [];
	const combinedLotAreaSqft = aggregation?.combinedLotAreaSqft ?? 0;
	const totalBuildableSqft = aggregation?.totalBuildableSqft ?? 0;
	const farMethod = aggregation?.farMethod ?? null;
	const requiresManualReview = aggregation?.requires_manual_review ?? false;
	const flags = aggregation?.flags ?? {};
	const missingCount = lots.filter((l) => l.status === "missing_lotarea").length;

	// Contamination risk (assemblage_contamination_risk source)
	const contaminationRiskSource = sources.find((s) => s.SourceKey === "assemblage_contamination_risk");
	const contaminationRiskData: ContaminationRiskData | null =
		contaminationRiskSource?.Status === "succeeded" && contaminationRiskSource?.ContentJson
			? (contaminationRiskSource.ContentJson as ContaminationRiskData)
			: null;

	// Zoning consistency (assemblage_zoning_consistency source)
	const zoningConsistencySource = sources.find((s) => s.SourceKey === "assemblage_zoning_consistency");
	const zoningConsistency = zoningConsistencySource?.Status === "succeeded" && zoningConsistencySource?.ContentJson
		? (zoningConsistencySource.ContentJson as {
				lots?: Array<{
					bbl: string | null;
					block?: number | null;
					lot?: number | null;
					borough?: string | null;
					primaryDistrict?: string | null;
					normalizedProfile?: string | null;
					zonedist?: (string | null)[];
					overlays?: (string | null)[];
					specialDistricts?: (string | null)[];
					flags?: { missingZonedist1?: boolean; hasOverlay?: boolean; hasSpecialDistrict?: boolean };
				}>;
				summary?: {
					primaryDistricts?: (string | null)[];
					normalizedProfiles?: (string | null)[];
					samePrimaryDistrict?: boolean;
					sameNormalizedProfile?: boolean;
					sameBlock?: boolean;
					hasAnyOverlay?: boolean;
					hasAnySpecialDistrict?: boolean;
					multiDistrictLotsCount?: number;
					confidence?: string;
					requires_manual_review?: boolean;
				};
				notes?: string[];
		  })
		: null;

	// Helpers for debug view: get sources by key; for multi-child keys, by childIndex
	const getSourceByKey = (key: string) =>
		sources.find((s) => s.SourceKey === key) ?? null;
	// Per-lot Zola (MapPLUTO) payload for property cards; returns null if Zola failed or missing
	const getZolaPayloadForLot = (childIndex: number): Record<string, unknown> | null => {
		const { byIndex } = getSourcesByKeyWithChildIndex("zola");
		const source = byIndex[childIndex];
		if (!source?.ContentJson || source.Status !== "succeeded") return null;
		const cj = source.ContentJson as { contentJson?: Record<string, unknown>; [key: string]: unknown };
		return (cj.contentJson ?? cj) as Record<string, unknown>;
	};
	// Per-lot Zola source (succeeded or failed) for showing error when parcel data unavailable
	const getZolaSourceForLot = (childIndex: number): ReportSource | null => {
		const { byIndex } = getSourcesByKeyWithChildIndex("zola");
		return byIndex[childIndex] ?? null;
	};
	const formatBorough = (boroughOrCode: string | number | null | undefined): string | null => {
		if (boroughOrCode == null || boroughOrCode === "") return null;
		const s = String(boroughOrCode).trim();
		if (s === "1" || s === "MN") return "Manhattan";
		if (s === "2" || s === "BX") return "Bronx";
		if (s === "3" || s === "BK") return "Brooklyn";
		if (s === "4" || s === "QN") return "Queens";
		if (s === "5" || s === "SI") return "Staten Island";
		return s || null;
	};
	const getSourcesByKeyWithChildIndex = (key: string) => {
		const list = sources.filter((s) => s.SourceKey === key);
		const byIndex: Record<number, ReportSource> = {};
		list.forEach((s) => {
			const cj = s.ContentJson as { childIndex?: number } | null;
			if (cj != null && typeof cj.childIndex === "number") {
				byIndex[cj.childIndex] = s;
			}
		});
		return { list, byIndex };
	};

	// Geoservice ContentJson shape (extracted may have bbl, or noBbl + errorMessage + partial segment data)
	type GeoserviceContentJson = {
		childIndex?: number;
		address?: string;
		extracted?: {
			bbl?: string | null;
			lat?: number | null;
			lng?: number | null;
			errorMessage?: string | null;
			partial?: {
				borough?: string | null;
				streetName?: string | null;
				zipCode?: string | null;
				uspsCityName?: string | null;
				communityDistrict?: string | null;
				assemblyDistrict?: string | null;
				schoolDistrict?: string | null;
				policePrecinct?: string | null;
				fireCompany?: string | null;
				fireDivision?: string | null;
				noParkingLanes?: string | null;
				noTotalLanes?: string | null;
				noTravelingLanes?: string | null;
				lat?: number | null;
				lng?: number | null;
			};
		};
		noBbl?: boolean;
		errorMessage?: string | null;
	};

	// All address slots: from assemblage_input.addresses, or from geoservice sources (Option B: report always has addresses)
	const assemblageInput = getSourceByKey("assemblage_input")?.ContentJson as { addresses?: string[] } | null;
	const { byIndex: geoByIndex } = getSourcesByKeyWithChildIndex("geoservice");
	const addressIndices = assemblageInput?.addresses?.length != null
		? Array.from({ length: assemblageInput.addresses!.length }, (_, i) => i)
		: Object.keys(geoByIndex).map(Number).sort((a, b) => a - b);
	const addressesList: string[] = assemblageInput?.addresses ?? addressIndices.map(
		(i) => (geoByIndex[i]?.ContentJson as GeoserviceContentJson)?.address ?? `Address ${i + 1}`
	);

	// One display item per address: hasBbl + lot (if any) + geoservice data for no-BBL messaging
	const displayItems = addressIndices.map((childIndex) => {
		const geo = geoByIndex[childIndex]?.ContentJson as GeoserviceContentJson | null;
		const extracted = geo?.extracted;
		const hasBbl = !!(extracted?.bbl != null && String(extracted.bbl).trim() !== "");
		const lot = lots.find((l) => l.childIndex === childIndex) ?? null;
		return {
			childIndex,
			address: addressesList[childIndex] ?? geo?.address ?? `Address ${childIndex + 1}`,
			hasBbl,
			lot,
			geoservice: geo,
			extracted,
		};
	});
	const addressesMissingBbl = displayItems.filter((item) => !item.hasBbl).map((item) => item.address);
	const hasMissingBbl = addressesMissingBbl.length > 0;

	// Lat/lng: geoservice extracted (or partial segment coords when no BBL), then Zola centroid
	const getCoordsForLot = (childIndex: number): { lat: number; lng: number } | null => {
		const geo = geoByIndex[childIndex]?.ContentJson as GeoserviceContentJson | null;
		const extracted = geo?.extracted;
		if (extracted?.lat != null && extracted?.lng != null && !Number.isNaN(extracted.lat) && !Number.isNaN(extracted.lng)) {
			return { lat: extracted.lat, lng: extracted.lng };
		}
		const partial = extracted?.partial;
		if (partial?.lat != null && partial?.lng != null && !Number.isNaN(partial.lat) && !Number.isNaN(partial.lng)) {
			return { lat: partial.lat, lng: partial.lng };
		}
		const zola = getZolaPayloadForLot(childIndex);
		const lat = zola?.lat != null ? Number(zola.lat) : null;
		const lon = zola?.lon != null ? Number(zola.lon) : null;
		if (lat != null && lon != null && !Number.isNaN(lat) && !Number.isNaN(lon)) {
			return { lat, lng: lon };
		}
		return null;
	};

	// Addresses from input (always 2 or 3); map geocodes them so both markers always show
	const assemblageAddresses = displayItems.map((item) => item.address);

	const DebugJsonBlock = ({ data }: { data: unknown }) => (
		<div className="bg-[#F7F5F3] rounded-lg p-3 border border-[rgba(55,50,47,0.12)] overflow-x-auto">
			<pre className="text-xs text-[#37322F] whitespace-pre-wrap">
				{data != null ? JSON.stringify(data, null, 2) : "—"}
			</pre>
		</div>
	);

	const DebugPlaceholder = () => (
		<div className="bg-[#EEECEA] rounded-lg p-4 border border-dashed border-[rgba(55,50,47,0.2)] text-center">
			<p className="text-sm text-[#605A57]">Data not pulled yet</p>
		</div>
	);

	const handleShare = () => {
		toast.info("Share coming soon");
	};
	const handleDownloadPdf = () => {
		// PDF download not yet implemented; see note below
		toast.info("PDF download coming soon");
	};

	return (
		<div className="p-8">
			<div className="max-w-5xl mx-auto space-y-6">
				<Button
					variant="ghost"
					onClick={() => router.push("/reports")}
					className="mb-2"
				>
					<ArrowLeft className="size-4 mr-2" />
					Back to Reports
				</Button>

				{/* Created by + Share / Download as PDF */}
				<div className="flex flex-wrap items-center justify-between gap-3 mb-2">
					<p className="text-sm text-[#605A57]">
						Created by {creator?.Name ?? "—"}
					</p>
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
				</div>

				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex flex-wrap items-center gap-3">
						<h1 className="text-2xl font-semibold text-[#37322F]">
							Assemblage Report
						</h1>
						<Badge
							variant="outline"
							className={`text-xs ${getStatusColor(report.Status)}`}
						>
							{report.Status}
						</Badge>
						{report.CreatedAt && (
							<span className="text-sm text-[#605A57]">
								{format(new Date(report.CreatedAt), "MMM d, yyyy 'at' h:mm a")}
							</span>
						)}
					</div>
					<div className="flex items-center gap-2">
						<Label
							htmlFor="assemblage-debug-toggle"
							className="text-sm text-[#605A57] cursor-pointer flex items-center gap-1"
						>
							<Bug className="size-4" />
							{showDebugMode ? "Debug" : "Pretty"}
						</Label>
						<Switch
							id="assemblage-debug-toggle"
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

				{/* Debug mode: ContentJson side by side for each source type */}
				{showDebugMode && (
					<div className="space-y-6">
						<h2 className="text-xl font-semibold text-[#37322F] flex items-center gap-2">
							<Bug className="size-5" />
							Report sources (ContentJson)
						</h2>

						{/* Assemblage input */}
						<Card>
							<CardHeader>
								<CardTitle className="text-base">assemblage_input</CardTitle>
								{getSourceByKey("assemblage_input") && (
									<Badge
										variant="outline"
										className={`text-xs w-fit ${getStatusColor(
											getSourceByKey("assemblage_input")!.Status
										)}`}
									>
										{getSourceByKey("assemblage_input")!.Status}
									</Badge>
								)}
							</CardHeader>
							<CardContent>
								{getSourceByKey("assemblage_input")?.ContentJson != null ? (
									<DebugJsonBlock data={getSourceByKey("assemblage_input")!.ContentJson} />
								) : (
									<DebugPlaceholder />
								)}
							</CardContent>
						</Card>

						{/* Geoservice: Property 1 | Property 2 | Property 3 — Debug shows raw error; "partial succeeded" (yellow) when no BBL */}
						<Card>
							<CardHeader>
								<CardTitle className="text-base">geoservice</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									{displayItems.map((item) => {
										const src = getSourcesByKeyWithChildIndex("geoservice").byIndex[item.childIndex];
										const cj = src?.ContentJson as { Status?: string; noBbl?: boolean; errorMessage?: string; extracted?: { errorMessage?: string } } | null;
										const isPartialSucceeded = src?.Status === "succeeded" && cj?.noBbl === true;
										const rawError = cj?.errorMessage ?? cj?.extracted?.errorMessage;
										return (
											<div key={item.childIndex}>
												<p className="text-sm font-medium text-[#605A57] mb-2">Property {item.childIndex + 1}</p>
												{src ? (
													<>
														<Badge
															variant="outline"
															className={`text-xs mb-2 ${
																isPartialSucceeded
																	? "bg-amber-100 text-amber-800 border-amber-200"
																	: getStatusColor(src.Status)
															}`}
														>
															{isPartialSucceeded ? "partial succeeded" : src.Status}
														</Badge>
														{rawError && (
															<p className="text-xs text-amber-800 mb-2 font-mono bg-amber-50/80 rounded px-2 py-1">
																{rawError}
															</p>
														)}
														<DebugJsonBlock data={src.ContentJson} />
													</>
												) : (
													<DebugPlaceholder />
												)}
											</div>
										);
									})}
								</div>
							</CardContent>
						</Card>

						{/* Zola: Property 1 | Property 2 */}
						<Card>
							<CardHeader>
								<CardTitle className="text-base">zola</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<p className="text-sm font-medium text-[#605A57] mb-2">Property 1</p>
										{getSourcesByKeyWithChildIndex("zola").byIndex[0] ? (
											<>
												<Badge
													variant="outline"
													className={`text-xs mb-2 ${getStatusColor(
														getSourcesByKeyWithChildIndex("zola").byIndex[0].Status
													)}`}
												>
													{getSourcesByKeyWithChildIndex("zola").byIndex[0].Status}
												</Badge>
												<DebugJsonBlock
													data={getSourcesByKeyWithChildIndex("zola").byIndex[0].ContentJson}
												/>
											</>
										) : (
											<DebugPlaceholder />
										)}
									</div>
									<div>
										<p className="text-sm font-medium text-[#605A57] mb-2">Property 2</p>
										{getSourcesByKeyWithChildIndex("zola").byIndex[1] ? (
											<>
												<Badge
													variant="outline"
													className={`text-xs mb-2 ${getStatusColor(
														getSourcesByKeyWithChildIndex("zola").byIndex[1].Status
													)}`}
												>
													{getSourcesByKeyWithChildIndex("zola").byIndex[1].Status}
												</Badge>
												<DebugJsonBlock
													data={getSourcesByKeyWithChildIndex("zola").byIndex[1].ContentJson}
												/>
											</>
										) : (
											<DebugPlaceholder />
										)}
									</div>
								</div>
							</CardContent>
						</Card>

						{/* Zoning resolution: placeholder (not pulled in assemblage yet) */}
						<Card>
							<CardHeader>
								<CardTitle className="text-base">zoning_resolution</CardTitle>
								<p className="text-xs text-[#605A57]">Not yet pulled for assemblage reports</p>
							</CardHeader>
							<CardContent>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<p className="text-sm font-medium text-[#605A57] mb-2">Property 1</p>
										<DebugPlaceholder />
									</div>
									<div>
										<p className="text-sm font-medium text-[#605A57] mb-2">Property 2</p>
										<DebugPlaceholder />
									</div>
								</div>
							</CardContent>
						</Card>

						{/* Assemblage aggregation */}
						<Card>
							<CardHeader>
								<CardTitle className="text-base">assemblage_aggregation</CardTitle>
								{getSourceByKey("assemblage_aggregation") && (
									<Badge
										variant="outline"
										className={`text-xs w-fit ${getStatusColor(
											getSourceByKey("assemblage_aggregation")!.Status
										)}`}
									>
										{getSourceByKey("assemblage_aggregation")!.Status}
									</Badge>
								)}
							</CardHeader>
							<CardContent>
								{getSourceByKey("assemblage_aggregation")?.ContentJson != null ? (
									<DebugJsonBlock data={getSourceByKey("assemblage_aggregation")!.ContentJson} />
								) : (
									<DebugPlaceholder />
								)}
							</CardContent>
						</Card>

						{/* Assemblage contamination risk */}
						<Card>
							<CardHeader>
								<CardTitle className="text-base">assemblage_contamination_risk</CardTitle>
								{getSourceByKey("assemblage_contamination_risk") && (
									<Badge
										variant="outline"
										className={`text-xs w-fit ${getStatusColor(
											getSourceByKey("assemblage_contamination_risk")!.Status
										)}`}
									>
										{getSourceByKey("assemblage_contamination_risk")!.Status}
									</Badge>
								)}
							</CardHeader>
							<CardContent>
								{getSourceByKey("assemblage_contamination_risk")?.ContentJson != null ? (
									<DebugJsonBlock data={getSourceByKey("assemblage_contamination_risk")!.ContentJson} />
								) : (
									<DebugPlaceholder />
								)}
							</CardContent>
						</Card>
					</div>
				)}

				{/* Pretty mode: one map above cards, then one card per address (Option B: always show all addresses; red disclaimer when no BBL) */}
				{!showDebugMode && (
					<div className="space-y-4">
						{displayItems.length === 0 ? (
							<p className="text-[#605A57]">No property data available.</p>
						) : (
							<>
							{/* Single map showing all addresses, labeled 1, 2, (3) */}
							<div className="rounded-lg bg-[#F9F8F6] border border-[rgba(55,50,47,0.08)] p-4">
								<p className="text-sm font-medium text-[#37322F] mb-3">Assemblage map</p>
								<AssemblageMap addresses={assemblageAddresses} />
							</div>
							<div
								className={
									displayItems.length === 3
										? "grid grid-cols-1 md:grid-cols-3 gap-4"
										: "grid grid-cols-1 md:grid-cols-2 gap-4"
								}
							>
								{displayItems.map((item) => {
									const { childIndex, address, hasBbl, lot, extracted } = item;
									const zolaPayload = getZolaPayloadForLot(childIndex);
									const zolaSource = getZolaSourceForLot(childIndex);
									const zolaFailed = zolaSource != null && zolaSource.Status !== "succeeded";
									const borough = formatBorough(zolaPayload?.borough ?? zolaPayload?.borocode ?? extracted?.partial?.borough ?? extracted?.borough);
									const landUse = zolaPayload?.landuse != null ? String(zolaPayload.landuse) : null;
									const buildingClass = zolaPayload?.bldgclass != null ? String(zolaPayload.bldgclass) : null;
									const unitsres = zolaPayload?.unitsres != null ? Number(zolaPayload.unitsres) : null;
									const numfloors = zolaPayload?.numfloors != null ? Number(zolaPayload.numfloors) : null;
									const partial = extracted?.partial;
									const errorMessage = extracted?.errorMessage ?? (item.geoservice as { errorMessage?: string })?.errorMessage;

									return (
									<Card key={childIndex} className="bg-[#F9F8F6] border-[rgba(55,50,47,0.12)]">
										<CardContent className="pt-5 pb-5">
											<div className="flex items-center gap-2 mb-4">
												<Home className="size-5 text-[#4090C2] shrink-0" />
												<h3 className="text-lg font-semibold text-[#37322F]">
													Address {childIndex + 1}
												</h3>
											</div>
											{/* Red disclaimer when no BBL was found (Pretty: user-friendly message only; raw error is in Debug) */}
											{!hasBbl && (
												<div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
													<strong>No BBL was found for this property.</strong>
													<span className="mt-1 block font-normal text-red-700">
														The city&apos;s address database could not return a parcel (BBL) for this address. Only segment-level street data is shown below.
													</span>
												</div>
											)}
											{zolaFailed && hasBbl && (
												<div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
													<strong>Parcel data unavailable</strong> for this address.
													{zolaSource?.ErrorMessage && (
														<span className="mt-1 block font-normal text-amber-700">
															{zolaSource.ErrorMessage}
														</span>
													)}
												</div>
											)}
											<div className="space-y-4">
												<div>
													<p className="text-sm text-[#605A57] mb-1">Address</p>
													<p className="text-[#37322F] font-medium break-words whitespace-pre-wrap">
														{lot?.normalizedAddress ?? address}
													</p>
												</div>
												{hasBbl && lot && (
													<div>
														<p className="text-sm text-[#605A57] mb-1">BBL</p>
														<p className="text-[#37322F] font-medium font-mono text-sm">
															{lot.bbl}
														</p>
													</div>
												)}
												<div>
													<p className="text-sm text-[#605A57] mb-1">Borough</p>
													<p className="text-[#37322F] font-medium">{borough ?? (partial?.uspsCityName?.trim() || "—")}</p>
												</div>
												{/* Segment-level data when no BBL */}
												{!hasBbl && partial && (
													<>
														{partial.uspsCityName && (
															<div>
																<p className="text-sm text-[#605A57] mb-1">USPS city</p>
																<p className="text-[#37322F] font-medium">{partial.uspsCityName.trim()}</p>
															</div>
														)}
														{partial.zipCode && (
															<div>
																<p className="text-sm text-[#605A57] mb-1">ZIP code</p>
																<p className="text-[#37322F] font-medium">{partial.zipCode.trim()}</p>
															</div>
														)}
														{partial.streetName && (
															<div>
																<p className="text-sm text-[#605A57] mb-1">Street (segment)</p>
																<p className="text-[#37322F] font-medium">{partial.streetName.trim()}</p>
															</div>
														)}
														{(partial.communityDistrict ?? partial.assemblyDistrict) && (
															<div>
																<p className="text-sm text-[#605A57] mb-1">Community / Assembly district</p>
																<p className="text-[#37322F] font-medium">
																	{[partial.communityDistrict?.trim(), partial.assemblyDistrict?.trim()].filter(Boolean).join(" / ") || "—"}
																</p>
															</div>
														)}
														{(partial.noParkingLanes ?? partial.noTotalLanes ?? partial.noTravelingLanes) && (
															<div>
																<p className="text-sm text-[#605A57] mb-1">Lanes (segment)</p>
																<p className="text-[#37322F] font-medium text-sm">
																	Parking: {partial.noParkingLanes?.trim() ?? "—"} · Total: {partial.noTotalLanes?.trim() ?? "—"} · Travel: {partial.noTravelingLanes?.trim() ?? "—"}
																</p>
															</div>
														)}
													</>
												)}
												{hasBbl && (
													<>
														<div>
															<p className="text-sm text-[#605A57] mb-1">Land Use</p>
															<p className="text-[#37322F] font-medium">
																{landUse != null ? (getLandUseDescriptionText(landUse) || landUse) : "—"}
															</p>
														</div>
														<div>
															<p className="text-sm text-[#605A57] mb-1">Building Class</p>
															<p className="text-[#37322F] font-medium">
																{buildingClass != null ? (getBuildingClassDescriptionText(buildingClass) || buildingClass) : "—"}
															</p>
														</div>
														<div>
															<p className="text-sm text-[#605A57] mb-1">Residential Units</p>
															<p className="text-[#37322F] font-medium">
																{unitsres != null && !Number.isNaN(unitsres) ? unitsres : "—"}
															</p>
														</div>
														<div>
															<p className="text-sm text-[#605A57] mb-1">Number of Floors</p>
															<p className="text-[#37322F] font-medium">
																{numfloors != null && !Number.isNaN(numfloors) ? numfloors : "—"}
															</p>
														</div>
														{lot?.zonedist1 && (
															<div>
																<p className="text-sm text-[#605A57] mb-1">Zoning district</p>
																<Badge variant="outline" className="text-xs font-medium text-[#37322F]">
																	{lot.zonedist1}
																</Badge>
															</div>
														)}
														<div>
															<p className="text-sm text-[#605A57] mb-1">Lot area</p>
															<p className="text-[#37322F] font-medium">
																{(lot?.lotarea ?? 0) > 0
																	? `${(lot!.lotarea).toLocaleString()} sq ft`
																	: "—"}
																{lot?.status === "missing_lotarea" && (
																	<span className="text-amber-600 ml-2 text-xs font-normal">
																		(missing)
																	</span>
																)}
															</p>
														</div>
														{lot?.maxFar != null && (
															<div>
																<p className="text-sm text-[#605A57] mb-1">Max FAR</p>
																<p className="text-[#37322F] font-medium">
																	{lot.maxFar}
																	{lot.requires_manual_review && (
																		<span className="text-amber-600 ml-2 text-xs font-normal">
																			(manual review)
																		</span>
																	)}
																</p>
															</div>
														)}
														{lot?.lotBuildableSqft != null && lot.lotBuildableSqft > 0 && (
															<div>
																<p className="text-sm text-[#605A57] mb-1">Buildable (FAR)</p>
																<p className="text-[#37322F] font-medium">
																	{lot.lotBuildableSqft.toLocaleString()} sq ft
																</p>
															</div>
														)}
													</>
												)}
											</div>
										</CardContent>
									</Card>
									);
								})}
							</div>
							</>
						)}
						<div className="pt-6 border-t border-[rgba(55,50,47,0.12)] space-y-6">
							{hasMissingBbl ? (
								<div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
									<p className="text-amber-800 font-medium mb-2">
										Missing BBL data for {addressesMissingBbl.length === 1 ? "address" : "addresses"}:{" "}
										{addressesMissingBbl.join(", ")}
									</p>
									<p className="text-sm text-amber-800 mb-3">
										We can&apos;t automatically calculate the following for this assemblage. Please consider a manual check while we improve this feature and experience.
									</p>
									<ul className="text-sm text-amber-800 list-disc list-inside space-y-1">
										<li>Combined Lot Area</li>
										<li>Total Buildable (FAR)</li>
										<li>Density (DUF)</li>
										<li>Zoning District Consistency</li>
										<li>Assemblage Contamination Risk</li>
									</ul>
								</div>
							) : (
							<>
							{/* Combined Lot Area */}
							<div className="rounded-lg bg-[#F9F8F6] border border-[rgba(55,50,47,0.08)] p-4">
								<div className="flex flex-wrap items-baseline gap-2 mb-1">
									<span className="text-[#37322F] font-medium">Combined Lot Area</span>
									<span className="text-xl font-semibold text-[#37322F]">
										{combinedLotAreaSqft.toLocaleString()} sq ft
									</span>
								</div>
								<p className="text-sm text-[#605A57] mb-3">
									Total land area of all lots in this assemblage. We sum the lot area (from MapPLUTO) for each property.
								</p>
								{lots.some((l) => l.lotarea > 0) && (
									<div className="text-sm">
										<span className="text-[#605A57]">Calculation: </span>
										<span className="text-[#37322F] font-mono bg-white/60 rounded px-1.5 py-0.5">
											{lots
												.filter((l) => l.lotarea > 0)
												.map((l) => `${l.lotarea.toLocaleString()} sq ft`)
												.join(" + ")}
											{" = "}
											{combinedLotAreaSqft.toLocaleString()} sq ft
										</span>
									</div>
								)}
							</div>

							{/* Total Buildable (FAR) */}
							{totalBuildableSqft > 0 && (
								<div className="rounded-lg bg-[#F9F8F6] border border-[rgba(55,50,47,0.08)] p-4">
									<div className="flex flex-wrap items-baseline gap-2 mb-1">
										<span className="text-[#37322F] font-medium">Total Buildable (FAR)</span>
										<span className="text-xl font-semibold text-[#37322F]">
											{totalBuildableSqft.toLocaleString()} sq ft
										</span>
										{farMethod && (
											<Badge
												variant={farMethod === "shared_district" ? "default" : "secondary"}
												className={
													farMethod === "shared_district"
														? "bg-emerald-600 hover:bg-emerald-600/90 text-white font-medium"
														: "bg-amber-100 text-amber-800 border-amber-200 font-medium"
												}
											>
												{farMethod === "shared_district" ? "Shared district" : "Per-lot sum"}
											</Badge>
										)}
									</div>
									<p className="text-sm text-[#605A57] mb-3">
										Maximum residential floor area allowed across the assemblage. For each lot we use the applicable max FAR (from zoning) × lot area, then add the results. When a lot has multiple zoning districts, we use the lowest FAR for that lot.
									</p>
									{lots.some((l) => l.maxFar != null && (l.lotBuildableSqft ?? 0) > 0) && (
										<div className="text-sm">
											<span className="text-[#605A57]">Calculation: </span>
											<span className="text-[#37322F] font-mono bg-white/60 rounded px-1.5 py-0.5 inline-block mt-1">
												{lots
													.filter((l) => l.maxFar != null && (l.lotBuildableSqft ?? 0) > 0)
													.map(
														(l) =>
															`${l.maxFar} × ${l.lotarea.toLocaleString()} = ${(l.lotBuildableSqft ?? 0).toLocaleString()} sq ft`
													)
													.join(" + ")}
												{" = "}
												{totalBuildableSqft.toLocaleString()} sq ft total
											</span>
										</div>
									)}
								</div>
							)}
							{requiresManualReview && (
								<p className="text-amber-700 text-sm flex items-start gap-2">
									<span className="shrink-0 mt-0.5">Note:</span>
									FAR was calculated per lot or using multiple zoning districts; manual zoning review is recommended.
								</p>
							)}
							{flags.missingLotArea && (
								<p className="text-amber-700 text-sm">
									Partial total — missing lot area for {missingCount} lot
									{missingCount !== 1 ? "s" : ""}.
								</p>
							)}
							{/* FAR assumptions & citations */}
							<div className="rounded-lg bg-[#F9F8F6]/60 border border-[rgba(55,50,47,0.08)] p-4">
								<p className="text-xs text-[#605A57] mb-2">
									We use standard FAR per NYC Zoning Resolution. Higher FAR may apply for qualifying residential sites, qualifying affordable or senior housing, or lots within 100 ft of a wide street. For lots with multiple zoning districts we use the lowest applicable FAR; manual review recommended.
								</p>
								<div className="flex flex-wrap gap-x-3 gap-y-1 text-xs mb-2">
									<a href="https://zr.planning.nyc.gov/index.php/article-ii/chapter-3/23-20" target="_blank" rel="noopener noreferrer" className="text-[#4090C2] hover:underline">See Citation [ZR § 23-20]</a>
									<a href="https://zr.planning.nyc.gov/index.php/article-ii/chapter-3/23-21" target="_blank" rel="noopener noreferrer" className="text-[#4090C2] hover:underline">See Citation [ZR § 23-21]</a>
									<a href="https://zr.planning.nyc.gov/index.php/article-ii/chapter-3/23-22" target="_blank" rel="noopener noreferrer" className="text-[#4090C2] hover:underline">See Citation [ZR § 23-22]</a>
									<a href="https://zr.planning.nyc.gov/index.php/article-ii/chapter-3/23-23" target="_blank" rel="noopener noreferrer" className="text-[#4090C2] hover:underline">See Citation [ZR § 23-23]</a>
								</div>
								{(() => {
									const totalRefuseExemption = lots.reduce((sum, l) => sum + (l.refuseExemptionMaxSqft ?? 0), 0);
									return totalRefuseExemption > 0 ? (
									<p className="text-xs text-[#605A57]">
										Potential exemption (refuse): up to {totalRefuseExemption.toLocaleString()} sq ft total across lots{" "}
										<a href="https://zr.planning.nyc.gov/index.php/article-ii/chapter-3/23-233" target="_blank" rel="noopener noreferrer" className="text-[#4090C2] hover:underline">See Citation [ZR § 23-233]</a>
									</p>
									) : null;
								})()}
							</div>
							{/* Density (DUF) cap */}
							{aggregation?.density?.candidates && aggregation.density.candidates.length > 0 && (() => {
								const defaultId = aggregation.density!.default_candidate_id ?? "duf_applies";
								const dufCandidate = aggregation.density!.candidates!.find((c) => c.id === defaultId) ?? aggregation.density!.candidates![0];
								if (!dufCandidate) return null;
								return (
									<div className="rounded-lg bg-[#F9F8F6] border border-[rgba(55,50,47,0.08)] p-4">
										<div className="flex flex-wrap items-baseline gap-2 mb-1">
											<span className="text-[#37322F] font-medium">Density (DUF)</span>
											{dufCandidate.duf_applicable && dufCandidate.max_dwelling_units != null ? (
												<span className="text-xl font-semibold text-[#37322F]">
													{dufCandidate.max_dwelling_units} max dwelling units
												</span>
											) : (
												<span className="text-sm text-[#605A57]">{dufCandidate.label}</span>
											)}
										</div>
										{dufCandidate.method_used && (
											<p className="text-sm text-[#605A57] mb-1">
												Method: {dufCandidate.method_used === "combined_area_then_duf"
													? "Combined buildable area ÷ DUF (680)"
													: "Per-lot DUF then sum"}
											</p>
										)}
										{/* DUF calculation breakdown */}
										{dufCandidate.duf_applicable &&
											dufCandidate.max_dwelling_units != null &&
											(dufCandidate.method_used === "combined_area_then_duf"
												? totalBuildableSqft > 0
												: (dufCandidate.per_lot_breakdown?.length ?? 0) > 0) && (
											<div className="text-sm mt-3">
												<span className="text-[#605A57]">Calculation: </span>
												{dufCandidate.method_used === "combined_area_then_duf" ? (
													<span className="text-[#37322F] font-mono bg-white/60 rounded px-1.5 py-0.5 inline-block mt-1">
														{totalBuildableSqft.toLocaleString()} ÷ 680 ={" "}
														{(totalBuildableSqft / 680).toFixed(2)} → rounded ={" "}
														{dufCandidate.max_dwelling_units} units
													</span>
												) : (
													<div className="mt-1.5 space-y-1">
														{dufCandidate.per_lot_breakdown
															?.filter(
																(row) =>
																	row.buildable_sqft != null &&
																	row.buildable_sqft > 0 &&
																	row.units_rounded != null &&
																	!row.missing_inputs
															)
															.map((row, i) => (
																<span
																	key={row.bbl ?? i}
																	className="text-[#37322F] font-mono bg-white/60 rounded px-1.5 py-0.5 inline-block mr-2 mb-1"
																>
																	{(row.buildable_sqft ?? 0).toLocaleString()} ÷ 680 ={" "}
																	{(row.units_raw ?? 0).toFixed(2)} →{" "}
																	{row.units_rounded} units
																</span>
															))}
														{(dufCandidate.per_lot_breakdown?.filter(
															(row) =>
																row.buildable_sqft != null &&
																row.buildable_sqft > 0 &&
																row.units_rounded != null &&
																!row.missing_inputs
														).length ?? 0) > 1 && (
															<span className="text-[#37322F] font-mono bg-white/60 rounded px-1.5 py-0.5 inline-block mt-1">
																{dufCandidate.per_lot_breakdown
																	?.filter(
																		(row) =>
																			row.buildable_sqft != null &&
																			row.buildable_sqft > 0 &&
																			row.units_rounded != null &&
																			!row.missing_inputs
																	)
																	.map((row) => String(row.units_rounded))
																	.join(" + ")}{" "}
																= {dufCandidate.max_dwelling_units} units total
															</span>
														)}
													</div>
												)}
											</div>
										)}
										{dufCandidate.source_section && (
											<p className="text-xs text-[#605A57]">
												{dufCandidate.source_section}
												{dufCandidate.source_url && (
													<>
														{" · "}
														<a
															href={dufCandidate.source_url}
															target="_blank"
															rel="noopener noreferrer"
															className="text-[#4090C2] hover:underline"
														>
															Source
														</a>
													</>
												)}
											</p>
										)}
										{dufCandidate.notes && (
											<p className="text-amber-700 text-sm mt-2">{dufCandidate.notes}</p>
										)}
										{dufCandidate.requires_manual_review && (
											<p className="text-amber-700 text-sm mt-1">Manual zoning review recommended.</p>
										)}
									</div>
								);
							})()}
							{/* Zoning Consistency */}
							{zoningConsistency && (
								<div className="rounded-lg bg-[#F9F8F6] border border-[rgba(55,50,47,0.08)] p-4">
									<div className="flex flex-wrap items-baseline gap-2 mb-3">
										<span className="text-[#37322F] font-medium">Zoning District Consistency</span>
										<Badge
											variant="outline"
											className={
												zoningConsistency.summary?.confidence === "high"
													? "bg-green-100 text-green-700 border-green-200"
													: zoningConsistency.summary?.confidence === "medium"
														? "bg-amber-100 text-amber-700 border-amber-200"
														: "bg-amber-100 text-amber-700 border-amber-200"
											}
										>
											{zoningConsistency.summary?.confidence ?? "—"} confidence
										</Badge>
									</div>
									<div className="flex flex-wrap gap-2 mb-3">
										<span className="text-sm text-[#605A57]">Primary districts:</span>
										{(zoningConsistency.summary?.primaryDistricts ?? []).map((d, i) => (
											<Badge key={i} variant="outline" className="text-xs font-mono">
												{d ?? "—"}
											</Badge>
										))}
										<span className="text-sm text-[#605A57] ml-2">Normalized:</span>
										{(zoningConsistency.summary?.normalizedProfiles ?? []).map((p, i) => (
											<Badge key={i} variant="outline" className="text-xs font-mono bg-white/60">
												{p ?? "—"}
											</Badge>
										))}
									</div>
									<div className="flex flex-wrap gap-2 mb-3">
										<Badge
											variant="outline"
											className={
												zoningConsistency.summary?.samePrimaryDistrict
													? "bg-green-100 text-green-700 border-green-200"
													: "bg-gray-100 text-gray-600 border-gray-200"
											}
										>
											Same primary district: {zoningConsistency.summary?.samePrimaryDistrict ? "Yes" : "No"}
										</Badge>
										<Badge
											variant="outline"
											className={
												zoningConsistency.summary?.sameNormalizedProfile
													? "bg-green-100 text-green-700 border-green-200"
													: "bg-gray-100 text-gray-600 border-gray-200"
											}
										>
											Same normalized profile: {zoningConsistency.summary?.sameNormalizedProfile ? "Yes" : "No"}
										</Badge>
										{/* Only show Same block when we have BBL data for all addresses */}
										{(zoningConsistency.lots?.length ?? 0) === addressesList.length && (
											<Badge
												variant="outline"
												className={
													zoningConsistency.summary?.sameBlock
														? "bg-green-100 text-green-700 border-green-200"
														: "bg-gray-100 text-gray-600 border-gray-200"
												}
											>
												Same block: {zoningConsistency.summary?.sameBlock ? "Yes" : "No"}
											</Badge>
										)}
									</div>
									{zoningConsistency.summary?.hasAnyOverlay && (
										<p className="text-amber-700 text-sm mb-2">
											Overlays present on at least one lot; verify applicable rules on NYC Zoning Map.
										</p>
									)}
									{zoningConsistency.summary?.hasAnySpecialDistrict && (
										<p className="text-amber-700 text-sm mb-2">
											Special district(s) present; verify applicable rules on NYC Zoning Map / ZR.
										</p>
									)}
									{zoningConsistency.summary?.requires_manual_review && (
										<p className="text-amber-700 text-sm mb-3">Manual zoning review recommended.</p>
									)}
									<div className="text-sm">
										<span className="text-[#605A57] font-medium">Per-lot breakdown</span>
										<ul className="mt-2 space-y-2">
											{(zoningConsistency.lots ?? []).map((lot, i) => (
												<li
													key={lot.bbl ?? i}
													className="flex flex-wrap items-center gap-2 text-[#37322F] bg-white/60 rounded px-3 py-2 border border-[rgba(55,50,47,0.08)]"
												>
													<span className="font-mono text-xs">{lot.bbl ?? "—"}</span>
													{lot.primaryDistrict != null && (
														<Badge variant="outline" className="text-xs">
															{lot.primaryDistrict}
														</Badge>
													)}
													{lot.normalizedProfile != null && (
														<span className="text-[#605A57] text-xs">
															→ {lot.normalizedProfile}
														</span>
													)}
													{lot.flags?.hasOverlay && (
														<span className="text-amber-600 text-xs">Overlay</span>
													)}
													{lot.flags?.hasSpecialDistrict && (
														<span className="text-amber-600 text-xs">Special dist.</span>
													)}
													{lot.flags?.missingZonedist1 && (
														<span className="text-amber-600 text-xs">Missing zonedist1</span>
													)}
												</li>
											))}
										</ul>
									</div>
									{(zoningConsistency.notes?.length ?? 0) > 0 && (
										<ul className="mt-3 text-xs text-[#605A57] space-y-1 list-disc list-inside">
											{zoningConsistency.notes?.map((note, i) => (
												<li key={i}>{note}</li>
											))}
										</ul>
									)}
								</div>
							)}
							{/* Assemblage Contamination Risk */}
							{contaminationRiskData && (
								<div className="rounded-lg bg-[#F9F8F6] border border-[rgba(55,50,47,0.08)] p-4">
									<div className="flex flex-wrap items-baseline gap-2 mb-3">
										<span className="text-[#37322F] font-medium">Assemblage Contamination Risk</span>
										<Badge
											variant="outline"
											className={
												contaminationRiskData.summary?.contaminationRisk === "none"
													? "bg-green-100 text-green-700 border-green-200"
													: contaminationRiskData.summary?.contaminationRisk === "moderate"
														? "bg-amber-100 text-amber-700 border-amber-200"
														: contaminationRiskData.summary?.contaminationRisk === "high"
															? "bg-red-100 text-red-700 border-red-200"
															: "bg-gray-100 text-gray-600 border-gray-200"
											}
										>
											{contaminationRiskData.summary?.contaminationRisk ?? "—"}
										</Badge>
										{contaminationRiskData.summary?.confidence && (
											<Badge variant="outline" className="text-xs text-[#605A57]">
												{contaminationRiskData.summary.confidence} confidence
											</Badge>
										)}
									</div>
									{(contaminationRiskData.summary?.contaminationRisk === "moderate" ||
										contaminationRiskData.summary?.contaminationRisk === "high") && (
										<p className="text-amber-700 text-sm mb-3">Manual review recommended.</p>
									)}
									<div className="text-sm">
										<span className="text-[#605A57] font-medium">Per-lot breakdown</span>
										<ul className="mt-2 space-y-2">
											{(contaminationRiskData.lots ?? []).map((lot, i) => (
												<li
													key={lot.bbl || i}
													className="flex flex-wrap items-start gap-x-4 gap-y-1 text-[#37322F] bg-white/60 rounded px-3 py-2 border border-[rgba(55,50,47,0.08)]"
												>
													<span className="font-mono text-xs shrink-0">{lot.bbl || "—"}</span>
													<span className="text-[#605A57] text-xs">
														Landmark:{" "}
														{lot.flags?.isLandmarked === true
															? "Yes"
															: lot.flags?.isLandmarked === false
																? "No"
																: "Unknown"}
													</span>
													<span className="text-[#605A57] text-xs">
														Historic: {lot.flags?.historicDistrictName ?? "none"}
													</span>
													<span className="text-[#605A57] text-xs">
														Special: {(lot.flags?.specialDistricts?.length ?? 0) > 0 ? lot.flags!.specialDistricts!.join(", ") : "none"}
													</span>
													<span className="text-[#605A57] text-xs">
														Overlays: {(lot.flags?.overlays?.length ?? 0) > 0 ? lot.flags!.overlays!.join(", ") : "none"}
													</span>
												</li>
											))}
										</ul>
									</div>
									{(contaminationRiskData.notes?.length ?? 0) > 0 && (
										<ul className="mt-3 text-xs text-[#605A57] space-y-1 list-disc list-inside">
											{contaminationRiskData.notes?.map((note, i) => (
												<li key={i}>{note}</li>
											))}
										</ul>
									)}
								</div>
							)}
							</>
							)}
							{/* Disclaimer */}
							<div className="pt-2 border-t border-[rgba(55,50,47,0.08)]">
								<p className="text-xs text-[#605A57] leading-relaxed">
									These figures are estimates for planning and feasibility purposes only. They are based on public data (e.g. MapPLUTO) and zoning lookups. Lot area, FAR, and buildable area can be affected by zoning amendments, special districts, and site-specific conditions. Consult a qualified professional for zoning and development decisions.
								</p>
							</div>

							{/* FEMA Flood Map */}
							{(() => {
								const firstCoords = lots.length > 0 ? getCoordsForLot(0) : null;
								const lat = firstCoords?.lat ?? null;
								const lng = firstCoords?.lng ?? null;
								const femaFloodSource = sources.find((s) => s.SourceKey === "fema_flood");
								const femaFloodData =
									femaFloodSource?.ContentJson != null
										? ((femaFloodSource.ContentJson as { contentJson?: unknown }).contentJson ??
												femaFloodSource.ContentJson) as {
												floodZone: string | null;
												floodZoneLabel: string;
												matched: boolean;
												features?: unknown[];
										  } | null
										: null;
								if (lat == null || lng == null) return null;
								return (
									<div className="pt-6 border-t border-[rgba(55,50,47,0.08)]">
										<Card className="bg-[#F9F8F6] border-[rgba(55,50,47,0.12)]">
											<CardContent className="pt-6">
												<h3 className="text-lg font-semibold text-[#37322F] mb-4 flex items-center gap-2">
													<MapPin className="size-5 text-[#4090C2]" />
													FEMA Flood Map
												</h3>
												<FemaFloodMap
													lat={lat}
													lng={lng}
													address={report.Address ?? ""}
													floodZoneData={femaFloodData}
												/>
											</CardContent>
										</Card>
									</div>
								);
							})()}

							{/* Transit Zone Map */}
							{(() => {
								const firstCoords = lots.length > 0 ? getCoordsForLot(0) : null;
								const lat = firstCoords?.lat ?? null;
								const lng = firstCoords?.lng ?? null;
								const transitZoneSource = sources.find((s) => s.SourceKey === "transit_zones");
								const transitZoneData =
									transitZoneSource?.ContentJson != null
										? ((transitZoneSource.ContentJson as { contentJson?: unknown }).contentJson ??
												transitZoneSource.ContentJson) as {
												transitZone: string;
												transitZoneLabel: string;
												matched: boolean;
										  } | null
										: null;
								if (lat == null || lng == null) return null;
								return (
									<div className="pt-6 border-t border-[rgba(55,50,47,0.12)]">
										<Card className="bg-[#F9F8F6] border-[rgba(55,50,47,0.12)]">
											<CardContent className="pt-6">
												<h3 className="text-lg font-semibold text-[#37322F] mb-4 flex items-center gap-2">
													<MapPinCheck className="size-5 text-[#4090C2]" />
													Transit Zone Map
												</h3>
												<TransitZoneMap
													lat={lat}
													lng={lng}
													address={report.Address ?? ""}
													transitZoneData={transitZoneData}
												/>
											</CardContent>
										</Card>
									</div>
								);
							})()}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
