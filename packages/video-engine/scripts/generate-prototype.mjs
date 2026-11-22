import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENGINE_ROOT = path.resolve(__dirname, "..");
const PUBLIC_AUDIO_DIR = path.join(ENGINE_ROOT, "public", "audio");
const OUT_DIR = path.join(ENGINE_ROOT, "out");

fs.mkdirSync(PUBLIC_AUDIO_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

function generateEstimatedWordTimestamps(text, durationMs) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const activeDuration = Math.max(900, durationMs - 300);
  const totalChars = words.reduce((acc, w) => acc + w.length + 1, 0);
  let cursor = 100;

  return words.map((word) => {
    const share = (word.length + 1) / totalChars;
    const wordDur = Math.max(160, Math.round(share * activeDuration));
    const entry = {
      word,
      start_ms: cursor,
      end_ms: cursor + wordDur,
    };
    cursor += wordDur;
    return entry;
  });
}

async function synthesizeSceneVoiceover(sceneId, narrationText) {
  const { MsEdgeTTS, OUTPUT_FORMAT } = await import("msedge-tts");
  const tts = new MsEdgeTTS();
  await tts.setMetadata(
    "en-US-ChristopherNeural",
    OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3
  );
  const mp3FileName = `${sceneId}.mp3`;
  const mp3FullPath = path.join(PUBLIC_AUDIO_DIR, mp3FileName);
  if (fs.existsSync(mp3FullPath)) {
    fs.unlinkSync(mp3FullPath);
  }
  const { audioFilePath } = await tts.toFile(PUBLIC_AUDIO_DIR, narrationText);
  if (audioFilePath && fs.existsSync(audioFilePath)) {
    if (audioFilePath !== mp3FullPath) {
      fs.renameSync(audioFilePath, mp3FullPath);
    }
    const stat = fs.statSync(mp3FullPath);
    // 48kbps = 6000 bytes per second
    const durationMs = Math.max(3000, Math.round((stat.size / 6000) * 1000));
    console.log(
      `[TTS] Edge Neural TTS synthesized ${mp3FileName} (${(durationMs / 1000).toFixed(1)}s)`
    );
    return {
      voiceover_url: `audio/${mp3FileName}`,
      duration_ms: durationMs + 450,
      word_timestamps: generateEstimatedWordTimestamps(
        narrationText,
        durationMs
      ),
    };
  }
  throw new Error(`Failed to synthesize audio for ${sceneId}`);
}

