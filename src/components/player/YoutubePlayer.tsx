"use client";

import {
  forwardRef,
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import youtubePlayer from "youtube-player";
import type { Options, YouTubePlayer as YTPlayer } from "youtube-player/dist/types";

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

// youtube-player's event emitter returns each listener from on() so it can be passed to off();
// its typings leave both out.
type EmitterPlayer = YTPlayer & {
  on(eventType: string, listener: (event: any) => void): unknown;
  off(listener: unknown): void;
};

// Subscribes to a player event; returns the unsubscribe function.
function listen(player: EmitterPlayer, eventType: string, listener: (event: any) => void) {
  const handle = player.on(eventType, listener);
  return () => player.off(handle);
}

const NO_PLAYER_VARS: Record<string, any> = {};

const UNSTARTED = -1;
const ENDED = 0;
const PLAYING = 1;
const PAUSED = 2;
const BUFFERING = 3;
const CUED = 5;

export const YoutubePlayer = forwardRef<YoutubePlayerHandle, YoutubePlayerProps>(
  function YoutubePlayer(
    {
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
      playerVars = NO_PLAYER_VARS,
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
    },
    ref,
  ) {
    const [elementId] = useState(() => {
      pid += 1;
      return `youtube-player-${pid}`;
    });
    const playerRef = useRef<any>(null);
    const readyRef = useRef(false);
    const retryForMengenRef = useRef(false);
    const videoIdRef = useRef(videoId);
    // Callers often pass playerVars inline, so compare them by value.
    const playerVarsKey = JSON.stringify(playerVars);
    const vars = useMemo(
      () =>
        ({
          playsinline: 1,
          cc_lang_pref: lang,
          hl: lang,
          ...(start ? { start } : {}),
          ...(autoplay ? { autoplay: 1 } : {}),
          ...JSON.parse(playerVarsKey),
        }) as Options["playerVars"],
      [lang, start, autoplay, playerVarsKey],
    );

    const handle: YoutubePlayerHandle = useMemo(
      () => ({
        getCurrentTime: () => playerRef.current?.getCurrentTime?.() ?? 0,
        getPlaybackRate: () => playerRef.current?.getPlaybackRate?.() ?? 1,
        getVolume: () => playerRef.current?.getVolume?.() ?? 0,
        getVideoData: () => playerRef.current?.getVideoData?.() ?? {},
        getPlayerState: () => playerRef.current?.getPlayerState?.() ?? UNSTARTED,
        isMuted: () => playerRef.current?.isMuted?.() ?? false,
        seekTo: (time: number, allowSeekAhead = true) => {
          playerRef.current?.seekTo?.(time, allowSeekAhead);
        },
        playVideo: () => {
          playerRef.current?.playVideo?.();
        },
        pauseVideo: () => {
          playerRef.current?.pauseVideo?.();
        },
        setPlaying: (playing: boolean) => {
          if (playing) playerRef.current?.playVideo?.();
          else playerRef.current?.pauseVideo?.();
        },
        setVolume: (volume: number) => {
          playerRef.current?.setVolume?.(volume);
        },
        setPlaybackRate: (rate: number) => {
          playerRef.current?.setPlaybackRate?.(rate);
        },
        setMute: (value: boolean) => {
          if (value) playerRef.current?.mute?.();
          else playerRef.current?.unMute?.();
        },
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
      }),
      [onCurrentTime, onPlaybackRate, onMute, onVolume],
    );

    useImperativeHandle(ref, () => handle, [handle]);

    // The player is created once per element; later prop changes are applied by the effects
    // below, and events always reach the latest callbacks.
    const initialOptions = useEffectEvent(
      () =>
        ({
          host: "https://www.youtube.com",
          width,
          height,
          videoId,
          playerVars: vars,
          origin: window.origin,
        }) as Options & { origin: string },
    );
    const handleReady = useEffectEvent((player: EmitterPlayer) => {
      readyRef.current = true;
      if (mute) player.mute();
      else player.unMute();
      retryForMengenRef.current = false;
      onReady?.(handle);
    });
    const handleStateChange = useEffectEvent((event: any) => {
      const handlers: Record<number, ((t: unknown) => void) | undefined> = {
        [UNSTARTED]: onUnstarted,
        [PLAYING]: onPlaying,
        [PAUSED]: onPaused,
        [ENDED]: onEnded,
        [BUFFERING]: onBuffering,
        [CUED]: onCued,
      };
      handlers[event?.data]?.(event?.target);
    });
    const handleError = useEffectEvent((event: any) => {
      if (!retryForMengenRef.current && String(event?.data) === "150") {
        retryForMengenRef.current = true;
        const retryVideoId = event?.target?.getVideoData?.()?.video_id ?? videoIdRef.current;
        event?.target?.loadVideoById?.(retryVideoId);
        return;
      }
      onError?.(event);
    });

    useEffect(() => {
      (window as any).YTConfig = { host: "https://www.youtube.com/iframe_api" };
      const options = initialOptions();
      const player = youtubePlayer(elementId, options) as EmitterPlayer;
      playerRef.current = player;
      videoIdRef.current = options.videoId;
      const unsubscribers = [
        listen(player, "ready", () => handleReady(player)),
        listen(player, "stateChange", (event) => handleStateChange(event)),
        listen(player, "error", (event) => handleError(event)),
      ];
      return () => {
        // destroy() waits for the player to be ready, so stop listening right away.
        for (const unsubscribe of unsubscribers) unsubscribe();
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
      if (mute) playerRef.current.mute();
      else playerRef.current.unMute();
    }, [mute]);

    useEffect(() => {
      if (manualUpdate || !onCurrentTime) return;
      const timer = setInterval(async () => {
        try {
          onCurrentTime(await playerRef.current?.getCurrentTime?.());
        } catch {}
      }, refreshRate);
      return () => clearInterval(timer);
    }, [manualUpdate, onCurrentTime, refreshRate]);

    return (
      <div className={className || undefined}>
        <div id={elementId} />
      </div>
    );
  },
);
