"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";

let pid = 0;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = (e) => reject(e);
    document.head.appendChild(s);
  });
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

export const TwitchPlayer = forwardRef<TwitchPlayerHandle, {
  height?: number | string;
  width?: number | string;
  mute?: boolean;
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
}>(function TwitchPlayer({
  height = 720,
  width = 1280,
  mute = false,
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
}, ref) {
  const [elementId] = useState(() => {
    pid += 1;
    return `twitch-player-${pid}`;
  });
  const twitchPlayer = useRef<any>(null);
  const readyRef = useRef(false);

  const handle: TwitchPlayerHandle = useMemo(() => ({
    play: () => { twitchPlayer.current?.play?.(); },
    pause: () => { twitchPlayer.current?.pause?.(); },
    getCurrentTime: () => twitchPlayer.current?.getCurrentTime?.() ?? 0,
    getPlaybackRate: () => 1,
    getVolume: () => (twitchPlayer.current?.getVolume?.() ?? 0) * 100,
    isMuted: () => twitchPlayer.current?.getMuted?.() ?? false,
    setMute: (value: boolean) => { twitchPlayer.current?.setMuted?.(value); },
    setPlaying: (playing: boolean) => { if (playing) twitchPlayer.current?.play?.(); else twitchPlayer.current?.pause?.(); },
    setVolume: (volume: number) => { twitchPlayer.current?.setVolume?.(volume / 100); },
    seekTo: (time: number) => { twitchPlayer.current?.seek?.(time); },
    updateListeners: () => {
      onMute?.(twitchPlayer.current?.getMuted?.() ?? false);
      onPlaybackRate?.(1);
      onCurrentTime?.(twitchPlayer.current?.getCurrentTime?.() ?? 0);
      onVolume?.((twitchPlayer.current?.getVolume?.() ?? 0) * 100);
    },
  }), [onCurrentTime, onMute, onPlaybackRate, onVolume]);

  useImperativeHandle(ref, () => handle, [handle]);

  useEffect(() => {
    let cancelled = false;
    loadScript("https://player.twitch.tv/js/embed/v1.js")
      .then(() => {
        if (cancelled) return;
        const options: Record<string, any> = { width, height, parent: [window.location.hostname], autoplay: false };
        if (playsInline) options.playsinline = true;
        if (channel) options.channel = channel;
        else if (video) options.video = video;
        else { onError?.("no source specified"); return; }
        const tp = new (window as any).Twitch.Player(elementId, options);
        twitchPlayer.current = tp;
        tp.addEventListener("ended", () => onEnded?.());
        tp.addEventListener("pause", () => onPaused?.());
        tp.addEventListener("play", () => onPlaying?.());
        tp.addEventListener("ready", () => {
          readyRef.current = true;
          tp.setQuality(quality);
          tp.setMuted(mute);
          onReady?.(handle);
        });
      })
      .catch((e) => onError?.(e));
    return () => {
      cancelled = true;
      readyRef.current = false;
      onPaused?.();
      twitchPlayer.current = null;
    };
  }, [elementId]);

  useEffect(() => { if (readyRef.current && channel) twitchPlayer.current?.setChannel?.(channel); }, [channel]);
  useEffect(() => { if (readyRef.current && video) twitchPlayer.current?.setVideo?.(video); }, [video]);
  useEffect(() => { if (readyRef.current) twitchPlayer.current?.setMuted?.(mute); }, [mute]);
  useEffect(() => {
    if (manualUpdate || !(onCurrentTime || onPlaybackRate || onMute || onVolume)) return;
    const timer = setInterval(() => handle.updateListeners(), refreshRate);
    return () => clearInterval(timer);
  }, [manualUpdate, onCurrentTime, onPlaybackRate, onMute, onVolume, refreshRate, handle]);

  return <div id={elementId} className={className || undefined} />;
});
