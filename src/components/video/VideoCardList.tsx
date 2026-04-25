"use client";
import { useMemo } from "react";
import { VideoCard } from "@/components/video/VideoCard";
import { Comment } from "@/components/video/Comment";
import { useAppState } from "@/lib/store";
import { filterVideo } from "@/lib/filter-videos";
import { cn } from "@/lib/cn";

export function VideoCardList({ videos = [], includeChannel = false, includeAvatar = false, hideThumbnail = false, denseList = false, horizontal = false, max = undefined, className = "", cols = { xs: 1, sm: 2, md: 3, lg: 4, xl: 5 }, activeId = "", dense = false, disableDefaultClick = false, filterConfig = {}, sortFn, showComments = false, inMultiViewSelector = false, fadeUnderNavExt = false, onVideoClicked, renderAction }: any) {
  const app = useAppState();
  const filterConfigKey = JSON.stringify(filterConfig);
  const colSize = useMemo(() => {
    const width = app.windowWidth || (typeof window !== "undefined" ? window.innerWidth : 1440);
    if (horizontal || denseList) return 1;
    if (width < 600) return cols.xs;
    if (width < 960) return cols.sm;
    if (width < 1264) return cols.md;
    if (width < 1904) return cols.lg;
    return cols.xl;
  }, [app.windowWidth, horizontal, denseList, cols.xs, cols.sm, cols.md, cols.lg, cols.xl]);
  const cssCols = horizontal || denseList
    ? { xs: 1, sm: 1, md: 1, lg: 1, xl: 1 }
    : cols;
  const gridStyle = {
    "--video-grid-columns": horizontal || denseList ? 1 : colSize,
    "--video-grid-xs": cssCols.xs,
    "--video-grid-sm": cssCols.sm,
    "--video-grid-md": cssCols.md,
    "--video-grid-lg": cssCols.lg,
    "--video-grid-xl": cssCols.xl,
  } as React.CSSProperties;
  const list = useMemo(() => {
    const processed = (videos || [])
      .filter((v: any) => v && typeof v === "object" && v.id && v.channel)
      .filter((v: any) => filterVideo(v, app, { hideGroups: includeChannel, ...filterConfig }));
    const mapped = sortFn ? processed.map(sortFn) : processed;
    return max ? mapped.slice(0, max) : mapped;
  }, [videos, max, app, includeChannel, filterConfigKey, sortFn, filterConfig]);
  return <div className={cn("relative py-0", fadeUnderNavExt && "video-list--fade-under-nav", className)}><div className={cn("video-grid", (dense || denseList || horizontal) && "video-grid--compact", (denseList || horizontal) && "video-grid--list")} style={gridStyle}>{list.map((video: any, index: number) => <div key={`${video.id}-${index}`} className="video-grid-item"><VideoCard video={video} fluid includeChannel={includeChannel} horizontal={horizontal} includeAvatar={includeAvatar} colSize={colSize} active={video.id === activeId} disableDefaultClick={disableDefaultClick} denseList={denseList} hideThumbnail={hideThumbnail} inMultiViewSelector={inMultiViewSelector} onVideoClicked={onVideoClicked} action={renderAction?.(video)} />{showComments && video.comments ? <div style={{ maxHeight: 400 }} className="overflow-y-auto overflow-x-hidden bg-transparent text-xs"><div className="mx-4 h-px bg-white/10" />{video.comments.map((comment: any, commentIndex: number) => <div key={`${comment.comment_key || "comment"}-${commentIndex}`} className="p-0"><Comment comment={comment} videoId={video.id} /></div>)}</div> : null}</div>)}</div></div>;
}
