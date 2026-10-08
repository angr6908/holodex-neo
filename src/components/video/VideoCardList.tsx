"use client";
import dynamic from "next/dynamic";
import { type CSSProperties, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { VideoCard } from "@/components/video/VideoCard";
import { makeVideoFilter } from "@/lib/filter-videos";
import { loadComment } from "@/lib/lazy";
import { useAppState } from "@/lib/store";
import { cn, GRID_COLUMN_CLASSES, getBreakpoint } from "@/lib/utils";

// Only search results show comments (with linkified text), so they load when shown.
const Comment = dynamic(() => loadComment().then((m) => m.Comment), { ssr: false });

const NO_VIDEOS: any[] = [];
const DEFAULT_COLS = { xs: 1, sm: 2, md: 3, lg: 4, xl: 5 };
const NO_FILTER = {};

export function VideoCardList({
  videos = NO_VIDEOS,
  includeChannel = false,
  includeAvatar = false,
  hideThumbnail = false,
  denseList = false,
  displayStartTime = false,
  horizontal = false,
  autoFit = false,
  autoFill = false,
  autoFitMin = "13rem",
  max = undefined,
  className = "",
  cols = DEFAULT_COLS,
  activeId = "",
  disableDefaultClick = false,
  filterConfig = NO_FILTER,
  sortFn,
  showComments = false,
  inMultiViewSelector = false,
  onVideoClicked,
  renderAction,
}: any) {
  const app = useAppState();
  // autoFill keeps empty tracks (auto-fill), so card width stays constant however few videos
  // there are; autoFit collapses them (auto-fit), stretching a short row to fill the container.
  const autoFitGrid = (autoFit || autoFill) && !horizontal && !denseList;
  const colSize = useMemo(() => {
    const width = app.windowWidth || (typeof window !== "undefined" ? window.innerWidth : 1440);
    if (horizontal || denseList) return 1;
    if (autoFit || autoFill) return 2;
    return cols[getBreakpoint(width)];
  }, [app.windowWidth, horizontal, denseList, autoFit, autoFill, cols]);
  // The filter only reads these slices of app state, so unrelated store updates don't re-run it.
  const { blockedChannelIDs, ignoredTopicsSet, favoriteChannelIDs } = app;
  const hiddenGroups = app.settings.hiddenGroups;
  const list = useMemo(() => {
    const matchesFilter = makeVideoFilter(
      { blockedChannelIDs, ignoredTopicsSet, favoriteChannelIDs, settings: { hiddenGroups } },
      { hideGroups: includeChannel, ...filterConfig },
    );
    const processed = (videos || [])
      .filter((v: any) => v && typeof v === "object" && v.id && v.channel)
      .filter(matchesFilter);
    const mapped = sortFn ? processed.map(sortFn) : processed;
    const seen = new Set<string>();
    const deduped = mapped.filter((v: any) => {
      if (seen.has(v.id)) return false;
      seen.add(v.id);
      return true;
    });
    return max ? deduped.slice(0, max) : deduped;
  }, [
    videos,
    max,
    includeChannel,
    filterConfig,
    sortFn,
    blockedChannelIDs,
    ignoredTopicsSet,
    favoriteChannelIDs,
    hiddenGroups,
  ]);
  return (
    <div className={cn("relative py-0", className)}>
      <div
        className={cn(
          "grid gap-x-2 gap-y-2.5",
          !autoFitGrid &&
            (GRID_COLUMN_CLASSES[horizontal || denseList ? 1 : colSize] || "grid-cols-1"),
          (denseList || horizontal) &&
            list.length > 0 &&
            "overflow-hidden rounded-xl border gap-y-0",
          autoFitGrid &&
            (autoFill
              ? "grid-cols-[repeat(auto-fill,minmax(min(var(--grid-min),100%),1fr))]"
              : "grid-cols-[repeat(auto-fit,minmax(min(var(--grid-min),100%),1fr))]"),
        )}
        style={autoFitGrid ? ({ "--grid-min": autoFitMin } as CSSProperties) : undefined}
      >
        {list.map((video: any) => (
          <div
            key={video.id}
            className={cn(
              "min-w-0 overflow-visible",
              (denseList || horizontal) && "[&:not(:last-child)]:border-b",
            )}
          >
            <VideoCard
              video={video}
              fluid
              includeChannel={includeChannel}
              horizontal={horizontal}
              includeAvatar={includeAvatar}
              colSize={colSize}
              active={video.id === activeId}
              disableDefaultClick={disableDefaultClick}
              denseList={denseList}
              displayStartTime={displayStartTime}
              hideThumbnail={hideThumbnail}
              inMultiViewSelector={inMultiViewSelector}
              onVideoClicked={onVideoClicked}
              action={renderAction?.(video)}
            />
            {showComments && video.comments ? (
              <ScrollArea className="max-h-[400px] text-xs">
                <Separator className="mx-4" />
                {video.comments.map((comment: any, commentIndex: number) => (
                  <div key={`${comment.comment_key || "comment"}-${commentIndex}`} className="p-0">
                    <Comment comment={comment} videoId={video.id} />
                  </div>
                ))}
              </ScrollArea>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
