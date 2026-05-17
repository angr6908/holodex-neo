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
// ---------- LayoutPreview ----------

const pctOf24 = (n: number) => `${n * (100 / 24)}%`;

export function LayoutPreview({ layout = [], content = {}, mobile = false, scale = 1 }: { layout?: any[]; content?: Record<string, any>; mobile?: boolean; scale?: number }) {
  const app = useAppState();
  const isLight = !app.settings.darkMode;
  const width = scale * (mobile ? 108 : 192);
  const height = scale * (mobile ? 192 : 108);
  const palette = isLight
    ? { info: "rgba(56, 189, 248, 0.28)", warning: "rgba(251, 191, 36, 0.3)" }
    : { info: "rgba(56, 189, 248, 0.24)", warning: "rgba(251, 191, 36, 0.28)" };
  return (
    <div style={{ width, height }}>
      <AspectRatio ratio={mobile ? 9 / 16 : 16 / 9} className={`overflow-hidden rounded border-2 ${isLight ? "border-slate-300 bg-slate-100" : "border-slate-600 bg-slate-950/80"}`}>
        {layout.map((item) => {
          const isChat = content?.[item.i]?.type === "chat";
          return (
            <div key={item.i} className={`absolute flex items-center justify-center overflow-hidden rounded border text-[0.55rem] ${isLight ? "border-slate-300 text-slate-950" : "border-slate-950/60 text-white/90"}`} style={{ top: pctOf24(item.y), left: pctOf24(item.x), width: pctOf24(item.w), height: pctOf24(item.h), backgroundColor: isChat ? palette.warning : palette.info }}>
              {isChat ? <span>💬</span> : null}
            </div>
          );
        })}
      </AspectRatio>
    </div>
  );
}

export function LayoutPreviewCard({ preset, custom = false, active = false, scale = 1, children, pre, post }: { preset: Record<string, any>; custom?: boolean; active?: boolean; scale?: number; children?: React.ReactNode; pre?: React.ReactNode; post?: React.ReactNode }) {
  return (
    <Card className="block rounded-[calc(var(--radius)+4px)] border-0 bg-transparent p-2 text-inherit shadow-none">
      <LayoutPreview layout={preset.layout} content={preset.content} mobile={preset.portrait} scale={scale} />
      <div className="relative mt-2 flex items-center justify-center gap-2 text-center text-sm">
        {pre}
        <span className={cn("min-w-0 truncate", custom && "flex-grow", active && "text-sky-300")}>{children || preset.name}</span>
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
        <Button type="button" className="w-[190px] bg-indigo-600 text-white hover:brightness-110" size="lg" onClick={() => onShowSelector?.(item.i)}><Video className="size-5" />{t("views.multiview.video.selectLive")}</Button>
        <div className="mt-2 flex max-w-[190px] gap-2">
          <Button type="button" size="lg" className="flex-1 bg-teal-600 text-white hover:brightness-110" onClick={() => setItemAsChat(false)}><icons.YtChatIcon className="size-5" />{t("component.common.chat")}</Button>
          <Button type="button" size="lg" className="flex-1 bg-teal-600 text-white hover:brightness-110" onClick={() => setItemAsChat(true)}><icons.TlChatIcon className="size-5" />TL</Button>
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
      if (video.id?.length === 11 && video.channel?.name) {
        let v = video;
        if (video.type === "placeholder") {
          const twitchChannel = video.link?.match(TWITCH_VIDEO_URL_REGEX)?.groups?.id;
          if (!twitchChannel) return;
          v = { ...video, id: twitchChannel, type: "twitch" };
        }
        setContent({ type: "video", id: v.id, video: v });
      }
      return;
    }
    const video = getVideoIDFromUrl(ev.dataTransfer.getData("text")) as any;
    if (video?.id) setContent({ id: video.id, type: "video", video });
  }
  return (
    <div className={`relative flex h-full flex-col content-stretch items-stretch justify-start border border-pink-400/10 bg-slate-950/55 bg-contain bg-center backdrop-blur-sm ${editMode ? "border-transparent shadow-[inset_0_0_0_2px_var(--color-secondary)]" : ""} ${disablePointerEvents ? "pointer-events-none" : ""}`} onDrop={drop} onDragOver={(ev) => ev.preventDefault()} onDragLeave={(ev) => { if (enterTarget === ev.target) setShowDropOverlay(false); }} onDragEnter={(ev) => { setEnterTarget(ev.target); setShowDropOverlay(true); }}>
      {showDropOverlay ? <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/72 backdrop-blur-sm"><Crosshair className="size-7 text-sky-200" /></div> : null}
      {children}
    </div>
  );
}

// ---------- MultiviewBackground ----------

