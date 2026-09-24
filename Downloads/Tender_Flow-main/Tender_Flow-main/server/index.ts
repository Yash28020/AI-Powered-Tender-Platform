// server/index.ts
import 'dotenv/config';
import { pool } from './db';
import express, { Request, Response } from "express";
import cors from "cors";
import axios from 'axios';
import { parseRFP} from "./gemini.js";
import { runTechnicalAgent } from "../src/agents/technicalagent";
import runFinancialAgent from "../src/agents/financialagent";
import { productInventory } from "../data/storeData";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { DiscoveryCoordinator } from "./discovery/DiscoveryCoord";
import { getHelperBotResponse } from "./chatbot.js";
import { login, setupPin, setup2FA, verify2FA, verifyVaultAccess, checkEmail, sendAuthOtp, verifyAuthOtp } from './auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { extractATCSlice, parseATCWithGrok } from './grok';
import ConvertAPI from 'convertapi';
const convertapi = new ConvertAPI(process.env.CONVERT_API_SECRET as string);

// --- CONFIGURATION & MIDDLEWARE ---
process.on('uncaughtException', (err) => {
  console.error('🔥 CRITICAL UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// --- HELPER FUNCTIONS ---
async function extractTextFromBuffer(buffer: ArrayBuffer): Promise<{ fullText: string, extractedLinks: string[] }> {
  const data = new Uint8Array(buffer);
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdfDocument = await loadingTask.promise;
  
  let fullText = "";
  const extractedLinks: string[] = []; 
  
  for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
    const page = await pdfDocument.getPage(pageNum);
    
    const textContent = await page.getTextContent();
    let pageText = textContent.items
      .map((item: any) => item.str)
      .join(" ");
    pageText = pageText.replace(/\*{7,}/g, (match) => "(Exact Location not visible due to security reasons) ");
    pageText = pageText.replace(/\*{5,}([A-Z\s,]+)/g, "$1");
    fullText += pageText + "\n";

    try {
      const annotations = await page.getAnnotations();
      annotations.forEach((anno: any) => {
        if (anno.subtype === 'Link' && anno.url) {
             extractedLinks.push(anno.url);
        }
      });
    } catch (e) {
      console.warn(`⚠️ Warning: Failed to extract annotations from page ${pageNum}. Continuing without links from this page.`);
    }
  }
  const relativeLinks = fullText.match(/\/bidding\/buyer\/[a-zA-Z0-9\/_-]+/g) || [];
  relativeLinks.forEach(u => extractedLinks.push(`https://bidplus.gem.gov.in${u}`));
  
  return { 
    fullText, 
    extractedLinks: Array.from(new Set(extractedLinks)) 
  };
}

function addLogToConsole(agent: string, message: string) {
  console.log(`\x1b[35m%s\x1b[0m`, `[${agent}]`, message); 
}

// --- FILE STORAGE SETUP ---
const vaultDir = path.join(process.cwd(), 'vault_storage'); 
if (!fs.existsSync(vaultDir)){
    fs.mkdirSync(vaultDir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, vaultDir)
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
  }
});
const upload = multer({ storage: storage });

// ============================================================================
//  API ROUTES
// ============================================================================

app.post("/api/auth/login", login);           
app.post("/api/vault/setup-pin", setupPin);   
app.post("/api/vault/setup-2fa", setup2FA);
app.post("/api/vault/verify-2fa", verify2FA);
app.post("/api/vault/verify-pin", verifyVaultAccess);
app.post("/api/auth/check-email", checkEmail);
app.post("/api/auth/send-otp", sendAuthOtp);
app.post("/api/auth/verify-otp", verifyAuthOtp);

