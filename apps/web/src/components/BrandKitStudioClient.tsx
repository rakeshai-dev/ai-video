"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { VoicePersona } from "@/lib/ai-generator";
import type {
  BodyFontOption,
  DisplayFontOption,
  MemberBrandKit,
  WatermarkPositionOption,
} from "@/lib/brand-kit";
import type { SubtitleStyle } from "@/lib/projects";

interface BrandKitStudioClientProps {
  initialBrandKit: MemberBrandKit;
  draftProjectsCount: number;
  voices: VoicePersona[];
  elevenlabsConfigured: boolean;
}

const COLOR_THEME_PRESETS: Array<{
  id: string;
  label: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  surfaceColor: string;
}> = [
  {
    id: "obsidian_vermilion",
    label: "Obsidian & Vermilion",
    primaryColor: "#FF4F28",
    secondaryColor: "#F59E0B",
    accentColor: "#10B981",
    surfaceColor: "#09090B",
  },
  {
    id: "cyberpunk",
    label: "Cyberpunk",
    primaryColor: "#EC4899",
    secondaryColor: "#38BDF8",
    accentColor: "#A855F7",
    surfaceColor: "#0B0714",
  },
  {
    id: "emerald_science",
    label: "Emerald Science",
    primaryColor: "#10B981",
    secondaryColor: "#38BDF8",
    accentColor: "#F59E0B",
    surfaceColor: "#07110E",
  },
  {
    id: "solar_kids",
    label: "Solar Kids",
    primaryColor: "#F59E0B",
    secondaryColor: "#FB7185",
    accentColor: "#34D399",
    surfaceColor: "#110E08",
  },
];

const DISPLAY_FONTS: Array<{ id: DisplayFontOption; label: string; styleTag: string }> = [
  { id: "Space Grotesk", label: "Space Grotesk", styleTag: "Technical Geometric" },
  { id: "Plus Jakarta Sans", label: "Plus Jakarta Sans", styleTag: "Modern Editorial" },
  { id: "Montserrat", label: "Montserrat", styleTag: "Bold Viral Impact" },
  { id: "Fredoka", label: "Fredoka", styleTag: "Playful Kids Rounded" },
];

const BODY_FONTS: Array<{ id: BodyFontOption; label: string }> = [
  { id: "Plus Jakarta Sans", label: "Plus Jakarta Sans" },
  { id: "Inter", label: "Inter Clean Sans" },
  { id: "JetBrains Mono", label: "JetBrains Mono" },
];

const SUBTITLE_CARDS: Array<{
  id: SubtitleStyle;
  title: string;
  description: string;
}> = [
  {
    id: "karaoke_highlight",
    title: "Karaoke Word Pill",
    description: "Glass dark pill with active word highlighted in your Primary Keylight.",
  },
  {
    id: "hormozi_pop",
    title: "Hormozi Pop Scale",
    description: "Punchy bold uppercase chunks with pop scale on the spoken word.",
  },
  {
    id: "kids_read_along",
    title: "Kids Read-Along Pill",
    description: "Warm high-contrast storybook card with Signal Accent word highlight.",
  },
  {
    id: "clean_minimal",
    title: "Clean Cinema Lower-Third",
    description: "Minimalist documentary bar with crisp Primary underline cadence.",
  },
];

const PREVIEW_WORDS = ["Sunlight", "hits", "silicon", "as", "PHOTONS"];

