"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { VideoProjectDetail } from "@/lib/projects";
import type { CreditLedgerEntry, RenderJobRecord } from "@/lib/render-engine";

interface RenderPublishClientProps {
  initialProject: VideoProjectDetail;
  initialRender: RenderJobRecord | null;
  initialLedger: CreditLedgerEntry[];
  initialCreditsBalance: number;
  requiredCredits: number;
  tierLabel: string;
  userHandle: string;
  instagramConnected: boolean;
}

type CaptionTone = "educational" | "kids" | "viral";

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "—";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatClockTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

export default function RenderPublishClient({
  initialProject,
  initialRender,
  initialLedger,
  initialCreditsBalance,
  requiredCredits,
  tierLabel,
  userHandle,
  instagramConnected,
}: RenderPublishClientProps) {
  const [project, setProject] = useState<VideoProjectDetail>(initialProject);
  const [latestRender, setLatestRender] = useState<RenderJobRecord | null>(initialRender);
  const [ledger, setLedger] = useState<CreditLedgerEntry[]>(initialLedger);
  const [creditsBalance, setCreditsBalance] = useState<number>(initialCreditsBalance);

  // Export configuration
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9">(
    initialRender?.aspectRatio || initialProject.aspectRatio
  );
  const [fps, setFps] = useState<30 | 60>(initialRender?.fps === 60 ? 60 : 30);
  const [startingRender, setStartingRender] = useState<boolean>(false);

  // Zero-Credits Modal state (Stitch 14A Panel 02)
  const [showZeroCreditsModal, setShowZeroCreditsModal] = useState<boolean>(false);
  const [selectedTopupPack, setSelectedTopupPack] = useState<"25_cr" | "60_cr">("60_cr");
  const [toppingUp, setToppingUp] = useState<boolean>(false);

  // Video player & copy helpers
  const [videoCurrentSec, setVideoCurrentSec] = useState<number>(0);
  const [videoDurationSec, setVideoDurationSec] = useState<number>(0);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [copiedCaption, setCopiedCaption] = useState<boolean>(false);
  const [captionTone, setCaptionTone] = useState<CaptionTone>("educational");
  const [actionError, setActionError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);

  const refreshRenderState = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/projects/${project.id}/render`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.project) setProject(data.project);
      if (data.latestRender !== undefined) setLatestRender(data.latestRender);
      if (Array.isArray(data.recentLedger)) setLedger(data.recentLedger);
      if (typeof data.creditsBalance === "number") setCreditsBalance(data.creditsBalance);
    } catch {
      // ignore transient network poll hiccups
    }
  }, [project.id]);

  const isRendering =
    latestRender?.status === "queued" || latestRender?.status === "rendering";

  // Connect real-time SSE stream + fallback polling while rendering
  useEffect(() => {
    if (!isRendering) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    if (typeof window !== "undefined" && "EventSource" in window) {
      const es = new EventSource(`/api/v1/projects/${project.id}/events`);
      eventSourceRef.current = es;

      es.addEventListener("progress", (evt) => {
        try {
          const parsed = JSON.parse((evt as MessageEvent).data);
          if (parsed.render) {
            setLatestRender(parsed.render);
          }
          if (typeof parsed.credits_balance === "number") {
            setCreditsBalance(parsed.credits_balance);
          }
          if (parsed.phase === "render_complete" || parsed.phase === "render_failed") {
            es.close();
            void refreshRenderState();
          }
        } catch {
          // ignore malformed SSE event
        }
      });

      es.onerror = () => {
        es.close();
      };
    }

    const pollTimer = setInterval(() => {
      void refreshRenderState();
    }, 1500);

    return () => {
      clearInterval(pollTimer);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [isRendering, project.id, refreshRenderState]);

  const startRender = async (overrideSkipBalanceCheck = false) => {
    setActionError(null);

    if (!overrideSkipBalanceCheck && creditsBalance < requiredCredits) {
      setShowZeroCreditsModal(true);
      return;
    }

    setStartingRender(true);
    try {
      const res = await fetch(`/api/v1/projects/${project.id}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aspectRatio, fps }),
      });
      const data = await res.json();

      if (res.status === 402 || data?.code === "INSUFFICIENT_CREDITS") {
        if (typeof data?.currentBalance === "number") {
          setCreditsBalance(data.currentBalance);
        }
        setShowZeroCreditsModal(true);
        return;
      }

      if (!res.ok) {
        throw new Error(data?.error || "Could not start 1080p MP4 render.");
      }

      if (data.render) {
        setLatestRender(data.render);
      }
      if (typeof data.remainingBalance === "number") {
        setCreditsBalance(data.remainingBalance);
      }
      await refreshRenderState();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to start render.");
    } finally {
      setStartingRender(false);
    }
  };

  const handleTopUpAndResume = async () => {
    if (toppingUp) return;
    setToppingUp(true);
    setActionError(null);
    try {
      const res = await fetch("/api/v1/credits/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack: selectedTopupPack }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Top-up failed.");
      }
      setCreditsBalance(data.creditsBalance);
      setShowZeroCreditsModal(false);
      await startRender(true);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Credit top-up failed.");
    } finally {
      setToppingUp(false);
    }
  };

  // Determine playable MP4 URL (from completed render job or pre-seeded demo project)
  const playableMp4Url = useMemo(() => {
    if (latestRender?.status === "completed" && latestRender.outputMp4Url) {
      return latestRender.outputMp4Url;
    }
    if (project.mp4Path) {
      return `/api/v1/projects/${project.id}/video`;
    }
    return null;
  }, [latestRender, project.id, project.mp4Path]);

  const downloadMp4Url = useMemo(() => {
    if (!playableMp4Url) return null;
    return playableMp4Url.includes("?")
      ? `${playableMp4Url}&download=1`
      : `${playableMp4Url}?download=1`;
  }, [playableMp4Url]);

  const totalStoryboardMs = useMemo(
    () => project.scenes.reduce((acc, s) => acc + (s.duration_ms || 5000), 0),
    [project.scenes]
  );

  const estimatedFrames =
    latestRender?.totalFrames ||
    Math.max(fps * 2, Math.ceil((totalStoryboardMs / 1000) * fps));

  const generatedCaptions = useMemo<Record<CaptionTone, string>>(() => {
    const headlines = project.scenes
      .slice(0, 3)
      .map((s, idx) => `${idx + 1}. ${s.on_screen_headline}`)
      .join("\n");
    return {
      educational: `${project.title} — explained visually step by step!\n\n${headlines}\n\nSave this Reel for quick revision & follow @${userHandle} for more animated breakdowns.\n\n#AnimatedExplainer #STEMEducation #LearnOnReels #AnimoraStudio`,
      kids: `Let's learn together: ${project.title}! 🌟\n\nCount, read along with highlighted words, and explore step by step:\n${headlines}\n\n#KidsLearning #EarlyEducation #ReadAlong #AnimatedKids`,
      viral: `99% of people get this wrong about ${project.title} ⚡👇\n\nWatch till Scene ${project.scenes.length} to see how it actually works:\n${headlines}\n\n#ExplainerVideo #TechFacts #VisualLearning #ReelsGrowth`,
    };
  }, [project.scenes, project.title, userHandle]);

  const progressPct =
    latestRender?.status === "completed"
      ? 100
      : isRendering
        ? Math.max(5, latestRender?.progressPct || 8)
        : playableMp4Url
          ? 100
          : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-7">
      {/* Horizontal 4-Step Progress Stepper (Stitch 07A) */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-[#27272A]">
        <div className="flex flex-wrap items-center gap-3 sm:gap-5">
          {[
            { num: "01", label: "Script & Voice", done: true },
            { num: "02", label: "Vector Diagrams", done: true },
            { num: "03", label: "Karaoke Subtitles", done: true },
            { num: "04", label: "Render & Publish", done: false },
          ].map((step, i) => (
            <React.Fragment key={step.num}>
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-display font-bold text-xs ${
                    step.done
                      ? "bg-[#10B981]/20 border border-[#10B981]/40 text-[#9BFFCE]"
                      : "bg-[#FF4F28] text-[#09090B] ring-4 ring-[#FF4F28]/20"
                  }`}
                >
                  {step.done ? (
                    <span className="material-symbols-outlined text-[15px]">check</span>
                  ) : (
                    step.num
                  )}
                </div>
                <div>
                  <div
                    className={`font-mono text-[10px] uppercase tracking-wider ${
                      step.done ? "text-[#71717A]" : "text-[#FFB4A4] font-bold"
                    }`}
                  >
                    Step {step.num}
                  </div>
                  <div className="font-display font-bold text-xs text-white">
                    {step.label}
                  </div>
                </div>
              </div>
              {i < 3 && (
                <div
                  className={`hidden sm:block w-8 h-px ${
                    i === 2 ? "bg-[#FF4F28]" : "bg-[#27272A]"
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-full bg-[#121216] border border-[#27272A] font-mono text-xs text-[#F59E0B] inline-flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[15px]">bolt</span>
            <span>{creditsBalance} Credits Available</span>
          </div>
          <Link
            href={`/dashboard/projects/${project.id}/studio`}
            className="px-3.5 py-1.5 rounded-xl bg-[#18181D] hover:bg-[#27272A] border border-[#27272A] font-display font-bold text-xs text-[#E4E4E7]"
          >
            ← Back to Studio
          </Link>
        </div>
      </div>

      {actionError && (
        <div className="p-4 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/40 text-xs text-[#FCA5A5] flex items-center justify-between gap-3">
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="font-mono text-[11px] underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Two-Column Export & Publish Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (7 cols): Render Telemetry, Failure Recovery & 1080p MP4 Player */}
        <div className="lg:col-span-7 space-y-6">
          {/* Pipeline Telemetry & Render Trigger Card */}
          <section className="p-6 rounded-2xl bg-[#121216] border border-[#27272A] relative overflow-hidden space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    latestRender?.status === "failed"
                      ? "bg-[#EF4444]"
                      : isRendering
                        ? "bg-[#F59E0B] animate-ping"
                        : playableMp4Url
                          ? "bg-[#10B981] animate-pulse"
                          : "bg-[#71717A]"
                  }`}
                />
                <h2 className="font-display font-bold text-xs sm:text-sm uppercase tracking-wider text-white">
                  {isRendering
                    ? latestRender?.currentStep || "Encoding 1080p H.264 MP4..."
                    : latestRender?.status === "failed"
                      ? "Render Interrupted — Credits Refunded"
                      : playableMp4Url
                        ? "Pipeline Telemetry: 100% Complete"
                        : "Ready for 1080p H.264 MP4 Export"}
                </h2>
              </div>

              <span
                className={`px-2.5 py-1 rounded font-mono text-[11px] font-bold ${
                  latestRender?.status === "failed"
                    ? "bg-[#EF4444]/15 text-[#FCA5A5]"
                    : isRendering
                      ? "bg-[#F59E0B]/15 text-[#FDE68A]"
                      : playableMp4Url
                        ? "bg-[#10B981]/15 text-[#9BFFCE]"
                        : "bg-[#18181D] text-[#A1A1AA]"
                }`}
              >
                {latestRender?.status === "failed"
                  ? "AUTO_REFUNDED"
                  : isRendering
                    ? `${progressPct}% ENCODING`
                    : playableMp4Url
                      ? "RENDER_OK"
                      : "READY_TO_RENDER"}
              </span>
            </div>

            {/* Live Progress Bar */}
            <div className="w-full h-2 rounded-full bg-[#18181D] overflow-hidden border border-[#27272A]">
              <div
                className="h-full bg-gradient-to-r from-[#FF4F28] via-[#F59E0B] to-[#10B981] transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* 4 Telemetry Tiles (Stitch 07A) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-[#09090B] border border-[#27272A]">
                <div className="font-mono text-[10px] text-[#71717A] uppercase">Frames</div>
                <div className="font-display font-bold font-mono text-sm text-white mt-0.5">
                  {estimatedFrames.toLocaleString()}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#09090B] border border-[#27272A]">
                <div className="font-mono text-[10px] text-[#71717A] uppercase">Frame Rate</div>
                <div className="font-display font-bold font-mono text-sm text-[#10B981] mt-0.5">
                  {fps} FPS H.264
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#09090B] border border-[#27272A]">
                <div className="font-mono text-[10px] text-[#71717A] uppercase">File Size</div>
                <div className="font-display font-bold font-mono text-sm text-white mt-0.5">
                  {latestRender?.fileSizeBytes
                    ? formatBytes(latestRender.fileSizeBytes)
                    : playableMp4Url
                      ? "Ready"
                      : "Pending"}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#09090B] border border-[#27272A]">
                <div className="font-mono text-[10px] text-[#71717A] uppercase">Resolution</div>
                <div className="font-display font-bold font-mono text-sm text-white mt-0.5">
                  {aspectRatio === "9:16" ? "1080×1920" : "1920×1080"}
                </div>
              </div>
            </div>

            {/* Export Settings Controls (Aspect Ratio + Frame Rate) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A1A1AA] mb-1.5">
                  Export Aspect Ratio
                </label>
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#09090B] border border-[#27272A]">
                  {(["9:16", "16:9"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      disabled={isRendering}
                      onClick={() => setAspectRatio(r)}
                      className={`py-1.5 rounded-lg font-mono text-xs font-bold transition-colors ${
                        aspectRatio === r
                          ? "bg-[#FF4F28] text-[#09090B]"
                          : "text-[#A1A1AA] hover:text-white"
                      }`}
                    >
                      {r === "9:16" ? "9:16 Reels" : "16:9 Wide"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A1A1AA] mb-1.5">
                  Encoder Frame Rate
                </label>
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#09090B] border border-[#27272A]">
                  {([30, 60] as const).map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      disabled={isRendering}
                      onClick={() => setFps(rate)}
                      className={`py-1.5 rounded-lg font-mono text-xs font-bold transition-colors ${
                        fps === rate
                          ? "bg-[#FF4F28] text-[#09090B]"
                          : "text-[#A1A1AA] hover:text-white"
                      }`}
                    >
                      {rate === 30 ? "30 FPS Turbo" : "60 FPS Master"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Verified 4-Stage Pipeline Checklist */}
            <div className="space-y-2 pt-1">
              {[
                {
                  label: `Voiceovers Synced (${project.voiceId})`,
                  done: progressPct >= 35 || Boolean(playableMp4Url),
                },
                {
                  label: `Vector Diagrams Composed (${project.scenes.length} Scenes • ${project.primaryTemplate.replace(/_/g, " ")})`,
                  done: progressPct >= 45 || Boolean(playableMp4Url),
                },
                {
                  label: `Word-Synced Subtitles Burned (${project.subtitleStyle.replace(/_/g, " ")})`,
                  done: progressPct >= 75 || Boolean(playableMp4Url),
                },
                {
                  label: `Encoded ${
                    aspectRatio === "9:16" ? "1080×1920" : "1920×1080"
                  } H.264 MP4 + AAC Audio`,
                  done: progressPct >= 100 || Boolean(playableMp4Url),
                },
              ].map((m) => (
                <div key={m.label} className="flex items-center gap-2.5 text-xs">
                  <span
                    className={`material-symbols-outlined text-[16px] ${
                      m.done ? "text-[#10B981]" : "text-[#52525B]"
                    }`}
                  >
                    {m.done ? "check_circle" : "radio_button_unchecked"}
                  </span>
                  <span className={m.done ? "text-[#F4F4F5]" : "text-[#A1A1AA]"}>
                    {m.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Primary Render / Download Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                disabled={isRendering || startingRender}
                onClick={() => void startRender(false)}
                className="flex-1 min-w-[220px] py-3 px-5 rounded-xl bg-[#FF4F28] hover:bg-[#FF6542] disabled:opacity-50 text-[#09090B] font-display font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(255,79,40,0.3)] transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {isRendering ? "progress_activity" : "movie_creation"}
                </span>
                <span>
                  {isRendering
                    ? `Rendering MP4 (${progressPct}%)...`
                    : startingRender
                      ? "Starting Render..."
                      : playableMp4Url
                        ? `Re-Render 1080p MP4 (${requiredCredits} CR)`
                        : `Render 1080p MP4 (${requiredCredits} ${
                            requiredCredits === 1 ? "Credit" : "Credits"
                          })`}
                </span>
              </button>

              {downloadMp4Url && (
                <a
                  href={downloadMp4Url}
                  download
                  className="py-3 px-5 rounded-xl bg-[#10B981] hover:bg-[#34D399] text-[#09090B] font-display font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  <span>
                    Download MP4
                    {latestRender?.fileSizeBytes
                      ? ` (${formatBytes(latestRender.fileSizeBytes)})`
                      : ""}
                  </span>
                </a>
              )}
            </div>

            {/* Stream / Download URL Copy Bar */}
            {playableMp4Url && (
              <div className="flex items-center gap-2 p-2 rounded-xl bg-[#09090B] border border-[#27272A]">
                <span className="material-symbols-outlined text-[#71717A] text-[18px] pl-1">
                  link
                </span>
                <input
                  type="text"
                  readOnly
                  value={
                    typeof window !== "undefined"
                      ? `${window.location.origin}${playableMp4Url}`
                      : playableMp4Url
                  }
                  className="bg-transparent font-mono text-xs text-[#E4E4E7] w-full outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const full =
                      typeof window !== "undefined"
                        ? `${window.location.origin}${playableMp4Url}`
                        : playableMp4Url;
                    void navigator.clipboard?.writeText(full);
                    setCopiedUrl(true);
                    setTimeout(() => setCopiedUrl(false), 2000);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#18181D] hover:bg-[#27272A] font-display font-bold text-xs text-white shrink-0"
                >
                  {copiedUrl ? "Copied ✓" : "Copy URL"}
                </button>
              </div>
            )}
          </section>

          {/* Stitch 14A Panel 03: Render Worker Failure & Automatic Credit Refund Card */}
          {latestRender?.status === "failed" && (
            <section className="p-6 rounded-2xl bg-[#121216] border border-[#EF4444]/40 space-y-4">
              <div className="p-4 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/30 flex items-start gap-3">
                <span className="material-symbols-outlined text-[#EF4444] text-2xl shrink-0">
                  report_problem
                </span>
                <div className="space-y-1">
                  <h3 className="font-display font-bold text-sm text-white">
                    Render Pipeline Interrupted
                  </h3>
                  <p className="text-xs text-[#FCA5A5] leading-relaxed">
                    {latestRender.errorMessage ||
                      "Headless Chromium / FFmpeg worker terminated before completing MP4 output."}
                  </p>
                </div>
              </div>

              {/* Signal Jade Auto-Refund Reassurance Banner */}
              <div className="p-4 rounded-xl bg-[#10B981]/12 border border-[#10B981]/35 flex items-start gap-3">
                <span className="material-symbols-outlined text-[#10B981] text-2xl shrink-0">
                  currency_exchange
                </span>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display font-bold text-sm text-[#9BFFCE]">
                      ✓ +{latestRender.creditsCharged}{" "}
                      {latestRender.creditsCharged === 1 ? "Credit" : "Credits"}{" "}
                      Automatically Refunded to Your Ledger
                    </span>
                    {latestRender.refundTxId && (
                      <span className="px-2 py-0.5 rounded bg-[#10B981]/20 font-mono text-[10px] text-[#9BFFCE]">
                        {latestRender.refundTxId}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#E4E4E7]">
                    Wallet balance restored to{" "}
                    <strong className="text-white">{creditsBalance} Credits</strong>{" "}
                    instantly. No manual support ticket required.
                  </p>
                </div>
              </div>

              {/* Technical Diagnostics Worker Trace */}
              {latestRender.workerTrace.length > 0 && (
                <div className="rounded-xl bg-[#09090B] border border-[#27272A] overflow-hidden font-mono text-[11px]">
                  <div className="px-4 py-2 bg-[#18181D] border-b border-[#27272A] flex items-center justify-between text-[#A1A1AA]">
                    <span>Worker Diagnostic Trace ({latestRender.id})</span>
                    <span className="text-[#EF4444]">Auto-Refund Verified</span>
                  </div>
                  <div className="p-3.5 space-y-1 text-[#A1A1AA] max-h-40 overflow-y-auto">
                    {latestRender.workerTrace.map((ln, idx) => (
                      <div
                        key={idx}
                        className={
                          ln.includes("ERROR")
                            ? "text-[#FCA5A5]"
                            : ln.includes("LEDGER")
                              ? "text-[#9BFFCE]"
                              : "text-[#A1A1AA]"
                        }
                      >
                        {ln}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  type="button"
                  onClick={() => void startRender(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#FF4F28] hover:bg-[#FF6542] text-[#09090B] font-display font-bold text-xs inline-flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[16px]">refresh</span>
                  <span>Retry 1080p Render</span>
                </button>
                <a
                  href={`/api/v1/projects/${project.id}/backup`}
                  download
                  className="py-2.5 px-4 rounded-xl bg-[#18181D] hover:bg-[#27272A] border border-[#27272A] text-xs font-mono text-[#E4E4E7] inline-flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    file_download
                  </span>
                  <span>Download Script &amp; Audio Backup (.JSON)</span>
                </a>
              </div>
            </section>
          )}

          {/* Rendered 1080p MP4 Master Video Player */}
          <section className="p-6 rounded-2xl bg-[#121216] border border-[#27272A] flex flex-col items-center space-y-4">
            <div className="w-full flex items-center justify-between">
              <span className="font-display font-bold text-xs uppercase tracking-wider text-white">
                Master Output Preview ({aspectRatio})
              </span>
              <span className="font-mono text-xs text-[#F59E0B]">
                {playableMp4Url
                  ? `${formatClockTime(videoCurrentSec)} / ${formatClockTime(
                      videoDurationSec || Math.round(totalStoryboardMs / 1000)
                    )}`
                  : `${project.scenes.length} Scenes • ${Math.round(
                      totalStoryboardMs / 1000
                    )}s`}
              </span>
            </div>

            {playableMp4Url ? (
              <div
                className={`relative rounded-2xl overflow-hidden border border-[#27272A] bg-[#050507] shadow-2xl ${
                  aspectRatio === "9:16"
                    ? "w-full max-w-[330px] aspect-[9/16]"
                    : "w-full aspect-[16/9]"
                }`}
              >
                <video
                  key={playableMp4Url}
                  src={playableMp4Url}
                  controls
                  playsInline
                  onTimeUpdate={(e) => setVideoCurrentSec(e.currentTarget.currentTime)}
                  onLoadedMetadata={(e) =>
                    setVideoDurationSec(e.currentTarget.duration || 0)
                  }
                  className="w-full h-full object-contain bg-black"
                />
              </div>
            ) : (
              <div className="w-full py-14 px-6 rounded-2xl bg-[#09090B] border border-dashed border-[#27272A] text-center space-y-3">
                <span className="material-symbols-outlined text-4xl text-[#FF4F28]">
                  smart_display
                </span>
                <div className="font-display font-bold text-sm text-white">
                  {isRendering
                    ? "Headless Remotion + FFmpeg H.264 Render in Progress..."
                    : "No Final MP4 Exported Yet"}
                </div>
                <p className="text-xs text-[#A1A1AA] max-w-md mx-auto">
                  {isRendering
                    ? "Your neural voiceovers, 5-template vector animations, and word-synced subtitles are being encoded to 1080p MP4."
                    : `Click "Render 1080p MP4" above to encode all ${project.scenes.length} scenes into a downloadable H.264 MP4 master.`}
                </p>
              </div>
            )}
          </section>
        </div>

        {/* RIGHT COLUMN (5 cols): Credit Audit Ledger & Social Copy / Instagram Handoff */}
        <div className="lg:col-span-5 space-y-6">
          {/* Credit Cost & Immutable Audit Ledger Summary */}
          <section className="p-6 rounded-2xl bg-[#121216] border border-[#27272A] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-sm text-white">
                Video Credits &amp; Ledger Audit
              </h3>
              <span className="px-2.5 py-1 rounded-lg bg-[#18181D] border border-[#27272A] font-mono text-xs text-[#F59E0B] font-bold">
                {creditsBalance} CR Balance
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#09090B] border border-[#27272A] flex items-center justify-between text-xs">
              <div>
                <div className="font-semibold text-white">{tierLabel}</div>
                <div className="text-[11px] text-[#A1A1AA]">
                  Automatic +100% credit refund if render ever fails
                </div>
              </div>
              <span className="font-mono font-bold text-[#FFB4A4]">
                {requiredCredits} {requiredCredits === 1 ? "Credit" : "Credits"}
              </span>
            </div>

            <div className="space-y-2">
              <div className="font-mono text-[10px] uppercase tracking-wider text-[#71717A]">
                Recent Immutable Ledger Entries
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {ledger.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-2.5 rounded-xl bg-[#09090B] border border-[#27272A] flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="text-[#E4E4E7] truncate">{entry.reason}</div>
                      <div className="font-mono text-[10px] text-[#71717A]">
                        {entry.id} • Bal: {entry.balanceAfter} CR
                      </div>
                    </div>
                    <span
                      className={`font-mono font-bold shrink-0 ${
                        entry.delta >= 0 ? "text-[#10B981]" : "text-[#FFB4A4]"
                      }`}
                    >
                      {entry.delta >= 0 ? `+${entry.delta}` : entry.delta} CR
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* AI Social Copywriter & Instagram Publisher Handoff (Stitch 07A Right Column) */}
          <section className="p-6 rounded-2xl bg-[#121216] border border-[#27272A] space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="font-display font-bold text-sm text-white">
                  AI Social Copywriter &amp; Reels Prep
                </h3>
                <p className="text-[11px] text-[#A1A1AA]">
                  Auto-generated from your {project.scenes.length}-scene storyboard
                </p>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full font-mono text-[10px] font-bold ${
                  instagramConnected
                    ? "bg-[#10B981]/15 text-[#9BFFCE]"
                    : "bg-[#18181D] text-[#A1A1AA]"
                }`}
              >
                {instagramConnected ? `@${userHandle}` : "IG Not Linked"}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#09090B] border border-[#27272A]">
              {(
                [
                  { id: "educational", label: "Educational" },
                  { id: "kids", label: "Kids/Parents" },
                  { id: "viral", label: "Viral Hook 🔥" },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setCaptionTone(t.id)}
                  className={`py-1.5 rounded-lg font-display font-bold text-[11px] transition-colors ${
                    captionTone === t.id
                      ? "bg-[#FF4F28] text-[#09090B]"
                      : "text-[#A1A1AA] hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <textarea
              rows={6}
              readOnly
              value={generatedCaptions[captionTone]}
              className="w-full p-3 rounded-xl bg-[#09090B] border border-[#27272A] text-xs text-[#E4E4E7] leading-relaxed outline-none"
            />

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(generatedCaptions[captionTone]);
                  setCopiedCaption(true);
                  setTimeout(() => setCopiedCaption(false), 2000);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#18181D] hover:bg-[#27272A] border border-[#27272A] font-display font-bold text-xs text-white"
              >
                {copiedCaption ? "Caption Copied ✓" : "Copy Caption & Hashtags"}
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* Stitch 14A Panel 02: Non-Destructive Insufficient Video Credits Modal */}
      {showZeroCreditsModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="zero-credits-title"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="relative w-full max-w-lg rounded-2xl bg-[#121216] border border-[#27272A] p-6 sm:p-7 shadow-2xl space-y-5">
            <button
              type="button"
              onClick={() => setShowZeroCreditsModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-[#18181D] hover:bg-[#27272A] text-[#A1A1AA] hover:text-white flex items-center justify-center"
              aria-label="Close modal"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>

            <div className="flex items-start gap-4 pr-8">
              <div className="w-12 h-12 rounded-xl bg-[#F59E0B]/20 border border-[#F59E0B]/40 flex items-center justify-center text-[#F59E0B] shrink-0">
                <span className="material-symbols-outlined text-2xl">bolt</span>
              </div>
              <div className="space-y-1">
                <h3
                  id="zero-credits-title"
                  className="font-display font-bold text-lg text-white"
                >
                  Not Enough Credits to Export 1080p MP4
                </h3>
                <div className="font-mono text-xs flex flex-wrap items-center gap-2">
                  <span className="text-[#F59E0B] font-semibold">
                    Required: {requiredCredits} Credits ({tierLabel})
                  </span>
                  <span className="text-[#52525B]">•</span>
                  <span className="text-[#EF4444] font-semibold">
                    Current Balance: {creditsBalance} Credits
                  </span>
                </div>
              </div>
            </div>

            {/* Zero-Data-Loss Invariant Reassurance Box */}
            <div className="p-4 rounded-xl bg-[#10B981]/12 border border-[#10B981]/30 flex items-start gap-3">
              <span className="material-symbols-outlined text-[#10B981] text-xl shrink-0 mt-0.5">
                verified_user
              </span>
              <div className="space-y-1">
                <div className="font-display font-bold text-xs text-[#9BFFCE] uppercase tracking-wider">
                  Zero-Data-Loss Invariant
                </div>
                <p className="text-xs text-[#E4E4E7] leading-relaxed">
                  Your {project.scenes.length}-scene storyboard is auto-saved — nothing is
                  lost! Your vector keyframes, {project.voiceId} voice settings, and{" "}
                  {project.subtitleStyle.replace(/_/g, " ")} subtitles remain safely stored.
                </p>
              </div>
            </div>

            {/* 1-Click Top-Up Pack Selector */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className="text-[#A1A1AA] uppercase">Select Credit Top-Up Tier</span>
                <span className="text-[#10B981]">Immediate Activation</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedTopupPack("25_cr")}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    selectedTopupPack === "25_cr"
                      ? "bg-[#1C181E] border-[#FF4F28]"
                      : "bg-[#09090B] border-[#27272A] hover:border-[#3F3F46]"
                  }`}
                >
                  <div className="font-display font-bold text-sm text-white">
                    25 Video Credits
                  </div>
                  <div className="font-display font-bold text-lg text-white mt-2">
                    $9{" "}
                    <span className="font-sans text-xs font-normal text-[#A1A1AA]">
                      ($0.36/cr)
                    </span>
                  </div>
                  <div className="text-[11px] text-[#A1A1AA] mt-0.5">
                    ~12 high-retention 60s Reels
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedTopupPack("60_cr")}
                  className={`relative p-4 rounded-xl border text-left transition-all ${
                    selectedTopupPack === "60_cr"
                      ? "bg-[#1C181E] border-[#FF4F28]"
                      : "bg-[#09090B] border-[#27272A] hover:border-[#3F3F46]"
                  }`}
                >
                  <span className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-[#FF4F28] text-[#09090B] font-mono text-[9px] font-bold uppercase">
                    POPULAR
                  </span>
                  <div className="font-display font-bold text-sm text-white">
                    60 Video Credits
                  </div>
                  <div className="font-display font-bold text-lg text-white mt-2">
                    $19{" "}
                    <span className="font-sans text-xs font-normal text-[#A1A1AA]">
                      ($0.31/cr)
                    </span>
                  </div>
                  <div className="text-[11px] text-[#A1A1AA] mt-0.5">
                    ~30 high-retention 60s Reels
                  </div>
                </button>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                disabled={toppingUp}
                onClick={() => void handleTopUpAndResume()}
                className="w-full py-3 px-4 rounded-xl bg-[#FF4F28] hover:bg-[#FF6542] text-[#09090B] font-display font-bold text-sm flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(255,79,40,0.3)] disabled:opacity-50"
              >
                <span>
                  {toppingUp
                    ? "Crediting Wallet & Starting Render..."
                    : `Top Up & Resume Render (${
                        selectedTopupPack === "60_cr" ? "60 CR • $19" : "25 CR • $9"
                      }) →`}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setShowZeroCreditsModal(false)}
                className="w-full py-2 text-xs text-[#A1A1AA] hover:text-white font-mono"
              >
                Keep Draft Saved &amp; Return to Export Page
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
