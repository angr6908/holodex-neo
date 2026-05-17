"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAppState } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useTranslations } from "next-intl";
export function VideoQuickPlaylist({ videoId, video }: { videoId: string; video: Record<string, any> }) {
  const appStore = useAppState();
  const t = useTranslations();
  const [playlistState, setPlaylistState] = useState<any[]>([]);
  const unnamedPlaylistLabel = t("component.playlist.unnamed-playlist");
  const activePlaylistName = !appStore.playlistActive?.id && appStore.playlistActive?.name === "Unnamed Playlist"
    ? unnamedPlaylistLabel
    : appStore.playlistActive?.name || unnamedPlaylistLabel;

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
        name: activePlaylistName,
        contains: appStore.playlist.some((item) => item.id === videoId),
      };
      const activeIdx = next.findIndex((p) => p.id === active.id);
      if (activeIdx >= 0) next.splice(activeIdx, 1);
      next.unshift(active);
      if (!cancelled) setPlaylistState(next);
    }
    void load();
    return () => { cancelled = true; };
  }, [appStore.userdata?.jwt, appStore.playlist, appStore.playlistActive?.id, activePlaylistName, videoId]);

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
        <Button
          key={`${p.id}${p.name}`}
          type="button"
          variant="ghost"
          className={cn(
            "h-auto justify-start rounded-xl px-3 py-2 text-left font-normal whitespace-normal text-slate-200 hover:bg-white/8 hover:text-slate-200",
            p.contains && "bg-emerald-500/12 text-emerald-100 hover:text-emerald-100",
          )}
          onClick={(event) => { event.stopPropagation(); toggle(idx); }}
        >
          <span>{p.name}</span>
          {p.loading ? <Spinner className="ml-2 size-3" /> : null}
        </Button>
      ))}
    </div>
  );
}