function normalizeHexInput(raw: string, fallback: string): string {
  const cleaned = raw.trim().replace(/^#+/, "").toUpperCase();
  if (/^[0-9A-F]{6}$/.test(cleaned)) {
    return `#${cleaned}`;
  }
  return fallback;
}

export default function BrandKitStudioClient({
  initialBrandKit,
  draftProjectsCount,
  voices,
  elevenlabsConfigured,
}: BrandKitStudioClientProps) {
  const router = useRouter();
  const [kit, setKit] = useState<MemberBrandKit>(initialBrandKit);
  const [saving, setSaving] = useState<boolean>(false);
  const [resetting, setResetting] = useState<boolean>(false);
  const [auditioning, setAuditioning] = useState<boolean>(false);
  const [activeWordIdx, setActiveWordIdx] = useState<number>(4);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Animate spoken word highlight in the live 9:16 preview every 750ms
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveWordIdx((prev) => (prev + 1) % PREVIEW_WORDS.length);
    }, 750);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleSaveBrandKit = async () => {
    if (saving) return;
    setSaving(true);
    setBanner(null);
    try {
      const res = await fetch("/api/v1/brand-kit", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryColor: kit.primaryColor,
          secondaryColor: kit.secondaryColor,
          accentColor: kit.accentColor,
          surfaceColor: kit.surfaceColor,
          displayFont: kit.displayFont,
          bodyFont: kit.bodyFont,
          subtitlePreset: kit.subtitlePreset,
          defaultVoiceEngine: kit.defaultVoiceEngine,
          defaultVoiceId: kit.defaultVoiceId,
          watermarkText: kit.watermarkText,
          watermarkPosition: kit.watermarkPosition,
          watermarkOpacity: kit.watermarkOpacity,
          safeZoneGuides: kit.safeZoneGuides,
          syncActiveProjects: kit.syncActiveProjects,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to save Brand Kit.");
      }

      setKit(data.brandKit);
      setBanner({
        type: "ok",
        text:
          kit.syncActiveProjects && data.syncedProjectsCount > 0
            ? `✓ Brand Kit saved & synced across ${data.syncedProjectsCount} active draft project(s)!`
            : "✓ Brand Kit preset saved! Every new 60fps storyboard & MP4 render will use these tokens.",
      });
      router.refresh();
    } catch (err) {
      setBanner({
        type: "err",
        text: err instanceof Error ? err.message : "Could not save Brand Kit.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    if (resetting) return;
    setResetting(true);
    setBanner(null);
    try {
      const res = await fetch("/api/v1/brand-kit/reset", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Reset failed.");
      setKit(data.brandKit);
      setBanner({
        type: "ok",
        text: "Reset Brand Kit to Obsidian Cinema & Electric Vermilion studio defaults.",
      });
      router.refresh();
    } catch (err) {
      setBanner({
        type: "err",
        text: err instanceof Error ? err.message : "Reset failed.",
      });
    } finally {
      setResetting(false);
    }
  };

  const handleExportTokensJson = () => {
    const payload = {
      schema: "animora.brand_kit.v4.1",
      exportedAt: new Date().toISOString(),
      tokens: kit,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `animora-brand-kit-tokens.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAuditionVoice = async () => {
    if (auditioning && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setAuditioning(false);
      return;
    }
    try {
      const audio = new Audio(
        `/api/v1/voices/audition?voiceId=${encodeURIComponent(kit.defaultVoiceId)}`
      );
      audioRef.current = audio;
      setAuditioning(true);
      audio.onended = () => setAuditioning(false);
      audio.onerror = () => setAuditioning(false);
      await audio.play();
    } catch {
      setAuditioning(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Command Strip (Stitch 10A) */}
      <div className="p-5 rounded-2xl bg-[#121216] border border-[#27272A] flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="font-display font-bold text-lg sm:text-xl uppercase tracking-tight text-white">
              Visual Identity &amp; Remotion Tokens
            </h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#10B981]/15 border border-[#10B981]/30 font-mono text-[10px] text-[#9BFFCE] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
              TENANT ISOLATED • REMOTION PROCEDURAL v4.1
            </span>
          </div>
          <p className="text-xs text-[#A1A1AA] max-w-2xl">
            Configure persistent brand colors, typography, word-synced karaoke subtitle
            presets, default neural voice, and Reels safe-zone watermarks auto-injected
            into every 60fps render.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Sync Active Draft Projects Toggle */}
          <label className="px-3 py-2 rounded-xl bg-[#09090B] border border-[#27272A] flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={kit.syncActiveProjects}
              onChange={(e) =>
                setKit((prev) => ({ ...prev, syncActiveProjects: e.target.checked }))
              }
              className="accent-[#10B981] w-4 h-4"
            />
            <div>
              <div className="font-display font-bold text-xs text-white leading-tight">
                Sync Active Projects
              </div>
              <div className="font-mono text-[10px] text-[#10B981]">
                {draftProjectsCount} Draft(s) Bound
              </div>
            </div>
          </label>

          <button
            type="button"
            onClick={handleExportTokensJson}
            className="px-3.5 py-2.5 rounded-xl bg-[#18181D] hover:bg-[#27272A] border border-[#27272A] font-mono text-xs text-[#E4E4E7] inline-flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">code</span>
            <span>Export Tokens (JSON)</span>
          </button>

          <button
            type="button"
            disabled={resetting}
            onClick={() => void handleResetDefaults()}
            className="px-3.5 py-2.5 rounded-xl bg-[#18181D] hover:bg-[#27272A] border border-[#27272A] font-mono text-xs text-[#A1A1AA] hover:text-white"
          >
            {resetting ? "Resetting..." : "Reset Defaults"}
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSaveBrandKit()}
            className="px-4 py-2.5 rounded-xl bg-[#FF4F28] hover:bg-[#FF6542] text-[#09090B] font-display font-bold text-xs uppercase tracking-wide inline-flex items-center gap-1.5 shadow-[0_0_24px_rgba(255,79,40,0.3)] disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">save</span>
            <span>{saving ? "Saving..." : "Save Brand Kit Preset"}</span>
          </button>
        </div>
      </div>

      {banner && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between gap-3 ${
            banner.type === "ok"
              ? "bg-[#10B981]/12 border-[#10B981]/35 text-[#9BFFCE]"
              : "bg-[#EF4444]/15 border-[#EF4444]/40 text-[#FCA5A5]"
          }`}
        >
          <span>{banner.text}</span>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="font-mono text-[11px] underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main 12-Column Workspace: Left 7 Cols Controls + Right 5 Cols Live 9:16 Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT 7 COLS */}
        <div className="lg:col-span-7 space-y-6">
          {/* SECTION 1: Procedural Color Tokens */}
          <section className="p-6 rounded-2xl bg-[#121216] border border-[#27272A] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#18181D] border border-[#27272A] flex items-center justify-center text-[#FF4F28]">
                  <span className="material-symbols-outlined text-[18px]">palette</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-bold text-sm uppercase text-white">
                      Procedural Color Tokens
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-[#18181D] font-mono text-[10px] text-[#FFB4A4]">
                      4 Active Vectors
                    </span>
                  </div>
                  <p className="text-[11px] text-[#A1A1AA]">
                    Remotion vector shader &amp; diagram node accent targets
                  </p>
                </div>
              </div>

              {/* Quick Theme Palette Switcher */}
              <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#09090B] border border-[#27272A]">
                {COLOR_THEME_PRESETS.map((theme) => {
                  const isMatch =
                    kit.primaryColor.toUpperCase() === theme.primaryColor &&
                    kit.secondaryColor.toUpperCase() === theme.secondaryColor;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() =>
                        setKit((prev) => ({
                          ...prev,
                          primaryColor: theme.primaryColor,
                          secondaryColor: theme.secondaryColor,
                          accentColor: theme.accentColor,
                          surfaceColor: theme.surfaceColor,
                        }))
                      }
                      className={`px-2.5 py-1 rounded-lg font-display font-bold text-[11px] transition-colors ${
                        isMatch
                          ? "bg-[#27272A] text-white"
                          : "text-[#A1A1AA] hover:text-white"
                      }`}
                    >
                      {theme.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              {(
                [
                  {
                    key: "primaryColor" as const,
                    code: "KEY-01",
                    label: "Primary Keylight",
                    desc: "Hero vectors, active karaoke word & primary borders",
                  },
                  {
                    key: "secondaryColor" as const,
                    code: "GLOW-02",
                    label: "Secondary Highlight",
                    desc: "Photon paths, callout badges & Hormozi pop scale",
                  },
                  {
                    key: "accentColor" as const,
                    code: "SIG-03",
                    label: "Signal Data Accent",
                    desc: "Verified facts, growth bars & Kids read-along pills",
                  },
                  {
                    key: "surfaceColor" as const,
                    code: "BG-04",
                    label: "Canvas Backdrop",
                    desc: "Deep dark cinema stage background",
                  },
                ] as const
              ).map((token) => (
                <div
                  key={token.key}
                  className="p-3.5 rounded-xl bg-[#09090B] border border-[#27272A] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={kit[token.key]}
                      onChange={(e) =>
                        setKit((prev) => ({
                          ...prev,
                          [token.key]: e.target.value.toUpperCase(),
                        }))
                      }
                      aria-label={`${token.label} color picker`}
                      className="w-9 h-9 rounded-lg border border-[#27272A] bg-transparent cursor-pointer shrink-0"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display font-bold text-xs text-white">
                          {token.label}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-[#18181D] font-mono text-[9px] text-[#FFB4A4]">
                          {token.code}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#A1A1AA]">{token.desc}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#121216] border border-[#27272A] font-mono text-xs self-end sm:self-auto">
                    <span className="text-[#71717A]">#</span>
                    <input
                      type="text"
                      maxLength={6}
                      value={kit[token.key].replace(/^#/, "")}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9A-Fa-f]/g, "").slice(0, 6);
                        if (val.length === 6) {
                          setKit((prev) => ({
                            ...prev,
                            [token.key]: normalizeHexInput(val, prev[token.key]),
                          }));
                        } else {
                          setKit((prev) => ({
                            ...prev,
                            [token.key]: `#${val.toUpperCase().padEnd(6, "0")}`,
                          }));
                        }
                      }}
                      aria-label={`${token.label} hex value`}
                      className="w-16 bg-transparent text-white uppercase outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* SECTION 2: Typography Pairing */}
          <section className="p-6 rounded-2xl bg-[#121216] border border-[#27272A] space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#18181D] border border-[#27272A] flex items-center justify-center text-[#F59E0B]">
                <span className="material-symbols-outlined text-[18px]">
                  font_download
                </span>
              </div>
              <div>
                <h3 className="font-display font-bold text-sm uppercase text-white">
                  Typography Stack
                </h3>
                <p className="text-[11px] text-[#A1A1AA]">
                  Headline display font &amp; body/subtitle font pairing
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A1A1AA] mb-1.5">
                  Display Headline Font
                </label>
                <select
                  value={kit.displayFont}
                  onChange={(e) =>
                    setKit((prev) => ({
                      ...prev,
                      displayFont: e.target.value as DisplayFontOption,
                    }))
                  }
                  aria-label="Display Headline Font"
                  className="w-full px-3 py-2.5 rounded-xl bg-[#09090B] border border-[#27272A] text-xs text-white"
                >
                  {DISPLAY_FONTS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label} — {f.styleTag}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A1A1AA] mb-1.5">
                  Body &amp; Caption Font
                </label>
                <select
                  value={kit.bodyFont}
                  onChange={(e) =>
                    setKit((prev) => ({
                      ...prev,
                      bodyFont: e.target.value as BodyFontOption,
                    }))
                  }
                  aria-label="Body and Caption Font"
                  className="w-full px-3 py-2.5 rounded-xl bg-[#09090B] border border-[#27272A] text-xs text-white"
                >
                  {BODY_FONTS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* SECTION 3: Word-Synced Subtitle Presets (2x2 Cards — Stitch 10A) */}
          <section className="p-6 rounded-2xl bg-[#121216] border border-[#27272A] space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#18181D] border border-[#27272A] flex items-center justify-center text-[#10B981]">
                <span className="material-symbols-outlined text-[18px]">
                  closed_caption
                </span>
              </div>
              <div>
                <h3 className="font-display font-bold text-sm uppercase text-white">
                  Default Word-Synced Subtitle Preset
                </h3>
                <p className="text-[11px] text-[#A1A1AA]">
                  Applied automatically to newly created storyboards &amp; synced drafts
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SUBTITLE_CARDS.map((card) => {
                const active = kit.subtitlePreset === card.id;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() =>
                      setKit((prev) => ({ ...prev, subtitlePreset: card.id }))
                    }
                    className={`p-4 rounded-xl border text-left transition-all space-y-2.5 ${
                      active
                        ? "bg-[#1C181E] border-[#FF4F28] shadow-[0_0_20px_rgba(255,79,40,0.16)]"
                        : "bg-[#09090B] border-[#27272A] hover:border-[#3F3F46]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display font-bold text-xs uppercase text-white">
                        {card.title}
                      </span>
                      <span
                        className={`w-3.5 h-3.5 rounded-full border ${
                          active
                            ? "bg-[#FF4F28] border-[#FF4F28]"
                            : "border-[#52525B]"
                        }`}
                      />
                    </div>
                    <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
                      {card.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* SECTION 4: Voice Engine & Safe-Zone Watermark */}
          <section className="p-6 rounded-2xl bg-[#121216] border border-[#27272A] space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#18181D] border border-[#27272A] flex items-center justify-center text-[#FFB4A4]">
                <span className="material-symbols-outlined text-[18px]">
                  record_voice_over
                </span>
              </div>
              <div>
                <h3 className="font-display font-bold text-sm uppercase text-white">
                  Default Neural Voice &amp; Safe-Zone Watermark
                </h3>
                <p className="text-[11px] text-[#A1A1AA]">
                  Global narrator persona and 9:16 Reels corner watermark placement
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5">
              <div className="flex-1">
                <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A1A1AA] mb-1">
                  Default Voice Persona
                </label>
                <select
                  value={kit.defaultVoiceId}
                  onChange={(e) => {
                    const picked = voices.find((v) => v.voiceId === e.target.value);
                    if (picked) {
                      setKit((prev) => ({
                        ...prev,
                        defaultVoiceId: picked.voiceId,
                        defaultVoiceEngine: picked.provider,
                      }));
                    }
                  }}
                  aria-label="Default Voice Persona"
                  className="w-full px-3 py-2.5 rounded-xl bg-[#09090B] border border-[#27272A] text-xs text-white"
                >
                  {voices.map((v) => (
                    <option key={v.voiceId} value={v.voiceId}>
                      {v.name} ({v.accentAndTone} •{" "}
                      {v.isFreeUnlimited
                        ? "Free Edge Neural"
                        : elevenlabsConfigured
                          ? "ElevenLabs Pro"
                          : "ElevenLabs → Free Fallback"}
                      )
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => void handleAuditionVoice()}
                className="px-4 py-2.5 rounded-xl bg-[#18181D] hover:bg-[#27272A] border border-[#27272A] font-mono text-xs text-[#9BFFCE] inline-flex items-center justify-center gap-1.5 shrink-0"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {auditioning ? "stop_circle" : "volume_up"}
                </span>
                <span>{auditioning ? "Stop Sample" : "Audition Voice"}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#27272A]">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A1A1AA] mb-1">
                  Channel Watermark Text
                </label>
                <input
                  type="text"
                  maxLength={36}
                  value={kit.watermarkText}
                  onChange={(e) =>
                    setKit((prev) => ({ ...prev, watermarkText: e.target.value }))
                  }
                  placeholder="@rohan_explains"
                  className="w-full px-3 py-2 rounded-xl bg-[#09090B] border border-[#27272A] font-mono text-xs text-white"
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A1A1AA] mb-1">
                  Watermark Corner Pin
                </label>
                <select
                  value={kit.watermarkPosition}
                  onChange={(e) =>
                    setKit((prev) => ({
                      ...prev,
                      watermarkPosition: e.target.value as WatermarkPositionOption,
                    }))
                  }
                  aria-label="Watermark Corner Pin"
                  className="w-full px-3 py-2 rounded-xl bg-[#09090B] border border-[#27272A] text-xs text-white"
                >
                  <option value="top-right">Top-Right (Safe Zone)</option>
                  <option value="top-left">Top-Left (Safe Zone)</option>
                  <option value="bottom-right">Bottom-Right (Above Caption)</option>
                  <option value="hidden">Hidden (No Watermark)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center pt-1">
              <div>
                <div className="flex items-center justify-between font-mono text-[10px] mb-1">
                  <span className="text-[#A1A1AA] uppercase">Watermark Opacity</span>
                  <span className="text-[#F59E0B] font-bold">
                    {kit.watermarkOpacity}%
                  </span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={100}
                  step={5}
                  value={kit.watermarkOpacity}
                  onChange={(e) =>
                    setKit((prev) => ({
                      ...prev,
                      watermarkOpacity: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-[#FF4F28]"
                />
              </div>

              <label className="p-3 rounded-xl bg-[#09090B] border border-[#27272A] flex items-center justify-between cursor-pointer">
                <div>
                  <div className="font-display font-bold text-xs text-white">
                    Reels Safe-Zone Wireframe
                  </div>
                  <div className="font-mono text-[10px] text-[#71717A]">
                    Show 96px top / 160px bottom bounds
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={kit.safeZoneGuides}
                  onChange={(e) =>
                    setKit((prev) => ({
                      ...prev,
                      safeZoneGuides: e.target.checked,
                    }))
                  }
                  className="accent-[#38BDF8] w-4 h-4"
                />
              </label>
            </div>
          </section>
        </div>

        {/* RIGHT 5 COLS: Sticky Live 9:16 Brand Kit Preview Stage (Stitch 10A) */}
        <aside className="lg:col-span-5 p-6 rounded-2xl bg-[#121216] border border-[#27272A] lg:sticky lg:top-20 flex flex-col items-center space-y-4">
          <div className="w-full flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-xs uppercase tracking-wider text-white">
                Live 9:16 Brand Kit Stage
              </h3>
              <p className="font-mono text-[10px] text-[#A1A1AA]">
                1080×1920 • {kit.displayFont}
              </p>
            </div>
            <span className="px-2.5 py-0.5 rounded bg-[#10B981]/15 font-mono text-[10px] text-[#9BFFCE] font-bold">
              60FPS LIVE TOKENS
            </span>
          </div>

          {/* 9:16 Vertical Stage */}
          <div
            className="relative w-full max-w-[320px] aspect-[9/16] rounded-2xl overflow-hidden border border-[#27272A] shadow-2xl flex flex-col justify-between p-4 select-none transition-colors duration-300"
            style={{
              backgroundColor: kit.surfaceColor,
              fontFamily: `"${kit.displayFont}", sans-serif`,
            }}
          >
            {/* Optional Instagram Reels Safe-Zone Wireframe Overlay */}
            {kit.safeZoneGuides && (
              <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between">
                <div className="h-14 w-full border-b border-dashed border-[#38BDF8]/45 bg-[#38BDF8]/5 px-2.5 pt-1.5 flex items-start justify-between">
                  <span className="font-mono text-[8px] text-[#7DD3FC] uppercase">
                    Reels Top Safe Zone (96px)
                  </span>
                </div>
                <div className="h-20 w-full border-t border-dashed border-[#38BDF8]/45 bg-[#38BDF8]/5 px-2.5 pb-1.5 flex items-end justify-between">
                  <span className="font-mono text-[8px] text-[#7DD3FC] uppercase">
                    IG Caption &amp; Audio Buffer (160px)
                  </span>
                </div>
              </div>
            )}

            {/* Top Row: Telemetry & Positioned Watermark */}
            <div className="relative z-30 flex items-center justify-between pt-2">
              {kit.watermarkPosition === "top-left" && kit.watermarkText ? (
                <span
                  style={{ opacity: kit.watermarkOpacity / 100 }}
                  className="px-2 py-0.5 rounded bg-black/55 border border-white/15 font-mono text-[10px] text-white"
                >
                  {kit.watermarkText}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded bg-black/50 font-mono text-[9px] text-[#9BFFCE]">
                  ● 60 FPS
                </span>
              )}

              {kit.watermarkPosition === "top-right" && kit.watermarkText && (
                <span
                  style={{ opacity: kit.watermarkOpacity / 100 }}
                  className="px-2 py-0.5 rounded bg-black/55 border border-white/15 font-mono text-[10px] text-white"
                >
                  {kit.watermarkText}
                </span>
              )}
            </div>

            {/* Center Vector Diagram Preview Styled by KEY-01, GLOW-02, SIG-03 */}
            <div className="relative z-10 my-auto space-y-3 px-1">
              <div className="text-center space-y-1">
                <span
                  style={{
                    backgroundColor: `${kit.primaryColor}26`,
                    color: kit.primaryColor,
                    borderColor: `${kit.primaryColor}66`,
                  }}
                  className="inline-block px-2.5 py-0.5 rounded-full border font-mono text-[9px] font-bold uppercase"
                >
                  SCENE 02 • DIAGRAM FLOW
                </span>
                <h4 className="font-bold text-sm text-white leading-snug">
                  Inside a Silicon Solar Cell
                </h4>
              </div>

              <div className="space-y-2">
                <div
                  style={{ borderColor: kit.primaryColor }}
                  className="p-2.5 rounded-xl bg-black/65 border-2 flex items-center justify-between"
                >
                  <div className="text-xs font-bold text-white">
                    ☀️ 1. N-Type Silicon Layer
                  </div>
                  <span
                    style={{ backgroundColor: kit.primaryColor }}
                    className="w-2.5 h-2.5 rounded-full"
                  />
                </div>

                <div className="flex justify-center">
                  <div
                    style={{ backgroundColor: kit.secondaryColor }}
                    className="w-2 h-2 rounded-full animate-bounce"
                  />
                </div>

                <div
                  style={{ borderColor: kit.accentColor }}
                  className="p-2.5 rounded-xl bg-black/65 border flex items-center justify-between"
                >
                  <div className="text-xs font-bold text-white">
                    ⚡ 2. P-N Electric Junction
                  </div>
                  <span
                    style={{ color: kit.accentColor }}
                    className="font-mono text-[10px] font-bold"
                  >
                    94.2% QE
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Live Word-Synced Subtitle Preview */}
            <div className="relative z-30 space-y-2 pb-4">
              {kit.watermarkPosition === "bottom-right" && kit.watermarkText && (
                <div className="flex justify-end">
                  <span
                    style={{ opacity: kit.watermarkOpacity / 100 }}
                    className="px-2 py-0.5 rounded bg-black/55 border border-white/15 font-mono text-[10px] text-white"
                  >
                    {kit.watermarkText}
                  </span>
                </div>
              )}

              <div
                style={{ fontFamily: `"${kit.bodyFont}", sans-serif` }}
                className={`p-2.5 rounded-xl flex flex-wrap items-center justify-center gap-1.5 text-xs ${
                  kit.subtitlePreset === "kids_read_along"
                    ? "bg-[#FFFBEB] text-[#18181B] border-2"
                    : "bg-black/80 text-white border border-white/15"
                }`}
              >
                {PREVIEW_WORDS.map((word, idx) => {
                  const isSpoken = idx === activeWordIdx;
                  if (kit.subtitlePreset === "hormozi_pop") {
                    return (
                      <span
                        key={word}
                        style={{
                          color: isSpoken ? kit.secondaryColor : "#FFFFFF",
                          transform: isSpoken ? "scale(1.14)" : "scale(1)",
                        }}
                        className="font-black uppercase tracking-tight transition-transform inline-block px-1"
                      >
                        {word}
                      </span>
                    );
                  }
                  if (kit.subtitlePreset === "kids_read_along") {
                    return (
                      <span
                        key={word}
                        style={{
                          backgroundColor: isSpoken ? kit.accentColor : "transparent",
                          color: isSpoken ? "#09090B" : "#18181B",
                        }}
                        className="font-bold px-1.5 py-0.5 rounded-md transition-colors"
                      >
                        {word}
                      </span>
                    );
                  }
                  if (kit.subtitlePreset === "clean_minimal") {
                    return (
                      <span
                        key={word}
                        style={{
                          borderBottom: isSpoken
                            ? `2px solid ${kit.primaryColor}`
                            : "2px solid transparent",
                          color: isSpoken ? "#FFFFFF" : "#A1A1AA",
                        }}
                        className="font-medium px-0.5 transition-colors"
                      >
                        {word}
                      </span>
                    );
                  }
                  // karaoke_highlight
                  return (
                    <span
                      key={word}
                      style={{
                        backgroundColor: isSpoken ? kit.primaryColor : "transparent",
                        color: isSpoken ? "#09090B" : "#FFFFFF",
                      }}
                      className="font-bold px-1.5 py-0.5 rounded-md transition-colors"
                    >
                      {word}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="w-full p-3 rounded-xl bg-[#09090B] border border-[#27272A] flex items-center justify-between font-mono text-[10px] text-[#A1A1AA]">
            <span>Voice: {kit.defaultVoiceId}</span>
            <span style={{ color: kit.primaryColor }}>{kit.primaryColor}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
