"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Heart } from "@/lib/icons";
import { useAppState } from "@/lib/store";
import { useTranslations } from "next-intl";
import { encodeCookieJson, HOME_STATE_COOKIE, type HomeUiState } from "@/lib/cookie-codec";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia } from "@/components/ui/empty";
import { HomeNavSegments } from "@/components/nav/HomeNavSegments";
import { ApiErrorMessage } from "@/components/common/ApiErrorMessage";
import { ConnectedVideoList } from "@/components/video/ConnectedVideoList";
import { openUserMenu, readJSON, writeJSON } from "@/lib/browser";
import { ChannelsPage } from "@/components/channel/ChannelsPage";
import { useDomElement, useSwipeTabs } from "@/lib/hooks";
import { clearSavedHomePageState, getSavedHomePageState, HOME_STATE_STORAGE_KEY, HOME_TABS as Tabs, primeHomePageState } from "@/lib/cookie-codec";

const scrollStore = new Map<string, number>();

const scrollKeyFor = (fp: boolean, vm: "streams" | "channels", t: number) =>
  vm === "channels" ? `${fp ? "fav" : "home"}-channels` : `${fp ? "fav" : "home"}-streams-${t}`;

const readStoredDefaultOpen = () => typeof window === "undefined" ? null
  : readJSON<{ defaultOpen?: string | null }>("holodex-v2-settings", {}).defaultOpen || null;

function normalizeHomeState(s?: HomeUiState | null): HomeUiState | null {
  if (!s || typeof s !== "object") return null;
  const out: HomeUiState = {};
  if (s.viewMode === "channels" || s.viewMode === "streams") out.viewMode = s.viewMode;
  if (typeof s.isFavPage === "boolean") out.isFavPage = s.isFavPage;
  if (typeof s.tab === "number" && s.tab >= 0 && s.tab <= 2) out.tab = s.tab;
  if (typeof s.scrollY === "number" && s.scrollY >= 0) out.scrollY = s.scrollY;
  return out;
}

