export type SceneType =
  | "kids_counting"
  | "diagram_flow"
  | "split_comparison"
  | "stat_counter"
  | "illustrated_motion";

export type SubtitleStyle =
  | "karaoke_highlight"
  | "hormozi_pop"
  | "kids_read_along"
  | "clean_minimal";

export interface WordTimestamp {
  word: string;
  start_ms: number;
  end_ms: number;
}

export interface CaptionConfig {
  enabled: boolean;
  style: SubtitleStyle;
  font_family: string;
  text_color: string;
  highlight_color: string;
  position: "bottom_safe" | "middle" | "top";
}

export interface BrandKitConfig {
  primary_color: string;
  accent_color: string;
  font_family: string;
  brand_name?: string;
}

// Template 1: Kids Counting & Alphabet A-Z
export interface KidsCountingProps {
  mode: "counting" | "alphabet";
  focus_symbol: string;
  phonetic_word: string;
  target_count: number;
  item_label: string;
  item_emoji: string;
  theme_palette: "playful" | "pastel" | "chalkboard";
  pop_trigger_ms?: number[];
  confetti_on_complete: boolean;
}

// Template 2: Animated Diagram & Flowchart
export interface DiagramNode {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
}

export interface DiagramFlowProps {
  flow_direction: "auto" | "vertical" | "horizontal";
  nodes: DiagramNode[];
}

// Template 3: Split Comparison (Myth vs. Fact)
export interface ComparisonSide {
  badge_text: string;
  title: string;
  points: string[];
  color_hex: string;
}

export interface SplitComparisonProps {
  left_or_top_card: ComparisonSide;
  right_or_bottom_card: ComparisonSide;
}

// Template 4: Stat Counter & Bar Chart
export interface ChartBar {
  label: string;
  value: number;
  color_hex: string;
}

export interface StatCounterProps {
  display_mode: "big_number" | "bar_chart";
  target_number: number;
  number_prefix: string;
  number_suffix: string;
  takeaway_label: string;
  bars?: ChartBar[];
}

// Template 5: Illustrated Motion
export interface IllustratedMotionProps {
  art_style: "flat_vector" | "pixar_3d" | "whiteboard" | "dark_tech";
  camera_motion: "zoom_in" | "zoom_out" | "pan_left" | "pan_right";
  callout_badge: string;
  illustration_theme?: string;
}

export type AnyAnimationProps =
  | KidsCountingProps
  | DiagramFlowProps
  | SplitComparisonProps
  | StatCounterProps
  | IllustratedMotionProps;

export interface SceneData {
  scene_id: string;
  order_index: number;
  scene_type: SceneType;
  narration_text: string;
  on_screen_headline: string;
  visual_prompt?: string;
  animation_props: Record<string, any>;
  voiceover_url?: string;
  image_url?: string;
  word_timestamps: WordTimestamp[];
  duration_ms: number;
}

export interface AnimoraProjectPayload {
  project_id: string;
  title: string;
  category_preset: string;
  aspect_ratio: "9:16" | "16:9";
  fps?: number;
  brand_kit: BrandKitConfig;
  caption_config: CaptionConfig;
  scenes: SceneData[];
}

export function generateEstimatedWordTimestamps(
  text: string,
  durationMs: number
): WordTimestamp[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const activeDuration = Math.max(1000, durationMs - 350);
  const totalChars = words.reduce((acc, w) => acc + w.length + 1, 0);
  let cursor = 120;

  return words.map((word) => {
    const share = (word.length + 1) / totalChars;
    const wordDur = Math.max(180, Math.round(share * activeDuration));
    const entry: WordTimestamp = {
      word,
      start_ms: cursor,
      end_ms: cursor + wordDur,
    };
    cursor += wordDur;
    return entry;
  });
}

