"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { channelAvatarSizeClass } from "@/components/channel/ChannelImg";
import { ChannelSocials } from "@/components/channel/ChannelSocials";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { getChannelPhoto } from "@/lib/functions";
import { useAppState } from "@/lib/store";
import { cn } from "@/lib/utils";
import { channelDisplayName, channelGroup } from "@/lib/video-format";

export function ChannelChip({
  channel,
  size = 60,
  closeDelay = 100,
  children,
}: {
  channel: Record<string, any>;
  size?: number;
  closeDelay?: number;
  children?: (ctx: { isHover: boolean }) => React.ReactNode;
}) {
  const app = useAppState();
  const [open, setOpen] = useState(false);
  const channelName = channelDisplayName(channel, app.settings.useEnglishName);
  const photo = useMemo(() => getChannelPhoto(channel?.id), [channel?.id]);
  const group = channelGroup(channel);
  const orgText = channel.org ? channel.org + (group ? ` / ${group}` : "") : null;

  function toggleHover() {
    if (app.isMobile) setOpen((value) => !value);
  }

  return (
    <HoverCard open={open} onOpenChange={setOpen}>
      {/* Open slower than close so sweeping the cursor across a row of chips doesn't stack
          multiple animating cards; only a deliberate pause opens one. */}
      <HoverCardTrigger
        delay={200}
        closeDelay={closeDelay}
        render={
          <div
            className={cn(
              "relative mr-1 overflow-hidden rounded-full",
              channelAvatarSizeClass(size),
            )}
            onClick={toggleHover}
          />
        }
      >
        <Avatar className={channelAvatarSizeClass(size)}>
          <AvatarImage
            src={photo}
            alt={`${channel.name}'s profile picture`}
            width={size}
            height={size}
            decoding="async"
          />
        </Avatar>
        {children ? children({ isHover: open }) : null}
      </HoverCardTrigger>
      {/* Mirrors the channel row in WatchInfo (avatar / name link / org line, socials) at a
          smaller scale so channel identity reads the same everywhere. */}
      <HoverCardContent align="center" sideOffset={8} className="w-auto min-w-56 max-w-72 p-3">
        <div className="flex items-center gap-3">
          <Avatar className={cn("shrink-0", channelAvatarSizeClass(40))}>
            <AvatarImage src={photo} alt="" width={40} height={40} decoding="async" />
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <Link
              href={`/channel/${channel.id}`}
              className="truncate text-sm font-medium text-foreground no-underline hover:underline"
            >
              {channelName}
            </Link>
            {orgText ? (
              <span className="truncate text-xs text-muted-foreground">{orgText}</span>
            ) : null}
          </div>
        </div>
        <ChannelSocials channel={channel} className="mt-2.5" />
      </HoverCardContent>
    </HoverCard>
  );
}
