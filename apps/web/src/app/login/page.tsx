"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const DEMO_PROFILES = [
  {
    initials: "RP",
    handle: "@rohan_explains",
    email: "rohan@animora.studio",
    role: "STEM Explainer Hub",
    meta: "Meta Graph API v21.0 • usr_demo_rohan",
    credits: "15 CR",
    color: "bg-[#FF4F28]/20 text-[#FFB4A4]",
  },
  {
    initials: "ML",
    handle: "@kidspark_abc",
    email: "maya@kidspark.edu",
    role: "Kids Phonics & ABCs",
    meta: "60fps Phoneme Engine • usr_demo_maya",
    credits: "15 CR",
    color: "bg-[#F59E0B]/20 text-[#FCD34D]",
  },
  {
    initials: "AR",
    handle: "@finpulse_daily",
    email: "alex@finpulse.io",
    role: "Fintech & Data Charts",
    meta: "Creator Pro Tenant • usr_demo_alex",
    credits: "42 CR PRO",
    color: "bg-[#10B981]/20 text-[#9BFFCE]",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("rohan@animora.studio");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberSession, setRememberSession] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const t = setInterval(() => {
      setLockoutSeconds((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [lockoutSeconds]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);
    setErrorCode(null);
    setFieldErrors({});
    setIsLoading(true);

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberSession }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorBanner(data.error || "Unable to sign in.");
        setErrorCode(data.code || `HTTP_${res.status}`);
        if (data.fieldErrors) setFieldErrors(data.fieldErrors);
        if (res.status === 429 && data.retryAfterSec) {
          setLockoutSeconds(data.retryAfterSec);
        }
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setErrorBanner("Network error. Please verify the local server is running.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoSwitch = async (demoEmail: string) => {
    setErrorBanner(null);
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demoEmail }),
      });
      if (res.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        const d = await res.json();
        setErrorBanner(d.error || "Demo sign-in failed.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-[#F4F4F5] flex flex-col justify-between">
      {/* Top Studio Header */}
      <header className="border-b border-[#27272A] px-4 sm:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-[#FF4F28] flex items-center justify-center shadow-[0_0_16px_rgba(255,79,40,0.4)]">
              <span className="material-symbols-outlined text-[#09090B] text-base font-bold">
                movie_filter
              </span>
            </div>
            <span className="font-display font-bold text-base tracking-tight text-white">
              ANIMORA STUDIO
            </span>
          </Link>
          <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#121216] border border-[#27272A] font-mono text-[10px] text-[#9BFFCE]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
            Multi-Tenant Vault Active
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <Link href="/forgot-password" className="text-[#A1A1AA] hover:text-white hidden sm:inline">
            Reset Password
          </Link>
          <Link
            href="/signup"
            className="px-3 py-1.5 rounded-md bg-[#121216] border border-[#27272A] hover:border-[#FF4F28] text-white font-display font-bold transition-colors"
          >
            Claim +15 Free Credits →
          </Link>
        </div>
      </header>

      {/* Main Split Grid (1-Col Mobile, 2-Col Split Desktop matching Stitch 02A/02B + 13A/13B) */}
      <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Cinema Preview Column (Visible on lg+) */}
        <section className="hidden lg:flex lg:col-span-6 flex-col gap-5 bg-[#121216] border border-[#27272A] rounded-2xl p-6">
          <div className="flex items-center justify-between font-mono text-[10px]">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#09090B] border border-[#27272A] text-[#9BFFCE]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
              LIVE PREVIEW • 60.0 FPS REMOTION ENGINE
            </span>
            <span className="px-2 py-0.5 rounded bg-[#10B981]/10 text-[#9BFFCE] border border-[#10B981]/25">
              Stereo Master 48kHz
            </span>
          </div>

          <div className="bg-[#09090B] border border-[#27272A] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between font-mono text-[10px] text-[#A1A1AA]">
              <span className="text-[#FF4F28] font-bold">● STEM_04 // SOLAR PHOTOVOLTAICS</span>
              <span className="text-[#10B981]">REC [00:28.4]</span>
            </div>

            <div className="space-y-2.5 py-4">
              <div className="flex justify-between font-mono text-[11px] text-[#F59E0B]">
                <span>☀️ hv = 2.4 eV</span>
                <span className="text-[#10B981]">38.4V • 8.92A (342.5W)</span>
              </div>
              <div className="p-2.5 rounded bg-[#18181D] border border-[#FF4F28]/30 flex justify-between text-xs font-mono">
                <span className="text-[#FFB4A4] font-bold">N-Type Layer</span>
                <span className="text-[#A1A1AA]">Free Electrons (e-)</span>
              </div>
              <div className="p-1.5 rounded bg-[#F59E0B]/15 border border-[#F59E0B]/40 text-center text-[10px] font-mono text-[#FCD34D] font-bold">
                Depletion Region (E-Field)
              </div>
              <div className="p-2.5 rounded bg-[#18181D] border border-[#10B981]/30 flex justify-between text-xs font-mono">
                <span className="text-[#9BFFCE] font-bold">P-Type Layer</span>
                <span className="text-[#A1A1AA]">Electron Holes (h+)</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#121216] border border-[#27272A] text-center text-xs text-[#E4E4E7]">
              &ldquo;First, sunlight hits the cell as energetic packets called{" "}
              <span className="px-1.5 py-0.5 rounded bg-[#FF4F28] text-[#09090B] font-display font-bold">
                PHOTONS
              </span>{" "}
              dislodging bonded electrons.&rdquo;
            </div>
          </div>

          <div className="bg-[#09090B] border border-[#27272A] rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-display font-bold text-xs text-white">Rohan Patel</div>
                <div className="text-[10px] font-mono text-[#71717A]">
                  @rohan_explains • 142K STEM Followers
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-[#10B981]/15 text-[#9BFFCE] font-mono text-[9px]">
                TIER 1 PARTNER
              </span>
            </div>
            <p className="text-xs text-[#A1A1AA] italic">
              &ldquo;Animora turns our raw physics lectures into viral 60fps Reels in 4 minutes
              flat. Watch time jumped 340%.&rdquo;
            </p>
          </div>
        </section>

        {/* Right Authentication & Error Handling Console */}
        <section className="lg:col-span-6 bg-[#121216] border border-[#27272A] rounded-2xl p-6 sm:p-8 space-y-5 shadow-2xl">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#10B981]">
                ● SECURITY &amp; WORKSPACE ENGINE • TENANT ISOLATED
              </span>
              {errorCode && (
                <span className="px-2 py-0.5 rounded bg-[#EF4444]/15 border border-[#EF4444]/40 text-[#FCA5A5] font-mono text-[10px] font-bold">
                  {errorCode}
                </span>
              )}
            </div>
            <h1 className="font-display font-bold text-2xl sm:text-3xl text-white tracking-tight">
              Welcome back to Animora Studio
            </h1>
            <p className="text-xs text-[#A1A1AA]">
              Sign in with your studio credentials or test instant multi-tenant isolation below.
            </p>
          </div>

          {/* Crimson Error / Rate-Limit Alert Banner (Matches Stitch 13A/13B) */}
          {errorBanner && (
            <div
              role="alert"
              className="p-3.5 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/50 text-[#FCA5A5] text-xs flex items-start justify-between gap-3"
            >
              <div className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-[#EF4444] text-lg flex-shrink-0">
                  error
                </span>
                <div className="space-y-1">
                  <p className="font-medium text-white">{errorBanner}</p>
                  {lockoutSeconds > 0 && (
                    <p className="font-mono text-[11px] text-[#F59E0B]">
                      Brute-force shield active • Lockout countdown: {formatTimer(lockoutSeconds)}
                    </p>
                  )}
                  {errorCode === "EMAIL_UNVERIFIED" && (
                    <Link
                      href={`/signup?verify=${encodeURIComponent(email)}`}
                      className="inline-block font-mono text-[11px] text-[#FF4F28] underline"
                    >
                      Open 6-Digit Email OTP Verification →
                    </Link>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setErrorBanner(null)}
                className="text-[#A1A1AA] hover:text-white"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
          )}

          {/* Credentials Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-mono text-[10px] uppercase tracking-widest text-[#A1A1AA]">
                  Workspace Email
                </label>
                {fieldErrors.email ? (
                  <span className="font-mono text-[10px] text-[#EF4444]">Invalid Email</span>
                ) : (
                  <span className="font-mono text-[10px] text-[#10B981]">SSL Sealed</span>
                )}
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="rohan@animora.studio"
                className={`w-full bg-[#09090B] border rounded-lg px-3.5 py-3 text-sm text-white focus:outline-none transition-colors ${
                  fieldErrors.email
                    ? "border-[#EF4444] focus:border-[#EF4444]"
                    : "border-[#27272A] focus:border-[#FF4F28]"
                }`}
              />
              {fieldErrors.email && (
                <p className="mt-1.5 text-[11px] text-[#FCA5A5] font-mono">→ {fieldErrors.email}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-mono text-[10px] uppercase tracking-widest text-[#A1A1AA]">
                  Master Password
                </label>
                <Link
                  href="/forgot-password"
                  className="font-mono text-[10px] text-[#FF4F28] hover:underline"
                >
                  Forgot studio password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter password (Demo: Animora#2026!)"
                  className={`w-full bg-[#09090B] border rounded-lg pl-3.5 pr-11 py-3 text-sm text-white focus:outline-none transition-colors ${
                    fieldErrors.password
                      ? "border-[#EF4444] focus:border-[#EF4444]"
                      : "border-[#27272A] focus:border-[#FF4F28]"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label="Toggle password visibility"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-white"
                >
                  <span className="material-symbols-outlined text-lg">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1.5 text-[11px] text-[#FCA5A5] font-mono">
                  → {fieldErrors.password}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-[#A1A1AA]">
                <input
                  type="checkbox"
                  checked={rememberSession}
                  onChange={(e) => setRememberSession(e.target.checked)}
                  className="accent-[#FF4F28] rounded"
                />
                <span>Remember studio session (14d HttpOnly Cookie)</span>
              </label>
              {lockoutSeconds > 0 && (
                <span className="font-mono text-[10px] text-[#EF4444]">
                  Lockout: {formatTimer(lockoutSeconds)}
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || lockoutSeconds > 0}
              className="w-full py-3.5 rounded-lg bg-gradient-to-br from-[#FFB4A4] to-[#FF4F28] text-[#09090B] font-display font-bold text-sm shadow-lg shadow-[#FF4F28]/20 hover:opacity-95 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
            >
              <span>{isLoading ? "Authenticating Vault..." : "Enter My Isolated Studio"}</span>
              <span className="material-symbols-outlined text-base font-bold">arrow_forward</span>
            </button>
          </form>

          {/* Instant Multi-Tenant Demo Switcher (Matches Stitch 02A/02B) */}
          <div className="pt-3 border-t border-[#27272A] space-y-2.5">
            <div className="flex items-center justify-between font-mono text-[10px] text-[#A1A1AA]">
              <span>QUICK SWITCH DEMO PROFILES (ISOLATED TENANTS)</span>
              <span className="text-[#10B981]">3 ACTIVE NODES</span>
            </div>
            <div className="space-y-2">
              {DEMO_PROFILES.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleDemoSwitch(d.email)}
                  className="w-full p-3 rounded-lg bg-[#09090B] hover:bg-[#18181D] border border-[#27272A] hover:border-[#FF4F28]/50 flex items-center justify-between gap-3 text-left transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-display font-bold text-xs flex-shrink-0 ${d.color}`}
                    >
                      {d.initials}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-display font-bold text-white truncate">
                        {d.handle}{" "}
                        <span className="font-sans font-normal text-[#A1A1AA]">• {d.role}</span>
                      </div>
                      <div className="text-[10px] font-mono text-[#71717A] truncate">{d.meta}</div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-[#18181D] border border-[#27272A] font-mono text-[10px] text-[#F59E0B] flex-shrink-0">
                    {d.credits}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="text-center text-xs text-[#A1A1AA] pt-1">
            New creator?{" "}
            <Link href="/signup" className="text-[#FF4F28] font-display font-bold hover:underline">
              Create your studio &amp; claim +15 free credits →
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#27272A] px-4 sm:px-8 py-4 text-center sm:flex sm:items-center sm:justify-between text-[11px] font-mono text-[#71717A]">
        <span>Scrypt Salted Password Vault • HttpOnly Session Cookies</span>
        <span>Strict Multi-Tenant Isolation (user_id scoped)</span>
      </footer>
    </div>
  );
}
