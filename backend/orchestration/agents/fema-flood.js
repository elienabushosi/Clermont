// FEMA Flood Agent - determines FEMA flood zone classification via ArcGIS
import { BaseAgent } from "./base-agent.js";

export class FemaFloodAgent extends BaseAgent {
	constructor() {
		super("FEMA Flood Agent", "fema_flood");
		this.enabled = true;
	}

	/**
	 * Build ArcGIS query URL for FEMA flood zone lookup
	 * @param {number} lng - Longitude
	 * @param {number} lat - Latitude
	 * @returns {string} ArcGIS query URL
	 */
	buildArcGISQueryUrl(lng, lat) {
		const baseUrl =
			"https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Flood_Hazard_Reduced_Set_gdb/FeatureServer/0/query";

		// Build geometry JSON for point-in-polygon query
		const geometry = {
			x: lng,
			y: lat,
			spatialReference: { wkid: 4326 },
		};

		// Build query parameters
		// We'll get all fields to see what's available, and return geometry for map visualization
		const params = new URLSearchParams({
			f: "json",
			where: "1=1",
			geometryType: "esriGeometryPoint",
			geometry: JSON.stringify(geometry),
			inSR: "4326",
			spatialRel: "esriSpatialRelIntersects",
			outFields: "*", // Get all fields to see flood zone classification
			returnGeometry: "true", // Return geometry for map visualization
			outSR: "4326",
		});

		return `${baseUrl}?${params.toString()}`;
	}

	/**
	 * Fetch FEMA flood zone classification from ArcGIS
	 * @param {number} lat - Latitude
	 * @param {number} lng - Longitude
	 * @returns {Promise<Object>} FEMA flood zone result
	 */
	async fetchFemaFloodZoneFromArcGIS(lat, lng) {
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
				// No flood zone found
				return {
					floodZone: null,
					floodZoneLabel: "No flood zone",
					matched: false,
					input: { lat, lng },
					sourceUrl: queryUrl,
					notes: "No FEMA flood zone polygon matched this location",
					features: [],
				};
			}

			// Extract flood zone information from features
			// FEMA flood zones typically have fields like: FLOODZONE, ZONE_SUBTYPE, etc.
			// We'll check common field names
			const firstFeature = data.features[0];
			const attributes = firstFeature.attributes || {};
			
			// Common FEMA flood zone field names
			const floodZoneField = 
				attributes.FLOODZONE || 
				attributes.ZONE_SUBTYPE || 
				attributes.ZONE || 
				attributes.FLD_ZONE ||
				attributes.ZONE_TYPE ||
				null;

			const floodZoneLabel = floodZoneField || "Unknown flood zone";

			// Return all features for map visualization
			return {
				floodZone: floodZoneField,
				floodZoneLabel: floodZoneLabel,
				matched: true,
				input: { lat, lng },
				sourceUrl: queryUrl,
				notes: null,
				features: data.features, // Include all features with geometry for map
				featureCount: data.features.length,
			};
		} catch (error) {
			// Return error result (non-critical agent)
			return {
				floodZone: null,
				floodZoneLabel: "Unknown",
				matched: false,
				input: { lat, lng },
				sourceUrl: queryUrl,
				notes: `Error fetching FEMA flood zone: ${error.message}`,
				features: [],
			};
		}
	}

	/**
	 * Fetch FEMA flood zone data
	 * @param {Object} addressData - Address information (must include location with lat/lng)
	 * @param {string} reportId - Report ID
	 * @returns {Promise<Object>} FEMA flood zone result
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
				"FemaFloodAgent requires lat/lng coordinates. GeoserviceAgent must run first."
			);
		}

		// Fetch FEMA flood zone from ArcGIS
		const result = await this.fetchFemaFloodZoneFromArcGIS(lat, lng);

		return {
			contentJson: result,
			sourceUrl: result.sourceUrl,
		};
	}
}
