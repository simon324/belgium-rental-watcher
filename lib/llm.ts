// LLM features via OpenRouter (https://openrouter.ai).
// One OpenRouter key gives you access to Claude, GPT, Gemini, Llama, etc.
// API is OpenAI-compatible — we use plain fetch, no SDK dep.

import type { Criteria } from "./config";
import type { Listing } from "./scrapers/types";

// Default model. Cheap, reliable JSON output, ~$1/1M in. Override via WATCH_LLM_MODEL
// or the `model` request param. Any OpenRouter ID works: anthropic/*, openai/*, google/*, qwen/*, etc.
export const DEFAULT_MODEL = "anthropic/claude-haiku-latest";
const ENV_MODEL = process.env.WATCH_LLM_MODEL || DEFAULT_MODEL;

interface OpenRouterMessage { role: "system" | "user" | "assistant"; content: string }
interface OpenRouterResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

async function callOpenRouter(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  model: string = ENV_MODEL,
): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://belgium-rental-watcher.vercel.app",
      "X-Title": "Belgium Rental Watcher",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ] satisfies OpenRouterMessage[],
    }),
  });
  const json = (await res.json()) as OpenRouterResponse;
  if (!res.ok || json.error) {
    throw new Error(json.error?.message || `OpenRouter ${res.status}`);
  }
  return json.choices?.[0]?.message?.content ?? "";
}

function compressHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 50_000);
}

const EXTRACTION_PROMPT = `You are a rental-listing extractor. Given the (compressed) HTML of a page that lists rental properties, return a JSON object with shape:

{ "listings": [ { "id": "url-or-stable-id", "title": "<short>", "price": <number-EUR-or-null>, "bedrooms": <number-or-null>, "propertyType": "house" | "apartment" | "studio" | null, "location": "<city or postcode>", "url": "<absolute URL>" } ] }

Rules:
- Only include rental listings (not for-sale, not ads, not navigation links).
- "price" is monthly rent in EUR; if you see €/week or per-night, set null.
- Absolute URLs only.
- Cap at 30 listings.
- If the page has zero listings, return { "listings": [] }.

Reply with ONLY the JSON object, no prose.`;

export async function extractListingsFromUrl(
  url: string,
  apiKey: string,
  model?: string,
): Promise<{ listings: Listing[]; error: string | null }> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,nl-BE;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      return { listings: [], error: `HTTP ${res.status} from ${url}` };
    }
    const html = await res.text();
    const compressed = compressHtml(html);

    const text = await callOpenRouter(
      apiKey,
      EXTRACTION_PROMPT,
      `Source URL: ${url}\n\nHTML:\n${compressed}`,
      4096,
      model || ENV_MODEL,
    );

    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return { listings: [], error: "LLM returned no JSON" };
    const parsed = JSON.parse(m[0]) as {
      listings?: Array<{
        id?: string;
        title?: string;
        price?: number | null;
        bedrooms?: number | null;
        propertyType?: string | null;
        location?: string;
        url?: string;
      }>;
    };
    const host = new URL(url).host;
    const listings: Listing[] = (parsed.listings ?? [])
      .filter((l) => l.url && /^https?:/.test(l.url))
      .map((l, i) => ({
        id: `custom:${host}:${l.id ?? l.url ?? i}`,
        source: `custom:${host}`,
        title: l.title || "Listing",
        price: typeof l.price === "number" ? l.price : null,
        url: l.url!,
        location: l.location || "",
        bedrooms: typeof l.bedrooms === "number" ? l.bedrooms : null,
        propertyType:
          l.propertyType === "house" ||
          l.propertyType === "apartment" ||
          l.propertyType === "studio"
            ? l.propertyType === "studio" ? "apartment" : l.propertyType
            : null,
        thumbnail: null,
        postedAt: null,
        rank: i,
      }));
    return { listings, error: null };
  } catch (e) {
    return { listings: [], error: String(e) };
  }
}

export interface MatchScore {
  id: string;
  score: number;
  reason: string;
  summary: string;
}

const MATCH_PROMPT = (criteria: Criteria, preferences: string) => `You score Belgian rental listings against a user's preferences.

The user's hard criteria (already filtered):
- Postal codes: ${criteria.postalCodes.join(", ")}
- Max rent: €${criteria.maxPrice}/mo
- Property type: ${criteria.propertyType}
- Min bedrooms: ${criteria.minBedrooms}

The user's soft preferences (free-text):
"""
${preferences || "(none)"}
"""

For each listing, return a JSON array of { "id": "<the listing id>", "score": 0-100, "reason": "<one short sentence>", "summary": "<1-2 sentence pitch>" }.

Scoring rubric:
- 80-100: hits multiple soft preferences
- 50-79: matches hard criteria, some soft preferences
- 0-49: matches hard criteria only or has a clear soft-preference miss

If preferences are empty, score 60 by default and use the summary to neutrally describe what's notable.

Reply with ONLY the JSON array, no prose.`;

export async function scoreListings(
  listings: Listing[],
  criteria: Criteria,
  preferences: string,
  apiKey: string,
  model?: string,
): Promise<Map<string, MatchScore>> {
  if (listings.length === 0) return new Map();

  const compact = listings.map((l) => ({
    id: l.id,
    title: l.title,
    price: l.price,
    bedrooms: l.bedrooms,
    propertyType: l.propertyType,
    location: l.location,
    source: l.source,
    url: l.url,
  }));

  const text = await callOpenRouter(
    apiKey,
    MATCH_PROMPT(criteria, preferences),
    `Listings:\n${JSON.stringify(compact, null, 2)}`,
    8192,
    model || ENV_MODEL,
  );

  const m = text.match(/\[[\s\S]*\]/);
  if (!m) return new Map();
  let parsed: MatchScore[] = [];
  try { parsed = JSON.parse(m[0]) as MatchScore[]; } catch { return new Map(); }
  const out = new Map<string, MatchScore>();
  for (const s of parsed) {
    if (s && typeof s.id === "string") out.set(s.id, s);
  }
  return out;
}
