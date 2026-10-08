"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { VideoListTopControls } from "@/components/nav/VideoListTopControls";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { GenericListLoader } from "@/components/video/GenericListLoader";
import { SkeletonCardList } from "@/components/video/SkeletonCardList";
import { VideoCardList } from "@/components/video/VideoCardList";
import { ALL_VTUBERS_ORG } from "@/lib/consts";
import { HOME_TABS } from "@/lib/cookie-codec";
import { type DisplayMode, displayModeFor } from "@/lib/display-mode";
import { getLiveViewerCount } from "@/lib/functions";
import {
  buildHomeTabQuery,
  clearHomeMultiOrgVideoCache,
  ensureFavoritesVideoFetch,
  ensureHomeMultiOrgVideoFetch,
  getHomeMultiOrgVideoCache,
} from "@/lib/home-video-loader";
import { useDomElement } from "@/lib/hooks";
import { runWhenSettled } from "@/lib/idle";
import { useAppState } from "@/lib/store";
import { getBreakpoint } from "@/lib/utils";

type AppState = ReturnType<typeof useAppState>;

const NO_LANGS: string[] = [];
const NO_VIDEOS: any[] = [];
const OTHER_TABS = [HOME_TABS.ARCHIVE, HOME_TABS.CLIPS];

function getHomeCachedLoaderPage(cacheKey: string, page: number, limit: number) {
  const cached = getHomeMultiOrgVideoCache(cacheKey);
  if (!cached?.isReady()) return null;
  const offset = (page - 1) * limit;
  const snap = cached.getCurrentItems();
  if (!cached.isExhausted() && offset + limit > snap.length) return null;
  return {
    items: snap.slice(offset, offset + limit),
    offset,
    total: cached.isExhausted() ? snap.length : Math.max(snap.length + limit, offset + limit),
  };
}

// Loads more of a cached video list until it holds `count` items or runs out. Each page needs
// the previous page's cursor, so pages are fetched one after another.
async function fetchCacheUntil(
  cached: { getCurrentItems: () => any[]; isExhausted: () => boolean; fetchMore: () => any },
  count: number,
): Promise<void> {
  if (count <= cached.getCurrentItems().length || cached.isExhausted()) return;
  await cached.fetchMore();
  return fetchCacheUntil(cached, count);
}

// Columns per breakpoint grow with the grid density; avatars hide once cards get too narrow.
function useListGeometry(windowWidth: number, gs: number) {
  const cols = useMemo(
    () => ({ xs: 1 + gs, sm: 2 + gs, md: 3 + gs, lg: 4 + gs, xl: 5 + gs }),
    [gs],
  );
  const bp = useMemo(
    () => getBreakpoint(windowWidth || (typeof window !== "undefined" ? window.innerWidth : 1440)),
    [windowWidth],
  );
  const includeAvatar = !((bp === "md" && gs > 1) || ((bp === "sm" || bp === "xs") && gs > 0));
  return { cols, includeAvatar, perRow: cols[bp] || 5 + gs };
}

// Cache key per tab for this list's identity (home/favorites, scroll/page mode, grid size, org
// selection, date and clip languages), and the orgs the list fetches.
function useListKeys(
  app: AppState,
  {
    isFavPage,
    toDate,
    clipLangs,
    orgTargetsOverride,
  }: {
    isFavPage: boolean;
    toDate: string | null;
    clipLangs: string[];
    orgTargetsOverride: any[] | null;
  },
) {
  const scrollMode = app.settings.scrollMode;
  const gs = app.currentGridSize;
  const orgsKey = JSON.stringify(app.selectedHomeOrgs || []);
  const overrideKey = JSON.stringify(orgTargetsOverride || []);
  const langsKey = JSON.stringify(clipLangs || []);
  const activeOrgs = isFavPage ? [] : app.selectedHomeOrgs || [];
  const activeOrgsKey = activeOrgs.join("\0");

  const keyFor = useCallback(
    (tv: number, fav = isFavPage) =>
      [
        "vlx",
        fav ? "fav" : "home",
        tv,
        scrollMode ? "scroll" : "page",
        gs,
        fav ? "" : orgsKey,
        fav ? "" : overrideKey,
        toDate || "",
        langsKey,
      ].join("-"),
    [isFavPage, scrollMode, gs, orgsKey, overrideKey, toDate, langsKey],
  );
  // Rebuilt from the keys so it only changes when the org selection does.
  const targets = useMemo(() => {
    const override: any[] = JSON.parse(overrideKey);
    if (override.length) return override;
    return activeOrgsKey ? activeOrgsKey.split("\0") : [ALL_VTUBERS_ORG];
  }, [overrideKey, activeOrgsKey]);
  return { orgsKey, keyFor, targets, activeOrgCount: activeOrgs.length };
}

