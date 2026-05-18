"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SquarePlus, Save, FastForward, Crosshair, SlidersVertical, TwitchIcon, Video, ReorderIcon } from "@/lib/icons";
import { useTranslations } from "next-intl";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Empty } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ChannelImg } from "@/components/channel/ChannelImg";
import { CellControl } from "@/components/multiview/CellControl";
import * as icons from "@/lib/icons";
import { useAppState } from "@/lib/store";
import { useMultiviewStore, useOptionalMultiviewStore } from "@/lib/multiview-store";
import { encodeLayout } from "@/lib/mv-utils";
import { getVideoIDFromUrl } from "@/lib/functions";
import { TWITCH_VIDEO_URL_REGEX } from "@/lib/consts";
import { cn } from "@/lib/utils";
// Tailwind v4 scans source for arbitrary-value class strings; arrays must stay literal.
const colStartClasses = ["", "col-start-[1]", "col-start-[2]", "col-start-[3]", "col-start-[4]", "col-start-[5]", "col-start-[6]", "col-start-[7]", "col-start-[8]", "col-start-[9]", "col-start-[10]", "col-start-[11]", "col-start-[12]", "col-start-[13]", "col-start-[14]", "col-start-[15]", "col-start-[16]", "col-start-[17]", "col-start-[18]", "col-start-[19]", "col-start-[20]", "col-start-[21]", "col-start-[22]", "col-start-[23]", "col-start-[24]"];
const rowStartClasses = ["", "row-start-[1]", "row-start-[2]", "row-start-[3]", "row-start-[4]", "row-start-[5]", "row-start-[6]", "row-start-[7]", "row-start-[8]", "row-start-[9]", "row-start-[10]", "row-start-[11]", "row-start-[12]", "row-start-[13]", "row-start-[14]", "row-start-[15]", "row-start-[16]", "row-start-[17]", "row-start-[18]", "row-start-[19]", "row-start-[20]", "row-start-[21]", "row-start-[22]", "row-start-[23]", "row-start-[24]"];
const colSpanClasses = ["", "col-span-[1]", "col-span-[2]", "col-span-[3]", "col-span-[4]", "col-span-[5]", "col-span-[6]", "col-span-[7]", "col-span-[8]", "col-span-[9]", "col-span-[10]", "col-span-[11]", "col-span-[12]", "col-span-[13]", "col-span-[14]", "col-span-[15]", "col-span-[16]", "col-span-[17]", "col-span-[18]", "col-span-[19]", "col-span-[20]", "col-span-[21]", "col-span-[22]", "col-span-[23]", "col-span-[24]"];
const rowSpanClasses = ["", "row-span-[1]", "row-span-[2]", "row-span-[3]", "row-span-[4]", "row-span-[5]", "row-span-[6]", "row-span-[7]", "row-span-[8]", "row-span-[9]", "row-span-[10]", "row-span-[11]", "row-span-[12]", "row-span-[13]", "row-span-[14]", "row-span-[15]", "row-span-[16]", "row-span-[17]", "row-span-[18]", "row-span-[19]", "row-span-[20]", "row-span-[21]", "row-span-[22]", "row-span-[23]", "row-span-[24]"];

const clamp = (v: number) => Math.max(1, Math.min(24, v));
export const gridAreaClass = (i: any) => cn(
  colStartClasses[clamp(Number(i.x) + 1)],
  rowStartClasses[clamp(Number(i.y) + 1)],
  colSpanClasses[clamp(Number(i.w))],
  rowSpanClasses[clamp(Number(i.h))],
);

function previewSizeClass(mobile: boolean, scale: number) {
  if (scale < 1) return mobile ? "h-[105.6px] w-[59.4px]" : "h-[59.4px] w-[105.6px]";
  return mobile ? "h-[192px] w-[108px]" : "h-[108px] w-[192px]";
}

