import {
  buildDefaultAnimationProps,
  generateEstimatedWordTimestamps,
  type SceneData,
  type SceneType,
} from "@/lib/projects";

export interface BrainstormIdea {
  id: string;
  badge: string;
  title: string;
  hookLine: string;
  visualConcept: string;
  recommendedTemplate: SceneType;
  recommendedDurationSec: 30 | 60 | 90;
  recommendedVoiceId: string;
}

export interface VoicePersona {
  voiceId: string;
  provider: "edge_tts" | "elevenlabs";
  name: string;
  initials: string;
  accentAndTone: string;
  idealFor: string;
  sampleDuration: string;
  isFreeUnlimited: boolean;
  fallbackEdgeVoiceId: string;
}

export const VOICE_CATALOG: VoicePersona[] = [
  {
    voiceId: "en-US-ChristopherNeural",
    provider: "edge_tts",
    name: "Christopher",
    initials: "CH",
    accentAndTone: "US Male • Deep & Authoritative",
    idealFor: "STEM, Tech & Explainer breakdowns",
    sampleDuration: "0:04",
    isFreeUnlimited: true,
    fallbackEdgeVoiceId: "en-US-ChristopherNeural",
  },
  {
    voiceId: "en-US-AnaNeural",
    provider: "edge_tts",
    name: "Ana",
    initials: "AN",
    accentAndTone: "US Female • Cheerful & Kind",
    idealFor: "Kids Early Learning & Counting",
    sampleDuration: "0:04",
    isFreeUnlimited: true,
    fallbackEdgeVoiceId: "en-US-AnaNeural",
  },
  {
    voiceId: "en-US-AriaNeural",
    provider: "edge_tts",
    name: "Aria",
    initials: "AR",
    accentAndTone: "US Female • Upbeat & Dynamic",
    idealFor: "Viral Reels & Hook Focus",
    sampleDuration: "0:04",
    isFreeUnlimited: true,
    fallbackEdgeVoiceId: "en-US-AriaNeural",
  },
  {
    voiceId: "en-IN-NeerjaNeural",
    provider: "edge_tts",
    name: "Neerja",
    initials: "NE",
    accentAndTone: "Indian English • Clear Academic",
    idealFor: "Math, Coding & Logic Tutorials",
    sampleDuration: "0:04",
    isFreeUnlimited: true,
    fallbackEdgeVoiceId: "en-IN-NeerjaNeural",
  },
  {
    voiceId: "JBFqnCBsd6RMkjVDRZzb",
    provider: "elevenlabs",
    name: "George Pro",
    initials: "GP",
    accentAndTone: "British/US • Warm Studio Narrator",
    idealFor: "Deep-Dive Science & History Reels",
    sampleDuration: "0:04",
    isFreeUnlimited: false,
    fallbackEdgeVoiceId: "en-US-ChristopherNeural",
  },
  {
    voiceId: "EXAVITQu4vr4xnSDxMaL",
    provider: "elevenlabs",
    name: "Sarah Pro",
    initials: "SP",
    accentAndTone: "US Female • Crisp Documentary",
    idealFor: "High-Retention Myth vs. Fact",
    sampleDuration: "0:04",
    isFreeUnlimited: false,
    fallbackEdgeVoiceId: "en-US-AriaNeural",
  },
  {
    voiceId: "XrExE9yKIg1WjnnlVkGX",
    provider: "elevenlabs",
    name: "Matilda Pro",
    initials: "MP",
    accentAndTone: "US Female • Expressive Storybook",
    idealFor: "Kids Phonics, Counting & Stories",
    sampleDuration: "0:04",
    isFreeUnlimited: false,
    fallbackEdgeVoiceId: "en-US-AnaNeural",
  },
  {
    voiceId: "onwK4e9ZLuTAKqWW03F9",
    provider: "elevenlabs",
    name: "Daniel Pro",
    initials: "DP",
    accentAndTone: "UK Male • Broadcast Data Host",
    idealFor: "Finance, Charts & Tech Architecture",
    sampleDuration: "0:04",
    isFreeUnlimited: false,
    fallbackEdgeVoiceId: "en-IN-NeerjaNeural",
  },
];

