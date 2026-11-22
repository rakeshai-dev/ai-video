import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BrandKitConfig, DiagramFlowProps } from "../types/schema";

interface Props {
  props: DiagramFlowProps;
  durationMs: number;
  isVertical: boolean;
  brandKit: BrandKitConfig;
}

export const DiagramFlowScene: React.FC<Props> = ({
  props,
  durationMs,
  isVertical,
  brandKit,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentMs = (frame / fps) * 1000;

  const nodes =
    props.nodes && props.nodes.length > 0
      ? props.nodes
      : [
          { id: "1", title: "Step 1", subtitle: "Input idea", icon: "💡" },
          { id: "2", title: "Step 2", subtitle: "AI Storyboard", icon: "🎬" },
          { id: "3", title: "Step 3", subtitle: "Auto Publish", icon: "🚀" },
        ];

  const stepIntervalMs = (durationMs * 0.82) / Math.max(1, nodes.length);
  const activeStepIndex = Math.min(
    nodes.length - 1,
    Math.floor(currentMs / stepIntervalMs)
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
        paddingTop: isVertical ? 230 : 120,
        paddingBottom: isVertical ? 320 : 140,
        paddingLeft: isVertical ? 64 : 80,
        paddingRight: isVertical ? 64 : 80,
        gap: isVertical ? 18 : 24,
      }}
    >
      {nodes.map((node, idx) => {
        const revealMs = idx * stepIntervalMs * 0.85;
        const revealFrame = Math.floor((revealMs / 1000) * fps);
        const isRevealed = currentMs >= revealMs;
        const isCurrentActive = idx === activeStepIndex;

        const entrance = isRevealed
          ? spring({
              frame: Math.max(0, frame - revealFrame),
              fps,
              config: { damping: 12, stiffness: 170 },
            })
          : 0;

        const activePulse = isCurrentActive
          ? 1 + Math.sin(frame / 5) * 0.025
          : 1;

        return (
          <React.Fragment key={node.id || idx}>
            {/* Flowchart Node Card */}
            <div
              style={{
                width: isVertical ? "100%" : 360,
                maxWidth: isVertical ? 880 : 380,
                padding: isVertical ? "24px 32px" : "28px 24px",
                borderRadius: 28,
                backgroundColor: isCurrentActive
                  ? "rgba(30, 41, 59, 0.96)"
                  : "rgba(15, 23, 42, 0.85)",
                border: isCurrentActive
                  ? `4px solid ${brandKit.accent_color || "#F59E0B"}`
                  : `2px solid ${brandKit.primary_color || "#6366F1"}66`,
                boxShadow: isCurrentActive
                  ? `0 18px 48px ${brandKit.accent_color || "#F59E0B"}44`
                  : "0 12px 30px rgba(0, 0, 0, 0.35)",
                display: "flex",
                flexDirection: isVertical ? "row" : "column",
                alignItems: "center",
                gap: isVertical ? 26 : 16,
                opacity: isRevealed ? entrance : 0.18,
                transform: `scale(${
                  (isRevealed ? 0.88 + 0.12 * entrance : 0.88) * activePulse
                })`,
              }}
            >
              <div
                style={{
                  width: isVertical ? 88 : 82,
                  height: isVertical ? 88 : 82,
                  borderRadius: 24,
                  background: isCurrentActive
                    ? `linear-gradient(135deg, ${
                        brandKit.accent_color || "#F59E0B"
                      }, ${brandKit.primary_color || "#6366F1"})`
                    : "rgba(99, 102, 241, 0.22)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: isVertical ? 46 : 42,
                  flexShrink: 0,
                }}
              >
                {node.icon || "⚡"}
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  textAlign: isVertical ? "left" : "center",
                }}
              >
                <span
                  style={{
                    fontSize: isVertical ? 36 : 30,
                    fontWeight: 900,
                    color: "#FFFFFF",
                  }}
                >
                  {node.title}
                </span>
                <span
                  style={{
                    fontSize: isVertical ? 26 : 22,
                    fontWeight: 600,
                    color: "#CBD5E1",
                    marginTop: 4,
                  }}
                >
                  {node.subtitle}
                </span>
              </div>
            </div>

            {/* Animated Arrow Connector between Flowchart Nodes */}
            {idx < nodes.length - 1 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: currentMs >= (idx + 0.6) * stepIntervalMs ? 1 : 0.25,
                  transform: `scale(${
                    currentMs >= (idx + 0.6) * stepIntervalMs ? 1.1 : 0.85
                  })`,
                  color: brandKit.accent_color || "#F59E0B",
                  fontSize: isVertical ? 38 : 42,
                  fontWeight: 900,
                }}
              >
                {isVertical ? "⬇" : "➔"}
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
