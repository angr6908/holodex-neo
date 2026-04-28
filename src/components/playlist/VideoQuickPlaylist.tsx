"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAppState } from "@/lib/store";

export function VideoQuickPlaylist({ videoId, video }: { videoId: string; video: Record<string, any> }) {
  const appStore = useAppState();
  const [playlistState, setPlaylistState] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const next: any[] = [];
      const jwt = appStore.userdata?.jwt;
      if (jwt) {
        const playlists = await api.getPlaylistState(videoId, jwt).catch(() => ({ data: [] as any[] }));
        next.push(...(playlists.data || []));
      }
      const active = {
        id: appStore.playlistActive?.id,
        active: true,
        name: appStore.playlistActive?.name || "Unnamed Playlist",
        contains: appStore.playlist.some((item) => item.id === videoId),
      };
      const activeIdx = next.findIndex((p) => p.id === active.id);
      if (activeIdx >= 0) next.splice(activeIdx, 1);
      next.unshift(active);
      if (!cancelled) setPlaylistState(next);
    }
    void load();
    return () => { cancelled = true; };
  }, [appStore.userdata?.jwt, appStore.playlist, videoId]);

  async function toggle(index: number) {
    const { id, active, contains } = playlistState[index];

    if (active) {
      if (contains) appStore.removeFromPlaylist(videoId);
      else appStore.addToPlaylist(video);
    } else {
      setPlaylistState((prev) => prev.map((item, idx) => idx === index ? { ...item, loading: true } : item));
      const jwt = appStore.userdata?.jwt;
      if (contains) await api.deleteVideoFromPlaylist(videoId, id, jwt);
      else await api.addVideoToPlaylist(videoId, id, jwt);
      setPlaylistState((prev) => prev.map((item, idx) => idx === index ? { ...item, loading: false } : item));
    }

    setPlaylistState((prev) => prev.map((item, idx) => idx === index ? { ...item, contains: !contains } : item));
  }

  return (
    <div className="flex flex-col gap-1">
      {playlistState.map((p, idx) => (
        <button
          key={`${p.id}${p.name}`}
          type="button"
          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/8 ${p.contains ? "bg-emerald-500/12 text-emerald-100" : ""}`}
          onClick={(event) => { event.stopPropagation(); toggle(idx); }}
        >
          <span>{p.name}</span>
          {p.loading ? <span className="ml-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : null}
        </button>
      ))}
    </div>
  );
}
