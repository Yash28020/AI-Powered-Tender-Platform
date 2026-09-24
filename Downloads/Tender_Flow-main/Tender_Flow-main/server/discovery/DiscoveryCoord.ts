import { SKU, DiscoveryFilters, AgentName,Tender } from '../../types';
import { GeMWorker} from './GeMWorker';

export class DiscoveryCoordinator {
  private inventory: SKU[];
  private addLog: (agent: AgentName | "SYSTEM", message: string, data?: any) => void;

  constructor(
    inventory: SKU[],
    addLog: (agent: AgentName | "SYSTEM", message: string, data?: any) => void
  ) {
    this.inventory = inventory;
    this.addLog = addLog;
  }
  async runDiscovery(portal: string, category: string, filters: DiscoveryFilters): Promise<Tender[]> {
    
    
    // 1. Initial Handshake & Log
    this.addLog('MASTER_AGENT', `Discovery Task: Scanning ${portal.toUpperCase()} for "${category}"`);

    try {
      if (portal !== 'gem') {
        throw new Error(`Portal Worker for ${portal} is not yet commissioned.`);
      }

      // 2. Delegate to specialized Portal Worker
      const worker = new GeMWorker(this.inventory, filters);
      const allRawBids: any[] = [];

      const categoriesToScan = filters.categories || [category];
      for (const cat of categoriesToScan) {
        this.addLog('MASTER_AGENT', `Delegating to GEM_WORKER for: "${cat}"...`);
        const catBids = await worker.scrape(cat);
        allRawBids.push(...catBids);
      }
      
      
      if (allRawBids.length === 0) {
        this.addLog('MASTER_AGENT', `Scan complete: No matching bids found for this category.`);
        return [];
      }

      this.addLog('MASTER_AGENT', `Observed ${allRawBids.length} raw bids. Initiating Qualification...`);

      // 3. Orient & Decide: Apply Thresholds (Distance, EMD, 20% Inventory)
      const qualifiedBids = await worker.qualify(allRawBids);

      // 4. Final Analysis Log
      const highProbabilityCount = qualifiedBids.filter(b => (b.matchScore || 0) >= 80).length;
      
      this.addLog('MASTER_AGENT', `Qualification Finished.`, {
        totalFound: allRawBids.length,
        qualified: qualifiedBids.length,
        highWinProbability: highProbabilityCount,
        appliedFilters: {
          manualKms: `${filters.manualAvgKms || 0}km`, // Updated to use your new manual KM logic
          emdAllowed: filters.allowEMD,
          minMatch: `${filters.minMatchThreshold}%`
        }
      });

      return qualifiedBids;

    } catch (error: any) {
      this.addLog('SYSTEM', `Discovery Agent Failure: ${error.message}`);
      throw error;
    }
  }

  /**
   * Strategic Insight Generator
   * Provides a text-based reason for why a bid was suggested.
   */
  public getRecommendationReason(bid: Tender, _filters: DiscoveryFilters): string {
    const reasons = [];
    
    if (bid.matchScore && bid.matchScore >= 80) reasons.push("High inventory overlap");
    if (bid.inStock) reasons.push("Immediate fulfillment available");
    if (bid.distance && bid.distance <= (_filters.manualAvgKms || 100)) reasons.push("Logistics within planned threshold");
    if (!bid.emdRequired) reasons.push("No financial lock-in (Zero EMD)");

    return reasons.length > 0 
      ? `Recommended: ${reasons.join(", ")}.` 
      : "Standard match based on category.";
  }
}