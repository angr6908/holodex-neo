"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import throttle from "lodash-es/throttle";
import { mdiFastForward10, mdiLinkVariant, mdiPause, mdiPlaySpeed, mdiRewind10 } from "@mdi/js";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { ChannelImg } from "@/components/channel/ChannelImg";
import { dayjs, formatDuration } from "@/lib/time";
import { encodeLayout } from "@/lib/mv-utils";
import { useI18n } from "@/lib/i18n";
import { useMultiviewStore } from "@/lib/multiview-store";
import { useMultiviewVideoCells } from "@/lib/multiview-video-cells";
import * as icons from "@/lib/icons";

const availablePlaybackRates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export function MultiviewSyncBar({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const store = useMultiviewStore();
  const registeredCells = useMultiviewVideoCells();
  const cells = useMemo(() => store.layout
    .map((item) => registeredCells.find((cell) => cell.id === String(item.i)))
    .filter((cell): cell is NonNullable<typeof cell> => !!cell && !!cell.video), [store.layout, registeredCells]);
  const [paused, setPausedState] = useState(true);
  const [hovering, setHovering] = useState(false);
  const [currentTs, setCurrentTsState] = useState(0);
  const [currentProgressByVideo, setCurrentProgressByVideo] = useState<Record<string, number>>({});
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [timeTooltipLeft, setTimeTooltipLeft] = useState<string | number>(0);
  const [timeTooltipText, setTimeTooltipText] = useState("");
  const [showConfiguration, setShowConfiguration] = useState(false);
  const [doneCopy, setDoneCopy] = useState(false);
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
  const totalTime = Math.max(maxTs - minTs, 1);
  const splitProgressBarData = useMemo(() => overlapVideos.map((v: any) => ({ id: v.id, channel: v.channel, offset: (v.startTs - minTs) / totalTime, width: (v.endTs - v.startTs) / totalTime })), [overlapVideos, minTs, totalTime]);
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
    const nextTs = ts;
    setCurrentTs(nextTs);
    cells.forEach((cell) => {
      const { video } = cell;
      const olVideo = video && overlapVideos.find((v: any) => v.id === video.id);
      if (!olVideo) return;
      const nextTime = nextTs - olVideo.startTs;
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
    setTimeTooltipLeft(`${percent}%`);
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
      setDoneCopy(true);
      setTimeout(() => setDoneCopy(false), 1400);
    });
  }

  return (
    <div className={`sync-bar flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-2 ${className}`}>
      <div className="mr-2 flex w-[120px] flex-col items-center" style={{ height: "100%" }}>
        {minTs ? <div className="text-center text-body-2">{currentDuration} / {totalDuration}</div> : null}
        <div className="flex items-center justify-between"><Button variant="ghost" size="icon" onClick={() => setTime(currentTsRef.current - 10)}><Icon icon={mdiRewind10} size="sm" /></Button><Button variant="ghost" size="icon" onClick={() => setPaused(!paused)}><Icon icon={paused ? icons.mdiPlay : mdiPause} size="lg" /></Button><Button variant="ghost" size="icon" onClick={() => setTime(currentTsRef.current + 10)}><Icon icon={mdiFastForward10} size="sm" /></Button></div>
        <div className="flex items-center"><Button variant="ghost" size="icon" onClick={() => setShowConfiguration(!showConfiguration)}><Icon icon={icons.mdiCog} size="sm" /></Button><label className="relative inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl text-slate-300 hover:bg-white/8"><Icon icon={mdiPlaySpeed} size="sm" /><select value={playbackRate} className="absolute inset-0 cursor-pointer opacity-0" onChange={(event) => setPlaybackRate(Number(event.target.value))}>{availablePlaybackRates.map((rate) => <option key={rate} value={rate}>{rate}</option>)}</select></label><Button variant="ghost" size="icon" onClick={onShareClick}><Icon icon={mdiLinkVariant} size="sm" /></Button></div>
      </div>
      <div className="grow self-start" style={{ position: "relative" }}>
        <div className="time-tooltip-wrapper"><div style={{ display: hovering ? undefined : "none", marginLeft: timeTooltipLeft }} className="time-tooltip">{timeTooltipText}</div></div>
        <div className="progressSlider pr-2"><div>{!hasVideosToSync ? t("views.multiview.sync.nothingToSync") : null}</div><div style={{ position: "relative", display: hasVideosToSync ? undefined : "none" }}><div className="slider-container" onMouseEnter={() => setHovering(true)} onMouseMove={(event) => { const rect = event.currentTarget.getBoundingClientRect(); onMouseOverThrottled(event.clientX, rect.x, event.currentTarget.clientWidth); }} onMouseLeave={() => setHovering(false)}><input type="range" min="0" max="100" value={currentProgress} className="sync-slider" step="0.01" onWheel={(event) => (event.currentTarget as HTMLInputElement).blur()} onInput={(event) => onSliderInputThrottled.current?.(Number((event.target as HTMLInputElement).value))} onChange={(event) => setTime(getTimeForPercent(Number(event.target.value)))} /></div>{splitProgressBarData.map((video: any, index: number) => (
          <div key={`${video.id || "video"}-${index}`} className="my-1 flex items-center"><ChannelImg channel={video.channel} size={24} className="px-1" noLink /><div className="flex"><div style={{ zIndex: 1, marginLeft: `${(video.offset * 100).toFixed(2)}%`, width: `${(video.width * 100).toFixed(2)}%`, height: 8, background: `linear-gradient(to right, var(--color-secondary) 0%, var(--color-secondary) ${(currentProgressByVideo[video.id] || 0)}%, rgba(255,255,255,0.08) ${(currentProgressByVideo[video.id] || 0)}%, rgba(255,255,255,0.08) 100%)` }} className="rounded-full bg-[color:var(--color-secondary)]" /></div></div>
        ))}</div></div>
      </div>
      <Dialog open={showConfiguration} className="max-w-lg p-0" onOpenChange={setShowConfiguration}><Card className="space-y-5 p-5"><div className="text-lg font-semibold text-white">{t("views.multiview.sync.syncSettings")}</div><div className="text-sm text-slate-200">{t("views.multiview.sync.syncSettingsDetail")} {overlapVideos.map((video: any, index: number) => <div key={`${video.id || "video"}-${index}`} className="my-3 flex justify-between gap-3"><ChannelImg channel={video.channel} size={40} noLink /><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => setOffset(video.id, (offsets[video.id] || 0) - 0.5)}>-0.5</Button><Input value={offsets[video.id] || "0"} className="w-24" type="number" onChange={(event) => setOffset(video.id, +event.target.value)} /><span className="text-xs text-slate-400">sec</span><Button variant="outline" size="sm" onClick={() => setOffset(video.id, (offsets[video.id] || 0) + 0.5)}>+0.5</Button></div></div>)}</div></Card></Dialog>
      {doneCopy ? <div className="fixed bottom-4 left-1/2 z-[120] -translate-x-1/2 rounded-2xl border border-emerald-400/30 bg-emerald-500/20 px-4 py-3 text-sm text-white backdrop-blur">{t("component.videoCard.copiedToClipboard")}</div> : null}
    </div>
  );
}
