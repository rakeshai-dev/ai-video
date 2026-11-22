import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";

export default async function ProtectedDashboardLandingPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-[#09090B] text-[#F4F4F5] p-6 sm:p-10">
      <div className="max-w-3xl mx-auto bg-[#121216] border border-[#27272A] rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#27272A] pb-5">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#10B981]/15 border border-[#10B981]/30 text-[#9BFFCE] font-mono text-[10px]">
              ● AUTHENTICATED ISOLATED TENANT SESSION
            </span>
            <h1 className="font-display font-bold text-2xl text-white mt-2">
              Welcome back, {user.fullName}
            </h1>
            <p className="text-xs font-mono text-[#A1A1AA] mt-0.5">
              Tenant ID: {user.id} • {user.email}
            </p>
          </div>
          <LogoutButton />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
          <div className="p-4 rounded-xl bg-[#09090B] border border-[#27272A]">
            <div className="text-[#71717A] text-[10px]">VIDEO CREDITS</div>
            <div className="text-2xl font-display font-bold text-[#FF4F28] mt-1">
              {user.creditsBalance} CR
            </div>
          </div>
          <div className="p-4 rounded-xl bg-[#09090B] border border-[#27272A]">
            <div className="text-[#71717A] text-[10px]">INSTAGRAM HANDLE</div>
            <div className="text-base font-display font-bold text-[#10B981] mt-1 truncate">
              {user.instagramHandle || "Not Connected"}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-[#09090B] border border-[#27272A]">
            <div className="text-[#71717A] text-[10px]">PLAN TIER</div>
            <div className="text-base font-display font-bold text-white mt-1 uppercase">
              {user.planTier.replace("_", " ")}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#09090B] border border-[#27272A] flex flex-wrap items-center justify-between gap-3 text-xs text-[#A1A1AA]">
          <span>
            <strong className="text-white">F-03 Auth Gate Verified!</strong> Next feature{" "}
            <strong className="text-[#FF4F28]">F-04</strong> will replace this landing view with
            the full Personal Member Dashboard &amp; Empty Onboarding state.
          </span>
          <Link href="/" className="font-mono text-[#FF4F28] hover:underline">
            ← Back to Homepage
          </Link>
        </div>
      </div>
    </main>
  );
}
