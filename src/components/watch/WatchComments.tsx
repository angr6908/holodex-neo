"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Comment } from "@/components/video/Comment";
import { formatDuration } from "@/lib/time";
import { useI18n } from "@/lib/i18n";

const COMMENT_TIMESTAMP_REGEX = /(?:([0-5]?[0-9]):)?([0-5]?[0-9]):([0-5][0-9])/gm;

export function WatchComments({ comments, video, limit = 3, hideBuckets = false, defaultExpanded = true, onTimeJump }: { comments: any[]; video: Record<string, any>; limit?: number; hideBuckets?: boolean; defaultExpanded?: boolean; onTimeJump?: (time: number) => void }) {
  const { t } = useI18n();
  const [currentFilter, setCurrentFilter] = useState(-1);
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState(defaultExpanded);
  const groupedComments = useMemo(() => comments.map((c: any) => {
    let match = COMMENT_TIMESTAMP_REGEX.exec(c.message);
    const times = new Set<number>();
    while (match !== null) {
      const hr = match[1]; const min = match[2]; const sec = match[3];
      const time = Number(hr ?? 0) * 3600 + Number(min) * 60 + Number(sec);
      if (time < video.duration) times.add(time);
      match = COMMENT_TIMESTAMP_REGEX.exec(c.message);
    }
    return { ...c, times: Array.from(times) };
  }), [comments, video.duration]);
  const filteredComments = useMemo(() => currentFilter < 0 ? [...groupedComments].sort((a, b) => b.times.length - a.times.length) : groupedComments.filter((c) => c.times.find((time: number) => Math.abs(currentFilter - time) <= 10)).sort((a, b) => a.times.length - b.times.length), [currentFilter, groupedComments]);
  const shouldLimit = !!limit && filteredComments.length > limit;
  const limitComment = shouldLimit && !expanded ? filteredComments.slice(0, limit) : filteredComments;
  const buckets = useMemo(() => {
    const arr: number[] = [];
    groupedComments.forEach((c: any) => arr.push(...c.times));
    arr.sort((a, b) => a - b);
    const result: any[] = [{ time: -1, count: comments.length, display: `${t("component.watch.Comments.all")}` }];
    let currentBucket = 0; let subBucket: number[] = [];
    arr.forEach((time, index) => {
      if (time - currentBucket <= 10 && index !== arr.length - 1) { subBucket.push(time); return; }
      if (time - currentBucket <= 10) subBucket.push(time);
      if (subBucket.length > 1) {
        const median = subBucket[Math.floor(subBucket.length / 2)];
        result.push({ time: median, count: subBucket.length, display: formatDuration(median * 1000) });
      }
      currentBucket = time; subBucket = [time];
    });
    return result.sort((a, b) => b.count - a.count);
  }, [groupedComments, comments.length, t]);
  function handleClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.matches(".comment-chip")) { onTimeJump?.(Number(target.getAttribute("data-time") || 0)); e.preventDefault(); }
  }
  return <Card className="rounded-none p-0 shadow-none"><button type="button" className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-white" onClick={() => setOpen((value) => !value)}><span>{t("component.watch.Comments.title")} ({comments.length})</span><span className="text-slate-400">{open ? "−" : "+"}</span></button>{open ? <div className="border-t border-white/10 px-4 py-4">{!hideBuckets ? <div className="mb-3 flex flex-wrap gap-2">{buckets.map((b) => <Button key={b.time} type="button" size="sm" variant={currentFilter === b.time ? "default" : "ghost"} className="ts-btn" onClick={() => setCurrentFilter(b.time)}>{b.display} ({b.count})</Button>)}</div> : null}<div className="border-t border-white/10" /><div className="caption mt-3" onClick={handleClick}>{limitComment.map((comment) => <Comment key={comment.comment_key} comment={comment} videoId={video.id} />)}</div>{shouldLimit ? <Button type="button" variant="ghost" size="sm" className="mt-3" onClick={() => setExpanded((value) => !value)}>{expanded ? t("views.app.close_btn") : t("component.description.showMore")}</Button> : null}</div> : null}</Card>;
}
