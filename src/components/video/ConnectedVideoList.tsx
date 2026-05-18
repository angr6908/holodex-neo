"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { ALL_VTUBERS_ORG } from "@/lib/consts";
import { getLiveViewerCount } from "@/lib/functions";
import { useAppState } from "@/lib/store";
import { getBreakpoint } from "@/lib/utils";
import { fetchTwitchViewerCounts, getTwitchLogin, getTwitchViewerCountFingerprint, mergeTwitchViewerCountsIntoVideos, readCachedTwitchViewerCounts } from "@/lib/twitch";
import { GenericListLoader } from "@/components/video/GenericListLoader";
import { SkeletonCardList } from "@/components/video/SkeletonCardList";
import { VideoCardList } from "@/components/video/VideoCardList";
import { VideoListTopControls, type DisplayMode } from "@/components/video/VideoListTopControls";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { useTranslations } from "next-intl";
import { HOME_TABS as Tabs } from "@/lib/cookie-codec";
import { buildHomeTabQuery, clearHomeMultiOrgVideoCache, ensureHomeMultiOrgVideoFetch, getHomeMultiOrgVideoCache, hasHomeMultiOrgVideoCache, sortPayloadForHomeTab } from "@/lib/home-video-loader";
import { useDomElement } from "@/lib/hooks";

