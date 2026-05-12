import * as cheerio from "cheerio";
import type { Criteria } from "../config";
import { browserHeaders, type Listing, type Scraper } from "./types";

function typeSlug(t: Criteria["propertyType"]): string {
  if (t === "house") return "house";
  if (t === "apartment") return "flat";
  return "house,flat";
}

// Realo uses "<city>-<postcode>" slugs.
const POSTAL_TO_SLUG: Record<string, string> = {
  "8000": "brugge-8000",
  "8200": "brugge-8200",
  "8310": "brugge-8310",
  "8380": "brugge-8380",
};

export const realoScraper: Scraper = {
  name: "realo",
  async fetch(criteria: Criteria): Promise<Listing[]> {
    const slugs = criteria.postalCodes
      .map((p) => POSTAL_TO_SLUG[p])
      .filter(Boolean);
    if (slugs.length === 0) return [];

    const out: Listing[] = [];
    const seen = new Set<string>();
    const types = typeSlug(criteria.propertyType);

    for (const slug of slugs) {
      const url = `https://www.realo.be/en/search/${types}/for-rent/${slug}?priceMax=${criteria.maxPrice}`;
      try {
        const res = await fetch(url, {
          headers: { ...browserHeaders, Referer: "https://www.realo.be/en" },
          cache: "no-store",
        });
        if (!res.ok) {
          console.error("realo", res.status, url);
          continue;
        }
        const html = await res.text();
        const $ = cheerio.load(html);

        const cards = $(".component-estate-grid-item").toArray();
        let rank = 0;
        for (const el of cards) {
          const $card = $(el);
          const idRaw = $card.attr("data-id");
          if (!idRaw || !/^\d{6,}$/.test(idRaw)) continue;
          const id = `realo:${idRaw}`;
          if (seen.has(id)) continue;
          seen.add(id);

          const href = ($card.attr("data-href") || "").trim().replace(/\s+$/, "");
          const listingUrl = href
            ? `https://www.realo.be${href.split("?")[0]}`
            : `https://www.realo.be/en/${slug}/${idRaw}`;

          const cardText = $card.text();
          const priceMatch = cardText.match(/€\s*([\d.,]+)/);
          const price = priceMatch
            ? parseInt(priceMatch[1].replace(/[.,]/g, ""), 10)
            : null;
          if (price !== null && price > criteria.maxPrice) continue;

          const bedMatch = cardText.match(/(\d+)\s*(bed|bedroom|slaap|kamer)/i);
          const bedrooms = bedMatch ? parseInt(bedMatch[1], 10) : null;

          const typeMatch = cardText.match(/\b(House|Apartment|Studio|Flat)\b/);
          const propertyType = typeMatch
            ? typeMatch[1].toLowerCase() === "house"
              ? "house"
              : "apartment"
            : null;

          let title = "Realo listing";
          if (href) {
            const m = href.match(/\/en\/([^/?]+)\//);
            if (m) {
              title = m[1].replace(/-/g, " ");
              if (propertyType) title = `${propertyType} · ${title}`;
            }
          }

          out.push({
            id,
            source: "realo",
            title,
            price,
            url: listingUrl,
            location: slug,
            bedrooms,
            propertyType,
            thumbnail: null,
            postedAt: null, // Realo doesn't expose publication date in search/detail HTML
            rank: rank++,
          });
        }
      } catch (e) {
        console.error("realo error", String(e));
      }
    }

    return out;
  },
};
