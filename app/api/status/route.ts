import { NextResponse } from "next/server";
import {
  defaultCriteria,
  defaultExtraUrls,
  defaultLlmModel,
  defaultOpenRouterKey,
  defaultPreferences,
  MODEL_PRESETS,
  notify,
} from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    defaultCriteria,
    defaultExtraUrls,
    defaultPreferences,
    defaultLlmModel,
    modelPresets: MODEL_PRESETS,
    notify: {
      defaultEmail: notify.email || null,
      resendConfigured: Boolean(notify.resendKey),
    },
    openrouterConfigured: Boolean(defaultOpenRouterKey),
  });
}
