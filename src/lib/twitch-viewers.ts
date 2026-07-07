import { CACHE_TTL_MS, TWITCH_VIDEO_URL_REGEX, VIEWER_DISPLAY_TTL_MS } from "@/lib/consts";
import { readJSON, writeJSON } from "@/lib/browser";

// Client-side Twitch concurrent-viewer counts for the watch-page live badge, fetched via
// /twitch-live-viewers (server -> Twitch GQL). Mirrors youtube-viewers.ts. (Grid/home CCV is
// injected into the list server-side; this is only the single-stream badge path.) Holodex
// CCV is never used.

const STORAGE_KEY = "holodex-twitch-viewer-counts-v1";
const TW_OFFLINE = -1;

const norm = (l: string) => l.trim().toLowerCase();
const isLogin = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

const cache = new Map<string, { ts: number; value: number }>(
  Object.entries(readJSON<Record<string, { ts: number; value: number }>>(STORAGE_KEY, {}))
    .filter(([, e]) => e && Number.isFinite(e.ts) && Number.isFinite(e.value))
    .map(([l, e]) => [norm(l), { ts: e.ts, value: e.value }]),
);
const inflight = new Map<string, Promise<Record<string, number>>>();

const persist = () => {
  const now = Date.now();
  writeJSON(STORAGE_KEY, Object.fromEntries([...cache].filter(([, e]) => now - e.ts <= VIEWER_DISPLAY_TTL_MS)));
};

// Fresh within the 60s TTL — decides whether the network still needs hitting; never mutates.
function getFresh(l: string) {
  const c = cache.get(norm(l));
  return c && Date.now() - c.ts <= CACHE_TTL_MS ? c.value : null;
}

// Last value we saw, within the display window — lets the badge paint immediately from cache.
function getLastKnown(l: string) {
  const c = cache.get(norm(l));
  return c && Date.now() - c.ts <= VIEWER_DISPLAY_TTL_MS ? c.value : null;
}

const setCached = (l: string, value: number) =>
  cache.set(norm(l), { ts: Date.now(), value: Number.isFinite(value) ? value : TW_OFFLINE });

function readCachedTwitchViewerCounts(logins: string[]) {
  const out: Record<string, number> = {};
  for (const l of new Set((logins || []).filter(isLogin).map(norm))) {
    const c = getFresh(l);
    if (c !== null) out[l] = c;
  }
  return out;
}

// The Twitch login for a video (link, channel, or a `twitch`-typed id), lowercased, else "".
export function twitchLoginOf(v: any): string {
  if (!v || typeof v !== "object") return "";
  const fromLink = v.link?.match?.(TWITCH_VIDEO_URL_REGEX)?.groups?.id;
  const l = fromLink || v.channel?.twitch || (v.type === "twitch" ? v.id : "");
  return isLogin(l) ? norm(l) : "";
}

// Last-known count for immediate first-paint display. Offline (< 0) is excluded so a stale
// "offline" never suppresses a stream that is live again.
export function readLastKnownTwitchViewerCounts(logins: string[]) {
  const out: Record<string, number> = {};
  for (const l of new Set((logins || []).filter(isLogin).map(norm))) {
    const c = getLastKnown(l);
    if (c !== null && c >= 0) out[l] = c;
  }
  return out;
}

async function requestCounts(logins: string[]): Promise<Record<string, number>> {
  const r = await fetch("/twitch-live-viewers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ logins }),
  });
  if (!r.ok) throw new Error(`Twitch CCV request failed: ${r.status}`);
  const map = await r.json();
  return logins.reduce((acc, l) => {
    const e = map?.[l];
    const n = Number(e?.live_viewers);
    acc[l] = e?.isLive && Number.isFinite(n) ? n : TW_OFFLINE;
    return acc;
  }, {} as Record<string, number>);
}

export async function fetchTwitchViewerCounts(logins: string[]) {
  const uniq = [...new Set((logins || []).filter(isLogin).map(norm))];
  if (!uniq.length) return {} as Record<string, number>;
  const cached = readCachedTwitchViewerCounts(uniq);
  const missing = uniq.filter((l) => cached[l] === undefined);
  if (!missing.length) return cached;
  const key = missing.join(",");
  let req = inflight.get(key);
  if (!req) {
    req = requestCounts(missing).then((counts) => {
      Object.entries(counts).forEach(([l, v]) => setCached(l, v));
      persist();
      return counts;
    }).finally(() => inflight.delete(key));
    inflight.set(key, req);
  }
  try { return { ...cached, ...(await req) }; }
  catch (e) { console.error("Failed to resolve Twitch viewer counts", e); return cached; }
}
