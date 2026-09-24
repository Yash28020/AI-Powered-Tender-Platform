import { SKU, RfpProductLineItem} from '../../types';

/* =====================================================
    CONFIG – Industrial Strategic Weights
===================================================== */

const AVAILABILITY = {
  FULL: 1.0,
  PARTIAL: 0.8,
  ZERO: 0.4, // Keep visible for manual sourcing
  THRESHOLD: 0.4, 
};

/* =====================================================
    CORE HELPERS
===================================================== */

function calculateIndustrialMatch(
  rfpSpecs: string[],
  skuSpecs: Record<string, string>,
  rfpItemName: string,
  skuCategory: string,
  skuName: string
): number {
  let score = 0;
  const skuValues = Object.values(skuSpecs || {}).map(v => String(v).toLowerCase());
  
  // Tokenize the strings (split by spaces/symbols and remove tiny filler words)
  const rfpWords = rfpItemName.toLowerCase().split(/[\s,/-]+/).filter(w => w.length > 2);
  const categoryWords = skuCategory.toLowerCase().split(/[\s,/-]+/).filter(w => w.length > 2);
  const nameWords = skuName.toLowerCase().split(/[\s,/-]+/).filter(w => w.length > 2);

  // 1. CATEGORY OVERLAP (Max 40 Points)
  // Does the RFP item belong in this family of products?
  let categoryMatches = 0;
  rfpWords.forEach(word => {
    if (categoryWords.some(catWord => catWord.includes(word) || word.includes(catWord))) {
      categoryMatches++;
    }
  });
  
  if (rfpWords.length > 0 && categoryWords.length > 0) {
    // We use Math.min to prevent dilution if one string is much longer than the other
    const catScore = (categoryMatches / Math.min(rfpWords.length, categoryWords.length)) * 40;
    score += Math.min(catScore, 40); // Cap at 40
  }

  // 2. PRODUCT NAME OVERLAP (Max 20 Points)
  // How closely does the specific item name match?
  let nameMatches = 0;
  rfpWords.forEach(word => {
    if (nameWords.some(nWord => nWord.includes(word) || word.includes(nWord))) {
      nameMatches++;
    }
  });

  if (rfpWords.length > 0 && nameWords.length > 0) {
    const nameScore = (nameMatches / Math.min(rfpWords.length, nameWords.length)) * 20;
    score += Math.min(nameScore, 20); // Cap at 20
  }

  // 3. IS STANDARD & SPEC DEEP DIVE (Max 40 Points)
  // Does it meet the technical requirements?
  if (rfpSpecs && rfpSpecs.length > 0) {
      // Bonus for exact IS standard match
      const hasStandardMatch = rfpSpecs.some(spec => 
        skuValues.some(val => val.includes("is") && (spec.toLowerCase().includes(val) || val.includes(spec.toLowerCase())))
      );
      if (hasStandardMatch) score += 20;

      // Bonus for other technical attributes (wattage, dimensions, etc.)
      let matchedAttributes = 0;
      rfpSpecs.forEach(spec => {
        const cleanSpec = spec.toLowerCase();
        if (skuValues.some(val => val.length > 2 && (cleanSpec.includes(val) || val.includes(cleanSpec)))) {
          matchedAttributes++;
        }
      });
      score += (matchedAttributes / Math.max(rfpSpecs.length, 1)) * 20;
  }

  // Enforce the 30% Safety Floor and 100% Ceiling
  return Math.min(100, Math.max(30, Math.round(score)));
}
/* =====================================================
    MAIN TECHNICAL AGENT
===================================================== */

export function runTechnicalAgent(
  rfpItems: RfpProductLineItem[],
  skus: SKU[]
): { itemAnalyses: any[]; riskEntries: any[] } {
  console.log(`\n[TECHNICAL_AGENT] 🔍 Initiating Audit for ${rfpItems.length} line items...`);
  const riskEntries: any[] = [];
  const THRESHOLD = 15;

  const itemAnalyses = rfpItems.map((item, index) => {
    const rfpCat = item.name.toLowerCase();
    const rfpKeywords = rfpCat.split(/[\s,/-]+/).filter(k => k.length >= 2);

    console.log(`[TECHNICAL_AGENT] 📦 Item ${index + 1}: "${item.name}" | Keywords: [${rfpKeywords.join(', ')}]`);

    // PHASE 1: KEYWORD DISCOVERY
    const candidates = skus.filter(sku => {
      const skuText = `${sku.productCategory} ${sku.productSubCategory} ${sku.productName}`.toLowerCase();
      return rfpKeywords.some(kw => skuText.includes(kw));
    });

    if (candidates.length === 0) {
      console.warn(`[TECHNICAL_AGENT] ⚠️ ZERO candidates found for "${item.name}" in Hub Inventory.`);
      return {
        rfpLineItem: item,
        status: 'NONE',
        selectedSku: null,
        matchPercentage: 0,
        technicalReasoning: "No keyword overlap found in Jalandhar Hub inventory.",
        top3Recommendations: []
      };
    }

    console.log(`[TECHNICAL_AGENT] Found ${candidates.length} potential SKU candidates.`);

    // PHASE 2: SCORING
    const scoredCandidates = candidates.map(sku => {
      const specScore = calculateIndustrialMatch(item.technicalSpecs, sku.specification, item.name, sku.productCategory, sku.productName);
      const stockWeight = sku.availableQuantity >= item.quantity ? AVAILABILITY.FULL : 
                         sku.availableQuantity > 0 ? AVAILABILITY.PARTIAL : AVAILABILITY.ZERO;
      
      const finalScore = Math.round(specScore * stockWeight);

      return {
        ...sku,
        matchPercentage: finalScore,
        __stockStatus: stockWeight === 1.0 ? 'FULL' : stockWeight === 0.8 ? 'PARTIAL' : 'ZERO',
        __specScore: specScore
      };
    }).sort((a, b) => (b.matchPercentage || 0) - (a.matchPercentage || 0));

    const bestMatch = scoredCandidates[0];
    const matchScore = bestMatch.matchPercentage || 0;

    console.log(`[TECHNICAL_AGENT] ✅ Best Match: ${bestMatch.skuId} | Score: ${matchScore}% | Stock: ${bestMatch.__stockStatus}`);

    // PHASE 3: STATUS & RISK
    let status: 'COMPLETE' | 'PARTIAL' | 'NONE' = 'PARTIAL';
    if (matchScore >= 75) status = 'COMPLETE';
    if (matchScore < THRESHOLD) status = 'NONE';

    if (bestMatch.availableQuantity < item.quantity) {
      riskEntries.push({
        category: 'Logistics',
        riskLevel: bestMatch.availableQuantity === 0 ? 'High' : 'Medium',
        statement: `Line Item ${index + 1}: Inventory shortfall (${bestMatch.availableQuantity}/${item.quantity}).`
      });
    }

    return {
      rfpLineItem: item,
      status,
      selectedSku: bestMatch,
      matchPercentage: matchScore,
      technicalReasoning: `Matched via ${matchScore}% spec alignment with ${bestMatch.productName}.`,
      top3Recommendations: scoredCandidates.slice(0, 3),
      complianceChecks: (item.technicalSpecs || []).map(spec => ({
        standard: spec,
        status: bestMatch.__specScore > 50 ? 'Found' : 'Referenced',
        verified: true
      }))
    };
  });

  console.log(`[TECHNICAL_AGENT] 🏁 Audit Complete. Generated ${riskEntries.length} risk alerts.\n`);

  return { 
    itemAnalyses, 
    riskEntries 
  };
}