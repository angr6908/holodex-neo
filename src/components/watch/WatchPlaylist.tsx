"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SectionPanel } from "@/components/common/SectionPanel";
import { VirtualVideoCardList } from "@/components/video/VirtualVideoCardList";
import { api } from "@/lib/api";
import { useAppState } from "@/lib/store";
import { useTranslations } from "next-intl";
import * as icons from "@/lib/icons";

export function WatchPlaylist({ value = 0, video, onInput, onPlayNext }: { value?: number; currentTime?: number; video: any; onInput?: (index: number) => void; onPlayNext?: (payload: { video: any }) => void }) {
  const searchParams = useSearchParams();
  const app = useAppState();
  const t = useTranslations();
  const [hasError, setHasError] = useState(false);
  const [playlist, setPlaylist] = useState<any>(undefined);
  const videos = useMemo(() => playlist?.videos || [], [playlist]);
  const playlistId = searchParams.get("playlist");
  const activePlaylistName = !app.playlistActive?.id && app.playlistActive?.name === "Unnamed Playlist"
    ? t("component.playlist.unnamed-playlist")
    : app.playlistActive?.name || t("component.playlist.unnamed-playlist");
  const activePlaylist = useMemo(() => ({ ...(app.playlistActive || {}), id: app.playlistActive?.id || "local", name: activePlaylistName, videos: app.playlist }), [app.playlistActive, app.playlist, activePlaylistName]);

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
  if (hasError) {
    return <div className="rounded-xl border border-border/60 bg-card/50 px-4 py-3 text-sm text-destructive">{t("component.playlist.error-loading")}</div>;
  }
  if (!playlist) return null;
  return (
    <SectionPanel
      title={playlist.name}
      meta={`${value + 1}/${videos.length}`}
      actions={
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" title={t("component.playlist.next-video")} onClick={nextVideo}>
          <icons.ArrowLeft className="size-4 rotate-180" />
        </Button>
      }
    >
      <VirtualVideoCardList playlist={playlist} includeChannel horizontal activeIndex={value} />
    </SectionPanel>
  );
}
