import "dotenv/config";

const API_KEY = process.env.GEMINI_API_KEY;

async function listModels() {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1/models?key=${API_KEY}`
  );

  const data = await res.json();

  if (!res.ok) {
    console.error("❌ Error response:", data);
    return;
  }

  console.log("✅ Available models:\n");

  for (const model of data.models ?? []) {
    console.log(`- ${model.name}`);
  }
}

listModels().catch(console.error);
