"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import type { AuthenticatedUser } from "@/lib/auth";
import type { VideoProjectSummary } from "@/lib/projects";

interface DashboardClientProps {
  user: AuthenticatedUser;
  initialTelemetry: {
    totalProjects: number;
    renderedExports: number;
    scheduledReels: number;
    projects: VideoProjectSummary[];
  };
}

const QUICK_LAUNCHERS = [
  {
    id: "diagram_flow",
    title: "Technical Flowchart Explainer",
    subtitle: "Nodes & Bezier Paths",
    icon: "account_tree",
    color: "#FF4F28",
    topic: "How Solar Panels Turn Sunlight Into Home Electricity",
  },
  {
    id: "kids_counting",
    title: "Kids Learning A-to-Z & Counting",
    subtitle: "Playful Vector Sprites",
    icon: "child_care",
    color: "#F59E0B",
    topic: "Count 1 to 5 Golden Stars & Learn Alphabet A-to-E",
  },
  {
    id: "split_comparison",
    title: "Myth vs. Fact Split Comparison",
    subtitle: "Dual-Pane Contrast",
    icon: "compare",
    color: "#10B981",
    topic: "5 Myths vs. Facts About Electric Vehicle Batteries",
  },
  {
    id: "stat_counter",
    title: "Animated Stat Counter & Bar Chart",
    subtitle: "Odometer & DataViz",
    icon: "monitoring",
    color: "#38BDF8",
    topic: "Why Compound Interest Grows Exponentially (+87%)",
  },
  {
    id: "illustrated_motion",
    title: "Illustrated Story & Motion Scene",
    subtitle: "Keyframe Camera Rig",
    icon: "auto_awesome_motion",
    color: "#A855F7",
    topic: "Inside a Lithium-Ion Battery Cell During Fast Charging",
  },
];

