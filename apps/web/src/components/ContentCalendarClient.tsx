"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { InstagramVaultAccount } from "@/lib/instagram";
import type {
  SchedulableProjectOption,
  ScheduledReelItem,
} from "@/lib/schedule";

interface ContentCalendarClientProps {
  initialPosts: ScheduledReelItem[];
  initialEligibleProjects: SchedulableProjectOption[];
  initialSummary: {
    total: number;
    scheduled: number;
    published: number;
    failed: number;
  };
  igAccount: InstagramVaultAccount | null;
  userTimezone: string;
}

type CalendarViewMode = "grid" | "weekly" | "list";
type StatusFilter = "all" | "scheduled" | "published" | "failed";

function toLocalDateTimeValue(isoString: string): string {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatScheduleLabel(isoString: string): string {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeCountdown(isoString: string, status: string): string {
  if (status === "published") return "Published to IG Reels";
  if (status === "failed") return "Dispatch interrupted — retry ready";
  const diffMs = new Date(isoString).getTime() - Date.now();
  if (diffMs <= 0) return "Due now — auto-dispatching";
  const mins = Math.round(diffMs / 60_000);
  if (mins < 60) return `In ${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `In ${hrs}h`;
  return `In ${Math.round(hrs / 24)}d`;
}

export default function ContentCalendarClient({
  initialPosts,
  initialEligibleProjects,
  initialSummary,
  igAccount,
  userTimezone,
}: ContentCalendarClientProps) {
  const router = useRouter();
  const [posts, setPosts] = useState<ScheduledReelItem[]>(initialPosts);
  const [eligibleProjects, setEligibleProjects] = useState<SchedulableProjectOption[]>(
    initialEligibleProjects
  );
  const [summary, setSummary] = useState(initialSummary);

  const [viewMode, setViewMode] = useState<CalendarViewMode>("grid");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedPostId, setSelectedPostId] = useState<string | null>(
    initialPosts[0]?.id || null
  );

  // Inspector edit states
  const [inspectorScheduleDt, setInspectorScheduleDt] = useState<string>("");
  const [inspectorCaption, setInspectorCaption] = useState<string>("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  // + Schedule New Reel Modal states
  const [showNewModal, setShowNewModal] = useState<boolean>(false);
  const renderedProjects = useMemo(
    () => eligibleProjects.filter((p) => p.hasMp4),
    [eligibleProjects]
  );
  const [modalProjectId, setModalProjectId] = useState<string>(
    () => initialEligibleProjects.find((p) => p.hasMp4)?.id || ""
  );
  const [modalDateTime, setModalDateTime] = useState<string>(() => {
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
    tomorrow.setHours(18, 30, 0, 0);
    return toLocalDateTimeValue(tomorrow.toISOString());
  });
  const [modalCaption, setModalCaption] = useState<string>(
    "Watch how this works step by step in 60fps! ⚡👇\n\n#AnimatedExplainer #LearnOnReels #AnimoraStudio"
  );

  const filteredPosts = useMemo(() => {
    if (statusFilter === "all") return posts;
    return posts.filter((p) => p.status === statusFilter);
  }, [posts, statusFilter]);

  const selectedPost = useMemo(() => {
    if (!selectedPostId) return filteredPosts[0] || null;
    return (
      posts.find((p) => p.id === selectedPostId) || filteredPosts[0] || null
    );
  }, [filteredPosts, posts, selectedPostId]);

  useEffect(() => {
    if (selectedPost) {
      setInspectorScheduleDt(toLocalDateTimeValue(selectedPost.scheduledFor));
      setInspectorCaption(selectedPost.caption);
    }
  }, [selectedPost]);

  const refreshQueue = async () => {
    try {
      const res = await fetch("/api/v1/schedule", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.posts)) setPosts(data.posts);
      if (Array.isArray(data.eligibleProjects)) {
        setEligibleProjects(data.eligibleProjects);
      }
      if (data.summary) setSummary(data.summary);
    } catch {
      // ignore transient poll error
    }
  };

  // Auto-poll every 20s so scheduled Reels approaching due time transition live
  useEffect(() => {
    const timer = setInterval(() => {
      void refreshQueue();
    }, 20_000);
    return () => clearInterval(timer);
  }, []);

  const handleSaveInspectorEdits = async () => {
    if (!selectedPost) return;
    setBusyAction("save");
    setFeedbackBanner(null);
    try {
      const res = await fetch(`/api/v1/schedule/${selectedPost.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledFor: new Date(inspectorScheduleDt).toISOString(),
          caption: inspectorCaption,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update schedule.");

      await refreshQueue();
      setFeedbackBanner({
        type: "ok",
        text: `Saved updated schedule & caption for "${selectedPost.projectTitle}".`,
      });
      router.refresh();
    } catch (err) {
      setFeedbackBanner({
        type: "err",
        text: err instanceof Error ? err.message : "Could not update schedule.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleDispatchNow = async (postId: string) => {
    setBusyAction(`dispatch_${postId}`);
    setFeedbackBanner(null);
    try {
      const res = await fetch(`/api/v1/schedule/${postId}/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Instant publish failed.");

      await refreshQueue();
      if (data?.post?.status === "published") {
        setFeedbackBanner({
          type: "ok",
          text: `✓ Reel published to ${data.post.igHandle} (${data.post.igContainerId}).`,
        });
      } else {
        setFeedbackBanner({
          type: "err",
          text: data?.post?.errorMessage || "Dispatch marked as failed.",
        });
      }
      router.refresh();
    } catch (err) {
      setFeedbackBanner({
        type: "err",
        text: err instanceof Error ? err.message : "Dispatch failed.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleCancelSlot = async (postId: string) => {
    setBusyAction(`cancel_${postId}`);
    setFeedbackBanner(null);
    try {
      const res = await fetch(`/api/v1/schedule/${postId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Could not cancel slot.");

      if (selectedPostId === postId) {
        setSelectedPostId(null);
      }
      await refreshQueue();
      setFeedbackBanner({
        type: "ok",
        text: "Scheduled Reel removed from your queue.",
      });
      router.refresh();
    } catch (err) {
      setFeedbackBanner({
        type: "err",
        text: err instanceof Error ? err.message : "Cancel failed.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleRunDueCronSweep = async () => {
    setBusyAction("sweep");
    setFeedbackBanner(null);
    try {
      const res = await fetch("/api/v1/schedule/run-due", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Cron sweep failed.");
      if (Array.isArray(data.posts)) setPosts(data.posts);
      if (data.summary) setSummary(data.summary);
      setFeedbackBanner({
        type: "ok",
        text: `Queue sweep complete: ${data.dispatchedCount} due Reel(s) published, ${data.failedCount} failed.`,
      });
      router.refresh();
    } catch (err) {
      setFeedbackBanner({
        type: "err",
        text: err instanceof Error ? err.message : "Queue sweep failed.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreateNewSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalProjectId) return;
    setBusyAction("create_schedule");
    setFeedbackBanner(null);

    try {
      const res = await fetch("/api/v1/publish/instagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: modalProjectId,
          caption: modalCaption,
          mode: "schedule",
          scheduledFor: new Date(modalDateTime).toISOString(),
          timezone: userTimezone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Could not schedule Reel.");
      }

      setShowNewModal(false);
      await refreshQueue();
      if (data?.post?.id) {
        setSelectedPostId(data.post.id);
      }
      setFeedbackBanner({
        type: "ok",
        text: `✓ Scheduled Reel queued for ${formatScheduleLabel(
          data.post.scheduledFor
        )}.`,
      });
      router.refresh();
    } catch (err) {
      setFeedbackBanner({
        type: "err",
        text: err instanceof Error ? err.message : "Failed to schedule Reel.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  // Group posts by calendar date for Weekly Timeline mode
  const groupedByDay = useMemo(() => {
    const groups = new Map<string, ScheduledReelItem[]>();
    for (const p of filteredPosts) {
      const dayKey = new Date(p.scheduledFor).toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const list = groups.get(dayKey) || [];
      list.push(p);
      groups.set(dayKey, list);
    }
    return Array.from(groups.entries());
  }, [filteredPosts]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header, Account Status & View Controls (Stitch 08A) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#27272A]">
        <div className="space-y-1">
          <h2 className="font-display font-bold text-xl sm:text-2xl text-white">
            Instagram Content Calendar &amp; Auto-Publish Queue
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <span
              className={`w-2 h-2 rounded-full ${
                igAccount && !igAccount.isExpired ? "bg-[#10B981]" : "bg-[#F59E0B]"
              }`}
            />
            {igAccount ? (
              <>
                <span className="text-[#FFB4A4] font-bold">{igAccount.handle}</span>
                <span className="text-[#52525B]">•</span>
                <span
                  className={
                    igAccount.isExpired ? "text-[#EF4444]" : "text-[#9BFFCE]"
                  }
                >
                  {igAccount.isExpired
                    ? "TOKEN_DEGRADED (Re-Auth Required)"
                    : igAccount.sandboxMode
                      ? "Sandbox Auto-Dispatcher Active"
                      : "Graph API v21.0 Active"}
                </span>
              </>
            ) : (
              <Link
                href="/dashboard/integrations"
                className="text-[#F59E0B] hover:underline"
              >
                No Instagram account connected — Pair in Security Center →
              </Link>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* 3 View Mode Tabs (Stitch 08A) */}
          <div className="inline-flex p-1 rounded-xl bg-[#121216] border border-[#27272A]">
            {(
              [
                { id: "grid", label: "Schedule Cards Grid" },
                { id: "weekly", label: "Weekly Timeline" },
                { id: "list", label: `Queue List (${posts.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setViewMode(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-display font-bold text-xs transition-colors ${
                  viewMode === tab.id
                    ? "bg-[#27272A] text-white"
                    : "text-[#A1A1AA] hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={busyAction === "sweep"}
            onClick={() => void handleRunDueCronSweep()}
            className="px-3 py-2 rounded-xl bg-[#18181D] hover:bg-[#27272A] border border-[#27272A] font-mono text-xs text-[#E4E4E7] inline-flex items-center gap-1.5"
            title="Immediately dispatch any scheduled Reels whose scheduled time has arrived"
          >
            <span className="material-symbols-outlined text-[16px] text-[#10B981]">
              sync
            </span>
            <span>{busyAction === "sweep" ? "Sweeping..." : "Run Due Check"}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!modalProjectId && renderedProjects[0]) {
                setModalProjectId(renderedProjects[0].id);
              }
              setShowNewModal(true);
            }}
            className="px-4 py-2 rounded-xl bg-[#FF4F28] hover:bg-[#FF6542] text-[#09090B] font-display font-bold text-xs inline-flex items-center gap-1.5 shadow-[0_0_24px_rgba(255,79,40,0.3)]"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Schedule New Reel</span>
          </button>
        </div>
      </div>

      {/* 4 Telemetry Summary Strips + Filter Chips */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap items-center gap-2">
          {(
            [
              { id: "all", label: `All (${summary.total})` },
              { id: "scheduled", label: `Queued (${summary.scheduled})` },
              { id: "published", label: `Published (${summary.published})` },
              { id: "failed", label: `Failed (${summary.failed})` },
            ] as const
          ).map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setStatusFilter(chip.id)}
              className={`px-3 py-1.5 rounded-xl font-mono text-xs border transition-colors ${
                statusFilter === chip.id
                  ? "bg-[#FF4F28]/15 border-[#FF4F28] text-[#FFB4A4] font-bold"
                  : "bg-[#121216] border-[#27272A] text-[#A1A1AA] hover:text-white"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="font-mono text-[11px] text-[#71717A]">
          Auto-Cron Worker: Active (30s interval • Timezone: {userTimezone})
        </div>
      </div>

      {feedbackBanner && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between gap-3 ${
            feedbackBanner.type === "ok"
              ? "bg-[#10B981]/12 border-[#10B981]/35 text-[#9BFFCE]"
              : "bg-[#EF4444]/15 border-[#EF4444]/40 text-[#FCA5A5]"
          }`}
        >
          <span>{feedbackBanner.text}</span>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="font-mono text-[11px] underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Empty Queue State */}
      {filteredPosts.length === 0 ? (
        <section className="p-10 rounded-2xl bg-[#121216] border border-dashed border-[#27272A] text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#FF4F28]/15 border border-[#FF4F28]/30 mx-auto flex items-center justify-center text-[#FF4F28]">
            <span className="material-symbols-outlined text-3xl">calendar_month</span>
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="font-display font-bold text-lg text-white">
              {statusFilter === "all"
                ? "Your Automated Reels Queue is Empty"
                : `No ${statusFilter} Reels in Queue`}
            </h3>
            <p className="text-xs text-[#A1A1AA] leading-relaxed">
              Schedule any rendered 1080p MP4 video for hands-free Instagram Reels
              publishing, or render a new animated explainer first.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => setShowNewModal(true)}
              className="px-5 py-2.5 rounded-xl bg-[#FF4F28] hover:bg-[#FF6542] text-[#09090B] font-display font-bold text-xs inline-flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">
                calendar_add_on
              </span>
              <span>+ Schedule Rendered Video</span>
            </button>
            <Link
              href="/dashboard/create"
              className="px-5 py-2.5 rounded-xl bg-[#18181D] hover:bg-[#27272A] border border-[#27272A] font-display font-bold text-xs text-white"
            >
              + Create New AI Video
            </Link>
          </div>
        </section>
      ) : (
        /* Main 12-Column Workspace: Left 8 Cols Queue View + Right 4 Cols Active Queue Inspector */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT 8 COLS */}
          <div className="lg:col-span-8 space-y-4">
            {viewMode === "grid" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredPosts.map((post) => {
                  const isSelected = selectedPost?.id === post.id;
                  return (
                    <article
                      key={post.id}
                      onClick={() => setSelectedPostId(post.id)}
                      className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-4 ${
                        isSelected
                          ? "bg-[#18151A] border-[#FF4F28] shadow-[0_0_24px_rgba(255,79,40,0.16)]"
                          : "bg-[#121216] border-[#27272A] hover:border-[#3F3F46]"
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[11px] text-[#A1A1AA]">
                            {formatScheduleLabel(post.scheduledFor)}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase ${
                              post.status === "published"
                                ? "bg-[#10B981]/15 text-[#9BFFCE]"
                                : post.status === "failed"
                                  ? "bg-[#EF4444]/15 text-[#FCA5A5]"
                                  : "bg-[#F59E0B]/15 text-[#FDE68A]"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                post.status === "published"
                                  ? "bg-[#10B981]"
                                  : post.status === "failed"
                                    ? "bg-[#EF4444]"
                                    : "bg-[#F59E0B]"
                              }`}
                            />
                            {post.status === "scheduled" ? "QUEUED" : post.status}
                          </span>
                        </div>

                        {/* Visual Reel Stage Banner */}
                        <div className="relative h-32 rounded-xl bg-[#09090B] border border-[#27272A] p-3 flex flex-col justify-between overflow-hidden">
                          <div
                            className="absolute inset-0 opacity-25 pointer-events-none"
                            style={{
                              background:
                                post.status === "published"
                                  ? "radial-gradient(circle at 30% 30%, rgba(16,185,129,0.45), transparent 65%)"
                                  : post.status === "failed"
                                    ? "radial-gradient(circle at 30% 30%, rgba(239,68,68,0.45), transparent 65%)"
                                    : "radial-gradient(circle at 30% 30%, rgba(255,79,40,0.45), transparent 65%)",
                            }}
                          />
                          <div className="relative z-10 flex items-center justify-between font-mono text-[10px]">
                            <span className="px-2 py-0.5 rounded bg-[#18181D] border border-[#27272A] text-[#FFB4A4]">
                              {post.igHandle}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-black/70 text-white">
                              {post.durationSec}s • {post.aspectRatio}
                            </span>
                          </div>
                          <div className="relative z-10 font-mono text-[11px] text-[#E4E4E7]">
                            {formatRelativeCountdown(post.scheduledFor, post.status)}
                          </div>
                        </div>

                        <h3 className="font-display font-bold text-sm text-white line-clamp-1">
                          {post.projectTitle}
                        </h3>
                        <p className="text-xs text-[#A1A1AA] line-clamp-2 leading-relaxed">
                          {post.caption}
                        </p>
                      </div>

                      <div
                        className="pt-3 border-t border-[#27272A] flex items-center justify-between gap-2 text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="font-mono text-[10px] text-[#71717A] truncate">
                          {post.igContainerId
                            ? `ID: ${post.igContainerId}`
                            : "Auto-publish enabled"}
                        </span>

                        {post.status === "failed" ? (
                          <button
                            type="button"
                            disabled={busyAction === `dispatch_${post.id}`}
                            onClick={() => void handleDispatchNow(post.id)}
                            className="px-2.5 py-1 rounded-lg bg-[#EF4444] text-white font-display font-bold text-[11px]"
                          >
                            Retry Dispatch
                          </button>
                        ) : post.status === "published" && post.igPermalink ? (
                          <span className="font-mono text-[11px] text-[#10B981]">
                            Published ✓
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedPostId(post.id)}
                            className="font-display font-bold text-xs text-[#FFB4A4] hover:underline"
                          >
                            Edit Schedule →
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {viewMode === "weekly" && (
              <div className="space-y-4">
                {groupedByDay.map(([dayLabel, items]) => (
                  <div
                    key={dayLabel}
                    className="p-5 rounded-2xl bg-[#121216] border border-[#27272A] space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-[#27272A] pb-2">
                      <span className="font-display font-bold text-sm text-white">
                        {dayLabel}
                      </span>
                      <span className="font-mono text-[11px] text-[#FFB4A4]">
                        {items.length} {items.length === 1 ? "Reel" : "Reels"}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => setSelectedPostId(item.id)}
                          className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between gap-3 ${
                            selectedPost?.id === item.id
                              ? "bg-[#1C181E] border-[#FF4F28]"
                              : "bg-[#09090B] border-[#27272A] hover:border-[#3F3F46]"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="font-display font-bold text-xs text-white truncate">
                              {item.projectTitle}
                            </div>
                            <div className="font-mono text-[10px] text-[#A1A1AA]">
                              {new Date(item.scheduledFor).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}{" "}
                              • {item.igHandle}
                            </div>
                          </div>
                          <span className="font-mono text-[10px] uppercase text-[#9BFFCE] shrink-0">
                            {item.status === "scheduled" ? "QUEUED" : item.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {viewMode === "list" && (
              <div className="rounded-2xl bg-[#121216] border border-[#27272A] overflow-hidden divide-y divide-[#27272A]">
                {filteredPosts.map((post) => (
                  <div
                    key={post.id}
                    onClick={() => setSelectedPostId(post.id)}
                    className={`p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer transition-colors ${
                      selectedPost?.id === post.id
                        ? "bg-[#1C181E]"
                        : "hover:bg-[#18181D]"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-display font-bold text-xs sm:text-sm text-white truncate">
                        {post.projectTitle}
                      </div>
                      <div className="font-mono text-[11px] text-[#A1A1AA]">
                        {formatScheduleLabel(post.scheduledFor)} • {post.igHandle}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase ${
                          post.status === "published"
                            ? "bg-[#10B981]/15 text-[#9BFFCE]"
                            : post.status === "failed"
                              ? "bg-[#EF4444]/15 text-[#FCA5A5]"
                              : "bg-[#F59E0B]/15 text-[#FDE68A]"
                        }`}
                      >
                        {post.status === "scheduled" ? "QUEUED" : post.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT 4 COLS: Sticky Active Queue Inspector (Stitch 08A) */}
          {selectedPost && (
            <aside className="lg:col-span-4 p-5 rounded-2xl bg-[#121216] border border-[#27272A] lg:sticky lg:top-20 space-y-4">
              <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#27272A]">
                <div className="min-w-0">
                  <h3 className="font-display font-bold text-base text-white">
                    Active Queue Inspector
                  </h3>
                  <p className="font-mono text-[11px] text-[#FFB4A4] truncate">
                    {selectedPost.projectTitle}
                  </p>
                </div>
                <span className="px-2 py-1 rounded bg-[#18181D] border border-[#27272A] font-mono text-[10px] text-[#A1A1AA] shrink-0">
                  {selectedPost.igContainerId
                    ? selectedPost.igContainerId.slice(0, 14)
                    : selectedPost.id}
                </span>
              </div>

              {/* Embedded MP4 Preview inside Queue Inspector */}
              {selectedPost.mp4Url ? (
                <div className="rounded-xl overflow-hidden border border-[#27272A] bg-black max-h-64 flex justify-center">
                  <video
                    key={selectedPost.mp4Url}
                    src={selectedPost.mp4Url}
                    controls
                    playsInline
                    className="max-h-60 w-auto object-contain"
                  />
                </div>
              ) : (
                <div className="p-6 rounded-xl bg-[#09090B] border border-[#27272A] text-center space-y-2">
                  <span className="material-symbols-outlined text-2xl text-[#F59E0B]">
                    movie
                  </span>
                  <div className="text-xs text-[#A1A1AA]">
                    MP4 master linked to {selectedPost.projectTitle}
                  </div>
                </div>
              )}

              {selectedPost.errorMessage && (
                <div className="p-3 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/40 text-xs text-[#FCA5A5]">
                  <strong>Last Error:</strong> {selectedPost.errorMessage} (Retries:{" "}
                  {selectedPost.retryCount})
                </div>
              )}

              {/* Metadata Rows */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#A1A1AA]">Target Account</span>
                  <span className="font-mono font-bold text-white">
                    {selectedPost.igHandle}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#A1A1AA]">Status</span>
                  <span className="font-mono font-bold uppercase text-[#9BFFCE]">
                    {selectedPost.status === "scheduled"
                      ? "QUEUED"
                      : selectedPost.status}
                  </span>
                </div>
                {selectedPost.igPermalink && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#A1A1AA] shrink-0">IG Permalink</span>
                    <span className="font-mono text-[11px] text-[#9BFFCE] truncate">
                      {selectedPost.igPermalink}
                    </span>
                  </div>
                )}
              </div>

              {/* Editable Schedule Date/Time & Caption */}
              <div className="space-y-3 pt-2 border-t border-[#27272A]">
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A1A1AA] mb-1">
                    Scheduled Dispatch Time
                  </label>
                  <input
                    type="datetime-local"
                    value={inspectorScheduleDt}
                    onChange={(e) => setInspectorScheduleDt(e.target.value)}
                    aria-label="Inspector scheduled dispatch time"
                    className="w-full px-3 py-2 rounded-xl bg-[#09090B] border border-[#27272A] font-mono text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A1A1AA] mb-1">
                    Instagram Caption &amp; Hashtags
                  </label>
                  <textarea
                    rows={4}
                    value={inspectorCaption}
                    onChange={(e) => setInspectorCaption(e.target.value.slice(0, 2200))}
                    aria-label="Inspector Instagram caption"
                    className="w-full p-3 rounded-xl bg-[#09090B] border border-[#27272A] text-xs text-[#E4E4E7] leading-relaxed outline-none focus:border-[#FF4F28]"
                  />
                </div>

                <button
                  type="button"
                  disabled={busyAction === "save"}
                  onClick={() => void handleSaveInspectorEdits()}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#18181D] hover:bg-[#27272A] border border-[#27272A] font-display font-bold text-xs text-white"
                >
                  {busyAction === "save"
                    ? "Saving Changes..."
                    : "Save Schedule & Caption"}
                </button>
              </div>

              {/* Primary Instant Publish / Retry + Cancel Actions */}
              <div className="space-y-2 pt-1">
                {selectedPost.status !== "published" && (
                  <button
                    type="button"
                    disabled={busyAction === `dispatch_${selectedPost.id}`}
                    onClick={() => void handleDispatchNow(selectedPost.id)}
                    className="w-full py-3 px-4 rounded-xl bg-[#FF4F28] hover:bg-[#FF6542] text-[#09090B] font-display font-bold text-xs uppercase tracking-wider inline-flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(255,79,40,0.3)] disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">bolt</span>
                    <span>
                      {busyAction === `dispatch_${selectedPost.id}`
                        ? "Publishing to Instagram..."
                        : selectedPost.status === "failed"
                          ? "Retry Dispatch to Instagram"
                          : "Force Instant Publish to Instagram"}
                    </span>
                  </button>
                )}

                <div className="flex items-center gap-2">
                  <Link
                    href={`/dashboard/projects/${selectedPost.projectId}/publish`}
                    className="flex-1 py-2 px-3 rounded-xl bg-[#09090B] hover:bg-[#18181D] border border-[#27272A] font-mono text-[11px] text-center text-[#E4E4E7]"
                  >
                    Open Project Export
                  </Link>
                  <button
                    type="button"
                    disabled={busyAction === `cancel_${selectedPost.id}`}
                    onClick={() => void handleCancelSlot(selectedPost.id)}
                    className="py-2 px-3 rounded-xl bg-[#09090B] hover:bg-[#EF4444]/20 border border-[#27272A] hover:border-[#EF4444]/40 font-mono text-[11px] text-[#FCA5A5]"
                  >
                    {selectedPost.status === "published"
                      ? "Remove Log"
                      : "Cancel Slot"}
                  </button>
                </div>
              </div>
            </aside>
          )}
        </div>
      )}

      {/* + Schedule New Reel Modal */}
      {showNewModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="schedule-modal-title"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="relative w-full max-w-lg rounded-2xl bg-[#121216] border border-[#27272A] p-6 shadow-2xl space-y-4">
            <button
              type="button"
              onClick={() => setShowNewModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-[#18181D] hover:bg-[#27272A] text-[#A1A1AA] hover:text-white flex items-center justify-center"
              aria-label="Close modal"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>

            <div>
              <h3
                id="schedule-modal-title"
                className="font-display font-bold text-lg text-white"
              >
                Schedule Rendered Reel to Calendar
              </h3>
              <p className="text-xs text-[#A1A1AA] mt-0.5">
                Queue a rendered 1080p MP4 video for automatic Instagram Reels publishing.
              </p>
            </div>

            {renderedProjects.length === 0 ? (
              <div className="p-5 rounded-xl bg-[#09090B] border border-[#27272A] space-y-3 text-center">
                <p className="text-xs text-[#E4E4E7]">
                  You don&apos;t have any rendered 1080p MP4 videos yet. Render a project in
                  Step 4 first, then queue it onto your Content Calendar!
                </p>
                <div className="flex items-center justify-center gap-2">
                  {eligibleProjects[0] ? (
                    <Link
                      href={`/dashboard/projects/${eligibleProjects[0].id}/publish`}
                      className="px-4 py-2 rounded-xl bg-[#FF4F28] text-[#09090B] font-display font-bold text-xs"
                    >
                      Render &ldquo;{eligibleProjects[0].title.slice(0, 28)}&rdquo; →
                    </Link>
                  ) : (
                    <Link
                      href="/dashboard/create"
                      className="px-4 py-2 rounded-xl bg-[#FF4F28] text-[#09090B] font-display font-bold text-xs"
                    >
                      + Create &amp; Render First Video →
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateNewSchedule} className="space-y-4">
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A1A1AA] mb-1">
                    Select Rendered MP4 Video
                  </label>
                  <select
                    value={modalProjectId}
                    onChange={(e) => setModalProjectId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#09090B] border border-[#27272A] text-xs text-white"
                  >
                    {renderedProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.aspectRatio} • {p.durationSec}s)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A1A1AA] mb-1">
                    Publish Date &amp; Time ({userTimezone})
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={modalDateTime}
                    onChange={(e) => setModalDateTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#09090B] border border-[#27272A] font-mono text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A1A1AA] mb-1">
                    Instagram Reel Caption &amp; Hashtags
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={modalCaption}
                    onChange={(e) => setModalCaption(e.target.value.slice(0, 2200))}
                    className="w-full p-3 rounded-xl bg-[#09090B] border border-[#27272A] text-xs text-[#E4E4E7] leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowNewModal(false)}
                    className="px-4 py-2.5 rounded-xl bg-[#18181D] border border-[#27272A] font-mono text-xs text-[#A1A1AA]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busyAction === "create_schedule" || !igAccount}
                    className="px-5 py-2.5 rounded-xl bg-[#FF4F28] hover:bg-[#FF6542] disabled:opacity-40 text-[#09090B] font-display font-bold text-xs"
                  >
                    {busyAction === "create_schedule"
                      ? "Queueing Reel..."
                      : !igAccount
                        ? "Connect IG First"
                        : "Add to Content Calendar Queue"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
