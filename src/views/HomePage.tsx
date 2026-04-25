"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { mdiHeart, mdiHeartOutline } from "@mdi/js";
import { useAppState } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import {
  encodeHomeState,
  HOME_STATE_COOKIE,
  type HomeUiState,
} from "@/lib/home-state";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { LoadingOverlay } from "@/components/common/LoadingOverlay";
import { ConnectedVideoList } from "@/components/video/ConnectedVideoList";
import { cn } from "@/lib/cn";
import { ChannelsPage } from "@/views/ChannelsPage";
import { openUserMenu } from "@/lib/navigation-events";

const Tabs = Object.freeze({ LIVE_UPCOMING: 0, ARCHIVE: 1, CLIPS: 2, LIST: 3 });
const STORAGE_KEY = "holodex-home-state";

function readStoredDefaultOpen() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("holodex-v2-settings");
    return raw ? JSON.parse(raw).defaultOpen || null : null;
  } catch {
    return null;
  }
}

function normalizeHomeState(input?: HomeUiState | null): HomeUiState | null {
  if (!input || typeof input !== "object") return null;
  const tab =
    typeof input.tab === "number" && input.tab >= 0 && input.tab <= 2
      ? input.tab
      : undefined;
  const viewMode =
    input.viewMode === "channels" || input.viewMode === "streams"
      ? input.viewMode
      : undefined;
  return {
    ...(viewMode ? { viewMode } : {}),
    ...(typeof input.isFavPage === "boolean"
      ? { isFavPage: input.isFavPage }
      : {}),
    ...(tab !== undefined ? { tab } : {}),
    ...(typeof input.scrollY === "number" && input.scrollY >= 0
      ? { scrollY: input.scrollY }
      : {}),
  };
}

