"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
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
  const [isHover, setIsHover] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelName = channelDisplayName(channel, app.settings.nameProperty === "english_name");
  const photo = useMemo(() => getChannelPhoto(channel?.id), [channel?.id]);

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  function handleEnter() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (!app.isMobile) setIsHover(true);
  }

  function handleLeave() {
    if (app.isMobile) return;
    closeTimer.current = setTimeout(() => setIsHover(false), closeDelay);
  }

  function toggleHover() {
    if (app.isMobile) setIsHover((value) => !value);
  }

  return (
    <div className="relative mr-1" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <div
        role="button"
        tabIndex={0}
        className="relative overflow-hidden rounded-full"
        style={{ width: `${size}px`, height: `${size}px` }}
        onClick={toggleHover}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggleHover();
          }
        }}
      >
        <img src={photo} crossOrigin="anonymous" alt={`${channel.name}'s profile picture`} width={size} height={size} className="h-full w-full object-cover" />
        {children ? children({ isHover }) : isHover ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70">
            <Button as={Link} href={`/channel/${channel.id}`} size="icon" variant="ghost">
              <Icon icon={icons.mdiLoginVariant} />
            </Button>
          </div>
        ) : null}
      </div>

      {isHover ? (
        <Card className="channel-hover-tooltip absolute left-1/2 top-full z-[80] mt-2 flex -translate-x-1/2 flex-row items-baseline gap-2 border border-white/10 px-2 py-2">
          <ChannelSocials channel={channel} vertical hideYt hideTwitter />
          <span className="ml-2 text-sm text-slate-300">{channelName}</span>
        </Card>
      ) : null}
    </div>
  );
}
