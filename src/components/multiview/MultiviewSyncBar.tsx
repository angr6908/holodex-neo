"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import throttle from "lodash-es/throttle";
import { toast } from "sonner";
import { FastForward, Link, Pause, Gauge } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ChannelImg } from "@/components/channel/ChannelImg";
import { dayjs, formatDuration } from "@/lib/time";
import { encodeLayout } from "@/lib/mv-utils";
import { useTranslations } from "next-intl";
import { useMultiviewStore } from "@/lib/multiview-store";
import { useOrderedMultiviewVideoCells } from "@/lib/multiview-video-cells";
import { cn } from "@/lib/utils";
import * as icons from "@/lib/icons";

const availablePlaybackRates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export function MultiviewSyncBar({ className = "" }: { className?: string }) {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const store = useMultiviewStore();
  const cells = useOrderedMultiviewVideoCells(store.layout);
  const [paused, setPausedState] = useState(true);
  const [hovering, setHovering] = useState(false);
  const [currentTs, setCurrentTsState] = useState(0);
  const [currentProgressByVideo, setCurrentProgressByVideo] = useState<Record<string, number>>({});
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [timeTooltipText, setTimeTooltipText] = useState("");
  const [showConfiguration, setShowConfiguration] = useState(false);
  const lastSyncTimeMillis = useRef(Date.now());
  const currentTsRef = useRef(0);
  const pausedRef = useRef(true);
  const playbackRateRef = useRef(1);
  const firstPlay = useRef(true);
  const onSliderInputThrottled = useRef<((percent: number) => void) | null>(null);

  const routeCurrentTs = searchParams.get("t") || undefined;
  const routeOffsets = searchParams.get("offsets")?.split(",");
  const pastVideos = useMemo(() => store.activeVideos.filter((v: any) => v.status === "past"), [store.activeVideos]);
  const videoWithTs = useMemo(() => {
    const videos = pastVideos.map((v: any) => ({ ...v, startTs: dayjs(v.available_at).unix(), endTs: dayjs(v.available_at).unix() + (v.duration || 0) }));
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
  const splitProgressBarData = useMemo(() => overlapVideos.map((v: any) => ({ id: v.id, channel: v.channel })), [overlapVideos]);
  const currentProgress = getPercentForTime(currentTs);
  const currentDuration = minTs ? formatDuration(Math.round(currentTs - minTs) * 1000) : "0:00";
  const totalDuration = minTs ? formatDuration((maxTs - minTs) * 1000) : "0:00";
  const offsets = useMemo(() => {
    const local = store.syncOffsets;
    if (routeOffsets && overlapVideos.length) {
      return overlapVideos
        .map((v: any, index: number) => ({ [v.id]: local[v.id] ?? Number(routeOffsets[index] || 0) }))
        .reduce((acc: any, current: any) => ({ ...acc, ...current }), {});
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
    return ((percent / 100) * (maxTs - minTs)) + minTs;
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

  const setTime = useCallback((ts: number) => {
    setCurrentTs(ts);
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
  }, [cells, maxTs, minTs, overlapVideos]);

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

    const deltaThreshold = 1.5 * playbackRateRef.current;
    const nextProgress: Record<string, number> = {};
    cells.forEach((cell) => {
      const { video, currentTime: cellCurrentTime } = cell;
      const olVideo = video && overlapVideos.find((v: any) => v.id === video.id);
      if (!olVideo) return;

      const percentProgress = nextTs > olVideo.endTs ? 100 : Number(((cellCurrentTime / olVideo.duration) * 100).toFixed(2));
      nextProgress[olVideo.id] = percentProgress;

      const expectedDuration = nextTs - olVideo.startTs + (offsets[olVideo.id] ?? 0);
      const delta = Math.abs(expectedDuration - cellCurrentTime);
      const isBefore = expectedDuration < 0;
      const isAfter = expectedDuration / olVideo.duration > 1;
      if (isBefore || isAfter) {
        cell.setPlaying(false);
      } else if (expectedDuration > 0 && delta > deltaThreshold) {
        cell.setPlaying(!pausedRef.current);
        cell.seekTo(expectedDuration);
        cell.setPlaybackRate(playbackRateRef.current);
      }
    });
    setCurrentProgressByVideo(nextProgress);
  }, [cells, findStartTime, hasVideosToSync, maxTs, minTs, offsets, overlapVideos]);

  useEffect(() => {
    const timer = setInterval(sync, 500);
    return () => clearInterval(timer);
  }, [sync]);

  useEffect(() => {
    cells.forEach((cell) => {
      const { video } = cell;
      const olVideo = video && overlapVideos.find((v: any) => v.id === video.id);
      if (olVideo && paused) cell.setPlaying(false);
      else setTime(currentTsRef.current);
    });
  }, [paused, cells, overlapVideos, setTime]);

  useEffect(() => {
    cells.forEach((cell) => {
      const { video } = cell;
      const olVideo = video && overlapVideos.find((v: any) => v.id === video.id);
      if (olVideo) cell.setPlaybackRate(playbackRate);
    });
  }, [playbackRate, cells, overlapVideos]);

  const onMouseOverThrottled = useMemo(() => throttle((clientX: number, offsetLeft: number, width: number) => {
    const percent = ((clientX - offsetLeft) / width) * 100;
    if (!(percent >= 0 && percent <= 100)) return;
    const hoverTs = getTimeForPercent(percent);
    setTimeTooltipText(`${formatUnixTime(hoverTs)}\n${formatDuration((hoverTs - minTs) * 1000)}/${totalDuration}`);
  }, 10), [maxTs, minTs, totalDuration]);

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

  useEffect(() => () => {
    onMouseOverThrottled.cancel();
  }, [onMouseOverThrottled]);

  function setOffset(id: string, value: number) { store.setSyncOffsets({ id, value }); }

  function onShareClick() {
    const layoutParam = encodeURIComponent(encodeLayout({ layout: store.layout, contents: store.layoutContent, includeVideo: true }));
    const params = new URLSearchParams();
    if (currentTsRef.current) params.append("t", String(Math.round(currentTsRef.current)));
    const offsetArr = overlapVideos.map((v: any) => offsets[v.id] ?? 0);
    if (offsetArr.find((offset: any) => Number(offset))) params.append("offsets", offsetArr.join(","));
    navigator.clipboard?.writeText(`${window.origin}/multiview/${layoutParam}${params.toString() ? `?${params.toString()}` : ""}`).then(() => {
      toast.success(t("component.videoCard.copiedToClipboard"));
    });
  }

  return (
    <Card className={cn("sticky bottom-0 flex h-[100px] w-full flex-row items-center justify-center gap-0 p-2", className)}>
      <div className="mr-2 flex h-full w-[120px] flex-col items-center">
        {minTs ? <div className="text-center text-sm">{currentDuration} / {totalDuration}</div> : null}
        <div className="flex items-center justify-between"><Button variant="ghost" size="icon" onClick={() => setTime(currentTsRef.current - 10)}><FastForward className="size-4" /></Button><Button variant="ghost" size="icon" onClick={() => setPaused(!paused)}>{paused ? <icons.Play className="size-6" /> : <Pause className="size-6" />}</Button><Button variant="ghost" size="icon" onClick={() => setTime(currentTsRef.current + 10)}><FastForward className="size-4" /></Button></div>
        <div className="flex items-center"><Button variant="ghost" size="icon" onClick={() => setShowConfiguration(!showConfiguration)}><icons.Settings className="size-4" /></Button><Select value={String(playbackRate)} onValueChange={(value) => setPlaybackRate(Number(value))}><SelectTrigger className="h-10 w-10 p-0 [&>svg:last-child]:hidden"><Gauge className="size-4" /><SelectValue className="sr-only" /></SelectTrigger><SelectContent>{availablePlaybackRates.map((rate) => <SelectItem key={rate} value={String(rate)}>{rate}</SelectItem>)}</SelectContent></Select><Button variant="ghost" size="icon" onClick={onShareClick}><Link className="size-4" /></Button></div>
      </div>
      <div className="relative grow self-start">
        {hovering ? <div className="absolute left-1/2 top-[-30px] z-[5] inline-block -translate-x-1/2 -translate-y-1/2 whitespace-pre rounded bg-popover p-1 text-center text-popover-foreground opacity-90">{timeTooltipText}</div> : null}
        <div className="h-[90px] overflow-y-scroll overflow-x-hidden pr-2"><div>{!hasVideosToSync ? t("views.multiview.sync.nothingToSync") : null}</div><div className={cn("relative", !hasVideosToSync && "hidden")}><div className="sticky left-8 top-0 z-[5] -mt-[90px] h-[90px] w-[calc(100%-32px)] border-0" onMouseEnter={() => setHovering(true)} onMouseMove={(event) => { const rect = event.currentTarget.getBoundingClientRect(); onMouseOverThrottled(event.clientX, rect.x, event.currentTarget.clientWidth); }} onMouseLeave={() => setHovering(false)}><Slider min={0} max={100} value={[currentProgress]} step={0.01} className="h-full w-full opacity-70 [&_[data-slot=slider-range]]:bg-transparent [&_[data-slot=slider-thumb]]:h-[90px] [&_[data-slot=slider-thumb]]:w-[3px] [&_[data-slot=slider-thumb]]:rounded-none [&_[data-slot=slider-thumb]]:border-0 [&_[data-slot=slider-thumb]]:bg-primary [&_[data-slot=slider-thumb]]:opacity-80 [&_[data-slot=slider-thumb]]:ring-0 [&_[data-slot=slider-track]]:h-full [&_[data-slot=slider-track]]:bg-transparent" onWheel={(event) => (event.currentTarget as HTMLElement).blur()} onValueChange={(value) => onSliderInputThrottled.current?.(Array.isArray(value) ? value[0] : value)} onValueCommitted={(value) => setTime(getTimeForPercent(Array.isArray(value) ? value[0] : value))} /></div>{splitProgressBarData.map((video: any, index: number) => (
          <div key={`${video.id || "video"}-${index}`} className="my-1 flex items-center gap-2"><ChannelImg channel={video.channel} size={24} noLink /><Progress value={currentProgressByVideo[video.id] || 0} className="h-2 flex-1" /></div>
        ))}</div></div>
      </div>
      <Dialog open={showConfiguration} onOpenChange={setShowConfiguration}><DialogContent className="max-w-lg"><DialogTitle>{t("views.multiview.sync.syncSettings")}</DialogTitle><div className="text-sm">{t("views.multiview.sync.syncSettingsDetail")} {overlapVideos.map((video: any, index: number) => <div key={`${video.id || "video"}-${index}`} className="my-3 flex justify-between gap-3"><ChannelImg channel={video.channel} size={40} noLink /><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => setOffset(video.id, (offsets[video.id] || 0) - 0.5)}>-0.5</Button><Input value={offsets[video.id] || "0"} className="w-24" type="number" onChange={(event) => setOffset(video.id, +event.target.value)} /><span className="text-xs text-muted-foreground">sec</span><Button variant="outline" size="sm" onClick={() => setOffset(video.id, (offsets[video.id] || 0) + 0.5)}>+0.5</Button></div></div>)}</div></DialogContent></Dialog>
    </Card>
  );
}
