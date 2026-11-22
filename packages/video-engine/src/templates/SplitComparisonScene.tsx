import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BrandKitConfig, SplitComparisonProps } from "../types/schema";

interface Props {
  props: SplitComparisonProps;
  durationMs: number;
  isVertical: boolean;
  brandKit: BrandKitConfig;
}

export const SplitComparisonScene: React.FC<Props> = ({
  props,
  durationMs,
  isVertical,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentMs = (frame / fps) * 1000;

  const leftCard = props.left_or_top_card || {
    badge_text: "✗ MYTH",
    title: "Manual Video Editing",
    points: ["Takes 4+ hours", "Multiple subscriptions"],
    color_hex: "#EF4444",
  };

  const rightCard = props.right_or_bottom_card || {
    badge_text: "✓ FACT",
    title: "Animora Automated Pipeline",
    points: ["Done in 3 minutes", "All-in-one dashboard"],
    color_hex: "#10B981",
  };

  const firstCardSpring = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 160 },
  });

  const secondRevealFrame = Math.floor(((durationMs * 0.36) / 1000) * fps);
  const showSecond = currentMs >= durationMs * 0.36;
  const secondCardSpring = showSecond
    ? spring({
        frame: Math.max(0, frame - secondRevealFrame),
        fps,
        config: { damping: 12, stiffness: 170 },
      })
    : 0;

  const renderCard = (
    card: typeof leftCard,
    animProgress: number,
    isHighlighted: boolean
  ) => (
    <div
      style={{
        flex: 1,
        width: isVertical ? "100%" : "48%",
        maxWidth: isVertical ? 880 : 760,
        padding: isVertical ? "32px 38px" : "36px 40px",
        borderRadius: 32,
        backgroundColor: "rgba(15, 23, 42, 0.9)",
        border: `4px solid ${card.color_hex || "#10B981"}`,
        boxShadow: isHighlighted
          ? `0 24px 60px ${card.color_hex}44`
          : "0 16px 38px rgba(0,0,0,0.45)",
        transform: `scale(${0.86 + 0.14 * animProgress})`,
        opacity: Math.max(0.18, animProgress),
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      <div
        style={{
          alignSelf: "flex-start",
          padding: "8px 22px",
          borderRadius: 999,
          backgroundColor: card.color_hex || "#10B981",
          color: "#FFFFFF",
          fontSize: isVertical ? 26 : 24,
          fontWeight: 900,
          letterSpacing: "0.04em",
        }}
      >
        {card.badge_text}
      </div>
      <div
        style={{
          fontSize: isVertical ? 42 : 38,
          fontWeight: 900,
          color: "#FFFFFF",
        }}
      >
        {card.title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {(card.points || []).map((pt, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontSize: isVertical ? 30 : 26,
              fontWeight: 700,
              color: "#E2E8F0",
            }}
          >
            <span style={{ color: card.color_hex, fontSize: 32 }}>●</span>
            <span>{pt}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: isVertical ? "column" : "row",
        alignItems: "center",
        justifyContent: "center",
        paddingTop: isVertical ? 250 : 160,
        paddingBottom: isVertical ? 340 : 170,
        paddingLeft: 64,
        paddingRight: 64,
        gap: isVertical ? 32 : 40,
      }}
    >
      {renderCard(leftCard, firstCardSpring, !showSecond)}
      {renderCard(rightCard, secondCardSpring, showSecond)}
    </div>
  );
};
