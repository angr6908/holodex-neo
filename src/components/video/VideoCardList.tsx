"use client";
import { useMemo } from "react";
import { VideoCard } from "@/components/video/VideoCard";
import { Comment } from "@/components/video/Comment";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAppState } from "@/lib/store";
import { filterVideo } from "@/lib/filter-videos";
import { cn, getBreakpoint } from "@/lib/utils";
export function VideoCardList({ videos = [], includeChannel = false, includeAvatar = false, hideThumbnail = false, denseList = false, horizontal = false, max = undefined, className = "", cols = { xs: 1, sm: 2, md: 3, lg: 4, xl: 5 }, activeId = "", dense = false, disableDefaultClick = false, filterConfig = {}, sortFn, showComments = false, inMultiViewSelector = false, fadeUnderNavExt = false, onVideoClicked, renderAction }: any) {
  const app = useAppState();
  const colSize = useMemo(() => {
    const width = app.windowWidth || (typeof window !== "undefined" ? window.innerWidth : 1440);
    if (horizontal || denseList) return 1;
    return cols[getBreakpoint(width)];
  }, [app.windowWidth, horizontal, denseList, cols.xs, cols.sm, cols.md, cols.lg, cols.xl]);
  const gridStyle = {
    gridTemplateColumns: `repeat(${horizontal || denseList ? 1 : colSize}, minmax(0, 1fr))`,
  } as React.CSSProperties;
  const list = useMemo(() => {
    const processed = (videos || [])
      .filter((v: any) => v && typeof v === "object" && v.id && v.channel)
      .filter((v: any) => filterVideo(v, app, { hideGroups: includeChannel, ...filterConfig }));
    const mapped = sortFn ? processed.map(sortFn) : processed;
    return max ? mapped.slice(0, max) : mapped;
  }, [videos, max, app, includeChannel, filterConfig, sortFn]);
  return <div className={cn("relative py-0", fadeUnderNavExt && "video-list--fade-under-nav", className)}><div className={cn("grid gap-x-1 gap-y-1.5", (denseList || horizontal) && list.length > 0 && "overflow-hidden rounded-xl border border-border gap-y-0")} style={gridStyle}>{list.map((video: any, index: number) => <div key={`${video.id}-${index}`} className={cn("min-w-0 overflow-visible bg-transparent shadow-none", (denseList || horizontal) && "border-border [&:not(:last-child)]:border-b")} style={{ contentVisibility: "auto", containIntrinsicSize: "auto 300px" }}><VideoCard video={video} fluid includeChannel={includeChannel} horizontal={horizontal} includeAvatar={includeAvatar} colSize={colSize} active={video.id === activeId} disableDefaultClick={disableDefaultClick} denseList={denseList} hideThumbnail={hideThumbnail} inMultiViewSelector={inMultiViewSelector} onVideoClicked={onVideoClicked} action={renderAction?.(video)} />{showComments && video.comments ? <ScrollArea className="max-h-[400px] bg-transparent text-xs"><Separator className="mx-4 bg-white/10 data-[orientation=horizontal]:w-auto" />{video.comments.map((comment: any, commentIndex: number) => <div key={`${comment.comment_key || "comment"}-${commentIndex}`} className="p-0"><Comment comment={comment} videoId={video.id} /></div>)}</ScrollArea> : null}</div>)}</div></div>;
}