export function isRealApiKey(value: string | undefined): value is string {
  if (!value) return false;
  const trimmed = value.trim();
  if (trimmed.length < 16) return false;
  const upper = trimmed.toUpperCase();
  if (
    upper.includes("DUMMY") ||
    upper.includes("REPLACE") ||
    upper.includes("YOUR_") ||
    upper.includes("EXAMPLE")
  ) {
    return false;
  }
  return true;
}

const VALID_TEMPLATES = new Set<SceneType>([
  "diagram_flow",
  "kids_counting",
  "split_comparison",
  "stat_counter",
  "illustrated_motion",
]);

function coerceTemplate(val: unknown, fallback: SceneType = "diagram_flow"): SceneType {
  return typeof val === "string" && VALID_TEMPLATES.has(val as SceneType)
    ? (val as SceneType)
    : fallback;
}

function coerceDuration(val: unknown, fallback: 30 | 60 | 90 = 60): 30 | 60 | 90 {
  const n = Number(val);
  if (n === 30 || n === 60 || n === 90) return n;
  return fallback;
}

function extractJsonObject(raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

async function callLlmJson(systemPrompt: string, userPrompt: string): Promise<{
  parsed: unknown;
  provider: "gemini-2.5-flash" | "groq-llama-3.3-70b";
} | null> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (isRealApiKey(geminiKey)) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey.trim())}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            generationConfig: {
              temperature: 0.75,
              responseMimeType: "application/json",
            },
          }),
          signal: AbortSignal.timeout(9000),
        }
      );
      if (res.ok) {
        const payload = await res.json();
        const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (typeof text === "string" && text.trim()) {
          return { parsed: extractJsonObject(text), provider: "gemini-2.5-flash" };
        }
      }
    } catch {
      // Fall through to Groq
    }
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (isRealApiKey(groqKey)) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqKey.trim()}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          temperature: 0.75,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
        signal: AbortSignal.timeout(9000),
      });
      if (res.ok) {
        const payload = await res.json();
        const text = payload?.choices?.[0]?.message?.content;
        if (typeof text === "string" && text.trim()) {
          return { parsed: extractJsonObject(text), provider: "groq-llama-3.3-70b" };
        }
      }
    } catch {
      // Fall through to deterministic local generator
    }
  }

  return null;
}

