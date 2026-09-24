// server/grok.ts
import Groq from "groq-sdk";
import { extractJsonFromText } from "./utils/extractJson";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export function extractATCSlice(fullText: string): string {
  const normalizedText = fullText.replace(/\s+/g, ' '); 

  const startKeywords = [
    "Buyer Added Bid Specific Terms and Conditions", 
    "Buyer Added Bid Specific ATC", 
    "Buyer Added text based ATC clauses",
    "क्रेता द्वारा जोड़ी गई बिड की विशेष शर्तें"
  ];
  const endKeywords = ["अवीकरण/Disclaimer", "Disclaimer", "This Bid is also governed by"];

  let startIndex = -1;
  for (const kw of startKeywords) {
    startIndex = normalizedText.lastIndexOf(kw);
    if (startIndex !== -1) break;
  }

  let endIndex = -1;
  if (startIndex !== -1) {
    for (const kw of endKeywords) {
      endIndex = normalizedText.indexOf(kw, startIndex);
      if (endIndex !== -1) break;
    }
  }

  let slice = "";
  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    console.log("✂️ [GROK] Plan A: Perfect Slice Achieved!");
    slice = normalizedText.substring(startIndex, endIndex).trim();
  } else if (startIndex !== -1) {
    console.log("✂️ [GROK] Plan B: Start found, but no Disclaimer. Grabbing 5000 chars.");
    slice = normalizedText.substring(startIndex, startIndex + 5000).trim();
  } else {
    console.log("✂️ [GROK] Plan C: Keywords not found. Grabbing bottom 8000 chars.");
    slice = fullText.slice(-8000).trim(); 
  }

  return slice;
}

/**
 * NEW: Accepts both the ATC Text AND the raw URLs extracted from the PDF.
 */
export async function parseATCWithGrok(atcText: string, rawLinks: string[] = []) {
  console.log(`🤖 [GROK] Analyzing ATC Slice length: ${atcText.length} characters & ${rawLinks.length} URLs.`);

const prompt = `You are a Senior Legal and Technical Compliance Officer analyzing an Indian GeM (Government e-Marketplace) tender.
  
  TASK 1 (DEEP SUMMARY): Write a highly detailed executive summary of the ATCs. Break it down into 3 to 4 bullet points. Each point MUST be a full sentence (minimum 15-25 words).
  
  TASK 2 (REQUIRED DOCS): Extract an array of specific Certificates the buyer is demanding.
  
  TASK 3 (SMART LINK EXTRACTION): I have provided a raw list of ALL URLs extracted from the document below. Evaluate them all. Select the URLs that point to vital tender documents (e.g., Technical Specifications, ATC, BoQ, Corrigendum). Assign a professional, human-readable name to each. You may safely ignore generic links (like gem.gov.in homepages or contact links).
  
  TASK 4 (RISK ANALYSIS): Generate 1 to 3 specific Risk Entries based on the ATC text. Categorize them as "Financial", "Technical", or "Logistics". Assign a risk level ("Low", "Medium", "High").

  RAW URLs EXTRACTED FROM PDF:
  ${JSON.stringify(rawLinks)}

  RETURN ONLY RAW JSON. NO MARKDOWN.
  {
    "atc_summary": ["Point 1...", "Point 2..."],
    "required_documents": ["OEM Auth"],
    "documents": [
      { "name": "Buyer ATC Document", "url": "https://..." },
      { "name": "Technical Specifications", "url": "https://..." }
    ],
    "risk_entries": [
      { "category": "Financial", "statement": "Payment terms are Net-90.", "riskLevel": "High" }
    ]
  }
  
  ATC TEXT TO ANALYZE:
  ${atcText}
  `;

  try {
    const response = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.1
    });

    const rawOutput = response.choices[0]?.message?.content || "{}";
    const cleanJson = extractJsonFromText(rawOutput);
    const parsed = JSON.parse(cleanJson);
    
    console.log(`✅ [GROK] Processed ${parsed.documents?.length || 0} smart links and generated summary.`);
    return parsed;
    
  } catch (error: any) {
    console.error("❌ [GROK] CRITICAL ERROR IN EXTRACTION:", error.message);
    return { atc_summary: [], required_documents: [], documents: [] };
  }
}