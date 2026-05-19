"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CellControl } from "@/components/multiview/CellControl";
import { TwitchPlayer, type TwitchPlayerHandle } from "@/components/player/TwitchPlayer";
import { YoutubePlayer, type YoutubePlayerHandle } from "@/components/player/YoutubePlayer";
import { useMultiviewStore } from "@/lib/multiview-store";
import { useRegisterMultiviewVideoCell, type MultiviewVideoCellHandle } from "@/lib/multiview-video-cells";
import { getYTLangFromState } from "@/lib/functions";
import { useAppState } from "@/lib/store";

type PH = YoutubePlayerHandle | TwitchPlayerHandle;

export function VideoCell({ item, onDelete }: { item: any; onDelete?: (id: string) => void }) {
  const app = useAppState();
  const store = useMultiviewStore();
  const c = store.layoutContent[item.i];
  const [uid, setUid] = useState(0);
  const player = useRef<PH | null>(null);
  const firstPlay = useRef(true);
  const lastExtTime = useRef<number | null>(null);
  const storeRef = useRef(store);
  const onDeleteRef = useRef(onDelete);
  const videoRef = useRef(c?.video);
  const editModeRef = useRef(c?.editMode ?? true);
  const mutedRef = useRef(!!c?.muted);
  const volumeRef = useRef(Number(c?.volume ?? 50));
  const rateRef = useRef(Number(c?.playbackRate ?? 1));
  const timeRef = useRef(Number(c?.currentTime || 0));
  const isTwRef = useRef(c?.video?.type === "twitch");
  const editMode = c?.editMode ?? true;
  const isTw = c?.video?.type === "twitch";
  const video = c?.video;
  const muted = !!c?.muted;
  const currentTime = Number(c?.currentTime || 0);
  const lang = getYTLangFromState({ settings: app.settings });

  useEffect(() => {
    storeRef.current = store; onDeleteRef.current = onDelete;
    videoRef.current = video; editModeRef.current = editMode; mutedRef.current = muted;
    volumeRef.current = Number(c?.volume ?? 50);
    rateRef.current = Number(c?.playbackRate ?? 1);
    timeRef.current = currentTime; isTwRef.current = isTw;
  }, [store, onDelete, video, editMode, muted, c?.volume, c?.playbackRate, currentTime, isTw]);

  useEffect(() => {
    if (!c) return;
    player.current?.setPlaying?.(!editMode);
  }, [editMode, c?.id]);

  useEffect(() => { player.current?.setMute?.(muted); }, [muted]);

  useEffect(() => {
    if (!c || isTw) return;
    if (lastExtTime.current === currentTime) return;
    if (lastExtTime.current === null || Math.abs(currentTime - lastExtTime.current) > 1)
      (player.current as any)?.seekTo?.(currentTime);
    lastExtTime.current = currentTime;
  }, [currentTime, c?.id, isTw]);

  useEffect(() => {
    if (!c || !video) return;
    const timer = setInterval(async () => {
      if (!player.current) return;
      const v = await player.current.getCurrentTime?.();
      if (typeof v === "number" && Number.isFinite(v) && Math.abs(v - timeRef.current) >= 0.25) {
        lastExtTime.current = v; timeRef.current = v;
        store.setLayoutContentWithKey({ id: item.i, key: "currentTime", value: v });
      }
    }, 500);
    return () => clearInterval(timer);
  }, [c?.id, video?.id, item.i]);

  useEffect(() => {
    if (!c) return;
    setUid((v) => v + 1);
    store.setLayoutContentWithKey({ id: item.i, key: "editMode", value: true });
  }, [c?.id]);

  const setKey = (key: string, value: any) => storeRef.current.setLayoutContentWithKey({ id: item.i, key, value });
  const handleVolume = (v: number) => { volumeRef.current = v; store.setLayoutContentWithKey({ id: item.i, key: "volume", value: v }); };
  const handleRate = (v: number) => { rateRef.current = v; store.setLayoutContentWithKey({ id: item.i, key: "playbackRate", value: v }); };
  const resetCell = () => storeRef.current.deleteLayoutContent(item.i);
  const deleteCell = () => onDeleteRef.current?.(item.i);
  const refresh = () => { setUid((v) => v + 1); setKey("editMode", true); };
  const setEditMode = (v: boolean) => setKey("editMode", v);
  const setMuted = (v: boolean) => {
    if (v === mutedRef.current) return;
    if (!v) storeRef.current.muteOthersAction(item.i);
    setKey("muted", v);
  };
  const setVolume = (v: number) => { player.current?.setVolume?.(v); volumeRef.current = v; setKey("volume", v); };
  const setPlaybackRate = (v: number) => {
    if (isTwRef.current) return;
    (player.current as YoutubePlayerHandle | null)?.setPlaybackRate?.(v);
    rateRef.current = v; setKey("playbackRate", v);
  };
  const togglePlaybackRate = () => { if (!isTwRef.current) setPlaybackRate(rateRef.current !== 1 ? 1 : 2); };
  const setPlaying = (v: boolean) => { if (editModeRef.current === v) player.current?.setPlaying?.(editModeRef.current); };
  const manualRefresh = () => player.current?.updateListeners?.();
  const manualCheckMuted = async () => { const v = await player.current?.isMuted?.(); if (typeof v === "boolean") setMuted(v); };
  const seekTo = (t: number) => player.current?.seekTo?.(t);

  function updatePaused(paused = false) {
    if (editModeRef.current === paused) return;
    setEditMode(paused);
    if (firstPlay.current && !paused) { storeRef.current.muteOthersAction(item.i); firstPlay.current = false; }
  }

  function onPlayPause(paused = false) {
    const p = player.current as YoutubePlayerHandle | null;
    const vd = p?.getVideoData?.();
    if (!isTwRef.current && p && (!vd?.isLive || vd?.allowLiveDvr)) {
      setTimeout(async () => updatePaused((await p.getPlayerState?.()) === 2), 200);
    } else updatePaused(paused);
  }

  const onReady = (p: PH) => { player.current = p; p.setMute?.(muted); };

  const exposed = useMemo<MultiviewVideoCellHandle>(() => ({
    get id() { return String(item.i); },
    get video() { return videoRef.current; },
    get editMode() { return editModeRef.current; },
    get muted() { return mutedRef.current; },
    get volume() { return volumeRef.current; },
    get isTwitchVideo() { return isTwRef.current; },
    get isFastFoward() { return rateRef.current !== 1; },
    get currentTime() { return timeRef.current; },
    refresh, setPlaying, setMuted, setVolume, togglePlaybackRate, setPlaybackRate,
    manualRefresh, manualCheckMuted, seekTo, deleteCell,
  }), [item.i]);

  useRegisterMultiviewVideoCell(String(item.i), c && video ? exposed : null);

  if (!c || !video) return null;
  const ytClass = "absolute inset-0 h-full w-full overflow-hidden [&>div]:absolute [&>div]:inset-0 [&>div]:h-full [&>div]:w-full [&>div>iframe]:absolute [&>div>iframe]:inset-0 [&>div>iframe]:h-full [&>div>iframe]:w-full [&>iframe]:absolute [&>iframe]:inset-0 [&>iframe]:h-full [&>iframe]:w-full";
  const twClass = "absolute inset-0 h-full w-full overflow-hidden [&>iframe]:absolute [&>iframe]:inset-0 [&>iframe]:h-full [&>iframe]:w-full";

  return (
    <div key={`uid-${uid}`} className="flex h-full max-h-full min-h-0 w-full grow basis-full shrink flex-col overflow-hidden">
      <div className="relative min-h-0 w-full flex-1">
        {isTw ? (
          <TwitchPlayer ref={player as React.Ref<TwitchPlayerHandle>} channel={c.id} className={twClass}
            playsInline mute={muted} manualUpdate onReady={onReady as any}
            onEnded={() => setEditMode(true)} onPlaying={() => onPlayPause(false)} onPaused={() => onPlayPause(true)}
            onError={() => setEditMode(true)} onMute={setMuted} onVolume={handleVolume} />
        ) : (
          <YoutubePlayer ref={player as React.Ref<YoutubePlayerHandle>} key={c.id} videoId={c.id} className={ytClass}
            playerVars={{ playsinline: 1, cc_lang_pref: lang, hl: lang }} mute={muted} manualUpdate onReady={onReady as any}
            onEnded={() => setEditMode(true)} onPlaying={() => onPlayPause(false)} onPaused={() => onPlayPause(true)}
            onCued={() => setEditMode(true)} onError={() => setEditMode(true)}
            onPlaybackRate={handleRate} onMute={setMuted} onVolume={handleVolume} />
        )}
        <div id={`overlay-${video.id}`} className="text-lg" />
      </div>
      {editMode ? <CellControl onReset={refresh} onBack={resetCell} onDelete={deleteCell} /> : null}
    </div>
  );
}
