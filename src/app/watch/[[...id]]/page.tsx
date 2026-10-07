"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  type CSSProperties,
  Suspense,
  startTransition,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { ApiErrorMessage } from "@/components/common/ApiErrorMessage";
import { TwitchPlayer } from "@/components/player/TwitchPlayer";
import { YoutubePlayer, type YoutubePlayerHandle } from "@/components/player/YoutubePlayer";
import { UploadScript } from "@/components/tl/UploadScript";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TwitchChat } from "@/components/watch/TwitchChat";
import { WatchComments } from "@/components/watch/WatchComments";
import { WatchHighlights } from "@/components/watch/WatchHighlights";
import { WatchInfo } from "@/components/watch/WatchInfo";
import { WatchLiveChat } from "@/components/watch/WatchLiveChat";
import { WatchPlaylist } from "@/components/watch/WatchPlaylist";
import { WatchQuickEditor } from "@/components/watch/WatchQuickEditor";
import { WatchSideBar } from "@/components/watch/WatchSideBar";
import { WatchToolbar } from "@/components/watch/WatchToolbar";
import { api } from "@/lib/api";
import { addWatchedVideo, defaultWatchControlsState, writeWatchControlsState } from "@/lib/browser";
import { decodeHTMLEntities, getYTLangFromState } from "@/lib/functions";
import { useIsClient } from "@/lib/hooks";
import * as icons from "@/lib/icons";
import { Maximize, ThumbsUp } from "@/lib/icons";
import { useAppState } from "@/lib/store";
import { useWatchPlaylist } from "@/lib/watch-playlist";
import { loadWatchVideo, readWatchSeed } from "@/lib/watch-preload";
import { fetchTwitchViewerCounts, twitchLoginOf } from "@/lib/twitch-viewers";
import { cn } from "@/lib/utils";
import { loadYoutubeIframeApi } from "@/lib/youtube-iframe-api";
import { fetchYoutubeViewerCounts } from "@/lib/youtube-viewers";

const empty = { channel: {}, id: null, title: "Loading...", description: "" };

export default function WatchPage() {
  return (
    <Suspense fallback={null}>
      <Watch />
    </Suspense>
  );
}

// Twitch streams reach the watch page as placeholders with a twitch.tv link (or type
// "twitch"); they play in the Twitch embed instead of the YouTube player.
function watchChatFlags(
  video: Record<string, any>,
  isMobile: boolean,
  { showTL, showLiveChat }: { showTL: boolean; showLiveChat: boolean },
) {
  const twitchChannel =
    video.type === "twitch" || video.link?.includes?.("twitch") ? twitchLoginOf(video) : "";
  const hasLiveChat =
    video.type === "stream" &&
    (["upcoming", "live"].includes(video.status) || (video.status === "past" && !isMobile));
  const hasTwitchChat = !!twitchChannel && video.status === "live";
  const hasLiveTL = video.type === "stream";
  return {
    twitchChannel,
    hasChat: hasLiveChat || hasTwitchChat,
    hasTwitchChat,
    hasLiveTL,
    showChat: ((hasLiveChat || hasTwitchChat) && showLiveChat) || (showTL && hasLiveTL),
    showYtChat: showLiveChat && hasLiveChat,
  };
}

function watchVideoId(id: string | string[] | undefined, sp: URLSearchParams) {
  return (Array.isArray(id) ? id[0] : id) || sp.get("v") || "";
}

function videoTitle(video: Record<string, any>) {
  return (video.title && decodeHTMLEntities(video.title)) || "";
}

// Song and comment highlights sit under the player; on mobile the TL panel replaces them.
function showsHighlights(video: Record<string, any>, isMobile: boolean, showTL: boolean) {
  return !!(video.comments?.length || video.songcount) && (!isMobile || !showTL);
}

function isEditorRole(role: string | undefined) {
  return role === "admin" || role === "editor";
}

// Twitch placeholders take their description and category from Twitch (see useTwitchInfo).
function twitchInfoProps(
  twitchChannel: string,
  twitchInfo: { category: string; description: string } | null,
) {
  if (!twitchChannel) return { description: undefined, twitchMeta: undefined };
  return {
    description: twitchInfo?.description ?? "",
    twitchMeta: { category: twitchInfo?.category ?? "" },
  };
}

function hasRelatedVideos(video: Record<string, any>) {
  return Boolean(
    video?.simulcasts?.length ||
      video?.clips?.length ||
      video?.sources?.length ||
      video?.same_source_clips?.length ||
      video?.recommendations?.length ||
      video?.refers?.length,
  );
}

