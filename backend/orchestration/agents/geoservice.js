// Geoservice Agent - resolves NYC address to BBL using NYC Planning Geoservice
import { BaseAgent } from "./base-agent.js";

export class GeoserviceAgent extends BaseAgent {
	constructor() {
		super("Geoservice Agent", "geoservice");
	}

	/**
	 * Get borough code from ZIP code
	 * @param {string} zipCode - 5-digit ZIP code
	 * @returns {string|null} Borough code (1-5) or null if not found
	 */
	getBoroughFromZip(zipCode) {
		if (!zipCode || zipCode.length < 5) {
			return null;
		}

		const zip = parseInt(zipCode.substring(0, 5), 10);

		// Manhattan: 10001-10299
		if (zip >= 10001 && zip <= 10299) {
			return "1";
		}

		// Bronx: 10451-10475
		if (zip >= 10451 && zip <= 10475) {
			return "2";
		}

		// Brooklyn: 11201-11256
		if (zip >= 11201 && zip <= 11256) {
			return "3";
		}

		// Queens: 11001-11499 (but not overlapping with Brooklyn)
		if (zip >= 11001 && zip <= 11499 && (zip < 11201 || zip > 11256)) {
			return "4";
		}

		// Staten Island: 10301-10314
		if (zip >= 10301 && zip <= 10314) {
			return "5";
		}

		return null;
	}

	/**
	 * Extract ZIP code from address string
	 * @param {string} address - Full address string
	 * @returns {string|null} ZIP code or null if not found
	 */
	extractZipCode(address) {
		// Look for 5-digit ZIP code pattern
		// Common formats: "NY 10019", "10019", "NY 10019-1234"
		const zipMatch = address.match(/\b(\d{5})(?:-\d{4})?\b/);
		return zipMatch ? zipMatch[1] : null;
	}

	/**
	 * Get borough code from borough text name
	 * @param {string} address - Full address string
	 * @returns {string|null} Borough code (1-5) or null if not found
	 */
	getBoroughFromText(address) {
		const upperAddress = address.toUpperCase();

		// Map borough names to Geoservice codes
		const boroughMap = {
			MANHATTAN: "1",
			MN: "1",
			BROOKLYN: "3",
			BK: "3",
			QUEENS: "4",
			QN: "4",
			BRONX: "2",
			BX: "2",
			"STATEN ISLAND": "5",
			SI: "5",
		};

		// Check for borough text in address
		for (const [key, value] of Object.entries(boroughMap)) {
			if (upperAddress.includes(key)) {
				return value;
			}
		}

		return null;
	}

	/**
	 * Parse address into Borough, AddressNo, and StreetName
	 * @param {string} address - Full address string
	 * @returns {Object} Parsed address components
	 */
	parseAddress(address) {
		// Normalize address to uppercase for parsing
		const upperAddress = address.toUpperCase().trim();

		// PRIMARY: Try to get borough from ZIP code
		const zipCode = this.extractZipCode(address);
		let borough = zipCode ? this.getBoroughFromZip(zipCode) : null;

		// FALLBACK: If ZIP code didn't work, try text-based detection
		if (!borough) {
			borough = this.getBoroughFromText(upperAddress);
		}

		// Extract street number (leading digits)
		const numberMatch = upperAddress.match(/^(\d+)/);
		const addressNo = numberMatch ? numberMatch[1] : "";

		// Extract street name (everything after the number, before borough/city/state/ZIP)
		let streetName = upperAddress
			.replace(/^\d+\s*/, "") // Remove leading number
			.replace(/\s*(MANHATTAN|BROOKLYN|QUEENS|BRONX|STATEN ISLAND|MN|BK|QN|BX|SI|NY|NEW YORK).*$/i, "") // Remove borough/city/state
			.replace(/,\s*.*$/, "") // Remove anything after comma
			.replace(/\b\d{5}(?:-\d{4})?\b/, "") // Remove ZIP code
			.trim();

		// Clean up street name (normalize common suffixes)
		streetName = streetName
			.replace(/\s+STREET$/, " STREET")
			.replace(/\s+AVENUE$/, " AVENUE")
			.replace(/\s+AVE$/, " AVENUE")
			.replace(/\s+ROAD$/, " ROAD")
			.replace(/\s+RD$/, " ROAD")
			.replace(/\s+BOULEVARD$/, " BOULEVARD")
			.replace(/\s+BLVD$/, " BOULEVARD")
			.replace(/\s+PLACE$/, " PLACE")
			.replace(/\s+PL$/, " PLACE")
			.replace(/\s+DRIVE$/, " DRIVE")
			.replace(/\s+DR$/, " DRIVE")
			.replace(/\s+LANE$/, " LANE")
			.replace(/\s+LN$/, " LANE")
			.replace(/\s+COURT$/, " COURT")
			.replace(/\s+CT$/, " COURT");

		return {
			borough,
			addressNo,
			streetName,
			zipCode, // Include ZIP code in return for debugging
		};
	}