// Which videos the list hides, per the user's settings and the orgs being shown.
function useFilterConfig(
  app: AppState,
  {
    isFavPage,
    tab,
    targets,
    activeOrgCount,
  }: { isFavPage: boolean; tab: number; targets: any[]; activeOrgCount: number },
) {
  const { hidePlaceholder, hideMissing, hideUpcoming, hideLive } = app.settings;
  const hideCollabs =
    tab !== HOME_TABS.CLIPS && app.settings.hideCollabStreams && (isFavPage || activeOrgCount > 0);
  const filterOrg = isFavPage
    ? "none"
    : targets.length > 1
      ? ALL_VTUBERS_ORG
      : targets[0] || app.currentOrg.name;
  return useMemo(
    () => ({
      forOrg: filterOrg,
      forOrgs: isFavPage ? undefined : targets,
      hideCollabs,
      hidePlaceholder,
      hideMissing,
      hideUpcoming,
      hideLive,
    }),
    [
      filterOrg,
      isFavPage,
      targets,
      hideCollabs,
      hidePlaceholder,
      hideMissing,
      hideUpcoming,
      hideLive,
    ],
  );
}

// The live/upcoming list: the caller's override (multiview), else the store's favorites or home
// list with its loading state.
function liveListState(app: AppState, liveContent: any[] | null, isFavPage: boolean) {
  if (liveContent !== null)
    return { liveSource: liveContent ?? NO_VIDEOS, isLoading: false, hasError: false };
  if (isFavPage)
    return {
      liveSource: app.favoritesLive,
      isLoading: app.favoritesLoading,
      hasError: app.favoritesError,
    };
  return { liveSource: app.homeLive, isLoading: app.homeLoading, hasError: app.homeError };
}

// Concurrent-viewer counts (`_ccv`) are injected into the live list server-side, straight
// from YouTube/Twitch, so the list arrives already sort-ready — just order by it.
function useSortedLive(
  liveSource: any[],
  sortBy: string,
  { hideLive, hideUpcoming }: { hideLive: boolean; hideUpcoming: boolean },
) {
  const live = useMemo(
    () =>
      sortBy === "viewers"
        ? [...liveSource].sort((a, b) => getLiveViewerCount(b) - getLiveViewerCount(a))
        : liveSource,
    [liveSource, sortBy],
  );
  const { livesVisible, upcoming } = useMemo(
    () => ({
      livesVisible: hideLive ? [] : live.filter((v: any) => v.status === "live"),
      upcoming: hideUpcoming
        ? []
        : live
            .filter((v: any) => v.status === "upcoming")
            .sort((a: any, b: any) =>
              a.available_at !== b.available_at || a.type === b.type
                ? 0
                : a.type === "placeholder"
                  ? 1
                  : -1,
            ),
    }),
    [live, hideLive, hideUpcoming],
  );
  return { live, livesVisible, upcoming };
}

// In grid mode live and upcoming streams are separate grids; the list modes show the live list
// (or just the live streams when upcoming ones are hidden) as one.
function liveUpcomingLayout(
  gridMode: boolean,
  hideUpcoming: boolean,
  { live, livesVisible, upcoming }: { live: any[]; livesVisible: any[]; upcoming: any[] },
) {
  const first = gridMode || hideUpcoming ? livesVisible : live;
  return { first, total: gridMode ? livesVisible.length + upcoming.length : first.length };
}

// Register this list as the poll focus: the store's central poll refreshes the complete
// on-screen live list every 60s. Overridden lists (multiview) run their own refresh.
function useLivePollFocus(enabled: boolean, focus: "favorites" | "home") {
  const { setLivePollFocus } = useAppState();
  useEffect(() => {
    if (!enabled) return;
    setLivePollFocus(focus);
    return () => setLivePollFocus(null);
  }, [enabled, focus, setLivePollFocus]);
}

