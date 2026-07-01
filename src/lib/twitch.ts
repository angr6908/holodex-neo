import { CACHE_TTL_MS, TWITCH_VIDEO_URL_REGEX } from "@/lib/consts";
import { readJSON, writeJSON } from "@/lib/browser";

const GQL_ENDPOINTS = ["/twitch-gql", "https://gql.twitch.tv/gql"] as const;
const CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";
const STORAGE_KEY = "holodex-twitch-viewer-counts-v1";

export const TWITCH_OFFLINE = -1;

const norm = (l: string) => l.trim().toLowerCase();

const cache = new Map<string, { ts: number; value: number }>(
  Object.entries(readJSON<Record<string, { ts: number; value: number }>>(STORAGE_KEY, {}))
    .filter(([, e]) => e && Number.isFinite(e.ts) && Number.isFinite(e.value))
    .map(([l, e]) => [norm(l), { ts: e.ts, value: e.value }])
);
const inflight = new Map<string, Promise<Record<string, number>>>();

const persist = () => {
  const now = Date.now();
  writeJSON(STORAGE_KEY, Object.fromEntries([...cache].filter(([, e]) => now - e.ts <= CACHE_TTL_MS)));
};

function getCached(login: string) {
  const n = norm(login);
  const c = cache.get(n);
  if (!c) return null;
  if (Date.now() - c.ts > CACHE_TTL_MS) { cache.delete(n); persist(); return null; }
  return c.value;
}

const setCached = (login: string, value: number) =>
  cache.set(norm(login), { ts: Date.now(), value: Number.isFinite(value) ? value : 0 });

async function requestCounts(logins: string[]) {
  const fields = logins.map((l, i) => `u${i}: user(login: ${JSON.stringify(l)}) { stream { viewersCount } }`).join("\n");
  const body = JSON.stringify({ query: `query HolodexTwitchLiveViewerCounts {\n${fields}\n}` });
  let lastErr: unknown = null;
  for (const ep of GQL_ENDPOINTS) {
    try {
      const r = await fetch(ep, { method: "POST", headers: { Accept: "application/json", "Client-Id": CLIENT_ID, "Content-Type": "application/json" }, body });
      if (!r.ok) { lastErr = new Error(`Twitch GQL request failed: ${r.status}`); continue; }
      const payload = await r.json();
      const data = Array.isArray(payload) ? payload[0]?.data : payload?.data;
      return logins.reduce((acc, l, i) => {
        const stream = data?.[`u${i}`]?.stream;
        const v = Number(stream?.viewersCount ?? 0);
        acc[l] = stream ? (Number.isFinite(v) ? v : 0) : TWITCH_OFFLINE;
        return acc;
      }, {} as Record<string, number>);
    } catch (e) { lastErr = e; }
  }
  throw lastErr ?? new Error("Unable to resolve Twitch viewer counts");
}

export function getTwitchLogin(v?: Record<string, any> | null) {
  if (!v || typeof v !== "object") return null;
  const fromLink = v.link?.match?.(TWITCH_VIDEO_URL_REGEX)?.groups?.id;
  const l = fromLink || v.channel?.twitch || (v.type === "twitch" ? v.id : null);
  return l && typeof l === "string" ? norm(l) : null;
}

export const getTwitchViewerCountFingerprint = (counts: Record<string, number>) =>
  Object.keys(counts).sort().map((l) => `${l}:${counts[l]}`).join(",");

export function readCachedTwitchViewerCounts(logins: string[]) {
  const out: Record<string, number> = {};
  for (const l of new Set((logins || []).map(norm))) {
    const c = getCached(l);
    if (c !== null) out[l] = c;
  }
  return out;
}

export const mergeTwitchViewerCountsIntoVideos = (videos: any[], counts: Record<string, number>) =>
  (videos || []).flatMap((v) => {
    const l = getTwitchLogin(v);
    if (!l) return [v];
    const c = counts[l];
    if (c === TWITCH_OFFLINE) return v.status === "live" ? [] : [v];
    return c === undefined || v.live_viewers === c ? [v] : [{ ...v, live_viewers: c }];
  });

export async function fetchTwitchViewerCounts(logins: string[]) {
  const norm_ = [...new Set((logins || []).filter((l): l is string => typeof l === "string" && l.trim().length > 0).map(norm))];
  if (!norm_.length) return {} as Record<string, number>;
  const cached = readCachedTwitchViewerCounts(norm_);
  const missing = norm_.filter((l) => cached[l] === undefined);
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

export async function enrichLiveVideosWithTwitchViewerCounts(videos: any[]) {
  const logins = (videos || []).filter((v) => v?.status === "live").map(getTwitchLogin).filter((l): l is string => !!l);
  if (!logins.length) return videos;
  return mergeTwitchViewerCountsIntoVideos(videos, await fetchTwitchViewerCounts(logins));
}
