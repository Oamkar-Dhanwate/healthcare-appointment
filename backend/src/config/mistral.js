// ─── Mistral AI Client ───────────────────────────────────────────────────────
// Initializes the Mistral AI SDK client for LLM-powered summaries.

import { Mistral } from "@mistralai/mistralai";

let mistralClient = null;

export function getMistralClient() {
  if (mistralClient) return mistralClient;

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey || apiKey === "your_mistral_api_key") {
    console.warn(
      "[Mistral] No valid API key found. AI features will be unavailable."
    );
    return null;
  }

  try {
    mistralClient = new Mistral({ apiKey });
    console.log("[Mistral] Client initialized");
  } catch (err) {
    console.error("[Mistral] Failed to initialize:", err.message);
    mistralClient = null;
  }

  return mistralClient;
}

export const MISTRAL_MODEL = process.env.MISTRAL_MODEL || "mistral-large-latest";
export const MISTRAL_TIMEOUT_MS = Number(process.env.MISTRAL_TIMEOUT_MS) || 15000;

export default getMistralClient;
