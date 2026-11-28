import crypto from "node:crypto";
import { getDb } from "@/lib/db";

export type PlanTierId = "starter_free" | "creator_pro" | "educator_studio";
export type TopUpPackId = "25_cr" | "60_cr" | "150_cr";
export type LedgerCategoryFilter = "all" | "grants" | "renders" | "refunds";
export type LedgerRowCategory = "grant" | "render" | "refund" | "tier_event";

export interface PlanTierDefinition {
  id: PlanTierId;
  name: string;
  eyebrow: string;
  badgeText: string;
  priceMonthlyUsd: number;
  billingSubtext: string;
  monthlyCreditsCap: number;
  rank: number;
  featured?: boolean;
  featuredBanner?: string;
  description: string;
  ctaLabel: string;
  features: string[];
}

export interface TopUpPackDefinition {
  id: TopUpPackId;
  credits: number;
  priceUsd: number;
  perCreditLabel: string;
  estimatedReelsLabel: string;
  priceLabel: string;
  badge?: string;
}

export interface CreditLedgerEntry {
  id: string;
  userId: string;
  delta: number;
  balanceAfter: number;
  reason: string;
  projectId: string | null;
  projectTitle: string | null;
  category: LedgerRowCategory;
  statusLabel: "Confirmed" | "Settled" | "Refunded" | "Plan Sync";
  createdAt: string;
}

export interface MemberBillingTelemetry {
  creditsBalance: number;
  planTier: PlanTierId;
  planName: string;
  planCapCredits: number;
  allocationRemainingPct: number;
  totalMintedCredits: number;
  totalSpentCredits: number;
  totalRefundedCredits: number;
  estimatedUsdSpent: number;
  completedRendersCount: number;
  totalRenderDurationMs: number;
  totalRenderedFrames: number;
  stripeLiveConfigured: boolean;
  resetsInDays: number;
}

export interface MemberBillingOverview {
  telemetry: MemberBillingTelemetry;
  plans: PlanTierDefinition[];
  topUpPacks: TopUpPackDefinition[];
  ledger: CreditLedgerEntry[];
  totalLedgerCount: number;
}

export const PLAN_TIERS: PlanTierDefinition[] = [
  {
    id: "starter_free",
    name: "Starter Free",
    eyebrow: "Free Onboarding",
    badgeText: "15 CR Gift",
    priceMonthlyUsd: 0,
    billingSubtext: "/ month (Free Forever)",
    monthlyCreditsCap: 15,
    rank: 0,
    description:
      "Ideal for sandbox experimentation, rapid script prototyping, and testing dynamic Remotion composition.",
    ctaLabel: "Switch to Starter Free",
    features: [
      "15 Starter video credits (One-time gift)",
      "1080p H.264 standard MP4 export",
      "Microsoft Edge Neural TTS (100% Free Unlimited)",
      "1 Connected Instagram Reels Account",
      "60fps browser timeline live preview engine",
    ],
  },
  {
    id: "creator_pro",
    name: "Creator Pro",
    eyebrow: "Recommended",
    badgeText: "100 CR / Mo",
    priceMonthlyUsd: 29,
    billingSubtext: "/ month (Billed monthly)",
    monthlyCreditsCap: 100,
    rank: 1,
    featured: true,
    featuredBanner: "Most Popular • Best for Educators",
    description:
      "For solo creators, viral educators, and publishers shipping daily educational micro-content.",
    ctaLabel: "Upgrade to Creator Pro",
    features: [
      "100 Video credits per month (~50 high-retention 60s Reels)",
      "ElevenLabs Pro custom voice cloning integration",
      "Full custom Brand Kit & procedurally colored vectors",
      "Autonomous Meta Graph API v21.0 Instagram scheduler",
      "Watermark-optional 1080p crisp render output",
      "Priority Cloudflare R2 worker queue pipeline",
    ],
  },
  {
    id: "educator_studio",
    name: "Educator Studio",
    eyebrow: "Multi-Seat Fleet",
    badgeText: "Scale & Multi-Tenant",
    priceMonthlyUsd: 79,
    billingSubtext: "/ month (Billed monthly)",
    monthlyCreditsCap: 350,
    rank: 2,
    description:
      "Designed for multi-creator collectives, academic course authors, and production marketing agencies.",
    ctaLabel: "Switch to Studio Tier",
    features: [
      "350 Video credits per month (~175 full Reels)",
      "5 Isolated per-member creator workspaces",
      "Bulk CSV prompt & textbook topic syllabus importer",
      "Multi-account Instagram Reels publishing engine",
      "Dedicated webhook API & Priority Render Cluster node",
      "24/7 dedicated engineering support & custom SLA",
    ],
  },
];

