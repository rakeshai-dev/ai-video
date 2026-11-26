import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { hashPassword, sha256, timingSafeEqualStr, validatePasswordStrength } from "@/lib/auth";

const resetSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  token: z.string().trim().min(10, "Recovery token is required."),
  newPassword: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = resetSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid reset request." },
        { status: 400 }
      );
    }

    const { email, token, newPassword } = parsed.data;
    const strength = validatePasswordStrength(newPassword);
    if (!strength.valid) {
      return NextResponse.json(
        {
          error: "New password must include 12+ characters, 1 uppercase letter, 1 number & 1 symbol.",
          strength,
        },
        { status: 400 }
      );
    }

    const db = getDb();
    const tokenHash = sha256(token);
    const user = db
      .prepare(
        `SELECT id, reset_token, reset_expires_at FROM users WHERE email = ?`
      )
      .get(email) as
      | { id: string; reset_token: string | null; reset_expires_at: string | null }
      | undefined;

    if (!user || !user.reset_token || !timingSafeEqualStr(user.reset_token, tokenHash)) {
      return NextResponse.json(
        { error: "Invalid or already used recovery token." },
        { status: 401 }
      );
    }

    if (user.reset_expires_at && user.reset_expires_at < new Date().toISOString()) {
      return NextResponse.json(
        { error: "Recovery token has expired. Please request a new reset link." },
        { status: 410 }
      );
    }

    const { hash, salt } = hashPassword(newPassword);
    const nowIso = new Date().toISOString();

    db.prepare(
      `UPDATE users
       SET password_hash = ?, password_salt = ?, reset_token = NULL, reset_expires_at = NULL,
           failed_login_attempts = 0, locked_until = NULL, updated_at = ?
       WHERE id = ?`
    ).run(hash, salt, nowIso, user.id);

    // Revoke existing sessions on password rotation for security
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);

    return NextResponse.json({
      status: "password_updated",
      message: "Master password updated and vault re-encrypted. You can now sign in.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to reset password." },
      { status: 500 }
    );
  }
}
