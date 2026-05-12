import type { Criteria } from "../config";
import { immowebScraper } from "./immoweb";
import { realoScraper } from "./realo";
import { tweedehandsScraper } from "./tweedehands";
import type { Listing, Scraper } from "./types";

const SCRAPERS: Scraper[] = [tweedehandsScraper, realoScraper, immowebScraper];

export interface ScrapeRunResult {
  listings: Listing[];
  perSource: Record<string, { count: number; error: string | null }>;
}

export async function runAllScrapers(criteria: Criteria): Promise<ScrapeRunResult> {
  const perSource: ScrapeRunResult["perSource"] = {};
  const results = await Promise.all(
    SCRAPERS.map(async (s) => {
      try {
        const items = await s.fetch(criteria);
        perSource[s.name] = { count: items.length, error: null };
        return items;
      } catch (e) {
        perSource[s.name] = { count: 0, error: String(e) };
        return [] as Listing[];
      }
    }),
  );

  const seen = new Set<string>();
  const merged: Listing[] = [];
  for (const list of results) {
    for (const l of list) {
      if (seen.has(l.id)) continue;
      seen.add(l.id);
      merged.push(l);
    }
  }
  return { listings: merged, perSource };
}

export function applyClientSideFilter(
  listings: Listing[],
  criteria: Criteria,
): Listing[] {
  return listings.filter((l) => {
    if (l.price !== null && l.price > criteria.maxPrice) return false;
    if (
      l.bedrooms !== null &&
      criteria.minBedrooms > 0 &&
      l.bedrooms < criteria.minBedrooms
    )
      return false;
    if (criteria.propertyType !== "both" && l.propertyType) {
      const isHouse = l.propertyType.includes("house");
      const isApt =
        l.propertyType.includes("apartment") ||
        l.propertyType.includes("flat") ||
        l.propertyType.includes("studio");
      if (criteria.propertyType === "house" && !isHouse) return false;
      if (criteria.propertyType === "apartment" && !isApt) return false;
    }
    return true;
  });
}

export type { Listing, Scraper } from "./types";