export function LayoutPreview({ layout = [], content = {}, mobile = false, scale = 1 }: { layout?: any[]; content?: Record<string, any>; mobile?: boolean; scale?: number }) {
  return (
    <div className={previewSizeClass(mobile, scale)}>
      <AspectRatio ratio={mobile ? 9 / 16 : 16 / 9} className="overflow-hidden rounded border bg-card">
        <div className="absolute inset-0 grid grid-cols-[repeat(24,minmax(0,1fr))] grid-rows-[repeat(24,minmax(0,1fr))]">
          {layout.map((item) => {
            const isChat = content?.[item.i]?.type === "chat";
            return (
              <div key={item.i} className={cn("flex items-center justify-center overflow-hidden rounded border bg-muted text-[0.55rem]", isChat && "bg-secondary", gridAreaClass(item))}>
                {isChat ? <icons.MessageSquare className="size-3" /> : null}
              </div>
            );
          })}
        </div>
      </AspectRatio>
    </div>
  );
}

export function LayoutPreviewCard({ preset, custom = false, active = false, scale = 1, children, pre, post }: { preset: Record<string, any>; custom?: boolean; active?: boolean; scale?: number; children?: React.ReactNode; pre?: React.ReactNode; post?: React.ReactNode }) {
  return (
    <Card size="sm" className="block p-2">
      <LayoutPreview layout={preset.layout} content={preset.content} mobile={preset.portrait} scale={scale} />
      <div className="relative mt-2 flex items-center justify-center gap-2 text-center text-sm">
        {pre}
        <span className={cn("min-w-0 truncate", custom && "flex-grow", active && "text-primary")}>{children || preset.name}</span>
        {post}
      </div>
    </Card>
  );
}

// ---------- EmptyCell ----------

export function EmptyCell({ item, onDelete, onShowSelector, onSetChat }: { item: any; onDelete?: (id: string) => void; onShowSelector?: (id: string) => void; onSetChat?: (id: string, initAsTL: boolean) => void }) {
  const t = useTranslations();
  const store = useOptionalMultiviewStore();
  const setItemAsChat = (initAsTL: boolean) => {
    store?.setLayoutContentById({ id: item.i, content: { type: "chat", initAsTL } });
    onSetChat?.(item.i, initAsTL);
  };
  return (
    <div className="flex h-full max-h-full min-h-0 w-full grow basis-full shrink flex-col overflow-hidden pt-4">
      <Empty className="relative grow shrink basis-auto gap-0 overflow-hidden rounded-none p-0 md:p-0">
        <Button type="button" className="w-[190px]" size="lg" onClick={() => onShowSelector?.(item.i)}><Video className="size-5" />{t("views.multiview.video.selectLive")}</Button>
        <div className="mt-2 flex max-w-[190px] gap-2">
          <Button type="button" size="lg" variant="secondary" className="flex-1" onClick={() => setItemAsChat(false)}><icons.YtChatIcon className="size-5" />{t("component.common.chat")}</Button>
          <Button type="button" size="lg" variant="secondary" className="flex-1" onClick={() => setItemAsChat(true)}><icons.TlChatIcon className="size-5" />TL</Button>
        </div>
      </Empty>
      <CellControl playIcon={icons.Play} className="mx-1 mb-2" onDelete={() => onDelete?.(item.i)} />
    </div>
  );
}

// ---------- CellContainer ----------

