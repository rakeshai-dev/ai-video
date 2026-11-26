import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import {
  createSession,
  generateOtpCode,
  setSessionCookie,
  timingSafeEqualStr,
} from "@/lib/auth";

const MAX_OTP_ATTEMPTS = 5;

const verifySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  code: z.string().trim().regex(/^\d{6}$/, "Please enter the 6-digit verification code."),
});

const resendSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  action: z.literal("resend"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const db = getDb();

    // Support Resend OTP action
    if (body?.action === "resend") {
      const resendParsed = resendSchema.safeParse(body);
      if (!resendParsed.success) {
        return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
      }
      const user = db
        .prepare("SELECT id, email_verified FROM users WHERE email = ?")
        .get(resendParsed.data.email) as { id: string; email_verified: number } | undefined;

      if (!user) {
        return NextResponse.json({ error: "Account not found." }, { status: 404 });
      }

      if (user.email_verified) {
        return NextResponse.json(
          { error: "This email is already verified. Please sign in." },
          { status: 400 }
        );
      }

      const newOtp = generateOtpCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      db.prepare(
        `UPDATE users
         SET otp_code = ?, otp_expires_at = ?, otp_attempts = 0, updated_at = ?
         WHERE id = ?`
      ).run(newOtp, expiresAt, new Date().toISOString(), user.id);

      return NextResponse.json({
        status: "resent",
        otpExpiresAt: expiresAt,
        ...(process.env.NODE_ENV !== "production" ? { devOtpPreview: newOtp } : {}),
      });
    }

    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid 6-digit verification code." },
        { status: 400 }
      );
    }

    const { email, code } = parsed.data;
    const user = db
      .prepare(
        `SELECT id, email, full_name, email_verified, otp_code, otp_expires_at, otp_attempts, credits_balance
         FROM users WHERE email = ?`
      )
      .get(email) as
      | {
          id: string;
          email: string;
          full_name: string;
          email_verified: number;
          otp_code: string | null;
          otp_expires_at: string | null;
          otp_attempts: number;
          credits_balance: number;
        }
      | undefined;

    if (!user) {
      return NextResponse.json({ error: "No pending account found for this email." }, { status: 404 });
    }

    if (user.email_verified) {
      return NextResponse.json(
        { error: "This email is already verified. Please sign in." },
        { status: 400 }
      );
    }

    if ((user.otp_attempts || 0) >= MAX_OTP_ATTEMPTS || !user.otp_code) {
      return NextResponse.json(
        {
          code: "OTP_LOCKED",
          error:
            "Too many failed verification attempts or no active code. Please request a new verification code.",
        },
        { status: 429 }
      );
    }

    const nowIso = new Date().toISOString();
    if (user.otp_expires_at && user.otp_expires_at < nowIso) {
      return NextResponse.json(
        { error: "This verification code has expired. Please request a new code." },
        { status: 410 }
      );
    }

    if (!timingSafeEqualStr(user.otp_code, code)) {
      const nextAttempts = (user.otp_attempts || 0) + 1;
      const remaining = Math.max(0, MAX_OTP_ATTEMPTS - nextAttempts);

      if (nextAttempts >= MAX_OTP_ATTEMPTS) {
        db.prepare(
          `UPDATE users
           SET otp_code = NULL, otp_expires_at = NULL, otp_attempts = ?, updated_at = ?
           WHERE id = ?`
        ).run(nextAttempts, nowIso, user.id);

        return NextResponse.json(
          {
            code: "OTP_LOCKED",
            error:
              "5 incorrect verification attempts reached. Code invalidated — please click Resend Verification Code.",
            attemptsRemaining: 0,
          },
          { status: 429 }
        );
      }

      db.prepare("UPDATE users SET otp_attempts = ?, updated_at = ? WHERE id = ?").run(
        nextAttempts,
        nowIso,
        user.id
      );

      return NextResponse.json(
        {
          error: `Invalid 6-digit verification code — ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
          attemptsRemaining: remaining,
        },
        { status: 401 }
      );
    }

    db.prepare(
      `UPDATE users
       SET email_verified = 1, otp_code = NULL, otp_expires_at = NULL, otp_attempts = 0, updated_at = ?
       WHERE id = ?`
    ).run(nowIso, user.id);

    const ua = request.headers.get("user-agent") || "Web Browser";
    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
    const { rawToken, expiresAt } = createSession(user.id, ua.slice(0, 64), ip);
    await setSessionCookie(rawToken, expiresAt);

    return NextResponse.json({
      status: "verified",
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        creditsBalance: user.credits_balance,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "OTP verification failed." },
      { status: 500 }
    );
  }
}
