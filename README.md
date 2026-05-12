# Belgium Rental Watcher

A side-quest tool for apartment-hunting in Belgium. Scrapes the major immo sites, lets an LLM rank each listing against a free-text description of what you actually want, and emails you a digest. **No accounts, no state stored, bring your own keys.**

Live demo: <https://belgium-rental-watcher.vercel.app>

## Why

The "alert" emails Belgian immo sites send are useless — they ping you on everything in the price range, not on whether the place actually fits you. So you scan 30 listings to maybe like one. This is the thing that stops that.

You give it postcodes + max rent + a plain-English description ("near the canal, no ground floor, room for a desk"). It scrapes the main sites, ranks each listing 0–100 against your description with an LLM, and (optionally) emails you a daily digest.

## What it scrapes

| Source | Method | Notes |
|---|---|---|
| **2dehands.be** | JSON API | Filtered by real posting date (last 24h) |
| **Realo.be** | HTML parse | Top 20 newest by listing ID (no date in HTML) |
| **Immoweb.be** | HTML parse | DataDome-blocked from Vercel; works locally |
| **Custom URLs** | LLM extraction | Paste any rental search page; Claude/GPT/etc. reads the HTML |

Sites we can't reach without a headless browser (Zimmo, Logic-immo, Immovlan) are skipped — they're Cloudflare-protected.

## How to use the hosted version

1. Open <https://belgium-rental-watcher.vercel.app>.
2. Set postcodes + max rent + property type. Hit **Run search** — that's it for the basics.
3. Want AI ranking? Open **Power features**, paste an [OpenRouter key](https://openrouter.ai/keys), and write what matters to you in free text. Pick a model (default: `anthropic/claude-haiku-latest`, ~$0.001/listing).
4. Want it in your inbox? Open **Get it by email**, paste a [Resend key](https://resend.com), and the matching email.

Nothing is stored. Keys are sent server-side once per request, never persisted, never logged.

## Self-hosting

It's a Next.js 16 app, deployable to Vercel in two clicks.

```bash
git clone https://github.com/simon324/belgium-rental-watcher
cd belgium-rental-watcher
npm install
cp .env.example .env.local   # then fill in keys you want
npm run dev                  # http://localhost:3000
```

Or run a one-off check from the CLI:

```bash
npm run check -- --postcodes 8000,8200 --max 1200 --type apartment \
  --prefs "near canal, quiet, no ground floor" \
  --openrouter sk-or-v1-... \
  --email you@example.com --resend re_...
```

### Deploy to Vercel

```bash
vercel deploy --prod
```

Then in **Settings → Environment Variables**, optionally set:

| Var | Used for |
|---|---|
| `WATCH_POSTAL_CODES` | comma-separated, e.g. `8000,8200,8310` |
| `WATCH_MAX_PRICE` | EUR/mo, e.g. `1000` |
| `WATCH_PROPERTY_TYPE` | `house`, `apartment`, or `both` |
| `WATCH_MIN_BEDROOMS` | integer |
| `WATCH_URLS` | comma-separated rental URLs for LLM extraction |
| `WATCH_PREFERENCES` | free-text match preferences |
| `WATCH_LLM_MODEL` | OpenRouter model id (default: `anthropic/claude-haiku-latest`) |
| `OPENROUTER_API_KEY` | enables LLM features for the cron |
| `RESEND_API_KEY` | enables email for the cron |
| `NOTIFY_EMAIL` | daily-cron recipient |
| `RESEND_FROM` | sender, default `onboarding@resend.dev` |
| `CRON_SECRET` | random string; protects `/api/cron` |

The cron in [`vercel.json`](./vercel.json) hits `/api/cron` every morning at 08:00 UTC.

## Architecture

```
app/
  api/cron/    GET   daily cron entrypoint
  api/check/   POST  on-demand run
  api/status/  GET   config + presets
  page.tsx     single-page UI with criteria form + results
lib/
  scrapers/    one file per site (immoweb, realo, tweedehands)
  llm.ts       OpenRouter wrapper (extract listings + score matches)
  runner.ts    scrape → filter → rank → email
  email.ts     Resend digest
  config.ts    criteria + env loading + per-request overrides
vercel.json    cron schedule
```

## Known rough edges

- **Immoweb 403s from Vercel** (DataDome blocks data-center IPs). Works fine locally. Fix would need a residential proxy.
- **No dedup across days** — popular listings will appear in multiple daily digests.
- **Resend free-tier** only delivers to the email that registered the account, until you [verify a sender domain](https://resend.com/domains).
- **2dehands inventory is thin** — Bruges typically has few rentals at ≤€1000 on 2dehands; most matches come from Realo.

## License

MIT. Build whatever you want with it.
