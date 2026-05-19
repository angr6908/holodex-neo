"use client";
import { useMemo } from "react";
import { VideoCard } from "@/components/video/VideoCard";
import { Comment } from "@/components/video/Comment";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAppState } from "@/lib/store";
import { filterVideo } from "@/lib/filter-videos";
import { cn, getBreakpoint } from "@/lib/utils";

const gridColumnClasses: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
  7: "grid-cols-7",
  8: "grid-cols-8",
  9: "grid-cols-9",
  10: "grid-cols-10",
  11: "grid-cols-11",
  12: "grid-cols-12",
};

export function VideoCardList({ videos = [], includeChannel = false, includeAvatar = false, hideThumbnail = false, denseList = false, horizontal = false, autoFit = false, autoFitMin = "13rem", max = undefined, className = "", cols = { xs: 1, sm: 2, md: 3, lg: 4, xl: 5 }, activeId = "", dense = false, disableDefaultClick = false, filterConfig = {}, sortFn, showComments = false, inMultiViewSelector = false, fadeUnderNavExt = false, onVideoClicked, renderAction }: any) {
  const app = useAppState();
  const autoFitGrid = autoFit && !horizontal && !denseList;
  const colSize = useMemo(() => {
    const width = app.windowWidth || (typeof window !== "undefined" ? window.innerWidth : 1440);
    if (horizontal || denseList) return 1;
    if (autoFit) return 2;
    return cols[getBreakpoint(width)];
  }, [app.windowWidth, horizontal, denseList, autoFit, cols.xs, cols.sm, cols.md, cols.lg, cols.xl]);
  const list = useMemo(() => {
    const processed = (videos || [])
      .filter((v: any) => v && typeof v === "object" && v.id && v.channel)
      .filter((v: any) => filterVideo(v, app, { hideGroups: includeChannel, ...filterConfig }));
    const mapped = sortFn ? processed.map(sortFn) : processed;
    return max ? mapped.slice(0, max) : mapped;
  }, [videos, max, app, includeChannel, filterConfig, sortFn]);
  return <div className={cn("relative py-0", className)}><div className={cn("grid gap-x-2 gap-y-2.5", !autoFitGrid && (gridColumnClasses[horizontal || denseList ? 1 : colSize] || "grid-cols-1"), (denseList || horizontal) && list.length > 0 && "overflow-hidden rounded-xl border gap-y-0")} style={autoFitGrid ? { gridTemplateColumns: `repeat(auto-fit, minmax(min(${autoFitMin}, 100%), 1fr))` } : undefined}>{list.map((video: any, index: number) => <div key={`${video.id}-${index}`} className={cn("min-w-0 overflow-visible", (denseList || horizontal) && "[&:not(:last-child)]:border-b")}><VideoCard video={video} fluid includeChannel={includeChannel} horizontal={horizontal} includeAvatar={includeAvatar} colSize={colSize} active={video.id === activeId} disableDefaultClick={disableDefaultClick} denseList={denseList} hideThumbnail={hideThumbnail} inMultiViewSelector={inMultiViewSelector} onVideoClicked={onVideoClicked} action={renderAction?.(video)} />{showComments && video.comments ? <ScrollArea className="max-h-[400px] text-xs"><Separator className="mx-4" />{video.comments.map((comment: any, commentIndex: number) => <div key={`${comment.comment_key || "comment"}-${commentIndex}`} className="p-0"><Comment comment={comment} videoId={video.id} /></div>)}</ScrollArea> : null}</div>)}</div></div>;
}
