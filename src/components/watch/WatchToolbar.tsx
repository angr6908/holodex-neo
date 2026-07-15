"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { ChannelChip } from "@/components/channel/ChannelChip";
import { VideoCardMenu } from "@/components/common/VideoCardMenu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LiveViewers } from "@/components/watch/LiveViewers";
import * as icons from "@/lib/icons";
import { ArrowLeft } from "@/lib/icons";
import { useAppState } from "@/lib/store";
import { formatDistance, formatDuration, titleTimeString } from "@/lib/time";
import { twitchLoginOf } from "@/lib/twitch-viewers";
import { elapsedLiveDuration } from "@/lib/video-format";

export function WatchToolbar({
  video,
  children,
}: {
  video: Record<string, any>;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const app = useAppState();
  const t = useTranslations();
  const locale = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const [elapsedTime, setElapsedTime] = useState("");

  const hasSaved = app.playlist.some((item) => item.id === video.id);
  const saveLabel = hasSaved
    ? t("views.watch.removeFromPlaylist")
    : t("views.watch.saveToPlaylist");

  // YouTube ids are 11 URL-safe chars; those get the direct-from-YouTube live count. Twitch
  // streams (twitch link/channel/type) get the direct-from-Twitch count instead.
  const isYoutube =
    /^[\w-]{11}$/.test(video.id || "") &&
    video.type !== "twitch" &&
    !video.link?.includes?.("twitch");
  const twitchLogin = isYoutube ? "" : twitchLoginOf(video);

  const timeLabel =
    video.status === "upcoming"
      ? formatDistance(video.start_scheduled, locale, t)
      : video.status === "live"
        ? elapsedTime || (video.start_actual ? elapsedLiveDuration(video.start_actual) : "")
        : video.status === "past" && video.duration
          ? formatDuration(video.duration * 1000)
          : null;

  const absoluteTimeString = titleTimeString(video.available_at, locale);

  const searchTopicUrl = (() => {
    const topic = video.topic_id || "";
    if (!topic) return "#";
    const capitalizedTopic = topic[0].toUpperCase() + topic.slice(1);
    let q = `type,value,text\ntopic,"${topic}","${capitalizedTopic}"`;
    if (video.channel?.org) q += `\norg,${video.channel.org},${video.channel.org}`;
    return `/search?${new URLSearchParams({ q })}`;
  })();

  const mentions: any[] = video.mentions || [];

  useEffect(() => {
    if (video.status !== "live") return;
    const timer = setInterval(() => setElapsedTime(elapsedLiveDuration(video.start_actual)), 1000);
    return () => clearInterval(timer);
  }, [video.status, video.start_actual]);

  function toggleSaved() {
    if (hasSaved) app.removeFromPlaylist(video.id);
    else app.addToPlaylist(video);
  }
  const reloadVideo = () => {
    const curr = document.querySelector('[id^="youtube-player"]') as HTMLIFrameElement | null;
    if (curr?.contentWindow) curr.contentWindow.location.replace(curr.src);
  };

  return (
    <TooltipProvider>
      <div className="sticky top-[var(--nav-h)] z-40 flex items-center gap-2 border-b bg-background px-3 py-2 max-[959px]:top-[calc(var(--nav-h)+var(--pad-y))] lg:px-4">
        <Button type="button" size="icon" variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="size-5" />
        </Button>

        {/* Stream metadata */}
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-sm text-muted-foreground">
          {video.status === "live" && isYoutube ? (
            <LiveViewers key={video.id} platform="youtube" id={video.id} />
          ) : video.status === "live" && twitchLogin ? (
            <LiveViewers key={twitchLogin} platform="twitch" id={twitchLogin} />
          ) : null}
          {video.topic_id ? (
            <Badge
              render={
                <Link
                  href={searchTopicUrl}
                  className="inline-flex shrink-0 items-center gap-1.5 capitalize no-underline font-ibm"
                />
              }
              variant="secondary"
            >
              <icons.Tag className="size-3.5" />
              {video.topic_id}
            </Badge>
          ) : null}
          {timeLabel ? (
            <Tooltip>
              <TooltipTrigger
                render={<Badge variant="secondary" className="shrink-0 gap-1.5 cursor-default" />}
              >
                <icons.Clock className="size-3.5" />
                <span className="font-ibm-digits">{timeLabel}</span>
              </TooltipTrigger>
              <TooltipContent className="whitespace-pre-line text-center">
                {absoluteTimeString}
              </TooltipContent>
            </Tooltip>
          ) : null}
          {mentions.length > 0 ? (
            <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto overscroll-x-contain">
              {mentions.map((mention: any, i: number) => (
                <span key={`${mention.id ?? "m"}-${i}`} className="shrink-0">
                  <ChannelChip channel={mention} size={32} />
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {children}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={t("views.watch.reloadVideoFrame")}
                  onClick={reloadVideo}
                />
              }
            >
              <icons.RefreshCw className="size-5" />
            </TooltipTrigger>
            <TooltipContent>{t("views.watch.reloadVideoFrame")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Toggle pressed={hasSaved} aria-label={saveLabel} onPressedChange={toggleSaved} />
              }
            >
              {hasSaved ? (
                <icons.Check className="size-5" />
              ) : (
                <icons.SquarePlus className="size-5" />
              )}
            </TooltipTrigger>
            <TooltipContent>{saveLabel}</TooltipContent>
          </Tooltip>
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <PopoverTrigger
                    render={
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={t("component.common.moreActions")}
                      />
                    }
                  />
                }
              >
                <icons.MoreVertical className="size-5" />
              </TooltipTrigger>
              <TooltipContent>{t("component.common.moreActions")}</TooltipContent>
            </Tooltip>
            <PopoverContent align="end" sideOffset={8} className="w-56">
              <VideoCardMenu video={video} close={() => setMenuOpen(false)} />
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </TooltipProvider>
  );
}
