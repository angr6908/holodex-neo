"use client";

import { useEffect, useRef, useState } from "react";
import { readStoredThemeId, resolveThemeById } from "@/lib/themes";
import { useAppState } from "@/lib/store";
const generatedColorTokenNames = [
  "--color-background", "--color-foreground", "--color-card", "--color-card-foreground",
  "--color-popover", "--color-popover-foreground", "--color-primary", "--color-primary-foreground",
  "--color-secondary", "--color-secondary-foreground", "--color-muted", "--color-muted-foreground",
  "--color-accent", "--color-accent-foreground", "--color-destructive", "--color-destructive-foreground",
  "--color-border", "--color-input", "--color-ring",
];

function hexToRgb(color: string) {
  if (!color?.startsWith("#")) return null;
  const raw = color.slice(1);
  const v = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  if (v.length !== 6) return null;
  return { r: parseInt(v.slice(0, 2), 16), g: parseInt(v.slice(2, 4), 16), b: parseInt(v.slice(4, 6), 16) };
}

const clamp255 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
const rgbToHex = (r: number, g: number, b: number) =>
  `#${[clamp255(r), clamp255(g), clamp255(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;

function withAlpha(color: string, alpha: number) {
  const rgb = hexToRgb(color);
  return rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})` : color;
}

function compositeOver(bgHex: string, fR: number, fG: number, fB: number, fA: number) {
  const bg = hexToRgb(bgHex);
  return bg ? rgbToHex(fR * fA + bg.r * (1 - fA), fG * fA + bg.g * (1 - fA), fB * fA + bg.b * (1 - fA)) : bgHex;
}

function mixColors(base: string, tint: string, weight = 0.5) {
  const a = hexToRgb(base), b = hexToRgb(tint);
  if (!a || !b) return base;
  const w = Math.max(0, Math.min(1, weight));
  return rgbToHex(a.r * (1 - w) + b.r * w, a.g * (1 - w) + b.g * w, a.b * (1 - w) + b.b * w);
}

function rgbToHsl({ r, g, b }: { r: number; g: number; b: number }) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2, d = max - min;
  let h = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = max === rn ? ((gn - bn) / d) % 6 : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

function hslToRgb({ h, s, l }: { h: number; s: number; l: number }) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r1, g1, b1] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return { r: (r1 + m) * 255, g: (g1 + m) * 255, b: (b1 + m) * 255 };
}

function getComplementaryColor(color: string) {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  const { h, s, l } = rgbToHsl(rgb);
  const comp = hslToRgb({ h: (h + 180) % 360, s: Math.min(1, Math.max(0.34, s)), l: Math.min(0.72, Math.max(0.3, l)) });
  return rgbToHex(comp.r, comp.g, comp.b);
}

