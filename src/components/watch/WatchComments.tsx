"use client";

import { useMemo, useState, type MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SectionPanel } from "@/components/common/SectionPanel";
import { Comment } from "@/components/video/Comment";
import { formatDuration, TIMESTAMP_REGEX, timestampToSeconds } from "@/lib/time";
import { useTranslations } from "next-intl";
const BUCKET_THRESHOLD_SECONDS = 10;

type WatchComment = {
  comment_key: string | number;
  message?: string;
  [key: string]: unknown;
};

type CommentWithTimes = WatchComment & {
  times: number[];
};

type WatchCommentsVideo = {
  id?: string;
  duration?: number;
};

type CommentBucket = {
  count: number;
  display: string;
  time: number;
};

type WatchCommentsProps = {
  comments: WatchComment[];
  video: WatchCommentsVideo;
  limit?: number;
  hideBuckets?: boolean;
  defaultExpanded?: boolean;
  onTimeJump?: (time: number) => void;
};

function parseCommentTimes(message = "", duration: number) {
  TIMESTAMP_REGEX.lastIndex = 0;

  const times = new Set<number>();
  let match = TIMESTAMP_REGEX.exec(message);

  while (match !== null) {
    const time = timestampToSeconds(match[1], match[2], match[3]);

    if (time < duration) {
      times.add(time);
    }

    match = TIMESTAMP_REGEX.exec(message);
  }

  return Array.from(times);
}

function buildCommentBuckets(comments: CommentWithTimes[], allLabel: string): CommentBucket[] {
  const times = comments.flatMap((comment) => comment.times).sort((a, b) => a - b);
  const result: CommentBucket[] = [{ time: -1, count: comments.length, display: allLabel }];
  let currentBucket = 0;
  let bucket: number[] = [];

  times.forEach((time, index) => {
    if (time - currentBucket <= BUCKET_THRESHOLD_SECONDS && index !== times.length - 1) {
      bucket.push(time);
      return;
    }

    if (time - currentBucket <= BUCKET_THRESHOLD_SECONDS) {
      bucket.push(time);
    }

    if (bucket.length > 1) {
      const median = bucket[Math.floor(bucket.length / 2)];
      result.push({ time: median, count: bucket.length, display: formatDuration(median * 1000) });
    }

    currentBucket = time;
    bucket = [time];
  });

  return result.sort((a, b) => b.count - a.count);
}

export function WatchComments({
  comments,
  video,
  limit = 3,
  hideBuckets = false,
  defaultExpanded = true,
  onTimeJump,
}: WatchCommentsProps) {
  const t = useTranslations();
  const [currentFilter, setCurrentFilter] = useState(-1);
  const [expanded, setExpanded] = useState(false);

  const groupedComments = useMemo(
    () => comments.map((comment) => ({ ...comment, times: parseCommentTimes(comment.message, video.duration || 0) })),
    [comments, video.duration],
  );

  const filteredComments = useMemo(() => {
    if (currentFilter < 0) {
      return [...groupedComments].sort((a, b) => b.times.length - a.times.length);
    }

    return groupedComments
      .filter((comment) => comment.times.some((time) => Math.abs(currentFilter - time) <= BUCKET_THRESHOLD_SECONDS))
      .sort((a, b) => a.times.length - b.times.length);
  }, [currentFilter, groupedComments]);

  const shouldLimit = !!limit && filteredComments.length > limit;
  const visibleComments = shouldLimit && !expanded ? filteredComments.slice(0, limit) : filteredComments;

  const buckets = useMemo(
    () => buildCommentBuckets(groupedComments, t("component.watch.Comments.all")),
    [groupedComments, t],
  );

  function handleCommentClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;

    if (!target.matches(".comment-chip")) return;

    onTimeJump?.(Number(target.getAttribute("data-time") || 0));
    event.preventDefault();
  }

  return (
    <SectionPanel title={t("component.watch.Comments.title")} count={comments.length} defaultOpen={defaultExpanded} contentClassName="px-4 py-3">
      {!hideBuckets ? (
        <ToggleGroup
          value={[String(currentFilter)]}
          size="sm"
          onValueChange={(value) => {
            if (value[0]) setCurrentFilter(Number(value[0]));
          }}
          className="mb-1 flex-wrap justify-start gap-1.5"
        >
          {buckets.map((bucket) => (
            <ToggleGroupItem key={bucket.time} value={String(bucket.time)}>
              {bucket.display} ({bucket.count})
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      ) : null}

      <div className="text-sm" onClick={handleCommentClick}>
        {visibleComments.map((comment) => (
          <Comment key={comment.comment_key} comment={comment} videoId={video.id || ""} />
        ))}
      </div>

      {shouldLimit ? (
        <Button type="button" variant="ghost" size="sm" className="mt-1" onClick={() => setExpanded((value) => !value)}>
          {expanded ? t("views.app.close_btn") : t("component.description.showMore")}
        </Button>
      ) : null}
    </SectionPanel>
  );
}
