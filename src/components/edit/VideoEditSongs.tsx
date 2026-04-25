"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { mdiAltimeter, mdiRestore, mdiTimelinePlusOutline } from "@mdi/js";
import { api } from "@/lib/api";
import { formatDuration, secondsToHuman } from "@/lib/time";
import { useAppState } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { SongSearch } from "@/components/media/SongSearch";
import { SongItem } from "@/components/media/SongItem";
import { RelativeTimestampEditor } from "@/components/edit/RelativeTimestampEditor";
import * as icons from "@/lib/icons";

function humanToSeconds(str: string) { const p = str.split(":"); let s = 0; let m = 1; while (p.length > 0) { s += m * parseInt(p.pop()!, 10); m *= 60; } return s; }
function maskTimestamp(s: string) { const p = s.split(":").join("").split(""); const out: string[] = []; while (p.length > 0 && p[0] === "0") p.shift(); while (p.length > 0) { if (p.length === 1) { out.unshift(`${p}`); break; } const swap = p.pop(); out.unshift(p.pop()! + swap); } return out.join(":"); }
const startTimeRegex = /^\d+([:]\d+)?([:]\d+)?$/;
const endTimeRegex = /^\+\d+$|^\d+(:\d+)?(:\d+)?$/;
function getEmptySong(video: any) { return { song: null, itunesid: null, start: 0, end: 12, name: "", original_artist: "", amUrl: null, art: null, video_id: video.id, channel_id: video.channel.id, creator_id: null, channel: { name: video.channel.name, english_name: video.channel.english_name }, available_at: video.available_at }; }

export type VideoEditSongsHandle = {
  setStartTime: (time: number) => void;
  setSongCandidate: (timeframe: any, songdata?: any) => void;
};

type VideoEditSongsProps = { id?: string; video: any; currentTime?: number; onTimeJump?: (time: number, playNow?: boolean, updateStart?: boolean, stopAt?: number) => void };

