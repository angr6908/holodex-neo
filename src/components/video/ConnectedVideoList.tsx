"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { mdiFormatListBulleted, mdiViewList } from "@mdi/js";
import { api } from "@/lib/api";
import { TL_LANGS } from "@/lib/consts";
import { getLiveViewerCount, videoTemporalComparator } from "@/lib/functions";
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
import { videoEndTimestamp } from "@/lib/video-format";

const Tabs = Object.freeze({ LIVE_UPCOMING: 0, ARCHIVE: 1, CLIPS: 2 });
const API_MAX_LIMIT = 100;
const multiOrgDataCache = new Map<
  string,
  { page1: Promise<any[]>; full: Promise<any[]> }
>();

function nearestUTCDate(date: any) {
  return date.add(1, "day").toDate().toISOString();
}

function dedupeVideos(videos: any[]) {
  return Array.from(
    new Map((videos || []).map((video) => [video.id, video])).values(),
  );
}

function extractVideoItems(payload: any) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  return (
    (Object.values(payload).find((value) => Array.isArray(value)) as any[]) ||
    []
  );
}

function sortForTab(items: any[], tab: number) {
  if (tab !== Tabs.ARCHIVE) return [...(items || [])].sort((a, b) => videoTemporalComparator(b, a));
  return (items || [])
    .map((item, index) => ({
      item,
      index,
      endTime: videoEndTimestamp(item),
      id: String(item?.id || ""),
    }))
    .sort((a, b) => {
      const diff = b.endTime - a.endTime;
      if (diff) return diff;
      const idDiff = b.id.localeCompare(a.id);
      if (idDiff) return idDiff;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

function sortPayloadForTab(payload: any, tab: number) {
  if (tab !== Tabs.ARCHIVE) return payload;
  if (Array.isArray(payload)) return sortForTab(payload, tab);
  if (payload?.items && Array.isArray(payload.items))
    return { ...payload, items: sortForTab(payload.items, tab) };
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
    () => ({
      xs: 1 + currentGridSize,
      sm: 2 + currentGridSize,
      md: 3 + currentGridSize,
      lg: 4 + currentGridSize,
      xl: 5 + currentGridSize,
    }),
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
          const v1IsPlaceholder = v1.type === "placeholder";
          const v2IsPlaceholder = v2.type === "placeholder";
          if (v1IsPlaceholder && v2IsPlaceholder) return 0;
          return v1IsPlaceholder ? 1 : -1;
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
  const loaderCacheKey = [
    "vlx",
    isFavPage ? "fav" : "home",
    tab,
    scrollMode ? "scroll" : "page",
    selectedHomeOrgsKey,
    orgTargetsOverrideKey,
    toDate || "",
    clipLangsKey,
  ].join("-");

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
    const inclusion =
      (
        {
          [Tabs.ARCHIVE]: "mentions,clips",
          [Tabs.LIVE_UPCOMING]: "mentions",
          [Tabs.CLIPS]: "mentions",
        } as Record<number, string>
      )[tabValue] ?? "";
    return {
      status: tabValue === Tabs.ARCHIVE ? "past,missing" : "past",
      type: tabValue === Tabs.ARCHIVE ? "stream" : "clip",
      include: inclusion,
      lang: clipLangs.join(","),
      paginated: false,
      ...(toDate && { to: nearestUTCDate(dayjs(toDate)) }),
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
    const orgPage1Promises = orgTargets.map((org) =>
      api
        .videos({ ...baseQuery, org, limit: API_MAX_LIMIT, offset: 0 })
        .then((res: any) => extractVideoItems(res.data))
        .catch(() => [] as any[]),
    );
    const page1 = Promise.all(orgPage1Promises).then((page1Items) => {
      const merged = dedupeVideos(page1Items.flat());
      return sortForTab(merged, tabValue);
    });
    const full = Promise.all(orgPage1Promises).then(async (page1Items) => {
      const needsPage2 = orgTargets
        .map((org, i) => ({ org, index: i }))
        .filter(({ index }) => page1Items[index].length >= API_MAX_LIMIT);
      const page2Flat = needsPage2.length
        ? (
            await Promise.allSettled(
              needsPage2.map(({ org }) =>
                api.videos({
                  ...baseQuery,
                  org,
                  limit: API_MAX_LIMIT,
                  offset: API_MAX_LIMIT,
                }),
              ),
            )
          ).flatMap((r) =>
            r.status === "fulfilled"
              ? extractVideoItems((r.value as any).data)
              : [],
          )
        : [];
      const merged = dedupeVideos(page1Items.flat().concat(page2Flat));
      return sortForTab(merged, tabValue);
    });
    multiOrgDataCache.set(cacheKey, { page1, full });
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
    if (orgTargets.length === 1) {
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
    const cacheKey = loaderCacheKey;
    startMultiOrgFetch(cacheKey, query, orgTargets);
    [Tabs.ARCHIVE, Tabs.CLIPS].forEach((otherTab) => {
      if (otherTab === tab) return;
      const key = cacheKeyForTab(otherTab);
      if (!multiOrgDataCache.has(key))
        startMultiOrgFetch(key, buildTabQuery(otherTab), orgTargets, otherTab);
    });
    const cached = multiOrgDataCache.get(cacheKey)!;
    const page1Threshold = API_MAX_LIMIT * orgTargets.length;
    return async (offset: number, limit: number) => {
      const all =
        offset + limit <= page1Threshold
          ? await cached.page1
          : await cached.full;
      const slice = all.slice(offset, offset + limit);
      if (!scrollMode) {
        const fullData = await Promise.race([
          cached.full.then((d: any[]) => d),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 0)),
        ]);
        return { items: slice, total: fullData ? fullData.length : all.length };
      }
      return slice;
    };
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
            {showLiveLoading ? (
              <SkeletonCardList
                cols={colSizes}
                dense={currentGridSize > 0}
                denseList={homeViewMode === "denseList"}
                horizontal={homeViewMode === "list"}
              />
            ) : null}
            {lives.length || upcoming.length ? (
              <div>
                <VideoCardList
                  {...attrs}
                  videos={homeViewMode === "grid" || app.settings.hideUpcoming ? lives : live}
                  includeChannel
                  includeAvatar={shouldIncludeAvatar}
                  cols={colSizes}
                  dense={currentGridSize > 0}
                  filterConfig={filterConfig}
                  denseList={homeViewMode === "denseList"}
                  horizontal={homeViewMode === "list"}
                  inMultiViewSelector={inMultiViewSelector}
                  fadeUnderNavExt={false}
                />
                {homeViewMode === "grid" ? (
                  <>
                    {lives.length && upcoming.length ? (
                      <div className="my-3 h-px bg-[color:var(--color-border)]" />
                    ) : null}
                    <VideoCardList
                      {...attrs}
                      videos={upcoming}
                      includeChannel
                      includeAvatar={shouldIncludeAvatar}
                      cols={colSizes}
                      dense={currentGridSize > 0}
                      filterConfig={filterConfig}
                      denseList={false}
                      horizontal={false}
                      inMultiViewSelector={inMultiViewSelector}
                      fadeUnderNavExt={false}
                    />
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
                <VideoCardList
                  {...attrs}
                  videos={data}
                  includeChannel
                  includeAvatar={shouldIncludeAvatar}
                  cols={colSizes}
                  dense={currentGridSize > 0}
                  filterConfig={filterConfig}
                  denseList={homeViewMode === "denseList"}
                  horizontal={homeViewMode === "list"}
                  inMultiViewSelector={inMultiViewSelector}
                  fadeUnderNavExt={false}
                />
              </div>
              {lod && data.length === 0 ? (
                <SkeletonCardList
                  cols={colSizes}
                  dense={currentGridSize > 0}
                  denseList={homeViewMode === "denseList"}
                  horizontal={homeViewMode === "list"}
                />
              ) : null}
            </>
          )}
        </GenericListLoader>
      )}
    </div>
  );
}
