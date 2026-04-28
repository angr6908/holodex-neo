"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { mdiFormatListBulleted, mdiViewList } from "@mdi/js";
import { api } from "@/lib/api";
import { TL_LANGS } from "@/lib/consts";
import { getLiveViewerCount } from "@/lib/functions";
import { dayjs } from "@/lib/time";
import { mdiViewComfy, mdiViewGrid, mdiViewModule } from "@/lib/icons";
import { useAppState } from "@/lib/store";
import {
  fetchTwitchViewerCounts,
  getTwitchLogin,
  getTwitchViewerCountFingerprint,
  mergeTwitchViewerCountsIntoVideos,
  readCachedTwitchViewerCounts,
} from "@/lib/twitch";
import { GenericListLoader } from "@/components/video/GenericListLoader";
import { SkeletonCardList } from "@/components/video/SkeletonCardList";
import { VideoCardList } from "@/components/video/VideoCardList";
import { SelectCard } from "@/components/setting/SelectCard";
import { VideoListFilters } from "@/components/setting/VideoListFilters";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { dedupeVideos, extractItems, sortVideosForTab } from "@/lib/video-list";

const Tabs = Object.freeze({ LIVE_UPCOMING: 0, ARCHIVE: 1, CLIPS: 2 });
const API_MAX_LIMIT = 100;
type MultiOrgCacheEntry = {
  page1: Promise<any[]>;
  getCurrentItems: () => any[];
  fetchMore: () => Promise<void>;
  isExhausted: () => boolean;
};
const multiOrgDataCache = new Map<string, MultiOrgCacheEntry>();

function sortPayloadForTab(payload: any, tab: number) {
  if (tab !== Tabs.ARCHIVE) return payload;
  if (Array.isArray(payload)) return sortVideosForTab(payload, true);
  if (payload?.items && Array.isArray(payload.items))
    return { ...payload, items: sortVideosForTab(payload.items, true) };
  return payload;
}

