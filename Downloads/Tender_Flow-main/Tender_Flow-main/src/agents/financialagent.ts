import { LineItemTechnicalAnalysis, SKU, ParsedRfpData, FinancialAgentResult } from "../../types";

/* =====================================================
    CONFIG – Regulatory & Logic Constants
===================================================== */
const TRANSPORT_BUFFER_PERCENT = 10; // 10% buffer on top of base transport cost

/* =====================================================
    CORE AGENT
===================================================== */
export default function runFinancialAgent(
  analyses: LineItemTechnicalAnalysis[],
  rfpData: ParsedRfpData,
  filters: any, // Contains manualAvgKms, manualRatePerKm
  manualPriceOverrides?: Record<string, { unitPrice: number }>
): FinancialAgentResult {
  let totalBaseMaterialCost = 0;
  let totalGstAmount = 0;
  const riskEntries: FinancialAgentResult["riskEntries"] = [];

  // Iterate through technical analyses to aggregate per-product costs
  analyses.forEach((analysis, index) => {
    const item = analysis.rfpLineItem;
    const sku: SKU | null = analysis.selectedSku;
    
    let unitPriceToUse = 0;
    let currentGstRate = 18; // Default fallback

    /* 1. DYNAMIC PRICE SELECTION */
    if (manualPriceOverrides?.[item.name]) {
      unitPriceToUse = manualPriceOverrides[item.name].unitPrice;
      currentGstRate = sku?.gstRate || 18;
    } else if (sku) {
      unitPriceToUse = sku.unitSalesPrice;
      currentGstRate = sku.gstRate;
    }

    const lineItemBase = unitPriceToUse * item.quantity;
    const lineItemGst = lineItemBase * (currentGstRate / 100);

    /* 2. INJECT BREAKDOWN INTO ANALYSIS OBJECT FOR UI */
    // This allows the AnalysisScreen to show (price * qty) and GST per card
    (analysis as any).financialBreakdown = {
      unitPrice: unitPriceToUse,
      quantity: item.quantity,
      baseTotal: lineItemBase,
      gst: lineItemGst,
      matchStatus: analysis.status
    };

    totalBaseMaterialCost += lineItemBase;
    totalGstAmount += lineItemGst;

    // Availability Risks
    if (sku && sku.availableQuantity < item.quantity) {
      riskEntries.push({
        category: "Logistics",
        statement: `Line ${index + 1}: Required ${item.quantity}, but Jalandhar Hub has ${sku.availableQuantity}.`,
        riskLevel: sku.availableQuantity === 0 ? "High" : "Medium",
      });
    }
  });

  /* 3. DYNAMIC TRANSPORTATION CALCULATION */
  // Base Transport = (User KM Input * User Rate per KM Input)
  const baseTransport = (filters.manualAvgKms || 0) * (filters.manualRatePerKm || 0);
  const transportWithBuffer = baseTransport * (1 + (TRANSPORT_BUFFER_PERCENT / 100));

  /* 4. GeM TRANSACTION CHARGES (Sept 2024 Guidelines) */
  // Orders <= 10L: 0
  // Orders > 10L to 10Cr: 0.30%
  // Orders > 10Cr: Flat 3,00,000
  let gemBrokerage = 0;
  const orderValueForFees = totalBaseMaterialCost; // GeM fees are usually on value excluding taxes

  if (orderValueForFees > 1000000 && orderValueForFees <= 100000000) {
    gemBrokerage = orderValueForFees * 0.0030; // 0.30%
  } else if (orderValueForFees > 100000000) {
    gemBrokerage = 300000;
  }

  /* 5. SECURITY DEPOSITS (EPBG & EMD) */
  const epbgAmount = calculateSecurityDeposit(rfpData, 'epbg', totalBaseMaterialCost);
  const emdAmount = calculateSecurityDeposit(rfpData, 'emd', totalBaseMaterialCost);

  /* 6. FINAL AGGREGATION */
  const finalBidValue = round(
    totalBaseMaterialCost + 
    totalGstAmount + 
    gemBrokerage + 
    transportWithBuffer + 
    epbgAmount + 
    emdAmount
  );

  return {
    pricing: {
      "Material Base Cost": round(totalBaseMaterialCost),
      "Total GST Impact": round(totalGstAmount),
      "GeM Transaction Fee (Sept '24)": round(gemBrokerage),
      "Logistics (incl. 10% Buffer)": round(transportWithBuffer),
      "EPBG Provision": round(epbgAmount),
      "EMD Provision": round(emdAmount),
      "Final Bid Value": round(finalBidValue),
    },
    summary: {
      matchStatus: determineOverallStatus(analyses),
      confidenceScore: calculateConfidence(analyses),
      requiresManualInput: totalBaseMaterialCost === 0,
        recommendation: finalBidValue > 0 
  ? `Strategic Bid Prepared. Logistics coverage for ${filters.manualAvgKms}km confirmed.` 
  : "Price mismatch detected. Awaiting authorized manual intervention.",
      finalBidValue: round(finalBidValue), 
    },
    riskEntries,
  };
}

/* =========================
    HELPERS
========================= */
function calculateSecurityDeposit(rfp: ParsedRfpData, type: 'epbg' | 'emd', base: number): number {
  const status = rfp.financialConditions?.[type];
  if (status === "Not Required" || status === "No") return 0;
  
  // RESTORED OVERRIDE: Exact ₹ amount for EMD
  if (type === 'emd' && rfp.metadata.emdAmount && rfp.metadata.emdAmount > 0) {
    return rfp.metadata.emdAmount;
  }

  // RESTORED OVERRIDE: Exact ₹ amount for ePBG
  if (type === 'epbg' && rfp.metadata.epbgAmount && rfp.metadata.epbgAmount > 0) {
    return rfp.metadata.epbgAmount;
  }
  
  // Dynamic percentages from RFP metadata or industry defaults
  const epbgDefault = 3; 
  const emdDefault = 2;
  
  const percent = (type === 'epbg' ? rfp.metadata.epbgPercent : null) || (type === 'epbg' ? epbgDefault : emdDefault);
  return base * (percent / 100);
}

function determineOverallStatus(analyses: any[]): 'COMPLETE' | 'PARTIAL' | 'NONE' {
  if (analyses.length === 0) return 'NONE';
  if (analyses.every(a => a.status === 'COMPLETE')) return 'COMPLETE';
  if (analyses.some(a => a.status === 'PARTIAL' || a.status === 'COMPLETE')) return 'PARTIAL';
  return 'NONE';
}

function calculateConfidence(analyses: any[]): number {
  if (analyses.length === 0) return 0;
  const sum = analyses.reduce((acc, curr) => acc + (curr.matchPercentage || 0), 0);
  return Math.round(sum / analyses.length);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}