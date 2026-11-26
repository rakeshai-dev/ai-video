"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { SceneData, SceneType, SubtitleStyle, WordTimestamp } from "@/lib/projects";

export interface StudioCanvasPlayerProps {
  scenes: SceneData[];
  aspectRatio: "9:16" | "16:9";
  subtitleStyle: SubtitleStyle;
  brandHandle: string;
  currentTimeMs: number;
  isPlaying: boolean;
  loop: boolean;
  showSafeZones: boolean;
  onTimeChange: (nextTimeMs: number, autoPaused?: boolean) => void;
  onTogglePlay: () => void;
  onToggleLoop: () => void;
  onToggleSafeZones: () => void;
  onSelectSceneIndex?: (index: number) => void;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function easeOutCubic(t: number): number {
  const x = clamp(t, 0, 1);
  return 1 - Math.pow(1 - x, 3);
}

function easeOutBack(t: number): number {
  const x = clamp(t, 0, 1);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 3
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = words[0];

  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
      if (lines.length === maxLines - 1) {
        const rest = [current, ...words.slice(i + 1)].join(" ");
        let trimmed = rest;
        while (trimmed.length > 3 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
          trimmed = trimmed.slice(0, -1).trimEnd();
        }
        current = trimmed === rest ? rest : `${trimmed}…`;
        break;
      }
    }
  }
  lines.push(current);
  return lines.slice(0, maxLines);
}

