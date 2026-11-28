"use client";

import React, { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  CreditLedgerEntry,
  LedgerCategoryFilter,
  MemberBillingOverview,
  PlanTierId,
  TopUpPackId,
} from "@/lib/billing";

interface BillingCreditsClientProps {
  initialOverview: MemberBillingOverview;
  userId: string;
  workspaceSlug: string;
}

function formatRenderDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}m ${String(secs).padStart(2, "0")}s`;
}

function formatUtcTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

export default function BillingCreditsClient({
  initialOverview,
  userId,
  workspaceSlug,
}: BillingCreditsClientProps) {
  const router = useRouter();
  const topUpSectionRef = useRef<HTMLDivElement | null>(null);

  const [overview, setOverview] = useState<MemberBillingOverview>(initialOverview);
  const [activeFilter, setActiveFilter] = useState<LedgerCategoryFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingPack, setLoadingPack] = useState<TopUpPackId | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<PlanTierId | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [showPricingDocs, setShowPricingDocs] = useState(false);
  const [showPaymentVaultInfo, setShowPaymentVaultInfo] = useState(false);
  const [banner, setBanner] = useState<{
    tone: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const filteredLedger = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return overview.ledger.filter((entry) => {
      if (activeFilter === "grants" && entry.category !== "grant") return false;
      if (activeFilter === "renders" && entry.category !== "render") return false;
      if (activeFilter === "refunds" && entry.category !== "refund") return false;

      if (q) {
        const haystack = [
          entry.id,
          entry.reason,
          entry.projectId ?? "",
          entry.projectTitle ?? "",
          entry.statusLabel,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [overview.ledger, activeFilter, searchQuery]);

  const handleTopUp = async (packId: TopUpPackId) => {
    setLoadingPack(packId);
    setBanner(null);
    try {
      const res = await fetch("/api/v1/credits/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack: packId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to purchase credit pack.");
      }

      if (data.overview) {
        setOverview(data.overview);
      }
      setBanner({
        tone: "success",
        message: `Minted +${data.creditsAdded} Video Credits (${data.txId}). New workspace balance: ${data.creditsBalance} CR.`,
      });
      router.refresh();
    } catch (err) {
      setBanner({
        tone: "error",
        message: err instanceof Error ? err.message : "Failed to top up credits.",
      });
    } finally {
      setLoadingPack(null);
    }
  };

  const handlePlanChange = async (targetPlan: PlanTierId) => {
    if (targetPlan === overview.telemetry.planTier) return;
    setLoadingPlan(targetPlan);
    setBanner(null);
    try {
      const res = await fetch("/api/v1/credits/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planTier: targetPlan }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to switch subscription plan.");
      }

      if (data.overview) {
        setOverview(data.overview);
      }

      const creditMsg =
        data.creditsAdded > 0
          ? ` Granted +${data.creditsAdded} CR (${data.txId}).`
          : data.txId
            ? ` Audit logged (${data.txId}) — existing ${data.creditsBalance} CR balance retained.`
            : "";

      setBanner({
        tone: "success",
        message: `Workspace switched to ${data.planName}.${creditMsg}`,
      });
      router.refresh();
    } catch (err) {
      setBanner({
        tone: "error",
        message: err instanceof Error ? err.message : "Failed to switch plan tier.",
      });
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleExportCsv = async () => {
    setExportingCsv(true);
    setBanner(null);
    try {
      const params = new URLSearchParams({
        filter: activeFilter,
        format: "csv",
      });
      if (searchQuery.trim()) {
        params.set("q", searchQuery.trim());
      }

      const res = await fetch(`/api/v1/credits/ledger?${params.toString()}`, {
        method: "GET",
      });
      if (!res.ok) {
        throw new Error("Failed to export credit ledger CSV.");
      }

      const csvText = await res.text();
      const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dateStamp = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `animora-credit-ledger-${workspaceSlug || "workspace"}-${dateStamp}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setBanner({
        tone: "info",
        message: `Exported ${filteredLedger.length} immutable ledger record${filteredLedger.length === 1 ? "" : "s"} as RFC-4180 CSV.`,
      });
    } catch (err) {
      setBanner({
        tone: "error",
        message: err instanceof Error ? err.message : "CSV export failed.",
      });
    } finally {
      setExportingCsv(false);
    }
  };

  const scrollToTopUps = () => {
    topUpSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const { telemetry } = overview;
  const est30s = Math.floor(telemetry.creditsBalance / 1);
  const est60s = Math.floor(telemetry.creditsBalance / 2);
  const est90s = Math.floor(telemetry.creditsBalance / 3);

  const renderDeltaBadge = (entry: CreditLedgerEntry) => {
    if (entry.category === "refund") {
      return (
        <span className="font-mono font-bold text-[#10B981]">
          +{entry.delta} CR <span className="text-[10px] uppercase">Refund</span>
        </span>
      );
    }
    if (entry.delta > 0) {
      return <span className="font-mono font-bold text-[#10B981]">+{entry.delta} CR</span>;
    }
    if (entry.delta < 0) {
      return <span className="font-mono font-bold text-[#FF4F28]">{entry.delta} CR</span>;
    }
    return (
      <span className="font-mono text-[#A1A1AA]">
        0 CR <span className="text-[10px] text-[#F59E0B]">Tier</span>
      </span>
    );
  };

  const renderStatusPill = (entry: CreditLedgerEntry) => {
    if (entry.statusLabel === "Confirmed") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#10B981]/15 border border-[#10B981]/30 text-[#10B981] font-mono text-[10px] font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
          Confirmed
        </span>
      );
    }
    if (entry.statusLabel === "Refunded") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F59E0B]/15 border border-[#F59E0B]/30 text-[#F59E0B] font-mono text-[10px] font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
          Auto-Refunded
        </span>
      );
    }
    if (entry.statusLabel === "Plan Sync") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#27272A] text-[#E4E4E7] font-mono text-[10px]">
          Plan Sync
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#18181D] border border-[#27272A] text-[#A1A1AA] font-mono text-[10px]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#FF4F28]" />
        Settled
      </span>
    );
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Top Subheader Pills & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#121216] border border-[#27272A] text-[11px] font-mono uppercase tracking-wider text-[#10B981]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
            Per-Member Immutable Audit
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#121216] border border-[#27272A] text-[11px] font-mono text-[#A1A1AA]">
            {telemetry.stripeLiveConfigured
              ? "Stripe Live Billing Active"
              : "Instant Sandbox Settlement Mode"}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowPricingDocs((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#121216] hover:bg-[#18181D] border border-[#27272A] text-xs font-mono text-[#E4E4E7] transition-colors"
          >
            <span className="material-symbols-outlined text-base text-[#F59E0B]">help</span>
            Pricing Docs
          </button>
          <button
            type="button"
            onClick={scrollToTopUps}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#FF4F28] hover:bg-[#FF6845] text-[#09090B] text-xs font-display font-bold uppercase tracking-wider shadow-lg shadow-[#FF4F28]/20 transition-all"
          >
            <span className="material-symbols-outlined text-base">add_circle</span>
            Add Credits
          </button>
        </div>
      </div>

      {/* Collapsible Pricing Docs Spec Drawer */}
      {showPricingDocs && (
        <div className="rounded-xl bg-[#121216] border border-[#F59E0B]/40 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-display font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-[#F59E0B] text-lg">policy</span>
              Deterministic Credit Burn Rate & Auto-Refund SLA
            </h3>
            <button
              type="button"
              onClick={() => setShowPricingDocs(false)}
              className="text-xs font-mono text-[#A1A1AA] hover:text-white"
            >
              Close ✕
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-[#A1A1AA]">
            <div className="p-3 rounded-lg bg-[#0C0C0F] border border-[#27272A]">
              <div className="font-mono font-bold text-white mb-1">1080p MP4 Export Costs</div>
              <p>
                30s = <strong className="text-[#FF4F28]">1 CR</strong> • 60s ={" "}
                <strong className="text-[#FF4F28]">2 CR</strong> • 90s ={" "}
                <strong className="text-[#FF4F28]">3 CR</strong>. Credits are only deducted when
                queuing a final H.264 MP4 render.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[#0C0C0F] border border-[#27272A]">
              <div className="font-mono font-bold text-[#10B981] mb-1">Zero-Cost Authoring</div>
              <p>
                AI script generation, storyboard scene edits, 60fps canvas previews, and Edge
                Neural TTS synthesis cost <strong className="text-[#10B981]">0 CR</strong>.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[#0C0C0F] border border-[#27272A]">
              <div className="font-mono font-bold text-[#F59E0B] mb-1">Crash Auto-Refund Guarantee</div>
              <p>
                If Chromium or FFmpeg encounters an unexpected failure mid-render, our worker
                automatically mints a <code className="text-white">tx_ref_*_refunded</code> credit
                restoration row.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Status Toast Banner */}
      {banner && (
        <div
          role="status"
          className={`rounded-xl px-4 py-3 border flex items-center justify-between gap-3 text-xs font-mono ${
            banner.tone === "success"
              ? "bg-[#10B981]/10 border-[#10B981]/40 text-[#10B981]"
              : banner.tone === "error"
                ? "bg-red-500/10 border-red-500/40 text-red-400"
                : "bg-[#F59E0B]/10 border-[#F59E0B]/40 text-[#F59E0B]"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">
              {banner.tone === "success"
                ? "verified"
                : banner.tone === "error"
                  ? "error"
                  : "download_done"}
            </span>
            <span>{banner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="text-[11px] opacity-80 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* TOP CREDIT BALANCE HERO BANNER */}
      <section className="relative overflow-hidden rounded-2xl bg-[#121216] border border-[#27272A] p-6 lg:p-8 shadow-2xl">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#FF4F28]/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 left-1/3 w-80 h-80 rounded-full bg-[#F59E0B]/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Balance Gauge + Burn Rate Calculator */}
          <div className="lg:col-span-7 space-y-5">
            <div className="flex items-baseline justify-between flex-wrap gap-3">
              <div className="flex items-baseline gap-3 flex-wrap">
                <span
                  data-testid="hero-credits-balance"
                  className="text-4xl lg:text-5xl font-display font-bold tracking-tight text-white"
                >
                  {telemetry.creditsBalance}
                </span>
                <span className="text-base lg:text-lg text-[#A1A1AA] font-mono">
                  / {telemetry.planCapCredits} {telemetry.planName} Credits Available
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#18181D] border border-[#27272A] text-xs font-mono text-[#10B981]">
                <span className="material-symbols-outlined text-sm">autorenew</span>
                Cycle resets in {telemetry.resetsInDays} days
              </span>
            </div>

            {/* Progress Track */}
            <div className="space-y-2">
              <div className="w-full h-3 rounded-full bg-[#1E1E24] p-0.5 overflow-hidden border border-[#27272A]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#FF4F28] to-[#F59E0B] transition-all duration-500 shadow-[0_0_12px_rgba(255,79,40,0.45)]"
                  style={{ width: `${telemetry.allocationRemainingPct}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[11px] font-mono text-[#A1A1AA] flex-wrap gap-2">
                <span>
                  {telemetry.totalSpentCredits} CR Spent
                  {telemetry.totalRefundedCredits > 0
                    ? ` • +${telemetry.totalRefundedCredits} CR Auto-Refunded`
                    : ""}
                </span>
                <span className="text-[#FF4F28] font-semibold">
                  {telemetry.allocationRemainingPct}% Tier Allocation Meter
                </span>
                <span>{telemetry.planCapCredits} CR Tier Cap</span>
              </div>
            </div>

            {/* Burn Rate Telemetry Calculator Pills */}
            <div className="pt-2 space-y-2">
              <div className="text-[11px] font-mono font-bold tracking-widest uppercase text-[#A1A1AA]">
                Current Burn Rate Telemetry & Capacity Estimator
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-[#0C0C0F] border border-[#27272A] space-y-1">
                  <div className="text-[10px] font-mono uppercase text-[#71717A]">30s Reel</div>
                  <div className="text-sm font-mono font-bold text-white">
                    1 <span className="text-xs text-[#FF4F28] font-normal">CR</span>
                  </div>
                  <div className="text-[10px] font-mono text-[#A1A1AA]">~{est30s} exports left</div>
                </div>
                <div className="p-3 rounded-xl bg-[#0C0C0F] border border-[#27272A] space-y-1">
                  <div className="text-[10px] font-mono uppercase text-[#71717A]">60s Reel</div>
                  <div className="text-sm font-mono font-bold text-white">
                    2 <span className="text-xs text-[#FF4F28] font-normal">CR</span>
                  </div>
                  <div className="text-[10px] font-mono text-[#A1A1AA]">~{est60s} exports left</div>
                </div>
                <div className="p-3 rounded-xl bg-[#0C0C0F] border border-[#27272A] space-y-1">
                  <div className="text-[10px] font-mono uppercase text-[#71717A]">90s Reel</div>
                  <div className="text-sm font-mono font-bold text-white">
                    3 <span className="text-xs text-[#FF4F28] font-normal">CR</span>
                  </div>
                  <div className="text-[10px] font-mono text-[#A1A1AA]">~{est90s} exports left</div>
                </div>
                <div className="p-3 rounded-xl bg-[#0C0C0F] border border-[#27272A] space-y-1">
                  <div className="text-[10px] font-mono uppercase text-[#71717A]">Previews / TTS</div>
                  <div className="text-sm font-mono font-bold text-[#10B981]">
                    0 CR <span className="text-[10px] font-normal text-[#A1A1AA]">Free</span>
                  </div>
                  <div className="text-[10px] font-mono text-[#10B981]">Unlimited</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Lifetime Telemetry & Quick Actions */}
          <div className="lg:col-span-5 space-y-4 lg:pl-6 lg:border-l lg:border-[#27272A]">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-[#0C0C0F] border border-[#27272A] space-y-1">
                <span className="text-[10px] font-mono uppercase text-[#71717A] block">
                  Total Spent
                </span>
                <span className="text-base font-mono font-bold text-white block">
                  ${telemetry.estimatedUsdSpent.toFixed(2)}
                </span>
                <span className="text-[10px] text-[#71717A] font-mono block">USD</span>
              </div>
              <div className="p-3 rounded-xl bg-[#0C0C0F] border border-[#27272A] space-y-1">
                <span className="text-[10px] font-mono uppercase text-[#71717A] block">
                  Minted (Life)
                </span>
                <span className="text-base font-mono font-bold text-[#FF4F28] block">
                  {telemetry.totalMintedCredits} CR
                </span>
                <span className="text-[10px] text-[#10B981] font-mono block">Verified</span>
              </div>
              <div className="p-3 rounded-xl bg-[#0C0C0F] border border-[#27272A] space-y-1">
                <span className="text-[10px] font-mono uppercase text-[#71717A] block">
                  Render Time
                </span>
                <span className="text-base font-mono font-bold text-white block">
                  {formatRenderDuration(telemetry.totalRenderDurationMs)}
                </span>
                <span className="text-[10px] text-[#71717A] font-mono block">
                  {telemetry.totalRenderedFrames.toLocaleString()} frames
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => handleTopUp("60_cr")}
                disabled={loadingPack !== null}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-[#FF4F28] hover:bg-[#FF6845] disabled:opacity-60 text-[#09090B] font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
              >
                <span className="material-symbols-outlined text-base">bolt</span>
                {loadingPack === "60_cr" ? "Minting +60 CR..." : "+ Quick Top-Up (60 CR)"}
              </button>
              <button
                type="button"
                onClick={() => setShowPaymentVaultInfo((prev) => !prev)}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-[#18181D] hover:bg-[#222228] border border-[#27272A] text-white font-mono text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <span className="material-symbols-outlined text-base text-[#F59E0B]">
                  credit_card
                </span>
                Payment Vault
              </button>
            </div>

            {showPaymentVaultInfo && (
              <div className="p-3 rounded-xl bg-[#0C0C0F] border border-[#27272A] text-[11px] font-mono text-[#A1A1AA] space-y-1">
                <div className="text-white font-semibold">
                  {telemetry.stripeLiveConfigured
                    ? "Stripe Checkout Connected"
                    : "Local Developer Sandbox Billing Active"}
                </div>
                <p>
                  {telemetry.stripeLiveConfigured
                    ? "Your workspace is linked to live Stripe Checkout."
                    : "No STRIPE_SECRET_KEY configured in .env — top-ups and tier upgrades execute atomic instant ledger settlements for zero-friction local testing."}
                </p>
              </div>
            )}

            <div className="flex items-center gap-2 text-[11px] text-[#A1A1AA] font-mono">
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
              <span>Meta Graph & Local Render Engine synced. Zero hidden compute fees.</span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION: SUBSCRIPTION PLAN TIERS */}
      <section className="space-y-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="font-bold uppercase tracking-widest text-[#FF4F28]">
              Subscription Matrix
            </span>
            <span className="text-[#52525B]">•</span>
            <span className="text-[#A1A1AA]">Billed monthly • Switch or upgrade anytime</span>
          </div>
          <h2 className="text-xl font-display font-bold text-white">Studio Production Tiers</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {overview.plans.map((plan) => {
            const isCurrent = telemetry.planTier === plan.id;
            const isSwitching = loadingPlan === plan.id;

            return (
              <div
                key={plan.id}
                data-testid={`plan-card-${plan.id}`}
                className={`relative rounded-2xl p-6 flex flex-col justify-between gap-8 transition-all ${
                  plan.featured
                    ? "bg-[#16161C] border-2 border-[#FF4F28]/60 shadow-[0_0_35px_rgba(255,79,40,0.12)]"
                    : "bg-[#121216] border border-[#27272A]"
                }`}
              >
                {plan.featured && plan.featuredBanner && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-[#FF4F28] to-[#F59E0B] text-[#09090B] font-display text-[10px] font-bold tracking-widest uppercase shadow-md flex items-center gap-1 whitespace-nowrap">
                    <span className="material-symbols-outlined text-xs">stars</span>
                    {plan.featuredBanner}
                  </div>
                )}

                <div className="space-y-5 pt-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div
                        className={`text-xs font-mono uppercase tracking-widest ${
                          plan.featured ? "text-[#FF4F28] font-bold" : "text-[#A1A1AA]"
                        }`}
                      >
                        {plan.eyebrow}
                      </div>
                      <h3 className="text-2xl font-display font-bold text-white mt-0.5">
                        {plan.name}
                      </h3>
                    </div>

                    {isCurrent ? (
                      <span className="px-2.5 py-1 rounded-full bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981] text-[10px] font-mono uppercase font-bold tracking-wider">
                        Current Active Plan
                      </span>
                    ) : (
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-mono uppercase font-bold tracking-wider ${
                          plan.featured
                            ? "bg-[#FF4F28]/15 text-[#FF4F28]"
                            : "bg-[#F59E0B]/15 text-[#F59E0B]"
                        }`}
                      >
                        {plan.badgeText}
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-display font-bold text-white">
                      ${plan.priceMonthlyUsd}
                    </span>
                    <span className="text-xs font-mono text-[#A1A1AA]">{plan.billingSubtext}</span>
                  </div>

                  <p className="text-xs text-[#A1A1AA] leading-relaxed">{plan.description}</p>

                  <ul className="space-y-2.5 pt-1">
                    {plan.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs text-[#E4E4E7]">
                        <span
                          className={`material-symbols-outlined text-base shrink-0 mt-0.5 ${
                            plan.featured ? "text-[#FF4F28]" : "text-[#10B981]"
                          }`}
                        >
                          {idx === 0 && plan.featured ? "verified" : "check_circle"}
                        </span>
                        <span className={idx === 0 ? "font-semibold text-white" : ""}>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {isCurrent ? (
                  <button
                    type="button"
                    disabled
                    className="w-full py-3 rounded-xl bg-[#1E1E24] border border-[#27272A] text-[#71717A] font-mono text-xs font-semibold uppercase tracking-wider cursor-not-allowed"
                  >
                    Current Plan
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handlePlanChange(plan.id)}
                    disabled={loadingPlan !== null}
                    className={`w-full py-3 rounded-xl font-display font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-60 ${
                      plan.featured
                        ? "bg-gradient-to-r from-[#FF4F28] to-[#FF7859] hover:brightness-110 text-[#09090B] shadow-lg shadow-[#FF4F28]/25"
                        : "bg-[#18181D] hover:bg-[#24242B] border border-[#27272A] text-white"
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">
                      {plan.featured ? "rocket_launch" : "swap_horiz"}
                    </span>
                    {isSwitching ? "Updating Plan..." : plan.ctaLabel}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION: INSTANT CREDIT TOP-UP PACKS */}
      <section ref={topUpSectionRef} id="topup-packs" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="font-bold uppercase tracking-widest text-[#F59E0B]">
                Pay As You Go
              </span>
              <span className="text-[#52525B]">•</span>
              <span className="text-[#A1A1AA]">Credits never expire</span>
            </div>
            <h3 className="text-lg font-display font-bold text-white">
              Instant Credit Top-Up Packs
            </h3>
          </div>
          <span className="text-xs font-mono text-[#71717A]">
            Atomic SQLite WAL ledger grant • Zero expiration
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {overview.topUpPacks.map((pack) => {
            const isPopular = Boolean(pack.badge);
            const isBuying = loadingPack === pack.id;

            return (
              <div
                key={pack.id}
                data-testid={`topup-pack-${pack.id}`}
                className={`p-4 rounded-xl bg-[#121216] border transition-all flex items-center justify-between gap-3 relative overflow-hidden ${
                  isPopular
                    ? "border-[#F59E0B]/50 hover:border-[#F59E0B]"
                    : "border-[#27272A] hover:border-[#3F3F46]"
                }`}
              >
                {pack.badge && (
                  <div className="absolute top-0 right-0 px-2 py-0.5 bg-[#F59E0B]/20 text-[#F59E0B] text-[9px] font-mono uppercase font-bold tracking-wider rounded-bl">
                    {pack.badge}
                  </div>
                )}

                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      isPopular ? "bg-[#F59E0B]/15 text-[#F59E0B]" : "bg-[#FF4F28]/15 text-[#FF4F28]"
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl">
                      {pack.id === "150_cr"
                        ? "workspace_premium"
                        : isPopular
                          ? "electric_bolt"
                          : "bolt"}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-display font-bold text-white">
                        {pack.credits} Credits
                      </span>
                      <span
                        className={`text-[11px] font-mono ${
                          pack.id === "150_cr"
                            ? "text-[#10B981]"
                            : isPopular
                              ? "text-[#F59E0B]"
                              : "text-[#A1A1AA]"
                        }`}
                      >
                        ({pack.perCreditLabel})
                      </span>
                    </div>
                    <div className="text-xs text-[#A1A1AA] truncate">
                      {pack.estimatedReelsLabel}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleTopUp(pack.id)}
                  disabled={loadingPack !== null}
                  className={`px-3.5 py-2 rounded-lg text-xs font-display font-bold transition-colors flex items-center gap-1.5 shrink-0 disabled:opacity-60 ${
                    isPopular
                      ? "bg-[#F59E0B] hover:bg-[#FBBF24] text-[#09090B]"
                      : "bg-[#18181D] hover:bg-[#27272A] border border-[#27272A] text-white"
                  }`}
                >
                  <span>{isBuying ? "Minting..." : `Buy $${pack.priceUsd}`}</span>
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION: FULL-WIDTH IMMUTABLE VIDEO CREDIT LEDGER */}
      <section className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="font-bold uppercase tracking-widest text-[#FF4F28]">
                Cryptographic Audit
              </span>
              <span className="text-[#52525B]">•</span>
              <span className="text-[#A1A1AA]">Member-Scoped `credit_ledger`</span>
            </div>
            <h3 className="text-xl font-display font-bold text-white">
              Immutable Render Transaction Log
            </h3>
          </div>

          {/* Search, Category Filter Chips & CSV Export */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative w-full sm:w-auto">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A] text-base">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by tx hash, project, reason..."
                aria-label="Filter transactions"
                className="h-9 pl-9 pr-3 rounded-lg bg-[#121216] border border-[#27272A] text-xs text-white placeholder:text-[#71717A] focus:outline-none focus:border-[#FF4F28] w-full sm:w-64 font-mono"
              />
            </div>

            <div className="flex items-center gap-1 bg-[#121216] border border-[#27272A] p-1 rounded-lg">
              {(
                [
                  { id: "all", label: "All" },
                  { id: "grants", label: "Grants" },
                  { id: "renders", label: "Renders (-CR)" },
                  { id: "refunds", label: "Refunds" },
                ] as Array<{ id: LedgerCategoryFilter; label: string }>
              ).map((tab) => {
                const active = activeFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveFilter(tab.id)}
                    className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                      active
                        ? "bg-[#FF4F28] text-[#09090B] font-bold"
                        : "text-[#A1A1AA] hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exportingCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#121216] hover:bg-[#18181D] border border-[#27272A] text-xs font-mono font-semibold text-white transition-colors disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-base text-[#10B981]">download</span>
              <span>{exportingCsv ? "Exporting..." : "Export CSV"}</span>
            </button>
          </div>
        </div>

        {/* Desktop Table Surface */}
        <div className="hidden md:block overflow-x-auto rounded-2xl bg-[#121216] border border-[#27272A] shadow-xl">
          <table className="w-full text-left border-collapse min-w-[860px]">
            <thead>
              <tr className="bg-[#18181D] border-b border-[#27272A] text-[11px] font-mono uppercase tracking-wider text-[#A1A1AA]">
                <th className="py-3.5 px-4 font-medium">Timestamp (UTC)</th>
                <th className="py-3.5 px-4 font-medium">Tx Hash</th>
                <th className="py-3.5 px-4 font-medium">Event Description</th>
                <th className="py-3.5 px-4 font-medium">Context / Artifact</th>
                <th className="py-3.5 px-4 font-medium text-right">Delta</th>
                <th className="py-3.5 px-4 font-medium text-right">Balance</th>
                <th className="py-3.5 px-4 font-medium text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272A]/70 text-xs">
              {filteredLedger.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 px-4 text-center font-mono text-[#71717A]">
                    No cryptographic ledger entries match the current filter.
                  </td>
                </tr>
              ) : (
                filteredLedger.map((entry) => (
                  <tr
                    key={entry.id}
                    className="hover:bg-[#18181D]/60 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono text-[#A1A1AA] whitespace-nowrap">
                      {formatUtcTimestamp(entry.createdAt)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[#FF4F28] whitespace-nowrap">
                      {entry.id}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-white">{entry.reason}</td>
                    <td className="py-3.5 px-4 text-[#A1A1AA] font-mono text-[11px]">
                      {entry.projectId ? (
                        <Link
                          href={`/dashboard/projects/${entry.projectId}/publish`}
                          className="text-[#F59E0B] hover:underline inline-flex items-center gap-1"
                        >
                          <span>{entry.projectTitle || entry.projectId}</span>
                          <span className="material-symbols-outlined text-xs">open_in_new</span>
                        </Link>
                      ) : entry.category === "grant" ? (
                        `Credit Allocation (${entry.delta > 0 ? `+${entry.delta}` : entry.delta} CR)`
                      ) : (
                        "Workspace Billing Event"
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      {renderDeltaBadge(entry)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-white text-right font-semibold whitespace-nowrap">
                      {entry.balanceAfter} CR
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      {renderStatusPill(entry)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="px-5 py-3.5 bg-[#0C0C0F] border-t border-[#27272A] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono text-[#A1A1AA]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#10B981]" />
              <span>
                Showing {filteredLedger.length} of {overview.totalLedgerCount} cryptographic
                transactions
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-[#10B981]">lock</span>
              <span>
                End-to-end audit verified via Member Partition{" "}
                <code className="text-white font-semibold">{userId}</code>
              </span>
            </div>
          </div>
        </div>

        {/* Mobile Stacked Audit Cards (Stitch 11B) */}
        <div className="md:hidden space-y-3">
          {filteredLedger.length === 0 ? (
            <div className="p-6 rounded-xl bg-[#121216] border border-[#27272A] text-center font-mono text-xs text-[#71717A]">
              No cryptographic ledger entries match the current filter.
            </div>
          ) : (
            filteredLedger.map((entry) => (
              <div
                key={entry.id}
                className="p-4 rounded-xl bg-[#121216] border border-[#27272A] space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-[#FF4F28] font-semibold truncate">
                    {entry.id}
                  </span>
                  {renderStatusPill(entry)}
                </div>
                <div className="text-xs font-semibold text-white">{entry.reason}</div>
                {entry.projectId && (
                  <Link
                    href={`/dashboard/projects/${entry.projectId}/publish`}
                    className="block text-[11px] font-mono text-[#F59E0B] hover:underline truncate"
                  >
                    Project: {entry.projectTitle || entry.projectId} →
                  </Link>
                )}
                <div className="pt-2 border-t border-[#27272A] flex items-center justify-between text-xs font-mono">
                  <span className="text-[#71717A] text-[11px]">
                    {formatUtcTimestamp(entry.createdAt)}
                  </span>
                  <div className="flex items-center gap-3">
                    {renderDeltaBadge(entry)}
                    <span className="text-white font-semibold">Bal: {entry.balanceAfter} CR</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ENTERPRISE / API WEBHOOKS FOOTNOTE BANNER */}
      <section className="rounded-2xl bg-[#121216] border border-[#27272A] p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#18181D] border border-[#27272A] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[#F59E0B] text-2xl">terminal</span>
          </div>
          <div>
            <h4 className="text-sm font-display font-bold text-white">
              Need programmatic rendering webhooks or API keys?
            </h4>
            <p className="text-xs text-[#A1A1AA]">
              Configure HMAC-signed render completion webhooks and workspace security settings in
              Account & Security.
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/settings"
          className="px-4 py-2.5 rounded-xl bg-[#18181D] hover:bg-[#24242B] border border-[#27272A] text-xs font-mono font-semibold text-white transition-colors whitespace-nowrap inline-flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-base text-[#FF4F28]">shield_person</span>
          Account & Security →
        </Link>
      </section>
    </div>
  );
}