// Layout classes for the default and theater ("cinema") modes; on desktop the chat is a fixed
// column on the right that the page pads around.
function watchLayoutClasses(theater: boolean, showChat: boolean, isMobile: boolean) {
  const cinema = theater && !isMobile;
  const desktopChat = showChat && !isMobile;
  return {
    pageClass: cn(
      "relative z-0 box-border flex min-h-screen w-full overflow-x-clip",
      "min-[960px]:items-start min-[960px]:gap-[clamp(12px,1.6vw,20px)] min-[960px]:px-[clamp(12px,1.8vw,24px)] min-[960px]:pt-[calc(var(--nav-header-height,0px)+0.5rem)] min-[960px]:pb-[clamp(1.5rem,3vw,3rem)]",
      "max-[959px]:flex-col max-[959px]:pt-[calc(var(--nav-header-height,0px)+0.5rem)]",
      desktopChat &&
        (cinema
          ? "min-[960px]:pr-[calc(clamp(320px,24vw,360px)+clamp(12px,1.8vw,24px))]"
          : "min-[960px]:pr-[calc(clamp(320px,24vw,360px)+clamp(12px,1.6vw,20px)+clamp(12px,1.8vw,24px))]"),
    ),
    contentClass: cn(
      "relative z-[1] flex w-full min-w-0 grow items-start overflow-visible",
      cinema ? "flex-col items-stretch" : "flex-row",
      "max-[959px]:flex-col",
    ),
    mainClass: cn(
      "flex min-w-0 flex-1 flex-col",
      cinema ? "w-full max-w-none" : "max-w-[min(100%,1080px)]",
      "max-[959px]:w-full",
    ),
    groupClass: cn("contents", cinema && "block min-[960px]:mx-[calc(-1*clamp(12px,1.8vw,24px))]"),
    screenClass: cn("relative transition-colors", cinema && "-mt-[4px]"),
    playerClass: cn(
      "relative aspect-video h-auto w-full overflow-hidden bg-background [&>div]:absolute [&>div]:inset-0 [&>div]:h-full [&>div]:w-full [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:h-full [&_iframe]:w-full",
      cinema && "mx-auto max-w-[calc((100dvh-5rem)*16/9)] shadow-2xl",
    ),
    toolbarShellClass: cn(cinema && "mx-auto w-full max-w-[calc((100dvh-5rem)*16/9)]"),
    chatClass: cn(
      "z-[1] w-full min-w-0",
      "min-[960px]:fixed min-[960px]:bottom-[clamp(12px,1.8vw,24px)] min-[960px]:right-[clamp(12px,1.8vw,24px)] min-[960px]:top-[calc(var(--nav-header-height,0px)+0.5rem)] min-[960px]:w-[clamp(320px,24vw,360px)] min-[960px]:overflow-hidden min-[960px]:rounded-xl",
      "max-[959px]:relative max-[959px]:mt-0 max-[959px]:h-[var(--watch-mobile-chat-height,65dvh)] max-[959px]:min-h-0 max-[959px]:overflow-hidden",
      cinema &&
        "min-[960px]:bottom-0 min-[960px]:right-0 min-[960px]:top-[var(--nav-header-height,0px)] min-[960px]:rounded-none min-[960px]:border-l min-[960px]:border-border min-[960px]:bg-card",
    ),
  };
}

// Shared vertical stack for the SectionPanel panels; px-4 matches WatchInfo's gutter so the
// panels align with the description card.
const stackClass = "flex flex-col gap-3 px-4";

