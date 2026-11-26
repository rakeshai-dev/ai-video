import crypto from "node:crypto";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";

export const SESSION_COOKIE_NAME = "animora_session";
const SESSION_TTL_DAYS = 14;
export const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  emailVerified: boolean;
  planTier: string;
  creditsBalance: number;
  workspaceSlug: string;
  timezone: string;
  niche: string;
  instagramHandle: string | null;
  instagramConnected: boolean;
}

export function hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyPassword(password: string, expectedHash: string, salt: string): boolean {
  const { hash } = hashPassword(password, salt);
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(expectedHash, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function generateOtpCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

export function generateToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function validatePasswordStrength(password: string) {
  const rules = {
    minLength: password.length >= 12,
    hasUppercase: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSymbol: /[^A-Za-z0-9]/.test(password),
  };
  const score = Object.values(rules).filter(Boolean).length;
  return {
    valid: score === 4,
    score,
    rules,
  };
}

export function createSession(
  userId: string,
  deviceLabel = "Web Browser",
  ipAddress = "127.0.0.1",
  ttlDays = SESSION_TTL_DAYS
): { rawToken: string; expiresAt: string } {
  const db = getDb();
  const rawToken = generateToken(32);
  const tokenHash = sha256(rawToken);
  const id = `ses_${crypto.randomBytes(10).toString("hex")}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, device_label, ip_address, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, userId, tokenHash, deviceLabel, ipAddress, expiresAt, now.toISOString());

  return { rawToken, expiresAt };
}

export async function setSessionCookie(rawToken: string, expiresAt: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    const db = getDb();
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256(token));
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) return null;

  const db = getDb();
  const tokenHash = sha256(rawToken);
  const nowIso = new Date().toISOString();

  const row = db
    .prepare(
      `SELECT u.id, u.email, u.full_name, u.email_verified, u.plan_tier,
              u.credits_balance, u.workspace_slug, u.timezone, u.niche,
              s.expires_at,
              sa.ig_handle, sa.status as ig_status
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN social_accounts sa ON sa.user_id = u.id AND sa.platform = 'instagram' AND sa.status = 'active'
       WHERE s.token_hash = ?
       LIMIT 1`
    )
    .get(tokenHash) as
    | {
        id: string;
        email: string;
        full_name: string;
        email_verified: number;
        plan_tier: string;
        credits_balance: number;
        workspace_slug: string;
        timezone: string;
        niche: string;
        expires_at: string;
        ig_handle: string | null;
        ig_status: string | null;
      }
    | undefined;

  if (!row) return null;
  if (row.expires_at < nowIso) {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    emailVerified: Boolean(row.email_verified),
    planTier: row.plan_tier,
    creditsBalance: row.credits_balance,
    workspaceSlug: row.workspace_slug,
    timezone: row.timezone,
    niche: row.niche,
    instagramHandle: row.ig_handle || null,
    instagramConnected: row.ig_status === "active",
  };
}

export function getLockoutUntilIso(): string {
  return new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
}

/**
 * Seeds 3 realistic multi-tenant demo creator accounts idempotently so users can test
 * instant multi-tenant isolation or login with real credentials right away.
 * Demo password for all 3 accounts: Animora#2026!
 */
export function ensureDemoTenantsSeeded() {
  const db = getDb();
  const demos = [
    {
      id: "usr_demo_rohan",
      email: "rohan@animora.studio",
      fullName: "Rohan Patel",
      handle: "@rohan_explains",
      niche: "STEM & Science",
      plan: "starter_free",
      credits: 15,
      slug: "rohan-explains",
    },
    {
      id: "usr_demo_maya",
      email: "maya@kidspark.edu",
      fullName: "Maya Lin",
      handle: "@kidspark_abc",
      niche: "Kids A-Z",
      plan: "starter_free",
      credits: 15,
      slug: "kidspark-abc",
    },
    {
      id: "usr_demo_alex",
      email: "alex@finpulse.io",
      fullName: "Alex Rivera",
      handle: "@finpulse_daily",
      niche: "Finance & Data",
      plan: "creator_pro",
      credits: 42,
      slug: "finpulse-daily",
    },
  ];

  const now = new Date().toISOString();
  const { hash, salt } = hashPassword("Animora#2026!");

  for (const d of demos) {
    const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(d.email);
    if (exists) continue;

    db.prepare(
      `INSERT INTO users (
        id, email, full_name, password_hash, password_salt, email_verified,
        plan_tier, credits_balance, workspace_slug, timezone, niche, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, 'Asia/Kolkata', ?, ?, ?)`
    ).run(d.id, d.email, d.fullName, hash, salt, d.plan, d.credits, d.slug, d.niche, now, now);

    db.prepare(
      `INSERT OR IGNORE INTO brand_kits (user_id, watermark_text, updated_at) VALUES (?, ?, ?)`
    ).run(d.id, d.handle, now);

    db.prepare(
      `INSERT INTO credit_ledger (id, user_id, delta, balance_after, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      `tx_seed_${d.id}`,
      d.id,
      d.credits,
      d.credits,
      "Starter Account Allocation Grant",
      now
    );

    db.prepare(
      `INSERT INTO social_accounts (
        id, user_id, platform, ig_handle, account_type, encrypted_token,
        sandbox_mode, status, token_expires_at, created_at
      ) VALUES (?, ?, 'instagram', ?, 'CREATOR', ?, 1, 'active', ?, ?)`
    ).run(
      `soc_${d.id}`,
      d.id,
      d.handle,
      `aes256gcm_sandbox_${d.id}`,
      new Date(Date.now() + 54 * 24 * 60 * 60 * 1000).toISOString(),
      now
    );
  }
}
