"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search } from "@/lib/icons";
import { api } from "@/lib/api";
import { forwardTransformSearchToAPIQuery } from "@/lib/functions";
import { useAppState } from "@/lib/store";
import { useTranslations } from "next-intl";
import { Empty, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { VideoCardList } from "@/components/video/VideoCardList";
import { GenericListLoader } from "@/components/video/GenericListLoader";
const pageLength = 30;

function routeSearchType(searchParams: Pick<URLSearchParams, "get">) {
  const channelType = searchParams.get("channelType");
  if (searchParams.get("vtuber") === "false" || channelType === "subber" || channelType === "clip") return "clip";
  if (channelType === "vtuber" || channelType === "stream") return "stream";
  return "all";
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const app = useAppState();
  const t = useTranslations();
  const [id, setId] = useState(0);
  const [horizontal, setHorizontal] = useState(false);
  const [executedQuery, setExecutedQuery] = useState<string | null>(null);
  const [filterSort, setFilterSort] = useState("newest");
  const [filterType, setFilterType] = useState("all");
  const clipLangsKey = app.settings.clipLangs.join(",");

  useEffect(() => {
    document.title = executedQuery ? "Search Results - Holodex" : "Search - Holodex";
  }, [executedQuery]);

  useEffect(() => {
    setFilterType(routeSearchType(searchParams));
    setFilterSort(searchParams.get("sort") || "newest");
    const q = searchParams.get("q");
    if (q !== executedQuery && q) setId((value) => value + 1);
    setExecutedQuery(q);
  }, [searchParams, executedQuery]);

  const searchVideo = useMemo(() => {
    if (!executedQuery || executedQuery.length < 5) return null;
    return async (offset: number, limit: number) => {
      const { csv2json } = await import("json-2-csv");
      const parsedQuery = await csv2json(executedQuery);
      const searchQuery = forwardTransformSearchToAPIQuery(parsedQuery, {
        sort: filterSort,
        lang: app.settings.clipLangs,
        target: filterType === "all" ? ["stream", "clip"] : [filterType],
        conditions: [],
        topic: [],
        vch: [],
        org: [],
        comment: [],
      });
      if (searchQuery.comment.length === 0) {
        setHorizontal(false);
        return api.searchVideo({ ...searchQuery, paginated: true, offset, limit }).then((x: any) => x.data);
      }
      setHorizontal(true);
      return api.searchComments({ ...searchQuery, paginated: true, offset, limit }).then((x: any) => x.data);
    };
  }, [executedQuery, filterSort, filterType, clipLangsKey, app.settings.clipLangs]);

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
        <GenericListLoader key={filterType + filterSort + id + executedQuery} paginate perPage={pageLength} loadFn={searchVideo}>
          {({ data, isLoading }) => (
            <div className="relative z-0 px-2">
              {isLoading ? (
                <div className="flex min-h-48 w-full items-center justify-center px-6 py-10">
                  <Card className="inline-flex flex-row items-center gap-3 rounded-lg px-4 py-3">
                    <Spinner />
                    <span className="text-sm font-medium">{t("views.search.searching")}</span>
                  </Card>
                </div>
              ) : null}
              <VideoCardList videos={data} horizontal={horizontal} includeChannel dense cols={{ xs: 1, sm: 3, md: 4, lg: 5, xl: 6 }} showComments className={isLoading ? "hidden" : undefined} />
            </div>
          )}
        </GenericListLoader>
      )}
    </section>
  );
}