export const TOPUP_PACKS: TopUpPackDefinition[] = [
  {
    id: "25_cr",
    credits: 25,
    priceUsd: 9,
    perCreditLabel: "$0.36 / cr",
    estimatedReelsLabel: "~12 high-retention 60s Reels",
    priceLabel: "$9 Starter Top-Up Pack",
  },
  {
    id: "60_cr",
    credits: 60,
    priceUsd: 19,
    perCreditLabel: "$0.31 / cr",
    estimatedReelsLabel: "~30 high-retention 60s Reels",
    priceLabel: "$19 Creator Top-Up Pack",
    badge: "Popular Top-Up",
  },
  {
    id: "150_cr",
    credits: 150,
    priceUsd: 39,
    perCreditLabel: "$0.26 / cr • Best Val",
    estimatedReelsLabel: "~75 high-retention 60s Reels",
    priceLabel: "$39 Studio Top-Up Pack",
  },
];

export function getPlanDefinition(planId: string | null | undefined): PlanTierDefinition {
  return PLAN_TIERS.find((p) => p.id === planId) ?? PLAN_TIERS[0];
}

export function getTopUpPackDefinition(packId: TopUpPackId): TopUpPackDefinition {
  const found = TOPUP_PACKS.find((p) => p.id === packId);
  if (!found) {
    throw new Error(`Unsupported credit top-up pack: ${packId}`);
  }
  return found;
}

function isRealStripeKey(val: string | undefined): boolean {
  if (!val) return false;
  const trimmed = val.trim();
  if (
    !trimmed ||
    trimmed.length < 32 ||
    /your_|placeholder|replace|example|demo|mock|sample|animora/i.test(trimmed)
  ) {
    return false;
  }
  return trimmed.startsWith("sk_live_") || trimmed.startsWith("sk_test_");
}

function classifyLedgerEntry(row: {
  id: string;
  delta: number;
  reason: string;
}): {
  category: LedgerRowCategory;
  statusLabel: CreditLedgerEntry["statusLabel"];
} {
  const lowerId = row.id.toLowerCase();
  const lowerReason = row.reason.toLowerCase();

  if (lowerId.includes("refund") || lowerReason.includes("refund")) {
    return { category: "refund", statusLabel: "Refunded" };
  }
  if (row.delta < 0) {
    return { category: "render", statusLabel: "Settled" };
  }
  if (row.delta === 0) {
    return { category: "tier_event", statusLabel: "Plan Sync" };
  }
  return { category: "grant", statusLabel: "Confirmed" };
}