export function MultiviewBackground({ collapseToolbar = false, showTips = true, style }: { collapseToolbar?: boolean; showTips?: boolean; style?: React.CSSProperties }) {
  const t = useTranslations();
  return (
    <div className="pointer-events-none absolute inset-0 h-full w-full bg-[linear-gradient(to_right,rgba(128,128,128,0.15)_1px,transparent_1px),linear-gradient(to_bottom,rgba(128,128,128,0.15)_1px,transparent_1px)] bg-repeat opacity-75" style={style}>
      {showTips ? (
        <div className="flex justify-center px-4 pt-[clamp(1rem,4vh,2.5rem)]">
          <Card className="block w-[min(100%,40rem)] rounded-2xl border-white/10 bg-slate-950/80 p-5 pb-4 text-slate-200 shadow-2xl backdrop-blur-sm max-[640px]:w-[min(100%,24rem)] max-[640px]:p-4">
            <div className="text-base font-normal leading-snug max-[640px]:text-[0.95rem]">{collapseToolbar ? t("views.multiview.openToolbarTip") : t("views.multiview.autoLayoutTip")}</div>
            {!collapseToolbar ? <div className="mt-2 leading-snug text-slate-300">{t("views.multiview.createLayoutTip")}</div> : null}
            <Separator className="my-4 bg-white/10" />
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
      <DialogContent className="max-w-[400px] p-0">
        <Card className="border-0 bg-transparent p-5 shadow-none">
          <DialogTitle className="leading-7 text-white">{t("views.multiview.confirmOverwrite")}</DialogTitle>
          <div className="mt-4 flex flex-col items-center justify-center gap-4 text-sm text-slate-200">
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
        </Card>
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
      <div className="flex items-center gap-2 text-sm font-semibold text-white">{t("views.multiview.presetEditor.title")}<span className="text-xs font-normal text-slate-400">{t("component.channelInfo.videoCount", { arg0: videoCells })}</span></div>
      <div className="flex justify-center"><LayoutPreview layout={layout} content={content} /></div>
      <div className="flex items-center gap-2"><Input value={name} className="flex-1" placeholder={t("views.multiview.presetEditor.name")} onChange={(event) => setName(event.target.value)} /><Button size="icon" className="rounded-xl" disabled={!canSave} title={t("views.multiview.presetEditor.title")} onClick={addPresetLayout}><Save className="size-4" /></Button></div>
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
  const autoLayoutSet = new Set(store.autoLayout);
  const presetInAuto = (p: any) => autoLayoutSet.has(p.id);
  function removePreset(p: any) {
    const idx = store.autoLayout.findIndex((l: any) => l === p.id);
    if (idx >= 0) store.setAutoLayout({ index: idx, encodedLayout: null });
    store.removePresetLayout(p.name);
  }
  const presetTileClass = (active: boolean) =>
    `h-auto w-full flex-col cursor-pointer rounded-lg border p-1 font-normal whitespace-normal text-inherit transition hover:text-inherit ${active ? "border-sky-400/40 bg-sky-500/10" : "border-white/8 bg-white/3 hover:border-white/14 hover:bg-white/7"}`;
  const removeBtnClass = "absolute right-1 top-1 size-5 rounded-md bg-black/40 p-0 text-slate-400 transition hover:bg-red-500/30 hover:text-red-300";
  return (
    <ScrollArea className="max-h-[min(80vh,600px)] w-[min(36rem,calc(100vw-2rem))]">
      <div className="p-2">
        {store.desktopGroups.length ? store.desktopGroups.map((group: any[], index: number) => group?.length ? (
          <div key={`group-${index}`} className="mb-1">
            <div className="px-2 pb-1.5 pt-2 text-[0.68rem] font-medium uppercase tracking-widest text-[color:var(--color-muted-foreground)]">{t("component.channelInfo.videoCount", { arg0: index })}</div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-1.5 px-1">
              {group.map((preset: any) => (
                <div key={preset.id || preset.name} className="relative">
                  <Button type="button" variant="ghost" className={presetTileClass(presetInAuto(preset))} onClick={() => onSelected?.(preset)}>
                    <LayoutPreviewCard preset={preset} active={presetInAuto(preset)} scale={0.55} />
                  </Button>
                  {preset.custom ? <Button type="button" variant="ghost" size="icon-xs" className={removeBtnClass} onClick={(event) => { event.stopPropagation(); removePreset(preset); }}><icons.Trash2 className="size-3.5" /></Button> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null) : null}
        {store.decodedCustomPresets.length ? (
          <div className="mb-1">
            <div className="px-2 pb-1.5 pt-2 text-[0.68rem] font-medium uppercase tracking-widest text-[color:var(--color-muted-foreground)]">{t("views.multiview.preset.custom")}</div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-1.5 px-1">
              {store.decodedCustomPresets.map((preset: any) => (
                <div key={preset.id || preset.name} className="relative">
                  <Button type="button" variant="ghost" className={presetTileClass(presetInAuto(preset))} onClick={() => onSelected?.(preset)}>
                    <LayoutPreviewCard preset={preset} active={presetInAuto(preset)} scale={0.55} />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-xs" className={removeBtnClass} onClick={(event) => { event.stopPropagation(); removePreset(preset); }}><icons.Trash2 className="size-3.5" /></Button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {!store.desktopGroups.length && !store.decodedCustomPresets.length ? <div className="px-3 py-4 text-center text-sm text-slate-400">{t("views.multiview.preset.noPresets")}</div> : null}
      </div>
    </ScrollArea>
  );
}

// ---------- ReorderLayout ----------

export function ReorderLayout({ isActive = false }: { isActive?: boolean }) {
  const t = useTranslations();
  const store = useMultiviewStore();
  const [draggingIdx, setDraggingIdx] = useState(-1);
  const [dragPos, setDragPos] = useState<{ left: string | number; top: string | number }>({ left: 0, top: 0 });
  const container = useRef<HTMLDivElement | null>(null);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const size = { width: 2 * (isMobile ? 108 : 192), height: 2 * (isMobile ? 192 : 108) };
  const touchContent = draggingIdx >= 0 ? store.layoutContent[store.layout[draggingIdx]?.i] : null;
  if (!isActive) return null;
  const relativePoint = (t: React.Touch) => {
    const br = container.current!.getBoundingClientRect();
    return { x: t.clientX - br.left, y: t.clientY - br.top };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    const { x, y } = relativePoint(e.changedTouches[0]);
    setDragPos({ left: `${x}px`, top: `${y}px` });
  };
  const onTouchEnd = (e: React.TouchEvent, startIdx: number) => {
    e.preventDefault();
    const { x, y } = relativePoint(e.changedTouches[0]);
    const unitX = x / (size.width / 24), unitY = y / (size.height / 24);
    const dropIdx = store.layout.findIndex((it: any) => unitX >= it.x && unitX < it.x + it.w && unitY >= it.y && unitY < it.y + it.h);
    if (dropIdx !== undefined) store.swapGridPosition({ id1: startIdx, id2: dropIdx });
    setDraggingIdx(-1);
  };
  const styleOf = (item: any) => ({
    top: pctOf24(item.y), left: pctOf24(item.x), width: pctOf24(item.w), height: pctOf24(item.h),
    backgroundColor: store.layoutContent[item.i]?.type === "chat" ? "rgba(245, 158, 11, 0.27)" : "rgba(14, 165, 233, 0.27)",
  });
  const contentIcon = (c: any) => !c ? null
    : c.type === "chat" ? <icons.YtChatIcon className="size-6" />
    : c.video?.type === "twitch" ? <TwitchIcon className="size-6" />
    : c.type === "video" ? <ChannelImg channel={c.video?.channel} noLink rounded /> : null;
  return (
    <div>
      <div className="text-sm font-semibold text-white">{t("views.multiview.reorderLayout")}</div>
      <div className="mt-2 text-xs text-slate-300">{t("views.multiview.reorderLayoutDetail")}</div>
      <Card ref={container} className="relative m-auto mt-3 block gap-0 overflow-hidden rounded border-2 border-slate-600 bg-slate-950/80 p-0 text-popover-foreground shadow-none" style={{ width: size.width, height: size.height }}>
        {store.layout.map((item: any, idx: number) => (
          <div key={item.i} className="absolute flex items-center justify-center overflow-hidden rounded border border-slate-950/60 text-white/90" style={styleOf(item)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const start = Number(e.dataTransfer.getData("index")); store.swapGridPosition({ id1: start, id2: idx }); setDraggingIdx(-1); }}>
            {store.layoutContent[item.i]
              ? <div draggable className="cursor-move p-3 [&_*]:cursor-move" style={{ opacity: draggingIdx !== idx ? 1 : 0 }} onDragStart={(e) => { e.dataTransfer.setData("index", String(idx)); setDraggingIdx(idx); }} onDragEnd={() => setDraggingIdx(-1)} onTouchStart={(e) => { e.preventDefault(); setDraggingIdx(idx); onTouchMove(e); }} onTouchEnd={(e) => onTouchEnd(e, idx)} onTouchMove={onTouchMove} onTouchCancel={() => setDraggingIdx(-1)}>{contentIcon(store.layoutContent[item.i])}</div>
              : null}
          </div>
        ))}
        {draggingIdx >= 0 && touchContent ? <div style={{ position: "absolute", touchAction: "none", ...dragPos }}>{contentIcon(touchContent)}</div> : null}
      </Card>
    </div>
  );
}