export const DEFAULT_PROTOTYPE_PROJECT: AnimoraProjectPayload = {
  project_id: "proto_01",
  title: "Animora Studio: 5 Animated Explainer Templates Showcase",
  category_preset: "Educational & Kids Animated Explainer",
  aspect_ratio: "9:16",
  brand_kit: {
    primary_color: "#6366F1",
    accent_color: "#F59E0B",
    font_family: "Inter, system-ui, sans-serif",
    brand_name: "Animora Studio",
  },
  caption_config: {
    enabled: true,
    style: "karaoke_highlight",
    font_family: "Inter, system-ui, sans-serif",
    text_color: "#FFFFFF",
    highlight_color: "#FBBF24",
    position: "bottom_safe",
  },
  scenes: [
    {
      scene_id: "sc_01",
      order_index: 1,
      scene_type: "illustrated_motion",
      on_screen_headline: "How AI Turns Ideas Into Animated Reels",
      narration_text:
        "Want to turn any idea into an animated educational video in seconds? Here is how Animora Studio works!",
      duration_ms: 5800,
      animation_props: {
        art_style: "dark_tech",
        camera_motion: "zoom_in",
        callout_badge: "✨ Idea to Animated Reel",
      } satisfies IllustratedMotionProps,
      word_timestamps: generateEstimatedWordTimestamps(
        "Want to turn any idea into an animated educational video in seconds? Here is how Animora Studio works!",
        5800
      ),
    },
    {
      scene_id: "sc_02",
      order_index: 2,
      scene_type: "diagram_flow",
      on_screen_headline: "The 4-Step Automated Pipeline",
      narration_text:
        "First, brainstorm your topic. Second, generate an animated storyboard. Third, add AI voiceover. Fourth, auto-post to Instagram!",
      duration_ms: 6800,
      animation_props: {
        flow_direction: "auto",
        nodes: [
          {
            id: "n1",
            title: "1. AI Brainstorm",
            subtitle: "Generate 5 hook-driven topic angles",
            icon: "💡",
          },
          {
            id: "n2",
            title: "2. Animated Storyboard",
            subtitle: "Diagrams, charts & kids animations",
            icon: "🎬",
          },
          {
            id: "n3",
            title: "3. Voice & Subtitles",
            subtitle: "Word-synced neural voiceover",
            icon: "🎙️",
          },
          {
            id: "n4",
            title: "4. Instagram Auto-Post",
            subtitle: "1-Click publish or schedule Reels",
            icon: "🚀",
          },
        ],
      } satisfies DiagramFlowProps,
      word_timestamps: generateEstimatedWordTimestamps(
        "First, brainstorm your topic. Second, generate an animated storyboard. Third, add AI voiceover. Fourth, auto-post to Instagram!",
        6800
      ),
    },
    {
      scene_id: "sc_03",
      order_index: 3,
      scene_type: "kids_counting",
      on_screen_headline: "Kids Learning: A-to-Z & Counting",
      narration_text:
        "Creating kids learning videos? Let's count three shiny red apples together! One! Two! Three!",
      duration_ms: 6200,
      animation_props: {
        mode: "counting",
        focus_symbol: "A • 3",
        phonetic_word: "A is for Apple",
        target_count: 3,
        item_label: "Apples",
        item_emoji: "🍎",
        theme_palette: "playful",
        pop_trigger_ms: [2800, 3900, 4900],
        confetti_on_complete: true,
      } satisfies KidsCountingProps,
      word_timestamps: generateEstimatedWordTimestamps(
        "Creating kids learning videos? Let's count three shiny red apples together! One! Two! Three!",
        6200
      ),
    },
    {
      scene_id: "sc_04",
      order_index: 4,
      scene_type: "split_comparison",
      on_screen_headline: "Manual Editing vs. Animora Studio",
      narration_text:
        "Stop spending four hours stitching five separate apps together. Build, animate, and schedule in one single dashboard.",
      duration_ms: 6200,
      animation_props: {
        left_or_top_card: {
          badge_text: "✗ OLD MANUAL WAY",
          title: "5 Disconnected Tools",
          points: [
            "4+ hours editing per video",
            "Static boring slideshows",
            "Manual subtitle timing & upload",
          ],
          color_hex: "#EF4444",
        },
        right_or_bottom_card: {
          badge_text: "✓ ANIMORA STUDIO",
          title: "1 Automated Pipeline",
          points: [
            "Ready in under 3 minutes",
            "Real 60fps diagrams & animations",
            "1-Click Instagram Reels schedule",
          ],
          color_hex: "#10B981",
        },
      } satisfies SplitComparisonProps,
      word_timestamps: generateEstimatedWordTimestamps(
        "Stop spending four hours stitching five separate apps together. Build, animate, and schedule in one single dashboard.",
        6200
      ),
    },
    {
      scene_id: "sc_05",
      order_index: 5,
      scene_type: "stat_counter",
      on_screen_headline: "Higher Viewer Retention with Animation",
      narration_text:
        "Animated diagrams and word-synced captions boost viewer retention up to eighty-seven percent! Ready to create your first video?",
      duration_ms: 6200,
      animation_props: {
        display_mode: "bar_chart",
        target_number: 87,
        number_prefix: "+",
        number_suffix: "%",
        takeaway_label: "Higher Retention on Animated Educational Reels",
        bars: [
          { label: "Plain Text", value: 24, color_hex: "#64748B" },
          { label: "Static Slides", value: 45, color_hex: "#818CF8" },
          { label: "Animora Animated", value: 87, color_hex: "#F59E0B" },
        ],
      } satisfies StatCounterProps,
      word_timestamps: generateEstimatedWordTimestamps(
        "Animated diagrams and word-synced captions boost viewer retention up to eighty-seven percent! Ready to create your first video?",
        6200
      ),
    },
  ],
};
