"use client";

import { createPortal } from "react-dom";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { mdiArrowExpand, mdiChevronLeft, mdiChevronRight, mdiSubtitlesOutline } from "@mdi/js";
import { dayjs } from "@/lib/time";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { LiveTranslationsSetting } from "@/components/chat/LiveTranslationsSetting";
import { WatchSubtitleOverlay } from "@/components/watch/WatchSubtitleOverlay";
import { useAppState } from "@/lib/store";

export function ArchiveTranslations({ video, currentTime = 0, useLocalSubtitleToggle = false, className = "", style, onTimeJump }: { video: Record<string, any>; currentTime?: number; useLocalSubtitleToggle?: boolean; className?: string; style?: React.CSSProperties; onTimeJump?: (time: number, a?: boolean, b?: boolean) => void }) {
  const app = useAppState();
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
      const shouldHideAuthor = index > 0 && (!(index === 0 || index === arr.length - 1 || item.name !== arr[index - 1].name || !!item.breakpoint));
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

  function itemClass(index: number) {
    if (index === curIndex) return "active-message";
    if (app.settings.liveTlHideSpoiler && index > curIndex) return "hide-spoiler";
    return "";
  }
  function handleClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    const link = target.closest(".tl-message") as HTMLElement | null;
    if (link) {
      onTimeJump?.(+link.getAttribute("data-time")!, true, true);
      e.preventDefault();
    }
  }

  const body = <div ref={bodyRef} className="archive tl-body px-1 py-0 lg:px-3" style={{ fontSize: `${app.settings.liveTlFontSize}px` }} onClick={handleClick}>{dividedTLs.map((item, index) => <div key={item.key || `${item.timestamp}${item.message}${item.name}`} data-archive-index={index} className={itemClass(index)}><ChatMessage source={item} /></div>)}</div>;

  return (
    <Card className={`tl-overlay w-full border border-white/10 p-0 text-sm shadow-none ${className}`} style={style}>
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
        <div>TLdex [{liveTlLang}]</div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" title="-2s" onClick={() => setTimeOffsetSeconds((v) => v - 2)}><Icon icon={mdiChevronLeft} size="sm" /></Button>
          <button type="button" className="rounded-md px-2 py-1 font-mono text-xs text-slate-300 transition hover:bg-white/8" onClick={() => setDialog(true)}>{`${timeOffsetSeconds >= 0 ? "+" : ""}${timeOffsetSeconds}s`}</button>
          <Dialog open={dialog} className="max-w-xs p-0" onOpenChange={setDialog}><Card className="space-y-4 p-5"><div className="text-sm font-semibold text-white">Time Offset</div><label className="flex flex-col gap-2 text-sm"><span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Offset</span><div className="flex items-center gap-2"><Input value={timeOffsetSeconds} type="number" className="flex-1" onChange={(event) => setTimeOffsetSeconds(Number(event.target.value))} /><span className="text-slate-400">s</span></div></label></Card></Dialog>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" title="+2s" onClick={() => setTimeOffsetSeconds((v) => v + 2)}><Icon icon={mdiChevronRight} size="sm" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" title="Show Subtitle" onClick={() => setShowSubtitle((v) => !v)}><Icon icon={mdiSubtitlesOutline} size="sm" className={showSubtitle ? "text-[color:var(--color-primary)]" : ""} /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" title="Expand TL" onClick={() => setExpanded(true)}><Icon icon={mdiArrowExpand} size="sm" /></Button>
          <Dialog open={expanded} className="max-w-4xl p-0" onOpenChange={setExpanded}><Card className="p-0"><div id={expandedMsgId} className="flex tl-expanded">{body}</div><div className="flex justify-end border-t border-white/10 px-4 py-3"><Button variant="destructive" size="sm" onClick={() => setExpanded(false)}>Close</Button></div></Card></Dialog>
          <LiveTranslationsSetting />
        </div>
      </div>
      {expanded ? null : body}
      {showSubtitle && subtitleTarget ? createPortal(<WatchSubtitleOverlay messages={toDisplay} />, subtitleTarget) : null}
    </Card>
  );
}
