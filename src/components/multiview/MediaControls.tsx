"use client";

import { useEffect } from "react";
import Link from "next/link";
import { FastForward, Pause, Play, RefreshCw, Trash2, Volume2, VolumeX } from "lucide-react";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupSeparator } from "@/components/ui/button-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldTitle } from "@/components/ui/field";
import { Item, ItemActions, ItemContent, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { useTranslations } from "next-intl";
import { getChannelPhoto } from "@/lib/functions";
import { useMultiviewStore } from "@/lib/multiview-store";
import { useOrderedMultiviewVideoCells } from "@/lib/multiview-video-cells";

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

  const renderAvatar = (cell: any) => {
    const channelId = cell.video?.channel?.id;
    const avatar = (
      <Avatar size="sm">
        {channelId ? <AvatarImage src={getChannelPhoto(channelId)} alt="" /> : null}
      </Avatar>
    );
    return channelId?.startsWith("UC") ? <Link href={`/channel/${channelId}`}>{avatar}</Link> : avatar;
  };

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
    <FieldGroup className="gap-3">
      <Field orientation="horizontal" className="items-center">
        <ButtonGroup>
          <Button type="button" variant="ghost" size="icon" onClick={() => allCellAction("play")}>
            <Play />
          </Button>
          <Button type="button" variant="ghost" size="icon" title={t("views.multiview.syncLabel")} onClick={() => allCellAction("sync")}>
            <FastForward />
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={() => allCellAction("pause")}>
            <Pause />
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={() => allCellAction("refresh")}>
            <RefreshCw />
          </Button>
          <ButtonGroupSeparator />
          <Button type="button" variant="ghost" size="icon" onClick={() => allCellAction("unmute")}>
            <Volume2 />
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={() => allCellAction("mute")}>
            <VolumeX />
          </Button>
        </ButtonGroup>
        <Slider className="min-w-24 flex-1" min={0} max={100} step={1} value={[allVolume]} onValueChange={(value) => setAllVolume(Array.isArray(value) ? value[0] ?? 0 : value)} />
      </Field>
      <ScrollArea className="max-h-[min(52vh,28rem)]">
        {cells.length ? (
          <ItemGroup data-size="sm" className="pr-3">
            {cells.map((cell) => (
              <Item key={cell.id} variant="outline" size="sm" className="items-start">
                <ItemMedia>{renderAvatar(cell)}</ItemMedia>
                <ItemContent className="min-w-0 gap-2">
                  <ItemTitle className="max-w-full truncate">{cell.video?.title || cell.video?.channel?.name}</ItemTitle>
                  <ItemActions>
                    <ButtonGroup>
                      <Button type="button" variant="ghost" size="icon" onClick={() => cell.setPlaying(cell.editMode)}>
                        {cell.editMode ? <Play /> : <Pause />}
                      </Button>
                      {!cell.isTwitchVideo ? (
                        <Button type="button" variant="ghost" size="icon" onClick={() => cell.togglePlaybackRate()}>
                          <FastForward />
                        </Button>
                      ) : null}
                      <Button type="button" variant="ghost" size="icon" onClick={() => cell.refresh()}>
                        <RefreshCw />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => cell.deleteCell()}>
                        <Trash2 />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => cell.setMuted(!cell.muted)}>
                        {cell.muted ? <VolumeX /> : <Volume2 />}
                      </Button>
                    </ButtonGroup>
                    <Slider className="min-w-20 flex-1" min={0} max={100} step={1} value={[cell.volume]} onValueChange={(value) => cell.setVolume(Array.isArray(value) ? value[0] ?? 0 : value)} />
                  </ItemActions>
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
        ) : <div className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">{t("views.multiview.mediaControlsEmpty")}</div>}
      </ScrollArea>
      <Separator />
      <Field orientation="horizontal" className="rounded-lg border p-2.5">
        <Checkbox checked={store.muteOthers} onCheckedChange={(checked) => store.setMuteOthers(checked === true)} />
        <FieldContent>
          <FieldTitle>{t("views.multiview.muteOthers")}</FieldTitle>
          <FieldDescription>{t("views.multiview.muteOthersDetail")}</FieldDescription>
        </FieldContent>
      </Field>
    </FieldGroup>
  );
}
