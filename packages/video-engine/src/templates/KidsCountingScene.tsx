import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import {
  BrandKitConfig,
  KidsCountingProps,
  WordTimestamp,
} from "../types/schema";

interface Props {
  props: KidsCountingProps;
  wordTimestamps: WordTimestamp[];
  durationMs: number;
  isVertical: boolean;
  brandKit: BrandKitConfig;
}

const NUMBER_WORD_MAP: Record<string, number> = {
  one: 1,
  "1": 1,
  two: 2,
  "2": 2,
  three: 3,
  "3": 3,
  four: 4,
  "4": 4,
  five: 5,
  "5": 5,
  six: 6,
  "6": 6,
  seven: 7,
  "7": 7,
  eight: 8,
  "8": 8,
  nine: 9,
  "9": 9,
  ten: 10,
  "10": 10,
};

export const KidsCountingScene: React.FC<Props> = ({
  props,
  wordTimestamps,
  durationMs,
  isVertical,
  brandKit,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentMs = (frame / fps) * 1000;

  const targetCount = Math.min(12, Math.max(1, props.target_count || 3));

  // Derive pop triggers from voiceover word timestamps if "One", "Two", "Three" are spoken!
  const derivedTriggers: number[] = [];
  for (const wt of wordTimestamps || []) {
    const clean = wt.word.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (NUMBER_WORD_MAP[clean]) {
      derivedTriggers.push(wt.start_ms);
    }
  }

  const triggers: number[] = [];
  for (let i = 0; i < targetCount; i++) {
    if (derivedTriggers[i] !== undefined) {
      triggers.push(derivedTriggers[i]);
    } else if (props.pop_trigger_ms && props.pop_trigger_ms[i] !== undefined) {
      triggers.push(props.pop_trigger_ms[i]);
    } else {
      const startOffset = durationMs * 0.32;
      const step = (durationMs * 0.52) / Math.max(1, targetCount);
      triggers.push(Math.round(startOffset + i * step));
    }
  }

  const heroBounce = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 160 },
  });

  // Determine how many items have popped in so far
  const activeCount = triggers.filter((t) => currentMs >= t).length;
  const allComplete = activeCount >= targetCount;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: isVertical ? 280 : 175,
        position: "relative",
      }}
    >
      {/* Hero Alphabet / Number Badge */}
      <div
        style={{
          transform: `scale(${heroBounce})`,
          display: "flex",
          alignItems: "center",
          gap: 28,
          padding: isVertical ? "26px 48px" : "20px 44px",
          borderRadius: 36,
          background:
            "linear-gradient(135deg, rgba(245, 158, 11, 0.95), rgba(236, 72, 153, 0.95))",
          boxShadow: "0 24px 60px rgba(245, 158, 11, 0.35)",
          border: "4px solid rgba(255, 255, 255, 0.65)",
          marginBottom: isVertical ? 48 : 32,
        }}
      >
        <div
          style={{
            fontSize: isVertical ? 96 : 78,
            fontWeight: 900,
            color: "#FFFFFF",
            lineHeight: 1,
            textShadow: "0 6px 16px rgba(0,0,0,0.3)",
          }}
        >
          {props.focus_symbol || "A • 3"}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              fontSize: isVertical ? 38 : 34,
              fontWeight: 800,
              color: "#FFFBEB",
            }}
          >
            {props.phonetic_word || "Let's Count Together!"}
          </span>
          <span
            style={{
              fontSize: isVertical ? 28 : 24,
              fontWeight: 700,
              color: "rgba(255,255,255,0.9)",
            }}
          >
            Count: {activeCount} / {targetCount} {props.item_label || "Items"}
          </span>
        </div>
      </div>

      {/* Counting Items Grid — Pops in 1-by-1 synced to voiceover timestamps */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          gap: isVertical ? 36 : 44,
          maxWidth: isVertical ? 920 : 1400,
        }}
      >
        {Array.from({ length: targetCount }).map((_, idx) => {
          const triggerMs = triggers[idx];
          const triggerFrame = Math.floor((triggerMs / 1000) * fps);
          const isVisible = currentMs >= triggerMs;

          const itemSpring = isVisible
            ? spring({
                frame: Math.max(0, frame - triggerFrame),
                fps,
                config: { damping: 9, stiffness: 200, mass: 0.7 },
              })
            : 0;

          const floatY = Math.sin((frame + idx * 14) / 10) * 8;

          return (
            <div
              key={idx}
              style={{
                width: isVertical ? 240 : 220,
                height: isVertical ? 270 : 240,
                borderRadius: 34,
                backgroundColor: isVisible
                  ? "rgba(30, 41, 59, 0.9)"
                  : "rgba(30, 41, 59, 0.35)",
                border: isVisible
                  ? `4px solid ${brandKit.accent_color || "#F59E0B"}`
                  : "3px dashed rgba(255,255,255,0.2)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                transform: `scale(${
                  isVisible ? itemSpring : 0.85
                }) translateY(${isVisible ? floatY : 0}px)`,
                boxShadow: isVisible
                  ? "0 20px 45px rgba(0, 0, 0, 0.4)"
                  : "none",
              }}
            >
              <div
                style={{
                  fontSize: isVertical ? 105 : 92,
                  opacity: isVisible ? 1 : 0.18,
                  filter: isVisible ? "none" : "grayscale(100%)",
                }}
              >
                {props.item_emoji || "🍎"}
              </div>
              <div
                style={{
                  marginTop: 14,
                  padding: "6px 24px",
                  borderRadius: 999,
                  backgroundColor: isVisible
                    ? brandKit.accent_color || "#F59E0B"
                    : "rgba(255,255,255,0.1)",
                  color: isVisible ? "#0F172A" : "rgba(255,255,255,0.4)",
                  fontSize: 32,
                  fontWeight: 900,
                }}
              >
                {idx + 1}
              </div>
            </div>
          );
        })}
      </div>

      {/* Confetti Celebration Banner on Completion */}
      {allComplete && props.confetti_on_complete && (
        <div
          style={{
            marginTop: isVertical ? 44 : 28,
            padding: "14px 36px",
            borderRadius: 999,
            background: "linear-gradient(90deg, #10B981, #3B82F6)",
            color: "#FFFFFF",
            fontSize: 32,
            fontWeight: 900,
            boxShadow: "0 12px 30px rgba(16, 185, 129, 0.45)",
            transform: `scale(${interpolate(
              currentMs - triggers[targetCount - 1],
              [0, 300],
              [0.7, 1],
              { extrapolateRight: "clamp" }
            )})`,
          }}
        >
          🎉 Awesome Job! {targetCount} {props.item_label || "Apples"}! ✨
        </div>
      )}
    </div>
  );
};
