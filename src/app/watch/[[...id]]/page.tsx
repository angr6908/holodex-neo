"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Theater, ThumbsUp } from "@/lib/icons";
import { api } from "@/lib/api";
import { useAppState } from "@/lib/store";
import { useTranslations } from "next-intl";
import { decodeHTMLEntities, getYTLangFromState } from "@/lib/functions";
import { addWatchedVideo, defaultWatchControlsState, writeWatchControlsState } from "@/lib/browser";
import { ApiErrorMessage } from "@/components/common/ApiErrorMessage";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { YoutubePlayer, type YoutubePlayerHandle } from "@/components/player/YoutubePlayer";
import { WatchToolbar } from "@/components/watch/WatchToolbar";
import { WatchInfo } from "@/components/watch/WatchInfo";
import { WatchHighlights } from "@/components/watch/WatchHighlights";
import { WatchComments } from "@/components/watch/WatchComments";
import { WatchSideBar } from "@/components/watch/WatchSideBar";
import { WatchLiveChat } from "@/components/watch/WatchLiveChat";
import { WatchQuickEditor } from "@/components/watch/WatchQuickEditor";
import { WatchPlaylist } from "@/components/watch/WatchPlaylist";
import { UploadScript } from "@/components/tl/UploadScript";
import * as icons from "@/lib/icons";
import { cn } from "@/lib/utils";
const emptyVideo = { channel: {}, id: null, title: "Loading...", description: "" };

