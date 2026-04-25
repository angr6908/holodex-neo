"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useAppState } from "@/lib/store";
import { formatDistance, secondsToHuman } from "@/lib/time";
import { useI18n } from "@/lib/i18n";
import * as icons from "@/lib/icons";

export function SongItem({ song, detailed = false, alwaysShowDeletion = false, showTime = false, hoverIcon, artworkHoverIcon, color = "", onPlay, onPlayNow, onRemove, onChannel }: any) {
  const app = useAppState();
  const { t } = useI18n();
  const [hover, setHover] = useState(false);
  const [hoverInner, setHoverInner] = useState(false);
  const user = app.userdata?.user;
  const userCanDelete = user?.role && user?.id && (user.role !== "user" || +user.id === +song.creator_id);
  const formattedTime = formatDistance(song.available_at, app.settings.lang, t);
  const nameProperty = app.settings.nameProperty;
  return <div className="flex items-start gap-3 rounded-xl px-3 py-2 hover:bg-white/5" onClick={() => onPlay?.(song)} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl" onMouseEnter={() => setHoverInner(true)} onMouseLeave={() => setHoverInner(false)}>{song.art ? <img src={song.art} className="h-full w-full object-cover" alt="" /> : <div className="flex h-full w-full bg-slate-700 p-1"><Button size="icon" variant="outline" className="m-auto h-8 w-8" disabled><Icon icon={icons.mdiMusic} size="sm" /></Button></div>}{hover && !hoverInner ? <div className="hover-item absolute left-0 top-0 flex h-full w-full p-1" style={{ position: "absolute", left: 0 }}><Button size="icon" className="m-auto h-8 w-8 rounded-full bg-sky-300 text-slate-950 shadow-md"><Icon icon={hoverIcon} size="sm" /></Button></div> : null}{onPlayNow && hoverInner ? <div className="hover-art absolute left-0 top-0 flex h-full w-full p-1" style={{ position: "absolute", left: 0 }}><Button size="icon" className="m-auto h-8 w-8 rounded-full bg-sky-300 text-slate-950 shadow-md" onClick={(e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault(); onPlayNow(song); }}><Icon icon={artworkHoverIcon} size="sm" /></Button></div> : null}</div>
    <div className="min-w-0 flex-1 py-1 pt-1"><div className={`text-base leading-7 ${color}`}>{(alwaysShowDeletion || (detailed && onRemove && userCanDelete)) ? <a className="text-xs text-red-400 float-right ml-1 song-clickable" onClick={(e) => { e.stopPropagation(); onRemove?.(song); }}>{t("component.media.remove")}</a> : null}{detailed ? <div className="float-right text-caption">[{secondsToHuman(song.start)} - {secondsToHuman(song.end)}]</div> : null}<span className="limit-width">{song.name} / <span className="text-[color:var(--color-primary)]">{song.original_artist}</span></span></div><div className={`text-xs leading-5 ${color}`}><div className="float-right">{showTime ? <span className="muted">{formattedTime}</span> : null} {Math.floor((song.end - song.start) / 60)}:{(Math.round(song.end - song.start) % 60).toString().padStart(2, "0")}</div>{onChannel ? <span className="song-clickable" onClick={(e) => { e.stopPropagation(); onChannel(song); }}>{song.channel?.[nameProperty] || song.channel?.name}</span> : <span> {song.channel?.[nameProperty] || song.channel?.name} </span>}</div></div>
  </div>;
}
