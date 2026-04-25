export const APP_BOOT_COOKIE = "holodex-neo-app";

export type AppBootState = {
  isMobile?: boolean;
  windowWidth?: number;
  currentOrg?: { name: string; short?: string; [key: string]: any };
  selectedHomeOrgs?: string[];
  orgFavorites?: any[];
  currentGridSize?: number;
  settings?: {
    lang?: string;
    defaultOpen?: "home" | "favorites" | "multiview";
    homeViewMode?: "grid" | "list" | "denseList";
    scrollMode?: boolean;
    hideUpcoming?: boolean;
    darkMode?: boolean;
    followSystemTheme?: boolean;
  };
};

export function encodeBootCookie(value: AppBootState) {
  try {
    return encodeURIComponent(JSON.stringify(value));
  } catch {
    return "";
  }
}

export function decodeBootCookie(value?: string | null): AppBootState | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}
