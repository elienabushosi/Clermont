// Agent registry - manages all available agents
import { ZolaAgent } from "./zola.js";
import { TaxLotFinderAgent } from "./tax-lot-finder.js";
import { ZoningResolutionAgent } from "./zoning-resolution.js";

// Initialize all agents
const agents = {
	zola: new ZolaAgent(),
	taxLotFinder: new TaxLotFinderAgent(),
	zoningResolution: new ZoningResolutionAgent(),
};

/**
 * Get all enabled agents
 * @returns {Array<BaseAgent>} Array of enabled agents
 */
export function getEnabledAgents() {
	return Object.values(agents).filter((agent) => agent.enabled);
}

/**
 * Get all agents (enabled and disabled)
 * @returns {Array<BaseAgent>} Array of all agents
 */
export function getAllAgents() {
	return Object.values(agents);
}

/**
 * Get a specific agent by source key
 * @param {string} sourceKey - Source key of the agent
 * @returns {BaseAgent|null} Agent instance or null if not found
 */
export function getAgentBySourceKey(sourceKey) {
	return (
		Object.values(agents).find((agent) => agent.sourceKey === sourceKey) ||
		null
	);
}

/**
 * Get agents that can run in parallel
 * Currently, all enabled agents can run in parallel
 * @returns {Array<BaseAgent>} Array of agents that can run in parallel
 */
export function getParallelAgents() {
	return getEnabledAgents();
}

export default agents;
