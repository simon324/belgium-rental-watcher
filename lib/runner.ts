import {
  defaultCriteria,
  defaultOpenRouterKey,
  defaultPreferences,
  defaultExtraUrls,
  defaultLlmModel,
  type Criteria,
} from "./config";
import { sendDigest } from "./email";
import { extractListingsFromUrl, scoreListings, type MatchScore } from "./llm";
import { applyClientSideFilter, runAllScrapers } from "./scrapers";
import type { Listing } from "./scrapers/types";

export interface ScoredListing extends Listing {
  score?: number;
  reason?: string;
  summary?: string;
}

export interface RunOutcome {
  listings: ScoredListing[];
  totalFound: number;
  perSource: Record<string, { count: number; error: string | null }>;
  emailSent: boolean;
  emailReason?: string;
  at: string;
  recipient: string | null;
  criteria: Criteria;
  extraUrls: string[];
  preferences: string;
  llmUsed: boolean;
  llmModel: string;
}

const TOP_N_FALLBACK = 20;
const RECENCY_HOURS = 24;

function pickRecent(listings: Listing[], now: Date): Listing[] {
  const cutoff = now.getTime() - RECENCY_HOURS * 3_600_000;
  const bySource: Record<string, Listing[]> = {};
  for (const l of listings) (bySource[l.source] ||= []).push(l);

  const out: Listing[] = [];
  for (const [, items] of Object.entries(bySource)) {
    const haveDates = items.some((l) => l.postedAt !== null);
    if (haveDates) {
      for (const l of items) {
        if (l.postedAt && new Date(l.postedAt).getTime() >= cutoff) out.push(l);
      }
    } else {
      items.sort((a, b) => a.rank - b.rank);
      out.push(...items.slice(0, TOP_N_FALLBACK));
    }
  }
  return out;
}

export async function runOnce(
  triggeredBy: "cron" | "manual",
  options: {
    criteria?: Criteria;
    extraUrls?: string[];
    preferences?: string;
    openrouterKey?: string;
    llmModel?: string;
    resendKey?: string;
    resendFrom?: string;
    emailOverride?: string;
    skipEmail?: boolean;
  } = {},
): Promise<RunOutcome> {
  const criteria = options.criteria ?? defaultCriteria;
  const extraUrls = options.extraUrls ?? defaultExtraUrls;
  const preferences = (options.preferences ?? defaultPreferences).trim();
  const llmKey = (options.openrouterKey ?? defaultOpenRouterKey).trim();
  const llmModel = (options.llmModel || defaultLlmModel).trim();
  const now = new Date();
  const at = now.toISOString();

  const { listings: builtinListings, perSource } = await runAllScrapers(criteria);

  // Generic LLM-based URL scrapers (each user-supplied URL becomes its own pseudo-source).
  if (extraUrls.length > 0) {
    if (!llmKey) {
      for (const u of extraUrls) {
        const host = (() => { try { return new URL(u).host; } catch { return u; } })();
        perSource[`custom:${host}`] = { count: 0, error: "OPENROUTER_API_KEY required to scrape custom URLs" };
      }
    } else {
      await Promise.all(
        extraUrls.map(async (u) => {
          const host = (() => { try { return new URL(u).host; } catch { return u; } })();
          const { listings, error } = await extractListingsFromUrl(u, llmKey, llmModel);
          builtinListings.push(...listings);
          perSource[`custom:${host}`] = { count: listings.length, error };
        }),
      );
    }
  }

  const filtered = applyClientSideFilter(builtinListings, criteria);
  const recent = pickRecent(filtered, now);

  let scored: ScoredListing[] = recent;
  let llmUsed = false;
  if (llmKey && recent.length > 0) {
    try {
      const scores = await scoreListings(recent, criteria, preferences, llmKey, llmModel);
      scored = recent.map((l): ScoredListing => {
        const s = scores.get(l.id);
        return s ? { ...l, score: s.score, reason: s.reason, summary: s.summary } : l;
      });
      // Sort by score desc; unscored go last.
      scored.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
      llmUsed = true;
    } catch (e) {
      console.error("LLM scoring failed", String(e));
    }
  }

  let emailSent = false;
  let emailReason: string | undefined;
  let recipient: string | null = null;
  if (!options.skipEmail) {
    const email = await sendDigest({
      listings: scored,
      criteria,
      triggeredBy,
      preferences,
      recipientOverride: options.emailOverride,
      resendKey: options.resendKey,
      resendFrom: options.resendFrom,
    });
    emailSent = email.sent;
    emailReason = email.reason;
    recipient = email.recipient;
  }

  return {
    listings: scored,
    totalFound: filtered.length,
    perSource,
    emailSent,
    emailReason,
    at,
    recipient,
    criteria,
    extraUrls,
    preferences,
    llmUsed,
    llmModel,
  };
}

export type { MatchScore };