// Twitch streams reach us as placeholders whose Holodex `description` is auto-generated bot
// junk. Pull the real description (channel bio + current title/category) from Twitch instead.
function useTwitchInfo(twitchChannel: string) {
  const [twitchInfo, setTwitchInfo] = useState<{
    title: string;
    category: string;
    description: string;
  } | null>(null);
  useEffect(() => {
    if (!twitchChannel) {
      setTwitchInfo(null);
      return;
    }
    let cancelled = false;
    setTwitchInfo(null);
    api
      .twitchStreamInfo(twitchChannel)
      .then((info) => {
        if (cancelled || !info) return;
        setTwitchInfo({
          title: info.title || "",
          category: info.category || "",
          description: info.description || "",
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [twitchChannel]);
  return twitchInfo;
}

// Alt+T toggles theater mode.
function useTheaterShortcut(toggle: () => void) {
  const onToggle = useEffectEvent(toggle);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        onToggle();
      }
    };
    window.addEventListener("keyup", onKey);
    return () => window.removeEventListener("keyup", onKey);
  }, []);
}

// On mobile the chat fills the viewport below the toolbar; track that height as the viewport,
// the on-screen keyboard and the content above change.
// `showHighlights` and `videoId` change the content above the chat, so they re-measure too.
function useMobileChatHeight(
  enabled: boolean,
  toolbarShell: React.RefObject<HTMLDivElement | null>,
  showHighlights: boolean,
  videoId: string | null,
) {
  const [mobileChatHeight, setMobileChatHeight] = useState("65dvh");
  useEffect(() => {
    if (!enabled) return;

    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const toolbarBottom = toolbarShell.current?.getBoundingClientRect().bottom ?? 0;
        const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
        const next = `${Math.max(0, Math.floor(viewportHeight - toolbarBottom))}px`;
        setMobileChatHeight((current) => (current === next ? current : next));
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
  }, [enabled, toolbarShell, showHighlights, videoId]);
  return mobileChatHeight;
}

function WatchStatus({ isLoading, hasError }: { isLoading: boolean; hasError: boolean }) {
  return (
    <div className="flex min-h-[calc(100vh-65px)] w-full items-start justify-center px-4 pt-[calc(var(--nav-header-height,0px)+1rem)] min-[960px]:px-[clamp(12px,1.8vw,24px)] min-[960px]:pt-[calc(var(--nav-header-height,0px)+1.5rem)]">
      {isLoading && !hasError ? (
        <Card className="inline-flex flex-row items-center gap-3 rounded-lg px-4 py-3">
          <Spinner />
        </Card>
      ) : null}
      {hasError ? <ApiErrorMessage /> : null}
    </div>
  );
}

// Liking from the page needs the Holodex Plus extension.
function LikeOnYoutubeButton({ onLike }: { onLike: () => void }) {
  const t = useTranslations();
  const isClient = useIsClient();
  const likeLbl = t("views.watch.likeOnYoutube");
  if (!(isClient && (window as any).HOLODEX_PLUS_INSTALLED)) return null;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={likeLbl}
            onClick={onLike}
          />
        }
      >
        <ThumbsUp className="size-4" />
      </TooltipTrigger>
      <TooltipContent>{likeLbl}</TooltipContent>
    </Tooltip>
  );
}

// Theater mode (desktop), TL panel and live chat toggles for the toolbar.
function WatchToggles({
  isMobile,
  theater,
  onTheater,
  hasLiveTL,
  showTL,
  onShowTL,
  hasChat,
  isTwitchChat,
  showLiveChat,
  onShowLiveChat,
}: {
  isMobile: boolean;
  theater: boolean;
  onTheater: () => void;
  hasLiveTL: boolean;
  showTL: boolean;
  onShowTL: (value: boolean) => void;
  hasChat: boolean;
  isTwitchChat: boolean;
  showLiveChat: boolean;
  onShowLiveChat: (value: boolean) => void;
}) {
  const t = useTranslations();
  const theaterLbl = t("views.watch.theaterMode");
  const tlLbl = showTL ? t("views.watch.chat.hideTLBtn") : t("views.watch.chat.showTLBtn");
  return (
    <>
      {!isMobile ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Toggle
                pressed={theater}
                aria-label={theaterLbl}
                onPressedChange={() => onTheater()}
              />
            }
          >
            <Maximize className="size-5" />
          </TooltipTrigger>
          <TooltipContent>{theaterLbl}</TooltipContent>
        </Tooltip>
      ) : null}
      {hasLiveTL ? (
        <Tooltip>
          <TooltipTrigger
            render={<Toggle pressed={showTL} aria-label={tlLbl} onPressedChange={onShowTL} />}
          >
            <icons.TlChatIcon className="size-5" />
          </TooltipTrigger>
          <TooltipContent>{tlLbl}</TooltipContent>
        </Tooltip>
      ) : null}
      {hasChat ? (
        <Toggle
          pressed={showLiveChat}
          aria-label={t("views.watch.chat.ytChatLabel")}
          onPressedChange={onShowLiveChat}
        >
          {isTwitchChat ? (
            <icons.MessageSquareText className="size-5" />
          ) : (
            <icons.YtChatIcon className="size-5" />
          )}
        </Toggle>
      ) : null}
    </>
  );
}

