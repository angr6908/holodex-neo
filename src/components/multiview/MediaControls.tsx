"use client";

import { useEffect } from "react";
import Link from "next/link";
import { mdiFastForward, mdiPause } from "@mdi/js";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/lib/i18n";
import { getChannelPhoto } from "@/lib/functions";
import { useMultiviewStore } from "@/lib/multiview-store";
import { useOrderedMultiviewVideoCells } from "@/lib/multiview-video-cells";
import * as icons from "@/lib/icons";

export function MediaControls({ open }: { open?: boolean }) {
  const { t } = useI18n();
  const store = useMultiviewStore();
  const cells = useOrderedMultiviewVideoCells(store.layout);

  useEffect(() => {
    if (!open) return;
    cells.forEach((cell) => cell.manualRefresh());
  }, [open, cells]);

  useEffect(() => {
    const timer = setInterval(() => {
      cells.forEach((cell) => cell.manualCheckMuted());
    }, 1000);
    return () => clearInterval(timer);
  }, [cells]);

  if (!open) return null;

  const allVolume = cells.length && cells.every((cell) => cell.volume === cells[0].volume) ? cells[0].volume : 0;

  function setAllVolume(val: number) {
    cells.forEach((cell) => cell.setVolume(val));
  }

  function allCellAction(fnName: string) {
    cells.forEach((cell) => {
      switch (fnName) {
        case "mute": cell.setMuted(true); break;
        case "play": cell.setPlaying(true); break;
        case "pause": cell.setPlaying(false); break;
        case "unmute": cell.setMuted(false); break;
        case "refresh": cell.refresh(); break;
        case "sync":
          if (cell.video.status === "live") cell.setPlaybackRate(2);
          else cell.togglePlaybackRate();
          break;
        default: break;
      }
    });
  }

  return (
    <div className="media-controls-dropdown absolute right-0 top-full z-[90] mt-2 w-[min(92vw,24rem)]">
      <Card className="max-h-[60vh] overflow-y-auto border border-[color:var(--color-border)] bg-[color:var(--surface-nav)] p-4 shadow-2xl shadow-black/60 backdrop-blur-xl">
        <div className="text-base font-semibold text-[color:var(--color-foreground)]">{t("views.multiview.mediaControls")}</div>
        <div className="mt-3 space-y-2">
          <section className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => allCellAction("play")}><Icon icon={icons.mdiPlay} size="sm" className="text-sky-300" /></Button>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" title="Sync" onClick={() => allCellAction("sync")}><Icon icon={mdiFastForward} size="sm" className="text-sky-300" /></Button>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => allCellAction("pause")}><Icon icon={mdiPause} size="sm" className="text-sky-300" /></Button>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => allCellAction("refresh")}><Icon icon={icons.mdiRefresh} size="sm" className="text-sky-300" /></Button>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => allCellAction("unmute")}><Icon icon={icons.mdiVolumeHigh} size="sm" className="text-sky-300" /></Button>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => allCellAction("mute")}><Icon icon={icons.mdiVolumeMute} size="sm" className="text-sky-300" /></Button>
              <input className="volume-slider ml-auto" type="range" min="0" max="100" step="1" value={allVolume} onInput={(event) => setAllVolume(Number((event.target as HTMLInputElement).value))} onChange={(event) => setAllVolume(Number(event.target.value))} />
            </div>
          </section>
          {cells.length ? cells.map((cell) => (
            <section key={cell.id} className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-2.5">
              <div className="flex items-start gap-2.5">
                <Link href={cell.video?.channel?.id?.startsWith("UC") ? `/channel/${cell.video?.channel?.id}` : ""}>
                  <img className="h-8 w-8 rounded-full border border-[color:var(--color-border)] object-cover" src={cell.video?.channel?.id ? getChannelPhoto(cell.video.channel.id) : ""} alt="" />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-sky-300">{cell.video?.title || cell.video?.channel?.name}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => cell.setPlaying(cell.editMode)}><Icon icon={cell.editMode ? icons.mdiPlay : mdiPause} size="sm" className="text-slate-300" /></Button>
                    {!cell.isTwitchVideo ? <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => cell.togglePlaybackRate()}><Icon icon={mdiFastForward} size="sm" className={cell.isFastFoward ? "text-sky-300" : "text-slate-300"} /></Button> : null}
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => cell.refresh()}><Icon icon={icons.mdiRefresh} size="sm" className="text-slate-300" /></Button>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => cell.deleteCell()}><Icon icon={icons.mdiDelete} size="sm" className="text-slate-300" /></Button>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => cell.setMuted(!cell.muted)}><Icon icon={cell.muted ? icons.mdiVolumeMute : icons.mdiVolumeHigh} size="sm" className="text-slate-300" /></Button>
                    <input className="volume-slider ml-auto" type="range" min="0" max="100" step="1" value={cell.volume} onInput={(event) => cell.setVolume(Number((event.target as HTMLInputElement).value))} onChange={(event) => cell.setVolume(Number(event.target.value))} />
                  </div>
                </div>
              </div>
            </section>
          )) : <div className="rounded-lg border border-dashed border-[color:var(--color-border)] px-3 py-4 text-center text-xs text-[color:var(--color-muted-foreground)]">{t("views.multiview.mediaControlsEmpty")}</div>}
          <label className="flex items-start gap-2.5 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-2.5 text-xs text-[color:var(--color-foreground)]">
            <input checked={store.muteOthers} type="checkbox" className="mt-0.5 h-3.5 w-3.5" onChange={(event) => store.setMuteOthers(event.target.checked)} />
            <span><span className="block text-xs font-medium text-[color:var(--color-foreground)]">{t("views.multiview.muteOthers")}</span><span className="block text-[color:var(--color-muted-foreground)]">{t("views.multiview.muteOthersDetail")}</span></span>
          </label>
        </div>
      </Card>
    </div>
  );
}
