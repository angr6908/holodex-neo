import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getBreakpoint(width: number): "xs" | "sm" | "md" | "lg" | "xl" {
  if (width < 600) return "xs";
  if (width < 960) return "sm";
  if (width < 1264) return "md";
  if (width < 1904) return "lg";
  return "xl";
}

// Layout-significant width thresholds used across the app (breakpoints + nav/list/multiview cutoffs).
// Resizes within a band don't change any derived layout, so windowWidth only needs to update on band changes.
const VIEWPORT_THRESHOLDS = [420, 600, 768, 960, 1264, 1904];
export const viewportBand = (width: number) => VIEWPORT_THRESHOLDS.reduce((n, t) => n + (width >= t ? 1 : 0), 0);
