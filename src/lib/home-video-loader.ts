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

export function ensureHomeMultiOrgVideoFetch(key: string, query: Record<string, any>, targets: string[], tab: number = Tabs.ARCHIVE) {
  if (dataCache.has(key)) return;
  const base = { ...query, paginated: false };
  const archive = tab === Tabs.ARCHIVE;

  const items: any[][] = targets.map(() => []);
  const offsets: number[] = targets.map(() => 0);
  const exhausted: boolean[] = targets.map(() => false);
  let inflight: Promise<void> | null = null;
  let current: any[] = [];

  const merge = () => { current = sortVideosForTab(dedupeVideos(items.flat()), archive); };

  const page1Promises = targets.map((org, i) =>
    api.videos({ ...base, org, limit: MAX, offset: 0 })
      .then((res: any) => {
        items[i] = extractItems(res.data);
        offsets[i] = MAX;
        if (items[i].length < MAX) exhausted[i] = true;
        return items[i];
      })
      .catch(() => { exhausted[i] = true; return (items[i] = []); })
  );

  const page1 = Promise.all(page1Promises).then(() => { merge(); return current; });

  const fetchMore = (): Promise<void> => {
    if (inflight) return inflight;
    if (exhausted.every(Boolean)) return Promise.resolve();
    inflight = Promise.all(targets.map(async (org, i) => {
      if (exhausted[i]) return;
      try {
        const res: any = await api.videos({ ...base, org, limit: MAX, offset: offsets[i] });
        const v = extractItems(res.data);
        items[i] = [...items[i], ...v];
        offsets[i] += MAX;
        if (v.length < MAX) exhausted[i] = true;
      } catch { exhausted[i] = true; }
    })).then(() => { merge(); inflight = null; });
    return inflight;
  };

  dataCache.set(key, {
    page1,
    getCurrentItems: () => current,
    fetchMore,
    isExhausted: () => exhausted.every(Boolean),
  });
}