// Songs, comments (desktop), related videos, the editor panel and the playlist under the info.
function WatchDetails({
  video,
  comments,
  isMobile,
  isEditor,
  playlist,
  onTimeJump,
  onPlaylistNext,
}: {
  video: Record<string, any>;
  comments: any[];
  isMobile: boolean;
  isEditor: boolean;
  playlist: ReturnType<typeof useWatchPlaylist> | null;
  onTimeJump: (time: number) => void;
  onPlaylistNext: () => void;
}) {
  const hasComments = comments.length > 0;
  const hasRelated = hasRelatedVideos(video);
  const showRail = Boolean(isEditor || playlist);
  if (!(video?.songcount || (!isMobile && hasComments) || hasRelated || showRail)) return null;
  return (
    <div className={cn(stackClass, "pb-4")}>
      {video?.songcount ? (
        <WatchSideBar
          key="songs"
          video={video}
          showSongs
          showRelations={false}
          onTimeJump={onTimeJump}
        />
      ) : null}
      {!isMobile && hasComments ? (
        <WatchComments
          key="comments"
          comments={comments}
          video={video}
          limit={0}
          onTimeJump={onTimeJump}
        />
      ) : null}
      {hasRelated ? (
        <WatchSideBar
          key="related"
          video={video}
          showSongs={false}
          showRelations
          onTimeJump={onTimeJump}
        />
      ) : null}
      {isEditor ? <WatchQuickEditor video={video} /> : null}
      {playlist ? (
        <WatchPlaylist
          playlist={playlist.playlist}
          hasError={playlist.hasError}
          currentIndex={playlist.currentIndex}
          onNext={onPlaylistNext}
        />
      ) : null}
    </div>
  );
}