// Single-Topic Deep-Dive Educational Explainer (~85-90 Seconds, 8 Cohesive Scenes):
// Topic: "How Solar Panels Turn Sunlight Into Electricity for Your Home"
const SOLAR_EXPLAINER_SCENES = [
  {
    scene_id: "solar_01",
    order_index: 1,
    scene_type: "illustrated_motion",
    on_screen_headline: "How Solar Panels Turn Sunlight Into Electricity",
    narration_text:
      "Have you ever wondered how a flat glass panel on a roof can power an entire house using only sunlight? Let's break down the science of solar energy step by step!",
    animation_props: {
      art_style: "dark_tech",
      camera_motion: "zoom_in",
      callout_badge: "☀️ Solar Energy Science Explained",
    },
  },
  {
    scene_id: "solar_02",
    order_index: 2,
    scene_type: "diagram_flow",
    on_screen_headline: "Inside a Silicon Photovoltaic Cell",
    narration_text:
      "Every solar panel contains dozens of silicon cells built like a sandwich: a negative N-type silicon layer on top, a positive P-type layer below, and an electric junction in the middle.",
    animation_props: {
      flow_direction: "auto",
      nodes: [
        {
          id: "layer1",
          title: "Top Layer: N-Type Silicon",
          subtitle: "Loaded with extra negatively charged electrons",
          icon: "➖",
        },
        {
          id: "layer2",
          title: "Middle: P-N Electric Junction",
          subtitle: "Creates a one-way internal electric field",
          icon: "⚡",
        },
        {
          id: "layer3",
          title: "Bottom Layer: P-Type Silicon",
          subtitle: "Contains positively charged electron spaces",
          icon: "➕",
        },
      ],
    },
  },
  {
    scene_id: "solar_03",
    order_index: 3,
    scene_type: "diagram_flow",
    on_screen_headline: "The Photovoltaic Effect in 4 Steps",
    narration_text:
      "First, sunlight hits the panel as tiny packets of energy called photons. Second, photons knock electrons loose from silicon atoms. Third, the electric field pushes those electrons into metal wires as electric current!",
    animation_props: {
      flow_direction: "auto",
      nodes: [
        {
          id: "p1",
          title: "1. Sunlight Photons Strike",
          subtitle: "Solar radiation penetrates the anti-reflective glass",
          icon: "☀️",
        },
        {
          id: "p2",
          title: "2. Electrons Knocked Free",
          subtitle: "Photon energy frees electrons from silicon atoms",
          icon: "⚛️",
        },
        {
          id: "p3",
          title: "3. Electric Field Pushes Flow",
          subtitle: "Electrons race upward into thin metal grid lines",
          icon: "🔋",
        },
        {
          id: "p4",
          title: "4. Direct Current (DC) Born",
          subtitle: "Flowing electrons exit the panel as DC power",
          icon: "🔌",
        },
      ],
    },
  },
  {
    scene_id: "solar_04",
    order_index: 4,
    scene_type: "kids_counting",
    on_screen_headline: "The 3 Core Parts of a Home Solar System",
    narration_text:
      "To power a real home, you need three key parts working together. Part one: the rooftop solar panels! Part two: the solar inverter! And part three: your home battery and breaker box!",
    animation_props: {
      mode: "counting",
      focus_symbol: "3 Parts",
      phonetic_word: "Home Solar Setup",
      target_count: 3,
      item_label: "Core Components",
      item_emoji: "☀️",
      theme_palette: "playful",
      confetti_on_complete: true,
    },
  },
  {
    scene_id: "solar_05",
    order_index: 5,
    scene_type: "split_comparison",
    on_screen_headline: "Why You Need an Inverter: DC vs. AC Power",
    narration_text:
      "Why can't solar panels plug straight into your toaster? Because panels generate Direct Current, where electrons flow in one straight direction, while your home appliances require Alternating Current!",
    animation_props: {
      left_or_top_card: {
        badge_text: "🔋 DIRECT CURRENT (DC)",
        title: "From Roof Solar Panels",
        points: [
          "Electrons flow in 1 flat direction",
          "Great for charging batteries",
          "Cannot run standard wall outlets",
        ],
        color_hex: "#F59E0B",
      },
      right_or_bottom_card: {
        badge_text: "⚡ ALTERNATING CURRENT (AC)",
        title: "Converted by Solar Inverter",
        points: [
          "Switches direction 60 times/sec",
          "Standard 120V / 240V home power",
          "Runs fridges, AC, lights & TVs",
        ],
        color_hex: "#10B981",
      },
    },
  },
  {
    scene_id: "solar_06",
    order_index: 6,
    scene_type: "diagram_flow",
    on_screen_headline: "How Power Flows From Roof to Your Outlets",
    narration_text:
      "Once the inverter transforms Direct Current into Alternating Current, electricity flows into your main breaker panel, powers your lights and appliances first, and sends any extra energy to your battery!",
    animation_props: {
      flow_direction: "auto",
      nodes: [
        {
          id: "f1",
          title: "1. Solar Inverter",
          subtitle: "Converts raw DC power into usable 240V AC power",
          icon: "🔄",
        },
        {
          id: "f2",
          title: "2. Home Breaker Panel",
          subtitle: "Routes electricity to every room and wall outlet",
          icon: "🏠",
        },
        {
          id: "f3",
          title: "3. Battery & Smart Meter",
          subtitle: "Stores surplus energy for nighttime or grid credits",
          icon: "🔋",
        },
      ],
    },
  },
  {
    scene_id: "solar_07",
    order_index: 7,
    scene_type: "stat_counter",
    on_screen_headline: "Real-World Solar Impact & Bill Savings",
    narration_text:
      "Today's high efficiency solar systems last over twenty five years and can reduce a household's annual electricity bill by up to eighty five percent compared to relying only on fossil fuel grid power!",
    animation_props: {
      display_mode: "bar_chart",
      target_number: 85,
      number_prefix: "-",
      number_suffix: "%",
      takeaway_label: "Average Electric Bill Reduction with Solar + Battery",
      bars: [
        { label: "Old Coal Grid", value: 15, color_hex: "#EF4444" },
        { label: "Solar Only", value: 62, color_hex: "#3B82F6" },
        { label: "Solar + Battery", value: 85, color_hex: "#10B981" },
      ],
    },
  },
  {
    scene_id: "solar_08",
    order_index: 8,
    scene_type: "illustrated_motion",
    on_screen_headline: "Clean Energy Day and Night",
    narration_text:
      "At night, when the sun goes down, your home seamlessly draws stored solar power from its battery or uses daytime grid credits. And that is how silent photons from the sun power your entire home!",
    animation_props: {
      art_style: "dark_tech",
      camera_motion: "zoom_out",
      callout_badge: "⚡ Sunlight ➔ Silicon ➔ Inverter ➔ Home",
    },
  },
];

