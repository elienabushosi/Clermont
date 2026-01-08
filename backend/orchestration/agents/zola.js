// Zola Agent - fetches property data from CARTO MapPLUTO using BBL
import { BaseAgent } from "./base-agent.js";

export class ZolaAgent extends BaseAgent {
	constructor() {
		super("Zola Agent", "zola");
	}

	/**
	 * Fetch data from CARTO MapPLUTO API
	 * @param {Object} addressData - Address information (must include bbl)
	 * @param {string} addressData.bbl - Borough-Block-Lot identifier
	 * @param {string} reportId - Report ID
	 * @returns {Promise<Object>} MapPLUTO property data
	 */
	async fetchData(addressData, reportId) {
		const bbl = addressData.bbl;

		if (!bbl) {
			throw new Error(
				"BBL is required for Zola agent. Geoservice agent must run first."
			);
		}

		// Ensure BBL is a valid integer
		const bblNumber = parseInt(bbl, 10);
		if (isNaN(bblNumber) || bblNumber <= 0) {
			throw new Error(`Invalid BBL format: ${bbl}`);
		}

		// CARTO SQL API endpoint
		const cartoUrl = "https://planninglabs.carto.com/api/v2/sql";

		// SQL query to fetch MapPLUTO data by BBL
		// Match the exact format from the working example: WHERE bbl=3004510001 (no spaces)
		const sqlQuery = `SELECT address,bbl,bldgarea,bldgclass,block,borough,borocode,cd,condono,council,firecomp,histdist,landmark,landuse,lot,lotarea,lotdepth,lotfront,notes,numbldgs,numfloors,ownername,ownertype,overlay1,overlay2,policeprct,sanitboro,sanitdistr,sanitsub,schooldist,spdist1,spdist2,spdist3,unitsres,unitstotal,yearbuilt,yearalter1,yearalter2,zipcode,zonedist1,zonedist2,zonedist3,zonedist4,LOWER(zonemap) AS zonemap,st_x(st_centroid(the_geom)) as lon,st_y(st_centroid(the_geom)) as lat,the_geom,bbl AS id FROM dcp_mappluto WHERE bbl=${bblNumber}`;

		const params = new URLSearchParams({
			q: sqlQuery,
			format: "geojson",
		});

		const url = `${cartoUrl}?${params.toString()}`;
		console.log(`Calling CARTO MapPLUTO API for BBL: ${bblNumber}`);
		console.log(`CARTO URL: ${url.substring(0, 200)}...`); // Log first 200 chars for debugging

		// Make API call
		const response = await fetch(url);

		if (!response.ok) {
			throw new Error(
				`CARTO API returned status ${response.status}: ${response.statusText}`
			);
		}

		const data = await response.json();

		// Check if we got results
		if (
			!data.features ||
			!Array.isArray(data.features) ||
			data.features.length === 0
		) {
			throw new Error(`No MapPLUTO data found for BBL: ${bbl}`);
		}

		// Extract properties from first feature
		const properties = data.features[0].properties;

		// Filter to keep only the fields we want (per requirements)
		const filteredProperties = {
			// Core parcel identifiers
			address: properties.address,
			bbl: properties.bbl,
			borough: properties.borough,
			borocode: properties.borocode,
			block: properties.block,
			lot: properties.lot,
			zipcode: properties.zipcode,

			// Community/district info
			cd: properties.cd,
			council: properties.council,

			// Zoning
			zonedist1: properties.zonedist1,
			zonedist2: properties.zonedist2,
			zonedist3: properties.zonedist3,
			zonedist4: properties.zonedist4,
			overlay1: properties.overlay1,
			overlay2: properties.overlay2,
			spdist1: properties.spdist1,
			spdist2: properties.spdist2,
			spdist3: properties.spdist3,
			zonemap: properties.zonemap,

			// Landmarks/historic
			landmark: properties.landmark,
			histdist: properties.histdist,

			// Land use
			landuse: properties.landuse,

			// Lot dimensions
			lotarea: properties.lotarea,
			lotfront: properties.lotfront,
			lotdepth: properties.lotdepth,

			// Building info
			bldgarea: properties.bldgarea,
			numbldgs: properties.numbldgs,
			numfloors: properties.numfloors,
			unitsres: properties.unitsres,
			unitstotal: properties.unitstotal,
			yearbuilt: properties.yearbuilt,
			yearalter1: properties.yearalter1,
			yearalter2: properties.yearalter2,
			bldgclass: properties.bldgclass,

			// Coordinates
			lon: properties.lon,
			lat: properties.lat,
		};

		console.log(`MapPLUTO data retrieved for BBL: ${bbl}`);

		return {
			contentJson: filteredProperties,
			sourceUrl: url,
		};
	}
}
