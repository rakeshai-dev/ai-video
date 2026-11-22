import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import {
  createSession,
  ensureDemoTenantsSeeded,
  getLockoutUntilIso,
  MAX_LOGIN_ATTEMPTS,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid work email address."),
  password: z.string().min(1, "Please enter your studio password."),
});

export async function POST(request: NextRequest) {
  try {
    ensureDemoTenantsSeeded();
    const body = await request.json();

    // Instant Demo Tenant Switcher (strictly limited to seeded demo accounts)
    if (body?.demoEmail && typeof body.demoEmail === "string") {
      const db = getDb();
      const demo = db
        .prepare(
          `SELECT id, email, full_name, credits_balance, plan_tier
           FROM users WHERE email = ? AND id LIKE 'usr_demo_%'`
        )
        .get(body.demoEmail.toLowerCase()) as
        | { id: string; email: string; full_name: string; credits_balance: number; plan_tier: string }
        | undefined;

      if (!demo) {
        return NextResponse.json({ error: "Demo tenant not found." }, { status: 404 });
      }

      const { rawToken, expiresAt } = createSession(demo.id, "Demo Tenant Switcher", "127.0.0.1");
      await setSessionCookie(rawToken, expiresAt);
      return NextResponse.json({ status: "authenticated", user: demo });
    }

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] || "form");
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      return NextResponse.json(
        { error: "Please check your email and password format.", fieldErrors },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;
    const db = getDb();
    const user = db
      .prepare(
        `SELECT id, email, full_name, password_hash, password_salt, email_verified,
                failed_login_attempts, locked_until, credits_balance, plan_tier
         FROM users WHERE email = ?`
      )
      .get(email) as
      | {
          id: string;
          email: string;
          full_name: string;
          password_hash: string;
          password_salt: string;
          email_verified: number;
          failed_login_attempts: number;
          locked_until: string | null;
          credits_balance: number;
          plan_tier: string;
        }
      | undefined;

    if (!user) {
      return NextResponse.json(
        {
          code: "INVALID_CREDENTIALS",
          error: "Invalid email or password. Please check your credentials and try again.",
        },
        { status: 401 }
      );
    }

    const nowIso = new Date().toISOString();
    if (user.locked_until && user.locked_until > nowIso) {
      const secondsLeft = Math.max(
        1,
        Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 1000)
      );
      return NextResponse.json(
        {
          code: "RATE_LIMITED",
          error: "Too many failed attempts. Your studio vault is temporarily locked.",
          lockedUntil: user.locked_until,
          retryAfterSec: secondsLeft,
        },
        { status: 429 }
      );
    }

    const isPasswordValid = verifyPassword(password, user.password_hash, user.password_salt);
    if (!isPasswordValid) {
      const nextAttempts = (user.failed_login_attempts || 0) + 1;
      const remaining = Math.max(0, MAX_LOGIN_ATTEMPTS - nextAttempts);

      if (nextAttempts >= MAX_LOGIN_ATTEMPTS) {
        const lockedUntil = getLockoutUntilIso();
        db.prepare(
          `UPDATE users SET failed_login_attempts = ?, locked_until = ?, updated_at = ? WHERE id = ?`
        ).run(nextAttempts, lockedUntil, nowIso, user.id);

        return NextResponse.json(
          {
            code: "RATE_LIMITED",
            error: "5 failed attempts reached. Account locked for 15 minutes for security.",
            lockedUntil,
            retryAfterSec: 15 * 60,
            attemptsRemaining: 0,
          },
          { status: 429 }
        );
      }

      db.prepare(
        `UPDATE users SET failed_login_attempts = ?, updated_at = ? WHERE id = ?`
      ).run(nextAttempts, nowIso, user.id);

      return NextResponse.json(
        {
          code: "INVALID_CREDENTIALS",
          error: `Invalid email or password — ${remaining} attempt${remaining === 1 ? "" : "s"} remaining before 15-minute cooldown.`,
          attemptsRemaining: remaining,
          fieldErrors: {
            password: "Incorrect master password.",
          },
        },
        { status: 401 }
      );
    }

    if (!user.email_verified) {
      return NextResponse.json(
        {
          code: "EMAIL_UNVERIFIED",
          error: "Please verify your email address with the 6-digit OTP code before signing in.",
          email: user.email,
        },
        { status: 403 }
      );
    }

    // Reset failed attempts on success and create HttpOnly DB session
    db.prepare(
      `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = ? WHERE id = ?`
    ).run(nowIso, user.id);

    const ua = request.headers.get("user-agent") || "Web Browser";
    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
    const { rawToken, expiresAt } = createSession(user.id, ua.slice(0, 64), ip);
    await setSessionCookie(rawToken, expiresAt);

    return NextResponse.json({
      status: "authenticated",
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        creditsBalance: user.credits_balance,
        planTier: user.plan_tier,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Authentication failed." },
      { status: 500 }
    );
  }
}
