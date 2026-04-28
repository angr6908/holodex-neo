export const APP_BOOT_COOKIE = "holodex-neo-app";
export const HOME_STATE_COOKIE = "holodex-neo-home";

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

export type HomeUiState = {
  viewMode?: "streams" | "channels";
  isFavPage?: boolean;
  tab?: number;
  scrollY?: number;
};

export function encodeCookieJson(value: unknown) {
  try { return encodeURIComponent(JSON.stringify(value)); } catch { return ""; }
}

function decodeCookieJson<T>(value?: string | null): T | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value));
    return parsed !== null && typeof parsed === "object" ? parsed : null;
  } catch { return null; }
}

export function decodeAppBootCookie(value?: string | null) {
  return decodeCookieJson<AppBootState>(value);
}

export function decodeHomeStateCookie(value?: string | null) {
  return decodeCookieJson<HomeUiState>(value);
}