export function ConnectedVideoList({
  liveContent = null, isFavPage = false, tab = Tabs.LIVE_UPCOMING, isActive = true,
  datePortalName = "", inMultiViewSelector, orgTargetsOverride = null, ...attrs
}: {
  liveContent?: any[] | null; isFavPage?: boolean; tab?: number; isActive?: boolean;
  datePortalName?: string; inMultiViewSelector?: boolean; orgTargetsOverride?: any[] | null;
  [key: string]: any;
}) {
  const app = useAppState();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const t = useTranslations();
  const [toDate, setToDate] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("viewers");
  const [twCounts, setTwCounts] = useState<Record<string, number>>({});
  const PAGE = 24;
  const prevOrgsKey = useRef<string | null>(null);
  const prevTab = useRef<number | null>(null);

  const clipLangs = app.settings.clipLangs || [];
  const viewMode = app.settings.homeViewMode || "grid";
  const scrollMode = app.settings.scrollMode;
  const prevScroll = useRef(scrollMode);
  const gs = app.currentGridSize;
  const cols = useMemo(() => ({ xs: 1 + gs, sm: 2 + gs, md: 3 + gs, lg: 4 + gs, xl: 5 + gs }), [gs]);
  const bp = useMemo(() => getBreakpoint(app.windowWidth || (typeof window !== "undefined" ? window.innerWidth : 1440)), [app.windowWidth]);
  const includeAvatar = !((bp === "md" && gs > 1) || ((bp === "sm" || bp === "xs") && gs > 0));
  const orgsKey = JSON.stringify(app.selectedHomeOrgs || []);
  const overrideKey = JSON.stringify(orgTargetsOverride || []);
  const langsKey = JSON.stringify(clipLangs || []);
  const activeOrgs = isFavPage ? [] : app.selectedHomeOrgs || [];
  const activeOrgsKey = activeOrgs.join("\0");

  const keyFor = (tv: number) =>
    ["vlx", isFavPage ? "fav" : "home", tv, scrollMode ? "scroll" : "page", orgsKey, overrideKey, toDate || "", langsKey].join("-");
  const cacheKey = keyFor(tab);

  const hideCollabs = tab !== Tabs.CLIPS && app.settings.hideCollabStreams && (isFavPage || activeOrgs.length > 0);
  const targets = useMemo(() => orgTargetsOverride?.length ? orgTargetsOverride : (activeOrgs.length ? activeOrgs : [ALL_VTUBERS_ORG]), [overrideKey, activeOrgsKey]);
  const filterOrg = isFavPage ? "none" : targets.length > 1 ? ALL_VTUBERS_ORG : targets[0] || app.currentOrg.name;
  const filterConfig = useMemo(() => ({
    forOrg: filterOrg,
    forOrgs: isFavPage ? undefined : targets,
    hideCollabs, hidePlaceholder: app.settings.hidePlaceholder, hideMissing: app.settings.hideMissing,
    hideUpcoming: app.settings.hideUpcoming, hideLive: app.settings.hideLive,
  }), [filterOrg, isFavPage, targets, hideCollabs, app.settings.hidePlaceholder, app.settings.hideMissing, app.settings.hideUpcoming, app.settings.hideLive]);
  const portalTarget = useDomElement(datePortalName || `date-selector${isFavPage}`);

  const getLiveSrc = useCallback((): any[] =>
    liveContent?.length ? liveContent : (isFavPage ? app.favoritesLive : app.homeLive),
    [liveContent, isFavPage, app.favoritesLive, app.homeLive]);
  const getTwLogins = useCallback((vs: any[]) =>
    [...new Set((vs || []).filter((v) => v?.status === "live").map(getTwitchLogin).filter((x): x is string => !!x))], []);

  const live = useMemo(() => {
    const list = mergeTwitchViewerCountsIntoVideos(getLiveSrc(), twCounts);
    return sortBy === "viewers" ? [...list].sort((a, b) => getLiveViewerCount(b) - getLiveViewerCount(a)) : list;
  }, [getLiveSrc, sortBy, twCounts]);
  const lives = live.filter((v: any) => v.status === "live");
  const livesVisible = app.settings.hideLive ? [] : lives;
  const upcoming = app.settings.hideUpcoming ? [] : live.filter((v: any) => v.status === "upcoming")
    .sort((a: any, b: any) => a.available_at !== b.available_at || a.type === b.type ? 0 : a.type === "placeholder" ? 1 : -1);
  const waitingTw = tab === Tabs.LIVE_UPCOMING && sortBy === "viewers" && getLiveSrc().some((v: any) => {
    const l = getTwitchLogin(v);
    return v?.status === "live" && !!l && getLiveViewerCount(v) <= 0 && twCounts[l] === undefined;
  });
  const isLoading = isFavPage ? app.favoritesLoading : app.homeLoading;
  const hasError = isFavPage ? app.favoritesError : app.homeError;
  const showLoading = isLoading || waitingTw;

  function init(force: boolean) {
    if (isFavPage) {
      if (force) app.fetchFavorites();
      if (app.favoriteChannelIDs.size > 0 && app.isLoggedIn)
        app.fetchFavoritesLive({ force: force || live.length === 0, minutes: 2 });
    } else if (!liveContent?.length) {
      app.fetchHomeLive({ force: live.length === 0, minutes: 2 });
    }
  }

  const buildQuery = (tv: number) => buildHomeTabQuery({ tab: tv, clipLangs, toDate });

  useEffect(() => {
    if (!isActive) { prevScroll.current = scrollMode; return; }
    const prev = prevScroll.current;
    prevScroll.current = scrollMode;
    if (prev === scrollMode || !scrollMode || !sp.get("page")) return;
    const p = new URLSearchParams(sp.toString());
    p.delete("page");
    const q = p.toString();
    router.replace(`${pathname}${q ? `?${q}` : ""}${typeof window !== "undefined" ? window.location.hash : ""}`);
  }, [scrollMode, isActive, sp, pathname, router]);

  useEffect(() => {
    if (!isActive || tab !== Tabs.LIVE_UPCOMING) return;
    let cancelled = false;
    const setIfChanged = (c: Record<string, number>) =>
      setTwCounts((p) => getTwitchViewerCountFingerprint(c) !== getTwitchViewerCountFingerprint(p) ? c : p);
    const refresh = async () => {
      const logins = getTwLogins(getLiveSrc());
      if (!logins.length) { setIfChanged({}); return; }
      const c = await fetchTwitchViewerCounts(logins);
      if (!cancelled) setIfChanged(c);
    };
    setIfChanged(readCachedTwitchViewerCounts(getTwLogins(getLiveSrc())));
    void refresh();
    const timer = setInterval(refresh, 60_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [isActive, tab, getLiveSrc, getTwLogins]);

  useEffect(() => {
    if (!app.hydrated) return;
    init(true);
    prevOrgsKey.current = orgsKey;
    prevTab.current = tab;
  }, [app.hydrated]);

  useEffect(() => {
    if (!app.hydrated) return;
    if (prevOrgsKey.current === null) { prevOrgsKey.current = orgsKey; return; }
    if (prevOrgsKey.current === orgsKey) return;
    prevOrgsKey.current = orgsKey;
    if (!isActive || isFavPage) return;
    clearHomeMultiOrgVideoCache();
    if (tab === Tabs.LIVE_UPCOMING) init(false);
  }, [orgsKey, isActive, isFavPage, tab]);

  useEffect(() => {
    if (prevTab.current === null) { prevTab.current = tab; return; }
    const old = prevTab.current;
    prevTab.current = tab;
    if (!isActive) return;
    if (tab !== old && tab === Tabs.LIVE_UPCOMING) init(false);
  }, [tab, isActive]);

  useEffect(() => {
    if (targets.length > 1 && !isFavPage)
      [Tabs.ARCHIVE, Tabs.CLIPS].forEach((tv) => ensureHomeMultiOrgVideoFetch(keyFor(tv), buildQuery(tv), targets, tv));
  }, [targets.join("\0"), isFavPage, scrollMode, langsKey, toDate]);

  const toggleClipLang = (v: string, checked: boolean) => {
    const n = new Set(clipLangs);
    checked ? n.add(v) : n.delete(v);
    app.patchSettings({ clipLangs: [...n].sort() });
  };

  const displayMode: DisplayMode = viewMode === "list" ? "list"
    : viewMode === "denseList" ? "denseList"
    : (`grid-${Math.min(Math.max(gs, 0), 2)}` as DisplayMode);

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

  function getLoadFn() {
    const query = buildQuery(tab);
    query.paginated = !scrollMode;
    if (isFavPage) return async (offset: number, limit: number) => {
      if (!app.userdata.jwt) return [];
      const res = await api.favoritesVideos(app.userdata.jwt, { ...query, limit, offset }).catch(async (err: any) => {
        if (err?.response?.status === 401) { await app.loginVerify({ bounceToLogin: true }); return { data: [] }; }
        throw err;
      });
      return sortPayloadForHomeTab(res.data, tab);
    };
    if (targets.length === 1 && tab !== Tabs.ARCHIVE) return async (offset: number, limit: number) => {
      const res: any = await api.videos({ ...query, org: targets[0], limit, offset });
      return sortPayloadForHomeTab(res.data, tab);
    };
    ensureHomeMultiOrgVideoFetch(cacheKey, query, targets, tab);
    if (targets.length > 1) [Tabs.ARCHIVE, Tabs.CLIPS].forEach((ot) => {
      if (ot === tab) return;
      const k = keyFor(ot);
      if (!hasHomeMultiOrgVideoCache(k)) ensureHomeMultiOrgVideoFetch(k, buildQuery(ot), targets, ot);
    });
    const cached = getHomeMultiOrgVideoCache(cacheKey)!;
    return async (offset: number, limit: number) => {
      await cached.page1;
      while (offset + limit > cached.getCurrentItems().length && !cached.isExhausted()) await cached.fetchMore();
      const snap = cached.getCurrentItems();
      const slice = snap.slice(offset, offset + limit);
      if (!cached.isExhausted() && snap.length - (offset + limit) < limit * 4) cached.fetchMore();
      if (!scrollMode) return { items: slice, total: cached.isExhausted() ? snap.length : snap.length + limit };
      return slice;
    };
  }

  const skeletons = <SkeletonCardList cols={cols} dense={gs > 0} denseList={viewMode === "denseList"} horizontal={viewMode === "list"} />;

  const renderList = (vs: any[], opts: { denseList?: boolean; horizontal?: boolean } = {}) => (
    <VideoCardList {...attrs} videos={vs} includeChannel includeAvatar={includeAvatar} cols={cols} dense={gs > 0}
      filterConfig={filterConfig}
      denseList={opts.denseList ?? viewMode === "denseList"}
      horizontal={opts.horizontal ?? viewMode === "list"}
      inMultiViewSelector={inMultiViewSelector} fadeUnderNavExt={false} />
  );

  const controls = <VideoListTopControls tab={tab} isActive={isActive} sortBy={sortBy} displayMode={displayMode} toDate={toDate} clipLangs={clipLangs}
    onSortByChange={setSortBy} onDisplayModeChange={setDisplayMode} onToDateChange={setToDate} onToggleClipLang={toggleClipLang} />;

  const hideFavs = isFavPage && !(app.isLoggedIn && app.favoriteChannelIDs.size > 0);

  return (
    <div className={hideFavs ? "hidden" : undefined}>
      {portalTarget ? createPortal(controls, portalTarget) : null}
      {tab === Tabs.LIVE_UPCOMING ? (
        hasError ? <div className="m-auto p-5 text-center text-destructive">{t("views.home.apiError") || "Failed to load live data. Please try again."}</div>
        : (
          <>
            {showLoading ? skeletons : null}
            {livesVisible.length || upcoming.length ? (
              <div>
                {renderList(viewMode === "grid" || app.settings.hideUpcoming ? livesVisible : live)}
                {viewMode === "grid" ? (
                  <>
                    {livesVisible.length && upcoming.length ? <Separator className="my-3" /> : null}
                    {renderList(upcoming, { denseList: false, horizontal: false })}
                  </>
                ) : null}
              </div>
            ) : null}
            {!showLoading && !lives.length && !upcoming.length ? <div className="m-auto p-5 text-center">{t("views.home.noStreams")}</div> : null}
          </>
        )
      ) : (
        <GenericListLoader key={cacheKey} cacheKey={cacheKey} infiniteLoad={scrollMode} paginate={!scrollMode} perPage={PAGE} loadFn={getLoadFn()}>
          {({ data, isLoading: lod }) => (
            <>
              {lod && data.length > 0 && !scrollMode ? (
                <div className="pointer-events-none relative">
                  <div className="absolute inset-0 z-10 flex min-h-32 items-center justify-center rounded-2xl bg-background/70 backdrop-blur-sm">
                    <Spinner className="size-6 text-primary" />
                  </div>
                </div>
              ) : null}
              <div className={scrollMode || data.length > 0 || !lod ? undefined : "hidden"}>{renderList(data)}</div>
              {lod && !data.length ? skeletons : null}
            </>
          )}
        </GenericListLoader>
      )}
    </div>
  );
}
