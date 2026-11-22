"use client";

import React, { useState, useEffect } from "react";

const HERO_SCENES = [
  {
    id: "01",
    label: "PHOTON IMPACT",
    duration: "00:18",
    summary: "Light packets accelerate toward silicon wafer...",
    captionPrefix: "Photons strike the",
    highlight: "SILICON CELL",
    captionSuffix: "knocking electrons free into direct electrical current.",
    voltage: "38.4V • 8.92A",
  },
  {
    id: "02",
    label: "ELECTRON JUMP",
    duration: "00:24",
    summary: "Free electrons cross P-N depletion barrier...",
    captionPrefix: "Built-in electric field pushes",
    highlight: "FREE ELECTRONS",
    captionSuffix: "through the metal grid busbars toward the inverter.",
    voltage: "41.2V • 9.45A",
  },
  {
    id: "03",
    label: "INVERTER DC → AC",
    duration: "00:16",
    summary: "Microinverters modulate 60Hz home AC...",
    captionPrefix: "Your solar inverter converts DC into",
    highlight: "240V HOME AC",
    captionSuffix: "powering every appliance in your house cleanly.",
    voltage: "240V • 60Hz AC",
  },
];

export default function HeroStudioPreview() {
  const [activeSceneIdx, setActiveSceneIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(41);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          setActiveSceneIdx((idx) => (idx + 1) % HERO_SCENES.length);
          return 0;
        }
        return prev + 2;
      });
    }, 180);
    return () => clearInterval(timer);
  }, [isPlaying]);

  const activeScene = HERO_SCENES[activeSceneIdx];

  return (
    <div className="bg-[#121216] border border-[#27272A] rounded-2xl p-3 sm:p-4 shadow-[0_24px_80px_rgba(0,0,0,0.65)] relative overflow-hidden">
      {/* Top Studio Telemetry Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-[#27272A] text-[10px] font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#FF4F28] animate-pulse" />
          <span className="text-[#A1A1AA]">PROJECT:</span>
          <span className="text-white font-semibold">solar_energy_v3.reel</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[#A1A1AA] hidden sm:inline">00:58.4 • 9:16 • 60FPS</span>
          <span className="px-2 py-0.5 rounded bg-[#10B981]/15 border border-[#10B981]/30 text-[#9BFFCE] font-bold">
            PRO-RENDER READY
          </span>
        </div>
      </div>

      {/* Main 3-Pane Studio Mockup (Stacks cleanly on Mobile, 3-Column on sm+) */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        {/* Left Scene Stack (Hidden on tiny mobile, visible sm+) */}
        <div className="hidden sm:flex sm:col-span-3 flex-col gap-2">
          <div className="flex items-center justify-between text-[9px] font-mono text-[#71717A] uppercase px-1">
            <span>SCENE STACK</span>
            <span>{activeSceneIdx + 1}/3</span>
          </div>
          {HERO_SCENES.map((sc, idx) => {
            const active = idx === activeSceneIdx;
            return (
              <button
                key={sc.id}
                type="button"
                onClick={() => {
                  setActiveSceneIdx(idx);
                  setProgress(15);
                }}
                className={`p-2 rounded-lg border text-left transition-all ${
                  active
                    ? "bg-[#1C1C22] border-[#FF4F28] shadow-[0_0_16px_rgba(255,79,40,0.15)]"
                    : "bg-[#09090B] border-[#27272A] hover:border-[#3F3F46]"
                }`}
              >
                <div className="flex items-center justify-between text-[9px] font-mono">
                  <span className={active ? "text-[#FF4F28] font-bold" : "text-[#71717A]"}>
                    #{sc.id}
                  </span>
                  <span className="text-[#71717A]">{sc.duration}</span>
                </div>
                <div className="text-[10px] font-display font-bold text-white mt-0.5 truncate">
                  {sc.label}
                </div>
                <p className="text-[9px] text-[#71717A] line-clamp-2 mt-0.5 leading-snug">
                  {sc.summary}
                </p>
              </button>
            );
          })}
        </div>

        {/* Center 9:16 Live Vector Stage */}
        <div className="sm:col-span-6 bg-[#09090B] border border-[#27272A] rounded-xl p-3 flex flex-col justify-between min-h-[290px] relative overflow-hidden">
          <div className="flex items-center justify-between text-[9px] font-mono text-[#A1A1AA]">
            <span className="text-[#F59E0B] font-bold">SOLAR CELL PHYSICS</span>
            <span>@solarexplained</span>
          </div>

          {/* Animated SVG Photovoltaic Schematic */}
          <div className="my-3 space-y-2 relative">
            {/* Photon Rays */}
            <div className="flex justify-around items-center px-3">
              {[0, 1, 2, 3].map((ray) => (
                <div key={ray} className="flex flex-col items-center">
                  <div className="w-0.5 h-6 bg-gradient-to-b from-[#F59E0B] to-[#FF4F28] rotate-12 opacity-85" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] shadow-[0_0_8px_#F59E0B]" />
                </div>
              ))}
            </div>

            {/* Silicon Layers */}
            <div className="rounded-lg bg-[#121216] border border-[#38BDF8]/30 p-2 flex items-center justify-between">
              <span className="text-[10px] font-mono text-[#7DD3FC] font-semibold">
                N-TYPE SILICON (e-)
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#38BDF8]/15 text-[#7DD3FC]">
                {activeScene.voltage}
              </span>
            </div>

            <div className="rounded bg-[#FF4F28]/15 border border-[#FF4F28]/40 px-2 py-1 text-center text-[9px] font-mono text-[#FFB4A4] font-bold tracking-wider">
              ⚡ P-N JUNCTION DEPLETION BARRIER
            </div>

            <div className="rounded-lg bg-[#121216] border border-[#10B981]/30 p-2 flex items-center justify-between">
              <span className="text-[10px] font-mono text-[#9BFFCE] font-semibold">
                P-TYPE SILICON (+h)
              </span>
              <span className="text-[9px] font-mono text-[#10B981]">60.0 FPS LIVE</span>
            </div>
          </div>

          {/* Karaoke Word-Synced Caption Box */}
          <div className="bg-[#121216]/95 border border-[#27272A] rounded-lg p-2.5 text-center">
            <p className="text-[11px] leading-relaxed text-[#E4E4E7] font-medium">
              {activeScene.captionPrefix}{" "}
              <span className="px-1.5 py-0.5 rounded bg-[#FF4F28] text-[#09090B] font-display font-bold tracking-tight">
                {activeScene.highlight}
              </span>{" "}
              {activeScene.captionSuffix}
            </p>
          </div>

          {/* Mini Scrubber Bar */}
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPlaying((p) => !p)}
              aria-label={isPlaying ? "Pause preview" : "Play preview"}
              className="w-6 h-6 rounded-full bg-[#FF4F28] text-[#09090B] flex items-center justify-center flex-shrink-0 hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined text-sm font-bold">
                {isPlaying ? "pause" : "play_arrow"}
              </span>
            </button>
            <div className="flex-1 h-1.5 bg-[#27272A] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#FF4F28] rounded-full transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[9px] font-mono text-[#A1A1AA]">00:24 / 00:58</span>
          </div>
        </div>

        {/* Right Render Engine Specs (Hidden on tiny mobile, visible sm+) */}
        <div className="hidden sm:flex sm:col-span-3 flex-col justify-between gap-2 bg-[#09090B] border border-[#27272A] rounded-xl p-2.5 text-[10px]">
          <div className="space-y-2.5">
            <div className="text-[9px] font-mono text-[#71717A] uppercase tracking-wider">
              RENDER ENGINE
            </div>
            <div>
              <div className="text-[9px] font-mono text-[#71717A]">ANIMATION ENGINE</div>
              <div className="font-display font-bold text-white mt-0.5">Flowchart &amp; Diagram</div>
            </div>
            <div>
              <div className="text-[9px] font-mono text-[#71717A]">NEURAL NARRATOR</div>
              <div className="font-medium text-[#E4E4E7] mt-0.5">Christopher (Edge TTS)</div>
            </div>
            <div>
              <div className="text-[9px] font-mono text-[#71717A]">KARAOKE CAPTION</div>
              <div className="font-medium text-[#F59E0B] mt-0.5">Kinetic Vermilion Glow</div>
            </div>
            <div>
              <div className="text-[9px] font-mono text-[#71717A]">DIRECT SCHEDULER</div>
              <div className="font-mono text-[#10B981] mt-0.5 truncate">@solarexplained</div>
            </div>
          </div>

          <div className="pt-2 border-t border-[#27272A]">
            <div className="w-full py-1.5 rounded bg-[#18181D] border border-[#27272A] text-center font-mono text-[9px] text-[#E4E4E7]">
              60FPS Remotion SVG
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Multi-Track Timeline Strip */}
      <div className="mt-3 pt-2.5 border-t border-[#27272A] space-y-1.5">
        <div className="flex items-center justify-between text-[9px] font-mono text-[#71717A]">
          <span>MULTI-TRACK RENDER TIMELINE</span>
          <span className="text-[#F59E0B]">LIVE TIME: 00:24.200 / 00:58.400</span>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {HERO_SCENES.map((sc, idx) => (
            <button
              key={sc.id}
              type="button"
              onClick={() => {
                setActiveSceneIdx(idx);
                setProgress(20);
              }}
              className={`h-5 rounded px-2 text-[9px] font-mono truncate text-left transition-all ${
                idx === activeSceneIdx
                  ? "bg-[#FF4F28] text-[#09090B] font-bold"
                  : "bg-[#18181D] text-[#A1A1AA] hover:text-white"
              }`}
            >
              #{sc.id} {sc.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
