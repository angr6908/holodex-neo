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
import { searchTypeFromParams } from "@/lib/functions";
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
  const filterType = searchTypeFromParams(searchParams);
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
    let queryPromise: ReturnType<typeof loadSearchQuery> | null = null;
    const getSearchQuery = () =>
      (queryPromise ??= loadSearchQuery(executedQuery, filterSort, filterType));
    const selectedOrgs = mainOrgFilterKey ? (JSON.parse(mainOrgFilterKey) as string[]) : [];
    if (!selectedOrgs.length || selectedOrgs.includes(ALL_VTUBERS_ORG)) {
      return async (offset: number, limit: number) => ({
        ...(await api.searchVideo(await getSearchQuery(), offset, limit)),
        offset,
      });
    }

    // Several orgs in one search would only match videos involving all of them, so each org is
    // searched on its own and the results merged. Pages load on demand; the list loader
    // preloads the next page.
    const orgSources = new Map<string, OrgSource>(
      selectedOrgs.map((org) => [
        org,
        { chunks: new Map(), items: [], exhausted: false, unavailable: false },
      ]),
    );
    const pendingOrgRequests = new Map<string, Promise<void>>();

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

    const startOrgBatch = (
      searchQuery: VideoSearchQuery,
      requests: Array<{ org: string; offset: number }>,
    ) => {
      const keys = requests.map(({ org, offset }) => `${org}:${offset}`);
      let tracked: Promise<void>;
      tracked = api
        .searchVideoByOrgs(searchQuery, requests, ORG_SOURCE_BATCH_SIZE)
        .then((response) => {
          for (const result of response.data?.results || []) {
            const source = orgSources.get(String(result.org || ""));
            if (!source) continue;
            if (result.failed) source.unavailable = true;
            else source.chunks.set(Math.max(0, Number(result.offset) || 0), result.data);
            rebuildOrgSource(source);
          }
        })
        .finally(() => {
          for (const key of keys) {
            if (pendingOrgRequests.get(key) === tracked) pendingOrgRequests.delete(key);
          }
        });
      for (const key of keys) pendingOrgRequests.set(key, tracked);
      return tracked;
    };

    // Loads until every org has `required` results or no more; a batch already on its way for
    // an org (say, the preloaded next page) is awaited rather than requested again.
    const ensureOrgResults = async (searchQuery: VideoSearchQuery, required: number) => {
      while (true) {
        const waiters: Promise<void>[] = [];
        const requests: Array<{ org: string; offset: number }> = [];
        for (const [org, source] of orgSources) {
          if (source.exhausted || source.items.length >= required) continue;
          const pending = pendingOrgRequests.get(`${org}:${source.items.length}`);
          if (pending) waiters.push(pending);
          else requests.push({ org, offset: source.items.length });
        }
        if (requests.length) waiters.push(startOrgBatch(searchQuery, requests));
        if (!waiters.length) return;
        await Promise.all(waiters);
      }
    };

    const mergeResults = () => {
      const uniqueItems: any[] = [];
      const seen = new Set<string>();
      for (const source of orgSources.values()) {
        for (const item of source.items) {
          if (!item?.id || seen.has(item.id)) continue;
          seen.add(item.id);
          uniqueItems.push(item);
        }
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

    return async (offset: number, limit: number) => {
      const searchQuery = await getSearchQuery();
      const pageEnd = offset + limit;
      let requiredPerOrg = pageEnd;
      let merged: any[] = [];
      let exhausted = false;
      do {
        await ensureOrgResults(searchQuery, requiredPerOrg);
        merged = mergeResults();
        exhausted = [...orgSources.values()].every((source) => source.exhausted);
        requiredPerOrg += ORG_SOURCE_BATCH_SIZE;
      } while (merged.length < pageEnd && !exhausted);
      return {
        items: merged.slice(offset, pageEnd),
        total: exhausted ? merged.length : Math.max(merged.length + limit, offset + limit * 2),
        offset,
      };
    };
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
