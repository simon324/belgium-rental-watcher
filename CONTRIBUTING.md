# Contributing

Thanks for considering a contribution. This is a side-quest tool, so the bar is "does it make life easier for someone apartment-hunting in Belgium?" — not enterprise-grade engineering.

## Quick orientation

Read [the README](./README.md) first, particularly the **Architecture** and **Ideas & wanted contributions** sections. Those ideas are the most likely path to a merged PR.

## Local setup

```bash
git clone https://github.com/simon324/belgium-rental-watcher
cd belgium-rental-watcher
npm install
cp .env.example .env.local   # optional — most things work without keys
npm run dev                  # http://localhost:3000
```

Run a one-off scrape from the CLI to test changes without the UI:

```bash
npm run check -- --postcodes 8000 --max 1500 --type apartment
```

Type-check before pushing:

```bash
npx tsc --noEmit
```

## Where to add a new scraper

1. Create `lib/scrapers/<name>.ts`. Implement the `Scraper` interface from `types.ts`.
2. Register it in `lib/scrapers/index.ts` in the `SCRAPERS` array.
3. Use the `browserHeaders` from `types.ts` for any site that does basic fingerprinting.
4. Return `Listing[]` with `postedAt` populated if you can extract a date — otherwise leave it `null` and the runner will fall back to "top N by rank".

The simplest existing example is `lib/scrapers/tweedehands.ts` (JSON API). The most representative HTML one is `lib/scrapers/realo.ts`.

## What I'm likely to merge

- Bug fixes — always
- New scrapers for actual Belgian rental sites — likely yes, especially if they're fetch-only (no headless browser dep)
- The ideas listed in the README — likely yes
- Performance / readability — likely yes
- New features that don't require an env var or a key to use — likely yes

## What I'll probably push back on

- Heavy dependencies for marginal features (e.g. adding a database for state when a JSON file would do)
- Tightly coupling to one LLM provider (we use OpenRouter precisely to avoid that)
- Tracking, analytics, telemetry of any kind
- UI rewrites in a framework — current UI is intentionally vanilla React + inline styles, low magic

## PR checklist

- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` passes
- [ ] The README still describes what the code does (update it if your PR changes user-visible behaviour)
- [ ] No keys, emails, or other secrets in the diff (`git diff main` and look)

## License

By contributing you agree your changes will be released under the [MIT license](./LICENSE).