export function HomePage({
  initialHomeState,
}: {
  initialHomeState?: HomeUiState | null;
}) {
  const app = useAppState();
  const router = useRouter();
  const { t } = useI18n();
  const initialState = normalizeHomeState(initialHomeState);
  const [tab, setTabState] = useState<number>(
    initialState?.tab ?? Tabs.LIVE_UPCOMING,
  );
  const [isFavPage, setIsFavPage] = useState(
    initialState?.isFavPage ?? app.settings.defaultOpen === "favorites",
  );
  const [viewMode, setViewMode] = useState<"streams" | "channels">(
    initialState?.viewMode || "streams",
  );
  const touchStartX = useRef<number | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const appRef = useRef(app);
  const isFavPageRef = useRef(isFavPage);
  const homeStateRef = useRef({ viewMode, isFavPage, tab });
  const initialHomeStateRef = useRef(initialState);
  const scrollPositions = useRef(new Map<string, number>());
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
  useEffect(
    () => () => {
      saveState({ ...homeStateRef.current, scrollY: window.scrollY });
    },
    [],
  );

  const live = isFavPage ? app.favoritesLive : app.homeLive;
  const hasError = isFavPage ? app.favoritesError : app.homeError;
  const hideUpcoming = app.settings.hideUpcoming;
  const lives = live.filter((v: any) => v.status === "live");
  const upcoming = hideUpcoming
    ? []
    : live.filter((v: any) => v.status === "upcoming");
  const liveUpcomingHeaderSplit = useMemo(() => {
    const match = String(
      t("views.home.liveOrUpcomingHeading") || "Live / Upcoming",
    ).match(/(.+)([\/／・].+)/);
    return match || ["", "Live", " / Upcoming"];
  }, [t]);
  const activeTabClass = "bg-[color:var(--color-bold)] text-white";
  const inactiveTabClass =
    "text-[color:var(--color-muted-foreground)] hover:bg-white/8 hover:text-[color:var(--color-foreground)]";

  function currentScrollKey() {
    const prefix = isFavPage ? "fav" : "home";
    return viewMode === "channels"
      ? `${prefix}-channels`
      : `${prefix}-streams-${tab}`;
  }

  function saveState(next: HomeUiState = { viewMode, isFavPage, tab }) {
    const value = {
      viewMode: next.viewMode ?? viewMode,
      isFavPage: next.isFavPage ?? isFavPage,
      tab: next.tab ?? tab,
      scrollY:
        typeof next.scrollY === "number"
          ? next.scrollY
          : typeof window !== "undefined"
            ? window.scrollY
            : 0,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      const encoded = encodeHomeState(value);
      if (encoded)
        document.cookie = `${HOME_STATE_COOKIE}=${encoded}; Path=/; SameSite=Lax`;
    } catch {}
  }

  function restoreScroll() {
    setTimeout(
      () =>
        window.scrollTo(
          0,
          scrollPositions.current.get(currentScrollKey()) || 0,
        ),
      0,
    );
  }
  function resetScrollableElement(element: Element | null | undefined) {
    if (!(element instanceof HTMLElement)) return;
    element.scrollTop = 0;
    element.scrollLeft = 0;
  }
  function resetAllHomeScrollbars() {
    scrollPositions.current.clear();
    resetScrollableElement(asideRef.current);
    resetScrollableElement(homeRoot.current);
    const root = homeRoot.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>("*").forEach((element) => {
      const style = window.getComputedStyle(element);
      const canScrollY =
        ["auto", "scroll", "overlay"].includes(style.overflowY) &&
        element.scrollHeight > element.clientHeight;
      const canScrollX =
        ["auto", "scroll", "overlay"].includes(style.overflowX) &&
        element.scrollWidth > element.clientWidth;
      if (!canScrollY && !canScrollX) return;
      resetScrollableElement(element);
    });
  }

  function init(updateFavorites = false, favOverride = isFavPage) {
    if (favOverride) {
      if (updateFavorites) app.fetchFavorites();
      if (app.favoriteChannelIDs.size > 0 && app.isLoggedIn)
        app.fetchFavoritesLive({
          force: updateFavorites || app.favoritesLive.length === 0,
          minutes: 2,
        });
    } else {
      app.fetchHomeLive({
        force: updateFavorites || app.homeLive.length === 0,
        minutes: 2,
      });
    }
  }

  function setAutoRefresh() {
    if (refreshTimer.current) clearInterval(refreshTimer.current);
    refreshTimer.current = setInterval(
      () => {
        const currentApp = appRef.current;
        if (isFavPageRef.current)
          currentApp.fetchFavoritesLive({ force: false });
        else currentApp.fetchHomeLive({ force: false });
      },
      2 * 60 * 1000,
    );
  }

  function setTab(nextTab: number) {
    if (nextTab === tab) return;
    scrollPositions.current.set(currentScrollKey(), window.scrollY);
    setTabState(nextTab);
    saveState({ viewMode, isFavPage, tab: nextTab });
    restoreScroll();
  }

  function switchToHome() {
    if (!isFavPage && viewMode === "streams") return;
    scrollPositions.current.set(currentScrollKey(), window.scrollY);
    setIsFavPage(false);
    setViewMode("streams");
    saveState({ viewMode: "streams", isFavPage: false, tab });
    setTimeout(() => {
      init(true);
      restoreScroll();
    }, 0);
  }

  function switchToFavorites() {
    if (isFavPage && viewMode === "streams") return;
    scrollPositions.current.set(currentScrollKey(), window.scrollY);
    setIsFavPage(true);
    setViewMode("streams");
    saveState({ viewMode: "streams", isFavPage: true, tab });
    setTimeout(() => {
      init(true);
      restoreScroll();
    }, 0);
  }

  function switchToStreams(nextTab: number) {
    scrollPositions.current.set(currentScrollKey(), window.scrollY);
    setViewMode("streams");
    setTabState(nextTab);
    saveState({ viewMode: "streams", isFavPage, tab: nextTab });
    restoreScroll();
  }

  function switchToChannels() {
    scrollPositions.current.set(currentScrollKey(), window.scrollY);
    setViewMode("channels");
    saveState({ viewMode: "channels", isFavPage, tab });
    restoreScroll();
  }

  function handleTouchStart(event: React.TouchEvent) {
    touchStartX.current = event.changedTouches?.[0]?.clientX ?? null;
  }

  function handleTouchEnd(event: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const endX = event.changedTouches?.[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 50) return;
    if (delta > 0) setTab(Math.max(tab - 1, 0));
    else setTab(Math.min(tab + 1, 2));
  }

  useEffect(() => {
    if (!app.hydrated) return;
    const defaultOpen = readStoredDefaultOpen() || app.settings.defaultOpen;
    if (defaultOpen === "multiview") {
      router.replace("/multiview");
      return;
    }
    const initialFavPage =
      initialHomeStateRef.current?.isFavPage ?? defaultOpen === "favorites";
    if (initialFavPage !== isFavPage) setIsFavPage(initialFavPage);
    isFavPageRef.current = initialFavPage;
    init(true, initialFavPage);
    const savedScrollY = initialHomeStateRef.current?.scrollY;
    if (typeof savedScrollY === "number" && savedScrollY > 0)
      setTimeout(() => window.scrollTo(0, savedScrollY), 0);
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
    if (app.visibilityState === "visible") {
      if (isFavPage) app.fetchFavoritesLive({ force: false });
      else app.fetchHomeLive({ force: false });
    }
  }, [app.visibilityState]);

  useEffect(() => {
    if (isFavPage) init(false);
  }, [app.favoriteChannelIDs.size]);

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
          <div className="home-fave-tab-stack">
            <div
              className="home-fave-tab-cover home-fave-tab-cover-top"
              aria-hidden="true"
            />
            <div
              className="home-fave-tab-cover home-fave-tab-cover-left"
              aria-hidden="true"
            />
            <div
              className="home-fave-tab-cover home-fave-tab-cover-right"
              aria-hidden="true"
            />
            <div className="home-fave-tab-bar flex w-full items-center justify-between gap-2 overflow-visible rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--surface-nav)] px-2 py-1.5 backdrop-blur-xl">
              <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
                <button
                  type="button"
                  className={cn(
                    "inline-flex cursor-pointer items-center rounded-xl px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition sm:text-sm",
                    tab === Tabs.LIVE_UPCOMING
                      ? activeTabClass
                      : inactiveTabClass,
                  )}
                  onClick={() => setTab(Tabs.LIVE_UPCOMING)}
                >
                  {liveUpcomingHeaderSplit[1]}
                  <span className="stream-count-chip mx-1 inline-flex h-5 items-center rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-1.5 text-[10px] text-[color:var(--color-muted-foreground)] sm:text-[11px]">
                    {lives.length}
                  </span>
                  {!hideUpcoming ? (
                    <>
                      {liveUpcomingHeaderSplit[2]}
                      <span className="stream-count-chip ml-1 inline-flex h-5 items-center rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-1.5 text-[10px] text-[color:var(--color-muted-foreground)] sm:text-[11px]">
                        {upcoming.length}
                      </span>
                    </>
                  ) : null}
                </button>
                <button
                  type="button"
                  className={cn(
                    "cursor-pointer rounded-xl px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition sm:text-sm",
                    tab === Tabs.ARCHIVE ? activeTabClass : inactiveTabClass,
                  )}
                  onClick={() => setTab(Tabs.ARCHIVE)}
                >
                  {t("views.home.recentVideoToggles.official")}
                </button>
                <button
                  type="button"
                  className={cn(
                    "cursor-pointer rounded-xl px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition sm:text-sm",
                    tab === Tabs.CLIPS ? activeTabClass : inactiveTabClass,
                  )}
                  onClick={() => setTab(Tabs.CLIPS)}
                >
                  {t("views.home.recentVideoToggles.subber")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <section
      ref={homeRoot}
      className="flex min-h-full"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {mobileTabBar}
      <aside
        ref={asideRef}
        className="home-fave-side-panel sticky z-[80] mr-8 hidden w-60 shrink-0 self-start flex-col overflow-y-auto rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--surface-nav)] p-3 shadow-2xl backdrop-blur-3xl min-[960px]:flex"
        style={{
          top: "var(--nav-total-height, 80px)",
          maxHeight:
            "calc(100vh - 2 * var(--nav-total-height, 80px) + var(--nav-header-height, 64px))",
        }}
      >
        <div className="flex min-h-0 flex-col gap-3">
          <div className="flex items-center gap-1 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-0.5">
            <button
              type="button"
              className={cn(
                "flex-1 cursor-pointer rounded-lg px-2.5 py-1.5 text-[0.8rem] font-medium transition",
                !isFavPage
                  ? activeTabClass
                  : "text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]",
              )}
              onClick={switchToHome}
            >
              {t("component.mainNav.home")}
            </button>
            <button
              type="button"
              className={cn(
                "flex-1 cursor-pointer rounded-lg px-2.5 py-1.5 text-[0.8rem] font-medium transition",
                isFavPage
                  ? activeTabClass
                  : "text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]",
              )}
              onClick={switchToFavorites}
            >
              <span className="flex items-center gap-1">
                <Icon
                  icon={isFavPage ? mdiHeart : mdiHeartOutline}
                  className="h-3.5 w-3.5"
                />
                {t("component.mainNav.favorites")}
              </span>
            </button>
          </div>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded-xl px-2.5 py-2 text-[0.8rem] font-medium whitespace-nowrap transition",
                viewMode === "streams" && tab === Tabs.LIVE_UPCOMING
                  ? activeTabClass
                  : inactiveTabClass,
              )}
              onClick={() => switchToStreams(Tabs.LIVE_UPCOMING)}
            >
              {liveUpcomingHeaderSplit[1]}{" "}
              <span className="stream-count-chip inline-grid h-5 min-w-5 place-items-center rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-1.5 text-[10px] text-[color:var(--color-muted-foreground)]">
                {lives.length}
              </span>
              {!hideUpcoming ? (
                <>
                  {" "}
                  {liveUpcomingHeaderSplit[2]}{" "}
                  <span className="stream-count-chip inline-grid h-5 min-w-5 place-items-center rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-1.5 text-[10px] text-[color:var(--color-muted-foreground)]">
                    {upcoming.length}
                  </span>
                </>
              ) : null}
            </button>
            <button
              type="button"
              className={cn(
                "cursor-pointer rounded-xl px-2.5 py-2 text-left text-[0.8rem] font-medium whitespace-nowrap transition",
                viewMode === "streams" && tab === Tabs.ARCHIVE
                  ? activeTabClass
                  : inactiveTabClass,
              )}
              onClick={() => switchToStreams(Tabs.ARCHIVE)}
            >
              {t("views.home.recentVideoToggles.official")}
            </button>
            <button
              type="button"
              className={cn(
                "cursor-pointer rounded-xl px-2.5 py-2 text-left text-[0.8rem] font-medium whitespace-nowrap transition",
                viewMode === "streams" && tab === Tabs.CLIPS
                  ? activeTabClass
                  : inactiveTabClass,
              )}
              onClick={() => switchToStreams(Tabs.CLIPS)}
            >
              {t("views.home.recentVideoToggles.subber")}
            </button>
            <button
              type="button"
              className={cn(
                "cursor-pointer rounded-xl px-2.5 py-2 text-left text-[0.8rem] font-medium whitespace-nowrap transition",
                viewMode === "channels" ? activeTabClass : inactiveTabClass,
              )}
              onClick={switchToChannels}
            >
              {t("component.mainNav.channels")}
            </button>
          </div>
          <hr className="border-t border-[color:var(--color-border)]" />
          {!app.isMobile && viewMode === "streams" ? (
            <div className="relative flex min-h-0 flex-col gap-3">
              <div
                id={`date-selector${isFavPage}`}
                className="flex min-h-0 flex-col"
              />
            </div>
          ) : null}
          {!app.isMobile && viewMode === "channels" ? (
            <div id="channels-panel-portal" className="flex flex-col gap-2" />
          ) : null}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        {viewMode === "streams" ? (
          <>
            {isFavPage &&
            !(app.isLoggedIn && app.favoriteChannelIDs.size > 0) ? (
              <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
                <Icon
                  icon={mdiHeartOutline}
                  className="h-12 w-12 text-[color:var(--color-muted-foreground)] opacity-40"
                />
                <p
                  className="text-sm text-[color:var(--color-muted-foreground)]"
                  dangerouslySetInnerHTML={{
                    __html: t("views.favorites.promptForAction"),
                  }}
                />
                <Button
                  variant="outline"
                  className="fav-login-btn"
                  onClick={() =>
                    app.isLoggedIn
                      ? switchToChannels()
                      : openUserMenu()
                  }
                >
                  {app.isLoggedIn
                    ? t("views.favorites.manageFavorites")
                    : "Login"}
                </Button>
              </div>
            ) : null}
            <LoadingOverlay isLoading={false} showError={hasError} />
            <ConnectedVideoList isFavPage={isFavPage} tab={tab} isActive />
          </>
        ) : (
          <ChannelsPage embedded />
        )}
      </div>
    </section>
  );
}
