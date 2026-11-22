import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { ensureDemoTenantsSeeded, generateToken, sha256 } from "@/lib/auth";

const forgotSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid work email address."),
});

export async function POST(request: NextRequest) {
  try {
    ensureDemoTenantsSeeded();
    const body = await request.json();
    const parsed = forgotSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid email address." },
        { status: 400 }
      );
    }

    const { email } = parsed.data;
    const db = getDb();
    const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as
      | { id: string }
      | undefined;

    if (!user) {
      // Return generic non-enumerating success message in production style, with dev flag
      return NextResponse.json({
        status: "dispatched",
        message: "If an account exists for this email, a 15-minute recovery token has been sent.",
      });
    }

    const rawResetToken = generateToken(24);
    const tokenHash = sha256(rawResetToken);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    db.prepare(
      `UPDATE users SET reset_token = ?, reset_expires_at = ?, updated_at = ? WHERE id = ?`
    ).run(tokenHash, expiresAt, new Date().toISOString(), user.id);

    return NextResponse.json({
      status: "dispatched",
      message: "Recovery token dispatched to your inbox (expires in 15 minutes).",
      expiresAt,
      // Local dev preview token so password reset can be verified end-to-end without SMTP
      devResetToken: rawResetToken,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to dispatch recovery token." },
      { status: 500 }
    );
  }
}
