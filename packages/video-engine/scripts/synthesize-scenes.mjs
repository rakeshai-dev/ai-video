import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENGINE_ROOT = path.resolve(__dirname, "..");
const PUBLIC_AUDIO_DIR = path.join(ENGINE_ROOT, "public", "audio");

fs.mkdirSync(PUBLIC_AUDIO_DIR, { recursive: true });

const FALLBACK_SAMPLE_BY_VOICE = {
  "en-US-ChristopherNeural": "solar_01.mp3",
  "en-US-AnaNeural": "sc_03.mp3",
  "en-US-AriaNeural": "sc_01.mp3",
  "en-IN-NeerjaNeural": "sc_02.mp3",
};

function generateWordTimestamps(text, durationMs) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const activeDuration = Math.max(900, durationMs - 320);
  const totalChars = words.reduce((acc, w) => acc + w.length + 1, 0);
  let cursor = 110;
  return words.map((word) => {
    const share = (word.length + 1) / totalChars;
    const wordDur = Math.max(160, Math.round(share * activeDuration));
    const item = { word, start_ms: cursor, end_ms: cursor + wordDur };
    cursor += wordDur;
    return item;
  });
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

async function synthesizeOneScene({ renderId, index, scene, edgeVoiceId, voiceSpeed }) {
  const mp3FileName = `rnd_${renderId}_${String(index + 1).padStart(2, "0")}.mp3`;
  const mp3FullPath = path.join(PUBLIC_AUDIO_DIR, mp3FileName);
  if (fs.existsSync(mp3FullPath)) {
    fs.unlinkSync(mp3FullPath);
  }

  try {
    const { MsEdgeTTS, OUTPUT_FORMAT } = await import("msedge-tts");
    const tts = new MsEdgeTTS();
    await withTimeout(
      tts.setMetadata(edgeVoiceId, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3),
      6000,
      "MsEdgeTTS.setMetadata"
    );

    const tempSubdir = path.join(PUBLIC_AUDIO_DIR, `tmp_${renderId}_${index}`);
    fs.mkdirSync(tempSubdir, { recursive: true });
    try {
      const ratePct = Math.round(((Number(voiceSpeed) || 1) - 1) * 100);
      const rateStr = ratePct >= 0 ? `+${ratePct}%` : `${ratePct}%`;
      const { audioFilePath } = await withTimeout(
        tts.toFile(tempSubdir, scene.narration_text, { rate: rateStr }),
        10000,
        "MsEdgeTTS.toFile"
      );
      if (audioFilePath && fs.existsSync(audioFilePath)) {
        fs.copyFileSync(audioFilePath, mp3FullPath);
      }
    } finally {
      try {
        tts.close?.();
      } catch {
        // ignore close error
      }
      fs.rmSync(tempSubdir, { recursive: true, force: true });
    }

    if (fs.existsSync(mp3FullPath)) {
      const stat = fs.statSync(mp3FullPath);
      if (stat.size > 500) {
        const audioMs = Math.max(2800, Math.round((stat.size / 6000) * 1000));
        const finalDurationMs = audioMs + 400;
        return {
          ...scene,
          voiceover_url: `audio/${mp3FileName}`,
          duration_ms: finalDurationMs,
          word_timestamps: generateWordTimestamps(scene.narration_text, audioMs),
          used_fallback_audio: false,
        };
      }
    }
  } catch (err) {
    console.warn(`[TTS Fallback] Scene ${index + 1}: ${err?.message || err}`);
  }

  // Offline / rate-limit resilient fallback using local pre-synthesized neural sample
  const fallbackFile =
    FALLBACK_SAMPLE_BY_VOICE[edgeVoiceId] || "solar_01.mp3";
  const fallbackSrc = path.join(PUBLIC_AUDIO_DIR, fallbackFile);
  const keepDurationMs = Math.max(3000, Number(scene.duration_ms) || 5000);

  if (fs.existsSync(fallbackSrc)) {
    fs.copyFileSync(fallbackSrc, mp3FullPath);
    return {
      ...scene,
      voiceover_url: `audio/${mp3FileName}`,
      duration_ms: keepDurationMs,
      word_timestamps: generateWordTimestamps(scene.narration_text, keepDurationMs),
      used_fallback_audio: true,
    };
  }

  return {
    ...scene,
    voiceover_url: undefined,
    duration_ms: keepDurationMs,
    word_timestamps: generateWordTimestamps(scene.narration_text, keepDurationMs),
    used_fallback_audio: true,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const inArg = args.find((a) => a.startsWith("--input="));
  const outArg = args.find((a) => a.startsWith("--output="));
  if (!inArg || !outArg) {
    throw new Error("Usage: node synthesize-scenes.mjs --input=<in.json> --output=<out.json>");
  }

  const inputPath = inArg.slice("--input=".length);
  const outputPath = outArg.slice("--output=".length);
  const payload = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const { renderId, edgeVoiceId, voiceSpeed, scenes } = payload;

  const enriched = [];
  for (let i = 0; i < scenes.length; i++) {
    const result = await synthesizeOneScene({
      renderId,
      index: i,
      scene: scenes[i],
      edgeVoiceId: edgeVoiceId || "en-US-ChristopherNeural",
      voiceSpeed: voiceSpeed || 1.0,
    });
    enriched.push(result);
    process.stdout.write(
      `TTS_PROGRESS:${JSON.stringify({
        sceneIndex: i + 1,
        totalScenes: scenes.length,
        durationMs: result.duration_ms,
        usedFallback: Boolean(result.used_fallback_audio),
      })}\n`
    );
  }

  fs.writeFileSync(outputPath, JSON.stringify({ scenes: enriched }, null, 2), "utf8");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
