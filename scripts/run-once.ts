// CLI runner. Examples:
//   npm run check
//   npm run check -- --postcodes 8000 --max 1200 --type apartment --bedrooms 1
//   npm run check -- --urls https://example.com/rent,https://other.be/rentals --prefs "near canal, quiet"
//   npm run check -- --email simon@example.com
//
// Flags:
//   --postcodes <csv>     e.g. 8000,8200,8310
//   --max <n>             max monthly rent in EUR
//   --type <both|house|apartment>
//   --bedrooms <n>        minimum bedrooms
//   --urls <csv>          comma-separated additional URLs (LLM extraction)
//   --prefs <text>        free-text matching preferences for LLM scoring
//   --openrouter <key>    override OPENROUTER_API_KEY env var (or use --anthropic legacy alias)
//   --model <id>          OpenRouter model id, e.g. openai/gpt-5.4-nano (default: anthropic/claude-haiku-latest)
//   --resend <key>        override RESEND_API_KEY env var
//   --from <addr>         override RESEND_FROM env var
//   --email <addr>        if set, send the digest
//   --json                emit raw JSON instead of a human report

import { defaultOpenRouterKey, defaultCriteria, defaultExtraUrls, defaultPreferences, type Criteria, type PropertyType } from "../lib/config";
import { runOnce } from "../lib/runner";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : undefined;
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function parseType(s: string | undefined): PropertyType {
  if (s === "house" || s === "apartment" || s === "both") return s;
  return defaultCriteria.propertyType;
}

const criteria: Criteria = {
  postalCodes: arg("postcodes")?.split(",").map((s) => s.trim()).filter(Boolean) ?? defaultCriteria.postalCodes,
  maxPrice: arg("max") ? parseInt(arg("max")!, 10) : defaultCriteria.maxPrice,
  minBedrooms: arg("bedrooms") ? parseInt(arg("bedrooms")!, 10) : defaultCriteria.minBedrooms,
  propertyType: parseType(arg("type")),
};

const extraUrls = arg("urls")?.split(",").map((s) => s.trim()).filter((s) => /^https?:\/\//.test(s)) ?? defaultExtraUrls;
const preferences = arg("prefs") ?? defaultPreferences;
const openrouterKey = arg("openrouter") ?? arg("anthropic") ?? defaultOpenRouterKey;
const llmModel = arg("model");
const resendKey = arg("resend");
const resendFrom = arg("from");
const email = arg("email");
const wantJson = flag("json");

async function main() {
  const result = await runOnce("manual", {
    criteria,
    extraUrls,
    preferences,
    openrouterKey,
    llmModel,
    resendKey,
    resendFrom,
    emailOverride: email,
    skipEmail: !email,
  });

  if (wantJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log("");
  console.log(`Criteria: ${criteria.postalCodes.join(",")} · max €${criteria.maxPrice} · ${criteria.propertyType}${criteria.minBedrooms > 0 ? ` · ${criteria.minBedrooms}+ bed` : ""}`);
  if (extraUrls.length > 0) console.log(`Custom URLs: ${extraUrls.join(" ")}`);
  if (preferences) console.log(`Preferences: ${preferences}`);
  console.log(`LLM scoring: ${result.llmUsed ? "yes" : "no" + (openrouterKey ? " (scoring failed)" : " (no OpenRouter key — get one at https://openrouter.ai/keys)")}`);
  console.log("");
  console.log(`Per source:`);
  for (const [name, info] of Object.entries(result.perSource)) {
    const errPart = info.error ? `  ERROR: ${info.error}` : "";
    console.log(`  ${name.padEnd(28)} ${String(info.count).padStart(3)} found${errPart}`);
  }
  console.log("");
  console.log(`${result.listings.length} recent listings (of ${result.totalFound} matching overall):`);
  console.log("");
  for (const l of result.listings) {
    const scorePart = typeof l.score === "number" ? `[${l.score}] ` : "";
    const meta = [
      l.price ? `€${l.price}` : "€?",
      l.bedrooms !== null ? `${l.bedrooms}bd` : null,
      l.propertyType,
      l.location,
      l.source,
      l.postedAt ? new Date(l.postedAt).toLocaleDateString() : null,
    ].filter(Boolean).join(" · ");
    console.log(`  ${scorePart}${l.title}`);
    console.log(`    ${meta}`);
    if (l.summary) console.log(`    > ${l.summary}`);
    console.log(`    ${l.url}`);
    console.log("");
  }
  if (email) {
    console.log(result.emailSent ? `✓ Email sent to ${result.recipient}` : `✗ Email skipped: ${result.emailReason}`);
  } else {
    console.log(`(pass --email <addr> to also send the digest)`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