function buildDeterministicBrainstormIdeas(
  topicRaw: string,
  preferredTemplate: SceneType,
  targetDurationSec: 30 | 60 | 90,
  variationSeed = 0
): BrainstormIdea[] {
  const cleanTopic = topicRaw.trim() || "How Solar Panels Turn Sunlight Into Home Electricity";
  const shortTopic =
    cleanTopic.length > 52 ? `${cleanTopic.slice(0, 49).trim()}...` : cleanTopic;
  const isKids =
    preferredTemplate === "kids_counting" ||
    /\b(kid|child|alphabet|abc|count|preschool|toddler|phonics)\b/i.test(cleanTopic);

  const hookAngles = [
    ["Ever wondered how", "really works under the hood in 60 seconds?"],
    ["90% of people misunderstand", "— watch the step-by-step physics unfold!"],
    ["What actually happens inside", "the exact millisecond it switches on?"],
  ];
  const angle = hookAngles[Math.abs(variationSeed) % hookAngles.length];

  if (isKids) {
    return [
      {
        id: `idea_${variationSeed}_1`,
        badge: "Kids Early Stage • High Replay",
        title: `${shortTopic}: Interactive Bounce & Count`,
        hookLine: `Can you count all five glowing objects with me and unlock today's secret letter?`,
        visualConcept:
          "Playful bouncing 3D vector cards popping in 1-by-1 on voiceover beat with confetti burst.",
        recommendedTemplate: "kids_counting",
        recommendedDurationSec: 30,
        recommendedVoiceId: "en-US-AnaNeural",
      },
      {
        id: `idea_${variationSeed}_2`,
        badge: "Phonics & Memory",
        title: `Sing, Spell & Spot: ${shortTopic}`,
        hookLine: `Say the sound out loud with me—watch each letter light up as we count together!`,
        visualConcept:
          "Large golden phoneme card + 5 animated emoji sprites synced to word-by-word read-along pills.",
        recommendedTemplate: "kids_counting",
        recommendedDurationSec: targetDurationSec,
        recommendedVoiceId: "en-US-AnaNeural",
      },
      {
        id: `idea_${variationSeed}_3`,
        badge: "Visual Story Steps",
        title: `3 Simple Steps for Curious Kids: ${shortTopic}`,
        hookLine: `How does this magic happen in real life? Follow the three glowing arrows!`,
        visualConcept:
          "Colorful 3-node illustrated flowchart with friendly icons illuminating step-by-step.",
        recommendedTemplate: "diagram_flow",
        recommendedDurationSec: 60,
        recommendedVoiceId: "en-US-AnaNeural",
      },
      {
        id: `idea_${variationSeed}_4`,
        badge: "True vs. Silly Quiz",
        title: `Silly Guess vs. Real Science: ${shortTopic}`,
        hookLine: `Can you guess which side is silly make-believe and which side is real?`,
        visualConcept:
          "Dual split comparison cards flipping from red Silly Guess to green Verified Discovery.",
        recommendedTemplate: "split_comparison",
        recommendedDurationSec: 30,
        recommendedVoiceId: "en-US-AriaNeural",
      },
      {
        id: `idea_${variationSeed}_5`,
        badge: "Storybook Motion",
        title: `A Magical Zoom Adventure Into ${shortTopic}`,
        hookLine: `Buckle up! Let's shrink down and zoom right inside today's big question!`,
        visualConcept:
          "3D storybook camera zoom with floating callout badges and cheerful karaoke captions.",
        recommendedTemplate: "illustrated_motion",
        recommendedDurationSec: 60,
        recommendedVoiceId: "en-US-AnaNeural",
      },
    ];
  }

  return [
    {
      id: `idea_${variationSeed}_1`,
      badge: "High Retention • STEM Breakdown",
      title: `How ${shortTopic} Works Step-by-Step`,
      hookLine: `${angle[0]} ${cleanTopic.toLowerCase()} ${angle[1]}`,
      visualConcept:
        "4-node system flowchart with glowing directional bezier paths illuminating on each cue.",
      recommendedTemplate: preferredTemplate || "diagram_flow",
      recommendedDurationSec: targetDurationSec,
      recommendedVoiceId: "en-US-ChristopherNeural",
    },
    {
      id: `idea_${variationSeed}_2`,
      badge: "Viral Debunk • Dual Contrast",
      title: `3 Myths vs. Real Facts About ${shortTopic}`,
      hookLine: `Stop believing outdated advice about ${cleanTopic.toLowerCase()}—here is what the real data proves.`,
      visualConcept:
        "Crimson MYTH card vs. Signal Jade FACT card snapping into view with kinetic Hormozi captions.",
      recommendedTemplate: "split_comparison",
      recommendedDurationSec: 60,
      recommendedVoiceId: "en-US-AriaNeural",
    },
    {
      id: `idea_${variationSeed}_3`,
      badge: "Data & Benchmarks",
      title: `The Numbers Behind ${shortTopic} (+87% Efficiency Shift)`,
      hookLine: `One single metric explains why ${cleanTopic.toLowerCase()} is transforming everything right now.`,
      visualConcept:
        "60fps spinning odometer counter + 3-bar comparative benchmark chart scaling on beat.",
      recommendedTemplate: "stat_counter",
      recommendedDurationSec: 30,
      recommendedVoiceId: "en-US-ChristopherNeural",
    },
    {
      id: `idea_${variationSeed}_4`,
      badge: "Deep-Dive Architecture",
      title: `Inside ${shortTopic}: From Input Signal to Final Output`,
      hookLine: `The instant the system starts, a hidden multi-stage chain reaction happens in milliseconds.`,
      visualConcept:
        "Layered technical schematic with micro-callout telemetry pills and smooth Z-axis camera rig.",
      recommendedTemplate: "illustrated_motion",
      recommendedDurationSec: 90,
      recommendedVoiceId: "en-IN-NeerjaNeural",
    },
    {
      id: `idea_${variationSeed}_5`,
      badge: "60-Second Beginner Guide",
      title: `Explain Like I'm 10: ${shortTopic}`,
      hookLine: `If you have 45 seconds, you can master the core intuition behind ${cleanTopic.toLowerCase()} forever.`,
      visualConcept:
        "Playful visual analogy + clean 3-step flowchart designed for maximum shareability on Reels.",
      recommendedTemplate: "diagram_flow",
      recommendedDurationSec: 60,
      recommendedVoiceId: "en-US-AriaNeural",
    },
  ];
}

