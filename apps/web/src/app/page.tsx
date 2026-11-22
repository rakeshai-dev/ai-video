import React from "react";

export default function ScaffoldStatusPage() {
  return (
    <main className="min-h-screen bg-[#09090B] text-[#F4F4F5] flex items-center justify-center p-6">
      <div className="max-w-xl w-full bg-[#121216] border border-[#27272A] rounded-xl p-6 sm:p-8 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-[#FF4F28] flex items-center justify-center shadow-[0_0_16px_rgba(255,79,40,0.45)]">
              <span className="material-symbols-outlined text-[#09090B] text-lg font-bold">
                movie_filter
              </span>
            </div>
            <span className="font-display font-bold text-lg tracking-tight text-white">
              Animora Studio
            </span>
          </div>
          <span className="px-2.5 py-1 rounded bg-[#10B981]/15 border border-[#10B981]/30 text-[#9BFFCE] font-mono text-[10px] uppercase tracking-wider">
            F-01 Scaffold Ready
          </span>
        </div>

        <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Obsidian Cinema Foundation Initialized
        </h1>
        <p className="text-sm text-[#A1A1AA] leading-relaxed">
          Next.js 15 App Router, Tailwind Design System Tokens (
          <span className="font-mono text-[#FF4F28]">#FF4F28</span> on{" "}
          <span className="font-mono text-white">#09090B</span>), and the multi-tenant SQLite
          database schema are verified and ready. Next up: <strong className="text-white">F-02 Public Marketing Homepage</strong>.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 font-mono text-xs">
          <div className="p-3 rounded-lg bg-[#09090B] border border-[#27272A]">
            <div className="text-[#71717A] text-[10px] uppercase">Database</div>
            <div className="text-[#10B981] font-bold mt-1">SQLite WAL (7 Tables)</div>
          </div>
          <div className="p-3 rounded-lg bg-[#09090B] border border-[#27272A]">
            <div className="text-[#71717A] text-[10px] uppercase">Health API</div>
            <div className="text-[#F59E0B] font-bold mt-1">/api/v1/health</div>
          </div>
          <div className="p-3 rounded-lg bg-[#09090B] border border-[#27272A]">
            <div className="text-[#71717A] text-[10px] uppercase">Stitch Spec</div>
            <div className="text-white font-bold mt-1">28 Screens Synced</div>
          </div>
        </div>
      </div>
    </main>
  );
}
