import { defaultOpenRouterKey, defaultCriteria, defaultExtraUrls, defaultLlmModel, defaultPreferences, MODEL_PRESETS, notify } from "@/lib/config";
import { SearchForm } from "./search-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px" }}>
      <h1 style={{ fontSize: 30, margin: "0 0 8px 0", letterSpacing: "-0.02em" }}>
        Belgium Rental Watcher
      </h1>
      <p style={{ color: "#555", margin: "0 0 16px 0", fontSize: 16, lineHeight: 1.5 }}>
        Search rentals across <strong>2dehands</strong>, <strong>Realo</strong>, and any other listing page you paste in. Optionally let an LLM (your choice of Claude / GPT / Gemini / …) rank each one by how well it matches what you actually care about, and get the digest by email.
      </p>

      <ul style={{
        margin: "0 0 24px 0",
        padding: "16px 20px",
        background: "#f5f5f4",
        borderRadius: 10,
        fontSize: 14,
        color: "#333",
        listStyle: "none",
        lineHeight: 1.7,
      }}>
        <li><strong>Default:</strong> set postcode + price → results appear below. No keys needed.</li>
        <li><strong>+ <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">OpenRouter key</a>:</strong> describe your dream rental in plain words → every listing gets scored 0–100. One key, your choice of Claude / GPT / Gemini / Llama.</li>
        <li><strong>+ <a href="https://resend.com" target="_blank" rel="noreferrer">Resend key</a>:</strong> get the digest in your inbox. There&apos;s also a daily cron at 08:00 UTC.</li>
      </ul>

      <SearchForm
        defaults={defaultCriteria}
        defaultEmail={notify.email}
        defaultUrls={defaultExtraUrls}
        defaultPreferences={defaultPreferences}
        defaultLlmModel={defaultLlmModel}
        modelPresets={MODEL_PRESETS}
        resendConfigured={Boolean(notify.resendKey)}
        openrouterConfigured={Boolean(defaultOpenRouterKey)}
      />

      <section style={{
        background: "white",
        borderRadius: 12,
        padding: 20,
        marginTop: 16,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.04)",
      }}>
        <h2 style={{ fontSize: 16, margin: "0 0 12px 0" }}>Known limits</h2>
        <ul style={{ margin: 0, paddingLeft: 18, color: "#555", fontSize: 13, lineHeight: 1.7 }}>
          <li><strong>Immoweb</strong> blocks Vercel&apos;s data-center IPs (DataDome). Works locally via the <code>rental-watcher</code> Claude Code skill.</li>
          <li><strong>Custom URLs</strong> with heavy Cloudflare protection (Zimmo, Logic-immo, Immovlan) can&apos;t be scraped from a serverless function.</li>
          <li><strong>Resend free tier</strong> only delivers to the email that registered the Resend account, until you verify a sender domain at resend.com/domains.</li>
          <li><strong>No state is stored</strong> between runs — listings can repeat day-over-day.</li>
        </ul>
      </section>
    </main>
  );
}
