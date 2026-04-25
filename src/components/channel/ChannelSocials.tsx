"use client";

import { mdiAccountCancel, mdiHeartOutline, mdiTwitch } from "@mdi/js";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useAppState } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import * as icons from "@/lib/icons";
import { cn } from "@/lib/cn";

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
  const { t } = useI18n();
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
    <div
      className={cn(
        "flex gap-2",
        vertical
          ? "flex-col items-start"
          : "channel-social-horizontal items-center",
        className,
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {channel?.id && !hideYt ? (
        <Button
          as="a"
          variant="ghost"
          size="icon"
          href={`https://www.youtube.com/channel/${channel.id}`}
          rel="noreferrer"
          target="_blank"
          title="YouTube"
        >
          <Icon icon={icons.mdiYoutube} className="text-red-500" />
        </Button>
      ) : null}
      {channel?.twitter && !hideTwitter ? (
        <Button
          as="a"
          variant="ghost"
          size="icon"
          href={`https://twitter.com/${channel.twitter}`}
          rel="noreferrer"
          target="_blank"
          title="Twitter"
        >
          <Icon icon={icons.mdiTwitter} className="text-sky-400" />
        </Button>
      ) : null}
      {channel?.twitch && !hideTwitch ? (
        <Button
          as="a"
          variant="ghost"
          size="icon"
          href={`https://twitch.tv/${channel.twitch}`}
          rel="noreferrer"
          target="_blank"
          title="Twitch"
        >
          <Icon icon={mdiTwitch} className="text-violet-400" />
        </Button>
      ) : null}
      {channel?.type === "vtuber" && !hideFav ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title={tooltip}
          onClick={toggleFavorite}
        >
          <Icon
            icon={isFavorited ? icons.mdiHeart : mdiHeartOutline}
            className={
              isFavorited && app.isLoggedIn ? "text-rose-400" : "text-slate-500"
            }
          />
        </Button>
      ) : null}
      {showDelete ? (
        <Button
          type="button"
          variant={isBlocked ? "destructive" : "ghost"}
          size="sm"
          title={blockTooltip}
          onClick={(e: any) => {
            e.preventDefault();
            e.stopPropagation();
            toggleBlocked();
          }}
        >
          <Icon icon={mdiAccountCancel} />
          {isBlocked ? (
            <span>{t("component.channelSocials.blocked")}</span>
          ) : null}
        </Button>
      ) : null}
    </div>
  );
}
