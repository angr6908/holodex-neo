export const APP_BOOT_COOKIE = "holodex-neo-app";
export const HOME_STATE_COOKIE = "holodex-neo-home";
export const HOME_STATE_STORAGE_KEY = "holodex-home-state";

export const HOME_TABS = Object.freeze({ LIVE_UPCOMING: 0, ARCHIVE: 1, CLIPS: 2 });

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

let savedHomePageState: { tab: number; isFavPage: boolean; viewMode: "streams" | "channels" } | null = null;

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

export const decodeAppBootCookie = (v?: string | null) => decodeCookieJson<AppBootState>(v);
export const decodeHomeStateCookie = (v?: string | null) => decodeCookieJson<HomeUiState>(v);
export const getSavedHomePageState = () => savedHomePageState;
export const clearSavedHomePageState = () => { savedHomePageState = null; };

export function primeHomePageState(next: HomeUiState) {
  savedHomePageState = {
    tab: next.tab ?? 0,
    isFavPage: next.isFavPage ?? false,
    viewMode: next.viewMode ?? "streams",
  };
}
