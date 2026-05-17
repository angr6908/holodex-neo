"use client";

import { useEffect, useMemo, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VideoCard } from "@/components/video/VideoCard";
import { cn } from "@/lib/utils";
export function VirtualVideoCardList({
  playlist,
  includeChannel,
  includeAvatar,
  hideThumbnail = false,
  horizontal = true,
  activeId = null,
  dense,
  disableDefaultClick,
  activePlaylistItem,
  activeIndex = -1,
  height = "500px",
  pageMode,
  ...rest
}: {
  playlist: Record<string, any>;
  includeChannel?: boolean;
  includeAvatar?: boolean;
  hideThumbnail?: boolean;
  horizontal?: boolean;
  keeps?: number;
  pageMode?: boolean;
  activeId?: string | null;
  dense?: boolean;
  disableDefaultClick?: boolean;
  activePlaylistItem?: boolean;
  activeIndex?: number;
  height?: string;
  [key: string]: any;
}) {
  const itemRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const videos = useMemo(() => playlist?.videos || [], [playlist]);

  useEffect(() => {
    if (activeIndex < 0) return;
    itemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  return (
    <ScrollArea
      className="[&>[data-slot=scroll-area-viewport]]:overscroll-contain"
      style={{ height: pageMode ? undefined : height }}
    >
      {videos.map((video: any, index: number) => (
        <div
          key={`${video.id || "video"}-${index}`}
          ref={(el) => { itemRefs.current[index] = el; }}
          className={cn("relative px-1 py-1.5", index === activeIndex && "before:pointer-events-none before:absolute before:-inset-px before:rounded before:bg-primary/15 before:content-['']")}
        >
          <VideoCard
            video={video}
            includeChannel={includeChannel}
            includeAvatar={includeAvatar}
            hideThumbnail={hideThumbnail}
            horizontal={horizontal}
            active={activePlaylistItem ? index === activeIndex : video.id === activeId}
            activePlaylistItem={activePlaylistItem}
            dense={dense}
            disableDefaultClick={disableDefaultClick}
            parentPlaylistId={playlist?.id || "local"}
            {...rest}
          />
        </div>
      ))}
    </ScrollArea>
  );
}
