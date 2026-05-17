"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "@/lib/icons";
import { useAppState } from "@/lib/store";
import { useTranslations } from "next-intl";
import { encodeCookieJson, HOME_STATE_COOKIE, type HomeUiState } from "@/lib/cookie-codec";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia } from "@/components/ui/empty";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ApiErrorMessage } from "@/components/common/ApiErrorMessage";
import { ConnectedVideoList } from "@/components/video/ConnectedVideoList";
import { cn } from "@/lib/utils";
import { openUserMenu, readJSON, writeJSON } from "@/lib/browser";
import { ChannelsPage } from "@/components/channel/ChannelsPage";
import { useSwipeTabs } from "@/lib/hooks";
import { HomeSidePanel } from "@/components/home/HomeSidePanel";
import { clearSavedHomePageState, getSavedHomePageState, HOME_STATE_STORAGE_KEY, HOME_TABS as Tabs, primeHomePageState } from "@/lib/cookie-codec";
// Module-level store: persists across soft navigations, resets on hard refresh.
const scrollPositionStore = new Map<string, number>();

function scrollKeyFor(fp: boolean, vm: "streams" | "channels", t: number): string {
  const prefix = fp ? "fav" : "home";
  return vm === "channels" ? `${prefix}-channels` : `${prefix}-streams-${t}`;
}

function readStoredDefaultOpen() {
  if (typeof window === "undefined") return null;
  return readJSON<{ defaultOpen?: string | null }>("holodex-v2-settings", {}).defaultOpen || null;
}

function normalizeHomeState(input?: HomeUiState | null): HomeUiState | null {
  if (!input || typeof input !== "object") return null;
  const out: HomeUiState = {};
  if (input.viewMode === "channels" || input.viewMode === "streams") out.viewMode = input.viewMode;
  if (typeof input.isFavPage === "boolean") out.isFavPage = input.isFavPage;
  if (typeof input.tab === "number" && input.tab >= 0 && input.tab <= 2) out.tab = input.tab;
  if (typeof input.scrollY === "number" && input.scrollY >= 0) out.scrollY = input.scrollY;
  return out;
}

