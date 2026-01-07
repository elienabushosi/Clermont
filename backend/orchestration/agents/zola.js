// Zola agent - fetches property data from Zola
import { BaseAgent } from "./base-agent.js";

export class ZolaAgent extends BaseAgent {
	constructor() {
		super("Zola", "zola");
	}

	async fetchData(addressData, reportId) {
		// For now, just log that we received the address
		console.log(`I got the address ${addressData.address}`);

		// TODO: Implement actual Zola API integration
		// This is a placeholder that returns success
		return {
			address: addressData.address,
			normalizedAddress: addressData.normalizedAddress,
			location: addressData.location,
			placeId: addressData.placeId,
			message: "Zola agent executed successfully",
		};
	}
}

