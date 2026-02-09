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
import { Input } from "@/components/ui/input";
import { GoogleMap, Marker, useLoadScript } from "@react-google-maps/api";
import { getReportWithSources, type ReportWithSources } from "@/lib/reports";
import type { ReportSource } from "@/lib/reports";
import { getBuildingClassDescriptionText } from "@/lib/building-class";
import { getLandUseDescriptionText } from "@/lib/land-use";
import { config } from "@/lib/config";
import { toast } from "sonner";
import FemaFloodMap, { type FemaFloodMapHandle } from "@/components/fema-flood-map";
import TransitZoneMap, { type TransitZoneMapHandle } from "@/components/transit-zone-map";

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
	existingFloorAreaSqft?: number | null;
}

/** User-entered "ghost" lot for scenario when BBL/data is missing (ZR § 23-52, merger logic). */
interface GhostLotInput {
	lotAreaSqft: number | "";
	existingFloorAreaSqft: number | "";
	zoningDistrict: string;
	contiguityLinearFt: number | "";
}

/** Min contiguity (ft) for zoning lot merger eligibility; below this show warning. */
const CONTIGUITY_MIN_FT = 10;

/** FAR and DUF for scenario ghost lot by district (subset of ZR § 23-21 / 23-22; DUF 680 per ZR § 23-52). */
const DISTRICT_FAR_DUF: Record<string, { far: number; duf: number }> = {
	R1: { far: 0.75, duf: 680 },
	R1A: { far: 0.75, duf: 680 },
	R2: { far: 1.0, duf: 680 },
	R2A: { far: 1.0, duf: 680 },
	R3: { far: 1.0, duf: 680 },
	"R3-1": { far: 1.0, duf: 680 },
	"R3-2": { far: 1.0, duf: 680 },
	R4: { far: 1.5, duf: 680 },
	"R4-1": { far: 1.5, duf: 680 },
	R5: { far: 2.0, duf: 680 },
	R5A: { far: 2.0, duf: 680 },
	R5B: { far: 2.0, duf: 680 },
	R6: { far: 2.2, duf: 680 },
	"R6-1": { far: 3.0, duf: 680 },
	"R6-2": { far: 2.5, duf: 680 },
	R6A: { far: 3.0, duf: 680 },
	R6B: { far: 2.0, duf: 680 },
	R6D: { far: 2.5, duf: 680 },
	R7: { far: 3.44, duf: 680 },
	"R7-1": { far: 3.44, duf: 680 },
	"R7-2": { far: 3.44, duf: 680 },
	R7A: { far: 4.0, duf: 680 },
	R7B: { far: 3.0, duf: 680 },
	R7D: { far: 4.66, duf: 680 },
	R8: { far: 6.02, duf: 680 },
	R8A: { far: 6.02, duf: 680 },
	R8B: { far: 4.0, duf: 680 },
	R9: { far: 7.52, duf: 680 },
	R9A: { far: 7.52, duf: 680 },
	"R9-1": { far: 9.0, duf: 680 },
	R9D: { far: 9.0, duf: 680 },
	R10: { far: 10.0, duf: 680 },
	R10A: { far: 10.0, duf: 680 },
};

function getFarDufForDistrict(district: string): { far: number; duf: number } | null {
	if (!district || typeof district !== "string") return null;
	const key = district.trim().toUpperCase();
	return DISTRICT_FAR_DUF[key] ?? null;
}

