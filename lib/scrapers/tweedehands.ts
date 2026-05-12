import type { Criteria } from "../config";
import { parseDutchDate } from "./dutch-date";
import type { Listing, Scraper } from "./types";

const BASE = "https://www.2dehands.be/lrp/api/search";
const L1_IMMO = 1032;
const L2_HOUSES = 2143;
const L2_APARTMENTS = 2771;

interface TweedehandsListing {
  itemId: string;
  title?: string;
  priceInfo?: { priceCents?: number; priceType?: string };
  location?: { cityName?: string; postcode?: string };
  vipUrl?: string;
  categoryId?: number;
  date?: string;
  pictures?: { extraSmallUrl?: string }[];
  attributes?: { key: string; value: unknown }[];
}

async function fetchCategory(
  l2: number,
  postcode: string,
  maxPriceCents: number,
): Promise<TweedehandsListing[]> {
  const params = new URLSearchParams({
    l1CategoryId: String(L1_IMMO),
    l2CategoryId: String(l2),
    postcode,
    distanceMeters: "10000",
    limit: "50",
    offset: "0",
    sortBy: "SORT_INDEX",
    sortOrder: "DECREASING",
  });
  params.append("attributesByKey[]", `PriceCentsTo:${maxPriceCents}`);

  const res = await fetch(`${BASE}?${params.toString()}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "nl-BE,nl;q=0.9,en;q=0.8",
      Referer: "https://www.2dehands.be/l/immo/",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`2dehands ${res.status} for postcode=${postcode} l2=${l2}`);
  }
  const json = (await res.json()) as { listings?: TweedehandsListing[] };
  return json.listings ?? [];
}

function findBedrooms(item: TweedehandsListing): number | null {
  const attr = item.attributes?.find(
    (a) => a.key === "bedrooms" || a.key === "Slaapkamers",
  );
  if (!attr) return null;
  const n = parseInt(String(attr.value), 10);
  return Number.isFinite(n) ? n : null;
}

export const tweedehandsScraper: Scraper = {
  name: "tweedehands",
  async fetch(criteria: Criteria): Promise<Listing[]> {
    const maxCents = criteria.maxPrice * 100;
    const categories: number[] = [];
    if (criteria.propertyType === "house" || criteria.propertyType === "both") {
      categories.push(L2_HOUSES);
    }
    if (
      criteria.propertyType === "apartment" ||
      criteria.propertyType === "both"
    ) {
      categories.push(L2_APARTMENTS);
    }

    const results: Listing[] = [];
    const seen = new Set<string>();
    let rank = 0;

    for (const postcode of criteria.postalCodes) {
      for (const l2 of categories) {
        try {
          const items = await fetchCategory(l2, postcode, maxCents);
          for (const item of items) {
            const id = `tweedehands:${item.itemId}`;
            if (seen.has(id)) continue;
            seen.add(id);

            const priceCents = item.priceInfo?.priceCents;
            const price =
              typeof priceCents === "number" && priceCents > 0
                ? Math.round(priceCents / 100)
                : null;
            if (price === null) continue;
            if (price < 100) continue;
            if (price > criteria.maxPrice) continue;
            if (price > 5000) continue;

            const url = item.vipUrl
              ? `https://www.2dehands.be${item.vipUrl}`
              : "";
            const propertyType =
              item.categoryId === L2_HOUSES ? "house" : "apartment";

            const posted = item.date ? parseDutchDate(item.date) : null;

            results.push({
              id,
              source: "tweedehands",
              title: item.title ?? "(no title)",
              price,
              url,
              location:
                [item.location?.cityName, item.location?.postcode]
                  .filter(Boolean)
                  .join(" ") || "",
              bedrooms: findBedrooms(item),
              propertyType,
              thumbnail: item.pictures?.[0]?.extraSmallUrl ?? null,
              postedAt: posted ? posted.toISOString() : null,
              rank: rank++,
            });
          }
        } catch (e) {
          console.error("tweedehands fetch failed", { postcode, l2, error: String(e) });
        }
      }
    }
    return results;
  },
};
