import React from "react";
import { Composition } from "remotion";
import { AnimoraVideo } from "./compositions/AnimoraVideo";
import {
  AnimoraProjectPayload,
  DEFAULT_PROTOTYPE_PROJECT,
} from "./types/schema";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="AnimoraVideo"
        component={AnimoraVideo}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          project: DEFAULT_PROTOTYPE_PROJECT,
        }}
        calculateMetadata={({ props }) => {
          const proj: AnimoraProjectPayload =
            props.project || DEFAULT_PROTOTYPE_PROJECT;
          const isVertical = proj.aspect_ratio !== "16:9";
          const totalMs = (proj.scenes || []).reduce(
            (sum, s) => sum + (s.duration_ms || 5000),
            0
          );
          const durationInFrames = Math.max(
            60,
            Math.ceil((totalMs / 1000) * 30)
          );
          return {
            durationInFrames,
            fps: 30,
            width: isVertical ? 1080 : 1920,
            height: isVertical ? 1920 : 1080,
          };
        }}
      />
    </>
  );
};
