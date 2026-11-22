import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BrandKitConfig, StatCounterProps } from "../types/schema";

interface Props {
  props: StatCounterProps;
  durationMs: number;
  isVertical: boolean;
  brandKit: BrandKitConfig;
}

export const StatCounterScene: React.FC<Props> = ({
  props,
  isVertical,
  brandKit,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const countProgress = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 90 },
  });

  const targetNum = props.target_number || 87;
  const currentNum = Math.round(
    interpolate(countProgress, [0, 1], [0, targetNum])
  );

  const bars =
    props.bars && props.bars.length > 0
      ? props.bars
      : [
          { label: "Plain Text", value: 24, color_hex: "#64748B" },
          { label: "Static Slides", value: 45, color_hex: "#818CF8" },
          { label: "Animora Video", value: 87, color_hex: "#F59E0B" },
        ];

  const maxBarValue = Math.max(...bars.map((b) => b.value), 100);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: isVertical ? 260 : 170,
        paddingLeft: 64,
        paddingRight: 64,
      }}
    >
      {/* Big Animated Stat Counter Card */}
      <div
        style={{
          padding: isVertical ? "28px 56px" : "22px 48px",
          borderRadius: 36,
          backgroundColor: "rgba(15, 23, 42, 0.9)",
          border: `3px solid ${brandKit.accent_color || "#F59E0B"}`,
          boxShadow: "0 20px 55px rgba(245, 158, 11, 0.28)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginBottom: isVertical ? 48 : 34,
        }}
      >
        <div
          style={{
            fontSize: isVertical ? 116 : 92,
            fontWeight: 900,
            color: brandKit.accent_color || "#FBBF24",
            lineHeight: 1.05,
          }}
        >
          {props.number_prefix || ""}
          {currentNum}
          {props.number_suffix || "%"}
        </div>
        <div
          style={{
            fontSize: isVertical ? 32 : 28,
            fontWeight: 800,
            color: "#F8FAFC",
            marginTop: 8,
            textAlign: "center",
          }}
        >
          {props.takeaway_label || "Higher Engagement & Retention"}
        </div>
      </div>

      {/* Spring-Animated Bar Chart */}
      <div
        style={{
          width: "100%",
          maxWidth: isVertical ? 860 : 1100,
          height: isVertical ? 520 : 340,
          padding: "32px 40px",
          borderRadius: 32,
          backgroundColor: "rgba(15, 23, 42, 0.78)",
          border: "2px solid rgba(255,255,255,0.12)",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-around",
          gap: 32,
        }}
      >
        {bars.map((bar, idx) => {
          const barSpring = spring({
            frame: Math.max(0, frame - idx * 8),
            fps,
            config: { damping: 12, stiffness: 130 },
          });

          const heightPct = (bar.value / maxBarValue) * 100 * barSpring;
          const animatedVal = Math.round(bar.value * barSpring);

          return (
            <div
              key={idx}
              style={{
                flex: 1,
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
              }}
            >
              <span
                style={{
                  fontSize: isVertical ? 34 : 28,
                  fontWeight: 900,
                  color: "#FFFFFF",
                  marginBottom: 10,
                }}
              >
                {animatedVal}%
              </span>
              <div
                style={{
                  width: isVertical ? 140 : 160,
                  height: `${Math.max(10, heightPct * 0.72)}%`,
                  borderRadius: "22px 22px 10px 10px",
                  background: `linear-gradient(180deg, ${
                    bar.color_hex || "#F59E0B"
                  }, ${bar.color_hex || "#F59E0B"}99)`,
                  boxShadow: `0 12px 28px ${bar.color_hex || "#F59E0B"}44`,
                }}
              />
              <span
                style={{
                  marginTop: 14,
                  fontSize: isVertical ? 28 : 24,
                  fontWeight: 800,
                  color: "#CBD5E1",
                  textAlign: "center",
                }}
              >
                {bar.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
