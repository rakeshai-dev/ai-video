import React from "react";
import {
  AbsoluteFill,
  Audio,
  Series,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SubtitleOverlay } from "../subtitles/SubtitleOverlay";
import { DiagramFlowScene } from "../templates/DiagramFlowScene";
import { IllustratedMotionScene } from "../templates/IllustratedMotionScene";
import { KidsCountingScene } from "../templates/KidsCountingScene";
import { SplitComparisonScene } from "../templates/SplitComparisonScene";
import { StatCounterScene } from "../templates/StatCounterScene";
import {
  AnimoraProjectPayload,
  DiagramFlowProps,
  IllustratedMotionProps,
  KidsCountingProps,
  SceneData,
  SplitComparisonProps,
  StatCounterProps,
} from "../types/schema";

const SingleSceneView: React.FC<{
  scene: SceneData;
  sceneIndex: number;
  totalScenes: number;
  project: AnimoraProjectPayload;
}> = ({ scene, sceneIndex, totalScenes, project }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const isVertical = height > width;

  const headerSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 160 },
  });

  const audioSrc = scene.voiceover_url
    ? scene.voiceover_url.startsWith("http") ||
      scene.voiceover_url.startsWith("/")
      ? scene.voiceover_url
      : staticFile(scene.voiceover_url)
    : undefined;

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at 50% 15%, #1E1B4B 0%, #090D16 70%, #050811 100%)",
        fontFamily: project.brand_kit.font_family || "Inter, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Voiceover Audio Track */}
      {audioSrc && <Audio src={audioSrc} />}

      {/* Subtle Ambient Background Grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(rgba(99, 102, 241, 0.14) 1.5px, transparent 1.5px)",
          backgroundSize: "38px 38px",
          opacity: 0.65,
        }}
      />

      {/* Top Header Zone: Scene Progress & Headline */}
      <div
        style={{
          position: "absolute",
          top: isVertical ? 82 : 36,
          left: isVertical ? 64 : 80,
          right: isVertical ? 64 : 80,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          transform: `translateY(${(1 - headerSpring) * -28}px)`,
          opacity: headerSpring,
          zIndex: 30,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 14,
          }}
        >
          <span
            style={{
              padding: "6px 20px",
              borderRadius: 999,
              backgroundColor: project.brand_kit.primary_color || "#6366F1",
              color: "#FFFFFF",
              fontSize: isVertical ? 22 : 20,
              fontWeight: 800,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Scene {sceneIndex + 1} of {totalScenes} •{" "}
            {scene.scene_type.replace("_", " ")}
          </span>
        </div>

        <div
          style={{
            fontSize: isVertical ? 46 : 40,
            fontWeight: 900,
            color: "#FFFFFF",
            textAlign: "center",
            lineHeight: 1.18,
            textShadow: "0 4px 18px rgba(0, 0, 0, 0.5)",
          }}
        >
          {scene.on_screen_headline}
        </div>
      </div>

      {/* Main Dynamic Animation Stage (5 Templates) */}
      <AbsoluteFill style={{ zIndex: 10 }}>
        {scene.scene_type === "kids_counting" && (
          <KidsCountingScene
            props={scene.animation_props as KidsCountingProps}
            wordTimestamps={scene.word_timestamps}
            durationMs={scene.duration_ms}
            isVertical={isVertical}
            brandKit={project.brand_kit}
          />
        )}

        {scene.scene_type === "diagram_flow" && (
          <DiagramFlowScene
            props={scene.animation_props as DiagramFlowProps}
            durationMs={scene.duration_ms}
            isVertical={isVertical}
            brandKit={project.brand_kit}
          />
        )}

        {scene.scene_type === "split_comparison" && (
          <SplitComparisonScene
            props={scene.animation_props as SplitComparisonProps}
            durationMs={scene.duration_ms}
            isVertical={isVertical}
            brandKit={project.brand_kit}
          />
        )}

        {scene.scene_type === "stat_counter" && (
          <StatCounterScene
            props={scene.animation_props as StatCounterProps}
            durationMs={scene.duration_ms}
            isVertical={isVertical}
            brandKit={project.brand_kit}
          />
        )}

        {scene.scene_type === "illustrated_motion" && (
          <IllustratedMotionScene
            props={scene.animation_props as IllustratedMotionProps}
            imageUrl={scene.image_url}
            headline={scene.on_screen_headline}
            durationMs={scene.duration_ms}
            isVertical={isVertical}
            brandKit={project.brand_kit}
          />
        )}
      </AbsoluteFill>

      {/* Word-by-Word Synced Animated Subtitles */}
      <SubtitleOverlay
        wordTimestamps={scene.word_timestamps}
        captionConfig={project.caption_config}
        isVertical={isVertical}
      />

      {/* Bottom Brand Kit Watermark Pill */}
      <div
        style={{
          position: "absolute",
          bottom: isVertical ? 48 : 26,
          right: isVertical ? 56 : 64,
          padding: "8px 20px",
          borderRadius: 999,
          backgroundColor: "rgba(15, 23, 42, 0.72)",
          border: "1px solid rgba(255,255,255,0.16)",
          color: "#94A3B8",
          fontSize: 20,
          fontWeight: 700,
          zIndex: 40,
        }}
      >
        ⚡ {project.brand_kit.brand_name || "Animora Studio"}
      </div>
    </AbsoluteFill>
  );
};

export const AnimoraVideo: React.FC<{ project: AnimoraProjectPayload }> = ({
  project,
}) => {
  const { fps } = useVideoConfig();
  const scenes = project.scenes || [];

  return (
    <AbsoluteFill>
      <Series>
        {scenes.map((scene, index) => {
          const durationInFrames = Math.max(
            30,
            Math.ceil((scene.duration_ms / 1000) * fps)
          );
          return (
            <Series.Sequence
              key={scene.scene_id || index}
              durationInFrames={durationInFrames}
            >
              <SingleSceneView
                scene={scene}
                sceneIndex={index}
                totalScenes={scenes.length}
                project={project}
              />
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};
