"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { csv2json } from "json-2-csv";
import { mdiMagnify } from "@mdi/js";
import { api } from "@/lib/api";
import { forwardTransformSearchToAPIQuery } from "@/lib/functions";
import { useAppState } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { Icon } from "@/components/ui/Icon";
import { VideoCardList } from "@/components/video/VideoCardList";
import { GenericListLoader } from "@/components/video/GenericListLoader";
import { LoadingOverlay } from "@/components/common/LoadingOverlay";
import { SearchForm } from "@/components/search/SearchForm";

const pageLength = 30;

export function SearchPage() {
  const searchParams = useSearchParams();
  const app = useAppState();
  const { t } = useI18n();
  const [id, setId] = useState(0);
  const [horizontal, setHorizontal] = useState(false);
  const [executedQuery, setExecutedQuery] = useState<string | null>(null);
  const [filterSort, setFilterSort] = useState("newest");
  const [filterType, setFilterType] = useState("all");
  const clipLangsKey = app.settings.clipLangs.join(",");

  const options = useMemo(() => ({
    defaults: { sort: "newest", type: "all" },
    sort: [
      { text: t("views.search.sort.newest"), value: "newest", query_value: { sort: "published_at", order: "desc" } },
      { text: t("views.search.sort.oldest"), value: "oldest", query_value: { sort: "published_at", order: "asc" } },
      { text: t("views.search.sort.longest"), value: "longest", query_value: { sort: "duration", order: "desc" } },
    ],
    type: [
      { text: t("views.search.type.all"), value: "all", query_value: {} },
      { text: t("views.search.type.official"), value: "stream", query_value: { channel_type: "vtuber" } },
      { text: t("views.search.type.clip"), value: "clip", query_value: { channel_type: "subber" } },
    ],
  }), [t]);

  useEffect(() => {
    document.title = executedQuery ? "Search Results - Holodex" : "Search - Holodex";
  }, [executedQuery]);

  useEffect(() => {
    setFilterType(searchParams.get("vtuber") === "false" ? "clip" : searchParams.get("channelType") || options.defaults.type);
    setFilterSort(searchParams.get("sort") || options.defaults.sort);
    const q = searchParams.get("q");
    if (q !== executedQuery && q) setId((value) => value + 1);
    setExecutedQuery(q);
  }, [searchParams, options.defaults.type, options.defaults.sort, executedQuery]);

  const searchVideo = useMemo(() => {
    if (!executedQuery || executedQuery.length < 5) return null;
    return async (offset: number, limit: number) => {
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
    <section>
      <div className="search-form-sticky">
        <SearchForm sortBy={filterSort} typeValue={filterType} sortOptions={options.sort} typeOptions={options.type} onSortByChange={setFilterSort} onTypeValueChange={setFilterType} />
      </div>

      <div className="search-content-area">
        {searchVideo === null ? (
          <div className="relative z-0 flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Icon icon={mdiMagnify} className="h-8 w-8 text-[color:var(--color-muted-foreground)]" />
            <p className="text-sm text-[color:var(--color-muted-foreground)]">Use the filters above or the search bar to find streams and clips.</p>
          </div>
        ) : (
          <GenericListLoader key={filterType + filterSort + id + executedQuery} paginate perPage={pageLength} loadFn={searchVideo}>
            {({ data, isLoading }) => (
            <div className="relative z-0">
              {isLoading ? <LoadingOverlay isLoading showError={false} label="Searching..." /> : null}
              <VideoCardList videos={data} horizontal={horizontal} includeChannel dense cols={{ xs: 1, sm: 3, md: 4, lg: 5, xl: 6 }} showComments className={isLoading ? "hidden" : undefined} />
            </div>
            )}
          </GenericListLoader>
        )}
      </div>
    </section>
  );
}
