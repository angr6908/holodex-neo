"use client";

import { Archive, Clapperboard, Heart, Home, Radio, Users } from "@/lib/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { HOME_TABS } from "@/lib/cookie-codec";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const selectedButtonClass = "bg-muted! text-foreground!";
// Nav selection buttons change their highlight instantly — no fade in or out. Colors are excluded from
// the transition, so the pressed/selected tab snaps straight to its final color (like the settings
// button) and the previously-selected tab drops its highlight immediately, with no lingering fade or
// flicker on switch. `active:` reflects the color the moment it's pressed; the press dip and focus ring
// keep animating.
const navSegmentClass = "transition-[transform,translate,box-shadow,border-color] active:bg-muted! active:text-foreground!";

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
          className={cn(navSegmentClass, !!sel && !sel.fav && selectedButtonClass)}
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
          className={cn(navSegmentClass, !!sel && sel.fav && selectedButtonClass)}
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
            className={cn(navSegmentClass, is("live-upcoming") && selectedButtonClass)}
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
          className={cn(navSegmentClass, is("archive") && selectedButtonClass)}
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
          className={cn(navSegmentClass, is("clips") && selectedButtonClass)}
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
          className={cn(navSegmentClass, is("channels") && selectedButtonClass)}
        >
          <Users className="size-4" />
        </Button>
      </ButtonGroup>
    </div>
  );
}