export async function generateBrainstormIdeas(params: {
  topic: string;
  primaryTemplate: SceneType;
  durationSec: 30 | 60 | 90;
  variationSeed?: number;
}): Promise<{
  ideas: BrainstormIdea[];
  providerUsed: "gemini-2.5-flash" | "groq-llama-3.3-70b" | "animora-topic-engine";
}> {
  const { topic, primaryTemplate, durationSec, variationSeed = 0 } = params;

  const systemPrompt = `You are Animora Studio's Viral Educational Video Strategist.
Return strictly a JSON object with key "ideas" containing EXACTLY 5 distinct video concept objects.
Each object MUST have:
- "badge": short 2-4 word category tag (e.g. "High Retention • STEM", "Kids Early Stage", "Viral Myth-Bust")
- "title": punchy video title (max 70 chars)
- "hookLine": scroll-stopping spoken opening sentence (max 150 chars)
- "visualConcept": 1-sentence description of the 60fps diagram/counting/comparison visual
- "recommendedTemplate": one of ["diagram_flow", "kids_counting", "split_comparison", "stat_counter", "illustrated_motion"]
- "recommendedDurationSec": one of [30, 60, 90]
- "recommendedVoiceId": one of ["en-US-ChristopherNeural", "en-US-AnaNeural", "en-US-AriaNeural", "en-IN-NeerjaNeural"]`;

  const userPrompt = `Topic / Niche: "${topic}"
Preferred Engine: ${primaryTemplate}
Target Duration: ${durationSec}s
Variation Seed: ${variationSeed}
Generate 5 diverse, high-retention educational or kids-learning Reel concepts.`;

  const llmResult = await callLlmJson(systemPrompt, userPrompt);
  if (llmResult && llmResult.parsed && typeof llmResult.parsed === "object") {
    const rawIdeas = (llmResult.parsed as { ideas?: unknown[] }).ideas;
    if (Array.isArray(rawIdeas) && rawIdeas.length >= 3) {
      const mapped: BrainstormIdea[] = rawIdeas.slice(0, 5).map((item, idx) => {
        const obj = (item || {}) as Record<string, unknown>;
        const tpl = coerceTemplate(obj.recommendedTemplate, primaryTemplate);
        return {
          id: `idea_ai_${Date.now()}_${idx + 1}`,
          badge: String(obj.badge || "High Retention • Explainer").slice(0, 42),
          title: String(obj.title || `${topic} — Concept ${idx + 1}`).slice(0, 90),
          hookLine: String(
            obj.hookLine || `Here is how ${topic} works step by step in plain visual terms.`
          ).slice(0, 220),
          visualConcept: String(
            obj.visualConcept || "60fps programmatic vector animation synced to word timestamps."
          ).slice(0, 220),
          recommendedTemplate: tpl,
          recommendedDurationSec: coerceDuration(obj.recommendedDurationSec, durationSec),
          recommendedVoiceId:
            typeof obj.recommendedVoiceId === "string" && obj.recommendedVoiceId.startsWith("en-")
              ? obj.recommendedVoiceId
              : tpl === "kids_counting"
              ? "en-US-AnaNeural"
              : "en-US-ChristopherNeural",
        };
      });
      return { ideas: mapped, providerUsed: llmResult.provider };
    }
  }

  return {
    ideas: buildDeterministicBrainstormIdeas(topic, primaryTemplate, durationSec, variationSeed),
    providerUsed: "animora-topic-engine",
  };
}

function targetSceneCountForDuration(durationSec: 30 | 60 | 90): number {
  if (durationSec === 30) return 5;
  if (durationSec === 90) return 12;
  return 8;
}

