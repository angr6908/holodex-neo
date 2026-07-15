"use client";
import { useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Comment } from "@/components/video/Comment";
import { VideoCard } from "@/components/video/VideoCard";
import { makeVideoFilter } from "@/lib/filter-videos";
import { useAppState } from "@/lib/store";
import { cn, GRID_COLUMN_CLASSES, getBreakpoint } from "@/lib/utils";

export function VideoCardList({
  videos = [],
  includeChannel = false,
  includeAvatar = false,
  hideThumbnail = false,
  denseList = false,
  horizontal = false,
  autoFit = false,
  autoFill = false,
  autoFitMin = "13rem",
  max = undefined,
  className = "",
  cols = { xs: 1, sm: 2, md: 3, lg: 4, xl: 5 },
  activeId = "",
  dense = false,
  disableDefaultClick = false,
  filterConfig = {},
  sortFn,
  showComments = false,
  inMultiViewSelector = false,
  fadeUnderNavExt = false,
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
  }, [
    app.windowWidth,
    horizontal,
    denseList,
    autoFit,
    autoFill,
    cols.xs,
    cols.sm,
    cols.md,
    cols.lg,
    cols.xl,
  ]);
  const list = useMemo(() => {
    const matchesFilter = makeVideoFilter(app, { hideGroups: includeChannel, ...filterConfig });
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
    // The filter only reads these slices of app state, so unrelated store updates don't re-run it.
  }, [
    videos,
    max,
    includeChannel,
    filterConfig,
    sortFn,
    app.blockedChannelIDs,
    app.ignoredTopicsSet,
    app.favoriteChannelIDs,
    app.settings.hiddenGroups,
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
        )}
        style={
          autoFitGrid
            ? {
                gridTemplateColumns: `repeat(${autoFill ? "auto-fill" : "auto-fit"}, minmax(min(${autoFitMin}, 100%), 1fr))`,
              }
            : undefined
        }
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
