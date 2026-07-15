import { api } from "@/lib/api";
import { HOME_TABS as Tabs } from "@/lib/cookie-codec";
import { dayjs } from "@/lib/time";
import { dedupeVideos, extractItems, sortVideosForTab } from "@/lib/video-format";

const MAX = 100;

type CacheEntry = {
  page1: Promise<any[]>;
  getCurrentItems: () => any[];
  fetchMore: () => Promise<void>;
  isReady: () => boolean;
  isExhausted: () => boolean;
  isStale: (maxAgeMs: number) => boolean;
  refresh: () => Promise<void>;
};

const dataCache = new Map<string, CacheEntry>();

export const buildHomeTabQuery = ({
  tab,
  clipLangs,
  toDate,
}: {
  tab: number;
  clipLangs: string[];
  toDate?: string | null;
}) => ({
  status: tab === Tabs.ARCHIVE ? "past,missing" : "past",
  type: tab === Tabs.ARCHIVE ? "stream" : "clip",
  include: tab === Tabs.ARCHIVE ? "mentions,clips" : "mentions",
  lang: clipLangs.join(","),
  sort: "available_at",
  order: "desc",
  ...(toDate && { to: dayjs(toDate).add(1, "day").toDate().toISOString() }),
  max_upcoming_hours: 1,
});

export const clearHomeMultiOrgVideoCache = () => dataCache.clear();
export const hasHomeMultiOrgVideoCache = (k: string) => dataCache.has(k);
export const getHomeMultiOrgVideoCache = (k: string) => dataCache.get(k);

type PageResult = { items: any[]; nextPage?: string };
type PageFetch = (cursor: string | undefined, limit: number) => Promise<PageResult>;

function createCacheEntry(sources: PageFetch[], archive: boolean): CacheEntry {
  const items: any[][] = sources.map(() => []);
  const cursors: (string | undefined)[] = sources.map(() => undefined);
  const exhausted: boolean[] = sources.map(() => false);
  let inflight: Promise<void> | null = null;
  let current: any[] = [];
  let ready = false;
  let lastLoaded = Date.now();

  const merge = () => {
    current = sortVideosForTab(dedupeVideos(items.flat()), archive);
    lastLoaded = Date.now();
  };

  const page1Promises = sources.map((fetchPage, i) =>
    fetchPage(undefined, MAX)
      .then(({ items: v, nextPage }) => {
        items[i] = v;
        cursors[i] = nextPage;
        if (!nextPage || v.length < MAX) exhausted[i] = true;
        return v;
      })
      .catch(() => {
        exhausted[i] = true;
        items[i] = [];
        return items[i];
      }),
  );

  const page1 = Promise.all(page1Promises).then(() => {
    merge();
    ready = true;
    return current;
  });

  const fetchMore = (): Promise<void> => {
    if (inflight) return inflight;
    if (exhausted.every(Boolean)) return Promise.resolve();
    inflight = Promise.all(
      sources.map(async (fetchPage, i) => {
        if (exhausted[i]) return;
        try {
          const { items: v, nextPage } = await fetchPage(cursors[i], MAX);
          items[i] = [...items[i], ...v];
          cursors[i] = nextPage;
          if (!nextPage || v.length < MAX) exhausted[i] = true;
        } catch {
          exhausted[i] = true;
        }
      }),
    ).then(() => {
      merge();
      inflight = null;
    });
    return inflight;
  };

  let refreshing: Promise<void> | null = null;
  const refresh = (): Promise<void> => {
    if (refreshing) return refreshing;
    refreshing = page1
      .then(() =>
        Promise.all(
          sources.map(async (fetchPage, i) => {
            const depth = Math.max(items[i].length, MAX);
            const fresh: any[] = [];
            let cursor: string | undefined;
            let done = false;
            while (fresh.length < depth && !done) {
              try {
                const { items: v, nextPage } = await fetchPage(cursor, MAX);
                fresh.push(...v);
                cursor = nextPage;
                if (!nextPage || v.length < MAX) done = true;
              } catch {
                done = true;
                break;
              }
            }
            if (fresh.length === 0) return;
            items[i] = fresh;
            cursors[i] = cursor;
            exhausted[i] = done;
          }),
        ),
      )
      .then(() => {
        merge();
      })
      .finally(() => {
        refreshing = null;
      });
    return refreshing;
  };

  return {
    page1,
    getCurrentItems: () => current,
    fetchMore,
    isReady: () => ready,
    isExhausted: () => exhausted.every(Boolean),
    isStale: (maxAgeMs: number) => Date.now() - lastLoaded > maxAgeMs,
    refresh,
  };
}

const fetchVideoPage =
  (query: Record<string, any>): PageFetch =>
  (cursor, limit) =>
    api
      .videosV3({ ...query, limit, ...(cursor ? { nextPage: cursor } : {}) })
      .then((res: any) => ({ items: extractItems(res.data), nextPage: res.data?.nextPage }));

export function ensureHomeMultiOrgVideoFetch(
  key: string,
  query: Record<string, any>,
  targets: string[],
  tab: number = Tabs.ARCHIVE,
) {
  if (dataCache.has(key)) return;
  const sources: PageFetch[] = targets.map((org) => fetchVideoPage({ ...query, org }));
  dataCache.set(key, createCacheEntry(sources, tab === Tabs.ARCHIVE));
}

export function ensureFavoritesVideoFetch(
  key: string,
  query: Record<string, any>,
  jwt: string,
  tab: number = Tabs.ARCHIVE,
) {
  if (dataCache.has(key) || !jwt) return;
  const source: PageFetch = (cursor, limit) => {
    const offset = cursor ? Number(cursor) : 0;
    return api
      .favoritesVideos(jwt, { ...query, paginated: false, limit, offset })
      .then((res: any) => {
        const items = extractItems(res.data);
        return { items, nextPage: items.length < limit ? undefined : String(offset + limit) };
      });
  };
  dataCache.set(key, createCacheEntry([source], tab === Tabs.ARCHIVE));
}