// Loads the video on navigation, resetting the page's controls, prefetching the live viewer
// counts and recording the visit. A video opened from a card renders from the card's data right
// away (see watch-preload) and `hasDetails` turns on once the full video has loaded.
function useWatchVideo(videoId: string, clipLangsParam: () => string, resetControls: () => void) {
  const [video, setVideo] = useState<Record<string, any>>(() => readWatchSeed(videoId) ?? empty);
  const [isLoading, setIsLoading] = useState(() => !readWatchSeed(videoId));
  const [hasDetails, setHasDetails] = useState(false);
  const [hasError, setHasError] = useState(false);
  const onReset = useEffectEvent(resetControls);
  const langs = useEffectEvent(clipLangsParam);
  useEffect(() => {
    if (!videoId) {
      setHasError(true);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    window.scrollTo(0, 0);
    const seed = readWatchSeed(videoId);
    setVideo(seed ?? empty);
    onReset();
    setIsLoading(!seed);
    setHasDetails(false);
    setHasError(false);

    // Start the direct live-viewer lookups alongside the video metadata request so the toolbar
    // badge doesn't pop in one request later than the rest of the page. The shared viewer
    // clients deduplicate these with LiveViewers' own refresh. Without card data, an id that
    // looks like YouTube's also starts loading the player API.
    const twitchLogin = seed ? twitchLoginOf(seed) : "";
    if (/^[\w-]{11}$/.test(videoId) && !twitchLogin && (!seed || seed.status === "live"))
      void fetchYoutubeViewerCounts([videoId]);
    if (twitchLogin && seed?.status === "live") void fetchTwitchViewerCounts([twitchLogin]);
    if (!seed && /^[\w-]{11}$/.test(videoId)) void loadYoutubeIframeApi().catch(() => {});

    loadWatchVideo(videoId, langs())
      .then((data) => {
        if (cancelled) return;
        // Without card data, the Twitch login is only known from the fetched video metadata.
        const login = twitchLoginOf(data);
        if (data.status === "live" && login) void fetchTwitchViewerCounts([login]);

        // The details are mostly below the player, so render them without blocking the
        // main thread the player's iframe may share.
        startTransition(() => {
          setVideo(data);
          setIsLoading(false);
          setHasDetails(true);
        });
        document.title = videoTitle(data) || "Holodex";
        addWatchedVideo(data);
      })
      .catch((e) => {
        console.error(e);
        // A page rendered from card data keeps its player; only the details are missing.
        if (!cancelled && !seed) {
          setHasError(true);
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [videoId]);
  return { video, setVideo, isLoading, hasDetails, hasError };
}

// The Twitch embed for Twitch streams, otherwise the YouTube player, plus the overlay target.
function WatchPlayer({
  video,
  twitchChannel,
  className,
  player,
  onCurrentTime,
  onEnded,
}: {
  video: Record<string, any>;
  twitchChannel: string;
  className: string;
  player: React.RefObject<YoutubePlayerHandle | null>;
  onCurrentTime: (time: number) => void;
  onEnded: () => void;
}) {
  const sp = useSearchParams();
  const app = useAppState();
  const timeOffset = Number(sp.get("t") || 0) || 0;
  return (
    <div className="relative">
      {video.id && twitchChannel ? (
        <TwitchPlayer
          key={twitchChannel}
          channel={twitchChannel}
          className={className}
          onEnded={onEnded}
        />
      ) : null}
      {video.id && !twitchChannel ? (
        <YoutubePlayer
          ref={player}
          className={className}
          videoId={video.id}
          start={timeOffset}
          autoplay
          lang={getYTLangFromState({ settings: { lang: app.settings.lang } })}
          onReady={(p) => {
            player.current = p;
          }}
          onCurrentTime={onCurrentTime}
          onEnded={onEnded}
        />
      ) : null}
      <div id={`overlay-${video.id}`} className="text-[max(1.5vw,16px)]" />
    </div>
  );
}

// Twitch chat for live Twitch streams, otherwise the YouTube chat and/or the TL panel.
function WatchChatPanel({
  className,
  twitchChannel,
  video,
  currentTime,
  showTL,
  showYtChat,
  onTimeJump,
  onVideoUpdate,
}: {
  className: string;
  twitchChannel: string | null;
  video: Record<string, any>;
  currentTime: number;
  showTL: boolean;
  showYtChat: boolean;
  onTimeJump: (time: number) => void;
  onVideoUpdate: (update: any) => void;
}) {
  if (twitchChannel) return <TwitchChat channel={twitchChannel} className={className} />;
  return (
    <WatchLiveChat
      className={className}
      video={video}
      currentTime={currentTime}
      modelValue={{ showTlChat: showTL, showYtChat }}
      onTimeJump={onTimeJump}
      onVideoUpdate={onVideoUpdate}
    />
  );
}

// On mobile the first few comments follow the chat; desktop shows them all under the info.
function WatchMobileComments({
  video,
  comments,
  onTimeJump,
}: {
  video: Record<string, any>;
  comments: any[];
  onTimeJump: (time: number) => void;
}) {
  if (comments.length === 0) return null;
  return (
    <div className={cn(stackClass, "mt-3")}>
      <WatchComments
        key="comments-mobile"
        comments={comments}
        video={video}
        limit={5}
        onTimeJump={onTimeJump}
      />
    </div>
  );
}

function Watch() {
  const params = useParams<{ id?: string | string[] }>();
  const sp = useSearchParams();
  const router = useRouter();
  const app = useAppState();
  const videoId = watchVideoId(params.id, sp);
  const [showTL, setShowTL] = useState(false);
  const [showLiveChat, setShowLiveChat] = useState(true);
  const [theater, setTheater] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  // Clip language preferences shape the request but changing them shouldn't reload the video.
  const { video, setVideo, isLoading, hasDetails, hasError } = useWatchVideo(
    videoId,
    () => app.settings.clipLangs.join(","),
    () => {
      setShowTL(defaultWatchControlsState.showTL);
      setShowLiveChat(defaultWatchControlsState.showLiveChat);
      setTheater(defaultWatchControlsState.theaterMode);
      writeWatchControlsState(defaultWatchControlsState);
      setCurrentTime(0);
    },
  );
  const player = useRef<YoutubePlayerHandle | null>(null);
  const layout = useRef<HTMLDivElement | null>(null);
  const toolbarShell = useRef<HTMLDivElement | null>(null);
  const title = videoTitle(video);
  const { twitchChannel, hasChat, hasTwitchChat, hasLiveTL, showChat, showYtChat } = watchChatFlags(
    video,
    app.isMobile,
    { showTL, showLiveChat },
  );
  const comments = video.comments || [];
  const playlistId = sp.get("playlist");
  const watchPlaylist = useWatchPlaylist(playlistId, video.id);
  const playVideo = (next: any) => {
    if (next?.id) router.push(`/watch/${next.id}${playlistId ? `?playlist=${playlistId}` : ""}`);
  };
  const playNextVideo = () => playVideo(watchPlaylist.videos[watchPlaylist.currentIndex + 1]);
  // Auto-advance only when the current video is part of the playlist.
  const playNextInPlaylist = () => {
    if (watchPlaylist.currentIndex >= 0) playNextVideo();
  };
  const showHighlights = hasDetails && showsHighlights(video, app.isMobile, showTL);

  useEffect(() => {
    if (title) document.title = title;
  }, [title]);
  const twitchInfo = useTwitchInfo(twitchChannel);
  useEffect(() => {
    writeWatchControlsState({ showTL, showLiveChat, theaterMode: theater });
  }, [showTL, showLiveChat, theater]);
  useTheaterShortcut(toggleTheater);
  const mobileChat = app.isMobile && showChat;
  const mobileChatHeight = useMobileChatHeight(mobileChat, toolbarShell, showHighlights, video.id);

  function seekTo(time: number) {
    if (!player.current) return;
    window.scrollTo(0, 0);
    player.current.seekTo(time);
    player.current.playVideo();
  }

  function toggleTheater() {
    setTheater((v) => !v);
    requestAnimationFrame(() => {
      if (layout.current) layout.current.scrollTop = 0;
    });
  }

  function handleVideoUpdate(u: any) {
    if (!u?.status || !u?.start_actual) return;

    setVideo((v) => ({
      ...v,
      status: u.status,
      start_actual: typeof u.start_actual === "string" ? u.start_actual : v.start_actual,
    }));
  }

  const {
    pageClass,
    contentClass,
    mainClass,
    groupClass,
    screenClass,
    playerClass,
    toolbarShellClass,
    chatClass,
  } = watchLayoutClasses(theater, showChat, app.isMobile);
  const chatPanel = showChat ? (
    <WatchChatPanel
      className={chatClass}
      twitchChannel={hasTwitchChat ? twitchChannel : null}
      video={video}
      currentTime={currentTime}
      showTL={showTL}
      showYtChat={showYtChat}
      onTimeJump={seekTo}
      onVideoUpdate={handleVideoUpdate}
    />
  ) : null;

  if (isLoading || hasError) return <WatchStatus isLoading={isLoading} hasError={hasError} />;
  return (
    <div
      className={pageClass}
      style={
        mobileChat
          ? ({ "--watch-mobile-chat-height": mobileChatHeight } as CSSProperties)
          : undefined
      }
    >
      <div ref={layout} className={contentClass}>
        <div className={mainClass}>
          <div className={groupClass}>
            <div className={screenClass}>
              <WatchPlayer
                video={video}
                twitchChannel={twitchChannel}
                className={playerClass}
                player={player}
                onCurrentTime={setCurrentTime}
                onEnded={playNextInPlaylist}
              />
            </div>
            {showHighlights ? (
              <WatchHighlights
                key="highlights"
                comments={comments}
                video={video}
                limit={app.isMobile ? 8 : 0}
                onTimeJump={seekTo}
              />
            ) : null}
            <div ref={toolbarShell} className={toolbarShellClass}>
              <WatchToolbar video={video}>
                <WatchToggles
                  isMobile={app.isMobile}
                  theater={theater}
                  onTheater={toggleTheater}
                  hasLiveTL={hasLiveTL}
                  showTL={showTL}
                  onShowTL={setShowTL}
                  hasChat={hasChat}
                  isTwitchChat={hasTwitchChat}
                  showLiveChat={showLiveChat}
                  onShowLiveChat={setShowLiveChat}
                />
              </WatchToolbar>
            </div>
          </div>
          {app.isMobile ? (
            <>
              {chatPanel}
              {hasDetails ? (
                <WatchMobileComments video={video} comments={comments} onTimeJump={seekTo} />
              ) : null}
            </>
          ) : null}
          <WatchInfo
            key="info"
            video={video}
            {...twitchInfoProps(twitchChannel, twitchInfo)}
            onTimeJump={seekTo}
            actions={<LikeOnYoutubeButton onLike={() => player.current?.sendLikeEvent()} />}
          />
          {hasDetails ? (
            <WatchDetails
              video={video}
              comments={comments}
              isMobile={app.isMobile}
              isEditor={isEditorRole(app.userdata?.user?.role)}
              playlist={playlistId ? watchPlaylist : null}
              onTimeJump={seekTo}
              onPlaylistNext={playNextVideo}
            />
          ) : null}
        </div>
      </div>
      {!app.isMobile ? chatPanel : null}
      <Dialog open={app.uploadPanel} onOpenChange={app.setUploadPanel}>
        <DialogContent className="max-h-[500px] max-w-[80%] p-0">
          <UploadScript
            key={video.id}
            videoData={video}
            onClose={() => app.setUploadPanel(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
