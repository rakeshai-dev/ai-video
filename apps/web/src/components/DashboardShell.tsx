"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { AuthenticatedUser } from "@/lib/auth";

interface DashboardShellProps {
  user: AuthenticatedUser;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard", matchExact: true },
  { href: "/dashboard/create", label: "+ Create AI Video", icon: "add_circle" },
  { href: "/dashboard/calendar", label: "Content Calendar", icon: "calendar_month" },
  { href: "/dashboard/integrations", label: "Instagram Connect", icon: "link" },
  { href: "/dashboard/brand-kit", label: "Brand Kit", icon: "palette" },
  { href: "/dashboard/billing", label: "Billing & Credits", icon: "bolt" },
  { href: "/dashboard/settings", label: "Account & Security", icon: "shield_person" },
];

export default function DashboardShell({
  user,
  title,
  subtitle,
  actions,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const isActive = (href: string, matchExact?: boolean) =>
    matchExact ? pathname === href : pathname?.startsWith(href);

  const handleSignOut = async () => {
    setSigningOut(true);
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const creditPercent = Math.min(100, Math.round((user.creditsBalance / 15) * 100));

  const SidebarContent = (
    <div className="flex flex-col h-full justify-between bg-[#0C0C0F] border-r border-[#27272A]">
      <div className="p-4 space-y-5">
        {/* Studio Brand Header */}
        <Link href="/dashboard" className="flex items-center gap-2.5 px-1">
          <div className="w-8 h-8 rounded-md bg-[#FF4F28] flex items-center justify-center shadow-[0_0_16px_rgba(255,79,40,0.4)] flex-shrink-0">
            <span className="material-symbols-outlined text-[#09090B] text-lg font-bold">
              movie_filter
            </span>
          </div>
          <div className="min-w-0">
            <div className="font-display font-bold text-sm tracking-tight text-white truncate">
              ANIMORA STUDIO
            </div>
            <div className="text-[10px] font-mono text-[#71717A] truncate">
              {user.fullName} • {user.planTier.replace("_", " ")}
            </div>
          </div>
        </Link>

        {/* Primary Nav Links */}
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href, item.matchExact);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setDrawerOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-display font-semibold transition-all ${
                  active
                    ? "bg-gradient-to-r from-[#FF4F28] to-[#FF7859] text-[#09090B] shadow-md shadow-[#FF4F28]/20"
                    : "text-[#A1A1AA] hover:text-white hover:bg-[#18181D]"
                }`}
              >
                <span className="material-symbols-outlined text-lg">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Credits Meter & Sign Out */}
      <div className="p-4 space-y-3 border-t border-[#27272A]">
        <div className="p-3 rounded-xl bg-[#121216] border border-[#27272A] space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-white font-bold">{user.creditsBalance} Video Credits</span>
            <span className="text-[#F59E0B]">{creditPercent}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-[#27272A] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#FF4F28] to-[#F59E0B] rounded-full"
              style={{ width: `${creditPercent}%` }}
            />
          </div>
          <Link
            href="/dashboard/billing"
            className="block text-[10px] font-mono text-[#A1A1AA] hover:text-[#FF4F28] transition-colors"
          >
            View Immutable Credit Ledger →
          </Link>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full py-2 px-3 rounded-lg bg-[#121216] hover:bg-[#18181D] border border-[#27272A] text-xs font-mono text-[#A1A1AA] hover:text-white flex items-center justify-center gap-2 transition-colors"
        >
          <span className="material-symbols-outlined text-sm">logout</span>
          <span>{signingOut ? "Signing out..." : "Sign Out"}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#09090B] text-[#F4F4F5] flex">
      {/* Desktop Fixed Sidebar (w-64, visible lg+) */}
      <aside className="hidden lg:block w-64 flex-shrink-0 fixed inset-y-0 left-0 z-30">
        {SidebarContent}
      </aside>

      {/* Mobile / Tablet Slide-Over Drawer */}
      {drawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex"
          onClick={() => setDrawerOpen(false)}
        >
          <div className="w-64 max-w-[80vw] h-full" onClick={(e) => e.stopPropagation()}>
            {SidebarContent}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0 pb-20 lg:pb-0">
        {/* Sticky Top Header Bar */}
        <header className="sticky top-0 z-20 bg-[#09090B]/90 backdrop-blur-md border-b border-[#27272A] px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                aria-label="Open studio navigation"
                className="lg:hidden w-9 h-9 rounded-md bg-[#121216] border border-[#27272A] flex items-center justify-center text-[#E4E4E7]"
              >
                <span className="material-symbols-outlined text-xl">menu</span>
              </button>
              <div className="min-w-0">
                <h1 className="font-display font-bold text-base sm:text-lg text-white truncate">
                  {title}
                </h1>
                {subtitle && (
                  <p className="text-[11px] text-[#A1A1AA] truncate">{subtitle}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-shrink-0">
              {/* Connected Instagram Pill */}
              <Link
                href="/dashboard/integrations"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#121216] border border-[#27272A] text-[11px] font-mono text-[#E4E4E7] hover:border-[#10B981]/50 transition-colors"
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    user.instagramConnected ? "bg-[#10B981]" : "bg-[#F59E0B]"
                  }`}
                />
                <span>
                  {user.instagramConnected && user.instagramHandle
                    ? `Connected: ${user.instagramHandle}`
                    : "Connect Instagram"}
                </span>
              </Link>

              {/* Credits Pill */}
              <Link
                href="/dashboard/billing"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-[#121216] border border-[#27272A] font-mono text-[11px] text-[#F59E0B] font-bold"
              >
                <span>⚡</span>
                <span>{user.creditsBalance} Cr</span>
              </Link>

              {actions}
            </div>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>

      {/* Fixed Bottom Mobile Navigation Bar (Visible below lg breakpoint, Matches Stitch 04B) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0C0C0F]/95 backdrop-blur-md border-t border-[#27272A] px-2 py-1.5 grid grid-cols-5 gap-1">
        {[
          { href: "/dashboard", label: "Videos", icon: "dashboard", exact: true },
          { href: "/dashboard/calendar", label: "Calendar", icon: "calendar_month" },
          { href: "/dashboard/create", label: "Create", icon: "add_circle", primary: true },
          { href: "/dashboard/integrations", label: "IG Sync", icon: "link" },
          { href: "/dashboard/settings", label: "Settings", icon: "shield_person" },
        ].map((tab) => {
          const active = isActive(tab.href, tab.exact);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center justify-center py-1 rounded-md text-[10px] font-display font-medium ${
                tab.primary
                  ? "text-[#FF4F28] font-bold"
                  : active
                  ? "text-white"
                  : "text-[#71717A]"
              }`}
            >
              <span className="material-symbols-outlined text-xl">{tab.icon}</span>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