export default function WatchPage() {
  const params = useParams<{ id?: string | string[] }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const app = useAppState();
  const t = useTranslations();
  const routeVideoId = Array.isArray(params.id) ? params.id[0] : params.id;
  const videoId = routeVideoId || searchParams.get("v") || "";
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
  const likeOnYoutubeLabel = t("views.watch.likeOnYoutube");
  const theaterModeLabel = t("views.watch.theaterMode");
  const liveTlLabel = showTL ? t("views.watch.chat.hideTLBtn") : t("views.watch.chat.showTLBtn");

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

  const isCinema = theaterMode && !app.isMobile;
  const watchStyle = {
    "--nav-h": "0px",
    "--pad-x": "clamp(12px,1.8vw,24px)",
    "--pad-y": "clamp(12px,1.8vw,24px)",
    "--gap": "clamp(12px,1.6vw,20px)",
    "--chat-w": "clamp(320px,24vw,360px)",
    "--player-stack-reserve": `${playerStackReserve}px`,
  } as React.CSSProperties;
  const pageClass = cn(
    "relative z-0 box-border flex min-h-screen w-full overflow-x-clip",
    "min-[960px]:items-start min-[960px]:gap-[var(--gap)] min-[960px]:px-[var(--pad-x)] min-[960px]:pt-[var(--pad-y)] min-[960px]:pb-[clamp(1.5rem,3vw,3rem)]",
    "max-[959px]:flex-col max-[959px]:pt-[var(--pad-y)]",
    showChatWindow && !app.isMobile && (isCinema ? "min-[960px]:pr-[calc(var(--chat-w)+var(--pad-x))]" : "min-[960px]:pr-[calc(var(--chat-w)+var(--gap)+var(--pad-x))]"),
  );
  const contentClass = cn(
    "relative z-[1] flex w-full min-w-0 grow items-start overflow-visible",
    isCinema ? "flex-col items-stretch" : "flex-row",
    "max-[959px]:flex-col",
  );
  const mainClass = cn("flex min-w-0 flex-1 flex-col", isCinema ? "w-full max-w-none" : "max-w-[min(100%,1080px)]", "max-[959px]:w-full");
  const playerGroupClass = cn("contents", isCinema && "block min-[960px]:mx-[calc(-1*var(--pad-x))]");
  const screenClass = cn("watch-screen relative transition-colors", isCinema && "-mt-[var(--pad-y)]");
  const playerClass = cn(
    "video relative aspect-video h-auto w-full overflow-hidden bg-black [&>div]:absolute [&>div]:inset-0 [&>div]:h-full [&>div]:w-full [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:h-full [&_iframe]:w-full",
    isCinema && "mx-auto max-w-[calc((100dvh-var(--nav-h)-var(--player-stack-reserve))*16/9)] shadow-2xl",
  );
  const toolbarShellClass = cn(isCinema && "mx-auto w-full max-w-[calc((100dvh-var(--nav-h)-var(--player-stack-reserve))*16/9)]");
  const sectionClass = "mt-[clamp(12px,1.4vw,18px)]";
  const chatClass = cn(
    "z-[1] w-full min-w-0",
    "min-[960px]:fixed min-[960px]:right-[var(--pad-x)] min-[960px]:top-[calc(var(--nav-h)+var(--pad-y))] min-[960px]:h-[calc(100vh-var(--nav-h)-var(--pad-y))] min-[960px]:w-[var(--chat-w)] min-[960px]:min-w-80 min-[960px]:overflow-y-auto min-[960px]:rounded-xl",
    "max-[959px]:relative max-[959px]:mt-[var(--gap)] max-[959px]:h-auto max-[959px]:max-h-[65vh] max-[959px]:min-h-[min(56vh,420px)] max-[959px]:overflow-hidden",
    isCinema && "min-[960px]:right-0 min-[960px]:top-[var(--nav-h)] min-[960px]:h-[calc(100dvh-var(--nav-h))] min-[960px]:rounded-none min-[960px]:border-l min-[960px]:border-white/10 min-[960px]:bg-slate-950/95",
  );

  if (isLoading || hasError) return (
    <div className="flex min-h-[calc(100vh-65px)] w-full items-start justify-center px-4 pt-[calc(10px+5.5rem)] min-[960px]:px-[clamp(12px,1.8vw,24px)] min-[960px]:pt-[calc(10px+8rem)]">
      {isLoading && !hasError ? (
        <Card className="inline-flex flex-row items-center gap-3 rounded-lg px-4 py-3">
          <Spinner />
        </Card>
      ) : null}
      {hasError ? <ApiErrorMessage /> : null}
    </div>
  );
  return (
    <div className={pageClass} style={watchStyle}>
      <div ref={watchLayout} className={contentClass}>
        <div className={mainClass}>
          <div className={playerGroupClass}>
            <div className={screenClass}>
              <div style={{ position: "relative" }}>
                {video.id ? (
                  <YoutubePlayer
                    ref={player}
                    className={playerClass}
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
            <div className={toolbarShellClass}>
              <WatchToolbar video={video}>
                {hasExtension ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={<Button type="button" size="icon" variant="ghost" aria-label={likeOnYoutubeLabel} onClick={() => player.current?.sendLikeEvent()} />}
                    >
                      <ThumbsUp className="size-5" />
                    </TooltipTrigger>
                    <TooltipContent>{likeOnYoutubeLabel}</TooltipContent>
                  </Tooltip>
                ) : null}
	                {!app.isMobile ? (
	                  <Tooltip>
	                    <TooltipTrigger
                        render={<Toggle pressed={theaterMode} aria-label={theaterModeLabel} onPressedChange={() => toggleTheaterMode()} />}
                      >
	                      <Theater className="size-5" />
	                    </TooltipTrigger>
	                    <TooltipContent>{theaterModeLabel}</TooltipContent>
	                  </Tooltip>
	                ) : null}
	                {hasLiveTL ? (
	                  <Tooltip>
	                    <TooltipTrigger
                        render={<Toggle pressed={showTL} aria-label={liveTlLabel} onPressedChange={setShowTL} />}
                      >
	                      <icons.TlChatIcon className="size-5" />
	                    </TooltipTrigger>
	                    <TooltipContent>{liveTlLabel}</TooltipContent>
	                  </Tooltip>
	                ) : null}
	                {hasLiveChat ? <Toggle pressed={showLiveChat} aria-label={t("views.watch.chat.ytChatLabel")} onPressedChange={setShowLiveChat}><icons.YtChatIcon className="size-5" /></Toggle> : null}
              </WatchToolbar>
            </div>
          </div>
          {video?.songcount ? <WatchSideBar key="songs" video={video} className={sectionClass} showSongs showRelations={false} onTimeJump={seekTo} /> : null}
          <WatchInfo key="info" video={video} onTimeJump={seekTo} />
          {comments.length ? <WatchComments key="comments" comments={comments} video={video} limit={app.isMobile ? 5 : 0} onTimeJump={seekTo} /> : null}
          {hasRelatedSections ? <WatchSideBar key="related" video={video} className={sectionClass} showSongs={false} showRelations onTimeJump={seekTo} /> : null}
          {showUtilityRail ? (
            <div className={cn(sectionClass, "flex flex-col gap-4")}>
              {isEditor ? <WatchQuickEditor video={video} /> : null}
              {isPlaylist ? <WatchPlaylist value={playlistIndex} video={video} onInput={setPlaylistIndex} onPlayNext={({ video: nextVideo }) => { const playlist = searchParams.get("playlist"); if (nextVideo?.id) router.push(`/watch/${nextVideo.id}${playlist ? `?playlist=${playlist}` : ""}`); }} /> : null}
            </div>
          ) : null}
        </div>
      </div>
      {showChatWindow ? <WatchLiveChat className={chatClass} video={video} currentTime={currentTime} modelValue={{ showTlChat: showTL, showYtChat: showLiveChat && hasLiveChat }} onTimeJump={seekTo} onVideoUpdate={(update) => {
        if (!update?.status || !update?.start_actual) return;
        setVideo((value) => ({
          ...value,
          live_viewers: update.live_viewers,
          status: update.status,
          start_actual: typeof update.start_actual === "string" ? update.start_actual : value.start_actual,
        }));
      }} /> : null}
      <Dialog open={showUpload} onOpenChange={(open) => app.setUploadPanel(open)}>
        <DialogContent className="max-h-[500px] max-w-[80%] p-0">
          <UploadScript videoData={video} onClose={() => app.setUploadPanel(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