function formatTimecode(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  const tenths = Math.floor((Math.max(0, ms) % 1000) / 100);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${tenths}`;
}

function renderDiagramFlow(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  isPortrait: boolean,
  props: Record<string, unknown>,
  progress: number
) {
  const rawNodes = Array.isArray(props.nodes) ? props.nodes : [];
  const nodes =
    rawNodes.length > 0
      ? rawNodes.slice(0, 4).map((n, idx) => {
          const obj = (n && typeof n === "object" ? n : {}) as Record<string, unknown>;
          return {
            title: String(obj.title || `Step ${idx + 1}`),
            subtitle: String(obj.subtitle || "Process stage"),
            icon: String(obj.icon || (idx === 0 ? "☀️" : idx === 1 ? "⚡" : "🚀")),
          };
        })
      : [
          { title: "1. Input Signal", subtitle: "Primary source", icon: "☀️" },
          { title: "2. Core Process", subtitle: "Active conversion", icon: "⚡" },
          { title: "3. Output Result", subtitle: "Delivered value", icon: "🚀" },
        ];

  const dirPref = String(props.flow_direction || "auto");
  const verticalLayout =
    dirPref === "vertical" ? true : dirPref === "horizontal" ? false : isPortrait;

  const activeFloat = progress * nodes.length;
  const areaTop = isPortrait ? 370 : 250;
  const areaBottom = isPortrait ? H - 430 : H - 250;
  const areaHeight = areaBottom - areaTop;

  if (verticalLayout) {
    const cardW = W - 180;
    const gap = nodes.length >= 4 ? 36 : 52;
    const cardH = Math.min(220, (areaHeight - gap * (nodes.length - 1)) / nodes.length);
    const startY = areaTop + (areaHeight - (cardH * nodes.length + gap * (nodes.length - 1))) / 2;
    const cardX = (W - cardW) / 2;

    // Connectors + animated signal pulses
    for (let i = 0; i < nodes.length - 1; i++) {
      const y1 = startY + i * (cardH + gap) + cardH;
      const y2 = y1 + gap;
      const cx = W / 2;

      ctx.save();
      ctx.strokeStyle = "rgba(255, 79, 40, 0.32)";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(cx, y1 + 4);
      ctx.lineTo(cx, y2 - 4);
      ctx.stroke();

      const pulseT = (progress * 3.2 - i * 0.35) % 1;
      if (pulseT > 0) {
        const py = y1 + pulseT * gap;
        ctx.fillStyle = "#FF4F28";
        ctx.shadowColor = "#FF4F28";
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(cx, py, 9, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    nodes.forEach((node, idx) => {
      const appear = easeOutBack(clamp((progress - idx * 0.14) / 0.32, 0, 1));
      const isCurrent = Math.floor(clamp(activeFloat, 0, nodes.length - 0.01)) === idx;
      const y = startY + idx * (cardH + gap) + (1 - appear) * 38;

      ctx.save();
      ctx.globalAlpha = clamp(appear, 0.12, 1);

      drawRoundedRect(ctx, cardX, y, cardW, cardH, 28);
      ctx.fillStyle = isCurrent ? "rgba(28, 24, 30, 0.96)" : "rgba(18, 18, 22, 0.9)";
      ctx.fill();
      ctx.lineWidth = isCurrent ? 4 : 2;
      ctx.strokeStyle = isCurrent ? "#FF4F28" : "#27272A";
      if (isCurrent) {
        ctx.shadowColor = "rgba(255, 79, 40, 0.45)";
        ctx.shadowBlur = 28;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Icon badge
      const iconBox = Math.min(116, cardH - 44);
      const iconX = cardX + 28;
      const iconY = y + (cardH - iconBox) / 2;
      drawRoundedRect(ctx, iconX, iconY, iconBox, iconBox, 22);
      ctx.fillStyle = isCurrent ? "rgba(255, 79, 40, 0.18)" : "rgba(39, 39, 42, 0.65)";
      ctx.fill();

      ctx.font = `${Math.round(iconBox * 0.5)}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(node.icon, iconX + iconBox / 2, iconY + iconBox / 2 + 4);

      // Node text
      const textX = iconX + iconBox + 28;
      const maxTextW = cardW - (iconBox + 90);
      ctx.textAlign = "left";
      ctx.fillStyle = "#FFFFFF";
      ctx.font = `700 38px "Space Grotesk", sans-serif`;
      const titleLines = wrapLines(ctx, node.title, maxTextW, 1);
      ctx.fillText(titleLines[0], textX, y + cardH * 0.41);

      ctx.fillStyle = "#A1A1AA";
      ctx.font = `500 26px "Plus Jakarta Sans", sans-serif`;
      const subLines = wrapLines(ctx, node.subtitle, maxTextW, 2);
      ctx.fillText(subLines[0], textX, y + cardH * 0.69);

      // Active badge
      drawRoundedRect(ctx, cardX + cardW - 144, y + 22, 118, 40, 20);
      ctx.fillStyle = isCurrent ? "rgba(16, 185, 129, 0.18)" : "rgba(39, 39, 42, 0.6)";
      ctx.fill();
      ctx.fillStyle = isCurrent ? "#9BFFCE" : "#71717A";
      ctx.font = `700 18px "JetBrains Mono", monospace`;
      ctx.textAlign = "center";
      ctx.fillText(isCurrent ? "ACTIVE" : `STEP 0${idx + 1}`, cardX + cardW - 85, y + 43);

      ctx.restore();
    });
  } else {
    const gap = 46;
    const totalW = W - 180;
    const cardW = (totalW - gap * (nodes.length - 1)) / nodes.length;
    const cardH = Math.min(430, areaHeight - 30);
    const startX = 90;
    const cardY = areaTop + (areaHeight - cardH) / 2;

    for (let i = 0; i < nodes.length - 1; i++) {
      const x1 = startX + i * (cardW + gap) + cardW;
      const x2 = x1 + gap;
      const cy = cardY + cardH / 2;

      ctx.save();
      ctx.strokeStyle = "rgba(255, 79, 40, 0.35)";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(x1 + 4, cy);
      ctx.lineTo(x2 - 4, cy);
      ctx.stroke();

      const pulseT = (progress * 3.2 - i * 0.3) % 1;
      if (pulseT > 0) {
        ctx.fillStyle = "#FF4F28";
        ctx.shadowColor = "#FF4F28";
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(x1 + pulseT * gap, cy, 9, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    nodes.forEach((node, idx) => {
      const appear = easeOutBack(clamp((progress - idx * 0.14) / 0.34, 0, 1));
      const isCurrent = Math.floor(clamp(activeFloat, 0, nodes.length - 0.01)) === idx;
      const x = startX + idx * (cardW + gap);
      const y = cardY + (1 - appear) * 40;

      ctx.save();
      ctx.globalAlpha = clamp(appear, 0.15, 1);
      drawRoundedRect(ctx, x, y, cardW, cardH, 28);
      ctx.fillStyle = isCurrent ? "rgba(28, 24, 30, 0.96)" : "rgba(18, 18, 22, 0.9)";
      ctx.fill();
      ctx.lineWidth = isCurrent ? 4 : 2;
      ctx.strokeStyle = isCurrent ? "#FF4F28" : "#27272A";
      ctx.stroke();

      drawRoundedRect(ctx, x + cardW / 2 - 58, y + 38, 116, 116, 28);
      ctx.fillStyle = isCurrent ? "rgba(255, 79, 40, 0.18)" : "rgba(39, 39, 42, 0.65)";
      ctx.fill();

      ctx.font = `56px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(node.icon, x + cardW / 2, y + 98);

      ctx.fillStyle = "#FFFFFF";
      ctx.font = `700 34px "Space Grotesk", sans-serif`;
      const tLines = wrapLines(ctx, node.title, cardW - 48, 2);
      tLines.forEach((ln, li) => {
        ctx.fillText(ln, x + cardW / 2, y + 206 + li * 42);
      });

      ctx.fillStyle = "#A1A1AA";
      ctx.font = `500 24px "Plus Jakarta Sans", sans-serif`;
      const sLines = wrapLines(ctx, node.subtitle, cardW - 52, 3);
      sLines.forEach((ln, li) => {
        ctx.fillText(ln, x + cardW / 2, y + 300 + li * 34);
      });

      ctx.restore();
    });
  }
}

function renderKidsCounting(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  isPortrait: boolean,
  props: Record<string, unknown>,
  progress: number
) {
  const focusSymbol = String(props.focus_symbol || "A • 5");
  const phoneticWord = String(props.phonetic_word || "Let's Count Together!");
  const targetCount = clamp(Math.round(Number(props.target_count || 5)), 1, 10);
  const itemLabel = String(props.item_label || "Items");
  const itemEmoji = String(props.item_emoji || "🍎");
  const confetti = props.confetti_on_complete !== false;

  // Soft warm glow behind counting arena
  const grad = ctx.createRadialGradient(W / 2, H * 0.48, 40, W / 2, H * 0.48, W * 0.55);
  grad.addColorStop(0, "rgba(245, 158, 11, 0.18)");
  grad.addColorStop(0.6, "rgba(16, 185, 129, 0.08)");
  grad.addColorStop(1, "rgba(9, 9, 11, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Hero Focus Symbol Badge
  const heroBounce = 1 + Math.sin(progress * Math.PI * 4) * 0.03;
  const heroW = isPortrait ? W - 200 : 620;
  const heroH = isPortrait ? 190 : 155;
  const heroX = (W - heroW) / 2;
  const heroY = isPortrait ? 355 : 225;

  ctx.save();
  ctx.translate(W / 2, heroY + heroH / 2);
  ctx.scale(heroBounce, heroBounce);
  drawRoundedRect(ctx, -heroW / 2, -heroH / 2, heroW, heroH, 36);
  ctx.fillStyle = "rgba(24, 24, 29, 0.95)";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#F59E0B";
  ctx.stroke();

  ctx.fillStyle = "#FDE68A";
  ctx.font = `800 ${isPortrait ? 64 : 54}px "Space Grotesk", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(focusSymbol, 0, -18);

  ctx.fillStyle = "#E4E4E7";
  ctx.font = `600 26px "Plus Jakarta Sans", sans-serif`;
  const phLine = wrapLines(ctx, `${phoneticWord} • ${targetCount} ${itemLabel}`, heroW - 60, 1)[0];
  ctx.fillText(phLine, 0, 44);
  ctx.restore();

  // Counting Grid
  const cols = targetCount <= 3 ? targetCount : targetCount <= 6 ? 3 : 5;
  const rows = Math.ceil(targetCount / cols);
  const gridTop = isPortrait ? 595 : 415;
  const gridHeight = isPortrait ? 670 : 380;
  const cellW = Math.min(isPortrait ? 250 : 230, (W - 220) / cols - 24);
  const cellH = Math.min(isPortrait ? 250 : 175, gridHeight / rows - 24);
  const gap = 24;
  const totalGridW = cols * cellW + (cols - 1) * gap;
  const startX = (W - totalGridW) / 2;

  let revealedCount = 0;
  for (let i = 0; i < targetCount; i++) {
    const threshold = 0.08 + (i / targetCount) * 0.68;
    const pop = easeOutBack(clamp((progress - threshold) / 0.16, 0, 1));
    if (pop > 0.5) revealedCount = i + 1;

    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = startX + c * (cellW + gap);
    const y = gridTop + r * (cellH + gap);

    ctx.save();
    ctx.translate(x + cellW / 2, y + cellH / 2);
    const scale = clamp(pop, 0.2, 1.08);
    ctx.scale(scale, scale);
    ctx.globalAlpha = pop > 0.02 ? 1 : 0.18;

    drawRoundedRect(ctx, -cellW / 2, -cellH / 2, cellW, cellH, 28);
    ctx.fillStyle = pop > 0.02 ? "rgba(16, 185, 129, 0.16)" : "rgba(24, 24, 29, 0.65)";
    ctx.fill();
    ctx.lineWidth = pop > 0.02 ? 4 : 2;
    ctx.strokeStyle = pop > 0.02 ? "#10B981" : "#27272A";
    ctx.stroke();

    ctx.font = `${Math.round(Math.min(cellW, cellH) * 0.45)}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(itemEmoji, 0, -10);

    // Count pill
    drawRoundedRect(ctx, -38, cellH / 2 - 48, 76, 36, 18);
    ctx.fillStyle = "#10B981";
    ctx.fill();
    ctx.fillStyle = "#09090B";
    ctx.font = `800 22px "Space Grotesk", sans-serif`;
    ctx.fillText(String(i + 1), 0, cellH / 2 - 29);

    ctx.restore();
  }

  // Live Counter Readout Pill
  const badgeY = isPortrait ? H - 485 : H - 225;
  drawRoundedRect(ctx, W / 2 - 190, badgeY, 380, 62, 31);
  ctx.fillStyle = "rgba(245, 158, 11, 0.16)";
  ctx.fill();
  ctx.strokeStyle = "rgba(245, 158, 11, 0.5)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#FDE68A";
  ctx.font = `700 26px "Space Grotesk", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`COUNTED: ${revealedCount} / ${targetCount} ${itemLabel.toUpperCase()}`, W / 2, badgeY + 32);

  // Confetti burst on completion
  if (confetti && progress > 0.78) {
    const burstT = (progress - 0.78) / 0.22;
    const colors = ["#FF4F28", "#F59E0B", "#10B981", "#38BDF8", "#F472B6"];
    for (let p = 0; p < 28; p++) {
      const angle = (p / 28) * Math.PI * 2 + p * 0.3;
      const dist = 80 + burstT * (isPortrait ? 420 : 340) * (0.6 + (p % 4) * 0.15);
      const px = W / 2 + Math.cos(angle) * dist;
      const py = H * 0.52 + Math.sin(angle) * dist * 0.7 + burstT * burstT * 90;
      ctx.save();
      ctx.globalAlpha = clamp(1 - burstT * 0.85, 0, 1);
      ctx.fillStyle = colors[p % colors.length];
      ctx.translate(px, py);
      ctx.rotate(burstT * 6 + p);
      ctx.fillRect(-9, -5, 18, 10);
      ctx.restore();
    }
  }
}

function renderSplitComparison(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  isPortrait: boolean,
  props: Record<string, unknown>,
  progress: number
) {
  const leftRaw = (props.left_or_top_card && typeof props.left_or_top_card === "object"
    ? props.left_or_top_card
    : {}) as Record<string, unknown>;
  const rightRaw = (props.right_or_bottom_card && typeof props.right_or_bottom_card === "object"
    ? props.right_or_bottom_card
    : {}) as Record<string, unknown>;

  const leftCard = {
    badge: String(leftRaw.badge_text || "✗ COMMON MYTH"),
    title: String(leftRaw.title || "Outdated Assumption"),
    points: Array.isArray(leftRaw.points)
      ? leftRaw.points.map(String).slice(0, 4)
      : ["High energy loss", "Fails under load"],
    color: String(leftRaw.color_hex || "#EF4444"),
  };
  const rightCard = {
    badge: String(rightRaw.badge_text || "✓ VERIFIED FACT"),
    title: String(rightRaw.title || "Measured Reality"),
    points: Array.isArray(rightRaw.points)
      ? rightRaw.points.map(String).slice(0, 4)
      : ["High efficiency", "Proven in field tests"],
    color: String(rightRaw.color_hex || "#10B981"),
  };

  const drawCard = (
    card: typeof leftCard,
    x: number,
    y: number,
    w: number,
    h: number,
    delay: number
  ) => {
    const enter = easeOutCubic(clamp((progress - delay) / 0.28, 0, 1));
    ctx.save();
    ctx.globalAlpha = clamp(enter, 0.1, 1);
    const offsetY = (1 - enter) * 42;

    drawRoundedRect(ctx, x, y + offsetY, w, h, 32);
    ctx.fillStyle = "rgba(18, 18, 22, 0.94)";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = card.color;
    ctx.stroke();

    // Badge pill
    drawRoundedRect(ctx, x + 34, y + offsetY + 32, Math.min(w - 68, 320), 48, 24);
    ctx.fillStyle = `${card.color}26`;
    ctx.fill();
    ctx.fillStyle = card.color;
    ctx.font = `800 22px "JetBrains Mono", monospace`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(card.badge.slice(0, 24), x + 56, y + offsetY + 57);

    // Card title
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `700 ${isPortrait ? 40 : 36}px "Space Grotesk", sans-serif`;
    const titleLines = wrapLines(ctx, card.title, w - 72, 2);
    titleLines.forEach((ln, idx) => {
      ctx.fillText(ln, x + 36, y + offsetY + 128 + idx * 44);
    });

    // Bullet points
    const bulletStartY = y + offsetY + (titleLines.length > 1 ? 220 : 186);
    card.points.forEach((pt, pIdx) => {
      const ptEnter = easeOutCubic(clamp((progress - (delay + 0.14 + pIdx * 0.08)) / 0.22, 0, 1));
      const py = bulletStartY + pIdx * (isPortrait ? 68 : 64);
      if (py + 36 > y + offsetY + h) return;

      ctx.save();
      ctx.globalAlpha = clamp(ptEnter, 0.15, 1);
      ctx.fillStyle = card.color;
      ctx.beginPath();
      ctx.arc(x + 50, py, 9, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#E4E4E7";
      ctx.font = `500 27px "Plus Jakarta Sans", sans-serif`;
      const pLine = wrapLines(ctx, pt, w - 115, 1)[0];
      ctx.fillText(pLine, x + 76, py + 2);
      ctx.restore();
    });

    ctx.restore();
  };

  if (isPortrait) {
    const cardW = W - 160;
    const cardH = 470;
    const topY = 370;
    const gap = 66;
    drawCard(leftCard, 80, topY, cardW, cardH, 0.02);
    drawCard(rightCard, 80, topY + cardH + gap, cardW, cardH, 0.26);

    // Center VS badge
    const vsY = topY + cardH + gap / 2;
    drawRoundedRect(ctx, W / 2 - 64, vsY - 30, 128, 60, 30);
    ctx.fillStyle = "#FF4F28";
    ctx.fill();
    ctx.fillStyle = "#09090B";
    ctx.font = `800 26px "Space Grotesk", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("VS", W / 2, vsY + 1);
  } else {
    const gap = 76;
    const cardW = (W - 180 - gap) / 2;
    const cardH = 540;
    const cardY = 265;
    drawCard(leftCard, 90, cardY, cardW, cardH, 0.02);
    drawCard(rightCard, 90 + cardW + gap, cardY, cardW, cardH, 0.24);

    drawRoundedRect(ctx, W / 2 - 58, cardY + cardH / 2 - 32, 116, 64, 32);
    ctx.fillStyle = "#FF4F28";
    ctx.fill();
    ctx.fillStyle = "#09090B";
    ctx.font = `800 26px "Space Grotesk", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("VS", W / 2, cardY + cardH / 2 + 1);
  }
}

function renderStatCounter(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  isPortrait: boolean,
  props: Record<string, unknown>,
  progress: number
) {
  const targetNum = Number.isFinite(Number(props.target_number)) ? Number(props.target_number) : 87;
  const prefix = String(props.number_prefix ?? "+");
  const suffix = String(props.number_suffix ?? "%");
  const takeaway = String(props.takeaway_label || "Verified Performance Gain");
  const displayMode = String(props.display_mode || "bar_chart");
  const rawBars = Array.isArray(props.bars) ? props.bars : [];
  const bars =
    rawBars.length > 0
      ? rawBars.slice(0, 4).map((b, i) => {
          const obj = (b && typeof b === "object" ? b : {}) as Record<string, unknown>;
          return {
            label: String(obj.label || `Metric ${i + 1}`),
            value: clamp(Number(obj.value || 50), 1, 100),
            color: String(
              obj.color_hex || (i === 0 ? "#64748B" : i === 1 ? "#F59E0B" : "#10B981")
            ),
          };
        })
      : [
          { label: "Baseline", value: 32, color: "#64748B" },
          { label: "Standard", value: 54, color: "#F59E0B" },
          { label: "Optimized", value: 87, color: "#10B981" },
        ];

  const countEase = easeOutCubic(clamp(progress / 0.65, 0, 1));
  const currentVal =
    Math.abs(targetNum) % 1 !== 0
      ? (targetNum * countEase).toFixed(1)
      : String(Math.round(targetNum * countEase));

  const heroY = isPortrait ? 390 : displayMode === "big_number" ? 410 : 255;

  // Big Number Card
  const heroW = isPortrait ? W - 160 : displayMode === "big_number" ? 980 : 1180;
  const heroH = isPortrait ? 290 : displayMode === "big_number" ? 340 : 210;
  drawRoundedRect(ctx, (W - heroW) / 2, heroY, heroW, heroH, 34);
  ctx.fillStyle = "rgba(18, 18, 22, 0.92)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 79, 40, 0.45)";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = "#FF4F28";
  ctx.font = `800 ${isPortrait ? 118 : displayMode === "big_number" ? 132 : 92}px "Space Grotesk", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${prefix}${currentVal}${suffix}`, W / 2, heroY + heroH * 0.44);

  ctx.fillStyle = "#E4E4E7";
  ctx.font = `600 28px "Plus Jakarta Sans", sans-serif`;
  const tkLine = wrapLines(ctx, takeaway, heroW - 80, 1)[0];
  ctx.fillText(tkLine, W / 2, heroY + heroH * 0.8);

  if (displayMode !== "big_number") {
    const chartTop = isPortrait ? 740 : 500;
    const chartW = isPortrait ? W - 180 : 1180;
    const chartX = (W - chartW) / 2;
    const barGap = isPortrait ? 44 : 34;
    const barH = isPortrait ? 110 : 76;
    const maxVal = Math.max(100, ...bars.map((b) => b.value));

    bars.forEach((bar, idx) => {
      const barEase = easeOutCubic(clamp((progress - (0.15 + idx * 0.12)) / 0.45, 0, 1));
      const y = chartTop + idx * (barH + barGap);

      // Track background
      drawRoundedRect(ctx, chartX, y, chartW, barH, 22);
      ctx.fillStyle = "rgba(24, 24, 29, 0.9)";
      ctx.fill();
      ctx.strokeStyle = "#27272A";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Animated fill bar
      const fillW = Math.max(90, (chartW - 16) * (bar.value / maxVal) * barEase);
      drawRoundedRect(ctx, chartX + 8, y + 8, fillW, barH - 16, 16);
      ctx.fillStyle = bar.color;
      ctx.fill();

      // Bar label & value
      ctx.fillStyle = "#FFFFFF";
      ctx.font = `700 26px "Space Grotesk", sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(bar.label, chartX + 30, y + barH / 2);

      ctx.fillStyle = "#FFFFFF";
      ctx.font = `700 26px "JetBrains Mono", monospace`;
      ctx.textAlign = "right";
      ctx.fillText(`${Math.round(bar.value * barEase)}%`, chartX + chartW - 28, y + barH / 2);
    });
  }
}

function renderIllustratedMotion(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  isPortrait: boolean,
  props: Record<string, unknown>,
  progress: number,
  headline: string
) {
  const cameraMotion = String(props.camera_motion || "zoom_in");
  const artStyle = String(props.art_style || "dark_tech");
  const calloutBadge = String(props.callout_badge || `✨ ${headline.slice(0, 28)}`);

  const palette =
    artStyle === "storybook_warm"
      ? { primary: "#F59E0B", secondary: "#FB7185", glow: "rgba(245, 158, 11, 0.22)" }
      : artStyle === "neon_science"
        ? { primary: "#38BDF8", secondary: "#10B981", glow: "rgba(56, 189, 248, 0.22)" }
        : artStyle === "clean_editorial"
          ? { primary: "#E4E4E7", secondary: "#FF4F28", glow: "rgba(255, 79, 40, 0.16)" }
          : { primary: "#FF4F28", secondary: "#10B981", glow: "rgba(255, 79, 40, 0.22)" };

  const frameX = isPortrait ? 80 : 140;
  const frameY = isPortrait ? 370 : 240;
  const frameW = W - frameX * 2;
  const frameH = isPortrait ? 980 : 570;

  ctx.save();
  drawRoundedRect(ctx, frameX, frameY, frameW, frameH, 38);
  ctx.clip();

  // Camera transform inside clipped viewport
  let scale = 1.05;
  let panX = 0;
  let panY = 0;
  if (cameraMotion === "zoom_in") {
    scale = 1.0 + progress * 0.16;
  } else if (cameraMotion === "zoom_out") {
    scale = 1.18 - progress * 0.16;
  } else if (cameraMotion === "pan_left") {
    scale = 1.12;
    panX = (0.5 - progress) * 90;
  } else if (cameraMotion === "pan_right") {
    scale = 1.12;
    panX = (progress - 0.5) * 90;
  }

  const cx = frameX + frameW / 2;
  const cy = frameY + frameH / 2;
  ctx.translate(cx + panX, cy + panY);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);

  // Rich procedural backdrop
  ctx.fillStyle = "#111116";
  ctx.fillRect(frameX - 120, frameY - 120, frameW + 240, frameH + 240);

  const glow = ctx.createRadialGradient(cx, cy, 30, cx, cy, frameW * 0.65);
  glow.addColorStop(0, palette.glow);
  glow.addColorStop(1, "rgba(9, 9, 11, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(frameX - 120, frameY - 120, frameW + 240, frameH + 240);

  // Perspective schematic grid
  ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
  ctx.lineWidth = 2;
  for (let gx = frameX - 80; gx < frameX + frameW + 80; gx += 70) {
    ctx.beginPath();
    ctx.moveTo(gx, frameY - 80);
    ctx.lineTo(gx, frameY + frameH + 80);
    ctx.stroke();
  }
  for (let gy = frameY - 80; gy < frameY + frameH + 80; gy += 70) {
    ctx.beginPath();
    ctx.moveTo(frameX - 80, gy);
    ctx.lineTo(frameX + frameW + 80, gy);
    ctx.stroke();
  }

  // Animated concentric orbital rings & vector nodes
  for (let ring = 1; ring <= 3; ring++) {
    const radius = ring * (isPortrait ? 115 : 92);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(progress * Math.PI * (ring % 2 === 0 ? -0.9 : 1.1) + ring);
    ctx.strokeStyle = ring === 1 ? palette.primary : "rgba(255,255,255,0.14)";
    ctx.lineWidth = ring === 1 ? 4 : 2;
    ctx.setLineDash(ring === 2 ? [14, 12] : []);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Orbiting satellite node
    ctx.fillStyle = ring % 2 === 0 ? palette.secondary : palette.primary;
    ctx.beginPath();
    ctx.arc(radius, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Center core emblem
  drawRoundedRect(ctx, cx - 78, cy - 78, 156, 156, 42);
  ctx.fillStyle = "rgba(9, 9, 11, 0.9)";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = palette.primary;
  ctx.stroke();

  ctx.fillStyle = palette.primary;
  ctx.font = `800 46px "Space Grotesk", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("60FPS", cx, cy - 10);
  ctx.fillStyle = "#A1A1AA";
  ctx.font = `700 18px "JetBrains Mono", monospace`;
  ctx.fillText(cameraMotion.replace("_", " ").toUpperCase(), cx, cy + 34);

  ctx.restore();

  // Viewport border
  drawRoundedRect(ctx, frameX, frameY, frameW, frameH, 38);
  ctx.strokeStyle = "#27272A";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Floating Callout Badge
  const badgeW = Math.min(frameW - 80, 620);
  const badgeX = W / 2 - badgeW / 2;
  const badgeY = frameY + frameH - 108;
  drawRoundedRect(ctx, badgeX, badgeY, badgeW, 74, 37);
  ctx.fillStyle = "rgba(9, 9, 11, 0.9)";
  ctx.fill();
  ctx.strokeStyle = palette.primary;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = `700 28px "Space Grotesk", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const badgeText = wrapLines(ctx, calloutBadge, badgeW - 60, 1)[0];
  ctx.fillText(badgeText, W / 2, badgeY + 38);
}

function renderWordSyncedSubtitles(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  isPortrait: boolean,
  subtitleStyle: SubtitleStyle,
  timestamps: WordTimestamp[],
  narrationText: string,
  localTimeMs: number
) {
  const words: WordTimestamp[] =
    timestamps.length > 0
      ? timestamps
      : narrationText
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .map((w, i) => ({ word: w, start_ms: i * 320, end_ms: (i + 1) * 320 }));

  if (words.length === 0) return;

  let activeIdx = words.findIndex(
    (w) => localTimeMs >= w.start_ms && localTimeMs <= w.end_ms
  );
  if (activeIdx === -1) {
    const passed = words.filter((w) => localTimeMs >= w.start_ms);
    activeIdx = passed.length > 0 ? passed.length - 1 : 0;
  }

  const chunkSize = subtitleStyle === "hormozi_pop" ? 4 : isPortrait ? 5 : 7;
  const chunkStart = Math.floor(activeIdx / chunkSize) * chunkSize;
  const chunk = words.slice(chunkStart, chunkStart + chunkSize);
  const yCenter = isPortrait ? H - 255 : H - 135;

  ctx.save();
  if (subtitleStyle === "hormozi_pop") {
    ctx.font = `900 ${isPortrait ? 58 : 52}px "Space Grotesk", sans-serif`;
    const gap = 22;
    const widths = chunk.map((c) => ctx.measureText(c.word.toUpperCase()).width);
    const totalW = widths.reduce((a, b) => a + b, 0) + gap * (chunk.length - 1);
    let cursorX = (W - totalW) / 2;

    chunk.forEach((item, idx) => {
      const globalIdx = chunkStart + idx;
      const isSpoken = globalIdx === activeIdx;
      const label = item.word.toUpperCase();
      const w = widths[idx];

      ctx.save();
      ctx.translate(cursorX + w / 2, yCenter);
      if (isSpoken) ctx.scale(1.12, 1.12);
      ctx.lineWidth = 12;
      ctx.strokeStyle = "#09090B";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeText(label, 0, 0);
      ctx.fillStyle = isSpoken ? "#F59E0B" : "#FFFFFF";
      ctx.fillText(label, 0, 0);
      ctx.restore();

      cursorX += w + gap;
    });
  } else if (subtitleStyle === "kids_read_along") {
    ctx.font = `800 ${isPortrait ? 44 : 40}px "Plus Jakarta Sans", sans-serif`;
    const gap = 18;
    const widths = chunk.map((c) => ctx.measureText(c.word).width);
    const totalW = widths.reduce((a, b) => a + b, 0) + gap * (chunk.length - 1);
    const padX = 44;
    drawRoundedRect(ctx, (W - totalW) / 2 - padX, yCenter - 52, totalW + padX * 2, 104, 36);
    ctx.fillStyle = "rgba(255, 251, 235, 0.96)";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#F59E0B";
    ctx.stroke();

    let cursorX = (W - totalW) / 2;
    chunk.forEach((item, idx) => {
      const isSpoken = chunkStart + idx === activeIdx;
      const w = widths[idx];
      if (isSpoken) {
        drawRoundedRect(ctx, cursorX - 10, yCenter - 34, w + 20, 68, 18);
        ctx.fillStyle = "#10B981";
        ctx.fill();
      }
      ctx.fillStyle = isSpoken ? "#FFFFFF" : "#18181B";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(item.word, cursorX, yCenter + 2);
      cursorX += w + gap;
    });
  } else if (subtitleStyle === "clean_minimal") {
    ctx.font = `600 ${isPortrait ? 38 : 34}px "Plus Jakarta Sans", sans-serif`;
    const gap = 14;
    const widths = chunk.map((c) => ctx.measureText(c.word).width);
    const totalW = widths.reduce((a, b) => a + b, 0) + gap * (chunk.length - 1);
    drawRoundedRect(ctx, (W - totalW) / 2 - 34, yCenter - 40, totalW + 68, 80, 18);
    ctx.fillStyle = "rgba(9, 9, 11, 0.78)";
    ctx.fill();

    let cursorX = (W - totalW) / 2;
    chunk.forEach((item, idx) => {
      const isSpoken = chunkStart + idx === activeIdx;
      const w = widths[idx];
      ctx.fillStyle = isSpoken ? "#FFFFFF" : "#A1A1AA";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(item.word, cursorX, yCenter);
      if (isSpoken) {
        ctx.fillStyle = "#FF4F28";
        ctx.fillRect(cursorX, yCenter + 24, w, 4);
      }
      cursorX += w + gap;
    });
  } else {
    // karaoke_highlight (default)
    ctx.font = `700 ${isPortrait ? 44 : 38}px "Space Grotesk", sans-serif`;
    const gap = 16;
    const widths = chunk.map((c) => ctx.measureText(c.word).width);
    const totalW = widths.reduce((a, b) => a + b, 0) + gap * (chunk.length - 1);
    drawRoundedRect(ctx, (W - totalW) / 2 - 40, yCenter - 48, totalW + 80, 96, 28);
    ctx.fillStyle = "rgba(18, 18, 22, 0.92)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 2;
    ctx.stroke();

    let cursorX = (W - totalW) / 2;
    chunk.forEach((item, idx) => {
      const isSpoken = chunkStart + idx === activeIdx;
      const w = widths[idx];
      if (isSpoken) {
        drawRoundedRect(ctx, cursorX - 10, yCenter - 32, w + 20, 64, 16);
        ctx.fillStyle = "#FF4F28";
        ctx.fill();
      }
      ctx.fillStyle = isSpoken ? "#09090B" : "#F4F4F5";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(item.word, cursorX, yCenter + 2);
      cursorX += w + gap;
    });
  }
  ctx.restore();
}

export default function StudioCanvasPlayer({
  scenes,
  aspectRatio,
  subtitleStyle,
  brandHandle,
  currentTimeMs,
  isPlaying,
  loop,
  showSafeZones,
  onTimeChange,
  onTogglePlay,
  onToggleLoop,
  onToggleSafeZones,
  onSelectSceneIndex,
}: StudioCanvasPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const sceneOffsets = useMemo(() => {
    let acc = 0;
    return scenes.map((scene, index) => {
      const startMs = acc;
      const dur = Math.max(1000, scene.duration_ms || 5000);
      acc += dur;
      return {
        index,
        scene,
        startMs,
        endMs: acc,
        durationMs: dur,
      };
    });
  }, [scenes]);

  const totalDurationMs = useMemo(
    () => (sceneOffsets.length > 0 ? sceneOffsets[sceneOffsets.length - 1].endMs : 5000),
    [sceneOffsets]
  );

  const activeEntry = useMemo(() => {
    if (sceneOffsets.length === 0) return null;
    const clamped = clamp(currentTimeMs, 0, totalDurationMs);
    const found = sceneOffsets.find((s) => clamped >= s.startMs && clamped < s.endMs);
    return found || sceneOffsets[sceneOffsets.length - 1];
  }, [sceneOffsets, currentTimeMs, totalDurationMs]);

  // 60fps requestAnimationFrame playback loop
  const timeRef = useRef(currentTimeMs);
  timeRef.current = currentTimeMs;

  useEffect(() => {
    if (!isPlaying) return;
    let rafId = 0;
    let prevTs = performance.now();

    const tick = (now: number) => {
      const delta = Math.min(100, Math.max(0, now - prevTs));
      prevTs = now;
      const next = timeRef.current + delta;

      if (next >= totalDurationMs) {
        if (loop) {
          timeRef.current = 0;
          onTimeChange(0, false);
        } else {
          timeRef.current = totalDurationMs;
          onTimeChange(totalDurationMs, true);
          return;
        }
      } else {
        timeRef.current = next;
        onTimeChange(next, false);
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, loop, totalDurationMs, onTimeChange]);

  // Notify parent when playback crosses into a new scene
  const prevSceneIdxRef = useRef<number>(-1);
  useEffect(() => {
    if (!activeEntry) return;
    if (isPlaying && prevSceneIdxRef.current !== activeEntry.index) {
      prevSceneIdxRef.current = activeEntry.index;
      onSelectSceneIndex?.(activeEntry.index);
    } else {
      prevSceneIdxRef.current = activeEntry.index;
    }
  }, [activeEntry, isPlaying, onSelectSceneIndex]);

  // Render active frame onto 1080p HTML5 <canvas>
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activeEntry) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isPortrait = aspectRatio === "9:16";
    const W = isPortrait ? 1080 : 1920;
    const H = isPortrait ? 1920 : 1080;
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }

    const { scene, startMs, durationMs, index } = activeEntry;
    const localMs = clamp(currentTimeMs - startMs, 0, durationMs);
    const progress = clamp(localMs / durationMs, 0, 1);

    // 1. Obsidian Cinema Canvas Backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, "#0D0D12");
    bgGrad.addColorStop(0.5, "#09090B");
    bgGrad.addColorStop(1, "#060608");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Subtle top ambient Vermilion glow
    const topGlow = ctx.createRadialGradient(W / 2, 0, 20, W / 2, 0, W * 0.7);
    topGlow.addColorStop(0, "rgba(255, 79, 40, 0.14)");
    topGlow.addColorStop(1, "rgba(9, 9, 11, 0)");
    ctx.fillStyle = topGlow;
    ctx.fillRect(0, 0, W, H * 0.45);

    // 2. Top Progress Strip + Watermark Pill
    ctx.fillStyle = "rgba(39, 39, 42, 0.7)";
    ctx.fillRect(0, 0, W, 10);
    ctx.fillStyle = "#FF4F28";
    ctx.fillRect(0, 0, W * clamp(currentTimeMs / totalDurationMs, 0, 1), 10);

    const headerY = isPortrait ? 110 : 54;
    drawRoundedRect(ctx, 72, headerY, 270, 52, 26);
    ctx.fillStyle = "rgba(24, 24, 29, 0.88)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 79, 40, 0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#FFB4A4";
    ctx.font = `700 20px "JetBrains Mono", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `SCENE ${String(index + 1).padStart(2, "0")} / ${String(scenes.length).padStart(2, "0")}`,
      72 + 135,
      headerY + 27
    );

    // Brand handle pill on top right
    const wmText = brandHandle || "@animora_creator";
    ctx.font = `600 20px "JetBrains Mono", monospace`;
    const wmWidth = Math.max(220, ctx.measureText(wmText).width + 56);
    drawRoundedRect(ctx, W - 72 - wmWidth, headerY, wmWidth, 52, 26);
    ctx.fillStyle = "rgba(18, 18, 22, 0.85)";
    ctx.fill();
    ctx.strokeStyle = "#27272A";
    ctx.stroke();
    ctx.fillStyle = "#A1A1AA";
    ctx.fillText(wmText, W - 72 - wmWidth / 2, headerY + 27);

    // 3. Animated On-Screen Headline
    const headEnter = easeOutCubic(clamp(progress / 0.18, 0, 1));
    ctx.save();
    ctx.globalAlpha = clamp(headEnter, 0.15, 1);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `800 ${isPortrait ? 56 : 50}px "Space Grotesk", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const headLines = wrapLines(ctx, scene.on_screen_headline, W - 160, 2);
    const headBaseY = (isPortrait ? 195 : 122) + (1 - headEnter) * 20;
    headLines.forEach((ln, li) => {
      ctx.fillText(ln, W / 2, headBaseY + li * (isPortrait ? 64 : 56));
    });
    ctx.restore();

    // 4. Active Scene Engine Renderer
    const engine: SceneType = scene.scene_type || "diagram_flow";
    const props = scene.animation_props || {};
    if (engine === "kids_counting") {
      renderKidsCounting(ctx, W, H, isPortrait, props, progress);
    } else if (engine === "split_comparison") {
      renderSplitComparison(ctx, W, H, isPortrait, props, progress);
    } else if (engine === "stat_counter") {
      renderStatCounter(ctx, W, H, isPortrait, props, progress);
    } else if (engine === "illustrated_motion") {
      renderIllustratedMotion(
        ctx,
        W,
        H,
        isPortrait,
        props,
        progress,
        scene.on_screen_headline
      );
    } else {
      renderDiagramFlow(ctx, W, H, isPortrait, props, progress);
    }

    // 5. Word-Synced Subtitles Overlay
    renderWordSyncedSubtitles(
      ctx,
      W,
      H,
      isPortrait,
      subtitleStyle,
      scene.word_timestamps || [],
      scene.narration_text || "",
      localMs
    );

    // 6. Optional Reels / Shorts Safe-Zone Overlay Guides
    if (showSafeZones) {
      ctx.save();
      ctx.strokeStyle = "rgba(56, 189, 248, 0.65)";
      ctx.lineWidth = 3;
      ctx.setLineDash([14, 10]);
      const marginX = isPortrait ? 96 : 120;
      const marginTop = isPortrait ? 190 : 96;
      const marginBottom = isPortrait ? 340 : 120;
      ctx.strokeRect(
        marginX,
        marginTop,
        W - marginX * 2,
        H - marginTop - marginBottom
      );
      ctx.setLineDash([]);
      drawRoundedRect(ctx, marginX + 16, marginTop + 16, 300, 42, 12);
      ctx.fillStyle = "rgba(14, 116, 144, 0.85)";
      ctx.fill();
      ctx.fillStyle = "#E0F2FE";
      ctx.font = `700 18px "JetBrains Mono", monospace`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("REELS SAFE ZONE (96PX)", marginX + 32, marginTop + 37);
      ctx.restore();
    }
  }, [
    activeEntry,
    aspectRatio,
    brandHandle,
    currentTimeMs,
    scenes.length,
    showSafeZones,
    subtitleStyle,
    totalDurationMs,
  ]);

  const handleToggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      setIsFullscreen(false);
    }
  };

  const currentFrame = Math.floor((currentTimeMs / 1000) * 60);
  const totalFrames = Math.max(1, Math.floor((totalDurationMs / 1000) * 60));

  const jumpByMs = (deltaMs: number) => {
    const next = clamp(currentTimeMs + deltaMs, 0, totalDurationMs);
    onTimeChange(next, false);
  };

  const jumpScene = (dir: -1 | 1) => {
    if (!activeEntry || sceneOffsets.length === 0) return;
    const nextIdx = clamp(activeEntry.index + dir, 0, sceneOffsets.length - 1);
    onTimeChange(sceneOffsets[nextIdx].startMs + 10, false);
    onSelectSceneIndex?.(nextIdx);
  };

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full rounded-2xl bg-[#121216] border border-[#27272A] overflow-hidden"
    >
      {/* Monitor Top Telemetry Bar */}
      <div className="px-3.5 py-2.5 border-b border-[#27272A] bg-[#141419] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#10B981]/15 border border-[#10B981]/30 text-[#9BFFCE] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
            60FPS VECTOR ENGINE
          </span>
          <span className="px-2 py-0.5 rounded bg-[#18181D] border border-[#27272A] text-[#E4E4E7]">
            {aspectRatio === "9:16" ? "1080×1920 (9:16)" : "1920×1080 (16:9)"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleSafeZones}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-colors ${
              showSafeZones
                ? "bg-[#0284C7]/20 border-[#38BDF8]/50 text-[#7DD3FC]"
                : "bg-[#18181D] border-[#27272A] text-[#A1A1AA] hover:text-white"
            }`}
            title="Toggle Reels/Shorts UI Safe Zone Guides"
          >
            Safe Zone
          </button>
          <button
            type="button"
            onClick={handleToggleFullscreen}
            className="p-1.5 rounded-lg bg-[#18181D] border border-[#27272A] text-[#A1A1AA] hover:text-white transition-colors"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Monitor"}
          >
            <span className="material-symbols-outlined text-[16px] leading-none block">
              {isFullscreen ? "fullscreen_exit" : "fullscreen"}
            </span>
          </button>
        </div>
      </div>

      {/* Viewport Stage */}
      <div className="relative flex-1 min-h-[340px] sm:min-h-[420px] bg-[#070709] flex items-center justify-center p-3 sm:p-5 select-none">
        <div
          className={`relative shadow-[0_24px_70px_rgba(0,0,0,0.75)] rounded-2xl overflow-hidden border border-[#27272A] bg-[#09090B] ${
            aspectRatio === "9:16"
              ? "h-[360px] sm:h-[440px] lg:h-[470px] aspect-[9/16]"
              : "w-full max-w-[680px] aspect-[16/9]"
          }`}
        >
          <canvas
            ref={canvasRef}
            onClick={onTogglePlay}
            className="w-full h-full block cursor-pointer"
            aria-label="60fps Storyboard Animation Preview Canvas"
          />
        </div>
      </div>

      {/* Scrubber & Transport Controls */}
      <div className="px-4 py-3 border-t border-[#27272A] bg-[#141419] space-y-2.5">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-[#FFB4A4] w-16">
            {formatTimecode(currentTimeMs)}
          </span>
          <input
            type="range"
            min={0}
            max={totalDurationMs}
            step={16}
            value={Math.round(clamp(currentTimeMs, 0, totalDurationMs))}
            onChange={(e) => onTimeChange(Number(e.target.value), false)}
            aria-label="Timeline scrubber"
            className="flex-1 accent-[#FF4F28] h-1.5 bg-[#27272A] rounded-lg cursor-pointer"
          />
          <span className="font-mono text-[11px] text-[#A1A1AA] w-16 text-right">
            {formatTimecode(totalDurationMs)}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => jumpScene(-1)}
              className="p-1.5 rounded-lg bg-[#18181D] hover:bg-[#27272A] border border-[#27272A] text-[#E4E4E7]"
              title="Previous Scene"
            >
              <span className="material-symbols-outlined text-[18px] leading-none block">
                skip_previous
              </span>
            </button>
            <button
              type="button"
              onClick={() => jumpByMs(-5000)}
              className="px-2 py-1 rounded-lg bg-[#18181D] hover:bg-[#27272A] border border-[#27272A] font-mono text-[11px] text-[#A1A1AA] hover:text-white"
              title="Back 5 seconds"
            >
              -5s
            </button>
            <button
              type="button"
              onClick={onTogglePlay}
              className="px-4 py-1.5 rounded-xl bg-[#FF4F28] hover:bg-[#FF6542] text-[#09090B] font-display font-bold text-xs inline-flex items-center gap-1.5 shadow-[0_0_20px_rgba(255,79,40,0.3)] transition-all"
            >
              <span className="material-symbols-outlined text-[18px] leading-none">
                {isPlaying ? "pause" : "play_arrow"}
              </span>
              {isPlaying ? "Pause" : "Play 60fps"}
            </button>
            <button
              type="button"
              onClick={() => jumpByMs(5000)}
              className="px-2 py-1 rounded-lg bg-[#18181D] hover:bg-[#27272A] border border-[#27272A] font-mono text-[11px] text-[#A1A1AA] hover:text-white"
              title="Forward 5 seconds"
            >
              +5s
            </button>
            <button
              type="button"
              onClick={() => jumpScene(1)}
              className="p-1.5 rounded-lg bg-[#18181D] hover:bg-[#27272A] border border-[#27272A] text-[#E4E4E7]"
              title="Next Scene"
            >
              <span className="material-symbols-outlined text-[18px] leading-none block">
                skip_next
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px] text-[#71717A]">
            <button
              type="button"
              onClick={onToggleLoop}
              className={`px-2.5 py-1 rounded-lg border transition-colors ${
                loop
                  ? "bg-[#FF4F28]/15 border-[#FF4F28]/40 text-[#FFB4A4]"
                  : "bg-[#18181D] border-[#27272A] text-[#71717A] hover:text-white"
              }`}
            >
              Loop {loop ? "On" : "Off"}
            </button>
            <span className="hidden sm:inline">
              Frame {currentFrame.toLocaleString()} / {totalFrames.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
