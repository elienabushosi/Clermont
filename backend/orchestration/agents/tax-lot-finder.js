// Tax Lot Finder agent - fetches tax lot information
import { BaseAgent } from "./base-agent.js";

export class TaxLotFinderAgent extends BaseAgent {
	constructor() {
		super("Tax Lot Finder", "tax_lot_finder");
		this.enabled = false; // Currently disabled
	}

	async fetchData(addressData, reportId) {
		// Placeholder - agent is disabled
		// This method won't be called since enabled = false
		throw new Error("Tax Lot Finder is currently disabled");
	}
}
