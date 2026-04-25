"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_THEME_ID, readStoredThemeId, resolveThemeById } from "@/lib/themes";
import { useAppState } from "@/lib/store";

function hexToRgb(color: string) {
  if (!color || !color.startsWith("#")) return null;
  const normalized = color.slice(1);
  const value = normalized.length === 3 ? normalized.split("").map((c) => c + c).join("") : normalized;
  if (value.length !== 6) return null;
  return { r: parseInt(value.slice(0, 2), 16), g: parseInt(value.slice(2, 4), 16), b: parseInt(value.slice(4, 6), 16) };
}
function rgbToHex(r: number, g: number, b: number) { const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v))); return `#${[clamp(r), clamp(g), clamp(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`; }
function withAlpha(color: string, alpha: number) { const rgb = hexToRgb(color); return rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})` : color; }
function compositeOver(bgHex: string, fgR: number, fgG: number, fgB: number, fgA: number) { const bg = hexToRgb(bgHex); if (!bg) return bgHex; return rgbToHex(fgR * fgA + bg.r * (1 - fgA), fgG * fgA + bg.g * (1 - fgA), fgB * fgA + bg.b * (1 - fgA)); }
function mixColors(baseColor: string, tintColor: string, tintWeight = 0.5) { const baseRgb = hexToRgb(baseColor); const tintRgb = hexToRgb(tintColor); if (!baseRgb || !tintRgb) return baseColor; const w = Math.max(0, Math.min(1, tintWeight)); return rgbToHex(baseRgb.r * (1 - w) + tintRgb.r * w, baseRgb.g * (1 - w) + tintRgb.g * w, baseRgb.b * (1 - w) + tintRgb.b * w); }
function rgbToHsl({ r, g, b }: { r: number; g: number; b: number }) { const rn = r / 255, gn = g / 255, bn = b / 255; const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn); let h = 0; const l = (max + min) / 2; const d = max - min; let s = 0; if (d) { s = d / (1 - Math.abs(2 * l - 1)); switch (max) { case rn: h = ((gn - bn) / d) % 6; break; case gn: h = (bn - rn) / d + 2; break; default: h = (rn - gn) / d + 4; } h *= 60; if (h < 0) h += 360; } return { h, s, l }; }
function hslToRgb({ h, s, l }: { h: number; s: number; l: number }) { const c = (1 - Math.abs(2 * l - 1)) * s; const x = c * (1 - Math.abs(((h / 60) % 2) - 1)); const m = l - c / 2; let r1 = 0, g1 = 0, b1 = 0; if (h < 60) [r1, g1, b1] = [c, x, 0]; else if (h < 120) [r1, g1, b1] = [x, c, 0]; else if (h < 180) [r1, g1, b1] = [0, c, x]; else if (h < 240) [r1, g1, b1] = [0, x, c]; else if (h < 300) [r1, g1, b1] = [x, 0, c]; else [r1, g1, b1] = [c, 0, x]; return { r: (r1 + m) * 255, g: (g1 + m) * 255, b: (b1 + m) * 255 }; }
function getComplementaryColor(color: string) { const rgb = hexToRgb(color); if (!rgb) return color; const { h, s, l } = rgbToHsl(rgb); const comp = hslToRgb({ h: (h + 180) % 360, s: Math.min(1, Math.max(0.34, s)), l: Math.min(0.72, Math.max(0.3, l)) }); return rgbToHex(comp.r, comp.g, comp.b); }
function getContrastColor(color: string, darkMode: boolean) { const rgb = hexToRgb(color); if (!rgb) return darkMode ? "#020617" : "#ffffff"; const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255; return luminance > 0.6 ? "#0f172a" : "#f8fafc"; }

export function ThemeRuntime() {
  const { settings } = useAppState();
  const [themeId, setThemeId] = useState(() => readStoredThemeId());
  const [systemPrefersDark, setSystemPrefersDark] = useState(true);
  const lastApplied = useRef("");

  const applyTheme = useCallback(() => {
    const darkMode = settings.followSystemTheme ? systemPrefersDark : settings.darkMode;
    const key = `${themeId}:${darkMode ? "dark" : "light"}`;
    if (lastApplied.current === key) return;
    const root = document.documentElement;
    root.classList.add("theme-switching");
    const resolvedTheme = resolveThemeById(themeId);
    const theme = resolvedTheme.themes[darkMode ? "dark" : "light"];
    const primaryColor = theme.accent;
    const primaryRgb = hexToRgb(primaryColor);
    const primaryHsl = primaryRgb ? rgbToHsl(primaryRgb) : { h: 220, s: 0.5, l: 0.5 };
    const secondaryColor = darkMode ? mixColors("#1e293b", primaryColor, 0.62) : mixColors("#e2e8f0", primaryColor, 0.5);
    const modeBaseBackground = theme.background || (darkMode ? "#0b0d11" : "#fcfcfd");
    let background = mixColors(modeBaseBackground, primaryColor, darkMode ? 0.08 : 0.03);
    if (darkMode) {
      const midToneRgb = hslToRgb({ h: primaryHsl.h, s: Math.max(0.24, Math.min(0.52, primaryHsl.s * 0.62)), l: 0.094 });
      background = mixColors(modeBaseBackground, rgbToHex(midToneRgb.r, midToneRgb.g, midToneRgb.b), 0.76);
    } else background = mixColors(modeBaseBackground, primaryColor, 0.055);
    const foreground = darkMode ? "#ffffff" : "#0f172a";
    const lightCardBase = mixColors("#ffffff", primaryColor, 0.045);
    const lightPopoverBase = mixColors("#ffffff", primaryColor, 0.07);
    const lightMutedBase = mixColors("#e2e8f0", primaryColor, 0.18);
    const lightBorderBase = mixColors("#94a3b8", primaryColor, 0.26);
    const lightInputBase = mixColors("#ffffff", primaryColor, 0.08);
    const lightSurfaceSoftBase = mixColors("#f1f5f9", primaryColor, 0.15);
    const lightSurfaceSoftHoverBase = mixColors("#e2e8f0", primaryColor, 0.22);
    const lightSurfaceNavBase = mixColors("#ffffff", primaryColor, 0.12);
    const lightSurfaceElevatedBase = mixColors("#ffffff", primaryColor, 0.08);
    const lightOverlayBase = mixColors("#cbd5e1", primaryColor, 0.24);
    const lightSkeletonBase = mixColors("#cbd5e1", primaryColor, 0.24);
    const accent = mixColors(secondaryColor, primaryColor, 0.58);
    const card = darkMode ? "rgba(15, 23, 42, 0.72)" : withAlpha(lightCardBase, 0.95);
    const colorbg = darkMode ? mixColors(background, "#0f172a", 0.72) : mixColors(background, lightCardBase, 0.95);
    const surfaceNavSolid = darkMode ? compositeOver(background, 2, 6, 23, 0.78) : (() => { const rgb = hexToRgb(lightSurfaceNavBase); return rgb ? compositeOver(background, rgb.r, rgb.g, rgb.b, 0.84) : background; })();
    const accentTone = mixColors(primaryColor, secondaryColor, 0.35);
    const supportTone = mixColors(secondaryColor, primaryColor, 0.2);
    const colorBase = mixColors(darkMode ? "#0b1020" : "#ffffff", supportTone, 0.12);
    const colorLight = darkMode ? mixColors(colorBase, accentTone, 0.42) : mixColors(colorBase, accentTone, 0.34);
    const colorBold = darkMode ? mixColors(colorBase, accentTone, 0.68) : mixColors(colorBase, accentTone, 0.58);
    const oppositeColor = getComplementaryColor(primaryColor);
    const socialMotherStart = darkMode ? mixColors("#0b0d11", oppositeColor, 0.08) : mixColors("#ffffff", oppositeColor, 0.16);
    const socialMotherEnd = darkMode ? "#0b0d11" : "#ffffff";
    const vars: Record<string, string> = {
      "--color-background": background, "--colorbg": colorbg, "--color-foreground": foreground,
      "--color-card": card, "--color-card-foreground": foreground, "--color-popover": darkMode ? "rgba(2, 6, 23, 0.96)" : withAlpha(lightPopoverBase, 0.98), "--color-popover-foreground": foreground,
      "--color-primary": primaryColor, "--color-primary-foreground": getContrastColor(primaryColor, darkMode), "--color-secondary": secondaryColor, "--color-secondary-foreground": getContrastColor(secondaryColor, darkMode),
      "--color-muted": darkMode ? "rgba(30, 41, 59, 0.82)" : withAlpha(lightMutedBase, 0.9), "--color-muted-foreground": darkMode ? "#94a3b8" : mixColors("#475569", primaryColor, 0.16),
      "--color-accent": accent, "--color-accent-foreground": getContrastColor(accent, darkMode), "--color-destructive": darkMode ? "#ef4444" : "#dc2626", "--color-border": darkMode ? "rgba(255, 255, 255, 0.1)" : withAlpha(lightBorderBase, 0.32),
      "--color-input": darkMode ? "rgba(255, 255, 255, 0.06)" : withAlpha(lightInputBase, 0.94), "--color-ring": accent, "--surface-soft": darkMode ? "rgba(255, 255, 255, 0.06)" : withAlpha(lightSurfaceSoftBase, 0.94),
      "--surface-soft-hover": darkMode ? "rgba(255, 255, 255, 0.08)" : withAlpha(lightSurfaceSoftHoverBase, 0.98), "--surface-nav": darkMode ? "rgba(2, 6, 23, 0.78)" : withAlpha(lightSurfaceNavBase, 0.84), "--surface-nav-solid": surfaceNavSolid,
      "--surface-elevated": darkMode ? "rgba(2, 6, 23, 0.94)" : withAlpha(lightSurfaceElevatedBase, 0.98), "--overlay-backdrop": darkMode ? "rgba(2, 6, 23, 0.74)" : withAlpha(lightOverlayBase, 0.66), "--skeleton-fill": darkMode ? "rgba(255, 255, 255, 0.08)" : withAlpha(lightSkeletonBase, 0.58),
      "--color-bold": colorBold, "--color-light": colorLight, "--color-base": colorBase, "--social-mother-start": socialMotherStart, "--social-mother-mid": mixColors(socialMotherStart, socialMotherEnd, darkMode ? 0.62 : 0.38), "--social-mother-end": socialMotherEnd, "--app-body-background": background,
    };
    Object.entries(vars).forEach(([name, value]) => root.style.setProperty(name, value));
    const mode = darkMode ? "dark" : "light";
    root.setAttribute("data-theme", mode); root.style.colorScheme = mode; root.style.backgroundColor = colorbg; document.body.style.backgroundColor = colorbg;
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute("content", primaryColor);
    try { localStorage.setItem("holodex-theme-bg", colorbg); } catch {}
    lastApplied.current = key;
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("theme-switching")));
  }, [settings.darkMode, settings.followSystemTheme, systemPrefersDark, themeId]);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (mq) { setSystemPrefersDark(mq.matches); const cb = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches); mq.addEventListener("change", cb); return () => mq.removeEventListener("change", cb); }
  }, []);
  useEffect(() => { applyTheme(); }, [applyTheme]);
  useEffect(() => { const cb = (event: Event) => { const next = Number((event as CustomEvent).detail); setThemeId(Number.isFinite(next) ? next : DEFAULT_THEME_ID); }; window.addEventListener("holodex-theme-change", cb); return () => window.removeEventListener("holodex-theme-change", cb); }, []);
  return null;
}
