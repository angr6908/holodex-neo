"use client";

import { useEffect, useState } from "react";
import { formatDuration, secondsToHuman } from "@/lib/time";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import * as icons from "@/lib/icons";

const TS_PARSING_REGEX = /(?<pre>.*?)(?:(?<s_h>[0-5]?[0-9]):)?(?<s_m>[0-5]?[0-9]):(?<s_s>[0-5][0-9])(?:(?<mid>.*?)(?:(?:(?<e_h>[0-5]?[0-9]):)?(?<e_m>[0-5]?[0-9]):(?<e_s>[0-5][0-9])))?(?<post>.*?)?$/gm;
function capgroupToSecs(h?: string, m?: string, s?: string) { if (!h && !m && !s) return undefined; return +(h || 0) * 3600 + +(m || 0) * 60 + +(s || 0); }
function tokensFrom(groups: any) { return [groups.pre, groups.mid, groups.post].join(" ").split(/[-,~|/／\u3000\s]+/g).map((x) => x.trim()).filter((x) => x.length > 1).slice(0, 12); }
async function jsonpItunes(query: string, country = "JP"): Promise<any> { return new Promise((resolve, reject) => { const cb = `itunes_${Date.now()}_${Math.random().toString(36).slice(2)}`; const script = document.createElement("script"); (window as any)[cb] = (data: any) => { resolve(data); delete (window as any)[cb]; script.remove(); }; script.onerror = reject; script.src = `https://itunes.apple.com/search?${new URLSearchParams({ term: query, entity: "musicTrack", country, limit: "12", callback: cb }).toString()}`; document.head.appendChild(script); }); }

export function CommentSongParser({ comments, onSongSelected }: { comments: any[]; onSongSelected?: (timeframe: any, songdata?: any) => void }) {
  const [open, setOpen] = useState(true);
  const [selection, setSelection] = useState<any[]>([]);
  const [searchResult, setSearchResult] = useState<any[]>([]);
  const [searchResultIdx, setSearchResultIdx] = useState(-1);
  useEffect(() => {
    if (!comments?.length) return;
    const chosen = comments.map(({ comment_key, message }: any) => ({ comment_key, message, sz: [...message.matchAll(TS_PARSING_REGEX)].length })).sort((a: any, b: any) => b.sz - a.sz)[0];
    if (!chosen?.sz) return;
    const match = [...chosen.message.matchAll(TS_PARSING_REGEX)];
    setSelection(match.map(({ index, groups: g }: any) => { const start = capgroupToSecs(g.s_h, g.s_m, g.s_s) || 0; const end = capgroupToSecs(g.e_h, g.e_m, g.e_s); return { index, start_time: start, end_time: end, start_human: secondsToHuman(start).replace(/^0:/, ""), end_human: end ? secondsToHuman(end).replace(/^0:/, "") : undefined, tokens: tokensFrom(g) }; }));
  }, [comments]);
  async function tryLooking(token: string, idx: number) { setSearchResultIdx(idx); const [jp, us] = await Promise.all([jsonpItunes(token, "JP"), jsonpItunes(token, "US")]); const lookupEn = us.results || []; setSearchResult((jp.results || []).map(({ trackId, collectionName, releaseDate, artistName, trackName, trackCensoredName, trackTimeMillis, artworkUrl100, trackViewUrl }: any) => { const foundEn = lookupEn.find((x: any) => x.trackId === trackId); return { trackId, trackTimeMillis, collectionName, releaseDate, artistName, trackName: foundEn?.trackCensoredName || foundEn?.trackName || trackCensoredName || trackName, artworkUrl100, trackViewUrl }; })); }
  return <Card className="p-4"><button type="button" className="flex w-full items-center justify-between text-left text-base font-medium text-white" onClick={() => setOpen((v) => !v)}><span>Automated Comment Song Helper</span><span className="text-slate-400">{open ? "−" : "+"}</span></button>{open ? <div className="mt-4"><h5 className="mb-3 text-sm font-semibold text-slate-200">1: Click on Searchable Component</h5>{selection.map((timeframe, idx) => <div key={`s${timeframe.index}`} className="mb-4"><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={() => onSongSelected?.(timeframe)}>[{timeframe.start_human + (timeframe.end_time ? `\t- ${timeframe.end_human}` : "\t- ?")}]</Button>{timeframe.tokens.map((token: string, tokenidx: number) => <Button key={`s${timeframe.index}t${tokenidx}`} type="button" variant="secondary" size="sm" onClick={() => tryLooking(token, idx)}>{token}</Button>)}</div>{idx === searchResultIdx ? <div className="mt-3"><div className="flex justify-end"><Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setSearchResultIdx(-1)}><Icon icon={icons.mdiClose} size="sm" /></Button></div><h5 className="rounded-lg bg-white/8 px-2 py-2 text-sm font-medium text-slate-200">Pick either iTunes result</h5><div className="mt-2 space-y-2">{searchResult.map((x) => <button key={`itn${x.trackId}`} type="button" className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-white/8" onClick={() => onSongSelected?.(timeframe, x)}><img src={x.artworkUrl100} alt="" className="h-12 w-12 rounded-md object-cover" /><div className="min-w-0"><div className="truncate text-sm text-white">🎵 {x.trackName} [{formatDuration(x.trackTimeMillis)}]</div><div className="truncate text-xs text-slate-400">🎤 {x.artistName} / {x.collectionName} / {x.releaseDate ? x.releaseDate.slice(0, 7) : ""}</div></div></button>)}</div></div> : null}</div>)}</div> : null}</Card>;
}
