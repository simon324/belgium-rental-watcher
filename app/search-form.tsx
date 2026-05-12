"use client";

import { useState, type FormEvent } from "react";
import type { Criteria, PropertyType } from "@/lib/config";

interface ModelPreset { id: string; label: string }

interface Listing {
  id: string;
  title: string;
  price: number | null;
  url: string;
  source: string;
  location: string;
  bedrooms: number | null;
  propertyType: string | null;
  postedAt: string | null;
  score?: number;
  reason?: string;
  summary?: string;
}

interface RunOutcome {
  listings: Listing[];
  totalFound: number;
  perSource: Record<string, { count: number; error: string | null }>;
  emailSent: boolean;
  emailReason?: string;
  recipient: string | null;
  criteria: Criteria;
  extraUrls: string[];
  preferences: string;
  llmUsed: boolean;
}

const inputStyle: React.CSSProperties = {
  padding: "9px 12px",
  borderRadius: 8,
  border: "1px solid #d4d4d8",
  fontSize: 14,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "#666",
  marginBottom: 6,
  fontWeight: 500,
};

export function SearchForm({
  defaults,
  defaultEmail,
  defaultUrls,
  defaultPreferences,
  defaultLlmModel,
  modelPresets,
  resendConfigured,
  openrouterConfigured,
}: {
  defaults: Criteria;
  defaultEmail: string;
  defaultUrls: string[];
  defaultPreferences: string;
  defaultLlmModel: string;
  modelPresets: ModelPreset[];
  resendConfigured: boolean;
  openrouterConfigured: boolean;
}) {
  const [postalCodes, setPostalCodes] = useState(defaults.postalCodes.join(", "));
  const [maxPrice, setMaxPrice] = useState(String(defaults.maxPrice));
  const [propertyType, setPropertyType] = useState<PropertyType>(defaults.propertyType);
  const [minBedrooms, setMinBedrooms] = useState(String(defaults.minBedrooms));
  const [urls, setUrls] = useState(defaultUrls.join("\n"));
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [openrouterKey, setOpenrouterKey] = useState("");
  const [llmModel, setLlmModel] = useState(defaultLlmModel);
  const [email, setEmail] = useState(defaultEmail || "");
  const [sendEmail, setSendEmail] = useState(false);
  const [resendKey, setResendKey] = useState("");
  const [resendFrom, setResendFrom] = useState("");

  const [showAdvanced, setShowAdvanced] = useState(
    defaultUrls.length > 0 || Boolean(defaultPreferences),
  );

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RunOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const body: Record<string, string> = {
        postalCodes: postalCodes.split(",").map((s) => s.trim()).filter(Boolean).join(","),
        maxPrice,
        propertyType,
        minBedrooms,
        urls,
        preferences,
      };
      if (openrouterKey.trim()) body.openrouterKey = openrouterKey.trim();
      if (llmModel.trim() && llmModel !== defaultLlmModel) body.model = llmModel.trim();
      if (resendKey.trim()) body.resendKey = resendKey.trim();
      if (resendFrom.trim()) body.resendFrom = resendFrom.trim();
      if (sendEmail && email) body.email = email;
      if (!sendEmail) body.skipEmail = "1";

      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as RunOutcome;
      setResult(json);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section style={cardStyle}>
        <h2 style={h2Style}>1 · Where & what</h2>
        <p style={sectionHintStyle}>The basics. With just these set, hit <strong>Run search</strong> and you&apos;ll see matching listings below — no account or API key needed.</p>
        <form onSubmit={onSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "span 2" }}>
              <label style={labelStyle}>Postcodes</label>
              <input
                style={inputStyle}
                value={postalCodes}
                onChange={(e) => setPostalCodes(e.target.value)}
                placeholder="8000, 8200, 8310"
                required
              />
              <div style={hintStyle}>Belgian postal codes, comma-separated. Bruges city = 8000. Look yours up on <a href="https://www.bpost.be/en/postcodes" target="_blank" rel="noreferrer">bpost.be</a>.</div>
            </div>
            <div>
              <label style={labelStyle}>Max rent (€/mo)</label>
              <input style={inputStyle} type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} min={0} required />
              <div style={hintStyle}>Anything above this is excluded.</div>
            </div>
            <div>
              <label style={labelStyle}>Min bedrooms</label>
              <input style={inputStyle} type="number" value={minBedrooms} onChange={(e) => setMinBedrooms(e.target.value)} min={0} required />
              <div style={hintStyle}>Studios count as 0. Set 0 if flexible.</div>
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <label style={labelStyle}>Property type</label>
              <div style={{ display: "flex", gap: 8 }}>
                {(["both", "house", "apartment"] as PropertyType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setPropertyType(t)}
                    style={{
                      flex: 1,
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: propertyType === t ? "1px solid #18181b" : "1px solid #d4d4d8",
                      background: propertyType === t ? "#18181b" : "white",
                      color: propertyType === t ? "white" : "#444",
                      fontSize: 14,
                      cursor: "pointer",
                      textTransform: "capitalize",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div style={hintStyle}>&quot;Apartment&quot; includes studios. &quot;House&quot; includes townhouses.</div>
            </div>
          </div>

          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #eee" }}>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              style={{
                background: "transparent",
                border: 0,
                color: "#0a66c2",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                padding: 0,
                marginBottom: showAdvanced ? 12 : 0,
              }}
            >
              {showAdvanced ? "▾" : "▸"} 2 · Power features: AI matching + custom sites
            </button>

            {showAdvanced && (
              <>
                <p style={sectionHintStyle}>
                  Bring your own <strong>OpenRouter key</strong> to unlock two things:{" "}
                  <strong>every listing gets scored</strong> against what you describe in plain English, and{" "}
                  <strong>you can paste any rental URL</strong>{" "}and an LLM will extract the listings from it. Skip this whole section if you don&apos;t care.
                </p>
                <p style={{ ...sectionHintStyle, background: "#f0f9ff", color: "#075985", padding: "10px 12px", borderRadius: 8, marginBottom: 14 }}>
                  💡 <strong>One key, any model.</strong> OpenRouter routes to Claude, GPT, Gemini, Llama, etc.{" "}
                  <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>Get one in ~30 seconds →</a>
                </p>
                <div style={{ display: "grid", gap: 16 }}>
                  <div>
                    <label style={labelStyle}>What matters to you (free text)</label>
                    <textarea
                      style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
                      value={preferences}
                      onChange={(e) => setPreferences(e.target.value)}
                      placeholder="e.g. near the canal, quiet street, no ground floor, modern bathroom, room for a desk, bike storage, pet-friendly"
                    />
                    <div style={hintStyle}>An LLM scores each listing 0-100 on how well it fits these. Listings sort by score, top matches first. Each gets a 1-line pitch.</div>
                  </div>

                  <div>
                    <label style={labelStyle}>Extra rental pages to scrape (optional, one per line)</label>
                    <textarea
                      style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
                      value={urls}
                      onChange={(e) => setUrls(e.target.value)}
                      placeholder={"https://www.immovlan.be/en/real-estate/...\nhttps://www.kapaza.be/te-huur/..."}
                    />
                    <div style={hintStyle}>Useful for sites we don&apos;t scrape natively. Cloudflare-protected sites (Zimmo, Logic-immo) won&apos;t work.</div>
                  </div>

                  <div>
                    <label style={labelStyle}>
                      OpenRouter API key
                      {openrouterConfigured ? <span style={{ color: "#166534", marginLeft: 6, fontWeight: 400 }}>· server already has one</span> : null}
                    </label>
                    <input
                      style={inputStyle}
                      type="password"
                      value={openrouterKey}
                      onChange={(e) => setOpenrouterKey(e.target.value)}
                      placeholder={openrouterConfigured ? "•••••• leave blank to use the server's key" : "sk-or-v1-..."}
                      autoComplete="off"
                    />
                    <div style={hintStyle}>
                      Required for both features above. <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer"><strong>Sign up &amp; create a key →</strong></a>{" "}
                      Pay-as-you-go (no subscription); roughly $0.001 per listing scored with the default model. Used once per request — never stored, never logged.
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Model</label>
                    <select
                      style={inputStyle}
                      value={modelPresets.some((p) => p.id === llmModel) ? llmModel : "__custom"}
                      onChange={(e) => {
                        if (e.target.value === "__custom") setLlmModel("");
                        else setLlmModel(e.target.value);
                      }}
                    >
                      {modelPresets.map((p) => (
                        <option key={p.id} value={p.id}>{p.label} — {p.id}</option>
                      ))}
                      <option value="__custom">Other (paste any OpenRouter model ID)</option>
                    </select>
                    {!modelPresets.some((p) => p.id === llmModel) && (
                      <input
                        style={{ ...inputStyle, marginTop: 8 }}
                        value={llmModel}
                        onChange={(e) => setLlmModel(e.target.value)}
                        placeholder="e.g. qwen/qwen3.5-flash-20260224"
                      />
                    )}
                    <div style={hintStyle}>
                      OpenRouter routes your request to whichever model you pick.
                      Browse all options at <a href="https://openrouter.ai/models" target="_blank" rel="noreferrer">openrouter.ai/models</a>.
                      Default ({defaultLlmModel}) is a sensible cheap pick.
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #eee" }}>
            <h2 style={{ ...h2Style, marginBottom: 6 }}>3 · Get it by email (optional)</h2>
            <p style={sectionHintStyle}>Otherwise results just stay on this page. Tick the box to also send a digest to your inbox.</p>
            <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, fontSize: 14, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                style={{ width: 16, height: 16, cursor: "pointer" }}
              />
              <span>Email me the digest after this run</span>
            </label>
            {sendEmail && (
              <div style={{ display: "grid", gap: 16 }}>
                <div>
                  <label style={labelStyle}>Send to</label>
                  <input
                    style={inputStyle}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required={sendEmail}
                  />
                  <div style={hintStyle}>The recipient. ⚠ Resend&apos;s free tier only delivers to the email that registered the Resend account — until you verify a sender domain.</div>
                </div>
                <div>
                  <label style={labelStyle}>
                    Resend API key
                    {resendConfigured ? <span style={{ color: "#166534", marginLeft: 6, fontWeight: 400 }}>· server already has one</span> : null}
                  </label>
                  <input
                    style={inputStyle}
                    type="password"
                    value={resendKey}
                    onChange={(e) => setResendKey(e.target.value)}
                    placeholder={resendConfigured ? "•••••• leave blank to use the server&apos;s key" : "re_..."}
                    autoComplete="off"
                  />
                  <div style={hintStyle}>Powers email delivery. 100 emails/day free at <a href="https://resend.com" target="_blank" rel="noreferrer">resend.com</a>. Used once — never stored, never logged.</div>
                </div>
                <div>
                  <label style={labelStyle}>From address <span style={{ color: "#999", fontWeight: 400 }}>(optional)</span></label>
                  <input
                    style={inputStyle}
                    value={resendFrom}
                    onChange={(e) => setResendFrom(e.target.value)}
                    placeholder="Belgium Rental Watcher <onboarding@resend.dev>"
                    autoComplete="off"
                  />
                  <div style={hintStyle}>Defaults to <code>onboarding@resend.dev</code> (a sender Resend gives every account). To send from your own domain, <a href="https://resend.com/domains" target="_blank" rel="noreferrer">verify it</a> at Resend first.</div>
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 16,
              background: "#18181b",
              color: "white",
              border: 0,
              borderRadius: 8,
              padding: "10px 18px",
              fontSize: 14,
              fontWeight: 500,
              cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Scraping…" : sendEmail ? "Run + email digest" : "Run search"}
          </button>
        </form>

        {error && (
          <div style={{ marginTop: 12, padding: 10, background: "#fee2e2", color: "#991b1b", borderRadius: 8, fontSize: 13 }}>
            {error}
          </div>
        )}
      </section>

      {result && <ResultsSection result={result} />}
    </>
  );
}

function scorePill(score: number) {
  const bg = score >= 80 ? "#dcfce7" : score >= 50 ? "#fef9c3" : "#f3f4f6";
  const fg = score >= 80 ? "#166534" : score >= 50 ? "#854d0e" : "#52525b";
  return (
    <span style={{
      display: "inline-block", padding: "1px 8px", borderRadius: 999,
      background: bg, color: fg, fontSize: 11, fontWeight: 600, marginLeft: 8, verticalAlign: "middle",
    }}>
      {score}
    </span>
  );
}

function ResultsSection({ result }: { result: RunOutcome }) {
  return (
    <section style={cardStyle}>
      <h2 style={h2Style}>Results {result.llmUsed && <span style={{ fontSize: 12, color: "#888", fontWeight: 400 }}>· LLM-scored</span>}</h2>
      <div style={{ fontSize: 14, color: "#444", marginBottom: 12 }}>
        Found <strong>{result.listings.length}</strong> recent listings out of <strong>{result.totalFound}</strong> matching criteria.{" "}
        {result.emailSent
          ? <span style={{ color: "#166534" }}>Email sent to {result.recipient}.</span>
          : result.emailReason
          ? <span style={{ color: "#92400e" }}>Email skipped: {result.emailReason}.</span>
          : null}
      </div>

      <details style={{ marginBottom: 12, fontSize: 13, color: "#555" }}>
        <summary style={{ cursor: "pointer" }}>Source breakdown</summary>
        <ul style={{ paddingLeft: 18, marginTop: 8 }}>
          {Object.entries(result.perSource).map(([name, info]) => (
            <li key={name}>
              <strong>{name}</strong>: {info.count} found{info.error ? <span style={{ color: "#b91c1c" }}> — {info.error}</span> : null}
            </li>
          ))}
        </ul>
      </details>

      {result.listings.length === 0 && (
        <div style={{ padding: 16, background: "#f5f5f4", borderRadius: 8, color: "#555", fontSize: 14 }}>
          No recent listings matched. Try widening the postal codes or raising the max price.
        </div>
      )}

      {result.listings.map((l) => (
        <div key={l.id} style={{ padding: "14px 0", borderTop: "1px solid #eee" }}>
          <div>
            <a href={l.url} target="_blank" rel="noreferrer" style={{ fontWeight: 600, fontSize: 15 }}>
              {l.title}
            </a>
            {typeof l.score === "number" && scorePill(l.score)}
          </div>
          <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
            {[
              l.price ? `€${l.price}/mo` : "price unknown",
              l.bedrooms !== null ? `${l.bedrooms} bed` : null,
              l.propertyType,
              l.location,
              l.source,
              l.postedAt ? new Date(l.postedAt).toLocaleDateString() : null,
            ].filter(Boolean).join(" · ")}
          </div>
          {l.summary && (
            <div style={{ fontSize: 13, color: "#444", marginTop: 6, lineHeight: 1.45 }}>{l.summary}</div>
          )}
          {l.reason && (
            <div style={{ fontSize: 12, color: "#888", marginTop: 4, fontStyle: "italic" }}>{l.reason}</div>
          )}
        </div>
      ))}
    </section>
  );
}

const cardStyle: React.CSSProperties = {
  background: "white",
  borderRadius: 12,
  padding: 20,
  marginBottom: 0,
  boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.04)",
};
const h2Style: React.CSSProperties = { fontSize: 16, margin: "0 0 4px 0" };
const sectionHintStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#666",
  margin: "0 0 14px 0",
  lineHeight: 1.5,
};
const hintStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#888",
  marginTop: 5,
  lineHeight: 1.4,
};