// Fetches the live list once the store hydrates, starts the list over when the org selection
// changes, and refreshes whichever tab becomes active.
function useListTracking({
  orgsKey,
  isActive,
  isFavPage,
  tab,
  liveContent,
  liveLength,
  cacheKey,
}: {
  orgsKey: string;
  isActive: boolean;
  isFavPage: boolean;
  tab: number;
  liveContent: any[] | null;
  liveLength: number;
  cacheKey: string;
}) {
  const app = useAppState();
  const hydrated = app.hydrated;
  const prevOrgsKey = useRef<string | null>(null);
  const prevTab = useRef<number | null>(null);

  function init(force: boolean) {
    if (isFavPage) {
      if (force) app.fetchFavorites();
      if (app.favoriteChannelIDs.size > 0 && app.isLoggedIn)
        app.fetchFavoritesLive({ force: force || liveLength === 0, minutes: 2 });
    } else if (!liveContent?.length) {
      app.fetchHomeLive({ force: liveLength === 0, minutes: 2 });
    }
  }

  // Store reads and actions for the effects below; they should not re-run the effects.
  const refreshLive = useEffectEvent((force: boolean) => init(force));
  const startTracking = useEffectEvent(() => {
    init(true);
    prevOrgsKey.current = orgsKey;
    prevTab.current = tab;
  });
  const isHydrated = useEffectEvent(() => hydrated);
  const refreshTabCache = useEffectEvent(() => {
    // Freshen the newly shown tab's warmed cache if it has gone stale — replaces the old
    // rolling 60s background re-fetch of every off-screen tab.
    const entry = getHomeMultiOrgVideoCache(cacheKey);
    if (entry?.isReady() && entry.isStale(60_000)) void entry.refresh();
  });

  useEffect(() => {
    if (hydrated) startTracking();
  }, [hydrated]);

  useEffect(() => {
    if (!isHydrated()) return;
    if (prevOrgsKey.current === null) {
      prevOrgsKey.current = orgsKey;
      return;
    }
    if (prevOrgsKey.current === orgsKey) return;
    prevOrgsKey.current = orgsKey;
    if (!isActive || isFavPage) return;
    // A changed org selection represents a new list. Leaving the viewport near the old
    // list's bottom can make the new sentinel immediately pull in several pages.
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    clearHomeMultiOrgVideoCache();
    if (tab === HOME_TABS.LIVE_UPCOMING) refreshLive(false);
  }, [orgsKey, isActive, isFavPage, tab]);

  useEffect(() => {
    if (prevTab.current === null) {
      prevTab.current = tab;
      return;
    }
    const old = prevTab.current;
    prevTab.current = tab;
    if (!isActive || tab === old) return;
    if (tab === HOME_TABS.LIVE_UPCOMING) refreshLive(false);
    else refreshTabCache();
  }, [tab, isActive]);
}

