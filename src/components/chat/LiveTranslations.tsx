"use client";

import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Maximize2, Captions } from "@/lib/icons";
import { dayjs } from "@/lib/time";
import { api } from "@/lib/api";
import { useAppState } from "@/lib/store";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { MessageRenderer, WatchSubtitleOverlay, type MessageRendererHandle } from "@/components/chat/MessageRenderer";
import { LiveTranslationsSetting } from "@/components/chat/LiveTranslationsSetting";

const LIMIT = 20;

export function LiveTranslations({
  video, currentTime = 0, useLocalSubtitleToggle = false,
  tlLang = "", tlClient = false, className = "", onVideoUpdate,
}: {
  video: Record<string, any>; currentTime?: number; useLocalSubtitleToggle?: boolean;
  tlLang?: string; tlClient?: boolean; className?: string; onVideoUpdate?: (obj: any) => void;
}) {
  const t = useTranslations();
  const app = useAppState();
  const [history, setHistory] = useState<any[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [lang, setLang] = useState(tlLang || app.settings.liveTlLang);
  const [showSub, setShowSub] = useState(useLocalSubtitleToggle || app.settings.liveTlShowSubtitle);
  const [overlayMsg, setOverlayMsg] = useState(t("views.watch.chat.loading"));
  const [showOverlay, setShowOverlay] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const body = useRef<MessageRendererHandle | null>(null);
  const expandedId = `tl-expanded-${useId().replace(/:/g, "")}`;
  const startMs = video?.available_at ? Number(dayjs(video.available_at)) : null;

  const blocked = useMemo(() => new Set(app.settings.liveTlBlocked || []), [app.settings.liveTlBlocked]);
  const filtered = useMemo(() => history.filter((m: any) => !blocked.has(m.name)), [history, blocked]);
  const [subTarget, setSubTarget] = useState<HTMLElement | null>(null);
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

  useEffect(() => { if (tlLang) setLang(tlLang); }, [tlLang]);
  useEffect(() => {
    if (typeof document === "undefined" || !video?.id) { setSubTarget(null); return; }
    setSubTarget(document.getElementById(`overlay-${video.id}`));
  }, [video?.id, expanded, showSub]);
  useEffect(() => { if (!useLocalSubtitleToggle) setShowSub(app.settings.liveTlShowSubtitle); }, [app.settings.liveTlShowSubtitle, useLocalSubtitleToggle]);
  useEffect(() => { body.current?.scrollToBottom(); }, [history]);

  const parseMessage = (msg: any) => {
    const next = { ...msg, timestamp: +msg.timestamp };
    next.relativeMs = startMs ? next.timestamp - startMs : 0;
    next.key = next.name + next.timestamp + next.message;
    if (next.message?.includes?.("https://") && !next.parsed) {
      next.parsed = next.message.replace(/<([^>]*)>/g, "($1)")
        .replace(/(\S+)(https:\/\/(yt\d+\.ggpht\.com\/[a-zA-Z0-9_\-=/]+-c-k-nd|www\.youtube\.com\/[a-zA-Z0-9_\-=/]+\.svg))/gi, '<img src="$2" />');
    }
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
    api.chatHistory(isCustom ? "custom" : video.id, q)
      .then(({ data }: { data: any[] }) => {
        setCompleted(data.length !== LIMIT || loadAll);
        const parsed = data.map(parseMessage);
        setHistory((prev) => {
          const next = firstLoad ? parsed : [...parsed, ...prev];
          if (next.length) next[0] = { ...next[0], breakpoint: true };
          return next;
        });
      })
      .catch(console.error)
      .finally(() => { setHistoryLoading(false); setIsLoading(false); setShowOverlay(false); });
  }

  const refresh = () => { loadMessages(true, false, tlClient); setShowOverlay(false); setIsLoading(false); };

  function tlJoin() {
    if (video?.status && video.status !== "live" && !dayjs().isAfter(dayjs(video.start_scheduled).subtract(15, "minutes"))) {
      setOverlayMsg(t("views.watch.chat.status.notLive"));
      setIsLoading(false); setShowOverlay(true);
      return;
    }
    refresh();
  }

  useEffect(() => {
    setIsLoading(true);
    setHistory([]);
    tlJoin();
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, [video?.id, video?.isCustom, lang, app.settings.liveTlShowVerified, app.settings.liveTlShowModerator, app.settings.liveTlShowVtuber]);

  const toggleSub = () => {
    const n = !showSub;
    setShowSub(n);
    if (!useLocalSubtitleToggle) app.patchSettings({ liveTlShowSubtitle: n } as any);
  };

  const blockedCount = history.length - filtered.length;

  return (
    <Card className={cn("relative box-border flex min-h-0 w-full flex-col overflow-hidden p-0 text-sm", className)}>
      {showOverlay ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-background px-4 text-center">
          {isLoading ? (
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" />{t("views.watch.chat.loading")}
            </div>
          ) : (
            <>
              <div className="text-sm text-muted-foreground">{overlayMsg}</div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowOverlay(false)}>{t("views.app.close_btn")}</Button>
              </div>
            </>
          )}
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-2 border-b px-3 py-1.5">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />TLdex [{lang}]
        </div>
        <div className="flex items-center gap-0.5">
          {!tlClient ? (
            <Button variant="ghost" size="icon" className="h-6 w-6" title={t("views.watch.chat.showSubtitle")} onClick={toggleSub}>
              <Captions className={cn("size-3.5", showSub && "text-primary")} />
            </Button>
          ) : null}
          {!tlClient ? (
            <Button variant="ghost" size="icon" className="h-6 w-6" title={t("views.watch.chat.expandTL")} onClick={() => setExpanded(true)}>
              <Maximize2 className="size-3.5" />
            </Button>
          ) : null}
          <Dialog open={expanded} onOpenChange={setExpanded}>
            <DialogContent className="max-w-4xl p-0">
              <Card className="p-0">
                <div id={expandedId} className="flex h-[75vh] w-full overscroll-auto [&>div]:h-[75vh] [&>div]:w-full">
                  <MessageRenderer tlHistory={filtered} fontSize={app.settings.liveTlFontSize}>
                    {blockedCount > 0 ? <div className="text-xs text-muted-foreground">{blockedCount} Blocked Messages</div> : null}
                    {!completed && !historyLoading ? <Button variant="ghost" size="sm" onClick={() => loadMessages(false, true)}>Load All</Button> : null}
                  </MessageRenderer>
                </div>
                <CardFooter className="justify-end">
                  <Button variant="destructive" size="sm" onClick={() => setExpanded(false)}>{t("views.app.close_btn")}</Button>
                </CardFooter>
              </Card>
            </DialogContent>
          </Dialog>
          <LiveTranslationsSetting />
        </div>
      </div>
      {showSub && subTarget ? createPortal(<WatchSubtitleOverlay messages={toDisplay} />, subTarget) : null}
      <MessageRenderer ref={body} tlHistory={filtered} fontSize={app.settings.liveTlFontSize}>
        {blockedCount > 0 ? <div className="text-xs text-muted-foreground">{blockedCount} Blocked Messages</div> : null}
        {!completed && !historyLoading && expanded ? <Button variant="ghost" size="sm" onClick={() => loadMessages(false, true)}>Load All</Button> : null}
      </MessageRenderer>
    </Card>
  );
}
