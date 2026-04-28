"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { formatDuration } from "@/lib/time";

const COMMENT_TIMESTAMP_REGEX = /(?:([0-5]?[0-9]):)?([0-5]?[0-9]):([0-5][0-9])([^\r\n]+)?/gm;
const STOP_WORDS = new Set(["an", "the"]);
function removeStopWords(words: string) { return words.split(" ").filter((s) => !STOP_WORDS.has(s.toLowerCase())).join(" "); }
function removePunctuations(input: string) { return input.replace(/[*,\-.\][()、。]/g, ""); }
function filterByWordCount(limit = 2) { return (input: string) => input.split(" ").length >= limit; }
function parseTimestampComments(message: string, videoDuration: number) {
  const pairs: any[] = [];
  let match = COMMENT_TIMESTAMP_REGEX.exec(message);
  while (match !== null) {
    const hr = match[1]; const min = match[2]; const sec = match[3];
    const time = Number(hr ?? 0) * 3600 + Number(min) * 60 + Number(sec);
    const text = match[4];
    if (time < videoDuration) pairs.push({ time, text });
    match = COMMENT_TIMESTAMP_REGEX.exec(message);
  }
  for (const pair of pairs) pair.occurence = pairs.length;
  return pairs;
}

export function WatchHighlights({ comments, video, limit = 0, playerWidth = null, onTimeJump }: { comments: any[]; video: Record<string, any>; limit?: number; playerWidth?: number | null; onTimeJump?: (time: number) => void }) {
  const buckets = useMemo(() => {
    const TIME_THRESHOLD = 40;
    const MIN_TIMESTAMP_OCCURENCE = 1;
    const VIDEO_START_TIMESTAMP = +new Date(video.start_actual || video.available_at);
    const parsed: any[] = [];
    for (const comment of comments) {
      const pairs = parseTimestampComments(comment.message, video.duration).filter((pair) => pair.text);
      if (pairs.length >= MIN_TIMESTAMP_OCCURENCE) parsed.push(...pairs);
    }
    parsed.sort((a, b) => a.time - b.time);
    const result: any[] = [];
    let subBucket: any[] = [];
    parsed.forEach((comment, index) => {
      subBucket.push(comment);
      if (index !== parsed.length - 1 && parsed[index + 1].time - comment.time <= TIME_THRESHOLD) return;
      const th = Math.floor(subBucket.length / 3);
      const median = subBucket[th].time;
      const matchingSong = video?.songs?.find((song: any) => Math.abs(song.start - median) <= TIME_THRESHOLD);
      if (!matchingSong) {
        const processed = subBucket.sort((a, b) => b.occurence / b.text.length - a.occurence / a.text.length).map((s) => s.text).map(removePunctuations).map(removeStopWords).map((c) => c.trim()).filter((c) => c.length > 1);
        if (processed.length > 0) {
          let best = processed[0];
          const stricter = processed.filter(filterByWordCount(2)).filter((c) => !/(?:clip\s?(?:it|this)|[!?]{3})/i.test(c));
          if (stricter.length > 0) [best] = stricter;
          if (best.length > 60) best = `${best.slice(0, 60)}...`;
          const medianMS = median * 1000;
          const absolute = new Date(VIDEO_START_TIMESTAMP + medianMS).toISOString();
          result.push({ time: median, count: subBucket.length, best, display: formatDuration(medianMS), absolute });
        }
      }
      subBucket = [];
    });
    result.push(...(video.songs?.map((song: any) => ({ time: song.start, count: 1, song: { ...song, channel: video.channel }, display: formatDuration(song.start * 1000) })) || []));
    return result;
  }, [comments, video]);
  const bucketsFiltered = limit ? [...buckets].filter((b, _i, arr) => b.song || arr.filter((x) => !x.song).indexOf(b) < limit) : buckets;
  const computeTipStyle = ({ song, count }: any) => song
    ? { width: "3px", backgroundColor: "var(--color-primary)" }
    : { width: count > 1 ? "2px" : "1px", backgroundColor: count > 5 ? "red" : count > 4 ? "#d05b5b" : count > 3 ? "orange" : count > 2 ? "darkorange" : count > 1 ? "rgb(164, 164, 164)" : "rgb(100, 100, 100)" };
  const cardStyle = playerWidth ? { width: `${playerWidth}px`, maxWidth: `${playerWidth}px`, marginInline: "auto" } : undefined;
  return <Card className="watch-highlights rounded-none border-x-0 border-t-0 px-3 py-2 shadow-none" style={cardStyle}>{bucketsFiltered.length > 0 ? <div className="highlight-container"><div className="highlight-bar">{bucketsFiltered.map((b) => <div key={`${b.display}-${b.time}`} className="highlight-item" style={{ marginLeft: `${Math.round((b.time / video.duration) * 100)}%` }} title={b.best ? `${b.display} ${b.best}` : b.display} onClick={(e) => { e.preventDefault(); onTimeJump?.(b.time); }}><div className="highlight-chip" style={computeTipStyle(b)} /></div>)}</div></div> : null}</Card>;
}
