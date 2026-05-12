import * as cheerio from "cheerio";
import type { Criteria } from "../config";
import { browserHeaders, type Listing, type Scraper } from "./types";

function pathSegmentForType(t: Criteria["propertyType"]): string {
  if (t === "house") return "house";
  if (t === "apartment") return "apartment";
  return "house-and-apartment";
}

// Immoweb's search page is a client-rendered SPA; no usable inline JSON.
// Price/bedroom filtering is enforced via the URL query params (server-side).
// We extract IDs + URLs from anchor tags and trust the URL filter for price.
export const immowebScraper: Scraper = {
  name: "immoweb",
  async fetch(criteria: Criteria): Promise<Listing[]> {
    const type = pathSegmentForType(criteria.propertyType);
    const postalCodes = criteria.postalCodes.map((p) => `BE-${p}`).join(",");
    const url =
      `https://www.immoweb.be/en/search/${type}/for-rent` +
      `?countries=BE&postalCodes=${postalCodes}` +
      `&maxPrice=${criteria.maxPrice}` +
      `&page=1&orderBy=newest`;

    const res = await fetch(url, {
      headers: { ...browserHeaders, Referer: "https://www.immoweb.be/en" },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`immoweb ${res.status}`);
    }
    const html = await res.text();
    const $ = cheerio.load(html);

    const out: Listing[] = [];
    const seen = new Set<string>();
    let rank = 0;
    $('a[href*="/classified/"]').each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      const m = href.match(
        /\/classified\/([^/]+)\/for-rent\/([^/]+)\/(\d+)\/(\d+)/,
      );
      if (!m) return;
      const [, slug, locality, postal, idRaw] = m;
      const id = `immoweb:${idRaw}`;
      if (seen.has(id)) return;
      seen.add(id);

      const propertyType = slug.includes("house")
        ? "house"
        : slug.includes("apartment") ||
          slug.includes("flat") ||
          slug.includes("studio")
        ? "apartment"
        : null;

      const full = href.startsWith("http") ? href : `https://www.immoweb.be${href}`;
      out.push({
        id,
        source: "immoweb",
        title: `${slug.replace(/-/g, " ")} for rent in ${locality.replace(/-/g, " ")}`,
        price: null,
        url: full,
        location: `${locality} ${postal}`,
        bedrooms: null,
        propertyType,
        thumbnail: null,
        postedAt: null,
        rank: rank++,
      });
    });
    return out;
  },
};
