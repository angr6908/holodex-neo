"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useEffect } from "react";
import { useAppState } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { replayTimedContinuation } from "@/lib/chat";
import { Card } from "@/components/ui/Card";
import { LiveTranslations } from "@/components/chat/LiveTranslations";
import { ArchiveTranslations } from "@/components/chat/ArchiveTranslations";

export function WatchLiveChat({ video, currentTime = 0, modelValue, className = "", fluid = false, scale = 1, useLocalSubtitleToggle = false, onVideoUpdate, onTimeJump }: { video?: Record<string, any> | null; currentTime?: number; modelValue: { showTlChat: boolean; showYtChat: boolean }; className?: string; fluid?: boolean; scale?: number; useLocalSubtitleToggle?: boolean; onVideoUpdate?: (obj: any) => void; onTimeJump?: (time: number, a?: boolean, b?: boolean) => void }) {
  const appStore = useAppState();
  const { t } = useI18n();
  const ytChat = useRef<HTMLIFrameElement | null>(null);
  const [chatLoaded, setChatLoaded] = useState(false);
  const needExtension = typeof window !== "undefined" && !(window as any).ARCHIVE_CHAT_OVERRIDE && video?.status === "past";
  const canShowTLChat = (video?.topic_id === "membersonly" && currentTime > 0) || (video?.topic_id !== "membersonly");
  const isLiveTLVideo = ["live", "upcoming"].includes(video?.status ?? "");
  const showTlChat = modelValue.showTlChat;
  const showYtChat = modelValue.showYtChat;
  const liveChatUrl = useMemo(() => {
    if (!video || typeof window === "undefined") return null;
    const query: Record<string, string> = { v: video.id, embed_domain: window.location.hostname, dark_theme: appStore.settings.darkMode ? "1" : "0", ...(video.status === "past" && { c: video.channel?.id }) };
    if (video.status === "past") {
      const cont = query.v && query.c && replayTimedContinuation({ videoId: query.v, channelId: query.c });
      if (cont) query.continuation = cont;
    }
    const q = new URLSearchParams(query).toString();
    if (video.status === "past") {
      if ((window as any).HOLODEX_PLUS_INSTALLED_V3) return `https://www.youtube.com/live_chat_replay?${q}`;
      return `https://www.youtube.com/redirect_replay_chat?${q}`;
    }
    return `https://www.youtube.com/live_chat?${q}`;
  }, [video, appStore.settings.darkMode]);
  const scaledStyle = useMemo(() => scale !== 1 ? { transform: `scale(${scale})`, height: `${100 / scale}%`, width: `${100 / scale}%`, transformOrigin: "top left" } : {}, [scale]);
  const ytChatHeight = appStore.settings.liveTlWindowSize > 0 && showTlChat ? `${100 - appStore.settings.liveTlWindowSize}%` : "";
  const tlChatHeight = showYtChat && appStore.settings.liveTlWindowSize > 0 ? `${appStore.settings.liveTlWindowSize}%` : "";

  const postFrameTime = (t: number) => ytChat.current?.contentWindow?.postMessage({ "yt-player-video-progress": t }, "*");
  const handleChatLoad = () => { setChatLoaded(true); if (video?.status === "past") postFrameTime(currentTime); };

  useEffect(() => { setChatLoaded(false); }, [showYtChat, liveChatUrl]);
  useEffect(() => { if (video?.status === "past") postFrameTime(currentTime); }, [currentTime, video?.status]);

  return (
    <div className={`watch-live-chat ${showTlChat ? "show-tl-overlay" : ""} ${fluid ? "fluid" : ""} ${appStore.isMobile ? "mobile-live-chat" : ""} ${className}`}>
      {showYtChat && !needExtension && !chatLoaded ? <span className="loading-text">{t("views.watch.chat.loading")}</span> : null}
      {showTlChat && video && isLiveTLVideo ? (
        <LiveTranslations
          video={video}
          className={`${appStore.settings.liveTlStickBottom ? "stick-bottom" : ""} ${!showYtChat ? "tl-full-height" : ""}`}
          style={{ height: tlChatHeight }}
          currentTime={currentTime}
          useLocalSubtitleToggle={useLocalSubtitleToggle}
          onVideoUpdate={onVideoUpdate}
        />
      ) : canShowTLChat && showTlChat && video ? (
        <ArchiveTranslations
          video={video}
          className={`${appStore.settings.liveTlStickBottom ? "stick-bottom" : ""} ${!showYtChat ? "tl-full-height" : ""}`}
          style={{ height: tlChatHeight }}
          currentTime={currentTime}
          useLocalSubtitleToggle={useLocalSubtitleToggle}
          onTimeJump={onTimeJump}
        />
      ) : showTlChat ? (
        <Card className="tl-overlay border-0 bg-slate-950/90 p-0 text-sm text-slate-200 shadow-none">
          <div className={`tl-body ${appStore.settings.liveTlStickBottom ? "stick-bottom" : ""} ${!showYtChat ? "tl-full-height" : ""}`} style={{ height: tlChatHeight }}>
            This video is members only, please play the video to see TLdex and translations.
          </div>
        </Card>
      ) : null}
      {showYtChat && !needExtension ? (
        <div className="embedded-chat" style={{ height: ytChatHeight }}>
          <iframe ref={ytChat} src={liveChatUrl || ""} frameBorder={0} style={scaledStyle} onLoad={handleChatLoad} />
        </div>
      ) : null}
      {needExtension ? (
        <div className="p-5 text-sm text-slate-300">
          Archive chat does not work without the <Link href="/extension" className="text-sky-300 hover:text-sky-200">Holodex+</Link> extension or other third party extensions.
        </div>
      ) : null}
    </div>
  );
}
