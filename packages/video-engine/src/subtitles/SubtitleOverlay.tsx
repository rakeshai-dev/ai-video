import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CaptionConfig, WordTimestamp } from "../types/schema";

interface SubtitleOverlayProps {
  wordTimestamps: WordTimestamp[];
  captionConfig: CaptionConfig;
  isVertical: boolean;
}

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({
  wordTimestamps,
  captionConfig,
  isVertical,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!captionConfig.enabled || !wordTimestamps || wordTimestamps.length === 0) {
    return null;
  }

  const currentMs = (frame / fps) * 1000;
  const wordsPerChunk = isVertical ? 4 : 6;

  // Group words into readable chunks
  const chunks: WordTimestamp[][] = [];
  for (let i = 0; i < wordTimestamps.length; i += wordsPerChunk) {
    chunks.push(wordTimestamps.slice(i, i + wordsPerChunk));
  }

  // Find currently active chunk
  let activeChunk = chunks.find((chunk) => {
    const start = chunk[0].start_ms - 80;
    const end = chunk[chunk.length - 1].end_ms + 220;
    return currentMs >= start && currentMs <= end;
  });

  if (!activeChunk && currentMs < wordTimestamps[0].start_ms) {
    activeChunk = chunks[0];
  }

  if (!activeChunk) return null;

  const positionTop =
    captionConfig.position === "top"
      ? isVertical
        ? 290
        : 150
      : captionConfig.position === "middle"
      ? isVertical
        ? 980
        : 540
      : isVertical
      ? 1480
      : 890;

  const style = captionConfig.style || "karaoke_highlight";

  return (
    <div
      style={{
        position: "absolute",
        top: positionTop,
        left: isVertical ? 64 : 160,
        right: isVertical ? 64 : 160,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 50,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          gap: isVertical ? 16 : 18,
          padding:
            style === "clean_minimal" ? "16px 32px" : "18px 34px",
          borderRadius: 28,
          backgroundColor:
            style === "clean_minimal"
              ? "rgba(15, 23, 42, 0.88)"
              : "rgba(15, 23, 42, 0.72)",
          backdropFilter: "blur(12px)",
          border: "2px solid rgba(255, 255, 255, 0.14)",
          boxShadow: "0 18px 42px rgba(0, 0, 0, 0.45)",
        }}
      >
        {activeChunk.map((w, idx) => {
          const isSpokenNow =
            currentMs >= w.start_ms - 40 && currentMs <= w.end_ms + 90;
          const isPast = currentMs > w.end_ms + 90;

          const wordStartFrame = Math.max(0, Math.floor((w.start_ms / 1000) * fps));
          const popProgress = isSpokenNow
            ? spring({
                frame: Math.max(0, frame - wordStartFrame),
                fps,
                config: { damping: 11, stiffness: 240, mass: 0.6 },
              })
            : 0;

          const scale = isSpokenNow ? 1 + 0.14 * popProgress : 1;

          return (
            <span
              key={`${w.word}-${idx}`}
              style={{
                position: "relative",
                display: "inline-flex",
                flexDirection: "column",
                alignItems: "center",
                transform: `scale(${scale})`,
                transition: "color 0.08s ease",
                fontFamily:
                  style === "kids_read_along"
                    ? "'Comic Sans MS', 'Trebuchet MS', sans-serif"
                    : captionConfig.font_family || "Inter, sans-serif",
                fontSize: isVertical ? 48 : 42,
                fontWeight: 900,
                textTransform: style === "hormozi_pop" ? "uppercase" : "none",
                letterSpacing: style === "hormozi_pop" ? "0.03em" : "0em",
                padding:
                  style === "hormozi_pop" && isSpokenNow
                    ? "4px 16px"
                    : "2px 6px",
                borderRadius: 14,
                backgroundColor:
                  style === "hormozi_pop" && isSpokenNow
                    ? captionConfig.highlight_color || "#F59E0B"
                    : "transparent",
                color:
                  style === "hormozi_pop" && isSpokenNow
                    ? "#0F172A"
                    : isSpokenNow
                    ? captionConfig.highlight_color || "#FBBF24"
                    : isPast
                    ? "#E2E8F0"
                    : captionConfig.text_color || "#FFFFFF",
                textShadow:
                  style === "hormozi_pop" && isSpokenNow
                    ? "none"
                    : "0 4px 14px rgba(0, 0, 0, 0.75)",
              }}
            >
              {style === "kids_read_along" && isSpokenNow && (
                <span
                  style={{
                    position: "absolute",
                    top: -36,
                    fontSize: 28,
                    transform: `translateY(${-6 * popProgress}px)`,
                  }}
                >
                  ⭐
                </span>
              )}
              {w.word}
            </span>
          );
        })}
      </div>
    </div>
  );
};
