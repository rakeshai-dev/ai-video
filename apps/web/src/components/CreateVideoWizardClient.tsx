"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import type { AuthenticatedUser } from "@/lib/auth";
import type { BrainstormIdea, VoicePersona } from "@/lib/ai-generator";
import type { SceneType } from "@/lib/projects";

interface CreateVideoWizardClientProps {
  user: AuthenticatedUser;
  voices: VoicePersona[];
  elevenlabsConfigured: boolean;
  initialTopic: string;
  initialTemplate: SceneType;
  initialIdeas: BrainstormIdea[];
  initialProvider: string;
}

const INSPIRATION_PRESETS: Array<{
  emoji: string;
  label: string;
  prompt: string;
  template: SceneType;
}> = [
  {
    emoji: "⚡",
    label: "Solar & Batteries",
    prompt: "Explain how silicon solar panels turn sunlight photons into home AC electricity",
    template: "diagram_flow",
  },
  {
    emoji: "🍎",
    label: "Kids Alphabet & Counting",
    prompt: "Count 1 to 5 shiny orchard apples and learn alphabet letters A to E",
    template: "kids_counting",
  },
  {
    emoji: "🔋",
    label: "EV Myths vs Facts",
    prompt: "3 Myths vs. Real Facts about how lithium-ion EV batteries age in winter",
    template: "split_comparison",
  },
  {
    emoji: "💻",
    label: "Computer Science 101",
    prompt: "How typing a URL loads a website across undersea fiber cables in 200 milliseconds",
    template: "diagram_flow",
  },
];

const ANIMATION_ENGINES: Array<{
  id: SceneType;
  label: string;
  icon: string;
}> = [
  { id: "diagram_flow", label: "Technical Flowchart & Diagrams", icon: "account_tree" },
  { id: "kids_counting", label: "Kids Learning A-Z & Counting", icon: "child_care" },
  { id: "split_comparison", label: "Myth vs. Fact Comparison", icon: "compare" },
  { id: "stat_counter", label: "Data & Stat Charts", icon: "monitoring" },
  { id: "illustrated_motion", label: "Illustrated Motion", icon: "auto_awesome_motion" },
];

const DURATION_OPTIONS: Array<{
  sec: 30 | 60 | 90;
  credits: number;
  wordsLabel: string;
  scenesLabel: string;
  scenesTarget: number;
  popular?: boolean;
}> = [
  { sec: 30, credits: 1, wordsLabel: "~70 Words", scenesLabel: "5–6 Scenes", scenesTarget: 5 },
  {
    sec: 60,
    credits: 2,
    wordsLabel: "~145 Words",
    scenesLabel: "8–10 Scenes",
    scenesTarget: 8,
    popular: true,
  },
  { sec: 90, credits: 3, wordsLabel: "~220 Words", scenesLabel: "12–15 Scenes", scenesTarget: 12 },
];