export function ConnectedVideoList({
  liveContent = null,
  isFavPage = false,
  tab = Tabs.LIVE_UPCOMING,
  isActive = true,
  datePortalName = "",
  inMultiViewSelector,
  orgTargetsOverride = null,
  ...attrs
}: {
  liveContent?: any[] | null;
  isFavPage?: boolean;
  tab?: number;
  isActive?: boolean;
  datePortalName?: string;
  inMultiViewSelector?: boolean;
  orgTargetsOverride?: any[] | null;
  [key: string]: any;
}) {
  const app = useAppState();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const [toDate, setToDate] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("viewers");
  const [twitchViewerCounts, setTwitchViewerCounts] = useState<
    Record<string, number>
  >({});
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const pageLength = 24;
  const previousSelectedHomeOrgsKey = useRef<string | null>(null);
  const previousTab = useRef<number | null>(null);

  const clipLangs = app.settings.clipLangs || [];
  const homeViewMode = app.settings.homeViewMode || "grid";
  const scrollMode = app.settings.scrollMode;
  const prevScrollMode = useRef(scrollMode);
  const currentGridSize = app.currentGridSize;
  const colSizes = useMemo(
    () =>
      Object.fromEntries(
        (["xs", "sm", "md", "lg", "xl"] as const).map((k, i) => [k, i + 1 + currentGridSize]),
      ) as { xs: number; sm: number; md: number; lg: number; xl: number },
    [currentGridSize],
  );
  const breakpointName = useMemo(() => {
    const width =
      app.windowWidth ||
      (typeof window !== "undefined" ? window.innerWidth : 1440);
    if (width < 600) return "xs";
    if (width < 960) return "sm";
    if (width < 1264) return "md";
    if (width < 1904) return "lg";
    return "xl";
  }, [app.windowWidth]);
  const shouldIncludeAvatar = !(
    (breakpointName === "md" && currentGridSize > 1) ||
    (breakpointName === "sm" && currentGridSize > 0) ||
    (breakpointName === "xs" && currentGridSize > 0)
  );
  const activeHomeOrgNames = isFavPage ? [] : app.selectedHomeOrgs || [];
  const shouldHideCollabs =
    tab !== Tabs.CLIPS &&
    app.settings.hideCollabStreams &&
    (isFavPage ? true : activeHomeOrgNames.length > 0);
  const resolvedOrgTargets = useMemo(() => {
    if (orgTargetsOverride?.length) return orgTargetsOverride;
    return activeHomeOrgNames.length ? activeHomeOrgNames : ["All Vtubers"];
  }, [JSON.stringify(orgTargetsOverride || []), activeHomeOrgNames.join("\0")]);
  const filterOrg = isFavPage
    ? "none"
    : resolvedOrgTargets.length > 1
      ? "All Vtubers"
      : resolvedOrgTargets[0] || app.currentOrg.name;
  const filterConfig = useMemo(
    () => ({
      forOrg: filterOrg,
      hideCollabs: shouldHideCollabs,
      hidePlaceholder: app.settings.hidePlaceholder,
      hideMissing: app.settings.hideMissing,
      hideUpcoming: app.settings.hideUpcoming,
    }),
    [
      filterOrg,
      shouldHideCollabs,
      app.settings.hidePlaceholder,
      app.settings.hideMissing,
      app.settings.hideUpcoming,
    ],
  );
  const portalName = datePortalName || `date-selector${isFavPage}`;

  const getLiveSourceList = useCallback(
    () =>
      ((liveContent?.length && liveContent) ||
        (isFavPage ? app.favoritesLive : app.homeLive)) as any[],
    [liveContent, isFavPage, app.favoritesLive, app.homeLive],
  );
  const getLiveTwitchLogins = useCallback(
    (videos: any[]) => [
      ...new Set(
        (videos || [])
          .filter((video: any) => video?.status === "live")
          .map((video: any) => getTwitchLogin(video))
          .filter((login): login is string => !!login),
      ),
    ],
    [],
  );

  const live = useMemo(() => {
    let liveList = mergeTwitchViewerCountsIntoVideos(
      getLiveSourceList(),
      twitchViewerCounts,
    );
    if (sortBy === "viewers")
      liveList = [...liveList].sort(
        (a, b) => getLiveViewerCount(b) - getLiveViewerCount(a),
      );
    return liveList;
  }, [getLiveSourceList, sortBy, twitchViewerCounts]);
  const lives = live.filter((v: any) => v.status === "live");
  const upcoming = app.settings.hideUpcoming
    ? []
    : live
        .filter((v: any) => v.status === "upcoming")
        .sort((v1: any, v2: any) => {
          if (v1.available_at !== v2.available_at) return 0;
          if (v1.type === "placeholder" && v2.type === "placeholder") return 0;
          return v1.type === "placeholder" ? 1 : -1;
        });
  const waitingForTwitchViewerCounts =
    tab === Tabs.LIVE_UPCOMING &&
    sortBy === "viewers" &&
    getLiveSourceList().some(
      (video: any) =>
        video?.status === "live" &&
        !!getTwitchLogin(video) &&
        getLiveViewerCount(video) <= 0 &&
        twitchViewerCounts[getTwitchLogin(video)!] === undefined,
    );
  const isLoading = isFavPage ? app.favoritesLoading : app.homeLoading;
  const hasError = isFavPage ? app.favoritesError : app.homeError;
  const showLiveLoading = isLoading || waitingForTwitchViewerCounts;

  const selectedHomeOrgsKey = JSON.stringify(app.selectedHomeOrgs || []);
  const orgTargetsOverrideKey = JSON.stringify(orgTargetsOverride || []);
  const clipLangsKey = JSON.stringify(clipLangs || []);
  const loaderCacheKey = cacheKeyForTab(tab);

  useEffect(() => {
    setPortalTarget(document.getElementById(portalName));
  }, [portalName, app.isMobile, isActive]);

  useEffect(() => {
    if (!isActive) {
      prevScrollMode.current = scrollMode;
      return;
    }
    const previous = prevScrollMode.current;
    prevScrollMode.current = scrollMode;
    if (previous === scrollMode) return;
    if (!scrollMode || !searchParams.get("page")) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    const query = params.toString();
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    router.replace(`${pathname}${query ? `?${query}` : ""}${hash}`);
  }, [scrollMode, isActive, searchParams, pathname, router]);
  useEffect(() => {
    if (!isActive || tab !== Tabs.LIVE_UPCOMING) return undefined;
    let cancelled = false;
    async function refreshTwitchViewerCounts() {
      const source = getLiveSourceList();
      const logins = getLiveTwitchLogins(source);
      if (logins.length === 0) {
        setTwitchViewerCounts((prev) => (Object.keys(prev).length ? {} : prev));
        return;
      }
      const counts = await fetchTwitchViewerCounts(logins);
      if (!cancelled) {
        setTwitchViewerCounts((prev) =>
          getTwitchViewerCountFingerprint(counts) !==
          getTwitchViewerCountFingerprint(prev)
            ? counts
            : prev,
        );
      }
    }
    const cached = readCachedTwitchViewerCounts(
      getLiveTwitchLogins(getLiveSourceList()),
    );
    setTwitchViewerCounts((prev) =>
      getTwitchViewerCountFingerprint(cached) !==
      getTwitchViewerCountFingerprint(prev)
        ? cached
        : prev,
    );
    void refreshTwitchViewerCounts();
    const timer = setInterval(refreshTwitchViewerCounts, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isActive, tab, getLiveSourceList, getLiveTwitchLogins]);

  useEffect(() => {
    if (!app.hydrated) return;
    init(true);
    previousSelectedHomeOrgsKey.current = selectedHomeOrgsKey;
    previousTab.current = tab;
  }, [app.hydrated]);

  useEffect(() => {
    if (!app.hydrated) return;
    if (previousSelectedHomeOrgsKey.current === null) {
      previousSelectedHomeOrgsKey.current = selectedHomeOrgsKey;
      return;
    }
    if (previousSelectedHomeOrgsKey.current === selectedHomeOrgsKey) return;
    previousSelectedHomeOrgsKey.current = selectedHomeOrgsKey;
    if (!isActive || isFavPage) return;
    multiOrgDataCache.clear();
    if (tab === Tabs.LIVE_UPCOMING) init(false);
  }, [selectedHomeOrgsKey, isActive, isFavPage, tab]);

  useEffect(() => {
    if (previousTab.current === null) {
      previousTab.current = tab;
      return;
    }
    const oldTab = previousTab.current;
    previousTab.current = tab;
    if (!isActive) return;
    if (tab !== oldTab && tab === Tabs.LIVE_UPCOMING) init(false);
  }, [tab, isActive]);

  useEffect(() => {
    if (resolvedOrgTargets.length > 1 && !isFavPage) {
      [Tabs.ARCHIVE, Tabs.CLIPS].forEach((tabVal) => {
        const key = cacheKeyForTab(tabVal);
        startMultiOrgFetch(key, buildTabQuery(tabVal), resolvedOrgTargets);
      });
    }
  }, [
    resolvedOrgTargets.join("\0"),
    isFavPage,
    scrollMode,
    clipLangsKey,
    toDate,
  ]);

  function toggleClipLang(value: string, checked: boolean) {
    const next = new Set(clipLangs);
    if (checked) next.add(value);
    else next.delete(value);
    app.patchSettings({ clipLangs: [...next].sort() });
  }

  function toggleDisplayMode() {
    const viewModes = ["grid", "list", "denseList"] as const;
    const nextViewMode =
      viewModes[
        ((viewModes as readonly string[]).indexOf(homeViewMode) + 1) %
          viewModes.length
      ];
    if (homeViewMode === "grid" && currentGridSize < 2)
      app.setCurrentGridSize(currentGridSize + 1);
    else {
      app.patchSettings({ homeViewMode: nextViewMode });
      app.setCurrentGridSize(0);
    }
  }

  function init(updateFavorites: boolean) {
    if (isFavPage) {
      if (updateFavorites) app.fetchFavorites();
      if (app.favoriteChannelIDs.size > 0 && app.isLoggedIn) {
        app.fetchFavoritesLive({
          force: updateFavorites || live.length === 0,
          minutes: 2,
        });
      }
    } else if (!liveContent?.length) {
      app.fetchHomeLive({
        force: live.length === 0,
        minutes: 2,
      });
    }
  }

  const displayIcon = (() => {
    if (homeViewMode === "list") return mdiFormatListBulleted;
    if (homeViewMode === "denseList") return mdiViewGrid;
    if (currentGridSize === 1) return mdiViewComfy;
    if (currentGridSize === 2) return mdiViewList;
    return mdiViewModule;
  })();

  function buildTabQuery(tabValue: number): Record<string, any> {
    const inclusion = tabValue === Tabs.ARCHIVE ? "mentions,clips" : "mentions";
    return {
      status: tabValue === Tabs.ARCHIVE ? "past,missing" : "past",
      type: tabValue === Tabs.ARCHIVE ? "stream" : "clip",
      include: inclusion,
      lang: clipLangs.join(","),
      paginated: false,
      ...(toDate && { to: dayjs(toDate).add(1, "day").toDate().toISOString() }),
      max_upcoming_hours: 1,
    };
  }

  function cacheKeyForTab(tabValue: number) {
    return [
      "vlx",
      isFavPage ? "fav" : "home",
      tabValue,
      scrollMode ? "scroll" : "page",
      selectedHomeOrgsKey,
      orgTargetsOverrideKey,
      toDate || "",
      clipLangsKey,
    ].join("-");
  }

  function startMultiOrgFetch(
    cacheKey: string,
    query: Record<string, any>,
    orgTargets: string[],
    tabValue = tab,
  ) {
    if (multiOrgDataCache.has(cacheKey)) return;
    const baseQuery = { ...query, paginated: false };
    const isArchive = tabValue === Tabs.ARCHIVE;

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

    // Fetches one more page per non-exhausted org; concurrent calls share the same batch.
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

  function getLoadFn() {
    const query = buildTabQuery(tab);
    query.paginated = !scrollMode;
    if (isFavPage) {
      return async (offset: number, limit: number) => {
        if (!app.userdata.jwt) return [];
        const res = await api
          .favoritesVideos(app.userdata.jwt, { ...query, limit, offset })
          .catch(async (err: any) => {
            if (err?.response?.status === 401) {
              await app.loginVerify({ bounceToLogin: true });
              return { data: [] };
            }
            throw err;
          });
        return sortPayloadForTab(res.data, tab);
      };
    }
    const orgTargets = resolvedOrgTargets;
    // Fast path: single org, non-archive — server sort matches display order.
    if (orgTargets.length === 1 && tab !== Tabs.ARCHIVE) {
      return async (offset: number, limit: number) => {
        const res: any = await api.videos({
          ...query,
          org: orgTargets[0],
          limit,
          offset,
        });
        return sortPayloadForTab(res.data, tab);
      };
    }
    // Single-org archive or multi-org: collect all pages for global endTime sort.
    const cacheKey = loaderCacheKey;
    startMultiOrgFetch(cacheKey, query, orgTargets);
    // Pre-fetch the sibling tab only for multi-org (avoids wasted single-org requests).
    if (orgTargets.length > 1) {
      [Tabs.ARCHIVE, Tabs.CLIPS].forEach((otherTab) => {
        if (otherTab === tab) return;
        const key = cacheKeyForTab(otherTab);
        if (!multiOrgDataCache.has(key))
          startMultiOrgFetch(key, buildTabQuery(otherTab), orgTargets, otherTab);
      });
    }
    const cached = multiOrgDataCache.get(cacheKey)!;
    return async (offset: number, limit: number) => {
      await cached.page1;
      // Fetch more pages until we have enough items or all orgs are exhausted.
      while (offset + limit > cached.getCurrentItems().length && !cached.isExhausted()) {
        await cached.fetchMore();
      }
      const snapshot = cached.getCurrentItems();
      const slice = snapshot.slice(offset, offset + limit);
      // Prefetch next batch when within 4 pages of the end so items are ready.
      if (!cached.isExhausted() && snapshot.length - (offset + limit) < limit * 4) {
        cached.fetchMore();
      }
      if (!scrollMode) {
        const total = cached.isExhausted() ? snapshot.length : snapshot.length + limit;
        return { items: slice, total };
      }
      return slice;
    };
  }

  function renderSkeletonList() {
    return (
      <SkeletonCardList
        cols={colSizes}
        dense={currentGridSize > 0}
        denseList={homeViewMode === "denseList"}
        horizontal={homeViewMode === "list"}
      />
    );
  }

  function renderVideoCardList(
    videos: any[],
    listOptions: { denseList?: boolean; horizontal?: boolean } = {},
  ) {
    const listDense = listOptions.denseList ?? (homeViewMode === "denseList");
    const listHorizontal = listOptions.horizontal ?? (homeViewMode === "list");

    return (
      <VideoCardList
        {...attrs}
        videos={videos}
        includeChannel
        includeAvatar={shouldIncludeAvatar}
        cols={colSizes}
        dense={currentGridSize > 0}
        filterConfig={filterConfig}
        denseList={listDense}
        horizontal={listHorizontal}
        inMultiViewSelector={inMultiViewSelector}
        fadeUnderNavExt={false}
      />
    );
  }

  const controls = (
    <>
      <div className="absolute top-0 right-0">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={toggleDisplayMode}
        >
          <Icon icon={displayIcon} />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {tab === Tabs.LIVE_UPCOMING ? (
          <div className="flex flex-col gap-[0.45rem]">
            <span className="filter-panel-label">Sort By</span>
            <div className="inline-flex w-fit items-center gap-1 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-0.5">
              {[
                { text: "Viewers", value: "viewers" },
                { text: "Latest", value: "latest" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={cn(
                    "cursor-pointer rounded-lg px-2.5 py-1.5 text-[0.8rem] font-medium transition",
                    sortBy === opt.value
                      ? "bg-[color:var(--color-bold)] text-white"
                      : "text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]",
                  )}
                  onClick={() => setSortBy(opt.value)}
                >
                  {opt.text}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {tab !== Tabs.LIVE_UPCOMING && isActive ? (
          <div className="flex flex-col gap-[0.45rem]">
            <span className="filter-panel-label">Uploaded Before</span>
            <div className="filter-panel-datepicker">
              <DatePicker
                value={toDate ?? ""}
                placeholder="Pick a date"
                onChange={(value) => setToDate(value || null)}
              />
            </div>
          </div>
        ) : null}
        {tab === Tabs.CLIPS && isActive ? (
          <div className="filter-panel-filters">
            <SelectCard title="Clip Languages">
              <div className="select-card-chip-flow">
                {TL_LANGS.map((lang) => (
                  <label
                    key={`${lang.value}-clip`}
                    className={cn(
                      "stream-check-chip",
                      clipLangs.includes(lang.value) &&
                        "stream-check-chip-selected",
                    )}
                  >
                    <input
                      checked={clipLangs.includes(lang.value)}
                      type="checkbox"
                      className="peer sr-only"
                      onChange={(event) =>
                        toggleClipLang(lang.value, event.target.checked)
                      }
                    />
                    <span className="stream-check-chip-indicator" />
                    <span>{lang.text}</span>
                  </label>
                ))}
              </div>
            </SelectCard>
          </div>
        ) : null}
        {tab !== Tabs.CLIPS ? (
          <VideoListFilters
            className="filter-panel-filters"
            showDescriptions={false}
            compact
          />
        ) : null}
      </div>
    </>
  );

  const hideFavoritesContent =
    isFavPage && !(app.isLoggedIn && app.favoriteChannelIDs.size > 0);

  return (
    <div style={hideFavoritesContent ? { display: "none" } : undefined}>
      {!app.isMobile && portalTarget
        ? createPortal(controls, portalTarget)
        : null}
      {tab === Tabs.LIVE_UPCOMING ? (
        hasError ? (
          <div className="m-auto p-5 text-center text-red-400">
            {t("views.home.apiError") ||
              "Failed to load live data. Please try again."}
          </div>
        ) : (
          <>
            {showLiveLoading ? renderSkeletonList() : null}
            {lives.length || upcoming.length ? (
              <div>
                {renderVideoCardList(
                  homeViewMode === "grid" || app.settings.hideUpcoming ? lives : live,
                )}
                {homeViewMode === "grid" ? (
                  <>
                    {lives.length && upcoming.length ? (
                      <div className="my-3 h-px bg-[color:var(--color-border)]" />
                    ) : null}
                    {renderVideoCardList(upcoming, {
                      denseList: false,
                      horizontal: false,
                    })}
                  </>
                ) : null}
              </div>
            ) : null}
            {!showLiveLoading && lives.length === 0 && upcoming.length === 0 ? (
              <div className="m-auto p-5 text-center">
                {t("views.home.noStreams")}
              </div>
            ) : null}
          </>
        )
      ) : (
        <GenericListLoader
          key={loaderCacheKey}
          cacheKey={loaderCacheKey}
          infiniteLoad={scrollMode}
          paginate={!scrollMode}
          perPage={pageLength}
          loadFn={getLoadFn()}
        >
          {({ data, isLoading: lod }) => (
            <>
              {lod && data.length > 0 && !scrollMode ? (
                <div className="pointer-events-none relative">
                  <div
                    className="absolute inset-0 z-10 flex items-center justify-center"
                    style={{
                      background: "rgba(var(--background-rgb, 2 6 23) / 0.35)",
                      backdropFilter: "blur(2px)",
                      borderRadius: "1rem",
                      minHeight: "8rem",
                    }}
                  >
                    <div className="loading-spinner-sm" aria-hidden="true" />
                  </div>
                </div>
              ) : null}
              <div
                style={{
                  display:
                    scrollMode || data.length > 0 || !lod ? undefined : "none",
                }}
              >
                {renderVideoCardList(data)}
              </div>
              {lod && data.length === 0 ? renderSkeletonList() : null}
            </>
          )}
        </GenericListLoader>
      )}
    </div>
  );
}
