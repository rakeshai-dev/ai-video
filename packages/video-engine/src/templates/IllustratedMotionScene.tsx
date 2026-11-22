import React from "react";
import { Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BrandKitConfig, IllustratedMotionProps } from "../types/schema";

interface Props {
  props: IllustratedMotionProps;
  imageUrl?: string;
  headline: string;
  durationMs: number;
  isVertical: boolean;
  brandKit: BrandKitConfig;
}

export const IllustratedMotionScene: React.FC<Props> = ({
  props,
  imageUrl,
  headline,
  durationMs,
  isVertical,
  brandKit,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const totalFrames = Math.max(30, Math.ceil((durationMs / 1000) * fps));

  // Ken Burns 60fps camera motion
  const zoomScale =
    props.camera_motion === "zoom_out"
      ? interpolate(frame, [0, totalFrames], [1.14, 1.0], {
          extrapolateRight: "clamp",
        })
      : interpolate(frame, [0, totalFrames], [1.0, 1.14], {
          extrapolateRight: "clamp",
        });

  const panX =
    props.camera_motion === "pan_left"
      ? interpolate(frame, [0, totalFrames], [24, -24], {
          extrapolateRight: "clamp",
        })
      : props.camera_motion === "pan_right"
      ? interpolate(frame, [0, totalFrames], [-24, 24], {
          extrapolateRight: "clamp",
        })
      : 0;

  const badgeSpring = spring({
    frame: Math.max(0, frame - 8),
    fps,
    config: { damping: 12, stiffness: 170 },
  });

  const orbitAngle = (frame / fps) * 45;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: isVertical ? 270 : 175,
        paddingLeft: 64,
        paddingRight: 64,
      }}
    >
      {/* Framed Animated Visual Stage */}
      <div
        style={{
          width: isVertical ? 880 : 1140,
          height: isVertical ? 960 : 580,
          borderRadius: 42,
          overflow: "hidden",
          position: "relative",
          border: `4px solid ${brandKit.primary_color || "#6366F1"}88`,
          boxShadow: "0 30px 80px rgba(0, 0, 0, 0.55)",
          background:
            "radial-gradient(circle at 50% 35%, #1E1B4B 0%, #0F172A 75%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            transform: `scale(${zoomScale}) translateX(${panX}px)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          {imageUrl ? (
            <Img
              src={imageUrl}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            /* Built-in Animated Vector Explainer Stage */
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              {/* Animated SVG Orbit Rings */}
              <svg
                width={isVertical ? 680 : 520}
                height={isVertical ? 680 : 520}
                viewBox="0 0 400 400"
                style={{
                  position: "absolute",
                  transform: `rotate(${orbitAngle}deg)`,
                  opacity: 0.45,
                }}
              >
                <circle
                  cx="200"
                  cy="200"
                  r="165"
                  fill="none"
                  stroke={brandKit.primary_color || "#6366F1"}
                  strokeWidth="3"
                  strokeDasharray="16 12"
                />
                <circle
                  cx="200"
                  cy="200"
                  r="120"
                  fill="none"
                  stroke={brandKit.accent_color || "#F59E0B"}
                  strokeWidth="3"
                  strokeDasharray="10 14"
                />
                <circle
                  cx="200"
                  cy="35"
                  r="10"
                  fill={brandKit.accent_color || "#F59E0B"}
                />
                <circle
                  cx="320"
                  cy="200"
                  r="8"
                  fill={brandKit.primary_color || "#6366F1"}
                />
              </svg>

              {/* Center Animated Hero Icon Cluster */}
              <div
                style={{
                  width: isVertical ? 230 : 190,
                  height: isVertical ? 230 : 190,
                  borderRadius: 56,
                  background: `linear-gradient(135deg, ${
                    brandKit.primary_color || "#6366F1"
                  }, ${brandKit.accent_color || "#F59E0B"})`,
                  boxShadow: "0 24px 60px rgba(99, 102, 241, 0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: isVertical ? 110 : 88,
                  zIndex: 2,
                }}
              >
                🎬
              </div>

              <div
                style={{
                  marginTop: 36,
                  fontSize: isVertical ? 42 : 36,
                  fontWeight: 900,
                  color: "#FFFFFF",
                  textAlign: "center",
                  maxWidth: "82%",
                  zIndex: 2,
                  textShadow: "0 6px 20px rgba(0,0,0,0.6)",
                }}
              >
                {headline}
              </div>
            </div>
          )}
        </div>

        {/* Floating Glassmorphic Keyword Callout Pill */}
        {props.callout_badge && (
          <div
            style={{
              position: "absolute",
              bottom: 36,
              padding: "16px 36px",
              borderRadius: 999,
              backgroundColor: "rgba(15, 23, 42, 0.88)",
              border: `3px solid ${brandKit.accent_color || "#F59E0B"}`,
              color: "#FFFFFF",
              fontSize: isVertical ? 34 : 30,
              fontWeight: 900,
              boxShadow: "0 16px 36px rgba(0, 0, 0, 0.55)",
              transform: `scale(${badgeSpring})`,
            }}
          >
            {props.callout_badge}
          </div>
        )}
      </div>
    </div>
  );
};
