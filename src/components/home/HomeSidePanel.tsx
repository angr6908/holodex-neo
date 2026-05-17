"use client";

import { Heart } from "@/lib/icons";
import type { Ref } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { HOME_TABS } from "@/lib/cookie-codec";
export function HomeSidePanel({
  isFavPage,
  viewMode,
  tab,
  hideBothLiveUpcoming,
  hideLive,
  hideUpcoming,
  liveUpcomingHeaderSplit,
  livesVisibleCount,
  upcomingCount,
  isMobile,
  panelRef,
  showPortals = true,
  onHome,
  onFavorites,
  onStreams,
  onChannels,
}: {
  isFavPage: boolean;
  viewMode: "streams" | "channels";
  tab: number;
  hideBothLiveUpcoming: boolean;
  hideLive: boolean;
  hideUpcoming: boolean;
  liveUpcomingHeaderSplit: RegExpMatchArray | string[];
  livesVisibleCount: number;
  upcomingCount: number;
  isMobile: boolean;
  panelRef?: Ref<HTMLElement>;
  showPortals?: boolean;
  onHome: () => void;
  onFavorites: () => void;
  onStreams: (tab: number) => void;
  onChannels: () => void;
}) {
  const t = useTranslations();
  const activeTabClass = "data-[state=on]:bg-[color:var(--color-bold)] data-[state=on]:text-white data-[state=on]:hover:bg-[color:var(--color-bold)] data-[state=on]:hover:text-white dark:data-[state=on]:hover:bg-[color:var(--color-bold)]";
  const inactiveTabClass = "data-[state=off]:text-[color:var(--color-muted-foreground)] data-[state=off]:hover:bg-white/8 data-[state=off]:hover:text-[color:var(--color-foreground)] dark:data-[state=off]:hover:bg-white/8";
  const countBadgeClass =
    "inline-grid h-5 min-w-6 place-items-center rounded-full border-[color:var(--color-border)] bg-[color:var(--color-card)] px-1.5 py-0 text-[10px] leading-none tracking-normal text-[color:var(--color-muted-foreground)]";
  const streamModeValue = viewMode === "channels" ? "channels" : tab === HOME_TABS.ARCHIVE ? "archive" : tab === HOME_TABS.CLIPS ? "clips" : "live-upcoming";

  return (
    <aside
      ref={panelRef}
      className="home-fave-side-panel sticky z-[80] mr-8 hidden w-60 shrink-0 self-start flex-col overflow-y-auto rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--surface-nav)] p-3 shadow-2xl backdrop-blur-3xl min-[960px]:flex"
      style={{
        top: "var(--nav-total-height, 80px)",
        maxHeight:
          "calc(100vh - 2 * var(--nav-total-height, 80px) + var(--nav-header-height, 64px))",
      }}
    >
      <div className="flex min-h-0 flex-col gap-3">
        <ToggleGroup
          value={[isFavPage ? "favorites" : "home"]}
          onValueChange={(value) => {
            if (value[0] === "home") onHome();
            if (value[0] === "favorites") onFavorites();
          }}
          className="flex w-full items-center gap-1 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-0.5"
        >
          <ToggleGroupItem
            value="home"
            size="sm"
            className={cn(
              "h-auto flex-1 shrink cursor-pointer justify-center rounded-lg px-2.5 py-1.5 text-[0.8rem] font-medium whitespace-normal transition",
              activeTabClass,
              "data-[state=off]:text-[color:var(--color-muted-foreground)] data-[state=off]:hover:bg-transparent data-[state=off]:hover:text-[color:var(--color-foreground)] dark:data-[state=off]:hover:bg-transparent",
            )}
          >
            {t("component.mainNav.home")}
          </ToggleGroupItem>
          <ToggleGroupItem
            value="favorites"
            size="sm"
            className={cn(
              "h-auto flex-1 shrink cursor-pointer justify-center rounded-lg px-2.5 py-1.5 text-[0.8rem] font-medium whitespace-normal transition",
              activeTabClass,
              "data-[state=off]:text-[color:var(--color-muted-foreground)] data-[state=off]:hover:bg-transparent data-[state=off]:hover:text-[color:var(--color-foreground)] dark:data-[state=off]:hover:bg-transparent",
            )}
          >
            <span className="flex items-center justify-center gap-1">
              <Heart className="size-3.5" />
              {t("component.mainNav.favorites")}
            </span>
          </ToggleGroupItem>
        </ToggleGroup>
        <ToggleGroup
          value={[streamModeValue]}
          onValueChange={(value) => {
            if (value[0] === "live-upcoming") onStreams(HOME_TABS.LIVE_UPCOMING);
            if (value[0] === "archive") onStreams(HOME_TABS.ARCHIVE);
            if (value[0] === "clips") onStreams(HOME_TABS.CLIPS);
            if (value[0] === "channels") onChannels();
          }}
          className="flex w-full flex-col items-stretch gap-1"
        >
          {!hideBothLiveUpcoming ? (
            <ToggleGroupItem
              value="live-upcoming"
              size="sm"
              className={cn(
                "h-auto shrink cursor-pointer justify-start gap-1.5 rounded-xl px-2.5 py-2 text-[0.8rem] font-medium whitespace-nowrap transition",
                activeTabClass,
                inactiveTabClass,
              )}
            >
              {!hideLive ? (
                <>
                  {liveUpcomingHeaderSplit[1]}{" "}
                  <Badge variant="outline" className={countBadgeClass}>
                    {livesVisibleCount}
                  </Badge>
                </>
              ) : null}
              {!hideUpcoming ? (
                <>
                  {" "}
	                  {hideLive ? t("views.home.upcomingLabel") : liveUpcomingHeaderSplit[2]}{" "}
                  <Badge variant="outline" className={countBadgeClass}>
                    {upcomingCount}
                  </Badge>
                </>
              ) : null}
            </ToggleGroupItem>
          ) : null}
          <ToggleGroupItem
            value="archive"
            size="sm"
            className={cn(
              "h-auto shrink cursor-pointer justify-start rounded-xl px-2.5 py-2 text-[0.8rem] font-medium whitespace-nowrap transition",
              activeTabClass,
              inactiveTabClass,
            )}
          >
            {t("views.home.recentVideoToggles.official")}
          </ToggleGroupItem>
          <ToggleGroupItem
            value="clips"
            size="sm"
            className={cn(
              "h-auto shrink cursor-pointer justify-start rounded-xl px-2.5 py-2 text-[0.8rem] font-medium whitespace-nowrap transition",
              activeTabClass,
              inactiveTabClass,
            )}
          >
            {t("views.home.recentVideoToggles.subber")}
          </ToggleGroupItem>
          <ToggleGroupItem
            value="channels"
            size="sm"
            className={cn(
              "h-auto shrink cursor-pointer justify-start rounded-xl px-2.5 py-2 text-[0.8rem] font-medium whitespace-nowrap transition",
              activeTabClass,
              inactiveTabClass,
            )}
          >
            {t("component.mainNav.channels")}
          </ToggleGroupItem>
        </ToggleGroup>
        <Separator />
        {showPortals && !isMobile && viewMode === "streams" ? (
          <div className="relative flex min-h-0 flex-col gap-3">
            <div
              id={`date-selector${isFavPage}`}
              className="flex min-h-0 flex-col"
            />
          </div>
        ) : null}
        {showPortals && !isMobile && viewMode === "channels" ? (
          <div id="channels-panel-portal" className="flex flex-col gap-2" />
        ) : null}
      </div>
    </aside>
  );
}
