"use client";

import { useEffect } from "react";
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
    <div className="media-controls-dropdown absolute right-0 top-full z-40 mt-2 w-[min(92vw,24rem)]">
      <Card className="max-h-[60vh] overflow-y-auto p-4">
        <div className="text-base font-semibold text-foreground">{t("views.multiview.mediaControls")}</div>
        <div className="mt-3 space-y-2">
          <section className="rounded-lg border p-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Button type="button" size="icon-sm" variant="ghost" onClick={() => allCellAction("play")}><icons.Play className="size-4" /></Button>
              <Button type="button" size="icon-sm" variant="ghost" title={t("views.multiview.syncLabel")} onClick={() => allCellAction("sync")}><FastForward className="size-4" /></Button>
              <Button type="button" size="icon-sm" variant="ghost" onClick={() => allCellAction("pause")}><Pause className="size-4" /></Button>
              <Button type="button" size="icon-sm" variant="ghost" onClick={() => allCellAction("refresh")}><icons.RefreshCw className="size-4" /></Button>
              <Button type="button" size="icon-sm" variant="ghost" onClick={() => allCellAction("unmute")}><icons.Volume2 className="size-4" /></Button>
              <Button type="button" size="icon-sm" variant="ghost" onClick={() => allCellAction("mute")}><icons.VolumeX className="size-4" /></Button>
              <Slider className="ml-auto w-24" min={0} max={100} step={1} value={[allVolume]} onValueChange={(value) => setAllVolume(Array.isArray(value) ? value[0] ?? 0 : value)} />
            </div>
          </section>
          {cells.length ? cells.map((cell) => (
            <section key={cell.id} className="rounded-lg border p-2.5">
              <div className="flex items-start gap-2.5">
                <Link href={cell.video?.channel?.id?.startsWith("UC") ? `/channel/${cell.video?.channel?.id}` : ""}>
                  <img className="h-8 w-8 rounded-full object-cover" src={cell.video?.channel?.id ? getChannelPhoto(cell.video.channel.id) : ""} alt="" />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">{cell.video?.title || cell.video?.channel?.name}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Button type="button" size="icon-sm" variant="ghost" onClick={() => cell.setPlaying(cell.editMode)}>{cell.editMode ? <icons.Play className="size-4" /> : <Pause className="size-4" />}</Button>
                    {!cell.isTwitchVideo ? <Button type="button" size="icon-sm" variant="ghost" onClick={() => cell.togglePlaybackRate()}><FastForward className="size-4" /></Button> : null}
                    <Button type="button" size="icon-sm" variant="ghost" onClick={() => cell.refresh()}><icons.RefreshCw className="size-4" /></Button>
                    <Button type="button" size="icon-sm" variant="ghost" onClick={() => cell.deleteCell()}><icons.Trash2 className="size-4" /></Button>
                    <Button type="button" size="icon-sm" variant="ghost" onClick={() => cell.setMuted(!cell.muted)}>{cell.muted ? <icons.VolumeX className="size-4" /> : <icons.Volume2 className="size-4" />}</Button>
                    <Slider className="ml-auto w-24" min={0} max={100} step={1} value={[cell.volume]} onValueChange={(value) => cell.setVolume(Array.isArray(value) ? value[0] ?? 0 : value)} />
                  </div>
                </div>
              </div>
            </section>
          )) : <div className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">{t("views.multiview.mediaControlsEmpty")}</div>}
          <Label className="items-start rounded-lg border p-2.5 text-xs">
            <Checkbox checked={store.muteOthers} onCheckedChange={(checked) => store.setMuteOthers(checked === true)} />
            <span><span className="block text-xs font-medium text-foreground">{t("views.multiview.muteOthers")}</span><span className="block text-muted-foreground">{t("views.multiview.muteOthersDetail")}</span></span>
          </Label>
        </div>
      </Card>
    </div>
  );
}
