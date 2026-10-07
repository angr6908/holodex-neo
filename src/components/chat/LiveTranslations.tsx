"use client";

import { useTranslations } from "next-intl";
import { useEffect, useEffectEvent, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LiveTranslationsSetting } from "@/components/chat/LiveTranslationsSetting";
import {
  MessageRenderer,
  type MessageRendererHandle,
  WatchSubtitleOverlay,
} from "@/components/chat/MessageRenderer";
import { Button } from "@/components/ui/button";
import { Card, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { useDomElement } from "@/lib/hooks";
import { Captions, Maximize2 } from "@/lib/icons";
import { useAppState } from "@/lib/store";
import { dayjs } from "@/lib/time";
import { cn } from "@/lib/utils";

const LIMIT = 20;

// The oldest loaded message starts a new author run in the list.
const markBreakpoint = (messages: any[]) =>
  messages.length ? [{ ...messages[0], breakpoint: true }, ...messages.slice(1)] : messages;

// Whether TL subtitles overlay the player. Panels with their own toggle start shown and keep a
// local choice; otherwise the toggle reads and writes the global setting.
function useSubtitleToggle(useLocalSubtitleToggle: boolean) {
  const app = useAppState();
  const settingShowSub = app.settings.liveTlShowSubtitle;
  const [showSub, setShowSub] = useState(useLocalSubtitleToggle || settingShowSub);
  // Follow the global subtitle setting unless this panel has its own toggle (adjusted during
  // render, so the overlay never shows the stale choice).
  const subSettingKey = `${useLocalSubtitleToggle}:${settingShowSub}`;
  const [syncedSubSetting, setSyncedSubSetting] = useState(subSettingKey);
  if (syncedSubSetting !== subSettingKey) {
    setSyncedSubSetting(subSettingKey);
    if (!useLocalSubtitleToggle) setShowSub(settingShowSub);
  }
  const toggleSub = () => {
    const n = !showSub;
    setShowSub(n);
    if (!useLocalSubtitleToggle) app.patchSettings({ liveTlShowSubtitle: n } as any);
  };
  return [showSub, toggleSub] as const;
}

function TlStatusOverlay({
  isLoading,
  message,
  onClose,
}: {
  isLoading: boolean;
  message: string;
  onClose: () => void;
}) {
  const t = useTranslations();
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-background px-4 text-center">
      {isLoading ? (
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="size-4" />
          {t("views.watch.chat.loading")}
        </div>
      ) : (
        <>
          <div className="text-sm text-muted-foreground">{message}</div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              {t("views.app.close_btn")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// Full-height view of the loaded TL history, with "Load All" until the history is complete.
function TlExpandedDialog({
  open,
  onOpenChange,
  id,
  messages,
  fontSize,
  blockedCount,
  canLoadAll,
  onLoadAll,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  id: string;
  messages: any[];
  fontSize: number;
  blockedCount: number;
  canLoadAll: boolean;
  onLoadAll: () => void;
}) {
  const t = useTranslations();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0">
        <Card className="p-0">
          <div
            id={id}
            className="flex h-[75vh] w-full overscroll-auto [&>div]:h-[75vh] [&>div]:w-full"
          >
            <MessageRenderer tlHistory={messages} fontSize={fontSize}>
              {blockedCount > 0 ? (
                <div className="text-xs text-muted-foreground">{blockedCount} Blocked Messages</div>
              ) : null}
              {canLoadAll ? (
                <Button variant="ghost" size="sm" onClick={onLoadAll}>
                  Load All
                </Button>
              ) : null}
            </MessageRenderer>
          </div>
          <CardFooter className="justify-end">
            <Button variant="destructive" size="sm" onClick={() => onOpenChange(false)}>
              {t("views.app.close_btn")}
            </Button>
          </CardFooter>
        </Card>
      </DialogContent>
    </Dialog>
  );
}

export function LiveTranslations({
  video,
  currentTime = 0,
  useLocalSubtitleToggle = false,
  tlLang = "",
  tlClient = false,
  className = "",
}: {
  video: Record<string, any>;
  currentTime?: number;
  useLocalSubtitleToggle?: boolean;
  tlLang?: string;
  tlClient?: boolean;
  className?: string;
  onVideoUpdate?: (obj: any) => void;
}) {
  const t = useTranslations();
  const app = useAppState();
  const [history, setHistory] = useState<any[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  // The TL client picks its own language; elsewhere the panel follows the TL language setting.
  const lang = tlLang || app.settings.liveTlLang;
  const [showSub, toggleSub] = useSubtitleToggle(useLocalSubtitleToggle);
  const [overlayMsg, setOverlayMsg] = useState(() => t("views.watch.chat.loading"));
  const [showOverlay, setShowOverlay] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const body = useRef<MessageRendererHandle | null>(null);
  const expandedId = `tl-expanded-${useId().replace(/:/g, "")}`;
  const startMs = video?.available_at ? Number(dayjs(video.available_at)) : null;

  const blocked = useMemo(
    () => new Set(app.settings.liveTlBlocked || []),
    [app.settings.liveTlBlocked],
  );
  const filtered = useMemo(
    () => history.filter((m: any) => !blocked.has(m.name)),
    [history, blocked],
  );
  const subTarget = useDomElement(video?.id ? `overlay-${video.id}` : "");
  const toDisplay = useMemo(() => {
    if (!filtered.length || !showSub || tlClient) return [];
    const buf = filtered.slice(-2);
    if (!currentTime) return buf;
    return buf.filter((m: any) => {
      const dur = +m.duration || String(m.message || "").length * 65 + 1800;
      const recvMs = m.receivedAt ? m.receivedAt - (startMs ?? 0) : m.relativeMs;
      const curMs = currentTime * 1000;
      return curMs >= recvMs && curMs < recvMs + dur;
    });
  }, [filtered, showSub, tlClient, currentTime, startMs]);

  useEffect(() => {
    body.current?.scrollToBottom();
  }, [history]);

  const parseMessage = (msg: any) => {
    const next = { ...msg, timestamp: +msg.timestamp };
    next.relativeMs = startMs ? next.timestamp - startMs : 0;
    next.key = next.name + next.timestamp + next.message;
    return next;
  };

  function loadMessages(firstLoad = false, loadAll = false, asTlClient = tlClient) {
    if (!video?.id) return;
    const isCustom = video.isCustom;
    setHistoryLoading(true);
    const last = !firstLoad && history[0]?.timestamp;
    const q: Record<string, unknown> = {
      lang,
      verified: !asTlClient && app.settings.liveTlShowVerified,
      moderator: !asTlClient && app.settings.liveTlShowModerator,
      vtuber: !asTlClient && app.settings.liveTlShowVtuber,
      limit: loadAll ? 100000 : LIMIT,
      ...(last && { before: last }),
      ...(isCustom && { custom_video_id: video.id }),
    };
    api
      .chatHistory(isCustom ? "custom" : video.id, q)
      .then(({ data }: { data: any[] }) => {
        setCompleted(data.length !== LIMIT || loadAll);
        const parsed = data.map(parseMessage);
        setHistory((prev) => markBreakpoint(firstLoad ? parsed : [...parsed, ...prev]));
      })
      .catch(console.error)
      .finally(() => {
        setHistoryLoading(false);
        setIsLoading(false);
        setShowOverlay(false);
      });
  }

  const refresh = () => {
    loadMessages(true, false, tlClient);
    setShowOverlay(false);
    setIsLoading(false);
  };

  function tlJoin() {
    if (
      video?.status &&
      video.status !== "live" &&
      !dayjs().isAfter(dayjs(video.start_scheduled).subtract(15, "minutes"))
    ) {
      setOverlayMsg(t("views.watch.chat.status.notLive"));
      setIsLoading(false);
      setShowOverlay(true);
      return;
    }
    refresh();
  }

  const join = useEffectEvent(() => tlJoin());
  const poll = useEffectEvent(() => refresh());
  useEffect(() => {
    setIsLoading(true);
    setHistory([]);
    join();
    const id = setInterval(() => poll(), 15000);
    return () => clearInterval(id);
  }, [
    video?.id,
    video?.isCustom,
    lang,
    app.settings.liveTlShowVerified,
    app.settings.liveTlShowModerator,
    app.settings.liveTlShowVtuber,
  ]);

  const blockedCount = history.length - filtered.length;

  return (
    <Card
      className={cn(
        "relative box-border flex min-h-0 w-full flex-col overflow-hidden p-0 text-sm",
        className,
      )}
    >
      {showOverlay ? (
        <TlStatusOverlay
          isLoading={isLoading}
          message={overlayMsg}
          onClose={() => setShowOverlay(false)}
        />
      ) : null}
      <div className="flex items-center justify-between gap-2 border-b px-3 py-1.5">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
          TLdex [{lang}]
        </div>
        <div className="flex items-center gap-0.5">
          {!tlClient ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              title={t("views.watch.chat.showSubtitle")}
              onClick={toggleSub}
            >
              <Captions className={cn("size-3.5", showSub && "text-primary")} />
            </Button>
          ) : null}
          {!tlClient ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              title={t("views.watch.chat.expandTL")}
              onClick={() => setExpanded(true)}
            >
              <Maximize2 className="size-3.5" />
            </Button>
          ) : null}
          <TlExpandedDialog
            open={expanded}
            onOpenChange={setExpanded}
            id={expandedId}
            messages={filtered}
            fontSize={app.settings.liveTlFontSize}
            blockedCount={blockedCount}
            canLoadAll={!completed && !historyLoading}
            onLoadAll={() => loadMessages(false, true)}
          />
          <LiveTranslationsSetting />
        </div>
      </div>
      {showSub && subTarget
        ? createPortal(<WatchSubtitleOverlay messages={toDisplay} />, subTarget)
        : null}
      <MessageRenderer ref={body} tlHistory={filtered} fontSize={app.settings.liveTlFontSize}>
        {blockedCount > 0 ? (
          <div className="text-xs text-muted-foreground">{blockedCount} Blocked Messages</div>
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
