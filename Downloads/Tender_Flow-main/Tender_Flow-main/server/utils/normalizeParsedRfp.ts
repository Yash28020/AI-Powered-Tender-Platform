import { ParsedRfpData, RfpProductLineItem, CertificationCheck } from "../../types";
import { isBidClosed } from "./rfpStatus";

/* =====================================================
   CERTIFICATION EXTRACTION (Maintained from original)
===================================================== */
function extractCertificationsFromText(
  texts: string[] = [],
  source: CertificationCheck["source"] = "Technical Specs"
): CertificationCheck[] {
  const CERT_KEYWORDS = [
    "ISO 9001", "ISO 14001", "ISO 45001", "BIS", "CE", "IEC", "ROHS", "ISI", "NABL",
  ];

  const found = new Map<string, CertificationCheck>();

  texts.forEach((text) => {
    CERT_KEYWORDS.forEach((cert) => {
      if (text?.toUpperCase().includes(cert)) {
        found.set(cert, {
          name: cert,
          source,
          verified: false,
        });
      }
    });
  });

  return Array.from(found.values());
}

/* =====================================================
   MAIN NORMALIZER
===================================================== */
export function normalizeParsedRfp(raw: any): ParsedRfpData {
  const products: RfpProductLineItem[] = [];

  if (!raw || typeof raw !== "object") {
    throw new Error("Normalizer received invalid raw object");
  }

  // 1. IMPROVED ITEM EXTRACTION (Handles the "item_details" array from Gemini)
  if (Array.isArray(raw.item_details)) {
    raw.item_details.forEach((item: any, idx: number) => {
      // Create spec summary from available data
      const specTexts = [
        item.item_category_code ? `Category Code: ${item.item_category_code}` : "",
        item.consignees?.[0]?.delivery_days ? `Delivery Days: ${item.consignees[0].delivery_days}` : ""
      ].filter(Boolean);

      products.push({
        name: item.item_category_code ? `Item ${item.item_category_code}` : `Line Item ${idx + 1}`,
        quantity: Number(item.consignees?.[0]?.quantity || item.quantity) || 0,
        technicalSpecs: specTexts,
        requiredStandards: [],
        certifications: extractCertificationsFromText(specTexts),
      });
    });
  }

  // 2. ORIGINAL CASE A: technical_specifications as ARRAY
  else if (Array.isArray(raw.technical_specifications)) {
    raw.technical_specifications.forEach((item: any, idx: number) => {
      const specTexts: string[] = [
        item.generic_technical_specifications_and_requirement_of_products,
        ...(item.additional_specification_parameters?.map(
          (p: any) => `${p.name}: ${p.bid_requirement_allowed_values ?? ""}`
        ) ?? []),
      ].filter(Boolean);

      products.push({
        name: item.item_name ?? `Line Item ${idx + 1}`,
        quantity: Number(item.quantity) || 0,
        technicalSpecs: specTexts,
        requiredStandards: [],
        certifications: extractCertificationsFromText(specTexts),
      });
    });
  }

  // 3. ORIGINAL CASE B: technical_specifications as OBJECT
  else if (raw.technical_specifications && typeof raw.technical_specifications === "object") {
    const specTexts = Object.entries(raw.technical_specifications).map(
      ([key, value]) => `${key}: ${String(value)}`
    );

    products.push({
      name: raw.item_details?.boq_title ?? raw.item_details?.searched_strings_used_in_gemarpts ?? "Unspecified Item",
      quantity: raw.item_details?.total_quantity ?? raw.consignees?.[0]?.quantity ?? 0,
      technicalSpecs: specTexts,
      requiredStandards: [],
      certifications: extractCertificationsFromText(specTexts),
    });
  }

  // 4. ABSOLUTE FALLBACK (Maintained)
  if (products.length === 0) {
    products.push({
      name: "Unstructured RFP Item",
      quantity: 0,
      technicalSpecs: [],
      requiredStandards: [],
      certifications: [],
    });
  }

  // 5. METADATA MAPPING (Guards against undefined to prevent UI crash)
  const bidDetails = raw.bid_details ?? {};
  const bidEndDate = bidDetails.bid_end_date_time ?? bidDetails.bid_end_date ?? "N/A";
  const extractedEmdAmount = Number(bidDetails.emdAmount) || 0;
  const extractedEpbgAmount = Number(bidDetails.epbgAmount) || 0;
  const isEmdRequired = bidDetails.emd_required === "Yes" || bidDetails.emd_required === true || bidDetails.emd_detail_required === "Yes"||extractedEmdAmount > 0;
  const isEpbgRequired = bidDetails.epbg_required === "Yes" || bidDetails.epbg_required === true || bidDetails.epbg_detail_required === "Yes"||extractedEpbgAmount > 0;
  
  const mandatoryDocuments =
    bidDetails.document_required_from_seller ??
    bidDetails.documents_required_from_seller ??
    [];

  // Support for Option Clause in string array or object form
  const optionClause = Array.isArray(raw.buyer_added_terms) 
    ? raw.buyer_added_terms.find((t: any) => String(t).toUpperCase().includes("OPTION"))
    : null;

  return {
    metadata: {
      bidNumber: bidDetails.bid_number ?? "N/A", // This prevents the AnalysisScreen crash
      issuingOrganization: bidDetails.organisation_name ?? bidDetails.department_name ?? "N/A",
      bidType: bidDetails.type_of_bid ?? "N/A",
      bidEndDate,
      offerValidity: Number(bidDetails.bid_offer_validity_days) || 0,
      deliveryDays: Number(raw.consignees?.[0]?.delivery_days) || 0,
      itemCategory: Array.isArray(bidDetails.item_category) ? bidDetails.item_category[0] : bidDetails.item_category,
      totalQuantity: Number(bidDetails.total_quantity ?? raw.item_details?.total_quantity) || 0,
      officeName: bidDetails.office_name,
      isBidClosed: isBidClosed(bidEndDate),
      emdAmount: extractedEmdAmount,
      epbgAmount: extractedEpbgAmount
    },
    products,
    mandatoryDocuments,
    financialConditions: {
      epbg: bidDetails.epbg_required === true || bidDetails.epbg_required === "Yes" || bidDetails.epbg_detail_required === "Yes"
          ? "Required"
          : "Not Required",
          emd: isEmdRequired ? "Required" : "No",
      paymentTerms: "As per GeM GTC",
    },
    eligibilityCriteria: {
      optionClause: typeof optionClause === 'string' ? optionClause : (optionClause?.details ?? optionClause?.description),
    },
    consignee: raw.consignees?.[0]?.address ?? "Consignee not specified",
  };
}