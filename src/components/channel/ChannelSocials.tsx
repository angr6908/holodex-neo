"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { AnyIcon } from "@/lib/icons";
import * as icons from "@/lib/icons";
import { Heart, TwitchIcon, UserX } from "@/lib/icons";
import { useAppState } from "@/lib/store";
import { cn } from "@/lib/utils";

function SocialLink({ href, label, icon: Icon }: { href: string; label: string; icon: AnyIcon }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            nativeButton={false}
            render={<a href={href} rel="noreferrer" target="_blank" aria-label={label} />}
            variant="ghost"
            size="icon"
          />
        }
      >
        <Icon className="size-5" />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function favoriteTooltipKey(isLoggedIn: boolean, isFavorited: boolean) {
  if (!isLoggedIn) return "component.channelList.signInToFavorite";
  return isFavorited
    ? "component.channelSocials.removeFromFavorites"
    : "component.channelSocials.addToFavorites";
}

function FavoriteButton({ channelId }: { channelId: string }) {
  const app = useAppState();
  const t = useTranslations();
  const isFavorited = app.isFavorited(channelId);
  const tooltip = t(favoriteTooltipKey(app.isLoggedIn, isFavorited));
  function toggleFavorite(event: React.MouseEvent) {
    event.preventDefault();
    if (!app.isLoggedIn) return;
    app.toggleFavorite(channelId);
  }
  return (
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
        <Heart className={cn("size-5", isFavorited && app.isLoggedIn && "text-primary")} />
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function BlockButton({ channel }: { channel: Record<string, any> }) {
  const app = useAppState();
  const t = useTranslations();
  const isBlocked = app.blockedChannelIDs.has(channel?.id);
  const blockTooltip = !isBlocked
    ? t("component.channelSocials.block")
    : t("component.channelSocials.unblock");
  function toggleBlocked() {
    const blocked = app.settings.blockedChannels || [];
    if (isBlocked)
      app.patchSettings({
        blockedChannels: blocked.filter((x: any) => x.id !== channel.id),
      } as any);
    else app.patchSettings({ blockedChannels: [...blocked, channel] } as any);
  }
  return (
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
        {isBlocked ? <span>{t("component.channelSocials.blocked")}</span> : null}
      </TooltipTrigger>
      <TooltipContent>{blockTooltip}</TooltipContent>
    </Tooltip>
  );
}

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
          <SocialLink
            href={`https://www.youtube.com/channel/${channel.id}`}
            label="YouTube"
            icon={icons.YoutubeIcon}
          />
        ) : null}
        {channel?.twitter && !hideTwitter ? (
          <SocialLink
            href={`https://twitter.com/${channel.twitter}`}
            label="Twitter"
            icon={icons.TwitterIcon}
          />
        ) : null}
        {channel?.twitch && !hideTwitch ? (
          <SocialLink
            href={`https://twitch.tv/${channel.twitch}`}
            label="Twitch"
            icon={TwitchIcon}
          />
        ) : null}
        {channel?.type === "vtuber" && !hideFav ? <FavoriteButton channelId={channel?.id} /> : null}
        {showDelete ? <BlockButton channel={channel} /> : null}
      </div>
    </TooltipProvider>
  );
}
