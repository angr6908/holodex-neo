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
import { Search } from "@/lib/icons";
import { useAppState } from "@/lib/store";

const pageLength = 30;

const V3_SORT_MAP: Record<string, string> = {
  newest: "latest",
  oldest: "oldest",
  longest: "longest",
};

function buildVideoSearchQuery(items: any[], sort: string, type: string, langs: string[]) {
  const q: any = {};
  for (const item of items) {
    const text = String(item.text ?? item.value ?? "").trim();
    if (item.type === "title & desc") {
      if (text) q.search = q.search ? `${q.search} ${text}` : text;
    } else if (item.type === "channel") {
      q.vtuber ??= [];
      q.vtuber.push(item.value);
    } else if (item.type === "topic") {
      q.topic ??= [];
      q.topic.push(item.value);
    } else if (item.type === "org") {
      q.org ??= [];
      q.org.push(item.value);
    }
  }
  q.type = type === "all" ? ["stream", "clip"] : [type];
  if (type === "clip" && langs.length) q.lang = langs;
  return { q, sort: V3_SORT_MAP[sort] ?? "latest" };
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
  const searchCacheKey =
    executedQuery && executedQuery.length >= 5
      ? `search:${filterType}:${filterSort}:${clipLangsKey}:${executedQuery}`
      : "";

  useEffect(() => {
    document.title = executedQuery ? "Search Results - Holodex" : "Search - Holodex";
  }, [executedQuery]);

  const searchVideo = useMemo(() => {
    if (!executedQuery || executedQuery.length < 5) return null;
    return async (offset: number, limit: number) => {
      const { csv2json } = await import("json-2-csv");
      const parsedQuery = (await csv2json(executedQuery)) as any[];
      const container = buildVideoSearchQuery(
        parsedQuery,
        filterSort,
        filterType,
        app.settings.clipLangs,
      );
      const res = await api.searchVideo({ ...container, offset, limit });
      const hits = res.data?.hits;
      return {
        items: (hits?.hits || []).map((hit: any) => hit._source),
        total: hits?.total?.value ?? null,
      };
    };
  }, [executedQuery, filterSort, filterType, clipLangsKey]);

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