export function CellContainer({ item, editMode: editModeProp, disablePointerEvents = false, onSetContent, children }: { item: Record<string, any>; editMode?: boolean; disablePointerEvents?: boolean; onSetContent?: (id: string, content: any) => void; children: React.ReactNode }) {
  const store = useOptionalMultiviewStore();
  const [showDropOverlay, setShowDropOverlay] = useState(false);
  const [enterTarget, setEnterTarget] = useState<EventTarget | null>(null);
  const editMode = editModeProp ?? store?.layoutContent[item.i]?.editMode ?? true;

  useEffect(() => {
    if (editMode) store?.unfreezeLayoutItem(item.i);
    else store?.freezeLayoutItem(item.i);
  }, [editMode, item.i, store?.freezeLayoutItem, store?.unfreezeLayoutItem]);

  const setContent = (content: any) => {
    if (store) { store.setLayoutContentById({ id: item.i, content }); store.fetchVideoData(); }
    onSetContent?.(item.i, content);
  };

  function drop(ev: React.DragEvent) {
    ev.preventDefault();
    setShowDropOverlay(false);
    const json = ev.dataTransfer.getData("application/json");
    if (json) {
      const video = JSON.parse(json);
      if (!(video.id?.length === 11 && video.channel?.name)) return;
      let v = video;
      if (video.type === "placeholder") {
        const tw = video.link?.match(TWITCH_VIDEO_URL_REGEX)?.groups?.id;
        if (!tw) return;
        v = { ...video, id: tw, type: "twitch" };
      }
      setContent({ type: "video", id: v.id, video: v });
      return;
    }
    const v = getVideoIDFromUrl(ev.dataTransfer.getData("text")) as any;
    if (v?.id) setContent({ id: v.id, type: "video", video: v });
  }
  return (
    <div className={cn("relative flex h-full flex-col content-stretch items-stretch justify-start border bg-background bg-contain bg-center", editMode && "ring-2 ring-ring", disablePointerEvents && "pointer-events-none")} onDrop={drop} onDragOver={(ev) => ev.preventDefault()} onDragLeave={(ev) => { if (enterTarget === ev.target) setShowDropOverlay(false); }} onDragEnter={(ev) => { setEnterTarget(ev.target); setShowDropOverlay(true); }}>
      {showDropOverlay ? <div className="absolute inset-0 z-20 flex items-center justify-center bg-muted"><Crosshair className="size-7" /></div> : null}
      {children}
    </div>
  );
}

// ---------- MultiviewBackground ----------