/** ZR § 23-52: fractional part >= 0.75 round up, else round down. */
function roundDwellingUnitsByZR(floorAreaSqft: number, duf: number): { units_raw: number; units_rounded: number } {
	if (floorAreaSqft <= 0 || !duf) return { units_raw: 0, units_rounded: 0 };
	const ROUNDING_THRESHOLD = 0.75;
	const unitsRaw = floorAreaSqft / duf;
	const fractionalPart = unitsRaw - Math.floor(unitsRaw);
	const unitsRounded =
		fractionalPart >= ROUNDING_THRESHOLD ? Math.ceil(unitsRaw) : Math.floor(unitsRaw);
	return { units_raw: unitsRaw, units_rounded: Math.max(0, unitsRounded) };
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
	const [ghostLot, setGhostLot] = useState<GhostLotInput>({
		lotAreaSqft: "",
		existingFloorAreaSqft: "",
		zoningDistrict: "",
		contiguityLinearFt: "",
	});
	const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
	const femaMapRef = useRef<FemaFloodMapHandle>(null);
	const transitMapRef = useRef<TransitZoneMapHandle>(null);

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

	// Hooks must run unconditionally (before any early return). Compute from reportData/ghostLot.
	const mergedScenario = useMemo(() => {
		const sources = reportData?.sources ?? [];
		const aggSource = sources.find((s) => s.SourceKey === "assemblage_aggregation");
		const rawAgg = aggSource?.ContentJson;
		const aggregation: AssemblageAggregation | null = rawAgg
			? (typeof rawAgg === "object" && "lots" in rawAgg
					? rawAgg
					: (rawAgg as Record<string, unknown>)?.contentJson ?? rawAgg) as AssemblageAggregation
			: null;
		const lots = aggregation?.lots ?? [];
		const knownLotAreaSqft = lots.reduce((sum, l) => sum + (l.lotarea > 0 ? l.lotarea : 0), 0);
		const knownExistingFloorAreaSqft = lots.reduce(
			(sum, l) => sum + (l.existingFloorAreaSqft ?? 0),
			0
		);
		const primaryZoningKnown = lots.length > 0 ? (lots[0].zonedist1 ?? null) : null;
		const ghostLotArea = typeof ghostLot.lotAreaSqft === "number" ? ghostLot.lotAreaSqft : 0;
		const ghostExisting = typeof ghostLot.existingFloorAreaSqft === "number" ? ghostLot.existingFloorAreaSqft : 0;
		const ghostContiguity = typeof ghostLot.contiguityLinearFt === "number" ? ghostLot.contiguityLinearFt : null;
		const ghostDistrict = (ghostLot.zoningDistrict || "").trim().toUpperCase();
		const farDufGhost = ghostDistrict ? getFarDufForDistrict(ghostDistrict) : null;
		if (ghostLotArea <= 0 || !farDufGhost) return null;
		const combinedLotAreaSqftM = knownLotAreaSqft + ghostLotArea;
		const effectiveFAR = farDufGhost.far;
		const totalBuildingBudgetSqft = combinedLotAreaSqftM * effectiveFAR;
		const totalExistingFloorAreaSqft = knownExistingFloorAreaSqft + ghostExisting;
		const remainingBuildableSqft = Math.max(0, totalBuildingBudgetSqft - totalExistingFloorAreaSqft);
		const { units_rounded: mergedUnits } = roundDwellingUnitsByZR(totalBuildingBudgetSqft, farDufGhost.duf);
		const zoningMismatch =
			primaryZoningKnown &&
			ghostDistrict &&
			primaryZoningKnown.trim().toUpperCase() !== ghostDistrict;
		const contiguityLow =
			ghostContiguity != null && ghostContiguity < CONTIGUITY_MIN_FT;
		return {
			combinedLotAreaSqft: combinedLotAreaSqftM,
			totalBuildingBudgetSqft,
			totalExistingFloorAreaSqft,
			remainingBuildableSqft,
			mergedUnits,
			effectiveFAR,
			duf: farDufGhost.duf,
			zoningMismatch,
			contiguityLow,
		};
	}, [reportData, ghostLot]);

	const reportSections = useMemo(() => {
		const base = [
			{ id: "assemblage-map", label: "Assemblage map" },
			{ id: "property-address-details", label: "Property Address Details" },
			{ id: "combined-lot-area", label: "Combined Lot Area" },
			{ id: "total-buildable-far", label: "Total Buildable (FAR)" },
			{ id: "density-duf", label: "Density (DUF)" },
			{ id: "zoning-district-consistency", label: "Zoning District Consistency" },
			{ id: "assemblage-contamination-risk", label: "Assemblage Contamination Risk" },
			{ id: "fema-flood-map", label: "FEMA Flood Map" },
			{ id: "transit-zone-map", label: "Transit Zone Map" },
		];
		const sources = reportData?.sources ?? [];
		const list = sources.filter((s) => s.SourceKey === "geoservice");
		const byIndex: Record<number, ReportSource> = {};
		list.forEach((s) => {
			const cj = s.ContentJson as { childIndex?: number } | null;
			if (cj != null && typeof cj.childIndex === "number") byIndex[cj.childIndex] = s;
		});
		const assemblageInput = sources.find((s) => s.SourceKey === "assemblage_input")?.ContentJson as { addresses?: string[] } | null;
		const addressIndices = assemblageInput?.addresses?.length != null
			? Array.from({ length: assemblageInput.addresses!.length }, (_, i) => i)
			: Object.keys(byIndex).map(Number).sort((a, b) => a - b);
		const hasMissingBbl = addressIndices.some((i) => {
			const geo = byIndex[i]?.ContentJson as { extracted?: { bbl?: string | null } } | null;
			const extracted = geo?.extracted;
			const hasBbl = !!(extracted?.bbl != null && String(extracted.bbl).trim() !== "");
			return !hasBbl;
		});
		if (hasMissingBbl) {
			// Scenario report: hide sections that are covered by "Merged scenario"
			const excludedInScenario = new Set([
				"combined-lot-area",
				"total-buildable-far",
				"density-duf",
				"zoning-district-consistency",
				"assemblage-contamination-risk",
			]);
			const filtered = base.filter((s) => !excludedInScenario.has(s.id));
			const idx = filtered.findIndex((s) => s.id === "property-address-details");
			const before = filtered.slice(0, idx + 1);
			const after = filtered.slice(idx + 1);
			return [...before, { id: "merged-scenario", label: "Merged scenario" }, ...after];
		}
		return base;
	}, [reportData]);

	// Intersection Observer + scroll listener: highlight TOC item for the section currently in view
	useEffect(() => {
		if (showDebugMode) return;
		const baseSectionIds = [
			"assemblage-map",
			"property-address-details",
			"combined-lot-area",
			"total-buildable-far",
			"density-duf",
			"zoning-district-consistency",
			"assemblage-contamination-risk",
			"fema-flood-map",
			"transit-zone-map",
		];
		// Include merged-scenario if it exists (when BBL missing)
		const sectionIds = [...baseSectionIds];
		if (document.getElementById("merged-scenario")) {
			sectionIds.splice(2, 0, "merged-scenario");
		}

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

			// Find the section that is currently "active" (in the top portion of viewport)
			// Priority: section whose top is between 0-150px (accounting for sticky header)
			const headerOffset = 100;
			const activeZone = tops.filter((x) => x.top >= headerOffset && x.top <= headerOffset + 200);
			
			let active: typeof tops[0] | null = null;
			if (activeZone.length > 0) {
				// Pick the one closest to the header offset
				active = activeZone.sort((a, b) => Math.abs(a.top - headerOffset) - Math.abs(b.top - headerOffset))[0];
			} else {
				// If none in active zone, pick the topmost section that's above the viewport or just entered
				const aboveOrJustEntered = tops.filter((x) => x.top <= headerOffset + 50);
				if (aboveOrJustEntered.length > 0) {
					active = aboveOrJustEntered.sort((a, b) => b.top - a.top)[0];
				} else {
					// Fallback: first section that's visible
					const visible = tops.filter((x) => x.top < window.innerHeight && x.bottom > 0);
					if (visible.length > 0) {
						active = visible.sort((a, b) => a.top - b.top)[0];
					}
				}
			}
			
			if (active) setActiveSectionId(active.id);
		};

		// Throttled scroll handler for smooth updates
		let scrollTimeout: NodeJS.Timeout | null = null;
		const handleScroll = () => {
			if (scrollTimeout) return;
			scrollTimeout = setTimeout(() => {
				updateActive();
				scrollTimeout = null;
			}, 50); // Update every 50ms during scroll
		};

		// Intersection Observer as backup/initial detection
		const io = new IntersectionObserver(
			() => updateActive(),
			{ rootMargin: "-100px 0px -50% 0px", threshold: 0 }
		);

		for (const id of sectionIds) {
			const el = document.getElementById(id);
			if (el) io.observe(el);
		}
		
		// Initial update after DOM is ready
		const initTimeout = setTimeout(() => {
			updateActive();
		}, 100);
		
		// Listen to scroll events
		window.addEventListener("scroll", handleScroll, { passive: true });
		
		return () => {
			clearTimeout(initTimeout);
			io.disconnect();
			window.removeEventListener("scroll", handleScroll);
			if (scrollTimeout) clearTimeout(scrollTimeout);
		};
	}, [showDebugMode, reportData]);

	const handleTocClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
		e.preventDefault();
		setActiveSectionId(id);
		const el = document.getElementById(id);
		el?.scrollIntoView({ behavior: "smooth", block: "start" });
	};

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

	// First address that has coords (for FEMA/Transit maps when some addresses may lack BBL)
	const firstAvailableCoords = (() => {
		for (let i = 0; i < displayItems.length; i++) {
			const coords = getCoordsForLot(i);
			if (coords) return { ...coords, address: displayItems[i]?.address ?? report.Address ?? "", index: i };
		}
		return null;
	})();

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
	const handleDownloadPdf = async () => {
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
		const addressTitle = (report.Address || "Assemblage Report").replace(/[\\/:*?"<>|]/g, " ").trim() || "Assemblage Report";
		document.title = addressTitle;
		const onAfterPrint = () => {
			document.title = previousTitle;
			window.removeEventListener("afterprint", onAfterPrint);
		};
		window.addEventListener("afterprint", onAfterPrint);
		setTimeout(() => window.print(), 150);
	};

	return (
		<div className="p-8 bg-[#F7F5F3] min-h-screen" data-report-print-root>
			<div className="max-w-6xl mx-auto flex gap-10">
				<main className="flex-1 min-w-0 max-w-5xl space-y-6">
				<div className="print-hide-top-bar">
					<Button
						variant="ghost"
						onClick={() => router.push("/reports")}
						className="mb-2"
					>
						<ArrowLeft className="size-4 mr-2" />
						Back to Reports
					</Button>

					{/* Share / Download as PDF */}
					<div className="flex flex-wrap items-center justify-between gap-3 mb-2">
					<div />
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
				</div>

				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex flex-col gap-2">
						<h1 className="text-2xl font-semibold text-[#37322F]">
							Assemblage Report
						</h1>
						<div className="flex flex-wrap items-center gap-2">
							{report.CreatedAt && (
								<Badge className="bg-green-100 text-green-700 border-green-200">
									Report Generated:{" "}
									{format(new Date(report.CreatedAt), "M/d/yyyy")}
								</Badge>
							)}
							{creator && (
								<Badge className="bg-blue-100 text-blue-700 border-blue-200">
									Created by: {creator.Name}
								</Badge>
							)}
						</div>
					</div>
					{process.env.NODE_ENV !== "production" && (
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
					)}
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
							<div id="assemblage-map" className="rounded-lg bg-[#F9F8F6] border border-[rgba(55,50,47,0.08)] p-4 scroll-mt-8">
								<p className="text-sm font-medium text-[#37322F] mb-3">Assemblage map</p>
								<AssemblageMap addresses={assemblageAddresses} />
							</div>
							<div
								id="property-address-details"
								className={
									`scroll-mt-8 ${displayItems.length === 3
										? "grid grid-cols-1 md:grid-cols-3 gap-4"
										: "grid grid-cols-1 md:grid-cols-2 gap-4"}`
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
								<div id="merged-scenario" className="space-y-6 scroll-mt-8">
									<div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
										<p className="text-amber-800 font-medium mb-2">
											Missing BBL data for {addressesMissingBbl.length === 1 ? "address" : "addresses"}:{" "}
											{addressesMissingBbl.join(", ")}
										</p>
										<p className="text-sm text-amber-800 mb-3">
											We can&apos;t automatically calculate Combined Lot Area, Total Buildable (FAR), Density (DUF), Zoning District Consistency, or Assemblage Contamination Risk. You can enter data for the missing lot below to see a merged scenario (Zoning Lot Merger).
										</p>
									</div>
									{/* Scenario form: ghost lot inputs */}
									<div className="rounded-lg bg-[#F9F8F6] border border-[rgba(55,50,47,0.08)] p-4">
										<h4 className="text-[#37322F] font-semibold mb-3">Scenario — missing lot data</h4>
										<p className="text-sm text-[#605A57] mb-4">
											Enter data for the missing lot to simulate a merged zoning lot and see Combined Lot Area, Total Building Budget, Remaining Buildable Floor Area, and Density (ZR § 23-52).
										</p>
										<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
											<div>
												<Label htmlFor="ghost-lot-area" className="text-sm text-[#605A57]">Lot Area (sq ft)</Label>
												<Input
													id="ghost-lot-area"
													type="number"
													min={0}
													step={1}
													placeholder="e.g. 2000"
													className="mt-1 bg-white border-[rgba(55,50,47,0.2)]"
													value={ghostLot.lotAreaSqft === "" ? "" : ghostLot.lotAreaSqft}
													onChange={(e) => {
														const v = e.target.value;
														setGhostLot((prev) => ({
															...prev,
															lotAreaSqft: v === "" ? "" : Math.max(0, Number(v)) || 0,
														}));
													}}
												/>
											</div>
											<div>
												<Label htmlFor="ghost-existing-floor" className="text-sm text-[#605A57]">Existing Floor Area (sq ft)</Label>
												<Input
													id="ghost-existing-floor"
													type="number"
													min={0}
													step={1}
													placeholder="e.g. 0"
													className="mt-1 bg-white border-[rgba(55,50,47,0.2)]"
													value={ghostLot.existingFloorAreaSqft === "" ? "" : ghostLot.existingFloorAreaSqft}
													onChange={(e) => {
														const v = e.target.value;
														setGhostLot((prev) => ({
															...prev,
															existingFloorAreaSqft: v === "" ? "" : Math.max(0, Number(v)) || 0,
														}));
													}}
												/>
											</div>
											<div>
												<Label htmlFor="ghost-zoning" className="text-sm text-[#605A57]">Zoning District</Label>
												<Input
													id="ghost-zoning"
													type="text"
													placeholder="e.g. R6, R7-2"
													className="mt-1 bg-white border-[rgba(55,50,47,0.2)]"
													value={ghostLot.zoningDistrict}
													onChange={(e) =>
														setGhostLot((prev) => ({ ...prev, zoningDistrict: e.target.value }))
													}
												/>
											</div>
											<div>
												<Label htmlFor="ghost-contiguity" className="text-sm text-[#605A57]">Contiguity (Linear Ft)</Label>
												<Input
													id="ghost-contiguity"
													type="number"
													min={0}
													step={1}
													placeholder={`min ${CONTIGUITY_MIN_FT} ft`}
													className="mt-1 bg-white border-[rgba(55,50,47,0.2)]"
													value={ghostLot.contiguityLinearFt === "" ? "" : ghostLot.contiguityLinearFt}
													onChange={(e) => {
														const v = e.target.value;
														setGhostLot((prev) => ({
															...prev,
															contiguityLinearFt: v === "" ? "" : Math.max(0, Number(v)) || 0,
														}));
													}}
												/>
											</div>
										</div>
										<Button
											type="button"
											variant="outline"
											size="sm"
											className="mt-4"
											onClick={() =>
												setGhostLot({
													lotAreaSqft: "",
													existingFloorAreaSqft: "",
													zoningDistrict: "",
													contiguityLinearFt: "",
												})
											}
										>
											Clear scenario
										</Button>
									</div>
									{/* Merged scenario results */}
									{mergedScenario && (
										<div className="rounded-lg bg-[#F9F8F6] border border-[rgba(55,50,47,0.08)] p-4 space-y-4">
											<h4 className="text-[#37322F] font-semibold">Merged scenario results</h4>
											{(mergedScenario.zoningMismatch || mergedScenario.contiguityLow) && (
												<div className="space-y-2">
													{mergedScenario.zoningMismatch && (
														<p className="text-amber-700 text-sm">
															Different primary zoning districts (known lot vs scenario). Merger may not be permitted or may require special review.
														</p>
													)}
													{mergedScenario.contiguityLow && (
														<p className="text-amber-700 text-sm">
															Contiguity below {CONTIGUITY_MIN_FT} ft; lots may not be eligible for zoning lot merger.
														</p>
													)}
												</div>
											)}
											<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
												<div>
													<p className="text-[#605A57] mb-1">Combined Lot Area</p>
													<p className="text-[#37322F] font-medium">
														{mergedScenario.combinedLotAreaSqft.toLocaleString()} sq ft
													</p>
												</div>
												<div>
													<p className="text-[#605A57] mb-1">Total Building Budget (FAR × combined)</p>
													<p className="text-[#37322F] font-medium">
														{mergedScenario.totalBuildingBudgetSqft.toLocaleString()} sq ft
													</p>
													<p className="text-xs text-[#605A57] mt-0.5">
														FAR {mergedScenario.effectiveFAR} × {mergedScenario.combinedLotAreaSqft.toLocaleString()} sq ft
													</p>
												</div>
												<div>
													<p className="text-[#605A57] mb-1">Total Existing Floor Area</p>
													<p className="text-[#37322F] font-medium">
														{mergedScenario.totalExistingFloorAreaSqft.toLocaleString()} sq ft
													</p>
												</div>
												<div>
													<p className="text-[#605A57] mb-1">Remaining Buildable Floor Area</p>
													<p className="text-[#37322F] font-medium">
														{mergedScenario.remainingBuildableSqft.toLocaleString()} sq ft
													</p>
												</div>
												<div>
													<p className="text-[#605A57] mb-1">Density (max dwelling units, ZR § 23-52)</p>
													<p className="text-[#37322F] font-medium">
														{mergedScenario.mergedUnits} units
													</p>
													<p className="text-xs text-[#605A57] mt-0.5">
														Building budget ÷ DUF {mergedScenario.duf}; fraction ≥ 0.75 rounds up.
													</p>
												</div>
											</div>
											<p className="text-xs text-[#605A57]">
												<a href="https://zr.planning.nyc.gov/article-ii/chapter-3#23-52" target="_blank" rel="noopener noreferrer" className="text-[#4090C2] hover:underline">ZR § 23-52</a> — DUF and rounding apply to merged lot. These figures are estimates for planning only; consult a qualified professional.
											</p>
										</div>
									)}
								</div>
							) : (
							<>
							{/* Combined Lot Area */}
							<div id="combined-lot-area" className="rounded-lg bg-[#F9F8F6] border border-[rgba(55,50,47,0.08)] p-4 scroll-mt-8">
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
								<div id="total-buildable-far" className="rounded-lg bg-[#F9F8F6] border border-[rgba(55,50,47,0.08)] p-4 scroll-mt-8">
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
									<div id="density-duf" className="rounded-lg bg-[#F9F8F6] border border-[rgba(55,50,47,0.08)] p-4 scroll-mt-8">
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
								<div id="zoning-district-consistency" className="rounded-lg bg-[#F9F8F6] border border-[rgba(55,50,47,0.08)] p-4 scroll-mt-8">
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
								<div id="assemblage-contamination-risk" className="rounded-lg bg-[#F9F8F6] border border-[rgba(55,50,47,0.08)] p-4 scroll-mt-8">
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
							{/* FEMA Flood Map & Transit Zone Map: show for first address that has coords (so maps show even when some addresses lack BBL) */}
							{firstAvailableCoords && (
								<>
									<div id="fema-flood-map" className="pt-6 border-t border-[rgba(55,50,47,0.08)] scroll-mt-8">
										<Card className="bg-[#F9F8F6] border-[rgba(55,50,47,0.12)]">
											<CardContent className="pt-6">
												<h3 className="text-lg font-semibold text-[#37322F] mb-4 flex items-center gap-2">
													<MapPin className="size-5 text-[#4090C2]" />
													FEMA Flood Map
												</h3>
												<FemaFloodMap
													ref={femaMapRef}
													lat={firstAvailableCoords.lat}
													lng={firstAvailableCoords.lng}
													address={firstAvailableCoords.address}
													printImageId="fema-flood-map-print-image"
													floodZoneData={
														sources.find((s) => s.SourceKey === "fema_flood")?.ContentJson != null
															? ((sources.find((s) => s.SourceKey === "fema_flood")!.ContentJson as { contentJson?: unknown }).contentJson ??
																	sources.find((s) => s.SourceKey === "fema_flood")!.ContentJson) as {
																	floodZone: string | null;
																	floodZoneLabel: string;
																	matched: boolean;
																	features?: unknown[];
															  } | null
															: null
													}
												/>
											</CardContent>
										</Card>
									</div>
									<div id="transit-zone-map" className="pt-6 border-t border-[rgba(55,50,47,0.12)] scroll-mt-8">
										<Card className="bg-[#F9F8F6] border-[rgba(55,50,47,0.12)]">
											<CardContent className="pt-6">
												<h3 className="text-lg font-semibold text-[#37322F] mb-4 flex items-center gap-2">
													<MapPinCheck className="size-5 text-[#4090C2]" />
													Transit Zone Map
												</h3>
												<TransitZoneMap
													ref={transitMapRef}
													lat={firstAvailableCoords.lat}
													lng={firstAvailableCoords.lng}
													address={firstAvailableCoords.address}
													printImageId="transit-zone-map-print-image"
													transitZoneData={
														sources.find((s) => s.SourceKey === "transit_zones")?.ContentJson != null
															? ((sources.find((s) => s.SourceKey === "transit_zones")!.ContentJson as { contentJson?: unknown }).contentJson ??
																	sources.find((s) => s.SourceKey === "transit_zones")!.ContentJson) as {
																	transitZone: string;
																	transitZoneLabel: string;
																	matched: boolean;
															  } | null
															: null
													}
												/>
											</CardContent>
										</Card>
									</div>
								</>
							)}
						</div>
					</div>
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
