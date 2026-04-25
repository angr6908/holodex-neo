"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { mdiAccountMultiple, mdiClipboardPlusOutline, mdiCommentSearch, mdiFilter, mdiTextSearch } from "@mdi/js";
import { api } from "@/lib/api";
import { useAppState } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { SelectCard } from "@/components/setting/SelectCard";
import * as icons from "@/lib/icons";

export function CalendarUsage({ initialQuery, showFavoritesCalendar = true }: { initialQuery?: any[] | false; showFavoritesCalendar?: boolean }) {
  const { t } = useI18n();
  const app = useAppState();
  const rootEl = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState<any[]>(Array.isArray(initialQuery) ? initialQuery : []);
  const [fromApi, setFromApi] = useState<any[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [snackbar, setSnackbar] = useState(false);
  const [openMenu, setOpenMenu] = useState(false);
  const requestId = useRef(0);

  const results = useMemo(() => {
    const selected = new Set((query || []).map((item) => item.value));
    return (fromApi || []).filter((item) => !selected.has(item.value));
  }, [fromApi, query]);

  const preferEnglishName = app.settings.useEnglishName;
  const liveCalendarURL = useMemo(() => {
    const bucket = query.reduce((b: any, { type, value }: any) => { b[type] ||= []; b[type].push(value); return b; }, {});
    const params = { ...bucket, ...(preferEnglishName ? { preferEnglishName: 1 } : null) } as any;
    return `https://holodex.net/live.ics?${new URLSearchParams(params).toString()}`;
  }, [query, preferEnglishName]);
  const favoritesCalendarURL = useMemo(() => {
    const jwt = app.userdata?.jwt;
    if (!jwt) return "Login required to use favorites calendar feed.";
    const params = { jwt, ...(preferEnglishName ? { preferEnglishName: 1 } : null) } as any;
    return `https://holodex.net/favorites.ics?${new URLSearchParams(params).toString()}`;
  }, [app.userdata?.jwt, preferEnglishName]);

  async function runSearch(formatted: string) {
    const current = ++requestId.current;
    try {
      const res = await api.searchAutocomplete(formatted);
      if (current !== requestId.current) return;
      const next = (res.data || []).map((x: any) => ({ ...x, text: x.text || x.value })).filter((x: any) => x.type === "topic" || x.type === "channel" || x.type === "org");
      setFromApi(next);
      setOpenMenu(next.length > 0);
    } catch (e) { if (current === requestId.current) setFromApi([]); console.error(e); }
    finally { if (current === requestId.current) setIsLoading(false); }
  }

  useEffect(() => { if (Array.isArray(initialQuery)) setQuery(initialQuery); }, [initialQuery]);
  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) { if (!rootEl.current?.contains(event.target as Node)) setOpenMenu(false); }
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);
  useEffect(() => {
    const formatted = (searchInput || "").trim().replace("#", "");
    if (!formatted || encodeURIComponent(formatted).length <= 1) { setFromApi([]); setOpenMenu(false); setIsLoading(false); return; }
    setIsLoading(true); setOpenMenu(true);
    const timer = setTimeout(() => runSearch(formatted), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);
  function getItemIcon(type: string) { switch (type) { case "channel": case "video url": return icons.mdiYoutube; case "topic": return icons.mdiAnimationPlay; case "org": return mdiAccountMultiple; case "title & desc": return mdiTextSearch; case "comments": return mdiCommentSearch; default: return null; } }
  function constrainQuery(next: any[]) { if (next.filter((x) => x.type === "org").length > 1) next.splice(next.findIndex((x) => x.type === "org"), 1); return next; }
  async function copyToClipboard(url: string) { await navigator.clipboard.writeText(url); setSnackbar(true); setTimeout(() => setSnackbar(false), 1000); }
  function addItem(item: any) { setQuery((prev) => constrainQuery(prev.find((entry) => entry.value === item.value) ? [...prev] : [...prev, { ...item }])); setSearchInput(""); setFromApi([]); setOpenMenu(false); }
  function deleteChip(item: any) { setQuery((prev) => prev.filter((q) => q.value !== item.value)); }
  function i18nItem(item: string) { switch (item) { case "channel": return t("component.search.type.channel"); case "video url": return t("component.search.type.videourl"); case "topic": return t("component.search.type.topic"); case "org": return t("component.search.type.org"); case "title & desc": return t("component.search.type.titledesc"); case "comments": return t("component.search.type.comments"); default: return ""; } }

  return <div ref={rootEl} className="space-y-4">
    <div className="relative"><SelectCard><div className="flex items-center gap-2 text-sm text-[color:var(--color-muted-foreground)]"><Icon icon={mdiFilter} className="h-4 w-4" /><span>Filter by Topic, Org, Channel ...</span></div><div className="space-y-2">{query.length ? <div className="select-card-chip-flow">{query.map((item) => <div key={item.value} className="settings-check-chip settings-check-chip-selected select-card-chip-compact"><span className="settings-check-chip-indicator" /><span className="select-card-chip-meta">{i18nItem(item.type)}</span><span className="select-card-chip-label truncate">{item.text}</span><button type="button" className="select-card-chip-meta select-card-chip-remove select-card-chip-remove-btn" onClick={(e) => { e.stopPropagation(); deleteChip(item); }}><Icon icon={icons.mdiClose} className="h-3.5 w-3.5" /></button></div>)}</div> : null}<Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Topic, org, or channel" className="h-9 border-[color:var(--color-light)] bg-[color:var(--color-card)]" onFocus={() => setOpenMenu(true)} /></div></SelectCard>{openMenu && (results.length || isLoading) ? <div className="absolute inset-x-0 top-[calc(100%+0.35rem)] z-30 overflow-hidden rounded-[calc(var(--radius)+4px)] border border-[color:var(--color-border)] bg-[color:var(--color-popover)] shadow-2xl shadow-slate-950/30">{isLoading ? <div className="px-4 py-2 text-xs text-[color:var(--color-muted-foreground)]">Loading...</div> : null}{results.map((item) => <button key={item.value} type="button" className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-[color:var(--color-foreground)] transition hover:bg-[color:var(--surface-soft)]" onClick={() => addItem(item)}>{getItemIcon(item.type) ? <Icon icon={getItemIcon(item.type)!} className="h-4 w-4 text-[color:var(--color-muted-foreground)]" /> : null}<span className="text-[color:var(--color-muted-foreground)]">{i18nItem(item.type)}</span><span>{item.text}</span></button>)}</div> : null}</div>
    <CalendarUrl label="Live Calendar (iCal)" url={liveCalendarURL} onCopy={copyToClipboard} />
    {app.isLoggedIn && showFavoritesCalendar ? <CalendarUrl label="Favorites Calendar (iCal)" url={favoritesCalendarURL} onCopy={copyToClipboard} /> : null}
    {snackbar ? <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-emerald-400/25 bg-emerald-500/20 px-4 py-3 text-sm text-emerald-100 shadow-xl">{t("component.videoCard.copiedToClipboard")}</div> : null}
  </div>;
}

function CalendarUrl({ label, url, onCopy }: { label: string; url: string; onCopy: (url: string) => void }) {
  return <div className="space-y-2"><label className="text-sm text-[color:var(--color-muted-foreground)]">{label}</label><button type="button" className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-left text-sm text-[color:var(--color-foreground)]" onClick={(e) => { e.stopPropagation(); onCopy(url); }}><span className="truncate">{url}</span><Icon icon={mdiClipboardPlusOutline} className="ml-3 h-4 w-4 shrink-0 text-[color:var(--color-primary)]" /></button></div>;
}
