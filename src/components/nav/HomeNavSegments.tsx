"use client";

import { Archive, Clapperboard, Heart, Home, Radio, Users } from "@/lib/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { HOME_TABS } from "@/lib/cookie-codec";
import { useTranslations } from "next-intl";

const selectedButtonClass = "bg-muted! text-foreground!";

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
        <Button
          type="button"
          variant="outline"
          size="lg"
          aria-pressed={!!sel && !sel.fav}
          aria-label={t("component.mainNav.home")}
          title={t("component.mainNav.home")}
          onClick={onHome}
          className={!!sel && !sel.fav ? selectedButtonClass : undefined}
        >
          <Home className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          aria-pressed={!!sel && sel.fav}
          aria-label={t("component.mainNav.favorites")}
          title={t("component.mainNav.favorites")}
          onClick={onFavorites}
          className={!!sel && sel.fav ? selectedButtonClass : undefined}
        >
          <Heart className="size-4" />
        </Button>
      </ButtonGroup>
      <ButtonGroup className="shrink-0">
        {!hideBoth ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            aria-pressed={is("live-upcoming")}
            aria-label={t("views.home.liveOrUpcomingHeading")}
            title={t("views.home.liveOrUpcomingHeading")}
            onClick={() => onTab(HOME_TABS.LIVE_UPCOMING)}
            className={is("live-upcoming") ? selectedButtonClass : undefined}
          >
            <Radio className="size-4" />
            {!hideLive && liveCount !== undefined ? <Badge variant="outline">{liveCount}</Badge> : null}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="lg"
          aria-pressed={is("archive")}
          aria-label={t("views.home.recentVideoToggles.official")}
          title={t("views.home.recentVideoToggles.official")}
          onClick={() => onTab(HOME_TABS.ARCHIVE)}
          className={is("archive") ? selectedButtonClass : undefined}
        >
          <Archive className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          aria-pressed={is("clips")}
          aria-label={t("views.home.recentVideoToggles.subber")}
          title={t("views.home.recentVideoToggles.subber")}
          onClick={() => onTab(HOME_TABS.CLIPS)}
          className={is("clips") ? selectedButtonClass : undefined}
        >
          <Clapperboard className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          aria-pressed={is("channels")}
          aria-label={t("component.mainNav.channels")}
          title={t("component.mainNav.channels")}
          onClick={onChannels}
          className={is("channels") ? selectedButtonClass : undefined}
        >
          <Users className="size-4" />
        </Button>
      </ButtonGroup>
    </div>
  );
}
