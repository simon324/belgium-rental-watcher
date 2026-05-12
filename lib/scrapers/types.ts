import type { Criteria } from "../config";

export interface Listing {
  id: string;              // globally unique: "<source>:<native id>"
  source: string;          // "immoweb" | "realo" | "tweedehands"
  title: string;
  price: number | null;    // monthly rent in EUR
  url: string;
  location: string;        // city / postal code
  bedrooms: number | null;
  propertyType: string | null;
  thumbnail: string | null;
  // ISO timestamp if extractable, else null. Null means "we can't tell — use ranking position as a proxy."
  postedAt: string | null;
  // Sort-position within its source (lower = newer/higher-ranked). Used to fall back when postedAt is null.
  rank: number;
}

export interface Scraper {
  name: string;
  fetch(criteria: Criteria): Promise<Listing[]>;
}

// Belgian-Chrome-like headers. DataDome (Immoweb) and Cloudflare-lite (Realo) want a full set.
export const browserHeaders: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,nl-BE;q=0.8,nl;q=0.7",
  "Accept-Encoding": "gzip, deflate, br",
  "Sec-Ch-Ua":
    '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"macOS"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};
