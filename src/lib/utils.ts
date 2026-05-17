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
