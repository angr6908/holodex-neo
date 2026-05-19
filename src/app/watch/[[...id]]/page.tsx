"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Maximize, ThumbsUp } from "@/lib/icons";
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

const empty = { channel: {}, id: null, title: "Loading...", description: "" };

export default function WatchPage() {
  const params = useParams<{ id?: string | string[] }>();
  const sp = useSearchParams();
  const router = useRouter();
  const app = useAppState();
  const t = useTranslations();
  const videoId = (Array.isArray(params.id) ? params.id[0] : params.id) || sp.get("v") || "";
  const [video, setVideo] = useState<Record<string, any>>(empty);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showTL, setShowTL] = useState(false);
  const [showLiveChat, setShowLiveChat] = useState(true);
  const [theater, setTheater] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [mobileChatHeight, setMobileChatHeight] = useState("65dvh");
  const [plIdx, setPlIdx] = useState(-1);
  const player = useRef<YoutubePlayerHandle | null>(null);
  const layout = useRef<HTMLDivElement | null>(null);
  const toolbarShell = useRef<HTMLDivElement | null>(null);
  const timeOffset = Number(sp.get("t") || 0) || 0;
  const title = (video.title && decodeHTMLEntities(video.title)) || "";
  const hasLiveChat = video.type === "stream" && (["upcoming", "live"].includes(video.status) || (video.status === "past" && !app.isMobile));
  const hasLiveTL = video.type === "stream";
  const showChat = (hasLiveChat && showLiveChat) || (showTL && hasLiveTL);
  const comments = video.comments || [];
  const hasComments = comments.length > 0;
  const isPlaylist = !!sp.get("playlist");
  const role = app.userdata?.user?.role;
  const isEditor = role === "admin" || role === "editor";
  const hasRelated = Boolean(video?.simulcasts?.length || video?.clips?.length || video?.sources?.length || video?.same_source_clips?.length || video?.recommendations?.length || video?.refers?.length);
  const showRail = Boolean(isEditor || isPlaylist);
  const hasExt = typeof window !== "undefined" && !!(window as any).HOLODEX_PLUS_INSTALLED;
  const showHighlights = !!(comments.length || video.songcount) && (!app.isMobile || !showTL);
  const likeLbl = t("views.watch.likeOnYoutube");
  const theaterLbl = t("views.watch.theaterMode");
  const tlLbl = showTL ? t("views.watch.chat.hideTLBtn") : t("views.watch.chat.showTLBtn");

  useEffect(() => {
    if (!videoId) { setHasError(true); setIsLoading(false); return; }
    let cancelled = false;
    window.scrollTo(0, 0);
    setVideo(empty);
    setShowTL(defaultWatchControlsState.showTL);
    setShowLiveChat(defaultWatchControlsState.showLiveChat);
    setTheater(defaultWatchControlsState.theaterMode);
    writeWatchControlsState(defaultWatchControlsState);
    setCurrentTime(0); setIsLoading(true); setHasError(false);
    api.video(videoId, app.settings.clipLangs.join(","), 1).then(({ data }: any) => {
      if (cancelled) return;
      setVideo(data); setIsLoading(false);
      document.title = (data.title && decodeHTMLEntities(data.title)) || "Holodex";
      addWatchedVideo(data);
    }).catch((e) => { console.error(e); if (!cancelled) { setHasError(true); setIsLoading(false); } });
    return () => { cancelled = true; };
  }, [videoId]);

  useEffect(() => { if (title) document.title = title; }, [title]);
  useEffect(() => { writeWatchControlsState({ showTL, showLiveChat, theaterMode: theater }); }, [showTL, showLiveChat, theater]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.altKey && e.key.toLowerCase() === "t") { e.preventDefault(); toggleTheater(); } };
    window.addEventListener("keyup", onKey);
    return () => window.removeEventListener("keyup", onKey);
  }, []);
  useEffect(() => {
    if (!app.isMobile || !showChat) return;

    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const toolbarBottom = toolbarShell.current?.getBoundingClientRect().bottom ?? 0;
        const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
        const next = `${Math.max(0, Math.floor(viewportHeight - toolbarBottom))}px`;
        setMobileChatHeight((current) => current === next ? current : next);
      });
    };

    update();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    if (toolbarShell.current) observer?.observe(toolbarShell.current);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [app.isMobile, showChat, showHighlights, video.id]);

  function seekTo(time: number) {
    if (!player.current) return;
    window.scrollTo(0, 0);
    player.current.seekTo(time);
    player.current.playVideo();
  }

  function toggleTheater() {
    setTheater((v) => !v);
    requestAnimationFrame(() => { if (layout.current) layout.current.scrollTop = 0; });
  }

  function handleVideoUpdate(u: any) {
    if (!u?.status || !u?.start_actual) return;

    setVideo((v) => ({
      ...v,
      live_viewers: u.live_viewers,
      status: u.status,
      start_actual: typeof u.start_actual === "string" ? u.start_actual : v.start_actual,
    }));
  }

  const cinema = theater && !app.isMobile;
  const pageClass = cn(
    "relative z-0 box-border flex min-h-screen w-full overflow-x-clip",
    "min-[960px]:items-start min-[960px]:gap-[clamp(12px,1.6vw,20px)] min-[960px]:px-[clamp(12px,1.8vw,24px)] min-[960px]:pt-[calc(var(--nav-header-height,0px)+0.5rem)] min-[960px]:pb-[clamp(1.5rem,3vw,3rem)]",
    "max-[959px]:flex-col max-[959px]:pt-[calc(var(--nav-header-height,0px)+0.5rem)]",
    showChat && !app.isMobile && (cinema ? "min-[960px]:pr-[calc(clamp(320px,24vw,360px)+clamp(12px,1.8vw,24px))]" : "min-[960px]:pr-[calc(clamp(320px,24vw,360px)+clamp(12px,1.6vw,20px)+clamp(12px,1.8vw,24px))]"),
  );
  const contentClass = cn("relative z-[1] flex w-full min-w-0 grow items-start overflow-visible", cinema ? "flex-col items-stretch" : "flex-row", "max-[959px]:flex-col");
  const mainClass = cn("flex min-w-0 flex-1 flex-col", cinema ? "w-full max-w-none" : "max-w-[min(100%,1080px)]", "max-[959px]:w-full");
  const groupClass = cn("contents", cinema && "block min-[960px]:mx-[calc(-1*clamp(12px,1.8vw,24px))]");
  const screenClass = cn("relative transition-colors", cinema && "-mt-[clamp(12px,1.8vw,24px)]");
  const playerClass = cn(
    "video relative aspect-video h-auto w-full overflow-hidden bg-background [&>div]:absolute [&>div]:inset-0 [&>div]:h-full [&>div]:w-full [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:h-full [&_iframe]:w-full",
    cinema && "mx-auto max-w-[calc((100dvh-5rem)*16/9)] shadow-2xl",
  );
  const toolbarShellClass = cn(cinema && "mx-auto w-full max-w-[calc((100dvh-5rem)*16/9)]");
  const sectionClass = "mt-[clamp(12px,1.4vw,18px)]";
  const chatClass = cn(
    "z-[1] w-full min-w-0",
    "min-[960px]:fixed min-[960px]:bottom-[clamp(12px,1.8vw,24px)] min-[960px]:right-[clamp(12px,1.8vw,24px)] min-[960px]:top-[calc(var(--nav-header-height,0px)+0.5rem)] min-[960px]:w-[clamp(320px,24vw,360px)] min-[960px]:overflow-hidden min-[960px]:rounded-xl",
    "max-[959px]:relative max-[959px]:mt-0 max-[959px]:h-[var(--watch-mobile-chat-height,65dvh)] max-[959px]:min-h-0 max-[959px]:overflow-hidden",
    cinema && "min-[960px]:bottom-0 min-[960px]:right-0 min-[960px]:top-[var(--nav-header-height,0px)] min-[960px]:rounded-none min-[960px]:border-l min-[960px]:border-border min-[960px]:bg-card",
  );
  const pageStyle = app.isMobile && showChat ? ({ "--watch-mobile-chat-height": mobileChatHeight } as CSSProperties) : undefined;
  const youtubeLikeButton = hasExt ? (
    <Tooltip>
      <TooltipTrigger render={<Button type="button" size="icon-sm" variant="ghost" aria-label={likeLbl} onClick={() => player.current?.sendLikeEvent()} />}>
        <ThumbsUp className="size-4" />
      </TooltipTrigger>
      <TooltipContent>{likeLbl}</TooltipContent>
    </Tooltip>
  ) : null;
  const chatPanel = showChat ? (
    <WatchLiveChat
      className={chatClass}
      video={video}
      currentTime={currentTime}
      modelValue={{ showTlChat: showTL, showYtChat: showLiveChat && hasLiveChat }}
      onTimeJump={seekTo}
      onVideoUpdate={handleVideoUpdate}
    />
  ) : null;

  if (isLoading || hasError) return (
    <div className="flex min-h-[calc(100vh-65px)] w-full items-start justify-center px-4 pt-[calc(var(--nav-header-height,0px)+1rem)] min-[960px]:px-[clamp(12px,1.8vw,24px)] min-[960px]:pt-[calc(var(--nav-header-height,0px)+1.5rem)]">
      {isLoading && !hasError ? <Card className="inline-flex flex-row items-center gap-3 rounded-lg px-4 py-3"><Spinner /></Card> : null}
      {hasError ? <ApiErrorMessage /> : null}
    </div>
  );
  return (
    <div className={pageClass} style={pageStyle}>
      <div ref={layout} className={contentClass}>
        <div className={mainClass}>
          <div className={groupClass}>
            <div className={screenClass}>
              <div className="relative">
                {video.id ? <YoutubePlayer ref={player} className={playerClass} videoId={video.id} start={timeOffset} autoplay lang={getYTLangFromState({ settings: { lang: app.settings.lang } })} onReady={(p) => { player.current = p; }} onCurrentTime={setCurrentTime} onEnded={() => { if (plIdx >= 0) setPlIdx((v) => v + 1); }} /> : null}
                <div id={`overlay-${video.id}`} className="text-[max(1.5vw,16px)]" />
              </div>
            </div>
            {showHighlights ? <WatchHighlights key="highlights" comments={comments} video={video} limit={app.isMobile ? 8 : 0} onTimeJump={seekTo} /> : null}
            <div ref={toolbarShell} className={toolbarShellClass}>
              <WatchToolbar video={video}>
                {!app.isMobile ? <Tooltip><TooltipTrigger render={<Toggle pressed={theater} aria-label={theaterLbl} onPressedChange={() => toggleTheater()} />}><Maximize className="size-5" /></TooltipTrigger><TooltipContent>{theaterLbl}</TooltipContent></Tooltip> : null}
                {hasLiveTL ? <Tooltip><TooltipTrigger render={<Toggle pressed={showTL} aria-label={tlLbl} onPressedChange={setShowTL} />}><icons.TlChatIcon className="size-5" /></TooltipTrigger><TooltipContent>{tlLbl}</TooltipContent></Tooltip> : null}
                {hasLiveChat ? <Toggle pressed={showLiveChat} aria-label={t("views.watch.chat.ytChatLabel")} onPressedChange={setShowLiveChat}><icons.YtChatIcon className="size-5" /></Toggle> : null}
              </WatchToolbar>
            </div>
          </div>
          {app.isMobile ? chatPanel : null}
          {app.isMobile && hasComments ? <WatchComments key="comments-mobile" comments={comments} video={video} limit={5} onTimeJump={seekTo} /> : null}
          {video?.songcount ? <WatchSideBar key="songs" video={video} className={sectionClass} showSongs showRelations={false} onTimeJump={seekTo} /> : null}
          <WatchInfo
            key="info"
            video={video}
            onTimeJump={seekTo}
            actions={youtubeLikeButton}
          />
          {!app.isMobile && hasComments ? <WatchComments key="comments" comments={comments} video={video} limit={0} onTimeJump={seekTo} /> : null}
          {hasRelated ? <WatchSideBar key="related" video={video} className={sectionClass} showSongs={false} showRelations onTimeJump={seekTo} /> : null}
          {showRail ? <div className={cn(sectionClass, "flex flex-col gap-4")}>
            {isEditor ? <WatchQuickEditor video={video} /> : null}
            {isPlaylist ? <WatchPlaylist value={plIdx} video={video} onInput={setPlIdx} onPlayNext={({ video: next }) => { const pl = sp.get("playlist"); if (next?.id) router.push(`/watch/${next.id}${pl ? `?playlist=${pl}` : ""}`); }} /> : null}
          </div> : null}
        </div>
      </div>
      {!app.isMobile ? chatPanel : null}
      <Dialog open={app.uploadPanel} onOpenChange={app.setUploadPanel}>
        <DialogContent className="max-h-[500px] max-w-[80%] p-0">
          <UploadScript videoData={video} onClose={() => app.setUploadPanel(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
