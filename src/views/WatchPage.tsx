"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { mdiTheater, mdiThumbUp } from "@mdi/js";
import { api } from "@/lib/api";
import { useAppState } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { decodeHTMLEntities, getYTLangFromState } from "@/lib/functions";
import { addWatchedVideo } from "@/lib/history";
import { LoadingOverlay } from "@/components/common/LoadingOverlay";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { YoutubePlayer, type YoutubePlayerHandle } from "@/components/player/YoutubePlayer";
import { WatchToolbar } from "@/components/watch/WatchToolbar";
import { WatchInfo } from "@/components/watch/WatchInfo";
import { WatchHighlights } from "@/components/watch/WatchHighlights";
import { WatchComments } from "@/components/watch/WatchComments";
import { WatchSideBar } from "@/components/watch/WatchSideBar";
import { WatchLiveChat } from "@/components/watch/WatchLiveChat";
import { WatchQuickEditor } from "@/components/watch/WatchQuickEditor";
import { WatchPlaylist } from "@/components/watch/WatchPlaylist";
import { UploadScript } from "@/components/tlscriptmanager/UploadScript";
import * as icons from "@/lib/icons";
import { defaultWatchControlsState, writeWatchControlsState } from "@/lib/watch-state";

const emptyVideo = { channel: {}, id: null, title: "Loading...", description: "" };

