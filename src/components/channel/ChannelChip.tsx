"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

import { ChannelSocials } from "@/components/channel/ChannelSocials";
import { getChannelPhoto } from "@/lib/functions";
import { channelDisplayName } from "@/lib/video-format";
import { useAppState } from "@/lib/store";
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
      <div
        className="relative mr-1 overflow-hidden rounded-full"
        style={{ width: `${size}px`, height: `${size}px` }}
      >
        <HoverCardTrigger
          delay={0}
          closeDelay={closeDelay}
          render={
            <Button
              type="button"
              variant="ghost"
              className="h-full w-full rounded-full p-0 hover:bg-transparent"
              onClick={toggleHover}
            />
          }
        >
          <img src={photo} alt={`${channel.name}'s profile picture`} width={size} height={size} decoding="async" className="h-full w-full object-cover" />
        </HoverCardTrigger>
        {children ? children({ isHover: open }) : open ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/70">
            <Button nativeButton={false}
              render={<Link href={`/channel/${channel.id}`} />}
              size="icon"
              variant="ghost"
              className="pointer-events-auto"
            >
              <icons.LogIn className="size-5" />
            </Button>
          </div>
        ) : null}
      </div>
      <HoverCardContent align="center" sideOffset={8} className="z-[80] flex max-h-12 w-auto flex-row items-baseline gap-2 overflow-hidden border border-white/10 px-2 py-2">
        <ChannelSocials channel={channel} vertical hideYt hideTwitter />
        <span className="ml-2 text-sm text-slate-300">{channelName}</span>
      </HoverCardContent>
    </HoverCard>
  );
}
