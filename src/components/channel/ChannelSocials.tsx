"use client";

import { UserX, Heart, TwitchIcon } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAppState } from "@/lib/store";
import { useTranslations } from "next-intl";
import * as icons from "@/lib/icons";
import { cn } from "@/lib/utils";
export function ChannelSocials({
  channel,
  vertical = false,
  hideYt = false,
  hideTwitter = false,
  hideTwitch = false,
  hideFav = false,
  showDelete = false,
  className = "",
}: {
  channel: Record<string, any>;
  vertical?: boolean;
  hideYt?: boolean;
  hideTwitter?: boolean;
  hideTwitch?: boolean;
  hideFav?: boolean;
  showDelete?: boolean;
  className?: string;
}) {
  const app = useAppState();
  const t = useTranslations();
  const isBlocked = app.blockedChannelIDs.has(channel?.id);
  const isFavorited = app.isFavorited(channel?.id);
  const tooltip = !app.isLoggedIn
    ? t("component.channelList.signInToFavorite")
    : !isFavorited
      ? t("component.channelSocials.addToFavorites")
      : t("component.channelSocials.removeFromFavorites");
  const blockTooltip = !isBlocked
    ? t("component.channelSocials.block")
    : t("component.channelSocials.unblock");
  function toggleFavorite(event: React.MouseEvent) {
    event.preventDefault();
    if (!app.isLoggedIn) return;
    app.toggleFavorite(channel.id);
  }
  function toggleBlocked() {
    const blocked = app.settings.blockedChannels || [];
    if (isBlocked)
      app.patchSettings({
        blockedChannels: blocked.filter((x: any) => x.id !== channel.id),
      } as any);
    else app.patchSettings({ blockedChannels: [...blocked, channel] } as any);
  }
  return (
    <TooltipProvider>
      <div
        className={cn(
          "flex gap-2",
          vertical ? "flex-col items-start" : "flex-wrap items-center",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {channel?.id && !hideYt ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button nativeButton={false}
                  render={
                    <a
                      href={`https://www.youtube.com/channel/${channel.id}`}
                      rel="noreferrer"
                      target="_blank"
                      aria-label="YouTube"
                    />
                  }
                  variant="ghost"
                  size="icon"
                />
              }
            >
              <icons.YoutubeIcon className="size-5" />
            </TooltipTrigger>
            <TooltipContent>YouTube</TooltipContent>
          </Tooltip>
        ) : null}
        {channel?.twitter && !hideTwitter ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button nativeButton={false}
                  render={
                    <a
                      href={`https://twitter.com/${channel.twitter}`}
                      rel="noreferrer"
                      target="_blank"
                      aria-label="Twitter"
                    />
                  }
                  variant="ghost"
                  size="icon"
                />
              }
            >
              <icons.TwitterIcon className="size-5" />
            </TooltipTrigger>
            <TooltipContent>Twitter</TooltipContent>
          </Tooltip>
        ) : null}
        {channel?.twitch && !hideTwitch ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button nativeButton={false}
                  render={
                    <a
                      href={`https://twitch.tv/${channel.twitch}`}
                      rel="noreferrer"
                      target="_blank"
                      aria-label="Twitch"
                    />
                  }
                  variant="ghost"
                  size="icon"
                />
              }
            >
              <TwitchIcon className="size-5" />
            </TooltipTrigger>
            <TooltipContent>Twitch</TooltipContent>
          </Tooltip>
        ) : null}
        {channel?.type === "vtuber" && !hideFav ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={tooltip}
                  onClick={toggleFavorite}
                />
              }
            >
              {isFavorited ? <icons.Heart className={cn("size-5", isFavorited && app.isLoggedIn && "text-primary")} /> : <Heart className={cn("size-5", isFavorited && app.isLoggedIn && "text-primary")} />}
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
          </Tooltip>
        ) : null}
        {showDelete ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant={isBlocked ? "destructive" : "ghost"}
                  size="sm"
                  aria-label={blockTooltip}
                  onClick={(e: any) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleBlocked();
                  }}
                />
              }
            >
              <UserX className="size-5" />
              {isBlocked ? (
                <span>{t("component.channelSocials.blocked")}</span>
              ) : null}
            </TooltipTrigger>
            <TooltipContent>{blockTooltip}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
