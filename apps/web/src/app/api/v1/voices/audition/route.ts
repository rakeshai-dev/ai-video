import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { VOICE_CATALOG } from "@/lib/ai-generator";

// Map each persona to a real pre-synthesized 48kbps neural MP3 sample in packages/video-engine/public/audio
const SAMPLE_MP3_MAP: Record<string, string> = {
  "en-US-ChristopherNeural": "solar_01.mp3",
  "en-US-AnaNeural": "sc_03.mp3",
  "en-US-AriaNeural": "sc_01.mp3",
  "en-IN-NeerjaNeural": "sc_02.mp3",
  JBFqnCBsd6RMkjVDRZzb: "solar_02.mp3",
  EXAVITQu4vr4xnSDxMaL: "sc_04.mp3",
  XrExE9yKIg1WjnnlVkGX: "sc_03.mp3",
  onwK4e9ZLuTAKqWW03F9: "sc_05.mp3",
};

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const voiceId = searchParams.get("voiceId") || "en-US-ChristopherNeural";

  const known = VOICE_CATALOG.find((v) => v.voiceId === voiceId);
  const sampleFile =
    SAMPLE_MP3_MAP[voiceId] ||
    (known ? SAMPLE_MP3_MAP[known.fallbackEdgeVoiceId] : "sc_01.mp3") ||
    "sc_01.mp3";

  const repoRoot = path.resolve(process.cwd(), "..", "..");
  const audioPath = path.join(repoRoot, "packages", "video-engine", "public", "audio", sampleFile);

  if (!fs.existsSync(audioPath)) {
    return NextResponse.json({ error: "Voice audition sample not found." }, { status: 404 });
  }

  const bytes = fs.readFileSync(audioPath);
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
