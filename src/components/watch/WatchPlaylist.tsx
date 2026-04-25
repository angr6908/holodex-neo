"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { VirtualVideoCardList } from "@/components/video/VirtualVideoCardList";
import { api } from "@/lib/api";
import { useAppState } from "@/lib/store";
import * as icons from "@/lib/icons";

export function WatchPlaylist({ value = 0, video, onInput, onPlayNext }: { value?: number; currentTime?: number; video: any; onInput?: (index: number) => void; onPlayNext?: (payload: { video: any }) => void }) {
  const searchParams = useSearchParams();
  const app = useAppState();
  const [hasError, setHasError] = useState(false);
  const [playlist, setPlaylist] = useState<any>(undefined);
  const videos = useMemo(() => (playlist && playlist.videos) || [], [playlist]);
  const playlistId = searchParams.get("playlist");
  const activePlaylist = useMemo(() => ({ ...(app.playlistActive || {}), id: app.playlistActive?.id || "local", name: app.playlistActive?.name || "Playlist", videos: app.playlist }), [app.playlistActive, app.playlist]);

  function updateCurrentIndex(nextPlaylist = playlist) {
    const currentId = video?.id;
    const newIndex = (nextPlaylist?.videos || []).findIndex(({ id }: any) => id === currentId);
    onInput?.(newIndex);
  }

  function nextVideo() {
    if (videos[value + 1]) onInput?.(value + 1);
  }

  function loadPlaylist(id: string) {
    setHasError(false);
    if (id === activePlaylist.id || id === "local") {
      setPlaylist(activePlaylist);
      updateCurrentIndex(activePlaylist);
      return;
    }
    api.getPlaylist(id)
      .then(({ data }: any) => {
        setPlaylist(data);
        updateCurrentIndex(data);
      })
      .catch((e: any) => {
        console.error(e);
        setHasError(true);
      });
  }

  useEffect(() => {
    if (!playlistId) return;
    updateCurrentIndex();
    loadPlaylist(playlistId);
  }, [playlistId, activePlaylist.id, activePlaylist.videos]);

  useEffect(() => { updateCurrentIndex(); }, [video?.id, playlist?.id]);

  useEffect(() => {
    if (!videos.length || videos.length === value || value === -1 || video?.id === videos[value]?.id) return;
    onPlayNext?.({ video: videos[value] });
  }, [value, videos, video?.id, onPlayNext]);

  if (!playlistId) return null;
  return (
    <div className="mb-2">
      <Card className="rounded-none p-0 shadow-none">
        {playlist ? (
          <>
            <div className="flex items-start justify-between gap-3 px-4 py-4">
              <div>
                <div className="text-base font-semibold text-white">{playlist.name}</div>
                <div className="pt-1 text-sm text-slate-400">{value + 1}/{videos.length}</div>
              </div>
              <Button type="button" size="icon" title="Next video" onClick={nextVideo}>
                <Icon icon={icons.mdiArrowLeft} className="rotate-180" />
              </Button>
            </div>
            <div className="border-t border-white/10" />
            <VirtualVideoCardList playlist={playlist} includeChannel horizontal activeIndex={value} height={`${Math.min(videos.length, 6) * 102}px`} />
          </>
        ) : null}
        {hasError ? <div className="px-4 py-4 text-sm text-rose-300">Error loading playlist, does it exist?</div> : null}
      </Card>
    </div>
  );
}
