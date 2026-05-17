"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { List, LayoutDashboard, Grid2x2, LayoutGrid } from "@/lib/icons";
import { api } from "@/lib/api";
import { ALL_VTUBERS_ORG } from "@/lib/consts";
import { getLiveViewerCount } from "@/lib/functions";
import { useAppState } from "@/lib/store";
import { getBreakpoint } from "@/lib/utils";
import { fetchTwitchViewerCounts, getTwitchLogin, getTwitchViewerCountFingerprint, mergeTwitchViewerCountsIntoVideos, readCachedTwitchViewerCounts } from "@/lib/twitch";
import { GenericListLoader } from "@/components/video/GenericListLoader";
import { SkeletonCardList } from "@/components/video/SkeletonCardList";
import { VideoCardList } from "@/components/video/VideoCardList";
import { VideoListSideControls } from "@/components/video/VideoListSideControls";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { useTranslations } from "next-intl";
import { HOME_TABS as Tabs } from "@/lib/cookie-codec";
import { buildHomeTabQuery, clearHomeMultiOrgVideoCache, ensureHomeMultiOrgVideoFetch, getHomeMultiOrgVideoCache, hasHomeMultiOrgVideoCache, sortPayloadForHomeTab } from "@/lib/home-video-loader";
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
  const t = useTranslations();
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
  const colSizes = useMemo(() => ({
    xs: 1 + currentGridSize, sm: 2 + currentGridSize, md: 3 + currentGridSize,
    lg: 4 + currentGridSize, xl: 5 + currentGridSize,
  }), [currentGridSize]);
  const breakpointName = useMemo(() =>
    getBreakpoint(app.windowWidth || (typeof window !== "undefined" ? window.innerWidth : 1440)),
    [app.windowWidth]);
  const shouldIncludeAvatar = !(
    (breakpointName === "md" && currentGridSize > 1) ||
    ((breakpointName === "sm" || breakpointName === "xs") && currentGridSize > 0)
  );
  const selectedHomeOrgsKey = JSON.stringify(app.selectedHomeOrgs || []);
  const orgTargetsOverrideKey = JSON.stringify(orgTargetsOverride || []);
  const clipLangsKey = JSON.stringify(clipLangs || []);
  const activeHomeOrgNames = isFavPage ? [] : app.selectedHomeOrgs || [];
  const activeHomeOrgNamesKey = activeHomeOrgNames.join("\0");
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
  const loaderCacheKey = cacheKeyForTab(tab);
  const shouldHideCollabs =
    tab !== Tabs.CLIPS &&
    app.settings.hideCollabStreams &&
    (isFavPage ? true : activeHomeOrgNames.length > 0);
  const resolvedOrgTargets = useMemo(() => {
    if (orgTargetsOverride?.length) return orgTargetsOverride;
    return activeHomeOrgNames.length ? activeHomeOrgNames : [ALL_VTUBERS_ORG];
  }, [orgTargetsOverrideKey, activeHomeOrgNamesKey]);
  const filterOrg = isFavPage
    ? "none"
    : resolvedOrgTargets.length > 1
      ? ALL_VTUBERS_ORG
      : resolvedOrgTargets[0] || app.currentOrg.name;
  const filterConfig = useMemo(
    () => ({
      forOrg: filterOrg,
      forOrgs: isFavPage ? undefined : resolvedOrgTargets,
      hideCollabs: shouldHideCollabs,
      hidePlaceholder: app.settings.hidePlaceholder,
      hideMissing: app.settings.hideMissing,
      hideUpcoming: app.settings.hideUpcoming,
      hideLive: app.settings.hideLive,
    }),
    [
      filterOrg,
      isFavPage,
      resolvedOrgTargets,
      shouldHideCollabs,
      app.settings.hidePlaceholder,
      app.settings.hideMissing,
      app.settings.hideUpcoming,
      app.settings.hideLive,
    ],
  );
  const portalName = datePortalName || `date-selector${isFavPage}`;

  const getLiveSourceList = useCallback(
    (): any[] => liveContent?.length ? liveContent : (isFavPage ? app.favoritesLive : app.homeLive),
    [liveContent, isFavPage, app.favoritesLive, app.homeLive],
  );
  const getLiveTwitchLogins = useCallback((videos: any[]) =>
    [...new Set((videos || []).filter((v) => v?.status === "live").map(getTwitchLogin).filter((x): x is string => !!x))], []);

  const live = useMemo(() => {
    const list = mergeTwitchViewerCountsIntoVideos(getLiveSourceList(), twitchViewerCounts);
    return sortBy === "viewers" ? [...list].sort((a, b) => getLiveViewerCount(b) - getLiveViewerCount(a)) : list;
  }, [getLiveSourceList, sortBy, twitchViewerCounts]);
  const lives = live.filter((v: any) => v.status === "live");
  const livesVisible = app.settings.hideLive ? [] : lives;
  const upcoming = app.settings.hideUpcoming ? [] : live
    .filter((v: any) => v.status === "upcoming")
    .sort((a: any, b: any) =>
      a.available_at !== b.available_at || a.type === b.type ? 0 : a.type === "placeholder" ? 1 : -1);
  const waitingForTwitchViewerCounts = tab === Tabs.LIVE_UPCOMING && sortBy === "viewers" &&
    getLiveSourceList().some((v: any) => {
      const login = getTwitchLogin(v);
      return v?.status === "live" && !!login && getLiveViewerCount(v) <= 0 && twitchViewerCounts[login] === undefined;
    });
  const isLoading = isFavPage ? app.favoritesLoading : app.homeLoading;
  const hasError = isFavPage ? app.favoritesError : app.homeError;
  const showLiveLoading = isLoading || waitingForTwitchViewerCounts;

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

  function buildTabQuery(tabValue: number): Record<string, any> {
    return buildHomeTabQuery({ tab: tabValue, clipLangs, toDate });
  }

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
    if (!isActive || tab !== Tabs.LIVE_UPCOMING) return;
    let cancelled = false;
    const setIfChanged = (counts: Record<string, number>) =>
      setTwitchViewerCounts((prev) =>
        getTwitchViewerCountFingerprint(counts) !== getTwitchViewerCountFingerprint(prev) ? counts : prev);
    async function refresh() {
      const logins = getLiveTwitchLogins(getLiveSourceList());
      if (!logins.length) { setIfChanged({}); return; }
      const counts = await fetchTwitchViewerCounts(logins);
      if (!cancelled) setIfChanged(counts);
    }
    setIfChanged(readCachedTwitchViewerCounts(getLiveTwitchLogins(getLiveSourceList())));
    void refresh();
    const timer = setInterval(refresh, 60_000);
    return () => { cancelled = true; clearInterval(timer); };
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
    clearHomeMultiOrgVideoCache();
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
        ensureHomeMultiOrgVideoFetch(key, buildTabQuery(tabVal), resolvedOrgTargets, tabVal);
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

  const displayIcon = (() => {
    if (homeViewMode === "list") return List;
    if (homeViewMode === "denseList") return Grid2x2;
    if (currentGridSize === 1) return LayoutDashboard;
    if (currentGridSize === 2) return List;
    return LayoutGrid;
  })();

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
        return sortPayloadForHomeTab(res.data, tab);
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
        return sortPayloadForHomeTab(res.data, tab);
      };
    }
    // Single-org archive or multi-org: collect all pages for global endTime sort.
    const cacheKey = loaderCacheKey;
    ensureHomeMultiOrgVideoFetch(cacheKey, query, orgTargets, tab);
    // Pre-fetch the sibling tab only for multi-org (avoids wasted single-org requests).
    if (orgTargets.length > 1) {
      [Tabs.ARCHIVE, Tabs.CLIPS].forEach((otherTab) => {
        if (otherTab === tab) return;
        const key = cacheKeyForTab(otherTab);
        if (!hasHomeMultiOrgVideoCache(key))
          ensureHomeMultiOrgVideoFetch(key, buildTabQuery(otherTab), orgTargets, otherTab);
      });
    }
    const cached = getHomeMultiOrgVideoCache(cacheKey)!;
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
    <VideoListSideControls
      tab={tab}
      isActive={isActive}
      sortBy={sortBy}
      displayIcon={displayIcon}
      toDate={toDate}
      clipLangs={clipLangs}
      onSortByChange={setSortBy}
      onToggleDisplayMode={toggleDisplayMode}
      onToDateChange={setToDate}
      onToggleClipLang={toggleClipLang}
    />
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
            {livesVisible.length || upcoming.length ? (
              <div>
                {renderVideoCardList(
                  homeViewMode === "grid" || app.settings.hideUpcoming ? livesVisible : live,
                )}
                {homeViewMode === "grid" ? (
                  <>
                    {livesVisible.length && upcoming.length ? (
                      <Separator className="my-3 bg-[color:var(--color-border)]" />
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
                    <Spinner className="size-6 text-primary" />
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
