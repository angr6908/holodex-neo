"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "@/lib/icons";
import { useAppState } from "@/lib/store";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia } from "@/components/ui/empty";
import { ApiErrorMessage } from "@/components/common/ApiErrorMessage";
import { ConnectedVideoList } from "@/components/nav/MainNav";
import { openUserMenu } from "@/lib/browser";
import { ChannelsPage } from "@/components/channel/ChannelsPage";
import { useSwipeTabs } from "@/lib/hooks";
import { HOME_TABS as Tabs } from "@/lib/cookie-codec";

export function HomeClient() {
  const app = useAppState();
  const router = useRouter();
  const t = useTranslations();
  const { viewMode, isFavPage, tab } = app.homeNav as { viewMode: "streams" | "channels"; isFavPage: boolean; tab: number };
  const prevNav = useRef({ viewMode, isFavPage, tab });
  const lastLogoTrigger = useRef<number | null>(null);

  const hasError = isFavPage ? app.favoritesError : app.homeError;

  function init(updateFavs = false, favOverride = isFavPage) {
    if (favOverride) {
      if (updateFavs) app.fetchFavorites();
      if (app.favoriteChannelIDs.size > 0 && app.isLoggedIn)
        app.fetchFavoritesLive({ force: updateFavs || app.favoritesLive.length === 0, minutes: 2 });
    } else app.fetchHomeLive({ force: updateFavs || app.homeLive.length === 0, minutes: 2 });
  }

  function setTab(next: number) {
    if (next !== tab) app.setHomeNav({ tab: next });
  }

  const swipeTabs = useSwipeTabs((d) => setTab(Math.max(0, Math.min(2, tab + d))));
  const switchToChannels = () => app.setHomeNav({ viewMode: "channels" });

  useEffect(() => {
    if (!app.hydrated) return;
    if (app.settings.defaultOpen === "multiview") { router.replace("/multiview"); return; }
    init(true);
  }, [app.hydrated]);

  // React to nav-state changes (from the nav bar or the local controls): scroll back to the
  // top, and refetch when the favorites/home context flips.
  useEffect(() => {
    const prev = prevNav.current;
    prevNav.current = { viewMode, isFavPage, tab };
    if (prev.viewMode === viewMode && prev.isFavPage === isFavPage && prev.tab === tab) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    if (prev.isFavPage !== isFavPage) setTimeout(() => init(true, isFavPage), 0);
  }, [viewMode, isFavPage, tab]);

  useEffect(() => { document.title = isFavPage ? `${t("component.mainNav.favorites")} - Holodex` : "Holodex"; }, [isFavPage, t]);
  useEffect(() => { if (isFavPage) init(false); }, [app.favoriteChannelIDs.size]);
  useEffect(() => {
    if (app.settings.hideLive && app.settings.hideUpcoming && tab === Tabs.LIVE_UPCOMING) setTab(Tabs.ARCHIVE);
  }, [app.settings.hideLive, app.settings.hideUpcoming, tab]);

  useEffect(() => {
    const tr = app.reloadTrigger;
    if (!tr || tr.consumed || tr.source !== "logo-home" || lastLogoTrigger.current === tr.timestamp) return;
    lastLogoTrigger.current = tr.timestamp;
    void app.reloadCurrentPage({ ...tr, consumed: true });
    const fav = tr.defaultOpen === "favorites";
    app.setHomeNav({ viewMode: "streams", isFavPage: fav, tab: Tabs.LIVE_UPCOMING });
    setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      if (fav) {
        app.fetchFavorites();
        if (app.favoriteChannelIDs.size > 0 && app.isLoggedIn) app.fetchFavoritesLive({ force: true, minutes: 2 });
      } else app.fetchHomeLive({ force: true, minutes: 2 });
    }, 0);
  }, [app.reloadTrigger]);

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-5 pb-10 pt-[calc(var(--nav-header-height,56px)+0.75rem)] sm:px-8 lg:px-10 xl:px-12" onTouchStart={swipeTabs.onTouchStart} onTouchEnd={swipeTabs.onTouchEnd}>
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
  );
}
