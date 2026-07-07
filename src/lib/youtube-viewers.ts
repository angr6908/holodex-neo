import { CACHE_TTL_MS, VIEWER_DISPLAY_TTL_MS } from "@/lib/consts";
import { readJSON, writeJSON } from "@/lib/browser";

// Client-side YouTube concurrent-viewer counts for the watch-page live badge, fetched from
// YouTube's own updated_metadata endpoint via /youtube-live-viewers. (Grid/home CCV is
// injected into the list server-side; this is only the single-video badge path.) Holodex
// CCV is never used.

const STORAGE_KEY = "holodex-youtube-viewer-counts-v1";
const YT_OFFLINE = -1;

const isYtId = (v: unknown): v is string => typeof v === "string" && /^[\w-]{11}$/.test(v);

const cache = new Map<string, { ts: number; value: number }>(
  Object.entries(readJSON<Record<string, { ts: number; value: number }>>(STORAGE_KEY, {}))
    .filter(([, e]) => e && Number.isFinite(e.ts) && Number.isFinite(e.value))
    .map(([id, e]) => [id, { ts: e.ts, value: e.value }]),
);
const inflight = new Map<string, Promise<Record<string, number>>>();

const persist = () => {
  const now = Date.now();
  writeJSON(STORAGE_KEY, Object.fromEntries([...cache].filter(([, e]) => now - e.ts <= VIEWER_DISPLAY_TTL_MS)));
};

// Fresh within the 60s TTL — used only to decide whether the network still needs hitting.
// Never mutates the cache, so a stale value survives as the last-known one for display.
function getFresh(id: string) {
  const c = cache.get(id);
  return c && Date.now() - c.ts <= CACHE_TTL_MS ? c.value : null;
}

// Last value we saw, past the 60s TTL but within the display window. Lets the badge paint
// immediately from cache instead of blanking and popping in on every load.
function getLastKnown(id: string) {
  const c = cache.get(id);
  return c && Date.now() - c.ts <= VIEWER_DISPLAY_TTL_MS ? c.value : null;
}

const setCached = (id: string, value: number) =>
  cache.set(id, { ts: Date.now(), value: Number.isFinite(value) ? value : YT_OFFLINE });

function readCachedYoutubeViewerCounts(ids: string[]) {
  const out: Record<string, number> = {};
  for (const id of new Set(ids || [])) {
    const c = getFresh(id);
    if (c !== null) out[id] = c;
  }
  return out;
}

// Last-known count for immediate first-paint display. Offline (< 0) is excluded so a stale
// "offline" never suppresses a stream that is live again.
export function readLastKnownYoutubeViewerCounts(ids: string[]) {
  const out: Record<string, number> = {};
  for (const id of new Set(ids || [])) {
    const c = getLastKnown(id);
    if (c !== null && c >= 0) out[id] = c;
  }
  return out;
}

async function requestCounts(ids: string[]): Promise<Record<string, number>> {
  const r = await fetch("/youtube-live-viewers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoIds: ids }),
  });
  if (!r.ok) throw new Error(`YouTube CCV request failed: ${r.status}`);
  const map = await r.json();
  return ids.reduce((acc, id) => {
    const e = map?.[id];
    const n = Number(e?.live_viewers);
    acc[id] = e?.isLive && Number.isFinite(n) ? n : YT_OFFLINE;
    return acc;
  }, {} as Record<string, number>);
}

export async function fetchYoutubeViewerCounts(ids: string[]) {
  const uniq = [...new Set((ids || []).filter(isYtId))];
  if (!uniq.length) return {} as Record<string, number>;
  const cached = readCachedYoutubeViewerCounts(uniq);
  const missing = uniq.filter((id) => cached[id] === undefined);
  if (!missing.length) return cached;
  const key = missing.join(",");
  let req = inflight.get(key);
  if (!req) {
    req = requestCounts(missing).then((counts) => {
      Object.entries(counts).forEach(([id, v]) => setCached(id, v));
      persist();
      return counts;
    }).finally(() => inflight.delete(key));
    inflight.set(key, req);
  }
  try { return { ...cached, ...(await req) }; }
  catch (e) { console.error("Failed to resolve YouTube viewer counts", e); return cached; }
}