// ============================================================================
//  REAL PDF TO DOCX CONVERSION ENGINE (PROXY DOWNLOADER)
// ============================================================================
app.post("/api/convert-pdf", async (req: Request, res: Response) => {
  let tempFilePath = "";

  try {
    const { url, fileName } = req.body;
    console.log(`[CONVERT_ENGINE] Initiating proxy download for: ${fileName}`);

    const pdfResponse = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'application/pdf,application/json,text/plain,*/*',
        'Referer': 'https://bidplus.gem.gov.in/'
      }
    });

    tempFilePath = path.join(vaultDir, `temp_convert_${Date.now()}.pdf`);
    fs.writeFileSync(tempFilePath, pdfResponse.data);
    console.log(`[CONVERT_ENGINE] Temporarily saved to: ${tempFilePath}`);

    console.log(`[CONVERT_ENGINE] Uploading local file to ConvertAPI...`);
    const result = await convertapi.convert('docx', {
        File: tempFilePath,
    }, 'pdf');

    const docxUrl = result.file.url;
    console.log(`[CONVERT_ENGINE] ✅ Success: ${docxUrl}`);

    fs.unlinkSync(tempFilePath);
    console.log(`[CONVERT_ENGINE] 🧹 Cleaned up temporary file.`);

    res.json({ success: true, docxUrl });

  } catch (err: any) {
    console.error("🔥 [CONVERT_ENGINE] Failed:", err.message);
    if (tempFilePath && fs.existsSync(tempFilePath)) {
       fs.unlinkSync(tempFilePath);
       console.log(`[CONVERT_ENGINE] 🧹 Cleaned up temporary file after error.`);
    }
    res.status(500).json({ success: false, error: "Conversion failed" });
  }
});

// ============================================================================
//  REAL-TIME MARKET INTELLIGENCE (Cached AI JSON Payload)
// ============================================================================
let cachedMarketData: any = null;
let lastInsightFetchTime = 0;

app.get("/api/market-insights", async (req: Request, res: Response) => {
  try {
    const CACHE_TTL = 1000 * 60 * 60; // Cache for 1 Hour
    
    if (cachedMarketData && (Date.now() - lastInsightFetchTime < CACHE_TTL)) {
      console.log("[MARKET_INTEL] Serving cached unified market data.");
      return res.json({ success: true, data: cachedMarketData });
    }

    console.log("[MARKET_INTEL] Fetching live market data via AI...");
    
    const prompt = `You are a live financial API. Output a strict JSON object containing two keys:
1. "insights": An array of exactly 4 short, distinct sentences (max 20 words each) about current global macroeconomic trends for Copper, Aluminum, and PVC resin.
2. "commodities": An array of exactly 4 objects for specific commodities (Copper, Aluminum, PVC Resin, Galvanized Steel). Each object must have: "symbol" (e.g. "LME.Cu"), "name", "price" (approximate current INR price formatted as string, e.g. "₹715.50"), "trend" (percentage trend string, e.g. "+1.2%"), and "up" (boolean true if trend is positive, false if negative).

RETURN ONLY RAW JSON. NO MARKDOWN.`;
    
    const aiResponse = await getHelperBotResponse(prompt, null, []); 
    
    const cleanJson = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(cleanJson);
    
    if (parsedData.insights && parsedData.commodities) {
       cachedMarketData = parsedData;
       lastInsightFetchTime = Date.now();
    }

    res.json({ 
      success: true, 
      data: cachedMarketData || { insights: ["Market intelligence uplink established..."], commodities: [] } 
    });
  } catch (err: any) {
    console.error("🔥 [MARKET_INTEL] Fetch Error:", err.message);
    res.json({ 
      success: false, 
      data: cachedMarketData || { 
        insights: ["Global market telemetry temporarily offline."],
        commodities: [
          { symbol: "LME.Cu", name: "Copper (Grade A)", price: "₹---", trend: "0.0%", up: true },
          { symbol: "LME.Al", name: "Primary Alum", price: "₹---", trend: "0.0%", up: true },
          { symbol: "IDX.PVC", name: "PVC Resin", price: "₹---", trend: "0.0%", up: true },
          { symbol: "IDX.STL", name: "Galv Steel", price: "₹---", trend: "0.0%", up: true }
        ] 
      } 
    });
  }
});

// ============================================================================
//  DISCOVERY & AGENT ROUTES
// ============================================================================
app.post("/api/discover", async (req: Request, res: Response) => {
  try {
    const { portal, category, filters, inventory } = req.body;

    if (!category || !inventory) {
      return res.status(400).json({ success: false, error: "Missing required discovery parameters" });
    }

    const coordinator = new DiscoveryCoordinator(inventory, (agent, message, data) => {
      console.log(`[${agent}] ${message}`, data || "");
    });

    addLogToConsole('MASTER_AGENT', `Starting discovery for: ${category}`);
    
    const qualifiedBids = await coordinator.runDiscovery(portal || 'gem', category, filters);
    res.json({ success: true, data: qualifiedBids });

  } catch (err: any) {
    console.error("Discovery Route Error:", err.message);
    res.status(500).json({ success: false, error: "Discovery Agent failed to scan portals", message: err.message });
  }
});

