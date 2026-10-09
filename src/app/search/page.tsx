"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { GenericListLoader } from "@/components/video/GenericListLoader";
import { VideoCardList } from "@/components/video/VideoCardList";
import { api } from "@/lib/api";
import { ALL_VTUBERS_ORG } from "@/lib/consts";
import { Search } from "@/lib/icons";
import { useAppState } from "@/lib/store";
import { videoStartTimestamp } from "@/lib/video-format";
import {
  VIDEO_SEARCH_MAX_LIMIT,
  type VideoSearchPage,
  type VideoSearchQuery,
} from "@/lib/video-search";

const pageLength = 30;
const ORG_SOURCE_BATCH_SIZE = VIDEO_SEARCH_MAX_LIMIT;
// The v3 sort for each sort the search filters offer.
const SEARCH_SORTS: Record<string, string> = {
  newest: "latest",
  oldest: "oldest",
  longest: "longest",
};

type SearchFilterItem = { type: string; value: string; text: string };
type OrgSource = {
  chunks: Map<number, VideoSearchPage>;
  items: any[];
  exhausted: boolean;
  unavailable: boolean;
};

// The v3 search for the filters in the URL. Text matches titles only (the "title & desc" type
// is kept so existing search links still work), and channel filters match VTuber channels only.
function buildSearchQuery(items: SearchFilterItem[], sort: string, type: string): VideoSearchQuery {
  const titles: string[] = [];
  const q = {
    type: type === "all" ? ["stream", "clip"] : [type],
    vtuber: [] as string[],
    topic: [] as string[],
    org: [] as string[],
  };
  for (const item of items) {
    const text = String(item.text ?? "").trim();
    if (item.type === "title & desc" && text) titles.push(text);
    else if (item.type === "channel") q.vtuber.push(item.value);
    else if (item.type === "topic") q.topic.push(item.value);
    else if (item.type === "org") q.org.push(item.value);
  }
  return {
    q: titles.length ? { ...q, search: titles.join(" ") } : q,
    sort: SEARCH_SORTS[sort] ?? SEARCH_SORTS.newest,
  };
}

async function loadSearchQuery(query: string, sort: string, type: string) {
  const { csv2json } = await import("json-2-csv");
  return buildSearchQuery((await csv2json(query)) as SearchFilterItem[], sort, type);
}

function searchResultPage(payload: any): VideoSearchPage {
  return {
    items: Array.isArray(payload?.items) ? payload.items : [],
    total: typeof payload?.total === "number" ? payload.total : null,
  };
}

function routeSearchType(searchParams: Pick<URLSearchParams, "get">) {
  const channelType = searchParams.get("channelType");
  if (searchParams.get("vtuber") === "false" || channelType === "subber" || channelType === "clip")
    return "clip";
  if (channelType === "vtuber" || channelType === "stream") return "stream";
  return "all";
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchResults />
    </Suspense>
  );
}

