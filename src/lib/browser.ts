import { jwtDecode } from "jwt-decode";
import { companionExtensionId, MESSAGE_TYPES } from "@/lib/consts";
type HistoryDb = { get: (k: string) => Promise<unknown>; put: (k: string, v: unknown) => Promise<boolean>; clear: () => Promise<boolean> };
type WatchControlsState = { showTL: boolean; showLiveChat: boolean; theaterMode: boolean };

const WATCH_KEY = "holodex-v2-watch";
export const OPEN_USER_MENU_EVENT = "holodex-open-user-menu";
const USER_MENU_KEY = "holodex-open-user-menu";

declare const chrome: any;

export const defaultWatchControlsState: WatchControlsState = { showTL: false, showLiveChat: true, theaterMode: false };

export async function downloadCsv(data: any[], filename: string) {
  const { json2csv } = await import("json-2-csv");
  const a = document.createElement("a");
  a.href = `data:attachment/csv,${encodeURIComponent(await json2csv(data))}`;
  a.target = "_blank";
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const p = JSON.parse(raw);
    if (p && fallback && typeof p === "object" && typeof fallback === "object" && !Array.isArray(p) && !Array.isArray(fallback)) {
      return { ...(fallback as any), ...p };
    }
    return p;
  } catch { return fallback; }
}

export function writeJSON(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function openUserMenu() {
  if (typeof window === "undefined") return;
  try { sessionStorage.setItem(USER_MENU_KEY, "1"); } catch {}
  window.dispatchEvent(new CustomEvent(OPEN_USER_MENU_EVENT));
}

export function consumeOpenUserMenuRequest() {
  if (typeof window === "undefined") return false;
  try {
    if (sessionStorage.getItem(USER_MENU_KEY) !== "1") return false;
    sessionStorage.removeItem(USER_MENU_KEY);
    return true;
  } catch { return false; }
}

function sendToExt(payload: Record<string, unknown>) {
  try { (window as any).chrome && chrome.runtime?.sendMessage && chrome.runtime.sendMessage(companionExtensionId, payload); } catch {}
}

export const sendTokenToExtension = (token: string | null) => sendToExt({ message: MESSAGE_TYPES.TOKEN, token });
export const sendFavoritesToExtension = (favorites: any[]) => sendToExt({ message: MESSAGE_TYPES.FAVORITES, favorites });

export const setLocaleCookie = (lang: string) => {
  try { document.cookie = `locale=${encodeURIComponent(lang)}; Path=/; Max-Age=31536000; SameSite=Lax`; } catch {}
};

export const setCookieJWT = (jwt: string | null) => {
  try {
    const { hostname } = window.location;
    const domain = (hostname === "localhost" || hostname === "127.0.0.1") ? "" : ";domain=.holodex.net";
    if (jwt) {
      const { exp } = jwtDecode<{ exp: number }>(jwt);
      document.cookie = `HOLODEX_JWT=${jwt};expires=${new Date(exp * 1000).toUTCString()}${domain};path=/`;
    } else {
      document.cookie = `HOLODEX_JWT=;max-age=-1${domain};path=/`;
    }
  } catch {}
};

let dbPromise: Promise<HistoryDb | null> | null = null;
const getDb = () => {
  if (typeof window === "undefined" || !window.indexedDB) return Promise.resolve(null);
  dbPromise ??= import("kv-idb").then((m: any) => (m.default || m)("watch-history") as Promise<HistoryDb>).catch(() => null);
  return dbPromise;
};

export async function hasWatched(id: string) {
  const db = await getDb();
  if (!db || !id) return false;
  try { return !!(await db.get(id)); } catch { return false; }
}

export async function addWatchedVideo(video: { id?: string | null }) {
  const db = await getDb();
  if (db && video?.id) db.put(video.id, 1).catch(() => {});
}

export const readWatchControlsState = (): WatchControlsState => readJSON(WATCH_KEY, defaultWatchControlsState);
export const writeWatchControlsState = (s: WatchControlsState) => writeJSON(WATCH_KEY, s);