export const VideoEditSongs = forwardRef<VideoEditSongsHandle, VideoEditSongsProps>(function VideoEditSongs({ id, video, currentTime = 0, onTimeJump }, ref) {
  const { t } = useI18n();
  const app = useAppState();
  const [current, setCurrent] = useState<any>(() => getEmptySong(video));
  const [songList, setSongList] = useState<any[]>([]);
  const [currentStartTimeInput, setCurrentStartTimeInput] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const priviledgeSufficient = useMemo(() => { const isUpdate = songList.find((m) => m.name === current.name); const user = app.userdata?.user; return !isUpdate || (isUpdate && (user?.role === "admin" || user?.role === "editor" || (user?.id && +current.creator_id === +user.id))); }, [songList, current, app.userdata?.user]);
  const canSave = current.end - current.start > 13 && current.name;
  const addOrUpdate = songList.find((m) => m.name === current.name) ? t("editor.music.update") : t("editor.music.add");
  const currentStartTime = currentStartTimeInput;
  const currentEndTime = `${current.end - current.start}`;
  useEffect(() => { refreshSongList(); }, [video.id]);
  function setStartInput(val: string) { const masked = maskTimestamp(val); setCurrentStartTimeInput(masked); if (startTimeRegex.test(masked)) { const duration = current.end - current.start; const start = humanToSeconds(masked); setCurrent((c: any) => ({ ...c, start, end: start + duration })); } }
  function setEndInput(val: string) { if (!endTimeRegex.test(val)) return; setCurrent((c: any) => ({ ...c, end: val.includes(":") ? humanToSeconds(val) : c.start + +val })); }
  function processSearch(item: any) { if (item) setCurrent((c: any) => ({ ...c, song: item, itunesid: item.trackId, name: item.trackName, original_artist: item.artistName, end: !c.end || c.end < 10 || c.end < c.start + 10 ? c.start + Math.ceil(item.trackTimeMillis / 1000) : c.end, amUrl: item.trackViewUrl, art: item.artworkUrl100 })); else setCurrent((c: any) => ({ ...c, song: null, itunesid: -1, amUrl: null, art: null })); }
  async function refreshSongList() { setSongList((await api.songListByVideo(video.channel.id, video.id, false)).data.sort((a: any, b: any) => a.start - b.start)); }
  async function saveCurrentSong() { await api.tryCreateSong(current, app.userdata.jwt); }
  async function addSong() { await saveCurrentSong(); setCurrent(getEmptySong(video)); await refreshSongList(); }
  function reset() { setCurrent(getEmptySong(video)); refreshSongList(); }
  async function removeSong(song: any) { await api.deleteSong(song, app.userdata.jwt); refreshSongList(); }
  function mountTwitter() { const s = document.createElement("script"); s.src = "https://platform.twitter.com/widgets.js"; s.async = true; document.head.appendChild(s); }

  useImperativeHandle(ref, () => ({
    setStartTime: (time: number) => {
      setStartInput(secondsToHuman(time));
    },
    setSongCandidate: (timeframe: any, songdata?: any) => {
      const start = Number(timeframe?.start_time ?? timeframe?.start ?? currentTime ?? 0);
      const end = Number(timeframe?.end_time ?? timeframe?.end ?? start + 12);
      if (songdata) processSearch(songdata);
      setCurrent((c: any) => ({
        ...c,
        ...(songdata ? {
          song: songdata,
          itunesid: songdata.trackId,
          name: songdata.trackName,
          original_artist: songdata.artistName,
          amUrl: songdata.trackViewUrl,
          art: songdata.artworkUrl100,
        } : {}),
        start,
        end: end > start ? end : start + 12,
      }));
      setCurrentStartTimeInput(secondsToHuman(start));
    },
  }));

  return <div id={id} className="space-y-5"><div className="flex items-center gap-3"><div className="h-px flex-1 bg-white/10" /><span className="text-xs uppercase tracking-[0.22em] text-[color:var(--color-muted-foreground)]">{t("editor.music.titles.addSong")}</span><div className="h-px flex-1 bg-white/10" /><button type="button" className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.22em] text-[color:var(--color-muted-foreground)]" onClick={() => { setHelpOpen(true); mountTwitter(); }}><span>{t("editor.music.titles.help")}</span><Icon icon={icons.mdiHelpCircle} className="h-4 w-4 text-sky-300" /></button></div>
    <Dialog open={helpOpen} className="w-auto max-w-3xl" onOpenChange={setHelpOpen}><Card className="p-4"><blockquote className="twitter-tweet"><p lang="en" dir="ltr">Easily create Music entries on Holodex, coming soon! 🎵🎶 <a href="https://t.co/1KJXYDcJjo">pic.twitter.com/1KJXYDcJjo</a></p>&mdash; Holodex (@holodex) <a href="https://twitter.com/holodex/status/1371290072058785797?ref_src=twsrc%5Etfw">March 15, 2021</a></blockquote></Card></Dialog>
    <div className="grid gap-3 md:grid-cols-12"><div className="md:col-span-10"><SongSearch value={current.song} onInput={processSearch} /></div><div className="md:col-span-2"><label className="mb-2 block text-xs uppercase tracking-[0.18em] text-[color:var(--color-muted-foreground)]">TrackId</label><Input value={current.itunesid || "N/A"} disabled className="text-xs" /></div><div className="md:col-span-6"><label className="mb-2 block text-xs uppercase tracking-[0.18em] text-[color:var(--color-muted-foreground)]">{t("editor.music.trackNameInput")}</label><Input value={current.name} onChange={(e) => setCurrent((c: any) => ({ ...c, name: e.target.value }))} placeholder={t("editor.music.trackNameInput")} /></div><div className="md:col-span-6"><label className="mb-2 block text-xs uppercase tracking-[0.18em] text-[color:var(--color-muted-foreground)]">{t("editor.music.originalArtistInput")}</label><Input value={current.original_artist} onChange={(e) => setCurrent((c: any) => ({ ...c, original_artist: e.target.value }))} placeholder={t("editor.music.originalArtistInput")} /></div>
      <div className="md:col-span-6"><div className="flex items-start gap-2"><button type="button" className="tweak-btn red" title={t("editor.music.setToCurrentTime", [secondsToHuman(currentTime)])} onClick={() => setStartInput(secondsToHuman(currentTime))}><Icon icon={mdiAltimeter} className="h-4 w-4 rotate-90" />{formatDuration(currentTime * 1000)}</button><Input value={currentStartTime} placeholder="12:31" className={startTimeRegex.test(currentStartTime) ? "" : "border-red-400/40"} onChange={(e) => setStartInput(e.target.value)} /></div><RelativeTimestampEditor value={Number(current.start)} test={currentTime} onInput={(x) => { setCurrent((c: any) => ({ ...c, start: x })); setCurrentStartTimeInput(secondsToHuman(x)); onTimeJump?.(x, true); }} onSeekTo={(x) => onTimeJump?.(x, true)} /></div>
      <div className="md:col-span-6"><div className="flex items-start gap-2"><button type="button" className={`tweak-btn ${currentTime < current.start + 10 ? "" : "red"}`} disabled={currentTime < current.start + 10} title={t("editor.music.setToCurrentTime", [secondsToHuman(currentTime)])} onClick={() => { setEndInput(`${currentTime - current.start}`); onTimeJump?.(currentTime - 3, true, false, currentTime); }}><Icon icon={mdiAltimeter} className="h-4 w-4 rotate-90" />{formatDuration(currentTime * 1000)}</button>{current.song?.trackTimeMillis ? <button type="button" className="tweak-btn red" title={t("editor.music.inheritItunesMusic", [`+${Math.ceil(current.song.trackTimeMillis / 1000)}`])} onClick={() => { setEndInput(`+${Math.ceil(current.song.trackTimeMillis / 1000)}`); onTimeJump?.(current.start + current.song.trackTimeMillis / 1000 - 3, true, false, current.start + current.song.trackTimeMillis / 1000); }}><Icon icon={mdiTimelinePlusOutline} className="h-4 w-4" />{formatDuration(current.start * 1000 + current.song.trackTimeMillis)}</button> : null}<Input value={currentEndTime} placeholder="312" className={endTimeRegex.test(currentEndTime) ? "" : "border-red-400/40"} onChange={(e) => setEndInput(e.target.value)} /></div><RelativeTimestampEditor value={Number(current.end)} upTo test={currentTime} onInput={(x) => { setCurrent((c: any) => ({ ...c, end: x })); onTimeJump?.(x - 3, true, false, x); }} onSeekTo={(x) => onTimeJump?.(x, true)} /></div>
      <div className="md:col-span-8"><Button type="button" className="w-full" disabled={!canSave || !priviledgeSufficient} onClick={addSong}>{addOrUpdate}</Button></div><div className="md:col-span-1"><Button type="button" variant="destructive" className="w-full px-0" onClick={reset}><Icon icon={mdiRestore} /></Button></div><div className="md:col-span-3"><Button as="a" variant="secondary" disabled={!current.amUrl} className="am-listen-btn" href={current.amUrl || "#"} rel="norefferer" target="_blank"><img src="https://apple-resources.s3.amazonaws.com/medusa/production/images/5f600674c4f022000191d6c4/en-us-large@1x.png" className="h-[26px] w-[26px] rounded-sm object-cover" alt="" /><span className="ml-2" style={{ fontSize: "0.7rem" }}>Listen on Apple Music</span></Button></div>{!canSave && !priviledgeSufficient ? <div className="md:col-span-12 rounded-xl border border-red-400/30 bg-red-500/15 px-3 py-3 text-sm text-red-100" dangerouslySetInnerHTML={{ __html: t("editor.music.permission") }} /> : null}
    </div><div className="flex items-center gap-3"><div className="h-px flex-1 bg-white/10" /><span className="text-xs uppercase tracking-[0.22em] text-[color:var(--color-muted-foreground)]">{t("editor.music.titles.songList", [video.title])}</span><div className="h-px flex-1 bg-white/10" /></div><div className="max-h-[45vh] min-h-[30vh] overflow-y-auto"><div className="space-y-2">{songList.map((song) => <SongItem key={song.name} song={song} detailed hoverIcon={icons.mdiPencil} artworkHoverIcon={icons.mdiPlay} onRemove={removeSong} onPlay={(x: any) => { onTimeJump?.(x.start); setCurrent(JSON.parse(JSON.stringify(x))); setCurrentStartTimeInput(secondsToHuman(x.start)); }} onPlayNow={(x: any) => onTimeJump?.(x.start, true)} />)}</div></div></div>;
});