// Only mount a capped window of live/upcoming cards, revealing more on scroll (append-only, so
// nothing ever unmounts -> no thumbnail reload). Keeps switching tabs and resizing cheap even
// with 100+ streams.
function useLiveWindow({
  cacheKey,
  perRow,
  tab,
  total,
}: {
  cacheKey: string;
  perRow: number;
  tab: number;
  total: number;
}) {
  const [liveLimit, setLiveLimit] = useState(60);
  const liveSentinel = useRef<HTMLDivElement | null>(null);
  // Reset the window when the list identity changes (tab/org/fav switch), then grow on scroll.
  // The initial window must extend past the observer's lookahead margin below the first
  // viewport; otherwise the sentinel is immediately "near" and the list grows in several quick
  // steps right after the switch, making the page height (and scrollbar) visibly jump.
  // (Adjusted during render.)
  const [liveLimitKey, setLiveLimitKey] = useState(cacheKey);
  if (liveLimitKey !== cacheKey) {
    setLiveLimitKey(cacheKey);
    setLiveLimit(Math.max(perRow * 10, 60));
  }
  useEffect(() => {
    if (tab !== HOME_TABS.LIVE_UPCOMING || liveLimit >= total) return;
    const el = liveSentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setLiveLimit((l) => l + perRow * 8);
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [tab, perRow, cacheKey, liveLimit, total]);
  return { liveLimit, liveSentinel };
}

// Warm the other tabs' caches once so switching to them is instant. Each cache is then
// freshened on activation (tab-change effect above) instead of on a rolling 60s timer,
// and the live lists are owned by the store's central poll. Warming waits until the shown
// list has loaded and the page has settled, so it never delays what is on screen.
function useWarmTabCaches(
  app: AppState,
  {
    isActive,
    isFavPage,
    tab,
    shownListLoaded,
    keyFor,
    buildQuery,
    targets,
  }: {
    isActive: boolean;
    isFavPage: boolean;
    tab: number;
    shownListLoaded: boolean;
    keyFor: (tv: number, fav?: boolean) => string;
    buildQuery: (tv: number) => Record<string, any>;
    targets: any[];
  },
) {
  const jwt: string | null = app.userdata.jwt;
  const warmFavorites = !!jwt && app.isLoggedIn && app.favoriteChannelIDs.size > 0;
  const hydrated = app.hydrated;
  useEffect(() => {
    if (!isActive || !hydrated || !shownListLoaded) return;
    return runWhenSettled(() => {
      const contexts = warmFavorites && !isFavPage ? [false, true] : [isFavPage];
      contexts.forEach((fav) => {
        OTHER_TABS.forEach((tv) => {
          if (fav === isFavPage && tv === tab) return;
          const key = keyFor(tv, fav);
          const q = buildQuery(tv);
          if (fav) ensureFavoritesVideoFetch(key, q, jwt!, tv);
          else ensureHomeMultiOrgVideoFetch(key, q, targets, tv);
        });
      });
    });
  }, [
    isActive,
    isFavPage,
    hydrated,
    shownListLoaded,
    warmFavorites,
    jwt,
    tab,
    keyFor,
    buildQuery,
    targets,
  ]);
}

// The list loader reads from the warmed multi-org/favorites cache for this list identity.
function useCachedLoadFn({
  buildQuery,
  tab,
  scrollMode,
  isFavPage,
  jwt,
  cacheKey,
  targets,
}: {
  buildQuery: (tv: number) => Record<string, any>;
  tab: number;
  scrollMode: boolean;
  isFavPage: boolean;
  jwt: string | null;
  cacheKey: string;
  targets: any[];
}) {
  return useMemo(() => {
    // The live tab renders the store's live list, not this loader.
    if (tab === HOME_TABS.LIVE_UPCOMING) return async () => [];
    if (isFavPage && !jwt) return async () => [];
    const query: Record<string, any> = buildQuery(tab);
    query.paginated = !scrollMode;
    // The cache (and its first request) is created when the list first loads, not during render,
    // so neither server rendering nor a render that never commits starts a request. The other
    // tabs are warmed separately once the page has settled (useWarmTabCaches).
    return async (offset: number, limit: number) => {
      if (isFavPage) ensureFavoritesVideoFetch(cacheKey, query, jwt!, tab);
      else ensureHomeMultiOrgVideoFetch(cacheKey, query, targets, tab);
      const cached = getHomeMultiOrgVideoCache(cacheKey)!;
      await cached.page1;
      await fetchCacheUntil(cached, offset + limit);
      const snap = cached.getCurrentItems();
      const slice = snap.slice(offset, offset + limit);
      if (!cached.isExhausted() && snap.length - (offset + limit) < limit * 4) cached.fetchMore();
      return scrollMode
        ? slice
        : { items: slice, total: cached.isExhausted() ? snap.length : snap.length + limit };
    };
  }, [buildQuery, tab, scrollMode, isFavPage, jwt, cacheKey, targets]);
}

// How the list's cards and skeletons are laid out.
type ListLook = {
  attrs: Record<string, any>;
  cols: { xs: number; sm: number; md: number; lg: number; xl: number };
  viewMode: string;
  includeAvatar: boolean;
  skeletonAvatar: boolean;
  filterConfig: ReturnType<typeof useFilterConfig>;
  inMultiViewSelector?: boolean;
};

function HomeVideoList({ look, videos }: { look: ListLook; videos: any[] }) {
  return (
    <VideoCardList
      {...look.attrs}
      videos={videos}
      includeChannel
      includeAvatar={look.includeAvatar}
      cols={look.cols}
      filterConfig={look.filterConfig}
      denseList={look.viewMode === "denseList"}
      horizontal={look.viewMode === "list"}
      inMultiViewSelector={look.inMultiViewSelector}
    />
  );
}

function HomeSkeletons({ look }: { look: ListLook }) {
  const app = useAppState();
  return (
    <SkeletonCardList
      cols={look.cols}
      denseList={look.viewMode === "denseList"}
      horizontal={look.viewMode === "list"}
      includeChannel
      includeAvatar={look.skeletonAvatar}
      hideThumbnail={app.settings.hideThumbnail}
      autoFit={look.attrs.autoFit}
      autoFitMin={look.attrs.autoFitMin}
    />
  );
}

function NoStreams() {
  const t = useTranslations();
  return <div className="m-auto p-5 text-center">{t("views.home.noStreams")}</div>;
}

// The mounted window of live (and, in grid mode, upcoming) cards, with the sentinel that grows
// it on scroll.
function LiveUpcomingWindow({
  look,
  upcoming,
  first,
  liveCount,
  liveLimit,
  total,
  sentinel,
}: {
  look: ListLook;
  upcoming: any[];
  first: any[];
  liveCount: number;
  liveLimit: number;
  total: number;
  sentinel: React.RefObject<HTMLDivElement | null>;
}) {
  const gridMode = look.viewMode === "grid";
  const shownFirst = first.slice(0, liveLimit);
  const shownUpcoming = gridMode ? upcoming.slice(0, Math.max(0, liveLimit - liveCount)) : [];
  return (
    <>
      <HomeVideoList look={look} videos={shownFirst} />
      {gridMode ? (
        <>
          {shownFirst.length > 0 && shownUpcoming.length > 0 ? (
            <Separator className="my-3" />
          ) : null}
          <HomeVideoList look={look} videos={shownUpcoming} />
        </>
      ) : null}
      {liveLimit < total ? <div ref={sentinel} className="h-px w-full" /> : null}
    </>
  );
}

function LiveUpcomingSection({
  look,
  hasError,
  isLoading,
  live,
  upcoming,
  first,
  liveCount,
  liveLimit,
  total,
  sentinel,
}: {
  look: ListLook;
  hasError: boolean;
  isLoading: boolean;
  live: any[];
  upcoming: any[];
  first: any[];
  liveCount: number;
  liveLimit: number;
  total: number;
  sentinel: React.RefObject<HTMLDivElement | null>;
}) {
  if (hasError) return <NoStreams />;
  const hasVisibleLiveUpcoming = liveCount > 0 || upcoming.length > 0;
  return (
    <>
      {isLoading && !hasVisibleLiveUpcoming ? <HomeSkeletons look={look} /> : null}
      {hasVisibleLiveUpcoming ? (
        <LiveUpcomingWindow
          look={look}
          upcoming={upcoming}
          first={first}
          liveCount={liveCount}
          liveLimit={liveLimit}
          total={total}
          sentinel={sentinel}
        />
      ) : null}
      {!isLoading && !live.some((v: any) => v.status === "live") && !upcoming.length ? (
        <NoStreams />
      ) : null}
    </>
  );
}

// Archive and clips tabs page through (or infinitely scroll) the warmed cache.
function PagedVideoSection({
  look,
  cacheKey,
  scrollMode,
  perPage,
  loadFn,
}: {
  look: ListLook;
  cacheKey: string;
  scrollMode: boolean;
  perPage: number;
  loadFn: ReturnType<typeof useCachedLoadFn>;
}) {
  return (
    <GenericListLoader
      cacheKey={cacheKey}
      getCachedPage={scrollMode ? undefined : getHomeCachedLoaderPage}
      infiniteLoad={scrollMode}
      paginate={!scrollMode}
      perPage={perPage}
      loadFn={loadFn}
    >
      {({ data, isLoading: loading, isFetching }) => (
        <>
          {isFetching && data.length > 0 && !scrollMode ? (
            <div className="pointer-events-none relative">
              <div className="absolute inset-0 z-10 flex min-h-32 items-center justify-center rounded-2xl bg-background/70 backdrop-blur-sm">
                <Spinner className="size-6 text-primary" />
              </div>
            </div>
          ) : null}
          <div className={scrollMode || data.length > 0 || !loading ? undefined : "hidden"}>
            <HomeVideoList look={look} videos={data} />
          </div>
          {loading && !data.length ? <HomeSkeletons look={look} /> : null}
          {!loading && !data.length ? <NoStreams /> : null}
        </>
      )}
    </GenericListLoader>
  );
}

// Sort, filter, date, clip language and display controls, portaled into the nav.
function ListControlsPortal({
  target,
  tab,
  isActive,
  sortBy,
  toDate,
  clipLangs,
  onSortByChange,
  onToDateChange,
}: {
  target: HTMLElement | null;
  tab: number;
  isActive: boolean;
  sortBy: string;
  toDate: string | null;
  clipLangs: string[];
  onSortByChange: (value: string) => void;
  onToDateChange: (value: string | null) => void;
}) {
  const app = useAppState();
  const viewMode = app.settings.homeViewMode || "grid";
  if (!target) return null;

  const toggleClipLang = (value: string, checked: boolean) => {
    const next = new Set(clipLangs);
    if (checked) next.add(value);
    else next.delete(value);
    app.patchSettings({ clipLangs: [...next].sort() });
  };

  function setDisplayMode(next: DisplayMode) {
    if (next.startsWith("grid-")) {
      const size = Number(next.slice(5)) || 0;
      if (viewMode !== "grid") app.patchSettings({ homeViewMode: "grid" });
      app.setCurrentGridSize(size);
      return;
    }
    if (viewMode !== next) app.patchSettings({ homeViewMode: next });
    app.setCurrentGridSize(0);
  }

  return createPortal(
    <VideoListTopControls
      tab={tab}
      isActive={isActive}
      sortBy={sortBy}
      displayMode={displayModeFor(viewMode, app.currentGridSize)}
      toDate={toDate}
      clipLangs={clipLangs}
      onSortByChange={onSortByChange}
      onDisplayModeChange={setDisplayMode}
      onToDateChange={onToDateChange}
      onToggleClipLang={toggleClipLang}
    />,
    target,
  );
}

export function ConnectedVideoList({
  liveContent = null,
  isFavPage = false,
  tab = HOME_TABS.LIVE_UPCOMING,
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
  const [toDate, setToDate] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("viewers");

  const clipLangs: string[] = app.settings.clipLangs ?? NO_LANGS;
  const viewMode = app.settings.homeViewMode || "grid";
  const scrollMode = app.settings.scrollMode;
  const { cols, includeAvatar, perRow } = useListGeometry(app.windowWidth, app.currentGridSize);
  const { orgsKey, keyFor, targets, activeOrgCount } = useListKeys(app, {
    isFavPage,
    toDate,
    clipLangs,
    orgTargetsOverride,
  });
  const cacheKey = keyFor(tab);
  const filterConfig = useFilterConfig(app, { isFavPage, tab, targets, activeOrgCount });
  const portalTarget = useDomElement(datePortalName || `date-selector${isFavPage}`);

  const { liveSource, isLoading, hasError } = liveListState(app, liveContent, isFavPage);
  const lists = useSortedLive(liveSource, sortBy, app.settings);
  const { first, total } = liveUpcomingLayout(
    viewMode === "grid",
    app.settings.hideUpcoming,
    lists,
  );

  const buildQuery = useCallback(
    (tv: number) => buildHomeTabQuery({ tab: tv, clipLangs, toDate }),
    [clipLangs, toDate],
  );

  useLivePollFocus(
    isActive && tab === HOME_TABS.LIVE_UPCOMING && liveContent === null,
    isFavPage ? "favorites" : "home",
  );
  useListTracking({
    orgsKey,
    isActive,
    isFavPage,
    tab,
    liveContent,
    liveLength: lists.live.length,
    cacheKey,
  });
  const { liveLimit, liveSentinel } = useLiveWindow({ cacheKey, perRow, tab, total });
  useWarmTabCaches(app, {
    isActive,
    isFavPage,
    tab,
    // The archive/clips loaders show their own progress; the live tab waits for its list.
    shownListLoaded: tab !== HOME_TABS.LIVE_UPCOMING || !isLoading,
    keyFor,
    buildQuery,
    targets,
  });
  const loadFn = useCachedLoadFn({
    buildQuery,
    tab,
    scrollMode,
    isFavPage,
    jwt: app.userdata.jwt,
    cacheKey,
    targets,
  });

  const look: ListLook = {
    attrs,
    cols,
    viewMode,
    includeAvatar,
    skeletonAvatar: tab === HOME_TABS.LIVE_UPCOMING && includeAvatar,
    filterConfig,
    inMultiViewSelector,
  };
  const hideFavs = isFavPage && !(app.isLoggedIn && app.favoriteChannelIDs.size > 0);

  return (
    <div className={hideFavs ? "hidden" : undefined}>
      <ListControlsPortal
        target={portalTarget}
        tab={tab}
        isActive={isActive}
        sortBy={sortBy}
        toDate={toDate}
        clipLangs={clipLangs}
        onSortByChange={setSortBy}
        onToDateChange={setToDate}
      />
      {tab === HOME_TABS.LIVE_UPCOMING ? (
        <LiveUpcomingSection
          look={look}
          hasError={hasError}
          isLoading={isLoading}
          live={lists.live}
          upcoming={lists.upcoming}
          first={first}
          liveCount={lists.livesVisible.length}
          liveLimit={liveLimit}
          total={total}
          sentinel={liveSentinel}
        />
      ) : (
        <PagedVideoSection
          look={look}
          cacheKey={cacheKey}
          scrollMode={scrollMode}
          perPage={perRow * 4}
          loadFn={loadFn}
        />
      )}
    </div>
  );
}
