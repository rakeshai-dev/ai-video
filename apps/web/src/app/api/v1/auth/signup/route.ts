import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import {
  generateOtpCode,
  hashPassword,
  validatePasswordStrength,
  ensureDemoTenantsSeeded,
} from "@/lib/auth";

const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your creator or channel name (min 2 chars)."),
  email: z.string().trim().toLowerCase().email("Please enter a valid work email address."),
  instagramHandle: z
    .string()
    .trim()
    .optional()
    .refine(
      (val) => !val || /^@[A-Za-z0-9._]{2,30}$/.test(val),
      "Handle must start with @ and contain no spaces or illegal symbols."
    ),
  niche: z.string().trim().min(2).max(50).default("STEM & Science"),
  password: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    ensureDemoTenantsSeeded();
    const body = await request.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] || "form");
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      return NextResponse.json(
        { error: "Please fix the highlighted fields below.", fieldErrors },
        { status: 400 }
      );
    }

    const { fullName, email, instagramHandle, niche, password } = parsed.data;
    const strength = validatePasswordStrength(password);
    if (!strength.valid) {
      return NextResponse.json(
        {
          error: "Password does not meet security requirements.",
          fieldErrors: {
            password: "Must include 12+ characters, 1 uppercase letter, 1 number & 1 symbol.",
          },
          strength,
        },
        { status: 400 }
      );
    }

    const db = getDb();
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) {
      return NextResponse.json(
        {
          code: "EMAIL_CONFLICT",
          error: `Email ${email} is already assigned to an existing workspace.`,
          fieldErrors: {
            email: "Email address is already in use by another workspace tenant.",
          },
        },
        { status: 409 }
      );
    }

    const userId = `usr_${crypto.randomBytes(8).toString("hex")}`;
    const { hash, salt } = hashPassword(password);
    const otpCode = generateOtpCode();
    const now = new Date();
    const nowIso = now.toISOString();
    const otpExpiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
    const baseSlug = fullName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 24);
    const workspaceSlug = `${baseSlug || "studio"}-${crypto.randomBytes(2).toString("hex")}`;
    const handleClean = instagramHandle || `@${workspaceSlug.replace(/-/g, "_")}`;

    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare(
        `INSERT INTO users (
          id, email, full_name, password_hash, password_salt,
          email_verified, otp_code, otp_expires_at, otp_attempts,
          plan_tier, credits_balance, workspace_slug, timezone, niche, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, 0, 'starter_free', 15, ?, 'Asia/Kolkata', ?, ?, ?)`
      ).run(
        userId,
        email,
        fullName,
        hash,
        salt,
        otpCode,
        otpExpiresAt,
        workspaceSlug,
        niche,
        nowIso,
        nowIso
      );

      db.prepare(
        `INSERT INTO brand_kits (user_id, watermark_text, updated_at) VALUES (?, ?, ?)`
      ).run(userId, handleClean, nowIso);

      db.prepare(
        `INSERT INTO credit_ledger (id, user_id, delta, balance_after, reason, created_at)
         VALUES (?, ?, 15, 15, 'Starter Account Allocation Grant (+15 Free Credits)', ?)`
      ).run(`tx_${crypto.randomBytes(6).toString("hex")}`, userId, nowIso);

      db.exec("COMMIT");
    } catch (txErr) {
      db.exec("ROLLBACK");
      throw txErr;
    }

    return NextResponse.json(
      {
        status: "verification_required",
        userId,
        email,
        workspaceSlug,
        creditsGranted: 15,
        otpExpiresAt,
        ...(process.env.NODE_ENV !== "production" ? { devOtpPreview: otpCode } : {}),
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create studio account." },
      { status: 500 }
    );
  }
}