export function MultiviewBackground({ collapseToolbar = false, showTips = true }: { collapseToolbar?: boolean; showTips?: boolean }) {
  const t = useTranslations();
  return (
    <div className="pointer-events-none absolute inset-0 h-full w-full">
      {showTips ? (
        <div className="flex justify-center px-4 pt-[clamp(1rem,4vh,2.5rem)]">
          <Card className="block w-[min(100%,40rem)] max-[640px]:w-[min(100%,24rem)]">
            <div className="text-base font-normal leading-snug max-[640px]:text-[0.95rem]">{collapseToolbar ? t("views.multiview.openToolbarTip") : t("views.multiview.autoLayoutTip")}</div>
            {!collapseToolbar ? <div className="mt-2 leading-snug text-muted-foreground">{t("views.multiview.createLayoutTip")}</div> : null}
            <Separator className="my-4" />
            <div className="space-y-2.5">
              <div className="font-normal">{t("views.multiview.hints")}</div>
              <div className="flex flex-wrap items-center gap-1 font-normal">1. <icons.Grid2x2 className="size-4" /> {t("views.multiview.presetsHint")}</div>
              <div className="flex flex-wrap items-center gap-1 font-normal">2. <SlidersVertical className="size-4" /> {t("views.multiview.mediaControlsHint1")} <FastForward className="size-4" /> {t("views.multiview.mediaControlsHint2")}</div>
              <div className="flex flex-wrap items-center gap-1 font-normal">3. <SquarePlus className="size-4" /> {t("views.multiview.dragDropHint")}</div>
              <div className="flex flex-wrap items-center gap-1 font-normal">4. <ReorderIcon className="size-4" /> {t("views.multiview.reorderHint")}</div>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

// ---------- LayoutChangePrompt ----------

export function LayoutChangePrompt({ open, onOpenChange, cancelFn = () => {}, confirmFn = () => {}, defaultOverwrite = false, layoutPreview = { layout: [], content: {} } }: { open: boolean; onOpenChange?: (value: boolean) => void; cancelFn?: (overwriteMerge: boolean) => void; confirmFn?: (overwriteMerge: boolean) => void; defaultOverwrite?: boolean; layoutPreview?: { layout: any[]; content: Record<string, any> } }) {
  const t = useTranslations();
  const [overwriteMerge, setOverwriteMerge] = useState(defaultOverwrite);
  useEffect(() => { setOverwriteMerge(defaultOverwrite); }, [defaultOverwrite, open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px]">
          <DialogTitle>{t("views.multiview.confirmOverwrite")}</DialogTitle>
          <div className="mt-4 flex flex-col items-center justify-center gap-4 text-sm">
            <LayoutPreview layout={layoutPreview.layout} content={layoutPreview.content} />
            <Label className="w-full">
              <Checkbox checked={overwriteMerge} onCheckedChange={(checked) => setOverwriteMerge(checked === true)} />
              <span>{t("views.multiview.fillEmptyCells")}</span>
            </Label>
          </div>
          <DialogFooter className="mt-5 flex-row justify-end">
            <Button type="button" variant="secondary" onClick={() => confirmFn(overwriteMerge)}>{t("views.multiview.confirmOverwriteYes")}</Button>
            <Button type="button" variant="ghost" onClick={() => cancelFn(overwriteMerge)}>{t("views.library.deleteConfirmationCancel")}</Button>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- PresetEditor ----------

export function PresetEditor({ layout, content, onClose }: { layout: any[]; content: Record<string, any>; onClose?: () => void }) {
  const t = useTranslations();
  const store = useMultiviewStore();
  const [name, setName] = useState("");
  const [autoLayout, setAutoLayout] = useState(false);
  const videoCells = useMemo(() => layout.filter((item) => !content[item.i] || content[item.i].type !== "chat").length, [layout, content]);
  const canSave = name.length > 0 && !store.presetLayout.find((item: any) => item.name === name) && layout.length > 0;
  function addPresetLayout() {
    const data = { layout: encodeLayout({ layout, contents: content }), name };
    store.addPresetLayout(data);
    if (autoLayout) store.setAutoLayout({ index: videoCells, encodedLayout: data.layout });
    onClose?.();
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold">{t("views.multiview.presetEditor.title")}<span className="text-xs font-normal text-muted-foreground">{t("component.channelInfo.videoCount", { arg0: videoCells })}</span></div>
      <div className="flex justify-center"><LayoutPreview layout={layout} content={content} /></div>
      <div className="flex items-center gap-2"><Input value={name} className="flex-1" placeholder={t("views.multiview.presetEditor.name")} onChange={(event) => setName(event.target.value)} /><Button size="icon" disabled={!canSave} title={t("views.multiview.presetEditor.title")} onClick={addPresetLayout}><Save className="size-4" /></Button></div>
      <Label>
        <Checkbox checked={autoLayout} onCheckedChange={(checked) => setAutoLayout(checked === true)} />
        <span>{t("views.multiview.presetEditor.autoLayout")}</span>
      </Label>
    </div>
  );
}

// ---------- PresetSelector ----------

export function PresetSelector({ onSelected }: { onSelected?: (preset: any) => void }) {
  const t = useTranslations();
  const store = useMultiviewStore();
  const autoSet = new Set(store.autoLayout);
  const inAuto = (p: any) => autoSet.has(p.id);
  const removePreset = (p: any) => {
    const i = store.autoLayout.findIndex((l: any) => l === p.id);
    if (i >= 0) store.setAutoLayout({ index: i, encodedLayout: null });
    store.removePresetLayout(p.name);
  };
  const tileClass = (active: boolean) => cn("h-auto w-full flex-col cursor-pointer whitespace-normal", active && "font-medium");
  const renderTile = (preset: any, showRemove: boolean) => (
    <div key={preset.id || preset.name} className="relative">
      <Button type="button" variant="ghost" className={tileClass(inAuto(preset))} onClick={() => onSelected?.(preset)}>
        <LayoutPreviewCard preset={preset} active={inAuto(preset)} scale={0.55} />
      </Button>
      {showRemove ? <Button type="button" variant="ghost" size="icon-xs" className="absolute right-1 top-1" onClick={(e) => { e.stopPropagation(); removePreset(preset); }}><icons.Trash2 className="size-3.5" /></Button> : null}
    </div>
  );
  return (
    <ScrollArea className="max-h-[min(80vh,600px)] w-[min(36rem,calc(100vw-2rem))]">
      <div className="p-2">
        {store.desktopGroups.map((g: any[], i: number) => g?.length ? (
          <div key={`group-${i}`} className="mb-1">
            <div className="px-2 pb-1.5 pt-2 text-[0.68rem] font-medium uppercase tracking-widest text-muted-foreground">{t("component.channelInfo.videoCount", { arg0: i })}</div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-1.5 px-1">
              {g.map((p: any) => renderTile(p, !!p.custom))}
            </div>
          </div>
        ) : null)}
        {store.decodedCustomPresets.length ? (
          <div className="mb-1">
            <div className="px-2 pb-1.5 pt-2 text-[0.68rem] font-medium uppercase tracking-widest text-muted-foreground">{t("views.multiview.preset.custom")}</div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-1.5 px-1">
              {store.decodedCustomPresets.map((p: any) => renderTile(p, true))}
            </div>
          </div>
        ) : null}
        {!store.desktopGroups.length && !store.decodedCustomPresets.length ? <div className="px-3 py-4 text-center text-sm text-muted-foreground">{t("views.multiview.preset.noPresets")}</div> : null}
      </div>
    </ScrollArea>
  );
}

// ---------- ReorderLayout ----------

export function ReorderLayout({ isActive = false }: { isActive?: boolean }) {
  const t = useTranslations();
  const store = useMultiviewStore();
  const [draggingIdx, setDraggingIdx] = useState(-1);
  const container = useRef<HTMLDivElement | null>(null);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const size = { width: 2 * (isMobile ? 108 : 192), height: 2 * (isMobile ? 192 : 108) };
  if (!isActive) return null;
  const relativePoint = (t: React.Touch) => {
    const br = container.current!.getBoundingClientRect();
    return { x: t.clientX - br.left, y: t.clientY - br.top };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
  };
  const onTouchEnd = (e: React.TouchEvent, startIdx: number) => {
    e.preventDefault();
    const { x, y } = relativePoint(e.changedTouches[0]);
    const unitX = x / (size.width / 24), unitY = y / (size.height / 24);
    const dropIdx = store.layout.findIndex((it: any) => unitX >= it.x && unitX < it.x + it.w && unitY >= it.y && unitY < it.y + it.h);
    if (dropIdx !== undefined) store.swapGridPosition({ id1: startIdx, id2: dropIdx });
    setDraggingIdx(-1);
  };
  const contentIcon = (c: any) => !c ? null
    : c.type === "chat" ? <icons.YtChatIcon className="size-6" />
    : c.video?.type === "twitch" ? <TwitchIcon className="size-6" />
    : c.type === "video" ? <ChannelImg channel={c.video?.channel} noLink rounded /> : null;
  return (
    <div>
      <div className="text-sm font-semibold">{t("views.multiview.reorderLayout")}</div>
      <div className="mt-2 text-xs text-muted-foreground">{t("views.multiview.reorderLayoutDetail")}</div>
      <Card ref={container} className="relative m-auto mt-3 grid h-[216px] w-[384px] grid-cols-[repeat(24,minmax(0,1fr))] grid-rows-[repeat(24,minmax(0,1fr))] gap-0 overflow-hidden p-0 max-[640px]:h-[384px] max-[640px]:w-[216px]">
        {store.layout.map((item: any, idx: number) => (
          <div key={item.i} className={cn("flex items-center justify-center overflow-hidden rounded border border-border bg-muted text-foreground", store.layoutContent[item.i]?.type === "chat" && "bg-secondary", gridAreaClass(item))} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const start = Number(e.dataTransfer.getData("index")); store.swapGridPosition({ id1: start, id2: idx }); setDraggingIdx(-1); }}>
            {store.layoutContent[item.i]
              ? <div draggable className={cn("cursor-move p-3 [&_*]:cursor-move", draggingIdx === idx && "opacity-0")} onDragStart={(e) => { e.dataTransfer.setData("index", String(idx)); setDraggingIdx(idx); }} onDragEnd={() => setDraggingIdx(-1)} onTouchStart={(e) => { e.preventDefault(); setDraggingIdx(idx); onTouchMove(e); }} onTouchEnd={(e) => onTouchEnd(e, idx)} onTouchMove={onTouchMove} onTouchCancel={() => setDraggingIdx(-1)}>{contentIcon(store.layoutContent[item.i])}</div>
              : null}
          </div>
        ))}
      </Card>
    </div>
  );
}
