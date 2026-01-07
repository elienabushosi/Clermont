// Zoning Resolution agent - fetches zoning information
import { BaseAgent } from "./base-agent.js";

export class ZoningResolutionAgent extends BaseAgent {
	constructor() {
		super("Zoning Resolution", "zoning_resolution");
		this.enabled = false; // Currently disabled
	}

	async fetchData(addressData, reportId) {
		// Placeholder - agent is disabled
		// This method won't be called since enabled = false
		throw new Error("Zoning Resolution is currently disabled");
	}
}
