"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { GenericListLoader } from "@/components/video/GenericListLoader";
import { VideoCardList } from "@/components/video/VideoCardList";
import { api } from "@/lib/api";
import { ALL_VTUBERS_ORG } from "@/lib/consts";
import { Search } from "@/lib/icons";
import { useAppState } from "@/lib/store";

const pageLength = 30;
const ORG_SEARCH_PAGE_SIZE = 100;

type SearchFilterItem = { type: string; value: string; text: string };
type SearchResultPage = { items: any[]; total: number | null };
type OrgResultPage = SearchResultPage & { exhausted: boolean };

function buildSearchQuery(
  items: SearchFilterItem[],
  sort: string,
  type: string,
  languages: string[],
) {
  const query = {
    sort,
    lang: languages,
    target: type === "all" ? ["stream", "clip"] : [type],
    conditions: [] as Array<{ text: string }>,
    topic: [] as string[],
    vch: [] as string[],
    org: [] as string[],
  };
  for (const item of items) {
    const text = String(item.text ?? "").trim();
    if (item.type === "title & desc" && text) query.conditions.push({ text });
    else if (item.type === "channel") query.vch.push(item.value);
    else if (item.type === "topic") query.topic.push(item.value);
    else if (item.type === "org") query.org.push(item.value);
  }
  return query;
}

async function loadSearchQuery(query: string, sort: string, type: string, languages: string[]) {
  const { csv2json } = await import("json-2-csv");
  return buildSearchQuery((await csv2json(query)) as SearchFilterItem[], sort, type, languages);
}

function searchResultPage(response: any): SearchResultPage {
  const payload = response.data || {};
  return {
    items: Array.isArray(payload.items) ? payload.items : [],
    total: typeof payload.total === "number" ? payload.total : null,
  };
}

function videoTime(item: any) {
  return new Date(item?.published_at || item?.available_at || 0).getTime();
}

function routeSearchType(searchParams: Pick<URLSearchParams, "get">) {
  const channelType = searchParams.get("channelType");
  if (searchParams.get("vtuber") === "false" || channelType === "subber" || channelType === "clip")
    return "clip";
  if (channelType === "vtuber" || channelType === "stream") return "stream";
  return "all";
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const app = useAppState();
  const t = useTranslations();
  const executedQuery = searchParams.get("q");
  const filterSort = searchParams.get("sort") || "newest";
  const filterType = routeSearchType(searchParams);
  const clipLangsKey = app.settings.clipLangs.join(",");
  const selectedMainOrgs = app.selectedHomeOrgs || [];
  const mainOrgFilterKey = app.searchUseMainOrgFilter ? JSON.stringify(selectedMainOrgs) : "";
  const searchCacheKey =
    executedQuery && executedQuery.length >= 5
      ? `search:v7:${filterType}:${filterSort}:${clipLangsKey}:${mainOrgFilterKey}:${executedQuery}`
      : "";

  useEffect(() => {
    document.title = executedQuery ? "Search Results - Holodex" : "Search - Holodex";
  }, [executedQuery]);

  const searchVideo = useMemo(() => {
    if (!executedQuery || executedQuery.length < 5) return null;
    const selectedOrgs = mainOrgFilterKey ? (JSON.parse(mainOrgFilterKey) as string[]) : [];
    const targetOrgs = selectedOrgs.length ? selectedOrgs : [ALL_VTUBERS_ORG];
    const orgPages = new Map<string, OrgResultPage>();
    const pendingOrgPages = new Map<string, Promise<void>>();
    let queryPromise: ReturnType<typeof loadSearchQuery> | null = null;
    const getSearchQuery = () => {
      queryPromise ??= loadSearchQuery(
        executedQuery,
        filterSort,
        filterType,
        app.settings.clipLangs,
      );
      return queryPromise;
    };

    const load = async (offset: number, limit: number) => {
      const searchQuery = await getSearchQuery();
      if (!mainOrgFilterKey || targetOrgs.includes(ALL_VTUBERS_ORG)) {
        const page = searchResultPage(
          await api.searchVideo({ ...searchQuery, paginated: true, offset, limit }),
        );
        return {
          items: page.items,
          total: page.total,
          offset,
        };
      }

      const ensureOrgResults = async (org: string, required: number) => {
        while (true) {
          const current = orgPages.get(org);
          if (current && (current.items.length >= required || current.exhausted)) return;
          const pending = pendingOrgPages.get(org);
          if (pending) {
            await pending;
            continue;
          }
          const offsetToFetch = current?.items.length || 0;
          const request = api
            .searchVideo({
              ...searchQuery,
              // The main selector replaces any organization filters encoded in the URL.
              org: [org],
              paginated: true,
              offset: offsetToFetch,
              limit: ORG_SEARCH_PAGE_SIZE,
            })
            .then((response) => {
              const { items, total } = searchResultPage(response);
              const allItems = [...(current?.items || []), ...items];
              orgPages.set(org, {
                items: allItems,
                total,
                exhausted:
                  items.length === 0 ||
                  (total !== null ? allItems.length >= total : items.length < ORG_SEARCH_PAGE_SIZE),
              });
            })
            .finally(() => pendingOrgPages.delete(org));
          pendingOrgPages.set(org, request);
          await request;
        }
      };

      const mergeResults = () => {
        const merged: any[] = [];
        const seen = new Set<string>();
        for (const item of targetOrgs.flatMap((org) => orgPages.get(org)?.items || [])) {
          if (!item?.id || seen.has(item.id)) continue;
          seen.add(item.id);
          merged.push(item);
        }
        merged.sort((a, b) => {
          const result =
            filterSort === "longest"
              ? (b.duration || 0) - (a.duration || 0)
              : filterSort === "oldest"
                ? videoTime(a) - videoTime(b)
                : videoTime(b) - videoTime(a);
          return result || String(a.id).localeCompare(String(b.id));
        });
        return merged;
      };

      const pageEnd = offset + limit;
      let requiredPerOrg = pageEnd;
      let merged: any[] = [];
      let exhausted = false;
      do {
        await Promise.all(targetOrgs.map((org) => ensureOrgResults(org, requiredPerOrg)));
        merged = mergeResults();
        exhausted = targetOrgs.every((org) => orgPages.get(org)?.exhausted);
        requiredPerOrg += ORG_SEARCH_PAGE_SIZE;
      } while (merged.length < pageEnd && !exhausted);

      return {
        items: merged.slice(offset, offset + limit),
        total: exhausted ? merged.length : Math.max(merged.length + limit, offset + limit * 2),
        offset,
      };
    };
    return load;
  }, [executedQuery, filterSort, filterType, clipLangsKey, mainOrgFilterKey]);

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
                dense
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