export default function CreateVideoWizardClient({
  user,
  voices,
  elevenlabsConfigured,
  initialTopic,
  initialTemplate,
  initialIdeas,
  initialProvider,
}: CreateVideoWizardClientProps) {
  const router = useRouter();
  const promptInputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Mode & Prompt State
  const [mode, setMode] = useState<"brainstorm" | "custom_script">("brainstorm");
  const [topicPrompt, setTopicPrompt] = useState(initialTopic);
  const [ideas, setIdeas] = useState<BrainstormIdea[]>(initialIdeas);
  const [selectedIdeaId, setSelectedIdeaId] = useState<string>(initialIdeas[0]?.id || "");
  const [providerUsed, setProviderUsed] = useState<string>(initialProvider);
  const [variationSeed, setVariationSeed] = useState<number>(1);
  const [isBrainstorming, setIsBrainstorming] = useState(false);

  // Custom Script Mode State
  const [customTitle, setCustomTitle] = useState(
    initialIdeas[0]?.title || "How Solar Panels Turn Sunlight Into Home Electricity"
  );
  const [customScript, setCustomScript] = useState(
    "Have you ever wondered how a flat glass panel on your roof powers an entire house using only sunlight?\n\nInside every solar cell are two specially treated silicon layers that create a built-in electric field.\n\nWhen photons strike the silicon atoms, they knock electrons loose into direct electrical current, and your inverter converts that DC power into clean 240V AC electricity for every outlet in your home!"
  );

  // Format, Engine & Voice State
  const [durationSec, setDurationSec] = useState<30 | 60 | 90>(
    initialIdeas[0]?.recommendedDurationSec || 60
  );
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9">("9:16");
  const [primaryTemplate, setPrimaryTemplate] = useState<SceneType>(initialTemplate);
  const [voiceEngine, setVoiceEngine] = useState<"edge_tts" | "elevenlabs">("edge_tts");
  const [voiceId, setVoiceId] = useState<string>(
    initialTemplate === "kids_counting"
      ? "en-US-AnaNeural"
      : initialIdeas[0]?.recommendedVoiceId || "en-US-ChristopherNeural"
  );
  const [voiceSpeed, setVoiceSpeed] = useState<number>(1.0);

  // Audition Playback & Submission State
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState<"draft" | "storyboard" | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Cmd+K / Ctrl+K shortcut to focus topic input
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setMode("brainstorm");
        setTimeout(() => promptInputRef.current?.focus(), 20);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Keep live audio playback speed synced with slider
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = voiceSpeed;
    }
  }, [voiceSpeed]);

  const selectedIdea = ideas.find((i) => i.id === selectedIdeaId) || ideas[0];
  const visibleVoices = voices.filter((v) => v.provider === voiceEngine);
  const activeDurationMeta =
    DURATION_OPTIONS.find((d) => d.sec === durationSec) || DURATION_OPTIONS[1];
  const exportCreditCost =
    activeDurationMeta.credits + (voiceEngine === "elevenlabs" ? 1 : 0);
  const effectiveWpm = Math.round(145 * voiceSpeed);

  const customWordCount = customScript.trim().split(/\s+/).filter(Boolean).length;
  const customEstimatedSec = Math.max(
    10,
    Math.round((customWordCount / Math.max(80, effectiveWpm)) * 60)
  );

  const handleSelectIdea = (idea: BrainstormIdea) => {
    setSelectedIdeaId(idea.id);
    setPrimaryTemplate(idea.recommendedTemplate);
    setDurationSec(idea.recommendedDurationSec);
    if (voiceEngine === "edge_tts" && idea.recommendedVoiceId) {
      setVoiceId(idea.recommendedVoiceId);
    }
  };

  const handleSwitchVoiceEngine = (nextEngine: "edge_tts" | "elevenlabs") => {
    if (audioRef.current) {
      audioRef.current.pause();
      setPlayingVoiceId(null);
    }
    setVoiceEngine(nextEngine);
    const matching = voices.filter((v) => v.provider === nextEngine);
    if (matching.length > 0 && !matching.some((v) => v.voiceId === voiceId)) {
      setVoiceId(matching[0].voiceId);
    }
  };

  const handleToggleAudition = async (e: React.MouseEvent, targetVoiceId: string) => {
    e.stopPropagation();
    if (playingVoiceId === targetVoiceId && audioRef.current) {
      audioRef.current.pause();
      setPlayingVoiceId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    try {
      const audio = new Audio(
        `/api/v1/voices/audition?voiceId=${encodeURIComponent(targetVoiceId)}`
      );
      audio.playbackRate = voiceSpeed;
      audioRef.current = audio;
      setPlayingVoiceId(targetVoiceId);
      audio.onended = () => setPlayingVoiceId(null);
      audio.onerror = () => setPlayingVoiceId(null);
      await audio.play();
    } catch {
      setPlayingVoiceId(null);
    }
  };

  const runBrainstorm = async (overrideTopic?: string, overrideTemplate?: SceneType) => {
    const promptToUse = (overrideTopic ?? topicPrompt).trim();
    if (promptToUse.length < 2) {
      setErrorBanner("Please enter at least 2 characters for your educational topic or niche.");
      return;
    }

    setErrorBanner(null);
    setIsBrainstorming(true);
    const nextSeed = variationSeed + 1;
    setVariationSeed(nextSeed);

    try {
      const res = await fetch("/api/v1/ai/brainstorm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: promptToUse,
          primaryTemplate: overrideTemplate ?? primaryTemplate,
          durationSec,
          variationSeed: nextSeed,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorBanner(data.error || "Could not brainstorm ideas right now.");
        return;
      }

      if (Array.isArray(data.ideas) && data.ideas.length > 0) {
        setIdeas(data.ideas);
        setProviderUsed(data.providerUsed || "animora-topic-engine");
        handleSelectIdea(data.ideas[0]);
      }
    } catch {
      setErrorBanner("Network error while brainstorming concepts.");
    } finally {
      setIsBrainstorming(false);
    }
  };

  const handleCreateProject = async (destination: "draft" | "storyboard") => {
    setErrorBanner(null);
    const resolvedTitle =
      mode === "custom_script"
        ? customTitle.trim()
        : (selectedIdea?.title || topicPrompt).trim();
    const resolvedTopic =
      mode === "custom_script"
        ? customScript.trim().slice(0, 380)
        : (topicPrompt.trim() || selectedIdea?.title || "").trim();

    if (resolvedTitle.length < 3) {
      setErrorBanner("Please provide a video title of at least 3 characters.");
      return;
    }
    if (mode === "custom_script" && customScript.trim().length < 15) {
      setErrorBanner("Please enter at least 15 characters in your custom script or lecture notes.");
      return;
    }

    setSubmittingAction(destination);
    try {
      const res = await fetch("/api/v1/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: resolvedTitle,
          topicPrompt: resolvedTopic || resolvedTitle,
          hookLine: mode === "brainstorm" ? selectedIdea?.hookLine : undefined,
          mode,
          customScript: mode === "custom_script" ? customScript : undefined,
          aspectRatio,
          durationSec,
          primaryTemplate,
          voiceEngine,
          voiceId,
          voiceSpeed,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorBanner(data.error || "Failed to generate project storyboard.");
        setSubmittingAction(null);
        return;
      }

      if (destination === "draft") {
        router.push("/dashboard");
        router.refresh();
      } else {
        router.push(`/dashboard/projects/${data.project.id}/studio`);
        router.refresh();
      }
    } catch {
      setErrorBanner("Network error while creating project storyboard.");
      setSubmittingAction(null);
    }
  };

  const templateLabel = (tpl: SceneType) => {
    switch (tpl) {
      case "kids_counting":
        return "Kids Counting & Alphabet Bounce";
      case "split_comparison":
        return "Dual Split Comparison Engine";
      case "stat_counter":
        return "Animated Stat Counter & Bar Chart";
      case "illustrated_motion":
        return "Illustrated Motion & Camera Rig";
      case "diagram_flow":
      default:
        return "System Flowchart & Bezier Nodes";
    }
  };

  return (
    <DashboardShell
      user={user}
      title="Create New AI Video Explainer"
      subtitle="Step 1 of 4: Topic Ideation, Timing & Voice Architecture"
      actions={
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#18181D] hover:bg-[#27272A] border border-[#27272A] text-xs font-mono text-[#E4E4E7] transition-colors"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          <span className="hidden sm:inline">Back to Dashboard</span>
        </Link>
      }
    >
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 pb-28 lg:pb-10">
        {/* Top Telemetry & 4-Step Pipeline Stepper (Matches Stitch 05A & 05B) */}
        <section className="space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
            <div className="flex items-center gap-2 text-[#9BFFCE]">
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
              <span>ZERO-CREDIT BRAINSTORMING SANDBOX ACTIVE</span>
            </div>
            <div className="flex items-center gap-2 text-[#A1A1AA]">
              <span>AI ENGINE:</span>
              <span className="px-2 py-0.5 rounded bg-[#121216] border border-[#27272A] text-[#F59E0B]">
                {providerUsed}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {[
              { num: "01", status: "Active Step", label: "Brainstorm & Format", active: true },
              { num: "02", status: "Upcoming", label: "Storyboard Studio", active: false },
              { num: "03", status: "Upcoming", label: "Voice & Subtitles", active: false },
              { num: "04", status: "Final", label: "Render & Schedule", active: false },
            ].map((st) => (
              <div
                key={st.num}
                className={`relative flex items-center gap-3 p-3 rounded-xl border transition-all overflow-hidden ${
                  st.active
                    ? "bg-[#16161C] border-[#FF4F28]/60 shadow-[0_0_24px_rgba(255,79,40,0.12)]"
                    : "bg-[#121216] border-[#27272A] opacity-60"
                }`}
              >
                {st.active && <div className="absolute left-0 inset-y-0 w-1 bg-[#FF4F28]" />}
                <div
                  className={`w-7 h-7 rounded-lg font-mono text-xs font-bold flex items-center justify-center flex-shrink-0 ${
                    st.active
                      ? "bg-[#FF4F28] text-[#09090B] shadow-[0_0_12px_rgba(255,79,40,0.4)]"
                      : "bg-[#18181D] text-[#A1A1AA]"
                  }`}
                >
                  {st.num}
                </div>
                <div className="min-w-0">
                  <div
                    className={`text-[9px] font-mono uppercase tracking-wider font-semibold ${
                      st.active ? "text-[#FF4F28]" : "text-[#71717A]"
                    }`}
                  >
                    {st.status}
                  </div>
                  <div className="text-xs font-display font-bold text-white truncate">
                    {st.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {errorBanner && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/50 text-[#FCA5A5] text-xs flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#EF4444] text-lg">error</span>
              <span>{errorBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorBanner(null)}
              className="text-[#A1A1AA] hover:text-white"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        )}

        {/* MAIN 2-COLUMN WIZARD GRID (7 Cols Left Ideation + 5 Cols Right Config on lg+) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: Mode Switcher + Brainstorm / Custom Script */}
          <div className="lg:col-span-7 space-y-5">
            {/* Segmented Mode Switcher */}
            <div className="p-1 rounded-xl bg-[#121216] border border-[#27272A] grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => setMode("brainstorm")}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg font-display text-xs font-bold transition-all ${
                  mode === "brainstorm"
                    ? "bg-gradient-to-r from-[#FF4F28] to-[#FF7859] text-[#09090B] shadow-md"
                    : "text-[#A1A1AA] hover:text-white hover:bg-[#18181D]"
                }`}
              >
                <span className="material-symbols-outlined text-base">auto_awesome</span>
                <span>Ask AI to Brainstorm Ideas</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("custom_script")}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg font-display text-xs font-bold transition-all ${
                  mode === "custom_script"
                    ? "bg-gradient-to-r from-[#FF4F28] to-[#FF7859] text-[#09090B] shadow-md"
                    : "text-[#A1A1AA] hover:text-white hover:bg-[#18181D]"
                }`}
              >
                <span className="material-symbols-outlined text-base">edit_note</span>
                <span>I Have My Own Script / Notes</span>
              </button>
            </div>

            {mode === "brainstorm" ? (
              <>
                {/* Creative Prompt & Inspiration Box */}
                <div className="p-5 rounded-2xl bg-[#121216] border border-[#27272A] space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#FF4F28] text-lg">
                        psychology
                      </span>
                      <span className="text-[10px] font-mono tracking-widest uppercase font-bold text-white">
                        TARGET EDUCATIONAL NICHE OR PROMPT
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#18181D] border border-[#27272A] text-[10px] font-mono text-[#9BFFCE]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                      <span>Gemini 2.5 Flash + Groq Llama 3.3</span>
                    </span>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      runBrainstorm();
                    }}
                    className="relative flex items-center"
                  >
                    <span className="material-symbols-outlined absolute left-3.5 text-[#71717A] text-xl pointer-events-none">
                      search
                    </span>
                    <input
                      ref={promptInputRef}
                      type="text"
                      value={topicPrompt}
                      onChange={(e) => setTopicPrompt(e.target.value)}
                      placeholder="e.g. How semiconductors work, or Kids counting 1 to 5..."
                      className="w-full bg-[#09090B] border border-[#27272A] focus:border-[#FF4F28] rounded-xl pl-11 pr-20 py-3.5 text-sm text-white placeholder:text-[#71717A] focus:outline-none transition-colors"
                    />
                    <kbd className="hidden sm:inline-block absolute right-3 px-2 py-1 rounded bg-[#18181D] border border-[#27272A] text-[10px] font-mono text-[#A1A1AA]">
                      Ctrl+K
                    </kbd>
                  </form>

                  {/* Quick Inspiration Chips */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-[#71717A]">
                      Quick Inspiration Presets:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {INSPIRATION_PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          disabled={isBrainstorming}
                          onClick={() => {
                            setTopicPrompt(preset.prompt);
                            setPrimaryTemplate(preset.template);
                            runBrainstorm(preset.prompt, preset.template);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-[#18181D] hover:bg-[#27272A] border border-[#27272A] text-xs text-[#E4E4E7] transition-colors inline-flex items-center gap-1.5"
                        >
                          <span>{preset.emoji}</span>
                          <span>{preset.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Prompt Action Footer */}
                  <div className="pt-2 border-t border-[#27272A] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-[#A1A1AA]">
                      <span className="material-symbols-outlined text-[#10B981] text-base">
                        verified
                      </span>
                      <span>AI generates hook-driven educational angles &amp; diagram structures</span>
                    </div>
                    <button
                      type="button"
                      disabled={isBrainstorming}
                      onClick={() => runBrainstorm()}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#18181D] hover:bg-[#27272A] border border-[#FF4F28]/40 text-[#FFB4A4] font-display font-bold text-xs transition-all disabled:opacity-50"
                    >
                      <span
                        className={`material-symbols-outlined text-base ${
                          isBrainstorming ? "animate-spin" : ""
                        }`}
                      >
                        refresh
                      </span>
                      <span>
                        {isBrainstorming
                          ? "Brainstorming 5 Concepts..."
                          : "Re-generate 5 Fresh Hooks (0 Credits)"}
                      </span>
                    </button>
                  </div>
                </div>

                {/* 5 Generated Concept Cards Stack */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                        5 Generated Video Concepts
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-[#FF4F28]/15 border border-[#FF4F28]/30 text-[#FFB4A4] font-mono text-[10px] font-bold">
                        1 SELECTED
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-[#71717A] hidden sm:inline">
                      Click any card to load format &amp; engine
                    </span>
                  </div>

                  <div className="space-y-3">
                    {ideas.map((idea, index) => {
                      const selected = idea.id === selectedIdea?.id;
                      return (
                        <div
                          key={idea.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleSelectIdea(idea)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleSelectIdea(idea);
                            }
                          }}
                          className={`relative p-4 rounded-2xl border transition-all cursor-pointer ${
                            selected
                              ? "bg-[#17171E] border-[#FF4F28] shadow-[0_0_28px_rgba(255,79,40,0.14)]"
                              : "bg-[#121216] border-[#27272A] hover:border-[#3F3F46]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1.5 min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase ${
                                    selected
                                      ? "bg-[#FF4F28] text-[#09090B]"
                                      : "bg-[#18181D] text-[#A1A1AA]"
                                  }`}
                                >
                                  CONCEPT 0{index + 1}
                                </span>
                                <span className="px-2 py-0.5 rounded bg-[#09090B] border border-[#27272A] font-mono text-[10px] text-[#9BFFCE]">
                                  {idea.badge}
                                </span>
                              </div>
                              <h3 className="font-display font-bold text-sm sm:text-base text-white leading-snug">
                                {idea.title}
                              </h3>
                            </div>

                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                                selected
                                  ? "bg-[#FF4F28] text-[#09090B]"
                                  : "bg-[#18181D] text-[#71717A]"
                              }`}
                            >
                              <span className="material-symbols-outlined text-base font-bold">
                                {selected ? "check" : "radio_button_unchecked"}
                              </span>
                            </div>
                          </div>

                          <div
                            className={`mt-3 p-3 rounded-xl bg-[#09090B] text-xs leading-relaxed ${
                              selected ? "border-l-2 border-[#FF4F28]" : "border border-[#27272A]"
                            }`}
                          >
                            <p className="text-[#E4E4E7] font-medium">&ldquo;{idea.hookLine}&rdquo;</p>
                            {selected && (
                              <p className="mt-1.5 text-[11px] font-mono text-[#71717A]">
                                → Visual cue: {idea.visualConcept}
                              </p>
                            )}
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-mono text-[#A1A1AA]">
                            <span className="px-2 py-0.5 rounded bg-[#18181D] text-[#F59E0B]">
                              Engine: {templateLabel(idea.recommendedTemplate)}
                            </span>
                            <span>•</span>
                            <span>{idea.recommendedDurationSec}s Target</span>
                            <span>•</span>
                            <span>{aspectRatio}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              /* MODE 2: CUSTOM SCRIPT / LECTURE NOTES EDITOR */
              <div className="p-5 sm:p-6 rounded-2xl bg-[#121216] border border-[#27272A] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#FF4F28] font-bold">
                      DIRECT SCRIPT TO 60FPS STORYBOARD
                    </span>
                    <h2 className="font-display font-bold text-lg text-white mt-0.5">
                      Paste Your Own Script, Syllabus, or Lecture Notes
                    </h2>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-[#18181D] border border-[#27272A] font-mono text-[10px] text-[#9BFFCE]">
                    {customWordCount} words • ~{customEstimatedSec}s
                  </span>
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[#A1A1AA] mb-1.5">
                    Video Project Title
                  </label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="e.g. How Solar Panels Convert Photons Into Home Power"
                    className="w-full bg-[#09090B] border border-[#27272A] focus:border-[#FF4F28] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-mono text-[10px] uppercase tracking-widest text-[#A1A1AA]">
                      Spoken Narration Script or Bullet Notes
                    </label>
                    <span className="font-mono text-[10px] text-[#71717A]">
                      Separate scenes with blank lines or sentences
                    </span>
                  </div>
                  <textarea
                    rows={9}
                    value={customScript}
                    onChange={(e) => setCustomScript(e.target.value)}
                    placeholder="Paste your narration script or bullet points here..."
                    className="w-full bg-[#09090B] border border-[#27272A] focus:border-[#FF4F28] rounded-xl p-3.5 text-sm text-white leading-relaxed focus:outline-none"
                  />
                </div>

                <div className="p-3 rounded-xl bg-[#09090B] border border-[#27272A] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[#A1A1AA]">
                  <span>
                    Auto-splitting into{" "}
                    <strong className="text-white">{activeDurationMeta.scenesLabel}</strong> using{" "}
                    <strong className="text-[#F59E0B]">{templateLabel(primaryTemplate)}</strong>
                  </span>
                  <span className="text-[#10B981]">Word-Timestamp Sync Active</span>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Format, Aspect Ratio, Engine & Dual Voiceover Configuration */}
          <div className="lg:col-span-5 space-y-5">
            {/* 1. Target Duration & Pacing */}
            <div className="p-5 rounded-2xl bg-[#121216] border border-[#27272A] space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-white">
                  1. TARGET DURATION &amp; PACING
                </span>
                <span className="px-2 py-0.5 rounded bg-[#18181D] border border-[#27272A] text-[10px] font-mono text-[#F59E0B] font-semibold">
                  REELS OPTIMIZED
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {DURATION_OPTIONS.map((opt) => {
                  const active = durationSec === opt.sec;
                  return (
                    <button
                      key={opt.sec}
                      type="button"
                      onClick={() => setDurationSec(opt.sec)}
                      className={`relative p-3 rounded-xl border text-left transition-all ${
                        active
                          ? "bg-[#18181F] border-[#FF4F28] shadow-[0_0_20px_rgba(255,79,40,0.14)]"
                          : "bg-[#09090B] border-[#27272A] hover:border-[#3F3F46]"
                      }`}
                    >
                      {opt.popular && (
                        <span className="absolute -top-2 right-2 px-1.5 py-0.5 rounded bg-[#FF4F28] text-[#09090B] font-mono text-[8px] font-bold uppercase">
                          POPULAR
                        </span>
                      )}
                      <span
                        className={`block text-xs font-display font-bold ${
                          active ? "text-[#FF4F28]" : "text-white"
                        }`}
                      >
                        {opt.sec} Sec
                      </span>
                      <span className="block text-[10px] font-mono text-[#A1A1AA] mt-0.5">
                        {opt.credits} Credit{opt.credits > 1 ? "s" : ""}
                      </span>
                      <span className="block text-[10px] text-[#E4E4E7] mt-2 font-medium">
                        {opt.wordsLabel}
                      </span>
                      <span className="block text-[9px] font-mono text-[#71717A]">
                        {opt.scenesLabel}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="p-2.5 rounded-xl bg-[#09090B] border border-[#27272A] flex items-center gap-2 text-[10px] font-mono text-[#9BFFCE]">
                <span className="material-symbols-outlined text-sm text-[#10B981]">speed</span>
                <span>
                  PACING: ~{effectiveWpm} WPM ({voiceSpeed.toFixed(2)}x) •{" "}
                  {activeDurationMeta.scenesLabel} Dynamic Cuts
                </span>
              </div>
            </div>

            {/* 2. Aspect Ratio & Canvas */}
            <div className="p-5 rounded-2xl bg-[#121216] border border-[#27272A] space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-white">
                  2. ASPECT RATIO &amp; CANVAS
                </span>
                <span className="text-[10px] font-mono text-[#71717A]">MULTI-PLATFORM READY</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAspectRatio("9:16")}
                  className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${
                    aspectRatio === "9:16"
                      ? "bg-[#18181F] border-[#FF4F28]"
                      : "bg-[#09090B] border-[#27272A] opacity-75 hover:opacity-100"
                  }`}
                >
                  <div className="w-8 h-12 rounded bg-[#FF4F28]/20 border border-[#FF4F28]/40 flex items-center justify-center flex-shrink-0">
                    <span className="text-[9px] font-mono font-bold text-[#FFB4A4]">9:16</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-xs font-display font-bold text-white">
                        9:16 Vertical
                      </span>
                      <span className="px-1 py-0.5 rounded bg-[#FF4F28] text-[#09090B] text-[8px] font-mono font-bold">
                        Reels
                      </span>
                    </div>
                    <span className="block text-[10px] font-mono text-[#71717A] mt-0.5">
                      1080 × 1920 FHD
                    </span>
                    <span className="block text-[10px] text-[#A1A1AA] mt-0.5">
                      IG Reels, Shorts
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setAspectRatio("16:9")}
                  className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${
                    aspectRatio === "16:9"
                      ? "bg-[#18181F] border-[#FF4F28]"
                      : "bg-[#09090B] border-[#27272A] opacity-75 hover:opacity-100"
                  }`}
                >
                  <div className="w-12 h-8 rounded bg-[#18181D] border border-[#3F3F46] flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-[9px] font-mono font-bold text-[#E4E4E7]">16:9</span>
                  </div>
                  <div className="min-w-0">
                    <span className="block text-xs font-display font-bold text-white">
                      16:9 Horizontal
                    </span>
                    <span className="block text-[10px] font-mono text-[#71717A] mt-0.5">
                      1920 × 1080 FHD
                    </span>
                    <span className="block text-[10px] text-[#A1A1AA] mt-0.5">
                      YouTube &amp; Courses
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* 3. Primary Animation Preset */}
            <div className="p-5 rounded-2xl bg-[#121216] border border-[#27272A] space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-white">
                  3. PRIMARY ANIMATION PRESET
                </span>
                <span className="text-[10px] font-mono text-[#10B981]">100% PROGRAMMATIC 60FPS</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {ANIMATION_ENGINES.map((eng) => {
                  const active = primaryTemplate === eng.id;
                  return (
                    <button
                      key={eng.id}
                      type="button"
                      onClick={() => {
                        setPrimaryTemplate(eng.id);
                        if (eng.id === "kids_counting" && voiceEngine === "edge_tts") {
                          setVoiceId("en-US-AnaNeural");
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-display font-semibold border transition-all inline-flex items-center gap-1.5 ${
                        active
                          ? "bg-[#FF4F28] text-[#09090B] border-[#FF4F28] font-bold shadow-sm"
                          : "bg-[#09090B] text-[#A1A1AA] border-[#27272A] hover:text-white hover:border-[#3F3F46]"
                      }`}
                    >
                      <span className="material-symbols-outlined text-base">{eng.icon}</span>
                      <span>{eng.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Voiceover Engine & 2x2 Persona Audition Grid */}
            <div className="p-5 rounded-2xl bg-[#121216] border border-[#27272A] space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-white">
                  4. VOICEOVER ENGINE &amp; PERSONA
                </span>
                <span className="text-[10px] font-mono text-[#F59E0B]">
                  Karaoke Word-Sync Ready
                </span>
              </div>

              {/* Dual Engine Toggle */}
              <div className="p-1 rounded-xl bg-[#09090B] border border-[#27272A] grid grid-cols-2 gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => handleSwitchVoiceEngine("edge_tts")}
                  className={`py-2 px-2.5 rounded-lg font-display font-bold transition-all ${
                    voiceEngine === "edge_tts"
                      ? "bg-[#18181D] text-white border border-[#3F3F46]"
                      : "text-[#71717A] hover:text-white"
                  }`}
                >
                  Edge Neural (Free • 0 CR)
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchVoiceEngine("elevenlabs")}
                  className={`py-2 px-2.5 rounded-lg font-display font-bold transition-all flex items-center justify-center gap-1 ${
                    voiceEngine === "elevenlabs"
                      ? "bg-[#18181D] text-[#FCD34D] border border-[#F59E0B]/50"
                      : "text-[#71717A] hover:text-white"
                  }`}
                >
                  <span>ElevenLabs Pro</span>
                  <span className="text-[9px] font-mono text-[#F59E0B]">(+1 CR)</span>
                </button>
              </div>

              {voiceEngine === "elevenlabs" && !elevenlabsConfigured && (
                <div className="p-2.5 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[11px] font-mono text-[#FCD34D]">
                  Auto-Fallback Active: Add real ELEVENLABS_API_KEY in .env.local for live studio clones; renders automatically fall back to Free Edge Neural TTS.
                </div>
              )}

              {/* 2x2 Voice Persona Audition Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {visibleVoices.map((v) => {
                  const selected = voiceId === v.voiceId;
                  const isPlaying = playingVoiceId === v.voiceId;
                  return (
                    <div
                      key={v.voiceId}
                      role="button"
                      tabIndex={0}
                      onClick={() => setVoiceId(v.voiceId)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setVoiceId(v.voiceId);
                        }
                      }}
                      className={`p-3 rounded-xl border space-y-2 cursor-pointer transition-all ${
                        selected
                          ? "bg-[#18181F] border-[#FF4F28] shadow-md"
                          : "bg-[#09090B] border-[#27272A] hover:border-[#3F3F46]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center font-mono font-bold text-[11px] flex-shrink-0 ${
                              selected
                                ? "bg-[#FF4F28]/20 text-[#FFB4A4]"
                                : "bg-[#18181D] text-[#A1A1AA]"
                            }`}
                          >
                            {v.initials}
                          </div>
                          <div className="min-w-0">
                            <span className="block text-xs font-display font-bold text-white truncate">
                              {v.name}
                            </span>
                            <span className="block text-[9px] font-mono text-[#71717A] truncate">
                              {v.accentAndTone}
                            </span>
                          </div>
                        </div>

                        {selected && (
                          <span className="material-symbols-outlined text-[#FF4F28] text-base flex-shrink-0">
                            check_circle
                          </span>
                        )}
                      </div>

                      {/* Audition Bar */}
                      <div className="p-1.5 rounded-lg bg-[#121216] border border-[#27272A] flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => handleToggleAudition(e, v.voiceId)}
                          aria-label={`Audition ${v.name} voice`}
                          className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                            isPlaying || selected
                              ? "bg-[#FF4F28] text-[#09090B]"
                              : "bg-[#27272A] text-white hover:bg-[#3F3F46]"
                          }`}
                        >
                          <span className="material-symbols-outlined text-sm font-bold">
                            {isPlaying ? "pause" : "play_arrow"}
                          </span>
                        </button>

                        <div className="flex-1 flex items-center gap-1 h-3">
                          {[2, 3, 1.5, 2.5, 1, 3, 2, 1.5].map((h, i) => (
                            <span
                              key={i}
                              style={{ height: `${h * 4}px` }}
                              className={`w-1 rounded-full ${
                                isPlaying
                                  ? "bg-[#FF4F28] animate-pulse"
                                  : selected
                                  ? "bg-[#FF4F28]/70"
                                  : "bg-[#3F3F46]"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-[9px] font-mono text-[#71717A]">
                          {isPlaying ? "LIVE" : v.sampleDuration}
                        </span>
                      </div>

                      <span className="block text-[10px] text-[#A1A1AA] truncate">
                        Ideal for: {v.idealFor}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Speech Delivery Cadence Slider */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[11px] text-[#A1A1AA]">Speech Delivery Cadence</span>
                  <span className="font-mono text-[#FF4F28] font-bold text-[11px]">
                    {voiceSpeed.toFixed(2)}x ({effectiveWpm} WPM)
                  </span>
                </div>
                <input
                  type="range"
                  min={0.8}
                  max={1.3}
                  step={0.05}
                  value={voiceSpeed}
                  onChange={(e) => setVoiceSpeed(Number.parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-[#27272A] rounded-lg appearance-none cursor-pointer accent-[#FF4F28]"
                />
                <div className="flex items-center justify-between text-[9px] font-mono text-[#71717A]">
                  <span>0.80x Deliberate</span>
                  <span>1.00x Natural</span>
                  <span>1.30x Fast Hook</span>
                </div>
              </div>
            </div>

            {/* 5. Execution Action Card */}
            <div className="p-5 rounded-2xl bg-[#16161C] border border-[#27272A] shadow-xl space-y-4">
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#09090B] border border-[#27272A] text-xs text-[#A1A1AA] leading-relaxed">
                <span className="material-symbols-outlined text-[#10B981] text-lg flex-shrink-0 mt-0.5">
                  verified_user
                </span>
                <span>
                  Storyboard generation &amp; 60fps browser previews are{" "}
                  <strong className="text-white">100% Free (0 Credits)</strong>.{" "}
                  {exportCreditCost} Credit{exportCreditCost > 1 ? "s" : ""} charged only when you
                  export full 1080p MP4.
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <button
                  type="button"
                  disabled={submittingAction !== null}
                  onClick={() => handleCreateProject("draft")}
                  className="px-4 py-3 rounded-xl bg-[#09090B] hover:bg-[#18181D] border border-[#27272A] text-[#E4E4E7] font-display font-semibold text-xs transition-colors disabled:opacity-50"
                >
                  {submittingAction === "draft" ? "Saving..." : "Save as Draft"}
                </button>

                <button
                  type="button"
                  disabled={submittingAction !== null}
                  onClick={() => handleCreateProject("storyboard")}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-br from-[#FFB4A4] to-[#FF4F28] text-[#09090B] font-display font-bold text-xs shadow-lg shadow-[#FF4F28]/25 hover:opacity-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  <span>
                    {submittingAction === "storyboard"
                      ? "Generating Timed Storyboard..."
                      : `Generate Script & ${activeDurationMeta.scenesTarget}-Scene Storyboard`}
                  </span>
                  <span className="material-symbols-outlined text-base font-bold">
                    arrow_forward
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
