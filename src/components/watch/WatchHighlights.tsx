"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDuration, timestampToSeconds } from "@/lib/time";
const COMMENT_TIMESTAMP_REGEX = /(?:([0-5]?[0-9]):)?([0-5]?[0-9]):([0-5][0-9])([^\r\n]+)?/gm;
const STOP_WORDS = new Set(["an", "the"]);
const TIME_THRESHOLD_SECONDS = 40;
const MIN_TIMESTAMP_OCCURRENCE = 1;

type TimestampComment = {
  message?: string;
};

type HighlightSong = {
  start: number;
  channel?: unknown;
};

type WatchHighlightsVideo = {
  available_at?: string | number | Date;
  channel?: unknown;
  duration?: number;
  songs?: HighlightSong[];
  start_actual?: string | number | Date;
};

type ParsedTimestampComment = {
  occurrence: number;
  text: string;
  time: number;
};

type HighlightBucket = {
  absolute?: string;
  best?: string;
  count: number;
  display: string;
  song?: HighlightSong;
  time: number;
};

type WatchHighlightsProps = {
  comments: TimestampComment[];
  video: WatchHighlightsVideo;
  limit?: number;
  playerWidth?: number | null;
  onTimeJump?: (time: number) => void;
};

function removeStopWords(words: string) {
  return words
    .split(" ")
    .filter((word) => !STOP_WORDS.has(word.toLowerCase()))
    .join(" ");
}

function removePunctuations(input: string) {
  return input.replace(/[*,\-.\][()、。]/g, "");
}

function filterByWordCount(limit = 2) {
  return (input: string) => input.split(" ").length >= limit;
}

function timestampMatchToSeconds(match: RegExpExecArray) {
  return timestampToSeconds(match[1], match[2], match[3]);
}

function parseTimestampComments(message = "", videoDuration: number): ParsedTimestampComment[] {
  COMMENT_TIMESTAMP_REGEX.lastIndex = 0;

  const pairs: ParsedTimestampComment[] = [];
  let match = COMMENT_TIMESTAMP_REGEX.exec(message);

  while (match !== null) {
    const time = timestampMatchToSeconds(match);
    const text = (match[4] ?? "").trim();

    if (time < videoDuration) {
      pairs.push({ time, text, occurrence: 0 });
    }

    match = COMMENT_TIMESTAMP_REGEX.exec(message);
  }

  return pairs.map((pair) => ({ ...pair, occurrence: pairs.length }));
}

function bestTimestampLabel(bucket: ParsedTimestampComment[]) {
  const processed = bucket
    .toSorted((a, b) => b.occurrence / b.text.length - a.occurrence / a.text.length)
    .map((item) => item.text)
    .map(removePunctuations)
    .map(removeStopWords)
    .map((text) => text.trim())
    .filter((text) => text.length > 1);

  const stricter = processed
    .filter(filterByWordCount(2))
    .filter((text) => !/(?:clip\s?(?:it|this)|[!?]{3})/i.test(text));

  const best = stricter[0] ?? processed[0];
  return best && best.length > 60 ? `${best.slice(0, 60)}...` : best;
}

function markerClass({ song, count }: HighlightBucket) {
  if (song) return "w-1 bg-primary";
  if (count > 5) return "w-0.5 bg-destructive";
  if (count > 2) return "w-0.5 bg-secondary";
  return "w-px bg-muted-foreground";
}

export function WatchHighlights({ comments, video, limit = 0, onTimeJump }: WatchHighlightsProps) {
  const buckets = useMemo(() => {
    const videoDuration = video.duration || 0;
    const videoStartTimestamp = +new Date(video.start_actual || video.available_at || 0);
    const parsed = comments.flatMap((comment) => {
      const pairs = parseTimestampComments(comment.message, videoDuration).filter((pair) => pair.text);
      return pairs.length >= MIN_TIMESTAMP_OCCURRENCE ? pairs : [];
    });
    const result: HighlightBucket[] = [];
    let bucket: ParsedTimestampComment[] = [];

    parsed.toSorted((a, b) => a.time - b.time).forEach((comment, index, sorted) => {
      bucket.push(comment);

      const next = sorted[index + 1];
      if (next && next.time - comment.time <= TIME_THRESHOLD_SECONDS) {
        return;
      }

      const median = bucket[Math.floor(bucket.length / 3)]?.time ?? comment.time;
      const matchingSong = video.songs?.find((song) => Math.abs(song.start - median) <= TIME_THRESHOLD_SECONDS);

      if (!matchingSong) {
        const best = bestTimestampLabel(bucket);

        if (best) {
          const medianMs = median * 1000;
          result.push({
            time: median,
            count: bucket.length,
            best,
            display: formatDuration(medianMs),
            absolute: new Date(videoStartTimestamp + medianMs).toISOString(),
          });
        }
      }

      bucket = [];
    });

    result.push(
      ...(video.songs?.map((song) => ({
        time: song.start,
        count: 1,
        song: { ...song, channel: video.channel },
        display: formatDuration(song.start * 1000),
      })) || []),
    );

    return result;
  }, [comments, video]);

  const bucketsFiltered = useMemo(() => {
    if (!limit) return buckets;

    let plainBucketCount = 0;
    return buckets.filter((bucket) => {
      if (bucket.song) return true;
      plainBucketCount += 1;
      return plainBucketCount <= limit;
    });
  }, [buckets, limit]);

  return (
    <Card className="rounded-none border-x-0 border-t-0 px-3 py-2">
      {bucketsFiltered.length > 0 ? (
        <div className="w-full">
          <div className="flex h-4 items-stretch justify-between gap-px rounded-full bg-muted">
            {bucketsFiltered.map((bucket) => {
              return (
                <Button
                  key={`${bucket.display}-${bucket.time}`}
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="h-full min-h-0 w-auto min-w-0 p-0"
                  title={bucket.best ? `${bucket.display} ${bucket.best}` : bucket.display}
                  aria-label={`Jump to ${bucket.display}`}
                  onClick={(event) => {
                    event.preventDefault();
                    onTimeJump?.(bucket.time);
                  }}
                >
                  <span className={`block h-full rounded-full ${markerClass(bucket)}`} />
                </Button>
              );
            })}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
