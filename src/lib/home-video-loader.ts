import { api } from "@/lib/api";
import { HOME_TABS as Tabs } from "@/lib/cookie-codec";
import { dayjs } from "@/lib/time";
import { dedupeVideos, extractItems, sortVideosForTab } from "@/lib/video-format";
const API_MAX_LIMIT = 100;

type MultiOrgCacheEntry = {
  page1: Promise<any[]>;
  getCurrentItems: () => any[];
  fetchMore: () => Promise<void>;
  isExhausted: () => boolean;
};

const multiOrgDataCache = new Map<string, MultiOrgCacheEntry>();

export function sortPayloadForHomeTab(payload: any, tab: number) {
  if (tab !== Tabs.ARCHIVE) return payload;
  if (Array.isArray(payload)) return sortVideosForTab(payload, true);
  if (payload?.items && Array.isArray(payload.items))
    return { ...payload, items: sortVideosForTab(payload.items, true) };
  return payload;
}

export function buildHomeTabQuery({
  tab,
  clipLangs,
  toDate,
}: {
  tab: number;
  clipLangs: string[];
  toDate?: string | null;
}): Record<string, any> {
  const inclusion = tab === Tabs.ARCHIVE ? "mentions,clips" : "mentions";
  return {
    status: tab === Tabs.ARCHIVE ? "past,missing" : "past",
    type: tab === Tabs.ARCHIVE ? "stream" : "clip",
    include: inclusion,
    lang: clipLangs.join(","),
    paginated: false,
    ...(toDate && { to: dayjs(toDate).add(1, "day").toDate().toISOString() }),
    max_upcoming_hours: 1,
  };
}

export function clearHomeMultiOrgVideoCache() {
  multiOrgDataCache.clear();
}

export function hasHomeMultiOrgVideoCache(cacheKey: string) {
  return multiOrgDataCache.has(cacheKey);
}

export function getHomeMultiOrgVideoCache(cacheKey: string) {
  return multiOrgDataCache.get(cacheKey);
}

export function ensureHomeMultiOrgVideoFetch(
  cacheKey: string,
  query: Record<string, any>,
  orgTargets: string[],
  tab: number = Tabs.ARCHIVE,
) {
  if (multiOrgDataCache.has(cacheKey)) return;
  const baseQuery = { ...query, paginated: false };
  const isArchive = tab === Tabs.ARCHIVE;

  const allOrgItems: any[][] = orgTargets.map(() => []);
  const orgOffsets: number[] = orgTargets.map(() => 0);
  const orgExhausted: boolean[] = orgTargets.map(() => false);
  let inflightFetch: Promise<void> | null = null;
  let currentItems: any[] = [];

  const mergeAll = () => {
    currentItems = sortVideosForTab(dedupeVideos(allOrgItems.flat()), isArchive);
  };

  const orgPage1Promises = orgTargets.map((org, i) =>
    api
      .videos({ ...baseQuery, org, limit: API_MAX_LIMIT, offset: 0 })
      .then((res: any) => {
        allOrgItems[i] = extractItems(res.data);
        orgOffsets[i] = API_MAX_LIMIT;
        if (allOrgItems[i].length < API_MAX_LIMIT) orgExhausted[i] = true;
        return allOrgItems[i];
      })
      .catch(() => {
        orgExhausted[i] = true;
        return (allOrgItems[i] = [] as any[]);
      }),
  );

  const page1 = Promise.all(orgPage1Promises).then(() => {
    mergeAll();
    return currentItems;
  });

  const fetchMore = (): Promise<void> => {
    if (inflightFetch) return inflightFetch;
    if (orgExhausted.every(Boolean)) return Promise.resolve();
    inflightFetch = Promise.all(
      orgTargets.map(async (org, i) => {
        if (orgExhausted[i]) return;
        try {
          const res: any = await api.videos({
            ...baseQuery,
            org,
            limit: API_MAX_LIMIT,
            offset: orgOffsets[i],
          });
          const items = extractItems(res.data);
          allOrgItems[i] = [...allOrgItems[i], ...items];
          orgOffsets[i] += API_MAX_LIMIT;
          if (items.length < API_MAX_LIMIT) orgExhausted[i] = true;
        } catch {
          orgExhausted[i] = true;
        }
      }),
    ).then(() => {
      mergeAll();
      inflightFetch = null;
    });
    return inflightFetch;
  };

  multiOrgDataCache.set(cacheKey, {
    page1,
    getCurrentItems: () => currentItems,
    fetchMore,
    isExhausted: () => orgExhausted.every(Boolean),
  });
}
