"use client";

import { useEffect, useRef, useState } from "react";
import { formatDuration } from "@/lib/time";
import { Input } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";
import * as icons from "@/lib/icons";
import { useI18n } from "@/lib/i18n";

function jsonpItunes(queryStr: string, country = "JP", lang = "ja_jp"): Promise<any> {
  return new Promise((resolve, reject) => {
    const cb = `itunes_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const params = new URLSearchParams({ term: queryStr, entity: "musicTrack", country, limit: "10", lang, callback: cb });
    (window as any)[cb] = (data: any) => { resolve(data); cleanup(); };
    const cleanup = () => { delete (window as any)[cb]; script.remove(); };
    script.onerror = () => { cleanup(); reject(new Error("iTunes search failed")); };
    script.src = `https://itunes.apple.com/search?${params.toString()}`;
    document.head.appendChild(script);
  });
}

export function SongSearch({ value, autofocus = false, onInput }: { value?: any; id?: number | null; autofocus?: boolean; onInput?: (value: any) => void }) {
  const { t } = useI18n();
  const root = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState<any>(value || null);
  const [search, setSearch] = useState("");
  const [fromApi, setFromApi] = useState<any[]>([]);
  const [openMenu, setOpenMenu] = useState(false);
  const [isComposing, setIsComposing] = useState(false);

  const results = fromApi.concat(query ? [query] : []);
  useEffect(() => { setQuery(value || null); }, [value]);
  useEffect(() => { function outside(e: MouseEvent) { if (!root.current?.contains(e.target as Node)) setOpenMenu(false); } document.addEventListener("mousedown", outside); return () => document.removeEventListener("mousedown", outside); }, []);
  useEffect(() => {
    if (isComposing) return;
    const val = search;
    const timer = setTimeout(() => performSearch(val), 500);
    return () => clearTimeout(timer);
  }, [search, isComposing]);
  useEffect(() => { if (query) onInput?.(query); }, [query]);

  async function performSearch(val: string) {
    if (!val) return;
    setOpenMenu(true); setFromApi([]);
    if (encodeURIComponent(val).length <= 2) return;
    const [md, res] = await Promise.all([searchMusicdex(val), searchRegionsAlternative(val, "JP")]);
    setFromApi([...md.slice(0, 3), ...(res || []).map((x: any) => ({ trackId: x.trackId, trackTimeMillis: x.trackTimeMillis, collectionName: x.collectionName, releaseDate: x.releaseDate, artistName: x.artistName, trackName: x.trackCensoredName || x.trackName, artworkUrl100: x.artworkUrl100, trackViewUrl: x.trackViewUrl, src: "iTunes", index: `iTunes${x.trackId}` }))]);
  }
  async function searchRegionsAlternative(queryStr: string, country = "JP", regions: string[] = ["ja_jp", "en_us"]) {
    const ids = new Set();
    const responses = await Promise.all(regions.map((region) => jsonpItunes(queryStr, country, region)));
    return responses.flatMap((data) => data.results || []).filter((song) => {
      if (ids.has(song.trackId)) return false;
      ids.add(song.trackId);
      return true;
    });
  }
  async function searchMusicdex(queryStr: string) { try { const resp = await fetch(`/api/v2/musicdex/elasticsearch/search`, { method: "POST", headers: { "Content-Type": "application/x-ndjson", Accept: "application/json, text/plain, */*" }, body: `{"preference":"results"}\n${JSON.stringify({ query: { bool: { must: [{ bool: { must: [{ multi_match: { query: queryStr, fields: ["general^3", "general.romaji^0.5", "original_artist^2", "original_artist.romaji^0.5"], type: "most_fields" } }, { multi_match: { query: queryStr, fields: ["name.ngram", "name"], type: "most_fields" } }] } }] } }, size: 12, _source: { includes: ["*"], excludes: [] }, from: 0, sort: [{ _score: { order: "desc" } }] })}\n` }); const data = await resp.json(); return data?.responses?.[0]?.hits?.hits?.map(({ _source }: any) => ({ trackId: _source.itunesid, artistName: _source.original_artist, trackName: _source.name, trackTimeMillis: (_source.end - _source.start) * 1000, trackViewUrl: _source.amUrl, artworkUrl100: _source.art, src: "Musicdex", index: `Musicdex${_source.itunesid}` })) || []; } catch (e) { console.error(e); return []; } }
  function clearSelection() { setQuery(null); onInput?.(null); }
  function selectItem(item: any) { setQuery(item); setSearch(""); setFromApi([]); setOpenMenu(false); }
  return <div ref={root} className="relative"><div className="rounded-[calc(var(--radius)+4px)] border border-white/10 bg-white/6 p-2 shadow-xl shadow-slate-950/20">{query ? <div className="mb-2 flex items-center gap-3 rounded-xl border border-white/10 bg-white/6 px-3 py-2">{query.artworkUrl100 ? <img src={query.artworkUrl100} className="h-12 w-12 rounded-lg object-cover" alt="" /> : null}<div className="min-w-0 flex-1"><div className="truncate text-sm text-[color:var(--color-foreground)]">🎵 {query.trackName} [{formatDuration(query.trackTimeMillis)}]</div><div className="truncate text-xs text-[color:var(--color-muted-foreground)]">🎤 {query.artistName}{query.collectionName ? ` / ${query.collectionName}` : ""}</div></div><button type="button" className="text-[color:var(--color-primary)]" onClick={clearSelection}><Icon icon={icons.mdiClose} className="h-4 w-4" /></button></div> : null}<Input value={search} autoFocus={autofocus} placeholder={t("editor.music.itunesLookupPlaceholder")} className="border-0 bg-transparent shadow-none focus:ring-0" onFocus={() => setOpenMenu(true)} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} onCompositionStart={() => setIsComposing(true)} onCompositionEnd={() => { setIsComposing(false); performSearch(search); }} /></div>{openMenu && results.length ? <div className="absolute inset-x-0 top-[calc(100%+0.35rem)] z-30 overflow-hidden rounded-[calc(var(--radius)+4px)] border border-white/10 bg-slate-950/96 shadow-2xl shadow-slate-950/40">{results.map((item, i) => <button key={item.index || item.trackId || i} type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/6" onClick={() => selectItem(item)}>{item.artworkUrl100 ? <img src={item.artworkUrl100} className="h-12 w-12 rounded-lg object-cover" alt="" /> : null}<div className="min-w-0 flex-1"><div className="truncate text-sm text-[color:var(--color-foreground)]">🎵 {item.trackName} [{formatDuration(item.trackTimeMillis)}]</div><div className="truncate text-xs text-[color:var(--color-muted-foreground)]">🎤 {item.artistName}{item.collectionName ? ` / ${item.collectionName}` : ""}{item.releaseDate ? ` / ${item.releaseDate.slice(0, 7)}` : ""}<span className="ml-1 rounded-full border border-white/10 px-1.5 py-0.5 text-[10px] uppercase opacity-60">{item.src}</span></div></div></button>)}</div> : null}</div>;
}