// ============================================================================
//  VAULT MANAGEMENT ENDPOINTS
// ============================================================================

// 1. ADD NEW DOCUMENT 
app.post('/api/vault/add-document', upload.single('file'), async (req: Request, res: Response) => {
    try {
        const { certName, category, expiryDate } = req.body;
        const file = req.file;
        if (!file) return res.status(400).json({ error: "No file uploaded" });

        const finalExpiry = expiryDate === 'Lifetime' ? '2099-12-31' : expiryDate;

        const result = await pool.query(
            "INSERT INTO compliance_vault (cert_name, category, is_valid, expiry_date, file_path) VALUES ($1, $2, true, $3, $4) RETURNING id",
            [certName, category, finalExpiry, file.filename] // FIXED: file.filename prevents absolute path bugs
        );
        
        res.json({ success: true, newId: result.rows[0].id, filePath: file.filename });
    } catch (err) {
        console.error("Add Document Error:", err);
        res.status(500).json({ error: "Failed to add new document to vault" });
    }
});

// 2. FETCH ALL DOCUMENTS
app.get("/api/vault/documents", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT cert_name, category, is_valid, expiry_date 
      FROM compliance_vault 
      WHERE is_valid = true
    `);
    res.json({ success: true, documents: result.rows });
  } catch (err: any) {
    console.error("🔥 [VAULT] Fetch Error:", err.message);
    res.status(500).json({ success: false, error: "Failed to fetch vault documents" });
  }
});

// 3. UPDATE EXISTING DOCUMENT
app.post('/api/vault/upload', upload.single('file'), async (req: Request, res: Response) => {
    try {
        const { docId, expiryDate } = req.body;
        const file = req.file;
        if (!file) return res.status(400).json({ error: "No file uploaded" });

        const finalExpiry = expiryDate === 'Lifetime' ? '2099-12-31' : expiryDate;

        await pool.query(
            "UPDATE compliance_vault SET file_path = $1, is_valid = true, expiry_date = $2 WHERE id = $3",
            [file.filename, finalExpiry, docId] // FIXED: file.filename
        );
        res.json({ success: true, filePath: file.filename });
    } catch (err) {
        console.error("Upload Error:", err);
        res.status(500).json({ error: "Upload failed" });
    }
});

// 4. VIEW DOCUMENT (Opens in Browser Tab)
app.get('/api/vault/view/:filename', (req, res) => {
    const filePath = path.join(vaultDir, req.params.filename);
    res.sendFile(filePath); // sendFile tells browser to display inline
});

// 5. DOWNLOAD DOCUMENT (Forces Hard Download)
app.get('/api/vault/download/:filename', (req, res) => {
    const filePath = path.join(vaultDir, req.params.filename);
    res.download(filePath); // download forces Save As dialog
});

// ============================================================================
//  OTHER ENDPOINTS
// ============================================================================
app.get("/api/compliance-check", async (req: Request, res: Response) => {
  try {
    const profile = await pool.query("SELECT * FROM company_profile LIMIT 1");
    const certs = await pool.query("SELECT id, cert_name, category, is_valid, TO_CHAR(expiry_date, 'YYYY-MM-DD') as expiry_date, file_path FROM compliance_vault ORDER BY id ASC");
    
    res.json({
      profile: profile.rows[0],
      certificates: certs.rows
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch compliance data" });
  }
});

app.post("/api/update-config", async (req: Request, res: Response) => {
  const { password, companyDetails } = req.body;
  if (password !== "TF-Admin-2026") {
    return res.status(401).json({ error: "Unauthorized Vault Access" });
  }
  try {
    await pool.query(
      "UPDATE company_profile SET company_name = $1, address = $2, gstin = $3, pan = $4",
      [companyDetails.companyName, companyDetails.companyAddress, companyDetails.gstin, companyDetails.pan]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Database update failed" });
  }
});

app.get("/api/inventory", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM product_inventory ORDER BY product_name ASC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).send("Inventory Retrieval Error");
  }
});

app.post("/api/inventory/update-stock", async (req, res) => {
  const { skuId, newQty } = req.body;
  await pool.query("UPDATE product_inventory SET available_qty = $1 WHERE sku_id = $2", [newQty, skuId]);
  res.json({ success: true });
});

app.post("/api/copilot-chat", async (req: Request, res: Response) => {
  try {
    const { query, context, history } = req.body;
    const reply = await getHelperBotResponse(query, context, history);
    res.json({ reply });
  } catch (err: any) {
    console.error("Copilot Error:", err);
    res.status(500).json({ reply: "I encountered a processing error. Please try again." });
  }
});

app.post("/api/fetch-rfp-url", async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    const response = await axios.get(url, { 
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    const result = await extractTextFromBuffer(response.data);
    res.json({ content: result.fullText, extractedLinks: result.extractedLinks }); 
  } catch (err: any) {
    console.error("URL Fetch Error:", err.message);
    res.status(500).json({ error: "Failed to fetch or parse GeM PDF" });
  }
});

app.post("/api/parse-rfp", async (req: Request, res: Response) => {
  try {
    const { content, filters, extractedLinks, inventory } = req.body;

    if (!content || typeof content !== "string") {
      return res.status(400).json({ error: "INVALID_REQUEST", message: "RFP content is missing" });
    }

    let finalLinks = extractedLinks || [];
    if (finalLinks.length === 0) {
       const relativeLinks = content.match(/\/bidding\/buyer\/[a-zA-Z0-9\/_-]+/g) || [];
       const absoluteLinks = content.match(/https?:\/\/[^\s"')]+/g) || [];
       
       const mappedRelative = relativeLinks.map((u: string) => `https://bidplus.gem.gov.in${u}`);
       finalLinks = Array.from(new Set([...absoluteLinks, ...mappedRelative]));
    }

    const atcSlice = extractATCSlice(content);

    console.log(`⚡ Firing Gemini & Grok in Parallel... (Sent ${finalLinks.length} URLs to Grok)`);
    
    const [parsedData, atcData] = await Promise.all([
      parseRFP(content),                 
      parseATCWithGrok(atcSlice, finalLinks) 
    ]);

    parsedData.buyer_added_terms = atcData.atc_summary || [];
    parsedData.mandatoryDocuments = Array.from(new Set([
      ...(parsedData.mandatoryDocuments || []),
      ...(atcData.required_documents || [])
    ]));
    parsedData.extractedLinks = atcData.documents || []; 

    const products = Array.isArray(parsedData?.products) ? parsedData.products : [];
    if (products.length === 0) {
      return res.json({ data: { parsedData, technicalAnalysis: { itemAnalyses: [] }, pricing: {}, riskAnalysis: [] } });
    }

    const activeInventory = inventory && inventory.length > 0 ? inventory : productInventory;
    const technicalResult = runTechnicalAgent(products, activeInventory);
    const hasLineItems = technicalResult?.itemAnalyses && technicalResult.itemAnalyses.length > 0;

    const defaultFilters = { manualAvgKms: 0, manualRatePerKm: 55, allowEMD: true, minMatchThreshold: 20 };
    const financialResult = hasLineItems
      ? runFinancialAgent(technicalResult.itemAnalyses, parsedData, filters || defaultFilters)
      : { pricing: {}, riskEntries: [] ,summary: {}};

    const grokRisks = atcData.risk_entries || [];
    
    res.json({
      data: {
        parsedData,
        technicalAnalysis: { itemAnalyses: technicalResult.itemAnalyses ?? [] },
        pricing: financialResult || { pricing: {}, riskEntries: [], summary: {} },
        riskAnalysis: [
          ...grokRisks,
          ...(technicalResult.riskEntries ?? []), 
          ...(financialResult.riskEntries ?? [])
        ],
      },
    });
    
  } catch (err: any) {
    console.error("🔥 BACKEND ERROR:", err);
    return res.status(500).json({ error: "BACKEND_LIVE_ERROR" });
  }
});

const initDb = async () => {
  try {
    const client = await pool.connect();
    client.release();
    console.log('✅ Connected to PostgreSQL');

    const check = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'company_profile'
      );
    `);

    if (!check.rows[0].exists) {
      console.log('⚡ Initializing Database Schema...');
      const schemaPath = path.join(process.cwd(), 'server', 'schema.sql');
      
      if (fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(schemaSql);
        console.log('✅ Database Tables Created Successfully');
      } else {
        console.error('❌ FATAL: schema.sql not found at', schemaPath);
      }
    } else {
      console.log('✅ Database Schema Verified');
    }
  } catch (err) {
    console.error('❌ Database Initialization Failed:', err);
    process.exit(1); 
  }
};

initDb().then(() => {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`🚀 Agent backend running on http://localhost:${PORT}`);
  });
});