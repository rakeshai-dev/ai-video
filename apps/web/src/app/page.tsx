"use client";

import React, { useState } from "react";
import Link from "next/link";
import HeroStudioPreview from "@/components/HeroStudioPreview";

const WORKFLOW_STEPS = [
  {
    num: "01",
    icon: "psychology",
    title: "AI Topic Brainstorm & Scripting",
    desc: "Feed raw lecture notes, PDFs, or a single topic prompt. AI outputs fact-checked educational scripts with retention hook formulas.",
    badge: "Fact-Check Verification Active",
    badgeColor: "text-[#F59E0B]",
  },
  {
    num: "02",
    icon: "auto_awesome_motion",
    title: "6–15 Scene Animated Storyboard",
    desc: "Programmatic 60fps engines generate custom flowcharts, technical schematics, kids counting cards, and motion graphs matching every paragraph.",
    badge: "Automatic 60FPS Keyframing",
    badgeColor: "text-[#7DD3FC]",
  },
  {
    num: "03",
    icon: "graphic_eq",
    title: "Neural Voice & Synced Captions",
    desc: "Choose unlimited Free Microsoft Edge Neural TTS or ElevenLabs Pro with millisecond-exact word boundaries and karaoke glow highlights.",
    badge: "Word-by-Word Glow Highlights",
    badgeColor: "text-[#FFB4A4]",
  },
  {
    num: "04",
    icon: "event_available",
    title: "1-Click Instagram Scheduler",
    desc: "Connect your own isolated Instagram Creator or Business handle, auto-generate SEO captions & hashtags, and schedule Reels automatically.",
    badge: "Official Graph API Auto-Post",
    badgeColor: "text-[#9BFFCE]",
  },
];

const SCHEDULE_PREVIEW = [
  {
    day: "MON 23",
    status: "PUBLISHED",
    statusClass: "bg-[#10B981]/15 text-[#9BFFCE] border-[#10B981]/30",
    title: "Photovoltaic Quantum Jump",
    handle: "@solarexplained • 18:30",
    metric: "48.2K Views",
  },
  {
    day: "TUE 24",
    status: "PUBLISHED",
    statusClass: "bg-[#10B981]/15 text-[#9BFFCE] border-[#10B981]/30",
    title: "Inverter AC Modulations",
    handle: "@solarexplained • 18:30",
    metric: "62.9K Views",
  },
  {
    day: "WED 25",
    status: "IN 42 MIN",
    statusClass: "bg-[#FF4F28]/20 text-[#FFB4A4] border-[#FF4F28]/50",
    title: "Why Silicon Loves Boron",
    handle: "@solarexplained • 18:30",
    metric: "1080p MP4 Ready",
    featured: true,
  },
  {
    day: "THU 26",
    status: "SCHEDULED",
    statusClass: "bg-[#F59E0B]/15 text-[#FCD34D] border-[#F59E0B]/30",
    title: "Kids Orchard Counting 1–5",
    handle: "@kidspark_abc • 17:00",
    metric: "Optimal Slot",
  },
  {
    day: "FRI 27",
    status: "SCHEDULED",
    statusClass: "bg-[#F59E0B]/15 text-[#FCD34D] border-[#F59E0B]/30",
    title: "Space-Based Solar Relays",
    handle: "@tech_microbytes • 19:15",
    metric: "Optimal Slot",
  },
];

const PRICING_TIERS = [
  {
    name: "Starter Free",
    price: "$0",
    period: "/ forever",
    badge: "+15 FREE CREDITS",
    desc: "Perfect for trying out 60fps programmatic explainers and kids learning Reels.",
    features: [
      "15 Free Starter Video Credits on signup",
      "Unlimited Free Edge Neural TTS voiceovers",
      "All 5 Programmatic 60fps Animation Engines",
      "1080p H.264 MP4 export (9:16 & 16:9)",
      "1 Personal Instagram Connect account",
    ],
    cta: "Start Free with 15 Credits",
    href: "/signup",
    highlighted: false,
  },
  {
    name: "Creator Pro",
    price: "$29",
    period: "/ month",
    badge: "MOST POPULAR",
    desc: "Built for daily STEM educators, kids channels, and faceless Reels creators.",
    features: [
      "100 Video Credits / month (~50 60s Reels)",
      "ElevenLabs Pro expressive studio voices",
      "Personal Brand Kit & custom watermark",
      "Automated Instagram Content Calendar",
      "Priority GPU 1080p & 4K render workers",
    ],
    cta: "Upgrade to Creator Pro",
    href: "/signup",
    highlighted: true,
  },
  {
    name: "Educator Studio",
    price: "$79",
    period: "/ month",
    badge: "MULTI-TENANT",
    desc: "For educational academies, agencies, and multi-channel creator teams.",
    features: [
      "350 Video Credits / month",
      "5 isolated creator workspaces & Brand Kits",
      "5 separate Instagram Creator/Business handles",
      "Bulk syllabus / CSV topic scheduler",
      "Headless Render API & Discord/Slack webhooks",
    ],
    cta: "Launch Educator Studio",
    href: "/signup",
    highlighted: false,
  },
];