export function WatchPage() {
  const params = useParams<{ id?: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const app = useAppState();
  const { t } = useI18n();
  const videoId = params.id || searchParams.get("v") || "";
  const [video, setVideo] = useState<Record<string, any>>(emptyVideo);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showTL, setShowTL] = useState(false);
  const [showLiveChat, setShowLiveChat] = useState(true);
  const [theaterMode, setTheaterMode] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playlistIndex, setPlaylistIndex] = useState(-1);
  const [playerRenderWidth, setPlayerRenderWidth] = useState<number | null>(null);
  const [playerStackReserve, setPlayerStackReserve] = useState(52);
  const playerStackReserveRef = useRef(52);
  const playerWidthRaf = useRef<number | null>(null);
  const player = useRef<YoutubePlayerHandle | null>(null);
  const watchLayout = useRef<HTMLDivElement | null>(null);
  const timeOffset = Number(searchParams.get("t") || 0) || 0;
  const title = (video.title && decodeHTMLEntities(video.title)) || "";
  const hasLiveChat = video.type === "stream" && (["upcoming", "live"].includes(video.status) || (video.status === "past" && !app.isMobile));
  const hasLiveTL = video.type === "stream";
  const showChatWindow = (hasLiveChat && showLiveChat) || (showTL && hasLiveTL);
  const comments = video.comments || [];
  const isPlaylist = !!searchParams.get("playlist");
  const role = app.userdata?.user?.role;
  const isEditor = role === "admin" || role === "editor";
  const hasRelatedSections = Boolean(video?.simulcasts?.length || video?.clips?.length || video?.sources?.length || video?.same_source_clips?.length || video?.recommendations?.length || video?.refers?.length);
  const showUtilityRail = Boolean(isEditor || isPlaylist);
  const showUpload = app.uploadPanel;
  const hasExtension = typeof window !== "undefined" && !!(window as any).HOLODEX_PLUS_INSTALLED;
  const showHighlightsBar = (comments.length || video.songcount) && (!app.isMobile || !showTL);

  useEffect(() => {
    if (!videoId) { setHasError(true); setIsLoading(false); return; }
    let cancelled = false;
    window.scrollTo(0, 0);
    setVideo(emptyVideo);
    setShowTL(defaultWatchControlsState.showTL);
    setShowLiveChat(defaultWatchControlsState.showLiveChat);
    setTheaterMode(defaultWatchControlsState.theaterMode);
    writeWatchControlsState(defaultWatchControlsState);
    setCurrentTime(0);
    setIsLoading(true);
    setHasError(false);
    api.video(videoId, app.settings.clipLangs.join(","), 1).then(({ data }: any) => {
      if (cancelled) return;
      setVideo(data);
      setIsLoading(false);
      document.title = (data.title && decodeHTMLEntities(data.title)) || "Holodex";
      requestAnimationFrame(schedulePlayerWidthMeasure);
      addWatchedVideo(data);
    }).catch((e) => { console.error(e); if (!cancelled) { setHasError(true); setIsLoading(false); } });
    return () => { cancelled = true; };
  }, [videoId]);

  useEffect(() => { if (title) document.title = title; }, [title]);
  useEffect(() => {
    writeWatchControlsState({ showTL, showLiveChat, theaterMode });
  }, [showTL, showLiveChat, theaterMode]);
  useEffect(() => { playerStackReserveRef.current = playerStackReserve; }, [playerStackReserve]);
  useEffect(() => {
    function onKey(event: KeyboardEvent) { if (event.altKey && event.key.toLowerCase() === "t") { event.preventDefault(); toggleTheaterMode(); } }
    window.addEventListener("keyup", onKey);
    window.addEventListener("resize", schedulePlayerWidthMeasure, { passive: true });
    requestAnimationFrame(schedulePlayerWidthMeasure);
    return () => {
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("resize", schedulePlayerWidthMeasure);
      if (playerWidthRaf.current) cancelAnimationFrame(playerWidthRaf.current);
    };
  }, []);
  useEffect(() => { requestAnimationFrame(schedulePlayerWidthMeasure); }, [theaterMode, app.isMobile, showChatWindow, showHighlightsBar]);
  function measurePlayerWidth() {
    const playerSurface = document.querySelector(".watch-screen .video");
    if (!(playerSurface instanceof HTMLElement)) { setPlayerRenderWidth(null); return; }
    const width = Math.round(playerSurface.getBoundingClientRect().width);
    setPlayerRenderWidth(width > 0 ? width : null);
    const toolbarEl = document.querySelector(".watch-toolbar");
    const highlightsEl = document.querySelector(".watch-highlights");
    const toolbarHeight = toolbarEl instanceof HTMLElement ? Math.ceil(toolbarEl.getBoundingClientRect().height) : 52;
    const highlightsHeight = highlightsEl instanceof HTMLElement ? Math.ceil(highlightsEl.getBoundingClientRect().height) : 0;
    const nextReserve = toolbarHeight + highlightsHeight;
    const reserveChanged = playerStackReserveRef.current !== nextReserve;
    playerStackReserveRef.current = nextReserve;
    setPlayerStackReserve(nextReserve);
    if (reserveChanged) requestAnimationFrame(schedulePlayerWidthMeasure);
  }

  function schedulePlayerWidthMeasure() {
    if (playerWidthRaf.current) cancelAnimationFrame(playerWidthRaf.current);
    playerWidthRaf.current = requestAnimationFrame(() => {
      playerWidthRaf.current = null;
      measurePlayerWidth();
    });
  }

  function seekTo(time: number) {
    if (!player.current) return;
    window.scrollTo(0, 0);
    player.current.seekTo(time);
    player.current.playVideo();
  }

  function toggleTheaterMode() {
    setTheaterMode((value) => !value);
    requestAnimationFrame(() => { schedulePlayerWidthMeasure(); if (watchLayout.current) watchLayout.current.scrollTop = 0; });
  }

  if (isLoading || hasError) return <div className="watch-loading-shell"><LoadingOverlay isLoading={isLoading} showError={hasError} variant="watch" /></div>;
  return (
    <div className={`watch-page ${theaterMode && !app.isMobile ? "watch-page--cinema" : ""} ${showChatWindow ? "watch-page--chat" : ""} ${app.isMobile ? "watch-page--mobile" : ""}`} style={{ "--player-stack-reserve": `${playerStackReserve}px` } as React.CSSProperties}>
      <div ref={watchLayout} className="watch-content">
        <div className="watch-main">
          <div className="watch-player-group">
            <div className={`watch-screen ${theaterMode && !app.isMobile ? "watch-screen--cinema" : ""}`}>
              <div style={{ position: "relative" }}>
                {video.id ? (
                  <YoutubePlayer
                    ref={player}
                    className="video"
                    videoId={video.id}
                    start={timeOffset}
                    autoplay
                    lang={getYTLangFromState({ settings: { lang: app.settings.lang } })}
                    onReady={(p) => { player.current = p; requestAnimationFrame(schedulePlayerWidthMeasure); }}
                    onCurrentTime={setCurrentTime}
                    onEnded={() => { if (playlistIndex >= 0) setPlaylistIndex((value) => value + 1); }}
                  />
                ) : null}
                <div id={`overlay-${video.id}`} style={{ fontSize: "max(1.5vw, 16px)" }} />
              </div>
            </div>
            {showHighlightsBar ? <WatchHighlights key="highlights" comments={comments} video={video} limit={app.isMobile ? 8 : 0} playerWidth={playerRenderWidth} onTimeJump={seekTo} /> : null}
            <WatchToolbar video={video} noBackButton={!app.isMobile}>
              {hasExtension ? <Button type="button" size="icon" variant="ghost" title={t("views.watch.likeOnYoutube")} onClick={() => player.current?.sendLikeEvent()}><Icon icon={mdiThumbUp} /></Button> : null}
              {!app.isMobile ? <Button type="button" size="icon" variant={theaterMode ? "default" : "ghost"} title={t("views.watch.theaterMode")} onClick={toggleTheaterMode}><Icon icon={mdiTheater} /></Button> : null}
              {hasLiveTL ? <Button type="button" size="icon" variant={showTL ? "default" : "ghost"} title={showTL ? t("views.watch.chat.hideTLBtn") : t("views.watch.chat.showTLBtn")} onClick={() => setShowTL((value) => !value)}><Icon icon={icons.tlChat} /></Button> : null}
              {hasLiveChat ? <Button type="button" size="icon" variant={showLiveChat ? "default" : "ghost"} onClick={() => setShowLiveChat((value) => !value)}><Icon icon={icons.ytChat} /></Button> : null}
            </WatchToolbar>
          </div>
          {video?.songcount ? <WatchSideBar key="songs" video={video} className="watch-section" showSongs showRelations={false} onTimeJump={seekTo} /> : null}
          <WatchInfo key="info" video={video} onTimeJump={seekTo} />
          {comments.length ? <div><WatchComments key="comments" comments={comments} video={video} limit={app.isMobile ? 5 : 0} onTimeJump={seekTo} /></div> : null}
          {hasRelatedSections ? <WatchSideBar key="related" video={video} className="watch-section" showSongs={false} showRelations onTimeJump={seekTo} /> : null}
          {showUtilityRail ? (
            <div className="watch-section flex flex-col gap-4">
              {isEditor ? <WatchQuickEditor video={video} /> : null}
              {isPlaylist ? <WatchPlaylist value={playlistIndex} video={video} onInput={setPlaylistIndex} onPlayNext={({ video: nextVideo }) => { const playlist = searchParams.get("playlist"); if (nextVideo?.id) router.push(`/watch/${nextVideo.id}${playlist ? `?playlist=${playlist}` : ""}`); }} /> : null}
            </div>
          ) : null}
        </div>
      </div>
      {showChatWindow ? <WatchLiveChat className="watch-chat" video={video} currentTime={currentTime} modelValue={{ showTlChat: showTL, showYtChat: showLiveChat && hasLiveChat }} onTimeJump={seekTo} onVideoUpdate={(update) => {
        if (!update?.status || !update?.start_actual) return;
        setVideo((value) => ({
          ...value,
          live_viewers: update.live_viewers,
          status: update.status,
          start_actual: typeof update.start_actual === "string" ? update.start_actual : value.start_actual,
        }));
      }} /> : null}
      <Dialog open={showUpload} className="max-h-[500px] max-w-[80%]" onOpenChange={(open) => app.setUploadPanel(open)}>
        <Card className="border-0 p-0 shadow-none">
          <UploadScript videoData={video} onClose={() => app.setUploadPanel(false)} />
        </Card>
      </Dialog>
    </div>
  );
}
