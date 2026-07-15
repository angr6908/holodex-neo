import { readJSON, writeJSON } from "@/lib/browser";
import { CACHE_TTL_MS, VIEWER_DISPLAY_TTL_MS } from "@/lib/consts";

// Shared client for per-stream concurrent-viewer counts (YouTube / Twitch variants in
// youtube-viewers.ts and twitch-viewers.ts). Keeps a localStorage-backed TTL cache with
// inflight dedup; a value < 0 means "offline".

const OFFLINE = -1;

export function createViewerCountClient({
  storageKey,
  endpoint,
  bodyKey,
  label,
  isValidKey,
  normalizeKey = (k) => k,
}: {
  storageKey: string;
  endpoint: string;
  bodyKey: string;
  label: string;
  isValidKey: (v: unknown) => v is string;
  normalizeKey?: (k: string) => string;
}) {
  const cache = new Map<string, { ts: number; value: number }>(
    Object.entries(readJSON<Record<string, { ts: number; value: number }>>(storageKey, {}))
      .filter(([, e]) => e && Number.isFinite(e.ts) && Number.isFinite(e.value))
      .map(([k, e]) => [normalizeKey(k), { ts: e.ts, value: e.value }]),
  );
  const inflight = new Map<string, Promise<Record<string, number>>>();
  const listeners = new Set<(counts: Record<string, number>) => void>();

  const persist = () => {
    const now = Date.now();
    writeJSON(
      storageKey,
      Object.fromEntries([...cache].filter(([, e]) => now - e.ts <= VIEWER_DISPLAY_TTL_MS)),
    );
  };

  // Fresh within the 60s TTL — decides whether the network still needs hitting; never mutates,
  // so a stale value survives as the last-known one for display.
  const getFresh = (k: string) => {
    const c = cache.get(k);
    return c && Date.now() - c.ts <= CACHE_TTL_MS ? c.value : null;
  };

  // Last value we saw, past the 60s TTL but within the display window. Lets the badge paint
  // immediately from cache instead of blanking and popping in on every load.
  const getLastKnown = (k: string) => {
    const c = cache.get(k);
    return c && Date.now() - c.ts <= VIEWER_DISPLAY_TTL_MS ? c.value : null;
  };

  const setCached = (k: string, value: number) =>
    cache.set(k, { ts: Date.now(), value: Number.isFinite(value) ? value : OFFLINE });

  const uniqKeys = (keys: string[]) => [
    ...new Set((keys || []).filter(isValidKey).map(normalizeKey)),
  ];

  const readCached = (keys: string[]) => {
    const out: Record<string, number> = {};
    for (const k of uniqKeys(keys)) {
      const c = getFresh(k);
      if (c !== null) out[k] = c;
    }
    return out;
  };

  // Last-known count for immediate first-paint display. Offline (< 0) is excluded so a stale
  // "offline" never suppresses a stream that is live again.
  const readLastKnown = (keys: string[]) => {
    const out: Record<string, number> = {};
    for (const k of uniqKeys(keys)) {
      const c = getLastKnown(k);
      if (c !== null && c >= 0) out[k] = c;
    }
    return out;
  };

  async function requestCounts(keys: string[]): Promise<Record<string, number>> {
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [bodyKey]: keys }),
    });
    if (!r.ok) throw new Error(`${label} CCV request failed: ${r.status}`);
    const map = await r.json();
    return keys.reduce(
      (acc, k) => {
        const e = map?.[k];
        const n = Number(e?.live_viewers);
        acc[k] = e?.isLive && Number.isFinite(n) ? n : OFFLINE;
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  async function fetchCounts(keys: string[]) {
    const uniq = uniqKeys(keys);
    if (!uniq.length) return {} as Record<string, number>;
    const cached = readCached(uniq);
    const missing = uniq.filter((k) => cached[k] === undefined);
    if (!missing.length) return cached;
    const key = missing.join(",");
    let req = inflight.get(key);
    if (!req) {
      const startedAt = Date.now();
      req = requestCounts(missing)
        .then((counts) => {
          const committed: Record<string, number> = {};
          Object.entries(counts).forEach(([k, v]) => {
            // A live-list response may have primed this key while this request was in flight.
            // Never let the older request overwrite that newer observation.
            const current = cache.get(k);
            if (!current || current.ts <= startedAt) {
              setCached(k, v);
              committed[k] = v;
            } else {
              committed[k] = current.value;
            }
          });
          persist();
          listeners.forEach((listener) => {
            listener(committed);
          });
          return committed;
        })
        .finally(() => inflight.delete(key));
      inflight.set(key, req);
    }
    try {
      return { ...cached, ...(await req) };
    } catch (e) {
      console.error(`Failed to resolve ${label} viewer counts`, e);
      return cached;
    }
  }

  // Accept counts already obtained as part of another response (for example the live-list
  // proxy). This keeps every mounted consumer aligned without another platform request.
  const primeCounts = (counts: Record<string, number>) => {
    const valid = Object.fromEntries(
      Object.entries(counts).filter(([k, v]) => isValidKey(k) && Number.isFinite(v) && v >= 0),
    );
    if (!Object.keys(valid).length) return;
    Object.entries(valid).forEach(([k, v]) => {
      setCached(normalizeKey(k), v);
    });
    persist();
    listeners.forEach((listener) => {
      listener(valid);
    });
  };

  const subscribe = (listener: (counts: Record<string, number>) => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  return { readLastKnown, fetchCounts, primeCounts, subscribe };
}