function getContrastColor(color: string) {
  const rgb = hexToRgb(color);
  if (!rgb) return "#ffffff";
  return (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255 > 0.62 ? "#020617" : "#ffffff";
}

function computedThemeTokens({ accentColor, baseBackground, darkMode }: { accentColor: string; baseBackground: string; darkMode: boolean }) {
  const primaryRgb = hexToRgb(accentColor);
  const primaryHsl = primaryRgb ? rgbToHsl(primaryRgb) : { h: 220, s: 0.5, l: 0.5 };
  const secondary = darkMode ? mixColors("#1e293b", accentColor, 0.62) : mixColors("#e2e8f0", accentColor, 0.5);

  let background = mixColors(baseBackground, accentColor, darkMode ? 0.08 : 0.055);
  if (darkMode) {
    const t = hslToRgb({ h: primaryHsl.h, s: Math.max(0.24, Math.min(0.52, primaryHsl.s * 0.62)), l: 0.094 });
    background = mixColors(baseBackground, rgbToHex(t.r, t.g, t.b), 0.76);
  }

  const foreground = darkMode ? "#ffffff" : "#0f172a";
  const accent = mixColors(secondary, accentColor, 0.58);
  const lightCard = mixColors("#ffffff", accentColor, 0.045);
  const lightNav = mixColors("#ffffff", accentColor, 0.12);
  const card = darkMode ? "rgba(15, 23, 42, 0.72)" : withAlpha(lightCard, 0.95);
  const navRgb = hexToRgb(lightNav);
  const supportTone = mixColors(secondary, accentColor, 0.2);
  const colorBase = mixColors(darkMode ? "#0b1020" : "#ffffff", supportTone, 0.12);
  const opposite = getComplementaryColor(accentColor);
  const socialStart = darkMode ? mixColors("#0b0d11", opposite, 0.08) : mixColors("#ffffff", opposite, 0.16);
  const socialEnd = darkMode ? "#0b0d11" : "#ffffff";

  return {
    background, foreground, card,
    popover: darkMode ? "rgba(2, 6, 23, 0.96)" : withAlpha(mixColors("#ffffff", accentColor, 0.07), 0.98),
    primary: accentColor,
    primaryForeground: getContrastColor(accentColor),
    secondary,
    secondaryForeground: getContrastColor(secondary),
    muted: darkMode ? "rgba(30, 41, 59, 0.82)" : withAlpha(mixColors("#e2e8f0", accentColor, 0.18), 0.9),
    mutedForeground: darkMode ? "#94a3b8" : mixColors("#475569", accentColor, 0.16),
    accent,
    accentForeground: getContrastColor(accent),
    destructive: darkMode ? "#ef4444" : "#dc2626",
    destructiveForeground: "#ffffff",
    border: darkMode ? "rgba(255, 255, 255, 0.1)" : withAlpha(mixColors("#94a3b8", accentColor, 0.26), 0.32),
    input: darkMode ? "rgba(255, 255, 255, 0.06)" : withAlpha(mixColors("#ffffff", accentColor, 0.08), 0.94),
    ring: accent,
    colorbg: darkMode ? mixColors(background, "#0f172a", 0.72) : mixColors(background, lightCard, 0.95),
    surfaceSoft: darkMode ? "rgba(255, 255, 255, 0.06)" : withAlpha(mixColors("#f1f5f9", accentColor, 0.15), 0.94),
    surfaceSoftHover: darkMode ? "rgba(255, 255, 255, 0.08)" : withAlpha(mixColors("#e2e8f0", accentColor, 0.22), 0.98),
    surfaceNav: darkMode ? "rgba(2, 6, 23, 0.78)" : withAlpha(lightNav, 0.84),
    surfaceNavSolid: darkMode ? compositeOver(background, 2, 6, 23, 0.78)
      : navRgb ? compositeOver(background, navRgb.r, navRgb.g, navRgb.b, 0.84) : background,
    surfaceElevated: darkMode ? "rgba(2, 6, 23, 0.94)" : withAlpha(mixColors("#ffffff", accentColor, 0.08), 0.98),
    overlayBackdrop: darkMode ? "rgba(2, 6, 23, 0.74)" : withAlpha(mixColors("#cbd5e1", accentColor, 0.24), 0.66),
    skeletonFill: darkMode ? "rgba(255, 255, 255, 0.08)" : withAlpha(mixColors("#cbd5e1", accentColor, 0.24), 0.58),
    colorBold: darkMode ? mixColors(colorBase, accent, 0.68) : mixColors(colorBase, accent, 0.58),
    colorLight: darkMode ? mixColors(colorBase, accent, 0.42) : mixColors(colorBase, accent, 0.34),
    colorBase,
    socialMotherStart: socialStart,
    socialMotherMid: mixColors(socialStart, socialEnd, darkMode ? 0.62 : 0.38),
    socialMotherEnd: socialEnd,
  };
}

export function ThemeRuntime() {
  const { settings } = useAppState();
  const [themeId, setThemeId] = useState(() => readStoredThemeId());
  const [systemPrefersDark, setSystemPrefersDark] = useState(true);
  const lastApplied = useRef("");

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return undefined;
    setSystemPrefersDark(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const darkMode = settings.followSystemTheme ? systemPrefersDark : settings.darkMode;
    const theme = resolveThemeById(themeId);
    const member = theme.themes[darkMode ? "dark" : "light"];
    const c = computedThemeTokens({ accentColor: member.accent, baseBackground: member.background, darkMode });
    const mode = darkMode ? "dark" : "light";
    const applyKey = `${mode}:${themeId}:${member.accent}:${member.background}`;
    if (lastApplied.current === applyKey) return;

    const root = document.documentElement;
    root.classList.add("theme-switching");
    root.classList.toggle("dark", darkMode);
    root.setAttribute("data-theme", mode);
    root.style.colorScheme = mode;
    generatedColorTokenNames.forEach((name) => root.style.removeProperty(name));

    const vars: Record<string, string> = {
      "--background": c.background, "--foreground": c.foreground,
      "--card": c.card, "--card-foreground": c.foreground,
      "--popover": c.popover, "--popover-foreground": c.foreground,
      "--primary": c.primary, "--primary-foreground": c.primaryForeground,
      "--secondary": c.secondary, "--secondary-foreground": c.secondaryForeground,
      "--muted": c.muted, "--muted-foreground": c.mutedForeground,
      "--accent": c.accent, "--accent-foreground": c.accentForeground,
      "--destructive": c.destructive, "--destructive-foreground": c.destructiveForeground,
      "--border": c.border, "--input": c.input, "--ring": c.ring,
      "--sidebar": c.card, "--sidebar-foreground": c.foreground,
      "--sidebar-primary": c.primary, "--sidebar-primary-foreground": c.primaryForeground,
      "--sidebar-accent": c.muted, "--sidebar-accent-foreground": c.foreground,
      "--sidebar-border": c.border, "--sidebar-ring": c.ring,
      "--colorbg": c.colorbg,
      "--surface-soft": c.surfaceSoft, "--surface-soft-hover": c.surfaceSoftHover,
      "--surface-nav": c.surfaceNav, "--surface-nav-solid": c.surfaceNavSolid,
      "--surface-elevated": c.surfaceElevated, "--overlay-backdrop": c.overlayBackdrop,
      "--skeleton-fill": c.skeletonFill,
      "--color-bold": c.colorBold, "--color-light": c.colorLight, "--color-base": c.colorBase,
      "--social-mother-start": c.socialMotherStart, "--social-mother-mid": c.socialMotherMid, "--social-mother-end": c.socialMotherEnd,
    };
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute("content", member.accent);
    lastApplied.current = applyKey;
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("theme-switching")));
  }, [settings.darkMode, settings.followSystemTheme, systemPrefersDark, themeId]);

  useEffect(() => {
    const onThemeChange = (e: Event) => {
      const id = Number((e as CustomEvent).detail);
      setThemeId(Number.isFinite(id) ? id : readStoredThemeId());
    };
    window.addEventListener("holodex-theme-change", onThemeChange);
    return () => window.removeEventListener("holodex-theme-change", onThemeChange);
  }, []);

  return null;
}
