"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import StudioCanvasPlayer from "@/components/StudioCanvasPlayer";
import type {
  SceneData,
  SceneType,
  SubtitleStyle,
  VideoProjectDetail,
  WordTimestamp,
} from "@/lib/projects";
import type { VoicePersona } from "@/lib/ai-generator";

interface StoryboardStudioClientProps {
  initialProject: VideoProjectDetail;
  userHandle: string;
  voices: VoicePersona[];
  elevenlabsConfigured: boolean;
}

type InspectorTab = "script" | "props" | "captions";
type MobileTab = "canvas" | "scenes" | "inspector" | "timeline";

const SCENE_TEMPLATES: Array<{
  id: SceneType;
  label: string;
  shortLabel: string;
  icon: string;
}> = [
  { id: "diagram_flow", label: "Diagram Flow", shortLabel: "FLOW", icon: "account_tree" },
  { id: "kids_counting", label: "Kids Counting", shortLabel: "KIDS", icon: "child_care" },
  { id: "split_comparison", label: "Myth vs. Fact", shortLabel: "SPLIT", icon: "compare_arrows" },
  { id: "stat_counter", label: "Stat Counter", shortLabel: "STAT", icon: "bar_chart" },
  { id: "illustrated_motion", label: "Illustrated Motion", shortLabel: "MOTION", icon: "animation" },
];

const SUBTITLE_STYLES: Array<{
  id: SubtitleStyle;
  label: string;
  description: string;
  previewBadge: string;
}> = [
  {
    id: "karaoke_highlight",
    label: "Karaoke Pill",
    description: "Glass dark pill with active word highlighted in Electric Vermilion.",
    previewBadge: "ACTIVE WORD",
  },
  {
    id: "hormozi_pop",
    label: "Hormozi Pop",
    description: "High-retention 4-word uppercase chunks with Solar Amber pop scale.",
    previewBadge: "VIRAL REELS",
  },
  {
    id: "kids_read_along",
    label: "Kids Read-Along",
    description: "Warm cream storybook card with bouncy Signal Jade word highlight.",
    previewBadge: "EARLY READER",
  },
  {
    id: "clean_minimal",
    label: "Clean Editorial",
    description: "Subtle documentary caption bar with crisp underline accent.",
    previewBadge: "DOCUMENTARY",
  },
];

const BGM_TRACKS = [
  { id: "cyber_pulse", label: "Cyber Synth Pulse (-18dB Ducked)" },
  { id: "playful_marimba", label: "Playful Kids Marimba (-18dB Ducked)" },
  { id: "lofi_focus", label: "Clean Lo-Fi Study Beat (-18dB Ducked)" },
  { id: "doc_ambient", label: "Deep Documentary Pad (-20dB Ducked)" },
  { id: "muted", label: "No Background Music (Voiceover Only)" },
];

function estimateWordTimestampsClient(text: string, durationMs: number): WordTimestamp[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const activeDuration = Math.max(1000, durationMs - 350);
  const totalChars = words.reduce((acc, w) => acc + w.length + 1, 0);
  let cursor = 120;
  return words.map((word) => {
    const share = (word.length + 1) / totalChars;
    const wordDur = Math.max(180, Math.round(share * activeDuration));
    const item: WordTimestamp = {
      word,
      start_ms: cursor,
      end_ms: cursor + wordDur,
    };
    cursor += wordDur;
    return item;
  });
}

function createClientDefaultProps(
  sceneType: SceneType,
  headline: string
): Record<string, unknown> {
  switch (sceneType) {
    case "kids_counting":
      return {
        mode: "counting",
        focus_symbol: "A • 5",
        phonetic_word: headline,
        target_count: 5,
        item_label: "Apples",
        item_emoji: "🍎",
        theme_palette: "playful",
        confetti_on_complete: true,
      };
    case "split_comparison":
      return {
        left_or_top_card: {
          badge_text: "✗ COMMON MYTH",
          title: "Outdated Assumption",
          points: ["High energy loss", "Fails under load"],
          color_hex: "#EF4444",
        },
        right_or_bottom_card: {
          badge_text: "✓ VERIFIED FACT",
          title: "Measured Reality",
          points: ["High efficiency", "Proven in field tests"],
          color_hex: "#10B981",
        },
      };
    case "stat_counter":
      return {
        display_mode: "bar_chart",
        target_number: 87,
        number_prefix: "+",
        number_suffix: "%",
        takeaway_label: headline,
        bars: [
          { label: "Baseline", value: 32, color_hex: "#64748B" },
          { label: "Standard", value: 54, color_hex: "#F59E0B" },
          { label: "Optimized", value: 87, color_hex: "#10B981" },
        ],
      };
    case "illustrated_motion":
      return {
        art_style: "dark_tech",
        camera_motion: "zoom_in",
        callout_badge: `✨ ${headline.slice(0, 28)}`,
      };
    case "diagram_flow":
    default:
      return {
        flow_direction: "auto",
        nodes: [
          { id: "n1", title: "1. Input Signal", subtitle: "Primary source", icon: "☀️" },
          { id: "n2", title: "2. Core Process", subtitle: "Active conversion", icon: "⚡" },
          { id: "n3", title: "3. Final Output", subtitle: "Delivered result", icon: "🚀" },
        ],
      };
  }
}

