import { NextRequest, NextResponse } from "next/server";
import { parseRunInputsFromQuery } from "@/lib/config";
import { runOnce } from "@/lib/runner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(req: NextRequest) {
  const url = new URL(req.url);
  let body: Record<string, string> = {};
  if (req.method === "POST") {
    try { body = (await req.json()) as Record<string, string>; } catch { /* fine */ }
  }
  const params = new URLSearchParams(url.search);
  for (const [k, v] of Object.entries(body)) {
    if (typeof v === "string" && !params.has(k)) params.set(k, v);
  }

  const email = params.get("email") || undefined;
  const skipEmail = params.get("skipEmail") === "1";
  const inputs = parseRunInputsFromQuery(params);

  const result = await runOnce("manual", {
    criteria: inputs.criteria,
    extraUrls: inputs.extraUrls,
    preferences: inputs.preferences,
    openrouterKey: inputs.openrouterKey,
    llmModel: inputs.llmModel,
    resendKey: inputs.resendKey,
    resendFrom: inputs.resendFrom,
    emailOverride: email,
    skipEmail,
  });
  // Never echo any API key back.
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) { return handle(req); }
export async function GET(req: NextRequest) { return handle(req); }
