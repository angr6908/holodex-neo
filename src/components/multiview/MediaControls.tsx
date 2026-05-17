"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { FastForward, Pause } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useTranslations } from "next-intl";
import { getChannelPhoto } from "@/lib/functions";
import { useMultiviewStore } from "@/lib/multiview-store";
import { useOrderedMultiviewVideoCells } from "@/lib/multiview-video-cells";
import * as icons from "@/lib/icons";

export function MediaControls({ open }: { open?: boolean }) {
  const t = useTranslations();
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
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => allCellAction("play")}><icons.Play className="size-4 text-sky-300" /></Button>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" title={t("views.multiview.syncLabel")} onClick={() => allCellAction("sync")}><FastForward className="size-4 text-sky-300" /></Button>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => allCellAction("pause")}><Pause className="size-4 text-sky-300" /></Button>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => allCellAction("refresh")}><icons.RefreshCw className="size-4 text-sky-300" /></Button>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => allCellAction("unmute")}><icons.Volume2 className="size-4 text-sky-300" /></Button>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => allCellAction("mute")}><icons.VolumeX className="size-4 text-sky-300" /></Button>
              <Slider className="ml-auto w-24" min={0} max={100} step={1} value={[allVolume]} onValueChange={(value) => setAllVolume(Array.isArray(value) ? value[0] ?? 0 : value)} />
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
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => cell.setPlaying(cell.editMode)}>{cell.editMode ? <icons.Play className="size-4 text-slate-300" /> : <Pause className="size-4 text-slate-300" />}</Button>
                    {!cell.isTwitchVideo ? <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => cell.togglePlaybackRate()}><FastForward className={cn("size-4", cell.isFastFoward ? "text-sky-300" : "text-slate-300")} /></Button> : null}
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => cell.refresh()}><icons.RefreshCw className="size-4 text-slate-300" /></Button>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => cell.deleteCell()}><icons.Trash2 className="size-4 text-slate-300" /></Button>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => cell.setMuted(!cell.muted)}>{cell.muted ? <icons.VolumeX className="size-4 text-slate-300" /> : <icons.Volume2 className="size-4 text-slate-300" />}</Button>
                    <Slider className="ml-auto w-24" min={0} max={100} step={1} value={[cell.volume]} onValueChange={(value) => cell.setVolume(Array.isArray(value) ? value[0] ?? 0 : value)} />
                  </div>
                </div>
              </div>
            </section>
          )) : <div className="rounded-lg border border-dashed border-[color:var(--color-border)] px-3 py-4 text-center text-xs text-[color:var(--color-muted-foreground)]">{t("views.multiview.mediaControlsEmpty")}</div>}
          <Label className="items-start rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-2.5 text-xs text-[color:var(--color-foreground)]">
            <Checkbox checked={store.muteOthers} onCheckedChange={(checked) => store.setMuteOthers(checked === true)} />
            <span><span className="block text-xs font-medium text-[color:var(--color-foreground)]">{t("views.multiview.muteOthers")}</span><span className="block text-[color:var(--color-muted-foreground)]">{t("views.multiview.muteOthersDetail")}</span></span>
          </Label>
        </div>
      </Card>
    </div>
  );
}