function SearchResults() {
  const searchParams = useSearchParams();
  const app = useAppState();
  const t = useTranslations();
  const executedQuery = searchParams.get("q");
  const filterSort = searchParams.get("sort") || "newest";
  const filterType = routeSearchType(searchParams);
  const selectedMainOrgs = app.selectedHomeOrgs || [];
  const mainOrgFilterKey = app.searchUseMainOrgFilter ? JSON.stringify(selectedMainOrgs) : "";
  const searchCacheKey =
    executedQuery && executedQuery.length >= 5
      ? `search:v8:${filterType}:${filterSort}:${mainOrgFilterKey}:${executedQuery}`
      : "";

  useEffect(() => {
    document.title = executedQuery ? "Search Results - Holodex" : "Search - Holodex";
  }, [executedQuery]);

  const searchVideo = useMemo(() => {
    if (!executedQuery || executedQuery.length < 5) return null;
    const selectedOrgs = mainOrgFilterKey ? (JSON.parse(mainOrgFilterKey) as string[]) : [];
    const targetOrgs = selectedOrgs.length ? selectedOrgs : [ALL_VTUBERS_ORG];
    const orgSources = new Map<string, OrgSource>();
    const pendingOrgRequests = new Map<string, Promise<void>>();
    let initialPrefetchStarted = false;
    let queryPromise: ReturnType<typeof loadSearchQuery> | null = null;
    const getSearchQuery = () => {
      queryPromise ??= loadSearchQuery(executedQuery, filterSort, filterType);
      return queryPromise;
    };

    const load = async (offset: number, limit: number) => {
      const searchQuery = await getSearchQuery();
      if (!mainOrgFilterKey || targetOrgs.includes(ALL_VTUBERS_ORG)) {
        const page = await api.searchVideo(searchQuery, offset, limit);
        return {
          items: page.items,
          total: page.total,
          offset,
        };
      }

      const getOrgSource = (org: string) => {
        let source = orgSources.get(org);
        if (!source) {
          source = {
            chunks: new Map(),
            items: [],
            exhausted: false,
            unavailable: false,
          };
          orgSources.set(org, source);
        }
        return source;
      };

      const rebuildOrgSource = (source: OrgSource) => {
        const items: any[] = [];
        let expectedOffset = 0;
        let total: number | null = null;
        let exhausted = source.unavailable;
        const chunks = [...source.chunks.entries()].sort(([a], [b]) => a - b);
        for (const [offset, page] of chunks) {
          if (offset !== expectedOffset) break;
          items.push(...page.items);
          if (page.total !== null) total = page.total;
          expectedOffset += page.items.length;
          if (
            !exhausted &&
            (page.items.length === 0 ||
              (total !== null ? items.length >= total : page.items.length < ORG_SOURCE_BATCH_SIZE))
          ) {
            exhausted = true;
            break;
          }
        }
        source.items = items;
        source.exhausted = exhausted;
      };

      const applyOrgResults = (response: any, ignoreFailures: boolean) => {
        for (const result of response.data?.results || []) {
          const org = String(result.org || "");
          if (!org) continue;
          const source = getOrgSource(org);
          if (result.failed) {
            if (!ignoreFailures) {
              source.unavailable = true;
              rebuildOrgSource(source);
            }
            continue;
          }
          const { items, total } = searchResultPage(result.data);
          const offset = Math.max(0, Number(result.offset) || 0);
          source.chunks.set(offset, { items, total });
          rebuildOrgSource(source);
        }
      };

      const startOrgBatch = (
        requests: Array<{ org: string; offset: number }>,
        ignoreFailures: boolean,
      ) => {
        const keys = requests.map(({ org, offset }) => `${org}:${offset}`);
        let tracked: Promise<void>;
        tracked = api
          .searchVideoByOrgs(searchQuery, requests, ORG_SOURCE_BATCH_SIZE)
          .then((response) => applyOrgResults(response, ignoreFailures))
          .finally(() => {
            for (const key of keys) {
              if (pendingOrgRequests.get(key) === tracked) pendingOrgRequests.delete(key);
            }
          });
        for (const key of keys) pendingOrgRequests.set(key, tracked);
        return tracked;
      };

      const prefetchNextOrgBatch = () => {
        const requests = targetOrgs.flatMap((org) => {
          const source = getOrgSource(org);
          if (source.exhausted) return [];
          const offset = source.items.length;
          if (pendingOrgRequests.has(`${org}:${offset}`)) return [];
          return [{ org, offset }];
        });
        if (!requests.length) return;
        void startOrgBatch(requests, true).catch(() => {});
      };

      const ensureOrgResults = async (required: number) => {
        while (true) {
          const requests = targetOrgs.flatMap((org) => {
            const source = getOrgSource(org);
            return source.items.length >= required || source.exhausted
              ? []
              : [{ org, offset: source.items.length }];
          });
          if (!requests.length) return;
          const waiters: Promise<void>[] = [];
          const newRequests = requests.filter((request) => {
            const pending = pendingOrgRequests.get(`${request.org}:${request.offset}`);
            if (pending) {
              waiters.push(pending);
              return false;
            }
            return true;
          });
          if (newRequests.length) {
            const foregroundBatch = startOrgBatch(newRequests, false);
            waiters.push(foregroundBatch);
            if (!initialPrefetchStarted && newRequests.some((request) => request.offset === 0)) {
              initialPrefetchStarted = true;
              const aheadRequests = targetOrgs.flatMap((org) => {
                const source = getOrgSource(org);
                if (source.exhausted || pendingOrgRequests.has(`${org}:${ORG_SOURCE_BATCH_SIZE}`)) {
                  return [];
                }
                return [{ org, offset: ORG_SOURCE_BATCH_SIZE }];
              });
              if (aheadRequests.length) void startOrgBatch(aheadRequests, true).catch(() => {});
            }
          }
          await Promise.all(waiters);
        }
      };

      const mergeResults = () => {
        const uniqueItems: any[] = [];
        const seen = new Set<string>();
        for (const item of targetOrgs.flatMap((org) => getOrgSource(org).items)) {
          if (!item?.id || seen.has(item.id)) continue;
          seen.add(item.id);
          uniqueItems.push(item);
        }
        return uniqueItems
          .map((item, index) => ({
            item,
            index,
            id: String(item.id),
            startTime: videoStartTimestamp(item),
          }))
          .sort((a, b) => {
            if (filterSort === "longest") {
              return (
                (Number(b.item.duration) || 0) - (Number(a.item.duration) || 0) ||
                b.id.localeCompare(a.id) ||
                a.index - b.index
              );
            }
            if (filterSort === "oldest") {
              return a.startTime - b.startTime || a.id.localeCompare(b.id) || a.index - b.index;
            }
            return b.startTime - a.startTime || b.id.localeCompare(a.id) || a.index - b.index;
          })
          .map(({ item }) => item);
      };

      const pageEnd = offset + limit;
      let requiredPerOrg = pageEnd;
      let merged: any[] = [];
      let exhausted = false;
      do {
        await ensureOrgResults(requiredPerOrg);
        merged = mergeResults();
        exhausted = targetOrgs.every((org) => getOrgSource(org).exhausted);
        requiredPerOrg += ORG_SOURCE_BATCH_SIZE;
      } while (merged.length < pageEnd && !exhausted);

      prefetchNextOrgBatch();
      return {
        items: merged.slice(offset, offset + limit),
        total: exhausted ? merged.length : Math.max(merged.length + limit, offset + limit * 2),
        offset,
      };
    };
    if (mainOrgFilterKey && !targetOrgs.includes(ALL_VTUBERS_ORG)) {
      void load(0, pageLength).catch(() => {});
    }
    return load;
  }, [executedQuery, filterSort, filterType, mainOrgFilterKey]);

  return (
    <section className="mx-auto min-h-screen w-full max-w-[1600px] px-5 pb-10 pt-[calc(var(--nav-total-height,120px)+0.75rem)] sm:px-8 lg:px-10 xl:px-12">
      {searchVideo === null ? (
        <Empty className="relative z-0 flex-none gap-2 rounded-none px-0 py-16 md:px-0 md:py-16">
          <EmptyMedia className="mb-0 text-muted-foreground">
            <Search className="h-8 w-8" />
          </EmptyMedia>
          <EmptyDescription className="leading-normal text-muted-foreground">
            {t("views.search.useSearchBar")}
          </EmptyDescription>
        </Empty>
      ) : (
        <GenericListLoader
          key={searchCacheKey}
          cacheKey={searchCacheKey}
          keepPreviousData
          paginate
          preloadAdjacent
          perPage={pageLength}
          loadFn={searchVideo}
        >
          {({ data, isLoading }) => (
            <div className="relative z-0 px-2">
              {isLoading && data.length === 0 ? (
                <div className="flex min-h-48 w-full items-center justify-center px-6 py-10">
                  <Card className="inline-flex flex-row items-center gap-3 rounded-lg px-4 py-3">
                    <Spinner />
                    <span className="text-sm font-medium">{t("views.search.searching")}</span>
                  </Card>
                </div>
              ) : null}
              <VideoCardList
                videos={data}
                includeChannel
                displayStartTime
                cols={{ xs: 1, sm: 3, md: 4, lg: 5, xl: 6 }}
                className={isLoading && data.length === 0 ? "hidden" : undefined}
              />
            </div>
          )}
        </GenericListLoader>
      )}
    </section>
  );
}
