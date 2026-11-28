import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

const topupSchema = z.object({
  pack: z.enum(["25_cr", "60_cr"]).default("60_cr"),
});

const PACK_CONFIG = {
  "25_cr": { credits: 25, priceLabel: "$9 Starter Top-Up Pack" },
  "60_cr": { credits: 60, priceLabel: "$19 Creator Top-Up Pack" },
} as const;

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = topupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid credit top-up pack." }, { status: 400 });
    }

    const packInfo = PACK_CONFIG[parsed.data.pack];
    const txId = `tx_topup_${crypto.randomBytes(5).toString("hex")}`;
    const nowIso = new Date().toISOString();
    const db = getDb();

    let nextBalance = 0;
    db.exec("BEGIN IMMEDIATE");
    try {
      const row = db
        .prepare("SELECT credits_balance FROM users WHERE id = ?")
        .get(user.id) as { credits_balance: number } | undefined;

      if (!row) {
        db.exec("ROLLBACK");
        return NextResponse.json({ error: "User not found." }, { status: 404 });
      }

      nextBalance = row.credits_balance + packInfo.credits;
      db.prepare("UPDATE users SET credits_balance = ?, updated_at = ? WHERE id = ?").run(
        nextBalance,
        nowIso,
        user.id
      );

      db.prepare(
        `INSERT INTO credit_ledger (id, user_id, delta, balance_after, reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        txId,
        user.id,
        packInfo.credits,
        nextBalance,
        `Credit Top-Up: +${packInfo.credits} CR (${packInfo.priceLabel})`,
        nowIso
      );

      db.exec("COMMIT");
    } catch (err) {
      try {
        db.exec("ROLLBACK");
      } catch {
        // ignore
      }
      throw err;
    }

    return NextResponse.json({
      status: "credited",
      txId,
      creditsAdded: packInfo.credits,
      creditsBalance: nextBalance,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to top up credits." },
      { status: 500 }
    );
  }
}
