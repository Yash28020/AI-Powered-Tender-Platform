import { GoogleGenerativeAI } from "@google/generative-ai";
import { extractJsonFromText } from "./utils/extractJson";
import { normalizeParsedRfp } from "./utils/normalizeParsedRfp";

const keys = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2
].filter(Boolean) as string[];

let currentKeyIndex = 0;
function getAIInstance() {
  if (keys.length === 0) throw new Error("No Gemini API keys found in .env");
  const key = keys[currentKeyIndex];
  return new GoogleGenerativeAI(key);
}

function rotateKey() {
  currentKeyIndex = (currentKeyIndex + 1) % keys.length;
  console.log(`🔄 [SYSTEM] API Failure. Rotating to Key Index: ${currentKeyIndex}`);
}

async function generateWithRetry(prompt: string) {
  const maxAttempts = keys.length * 2; 
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const genAI = getAIInstance();
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash", 
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 20480,
        }
      });

      const result = await model.generateContent(prompt);
      return result;

    } catch (error: any) {
      console.warn(`⚠️ API Attempt ${attempt + 1} Failed with Key Index ${currentKeyIndex}:`, error.message);
      rotateKey();
      if (attempt === maxAttempts - 1) {
        throw new Error(`All API keys exhausted. Last error: ${error.message}`);
      }
      await new Promise(res => setTimeout(res, 1000));
    }
  }
  throw new Error("Unexpected error: Retry loop finished without result.");
}

export async function parseRFP(content: string) {
  const prompt = `
You are an expert Indian Government GeM (Government e-Marketplace) tender analyst.
Your task is to extract highly specific data from the provided tender document content.

STRICT JSON STRUCTURE:
{
  "bid_details": {
    "bid_number": "String",
    "organisation_name": "String",
    "type_of_bid": "String",
    "bid_end_date_time": "String",
    "bid_offer_validity_days": Number,
    "total_quantity": Number,
    "item_category": ["String"],
    "office_name": "String",
    "epbg_detail_required": "Yes/No"
  },
  "item_details": [
    {
      "item_category_code": "String",
      "consignees": [
        {
          "quantity": Number,
          "delivery_days": Number,
          "address": "String"
        }
      ]
    }
  ],
  "technical_specifications": {
    "specification_document": "String",
    "boq_detail_document": "String"
  },
  "consignees": [
    {
      "address": "String",
      "total_quantity": Number,
      "delivery_days": Number
    }
  ],
  "buyer_added_terms": ["String"]
}

STRICT RULES:
1. Extract ALL item categories and their specific quantities from the item_details/consignee sections.
2. If specifications are mentioned as "View File" or in an annexure, list them in technical_specifications.
3. Buyer added terms must include mentions of inspection, guarantee, and option clauses.
4. Output ONLY the JSON object. No preamble, no markdown.
5. IMPORTANT: If any text contains double quotes, replace them with single quotes inside the JSON string to prevent parsing errors.
6. Buyer added terms: Provide ONLY the first 10 most critical terms. Summarize each to under 100 characters. DO NOT include full legal text.
7. If an address contains 'Location not visible due to security reasons', keep that exact phrase in the JSON.
8. If an address contains partial asterisks, extract only the readable City/State names.
9. "When extracting financial requirements, explicitly look for the 'EMD Detail' or 'ईएमडी विवरण' tables. Map the value next to 'ईएमडी राशि/EMD Amount' to the integer field 'emdAmount'. Do the same for 'ePBG Detail'. If none is found, return 0."

DOCUMENT CONTENT:
${content.substring(0, 30000)}
`;

  const result = await generateWithRetry(prompt);
  const response: any = result.response;

  let rawText: string;

  if (typeof response?.text === "function") {
    rawText = String(response.text());
  } else if (response?.candidates?.[0]?.content?.parts) {
    rawText = response.candidates[0].content.parts
      .map((p: any) => String(p.text ?? ""))
      .join("\n");
  } else {
    throw new Error("Gemini returned no text");
  }

  console.log("🧠 RAW GEMINI OUTPUT START");
  console.log("🧠 RAW GEMINI OUTPUT END");

  const jsonString = extractJsonFromText(rawText);
  let sanitizedJson = "";

  try {
    sanitizedJson = jsonString
      .replace(/[\u201C\u201D]/g, '"') 
      .replace(/[\u2018\u2019]/g, "'") 
      .replace(/\n/g, " ");

    const repairJson = (str: string) => {
      const stack: string[] = [];
      for (const char of str) {
        if (char === '{') stack.push('}');
        else if (char === '[') stack.push(']');
        else if (char === '}' || char === ']') {
          if (stack[stack.length - 1] === char) stack.pop();
        }
      }
      return str + stack.reverse().join('');
    };

    sanitizedJson = repairJson(sanitizedJson);

    sanitizedJson = sanitizedJson.replace(/":\s*"(.*?)"\s*([,}])/g, (match, content, suffix) => {
      const cleanedContent = content.replace(/"/g, "'");
      return `": "${cleanedContent}"${suffix}`;
    });

    sanitizedJson = sanitizedJson.replace(/,\s*([\]}])/g, '$1');

    const json = JSON.parse(sanitizedJson);
    return normalizeParsedRfp(json);

  } catch (e: any) {
    const pos = parseInt(e.message.match(/\d+/)?.[0] || "0");
    console.error("🧠 JSON Error Context:", sanitizedJson.substring(Math.max(0, pos - 50), pos + 50));
    throw new Error(`AI generated invalid JSON: ${e.message}`);
  }
}