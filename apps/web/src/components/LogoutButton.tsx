"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="px-3.5 py-2 rounded-md bg-[#18181D] hover:bg-[#27272A] border border-[#27272A] text-xs font-mono text-[#E4E4E7] transition-colors"
    >
      {loading ? "Signing out..." : "Sign Out"}
    </button>
  );
}