function buildSceneAnimationProps(
  sceneType: SceneType,
  headline: string,
  topic: string,
  sceneIdx: number
): Record<string, unknown> {
  const shortTopic = topic.slice(0, 32);
  switch (sceneType) {
    case "kids_counting": {
      const emojis = ["🍎", "⭐", "🚀", "🦕", "🎈"];
      const labels = ["Apples", "Golden Stars", "Space Rockets", "Friendly Dinos", "Balloons"];
      const letters = ["A", "B", "C", "D", "E"];
      const pick = sceneIdx % emojis.length;
      const count = Math.min(5, (sceneIdx % 5) + 1);
      return {
        mode: sceneIdx % 2 === 0 ? "counting" : "alphabet",
        focus_symbol: `${letters[pick]} • ${count}`,
        phonetic_word: headline,
        target_count: count,
        item_label: labels[pick],
        item_emoji: emojis[pick],
        theme_palette: "playful",
        confetti_on_complete: true,
      };
    }
    case "split_comparison":
      return {
        left_or_top_card: {
          badge_text: "✗ COMMON MYTH",
          title: "Surface Assumption",
          points: [
            `Overlooks core ${shortTopic.toLowerCase()} mechanics`,
            "Causes avoidable performance loss",
            "Based on outdated rules of thumb",
          ],
          color_hex: "#EF4444",
        },
        right_or_bottom_card: {
          badge_text: "✓ VERIFIED SCIENCE",
          title: headline.slice(0, 38),
          points: [
            "Backed by measured real-world physics",
            "Maximizes long-term output & reliability",
            "Easy to apply immediately",
          ],
          color_hex: "#10B981",
        },
      };
    case "stat_counter":
      return {
        display_mode: sceneIdx % 2 === 0 ? "bar_chart" : "big_number",
        target_number: 87,
        number_prefix: "+",
        number_suffix: "%",
        takeaway_label: headline,
        bars: [
          { label: "Baseline", value: 28, color_hex: "#64748B" },
          { label: "Standard", value: 54, color_hex: "#F59E0B" },
          { label: "Optimized", value: 87, color_hex: "#10B981" },
        ],
      };
    case "illustrated_motion": {
      const motions = ["zoom_in", "pan_right", "zoom_out", "pan_left"] as const;
      return {
        art_style: "dark_tech",
        camera_motion: motions[sceneIdx % motions.length],
        callout_badge: `⚡ ${headline.slice(0, 30)}`,
      };
    }
    case "diagram_flow":
    default:
      return {
        flow_direction: "auto",
        nodes: [
          {
            id: `s${sceneIdx + 1}_n1`,
            title: "1. Input Trigger",
            subtitle: `Initial signal enters ${shortTopic.slice(0, 22)}`,
            icon: "☀️",
          },
          {
            id: `s${sceneIdx + 1}_n2`,
            title: "2. Core Transformation",
            subtitle: headline.slice(0, 36),
            icon: "⚡",
          },
          {
            id: `s${sceneIdx + 1}_n3`,
            title: "3. Verified Output",
            subtitle: "Clean, measurable result delivered",
            icon: "🚀",
          },
        ],
      };
  }
}

