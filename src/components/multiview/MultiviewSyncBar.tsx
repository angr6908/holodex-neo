"use client";

import throttle from "lodash-es/throttle";
import { FastForward, Gauge, Link, Pause, Play, Rewind, Settings, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ChannelImg } from "@/components/channel/ChannelImg";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useMultiviewStore } from "@/lib/multiview-store";
import { useOrderedMultiviewVideoCells } from "@/lib/multiview-video-cells";
import { encodeLayout } from "@/lib/mv-utils";
import { dayjs, formatDuration } from "@/lib/time";
import { cn } from "@/lib/utils";

const availablePlaybackRates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

type TimedVideo = Record<string, any> & { startTs: number; endTs: number };
type SyncCell = ReturnType<typeof useOrderedMultiviewVideoCells>[number];

// Past videos with their start/end as unix seconds, earliest first.
function timedVideos(activeVideos: any[]): TimedVideo[] {
  const videos = activeVideos
    .filter((v: any) => v.status === "past")
    .map((v: any) => ({
      ...v,
      startTs: dayjs(v.available_at).unix(),
      endTs: dayjs(v.available_at).unix() + (v.duration || 0),
    }));
  videos.sort((a: any, b: any) => a.startTs - b.startTs);
  return videos;
}

// The run of videos starting within an hour of the previous one's end; a lone earlier video
// is replaced by the next one.
function overlappingVideos(videoWithTs: TimedVideo[]) {
  const ol: TimedVideo[] = [];
  videoWithTs.forEach((v) => {
    if (!ol.length) {
      ol.push(v);
      return;
    }
    if (v.startTs - ol[ol.length - 1].endTs < 60 * 60) {
      ol.push(v);
    } else if (ol.length === 1) {
      ol.splice(0, 1, v);
    }
  });
  return ol;
}

// Per-video offsets: the stored ones, falling back to the shared link's `offsets` param.
function syncOffsetsFor(
  local: Record<string, number>,
  routeOffsets: string[] | undefined,
  overlapVideos: TimedVideo[],
) {
  if (routeOffsets && overlapVideos.length) {
    return Object.fromEntries(
      overlapVideos.map((v, index) => [v.id, local[v.id] ?? Number(routeOffsets[index] || 0)]),
    );
  }
  return local;
}

function overlapFor(cell: SyncCell, overlapVideos: TimedVideo[]) {
  const { video } = cell;
  return video && overlapVideos.find((v) => v.id === video.id);
}

function formatUnixTime(ts: number) {
  return dayjs.unix(ts).format("LTS");
}

