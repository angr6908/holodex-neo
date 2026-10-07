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
import { loadTwitchEmbedApi } from "@/lib/twitch-embed-api";

let pid = 0;

// Subscribes to a Twitch embed event; returns the unsubscribe function.
function listen(player: any, event: string, listener: () => void) {
  player.addEventListener(event, listener);
  return () => player.removeEventListener?.(event, listener);
}

export type TwitchPlayerHandle = {
  play: () => void;
  pause: () => void;
  getCurrentTime: () => number;
  getPlaybackRate: () => number;
  getVolume: () => number;
  isMuted: () => boolean;
  setMute: (value: boolean) => void;
  setPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
  seekTo?: (time: number) => void;
  updateListeners: () => void;
};

export const TwitchPlayer = forwardRef<
  TwitchPlayerHandle,
  {
    height?: number | string;
    width?: number | string;
    mute?: boolean;
    autoplay?: boolean;
    refreshRate?: number;
    manualUpdate?: boolean;
    quality?: string;
    playsInline?: boolean;
    channel?: string;
    video?: string;
    className?: string;
    onReady?: (player: TwitchPlayerHandle) => void;
    onError?: (error: unknown) => void;
    onCurrentTime?: (value: number) => void;
    onPlaybackRate?: (value: number) => void;
    onMute?: (value: boolean) => void;
    onVolume?: (value: number) => void;
    onEnded?: () => void;
    onPaused?: () => void;
    onPlaying?: () => void;
  }
>(function TwitchPlayer(
  {
    height = 720,
    width = 1280,
    mute = false,
    autoplay = false,
    refreshRate = 500,
    manualUpdate = false,
    quality = "medium",
    playsInline = false,
    channel = "",
    video = "",
    className = "",
    onReady,
    onError,
    onCurrentTime,
    onPlaybackRate,
    onMute,
    onVolume,
    onEnded,
    onPaused,
    onPlaying,
  },
  ref,
) {
  const [elementId] = useState(() => {
    pid += 1;
    return `twitch-player-${pid}`;
  });
  const twitchPlayer = useRef<any>(null);
  const readyRef = useRef(false);

  const handle: TwitchPlayerHandle = useMemo(
    () => ({
      play: () => {
        twitchPlayer.current?.play?.();
      },
      pause: () => {
        twitchPlayer.current?.pause?.();
      },
      getCurrentTime: () => twitchPlayer.current?.getCurrentTime?.() ?? 0,
      getPlaybackRate: () => 1,
      getVolume: () => (twitchPlayer.current?.getVolume?.() ?? 0) * 100,
      isMuted: () => twitchPlayer.current?.getMuted?.() ?? false,
      setMute: (value: boolean) => {
        twitchPlayer.current?.setMuted?.(value);
      },
      setPlaying: (playing: boolean) => {
        if (playing) twitchPlayer.current?.play?.();
        else twitchPlayer.current?.pause?.();
      },
      setVolume: (volume: number) => {
        twitchPlayer.current?.setVolume?.(volume / 100);
      },
      seekTo: (time: number) => {
        twitchPlayer.current?.seek?.(time);
      },
      updateListeners: () => {
        onMute?.(twitchPlayer.current?.getMuted?.() ?? false);
        onPlaybackRate?.(1);
        onCurrentTime?.(twitchPlayer.current?.getCurrentTime?.() ?? 0);
        onVolume?.((twitchPlayer.current?.getVolume?.() ?? 0) * 100);
      },
    }),
    [onCurrentTime, onMute, onPlaybackRate, onVolume],
  );

  useImperativeHandle(ref, () => handle, [handle]);

  // The player is created once per element; later prop changes are applied by the effects
  // below, and events always reach the latest callbacks.
  const initialOptions = useEffectEvent(() => {
    const options: Record<string, any> = {
      width,
      height,
      parent: [window.location.hostname],
      autoplay,
    };
    if (playsInline) options.playsinline = true;
    if (channel) options.channel = channel;
    else if (video) options.video = video;
    else return null;
    return options;
  });
  const handleReady = useEffectEvent((tp: any) => {
    readyRef.current = true;
    tp.setQuality(quality);
    tp.setMuted(mute);
    onReady?.(handle);
  });
  const handleEvent = useEffectEvent((event: "ended" | "pause" | "play") => {
    if (event === "ended") onEnded?.();
    else if (event === "pause") onPaused?.();
    else onPlaying?.();
  });
  const handleError = useEffectEvent((error: unknown) => onError?.(error));

  useEffect(() => {
    let cancelled = false;
    let unsubscribers: Array<() => void> = [];
    loadTwitchEmbedApi()
      .then(() => {
        if (cancelled) return;
        const options = initialOptions();
        if (!options) {
          handleError("no source specified");
          return;
        }
        const tp = new (window as any).Twitch.Player(elementId, options);
        twitchPlayer.current = tp;
        unsubscribers = [
          listen(tp, "ended", () => handleEvent("ended")),
          listen(tp, "pause", () => handleEvent("pause")),
          listen(tp, "play", () => handleEvent("play")),
          listen(tp, "ready", () => handleReady(tp)),
        ];
      })
      .catch((e) => handleError(e));
    return () => {
      cancelled = true;
      for (const unsubscribe of unsubscribers) unsubscribe();
      readyRef.current = false;
      handleEvent("pause");
      twitchPlayer.current = null;
    };
  }, [elementId]);

  useEffect(() => {
    if (readyRef.current && channel) twitchPlayer.current?.setChannel?.(channel);
  }, [channel]);
  useEffect(() => {
    if (readyRef.current && video) twitchPlayer.current?.setVideo?.(video);
  }, [video]);
  useEffect(() => {
    if (readyRef.current) twitchPlayer.current?.setMuted?.(mute);
  }, [mute]);
  useEffect(() => {
    if (manualUpdate || !(onCurrentTime || onPlaybackRate || onMute || onVolume)) return;
    const timer = setInterval(() => handle.updateListeners(), refreshRate);
    return () => clearInterval(timer);
  }, [manualUpdate, onCurrentTime, onPlaybackRate, onMute, onVolume, refreshRate, handle]);

  return <div id={elementId} className={className || undefined} />;
});