function buildDeterministicStoryboard(params: {
  title: string;
  topicPrompt: string;
  hookLine?: string;
  mode: "brainstorm" | "custom_script";
  customScript?: string;
  durationSec: 30 | 60 | 90;
  primaryTemplate: SceneType;
  voiceSpeed: number;
}): SceneData[] {
  const {
    title,
    topicPrompt,
    hookLine,
    mode,
    customScript,
    durationSec,
    primaryTemplate,
    voiceSpeed,
  } = params;

  const targetCount = targetSceneCountForDuration(durationSec);
  const speedClamped = Math.min(1.4, Math.max(0.8, voiceSpeed || 1.0));

  // Custom script splitting path
  if (mode === "custom_script" && customScript && customScript.trim().length > 15) {
    const rawBlocks = customScript
      .split(/\n{2,}|(?<=[.!?])\s+(?=[A-Z0-9"“])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const chunks: string[] = [];
    if (rawBlocks.length <= targetCount) {
      chunks.push(...rawBlocks);
    } else {
      const perScene = Math.ceil(rawBlocks.length / targetCount);
      for (let i = 0; i < rawBlocks.length; i += perScene) {
        chunks.push(rawBlocks.slice(i, i + perScene).join(" "));
      }
    }

    return chunks.slice(0, 15).map((narration, idx) => {
      const wordCount = narration.split(/\s+/).filter(Boolean).length;
      // ~145 WPM at 1.0x => ~414ms per word
      const rawMs = Math.round(((wordCount * 414) / speedClamped) + 600);
      const durationMs = Math.min(14000, Math.max(4000, rawMs));
      const sceneType: SceneType =
        idx === 0 && primaryTemplate !== "kids_counting" ? "illustrated_motion" : primaryTemplate;
      const firstWords = narration.split(/\s+/).slice(0, 6).join(" ").replace(/[.,!?]+$/, "");
      const headline = idx === 0 ? title.slice(0, 56) : `${idx + 1}. ${firstWords}`;

      return {
        scene_id: `sc_${String(idx + 1).padStart(2, "0")}`,
        order_index: idx + 1,
        scene_type: sceneType,
        on_screen_headline: headline,
        narration_text: narration,
        visual_prompt: `${title} — ${headline}`,
        animation_props: buildSceneAnimationProps(sceneType, headline, title, idx),
        word_timestamps: generateEstimatedWordTimestamps(narration, durationMs),
        duration_ms: durationMs,
      };
    });
  }

  // Structured Educational Storyboard Arc (Hook -> Mechanism -> Contrast -> Data -> Recap CTA)
  const cleanTopic = topicPrompt.trim() || title;
  const openingHook =
    hookLine?.trim() ||
    `Have you ever wondered how ${cleanTopic.toLowerCase()} actually works step by step? Let's break it down visually!`;

  const stageBlueprints: Array<{
    headline: string;
    narration: string;
    template: SceneType;
  }> = [
    {
      headline: title.slice(0, 58),
      narration: openingHook,
      template: primaryTemplate === "kids_counting" ? "kids_counting" : "illustrated_motion",
    },
    {
      headline: "Step 1: The Core Building Blocks",
      narration: `At the foundation of ${cleanTopic}, everything starts with three essential components working in tight synchronization.`,
      template: primaryTemplate,
    },
    {
      headline: "Step 2: How the Signal Triggers Action",
      narration: `The moment energy or input arrives, it triggers a rapid chain reaction that moves cleanly from stage one into stage two.`,
      template: primaryTemplate,
    },
    {
      headline: "Common Myth vs. Measured Reality",
      narration: `Many beginners assume the process loses most of its power right away, but modern design keeps real-world efficiency remarkably high.`,
      template: primaryTemplate === "kids_counting" ? "kids_counting" : "split_comparison",
    },
    {
      headline: "Real-World Impact & Key Takeaway",
      narration: `Visualizing ${cleanTopic} step by step boosts comprehension up to eighty-seven percent! Follow for your next sixty-second breakdown!`,
      template: primaryTemplate === "kids_counting" ? "kids_counting" : "stat_counter",
    },
    {
      headline: "Step 3: Precision Control & Regulation",
      narration: `Smart feedback sensors continuously regulate timing and balance so output stays smooth under changing conditions.`,
      template: primaryTemplate,
    },
    {
      headline: "Step 4: Scaling Across Everyday Life",
      narration: `Once stabilized, this exact mechanism scales effortlessly from tiny pocket devices to city-scale infrastructure.`,
      template: "diagram_flow",
    },
    {
      headline: "Quick 10-Second Mental Model",
      narration: `Remember the simple three-part loop: clean input, structured conversion, and high-efficiency delivery—follow for more explainers!`,
      template: primaryTemplate,
    },
    {
      headline: "Edge Case: Peak Load Behavior",
      narration: `Under peak demand, protective buffers absorb spikes automatically without interrupting downstream performance.`,
      template: "split_comparison",
    },
    {
      headline: "Historical Leap in Performance",
      narration: `Over the past decade, engineering breakthroughs cut cost dramatically while pushing reliability past eighty-seven percent.`,
      template: "stat_counter",
    },
    {
      headline: "Inside the Microscopic Layer",
      narration: `Zooming in reveals why material purity and geometry matter so much at high operating speeds.`,
      template: "illustrated_motion",
    },
    {
      headline: "Final Summary & Next Reel",
      narration: `Now you know the complete science behind ${cleanTopic}! Save this Reel for revision and comment what topic we should animate next.`,
      template: "diagram_flow",
    },
  ];

  const selected =
    targetCount === 5
      ? stageBlueprints.slice(0, 5)
      : targetCount === 8
      ? [
          stageBlueprints[0],
          stageBlueprints[1],
          stageBlueprints[2],
          stageBlueprints[5],
          stageBlueprints[3],
          stageBlueprints[6],
          stageBlueprints[4],
          stageBlueprints[7],
        ]
      : stageBlueprints.slice(0, 12);

  const baseSceneMs = Math.round(((durationSec * 1000) / selected.length) / speedClamped);

  return selected.map((item, idx) => {
    const durationMs = Math.max(3800, baseSceneMs);
    return {
      scene_id: `sc_${String(idx + 1).padStart(2, "0")}`,
      order_index: idx + 1,
      scene_type: item.template,
      on_screen_headline: item.headline,
      narration_text: item.narration,
      visual_prompt: `${title} — ${item.headline}`,
      animation_props: buildSceneAnimationProps(item.template, item.headline, title, idx),
      word_timestamps: generateEstimatedWordTimestamps(item.narration, durationMs),
      duration_ms: durationMs,
    };
  });
}

export async function generateProjectStoryboard(params: {
  title: string;
  topicPrompt: string;
  hookLine?: string;
  mode: "brainstorm" | "custom_script";
  customScript?: string;
  durationSec: 30 | 60 | 90;
  aspectRatio: "9:16" | "16:9";
  primaryTemplate: SceneType;
  voiceSpeed: number;
}): Promise<{
  scenes: SceneData[];
  providerUsed: "gemini-2.5-flash" | "groq-llama-3.3-70b" | "animora-storyboard-engine";
}> {
  const targetScenes = targetSceneCountForDuration(params.durationSec);
  const speedClamped = Math.min(1.4, Math.max(0.8, params.voiceSpeed || 1.0));

  const systemPrompt = `You are Animora Studio's 60fps Animated Storyboard Architect.
Return strictly a JSON object with key "scenes" containing EXACTLY ${targetScenes} ordered scene objects.
Each scene object MUST include:
- "scene_type": one of ["diagram_flow", "kids_counting", "split_comparison", "stat_counter", "illustrated_motion"] (predominantly "${params.primaryTemplate}")
- "on_screen_headline": crisp title max 55 chars
- "narration_text": clear spoken voiceover sentence(s) (~18-24 words per scene)
- "duration_ms": integer milliseconds between 4200 and 9500
- "animation_props": valid object for that scene_type (or omit optional subfields).`;

  const userPrompt =
    params.mode === "custom_script" && params.customScript?.trim()
      ? `Title: "${params.title}"\nAspect Ratio: ${params.aspectRatio}\nTarget Duration: ${params.durationSec}s (${targetScenes} scenes)\nPrimary Engine: ${params.primaryTemplate}\nConvert this custom script/notes into ${targetScenes} timed scenes:\n${params.customScript}`
      : `Title: "${params.title}"\nTopic: "${params.topicPrompt}"\nOpening Hook: "${params.hookLine || ""}"\nAspect Ratio: ${params.aspectRatio}\nTarget Duration: ${params.durationSec}s (${targetScenes} scenes)\nPrimary Engine: ${params.primaryTemplate}\nGenerate a cohesive single-topic educational storyboard.`;

  const llmResult = await callLlmJson(systemPrompt, userPrompt);
  if (llmResult && llmResult.parsed && typeof llmResult.parsed === "object") {
    const rawScenes = (llmResult.parsed as { scenes?: unknown[] }).scenes;
    if (Array.isArray(rawScenes) && rawScenes.length >= 3) {
      const scenes: SceneData[] = rawScenes.slice(0, 15).map((raw, idx) => {
        const s = (raw || {}) as Record<string, unknown>;
        const sceneType = coerceTemplate(s.scene_type, params.primaryTemplate);
        const headline = String(s.on_screen_headline || `Scene ${idx + 1}`).slice(0, 68);
        const narration = String(
          s.narration_text || params.topicPrompt || params.title
        ).trim();
        const rawDur = Number(s.duration_ms) || Math.round((params.durationSec * 1000) / rawScenes.length);
        const durationMs = Math.min(14000, Math.max(3800, Math.round(rawDur / speedClamped)));
        const props =
          s.animation_props && typeof s.animation_props === "object" && Object.keys(s.animation_props as object).length > 0
            ? {
                ...buildDefaultAnimationProps(sceneType, headline),
                ...(s.animation_props as Record<string, unknown>),
              }
            : buildSceneAnimationProps(sceneType, headline, params.title, idx);

        return {
          scene_id: `sc_${String(idx + 1).padStart(2, "0")}`,
          order_index: idx + 1,
          scene_type: sceneType,
          on_screen_headline: headline,
          narration_text: narration,
          visual_prompt: `${params.title} — ${headline}`,
          animation_props: props,
          word_timestamps: generateEstimatedWordTimestamps(narration, durationMs),
          duration_ms: durationMs,
        };
      });
      return { scenes, providerUsed: llmResult.provider };
    }
  }

  return {
    scenes: buildDeterministicStoryboard(params),
    providerUsed: "animora-storyboard-engine",
  };
}
