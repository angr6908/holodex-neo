"use client";

import throttle from "lodash-es/throttle";
import { FastForward, Gauge, Link, Pause, Play, Rewind, Settings, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

export function MultiviewSyncBar({
  className = "",
  onClose,
}: {
  className?: string;
  onClose?: () => void;
}) {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const store = useMultiviewStore();
  const cells = useOrderedMultiviewVideoCells(store.layout);
  const [paused, setPausedState] = useState(true);
  const [hovering, setHovering] = useState(false);
  const [tooltipX, setTooltipX] = useState(0);
  const [currentTs, setCurrentTsState] = useState(0);
  const [currentProgressByVideo, setCurrentProgressByVideo] = useState<Record<string, number>>({});
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [timeTooltipText, setTimeTooltipText] = useState("");
  const lastSyncTimeMillis = useRef(Date.now());
  const currentTsRef = useRef(0);
  const pausedRef = useRef(true);
  const playbackRateRef = useRef(1);
  const firstPlay = useRef(true);
  const onSliderInputThrottled = useRef<((percent: number) => void) | null>(null);
  const lastSeekByCellRef = useRef<Record<string, number>>({});
  const prevPausedRef = useRef(true);
  const syncRef = useRef<(() => void) | null>(null);

  const routeCurrentTs = searchParams.get("t") || undefined;
  const routeOffsets = searchParams.get("offsets")?.split(",");
  const pastVideos = useMemo(
    () => store.activeVideos.filter((v: any) => v.status === "past"),
    [store.activeVideos],
  );
  const videoWithTs = useMemo(() => {
    const videos = pastVideos.map((v: any) => ({
      ...v,
      startTs: dayjs(v.available_at).unix(),
      endTs: dayjs(v.available_at).unix() + (v.duration || 0),
    }));
    videos.sort((a: any, b: any) => a.startTs - b.startTs);
    return videos;
  }, [pastVideos]);
  const overlapVideos = useMemo(() => {
    const ol: any[] = [];
    videoWithTs.forEach((v: any) => {
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
  }, [videoWithTs]);
  const hasVideosToSync = overlapVideos.length >= 1;
  const minTs = hasVideosToSync ? Math.min(...overlapVideos.map((v: any) => v.startTs)) : 0;
  const maxTs = hasVideosToSync ? Math.max(...overlapVideos.map((v: any) => v.endTs)) : 0;
  const splitProgressBarData = useMemo(
    () => overlapVideos.map((v: any) => ({ id: v.id, channel: v.channel })),
    [overlapVideos],
  );
  const currentProgress = getPercentForTime(currentTs);
  const currentDuration = minTs ? formatDuration(Math.round(currentTs - minTs) * 1000) : "0:00";
  const totalDuration = minTs ? formatDuration((maxTs - minTs) * 1000) : "0:00";
  const syncDisabled = !hasVideosToSync || !cells.length;
  const offsets = useMemo(() => {
    const local = store.syncOffsets;
    if (routeOffsets && overlapVideos.length) {
      return Object.fromEntries(
        overlapVideos.map((v: any, index: number) => [
          v.id,
          local[v.id] ?? Number(routeOffsets[index] || 0),
        ]),
      );
    }
    return local;
  }, [store.syncOffsets, routeOffsets, overlapVideos]);

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

  function getPercentForTime(ts: number) {
    if (!hasVideosToSync || maxTs <= minTs) return 0;
    return ((ts - minTs) / (maxTs - minTs)) * 100;
  }

  function formatUnixTime(ts: number) {
    return dayjs.unix(ts).format("LTS");
  }

  const findStartTime = useCallback(() => {
    if (routeCurrentTs) return Number(routeCurrentTs);
    const times: number[] = [];
    let firstOverlap = minTs;
    cells.forEach((cell, index) => {
      const { video, currentTime } = cell;
      const olVideo = video && overlapVideos.find((v: any) => v.id === video.id);
      if (!olVideo) return;
      const tCell = currentTime + olVideo.startTs;
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
        const { video } = cell;
        const olVideo = video && overlapVideos.find((v: any) => v.id === video.id);
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
    [cells, maxTs, minTs, overlapVideos],
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
      const { video, currentTime: cellCurrentTime } = cell;
      const olVideo = video && overlapVideos.find((v: any) => v.id === video.id);
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
    const timer = setInterval(() => syncRef.current?.(), 500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (prevPausedRef.current === paused) return;
    prevPausedRef.current = paused;
    if (paused) {
      cells.forEach((cell) => {
        const { video } = cell;
        const olVideo = video && overlapVideos.find((v: any) => v.id === video.id);
        if (olVideo) cell.setPlaying(false);
      });
    } else if (currentTsRef.current > 0) {
      setTime(currentTsRef.current);
    }
  }, [paused, cells, overlapVideos, setTime]);

  useEffect(() => {
    cells.forEach((cell) => {
      const { video } = cell;
      const olVideo = video && overlapVideos.find((v: any) => v.id === video.id);
      if (olVideo) cell.setPlaybackRate(playbackRate);
    });
  }, [playbackRate, cells, overlapVideos]);

  const onMouseOverThrottled = useMemo(
    () =>
      throttle((clientX: number, offsetLeft: number, width: number) => {
        const percent = ((clientX - offsetLeft) / width) * 100;
        if (!(percent >= 0 && percent <= 100)) return;
        const hoverTs = getTimeForPercent(percent);
        setTimeTooltipText(
          `${formatUnixTime(hoverTs)}\n${formatDuration((hoverTs - minTs) * 1000)}/${totalDuration}`,
        );
      }, 10),
    [maxTs, minTs, totalDuration],
  );

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

  useEffect(
    () => () => {
      onMouseOverThrottled.cancel();
    },
    [onMouseOverThrottled],
  );

  function setOffset(id: string, value: number) {
    store.setSyncOffsets({ id, value });
  }

  function onShareClick() {
    const layoutParam = encodeURIComponent(
      encodeLayout({ layout: store.layout, contents: store.layoutContent, includeVideo: true }),
    );
    const params = new URLSearchParams();
    if (currentTsRef.current) params.append("t", String(Math.round(currentTsRef.current)));
    const offsetArr = overlapVideos.map((v: any) => offsets[v.id] ?? 0);
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
          disabled={syncDisabled}
          onClick={() => setTime(currentTsRef.current - 10)}
        >
          <Rewind />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={syncDisabled}
          onClick={() => setPaused(!paused)}
        >
          {paused ? <Play /> : <Pause />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={syncDisabled}
          onClick={() => setTime(currentTsRef.current + 10)}
        >
          <FastForward />
        </Button>
        <Popover>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={!overlapVideos.length}
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

            {splitProgressBarData.length > 0 && (
              <div className="space-y-1.5 rounded-lg border p-3">
                <p className="text-xs font-medium text-muted-foreground">Playback progress</p>
                {splitProgressBarData.map((video: any, index: number) => (
                  <div key={`progress-${video.id || index}`} className="flex items-center gap-2">
                    <ChannelImg channel={video.channel} size={16} noLink />
                    <Progress
                      value={currentProgressByVideo[video.id] || 0}
                      className="h-1.5 flex-1"
                    />
                    <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">
                      {Math.round(currentProgressByVideo[video.id] || 0)}%
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              {overlapVideos.map((video: any, index: number) => (
                <div
                  key={`${video.id || "video"}-${index}`}
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
                      onClick={() => setOffset(video.id, (offsets[video.id] || 0) - 0.5)}
                    >
                      -0.5
                    </Button>
                    <Input
                      value={offsets[video.id] ?? "0"}
                      className="w-20"
                      type="number"
                      onChange={(event) => setOffset(video.id, +event.target.value)}
                    />
                    <span className="text-sm text-muted-foreground">s</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setOffset(video.id, (offsets[video.id] || 0) + 0.5)}
                    >
                      +0.5
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
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
        <Select
          value={String(playbackRate)}
          onValueChange={(value) => setPlaybackRate(Number(value))}
        >
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
                    style={{ left: tooltipX }}
                    className="pointer-events-none absolute bottom-full z-30 mb-2 -translate-x-1/2 whitespace-pre rounded-md bg-popover px-2 py-1 text-center text-xs text-popover-foreground shadow-md ring-1 ring-foreground/10"
                  >
                    {timeTooltipText}
                  </div>
                )}
                <Slider
                  min={0}
                  max={100}
                  value={[currentProgress]}
                  step={0.01}
                  onWheel={(event) => (event.currentTarget as HTMLElement).blur()}
                  onValueChange={(value) =>
                    onSliderInputThrottled.current?.(Array.isArray(value) ? value[0] : value)
                  }
                  onValueCommitted={(value) =>
                    setTime(getTimeForPercent(Array.isArray(value) ? value[0] : value))
                  }
                />
              </div>
              <span className="hidden shrink-0 whitespace-nowrap text-right text-sm tabular-nums text-muted-foreground xl:block">
                {formatUnixTime(maxTs)}
              </span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