export function HomePage({
  initialHomeState,
}: {
  initialHomeState?: HomeUiState | null;
}) {
  const app = useAppState();
  const router = useRouter();
  const t = useTranslations();
  const initialState = normalizeHomeState(initialHomeState);
  const savedHomePageState = getSavedHomePageState();
  // savedHomePageState (module-level) takes priority over SSR cookie on soft-nav back.
  const [tab, setTabState] = useState<number>(
    savedHomePageState?.tab ?? initialState?.tab ?? Tabs.LIVE_UPCOMING,
  );
  const [isFavPage, setIsFavPage] = useState(
    savedHomePageState?.isFavPage ?? initialState?.isFavPage ?? app.settings.defaultOpen === "favorites",
  );
  const [viewMode, setViewMode] = useState<"streams" | "channels">(
    savedHomePageState?.viewMode ?? initialState?.viewMode ?? "streams",
  );
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const appRef = useRef(app);
  const isFavPageRef = useRef(isFavPage);
  const homeStateRef = useRef({ viewMode, isFavPage, tab });
  const initialHomeStateRef = useRef(initialState);
  const lastLogoHomeTrigger = useRef<number | null>(null);
  const asideRef = useRef<HTMLElement | null>(null);
  const homeRoot = useRef<HTMLElement | null>(null);

  useEffect(() => {
    appRef.current = app;
  }, [app]);
  useEffect(() => {
    isFavPageRef.current = isFavPage;
  }, [isFavPage]);
  useEffect(() => {
    homeStateRef.current = { viewMode, isFavPage, tab };
  }, [viewMode, isFavPage, tab]);
  // Real-time scroll saving so unmount timing doesn't matter.
  useEffect(() => {
    const key = scrollKeyFor(isFavPage, viewMode, tab);
    function onScroll() { scrollPositionStore.set(key, window.scrollY); }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isFavPage, viewMode, tab]);
  useEffect(
    () => () => {
      // Save full page state for soft-nav back; do NOT persist scrollY to cookie.
      const { viewMode: vm, isFavPage: fp, tab: t } = homeStateRef.current;
      const typedVm = vm as "streams" | "channels";
      primeHomePageState({ tab: t, isFavPage: fp, viewMode: typedVm });
      // scrollPositionStore already has latest scroll from the event listener above.
      saveState({ ...homeStateRef.current, scrollY: 0 });
    },
    [],
  );

  const live = isFavPage ? app.favoritesLive : app.homeLive;
  const hasError = isFavPage ? app.favoritesError : app.homeError;
  const hideUpcoming = app.settings.hideUpcoming;
  const hideLive = app.settings.hideLive;
  const hideBothLiveUpcoming = hideLive && hideUpcoming;
  const lives = live.filter((v: any) => v.status === "live");
  const livesVisible = hideLive ? [] : lives;
  const upcoming = hideUpcoming
    ? []
    : live.filter((v: any) => v.status === "upcoming");
	  const liveUpcomingHeaderSplit = useMemo(() => {
	    const match = String(
	      t("views.home.liveOrUpcomingHeading") || "Live / Upcoming",
	    ).match(/(.+)([\/／・].+)/);
	    return match || ["", t("views.home.liveLabel"), ` / ${t("views.home.upcomingLabel")}`];
	  }, [t]);
  const activeTabClass =
    "data-[state=on]:bg-[color:var(--color-bold)] data-[state=on]:text-white data-[state=on]:hover:bg-[color:var(--color-bold)] data-[state=on]:hover:text-white dark:data-[state=on]:hover:bg-[color:var(--color-bold)]";
  const inactiveTabClass =
    "data-[state=off]:text-[color:var(--color-muted-foreground)] data-[state=off]:hover:bg-white/8 data-[state=off]:hover:text-[color:var(--color-foreground)] dark:data-[state=off]:hover:bg-white/8";
  const countBadgeClass =
    "h-5 min-w-6 rounded-full border-[color:var(--color-border)] bg-[color:var(--color-card)] px-1.5 py-0 text-[10px] leading-none tracking-normal text-[color:var(--color-muted-foreground)] sm:text-[11px]";

  function currentScrollKey() {
    return scrollKeyFor(isFavPage, viewMode, tab);
  }

  function saveState(next: HomeUiState = { viewMode, isFavPage, tab }) {
    const value = {
      viewMode: next.viewMode ?? viewMode,
      isFavPage: next.isFavPage ?? isFavPage,
      tab: next.tab ?? tab,
      scrollY: next.scrollY ?? (typeof window !== "undefined" ? window.scrollY : 0),
    };
    try {
      writeJSON(HOME_STATE_STORAGE_KEY, value);
      const encoded = encodeCookieJson(value);
      if (encoded) document.cookie = `${HOME_STATE_COOKIE}=${encoded}; Path=/; SameSite=Lax`;
    } catch {}
  }

  const restoreScroll = (key?: string) =>
    setTimeout(() => window.scrollTo(0, scrollPositionStore.get(key ?? currentScrollKey()) || 0), 0);

  function resetAllHomeScrollbars() {
    scrollPositionStore.clear();
    clearSavedHomePageState();
    const resetEl = (el: Element | null | undefined) => {
      if (el instanceof HTMLElement) { el.scrollTop = 0; el.scrollLeft = 0; }
    };
    resetEl(asideRef.current);
    resetEl(homeRoot.current);
    const root = homeRoot.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>("*").forEach((el) => {
      const s = window.getComputedStyle(el);
      const scrollable = ["auto", "scroll", "overlay"];
      if ((scrollable.includes(s.overflowY) && el.scrollHeight > el.clientHeight) ||
          (scrollable.includes(s.overflowX) && el.scrollWidth > el.clientWidth)) resetEl(el);
    });
  }

  const refreshCurrentLive = (a = app, favPage = isFavPage, force = false) =>
    favPage ? a.fetchFavoritesLive({ force }) : a.fetchHomeLive({ force });

  function init(updateFavorites = false, favOverride = isFavPage) {
    if (favOverride) {
      if (updateFavorites) app.fetchFavorites();
      if (app.favoriteChannelIDs.size > 0 && app.isLoggedIn)
        app.fetchFavoritesLive({ force: updateFavorites || app.favoritesLive.length === 0, minutes: 2 });
    } else {
      app.fetchHomeLive({ force: updateFavorites || app.homeLive.length === 0, minutes: 2 });
    }
  }

  function setAutoRefresh() {
    if (refreshTimer.current) clearInterval(refreshTimer.current);
    refreshTimer.current = setInterval(() => refreshCurrentLive(appRef.current, isFavPageRef.current), 120_000);
  }

  function setTab(nextTab: number) {
    if (nextTab === tab) return;
    scrollPositionStore.set(currentScrollKey(), window.scrollY);
    setTabState(nextTab);
    saveState({ viewMode, isFavPage, tab: nextTab });
    restoreScroll(scrollKeyFor(isFavPage, viewMode, nextTab));
  }

  const swipeTabs = useSwipeTabs((direction) =>
    setTab(Math.max(0, Math.min(2, tab + direction))),
  );

  function switchTo(nextFav: boolean, nextVm: "streams" | "channels", nextTab: number, refetch = false) {
    scrollPositionStore.set(currentScrollKey(), window.scrollY);
    setIsFavPage(nextFav);
    setViewMode(nextVm);
    setTabState(nextTab);
    saveState({ viewMode: nextVm, isFavPage: nextFav, tab: nextTab });
    const newKey = scrollKeyFor(nextFav, nextVm, nextTab);
    if (refetch) setTimeout(() => { init(true, nextFav); restoreScroll(newKey); }, 0);
    else restoreScroll(newKey);
  }
  const switchToHome = () => { if (isFavPage || viewMode !== "streams") switchTo(false, "streams", tab, true); };
  const switchToFavorites = () => { if (!isFavPage || viewMode !== "streams") switchTo(true, "streams", tab, true); };
  const switchToStreams = (nextTab: number) => switchTo(isFavPage, "streams", nextTab);
  const switchToChannels = () => switchTo(isFavPage, "channels", tab);

  useEffect(() => {
    if (!app.hydrated) return;
    const defaultOpen = readStoredDefaultOpen() || app.settings.defaultOpen;
    if (defaultOpen === "multiview") {
      router.replace("/multiview");
      return;
    }
    // Use savedHomePageState (module-level) for soft-nav back; fall back to cookie for hard refresh.
    const initialFavPage = savedHomePageState?.isFavPage
      ?? initialHomeStateRef.current?.isFavPage
      ?? defaultOpen === "favorites";
    if (initialFavPage !== isFavPage) setIsFavPage(initialFavPage);
    isFavPageRef.current = initialFavPage;
    const initialVm = (savedHomePageState?.viewMode ?? initialHomeStateRef.current?.viewMode ?? "streams") as "streams" | "channels";
    const rawInitialTab = savedHomePageState?.tab ?? initialHomeStateRef.current?.tab ?? Tabs.LIVE_UPCOMING;
    const initialTab = rawInitialTab === Tabs.LIVE_UPCOMING && appRef.current.settings.hideLive && appRef.current.settings.hideUpcoming ? Tabs.ARCHIVE : rawInitialTab;
    if (savedHomePageState) {
      if (initialVm !== viewMode) setViewMode(initialVm);
      if (initialTab !== tab) setTabState(initialTab);
    }
    init(true, initialFavPage);
    window.history.scrollRestoration = "manual";
    // Restore scroll: retry with rAF until the page is tall enough or we give up.
    const savedScroll = scrollPositionStore.get(scrollKeyFor(initialFavPage, initialVm, initialTab)) ?? 0;
    if (savedScroll > 0) {
      let attempts = 0;
      const tryScroll = () => {
        window.scrollTo(0, savedScroll);
        if (window.scrollY < savedScroll - 5 && attempts < 20) {
          attempts++;
          requestAnimationFrame(tryScroll);
        }
      };
      setTimeout(tryScroll, 0);
    } else {
      window.scrollTo(0, 0);
    }
    setAutoRefresh();
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [app.hydrated]);

  useEffect(() => {
    document.title = isFavPage
      ? `${t("component.mainNav.favorites")} - Holodex`
      : "Holodex";
  }, [isFavPage, t]);

  useEffect(() => {
    if (app.visibilityState === "visible") refreshCurrentLive(app, isFavPage);
  }, [app.visibilityState]);

  useEffect(() => {
    if (isFavPage) init(false);
  }, [app.favoriteChannelIDs.size]);

  useEffect(() => {
    if (hideBothLiveUpcoming && tab === Tabs.LIVE_UPCOMING) {
      setTab(Tabs.ARCHIVE);
    }
  }, [hideBothLiveUpcoming]);

  useEffect(() => {
    const trigger = app.reloadTrigger;
    if (!trigger || trigger.consumed || trigger.source !== "logo-home") return;
    if (lastLogoHomeTrigger.current === trigger.timestamp) return;
    lastLogoHomeTrigger.current = trigger.timestamp;
    void app.reloadCurrentPage({ ...trigger, consumed: true });
    resetAllHomeScrollbars();
    const nextIsFavPage = trigger.defaultOpen === "favorites";
    setIsFavPage(nextIsFavPage);
    setViewMode("streams");
    setTabState(Tabs.LIVE_UPCOMING);
    saveState({
      viewMode: "streams",
      isFavPage: nextIsFavPage,
      tab: Tabs.LIVE_UPCOMING,
      scrollY: 0,
    });
    setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      if (nextIsFavPage) {
        app.fetchFavorites();
        if (app.favoriteChannelIDs.size > 0 && app.isLoggedIn)
          app.fetchFavoritesLive({ force: true, minutes: 2 });
      } else {
        app.fetchHomeLive({ force: true, minutes: 2 });
      }
    }, 0);
  }, [app.reloadTrigger]);

  const mobileTabBar =
    viewMode === "streams" ? (
      <div
        className="pointer-events-none fixed inset-x-0 z-[91] px-3 py-2 sm:px-5 min-[960px]:hidden"
        style={{ top: "var(--nav-header-height, 65px)" }}
      >
        <div className="pointer-events-auto mx-auto max-w-[1600px]">
          <div className="relative [--home-fave-bar-cover-rise:16px] [--home-fave-bar-radius:1rem]">
            <div
              className="pointer-events-none absolute inset-x-0 top-[calc(-1*var(--home-fave-bar-cover-rise))] z-0 h-[var(--home-fave-bar-cover-rise)] bg-[color:var(--color-background)]"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute left-0 top-0 z-0 h-[calc(var(--home-fave-bar-radius)+1px)] w-[calc(var(--home-fave-bar-radius)+1px)]"
              style={{ background: "radial-gradient(circle at bottom right, transparent calc(var(--home-fave-bar-radius) - 1px), var(--color-background) var(--home-fave-bar-radius))" }}
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute right-0 top-0 z-0 h-[calc(var(--home-fave-bar-radius)+1px)] w-[calc(var(--home-fave-bar-radius)+1px)]"
              style={{ background: "radial-gradient(circle at bottom left, transparent calc(var(--home-fave-bar-radius) - 1px), var(--color-background) var(--home-fave-bar-radius))" }}
              aria-hidden="true"
            />
            <div className="relative z-[1] flex w-full items-center justify-between gap-2 overflow-visible rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--surface-nav)] px-2 py-1.5 backdrop-blur-xl">
              <ToggleGroup value={[String(tab)]} onValueChange={(value) => { if (value[0]) setTab(Number(value[0])); }} className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
                {(() => {
                  const tabItemClass = cn("h-auto gap-0 cursor-pointer rounded-xl px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition sm:text-sm", activeTabClass, inactiveTabClass);
                  return (
                    <>
                      {!hideBothLiveUpcoming ? (
                        <ToggleGroupItem value={String(Tabs.LIVE_UPCOMING)} size="sm" className={tabItemClass}>
                          {!hideLive ? <>{liveUpcomingHeaderSplit[1]}<Badge variant="outline" className={cn(countBadgeClass, "mx-1")}>{livesVisible.length}</Badge></> : null}
                          {!hideUpcoming ? <>{hideLive ? t("views.home.upcomingLabel") : liveUpcomingHeaderSplit[2]}<Badge variant="outline" className={cn(countBadgeClass, "ml-1")}>{upcoming.length}</Badge></> : null}
                        </ToggleGroupItem>
                      ) : null}
                      <ToggleGroupItem value={String(Tabs.ARCHIVE)} size="sm" className={tabItemClass}>{t("views.home.recentVideoToggles.official")}</ToggleGroupItem>
                      <ToggleGroupItem value={String(Tabs.CLIPS)} size="sm" className={tabItemClass}>{t("views.home.recentVideoToggles.subber")}</ToggleGroupItem>
                    </>
                  );
                })()}
              </ToggleGroup>
            </div>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <section
      ref={homeRoot}
      className="app-page flex"
      onTouchStart={swipeTabs.onTouchStart}
      onTouchEnd={swipeTabs.onTouchEnd}
    >
      {mobileTabBar}
      <HomeSidePanel
        panelRef={asideRef}
        isFavPage={isFavPage}
        viewMode={viewMode}
        tab={tab}
        hideBothLiveUpcoming={hideBothLiveUpcoming}
        hideLive={hideLive}
        hideUpcoming={hideUpcoming}
        liveUpcomingHeaderSplit={liveUpcomingHeaderSplit}
        livesVisibleCount={livesVisible.length}
        upcomingCount={upcoming.length}
        isMobile={app.isMobile}
        onHome={switchToHome}
        onFavorites={switchToFavorites}
        onStreams={switchToStreams}
        onChannels={switchToChannels}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {viewMode === "streams" ? (
          <>
            {isFavPage &&
            !(app.isLoggedIn && app.favoriteChannelIDs.size > 0) ? (
              <Empty className="py-24">
                <EmptyMedia variant="icon">
                  <Heart className="h-6 w-6" />
                </EmptyMedia>
                <EmptyHeader>
                  <EmptyDescription>
                    <span
                      dangerouslySetInnerHTML={{
                        __html: t.raw("views.favorites.promptForAction"),
                      }}
                    />
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button
                    variant="outline"
                    onClick={() => app.isLoggedIn ? switchToChannels() : openUserMenu()}
                  >
	                    {app.isLoggedIn
	                      ? t("views.favorites.manageFavorites")
	                      : t("component.mainNav.login")}
                  </Button>
                </EmptyContent>
              </Empty>
            ) : null}
            {hasError ? <ApiErrorMessage /> : null}
            <ConnectedVideoList isFavPage={isFavPage} tab={tab} isActive />
          </>
        ) : (
          <ChannelsPage embedded />
        )}
      </div>
    </section>
  );
}
