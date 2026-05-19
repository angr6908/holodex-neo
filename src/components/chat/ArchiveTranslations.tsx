"use client";

import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Maximize2, ChevronLeft, ChevronRight, Captions } from "@/lib/icons";
import { dayjs } from "@/lib/time";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { LiveTranslationsSetting } from "@/components/chat/LiveTranslationsSetting";
import { liveTlFontSizeClass, WatchSubtitleOverlay } from "@/components/chat/MessageRenderer";
import { useAppState } from "@/lib/store";
import { useTranslations } from "next-intl";
export function ArchiveTranslations({ video, currentTime = 0, useLocalSubtitleToggle = false, className = "", onTimeJump }: { video: Record<string, any>; currentTime?: number; useLocalSubtitleToggle?: boolean; className?: string; onTimeJump?: (time: number, a?: boolean, b?: boolean) => void }) {
  const app = useAppState();
  const t = useTranslations();
  const [tlHistory, setTlHistory] = useState<any[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [timeOffsetSeconds, setTimeOffsetSeconds] = useState(0);
  const [liveTlLang, setLiveTlLang] = useState(app.settings.liveTlLang);
  const [showSubtitle, setShowSubtitle] = useState(useLocalSubtitleToggle ? true : app.settings.liveTlShowSubtitle);
  const [curIndex, setCurIndex] = useState(0);
  const [subtitleTarget, setSubtitleTarget] = useState<HTMLElement | null>(null);
  const expandedMsgId = `tl-expanded-${useId().replace(/:/g, "")}`;
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const startTimeMillis = video?.available_at ? Number(dayjs(video.available_at)) : null;
  const blockedNames = useMemo(() => new Set(app.settings.liveTlBlocked || []), [app.settings.liveTlBlocked]);

  function parseMessage(msg: any) {
    const next = { ...msg };
    next.timestamp = +next.timestamp;
    next.relativeMs = startTimeMillis ? next.timestamp - startTimeMillis : 0;
    next.key = next.name + next.timestamp + next.message;
    if (next.message?.includes?.("https://") && !next.parsed) {
      const regex = /(\S+)(https:\/\/(yt\d+\.ggpht\.com\/[a-zA-Z0-9_\-=/]+-c-k-nd|www\.youtube\.com\/[a-zA-Z0-9_\-=/]+\.svg))/gi;
      next.parsed = next.message.replace(/<([^>]*)>/g, "($1)").replace(regex, '<img src="$2" />');
    }
    return next;
  }
  function loadMessages() {
    if (!video?.id) return;
    api.chatHistory(video.id, { lang: liveTlLang, verified: app.settings.liveTlShowVerified, moderator: app.settings.liveTlShowModerator, vtuber: app.settings.liveTlShowVtuber, limit: 100000 })
      .then(({ data }: any) => setTlHistory((data || []).map(parseMessage)))
      .catch(console.error);
  }

  useEffect(() => { setLiveTlLang(app.settings.liveTlLang); }, [app.settings.liveTlLang]);
  useEffect(() => { if (!useLocalSubtitleToggle) setShowSubtitle(app.settings.liveTlShowSubtitle); }, [app.settings.liveTlShowSubtitle, useLocalSubtitleToggle]);
  useEffect(() => { loadMessages(); }, [video?.id, liveTlLang, app.settings.liveTlShowVerified, app.settings.liveTlShowModerator, app.settings.liveTlShowVtuber]);
  useEffect(() => { if (!video?.id) setSubtitleTarget(null); else setSubtitleTarget(document.getElementById(`overlay-${video.id}`)); }, [video?.id, showSubtitle]);

  const dividedTLs = useMemo(() => {
    const filtered = tlHistory.filter((m: any) => !blockedNames.has(m.name));
    return filtered.map((item: any, index: number, arr: any[]) => {
      const shouldHideAuthor = index > 0 && index !== arr.length - 1 && item.name === arr[index - 1].name && !item.breakpoint;
      const newtime = item.timestamp + timeOffsetSeconds * 1000;
      const relativeMs = item.relativeMs + timeOffsetSeconds * 1000;
      return { ...item, shouldHideAuthor, relativeMs, timestamp: newtime };
    });
  }, [tlHistory, blockedNames, timeOffsetSeconds]);

  const toDisplay = useMemo(() => {
    if (!dividedTLs.length || !showSubtitle) return [];
    const startIdx = Math.max(curIndex - 1, 0);
    const buffer = dividedTLs.slice(startIdx, startIdx + 2);
    return buffer.filter((m: any) => {
      const displayTime = +m.duration || (String(m.message || "").length * 65 + 1800);
      return currentTime * 1000 >= m.relativeMs && currentTime * 1000 < m.relativeMs + displayTime;
    });
  }, [dividedTLs, showSubtitle, curIndex, currentTime]);

  useEffect(() => {
    if (!dividedTLs.length) return;
    const msTime = currentTime * 1000;
    const cur = dividedTLs[curIndex]?.relativeMs ?? 0;
    const startIndex = currentTime < cur ? 0 : curIndex;
    for (let i = startIndex; i < dividedTLs.length; i += 1) {
      if (i === dividedTLs.length - 1) { setCurIndex(dividedTLs.length - 1); return; }
      if (msTime <= dividedTLs[i].relativeMs) { setCurIndex(Math.max(i - 1, 0)); return; }
    }
  }, [currentTime, dividedTLs.length, timeOffsetSeconds]);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    if (app.settings.liveTlHideSpoiler) el.scrollTop = el.scrollHeight;
    else {
      const target = el.querySelector(`[data-archive-index="${curIndex}"]`) as HTMLElement | null;
      if (target) target.scrollIntoView({ block: "center" });
    }
  }, [curIndex, app.settings.liveTlHideSpoiler]);

  const itemClass = (index: number) => index === curIndex ? "relative z-0 [&_.tl-message]:relative [&_.tl-message]:z-0 [&_.tl-message]:before:absolute [&_.tl-message]:before:left-0 [&_.tl-message]:before:top-[-1px] [&_.tl-message]:before:z-[-1] [&_.tl-message]:before:h-full [&_.tl-message]:before:w-full [&_.tl-message]:before:bg-primary/70 [&_.tl-message]:before:bg-cover [&_.tl-message]:before:opacity-25 [&_.tl-message]:before:content-['']" : app.settings.liveTlHideSpoiler && index > curIndex ? "hidden" : "";
  function handleClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    const link = target.closest(".tl-message") as HTMLElement | null;
    if (link) {
      onTimeJump?.(+link.getAttribute("data-time")!, true, true);
      e.preventDefault();
    }
  }

  const body = <div ref={bodyRef} className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-1 py-0 leading-[1.35] lg:px-3", liveTlFontSizeClass(app.settings.liveTlFontSize))} onClick={handleClick}>{dividedTLs.map((item, index) => <div key={item.key || `${item.timestamp}${item.message}${item.name}`} data-archive-index={index} className={itemClass(index)}><ChatMessage source={item} /></div>)}</div>;

  return (
    <Card className={cn("box-border flex min-h-0 w-full flex-col overflow-hidden p-0 text-sm", className)}>
      <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
        <div>TLdex [{liveTlLang}]</div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" title="-2s" onClick={() => setTimeOffsetSeconds((v) => v - 2)}><ChevronLeft className="size-4" /></Button>
          <Button type="button" variant="ghost" size="xs" className="h-7 font-mono text-xs" onClick={() => setDialog(true)}>{`${timeOffsetSeconds >= 0 ? "+" : ""}${timeOffsetSeconds}s`}</Button>
          <Dialog open={dialog} onOpenChange={setDialog}><DialogContent className="max-w-xs"><Card><div className="text-sm font-normal">{t("views.scriptEditor.timeShift.timeOffset")}</div><div className="flex flex-col gap-2 text-sm"><Label htmlFor="archive-tl-time-offset">{t("views.scriptEditor.timeShift.offset")}</Label><div className="flex items-center gap-2"><Input id="archive-tl-time-offset" value={timeOffsetSeconds} type="number" className="flex-1" onChange={(event) => setTimeOffsetSeconds(Number(event.target.value))} /><span className="text-muted-foreground">{t("views.scriptEditor.timeShift.secondsShort")}</span></div></div></Card></DialogContent></Dialog>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" title="+2s" onClick={() => setTimeOffsetSeconds((v) => v + 2)}><ChevronRight className="size-4" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" title={t("views.watch.chat.showSubtitle")} onClick={() => setShowSubtitle((v) => !v)}><Captions className={cn("size-4", showSubtitle ? "text-primary" : "")} /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" title={t("views.watch.chat.expandTL")} onClick={() => setExpanded(true)}><Maximize2 className="size-4" /></Button>
          <Dialog open={expanded} onOpenChange={setExpanded}><DialogContent className="max-w-4xl"><Card className="p-0"><div id={expandedMsgId} className="flex h-[75vh] w-full overscroll-auto [&>div]:h-[75vh] [&>div]:w-full">{body}</div><div className="flex justify-end border-t px-4 py-3"><Button variant="destructive" size="sm" onClick={() => setExpanded(false)}>{t("component.common.close")}</Button></div></Card></DialogContent></Dialog>
          <LiveTranslationsSetting />
        </div>
      </div>
      {expanded ? null : body}
      {showSubtitle && subtitleTarget ? createPortal(<WatchSubtitleOverlay messages={toDisplay} />, subtitleTarget) : null}
    </Card>
  );
}
