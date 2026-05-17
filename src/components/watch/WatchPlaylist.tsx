"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { Separator } from "@/components/ui/separator";
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
  return (
    <div className="mb-2">
      <Card className="rounded-none p-0 shadow-none">
        {playlist ? (
          <>
            <CardHeader className="flex items-start justify-between gap-3 px-4 py-4">
              <div>
                <CardTitle className="text-base font-semibold leading-normal text-white">{playlist.name}</CardTitle>
                <CardDescription className="pt-1 text-sm text-slate-400">{value + 1}/{videos.length}</CardDescription>
              </div>
              <Button type="button" size="icon" title={t("component.playlist.next-video")} onClick={nextVideo}>
                <icons.ArrowLeft className="size-5 rotate-180" />
              </Button>
            </CardHeader>
            <Separator className="bg-white/10" />
            <VirtualVideoCardList playlist={playlist} includeChannel horizontal activeIndex={value} height={`${Math.min(videos.length, 6) * 102}px`} />
          </>
        ) : null}
        {hasError ? <div className="px-4 py-4 text-sm text-rose-300">{t("component.playlist.error-loading")}</div> : null}
      </Card>
    </div>
  );
}
