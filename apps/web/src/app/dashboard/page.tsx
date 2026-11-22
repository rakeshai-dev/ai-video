import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardTelemetry } from "@/lib/projects";
import DashboardClient from "@/components/DashboardClient";

export default async function PersonalDashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const telemetry = getDashboardTelemetry(user.id);

  return <DashboardClient user={user} initialTelemetry={telemetry} />;
}
