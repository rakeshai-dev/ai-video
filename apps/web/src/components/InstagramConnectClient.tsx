"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  InstagramVaultAccount,
  PublishedOrScheduledReel,
} from "@/lib/instagram";

interface InstagramConnectClientProps {
  initialAccount: InstagramVaultAccount | null;
  initialDispatches: PublishedOrScheduledReel[];
  metaOAuthConfigured: boolean;
  tenantId: string;
  defaultSuggestedHandle: string;
  defaultDisplayName: string;
  isDevMode: boolean;
}

export default function InstagramConnectClient({
  initialAccount,
  initialDispatches,
  metaOAuthConfigured,
  tenantId,
  defaultSuggestedHandle,
  defaultDisplayName,
  isDevMode,
}: InstagramConnectClientProps) {
  const router = useRouter();
  const [account, setAccount] = useState<InstagramVaultAccount | null>(initialAccount);
  const [dispatches] = useState<PublishedOrScheduledReel[]>(initialDispatches);

  // Connect / Switch form state
  const [showConnectForm, setShowConnectForm] = useState<boolean>(!initialAccount);
  const [handleInput, setHandleInput] = useState<string>(
    initialAccount?.cleanUsername || defaultSuggestedHandle
  );
  const [displayNameInput, setDisplayNameInput] = useState<string>(
    initialAccount?.displayName || defaultDisplayName
  );
  const [accountTypeInput, setAccountTypeInput] = useState<
    "CREATOR" | "BUSINESS" | "PERSONAL"
  >(initialAccount?.accountType || "CREATOR");
  const [sandboxModeInput, setSandboxModeInput] = useState<boolean>(
    initialAccount ? initialAccount.sandboxMode : true
  );

  // Error & guide states (Stitch 14A Panel 04)
  const [personalTierError, setPersonalTierError] = useState<string | null>(null);
  const [showConvertGuide, setShowConvertGuide] = useState<boolean>(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // Live Diagnostic Terminal state (Stitch 09A)
  const [probeLogs, setProbeLogs] = useState<string[]>(() =>
    initialAccount
      ? [
          `[BOOT] Tenant vault initialized for ${tenantId} (AES-256-GCM 96-bit IV / 128-bit Auth Tag)`,
          `[VAULT] Active fingerprint ${initialAccount.maskedTokenFingerprint} (${
            initialAccount.isExpired
              ? "TOKEN_DEGRADED — 0 days left"
              : `${initialAccount.daysRemaining} days remaining`
          })`,
          `[READY] Click "Run Live Handshake Probe" to verify Meta Graph API v21.0 publishing gates.`,
        ]
      : [
          `[BOOT] Tenant vault initialized for ${tenantId} — no Instagram account paired yet.`,
          `[READY] Connect a Creator or Business account above to initialize encrypted token storage.`,
        ]
  );

  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPersonalTierError(null);
    setGeneralError(null);
    setBusyAction("connect");

    try {
      const res = await fetch("/api/v1/instagram/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: handleInput,
          displayName: displayNameInput,
          accountType: accountTypeInput,
          sandboxMode: sandboxModeInput,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data?.code === "ERR_PERSONAL_TIER") {
          setPersonalTierError(data.error);
          return;
        }
        throw new Error(data?.error || "Failed to connect Instagram account.");
      }

      setAccount(data.account);
      setShowConnectForm(false);
      setShowConvertGuide(false);
      setProbeLogs((prev) => [
        ...prev,
        `[CONNECTED] Paired ${data.account.handle} (${data.account.accountType}) with fresh 60-day AES-256-GCM token.`,
      ]);
      router.refresh();
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : "Connection failed.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleRevokeOAuth = async () => {
    setBusyAction("revoke");
    setGeneralError(null);
    try {
      const res = await fetch("/api/v1/instagram/account", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to revoke Instagram OAuth session.");
      setAccount(null);
      setShowConnectForm(true);
      setProbeLogs((prev) => [
        ...prev,
        `[REVOKED] Cryptographic token wiped from social_accounts for tenant ${tenantId}.`,
      ]);
      router.refresh();
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : "Revoke failed.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleRefreshOrToggle = async (opts?: {
    simulateExpired?: boolean;
    sandboxMode?: boolean;
  }) => {
    setBusyAction("refresh");
    setGeneralError(null);
    try {
      const res = await fetch("/api/v1/instagram/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opts || {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Token rotation failed.");
      setAccount(data.account);
      setProbeLogs((prev) => [
        ...prev,
        data.account.isExpired
          ? `[SIMULATED] Marked 60-day token for ${data.account.handle} as TOKEN_DEGRADED (expired).`
          : `[ROTATED] Issued new 60-day AES-256-GCM token (${data.account.maskedTokenFingerprint}) for ${data.account.handle}.`,
      ]);
      router.refresh();
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : "Refresh failed.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleRunHandshakeProbe = async () => {
    setBusyAction("probe");
    try {
      const res = await fetch("/api/v1/instagram/probe", { method: "POST" });
      const data = await res.json();
      if (Array.isArray(data?.logs)) {
        setProbeLogs(data.logs);
      }
    } catch {
      setProbeLogs((prev) => [
        ...prev,
        "[ERROR] Handshake probe network request failed.",
      ]);
    } finally {
      setBusyAction(null);
    }
  };

  const handleExportAuditLog = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      tenantId,
      metaGraphVersion: "v21.0",
      account: account
        ? {
            handle: account.handle,
            igUserId: account.igUserId,
            accountType: account.accountType,
            sandboxMode: account.sandboxMode,
            status: account.status,
            vaultCipher: account.vaultCipher,
            maskedTokenFingerprint: account.maskedTokenFingerprint,
            tokenExpiresAt: account.tokenExpiresAt,
            scopes: account.scopes,
          }
        : null,
      diagnosticLogs: probeLogs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `animora-ig-security-audit-${tenantId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const ttlPct = account
    ? Math.max(0, Math.min(100, Math.round((account.daysRemaining / 60) * 100)))
    : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-7">
      {/* Top Architecture & Tenant Security Ribbon (Stitch 09A) */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-[#27272A]">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-[#A1A1AA]">
            <span>Animora Studio</span>
            <span>/</span>
            <span>Integrations</span>
            <span>/</span>
            <span className="text-[#FFB4A4] font-bold">Instagram Connect</span>
          </div>
          <h2 className="font-display font-bold text-xl sm:text-2xl text-white">
            Instagram Connect &amp; Meta Graph API Security Center
          </h2>
          <p className="text-xs text-[#A1A1AA]">
            Per-member isolated OAuth 2.0 gateway, AES-256-GCM cryptographic token vault &amp;
            automated Reels publishing bridge.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#121216] border border-[#27272A] font-mono text-[11px] text-[#9BFFCE]">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
            Meta Graph API v21.0 {metaOAuthConfigured ? "Live App" : "Sandbox Ready"}
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#121216] border border-[#27272A] font-mono text-[11px] text-[#E4E4E7]">
            <span className="material-symbols-outlined text-[15px] text-[#F59E0B]">
              encrypted
            </span>
            Tenant Lock: {tenantId}
          </span>
        </div>
      </div>

      {generalError && (
        <div className="p-4 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/40 text-xs text-[#FCA5A5] flex items-center justify-between gap-3">
          <span>{generalError}</span>
          <button
            type="button"
            onClick={() => setGeneralError(null)}
            className="font-mono text-[11px] underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* STATE B2: 60-Day OAuth Token Expired Banner (Stitch 14A Panel 04) */}
      {account && account.isExpired && (
        <section className="p-5 rounded-2xl bg-[#EF4444]/15 border border-[#EF4444]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-[#EF4444] text-2xl shrink-0 mt-0.5">
              lock_clock
            </span>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display font-bold text-sm text-white uppercase tracking-wide">
                  60-Day OAuth Token Expired
                </h3>
                <span className="px-2 py-0.5 rounded bg-[#EF4444]/20 font-mono text-[10px] text-[#FCA5A5] font-bold">
                  TOKEN_DEGRADED
                </span>
              </div>
              <p className="text-xs text-[#E4E4E7] leading-relaxed">
                Bearer token for{" "}
                <code className="font-mono font-bold text-white">{account.handle}</code> has
                expired. Direct Reels publishing and scheduled queue dispatches are paused
                until you re-authenticate.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={busyAction === "refresh"}
            onClick={() => void handleRefreshOrToggle({ simulateExpired: false })}
            className="px-4 py-2.5 rounded-xl bg-[#EF4444] hover:bg-[#F87171] text-white font-display font-bold text-xs shrink-0 shadow-lg shadow-[#EF4444]/20 disabled:opacity-50"
          >
            {busyAction === "refresh"
              ? "Rotating Token..."
              : `Re-Authenticate ${account.handle} Now →`}
          </button>
        </section>
      )}

      {/* Main 12-Column Control Surface Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT 7 COLS: Connected Profile / Connect Onboarding + 3-Step Handshake */}
        <div className="xl:col-span-7 space-y-6">
          {/* Connected Creator Profile Hero Card (Stitch 09A) */}
          {account && !showConnectForm && (
            <section className="p-6 rounded-2xl bg-[#121216] border border-[#27272A] space-y-6 relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
                <div className="flex items-start gap-4">
                  {/* Instagram Neon Gradient Ring Avatar */}
                  <div className="relative shrink-0">
                    <div className="w-16 h-16 rounded-full p-[2.5px] bg-gradient-to-tr from-[#F59E0B] via-[#FF4F28] to-[#EC4899]">
                      <div className="w-full h-full rounded-full bg-[#09090B] flex items-center justify-center font-display font-bold text-lg text-white">
                        {account.displayName
                          .split(/\s+/)
                          .map((w) => w[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                    </div>
                    <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#121216] border border-[#27272A] flex items-center justify-center text-[#10B981]">
                      <span className="material-symbols-outlined text-[15px]">verified</span>
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display font-bold text-lg text-white">
                        {account.displayName}
                      </h3>
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase ${
                          account.isExpired
                            ? "bg-[#EF4444]/15 text-[#FCA5A5]"
                            : "bg-[#10B981]/15 text-[#9BFFCE]"
                        }`}
                      >
                        ● {account.isExpired ? "Token Expired" : "OAuth 2.0 Active"}
                      </span>
                      {account.sandboxMode && (
                        <span className="px-2 py-0.5 rounded-full bg-[#F59E0B]/15 border border-[#F59E0B]/35 font-mono text-[10px] text-[#FDE68A]">
                          SANDBOX MOCK
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 text-xs text-[#A1A1AA] font-mono">
                      <span className="text-[#FFB4A4] font-bold">{account.handle}</span>
                      <span>•</span>
                      <span className="px-2 py-0.5 rounded bg-[#18181D] border border-[#27272A] text-white text-[10px]">
                        {account.accountType} TIER
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 pt-1 font-mono text-xs text-[#A1A1AA]">
                      <span>
                        <strong className="text-white">
                          {(account.followersCount / 1000).toFixed(1)}K
                        </strong>{" "}
                        Followers
                      </span>
                      <span>/</span>
                      <span>
                        <strong className="text-white">{account.publishedReelsCount}</strong>{" "}
                        Reels Published
                      </span>
                      <span>/</span>
                      <span>
                        <strong className="text-[#10B981]">{account.scheduledReelsCount}</strong>{" "}
                        Queued
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setPersonalTierError(null);
                      setShowConnectForm(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#18181D] hover:bg-[#27272A] border border-[#27272A] font-display font-bold text-xs text-white inline-flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">sync_alt</span>
                    <span>Switch Profile</span>
                  </button>
                  <button
                    type="button"
                    disabled={busyAction === "revoke"}
                    onClick={() => void handleRevokeOAuth()}
                    className="px-3.5 py-2 rounded-xl bg-[#09090B] hover:bg-[#EF4444]/20 border border-[#27272A] hover:border-[#EF4444]/40 font-display font-bold text-xs text-[#FCA5A5] inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[16px]">key_off</span>
                    <span>{busyAction === "revoke" ? "Revoking..." : "Revoke OAuth"}</span>
                  </button>
                </div>
              </div>

              {/* 3-Column Telemetry Strip */}
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-[#27272A]">
                <div className="p-3 rounded-xl bg-[#09090B] border border-[#27272A]">
                  <div className="font-mono text-[10px] text-[#71717A] uppercase">
                    Linked FB Page
                  </div>
                  <div className="font-display font-bold text-xs sm:text-sm text-white mt-1 truncate">
                    {account.fbPageName}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#09090B] border border-[#27272A]">
                  <div className="font-mono text-[10px] text-[#71717A] uppercase">
                    Ingestion Speed
                  </div>
                  <div className="font-display font-bold text-xs sm:text-sm text-[#F59E0B] mt-1">
                    ~2.4 sec
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#09090B] border border-[#27272A]">
                  <div className="font-mono text-[10px] text-[#71717A] uppercase">
                    Gateway Mode
                  </div>
                  <div className="font-display font-bold text-xs sm:text-sm text-[#10B981] mt-1">
                    {account.sandboxMode ? "Sandbox v21.0" : "Live Meta v21.0"}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Disconnected Onboarding / Switch Profile Form (Stitch 14A State A & State B1) */}
          {(!account || showConnectForm) && (
            <section className="p-6 rounded-2xl bg-[#121216] border border-[#27272A] space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#F59E0B] via-[#FF4F28] to-[#EC4899] flex items-center justify-center text-[#09090B] shadow-md shrink-0">
                    <span className="material-symbols-outlined text-2xl font-bold">
                      photo_camera
                    </span>
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-base text-white">
                      {account
                        ? "Switch Connected Instagram Profile"
                        : "Connect Your Personal Instagram Account"}
                    </h3>
                    <p className="font-mono text-[11px] text-[#A1A1AA]">
                      Meta Graph API v21.0 • AES-256-GCM Isolated Token Vault
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded bg-[#18181D] border border-[#27272A] font-mono text-[10px] text-[#A1A1AA]">
                  {account ? "SWITCHING" : "STATUS: DISCONNECTED"}
                </span>
              </div>

              {/* STATE B1: Personal Account Detected Warning Banner (Stitch 14A) */}
              {personalTierError && (
                <div className="p-4 rounded-xl bg-[#F59E0B]/15 border border-[#F59E0B]/40 space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-[#F59E0B] text-xl shrink-0 mt-0.5">
                      warning
                    </span>
                    <div className="space-y-1 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-display font-bold text-xs text-white uppercase">
                          Personal Instagram Account Detected
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#F59E0B]/20 font-mono text-[10px] text-[#FDE68A] font-bold">
                          ERR_PERSONAL_TIER
                        </span>
                      </div>
                      <p className="text-xs text-[#E4E4E7] leading-relaxed">
                        {personalTierError} Switch Account Tier below to{" "}
                        <strong className="text-white">Creator</strong> or{" "}
                        <strong className="text-white">Business</strong> to complete pairing.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => setShowConvertGuide((v) => !v)}
                      className="px-3 py-1.5 rounded-lg bg-[#18181D] hover:bg-[#27272A] border border-[#27272A] font-mono text-[11px] text-[#FDE68A]"
                    >
                      {showConvertGuide ? "Hide Guide" : "Convert Account Guide →"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAccountTypeInput("CREATOR");
                        setPersonalTierError(null);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#F59E0B] text-[#09090B] font-display font-bold text-xs"
                    >
                      Select Creator Tier
                    </button>
                  </div>

                  {showConvertGuide && (
                    <ol className="p-3 rounded-xl bg-[#09090B] border border-[#27272A] text-[11px] text-[#A1A1AA] space-y-1 list-decimal list-inside font-mono">
                      <li>Open Instagram App → Profile → Menu (☰) → Account Type and Tools.</li>
                      <li>Tap &ldquo;Switch to Professional Account&rdquo; → Choose Creator (Free).</li>
                      <li>Link your Facebook Page and click Connect below.</li>
                    </ol>
                  )}
                </div>
              )}

              <form onSubmit={handleConnectSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A1A1AA] mb-1">
                      Instagram Handle
                    </label>
                    <div className="flex items-center rounded-xl bg-[#09090B] border border-[#27272A] px-3 py-2 focus-within:border-[#FF4F28]">
                      <span className="font-mono text-xs text-[#71717A] mr-1">@</span>
                      <input
                        type="text"
                        required
                        value={handleInput.replace(/^@+/, "")}
                        onChange={(e) => setHandleInput(e.target.value)}
                        placeholder="rohan_explains"
                        className="w-full bg-transparent text-xs text-white font-mono outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A1A1AA] mb-1">
                      Channel Display Name
                    </label>
                    <input
                      type="text"
                      value={displayNameInput}
                      onChange={(e) => setDisplayNameInput(e.target.value)}
                      placeholder="Rohan Explains STEM"
                      className="w-full px-3 py-2 rounded-xl bg-[#09090B] border border-[#27272A] text-xs text-white focus:outline-none focus:border-[#FF4F28]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A1A1AA] mb-1">
                      Instagram Account Tier
                    </label>
                    <select
                      value={accountTypeInput}
                      onChange={(e) =>
                        setAccountTypeInput(
                          e.target.value as "CREATOR" | "BUSINESS" | "PERSONAL"
                        )
                      }
                      className="w-full px-3 py-2 rounded-xl bg-[#09090B] border border-[#27272A] text-xs text-white"
                    >
                      <option value="CREATOR">Creator Account (Recommended)</option>
                      <option value="BUSINESS">Business Brand Account</option>
                      <option value="PERSONAL">
                        Personal Account (Tests ERR_PERSONAL_TIER Guard)
                      </option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <label className="w-full p-2.5 rounded-xl bg-[#09090B] border border-[#27272A] flex items-center justify-between cursor-pointer">
                      <div>
                        <div className="font-display font-bold text-xs text-white">
                          Sandbox Mock Publisher
                        </div>
                        <div className="font-mono text-[10px] text-[#71717A]">
                          Test Reels flow without Meta App Review
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={sandboxModeInput}
                        onChange={(e) => setSandboxModeInput(e.target.checked)}
                        className="accent-[#10B981] w-4 h-4"
                      />
                    </label>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={busyAction === "connect"}
                    className="flex-1 py-2.5 px-5 rounded-xl bg-[#FF4F28] hover:bg-[#FF6542] text-[#09090B] font-display font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(255,79,40,0.3)] disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">link</span>
                    <span>
                      {busyAction === "connect"
                        ? "Encrypting OAuth Token..."
                        : "Connect Instagram via Meta Graph API v21.0"}
                    </span>
                  </button>

                  {account && (
                    <button
                      type="button"
                      onClick={() => {
                        setPersonalTierError(null);
                        setShowConnectForm(false);
                      }}
                      className="py-2.5 px-4 rounded-xl bg-[#18181D] hover:bg-[#27272A] border border-[#27272A] font-mono text-xs text-[#A1A1AA]"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </section>
          )}

          {/* 3-Step Meta Graph API Handshake Pipeline (Stitch 09A) */}
          <section className="p-6 rounded-2xl bg-[#121216] border border-[#27272A] space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#10B981] text-xl">
                  verified_user
                </span>
                <h3 className="font-display font-bold text-sm sm:text-base text-white">
                  Meta Graph API Handshake Pipeline
                </h3>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded font-mono text-[10px] font-bold uppercase ${
                  account && !account.isExpired
                    ? "bg-[#10B981]/15 text-[#9BFFCE]"
                    : "bg-[#F59E0B]/15 text-[#FDE68A]"
                }`}
              >
                {account
                  ? `${account.eligibilityGates.filter((g) => g.passed).length} of 3 Gates Cleared`
                  : "0 of 3 Gates Cleared"}
              </span>
            </div>

            <div className="space-y-3">
              {(account
                ? account.eligibilityGates
                : [
                    {
                      step: 1,
                      title: "1. Professional Creator / Business Account Check",
                      statusLabel: "ACTION_REQUIRED" as const,
                      passed: false,
                      description:
                        "Connect a Creator or Business Instagram account above to verify Reels container upload eligibility.",
                      metaTag: "Awaiting OAuth pairing",
                    },
                    {
                      step: 2,
                      title: "2. Linked Facebook Page Handshake",
                      statusLabel: "ACTION_REQUIRED" as const,
                      passed: false,
                      description:
                        "Server-to-server Page link will be verified automatically upon pairing.",
                      metaTag: "Awaiting Page handshake",
                    },
                    {
                      step: 3,
                      title: "3. Granted OAuth 2.0 Security Scopes",
                      statusLabel: "ACTION_REQUIRED" as const,
                      passed: false,
                      description:
                        "Requires instagram_basic, instagram_content_publish, pages_show_list, and pages_read_engagement.",
                      metaTag: "4 Scopes Pending",
                    },
                  ]
              ).map((gate) => (
                <div
                  key={gate.step}
                  className="p-4 rounded-xl bg-[#09090B] border border-[#27272A] flex items-start gap-3.5"
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                      gate.passed
                        ? "bg-[#10B981]/20 text-[#10B981]"
                        : "bg-[#F59E0B]/20 text-[#F59E0B]"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {gate.passed ? "check" : "schedule"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-display font-bold text-xs sm:text-sm text-white truncate">
                        {gate.title}
                      </h4>
                      <span
                        className={`font-mono text-[10px] font-bold shrink-0 ${
                          gate.passed ? "text-[#9BFFCE]" : "text-[#FDE68A]"
                        }`}
                      >
                        {gate.statusLabel}
                      </span>
                    </div>
                    <p className="text-xs text-[#A1A1AA] leading-relaxed">
                      {gate.description}
                    </p>
                    <div className="font-mono text-[10px] text-[#71717A] pt-0.5">
                      {gate.metaTag}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* RIGHT 5 COLS: AES-256-GCM Token Vault + Recent Reels Dispatches */}
        <div className="xl:col-span-5 space-y-6">
          {/* AES-256-GCM Encrypted Token Vault Telemetry Card */}
          <section className="p-6 rounded-2xl bg-[#121216] border border-[#27272A] space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#F59E0B] text-xl">
                  shield_lock
                </span>
                <h3 className="font-display font-bold text-sm sm:text-base text-white">
                  AES-256-GCM Token Vault
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded bg-[#18181D] border border-[#27272A] font-mono text-[10px] text-[#F59E0B]">
                96-BIT IV • 128-BIT TAG
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#09090B] border border-[#27272A] space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#71717A]">Cipher Envelope</span>
                <span className="text-[#9BFFCE]">AES-256-GCM</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#71717A]">Bearer Fingerprint</span>
                <span className="text-white">
                  {account ? account.maskedTokenFingerprint : "Not Provisioned"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#71717A]">60-Day Token TTL</span>
                <span
                  className={
                    account?.isExpired ? "text-[#EF4444] font-bold" : "text-[#F59E0B]"
                  }
                >
                  {account
                    ? account.isExpired
                      ? "EXPIRED (0d left)"
                      : `${account.daysRemaining} / 60 Days`
                    : "—"}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[#18181D] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    account?.isExpired ? "bg-[#EF4444]" : "bg-[#10B981]"
                  }`}
                  style={{ width: `${account ? Math.max(4, ttlPct) : 0}%` }}
                />
              </div>
            </div>

            {account && (
              <>
                <label className="p-3.5 rounded-xl bg-[#09090B] border border-[#27272A] flex items-center justify-between gap-3 cursor-pointer">
                  <div>
                    <div className="font-display font-bold text-xs text-white">
                      Sandbox Mock Publisher Mode
                    </div>
                    <div className="text-[11px] text-[#A1A1AA]">
                      Simulates Meta Graph API v21.0 Reels container creation locally
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={account.sandboxMode}
                    onChange={(e) =>
                      void handleRefreshOrToggle({ sandboxMode: e.target.checked })
                    }
                    className="accent-[#10B981] w-4 h-4 shrink-0"
                  />
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busyAction === "refresh"}
                    onClick={() => void handleRefreshOrToggle({ simulateExpired: false })}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-[#18181D] hover:bg-[#27272A] border border-[#27272A] font-display font-bold text-xs text-white inline-flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px] text-[#10B981]">
                      autorenew
                    </span>
                    <span>Rotate 60-Day Token</span>
                  </button>

                  {isDevMode && !account.isExpired && (
                    <button
                      type="button"
                      disabled={busyAction === "refresh"}
                      onClick={() => void handleRefreshOrToggle({ simulateExpired: true })}
                      className="py-2.5 px-3 rounded-xl bg-[#09090B] hover:bg-[#27272A] border border-[#27272A] font-mono text-[11px] text-[#A1A1AA]"
                      title="QA helper to test 60-Day Token Expired recovery state"
                    >
                      Simulate Expiry
                    </button>
                  )}
                </div>
              </>
            )}
          </section>

          {/* Recent Published & Scheduled Reels Feed */}
          <section className="p-6 rounded-2xl bg-[#121216] border border-[#27272A] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-sm text-white">
                Recent Instagram Reels Dispatches
              </h3>
              <Link
                href="/dashboard"
                className="font-mono text-[11px] text-[#FFB4A4] hover:underline"
              >
                Export a Video →
              </Link>
            </div>

            {dispatches.length === 0 ? (
              <div className="p-5 rounded-xl bg-[#09090B] border border-dashed border-[#27272A] text-center space-y-1.5">
                <div className="font-display font-bold text-xs text-white">
                  No Reels Dispatched Yet
                </div>
                <p className="text-[11px] text-[#A1A1AA]">
                  Render any project to 1080p MP4 in Step 4 and click &ldquo;Post Reel Now&rdquo; to
                  publish directly to your feed.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {dispatches.map((d) => (
                  <div
                    key={d.id}
                    className="p-3 rounded-xl bg-[#09090B] border border-[#27272A] space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2 font-mono text-[10px]">
                      <span className="text-[#FFB4A4] font-bold">{d.igHandle}</span>
                      <span
                        className={
                          d.status === "published" ? "text-[#10B981]" : "text-[#F59E0B]"
                        }
                      >
                        ● {d.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-[#E4E4E7] line-clamp-1">{d.caption}</p>
                    {d.igContainerId && (
                      <div className="font-mono text-[10px] text-[#71717A]">
                        Container: {d.igContainerId}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Full-Width Interactive Live Diagnostic Terminal (Stitch 09A) */}
      <section className="rounded-2xl bg-[#121216] border border-[#27272A] overflow-hidden shadow-xl">
        <div className="px-5 py-3 bg-[#141419] border-b border-[#27272A] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
            </div>
            <span className="font-mono text-xs text-[#A1A1AA]">
              meta-graph-v21.0-diagnostic-shell // live-telemetry
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportAuditLog}
              className="px-3 py-1.5 rounded-lg bg-[#18181D] hover:bg-[#27272A] border border-[#27272A] font-mono text-[11px] text-[#E4E4E7]"
            >
              Export Audit Log (JSON)
            </button>
            <button
              type="button"
              disabled={busyAction === "probe"}
              onClick={() => void handleRunHandshakeProbe()}
              className="px-3.5 py-1.5 rounded-lg bg-[#FF4F28] hover:bg-[#FF6542] text-[#09090B] font-display font-bold text-xs inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">play_arrow</span>
              <span>
                {busyAction === "probe" ? "Probing..." : "Run Live Handshake Probe"}
              </span>
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5 bg-[#070709] font-mono text-xs space-y-1.5 min-h-[150px] overflow-x-auto">
          {probeLogs.map((ln, idx) => (
            <div
              key={idx}
              className={
                ln.includes("ERROR") || ln.includes("WARN") || ln.includes("DEGRADED")
                  ? "text-[#FCA5A5]"
                  : ln.includes("✓") || ln.includes("CONNECTED") || ln.includes("ROTATED")
                    ? "text-[#9BFFCE]"
                    : "text-[#A1A1AA]"
              }
            >
              {ln}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