	/**
	 * Fetch data from NYC Planning Geoservice
	 * @param {Object} addressData - Address information
	 * @param {string} addressData.address - Full address string
	 * @param {string} reportId - Report ID
	 * @returns {Promise<Object>} Geoservice response with extracted fields
	 */
	async fetchData(addressData, reportId) {
		const apiKey = process.env.GEOSERVICE_API_KEY || "TjWnZr4u7xXABCHF";
		const address = addressData.address;

		if (!address) {
			throw new Error("Address is required for Geoservice agent");
		}

		// Parse address into components
		const { borough: inputBorough, addressNo, streetName, zipCode } = this.parseAddress(address);

		if (!inputBorough) {
			throw new Error(
				`Could not determine borough from address: ${address}. ` +
				`ZIP code found: ${zipCode || "none"}. ` +
				`Please ensure address includes a valid NYC ZIP code (10001-11499) or borough name.`
			);
		}

		if (!addressNo || !streetName) {
			throw new Error(
				`Could not parse address number and street name from: ${address}`
			);
		}

		// Build Geoservice URL
		const baseUrl =
			"https://geoservice.planning.nyc.gov/geoservice/geoservice.svc/Function_1B";
		const params = new URLSearchParams({
			Borough: inputBorough,
			AddressNo: addressNo,
			StreetName: streetName,
			Key: apiKey,
			DisplayFormat: "false",
		});

		const url = `${baseUrl}?${params.toString()}`;
		console.log(`Calling Geoservice: ${url.replace(apiKey, "***")}`);

		// Make API call
		const response = await fetch(url);

		if (!response.ok) {
			throw new Error(
				`Geoservice API returned status ${response.status}: ${response.statusText}`
			);
		}

		const rawResponse = await response.json();
		console.log("Geoservice raw response:", JSON.stringify(rawResponse, null, 2));

		// Extract key fields from response
		// The response structure is: root.bbl_toString or root.wa2F1b.wa2f1ax.bbl
		let bbl = null;
		let normalizedAddress = null;
		let latitude = null;
		let longitude = null;
		let extractedBorough = null;
		let block = null;
		let lot = null;

		// Extract BBL - try multiple paths
		if (rawResponse.root?.bbl_toString) {
			// Direct BBL string from root
			bbl = rawResponse.root.bbl_toString.toString().trim();
		} else if (rawResponse.root?.wa2F1b?.wa2f1ax?.bbl) {
			// Construct BBL from nested bbl object
			const bblObj = rawResponse.root.wa2F1b.wa2f1ax.bbl;
			extractedBorough = bblObj.boro?.trim() || rawResponse.root.wa2F1b.wa2f1ax.bbl.boro?.trim();
			block = bblObj.block?.trim() || rawResponse.root.wa2F1b.wa2f1ax.bbl.block?.trim();
			lot = bblObj.lot?.trim() || rawResponse.root.wa2F1b.wa2f1ax.bbl.lot?.trim();
			
			if (extractedBorough && block && lot) {
				// Construct BBL: Borough (1 digit) + Block (5 digits) + Lot (4 digits)
				const borocode = extractedBorough.padStart(1, "0");
				const blockPadded = block.padStart(5, "0");
				const lotPadded = lot.padStart(4, "0");
				bbl = `${borocode}${blockPadded}${lotPadded}`;
			}
		} else if (rawResponse.BBL) {
			bbl = rawResponse.BBL.toString();
		} else if (rawResponse.bbl) {
			bbl = rawResponse.bbl.toString();
		}

		// Extract normalized address
		if (rawResponse.root?.wa2F1b?.wa2f1ax?.wa2f1ex?.boe_preferred_stname) {
			const streetName = rawResponse.root.wa2F1b.wa2f1ax.wa2f1ex.boe_preferred_stname.trim();
			const houseNumber = rawResponse.root.wa1?.out_hnd?.trim() || 
			                    rawResponse.root.wa2F1b?.wa2f1ax?.wa2f1ex?.hi_hns?.substring(0, 3)?.trim();
			if (streetName && houseNumber) {
				normalizedAddress = `${houseNumber} ${streetName}`.trim();
			}
		}
		
		// Fallback address extraction
		if (!normalizedAddress) {
			if (rawResponse.root?.wa1?.out_stname1) {
				const streetName = rawResponse.root.wa1.out_stname1.trim();
				const houseNumber = rawResponse.root.wa1.out_hnd?.trim();
				if (streetName && houseNumber) {
					normalizedAddress = `${houseNumber} ${streetName}`.trim();
				}
			} else if (rawResponse.NormalizedAddress) {
				normalizedAddress = rawResponse.NormalizedAddress;
			} else if (rawResponse.normalizedAddress) {
				normalizedAddress = rawResponse.normalizedAddress;
			} else if (rawResponse.Address) {
				normalizedAddress = rawResponse.Address;
			}
		}

		// Extract latitude - try nested paths first
		if (rawResponse.root?.wa2F1b?.wa2f1ax?.latitude) {
			latitude = parseFloat(rawResponse.root.wa2F1b.wa2f1ax.latitude);
		} else if (rawResponse.root?.wa2F1b?.wa2f1ax?.wa2f1ex?.latitude) {
			latitude = parseFloat(rawResponse.root.wa2F1b.wa2f1ax.wa2f1ex.latitude);
		} else if (rawResponse.Latitude) {
			latitude = parseFloat(rawResponse.Latitude);
		} else if (rawResponse.latitude) {
			latitude = parseFloat(rawResponse.latitude);
		} else if (rawResponse.Lat) {
			latitude = parseFloat(rawResponse.Lat);
		}

		// Extract longitude - try nested paths first
		if (rawResponse.root?.wa2F1b?.wa2f1ax?.longitude) {
			longitude = parseFloat(rawResponse.root.wa2F1b.wa2f1ax.longitude);
		} else if (rawResponse.root?.wa2F1b?.wa2f1ax?.wa2f1ex?.longitude) {
			longitude = parseFloat(rawResponse.root.wa2F1b.wa2f1ax.wa2f1ex.longitude);
		} else if (rawResponse.Longitude) {
			longitude = parseFloat(rawResponse.Longitude);
		} else if (rawResponse.longitude) {
			longitude = parseFloat(rawResponse.longitude);
		} else if (rawResponse.Lon) {
			longitude = parseFloat(rawResponse.Lon);
		}

		// Extract borough if not already set
		if (!extractedBorough) {
			if (rawResponse.root?.wa2F1b?.wa2f1ax?.bbl?.boro) {
				extractedBorough = rawResponse.root.wa2F1b.wa2f1ax.bbl.boro.trim();
			} else if (rawResponse.root?.wa1?.in_boro1) {
				extractedBorough = rawResponse.root.wa1.in_boro1.trim();
			} else if (rawResponse.Borough) {
				extractedBorough = rawResponse.Borough;
			} else if (rawResponse.borough) {
				extractedBorough = rawResponse.borough;
			}
		}

		// Extract block if not already set
		if (!block && rawResponse.root?.wa2F1b?.wa2f1ax?.bbl?.block) {
			block = rawResponse.root.wa2F1b.wa2f1ax.bbl.block.trim();
		}

		// Extract lot if not already set
		if (!lot && rawResponse.root?.wa2F1b?.wa2f1ax?.bbl?.lot) {
			lot = rawResponse.root.wa2F1b.wa2f1ax.bbl.lot.trim();
		}

		// Extract additional structured data from Geoservice response
		const wa2f1ax = rawResponse.root?.wa2F1b?.wa2f1ax;
		const wa2f1ex = rawResponse.root?.wa2F1b?.wa2f1ax?.wa2f1ex;

		// Extract building class
		const buildingClass = wa2f1ax?.rpad_bldg_class?.trim() || null;

		// Extract neighborhood/district information
		const communityDistrict = wa2f1ex?.cd?.trim() || null;
		const cityCouncilDistrict = wa2f1ex?.com_dist?.district_number?.trim() || null;
		const schoolDistrict = wa2f1ex?.school_dist?.trim() || null;
		const policePrecinct = wa2f1ex?.police_pct?.trim() || null;
		const fireCompany = wa2f1ex?.fire_co_num?.trim() || null;
		const fireDivision = wa2f1ex?.fire_div?.trim() || null;
		const sanitationBorough = wa2f1ex?.sanitboro?.trim() || null;
		const sanitationDistrict = wa2f1ex?.san_dist?.trim() || null;
		const sanitationSubsection = wa2f1ex?.san_commercial_waste_zone?.trim() || null;

		// Extract zoning information
		const zoningMap = wa2f1ax?.DCP_Zoning_Map?.trim() || null;

		// Extract BIN (Building Identification Number)
		const bin = wa2f1ax?.bin?.binnum?.trim() 
			? `${wa2f1ax.bin.binnum.trim()}${wa2f1ax.bin.boro?.trim() || ""}`.trim()
			: rawResponse.root?.bin_toString?.trim() || null;

		// Return structured data
		return {
			contentJson: rawResponse,
			extracted: {
				bbl: bbl ? bbl.toString() : null,
				normalizedAddress: normalizedAddress || address,
				lat: latitude,
				lng: longitude,
				borough: extractedBorough || rawResponse.root?.wa1?.in_boro1?.trim() || inputBorough || null,
				block: block || null,
				lot: lot || null,
				// Building information
				buildingClass: buildingClass,
				bin: bin,
				// Neighborhood/district information
				communityDistrict: communityDistrict,
				cityCouncilDistrict: cityCouncilDistrict,
				schoolDistrict: schoolDistrict,
				policePrecinct: policePrecinct,
				fireCompany: fireCompany,
				fireDivision: fireDivision,
				sanitationBorough: sanitationBorough,
				sanitationDistrict: sanitationDistrict,
				sanitationSubsection: sanitationSubsection,
				// Zoning information
				zoningMap: zoningMap,
			},
			sourceUrl: url.replace(apiKey, "***"),
		};
	}
}

