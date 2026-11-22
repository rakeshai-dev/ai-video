"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

const NICHES = [
  "STEM & Science",
  "Kids A-Z & Counting",
  "Finance & Data",
  "Tech & Coding",
  "History & Geography",
];

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialVerifyEmail = searchParams.get("verify");

  const [step, setStep] = useState<"register" | "verify_otp">(
    initialVerifyEmail ? "verify_otp" : "register"
  );

  // Registration fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(initialVerifyEmail || "");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [niche, setNiche] = useState("STEM & Science");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // OTP fields
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [devOtpPreview, setDevOtpPreview] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Feedback
  const [isLoading, setIsLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  // Live password strength calculation (Matches Stitch 13A/13B)
  const rules = {
    minLength: password.length >= 12,
    hasUppercase: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSymbol: /[^A-Za-z0-9]/.test(password),
  };
  const strengthScore = Object.values(rules).filter(Boolean).length;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);
    setErrorCode(null);
    setFieldErrors({});
    setIsLoading(true);

    try {
      const res = await fetch("/api/v1/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          instagramHandle: instagramHandle.trim() || undefined,
          niche,
          password,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorBanner(data.error || "Unable to create account.");
        setErrorCode(data.code || `HTTP_${res.status}`);
        if (data.fieldErrors) setFieldErrors(data.fieldErrors);
        return;
      }

      if (data.devOtpPreview) {
        setDevOtpPreview(data.devOtpPreview);
      }
      setResendCooldown(45);
      setStep("verify_otp");
    } catch {
      setErrorBanner("Network error. Please verify the local server is running.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const clean = value.replace(/\D/g, "").slice(-1);
    const next = [...otpDigits];
    next[index] = clean;
    setOtpDigits(next);

    if (clean && index < 5) {
      const nextEl = document.getElementById(`otp-box-${index + 1}`);
      nextEl?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      const prevEl = document.getElementById(`otp-box-${index - 1}`);
      prevEl?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    const next = ["", "", "", "", "", ""];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setOtpDigits(next);
    const focusIdx = Math.min(pasted.length, 5);
    document.getElementById(`otp-box-${focusIdx}`)?.focus();
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);
    setIsLoading(true);
    const code = otpDigits.join("");

    try {
      const res = await fetch("/api/v1/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorBanner(data.error || "Verification failed.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setErrorBanner("Network error while verifying OTP.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setErrorBanner(null);
    const res = await fetch("/api/v1/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, action: "resend" }),
    });
    const data = await res.json();
    if (res.ok) {
      if (data.devOtpPreview) setDevOtpPreview(data.devOtpPreview);
      setResendCooldown(45);
    } else {
      setErrorBanner(data.error || "Could not resend OTP.");
    }
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-[#F4F4F5] flex flex-col justify-between">
      {/* Top Header */}
      <header className="border-b border-[#27272A] px-4 sm:px-8 h-16 flex items-center justify-between">
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

        <div className="flex items-center gap-3 text-xs">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#10B981]/15 border border-[#10B981]/30 text-[#9BFFCE] font-mono text-[10px] font-bold">
            ⚡ +15 Free Starter Credits
          </span>
          <Link href="/login" className="text-[#A1A1AA] hover:text-white font-medium">
            Sign In →
          </Link>
        </div>
      </header>

      {/* Main Split Grid (Matches Stitch 03A/03B + 13A/13B) */}
      <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Onboarding Perks & Credit Burn Table */}
        <section className="lg:col-span-6 space-y-6">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#121216] border border-[#27272A] font-mono text-[10px] text-[#9BFFCE]">
              ● MULTI-TENANT ISOLATED CREATOR VAULT • ZERO CARD REQUIRED
            </span>
            <h1 className="font-display font-bold text-3xl sm:text-4xl lg:text-5xl text-white tracking-tight leading-[1.08]">
              Turn raw ideas into{" "}
              <span className="text-[#FF4F28]">high-retention 60fps</span> explainer Reels.
            </h1>
            <p className="text-sm text-[#A1A1AA] leading-relaxed">
              Every account provisions a private workspace with{" "}
              <strong className="text-white">15 free starter video credits</strong>, unlimited free
              Edge Neural TTS voiceovers, and isolated per-member Instagram publishing.
            </p>
          </div>

          <div className="bg-[#121216] border border-[#10B981]/30 rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-display font-bold text-sm text-white">
                +15 Free Starter Video Credits Granted on Signup
              </span>
              <span className="px-2 py-0.5 rounded bg-[#10B981]/15 text-[#9BFFCE] font-mono text-[10px] font-bold">
                INSTANT AUTO-CREDIT
              </span>
            </div>
            <p className="text-xs text-[#A1A1AA]">
              Valid for up to 15 vertical 30s Reels or 7 full 60s animated breakdowns. Storyboard
              previews and Edge Neural TTS cost 0 credits forever.
            </p>
          </div>

          {/* Credit Consumption Telemetry Table */}
          <div className="bg-[#121216] border border-[#27272A] rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between font-mono text-[10px] text-[#A1A1AA]">
              <span>CREDIT CONSUMPTION TELEMETRY LEDGER</span>
              <span>FIXED RATE</span>
            </div>
            <div className="divide-y divide-[#27272A] text-xs font-mono">
              <div className="py-2 flex items-center justify-between">
                <span className="text-[#E4E4E7]">Quick-Hit Explainer (30s)</span>
                <span className="text-[#F59E0B] font-bold">1 Credit</span>
              </div>
              <div className="py-2 flex items-center justify-between">
                <span className="text-[#E4E4E7]">Standard Diagram Reel (60s)</span>
                <span className="text-[#F59E0B] font-bold">2 Credits</span>
              </div>
              <div className="py-2 flex items-center justify-between">
                <span className="text-[#E4E4E7]">Deep-Dive Masterclass (90s)</span>
                <span className="text-[#F59E0B] font-bold">3 Credits</span>
              </div>
              <div className="py-2 flex items-center justify-between">
                <span className="text-[#10B981]">60fps Browser Previews &amp; Edge TTS</span>
                <span className="text-[#10B981] font-bold">0 Credits (Free)</span>
              </div>
            </div>
          </div>
        </section>

        {/* Right Registration OR 6-Digit Email OTP Verification Card */}
        <section className="lg:col-span-6 bg-[#121216] border border-[#27272A] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5">
          {step === "register" ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-[#FF4F28]">
                    WORKSPACE PROVISIONING • STEP 1/2
                  </div>
                  <h2 className="font-display font-bold text-2xl text-white mt-0.5">
                    Create Studio Vault
                  </h2>
                </div>
                {errorCode && (
                  <span className="px-2 py-0.5 rounded bg-[#EF4444]/15 border border-[#EF4444]/40 text-[#FCA5A5] font-mono text-[10px] font-bold">
                    {errorCode}
                  </span>
                )}
              </div>

              {/* 409 Conflict / Validation Alert Banner (Matches Stitch 13A) */}
              {errorBanner && (
                <div
                  role="alert"
                  className="p-3.5 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/50 text-xs space-y-1"
                >
                  <div className="flex items-center gap-2 text-white font-medium">
                    <span className="material-symbols-outlined text-[#EF4444] text-base">
                      warning
                    </span>
                    <span>{errorBanner}</span>
                  </div>
                  {errorCode === "EMAIL_CONFLICT" && (
                    <Link
                      href="/login"
                      className="inline-block pl-6 font-mono text-[11px] text-[#F59E0B] underline"
                    >
                      Sign in to your existing workspace instead →
                    </Link>
                  )}
                </div>
              )}

              <form onSubmit={handleRegister} noValidate className="space-y-4">
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[#A1A1AA] mb-1.5">
                    Creator / Channel Display Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Rohan Explains STEM"
                    className={`w-full bg-[#09090B] border rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none ${
                      fieldErrors.fullName
                        ? "border-[#EF4444]"
                        : "border-[#27272A] focus:border-[#FF4F28]"
                    }`}
                  />
                  {fieldErrors.fullName && (
                    <p className="mt-1 text-[11px] font-mono text-[#FCA5A5]">
                      → {fieldErrors.fullName}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[#A1A1AA] mb-1.5">
                    Work / Studio Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@studio.com"
                    className={`w-full bg-[#09090B] border rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none ${
                      fieldErrors.email
                        ? "border-[#EF4444]"
                        : "border-[#27272A] focus:border-[#FF4F28]"
                    }`}
                  />
                  {fieldErrors.email && (
                    <p className="mt-1 text-[11px] font-mono text-[#FCA5A5]">
                      → {fieldErrors.email}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[#A1A1AA] mb-1.5">
                    Target Instagram Handle (Optional)
                  </label>
                  <input
                    type="text"
                    value={instagramHandle}
                    onChange={(e) => setInstagramHandle(e.target.value)}
                    placeholder="@your_channel"
                    className={`w-full bg-[#09090B] border rounded-lg px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none ${
                      fieldErrors.instagramHandle
                        ? "border-[#EF4444]"
                        : "border-[#27272A] focus:border-[#FF4F28]"
                    }`}
                  />
                  {fieldErrors.instagramHandle && (
                    <p className="mt-1 text-[11px] font-mono text-[#FCA5A5]">
                      → {fieldErrors.instagramHandle}
                    </p>
                  )}
                </div>

                {/* Primary Niche Selector Chips */}
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[#A1A1AA] mb-1.5">
                    Primary Video Niche
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {NICHES.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setNiche(n)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
                          niche === n
                            ? "bg-[#FF4F28] text-[#09090B] border-[#FF4F28] font-bold"
                            : "bg-[#09090B] text-[#A1A1AA] border-[#27272A] hover:text-white"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Password + Live 4-Rule Strength Meter (Matches Stitch 13A/13B) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-mono text-[10px] uppercase tracking-widest text-[#A1A1AA]">
                      Master Vault Password
                    </label>
                    <span
                      className={`font-mono text-[10px] font-bold ${
                        strengthScore === 4
                          ? "text-[#10B981]"
                          : strengthScore >= 2
                          ? "text-[#F59E0B]"
                          : "text-[#EF4444]"
                      }`}
                    >
                      {strengthScore === 4
                        ? "STRONG"
                        : strengthScore >= 2
                        ? "MEDIUM"
                        : "WEAK"}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 12 chars, Uppercase, Number & Symbol"
                      className={`w-full bg-[#09090B] border rounded-lg pl-3.5 pr-11 py-2.5 text-sm text-white focus:outline-none ${
                        fieldErrors.password
                          ? "border-[#EF4444]"
                          : "border-[#27272A] focus:border-[#FF4F28]"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-white"
                    >
                      <span className="material-symbols-outlined text-lg">
                        {showPassword ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>

                  {/* 4-segment visual bar */}
                  <div className="grid grid-cols-4 gap-1.5 mt-2">
                    {[1, 2, 3, 4].map((idx) => (
                      <div
                        key={idx}
                        className={`h-1.5 rounded-full transition-colors ${
                          strengthScore >= idx
                            ? strengthScore === 4
                              ? "bg-[#10B981]"
                              : strengthScore >= 2
                              ? "bg-[#F59E0B]"
                              : "bg-[#EF4444]"
                            : "bg-[#27272A]"
                        }`}
                      />
                    ))}
                  </div>

                  {/* Live 4-rule checklist */}
                  <div className="grid grid-cols-2 gap-1.5 mt-2 font-mono text-[10px]">
                    <span className={rules.minLength ? "text-[#10B981]" : "text-[#71717A]"}>
                      {rules.minLength ? "✓" : "×"} 12+ characters
                    </span>
                    <span className={rules.hasUppercase ? "text-[#10B981]" : "text-[#71717A]"}>
                      {rules.hasUppercase ? "✓" : "×"} 1 uppercase (A-Z)
                    </span>
                    <span className={rules.hasNumber ? "text-[#10B981]" : "text-[#71717A]"}>
                      {rules.hasNumber ? "✓" : "×"} 1 number (0-9)
                    </span>
                    <span className={rules.hasSymbol ? "text-[#10B981]" : "text-[#71717A]"}>
                      {rules.hasSymbol ? "✓" : "×"} 1 symbol (!@#$)
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 rounded-lg bg-gradient-to-br from-[#FFB4A4] to-[#FF4F28] text-[#09090B] font-display font-bold text-sm shadow-lg shadow-[#FF4F28]/20 hover:opacity-95 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
                >
                  <span>
                    {isLoading
                      ? "Provisioning Isolated Vault..."
                      : "Create My Studio & Claim +15 Free Credits"}
                  </span>
                  <span className="material-symbols-outlined text-base font-bold">
                    arrow_forward
                  </span>
                </button>
              </form>
            </>
          ) : (
            /* STEP 2: 6-DIGIT EMAIL OTP VERIFICATION GATE (Matches Stitch 13A/13B) */
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 mx-auto rounded-xl bg-[#FF4F28]/15 border border-[#FF4F28]/40 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#FF4F28] text-2xl">
                    mark_email_read
                  </span>
                </div>
                <span className="inline-block px-2.5 py-0.5 rounded bg-[#F59E0B]/15 text-[#FCD34D] font-mono text-[10px] font-bold">
                  STEP 2/2 • EMAIL VERIFICATION GATE
                </span>
                <h2 className="font-display font-bold text-2xl text-white">
                  Verify your email to unlock +15 Free Credits
                </h2>
                <p className="text-xs text-[#A1A1AA]">
                  Enter the 6-digit verification code dispatched to{" "}
                  <span className="font-mono text-white">{email}</span>
                </p>
              </div>

              {/* Local Dev Sandbox OTP Preview Box (so user can test immediately without SMTP) */}
              {devOtpPreview && (
                <div className="p-3 rounded-lg bg-[#10B981]/10 border border-[#10B981]/35 flex items-center justify-between gap-3 font-mono text-xs">
                  <span className="text-[#9BFFCE]">
                    Local Dev Sandbox OTP Code:{" "}
                    <strong className="text-white text-sm tracking-widest">{devOtpPreview}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setOtpDigits(devOtpPreview.split(""))}
                    className="px-2.5 py-1 rounded bg-[#10B981] text-[#09090B] font-bold text-[10px]"
                  >
                    Auto-Fill
                  </button>
                </div>
              )}

              {errorBanner && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/50 text-[#FCA5A5] text-xs font-mono text-center"
                >
                  {errorBanner}
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-5">
                <div className="grid grid-cols-6 gap-2 sm:gap-3">
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      id={`otp-box-${idx}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      onPaste={handleOtpPaste}
                      className="h-14 text-center font-mono text-xl font-bold text-white bg-[#09090B] border border-[#27272A] focus:border-[#FF4F28] focus:ring-1 focus:ring-[#FF4F28] rounded-lg focus:outline-none"
                    />
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={isLoading || otpDigits.join("").length !== 6}
                  className="w-full py-3.5 rounded-lg bg-gradient-to-br from-[#FFB4A4] to-[#FF4F28] text-[#09090B] font-display font-bold text-sm shadow-lg shadow-[#FF4F28]/20 hover:opacity-95 disabled:opacity-40 transition-all"
                >
                  {isLoading
                    ? "Verifying Code..."
                    : "VERIFY & CLAIM 15 FREE CREDITS (START CREATING)"}
                </button>
              </form>

              <div className="flex items-center justify-between text-xs font-mono pt-2 border-t border-[#27272A]">
                <button
                  type="button"
                  disabled={resendCooldown > 0}
                  onClick={handleResendOtp}
                  className="text-[#F59E0B] disabled:text-[#71717A] hover:underline"
                >
                  {resendCooldown > 0
                    ? `Resend Code in 00:${String(resendCooldown).padStart(2, "0")}`
                    : "Resend Verification Code"}
                </button>
                <button
                  type="button"
                  onClick={() => setStep("register")}
                  className="text-[#A1A1AA] hover:text-white"
                >
                  Change Email Address
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-[#27272A] px-4 sm:px-8 py-4 text-center text-[11px] font-mono text-[#71717A]">
        Encrypted Tenant Provisioning • Free Edge Neural TTS included on every render
      </footer>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#09090B] text-white flex items-center justify-center font-mono text-xs">
          Loading Studio Registration...
        </div>
      }
    >
      <SignupContent />
    </Suspense>
  );
}
