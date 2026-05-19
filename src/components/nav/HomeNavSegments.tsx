"use client";

import { Archive, Clapperboard, Heart, Home, Radio, Users } from "@/lib/icons";
import { Badge } from "@/components/ui/badge";
import { ButtonGroup } from "@/components/ui/button-group";
import { Toggle } from "@/components/ui/toggle";
import { HOME_TABS } from "@/lib/cookie-codec";
import { useTranslations } from "next-intl";

export type HomeNavMode = "live-upcoming" | "archive" | "clips" | "channels";

export type HomeNavSelection = { fav: boolean; mode: HomeNavMode } | null;

export type HomeNavSegmentsProps = {
  selection: HomeNavSelection;
  hideBoth?: boolean;
  hideLive?: boolean;
  liveCount?: number;
  onHome: () => void;
  onFavorites: () => void;
  onTab: (tab: number) => void;
  onChannels: () => void;
};

export function HomeNavSegments({
  selection,
  hideBoth,
  hideLive,
  liveCount,
  onHome,
  onFavorites,
  onTab,
  onChannels,
}: HomeNavSegmentsProps) {
  const t = useTranslations();
  const sel = selection;
  const is = (mode: HomeNavMode) => !!sel && sel.mode === mode;

  return (
    <div className="flex items-center gap-1.5">
      <ButtonGroup className="shrink-0">
        <Toggle
          variant="outline"
          size="lg"
          pressed={!!sel && !sel.fav}
          aria-label={t("component.mainNav.home")}
          title={t("component.mainNav.home")}
          onPressedChange={onHome}
        >
          <Home className="size-4" />
        </Toggle>
        <Toggle
          variant="outline"
          size="lg"
          pressed={!!sel && sel.fav}
          aria-label={t("component.mainNav.favorites")}
          title={t("component.mainNav.favorites")}
          onPressedChange={onFavorites}
        >
          <Heart className="size-4" />
        </Toggle>
      </ButtonGroup>
      <ButtonGroup className="shrink-0">
        {!hideBoth ? (
          <Toggle
            variant="outline"
            size="lg"
            pressed={is("live-upcoming")}
            aria-label={t("views.home.liveOrUpcomingHeading")}
            title={t("views.home.liveOrUpcomingHeading")}
            onPressedChange={() => onTab(HOME_TABS.LIVE_UPCOMING)}
          >
            <Radio className="size-4" />
            {!hideLive && liveCount !== undefined ? <Badge variant="outline">{liveCount}</Badge> : null}
          </Toggle>
        ) : null}
        <Toggle
          variant="outline"
          size="lg"
          pressed={is("archive")}
          aria-label={t("views.home.recentVideoToggles.official")}
          title={t("views.home.recentVideoToggles.official")}
          onPressedChange={() => onTab(HOME_TABS.ARCHIVE)}
        >
          <Archive className="size-4" />
        </Toggle>
        <Toggle
          variant="outline"
          size="lg"
          pressed={is("clips")}
          aria-label={t("views.home.recentVideoToggles.subber")}
          title={t("views.home.recentVideoToggles.subber")}
          onPressedChange={() => onTab(HOME_TABS.CLIPS)}
        >
          <Clapperboard className="size-4" />
        </Toggle>
        <Toggle
          variant="outline"
          size="lg"
          pressed={is("channels")}
          aria-label={t("component.mainNav.channels")}
          title={t("component.mainNav.channels")}
          onPressedChange={onChannels}
        >
          <Users className="size-4" />
        </Toggle>
      </ButtonGroup>
    </div>
  );
}
