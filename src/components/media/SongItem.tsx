"use client";

import { useTranslations } from "next-intl";
import { type KeyboardEvent, type MouseEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Item, ItemContent, ItemMedia } from "@/components/ui/item";
import type { AnyIcon } from "@/lib/icons";
import * as icons from "@/lib/icons";
import { useAppState } from "@/lib/store";
import { formatDistance, formatDuration, secondsToHuman } from "@/lib/time";
import { cn } from "@/lib/utils";
import { channelDisplayName } from "@/lib/video-format";

type SongChannel = {
  name?: string;
  [key: string]: unknown;
};

type Song = {
  art?: string;
  available_at?: string;
  channel?: SongChannel;
  creator_id?: string | number;
  end: number;
  name: string;
  original_artist?: string;
  start: number;
};

type SongItemProps = {
  song: Song;
  detailed?: boolean;
  alwaysShowDeletion?: boolean;
  showTime?: boolean;
  hoverIcon?: AnyIcon;
  artworkHoverIcon?: AnyIcon;
  color?: string;
  onPlay?: (song: Song) => void;
  onPlayNow?: (song: Song) => void;
  onRemove?: (song: Song) => void;
  onChannel?: (song: Song) => void;
};

export function SongItem({
  song,
  detailed = false,
  alwaysShowDeletion = false,
  showTime = false,
  hoverIcon: HoverIcon = icons.Play,
  artworkHoverIcon: ArtworkHoverIcon = icons.Play,
  color = "",
  onPlay,
  onPlayNow,
  onRemove,
  onChannel,
}: SongItemProps) {
  const app = useAppState();
  const t = useTranslations();
  const [hover, setHover] = useState(false);
  const [hoverInner, setHoverInner] = useState(false);
  const user = app.userdata?.user;
  const userCanDelete =
    user?.role && user?.id && (user.role !== "user" || +user.id === +song.creator_id);
  const formattedTime = formatDistance(song.available_at, app.settings.lang, t);
  const channelName = channelDisplayName(song.channel, app.settings.useEnglishName);

  function playSong() {
    onPlay?.(song);
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!onPlay || (event.key !== "Enter" && event.key !== " ")) return;

    event.preventDefault();
    playSong();
  }

  function handlePlayNow(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    event.preventDefault();
    onPlayNow?.(song);
  }

  function handleRemove(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onRemove?.(song);
  }

  function handleChannel(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onChannel?.(song);
  }

  return (
    <Item
      className="flex-nowrap items-start gap-3"
      role={onPlay ? "button" : undefined}
      tabIndex={onPlay ? 0 : undefined}
      onClick={playSong}
      onKeyDown={handleRowKeyDown}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <ItemMedia
        className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl"
        onMouseEnter={() => setHoverInner(true)}
        onMouseLeave={() => setHoverInner(false)}
      >
        {song.art ? (
          <img src={song.art} className="h-full w-full object-cover" alt="" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <icons.Music className="size-5 text-muted-foreground" />
          </div>
        )}

        {hover && !hoverInner ? (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/45"
            aria-hidden="true"
          >
            <HoverIcon className="size-5 text-white drop-shadow-sm" />
          </div>
        ) : null}

        {onPlayNow && hoverInner ? (
          <button
            type="button"
            className="absolute inset-0 flex items-center justify-center bg-black/45 text-white outline-none transition-colors hover:bg-black/55 focus-visible:ring-2 focus-visible:ring-ring"
            onClick={handlePlayNow}
          >
            <ArtworkHoverIcon className="size-5 drop-shadow-sm" />
          </button>
        ) : null}
      </ItemMedia>

      <ItemContent className="min-w-0 flex-1 gap-0 py-1 pt-1">
        <div className={cn("text-base leading-7", color)}>
          {alwaysShowDeletion || (detailed && onRemove && userCanDelete) ? (
            <Button
              type="button"
              variant="link"
              size="xs"
              className="float-right ml-1 h-auto px-0 py-0 font-normal"
              onClick={handleRemove}
            >
              {t("component.media.remove")}
            </Button>
          ) : null}

          {detailed ? (
            <div className="float-right text-caption">
              [{secondsToHuman(song.start)} - {secondsToHuman(song.end)}]
            </div>
          ) : null}

          <span className="line-clamp-1 break-words text-left hyphens-auto">
            {song.name} / <span className="text-primary">{song.original_artist}</span>
          </span>
        </div>

        <div className={cn("text-xs leading-5", color)}>
          <div className="float-right">
            {showTime ? <span className="opacity-40">{formattedTime}</span> : null}{" "}
            {formatDuration((song.end - song.start) * 1000)}
          </div>

          {onChannel ? (
            <Button
              type="button"
              variant="link"
              size="xs"
              className="h-auto px-0 py-0 text-xs font-normal"
              onClick={handleChannel}
            >
              {channelName}
            </Button>
          ) : (
            <span> {channelName} </span>
          )}
        </div>
      </ItemContent>
    </Item>
  );
}
