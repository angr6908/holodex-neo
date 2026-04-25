"use client";

import { useEffect, useMemo, useRef } from "react";
import { VideoCard } from "@/components/video/VideoCard";
import { cn } from "@/lib/cn";

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
  const root = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const videos = useMemo(() => playlist?.videos || [], [playlist]);

  useEffect(() => {
    if (activeIndex < 0) return;
    itemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  return (
    <div ref={root} style={{ overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain", height: pageMode ? undefined : height }}>
      {videos.map((video: any, index: number) => (
        <div
          key={`${video.id || "video"}-${index}`}
          ref={(el) => { itemRefs.current[index] = el; }}
          className={cn("virtual-video-list-item", index === activeIndex && "video-card-active")}
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
            parentPlaylistId={(playlist && playlist.id) || "local"}
            {...rest}
          />
        </div>
      ))}
    </div>
  );
}
