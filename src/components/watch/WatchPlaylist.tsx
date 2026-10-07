"use client";

import { useTranslations } from "next-intl";
import { SectionPanel } from "@/components/common/SectionPanel";
import { Button } from "@/components/ui/button";
import { VirtualVideoCardList } from "@/components/video/VirtualVideoCardList";
import * as icons from "@/lib/icons";

export function WatchPlaylist({
  playlist,
  hasError = false,
  currentIndex,
  onNext,
}: {
  playlist?: any;
  hasError?: boolean;
  /** Index of the playing video in the playlist, or -1. */
  currentIndex: number;
  onNext?: () => void;
}) {
  const t = useTranslations();
  if (hasError) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/50 px-4 py-3 text-sm text-destructive">
        {t("component.playlist.error-loading")}
      </div>
    );
  }
  if (!playlist) return null;
  return (
    <SectionPanel
      title={playlist.name}
      meta={`${currentIndex + 1}/${(playlist.videos || []).length}`}
      actions={
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          title={t("component.playlist.next-video")}
          aria-label={t("component.playlist.next-video")}
          onClick={onNext}
        >
          <icons.ArrowLeft className="size-4 rotate-180" />
        </Button>
      }
    >
      <VirtualVideoCardList
        playlist={playlist}
        includeChannel
        horizontal
        activeIndex={currentIndex}
      />
    </SectionPanel>
  );
}
