export type PropertyType = "house" | "apartment" | "both";

export interface Criteria {
  postalCodes: string[];
  maxPrice: number;
  minBedrooms: number;
  propertyType: PropertyType;
}

function envInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function envList(name: string, fallback: string[]): string[] {
  const v = process.env[name];
  if (!v) return fallback;
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

function envType(name: string, fallback: PropertyType): PropertyType {
  const v = process.env[name];
  if (v === "house" || v === "apartment" || v === "both") return v;
  return fallback;
}

// Defaults: Bruges, max €1000, 1-person house OR apartment.
export const defaultCriteria: Criteria = {
  postalCodes: envList("WATCH_POSTAL_CODES", ["8000", "8200", "8310"]),
  maxPrice: envInt("WATCH_MAX_PRICE", 1000),
  minBedrooms: envInt("WATCH_MIN_BEDROOMS", 0),
  propertyType: envType("WATCH_PROPERTY_TYPE", "both"),
};

// User-supplied list of arbitrary URLs to scrape via the LLM extractor.
export const defaultExtraUrls = envList("WATCH_URLS", []);

// Free-text user preferences for the LLM matcher (e.g. "quiet street, no ground floor, near canal").
export const defaultPreferences = process.env.WATCH_PREFERENCES || "";

// Bring-your-own OpenRouter key. One key works for Claude, GPT, Gemini, Llama, etc.
// Get one at https://openrouter.ai/keys (free signup; pay-as-you-go).
// Falls back to ANTHROPIC_API_KEY for legacy installs but OpenRouter is preferred.
export const defaultOpenRouterKey =
  process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY || "";

// Deprecated alias for back-compat with old code paths.
export const defaultAnthropicKey = defaultOpenRouterKey;

// Default OpenRouter model. Cheap (~$1/1M in), great JSON output.
export const DEFAULT_MODEL = "anthropic/claude-haiku-latest";
export const defaultLlmModel = process.env.WATCH_LLM_MODEL || DEFAULT_MODEL;

// Curated short-list shown as quick picks in the UI. Anyone can also paste any
// OpenRouter model ID — see https://openrouter.ai/models for the full list.
export const MODEL_PRESETS = [
  { id: "anthropic/claude-haiku-latest",  label: "Claude Haiku (default)" },
  { id: "openai/gpt-5.4-nano",            label: "GPT-5.4 nano (cheapest mainstream)" },
  { id: "google/gemini-3.1-flash-lite",   label: "Gemini 3.1 Flash Lite" },
  { id: "anthropic/claude-sonnet-latest", label: "Claude Sonnet (best reasoning, pricier)" },
];

export interface RunInputs {
  criteria: Criteria;
  extraUrls: string[];
  preferences: string;
  openrouterKey: string;
  llmModel: string;
  resendKey: string;
  resendFrom: string;
}

export function parseRunInputsFromQuery(params: URLSearchParams): RunInputs {
  return {
    criteria: parseCriteriaFromQuery(params),
    extraUrls: (params.get("urls") || "")
      .split(/[\s,\n]+/)
      .map((s) => s.trim())
      .filter((s) => /^https?:\/\//.test(s)),
    preferences: params.get("preferences") || defaultPreferences,
    openrouterKey:
      params.get("openrouterKey") ||
      params.get("anthropicKey") ||
      defaultOpenRouterKey,
    llmModel: (params.get("model") || defaultLlmModel).trim(),
    resendKey: params.get("resendKey") || notify.resendKey,
    resendFrom: params.get("resendFrom") || notify.from,
  };
}

export function parseCriteriaFromQuery(params: URLSearchParams): Criteria {
  const postalCodesRaw = params.get("postalCodes");
  const maxPriceRaw = params.get("maxPrice");
  const minBedroomsRaw = params.get("minBedrooms");
  const propertyTypeRaw = params.get("propertyType");

  const postalCodes = postalCodesRaw
    ? postalCodesRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : defaultCriteria.postalCodes;

  const maxPrice = maxPriceRaw ? parseInt(maxPriceRaw, 10) : defaultCriteria.maxPrice;
  const minBedrooms = minBedroomsRaw ? parseInt(minBedroomsRaw, 10) : defaultCriteria.minBedrooms;

  let propertyType: PropertyType = defaultCriteria.propertyType;
  if (propertyTypeRaw === "house" || propertyTypeRaw === "apartment" || propertyTypeRaw === "both") {
    propertyType = propertyTypeRaw;
  }

  return {
    postalCodes,
    maxPrice: Number.isFinite(maxPrice) ? maxPrice : defaultCriteria.maxPrice,
    minBedrooms: Number.isFinite(minBedrooms) ? minBedrooms : defaultCriteria.minBedrooms,
    propertyType,
  };
}

export const notify = {
  email: process.env.NOTIFY_EMAIL || "",
  resendKey: process.env.RESEND_API_KEY || "",
  from: process.env.RESEND_FROM || "Belgium Rental Watcher <onboarding@resend.dev>",
};

export const cronSecret = process.env.CRON_SECRET || "";
