import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { createSession, generateOtpCode, setSessionCookie } from "@/lib/auth";

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

      const newOtp = generateOtpCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      db.prepare("UPDATE users SET otp_code = ?, otp_expires_at = ?, updated_at = ? WHERE id = ?").run(
        newOtp,
        expiresAt,
        new Date().toISOString(),
        user.id
      );

      return NextResponse.json({
        status: "resent",
        otpExpiresAt: expiresAt,
        devOtpPreview: newOtp,
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
        `SELECT id, email, full_name, otp_code, otp_expires_at, credits_balance
         FROM users WHERE email = ?`
      )
      .get(email) as
      | {
          id: string;
          email: string;
          full_name: string;
          otp_code: string | null;
          otp_expires_at: string | null;
          credits_balance: number;
        }
      | undefined;

    if (!user) {
      return NextResponse.json({ error: "No pending account found for this email." }, { status: 404 });
    }

    if (!user.otp_code || user.otp_code !== code) {
      return NextResponse.json(
        { error: "Invalid 6-digit verification code. Please check and try again." },
        { status: 401 }
      );
    }

    if (user.otp_expires_at && user.otp_expires_at < new Date().toISOString()) {
      return NextResponse.json(
        { error: "This verification code has expired. Please request a new code." },
        { status: 410 }
      );
    }

    db.prepare(
      `UPDATE users
       SET email_verified = 1, otp_code = NULL, otp_expires_at = NULL, updated_at = ?
       WHERE id = ?`
    ).run(new Date().toISOString(), user.id);

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
