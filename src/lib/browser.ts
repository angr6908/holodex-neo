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

// Synchronous in-memory mirror of the watched-id set, backed by localStorage so
// the watched-title style applies on the very first paint (no async flash from
// white → muted) and survives reloads.
const WATCHED_IDS_KEY = "holodex-watched-ids";
let watchedCache: Set<string> | null = null;
function getWatchedSet(): Set<string> {
  if (watchedCache) return watchedCache;
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage?.getItem(WATCHED_IDS_KEY);
    watchedCache = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  } catch { watchedCache = new Set<string>(); }
  return watchedCache;
}
function persistWatchedSet() {
  if (!watchedCache || typeof window === "undefined") return;
  try { window.localStorage?.setItem(WATCHED_IDS_KEY, JSON.stringify([...watchedCache])); } catch {}
}

export function hasWatchedSync(id?: string | null): boolean {
  return !!id && getWatchedSet().has(id);
}

export async function hasWatched(id: string) {
  if (!id) return false;
  if (getWatchedSet().has(id)) return true;
  const db = await getDb();
  if (!db) return false;
  try {
    const found = !!(await db.get(id));
    if (found) { getWatchedSet().add(id); persistWatchedSet(); }
    return found;
  } catch { return false; }
}

export async function addWatchedVideo(video: { id?: string | null }) {
  if (!video?.id) return;
  getWatchedSet().add(video.id);
  persistWatchedSet();
  const db = await getDb();
  if (db) db.put(video.id, 1).catch(() => {});
}

export const readWatchControlsState = (): WatchControlsState => readJSON(WATCH_KEY, defaultWatchControlsState);
export const writeWatchControlsState = (s: WatchControlsState) => writeJSON(WATCH_KEY, s);
