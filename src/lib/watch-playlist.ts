"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAppState } from "@/lib/store";

// The playlist a watch page is playing (`?playlist=`), and where the current video sits in it.
// The user's active playlist is read live from the store; any other playlist is fetched.
export function useWatchPlaylist(playlistId: string | null, currentVideoId?: string | null) {
  const app = useAppState();
  const t = useTranslations();
  const activePlaylistName =
    !app.playlistActive?.id && app.playlistActive?.name === "Unnamed Playlist"
      ? t("component.playlist.unnamed-playlist")
      : app.playlistActive?.name || t("component.playlist.unnamed-playlist");
  const activePlaylist = useMemo(
    () => ({
      ...(app.playlistActive || {}),
      id: app.playlistActive?.id || "local",
      name: activePlaylistName,
      videos: app.playlist,
    }),
    [app.playlistActive, app.playlist, activePlaylistName],
  );
  const isActivePlaylist =
    !!playlistId && (playlistId === "local" || playlistId === activePlaylist.id);
  const [fetched, setFetched] = useState<{ id: string; playlist?: any; error?: boolean } | null>(
    null,
  );

  useEffect(() => {
    if (!playlistId || isActivePlaylist) return;
    let cancelled = false;
    api
      .getPlaylist(playlistId)
      .then(({ data }: any) => {
        if (!cancelled) setFetched({ id: playlistId, playlist: data });
      })
      .catch((e: any) => {
        console.error(e);
        if (!cancelled) setFetched({ id: playlistId, error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [playlistId, isActivePlaylist]);

  const current = !isActivePlaylist && fetched?.id === playlistId ? fetched : null;
  const playlist = !playlistId ? undefined : isActivePlaylist ? activePlaylist : current?.playlist;
  const videos: any[] = playlist?.videos || [];
  return {
    playlist,
    videos,
    hasError: !!current?.error,
    currentIndex: currentVideoId ? videos.findIndex((v) => v.id === currentVideoId) : -1,
  };
}