export function HomeClient({ initialHomeState }: { initialHomeState?: HomeUiState | null }) {
  const app = useAppState();
  const router = useRouter();
  const t = useTranslations();
  const initial = normalizeHomeState(initialHomeState);
  const saved = getSavedHomePageState();
  const [tab, setTabState] = useState(saved?.tab ?? initial?.tab ?? Tabs.LIVE_UPCOMING);
  const [isFavPage, setIsFavPage] = useState(saved?.isFavPage ?? initial?.isFavPage ?? app.settings.defaultOpen === "favorites");
  const [viewMode, setViewMode] = useState<"streams" | "channels">(saved?.viewMode ?? initial?.viewMode ?? "streams");
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const appRef = useRef(app);
  const favRef = useRef(isFavPage);
  const stateRef = useRef({ viewMode, isFavPage, tab });
  const initialRef = useRef(initial);
  const lastLogoTrigger = useRef<number | null>(null);
  const root = useRef<HTMLElement | null>(null);
  const navTarget = useDomElement("mainNavHomeControls");

  useEffect(() => { appRef.current = app; }, [app]);
  useEffect(() => { favRef.current = isFavPage; stateRef.current = { viewMode, isFavPage, tab }; }, [viewMode, isFavPage, tab]);

  useEffect(() => {
    const key = scrollKeyFor(isFavPage, viewMode, tab);
    const onScroll = () => scrollStore.set(key, window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isFavPage, viewMode, tab]);

  useEffect(() => () => {
    const s = stateRef.current;
    primeHomePageState({ tab: s.tab, isFavPage: s.isFavPage, viewMode: s.viewMode as "streams" | "channels" });
    saveState({ ...s, scrollY: 0 });
  }, []);

  const live = isFavPage ? app.favoritesLive : app.homeLive;
  const hasError = isFavPage ? app.favoritesError : app.homeError;
  const { hideUpcoming, hideLive } = app.settings;
  const hideBoth = hideLive && hideUpcoming;
  const livesVisible = hideLive ? [] : live.filter((v: any) => v.status === "live");
  const streamMode = viewMode === "channels" ? "channels"
    : tab === Tabs.ARCHIVE ? "archive" : tab === Tabs.CLIPS ? "clips" : "live-upcoming";

  const currentScrollKey = () => scrollKeyFor(isFavPage, viewMode, tab);

  function saveState(next: HomeUiState = { viewMode, isFavPage, tab }) {
    const v = {
      viewMode: next.viewMode ?? viewMode,
      isFavPage: next.isFavPage ?? isFavPage,
      tab: next.tab ?? tab,
      scrollY: next.scrollY ?? (typeof window !== "undefined" ? window.scrollY : 0),
    };
    try {
      writeJSON(HOME_STATE_STORAGE_KEY, v);
      const enc = encodeCookieJson(v);
      if (enc) document.cookie = `${HOME_STATE_COOKIE}=${enc}; Path=/; SameSite=Lax`;
    } catch {}
  }

  const restoreScroll = (key?: string) =>
    setTimeout(() => window.scrollTo(0, scrollStore.get(key ?? currentScrollKey()) || 0), 0);

  function resetAllScrolls() {
    scrollStore.clear();
    clearSavedHomePageState();
    const reset = (el: Element | null | undefined) => { if (el instanceof HTMLElement) { el.scrollTop = 0; el.scrollLeft = 0; } };
    reset(root.current);
    if (!root.current) return;
    const scrollable = ["auto", "scroll", "overlay"];
    root.current.querySelectorAll<HTMLElement>("*").forEach((el) => {
      const s = window.getComputedStyle(el);
      if ((scrollable.includes(s.overflowY) && el.scrollHeight > el.clientHeight) ||
          (scrollable.includes(s.overflowX) && el.scrollWidth > el.clientWidth)) reset(el);
    });
  }

  const refreshLive = (a = app, fp = isFavPage, force = false) =>
    fp ? a.fetchFavoritesLive({ force }) : a.fetchHomeLive({ force });

  function init(updateFavs = false, favOverride = isFavPage) {
    if (favOverride) {
      if (updateFavs) app.fetchFavorites();
      if (app.favoriteChannelIDs.size > 0 && app.isLoggedIn)
        app.fetchFavoritesLive({ force: updateFavs || app.favoritesLive.length === 0, minutes: 2 });
    } else app.fetchHomeLive({ force: updateFavs || app.homeLive.length === 0, minutes: 2 });
  }

  function setTab(next: number) {
    if (next === tab) return;
    scrollStore.set(currentScrollKey(), window.scrollY);
    setTabState(next);
    saveState({ viewMode, isFavPage, tab: next });
    restoreScroll(scrollKeyFor(isFavPage, viewMode, next));
  }

  const swipeTabs = useSwipeTabs((d) => setTab(Math.max(0, Math.min(2, tab + d))));

  function switchTo(nextFav: boolean, nextVm: "streams" | "channels", nextTab: number, refetch = false) {
    scrollStore.set(currentScrollKey(), window.scrollY);
    setIsFavPage(nextFav); setViewMode(nextVm); setTabState(nextTab);
    saveState({ viewMode: nextVm, isFavPage: nextFav, tab: nextTab });
    const key = scrollKeyFor(nextFav, nextVm, nextTab);
    if (refetch) setTimeout(() => { init(true, nextFav); restoreScroll(key); }, 0);
    else restoreScroll(key);
  }
  const switchToHome = () => { if (isFavPage || viewMode !== "streams") switchTo(false, "streams", tab, true); };
  const switchToFavorites = () => { if (!isFavPage || viewMode !== "streams") switchTo(true, "streams", tab, true); };
  const switchToStreams = (t: number) => switchTo(isFavPage, "streams", t);
  const switchToChannels = () => switchTo(isFavPage, "channels", tab);

  useEffect(() => {
    if (!app.hydrated) return;
    const defaultOpen = readStoredDefaultOpen() || app.settings.defaultOpen;
    if (defaultOpen === "multiview") { router.replace("/multiview"); return; }
    const initFav = saved?.isFavPage ?? initialRef.current?.isFavPage ?? defaultOpen === "favorites";
    if (initFav !== isFavPage) setIsFavPage(initFav);
    favRef.current = initFav;
    const initVm = (saved?.viewMode ?? initialRef.current?.viewMode ?? "streams") as "streams" | "channels";
    const rawTab = saved?.tab ?? initialRef.current?.tab ?? Tabs.LIVE_UPCOMING;
    const initTab = rawTab === Tabs.LIVE_UPCOMING && appRef.current.settings.hideLive && appRef.current.settings.hideUpcoming ? Tabs.ARCHIVE : rawTab;
    if (saved) {
      if (initVm !== viewMode) setViewMode(initVm);
      if (initTab !== tab) setTabState(initTab);
    }
    init(true, initFav);
    window.history.scrollRestoration = "manual";
    const savedScroll = scrollStore.get(scrollKeyFor(initFav, initVm, initTab)) ?? 0;
    if (savedScroll > 0) {
      let attempts = 0;
      const tryScroll = () => {
        window.scrollTo(0, savedScroll);
        if (window.scrollY < savedScroll - 5 && attempts++ < 20) requestAnimationFrame(tryScroll);
      };
      setTimeout(tryScroll, 0);
    } else window.scrollTo(0, 0);
    if (refreshTimer.current) clearInterval(refreshTimer.current);
    refreshTimer.current = setInterval(() => refreshLive(appRef.current, favRef.current), 120_000);
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current); };
  }, [app.hydrated]);

  useEffect(() => { document.title = isFavPage ? `${t("component.mainNav.favorites")} - Holodex` : "Holodex"; }, [isFavPage, t]);
  useEffect(() => { if (app.visibilityState === "visible") refreshLive(app, isFavPage); }, [app.visibilityState]);
  useEffect(() => { if (isFavPage) init(false); }, [app.favoriteChannelIDs.size]);
  useEffect(() => { if (hideBoth && tab === Tabs.LIVE_UPCOMING) setTab(Tabs.ARCHIVE); }, [hideBoth]);

  useEffect(() => {
    const tr = app.reloadTrigger;
    if (!tr || tr.consumed || tr.source !== "logo-home" || lastLogoTrigger.current === tr.timestamp) return;
    lastLogoTrigger.current = tr.timestamp;
    void app.reloadCurrentPage({ ...tr, consumed: true });
    resetAllScrolls();
    const fav = tr.defaultOpen === "favorites";
    setIsFavPage(fav); setViewMode("streams"); setTabState(Tabs.LIVE_UPCOMING);
    saveState({ viewMode: "streams", isFavPage: fav, tab: Tabs.LIVE_UPCOMING, scrollY: 0 });
    setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      if (fav) {
        app.fetchFavorites();
        if (app.favoriteChannelIDs.size > 0 && app.isLoggedIn) app.fetchFavoritesLive({ force: true, minutes: 2 });
      } else app.fetchHomeLive({ force: true, minutes: 2 });
    }, 0);
  }, [app.reloadTrigger]);

  const navControls = navTarget ? createPortal(
    <div className="flex items-center gap-1.5">
      <HomeNavSegments
        selection={{ fav: isFavPage, mode: streamMode as any }}
        hideBoth={hideBoth}
        hideLive={hideLive}
        liveCount={livesVisible.length}
        onHome={switchToHome}
        onFavorites={switchToFavorites}
        onTab={switchToStreams}
        onChannels={switchToChannels}
      />
      {viewMode === "streams" ? <div id={`date-selector${isFavPage}`} className="flex shrink-0 items-center gap-1.5 empty:hidden" /> : null}
      {viewMode === "channels" ? <div id="channels-panel-portal" className="flex shrink-0 items-center gap-1.5 empty:hidden" /> : null}
    </div>, navTarget) : null;

  return (
    <>
      {navControls}
      <section ref={root} className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-5 pb-10 pt-[calc(var(--nav-total-height,120px)+0.75rem)] sm:px-8 lg:px-10 xl:px-12" onTouchStart={swipeTabs.onTouchStart} onTouchEnd={swipeTabs.onTouchEnd}>
        {viewMode === "streams" ? (
          <>
            {isFavPage && !(app.isLoggedIn && app.favoriteChannelIDs.size > 0) ? (
              <Empty className="py-24">
                <EmptyMedia variant="icon"><Heart className="h-6 w-6" /></EmptyMedia>
                <EmptyHeader><EmptyDescription><span dangerouslySetInnerHTML={{ __html: t.raw("views.favorites.promptForAction") }} /></EmptyDescription></EmptyHeader>
                <EmptyContent><Button variant="outline" onClick={() => app.isLoggedIn ? switchToChannels() : openUserMenu()}>{app.isLoggedIn ? t("views.favorites.manageFavorites") : t("component.mainNav.login")}</Button></EmptyContent>
              </Empty>
            ) : null}
            {hasError ? <ApiErrorMessage /> : null}
            <ConnectedVideoList isFavPage={isFavPage} tab={tab} isActive />
          </>
        ) : <ChannelsPage embedded />}
      </section>
    </>
  );
}