async function main() {
  console.log("=== Animora Studio: 85s Single-Topic Solar Explainer Generator ===");
  const enrichedScenes = [];
  let totalDurationMs = 0;

  for (const scene of SOLAR_EXPLAINER_SCENES) {
    const ttsData = await synthesizeSceneVoiceover(
      scene.scene_id,
      scene.narration_text
    );
    totalDurationMs += ttsData.duration_ms;
    enrichedScenes.push({
      ...scene,
      voiceover_url: ttsData.voiceover_url,
      duration_ms: ttsData.duration_ms,
      word_timestamps: ttsData.word_timestamps,
    });
  }

  console.log(
    `[Total Duration] ${(totalDurationMs / 1000).toFixed(1)} seconds across ${
      enrichedScenes.length
    } scenes`
  );

  const projectPayload = {
    project: {
      project_id: "solar_explainer_01",
      title: "How Solar Panels Turn Sunlight Into Electricity (Full Explainer)",
      category_preset: "Science & Technology Explainer",
      aspect_ratio: "9:16",
      brand_kit: {
        primary_color: "#3B82F6",
        accent_color: "#F59E0B",
        font_family: "Inter, system-ui, sans-serif",
        brand_name: "Animora Studio • Science Explainer",
      },
      caption_config: {
        enabled: true,
        style: "karaoke_highlight",
        font_family: "Inter, system-ui, sans-serif",
        text_color: "#FFFFFF",
        highlight_color: "#FBBF24",
        position: "bottom_safe",
      },
      scenes: enrichedScenes,
    },
  };

  const propsPath = path.join(OUT_DIR, "solar-explainer-props.json");
  fs.writeFileSync(propsPath, JSON.stringify(projectPayload, null, 2), "utf-8");
  console.log(`[Storyboard] Wrote 8-scene solar explainer props to ${propsPath}`);

  const outputMp4 = path.join(OUT_DIR, "solar-explainer-video.mp4");
  console.log(`[Render] Rendering 1080x1920 (9:16) H.264 MP4 to ${outputMp4}...`);

  const remotionCli = path.join(
    ENGINE_ROOT,
    "node_modules",
    "@remotion",
    "cli",
    "remotion-cli.js"
  );

  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const cliArgs = [
    remotionCli,
    "render",
    "src/index.ts",
    "AnimoraVideo",
    outputMp4,
    `--props=${propsPath}`,
  ];
  if (fs.existsSync(chromePath)) {
    cliArgs.push(`--browser-executable=${chromePath}`);
  }

  const res = spawnSync(process.execPath, cliArgs, {
    cwd: ENGINE_ROOT,
    stdio: "inherit",
  });

  if (res.status !== 0) {
    process.exit(res.status || 1);
  }

  console.log(`\n✅ Full Solar Explainer MP4 generated at: ${outputMp4}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
