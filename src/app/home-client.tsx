"use client";

import { useTranslations } from "next-intl";
import { useEffect, useEffectEvent, useRef } from "react";
import { ChannelsPage } from "@/components/channel/ChannelsPage";
import { ApiErrorMessage } from "@/components/common/ApiErrorMessage";
import { ConnectedVideoList } from "@/components/video/ConnectedVideoList";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from "@/components/ui/empty";
import { openUserMenu } from "@/lib/browser";
import { HOME_TABS as Tabs } from "@/lib/cookie-codec";
import { useDeferredCallbacks, useSwipeTabs } from "@/lib/hooks";
import { Heart } from "@/lib/icons";
import { useAppState } from "@/lib/store";

export function HomeClient() {
  const app = useAppState();
  const t = useTranslations();
  const defer = useDeferredCallbacks();
  const { viewMode, isFavPage, tab } = app.homeNav as {
    viewMode: "streams" | "channels";
    isFavPage: boolean;
    tab: number;
  };
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

  // Store reads/actions used by the effects below; they should not re-run the effects.
  const refresh = useEffectEvent((updateFavs: boolean, favOverride?: boolean) =>
    init(updateFavs, favOverride),
  );
  const showArchiveTab = useEffectEvent(() => setTab(Tabs.ARCHIVE));

  // (Users who open to multiview are redirected by the server page before this renders.)
  useEffect(() => {
    if (app.hydrated) refresh(true);
  }, [app.hydrated]);

  // React to nav-state changes (from the nav bar or the local controls): scroll back to the
  // top, and refetch when the favorites/home context flips.
  useEffect(() => {
    const prev = prevNav.current;
    prevNav.current = { viewMode, isFavPage, tab };
    if (prev.viewMode === viewMode && prev.isFavPage === isFavPage && prev.tab === tab) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    if (prev.isFavPage !== isFavPage) defer(() => refresh(true, isFavPage));
  }, [viewMode, isFavPage, tab, defer]);

  useEffect(() => {
    document.title = isFavPage ? `${t("component.mainNav.favorites")} - Holodex` : "Holodex";
  }, [isFavPage, t]);
  // Refresh the favorites list when the set of favorite channels changes.
  const refreshFavorites = useEffectEvent(() => {
    if (isFavPage) init(false);
  });
  const favoriteCount = app.favoriteChannelIDs.size;
  useEffect(() => {
    refreshFavorites();
  }, [favoriteCount]);
  useEffect(() => {
    if (app.settings.hideLive && app.settings.hideUpcoming && tab === Tabs.LIVE_UPCOMING)
      showArchiveTab();
  }, [app.settings.hideLive, app.settings.hideUpcoming, tab]);

  const handleLogoTrigger = useEffectEvent((tr: NonNullable<typeof app.reloadTrigger>) => {
    lastLogoTrigger.current = tr.timestamp;
    void app.reloadCurrentPage({ ...tr, consumed: true });
    const fav = tr.defaultOpen === "favorites";
    app.setHomeNav({ viewMode: "streams", isFavPage: fav, tab: Tabs.LIVE_UPCOMING });
    // Scroll and refetch once the nav change has rendered.
    defer(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      if (fav) {
        app.fetchFavorites();
        if (app.favoriteChannelIDs.size > 0 && app.isLoggedIn)
          app.fetchFavoritesLive({ force: true, minutes: 2 });
      } else app.fetchHomeLive({ force: true, minutes: 2 });
    });
  });
  useEffect(() => {
    const tr = app.reloadTrigger;
    if (!tr || tr.consumed || tr.source !== "logo-home" || lastLogoTrigger.current === tr.timestamp)
      return;
    handleLogoTrigger(tr);
  }, [app.reloadTrigger]);

  return (
    <section
      className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-5 pb-10 pt-[calc(var(--nav-header-height,56px)+0.75rem)] sm:px-8 lg:px-10 xl:px-12"
      onTouchStart={swipeTabs.onTouchStart}
      onTouchEnd={swipeTabs.onTouchEnd}
    >
      {viewMode === "streams" ? (
        <>
          {isFavPage && !(app.isLoggedIn && app.favoriteChannelIDs.size > 0) ? (
            <Empty className="py-24">
              <EmptyMedia variant="icon">
                <Heart className="h-6 w-6" />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyDescription>
                  <span
                    dangerouslySetInnerHTML={{ __html: t.raw("views.favorites.promptForAction") }}
                  />
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button
                  variant="outline"
                  onClick={() => (app.isLoggedIn ? switchToChannels() : openUserMenu())}
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
    </section>
  );
}