export default function DashboardClient({ user, initialTelemetry }: DashboardClientProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<VideoProjectSummary[]>(initialTelemetry.projects);
  const [scheduledReelsCount, setScheduledReelsCount] = useState<number>(
    initialTelemetry.scheduledReels
  );
  const [filterStatus, setFilterStatus] = useState<"all" | "rendered" | "scheduled" | "draft">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredProjects = projects.filter((p) => {
    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "rendered" && (p.status === "rendered" || p.status === "published")) ||
      p.status === filterStatus;
    const matchesSearch =
      !searchQuery.trim() ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.topicPrompt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleDeleteProject = async (project: VideoProjectSummary) => {
    setDeletingId(project.id);
    try {
      const res = await fetch(`/api/v1/projects?id=${encodeURIComponent(project.id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== project.id));
        if (project.status === "scheduled") {
          setScheduledReelsCount((c) => Math.max(0, c - 1));
        }
        setConfirmDeleteId(null);
      }
    } finally {
      setDeletingId(null);
    }
  };

  const renderedCount = projects.filter(
    (p) => p.status === "rendered" || p.status === "published" || p.status === "scheduled"
  ).length;

  return (
    <DashboardShell
      user={user}
      title={`Welcome back, ${user.fullName.split(" ")[0]}`}
      subtitle="Your isolated creator workspace & automated Instagram pipeline"
      actions={
        <Link
          href="/dashboard/create"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gradient-to-br from-[#FFB4A4] to-[#FF4F28] text-[#09090B] font-display font-bold text-xs whitespace-nowrap shrink-0 shadow-lg shadow-[#FF4F28]/20 hover:opacity-95 transition-all"
        >
          <span>+ Create New AI Video</span>
          <span className="material-symbols-outlined text-sm font-bold">arrow_forward</span>
        </Link>
      }
    >
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
        {/* 1. 4 TELEMETRY STAT CARDS (Matches Stitch 04A & 04B) */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          <div className="bg-[#121216] border border-[#27272A] rounded-xl p-4 sm:p-5 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase text-[#A1A1AA]">
              <span className="truncate">TOTAL VIDEO PROJECTS</span>
              <span className="material-symbols-outlined text-[#FF4F28] text-lg">movie</span>
            </div>
            <div className="font-display font-bold text-2xl sm:text-3xl text-white">
              {projects.length} <span className="text-base font-semibold">Projects</span>
            </div>
            <div className="text-[11px] font-mono text-[#71717A]">
              Tenant: {user.workspaceSlug}
            </div>
          </div>

          <div className="bg-[#121216] border border-[#27272A] rounded-xl p-4 sm:p-5 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase text-[#A1A1AA]">
              <span className="truncate">RENDERED 1080P MP4S</span>
              <span className="material-symbols-outlined text-[#10B981] text-lg">hd</span>
            </div>
            <div className="font-display font-bold text-2xl sm:text-3xl text-white">
              {renderedCount} <span className="text-base font-semibold">Exports</span>
            </div>
            <div className="text-[11px] font-mono text-[#10B981]">60 FPS Vector &amp; H.264</div>
          </div>

          <div className="bg-[#121216] border border-[#27272A] rounded-xl p-4 sm:p-5 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase text-[#A1A1AA]">
              <span className="truncate">INSTAGRAM REELS QUEUED</span>
              <span className="material-symbols-outlined text-[#F59E0B] text-lg">
                event_upcoming
              </span>
            </div>
            <div className="font-display font-bold text-2xl sm:text-3xl text-white">
              {scheduledReelsCount}{" "}
              <span className="text-base font-semibold">Queued</span>
            </div>
            <div className="text-[11px] font-mono text-[#F59E0B]">
              {user.instagramHandle || "Connect IG to auto-post"}
            </div>
          </div>

          <div className="bg-[#121216] border border-[#27272A] rounded-xl p-4 sm:p-5 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase text-[#A1A1AA]">
              <span className="truncate">AVAILABLE VIDEO CREDITS</span>
              <span className="material-symbols-outlined text-[#FFB4A4] text-lg">bolt</span>
            </div>
            <div className="font-display font-bold text-2xl sm:text-3xl text-[#F59E0B]">
              {user.creditsBalance} <span className="text-base font-semibold">Credits</span>
            </div>
            <div className="text-[11px] font-mono text-[#71717A]">30s=1, 60s=2, 90s=3</div>
          </div>
        </section>

        {/* 2. QUICK-START 5 PROGRAMMATIC ANIMATION ENGINE LAUNCHERS (Matches Stitch 04A & 04B) */}
        <section className="space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <h2 className="font-display font-bold text-base text-white">
                Quick-Start AI Video Creation
              </h2>
              <span className="px-2 py-0.5 rounded bg-[#121216] border border-[#27272A] font-mono text-[10px] text-[#F59E0B]">
                5 PROGRAMMATIC ANIMATION ENGINES
              </span>
            </div>
            <Link
              href="/dashboard/create"
              className="text-xs font-mono text-[#A1A1AA] hover:text-[#FF4F28] transition-colors"
            >
              Open Full Prompt Studio →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {QUICK_LAUNCHERS.map((eng) => (
              <button
                key={eng.id}
                type="button"
                onClick={() =>
                  router.push(
                    `/dashboard/create?template=${eng.id}&topic=${encodeURIComponent(eng.topic)}`
                  )
                }
                className="group bg-[#121216] hover:bg-[#18181D] border border-[#27272A] hover:border-[#FF4F28]/50 rounded-xl p-4 text-left flex flex-col justify-between min-h-[128px] transition-all"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${eng.color}1F`, color: eng.color }}
                >
                  <span className="material-symbols-outlined text-lg">{eng.icon}</span>
                </div>
                <div className="mt-3">
                  <div className="font-display font-bold text-xs text-white group-hover:text-[#FFB4A4] transition-colors leading-snug">
                    {eng.title}
                  </div>
                  <div className="text-[11px] font-mono text-[#71717A] mt-1">{eng.subtitle}</div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* 3. FIRST-TIME EMPTY ONBOARDING STATE (0 PROJECTS — Matches Stitch 14A/14B) OR RECENT PROJECTS GRID (04A/04B) */}
        {projects.length === 0 ? (
          <section className="bg-[#121216] border border-dashed border-[#3F3F46] rounded-2xl p-6 sm:p-10 text-center max-w-3xl mx-auto space-y-6">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FF4F28]/15 border border-[#FF4F28]/40 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#FF4F28] text-3xl">movie_edit</span>
            </div>

            <div className="space-y-2">
              <span className="inline-block px-2.5 py-0.5 rounded bg-[#18181D] border border-[#27272A] font-mono text-[10px] text-[#9BFFCE]">
                NEW STUDIO WORKSPACE READY • {user.creditsBalance} FREE CREDITS LOADED
              </span>
              <h2 className="font-display font-bold text-2xl sm:text-3xl text-white">
                Your Studio Canvas is Empty — Create Your First 60fps Explainer Reel
              </h2>
              <p className="text-xs sm:text-sm text-[#A1A1AA] max-w-lg mx-auto">
                Turn raw ideas or educational topics into Instagram-ready 9:16 and 16:9 animations
                with zero manual keyframing. Browser previews &amp; Edge Neural TTS are 100% free.
              </p>
            </div>

            {/* 3-Step Interactive Onboarding Checklist (Matches Stitch 14A) */}
            <div className="max-w-md mx-auto text-left space-y-2.5">
              <div className="p-3 rounded-lg bg-[#09090B] border border-[#10B981]/35 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[#10B981] text-base">
                    check_circle
                  </span>
                  <span className="text-white font-medium">
                    1. Account Created &amp; +{user.creditsBalance} Free Credits Claimed
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#10B981]/15 text-[#9BFFCE] font-mono text-[9px] font-bold">
                  COMPLETED
                </span>
              </div>

              <div className="p-3 rounded-lg bg-[#09090B] border border-[#27272A] flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[#F59E0B] text-base">
                    {user.instagramConnected ? "check_circle" : "sync"}
                  </span>
                  <span className="text-[#E4E4E7]">
                    2. Connect Your Personal Instagram Account
                  </span>
                </div>
                <Link
                  href="/dashboard/integrations"
                  className="px-2.5 py-1 rounded bg-[#18181D] hover:bg-[#27272A] border border-[#27272A] font-mono text-[10px] text-[#F59E0B]"
                >
                  {user.instagramConnected ? "Connected" : "Connect IG"}
                </Link>
              </div>

              <div className="p-3 rounded-lg bg-[#09090B] border border-[#27272A] flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[#71717A] text-base">
                    hourglass_empty
                  </span>
                  <span className="text-[#A1A1AA]">3. Generate Your First Animated Video</span>
                </div>
                <span className="font-mono text-[10px] text-[#71717A]">NEXT STEP</span>
              </div>
            </div>

            <div className="pt-2">
              <Link
                href="/dashboard/create"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg bg-gradient-to-br from-[#FFB4A4] to-[#FF4F28] text-[#09090B] font-display font-bold text-sm shadow-lg shadow-[#FF4F28]/25 hover:opacity-95 transition-all"
              >
                <span className="material-symbols-outlined text-base font-bold">auto_awesome</span>
                <span>+ Create My First AI Video →</span>
              </Link>
            </div>
          </section>
        ) : (
          <section className="space-y-5">
            {/* Projects Header + Status Filter Chips + Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#27272A] pb-4">
              <div>
                <h2 className="font-display font-bold text-lg text-white">
                  My Recent Video Projects ({filteredProjects.length})
                </h2>
                <p className="text-xs text-[#A1A1AA]">
                  60 FPS programmatic renders, synced neural voiceovers &amp; Instagram publishing.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="inline-flex bg-[#121216] p-1 rounded-lg border border-[#27272A] text-xs">
                  {(
                    [
                      { id: "all", label: `All (${projects.length})` },
                      { id: "rendered", label: "MP4 Ready" },
                      { id: "scheduled", label: "Scheduled" },
                      { id: "draft", label: "Drafts" },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFilterStatus(f.id)}
                      className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                        filterStatus === f.id
                          ? "bg-[#27272A] text-white"
                          : "text-[#A1A1AA] hover:text-white"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[#71717A] text-sm">
                    search
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter projects..."
                    className="bg-[#121216] border border-[#27272A] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#FF4F28] w-44 sm:w-52"
                  />
                </div>
              </div>
            </div>

            {/* 3-Column Recent Video Projects Grid */}
            {filteredProjects.length === 0 ? (
              <div className="bg-[#121216] border border-dashed border-[#27272A] rounded-xl p-8 text-center space-y-3">
                <span className="material-symbols-outlined text-3xl text-[#71717A]">
                  search_off
                </span>
                <div className="font-display font-bold text-sm text-white">
                  No projects match your current filter
                </div>
                <p className="text-xs text-[#A1A1AA]">
                  Try clearing your search query or switching back to &ldquo;All&rdquo;.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setFilterStatus("all");
                    setSearchQuery("");
                  }}
                  className="px-3.5 py-1.5 rounded-md bg-[#18181D] hover:bg-[#27272A] border border-[#27272A] text-xs font-mono text-[#FF4F28]"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredProjects.map((project) => (
                <article
                  key={project.id}
                  className="bg-[#121216] border border-[#27272A] hover:border-[#3F3F46] rounded-xl overflow-hidden flex flex-col justify-between transition-all"
                >
                  <div>
                    {/* Visual Stage Header */}
                    <div className="relative aspect-video bg-[#09090B] border-b border-[#27272A] p-4 flex flex-col justify-between overflow-hidden">
                      <div
                        className="absolute inset-0 opacity-25 pointer-events-none"
                        style={{
                          background:
                            project.primaryTemplate === "kids_counting"
                              ? "radial-gradient(circle at 30% 30%, rgba(245,158,11,0.45), transparent 65%)"
                              : project.primaryTemplate === "split_comparison"
                              ? "radial-gradient(circle at 70% 30%, rgba(16,185,129,0.4), transparent 65%)"
                              : "radial-gradient(circle at 35% 35%, rgba(255,79,40,0.4), transparent 65%)",
                        }}
                      />

                      <div className="relative z-10 flex items-center justify-between gap-2">
                        {project.status === "published" && (
                          <span className="px-2 py-0.5 rounded bg-[#10B981]/20 border border-[#10B981]/35 text-[#9BFFCE] font-mono text-[10px]">
                            ● Published on IG
                          </span>
                        )}
                        {project.status === "rendered" && (
                          <span className="px-2 py-0.5 rounded bg-[#10B981]/15 border border-[#10B981]/30 text-[#9BFFCE] font-mono text-[10px]">
                            ● MP4 Ready
                          </span>
                        )}
                        {project.status === "scheduled" && (
                          <span className="px-2 py-0.5 rounded bg-[#F59E0B]/15 border border-[#F59E0B]/35 text-[#FCD34D] font-mono text-[10px]">
                            ● Scheduled
                          </span>
                        )}
                        {project.status === "rendering" && (
                          <span className="px-2 py-0.5 rounded bg-[#F59E0B]/20 border border-[#F59E0B]/40 text-[#FDE68A] font-mono text-[10px]">
                            ● Encoding MP4...
                          </span>
                        )}
                        {project.status === "draft" && (
                          <span className="px-2 py-0.5 rounded bg-[#27272A] text-[#E4E4E7] font-mono text-[10px]">
                            ● Draft Storyboard
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded bg-black/75 border border-white/10 font-mono text-[10px] text-white">
                          {project.aspectRatio}
                        </span>
                      </div>

                      <div className="relative z-10 text-center my-auto px-2">
                        <span className="inline-block px-2 py-0.5 rounded bg-[#18181D]/90 border border-[#27272A] font-mono text-[10px] text-[#F59E0B] uppercase mb-1.5">
                          {project.primaryTemplate.replace("_", " ")}
                        </span>
                      </div>
                    </div>

                    {/* Metadata Body */}
                    <div className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-display font-bold text-sm text-white line-clamp-2 leading-snug">
                          {project.title}
                        </h3>
                        {confirmDeleteId === project.id ? (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              disabled={deletingId === project.id}
                              onClick={() => handleDeleteProject(project)}
                              className="px-2 py-0.5 rounded bg-[#EF4444] text-white font-mono text-[10px] font-bold"
                            >
                              {deletingId === project.id ? "..." : "Delete"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-1.5 py-0.5 rounded bg-[#18181D] border border-[#27272A] text-[#A1A1AA] font-mono text-[10px]"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(project.id)}
                            title="Delete project"
                            className="text-[#71717A] hover:text-[#EF4444] transition-colors flex-shrink-0"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] font-mono text-[#71717A]">
                        {project.aspectRatio === "9:16" ? "9:16 Vertical" : "16:9 Landscape"} •{" "}
                        {project.durationSec}s • {project.scenesCount} Scenes
                      </p>
                    </div>
                  </div>

                  {/* Action Footer */}
                  <div className="px-4 pb-4 pt-2 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/dashboard/projects/${project.id}/studio`}
                      className="px-3 py-1.5 rounded-md bg-gradient-to-br from-[#FFB4A4] to-[#FF4F28] text-[#09090B] font-display font-bold text-xs hover:opacity-95 transition-opacity"
                    >
                      Open Studio
                    </Link>
                    {project.mp4Path && (
                      <a
                        href={`${project.mp4Path}${project.mp4Path.includes("?") ? "&" : "?"}download=1`}
                        className="px-3 py-1.5 rounded-md bg-[#18181D] hover:bg-[#27272A] border border-[#27272A] text-white font-display font-semibold text-xs inline-flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-sm">download</span>
                        <span>MP4</span>
                      </a>
                    )}
                    <Link
                      href={`/dashboard/projects/${project.id}/publish`}
                      className="px-3 py-1.5 rounded-md bg-[#10B981]/15 hover:bg-[#10B981]/25 border border-[#10B981]/30 text-[#9BFFCE] font-display font-semibold text-xs"
                    >
                      Publish to IG
                    </Link>
                  </div>
                </article>
              ))}

              {/* + Create New Animated Video Card (Matches Stitch 04A bottom-right card) */}
              <Link
                href="/dashboard/create"
                className="bg-[#121216]/60 hover:bg-[#18181D] border border-dashed border-[#27272A] hover:border-[#FF4F28]/60 rounded-xl p-6 flex flex-col items-center justify-center text-center gap-3 min-h-[260px] transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-[#FF4F28]/15 border border-[#FF4F28]/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined text-[#FF4F28] text-2xl">add</span>
                </div>
                <div>
                  <div className="font-display font-bold text-sm text-white">
                    Create New Animated Video
                  </div>
                  <p className="text-xs text-[#71717A] mt-1 max-w-[200px]">
                    Start from an AI brainstorm prompt or pick any of the 5 animation engines
                  </p>
                </div>
              </Link>
              </div>
            )}
          </section>
        )}
      </div>
    </DashboardShell>
  );
}
