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
	MapPin,
	Send,
	Home,
	Grid2x2Check,
	LandPlot,
	Building2,
	ExternalLink,
	Ruler,
	MapPinCheck,
} from "lucide-react";
import { GoogleMap, Marker, useLoadScript } from "@react-google-maps/api";
import { config } from "@/lib/config";
import FemaFloodMap from "@/components/fema-flood-map";

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
	const arcgisMapRef = useRef<HTMLDivElement>(null);
	const [arcgisScriptLoaded, setArcgisScriptLoaded] = useState(false);
	const [mapElementCreated, setMapElementCreated] = useState(false);

	const [reportData, setReportData] = useState<ReportWithSources | null>(
		null
	);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showDebugMode, setShowDebugMode] = useState(false); // false = pretty mode (default), true = debug mode
	const [densityCandidateId, setDensityCandidateId] = useState<string>("duf_applies"); // Default to "DUF applies"

	useEffect(() => {
		const fetchReport = async () => {
			if (!reportId) return;

			try {
				setIsLoading(true);
				setError(null);
				const data = await getReportWithSources(reportId);
				setReportData(data);
				// Reset density toggle to default when report changes
				setDensityCandidateId("duf_applies");
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

	// Create map element in DOM first (before script loads) so custom element can upgrade it
	// Check periodically until ref is available and we have coordinates
	useEffect(() => {
		if (!reportData) return; // Wait for report data to be loaded

		const sources = reportData.sources || [];
		const geoserviceSource = sources.find((s) => s.SourceKey === "geoservice");
		const zolaSource = sources.find((s) => s.SourceKey === "zola");
		
		const geoserviceData = geoserviceSource?.ContentJson || {};
		const zolaData = zolaSource?.ContentJson?.contentJson || zolaSource?.ContentJson || {};
		
		// Get coordinates (prefer Zola, fallback to Geoservice)
		const lat = zolaData.lat || geoserviceData.lat || null;
		const lng = zolaData.lon || zolaData.lng || geoserviceData.lng || null;
		
		// Default to NYC center if no coordinates available
		const centerLat = lat || 40.696281660383654;
		const centerLng = lng || -73.96328347161334;
		const centerString = `${centerLng},${centerLat}`;

		const checkAndCreate = () => {
			if (arcgisMapRef.current && !arcgisMapRef.current.querySelector("arcgis-embedded-map")) {
				console.log("Creating map element in DOM before script loads with center:", centerString);
				arcgisMapRef.current.innerHTML = `<arcgis-embedded-map style="height:600px;width:100%;" item-id="51d6d85803264b2a81a95ec7b59b9ead" theme="light" heading-enabled legend-enabled share-enabled center="${centerString}" scale="144447.638572" portal-url="https://www.arcgis.com"></arcgis-embedded-map>`;
				return true; // Element created
			}
			return false; // Ref not available yet
		};

		// Try immediately
		if (checkAndCreate()) {
			return;
		}

		// If ref not available, check periodically
		const interval = setInterval(() => {
			if (checkAndCreate()) {
				clearInterval(interval);
			}
		}, 100);

		// Cleanup after 5 seconds max
		const timeout = setTimeout(() => {
			clearInterval(interval);
		}, 5000);

		return () => {
			clearInterval(interval);
			clearTimeout(timeout);
		};
	}, [reportData]);

	// Load ArcGIS embeddable components script and wait for custom element to be defined
	useEffect(() => {
		// Check if script is already loaded
		const existingScript = document.querySelector(
			'script[src="https://js.arcgis.com/4.34/embeddable-components/"]'
		);

		const initializeMap = () => {
			if (customElements.get("arcgis-embedded-map")) {
				console.log("arcgis-embedded-map custom element already defined");
				setArcgisScriptLoaded(true);
			} else {
				customElements
					.whenDefined("arcgis-embedded-map")
					.then(() => {
						console.log("arcgis-embedded-map custom element is now defined");
						setArcgisScriptLoaded(true);
					})
					.catch((error) => {
						console.log("Custom element not defined, retrying...", error);
						setTimeout(() => {
							if (customElements.get("arcgis-embedded-map")) {
								setArcgisScriptLoaded(true);
							} else {
								// Force set loaded after delay
								setTimeout(() => setArcgisScriptLoaded(true), 2000);
							}
						}, 2000);
					});
			}
		};

		if (existingScript) {
			// Script already exists
			setTimeout(initializeMap, 500);
		} else {
			// Create and load script
			const script = document.createElement("script");
			script.type = "module";
			script.src = "https://js.arcgis.com/4.34/embeddable-components/";
			script.onload = () => {
				console.log("ArcGIS script loaded, waiting for custom element definition");
				setTimeout(initializeMap, 1000);
			};
			script.onerror = () => {
				console.error("Failed to load ArcGIS embeddable components");
			};
			document.head.appendChild(script);
		}
	}, []);

	// Remove loading message when script is loaded and inspect element API
	// This runs whenever arcgisScriptLoaded changes, and checks periodically for ref availability
	useEffect(() => {
		if (!arcgisScriptLoaded || !reportData) {
			return;
		}

		// Get coordinates from report data
		const sources = reportData.sources || [];
		const geoserviceSource = sources.find((s) => s.SourceKey === "geoservice");
		const zolaSource = sources.find((s) => s.SourceKey === "zola");
		
		const geoserviceData = geoserviceSource?.ContentJson || {};
		const zolaData = zolaSource?.ContentJson?.contentJson || zolaSource?.ContentJson || {};
		
		const lat = zolaData.lat || geoserviceData.lat || null;
		const lng = zolaData.lon || zolaData.lng || geoserviceData.lng || null;

		const performInspection = () => {
			if (!arcgisMapRef.current) {
				return false; // Ref not available yet
			}

			const loadingDiv = arcgisMapRef.current.querySelector("div");
			if (loadingDiv && loadingDiv.textContent?.includes("Loading transit zone map")) {
				loadingDiv.remove();
			}
			
			// Wait a bit for element to be fully upgraded
			setTimeout(() => {
				// Verify element exists and inspect its API
				const mapElement = arcgisMapRef.current?.querySelector("arcgis-embedded-map");
				
				if (mapElement) {
					// Update center property if we have coordinates
					if (lat && lng && mapElement.center) {
						try {
							(mapElement as any).center = [lng, lat];
							console.log("Updated map center to property coordinates:", [lng, lat]);
						} catch (error) {
							console.log("Could not update center property:", error);
						}
					}
					console.log("=== ArcGIS Map Element Inspection ===");
					console.log("Element:", mapElement);
					console.log("Element tagName:", mapElement.tagName);
					console.log("Element constructor:", mapElement.constructor.name);
					
					// Check for Shadow DOM
					if (mapElement.shadowRoot) {
						console.log("Shadow DOM found:", mapElement.shadowRoot);
						
						// Search for standard inputs
						const shadowInputs = mapElement.shadowRoot.querySelectorAll("input");
						console.log("Standard inputs in Shadow DOM:", shadowInputs.length, shadowInputs);
						
						// Search for custom elements that might be search inputs (ArcGIS/Calcite components)
						const customSearchElements = mapElement.shadowRoot.querySelectorAll(
							'calcite-input, calcite-search, calcite-combobox, esri-search, esri-search-widget, [role="search"], [aria-label*="search" i], [placeholder*="search" i]'
						);
						console.log("Custom search elements found:", customSearchElements.length, customSearchElements);
						
						// Look for any elements with search-related attributes
						const allElements = mapElement.shadowRoot.querySelectorAll("*");
						const searchRelatedElements: Element[] = [];
						allElements.forEach((el) => {
							const ariaLabel = el.getAttribute("aria-label")?.toLowerCase() || "";
							const placeholder = el.getAttribute("placeholder")?.toLowerCase() || "";
							const role = el.getAttribute("role")?.toLowerCase() || "";
							const id = el.id?.toLowerCase() || "";
							const className = el.className?.toString().toLowerCase() || "";
							
							if (
								ariaLabel.includes("search") ||
								placeholder.includes("search") ||
								role.includes("search") ||
								id.includes("search") ||
								className.includes("search")
							) {
								searchRelatedElements.push(el);
							}
						});
						console.log("Elements with search-related attributes:", searchRelatedElements.length, searchRelatedElements);
						
						// Log details of search-related elements
						searchRelatedElements.forEach((el, idx) => {
							console.log(`Search-related element ${idx}:`, {
								tagName: el.tagName,
								id: el.id,
								className: el.className,
								ariaLabel: el.getAttribute("aria-label"),
								placeholder: el.getAttribute("placeholder"),
								role: el.getAttribute("role"),
								value: (el as any).value,
								textContent: el.textContent?.substring(0, 50)
							});
						});
						
						// Try to find the ArcGIS Search widget specifically
						const esriWidgets = mapElement.shadowRoot.querySelectorAll("[class*='esri'], [class*='search'], [id*='search']");
						console.log("Potential ESRI widgets:", esriWidgets.length);
						esriWidgets.forEach((widget, idx) => {
							if (idx < 5) { // Limit to first 5
								console.log(`Widget ${idx}:`, {
									tagName: widget.tagName,
									id: widget.id,
									className: widget.className,
									innerHTML: widget.innerHTML?.substring(0, 100)
								});
							}
						});
						
						// Check if we can access nested Shadow DOMs
						const allCustomElements = mapElement.shadowRoot.querySelectorAll("*");
						allCustomElements.forEach((el) => {
							if (el.shadowRoot) {
								console.log(`Nested Shadow DOM found in ${el.tagName}:`, el.shadowRoot);
								const nestedInputs = el.shadowRoot.querySelectorAll("input");
								if (nestedInputs.length > 0) {
									console.log(`Found ${nestedInputs.length} inputs in nested Shadow DOM of ${el.tagName}`);
								}
							}
						});
					} else {
						console.log("No Shadow DOM found");
					}
					
					// Check for properties
					console.log("Element properties:", Object.getOwnPropertyNames(mapElement));
					console.log("Element prototype:", Object.getOwnPropertyNames(Object.getPrototypeOf(mapElement)));
					
					// Check for common ArcGIS properties
					const possibleProps = ['itemId', 'item-id', 'center', 'scale', 'address', 'searchAddress', 'currentAddress'];
					possibleProps.forEach(prop => {
						if (prop in mapElement) {
							console.log(`Property "${prop}":`, (mapElement as any)[prop]);
						}
					});
					
					// Check for methods
					const possibleMethods = ['search', 'searchAddress', 'getAddress', 'getCurrentAddress', 'setAddress'];
					possibleMethods.forEach(method => {
						if (typeof (mapElement as any)[method] === 'function') {
							console.log(`Method "${method}" exists`);
						}
					});
					
					// Check for event listeners or events
					console.log("Checking for events...");
					const testEvents = ['addresschange', 'address-selected', 'search', 'search-complete'];
					testEvents.forEach(eventName => {
						mapElement.addEventListener(eventName, (e) => {
							console.log(`Event "${eventName}" fired:`, e);
						});
					});
					
					// Try to access all attributes
					console.log("All attributes:", Array.from(mapElement.attributes).map(attr => `${attr.name}="${attr.value}"`));
					
					// Check for internal properties (might be prefixed with _ or $)
					const allKeys = Object.keys(mapElement);
					const internalKeys = allKeys.filter(key => key.startsWith('_') || key.startsWith('$'));
					if (internalKeys.length > 0) {
						console.log("Internal properties found:", internalKeys);
					}
					
					console.log("=== End Inspection ===");
					return true; // Inspection completed
				} else {
					console.log("Map element not found yet, ref content:", arcgisMapRef.current?.innerHTML);
					return false; // Element not found yet
				}
			}, 500); // Wait 500ms for element to be fully upgraded
			return true; // Started inspection
		};

		// Try immediately
		if (performInspection()) {
			return;
		}

		// If ref not available, check periodically (ref is attached when parking section renders)
		const interval = setInterval(() => {
			if (performInspection()) {
				clearInterval(interval);
			}
		}, 200);

		// Stop checking after 10 seconds
		const timeout = setTimeout(() => {
			clearInterval(interval);
		}, 10000);

		return () => {
			clearInterval(interval);
			clearTimeout(timeout);
		};
	}, [arcgisScriptLoaded, reportData]);

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
							<Card className="mb-6">
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

										{/* Required Yards */}
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
						)}

						{/* Zoning Constraints Section */}
						{formattedData.zoningResolution &&
							formattedData.zoningResolution.maxFar != null && (
								<Card className="mb-6">
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
													<p className="text-sm font-semibold text-[#37322F] mb-3">
														Derived Calculations
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
																View & open this page to verify transit zone information.
															</p>
															<div className="border border-[rgba(55,50,47,0.12)] rounded-md overflow-hidden">
																<div ref={arcgisMapRef} style={{ minHeight: "600px", width: "100%" }}>
																	{!arcgisScriptLoaded && (
																		<div className="flex items-center justify-center h-[600px] text-[#605A57]">
																			Loading transit zone map...
																		</div>
																	)}
																</div>
															</div>
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
								<Card>
									<CardContent className="pt-6">
										<div>
											<h3 className="text-lg font-semibold text-[#37322F] mb-4 flex items-center gap-2">
												<MapPin className="w-5 h-5 text-[#4090C2]" />
												FEMA Flood Map
											</h3>
											<FemaFloodMap
												lat={lat}
												lng={lng}
												address={report.Address}
												floodZoneData={femaFloodData}
											/>
										</div>
									</CardContent>
								</Card>
							);
						})()}

						{/* Neighborhood Information */}
						<Card>
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
