"use client";

import { createPortal } from "react-dom";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { mdiArrowExpand, mdiSubtitlesOutline } from "@mdi/js";
import { dayjs } from "@/lib/time";
import { api } from "@/lib/api";
import { useAppState } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { MessageRenderer, type MessageRendererHandle } from "@/components/chat/MessageRenderer";
import { WatchSubtitleOverlay } from "@/components/watch/WatchSubtitleOverlay";
import { LiveTranslationsSetting } from "@/components/chat/LiveTranslationsSetting";

const MESSAGE_TYPES = Object.freeze({
  END: "end",
  ERROR: "error",
  INFO: "info",
  MESSAGE: "message",
  UPDATE: "update",
});

export function LiveTranslations({
  video,
  currentTime = 0,
  useLocalSubtitleToggle = false,
  tlLang = "",
  tlClient = false,
  className = "",
  style,
  onVideoUpdate,
}: {
  video: Record<string, any>;
  currentTime?: number;
  useLocalSubtitleToggle?: boolean;
  tlLang?: string;
  tlClient?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onVideoUpdate?: (obj: any) => void;
}) {
  const { t } = useI18n();
  const appStore = useAppState();
  const [tlHistory, setTlHistory] = useState<any[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [liveTlLang, setLiveTlLang] = useState(tlLang || appStore.settings.liveTlLang);
  const [showSubtitle, setShowSubtitle] = useState(useLocalSubtitleToggle ? true : appStore.settings.liveTlShowSubtitle);
  const [overlayMessage, setOverlayMessage] = useState(t("views.watch.chat.loading"));
  const [showOverlay, setShowOverlay] = useState(false);
  const [forceCloseOverlay, setForceCloseOverlay] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const tlBody = useRef<MessageRendererHandle | null>(null);
  const expandedMsgId = `tl-expanded-${useId().replace(/:/g, "")}`;
  const limit = 20;

  const startTimeMillis = video?.available_at ? Number(dayjs(video.available_at)) : null;

  const blockedNames = useMemo(() => new Set(appStore.settings.liveTlBlocked || []), [appStore.settings.liveTlBlocked]);
  const filteredMessages = useMemo(() => tlHistory.filter((m: any) => !blockedNames.has(m.name)), [tlHistory, blockedNames]);
  const connected = true;
  const socketDisconnected = false;
  const [subtitleTarget, setSubtitleTarget] = useState<HTMLElement | null>(null);
  const toDisplay = useMemo(() => {
    if (!filteredMessages.length || !showSubtitle || tlClient) return [];
    const buffer = filteredMessages.slice(-2);
    if (!currentTime) return buffer;
    return buffer.filter((m: any) => {
      const displayTime = +m.duration || String(m.message || "").length * 65 + 1800;
      const receivedRelativeMs = m.receivedAt ? m.receivedAt - (startTimeMillis ?? 0) : m.relativeMs;
      const curRelativeMs = currentTime * 1000;
      return curRelativeMs >= receivedRelativeMs && curRelativeMs < receivedRelativeMs + displayTime;
    });
  }, [filteredMessages, showSubtitle, tlClient, currentTime, startTimeMillis]);

  useEffect(() => {
    if (tlLang) setLiveTlLang(tlLang);
  }, [tlLang]);

  useEffect(() => {
    if (typeof document === "undefined" || !video?.id) { setSubtitleTarget(null); return; }
    setSubtitleTarget(document.getElementById(`overlay-${video.id}`));
  }, [video?.id, expanded, showSubtitle]);

  useEffect(() => {
    if (!useLocalSubtitleToggle) setShowSubtitle(appStore.settings.liveTlShowSubtitle);
  }, [appStore.settings.liveTlShowSubtitle, useLocalSubtitleToggle]);

  useEffect(() => {
    tlBody.current?.scrollToBottom();
  }, [tlHistory]);

  function parseMessage(msg: any) {
    const next = { ...msg };
    next.timestamp = +next.timestamp;
    next.relativeMs = startTimeMillis ? next.timestamp - startTimeMillis : 0;
    next.key = next.name + next.timestamp + next.message;
    if (next.message?.includes?.("https://") && !next.parsed) {
      const regex = /(\S+)(https:\/\/(yt\d+\.ggpht\.com\/[a-zA-Z0-9_\-=/]+-c-k-nd|www\.youtube\.com\/[a-zA-Z0-9_\-=/]+\.svg))/gi;
      next.parsed = next.message
        .replace(/<([^>]*)>/g, "($1)")
        .replace(regex, '<img src="$2" />');
    }
    return next;
  }

  function loadMessages(firstLoad = false, loadAll = false, asTlClient = tlClient) {
    if (!video?.id) return;
    const isCustom = video.isCustom;
    setHistoryLoading(true);
    const lastTimestamp = !firstLoad && tlHistory[0]?.timestamp;
    const query: Record<string, unknown> = {
      lang: liveTlLang,
      verified: !asTlClient && appStore.settings.liveTlShowVerified,
      moderator: !asTlClient && appStore.settings.liveTlShowModerator,
      vtuber: !asTlClient && appStore.settings.liveTlShowVtuber,
      limit: loadAll ? 100000 : limit,
      ...(lastTimestamp && { before: lastTimestamp }),
      ...(isCustom && { custom_video_id: video.id }),
    };
    api.chatHistory(isCustom ? "custom" : video.id, query)
      .then(({ data }: { data: any[] }) => {
        setCompleted(data.length !== limit || loadAll);
        const parsed = data.map(parseMessage);
        setTlHistory((prev) => {
          const next = firstLoad ? parsed : [...parsed, ...prev];
          if (next.length) next[0] = { ...next[0], breakpoint: true };
          return next;
        });
      })
      .catch((e: unknown) => {
        console.error(e);
      })
      .finally(() => {
        setHistoryLoading(false);
        setIsLoading(false);
        setShowOverlay(false);
        setForceCloseOverlay(false);
      });
  }

  function refreshFallbackHistory() {
    loadMessages(true, false, tlClient);
    setShowOverlay(false);
    setForceCloseOverlay(false);
    setIsLoading(false);
  }

  function tlJoin() {
    if (video?.status && video.status !== "live" && !dayjs().isAfter(dayjs(video.start_scheduled).subtract(15, "minutes"))) {
      setOverlayMessage(t("views.watch.chat.status.notLive"));
      setIsLoading(false);
      setShowOverlay(true);
      return;
    }
    refreshFallbackHistory();
  }

  useEffect(() => {
    setIsLoading(true);
    setTlHistory([]);
    tlJoin();
    const id = setInterval(() => refreshFallbackHistory(), 15000);
    return () => clearInterval(id);
  }, [video?.id, video?.isCustom, liveTlLang, appStore.settings.liveTlShowVerified, appStore.settings.liveTlShowModerator, appStore.settings.liveTlShowVtuber]);

  function toggleSubtitle() {
    const next = !showSubtitle;
    setShowSubtitle(next);
    if (!useLocalSubtitleToggle) appStore.patchSettings({ liveTlShowSubtitle: next } as any);
  }

  return (
    <Card className={`tl-overlay relative w-full overflow-hidden border-0 bg-transparent p-0 text-sm shadow-none ${className}`} style={style}>
      {showOverlay || (!forceCloseOverlay && socketDisconnected) ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-slate-950/90 px-4 text-center backdrop-blur-sm">
          {isLoading ? (
            <div className="text-sm text-slate-300">
              {t("views.watch.chat.loading")}
            </div>
          ) : (
            <>
              <div className="text-sm text-slate-400">
                {overlayMessage}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {socketDisconnected ? (
                  <Button variant="outline" size="sm" className="h-7 rounded-lg text-xs" onClick={tlJoin}>
                    {t("views.watch.chat.retryBtn")}
                  </Button>
                ) : null}
                <Button variant="ghost" size="sm" className="h-7 rounded-lg text-xs text-slate-500" onClick={() => { setForceCloseOverlay(true); setShowOverlay(false); }}>
                  {t("views.app.close_btn")}
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-2 border-b border-white/8 px-3 py-1.5">
        <div className={`flex items-center gap-1.5 text-xs font-medium ${connected ? "text-emerald-400" : "text-rose-400"}`}>
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-rose-400"}`} />
          TLdex [{liveTlLang}]
        </div>
        <div className="flex items-center gap-0.5">
          {!tlClient ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-full text-slate-400 hover:text-white"
              title={t("views.watch.chat.showSubtitle")}
              onClick={toggleSubtitle}
            >
              <Icon icon={mdiSubtitlesOutline} size="xs" className={showSubtitle ? "text-[color:var(--color-primary)]" : ""} />
            </Button>
          ) : null}
          {!tlClient ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-full text-slate-400 hover:text-white"
              title={t("views.watch.chat.expandTL")}
              onClick={() => setExpanded(true)}
            >
              <Icon icon={mdiArrowExpand} size="xs" />
            </Button>
          ) : null}
          <Dialog open={expanded} className="max-w-4xl p-0" onOpenChange={setExpanded}>
            <Card className="p-0">
              <div id={expandedMsgId} className="flex tl-expanded">
                <MessageRenderer tlHistory={filteredMessages} fontSize={appStore.settings.liveTlFontSize}>
                  {tlHistory.length - filteredMessages.length > 0 ? (
                    <div className="text-caption">
                      {tlHistory.length - filteredMessages.length} Blocked Messages
                    </div>
                  ) : null}
                  {!completed && !historyLoading ? (
                    <Button variant="ghost" size="sm" onClick={() => loadMessages(false, true)}>
                      Load All
                    </Button>
                  ) : null}
                </MessageRenderer>
              </div>
              <div className="flex justify-end border-t border-white/10 px-4 py-3">
                <Button variant="destructive" size="sm" onClick={() => setExpanded(false)}>
                  {t("views.app.close_btn")}
                </Button>
              </div>
            </Card>
          </Dialog>
          <LiveTranslationsSetting />
        </div>
      </div>
      {showSubtitle && subtitleTarget ? createPortal(<WatchSubtitleOverlay messages={toDisplay} />, subtitleTarget) : null}
      <MessageRenderer ref={tlBody} tlHistory={filteredMessages} fontSize={appStore.settings.liveTlFontSize}>
        {tlHistory.length - filteredMessages.length > 0 ? (
          <div className="text-caption">
            {tlHistory.length - filteredMessages.length} Blocked Messages
          </div>
        ) : null}
        {!completed && !historyLoading && expanded ? (
          <Button variant="ghost" size="sm" onClick={() => loadMessages(false, true)}>
            Load All
          </Button>
        ) : null}
      </MessageRenderer>
    </Card>
  );
}
