import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isRealApiKey, VOICE_CATALOG } from "@/lib/ai-generator";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const elevenlabsConfigured = isRealApiKey(process.env.ELEVENLABS_API_KEY);

  return NextResponse.json({
    elevenlabsConfigured,
    voices: VOICE_CATALOG,
  });
}