export default function StoryboardStudioClient({
  initialProject,
  userHandle,
  voices,
  elevenlabsConfigured,
}: StoryboardStudioClientProps) {
  const [project, setProject] = useState<VideoProjectDetail>(initialProject);
  const [scenes, setScenes] = useState<SceneData[]>(initialProject.scenes);
  const [selectedSceneIndex, setSelectedSceneIndex] = useState<number>(0);

  // Playback & viewport states
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [loop, setLoop] = useState<boolean>(true);
  const [showSafeZones, setShowSafeZones] = useState<boolean>(false);

  // Layout & inspector states
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("script");
  const [mobileTab, setMobileTab] = useState<MobileTab>("canvas");
  const [bgmTrack, setBgmTrack] = useState<string>("cyber_pulse");
  const [titleDraft, setTitleDraft] = useState<string>(initialProject.title);

  // Persistence & feedback states
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [statusMessage, setStatusMessage] = useState<string>("All changes saved");
  const [syncingVoices, setSyncingVoices] = useState<boolean>(false);
  const [addingScene, setAddingScene] = useState<boolean>(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [speakingSceneId, setSpeakingSceneId] = useState<string | null>(null);

  const sceneSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timelineBarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      if (sceneSaveTimerRef.current) clearTimeout(sceneSaveTimerRef.current);
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const activeScene = scenes[selectedSceneIndex] || scenes[0] || null;

  const sceneOffsets = useMemo(() => {
    let cursor = 0;
    return scenes.map((sc, idx) => {
      const startMs = cursor;
      const dur = Math.max(1000, sc.duration_ms || 5000);
      cursor += dur;
      return { index: idx, scene: sc, startMs, endMs: cursor, durationMs: dur };
    });
  }, [scenes]);

  const totalDurationMs = useMemo(
    () => (sceneOffsets.length > 0 ? sceneOffsets[sceneOffsets.length - 1].endMs : 5000),
    [sceneOffsets]
  );

  const handleTimeChange = useCallback((nextTimeMs: number, autoPaused?: boolean) => {
    setCurrentTimeMs(nextTimeMs);
    if (autoPaused) {
      setIsPlaying(false);
    }
  }, []);

  const selectAndJumpToScene = (idx: number) => {
    const clampedIdx = Math.max(0, Math.min(scenes.length - 1, idx));
    setSelectedSceneIndex(clampedIdx);
    const offset = sceneOffsets[clampedIdx];
    if (offset) {
      setCurrentTimeMs(offset.startMs + 10);
    }
  };

  // --- API Helpers ---
  const patchProjectSettings = async (
    payload: Partial<{
      title: string;
      aspectRatio: "9:16" | "16:9";
      voiceEngine: string;
      voiceId: string;
      voiceSpeed: number;
      subtitleStyle: SubtitleStyle;
    }>
  ) => {
    setSaveState("saving");
    setStatusMessage("Saving project settings...");
    try {
      const res = await fetch(`/api/v1/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json?.project) {
        throw new Error(json?.error || "Failed to update project settings");
      }
      const updated: VideoProjectDetail = json.project;
      setProject(updated);
      setScenes(updated.scenes);
      setTitleDraft(updated.title);
      setSaveState("saved");
      setStatusMessage(
        json.voiceFallbackApplied
          ? "Saved (Free Edge Neural fallback active)"
          : "All changes saved"
      );
    } catch (err) {
      setSaveState("error");
      setStatusMessage(err instanceof Error ? err.message : "Failed to save settings");
    }
  };

  const persistSceneToServer = useCallback(
    async (sceneToSave: SceneData) => {
      setSaveState("saving");
      setStatusMessage(`Saving Scene ${String(sceneToSave.order_index).padStart(2, "0")}...`);
      try {
        const res = await fetch(
          `/api/v1/projects/${project.id}/scenes/${sceneToSave.scene_id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sceneType: sceneToSave.scene_type,
              onScreenHeadline: sceneToSave.on_screen_headline,
              narrationText: sceneToSave.narration_text,
              durationMs: sceneToSave.duration_ms,
              animationProps: sceneToSave.animation_props,
            }),
          }
        );
        const json = await res.json();
        if (!res.ok || !json?.scene) {
          throw new Error(json?.error || "Failed to save scene");
        }
        const savedScene: SceneData = json.scene;
        setScenes((prev) =>
          prev.map((sc) => (sc.scene_id === savedScene.scene_id ? savedScene : sc))
        );
        setSaveState("saved");
        setStatusMessage("All changes saved");
      } catch (err) {
        setSaveState("error");
        setStatusMessage(err instanceof Error ? err.message : "Scene save failed");
      }
    },
    [project.id]
  );

  const updateActiveSceneLocalAndScheduleSave = (
    updater: (prev: SceneData) => SceneData,
    immediate = false
  ) => {
    if (!activeScene) return;
    const nextScene = updater(activeScene);
    setScenes((prev) =>
      prev.map((sc, idx) => (idx === selectedSceneIndex ? nextScene : sc))
    );

    if (sceneSaveTimerRef.current) clearTimeout(sceneSaveTimerRef.current);
    if (immediate) {
      void persistSceneToServer(nextScene);
    } else {
      setSaveState("saving");
      setStatusMessage("Editing scene...");
      sceneSaveTimerRef.current = setTimeout(() => {
        void persistSceneToServer(nextScene);
      }, 550);
    }
  };

  const handleAddScene = async () => {
    if (scenes.length >= 20 || addingScene) return;
    setAddingScene(true);
    setSaveState("saving");
    setStatusMessage("Adding new scene...");
    try {
      const res = await fetch(`/api/v1/projects/${project.id}/scenes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneType: activeScene?.scene_type || project.primaryTemplate,
          onScreenHeadline: `Key Takeaway #${scenes.length + 1}`,
          narrationText:
            "Here is the next visual step animated smoothly at sixty frames per second.",
        }),
      });
      const json = await res.json();
      if (!res.ok || !Array.isArray(json?.scenes)) {
        throw new Error(json?.error || "Could not add scene");
      }
      const nextScenes: SceneData[] = json.scenes;
      setScenes(nextScenes);
      setProject((prev) => ({
        ...prev,
        scenes: nextScenes,
        scenesCount: nextScenes.length,
        durationSec: json.durationSec ?? prev.durationSec,
      }));
      setSelectedSceneIndex(nextScenes.length - 1);
      setSaveState("saved");
      setStatusMessage(`Added Scene ${String(nextScenes.length).padStart(2, "0")}`);
    } catch (err) {
      setSaveState("error");
      setStatusMessage(err instanceof Error ? err.message : "Could not add scene");
    } finally {
      setAddingScene(false);
    }
  };

  const handleDeleteScene = async (sceneId: string, idx: number) => {
    if (scenes.length <= 1) return;
    setSaveState("saving");
    setStatusMessage("Removing scene...");
    try {
      const res = await fetch(`/api/v1/projects/${project.id}/scenes/${sceneId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !Array.isArray(json?.scenes)) {
        throw new Error(json?.error || "Could not delete scene");
      }
      const nextScenes: SceneData[] = json.scenes;
      setScenes(nextScenes);
      setProject((prev) => ({
        ...prev,
        scenes: nextScenes,
        scenesCount: nextScenes.length,
        durationSec: json.durationSec ?? prev.durationSec,
      }));
      const nextIdx = Math.max(0, Math.min(nextScenes.length - 1, idx));
      setSelectedSceneIndex(nextIdx);
      setCurrentTimeMs(0);
      setSaveState("saved");
      setStatusMessage("Scene removed");
    } catch (err) {
      setSaveState("error");
      setStatusMessage(err instanceof Error ? err.message : "Could not delete scene");
    }
  };

  const handleReorderScenes = async (fromIdx: number, toIdx: number) => {
    if (
      fromIdx === toIdx ||
      fromIdx < 0 ||
      toIdx < 0 ||
      fromIdx >= scenes.length ||
      toIdx >= scenes.length
    ) {
      return;
    }

    const reordered = [...scenes];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const reindexed = reordered.map((sc, i) => ({ ...sc, order_index: i + 1 }));

    setScenes(reindexed);
    setSelectedSceneIndex(toIdx);
    setSaveState("saving");
    setStatusMessage("Saving scene order...");

    try {
      const res = await fetch(`/api/v1/projects/${project.id}/scenes/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderedSceneIds: reindexed.map((s) => s.scene_id),
        }),
      });
      const json = await res.json();
      if (!res.ok || !Array.isArray(json?.scenes)) {
        throw new Error(json?.error || "Could not reorder scenes");
      }
      const savedOrder: SceneData[] = json.scenes;
      setScenes(savedOrder);
      setProject((prev) => ({ ...prev, scenes: savedOrder }));
      setSaveState("saved");
      setStatusMessage("Scene order saved");
    } catch (err) {
      setSaveState("error");
      setStatusMessage(err instanceof Error ? err.message : "Reorder failed");
    }
  };

  const handleSyncAllVoices = async () => {
    if (syncingVoices) return;
    setSyncingVoices(true);
    setSaveState("saving");
    setStatusMessage("Syncing neural voices & word timestamps...");
    try {
      const res = await fetch(`/api/v1/projects/${project.id}/generate-assets`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !Array.isArray(json?.scenes)) {
        throw new Error(json?.error || "Failed to sync voice assets");
      }
      const syncedScenes: SceneData[] = json.scenes;
      setScenes(syncedScenes);
      setProject((prev) => ({
        ...prev,
        scenes: syncedScenes,
        durationSec: json.durationSec ?? prev.durationSec,
      }));
      setSaveState("saved");
      setStatusMessage(`Synced ${json.syncedCount ?? syncedScenes.length} scenes @ 60fps`);
    } catch (err) {
      setSaveState("error");
      setStatusMessage(err instanceof Error ? err.message : "Voice sync failed");
    } finally {
      setSyncingVoices(false);
    }
  };

  const handleAuditionNarration = (scene: SceneData) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (speakingSceneId === scene.scene_id) {
      window.speechSynthesis.cancel();
      setSpeakingSceneId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(scene.narration_text);
    utter.rate = project.voiceSpeed || 1.0;
    utter.onend = () => setSpeakingSceneId(null);
    utter.onerror = () => setSpeakingSceneId(null);
    setSpeakingSceneId(scene.scene_id);
    window.speechSynthesis.speak(utter);
  };

  const handleTimelineScrubClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineBarRef.current) return;
    const rect = timelineBarRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetMs = Math.round(ratio * totalDurationMs);
    setCurrentTimeMs(targetMs);
    const hit = sceneOffsets.find((s) => targetMs >= s.startMs && targetMs < s.endMs);
    if (hit) setSelectedSceneIndex(hit.index);
  };

  // Determine local elapsed ms inside selected scene for word-chip highlight
  const activeSceneOffset = sceneOffsets[selectedSceneIndex];
  const localSceneElapsedMs = activeSceneOffset
    ? Math.max(
        0,
        Math.min(activeSceneOffset.durationMs, currentTimeMs - activeSceneOffset.startMs)
      )
    : 0;

  // --- Template-Specific Props Editor Renderer ---
  const renderTemplatePropsEditor = () => {
    if (!activeScene) return null;
    const props = activeScene.animation_props || {};
    const type = activeScene.scene_type;

    if (type === "diagram_flow") {
      const rawNodes = Array.isArray(props.nodes) ? props.nodes : [];
      const nodes = rawNodes.map((n, i) => {
        const obj = (n && typeof n === "object" ? n : {}) as Record<string, unknown>;
        return {
          id: String(obj.id || `n${i + 1}`),
          icon: String(obj.icon || "⚡"),
          title: String(obj.title || `Step ${i + 1}`),
          subtitle: String(obj.subtitle || "Stage detail"),
        };
      });

      const updateNodes = (nextNodes: typeof nodes) => {
        updateActiveSceneLocalAndScheduleSave((sc) => ({
          ...sc,
          animation_props: { ...sc.animation_props, nodes: nextNodes },
        }));
      };

      return (
        <div className="space-y-3">
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A1A1AA] mb-1">
              Flow Direction
            </label>
            <select
              value={String(props.flow_direction || "auto")}
              onChange={(e) =>
                updateActiveSceneLocalAndScheduleSave(
                  (sc) => ({
                    ...sc,
                    animation_props: {
                      ...sc.animation_props,
                      flow_direction: e.target.value,
                    },
                  }),
                  true
                )
              }
              className="w-full px-3 py-2 rounded-xl bg-[#09090B] border border-[#27272A] text-xs text-white"
            >
              <option value="auto">Auto (Vertical in 9:16, Horizontal in 16:9)</option>
              <option value="vertical">Force Vertical Stack</option>
              <option value="horizontal">Force Horizontal Pipeline</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#A1A1AA]">
              Diagram Nodes ({nodes.length}/4)
            </span>
            {nodes.length < 4 && (
              <button
                type="button"
                onClick={() =>
                  updateNodes([
                    ...nodes,
                    {
                      id: `n${nodes.length + 1}`,
                      icon: "🚀",
                      title: `${nodes.length + 1}. Next Stage`,
                      subtitle: "Output signal",
                    },
                  ])
                }
                className="px-2 py-1 rounded-lg bg-[#18181D] hover:bg-[#27272A] border border-[#27272A] font-mono text-[10px] text-[#FFB4A4]"
              >
                + Add Node
              </button>
            )}
          </div>

          {nodes.map((node, idx) => (
            <div
              key={node.id + idx}
              className="p-3 rounded-xl bg-[#09090B] border border-[#27272A] space-y-2"
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={node.icon}
                  onChange={(e) => {
                    const copy = [...nodes];
                    copy[idx] = { ...copy[idx], icon: e.target.value.slice(0, 4) };
                    updateNodes(copy);
                  }}
                  className="w-12 px-2 py-1.5 rounded-lg bg-[#18181D] border border-[#27272A] text-center text-sm"
                  aria-label={`Node ${idx + 1} icon`}
                />
                <input
                  type="text"
                  value={node.title}
                  onChange={(e) => {
                    const copy = [...nodes];
                    copy[idx] = { ...copy[idx], title: e.target.value };
                    updateNodes(copy);
                  }}
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#18181D] border border-[#27272A] text-xs text-white font-semibold"
                  placeholder="Node title"
                />
                {nodes.length > 2 && (
                  <button
                    type="button"
                    onClick={() => updateNodes(nodes.filter((_, i) => i !== idx))}
                    className="p-1 rounded hover:bg-[#27272A] text-[#71717A] hover:text-[#EF4444]"
                    title="Remove node"
                  >
                    <span className="material-symbols-outlined text-[15px] block">close</span>
                  </button>
                )}
              </div>
              <input
                type="text"
                value={node.subtitle}
                onChange={(e) => {
                  const copy = [...nodes];
                  copy[idx] = { ...copy[idx], subtitle: e.target.value };
                  updateNodes(copy);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#121216] border border-[#27272A] text-xs text-[#A1A1AA]"
                placeholder="Node subtitle"
              />
            </div>
          ))}
        </div>
      );
    }

    if (type === "kids_counting") {
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block font-mono text-[10px] text-[#A1A1AA] mb-1">
                Focus Symbol
              </label>
              <input
                type="text"
                value={String(props.focus_symbol || "A • 5")}
                onChange={(e) =>
                  updateActiveSceneLocalAndScheduleSave((sc) => ({
                    ...sc,
                    animation_props: { ...sc.animation_props, focus_symbol: e.target.value },
                  }))
                }
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#09090B] border border-[#27272A] text-xs text-white"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] text-[#A1A1AA] mb-1">
                Item Emoji
              </label>
              <input
                type="text"
                value={String(props.item_emoji || "🍎")}
                onChange={(e) =>
                  updateActiveSceneLocalAndScheduleSave((sc) => ({
                    ...sc,
                    animation_props: { ...sc.animation_props, item_emoji: e.target.value },
                  }))
                }
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#09090B] border border-[#27272A] text-sm text-center"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block font-mono text-[10px] text-[#A1A1AA] mb-1">
                Target Count ({Number(props.target_count || 5)})
              </label>
              <input
                type="range"
                min={1}
                max={10}
                value={Number(props.target_count || 5)}
                onChange={(e) =>
                  updateActiveSceneLocalAndScheduleSave((sc) => ({
                    ...sc,
                    animation_props: {
                      ...sc.animation_props,
                      target_count: Number(e.target.value),
                    },
                  }))
                }
                className="w-full accent-[#F59E0B]"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] text-[#A1A1AA] mb-1">
                Item Label
              </label>
              <input
                type="text"
                value={String(props.item_label || "Apples")}
                onChange={(e) =>
                  updateActiveSceneLocalAndScheduleSave((sc) => ({
                    ...sc,
                    animation_props: { ...sc.animation_props, item_label: e.target.value },
                  }))
                }
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#09090B] border border-[#27272A] text-xs text-white"
              />
            </div>
          </div>

          <div>
            <label className="block font-mono text-[10px] text-[#A1A1AA] mb-1">
              Phonetic Banner Text
            </label>
            <input
              type="text"
              value={String(props.phonetic_word || activeScene.on_screen_headline)}
              onChange={(e) =>
                updateActiveSceneLocalAndScheduleSave((sc) => ({
                  ...sc,
                  animation_props: { ...sc.animation_props, phonetic_word: e.target.value },
                }))
              }
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#09090B] border border-[#27272A] text-xs text-white"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-[#E4E4E7] cursor-pointer">
            <input
              type="checkbox"
              checked={props.confetti_on_complete !== false}
              onChange={(e) =>
                updateActiveSceneLocalAndScheduleSave(
                  (sc) => ({
                    ...sc,
                    animation_props: {
                      ...sc.animation_props,
                      confetti_on_complete: e.target.checked,
                    },
                  }),
                  true
                )
              }
              className="accent-[#10B981]"
            />
            Celebration confetti burst on completion
          </label>
        </div>
      );
    }

    if (type === "split_comparison") {
      const left = (props.left_or_top_card && typeof props.left_or_top_card === "object"
        ? props.left_or_top_card
        : {}) as Record<string, unknown>;
      const right = (props.right_or_bottom_card && typeof props.right_or_bottom_card === "object"
        ? props.right_or_bottom_card
        : {}) as Record<string, unknown>;

      return (
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-[#09090B] border border-[#EF4444]/40 space-y-2">
            <div className="font-mono text-[10px] text-[#FCA5A5] font-bold">
              LEFT / TOP CARD (MYTH / BEFORE)
            </div>
            <input
              type="text"
              value={String(left.badge_text || "✗ COMMON MYTH")}
              onChange={(e) =>
                updateActiveSceneLocalAndScheduleSave((sc) => ({
                  ...sc,
                  animation_props: {
                    ...sc.animation_props,
                    left_or_top_card: { ...left, badge_text: e.target.value },
                  },
                }))
              }
              className="w-full px-2.5 py-1 rounded-lg bg-[#18181D] border border-[#27272A] text-[11px] font-mono text-[#FCA5A5]"
            />
            <input
              type="text"
              value={String(left.title || "Outdated Assumption")}
              onChange={(e) =>
                updateActiveSceneLocalAndScheduleSave((sc) => ({
                  ...sc,
                  animation_props: {
                    ...sc.animation_props,
                    left_or_top_card: { ...left, title: e.target.value },
                  },
                }))
              }
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#18181D] border border-[#27272A] text-xs text-white font-semibold"
            />
            <textarea
              rows={2}
              value={
                Array.isArray(left.points)
                  ? left.points.join("\n")
                  : "High energy loss\nFails under load"
              }
              onChange={(e) =>
                updateActiveSceneLocalAndScheduleSave((sc) => ({
                  ...sc,
                  animation_props: {
                    ...sc.animation_props,
                    left_or_top_card: {
                      ...left,
                      points: e.target.value
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    },
                  },
                }))
              }
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#121216] border border-[#27272A] text-xs text-[#A1A1AA]"
              placeholder="One bullet per line"
            />
          </div>

          <div className="p-3 rounded-xl bg-[#09090B] border border-[#10B981]/40 space-y-2">
            <div className="font-mono text-[10px] text-[#9BFFCE] font-bold">
              RIGHT / BOTTOM CARD (VERIFIED FACT)
            </div>
            <input
              type="text"
              value={String(right.badge_text || "✓ VERIFIED FACT")}
              onChange={(e) =>
                updateActiveSceneLocalAndScheduleSave((sc) => ({
                  ...sc,
                  animation_props: {
                    ...sc.animation_props,
                    right_or_bottom_card: { ...right, badge_text: e.target.value },
                  },
                }))
              }
              className="w-full px-2.5 py-1 rounded-lg bg-[#18181D] border border-[#27272A] text-[11px] font-mono text-[#9BFFCE]"
            />
            <input
              type="text"
              value={String(right.title || "Measured Reality")}
              onChange={(e) =>
                updateActiveSceneLocalAndScheduleSave((sc) => ({
                  ...sc,
                  animation_props: {
                    ...sc.animation_props,
                    right_or_bottom_card: { ...right, title: e.target.value },
                  },
                }))
              }
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#18181D] border border-[#27272A] text-xs text-white font-semibold"
            />
            <textarea
              rows={2}
              value={
                Array.isArray(right.points)
                  ? right.points.join("\n")
                  : "High efficiency\nProven in field tests"
              }
              onChange={(e) =>
                updateActiveSceneLocalAndScheduleSave((sc) => ({
                  ...sc,
                  animation_props: {
                    ...sc.animation_props,
                    right_or_bottom_card: {
                      ...right,
                      points: e.target.value
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    },
                  },
                }))
              }
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#121216] border border-[#27272A] text-xs text-[#A1A1AA]"
              placeholder="One bullet per line"
            />
          </div>
        </div>
      );
    }

    if (type === "stat_counter") {
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block font-mono text-[10px] text-[#A1A1AA] mb-1">Prefix</label>
              <input
                type="text"
                value={String(props.number_prefix ?? "+")}
                onChange={(e) =>
                  updateActiveSceneLocalAndScheduleSave((sc) => ({
                    ...sc,
                    animation_props: { ...sc.animation_props, number_prefix: e.target.value },
                  }))
                }
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#09090B] border border-[#27272A] text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] text-[#A1A1AA] mb-1">Target #</label>
              <input
                type="number"
                value={Number(props.target_number ?? 87)}
                onChange={(e) =>
                  updateActiveSceneLocalAndScheduleSave((sc) => ({
                    ...sc,
                    animation_props: {
                      ...sc.animation_props,
                      target_number: Number(e.target.value),
                    },
                  }))
                }
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#09090B] border border-[#27272A] text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] text-[#A1A1AA] mb-1">Suffix</label>
              <input
                type="text"
                value={String(props.number_suffix ?? "%")}
                onChange={(e) =>
                  updateActiveSceneLocalAndScheduleSave((sc) => ({
                    ...sc,
                    animation_props: { ...sc.animation_props, number_suffix: e.target.value },
                  }))
                }
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#09090B] border border-[#27272A] text-xs text-white font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-mono text-[10px] text-[#A1A1AA] mb-1">
              Display Mode
            </label>
            <select
              value={String(props.display_mode || "bar_chart")}
              onChange={(e) =>
                updateActiveSceneLocalAndScheduleSave(
                  (sc) => ({
                    ...sc,
                    animation_props: { ...sc.animation_props, display_mode: e.target.value },
                  }),
                  true
                )
              }
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#09090B] border border-[#27272A] text-xs text-white"
            >
              <option value="bar_chart">Hero Metric + Animated Comparison Bars</option>
              <option value="big_number">Hero Metric Counter Only</option>
            </select>
          </div>

          <div>
            <label className="block font-mono text-[10px] text-[#A1A1AA] mb-1">
              Takeaway Subtitle
            </label>
            <input
              type="text"
              value={String(props.takeaway_label || activeScene.on_screen_headline)}
              onChange={(e) =>
                updateActiveSceneLocalAndScheduleSave((sc) => ({
                  ...sc,
                  animation_props: { ...sc.animation_props, takeaway_label: e.target.value },
                }))
              }
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#09090B] border border-[#27272A] text-xs text-white"
            />
          </div>
        </div>
      );
    }

    // illustrated_motion
    return (
      <div className="space-y-3">
        <div>
          <label className="block font-mono text-[10px] text-[#A1A1AA] mb-1">
            60fps Camera Motion
          </label>
          <select
            value={String(props.camera_motion || "zoom_in")}
            onChange={(e) =>
              updateActiveSceneLocalAndScheduleSave(
                (sc) => ({
                  ...sc,
                  animation_props: { ...sc.animation_props, camera_motion: e.target.value },
                }),
                true
              )
            }
            className="w-full px-2.5 py-2 rounded-lg bg-[#09090B] border border-[#27272A] text-xs text-white"
          >
            <option value="zoom_in">Slow Ken Burns Zoom In</option>
            <option value="zoom_out">Wide Reveal Zoom Out</option>
            <option value="pan_left">Cinema Pan Left</option>
            <option value="pan_right">Cinema Pan Right</option>
          </select>
        </div>

        <div>
          <label className="block font-mono text-[10px] text-[#A1A1AA] mb-1">
            Vector Art Palette
          </label>
          <select
            value={String(props.art_style || "dark_tech")}
            onChange={(e) =>
              updateActiveSceneLocalAndScheduleSave(
                (sc) => ({
                  ...sc,
                  animation_props: { ...sc.animation_props, art_style: e.target.value },
                }),
                true
              )
            }
            className="w-full px-2.5 py-2 rounded-lg bg-[#09090B] border border-[#27272A] text-xs text-white"
          >
            <option value="dark_tech">Obsidian Vermilion Tech</option>
            <option value="neon_science">Cyan & Emerald Science</option>
            <option value="storybook_warm">Warm Solar Storybook</option>
            <option value="clean_editorial">Clean Editorial Monochrome</option>
          </select>
        </div>

        <div>
          <label className="block font-mono text-[10px] text-[#A1A1AA] mb-1">
            Floating Callout Badge
          </label>
          <input
            type="text"
            value={String(props.callout_badge || `✨ ${activeScene.on_screen_headline}`)}
            onChange={(e) =>
              updateActiveSceneLocalAndScheduleSave((sc) => ({
                ...sc,
                animation_props: { ...sc.animation_props, callout_badge: e.target.value },
              }))
            }
            className="w-full px-2.5 py-1.5 rounded-lg bg-[#09090B] border border-[#27272A] text-xs text-white"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-[#09090B] text-[#F4F4F5]">
      {/* Studio Workstation Sub-Header */}
      <div className="px-4 sm:px-6 py-3 border-b border-[#27272A] bg-[#121216]/95 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Link
            href="/dashboard"
            className="p-2 rounded-xl bg-[#18181D] hover:bg-[#27272A] border border-[#27272A] text-[#A1A1AA] hover:text-white transition-colors shrink-0"
            title="Back to My Videos Dashboard"
          >
            <span className="material-symbols-outlined text-[18px] block">arrow_back</span>
          </Link>

          <div className="min-w-0 flex-1 max-w-md">
            <input
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => {
                if (titleDraft.trim().length >= 3 && titleDraft.trim() !== project.title) {
                  void patchProjectSettings({ title: titleDraft.trim() });
                } else {
                  setTitleDraft(project.title);
                }
              }}
              aria-label="Project title"
              className="w-full bg-transparent font-display font-bold text-sm sm:text-base text-white focus:outline-none focus:ring-1 focus:ring-[#FF4F28] rounded px-1.5 py-0.5 truncate"
            />
            <div className="flex items-center gap-2 px-1.5 font-mono text-[10px]">
              <span
                className={
                  saveState === "error"
                    ? "text-[#EF4444]"
                    : saveState === "saving"
                      ? "text-[#F59E0B]"
                      : "text-[#10B981]"
                }
              >
                ● {statusMessage}
              </span>
              <span className="text-[#52525B]">•</span>
              <span className="text-[#A1A1AA]">
                {scenes.length} Scenes ({(totalDurationMs / 1000).toFixed(1)}s)
              </span>
            </div>
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Live 9:16 / 16:9 Switcher */}
          <div className="inline-flex rounded-xl bg-[#09090B] p-1 border border-[#27272A]">
            {(["9:16", "16:9"] as const).map((ratio) => {
              const active = project.aspectRatio === ratio;
              return (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => {
                    if (!active) void patchProjectSettings({ aspectRatio: ratio });
                  }}
                  className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold transition-colors ${
                    active
                      ? "bg-[#FF4F28] text-[#09090B]"
                      : "text-[#A1A1AA] hover:text-white"
                  }`}
                >
                  {ratio}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleSyncAllVoices}
            disabled={syncingVoices}
            className="px-3 py-2 rounded-xl bg-[#18181D] hover:bg-[#27272A] border border-[#27272A] font-mono text-xs text-[#E4E4E7] inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px] text-[#10B981]">
              graphic_eq
            </span>
            {syncingVoices ? "Syncing..." : "Sync Voices"}
          </button>

          <Link
            href={`/dashboard/projects/${project.id}/publish`}
            className="px-4 py-2 rounded-xl bg-[#FF4F28] hover:bg-[#FF6542] text-[#09090B] font-display font-bold text-xs inline-flex items-center gap-1.5 shadow-[0_0_24px_rgba(255,79,40,0.3)] transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">movie_creation</span>
            Render 1080p MP4
          </Link>
        </div>
      </div>

      {/* Mobile / Tablet 4-Tab Bar (`06B` Responsive Switcher) */}
      <div className="lg:hidden grid grid-cols-4 border-b border-[#27272A] bg-[#121216] px-2 py-1.5 gap-1">
        {(
          [
            { id: "canvas", label: "Canvas", icon: "smart_display" },
            { id: "scenes", label: `Scenes (${scenes.length})`, icon: "view_carousel" },
            { id: "inspector", label: "Inspector", icon: "tune" },
            { id: "timeline", label: "Timeline", icon: "clear_all" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setMobileTab(t.id)}
            className={`py-2 rounded-xl font-display text-xs font-bold flex items-center justify-center gap-1 transition-colors ${
              mobileTab === t.id
                ? "bg-[#FF4F28]/15 text-[#FFB4A4] border border-[#FF4F28]/40"
                : "text-[#A1A1AA] hover:text-white"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Main 3-Column Workstation Grid */}
      <div className="flex-1 p-3 sm:p-4 lg:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* LEFT COLUMN (3 cols): Storyboard Scene Deck */}
        <section
          className={`lg:col-span-3 flex-col rounded-2xl bg-[#121216] border border-[#27272A] overflow-hidden ${
            mobileTab === "scenes" ? "flex" : "hidden lg:flex"
          }`}
        >
          <div className="px-4 py-3 border-b border-[#27272A] bg-[#141419] flex items-center justify-between">
            <div>
              <h2 className="font-display font-bold text-xs uppercase tracking-wider text-white">
                Storyboard Deck
              </h2>
              <p className="font-mono text-[10px] text-[#71717A]">
                Drag or use arrows to reorder
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddScene}
              disabled={addingScene || scenes.length >= 20}
              className="px-2.5 py-1.5 rounded-lg bg-[#FF4F28]/15 hover:bg-[#FF4F28]/25 border border-[#FF4F28]/40 font-mono text-[11px] font-bold text-[#FFB4A4] disabled:opacity-40"
            >
              {addingScene ? "Adding..." : "+ Add Scene"}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[560px] p-3 space-y-2.5">
            {scenes.map((scene, idx) => {
              const isSelected = idx === selectedSceneIndex;
              const tplMeta =
                SCENE_TEMPLATES.find((t) => t.id === scene.scene_type) || SCENE_TEMPLATES[0];

              return (
                <div
                  key={scene.scene_id}
                  draggable
                  onDragStart={() => setDraggedIndex(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (draggedIndex !== null && draggedIndex !== idx) {
                      void handleReorderScenes(draggedIndex, idx);
                    }
                    setDraggedIndex(null);
                  }}
                  onClick={() => selectAndJumpToScene(idx)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-[#1C181E] border-[#FF4F28] shadow-[0_0_20px_rgba(255,79,40,0.18)]"
                      : "bg-[#09090B] border-[#27272A] hover:border-[#3F3F46]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 font-mono text-[10px]">
                      <span
                        className={`px-1.5 py-0.5 rounded font-bold ${
                          isSelected
                            ? "bg-[#FF4F28] text-[#09090B]"
                            : "bg-[#18181D] text-[#A1A1AA]"
                        }`}
                      >
                        #{String(idx + 1).padStart(2, "0")}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-[#18181D] border border-[#27272A] text-[#FFB4A4]">
                        {tplMeta.shortLabel}
                      </span>
                      <span className="text-[#71717A]">
                        {(scene.duration_ms / 1000).toFixed(1)}s
                      </span>
                    </div>

                    <div
                      className="flex items-center gap-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => void handleReorderScenes(idx, idx - 1)}
                        className="p-1 rounded hover:bg-[#27272A] text-[#A1A1AA] disabled:opacity-30"
                        title="Move Scene Up"
                      >
                        <span className="material-symbols-outlined text-[14px] block">
                          arrow_upward
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={idx === scenes.length - 1}
                        onClick={() => void handleReorderScenes(idx, idx + 1)}
                        className="p-1 rounded hover:bg-[#27272A] text-[#A1A1AA] disabled:opacity-30"
                        title="Move Scene Down"
                      >
                        <span className="material-symbols-outlined text-[14px] block">
                          arrow_downward
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={scenes.length <= 1}
                        onClick={() => void handleDeleteScene(scene.scene_id, idx)}
                        className="p-1 rounded hover:bg-[#EF4444]/20 text-[#71717A] hover:text-[#EF4444] disabled:opacity-30"
                        title="Delete Scene"
                      >
                        <span className="material-symbols-outlined text-[14px] block">
                          delete
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="font-display font-bold text-xs text-white line-clamp-1">
                    {scene.on_screen_headline}
                  </div>
                  <p className="text-[11px] text-[#A1A1AA] line-clamp-2 mt-1 leading-relaxed">
                    {scene.narration_text}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* CENTER COLUMN (5 cols): 60fps HTML5 Canvas Monitor */}
        <section
          className={`lg:col-span-5 flex-col ${
            mobileTab === "canvas" ? "flex" : "hidden lg:flex"
          }`}
        >
          <StudioCanvasPlayer
            scenes={scenes}
            aspectRatio={project.aspectRatio}
            subtitleStyle={project.subtitleStyle}
            brandHandle={`@${userHandle}`}
            currentTimeMs={currentTimeMs}
            isPlaying={isPlaying}
            loop={loop}
            showSafeZones={showSafeZones}
            onTimeChange={handleTimeChange}
            onTogglePlay={() => {
              if (!isPlaying && currentTimeMs >= totalDurationMs - 40) {
                setCurrentTimeMs(0);
              }
              setIsPlaying((p) => !p);
            }}
            onToggleLoop={() => setLoop((l) => !l)}
            onToggleSafeZones={() => setShowSafeZones((s) => !s)}
            onSelectSceneIndex={(idx) => setSelectedSceneIndex(idx)}
          />
        </section>

        {/* RIGHT COLUMN (4 cols): 3-Tab Scene Inspector */}
        <section
          className={`lg:col-span-4 flex-col rounded-2xl bg-[#121216] border border-[#27272A] overflow-hidden ${
            mobileTab === "inspector" ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* Inspector Tabs Header */}
          <div className="grid grid-cols-3 border-b border-[#27272A] bg-[#141419] p-1.5 gap-1">
            {(
              [
                { id: "script", label: "Script & Voice", icon: "record_voice_over" },
                { id: "props", label: "Diagram Props", icon: "widgets" },
                { id: "captions", label: "Captions & Audio", icon: "closed_caption" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setInspectorTab(tab.id)}
                className={`py-2 px-2 rounded-xl font-display font-bold text-[11px] flex items-center justify-center gap-1 transition-colors ${
                  inspectorTab === tab.id
                    ? "bg-[#FF4F28] text-[#09090B]"
                    : "text-[#A1A1AA] hover:text-white hover:bg-[#18181D]"
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">{tab.icon}</span>
                <span className="truncate">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Inspector Body */}
          {activeScene && (
            <div className="flex-1 overflow-y-auto max-h-[560px] p-4 space-y-4">
              {inspectorTab === "script" && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] text-[#FFB4A4] font-bold">
                      EDITING SCENE #{String(selectedSceneIndex + 1).padStart(2, "0")}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAuditionNarration(activeScene)}
                      className="px-2.5 py-1 rounded-lg bg-[#18181D] hover:bg-[#27272A] border border-[#27272A] font-mono text-[10px] text-[#9BFFCE] inline-flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        {speakingSceneId === activeScene.scene_id ? "stop_circle" : "volume_up"}
                      </span>
                      {speakingSceneId === activeScene.scene_id
                        ? "Stop Preview"
                        : "Audition Voice"}
                    </button>
                  </div>

                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A1A1AA] mb-1">
                      On-Screen Headline
                    </label>
                    <input
                      type="text"
                      value={activeScene.on_screen_headline}
                      onChange={(e) =>
                        updateActiveSceneLocalAndScheduleSave((sc) => ({
                          ...sc,
                          on_screen_headline: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl bg-[#09090B] border border-[#27272A] text-xs text-white font-semibold focus:outline-none focus:border-[#FF4F28]"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-mono text-[10px] uppercase tracking-wider text-[#A1A1AA]">
                        Spoken Voiceover Narration
                      </label>
                      <span className="font-mono text-[10px] text-[#71717A]">
                        {activeScene.narration_text.trim().split(/\s+/).filter(Boolean).length}{" "}
                        words
                      </span>
                    </div>
                    <textarea
                      rows={4}
                      value={activeScene.narration_text}
                      onChange={(e) => {
                        const nextText = e.target.value;
                        const words = nextText.trim().split(/\s+/).filter(Boolean).length;
                        const autoDur = Math.min(
                          18000,
                          Math.max(
                            3500,
                            Math.round(
                              ((words / 2.4) * 1000) / Math.max(0.75, project.voiceSpeed || 1)
                            ) + 600
                          )
                        );
                        updateActiveSceneLocalAndScheduleSave((sc) => ({
                          ...sc,
                          narration_text: nextText,
                          duration_ms: autoDur,
                          word_timestamps: estimateWordTimestampsClient(nextText, autoDur),
                        }));
                      }}
                      className="w-full px-3 py-2.5 rounded-xl bg-[#09090B] border border-[#27272A] text-xs text-[#E4E4E7] leading-relaxed focus:outline-none focus:border-[#FF4F28]"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-mono text-[10px] uppercase tracking-wider text-[#A1A1AA]">
                        Scene Duration
                      </label>
                      <span className="font-mono text-[11px] text-[#F59E0B] font-bold">
                        {(activeScene.duration_ms / 1000).toFixed(1)}s
                      </span>
                    </div>
                    <input
                      type="range"
                      min={3000}
                      max={18000}
                      step={500}
                      value={activeScene.duration_ms}
                      onChange={(e) => {
                        const nextDur = Number(e.target.value);
                        updateActiveSceneLocalAndScheduleSave((sc) => ({
                          ...sc,
                          duration_ms: nextDur,
                          word_timestamps: estimateWordTimestampsClient(
                            sc.narration_text,
                            nextDur
                          ),
                        }));
                      }}
                      className="w-full accent-[#FF4F28]"
                    />
                  </div>

                  <div className="pt-3 border-t border-[#27272A] space-y-3">
                    <div>
                      <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A1A1AA] mb-1">
                        Project Neural Voice Persona
                      </label>
                      <select
                        value={project.voiceId}
                        onChange={(e) => {
                          const picked = voices.find((v) => v.voiceId === e.target.value);
                          if (picked) {
                            void patchProjectSettings({
                              voiceId: picked.voiceId,
                              voiceEngine: picked.provider,
                            });
                          }
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-[#09090B] border border-[#27272A] text-xs text-white"
                      >
                        {voices.map((v) => (
                          <option key={v.voiceId} value={v.voiceId}>
                            {v.name} ({v.isFreeUnlimited ? "Free Edge Neural" : "ElevenLabs Pro"}
                            {!v.isFreeUnlimited && !elevenlabsConfigured
                              ? " → Auto-Fallback"
                              : ""}
                            )
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-mono text-[10px] uppercase tracking-wider text-[#A1A1AA]">
                          Voice Pacing Speed
                        </label>
                        <span className="font-mono text-[11px] text-[#9BFFCE]">
                          {project.voiceSpeed.toFixed(2)}x
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.85}
                        max={1.25}
                        step={0.05}
                        value={project.voiceSpeed}
                        onChange={(e) =>
                          void patchProjectSettings({ voiceSpeed: Number(e.target.value) })
                        }
                        className="w-full accent-[#10B981]"
                      />
                    </div>
                  </div>
                </>
              )}

              {inspectorTab === "props" && (
                <>
                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A1A1AA] mb-2">
                      60fps Animation Template Engine
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {SCENE_TEMPLATES.map((tpl) => {
                        const isCurrent = activeScene.scene_type === tpl.id;
                        return (
                          <button
                            key={tpl.id}
                            type="button"
                            onClick={() => {
                              if (isCurrent) return;
                              updateActiveSceneLocalAndScheduleSave(
                                (sc) => ({
                                  ...sc,
                                  scene_type: tpl.id,
                                  animation_props: createClientDefaultProps(
                                    tpl.id,
                                    sc.on_screen_headline
                                  ),
                                }),
                                true
                              );
                            }}
                            className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                              isCurrent
                                ? "bg-[#FF4F28]/15 border-[#FF4F28] text-white"
                                : "bg-[#09090B] border-[#27272A] text-[#A1A1AA] hover:text-white"
                            }`}
                          >
                            <span className="material-symbols-outlined text-[18px] text-[#FF4F28]">
                              {tpl.icon}
                            </span>
                            <span className="font-display font-bold text-xs truncate">
                              {tpl.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#27272A]">
                    {renderTemplatePropsEditor()}
                  </div>
                </>
              )}

              {inspectorTab === "captions" && (
                <>
                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A1A1AA] mb-2">
                      Word-Synced Subtitle Style
                    </label>
                    <div className="space-y-2">
                      {SUBTITLE_STYLES.map((style) => {
                        const selected = project.subtitleStyle === style.id;
                        return (
                          <button
                            key={style.id}
                            type="button"
                            onClick={() => {
                              if (!selected) {
                                void patchProjectSettings({ subtitleStyle: style.id });
                              }
                            }}
                            className={`w-full p-3 rounded-xl border text-left transition-all ${
                              selected
                                ? "bg-[#FF4F28]/15 border-[#FF4F28]"
                                : "bg-[#09090B] border-[#27272A] hover:border-[#3F3F46]"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-display font-bold text-xs text-white">
                                {style.label}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-[#18181D] font-mono text-[9px] text-[#FFB4A4]">
                                {style.previewBadge}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#A1A1AA] mt-1">
                              {style.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#27272A]">
                    <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A1A1AA] mb-1.5">
                      Background Music Bed (Auto-Ducked)
                    </label>
                    <select
                      value={bgmTrack}
                      onChange={(e) => setBgmTrack(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#09090B] border border-[#27272A] text-xs text-white"
                    >
                      {BGM_TRACKS.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="pt-3 border-t border-[#27272A]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-[#A1A1AA]">
                        Synced Word Timestamps ({activeScene.word_timestamps.length})
                      </span>
                      <span className="font-mono text-[10px] text-[#10B981]">60fps Locked</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#09090B] border border-[#27272A] flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                      {activeScene.word_timestamps.map((wt, wIdx) => {
                        const activeWord =
                          localSceneElapsedMs >= wt.start_ms &&
                          localSceneElapsedMs <= wt.end_ms;
                        return (
                          <span
                            key={`${wt.word}_${wIdx}`}
                            onClick={() => {
                              if (activeSceneOffset) {
                                setCurrentTimeMs(activeSceneOffset.startMs + wt.start_ms + 5);
                              }
                            }}
                            className={`px-2 py-0.5 rounded-md font-mono text-[10px] cursor-pointer transition-colors ${
                              activeWord
                                ? "bg-[#FF4F28] text-[#09090B] font-bold"
                                : "bg-[#18181D] text-[#E4E4E7] hover:bg-[#27272A]"
                            }`}
                            title={`${wt.start_ms}ms – ${wt.end_ms}ms`}
                          >
                            {wt.word}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Bottom 4-Track Sequencer Dock */}
      <section
        className={`mx-3 sm:mx-4 lg:mx-5 mb-4 rounded-2xl bg-[#121216] border border-[#27272A] overflow-hidden ${
          mobileTab === "timeline" ? "block" : "hidden lg:block"
        }`}
      >
        <div className="px-4 py-2 border-b border-[#27272A] bg-[#141419] flex items-center justify-between font-mono text-[10px] text-[#A1A1AA]">
          <div className="flex items-center gap-2">
            <span className="text-white font-bold">MULTI-TRACK SEQUENCER</span>
            <span>• Click anywhere on tracks to scrub playhead</span>
          </div>
          <span className="text-[#FFB4A4]">
            Playhead: {(currentTimeMs / 1000).toFixed(1)}s / {(totalDurationMs / 1000).toFixed(1)}s
          </span>
        </div>

        <div className="p-3 space-y-2">
          <div className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-2 font-mono text-[10px] text-[#71717A] uppercase pl-1">
              Track
            </div>
            <div
              ref={timelineBarRef}
              onClick={handleTimelineScrubClick}
              className="col-span-10 relative space-y-1.5 cursor-pointer select-none py-1"
            >
              {/* Electric Vermilion Playhead Needle */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-[#FF4F28] z-20 pointer-events-none shadow-[0_0_10px_#FF4F28]"
                style={{
                  left: `${Math.max(0, Math.min(100, (currentTimeMs / totalDurationMs) * 100))}%`,
                }}
              >
                <div className="w-2.5 h-2.5 -ml-1 -mt-1 rounded-full bg-[#FF4F28]" />
              </div>

              {/* Track 1: Scenes */}
              <div className="flex w-full h-8 rounded-lg overflow-hidden bg-[#09090B] border border-[#27272A]">
                {sceneOffsets.map((item) => {
                  const widthPct = (item.durationMs / totalDurationMs) * 100;
                  const isSel = item.index === selectedSceneIndex;
                  return (
                    <div
                      key={item.scene.scene_id}
                      style={{ width: `${widthPct}%` }}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectAndJumpToScene(item.index);
                      }}
                      className={`h-full px-2 flex items-center justify-between border-r border-[#27272A] text-[10px] font-mono truncate transition-colors ${
                        isSel
                          ? "bg-[#FF4F28]/25 text-white font-bold"
                          : "bg-[#18181D] text-[#A1A1AA] hover:bg-[#222229]"
                      }`}
                    >
                      <span className="truncate">
                        #{String(item.index + 1).padStart(2, "0")} {item.scene.on_screen_headline}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Track 2: Neural Voiceover */}
              <div className="flex w-full h-6 rounded-lg overflow-hidden bg-[#09090B] border border-[#27272A]">
                {sceneOffsets.map((item) => {
                  const widthPct = (item.durationMs / totalDurationMs) * 100;
                  return (
                    <div
                      key={`vo_${item.scene.scene_id}`}
                      style={{ width: `${widthPct}%` }}
                      className="h-full px-2 flex items-center border-r border-[#27272A] bg-[#10B981]/12 text-[#9BFFCE] font-mono text-[9px] truncate"
                    >
                      🎙 {project.voiceId} ({item.scene.word_timestamps.length}w)
                    </div>
                  );
                })}
              </div>

              {/* Track 3: Word-Synced Captions */}
              <div className="flex w-full h-6 rounded-lg overflow-hidden bg-[#09090B] border border-[#27272A]">
                <div className="w-full h-full px-2.5 flex items-center bg-[#F59E0B]/12 text-[#FDE68A] font-mono text-[9px] truncate">
                  CC • {project.subtitleStyle.replace(/_/g, " ").toUpperCase()} OVERLAY ACTIVE ACROSS{" "}
                  {scenes.length} SCENES
                </div>
              </div>

              {/* Track 4: Auto-Ducked BGM */}
              <div className="flex w-full h-6 rounded-lg overflow-hidden bg-[#09090B] border border-[#27272A]">
                <div className="w-full h-full px-2.5 flex items-center bg-[#38BDF8]/10 text-[#7DD3FC] font-mono text-[9px] truncate">
                  ♫ {BGM_TRACKS.find((b) => b.id === bgmTrack)?.label || "Ambient Bed"}
                </div>
              </div>
            </div>
          </div>

          {/* Left Track Labels Legend */}
          <div className="flex flex-wrap items-center gap-4 px-1 pt-1 font-mono text-[10px] text-[#71717A]">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-[#FF4F28]" /> V1: 60fps Vector Scenes
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-[#10B981]" /> A1: Neural Voiceover
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-[#F59E0B]" /> C1: Word-Synced Subtitles
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-[#38BDF8]" /> A2: Auto-Ducked BGM
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
