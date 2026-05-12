import { NextRequest, NextResponse } from "next/server";
import { cronSecret } from "@/lib/config";
import { runOnce } from "@/lib/runner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  // Daily cron uses defaults (env vars) for criteria, URLs, preferences, LLM key.
  const result = await runOnce("cron");
  return NextResponse.json(result);
}
