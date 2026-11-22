"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"request" | "reset" | "done">("request");
  const [email, setEmail] = useState("rohan@animora.studio");
  const [token, setToken] = useState("");
  const [devResetToken, setDevResetToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const rules = {
    minLength: newPassword.length >= 12,
    hasUppercase: /[A-Z]/.test(newPassword),
    hasNumber: /[0-9]/.test(newPassword),
    hasSymbol: /[^A-Za-z0-9]/.test(newPassword),
    matches: newPassword.length > 0 && newPassword === confirmPassword,
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorBanner(data.error || "Unable to send recovery link.");
        return;
      }
      setInfoMessage(data.message);
      if (data.devResetToken) {
        setDevResetToken(data.devResetToken);
      }
      setStep("reset");
    } catch {
      setErrorBanner("Network error while requesting recovery token.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);
    if (!rules.matches) {
      setErrorBanner("Passwords do not match.");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorBanner(data.error || "Could not update password.");
        return;
      }
      setStep("done");
    } catch {
      setErrorBanner("Network error while resetting password.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-[#F4F4F5] flex flex-col justify-between p-4 sm:p-8">
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-[#FF4F28] flex items-center justify-center">
            <span className="material-symbols-outlined text-[#09090B] text-base font-bold">
              movie_filter
            </span>
          </div>
          <span className="font-display font-bold text-base text-white">Animora Studio</span>
        </Link>
        <Link href="/login" className="text-xs font-mono text-[#A1A1AA] hover:text-white">
          ← Back to Sign In
        </Link>
      </header>

      <main className="my-10 w-full max-w-md mx-auto bg-[#121216] border border-[#27272A] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5">
        <div className="space-y-1">
          <span className="inline-block px-2 py-0.5 rounded bg-[#FF4F28]/15 text-[#FFB4A4] font-mono text-[10px] font-bold">
            CRYPTO RECOVERY • 15-MIN EPHEMERAL TOKEN
          </span>
          <h1 className="font-display font-bold text-2xl text-white">
            Reset Studio Vault Password
          </h1>
          <p className="text-xs text-[#A1A1AA]">
            Re-encrypt your isolated workspace credentials and invalidate old sessions.
          </p>
        </div>

        {errorBanner && (
          <div className="p-3 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/50 text-[#FCA5A5] text-xs font-mono">
            {errorBanner}
          </div>
        )}

        {step === "request" && (
          <form onSubmit={handleRequestReset} className="space-y-4">
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-[#A1A1AA] mb-1.5">
                Registered Workspace Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#FF4F28]"
                placeholder="rohan@animora.studio"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-lg bg-gradient-to-br from-[#FFB4A4] to-[#FF4F28] text-[#09090B] font-display font-bold text-sm"
            >
              {isLoading ? "Dispatching Token..." : "Send Recovery Token →"}
            </button>
          </form>
        )}

        {step === "reset" && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            {infoMessage && (
              <div className="p-3 rounded-lg bg-[#10B981]/10 border border-[#10B981]/30 text-[#9BFFCE] text-xs">
                {infoMessage}
              </div>
            )}

            {devResetToken && (
              <div className="p-3 rounded-lg bg-[#09090B] border border-[#F59E0B]/40 flex items-center justify-between gap-2 font-mono text-[11px]">
                <span className="text-[#FCD34D] truncate">Dev Token: {devResetToken}</span>
                <button
                  type="button"
                  onClick={() => setToken(devResetToken)}
                  className="px-2 py-1 rounded bg-[#F59E0B] text-[#09090B] font-bold text-[10px] flex-shrink-0"
                >
                  Auto-Fill
                </button>
              </div>
            )}

            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-[#A1A1AA] mb-1.5">
                Recovery Token
              </label>
              <input
                type="text"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-[#FF4F28]"
                placeholder="Paste 48-char recovery token"
              />
            </div>

            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-[#A1A1AA] mb-1.5">
                New Master Password
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#FF4F28]"
              />
            </div>

            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-[#A1A1AA] mb-1.5">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#FF4F28]"
              />
            </div>

            <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
              <span className={rules.minLength ? "text-[#10B981]" : "text-[#71717A]"}>
                {rules.minLength ? "✓" : "×"} 12+ characters
              </span>
              <span className={rules.hasUppercase ? "text-[#10B981]" : "text-[#71717A]"}>
                {rules.hasUppercase ? "✓" : "×"} Uppercase (A-Z)
              </span>
              <span className={rules.hasNumber ? "text-[#10B981]" : "text-[#71717A]"}>
                {rules.hasNumber ? "✓" : "×"} Number (0-9)
              </span>
              <span className={rules.hasSymbol ? "text-[#10B981]" : "text-[#71717A]"}>
                {rules.hasSymbol ? "✓" : "×"} Symbol (!@#$)
              </span>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-lg bg-gradient-to-br from-[#FFB4A4] to-[#FF4F28] text-[#09090B] font-display font-bold text-sm"
            >
              {isLoading ? "Re-encrypting Vault..." : "UPDATE MASTER PASSWORD & RE-ENCRYPT VAULT"}
            </button>
          </form>
        )}

        {step === "done" && (
          <div className="space-y-4 text-center py-2">
            <div className="w-12 h-12 mx-auto rounded-full bg-[#10B981]/15 border border-[#10B981]/40 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#10B981] text-2xl">
                verified_user
              </span>
            </div>
            <h2 className="font-display font-bold text-lg text-white">
              Master Password Updated!
            </h2>
            <p className="text-xs text-[#A1A1AA]">
              All prior sessions have been revoked and your brute-force lockout counter has been
              cleared.
            </p>
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="w-full py-3 rounded-lg bg-[#FF4F28] text-[#09090B] font-display font-bold text-sm"
            >
              Proceed to Sign In →
            </button>
          </div>
        )}
      </main>

      <footer className="text-center text-[11px] font-mono text-[#71717A]">
        Salted Scrypt Hash Recalculation • Zero-Knowledge Session Rotation
      </footer>
    </div>
  );
}
