import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  generateBrainstormIdeas,
  isRealApiKey,
  VOICE_CATALOG,
} from "@/lib/ai-generator";
import type { SceneType } from "@/lib/projects";
import CreateVideoWizardClient from "@/components/CreateVideoWizardClient";

const VALID_TEMPLATES = new Set<SceneType>([
  "diagram_flow",
  "kids_counting",
  "split_comparison",
  "stat_counter",
  "illustrated_motion",
]);

export default async function CreateVideoWizardPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string; topic?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const resolvedParams = await searchParams;
  const initialTemplate: SceneType =
    resolvedParams.template && VALID_TEMPLATES.has(resolvedParams.template as SceneType)
      ? (resolvedParams.template as SceneType)
      : user.niche.toLowerCase().includes("kids")
      ? "kids_counting"
      : "diagram_flow";

  const initialTopic =
    resolvedParams.topic?.trim() ||
    (initialTemplate === "kids_counting"
      ? "Count 1 to 5 Golden Stars & Learn Alphabet A-to-E"
      : "How Solar Panels Turn Sunlight Into Home Electricity");

  const { ideas, providerUsed } = await generateBrainstormIdeas({
    topic: initialTopic,
    primaryTemplate: initialTemplate,
    durationSec: 60,
    variationSeed: 0,
  });

  const elevenlabsConfigured = isRealApiKey(process.env.ELEVENLABS_API_KEY);

  return (
    <CreateVideoWizardClient
      user={user}
      voices={VOICE_CATALOG}
      elevenlabsConfigured={elevenlabsConfigured}
      initialTopic={initialTopic}
      initialTemplate={initialTemplate}
      initialIdeas={ideas}
      initialProvider={providerUsed}
    />
  );
}
