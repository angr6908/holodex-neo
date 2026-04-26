"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import youtubePlayer from "youtube-player";
import type { Options } from "youtube-player/dist/types";

let pid = 0;

export type YoutubePlayerHandle = {
  getCurrentTime: () => Promise<number> | number;
  getPlaybackRate: () => Promise<number> | number;
  getVolume: () => Promise<number> | number;
  getVideoData: () => any;
  getPlayerState: () => Promise<number> | number;
  isMuted: () => Promise<boolean> | boolean;
  seekTo: (time: number, allowSeekAhead?: boolean) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  setPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  setMute: (value: boolean) => void;
  sendLikeEvent: () => Promise<void> | void;
  updateListeners: () => void;
};

type YoutubePlayerProps = {
  videoId: string;
  height?: number | string;
  width?: number | string;
  start?: number;
  autoplay?: boolean;
  lang?: string;
  mute?: boolean;
  refreshRate?: number;
  manualUpdate?: boolean;
  className?: string;
  playerVars?: Record<string, any>;
  onReady?: (player: YoutubePlayerHandle) => void;
  onError?: (error: unknown) => void;
  onCurrentTime?: (value: number) => void;
  onPlaybackRate?: (value: number) => void;
  onMute?: (value: boolean) => void;
  onVolume?: (value: number) => void;
  onUnstarted?: (target: unknown) => void;
  onPlaying?: (target: unknown) => void;
  onPaused?: (target: unknown) => void;
  onEnded?: (target: unknown) => void;
  onBuffering?: (target: unknown) => void;
  onCued?: (target: unknown) => void;
};

const UNSTARTED = -1;
const ENDED = 0;
const PLAYING = 1;
const PAUSED = 2;
const BUFFERING = 3;
const CUED = 5;

export const YoutubePlayer = forwardRef<YoutubePlayerHandle, YoutubePlayerProps>(function YoutubePlayer({
  videoId,
  height = 720,
  width = 1280,
  start = 0,
  autoplay = false,
  lang = "en",
  mute = false,
  refreshRate = 500,
  manualUpdate = false,
  className = "",
  playerVars = {},
  onReady,
  onError,
  onCurrentTime,
  onPlaybackRate,
  onMute,
  onVolume,
  onUnstarted,
  onPlaying,
  onPaused,
  onEnded,
  onBuffering,
  onCued,
}, ref) {
  const [elementId] = useState(() => {
    pid += 1;
    return `youtube-player-${pid}`;
  });
  const playerRef = useRef<any>(null);
  const readyRef = useRef(false);
  const retryForMengenRef = useRef(false);
  const videoIdRef = useRef(videoId);
  const vars = useMemo(() => ({
    playsinline: 1,
    cc_lang_pref: lang,
    hl: lang,
    ...(start ? { start } : {}),
    ...(autoplay ? { autoplay: 1 } : {}),
    ...playerVars,
  } as Options["playerVars"]), [lang, start, autoplay, JSON.stringify(playerVars)]);

  const handle: YoutubePlayerHandle = useMemo(() => ({
    getCurrentTime: () => playerRef.current?.getCurrentTime?.() ?? 0,
    getPlaybackRate: () => playerRef.current?.getPlaybackRate?.() ?? 1,
    getVolume: () => playerRef.current?.getVolume?.() ?? 0,
    getVideoData: () => playerRef.current?.getVideoData?.() ?? {},
    getPlayerState: () => playerRef.current?.getPlayerState?.() ?? UNSTARTED,
    isMuted: () => playerRef.current?.isMuted?.() ?? false,
    seekTo: (time: number, allowSeekAhead = true) => { playerRef.current?.seekTo?.(time, allowSeekAhead); },
    playVideo: () => { playerRef.current?.playVideo?.(); },
    pauseVideo: () => { playerRef.current?.pauseVideo?.(); },
    setPlaying: (playing: boolean) => { if (playing) playerRef.current?.playVideo?.(); else playerRef.current?.pauseVideo?.(); },
    setVolume: (volume: number) => { playerRef.current?.setVolume?.(volume); },
    setPlaybackRate: (rate: number) => { playerRef.current?.setPlaybackRate?.(rate); },
    setMute: (value: boolean) => { if (value) playerRef.current?.mute?.(); else playerRef.current?.unMute?.(); },
    sendLikeEvent: async () => {
      const iframe = await playerRef.current?.getIframe?.();
      iframe?.contentWindow?.postMessage({ event: "likeVideo" }, "*");
    },
    updateListeners: () => {
      playerRef.current?.getCurrentTime?.().then?.((value: number) => onCurrentTime?.(value));
      playerRef.current?.getPlaybackRate?.().then?.((value: number) => onPlaybackRate?.(value));
      playerRef.current?.isMuted?.().then?.((value: boolean) => onMute?.(value));
      playerRef.current?.getVolume?.().then?.((value: number) => onVolume?.(value));
    },
  }), [onCurrentTime, onPlaybackRate, onMute, onVolume]);

  useImperativeHandle(ref, () => handle, [handle]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as any).YTConfig = { host: "https://www.youtube.com/iframe_api" };
    const player = youtubePlayer(elementId, {
      host: "https://www.youtube.com",
      width,
      height,
      videoId,
      playerVars: vars,
      origin: window.origin,
    } as Options & { origin: string });
    playerRef.current = player;
    videoIdRef.current = videoId;
    player.on("ready", (event: any) => {
      readyRef.current = true;
      if (mute) player.mute(); else player.unMute();
      retryForMengenRef.current = false;
      onReady?.(handle);
    });
    player.on("stateChange", (event: any) => {
      const target = event?.target;
      switch (event?.data) {
        case UNSTARTED: onUnstarted?.(target); break;
        case PLAYING: onPlaying?.(target); break;
        case PAUSED: onPaused?.(target); break;
        case ENDED: onEnded?.(target); break;
        case BUFFERING: onBuffering?.(target); break;
        case CUED: onCued?.(target); break;
        default: break;
      }
    });
    player.on("error", (event: any) => {
      if (!retryForMengenRef.current && String(event?.data) === "150") {
        retryForMengenRef.current = true;
        const retryVideoId = event?.target?.getVideoData?.()?.video_id ?? videoIdRef.current;
        event?.target?.loadVideoById?.(retryVideoId);
        return;
      }
      onError?.(event);
    });
    return () => {
      readyRef.current = false;
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, [elementId]);

  useEffect(() => {
    const player = playerRef.current;
    if (!readyRef.current || !player || videoIdRef.current === videoId) return;
    videoIdRef.current = videoId;
    const params: Record<string, any> = { videoId };
    if (typeof vars.start === "number") params.startSeconds = vars.start;
    if (typeof vars.end === "number") params.endSeconds = vars.end;
    if (vars.autoplay === 1) player.loadVideoById(params);
    else player.cueVideoById(params);
  }, [videoId, vars.start, vars.end, vars.autoplay]);

  useEffect(() => {
    if (!readyRef.current || !playerRef.current) return;
    if (mute) playerRef.current.mute(); else playerRef.current.unMute();
  }, [mute]);

  useEffect(() => {
    if (manualUpdate || !onCurrentTime) return;
    const timer = setInterval(async () => {
      try { onCurrentTime(await playerRef.current?.getCurrentTime?.()); } catch {}
    }, refreshRate);
    return () => clearInterval(timer);
  }, [manualUpdate, onCurrentTime, refreshRate]);

  return <div className={className || undefined}><div id={elementId} /></div>;
});
