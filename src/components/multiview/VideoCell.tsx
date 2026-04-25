"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CellControl } from "@/components/multiview/CellControl";
import { TwitchPlayer, type TwitchPlayerHandle } from "@/components/player/TwitchPlayer";
import { YoutubePlayer, type YoutubePlayerHandle } from "@/components/player/YoutubePlayer";
import { useMultiviewStore } from "@/lib/multiview-store";
import { useRegisterMultiviewVideoCell, type MultiviewVideoCellHandle } from "@/lib/multiview-video-cells";
import { getYTLangFromState } from "@/lib/functions";
import { useAppState } from "@/lib/store";

type PlayerHandle = YoutubePlayerHandle | TwitchPlayerHandle;

export function VideoCell({ item, onDelete }: { item: any; onDelete?: (id: string) => void }) {
  const app = useAppState();
  const store = useMultiviewStore();
  const content = store.layoutContent[item.i];
  const [uniqueId, setUniqueId] = useState(0);
  const player = useRef<PlayerHandle | null>(null);
  const firstPlay = useRef(true);
  const lastExternalTime = useRef<number | null>(null);
  const storeRef = useRef(store);
  const onDeleteRef = useRef(onDelete);
  const videoRef = useRef(content?.video);
  const editModeRef = useRef(content?.editMode ?? true);
  const mutedRef = useRef(!!content?.muted);
  const volumeRef = useRef(Number(content?.volume ?? 50));
  const playbackRateRef = useRef(Number(content?.playbackRate ?? 1));
  const currentTimeRef = useRef(Number(content?.currentTime || 0));
  const isTwitchVideoRef = useRef(content?.video?.type === "twitch");
  const editMode = content?.editMode ?? true;
  const isTwitchVideo = content?.video?.type === "twitch";
  const video = content?.video;
  const muted = !!content?.muted;
  const currentTime = Number(content?.currentTime || 0);
  const lang = getYTLangFromState({ settings: app.settings });

  useEffect(() => {
    storeRef.current = store;
    onDeleteRef.current = onDelete;
    videoRef.current = video;
    editModeRef.current = editMode;
    mutedRef.current = muted;
    volumeRef.current = Number(content?.volume ?? 50);
    playbackRateRef.current = Number(content?.playbackRate ?? 1);
    currentTimeRef.current = currentTime;
    isTwitchVideoRef.current = isTwitchVideo;
  }, [store, onDelete, video, editMode, muted, content?.volume, content?.playbackRate, currentTime, isTwitchVideo]);

  useEffect(() => {
    if (!content) return;
    if (editMode) store.unfreezeLayoutItem(item.i);
    else store.freezeLayoutItem(item.i);
    player.current?.setPlaying?.(!editMode);
  }, [editMode, item.i, !!content]);

  useEffect(() => {
    player.current?.setMute?.(muted);
  }, [muted]);

  useEffect(() => {
    if (!content || isTwitchVideo) return;
    if (lastExternalTime.current === currentTime) return;
    if (lastExternalTime.current === null || Math.abs(currentTime - lastExternalTime.current) > 1) {
      (player.current as any)?.seekTo?.(currentTime);
    }
    lastExternalTime.current = currentTime;
  }, [currentTime, content?.id, isTwitchVideo]);

  useEffect(() => {
    if (!content || !video) return;
    const timer = setInterval(async () => {
      if (!player.current) return;
      const value = await player.current.getCurrentTime?.();
      if (typeof value === "number" && Number.isFinite(value) && Math.abs(value - currentTimeRef.current) >= 0.25) {
        lastExternalTime.current = value;
        currentTimeRef.current = value;
        store.setLayoutContentWithKey({ id: item.i, key: "currentTime", value });
      }
    }, 500);
    return () => clearInterval(timer);
  }, [content?.id, video?.id, item.i]);

  useEffect(() => {
    if (!content) return;
    setUniqueId((value) => value + 1);
    store.setLayoutContentWithKey({ id: item.i, key: "editMode", value: true });
  }, [content?.id]);

  function resetCell() { storeRef.current.deleteLayoutContent(item.i); }
  function deleteCell() { onDeleteRef.current?.(item.i); }
  function refresh() { setUniqueId((value) => value + 1); storeRef.current.setLayoutContentWithKey({ id: item.i, key: "editMode", value: true }); }
  function setEditMode(value: boolean) { storeRef.current.setLayoutContentWithKey({ id: item.i, key: "editMode", value }); }
  function setMuted(val: boolean) {
    if (val === mutedRef.current) return;
    if (!val) storeRef.current.muteOthersAction(item.i);
    storeRef.current.setLayoutContentWithKey({ id: item.i, key: "muted", value: val });
  }
  function setVolume(val: number) {
    player.current?.setVolume?.(val);
    volumeRef.current = val;
    storeRef.current.setLayoutContentWithKey({ id: item.i, key: "volume", value: val });
  }
  function setPlaybackRate(val: number) {
    if (isTwitchVideoRef.current) return;
    (player.current as YoutubePlayerHandle | null)?.setPlaybackRate?.(val);
    playbackRateRef.current = val;
    storeRef.current.setLayoutContentWithKey({ id: item.i, key: "playbackRate", value: val });
  }
  function togglePlaybackRate() {
    if (isTwitchVideoRef.current) return;
    setPlaybackRate(playbackRateRef.current !== 1 ? 1 : 2);
  }
  function setPlaying(val: boolean) {
    if (editModeRef.current !== val) return;
    player.current?.setPlaying?.(editModeRef.current);
  }
  function manualRefresh() {
    player.current?.updateListeners?.();
  }
  async function manualCheckMuted() {
    const value = await player.current?.isMuted?.();
    if (typeof value === "boolean") setMuted(value);
  }
  function seekTo(t: number) {
    player.current?.seekTo?.(t);
  }
  function updatePausedState(paused = false) {
    if (editModeRef.current === paused) return;
    setEditMode(paused);
    if (firstPlay.current && !paused) {
      storeRef.current.muteOthersAction(item.i);
      firstPlay.current = false;
    }
  }

  function onPlayPause(paused = false) {
    const currentPlayer = player.current as YoutubePlayerHandle | null;
    const videoData = currentPlayer?.getVideoData?.();
    if (!isTwitchVideoRef.current && currentPlayer && (!videoData?.isLive || videoData?.allowLiveDvr)) {
      setTimeout(async () => {
        const playerState = await currentPlayer.getPlayerState?.();
        updatePausedState(playerState === 2);
      }, 200);
    } else {
      updatePausedState(paused);
    }
  }
  function onReady(p: PlayerHandle) {
    player.current = p;
    p.setMute?.(muted);
  }

  const exposedCell = useMemo<MultiviewVideoCellHandle>(() => ({
    get id() { return String(item.i); },
    get video() { return videoRef.current; },
    get editMode() { return editModeRef.current; },
    get muted() { return mutedRef.current; },
    get volume() { return volumeRef.current; },
    get isTwitchVideo() { return isTwitchVideoRef.current; },
    get isFastFoward() { return playbackRateRef.current !== 1; },
    get currentTime() { return currentTimeRef.current; },
    refresh,
    setPlaying,
    setMuted,
    setVolume,
    togglePlaybackRate,
    setPlaybackRate,
    manualRefresh,
    manualCheckMuted,
    seekTo,
    deleteCell,
  }), [item.i]);

  useRegisterMultiviewVideoCell(String(item.i), content && video ? exposedCell : null);

  if (!content || !video) return null;
  return (
    <div key={`uid-${uniqueId}`} className="cell-content video-cell">
      <div className={`mv-frame ${editMode ? "elevation-4" : ""}`}>
        {isTwitchVideo ? (
          <TwitchPlayer
            ref={player as React.Ref<TwitchPlayerHandle>}
            channel={content.id}
            playsInline
            mute={muted}
            manualUpdate
            onReady={onReady as any}
            onEnded={() => setEditMode(true)}
            onPlaying={() => onPlayPause(false)}
            onPaused={() => onPlayPause(true)}
            onError={() => setEditMode(true)}
            onMute={setMuted}
            onVolume={(value) => { volumeRef.current = value; store.setLayoutContentWithKey({ id: item.i, key: "volume", value }); }}
          />
        ) : (
          <YoutubePlayer
            ref={player as React.Ref<YoutubePlayerHandle>}
            key={content.id}
            videoId={content.id}
            playerVars={{ playsinline: 1, cc_lang_pref: lang, hl: lang }}
            mute={muted}
            manualUpdate
            onReady={onReady as any}
            onEnded={() => setEditMode(true)}
            onPlaying={() => onPlayPause(false)}
            onPaused={() => onPlayPause(true)}
            onCued={() => setEditMode(true)}
            onError={() => setEditMode(true)}
            onPlaybackRate={(value) => { playbackRateRef.current = value; store.setLayoutContentWithKey({ id: item.i, key: "playbackRate", value }); }}
            onMute={setMuted}
            onVolume={(value) => { volumeRef.current = value; store.setLayoutContentWithKey({ id: item.i, key: "volume", value }); }}
          />
        )}
        <div id={`overlay-${video.id}`} style={{ fontSize: 18 }} />
      </div>
      {editMode ? <CellControl onReset={refresh} onBack={resetCell} onDelete={deleteCell} /> : null}
    </div>
  );
}
