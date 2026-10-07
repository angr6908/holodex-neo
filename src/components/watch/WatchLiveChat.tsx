"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArchiveTranslations } from "@/components/chat/ArchiveTranslations";
import { LiveTranslations } from "@/components/chat/LiveTranslations";
import { Card, CardContent } from "@/components/ui/card";
import { replayTimedContinuation } from "@/lib/chat";
import { CHAT_EMBED_SANDBOX } from "@/lib/consts";
import { useIsClient } from "@/lib/hooks";
import { useAppState } from "@/lib/store";
import { cn } from "@/lib/utils";

// Members-only archives show TLs only once the player has a position (i.e. the viewer has access).
function canShowArchiveTl(video: Record<string, any> | null | undefined, currentTime: number) {
  return video?.topic_id !== "membersonly" || currentTime > 0;
}

// Live/upcoming streams get the live TL feed, archives the timed one, members-only archives a
// notice until playback starts.
function TranslationPane({
  video,
  currentTime,
  className,
  split,
  stickBottom,
  useLocalSubtitleToggle,
  onVideoUpdate,
  onTimeJump,
}: {
  video?: Record<string, any> | null;
  currentTime: number;
  className: string;
  /** Both chat panes are shown, so they split the height. */
  split: boolean;
  stickBottom: boolean;
  useLocalSubtitleToggle: boolean;
  onVideoUpdate?: (obj: any) => void;
  onTimeJump?: (time: number, a?: boolean, b?: boolean) => void;
}) {
  const t = useTranslations();
  const isLiveTLVideo = ["live", "upcoming"].includes(video?.status ?? "");
  if (video && isLiveTLVideo)
    return (
      <LiveTranslations
        video={video}
        className={className}
        currentTime={currentTime}
        useLocalSubtitleToggle={useLocalSubtitleToggle}
        onVideoUpdate={onVideoUpdate}
      />
    );
  if (video && canShowArchiveTl(video, currentTime))
    return (
      <ArchiveTranslations
        video={video}
        className={className}
        currentTime={currentTime}
        useLocalSubtitleToggle={useLocalSubtitleToggle}
        onTimeJump={onTimeJump}
      />
    );
  return (
    <Card
      className={cn(
        "box-border flex flex-col p-0 text-sm",
        split ? "min-h-0 flex-1 basis-0" : "min-h-0 flex-1",
      )}
    >
      <CardContent
        className={cn(
          "min-h-0 flex-1 overflow-auto px-0 text-base leading-normal",
          stickBottom && "order-2",
        )}
      >
        {t("views.watch.chat.membersOnlyTl")}
      </CardContent>
    </Card>
  );
}

// Archive chat replay needs the Holodex+ extension unless it has overridden the embed.
function needsChatExtension(isClient: boolean, video?: Record<string, any> | null) {
  return isClient && !(window as any).ARCHIVE_CHAT_OVERRIDE && video?.status === "past";
}

function ExtensionNotice() {
  const t = useTranslations();
  return (
    <div className="p-5 text-sm text-muted-foreground">
      {t("views.watch.chat.archiveNeedExtensionBefore")}{" "}
      <Link href="/extension" className="text-primary underline underline-offset-4">
        Holodex+
      </Link>{" "}
      {t("views.watch.chat.archiveNeedExtensionAfter")}
    </div>
  );
}

export function WatchLiveChat({
  video,
  currentTime = 0,
  modelValue,
  className = "",
  fluid = false,
  useLocalSubtitleToggle = false,
  onVideoUpdate,
  onTimeJump,
}: {
  video?: Record<string, any> | null;
  currentTime?: number;
  modelValue: { showTlChat: boolean; showYtChat: boolean };
  className?: string;
  fluid?: boolean;
  scale?: number;
  useLocalSubtitleToggle?: boolean;
  onVideoUpdate?: (obj: any) => void;
  onTimeJump?: (time: number, a?: boolean, b?: boolean) => void;
}) {
  const appStore = useAppState();
  const t = useTranslations();
  const ytChat = useRef<HTMLIFrameElement | null>(null);
  const [chatLoaded, setChatLoaded] = useState(false);
  // Browser-only flags (set by the extension) are read after hydration so the first client
  // render matches the server markup.
  const isClient = useIsClient();
  const needExtension = needsChatExtension(isClient, video);
  const showTlChat = modelValue.showTlChat;
  const showYtChat = modelValue.showYtChat;
  const liveChatUrl = useMemo(() => {
    if (!video || !isClient) return null;
    const query: Record<string, string> = {
      v: video.id,
      embed_domain: window.location.hostname,
      dark_theme: appStore.settings.darkMode ? "1" : "0",
      ...(video.status === "past" && { c: video.channel?.id }),
    };
    if (video.status === "past") {
      const cont =
        query.v && query.c && replayTimedContinuation({ videoId: query.v, channelId: query.c });
      if (cont) query.continuation = cont;
    }
    const q = new URLSearchParams(query).toString();
    if (video.status === "past") {
      if ((window as any).HOLODEX_PLUS_INSTALLED_V3)
        return `https://www.youtube.com/live_chat_replay?${q}`;
      return `https://www.youtube.com/redirect_replay_chat?${q}`;
    }
    return `https://www.youtube.com/live_chat?${q}`;
  }, [video, appStore.settings.darkMode, isClient]);
  const paneClass = showTlChat && showYtChat ? "min-h-0 flex-1 basis-0" : "min-h-0 flex-1";
  const tlPanelClass = cn(
    paneClass,
    appStore.settings.liveTlStickBottom && "order-2",
    !showYtChat && "pb-[env(safe-area-inset-bottom)]",
  );
  const embeddedChatClass = cn(
    "relative min-h-0 w-full [&>iframe]:absolute [&>iframe]:z-[3] [&>iframe]:h-full [&>iframe]:w-full",
    paneClass,
  );

  const postFrameTime = (t: number) =>
    ytChat.current?.contentWindow?.postMessage({ "yt-player-video-progress": t }, "*");
  const handleChatLoad = () => {
    setChatLoaded(true);
    if (video?.status === "past") postFrameTime(currentTime);
  };

  useEffect(() => {
    setChatLoaded(false);
  }, [showYtChat, liveChatUrl]);
  useEffect(() => {
    if (video?.status === "past") postFrameTime(currentTime);
  }, [currentTime, video?.status]);

  return (
    <div
      className={cn(
        "relative z-0 flex min-h-0 flex-col overflow-hidden rounded-[inherit] text-base",
        fluid && "h-full w-full min-w-0",
        className,
      )}
    >
      {showYtChat && !needExtension && !chatLoaded ? (
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          {t("views.watch.chat.loading")}
        </span>
      ) : null}
      {showTlChat ? (
        <TranslationPane
          video={video}
          currentTime={currentTime}
          className={tlPanelClass}
          split={showTlChat && showYtChat}
          stickBottom={appStore.settings.liveTlStickBottom}
          useLocalSubtitleToggle={useLocalSubtitleToggle}
          onVideoUpdate={onVideoUpdate}
          onTimeJump={onTimeJump}
        />
      ) : null}
      {showYtChat && !needExtension ? (
        <div className={embeddedChatClass}>
          <iframe
            ref={ytChat}
            src={liveChatUrl || ""}
            title={t("views.watch.chat.ytChatLabel")}
            sandbox={CHAT_EMBED_SANDBOX}
            frameBorder={0}
            onLoad={handleChatLoad}
          />
        </div>
      ) : null}
      {needExtension ? <ExtensionNotice /> : null}
    </div>
  );
}
