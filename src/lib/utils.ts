import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getBreakpoint(width: number): "xs" | "sm" | "md" | "lg" | "xl" {
  if (width < 600) return "xs";
  if (width < 960) return "sm";
  if (width < 1264) return "md";
  if (width < 1904) return "lg";
  return "xl";
}

// Static class map so Tailwind sees the literal grid-cols-* names. Shared by the card/skeleton/channel
// grids, which must agree exactly or the loading skeleton shifts layout when real cards arrive.
export const GRID_COLUMN_CLASSES: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
  7: "grid-cols-7",
  8: "grid-cols-8",
  9: "grid-cols-9",
  10: "grid-cols-10",
  11: "grid-cols-11",
  12: "grid-cols-12",
};

// Layout-significant width thresholds used across the app (breakpoints + nav/list/multiview cutoffs).
// Resizes within a band don't change any derived layout, so windowWidth only needs to update on band changes.
const VIEWPORT_THRESHOLDS = [420, 600, 768, 960, 1264, 1904];
export const viewportBand = (width: number) =>
  VIEWPORT_THRESHOLDS.reduce((n, t) => n + (width >= t ? 1 : 0), 0);
