// Transit Zones Agent - determines transit zone classification via ArcGIS
import { BaseAgent } from "./base-agent.js";

export class TransitZonesAgent extends BaseAgent {
	constructor() {
		super("Transit Zones Agent", "transit_zones");
		this.enabled = true;
	}

	/**
	 * Normalize ArcGIS transit zone string to enum value
	 * @param {string} transitZoneString - Raw transit zone string from ArcGIS
	 * @returns {Object} Normalized transit zone data
	 */
	normalizeTransitZone(transitZoneString) {
		if (!transitZoneString || typeof transitZoneString !== "string") {
			return {
				transitZone: "unknown",
				transitZoneLabel: "Unknown or missing",
			};
		}

		const normalized = transitZoneString.trim();

		// Map ArcGIS values to normalized enums
		if (
			normalized.includes("Inner Transit Zone") ||
			normalized === "Inner Transit Zone"
		) {
			return {
				transitZone: "inner",
				transitZoneLabel: "Inner Transit Zone",
			};
		}

		if (
			normalized.includes("Outer Transit Zone") ||
			normalized === "Outer Transit Zone"
		) {
			return {
				transitZone: "outer",
				transitZoneLabel: "Outer Transit Zone",
			};
		}

		if (
			normalized.includes("Manhattan Core") ||
			normalized.includes("Long Island City") ||
			normalized === "Manhattan Core and Long Island City Parking Areas"
		) {
			return {
				transitZone: "manhattan_core_lic",
				transitZoneLabel:
					"Manhattan Core and Long Island City Parking Areas",
			};
		}

		// Default to unknown if string doesn't match known patterns
		return {
			transitZone: "unknown",
			transitZoneLabel: normalized || "Unknown",
		};
	}

	/**
	 * Build ArcGIS query URL for transit zone lookup
	 * @param {number} lng - Longitude
	 * @param {number} lat - Latitude
	 * @returns {string} ArcGIS query URL
	 */
	buildArcGISQueryUrl(lng, lat) {
		const baseUrl =
			"https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/ArcGIS/rest/services/Transit_Zones/FeatureServer/0/query";

		// Build geometry JSON
		const geometry = {
			x: lng,
			y: lat,
			spatialReference: { wkid: 4326 },
		};

		// Build query parameters
		const params = new URLSearchParams({
			f: "json",
			where: "1=1",
			geometryType: "esriGeometryPoint",
			geometry: JSON.stringify(geometry),
			inSR: "4326",
			spatialRel: "esriSpatialRelIntersects",
			outFields: "TranstZone",
			returnGeometry: "false",
		});

		return `${baseUrl}?${params.toString()}`;
	}

	/**
	 * Fetch transit zone classification from ArcGIS
	 * @param {number} lat - Latitude
	 * @param {number} lng - Longitude
	 * @returns {Promise<Object>} Transit zone result
	 */
	async fetchTransitZoneFromArcGIS(lat, lng) {
		const queryUrl = this.buildArcGISQueryUrl(lng, lat);

		try {
			const response = await fetch(queryUrl, {
				method: "GET",
				headers: {
					Accept: "application/json",
				},
			});

			if (!response.ok) {
				throw new Error(
					`ArcGIS API returned status ${response.status}: ${response.statusText}`
				);
			}

			const data = await response.json();

			// Check for ArcGIS errors
			if (data.error) {
				throw new Error(
					`ArcGIS API error: ${data.error.message || JSON.stringify(data.error)}`
				);
			}

			// Parse features
			if (
				!data.features ||
				!Array.isArray(data.features) ||
				data.features.length === 0
			) {
				// No features found = Beyond Greater Transit Zone
				return {
					transitZone: "beyond_gtz",
					transitZoneLabel: "Beyond the Greater Transit Zone",
					matched: false,
					input: { lat, lng },
					sourceUrl: queryUrl,
					notes: "No transit zone polygon matched this location",
				};
			}

			// Extract TranstZone attribute from first feature
			const transitZoneString =
				data.features[0].attributes?.TranstZone || null;

			if (!transitZoneString) {
				return {
					transitZone: "unknown",
					transitZoneLabel: "Unknown",
					matched: true,
					input: { lat, lng },
					sourceUrl: queryUrl,
					notes: "Feature found but TranstZone attribute missing",
				};
			}

			// Normalize the transit zone string
			const normalized = this.normalizeTransitZone(transitZoneString);

			return {
				transitZone: normalized.transitZone,
				transitZoneLabel: normalized.transitZoneLabel,
				matched: true,
				input: { lat, lng },
				sourceUrl: queryUrl,
				notes: null,
			};
		} catch (error) {
			// Return unknown on error (non-critical agent)
			return {
				transitZone: "unknown",
				transitZoneLabel: "Unknown",
				matched: false,
				input: { lat, lng },
				sourceUrl: queryUrl,
				notes: `Error fetching transit zone: ${error.message}`,
			};
		}
	}

	/**
	 * Fetch transit zone data
	 * @param {Object} addressData - Address information (must include location with lat/lng)
	 * @param {string} reportId - Report ID
	 * @returns {Promise<Object>} Transit zone result
	 */
	async fetchData(addressData, reportId) {
		// Get lat/lng from addressData.location or addressData
		const lat =
			addressData.location?.lat ||
			addressData.lat ||
			addressData.latitude;
		const lng =
			addressData.location?.lng ||
			addressData.lng ||
			addressData.longitude;

		if (!lat || !lng) {
			throw new Error(
				"TransitZonesAgent requires lat/lng coordinates. GeoserviceAgent must run first."
			);
		}

		// Fetch transit zone from ArcGIS
		const result = await this.fetchTransitZoneFromArcGIS(lat, lng);

		return {
			contentJson: result,
			sourceUrl: result.sourceUrl,
		};
	}
}
