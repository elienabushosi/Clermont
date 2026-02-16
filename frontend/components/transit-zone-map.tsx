"use client";

import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";

interface TransitZoneMapProps {
	lat: number;
	lng: number;
	address: string;
	/** ID for print-only image (PDF export) */
	printImageId?: string;
	transitZoneData?: {
		transitZone: string;
		transitZoneLabel: string;
		matched: boolean;
	} | null;
}

export interface TransitZoneMapHandle {
	takeScreenshot(): Promise<string | null>;
}

// Declare global ArcGIS types
declare global {
	interface Window {
		require: any;
	}
}

const TransitZoneMap = forwardRef<TransitZoneMapHandle, TransitZoneMapProps>(function TransitZoneMap(
	{
		lat,
		lng,
		address,
		printImageId,
		transitZoneData,
	},
	ref
) {
	const wrapperRef = useRef<HTMLDivElement>(null);
	const mapContainerId = useRef(`transit-zone-map-${Date.now()}-${Math.random()}`);
	const mapViewRef = useRef<any>(null);
	const [mapLoaded, setMapLoaded] = useState(false);
	const [mapError, setMapError] = useState<string | null>(null);
	const scriptLoadedRef = useRef(false);

	useImperativeHandle(ref, () => ({
		async takeScreenshot(): Promise<string | null> {
			const view = mapViewRef.current;
			if (!view || typeof view.takeScreenshot !== "function") return null;
			try {
				const result = await view.takeScreenshot({ format: "png" });
				return result?.dataUrl ?? null;
			} catch {
				return null;
			}
		},
	}), []);

	const initializeMap = useCallback(() => {
		if (!window.require || mapViewRef.current) return;

		const containerId = mapContainerId.current;
		const container = document.getElementById(containerId);
		if (!container) {
			console.warn("Map container not found");
			return;
		}

		try {
			const esriBase = "esri";
			const esriModules = [
				`${esriBase}/Map`,
				`${esriBase}/views/MapView`,
				`${esriBase}/layers/FeatureLayer`,
				`${esriBase}/layers/GraphicsLayer`,
				`${esriBase}/Graphic`,
				`${esriBase}/geometry/Point`,
				`${esriBase}/symbols/SimpleMarkerSymbol`,
				`${esriBase}/symbols/SimpleFillSymbol`,
				`${esriBase}/symbols/SimpleLineSymbol`,
				`${esriBase}/renderers/UniqueValueRenderer`,
			];

			window.require(
				esriModules,
				(
					Map: any,
					MapView: any,
					FeatureLayer: any,
					GraphicsLayer: any,
					Graphic: any,
					Point: any,
					SimpleMarkerSymbol: any,
					SimpleFillSymbol: any,
					SimpleLineSymbol: any,
					UniqueValueRenderer: any
				) => {
					// Double-check container still exists
					const currentContainer = document.getElementById(containerId);
					if (!currentContainer || mapViewRef.current) {
						return;
					}

					// Create map
					const map = new Map({
						basemap: "streets-vector",
					});

					// Create map view with explicit container reference
					const view = new MapView({
						container: currentContainer,
						map: map,
						center: [lng, lat],
						zoom: 14,
					});

					mapViewRef.current = view;

					// Add Transit Zones layer with color-coded renderer
					// Create unique value renderer to color-code different zone types
					const uniqueValueInfos = [
						{
							value: "Inner Transit Zone",
							symbol: new SimpleFillSymbol({
								color: [76, 175, 80, 0.7], // Green
								outline: new SimpleLineSymbol({
									color: [56, 142, 60, 1],
									width: 2,
								}),
							}),
						},
						{
							value: "Outer Transit Zone",
							symbol: new SimpleFillSymbol({
								color: [255, 152, 0, 0.7], // Orange
								outline: new SimpleLineSymbol({
									color: [230, 126, 34, 1],
									width: 2,
								}),
							}),
						},
						{
							value: "Manhattan Core and Long Island City Parking Areas",
							symbol: new SimpleFillSymbol({
								color: [156, 39, 176, 0.7], // Purple
								outline: new SimpleLineSymbol({
									color: [123, 31, 162, 1],
									width: 2,
								}),
							}),
						},
					];

					const defaultSymbol = new SimpleFillSymbol({
						color: [224, 224, 224, 0.7], // Light gray for unknown
						outline: new SimpleLineSymbol({
							color: [158, 158, 158, 1],
							width: 2,
						}),
					});

					const transitZoneLayer = new FeatureLayer({
						url: "https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/ArcGIS/rest/services/Transit_Zones/FeatureServer/0",
						opacity: 0.7,
						outFields: ["TranstZone"],
						renderer: new UniqueValueRenderer({
							field: "TranstZone",
							uniqueValueInfos: uniqueValueInfos,
							defaultSymbol: defaultSymbol,
						}),
					});

					map.add(transitZoneLayer);

					// Create graphics layer for property marker
					const graphicsLayer = new GraphicsLayer();
					map.add(graphicsLayer);

					// Add property location marker
					const point = new Point({
						longitude: lng,
						latitude: lat,
					});

					const markerSymbol = new SimpleMarkerSymbol({
						style: "circle",
						color: [255, 0, 0], // Red
						size: 12,
						outline: {
							color: [255, 255, 255],
							width: 2,
						},
					});

					const markerGraphic = new Graphic({
						geometry: point,
						symbol: markerSymbol,
					});

					graphicsLayer.add(markerGraphic);

					// Wait for view to load
					view.when(() => {
						const stillExists = document.getElementById(containerId);
						if (stillExists && mapViewRef.current === view) {
							setMapLoaded(true);
						}
					}).catch((error: Error) => {
						console.error("Error loading map view:", error);
						const stillExists = document.getElementById(containerId);
						if (stillExists) {
							setMapError(error.message || "Failed to load map");
						}
					});
				}
			);
		} catch (error) {
			console.error("Error initializing ArcGIS map:", error);
			setMapError(
				error instanceof Error
					? error.message
					: "Failed to initialize map"
			);
		}
	}, [lat, lng, transitZoneData]);

	// Load ArcGIS script
	useEffect(() => {
		if (scriptLoadedRef.current) {
			// Script already loaded, just initialize
			setTimeout(() => initializeMap(), 100);
			return;
		}

		// Check if already loaded
		if (window.require) {
			scriptLoadedRef.current = true;
			setTimeout(() => initializeMap(), 100);
			return;
		}

		// Load script
		const script = document.createElement("script");
		script.src = "https://js.arcgis.com/4.34/";
		script.async = true;
		
		script.onload = () => {
			scriptLoadedRef.current = true;
			setTimeout(() => initializeMap(), 200);
		};

		script.onerror = () => {
			setMapError("Failed to load ArcGIS JS API");
		};

		document.head.appendChild(script);

		return () => {
			// Don't remove script - it can be reused
		};
	}, [initializeMap]);

	// Create container element
	useEffect(() => {
		if (!wrapperRef.current) return;

		const containerId = mapContainerId.current;
		let container = document.getElementById(containerId);
		
		if (!container) {
			container = document.createElement("div");
			container.id = containerId;
			container.style.width = "100%";
			container.style.height = "100%";
			wrapperRef.current.appendChild(container);
		}

		return () => {
			// Cleanup map view before removing container
			if (mapViewRef.current) {
				const view = mapViewRef.current;
				try {
					// Set container to null to prevent ArcGIS from trying to manipulate it
					if (view.container) {
						view.container = null;
					}
					view.destroy();
				} catch (error) {
					// Ignore cleanup errors
					console.warn("Error during map cleanup:", error);
				}
				mapViewRef.current = null;
			}

			// Remove container
			const containerToRemove = document.getElementById(containerId);
			if (containerToRemove && containerToRemove.parentNode) {
				try {
					containerToRemove.parentNode.removeChild(containerToRemove);
				} catch (error) {
					// Ignore - might already be removed
				}
			}
		};
	}, []);

	if (mapError) {
		return (
			<div className="w-full h-[500px] bg-gray-100 rounded-lg flex items-center justify-center border border-[rgba(55,50,47,0.12)]">
				<p className="text-[#605A57]">Error loading map: {mapError}</p>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			{/* Transit Zone Classification */}
			{transitZoneData && (
				<div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
					<p className="text-sm text-blue-800">
						<strong>Transit Zone:</strong>{" "}
						{transitZoneData.transitZoneLabel || "Unknown"}
					</p>
				</div>
			)}

			{/* Map Container - data-map-print-target used for PDF capture */}
			<div
				ref={wrapperRef}
				data-map-print-target
				className="w-full h-[500px] rounded-lg overflow-hidden border border-[rgba(55,50,47,0.12)] shadow-sm relative"
			>
				{!mapLoaded && (
					<div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gray-50 z-10">
						<p className="text-[#605A57]">Loading transit zone map...</p>
					</div>
				)}
			</div>
			{printImageId && (
				<img
					id={printImageId}
					alt="Transit Zone Map"
					className="print-show-map-image w-full rounded-lg border border-[rgba(55,50,47,0.12)]"
					style={{ display: "none", height: "500px", objectFit: "cover" }}
				/>
			)}
			<p className="text-xs text-[#605A57] text-center">
				Property location: {address}
			</p>
		</div>
	);
});

export default TransitZoneMap;