export default function PublicHomepage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [autoCitations, setAutoCitations] = useState(true);

  return (
    <div className="min-h-screen bg-[#09090B] text-[#F4F4F5] relative overflow-x-hidden">
      {/* Subtle Ambient Vermilion Top Glow */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_top,rgba(255,79,40,0.12),transparent_70%)] z-0" />

      {/* 1. STICKY RESPONSIVE NAVBAR (Desktop Links + Mobile Hamburger Drawer) */}
      <header className="sticky top-0 z-50 bg-[#09090B]/90 backdrop-blur-md border-b border-[#27272A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-md bg-[#FF4F28] flex items-center justify-center shadow-[0_0_18px_rgba(255,79,40,0.45)]">
              <span className="material-symbols-outlined text-[#09090B] text-lg font-bold">
                movie_filter
              </span>
            </div>
            <span className="font-display font-bold text-lg tracking-tight text-white">
              Animora Studio
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-7 text-xs font-medium text-[#A1A1AA]">
            <a href="#pipeline" className="hover:text-white transition-colors">
              Pipeline
            </a>
            <a href="#engines" className="hover:text-white transition-colors">
              5 Animation Engines
            </a>
            <a href="#voice" className="hover:text-white transition-colors">
              Voice &amp; Captions
            </a>
            <a href="#instagram" className="hover:text-white transition-colors">
              Instagram Scheduler
            </a>
            <a href="#pricing" className="hover:text-white transition-colors">
              Pricing
            </a>
          </nav>

          {/* Right CTA Buttons + Mobile Menu Trigger */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <Link
              href="/login"
              className="hidden sm:inline-flex text-xs font-medium text-[#E4E4E7] hover:text-white px-3 py-2 transition-colors"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-md bg-gradient-to-br from-[#FFB4A4] to-[#FF4F28] text-[#09090B] font-display font-bold text-xs tracking-tight whitespace-nowrap shadow-[0_0_20px_rgba(255,79,40,0.28)] hover:opacity-95 transition-all"
            >
              <span className="hidden sm:inline">START CREATING FREE (15 CREDITS)</span>
              <span className="sm:hidden">Start Free</span>
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle navigation menu"
              className="lg:hidden w-9 h-9 rounded-md bg-[#121216] border border-[#27272A] flex items-center justify-center text-[#E4E4E7] hover:text-white"
            >
              <span className="material-symbols-outlined text-xl">
                {mobileMenuOpen ? "close" : "menu"}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile / Tablet Slide-Down Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#121216] border-t border-[#27272A] px-4 py-4 space-y-3">
            <div className="flex flex-col space-y-2.5 text-sm font-medium text-[#E4E4E7]">
              <a
                href="#pipeline"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 hover:text-[#FF4F28]"
              >
                4-Step Pipeline
              </a>
              <a
                href="#engines"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 hover:text-[#FF4F28]"
              >
                5 Animation Engines
              </a>
              <a
                href="#voice"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 hover:text-[#FF4F28]"
              >
                Dual Voiceover &amp; Captions
              </a>
              <a
                href="#instagram"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 hover:text-[#FF4F28]"
              >
                Per-Member Instagram Scheduler
              </a>
              <a
                href="#pricing"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 hover:text-[#FF4F28]"
              >
                Pricing
              </a>
            </div>
            <div className="pt-3 border-t border-[#27272A] grid grid-cols-2 gap-2.5">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2.5 rounded-md bg-[#18181D] border border-[#27272A] text-center text-xs font-display font-bold text-white"
              >
                Log In
              </Link>
              <Link
                href="/signup"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2.5 rounded-md bg-[#FF4F28] text-center text-xs font-display font-bold text-[#09090B]"
              >
                Claim 15 Credits
              </Link>
            </div>
          </div>
        )}
      </header>

      <main className="relative z-10">
        {/* 2. HERO SECTION (1-Col Stacked on Mobile/Tablet, 2-Col Split on Laptop/Desktop) */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16 sm:pt-16 sm:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left Copy Column */}
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#121216] border border-[#27272A] text-[11px] font-mono text-[#A1A1AA]">
                <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                <span>ANIMORA STUDIO V1.0 • IDEA TO SCHEDULED REEL</span>
              </div>

              <h1 className="font-display font-bold text-4xl sm:text-5xl lg:text-[54px] leading-[1.06] tracking-[-0.03em] text-white">
                Turn rough ideas into{" "}
                <span className="text-[#FF4F28]">animated educational Reels</span>—scheduled in
                minutes.
              </h1>

              <p className="text-sm sm:text-base text-[#A1A1AA] leading-relaxed max-w-xl">
                Transform raw scripts, scientific papers, or kids learning prompts into 9:16 and
                16:9 animated explainer videos. Programmatic 60fps vector motion, neural narration,
                word-by-word karaoke subtitles, and direct Instagram auto-posting without leaving
                your studio.
              </p>

              {/* Hero CTAs */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                <Link
                  href="/signup"
                  className="px-6 py-3.5 rounded-md bg-gradient-to-br from-[#FFB4A4] to-[#FF4F28] text-[#09090B] font-display font-bold text-sm flex items-center justify-center gap-2 shadow-[0_0_28px_rgba(255,79,40,0.3)] hover:opacity-95 transition-all"
                >
                  <span>Start Creating Free</span>
                  <span className="material-symbols-outlined text-base font-bold">
                    arrow_forward
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => setShowDemoModal(true)}
                  className="px-5 py-3.5 rounded-md bg-[#121216] hover:bg-[#18181D] border border-[#27272A] text-white font-display font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <span className="material-symbols-outlined text-[#F59E0B] text-lg">
                    play_circle
                  </span>
                  <span>Watch 105s Solar Explainer MP4</span>
                </button>
              </div>

              {/* Micro Trust Indicators */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2 text-[11px] font-mono text-[#71717A]">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF4F28]" />
                  15 Free Trial Credits
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                  No Card Required
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                  60 FPS 1080p Vector Render
                </span>
              </div>
            </div>

            {/* Right Interactive Studio Preview */}
            <div className="lg:col-span-6">
              <HeroStudioPreview />
            </div>
          </div>
        </section>

        {/* 3. ZERO FRICTION 4-STEP PIPELINE */}
        <section id="pipeline" className="border-t border-[#27272A] py-16 sm:py-24 bg-[#0B0B0E]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div className="space-y-2 max-w-2xl">
                <div className="text-[11px] font-mono uppercase tracking-widest text-[#FF4F28]">
                  ZERO FRICTION WORKFLOW
                </div>
                <h2 className="font-display font-bold text-3xl sm:text-4xl text-white tracking-tight">
                  From blank prompt to viral calendar in 4 steps.
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-[#A1A1AA] max-w-md">
                Eliminate complex video editing timelines, manual keyframing, voice actors, and
                manual social posting. Animora automates the entire educational production stack.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {WORKFLOW_STEPS.map((step) => (
                <div
                  key={step.num}
                  className="bg-[#121216] border border-[#27272A] rounded-xl p-5 flex flex-col justify-between gap-5 hover:border-[#3F3F46] transition-colors"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-2xl font-bold text-[#27272A]">
                        {step.num}
                      </span>
                      <span className="material-symbols-outlined text-[#A1A1AA] text-xl">
                        {step.icon}
                      </span>
                    </div>
                    <h3 className="font-display font-bold text-base text-white">{step.title}</h3>
                    <p className="text-xs text-[#A1A1AA] leading-relaxed">{step.desc}</p>
                  </div>
                  <div className={`pt-3 border-t border-[#27272A] font-mono text-[10px] ${step.badgeColor}`}>
                    ● {step.badge}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 4. 5 MODULAR PROGRAMMATIC ANIMATION ENGINES BENTO GRID */}
        <section id="engines" className="border-t border-[#27272A] py-16 sm:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="space-y-2 max-w-2xl">
              <div className="text-[11px] font-mono uppercase tracking-widest text-[#FF4F28]">
                PROGRAMMATIC RENDERING SUITE
              </div>
              <h2 className="font-display font-bold text-3xl sm:text-4xl text-white tracking-tight">
                5 Modular Animation Engines Built for High-Retention Education.
              </h2>
              <p className="text-sm text-[#A1A1AA]">
                Stop relying on static slides or hallucinated AI video clips. Every engine runs
                real 60fps procedural physics, vector diagrams, and kinetic typography.
              </p>
            </div>

            {/* Top Row: 2 Wide Engine Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Engine 01: Flowcharts */}
              <div className="lg:col-span-7 bg-[#121216] border border-[#27272A] rounded-xl p-6 flex flex-col justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between font-mono text-[10px]">
                    <span className="px-2 py-0.5 rounded bg-[#FF4F28]/15 text-[#FFB4A4]">
                      ENGINE 01
                    </span>
                    <span className="text-[#71717A]">NODE_GRAPHICS_V4</span>
                  </div>
                  <h3 className="font-display font-bold text-xl text-white">
                    Animated Flowcharts &amp; System Diagrams
                  </h3>
                  <p className="text-xs text-[#A1A1AA] leading-relaxed">
                    Perfect for engineering workflows, physics processes, computer networks, and
                    biology cascades. Nodes illuminate in exact sync with voiceover cues.
                  </p>
                </div>

                {/* Flowchart Diagram Visual */}
                <div className="bg-[#09090B] border border-[#27272A] rounded-lg p-4 flex flex-wrap items-center justify-center gap-3 font-mono text-[11px]">
                  <div className="px-3 py-2 rounded bg-[#18181D] border border-[#27272A] text-[#E4E4E7]">
                    INPUT: Sunlight
                  </div>
                  <span className="text-[#FF4F28] font-bold">→</span>
                  <div className="px-3 py-2 rounded bg-[#FF4F28]/15 border border-[#FF4F28] text-white font-bold">
                    SILICON P-N JUNCTION
                  </div>
                  <span className="text-[#10B981] font-bold">→</span>
                  <div className="px-3 py-2 rounded bg-[#10B981]/15 border border-[#10B981]/40 text-[#9BFFCE]">
                    240V AC OUTPUT
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-[#71717A]">
                  <span>Dynamic Bezier Flow Engine</span>
                  <span className="text-[#10B981]">Real-Time Node Highlighting</span>
                </div>
              </div>

              {/* Engine 02: Kids Learning */}
              <div className="lg:col-span-5 bg-[#121216] border border-[#27272A] rounded-xl p-6 flex flex-col justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between font-mono text-[10px]">
                    <span className="px-2 py-0.5 rounded bg-[#F59E0B]/15 text-[#FCD34D]">
                      ENGINE 02
                    </span>
                    <span className="text-[#71717A]">PHONEME_BURST</span>
                  </div>
                  <h3 className="font-display font-bold text-xl text-white">
                    Kids Learning &amp; Gamified Alphabet
                  </h3>
                  <p className="text-xs text-[#A1A1AA] leading-relaxed">
                    Bouncing letter cards, phonetic sound wave cues, and timestamp-synced counting
                    objects designed for early childhood learning channels.
                  </p>
                </div>

                <div className="bg-[#09090B] border border-[#27272A] rounded-lg p-5 flex items-center justify-center gap-5">
                  <div className="w-14 h-14 rounded-xl bg-[#F59E0B] text-[#09090B] font-display font-bold text-2xl flex items-center justify-center shadow-[0_0_24px_rgba(245,158,11,0.3)]">
                    A
                  </div>
                  <span className="text-[#71717A] font-mono text-lg">→</span>
                  <div className="px-4 py-3 rounded-xl bg-[#18181D] border border-[#27272A] text-center">
                    <div className="text-xl">🍎</div>
                    <div className="text-[10px] font-mono text-[#E4E4E7] mt-0.5">APPLE</div>
                  </div>
                </div>

                <div className="text-[11px] font-mono text-[#F59E0B]">
                  ● Phonics-matched audio bounce physics
                </div>
              </div>
            </div>

            {/* Bottom Row: 3 Equal Engine Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Engine 03: Split Comparison */}
              <div className="bg-[#121216] border border-[#27272A] rounded-xl p-6 flex flex-col justify-between gap-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between font-mono text-[10px]">
                    <span className="px-2 py-0.5 rounded bg-[#10B981]/15 text-[#9BFFCE]">
                      ENGINE 03
                    </span>
                    <span className="text-[#71717A]">SPLIT_OSC</span>
                  </div>
                  <h3 className="font-display font-bold text-lg text-white">
                    Split Comparisons &amp; Waveforms
                  </h3>
                  <p className="text-xs text-[#A1A1AA] leading-relaxed">
                    Side-by-side Myth vs. Fact panels, AC vs. DC oscillation curves, and before/after
                    visual explainers.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 bg-[#09090B] border border-[#27272A] rounded-lg p-3 text-[10px] font-mono">
                  <div className="p-2 rounded bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#FCA5A5]">
                    <div className="font-bold">MYTH</div>
                    <div className="text-[#A1A1AA] mt-1">Fails in clouds</div>
                  </div>
                  <div className="p-2 rounded bg-[#10B981]/10 border border-[#10B981]/30 text-[#9BFFCE]">
                    <div className="font-bold">FACT</div>
                    <div className="text-[#A1A1AA] mt-1">Diffuse UV works</div>
                  </div>
                </div>
              </div>

              {/* Engine 04: Stat Counter */}
              <div className="bg-[#121216] border border-[#27272A] rounded-xl p-6 flex flex-col justify-between gap-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between font-mono text-[10px]">
                    <span className="px-2 py-0.5 rounded bg-[#38BDF8]/15 text-[#7DD3FC]">
                      ENGINE 04
                    </span>
                    <span className="text-[#71717A]">INFOGRAPH_FX</span>
                  </div>
                  <h3 className="font-display font-bold text-lg text-white">
                    Animated Counters &amp; Infographics
                  </h3>
                  <p className="text-xs text-[#A1A1AA] leading-relaxed">
                    Data-backed storytelling with spinning radial percentages, 60fps odometer
                    tickers, and comparative bar charts.
                  </p>
                </div>
                <div className="bg-[#09090B] border border-[#27272A] rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <div className="font-display font-bold text-2xl text-[#10B981]">+87.4%</div>
                    <div className="text-[10px] font-mono text-[#71717A]">
                      Average Reel Retention
                    </div>
                  </div>
                  <div className="w-11 h-11 rounded-full border-4 border-[#10B981] flex items-center justify-center font-mono text-[10px] font-bold text-white">
                    87%
                  </div>
                </div>
              </div>

              {/* Engine 05: Illustrated Motion */}
              <div className="bg-[#121216] border border-[#27272A] rounded-xl p-6 flex flex-col justify-between gap-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between font-mono text-[10px]">
                    <span className="px-2 py-0.5 rounded bg-[#A855F7]/15 text-[#D8B4FE]">
                      ENGINE 05
                    </span>
                    <span className="text-[#71717A]">KINETIC_KEYFRAME</span>
                  </div>
                  <h3 className="font-display font-bold text-lg text-white">
                    Illustrated Motion &amp; Camera Rigs
                  </h3>
                  <p className="text-xs text-[#A1A1AA] leading-relaxed">
                    Cinematic pan-and-scan camera tracks, micro-callout label badges, and layered
                    technical scenes rendered at 60fps.
                  </p>
                </div>
                <div className="bg-[#09090B] border border-[#27272A] rounded-lg p-3.5 font-mono text-[10px] space-y-1.5">
                  <div className="flex justify-between text-[#71717A]">
                    <span>CAM_TRACK_AXIS_Z</span>
                    <span>FOV: 35mm</span>
                  </div>
                  <div className="flex items-center justify-between text-[#E4E4E7]">
                    <span className="px-2 py-1 rounded bg-[#18181D] border border-[#27272A]">
                      [PHOTON_A]
                    </span>
                    <span className="text-[#FF4F28]">———→</span>
                    <span className="px-2 py-1 rounded bg-[#18181D] border border-[#27272A]">
                      [BUSBAR]
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. DUAL VOICEOVER & WORD-SYNCED CAPTIONS SECTION */}
        <section id="voice" className="border-t border-[#27272A] py-16 sm:py-20 bg-[#0B0B0E]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#121216] border border-[#27272A] rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#10B981]">
                  0 CREDITS • UNLIMITED
                </span>
                <span className="material-symbols-outlined text-[#10B981]">record_voice_over</span>
              </div>
              <h3 className="font-display font-bold text-2xl text-white">
                Microsoft Edge Neural TTS (Free Forever)
              </h3>
              <p className="text-xs sm:text-sm text-[#A1A1AA] leading-relaxed">
                Generate crisp studio narration in English, Hindi, Spanish, and 40+ languages with
                native millisecond word-boundary timestamps—zero extra credit cost on every draft
                and final 1080p MP4 render.
              </p>
              <div className="flex flex-wrap gap-2 pt-1 font-mono text-[11px]">
                <span className="px-2.5 py-1 rounded bg-[#09090B] border border-[#27272A] text-white">
                  ChristopherNeural (STEM)
                </span>
                <span className="px-2.5 py-1 rounded bg-[#09090B] border border-[#27272A] text-white">
                  AnaNeural (Kids)
                </span>
                <span className="px-2.5 py-1 rounded bg-[#09090B] border border-[#27272A] text-white">
                  AriaNeural (Reels)
                </span>
              </div>
            </div>

            <div className="bg-[#121216] border border-[#27272A] rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#F59E0B]">
                  +1 CREDIT • STUDIO CLONE
                </span>
                <span className="material-symbols-outlined text-[#F59E0B]">graphic_eq</span>
              </div>
              <h3 className="font-display font-bold text-2xl text-white">
                ElevenLabs Pro + 4 Karaoke Caption Presets
              </h3>
              <p className="text-xs sm:text-sm text-[#A1A1AA] leading-relaxed">
                Upgrade any video to ultra-expressive ElevenLabs Pro narration with automatic
                fallback and 4 word-synced subtitle styles: Karaoke Word Box, Hormozi Pop Scale,
                Kids Read-Along Pill, and Clean Cinema Lower-Third.
              </p>
              <div className="p-3 rounded-lg bg-[#09090B] border border-[#27272A] text-center text-xs font-medium text-[#E4E4E7]">
                &ldquo;Every word highlights in exact sync with{" "}
                <span className="px-1.5 py-0.5 rounded bg-[#F59E0B] text-[#09090B] font-display font-bold">
                  60FPS MOTION
                </span>{" "}
                &rdquo;
              </div>
            </div>
          </div>
        </section>

        {/* 6. PER-MEMBER AUTOMATED INSTAGRAM PUBLISHING SECTION */}
        <section id="instagram" className="border-t border-[#27272A] py-16 sm:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div className="space-y-2 max-w-2xl">
                <div className="text-[11px] font-mono uppercase tracking-widest text-[#10B981]">
                  ● INSTAGRAM GRAPH API CONNECTED
                </div>
                <h2 className="font-display font-bold text-3xl sm:text-4xl text-white tracking-tight">
                  Never miss a drop. Automated Per-Member Instagram Publishing.
                </h2>
                <p className="text-sm text-[#A1A1AA]">
                  Every member connects their own personal Instagram Creator or Business account
                  with AES-256-GCM encrypted OAuth tokens, AI captions, and a 30-day Content
                  Calendar.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 font-mono text-[11px]">
                <span className="px-3 py-1.5 rounded-full bg-[#121216] border border-[#27272A] text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                  @solarexplained <span className="text-[#10B981]">ACTIVE</span>
                </span>
                <span className="px-3 py-1.5 rounded-full bg-[#121216] border border-[#27272A] text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                  @kidspark_abc <span className="text-[#10B981]">ACTIVE</span>
                </span>
              </div>
            </div>

            {/* Schedule Strip Card */}
            <div className="bg-[#121216] border border-[#27272A] rounded-2xl p-5 sm:p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="font-display font-bold text-base text-white">
                    November 2026 Content Schedule
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#18181D] border border-[#27272A] font-mono text-[10px] text-[#A1A1AA]">
                    WEEK 48
                  </span>
                </div>
                <div className="inline-flex bg-[#09090B] p-1 rounded-md border border-[#27272A] font-mono text-[11px]">
                  <span className="px-2.5 py-1 text-[#71717A]">Week View</span>
                  <span className="px-2.5 py-1 rounded bg-[#FF4F28] text-[#09090B] font-bold">
                    Month Grid
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                {SCHEDULE_PREVIEW.map((item) => (
                  <div
                    key={item.day}
                    className={`p-3.5 rounded-xl bg-[#09090B] border flex flex-col justify-between gap-3 ${
                      item.featured
                        ? "border-[#FF4F28] shadow-[0_0_24px_rgba(255,79,40,0.14)]"
                        : "border-[#27272A]"
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono text-[10px]">
                      <span className="text-[#A1A1AA] font-bold">{item.day}</span>
                      <span className={`px-1.5 py-0.5 rounded border ${item.statusClass}`}>
                        {item.status}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="font-display font-bold text-xs text-white line-clamp-1">
                        {item.title}
                      </div>
                      <div className="text-[10px] font-mono text-[#71717A]">{item.handle}</div>
                    </div>
                    <div className="text-[10px] font-mono text-[#10B981] pt-2 border-t border-[#27272A]">
                      {item.metric}
                    </div>
                  </div>
                ))}
              </div>

              {/* AI Caption Footer Bar */}
              <div className="p-3.5 rounded-xl bg-[#09090B] border border-[#27272A] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-[10px] font-mono text-[#F59E0B] uppercase">
                    AI GENERATED CAPTION &amp; HASHTAGS (WED 25 POST)
                  </div>
                  <p className="text-xs text-[#E4E4E7]">
                    &ldquo;Did you know 1 hour of sunlight can power Earth for an entire year? ☀️⚡
                    #SolarEnergy #CleanTech #STEMEducation #AnimoraStudio&rdquo;
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoCitations((v) => !v)}
                  className="inline-flex items-center gap-2 text-xs font-mono text-[#A1A1AA] flex-shrink-0"
                >
                  <span
                    className={`w-9 h-5 rounded-full p-0.5 transition-colors flex items-center ${
                      autoCitations ? "bg-[#10B981] justify-end" : "bg-[#27272A] justify-start"
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-white block" />
                  </span>
                  <span>Auto-post 1st comment citations</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 7. PRICING SECTION */}
        <section id="pricing" className="border-t border-[#27272A] py-16 sm:py-24 bg-[#0B0B0E]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-widest text-[#FF4F28]">
                TRANSPARENT VIDEO CREDITS
              </div>
              <h2 className="font-display font-bold text-3xl sm:text-4xl text-white tracking-tight">
                Start free. Scale as your channel grows.
              </h2>
              <p className="text-sm text-[#A1A1AA]">
                30s Reel = 1 Credit • 60s Reel = 2 Credits • 90s Reel = 3 Credits. Browser 60fps
                previews and Edge Neural TTS are 0 Credits forever.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {PRICING_TIERS.map((tier) => (
                <div
                  key={tier.name}
                  className={`rounded-2xl p-6 flex flex-col justify-between gap-6 border ${
                    tier.highlighted
                      ? "bg-[#14141A] border-[#FF4F28] shadow-[0_0_36px_rgba(255,79,40,0.16)]"
                      : "bg-[#121216] border-[#27272A]"
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display font-bold text-lg text-white">{tier.name}</h3>
                      <span
                        className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                          tier.highlighted
                            ? "bg-[#FF4F28] text-[#09090B]"
                            : "bg-[#18181D] text-[#10B981] border border-[#27272A]"
                        }`}
                      >
                        {tier.badge}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-display font-bold text-4xl text-white">
                        {tier.price}
                      </span>
                      <span className="text-xs font-mono text-[#71717A]">{tier.period}</span>
                    </div>
                    <p className="text-xs text-[#A1A1AA] leading-relaxed">{tier.desc}</p>
                    <ul className="space-y-2.5 pt-2 border-t border-[#27272A] text-xs text-[#E4E4E7]">
                      {tier.features.map((feat) => (
                        <li key={feat} className="flex items-start gap-2">
                          <span className="material-symbols-outlined text-[#10B981] text-base leading-none mt-0.5">
                            check_circle
                          </span>
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Link
                    href={tier.href}
                    className={`w-full py-3 rounded-md font-display font-bold text-xs text-center transition-all ${
                      tier.highlighted
                        ? "bg-gradient-to-br from-[#FFB4A4] to-[#FF4F28] text-[#09090B] shadow-lg shadow-[#FF4F28]/20 hover:opacity-95"
                        : "bg-[#18181D] hover:bg-[#27272A] border border-[#27272A] text-white"
                    }`}
                  >
                    {tier.cta}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 8. FINAL CTA BANNER */}
        <section className="border-t border-[#27272A] py-16 sm:py-24">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-6">
            <span className="inline-block px-3 py-1 rounded-full bg-[#121216] border border-[#27272A] font-mono text-[10px] uppercase tracking-widest text-[#FF4F28]">
              READY TO LAUNCH YOUR VIDEO ENGINE?
            </span>
            <h2 className="font-display font-bold text-3xl sm:text-5xl text-white tracking-tight">
              Ready to 10x your educational video pipeline?
            </h2>
            <p className="text-sm text-[#A1A1AA] max-w-xl mx-auto">
              Generate your first 3 high-retention animated educational Reels in under 10 minutes.
              Rendered in 60fps vector motion and synced to your personal Instagram handle.
            </p>
            <div className="pt-2">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-7 py-4 rounded-md bg-gradient-to-br from-[#FFB4A4] to-[#FF4F28] text-[#09090B] font-display font-bold text-sm shadow-[0_0_32px_rgba(255,79,40,0.32)] hover:opacity-95 transition-all"
              >
                <span>Start Free with 15 Video Credits</span>
                <span className="material-symbols-outlined text-base font-bold">bolt</span>
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto pt-4">
              <div className="p-3.5 rounded-lg bg-[#121216] border border-[#27272A]">
                <div className="font-display font-bold text-lg text-white">4.9 / 5.0</div>
                <div className="text-[11px] font-mono text-[#71717A]">From STEM &amp; Kids Creators</div>
              </div>
              <div className="p-3.5 rounded-lg bg-[#121216] border border-[#27272A]">
                <div className="font-display font-bold text-lg text-white">1080×1920 &amp; 16:9</div>
                <div className="text-[11px] font-mono text-[#71717A]">Native 60FPS H.264 MP4</div>
              </div>
              <div className="p-3.5 rounded-lg bg-[#121216] border border-[#27272A]">
                <div className="font-display font-bold text-lg text-white">98.7% On-Time</div>
                <div className="text-[11px] font-mono text-[#71717A]">Direct Auto-Publish SLA</div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 9. FOOTER */}
      <footer className="border-t border-[#27272A] bg-[#09090B] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-[#FF4F28] flex items-center justify-center">
              <span className="material-symbols-outlined text-[#09090B] text-sm font-bold">
                movie_filter
              </span>
            </div>
            <span className="font-display font-bold text-sm text-white">Animora Studio</span>
            <span className="text-xs text-[#71717A]">• Obsidian Cinema Engine</span>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#121216] border border-[#27272A] font-mono text-[10px] text-[#9BFFCE]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
            <span>Signal Jade • All AI Engines Operational</span>
          </div>
        </div>
      </footer>

      {/* 10. REAL RENDERED 1080P SOLAR EXPLAINER DEMO MODAL */}
      {showDemoModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowDemoModal(false)}
        >
          <div
            className="bg-[#121216] border border-[#27272A] rounded-2xl max-w-2xl w-full p-4 sm:p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-display font-bold text-base text-white">
                  Real 1080p MP4 Output: How Solar Panels Turn Sunlight Into Electricity
                </h3>
                <p className="text-[11px] font-mono text-[#A1A1AA]">
                  Rendered programmatically via Animora Remotion Engine + Edge Neural TTS (105s)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDemoModal(false)}
                className="w-8 h-8 rounded-md bg-[#18181D] border border-[#27272A] flex items-center justify-center text-[#A1A1AA] hover:text-white"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            <div className="rounded-xl overflow-hidden bg-black border border-[#27272A]">
              <video
                src="/api/v1/video-file?name=solar"
                controls
                autoPlay
                playsInline
                className="w-full max-h-[480px] object-contain bg-black"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
