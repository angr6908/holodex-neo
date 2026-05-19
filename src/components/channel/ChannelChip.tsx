"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Avatar, AvatarImage } from "@/components/ui/avatar";

import { ChannelSocials } from "@/components/channel/ChannelSocials";
import { channelAvatarSizeClass } from "@/components/channel/ChannelImg";
import { getChannelPhoto } from "@/lib/functions";
import { channelDisplayName } from "@/lib/video-format";
import { useAppState } from "@/lib/store";
import { cn } from "@/lib/utils";
import * as icons from "@/lib/icons";

export function ChannelChip({
  channel,
  size = 60,
  closeDelay = 250,
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

  function toggleHover() {
    if (app.isMobile) setOpen((value) => !value);
  }

  return (
    <HoverCard open={open} onOpenChange={setOpen}>
      <HoverCardTrigger
        delay={0}
        closeDelay={closeDelay}
        render={
          <div
            className={cn("relative mr-1 overflow-hidden rounded-full", channelAvatarSizeClass(size))}
            onClick={toggleHover}
          />
        }
      >
        <Avatar className={channelAvatarSizeClass(size)}>
          <AvatarImage src={photo} alt={`${channel.name}'s profile picture`} width={size} height={size} decoding="async" />

        </Avatar>
        {children ? children({ isHover: open }) : open ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
            <Button nativeButton={false}
              render={<Link href={`/channel/${channel.id}`} />}
              size="icon"
              variant="ghost"
            >
              <icons.LogIn className="size-5" />
            </Button>
          </div>
        ) : null}
      </HoverCardTrigger>
      <HoverCardContent align="center" sideOffset={8} className="flex max-h-12 w-auto flex-row items-baseline gap-2 overflow-hidden px-2 py-2">
        <ChannelSocials channel={channel} vertical hideYt hideTwitter />
        <span className="ml-2 text-sm text-foreground">{channelName}</span>
      </HoverCardContent>
    </HoverCard>
  );
}
