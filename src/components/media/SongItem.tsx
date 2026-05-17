"use client";

import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { Item, ItemContent, ItemMedia } from "@/components/ui/item";
import { type AnyIcon } from "@/lib/icons";
import { useAppState } from "@/lib/store";
import { channelDisplayName } from "@/lib/video-format";
import { formatDistance, formatDuration, secondsToHuman } from "@/lib/time";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import * as icons from "@/lib/icons";

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
  hoverIcon: HoverIcon,
  artworkHoverIcon: ArtworkHoverIcon,
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
  const userCanDelete = user?.role && user?.id && (user.role !== "user" || +user.id === +song.creator_id);
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
      className="flex-nowrap items-start gap-3 rounded-xl px-3 py-2 hover:bg-white/5"
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
          <div className="flex h-full w-full bg-slate-700 p-1">
            <Button type="button" size="icon" variant="outline" className="m-auto h-8 w-8" disabled>
              <icons.Music className="size-4" />
            </Button>
          </div>
        )}

        {hover && !hoverInner ? (
          <div className="hover-item absolute left-0 top-0 flex h-full w-full p-1">
            <Button
              type="button"
              size="icon"
              className="m-auto h-8 w-8 rounded-full bg-sky-300 text-slate-950 shadow-md"
              tabIndex={-1}
              aria-hidden="true"
            >
              <HoverIcon className="size-4" />
            </Button>
          </div>
        ) : null}

        {onPlayNow && hoverInner ? (
          <div className="hover-art absolute left-0 top-0 flex h-full w-full p-1">
            <Button
              type="button"
              size="icon"
              className="m-auto h-8 w-8 rounded-full bg-sky-300 text-slate-950 shadow-md"
              onClick={handlePlayNow}
            >
              <ArtworkHoverIcon className="size-4" />
            </Button>
          </div>
        ) : null}
      </ItemMedia>

      <ItemContent className="min-w-0 flex-1 gap-0 py-1 pt-1">
        <div className={cn("text-base leading-7", color)}>
          {alwaysShowDeletion || (detailed && onRemove && userCanDelete) ? (
            <Button
              type="button"
              variant="link"
              size="xs"
              className="float-right ml-1 h-auto rounded-none px-0 py-0 font-normal text-destructive hover:bg-muted"
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
            {song.name} / <span className="text-[color:var(--color-primary)]">{song.original_artist}</span>
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
              className="h-auto rounded-none px-0 py-0 text-xs font-normal text-inherit underline-offset-4 hover:bg-muted hover:underline"
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
