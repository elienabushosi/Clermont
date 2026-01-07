// Base class for all agents
export class BaseAgent {
	constructor(name, sourceKey) {
		this.name = name;
		this.sourceKey = sourceKey;
		this.enabled = true;
	}

	/**
	 * Execute the agent to fetch data for the given address
	 * @param {Object} addressData - Address information
	 * @param {string} addressData.address - Full address string
	 * @param {string} addressData.normalizedAddress - Normalized address
	 * @param {Object} addressData.location - Location coordinates
	 * @param {number} addressData.location.lat - Latitude
	 * @param {number} addressData.location.lng - Longitude
	 * @param {string} addressData.placeId - Google Places ID
	 * @param {string} reportId - Report ID to associate results with
	 * @returns {Promise<Object>} Agent execution result
	 */
	async execute(addressData, reportId) {
		if (!this.enabled) {
			console.log(`${this.sourceKey} is currently disabled`);
			return {
				status: "failed",
				data: null,
				error: `${this.name} is currently disabled`,
			};
		}

		try {
			const data = await this.fetchData(addressData, reportId);
			return {
				status: "succeeded",
				data: data,
				error: null,
			};
		} catch (error) {
			console.error(`Error in ${this.name}:`, error);
			return {
				status: "failed",
				data: null,
				error: error.message || "Unknown error occurred",
			};
		}
	}

	/**
	 * Override this method in subclasses to implement agent-specific data fetching
	 * @param {Object} addressData - Address information
	 * @param {string} reportId - Report ID
	 * @returns {Promise<Object>} Agent-specific data
	 */
	async fetchData(addressData, reportId) {
		throw new Error(`fetchData must be implemented in ${this.name} agent`);
	}
}