// Keeps the synced cells playing together: a 500ms tick advances the shared timestamp and seeks
// any cell that drifted, and play/pause, seeks and the playback rate apply to every synced cell.
function useArchiveSync({
  cells,
  overlapVideos,
  minTs,
  maxTs,
  offsets,
  routeCurrentTs,
}: {
  cells: SyncCell[];
  overlapVideos: TimedVideo[];
  minTs: number;
  maxTs: number;
  offsets: Record<string, number>;
  routeCurrentTs: string | undefined;
}) {
  const [paused, setPausedState] = useState(true);
  const [currentTs, setCurrentTsState] = useState(0);
  const [currentProgressByVideo, setCurrentProgressByVideo] = useState<Record<string, number>>({});
  const [playbackRate, setPlaybackRateState] = useState(1);
  const lastSyncTimeMillis = useRef(0);
  const currentTsRef = useRef(0);
  const pausedRef = useRef(true);
  const playbackRateRef = useRef(1);
  const firstPlay = useRef(true);
  const onSliderInputThrottled = useRef<((percent: number) => void) | null>(null);
  const lastSeekByCellRef = useRef<Record<string, number>>({});
  const prevPausedRef = useRef(true);
  const syncRef = useRef<(() => void) | null>(null);
  const hasVideosToSync = overlapVideos.length >= 1;

  function setPaused(value: boolean) {
    pausedRef.current = value;
    setPausedState(value);
  }

  function setCurrentTs(value: number) {
    currentTsRef.current = value;
    setCurrentTsState(value);
  }

  function setPlaybackRate(value: number) {
    playbackRateRef.current = value;
    setPlaybackRateState(value);
  }

  function getTimeForPercent(percent: number) {
    return (percent / 100) * (maxTs - minTs) + minTs;
  }

  // The shared link's time, else the cells' common time when they agree, else the start of
  // the latest-starting overlapping video.
  const findStartTime = useCallback(() => {
    if (routeCurrentTs) return Number(routeCurrentTs);
    const times: number[] = [];
    let firstOverlap = minTs;
    cells.forEach((cell, index) => {
      const olVideo = overlapFor(cell, overlapVideos);
      if (!olVideo) return;
      const tCell = cell.currentTime + olVideo.startTs;
      if (index === 0 || Math.abs(times[index - 1] - tCell) < 2000) {
        times.push(tCell);
      }
      if (olVideo.startTs > firstOverlap && olVideo.endTs > firstOverlap) {
        firstOverlap = olVideo.startTs;
      }
    });
    if (times.length === overlapVideos.length) {
      return times.reduce((acc, value) => acc + value, 0) / times.length;
    }
    return firstOverlap;
  }, [cells, minTs, overlapVideos, routeCurrentTs]);

  const setTime = useCallback(
    (ts: number) => {
      setCurrentTs(ts);
      lastSeekByCellRef.current = {};
      cells.forEach((cell) => {
        const olVideo = overlapFor(cell, overlapVideos);
        if (!olVideo) return;
        const nextTime = ts - olVideo.startTs;
        const isBefore = nextTime < 0;
        const isAfter = nextTime / olVideo.duration > 1;
        if (isBefore || isAfter) {
          cell.setPlaying(false);
          cell.seekTo(isBefore ? 0 : olVideo.duration - 1);
          return;
        }
        if (firstPlay.current) {
          setPaused(false);
          firstPlay.current = false;
        }
        cell.setPlaying(!pausedRef.current);
        cell.seekTo(nextTime);
      });
    },
    [cells, overlapVideos],
  );

  const sync = useCallback(() => {
    if (!cells || !hasVideosToSync) return;
    const currentSyncTimeMillis = Date.now();
    const syncDeltaTime = (currentSyncTimeMillis - lastSyncTimeMillis.current) / 1000;
    lastSyncTimeMillis.current = currentSyncTimeMillis;

    let nextTs = currentTsRef.current;
    if (nextTs <= 0 || nextTs < minTs || nextTs > maxTs) {
      nextTs = findStartTime();
    } else if (!pausedRef.current) {
      nextTs = Math.min(Math.max(nextTs + syncDeltaTime * playbackRateRef.current, minTs), maxTs);
    }
    setCurrentTs(nextTs);

    const deltaThreshold = 2.5 * playbackRateRef.current;
    const nextProgress: Record<string, number> = {};
    cells.forEach((cell) => {
      const { currentTime: cellCurrentTime } = cell;
      const olVideo = overlapFor(cell, overlapVideos);
      if (!olVideo) return;

      const percentProgress =
        nextTs > olVideo.endTs
          ? 100
          : Number(((cellCurrentTime / olVideo.duration) * 100).toFixed(2));
      nextProgress[olVideo.id] = percentProgress;

      const expectedDuration = nextTs - olVideo.startTs + (offsets[olVideo.id] ?? 0);
      const delta = Math.abs(expectedDuration - cellCurrentTime);
      const isBefore = expectedDuration < 0;
      const isAfter = expectedDuration / olVideo.duration > 1;
      if (isBefore || isAfter) {
        cell.setPlaying(false);
      } else if (expectedDuration > 0 && delta > deltaThreshold) {
        // Don't seek again while the player is still settling from the previous seek.
        const lastSeek = lastSeekByCellRef.current[cell.id] || 0;
        if (currentSyncTimeMillis - lastSeek < 2500) return;
        lastSeekByCellRef.current[cell.id] = currentSyncTimeMillis;
        cell.seekTo(expectedDuration);
        cell.setPlaying(!pausedRef.current);
      }
    });
    setCurrentProgressByVideo(nextProgress);
  }, [cells, findStartTime, hasVideosToSync, maxTs, minTs, offsets, overlapVideos]);

  useEffect(() => {
    syncRef.current = sync;
  }, [sync]);
  useEffect(() => {
    lastSyncTimeMillis.current = Date.now();
    const timer = setInterval(() => syncRef.current?.(), 500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (prevPausedRef.current === paused) return;
    prevPausedRef.current = paused;
    if (paused) {
      cells.forEach((cell) => {
        if (overlapFor(cell, overlapVideos)) cell.setPlaying(false);
      });
    } else if (currentTsRef.current > 0) {
      setTime(currentTsRef.current);
    }
  }, [paused, cells, overlapVideos, setTime]);

  useEffect(() => {
    cells.forEach((cell) => {
      if (overlapFor(cell, overlapVideos)) cell.setPlaybackRate(playbackRate);
    });
  }, [playbackRate, cells, overlapVideos]);

  useEffect(() => {
    const throttled = throttle((percent: number) => {
      const ts = getTimeForPercent(percent);
      setTime(ts);
    }, 50);
    onSliderInputThrottled.current = throttled;
    return () => {
      throttled.cancel();
      if (onSliderInputThrottled.current === throttled) onSliderInputThrottled.current = null;
    };
  }, [maxTs, minTs, setTime]);

  return {
    paused,
    setPaused,
    currentTs,
    currentTsRef,
    currentProgressByVideo,
    playbackRate,
    setPlaybackRate,
    setTime,
    getTimeForPercent,
    onSliderInput: (percent: number) => onSliderInputThrottled.current?.(percent),
  };
}

// Per-video progress and offset controls for the synced videos.
function SyncSettingsPopover({
  disabled,
  videos,
  progressByVideo,
  offsets,
  onOffset,
}: {
  disabled: boolean;
  videos: TimedVideo[];
  progressByVideo: Record<string, number>;
  offsets: Record<string, number>;
  onOffset: (id: string, value: number) => void;
}) {
  const t = useTranslations();
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label={t("views.multiview.sync.syncSettings")}
          />
        }
      >
        <Settings />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-[28rem] max-w-[calc(100vw-1rem)] gap-3 p-3"
      >
        <PopoverTitle>{t("views.multiview.sync.syncSettings")}</PopoverTitle>
        <p className="text-sm text-muted-foreground">
          {t("views.multiview.sync.syncSettingsDetail")}
        </p>

        {videos.length > 0 && (
          <div className="space-y-1.5 rounded-lg border p-3">
            <p className="text-xs font-medium text-muted-foreground">Playback progress</p>
            {videos.map((video) => (
              <div key={`progress-${video.id}`} className="flex items-center gap-2">
                <ChannelImg channel={video.channel} size={16} noLink />
                <Progress value={progressByVideo[video.id] || 0} className="h-1.5 flex-1" />
                <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">
                  {Math.round(progressByVideo[video.id] || 0)}%
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          {videos.map((video) => (
            <div
              key={video.id}
              className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <ChannelImg channel={video.channel} size={36} noLink />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {video.channel?.name || video.id}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDuration((video.duration || 0) * 1000)}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onOffset(video.id, (offsets[video.id] || 0) - 0.5)}
                >
                  -0.5
                </Button>
                <Input
                  value={offsets[video.id] ?? "0"}
                  className="w-20"
                  type="number"
                  onChange={(event) => onOffset(video.id, +event.target.value)}
                />
                <span className="text-sm text-muted-foreground">s</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onOffset(video.id, (offsets[video.id] || 0) + 0.5)}
                >
                  +0.5
                </Button>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PlaybackRateSelect({
  playbackRate,
  onChange,
}: {
  playbackRate: number;
  onChange: (rate: number) => void;
}) {
  return (
    <Select value={String(playbackRate)} onValueChange={(value) => onChange(Number(value))}>
      <SelectTrigger size="sm" className="ml-1 h-7 w-[4.5rem] shrink-0 px-2">
        <Gauge className="size-3.5" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent side="top">
        {availablePlaybackRates.map((rate) => (
          <SelectItem key={rate} value={String(rate)}>
            {rate}x
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// The timeline slider between the first start and last end, with a hover tooltip giving the
// wall-clock and elapsed time under the pointer.
function SyncScrubber({
  hasVideosToSync,
  minTs,
  maxTs,
  totalDuration,
  progress,
  onInput,
  onCommit,
}: {
  hasVideosToSync: boolean;
  minTs: number;
  maxTs: number;
  totalDuration: string;
  progress: number;
  onInput: (percent: number) => void;
  onCommit: (percent: number) => void;
}) {
  const t = useTranslations();
  const [hovering, setHovering] = useState(false);
  const [tooltipX, setTooltipX] = useState(0);
  const [timeTooltipText, setTimeTooltipText] = useState("");
  const onMouseOverThrottled = useMemo(
    () =>
      throttle((clientX: number, offsetLeft: number, width: number) => {
        const percent = ((clientX - offsetLeft) / width) * 100;
        if (!(percent >= 0 && percent <= 100)) return;
        const hoverTs = (percent / 100) * (maxTs - minTs) + minTs;
        setTimeTooltipText(
          `${formatUnixTime(hoverTs)}\n${formatDuration((hoverTs - minTs) * 1000)}/${totalDuration}`,
        );
      }, 10),
    [maxTs, minTs, totalDuration],
  );
  useEffect(
    () => () => {
      onMouseOverThrottled.cancel();
    },
    [onMouseOverThrottled],
  );

  return (
    <div className="relative min-w-0 flex-1">
      {!hasVideosToSync ? (
        <div className="truncate rounded-md border border-dashed px-2 py-1 text-sm text-muted-foreground">
          {t("views.multiview.sync.nothingToSync")}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="hidden shrink-0 whitespace-nowrap text-sm tabular-nums text-muted-foreground xl:block">
            {formatUnixTime(minTs)}
          </span>
          <div
            className="relative min-w-0 flex-1 py-1.5"
            onMouseEnter={() => setHovering(true)}
            onMouseMove={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setTooltipX(Math.max(0, Math.min(rect.width, event.clientX - rect.left)));
              onMouseOverThrottled(event.clientX, rect.x, event.currentTarget.clientWidth);
            }}
            onMouseLeave={() => setHovering(false)}
          >
            {hovering && (
              <div
                style={{ "--tooltip-x": `${tooltipX}px` } as CSSProperties}
                className="pointer-events-none absolute bottom-full left-(--tooltip-x) z-30 mb-2 -translate-x-1/2 whitespace-pre rounded-md bg-popover px-2 py-1 text-center text-xs text-popover-foreground shadow-md ring-1 ring-foreground/10"
              >
                {timeTooltipText}
              </div>
            )}
            <Slider
              min={0}
              max={100}
              value={[progress]}
              step={0.01}
              onWheel={(event) => (event.currentTarget as HTMLElement).blur()}
              onValueChange={(value) => onInput(Array.isArray(value) ? value[0] : value)}
              onValueCommitted={(value) => onCommit(Array.isArray(value) ? value[0] : value)}
            />
          </div>
          <span className="hidden shrink-0 whitespace-nowrap text-right text-sm tabular-nums text-muted-foreground xl:block">
            {formatUnixTime(maxTs)}
          </span>
        </div>
      )}
    </div>
  );
}

export function MultiviewSyncBar({
  className = "",
  routeTime,
  routeOffsets: routeOffsetsParam,
  onClose,
}: {
  className?: string;
  /** `t` query param: the shared sync timestamp. */
  routeTime?: string | null;
  /** `offsets` query param: comma-separated per-video offsets. */
  routeOffsets?: string | null;
  onClose?: () => void;
}) {
  const t = useTranslations();
  const store = useMultiviewStore();
  const cells = useOrderedMultiviewVideoCells(store.layout);

  const routeOffsets = useMemo(() => routeOffsetsParam?.split(","), [routeOffsetsParam]);
  const overlapVideos = useMemo(
    () => overlappingVideos(timedVideos(store.activeVideos)),
    [store.activeVideos],
  );
  const hasVideosToSync = overlapVideos.length >= 1;
  const minTs = hasVideosToSync ? Math.min(...overlapVideos.map((v) => v.startTs)) : 0;
  const maxTs = hasVideosToSync ? Math.max(...overlapVideos.map((v) => v.endTs)) : 0;
  // The same archive can sit in two cells; list each video once in the settings popover.
  const uniqueOverlapVideos = useMemo(
    () => [...new Map(overlapVideos.map((v) => [v.id, v])).values()],
    [overlapVideos],
  );
  const offsets = useMemo(
    () => syncOffsetsFor(store.syncOffsets, routeOffsets, overlapVideos),
    [store.syncOffsets, routeOffsets, overlapVideos],
  );
  const sync = useArchiveSync({
    cells,
    overlapVideos,
    minTs,
    maxTs,
    offsets,
    routeCurrentTs: routeTime || undefined,
  });
  const { paused, currentTs, currentTsRef, setTime } = sync;
  const currentProgress =
    !hasVideosToSync || maxTs <= minTs ? 0 : ((currentTs - minTs) / (maxTs - minTs)) * 100;
  const currentDuration = minTs ? formatDuration(Math.round(currentTs - minTs) * 1000) : "0:00";
  const totalDuration = minTs ? formatDuration((maxTs - minTs) * 1000) : "0:00";
  const syncDisabled = !hasVideosToSync || !cells.length;

  function onShareClick() {
    const layoutParam = encodeURIComponent(
      encodeLayout({ layout: store.layout, contents: store.layoutContent, includeVideo: true }),
    );
    const params = new URLSearchParams();
    if (currentTsRef.current) params.append("t", String(Math.round(currentTsRef.current)));
    const offsetArr = overlapVideos.map((v) => offsets[v.id] ?? 0);
    if (offsetArr.find((offset: any) => Number(offset)))
      params.append("offsets", offsetArr.join(","));
    navigator.clipboard
      ?.writeText(
        `${window.origin}/multiview/${layoutParam}${params.toString() ? `?${params.toString()}` : ""}`,
      )
      .then(() => {
        toast.success(t("component.videoCard.copiedToClipboard"));
      });
  }

  return (
    <Card
      size="sm"
      className={cn(
        "sticky bottom-0 z-20 w-full overflow-visible rounded-none border-x-0 border-b-0 bg-card/95 px-3 py-2 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/90",
        className,
      )}
    >
      <div className="flex items-center gap-1">
        {/* Playback controls */}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("component.common.rewind10")}
          disabled={syncDisabled}
          onClick={() => setTime(currentTsRef.current - 10)}
        >
          <Rewind />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t(paused ? "component.common.play" : "component.common.pause")}
          disabled={syncDisabled}
          onClick={() => sync.setPaused(!paused)}
        >
          {paused ? <Play /> : <Pause />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("component.common.forward10")}
          disabled={syncDisabled}
          onClick={() => setTime(currentTsRef.current + 10)}
        >
          <FastForward />
        </Button>
        <SyncSettingsPopover
          disabled={!overlapVideos.length}
          videos={uniqueOverlapVideos}
          progressByVideo={sync.currentProgressByVideo}
          offsets={offsets}
          onOffset={(id, value) => store.setSyncOffsets({ id, value })}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("views.multiview.shareLayout")}
          disabled={!store.layout.length}
          onClick={onShareClick}
        >
          <Link />
        </Button>
        {onClose ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Delete archive sync panel"
            title="Delete archive sync panel"
            onClick={onClose}
          >
            <Trash2 />
          </Button>
        ) : null}

        {/* Speed */}
        <PlaybackRateSelect playbackRate={sync.playbackRate} onChange={sync.setPlaybackRate} />

        {/* Time readout */}
        <Badge
          variant="outline"
          className="h-auto shrink-0 gap-1 px-2.5 py-1 text-sm tabular-nums font-normal"
        >
          {currentDuration}
          <span className="opacity-30">/</span>
          {totalDuration}
        </Badge>

        {/* Scrubber */}
        <SyncScrubber
          hasVideosToSync={hasVideosToSync}
          minTs={minTs}
          maxTs={maxTs}
          totalDuration={totalDuration}
          progress={currentProgress}
          onInput={sync.onSliderInput}
          onCommit={(percent) => setTime(sync.getTimeForPercent(percent))}
        />
      </div>
    </Card>
  );
}
