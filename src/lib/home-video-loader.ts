import { api } from "@/lib/api";
import { HOME_TABS as Tabs } from "@/lib/cookie-codec";
import { dayjs } from "@/lib/time";
import { dedupeVideos, extractItems, sortVideosForTab } from "@/lib/video-format";

const MAX = 100;

type CacheEntry = {
  page1: Promise<any[]>;
  getCurrentItems: () => any[];
  fetchMore: () => Promise<void>;
  isExhausted: () => boolean;
  refresh: () => Promise<void>;
};

const dataCache = new Map<string, CacheEntry>();

export function sortPayloadForHomeTab(payload: any, tab: number) {
  if (tab !== Tabs.ARCHIVE) return payload;
  if (Array.isArray(payload)) return sortVideosForTab(payload, true);
  if (Array.isArray(payload?.items)) return { ...payload, items: sortVideosForTab(payload.items, true) };
  return payload;
}

export const buildHomeTabQuery = ({ tab, clipLangs, toDate }: { tab: number; clipLangs: string[]; toDate?: string | null }) => ({
  status: tab === Tabs.ARCHIVE ? "past,missing" : "past",
  type: tab === Tabs.ARCHIVE ? "stream" : "clip",
  include: tab === Tabs.ARCHIVE ? "mentions,clips" : "mentions",
  lang: clipLangs.join(","),
  paginated: false,
  ...(toDate && { to: dayjs(toDate).add(1, "day").toDate().toISOString() }),
  max_upcoming_hours: 1,
});

export const clearHomeMultiOrgVideoCache = () => dataCache.clear();
export const hasHomeMultiOrgVideoCache = (k: string) => dataCache.has(k);
export const getHomeMultiOrgVideoCache = (k: string) => dataCache.get(k);

type PageFetch = (offset: number, limit: number) => Promise<any[]>;

function createCacheEntry(sources: PageFetch[], archive: boolean): CacheEntry {
  const items: any[][] = sources.map(() => []);
  const offsets: number[] = sources.map(() => 0);
  const exhausted: boolean[] = sources.map(() => false);
  let inflight: Promise<void> | null = null;
  let current: any[] = [];

  const merge = () => { current = sortVideosForTab(dedupeVideos(items.flat()), archive); };

  const page1Promises = sources.map((fetchPage, i) =>
    fetchPage(0, MAX)
      .then((v) => {
        items[i] = v;
        offsets[i] = MAX;
        if (v.length < MAX) exhausted[i] = true;
        return v;
      })
      .catch(() => { exhausted[i] = true; return (items[i] = []); })
  );

  const page1 = Promise.all(page1Promises).then(() => { merge(); return current; });

  const fetchMore = (): Promise<void> => {
    if (inflight) return inflight;
    if (exhausted.every(Boolean)) return Promise.resolve();
    inflight = Promise.all(sources.map(async (fetchPage, i) => {
      if (exhausted[i]) return;
      try {
        const v = await fetchPage(offsets[i], MAX);
        items[i] = [...items[i], ...v];
        offsets[i] += MAX;
        if (v.length < MAX) exhausted[i] = true;
      } catch { exhausted[i] = true; }
    })).then(() => { merge(); inflight = null; });
    return inflight;
  };

  let refreshing: Promise<void> | null = null;
  const refresh = (): Promise<void> => {
    if (refreshing) return refreshing;
    refreshing = page1
      .then(() => Promise.all(sources.map(async (fetchPage, i) => {
        const depth = Math.max(offsets[i], MAX);
        const fresh: any[] = [];
        let offset = 0;
        let done = false;
        while (offset < depth && !done) {
          try {
            const v = await fetchPage(offset, MAX);
            fresh.push(...v);
            offset += MAX;
            if (v.length < MAX) done = true;
          } catch { done = true; break; }
        }
        if (offset === 0) return;
        items[i] = fresh;
        offsets[i] = offset;
        exhausted[i] = done;
      })))
      .then(() => { merge(); })
      .finally(() => { refreshing = null; });
    return refreshing;
  };

  return {
    page1,
    getCurrentItems: () => current,
    fetchMore,
    isExhausted: () => exhausted.every(Boolean),
    refresh,
  };
}

export function ensureHomeMultiOrgVideoFetch(key: string, query: Record<string, any>, targets: string[], tab: number = Tabs.ARCHIVE) {
  if (dataCache.has(key)) return;
  const base = { ...query, paginated: false };
  const sources: PageFetch[] = targets.map((org) =>
    (offset, limit) => api.videos({ ...base, org, limit, offset }).then((res: any) => extractItems(res.data)));
  dataCache.set(key, createCacheEntry(sources, tab === Tabs.ARCHIVE));
}

export function refreshHomeMultiOrgVideoFetch(key: string, query: Record<string, any>, targets: string[], tab: number = Tabs.ARCHIVE) {
  const entry = dataCache.get(key);
  if (!entry) return ensureHomeMultiOrgVideoFetch(key, query, targets, tab);
  return void entry.refresh();
}

export function ensureFavoritesVideoFetch(key: string, query: Record<string, any>, jwt: string, tab: number = Tabs.ARCHIVE) {
  if (dataCache.has(key) || !jwt) return;
  const base = { ...query, paginated: false };
  const sources: PageFetch[] = [
    (offset, limit) => api.favoritesVideos(jwt, { ...base, limit, offset }).then((res: any) => extractItems(res.data)),
  ];
  dataCache.set(key, createCacheEntry(sources, tab === Tabs.ARCHIVE));
}

export function refreshFavoritesVideoFetch(key: string, query: Record<string, any>, jwt: string, tab: number = Tabs.ARCHIVE) {
  const entry = dataCache.get(key);
  if (!entry) return ensureFavoritesVideoFetch(key, query, jwt, tab);
  return void entry.refresh();
}