function parseUsdFromReason(reason: string): number {
  const match = reason.match(/\$(\d+(?:\.\d+)?)/);
  if (!match) return 0;
  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getMemberBillingOverview(
  userId: string,
  options?: {
    filter?: LedgerCategoryFilter;
    query?: string;
  }
): MemberBillingOverview {
  const db = getDb();
  const userRow = db
    .prepare("SELECT id, plan_tier, credits_balance, created_at FROM users WHERE id = ?")
    .get(userId) as
    | {
        id: string;
        plan_tier: string;
        credits_balance: number;
        created_at: string;
      }
    | undefined;

  if (!userRow) {
    throw new Error("Authenticated workspace member not found.");
  }

  const planDef = getPlanDefinition(userRow.plan_tier);

  const rawRows = db
    .prepare(
      `SELECT
         cl.id,
         cl.user_id,
         cl.delta,
         cl.balance_after,
         cl.reason,
         cl.project_id,
         cl.created_at,
         vp.title AS project_title
       FROM credit_ledger cl
       LEFT JOIN video_projects vp
         ON vp.id = cl.project_id AND vp.user_id = cl.user_id
       WHERE cl.user_id = ?
       ORDER BY cl.created_at DESC, cl.rowid DESC`
    )
    .all(userId) as Array<{
    id: string;
    user_id: string;
    delta: number;
    balance_after: number;
    reason: string;
    project_id: string | null;
    created_at: string;
    project_title: string | null;
  }>;

  let totalMintedCredits = 0;
  let totalSpentCredits = 0;
  let totalRefundedCredits = 0;
  let estimatedUsdSpent = 0;

  const allEntries: CreditLedgerEntry[] = rawRows.map((row) => {
    const { category, statusLabel } = classifyLedgerEntry(row);

    if (category === "refund" && row.delta > 0) {
      totalRefundedCredits += row.delta;
    } else if (row.delta > 0) {
      totalMintedCredits += row.delta;
      estimatedUsdSpent += parseUsdFromReason(row.reason);
    } else if (row.delta < 0) {
      totalSpentCredits += Math.abs(row.delta);
    }

    return {
      id: row.id,
      userId: row.user_id,
      delta: row.delta,
      balanceAfter: row.balance_after,
      reason: row.reason,
      projectId: row.project_id ?? null,
      projectTitle: row.project_title ?? null,
      category,
      statusLabel,
      createdAt: row.created_at,
    };
  });

  const renderAgg = db
    .prepare(
      `SELECT
         COUNT(*) AS completed_count,
         COALESCE(SUM(duration_ms), 0) AS total_duration_ms,
         COALESCE(SUM(total_frames), 0) AS total_frames
       FROM renders
       WHERE user_id = ? AND status = 'completed'`
    )
    .get(userId) as {
    completed_count: number;
    total_duration_ms: number;
    total_frames: number;
  };

  const filter: LedgerCategoryFilter = options?.filter ?? "all";
  const query = (options?.query ?? "").trim().toLowerCase();

  const filteredLedger = allEntries.filter((entry) => {
    if (filter === "grants" && entry.category !== "grant") return false;
    if (filter === "renders" && entry.category !== "render") return false;
    if (filter === "refunds" && entry.category !== "refund") return false;

    if (query) {
      const haystack = [
        entry.id,
        entry.reason,
        entry.projectId ?? "",
        entry.projectTitle ?? "",
        entry.statusLabel,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    return true;
  });

  const createdMs = Date.parse(userRow.created_at);
  const daysSinceSignup = Number.isFinite(createdMs)
    ? Math.max(0, Math.floor((Date.now() - createdMs) / 86_400_000))
    : 2;
  const resetsInDays = 30 - (daysSinceSignup % 30);

  const allocationRemainingPct = Math.min(
    100,
    Math.max(0, Math.round((userRow.credits_balance / planDef.monthlyCreditsCap) * 100))
  );

  return {
    telemetry: {
      creditsBalance: userRow.credits_balance,
      planTier: planDef.id,
      planName: planDef.name,
      planCapCredits: planDef.monthlyCreditsCap,
      allocationRemainingPct,
      totalMintedCredits,
      totalSpentCredits,
      totalRefundedCredits,
      estimatedUsdSpent,
      completedRendersCount: Number(renderAgg?.completed_count ?? 0),
      totalRenderDurationMs: Number(renderAgg?.total_duration_ms ?? 0),
      totalRenderedFrames: Number(renderAgg?.total_frames ?? 0),
      stripeLiveConfigured: isRealStripeKey(process.env.STRIPE_SECRET_KEY),
      resetsInDays,
    },
    plans: PLAN_TIERS,
    topUpPacks: TOPUP_PACKS,
    ledger: filteredLedger,
    totalLedgerCount: allEntries.length,
  };
}

export function topUpMemberCredits(
  userId: string,
  packId: TopUpPackId
): {
  status: "credited";
  txId: string;
  pack: TopUpPackDefinition;
  creditsAdded: number;
  creditsBalance: number;
} {
  const pack = getTopUpPackDefinition(packId);
  const txId = `tx_topup_${crypto.randomBytes(5).toString("hex")}`;
  const nowIso = new Date().toISOString();
  const db = getDb();

  let nextBalance = 0;
  db.exec("BEGIN IMMEDIATE");
  try {
    const row = db
      .prepare("SELECT credits_balance FROM users WHERE id = ?")
      .get(userId) as { credits_balance: number } | undefined;

    if (!row) {
      db.exec("ROLLBACK");
      throw new Error("User not found.");
    }

    nextBalance = row.credits_balance + pack.credits;
    db.prepare("UPDATE users SET credits_balance = ?, updated_at = ? WHERE id = ?").run(
      nextBalance,
      nowIso,
      userId
    );

    db.prepare(
      `INSERT INTO credit_ledger (id, user_id, delta, balance_after, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      txId,
      userId,
      pack.credits,
      nextBalance,
      `Credit Top-Up: +${pack.credits} CR (${pack.priceLabel})`,
      nowIso
    );

    db.exec("COMMIT");
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // ignore rollback failure
    }
    throw err;
  }

  return {
    status: "credited",
    txId,
    pack,
    creditsAdded: pack.credits,
    creditsBalance: nextBalance,
  };
}

export function changeMemberPlanTier(
  userId: string,
  targetPlanId: PlanTierId
): {
  status: "updated" | "unchanged";
  txId: string | null;
  previousPlan: PlanTierId;
  planTier: PlanTierId;
  planName: string;
  creditsAdded: number;
  creditsBalance: number;
} {
  const targetPlan = getPlanDefinition(targetPlanId);
  const nowIso = new Date().toISOString();
  const db = getDb();

  db.exec("BEGIN IMMEDIATE");
  try {
    const row = db
      .prepare("SELECT plan_tier, credits_balance FROM users WHERE id = ?")
      .get(userId) as { plan_tier: string; credits_balance: number } | undefined;

    if (!row) {
      db.exec("ROLLBACK");
      throw new Error("User not found.");
    }

    const currentPlan = getPlanDefinition(row.plan_tier);
    if (currentPlan.id === targetPlan.id) {
      db.exec("COMMIT");
      return {
        status: "unchanged",
        txId: null,
        previousPlan: currentPlan.id,
        planTier: targetPlan.id,
        planName: targetPlan.name,
        creditsAdded: 0,
        creditsBalance: row.credits_balance,
      };
    }

    const isUpgrade = targetPlan.rank > currentPlan.rank;
    const creditsAdded = isUpgrade ? targetPlan.monthlyCreditsCap : 0;
    const nextBalance = row.credits_balance + creditsAdded;
    const txId = `tx_plan_${crypto.randomBytes(5).toString("hex")}`;

    const reason = isUpgrade
      ? `Plan Upgrade: ${targetPlan.name} (+${creditsAdded} CR • $${targetPlan.priceMonthlyUsd}/mo)`
      : `Plan Tier Switch: ${targetPlan.name} ($${targetPlan.priceMonthlyUsd}/mo • Existing balance retained)`;

    db.prepare(
      "UPDATE users SET plan_tier = ?, credits_balance = ?, updated_at = ? WHERE id = ?"
    ).run(targetPlan.id, nextBalance, nowIso, userId);

    db.prepare(
      `INSERT INTO credit_ledger (id, user_id, delta, balance_after, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(txId, userId, creditsAdded, nextBalance, reason, nowIso);

    db.exec("COMMIT");

    return {
      status: "updated",
      txId,
      previousPlan: currentPlan.id,
      planTier: targetPlan.id,
      planName: targetPlan.name,
      creditsAdded,
      creditsBalance: nextBalance,
    };
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // ignore rollback failure
    }
    throw err;
  }
}

function escapeCsvCell(value: string | number | null | undefined): string {
  const str = value == null ? "" : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportMemberLedgerCsv(
  userId: string,
  options?: {
    filter?: LedgerCategoryFilter;
    query?: string;
  }
): string {
  const overview = getMemberBillingOverview(userId, options);
  const header = [
    "Timestamp_UTC",
    "Tx_Hash",
    "Category",
    "Event_Description",
    "Project_ID",
    "Project_Title",
    "Delta_Credits",
    "Balance_After",
    "Status",
  ].join(",");

  const rows = overview.ledger.map((entry) =>
    [
      escapeCsvCell(entry.createdAt),
      escapeCsvCell(entry.id),
      escapeCsvCell(entry.category),
      escapeCsvCell(entry.reason),
      escapeCsvCell(entry.projectId ?? ""),
      escapeCsvCell(entry.projectTitle ?? ""),
      escapeCsvCell(entry.delta),
      escapeCsvCell(entry.balanceAfter),
      escapeCsvCell(entry.statusLabel),
    ].join(",")
  );

  return [header, ...rows].join("\r\n") + "\r\n";
}
