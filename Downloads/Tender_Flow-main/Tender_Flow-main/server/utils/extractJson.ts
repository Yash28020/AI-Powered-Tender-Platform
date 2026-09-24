export function extractJsonFromText(raw: unknown): string {
  const text =
    typeof raw === "string"
      ? raw
      : raw instanceof String
      ? raw.valueOf()
      : null;

  if (typeof text !== "string") {
    throw new Error("extractJsonFromText must receive RAW LLM TEXT only");
  }

  let cleaned = text.trim();

  // 1. IMPROVED MARKDOWN REMOVAL
  // Sometimes LLMs put 'json' or 'JSON' outside the code block or right before the brace.
  cleaned = cleaned
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();

  // 2. SURGICAL BRACE EXTRACTION
  // This is the most reliable way to ignore LLM "chatter" (like "Sure, here is the JSON:")
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("No JSON object found in model output");
  }

  let json = cleaned.slice(firstBrace, lastBrace + 1);

  // 3. FORTIFIED HARDENING
  json = json
    // Remove control characters but PROTECT valid whitespace (\n, \r, \t)
    // Your previous regex /[\u0000-\u001F]/ would strip newlines, potentially breaking long strings.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "")
    
    // Normalize smart quotes (Maintained from your original)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    
    // FIX TRAILING COMMAS: This is the most common reason for JSON.parse to fail.
    // Handles [1,2,3,] and {"a":1,}
    .replace(/,\s*([}\]])/g, "$1");

  return json;
}