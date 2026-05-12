import { Resend } from "resend";
import { notify, type Criteria } from "./config";
import type { ScoredListing } from "./runner";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function scorePill(score: number): string {
  const bg = score >= 80 ? "#dcfce7" : score >= 50 ? "#fef9c3" : "#f3f4f6";
  const fg = score >= 80 ? "#166534" : score >= 50 ? "#854d0e" : "#52525b";
  return `<span style="display:inline-block;padding:1px 8px;border-radius:999px;background:${bg};color:${fg};font-size:11px;font-weight:600;vertical-align:middle">${score}</span>`;
}

function listingRow(l: ScoredListing): string {
  const price = l.price !== null ? `€${l.price}/mo` : "price unknown";
  const beds = l.bedrooms !== null ? `${l.bedrooms} bed` : "";
  const type = l.propertyType ?? "";
  const meta = [price, beds, type, l.location, l.source]
    .filter(Boolean)
    .map(escapeHtml)
    .join(" · ");
  const summaryLine = l.summary
    ? `<div style="color:#444;font-size:13px;margin-top:6px;line-height:1.4">${escapeHtml(l.summary)}</div>`
    : "";
  const reasonLine = l.reason
    ? `<div style="color:#888;font-size:12px;margin-top:4px;font-style:italic">${escapeHtml(l.reason)}</div>`
    : "";
  const scoreBit = typeof l.score === "number" ? ` ${scorePill(l.score)}` : "";
  return `
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid #eee;">
        <div><a href="${escapeHtml(l.url)}" style="color:#0a66c2;font-weight:600;font-size:15px;text-decoration:none">${escapeHtml(l.title)}</a>${scoreBit}</div>
        <div style="color:#555;font-size:13px;margin-top:4px">${meta}</div>
        ${summaryLine}
        ${reasonLine}
      </td>
    </tr>`;
}

export interface EmailDigestOptions {
  listings: ScoredListing[];
  criteria: Criteria;
  preferences?: string;
  triggeredBy: "cron" | "manual";
  recipientOverride?: string;
  resendKey?: string;
  resendFrom?: string;
}

export interface EmailResult {
  sent: boolean;
  reason?: string;
  recipient: string | null;
}

export async function sendDigest({
  listings,
  criteria,
  preferences,
  triggeredBy,
  recipientOverride,
  resendKey,
  resendFrom,
}: EmailDigestOptions): Promise<EmailResult> {
  const recipient = (recipientOverride || notify.email || "").trim();
  const effectiveKey = (resendKey ?? notify.resendKey).trim();
  const effectiveFrom = (resendFrom ?? notify.from).trim();

  if (listings.length === 0) {
    return { sent: false, reason: "no recent listings", recipient: recipient || null };
  }
  if (!recipient) {
    return { sent: false, reason: "no email address (set NOTIFY_EMAIL or pass ?email=)", recipient: null };
  }
  if (!effectiveKey) {
    return { sent: false, reason: "no Resend key (set RESEND_API_KEY or pass resendKey)", recipient };
  }

  const resend = new Resend(effectiveKey);
  const subject =
    listings.length === 1
      ? `New rental: ${listings[0].title}`
      : `${listings.length} new rentals in ${criteria.postalCodes.join("/")}`;

  const criteriaLine = `${criteria.postalCodes.join(", ")} · max €${criteria.maxPrice}/mo · ${criteria.propertyType}${criteria.minBedrooms > 0 ? ` · ${criteria.minBedrooms}+ bed` : ""}`;
  const prefLine = preferences && preferences.trim()
    ? `<p style="color:#666;font-size:13px;margin:0 0 16px 0"><strong>Looking for:</strong> ${escapeHtml(preferences)}</p>`
    : "";

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
      <h1 style="font-size:20px;margin:0 0 8px 0">${listings.length} rental${listings.length === 1 ? "" : "s"} for you</h1>
      <p style="color:#666;font-size:13px;margin:0 0 8px 0">${escapeHtml(criteriaLine)} · ${triggeredBy === "cron" ? "Daily digest" : "On-demand"}</p>
      ${prefLine}
      <table style="width:100%;border-collapse:collapse">${listings.map(listingRow).join("")}</table>
      <p style="color:#999;font-size:12px;margin-top:24px">Belgium Rental Watcher</p>
    </div>
  `;

  const { error } = await resend.emails.send({
    from: effectiveFrom,
    to: recipient,
    subject,
    html,
  });
  if (error) {
    return { sent: false, reason: `resend: ${error.message}`, recipient };
  }
  return { sent: true, recipient };
}
