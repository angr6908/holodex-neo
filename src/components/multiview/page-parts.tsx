"use client";

import {
  Check,
  Crosshair,
  Languages,
  MessageCircle,
  MessageSquare,
  Play,
  Radio,
  Save,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChannelImg } from "@/components/channel/ChannelImg";
import { CellControl } from "@/components/multiview/CellControl";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Empty } from "@/components/ui/empty";
import { FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Toggle } from "@/components/ui/toggle";
import { getVideoIDFromUrl } from "@/lib/functions";
import { useMultiviewStore, useOptionalMultiviewStore } from "@/lib/multiview-store";
import { asTwitchVideo, encodeLayout } from "@/lib/mv-utils";
import { cn } from "@/lib/utils";

// Tailwind v4 scans source for arbitrary-value class strings; arrays must stay literal.
const colStartClasses = [
  "",
  "col-start-[1]",
  "col-start-[2]",
  "col-start-[3]",
  "col-start-[4]",
  "col-start-[5]",
  "col-start-[6]",
  "col-start-[7]",
  "col-start-[8]",
  "col-start-[9]",
  "col-start-[10]",
  "col-start-[11]",
  "col-start-[12]",
  "col-start-[13]",
  "col-start-[14]",
  "col-start-[15]",
  "col-start-[16]",
  "col-start-[17]",
  "col-start-[18]",
  "col-start-[19]",
  "col-start-[20]",
  "col-start-[21]",
  "col-start-[22]",
  "col-start-[23]",
  "col-start-[24]",
];
const rowStartClasses = [
  "",
  "row-start-[1]",
  "row-start-[2]",
  "row-start-[3]",
  "row-start-[4]",
  "row-start-[5]",
  "row-start-[6]",
  "row-start-[7]",
  "row-start-[8]",
  "row-start-[9]",
  "row-start-[10]",
  "row-start-[11]",
  "row-start-[12]",
  "row-start-[13]",
  "row-start-[14]",
  "row-start-[15]",
  "row-start-[16]",
  "row-start-[17]",
  "row-start-[18]",
  "row-start-[19]",
  "row-start-[20]",
  "row-start-[21]",
  "row-start-[22]",
  "row-start-[23]",
  "row-start-[24]",
];
const colSpanClasses = [
  "",
  "col-span-[1]",
  "col-span-[2]",
  "col-span-[3]",
  "col-span-[4]",
  "col-span-[5]",
  "col-span-[6]",
  "col-span-[7]",
  "col-span-[8]",
  "col-span-[9]",
  "col-span-[10]",
  "col-span-[11]",
  "col-span-[12]",
  "col-span-[13]",
  "col-span-[14]",
  "col-span-[15]",
  "col-span-[16]",
  "col-span-[17]",
  "col-span-[18]",
  "col-span-[19]",
  "col-span-[20]",
  "col-span-[21]",
  "col-span-[22]",
  "col-span-[23]",
  "col-span-[24]",
];
const rowSpanClasses = [
  "",
  "row-span-[1]",
  "row-span-[2]",
  "row-span-[3]",
  "row-span-[4]",
  "row-span-[5]",
  "row-span-[6]",
  "row-span-[7]",
  "row-span-[8]",
  "row-span-[9]",
  "row-span-[10]",
  "row-span-[11]",
  "row-span-[12]",
  "row-span-[13]",
  "row-span-[14]",
  "row-span-[15]",
  "row-span-[16]",
  "row-span-[17]",
  "row-span-[18]",
  "row-span-[19]",
  "row-span-[20]",
  "row-span-[21]",
  "row-span-[22]",
  "row-span-[23]",
  "row-span-[24]",
];

const clamp = (v: number) => Math.max(1, Math.min(24, v));
export const gridAreaClass = (i: any) =>
  cn(
    colStartClasses[clamp(Number(i.x) + 1)],
    rowStartClasses[clamp(Number(i.y) + 1)],
    colSpanClasses[clamp(Number(i.w))],
    rowSpanClasses[clamp(Number(i.h))],
  );

function previewSizeClass(mobile: boolean, scale: number) {
  if (scale <= 0.3) return mobile ? "h-12 w-7" : "h-7 w-12";
  if (scale <= 0.55) return mobile ? "h-20 w-11" : "h-11 w-20";
  if (scale < 1) return mobile ? "h-[105.6px] w-[59.4px]" : "h-[59.4px] w-[105.6px]";
  return mobile ? "h-[192px] w-[108px]" : "h-[108px] w-[192px]";
}

export function LayoutPreview({
  layout = [],
  content = {},
  mobile = false,
  scale = 1,
}: {
  layout?: any[];
  content?: Record<string, any>;
  mobile?: boolean;
  scale?: number;
}) {
  return (
    <div className={previewSizeClass(mobile, scale)}>
      <AspectRatio
        ratio={mobile ? 9 / 16 : 16 / 9}
        className="overflow-hidden rounded border bg-card"
      >
        <div className="absolute inset-0 grid grid-cols-[repeat(24,minmax(0,1fr))] grid-rows-[repeat(24,minmax(0,1fr))]">
          {layout.map((item) => {
            const isChat = content?.[item.i]?.type === "chat";
            return (
              <div
                key={item.i}
                className={cn(
                  "flex items-center justify-center overflow-hidden rounded border bg-muted text-[0.55rem]",
                  isChat && "bg-secondary",
                  gridAreaClass(item),
                )}
              >
                {isChat ? <MessageSquare className="size-3" /> : null}
              </div>
            );
          })}
        </div>
      </AspectRatio>
    </div>
  );
}

// ---------- EmptyCell ----------

export function EmptyCell({
  item,
  onDelete,
  streamSelector,
  onSetChat,
  showDeleteControl = true,
}: {
  item: any;
  onDelete?: (id: string) => void;
  streamSelector?: React.ReactNode;
  onSetChat?: (id: string, initAsTL: boolean) => void;
  showDeleteControl?: boolean;
}) {
  const t = useTranslations();
  const store = useOptionalMultiviewStore();
  const setItemAsChat = (initAsTL: boolean) => {
    if (onSetChat) {
      onSetChat(item.i, initAsTL);
      return;
    }
    store?.setLayoutContentById({ id: item.i, content: { type: "chat", initAsTL } });
  };
  return (
    <div className="flex h-full max-h-full min-h-0 w-full grow basis-full shrink flex-col overflow-hidden">
      <Empty className="relative grow shrink basis-auto gap-0 overflow-hidden rounded-none p-0 md:p-0">
        <ButtonGroup className="absolute left-2 top-2 z-10">
          {streamSelector}
          <Toggle
            variant="outline"
            size="lg"
            aria-label={t("component.common.chat")}
            title={t("component.common.chat")}
            onPressedChange={() => setItemAsChat(false)}
          >
            <MessageCircle />
            {t("component.common.chat")}
          </Toggle>
          <Toggle
            variant="outline"
            size="lg"
            aria-label="TL"
            title="TL"
            onPressedChange={() => setItemAsChat(true)}
          >
            <Languages />
            TL
          </Toggle>
        </ButtonGroup>
      </Empty>
      {showDeleteControl ? (
        <CellControl playIcon={Play} className="mx-1 mb-2" onDelete={() => onDelete?.(item.i)} />
      ) : null}
    </div>
  );
}

// ---------- CellContainer ----------

export function CellContainer({
  item,
  editMode: editModeProp,
  disablePointerEvents = false,
  onSetContent,
  children,
}: {
  item: Record<string, any>;
  editMode?: boolean;
  disablePointerEvents?: boolean;
  onSetContent?: (id: string, content: any) => void;
  children: React.ReactNode;
}) {
  const store = useOptionalMultiviewStore();
  const [showDropOverlay, setShowDropOverlay] = useState(false);
  const [enterTarget, setEnterTarget] = useState<EventTarget | null>(null);
  const editMode = editModeProp ?? true;

  useEffect(() => {
    if (editMode) store?.unfreezeLayoutItem(item.i);
    else store?.freezeLayoutItem(item.i);
  }, [editMode, item.i, store?.freezeLayoutItem, store?.unfreezeLayoutItem]);

  const setContent = (content: any) => {
    if (onSetContent) {
      onSetContent(item.i, content);
      return;
    }
    if (store) {
      store.setLayoutContentById({ id: item.i, content });
      store.fetchVideoData();
    }
  };

  function drop(ev: React.DragEvent) {
    ev.preventDefault();
    setShowDropOverlay(false);
    const json = ev.dataTransfer.getData("application/json");
    if (json) {
      const video = JSON.parse(json);
      let v = video;
      if (video.type === "placeholder") {
        v = asTwitchVideo(video);
        if (!v) return;
      } else if (video.type !== "twitch" && !(video.id?.length === 11 && video.channel?.name)) {
        return;
      }
      setContent({ type: "video", id: v.id, video: v });
      return;
    }
    const v = getVideoIDFromUrl(ev.dataTransfer.getData("text")) as any;
    if (v?.id) setContent({ id: v.id, type: "video", video: v });
  }
  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 w-full min-w-0 flex-col content-stretch items-stretch justify-start overflow-hidden border bg-background bg-contain bg-center",
        disablePointerEvents && "pointer-events-none",
      )}
      onDrop={drop}
      onDragOver={(ev) => ev.preventDefault()}
      onDragLeave={(ev) => {
        if (enterTarget === ev.target) setShowDropOverlay(false);
      }}
      onDragEnter={(ev) => {
        setEnterTarget(ev.target);
        setShowDropOverlay(true);
      }}
    >
      {showDropOverlay ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-muted">
          <Crosshair className="size-7" />
        </div>
      ) : null}
      {children}
    </div>
  );
}

// ---------- LayoutChangePrompt ----------

export function LayoutChangePrompt({
  open,
  onOpenChange,
  cancelFn = () => {},
  confirmFn = () => {},
  defaultOverwrite = false,
  layoutPreview = { layout: [], content: {} },
}: {
  open: boolean;
  onOpenChange?: (value: boolean) => void;
  cancelFn?: (overwriteMerge: boolean) => void;
  confirmFn?: (overwriteMerge: boolean) => void;
  defaultOverwrite?: boolean;
  layoutPreview?: { layout: any[]; content: Record<string, any> };
}) {
  const t = useTranslations();
  const [overwriteMerge, setOverwriteMerge] = useState(defaultOverwrite);
  useEffect(() => {
    setOverwriteMerge(defaultOverwrite);
  }, [defaultOverwrite, open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px]">
        <DialogTitle>{t("views.multiview.confirmOverwrite")}</DialogTitle>
        <div className="mt-4 flex flex-col items-center justify-center gap-4 text-sm">
          <LayoutPreview layout={layoutPreview.layout} content={layoutPreview.content} />
          <Label className="w-full">
            <Checkbox
              checked={overwriteMerge}
              onCheckedChange={(checked) => setOverwriteMerge(checked === true)}
            />
            <span>{t("views.multiview.fillEmptyCells")}</span>
          </Label>
        </div>
        <DialogFooter className="mt-5 flex-row justify-end">
          <Button type="button" variant="ghost" onClick={() => confirmFn(overwriteMerge)}>
            {t("views.multiview.confirmOverwriteYes")}
          </Button>
          <Button type="button" variant="ghost" onClick={() => cancelFn(overwriteMerge)}>
            {t("views.library.deleteConfirmationCancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- PresetEditor ----------

export function PresetEditor({
  layout,
  content,
  onClose,
}: {
  layout: any[];
  content: Record<string, any>;
  onClose?: () => void;
}) {
  const t = useTranslations();
  const store = useMultiviewStore();
  const [name, setName] = useState("");
  const [autoLayout, setAutoLayout] = useState(false);
  const videoCells = useMemo(
    () => layout.filter((item) => !content[item.i] || content[item.i].type !== "chat").length,
    [layout, content],
  );
  const canSave =
    name.length > 0 &&
    !store.presetLayout.find((item: any) => item.name === name) &&
    layout.length > 0;
  function addPresetLayout() {
    const data = { layout: encodeLayout({ layout, contents: content }), name };
    store.addPresetLayout(data);
    if (autoLayout) store.setAutoLayout({ index: videoCells, encodedLayout: data.layout });
    onClose?.();
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-normal">
        {t("views.multiview.presetEditor.title")}
        <span className="text-xs font-normal text-muted-foreground">
          {t("component.channelInfo.videoCount", { arg0: videoCells })}
        </span>
      </div>
      <div className="flex justify-center">
        <LayoutPreview layout={layout} content={content} />
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={name}
          className="flex-1"
          placeholder={t("views.multiview.presetEditor.name")}
          onChange={(event) => setName(event.target.value)}
        />
        <Button
          variant="ghost"
          size="icon"
          disabled={!canSave}
          title={t("views.multiview.presetEditor.title")}
          onClick={addPresetLayout}
        >
          <Save />
        </Button>
      </div>
      <Label>
        <Checkbox
          checked={autoLayout}
          onCheckedChange={(checked) => setAutoLayout(checked === true)}
        />
        <span>{t("views.multiview.presetEditor.autoLayout")}</span>
      </Label>
    </div>
  );
}

// ---------- PresetSelector ----------

export function PresetSelector({ onSelected }: { onSelected?: (preset: any) => void }) {
  const t = useTranslations();
  const store = useMultiviewStore();
  const hasPresets = store.desktopGroups.some((group: any[]) => group?.length);
  const autoSet = new Set(store.autoLayout);
  const inAuto = (p: any) => autoSet.has(p.id);
  const selectPreset = (preset: any) => onSelected?.(preset);
  const removePreset = (p: any) => {
    const i = store.autoLayout.findIndex((l: any) => l === p.id);
    if (i >= 0) store.setAutoLayout({ index: i, encodedLayout: null });
    store.removePresetLayout(p.name);
  };
  const renderTile = (preset: any, showRemove: boolean) => (
    <Card
      key={preset.id || preset.name}
      size="sm"
      role="button"
      tabIndex={0}
      className="cursor-pointer gap-1 p-1.5 outline-none transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      onClick={() => selectPreset(preset)}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        selectPreset(preset);
      }}
    >
      <div className="flex justify-center">
        <LayoutPreview
          layout={preset.layout}
          content={preset.content}
          mobile={preset.portrait}
          scale={0.5}
        />
      </div>
      <div className="flex min-w-0 items-center gap-1">
        {inAuto(preset) ? <Check className="size-3 shrink-0 text-primary" /> : null}
        <span className="min-w-0 flex-1 truncate text-center text-xs leading-tight">
          {preset.name}
        </span>
        {showRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            title={t("views.multiview.preset.remove")}
            onClick={(e) => {
              e.stopPropagation();
              removePreset(preset);
            }}
          >
            <Trash2 />
          </Button>
        ) : null}
      </div>
    </Card>
  );
  return (
    <ScrollArea className="max-h-[min(64vh,26rem)] w-full overflow-hidden">
      <div className="space-y-3 p-2.5">
        {store.desktopGroups.map((g: any[], i: number) =>
          g?.length ? (
            <FieldSet key={`group-${i}`} className="gap-0">
              <div className="px-1.5 text-xs font-medium text-muted-foreground">
                {t("component.channelInfo.videoCount", { arg0: i })}
              </div>
              <div className="mt-1.5 grid grid-cols-3 gap-2 px-0.5">
                {g.map((p: any) => renderTile(p, !!p.custom))}
              </div>
            </FieldSet>
          ) : null,
        )}
        {!hasPresets ? (
          <div className="px-3 py-4 text-center text-sm text-muted-foreground">
            {t("views.multiview.preset.noPresets")}
          </div>
        ) : null}
      </div>
    </ScrollArea>
  );
}

// ---------- ReorderLayout ----------

export function ReorderLayout({ isActive = false }: { isActive?: boolean }) {
  const store = useMultiviewStore();
  const [draggingIdx, setDraggingIdx] = useState(-1);
  const container = useRef<HTMLDivElement | null>(null);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
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
    const br = container.current!.getBoundingClientRect();
    const unitX = x / (br.width / 24),
      unitY = y / (br.height / 24);
    const dropIdx = store.layout.findIndex(
      (it: any) => unitX >= it.x && unitX < it.x + it.w && unitY >= it.y && unitY < it.y + it.h,
    );
    if (dropIdx !== undefined) store.swapGridPosition({ id1: startIdx, id2: dropIdx });
    setDraggingIdx(-1);
  };
  const tileStyle = (item: any) => ({
    height: `${(item.h / 24) * 100}%`,
    left: `${(item.x / 24) * 100}%`,
    top: `${(item.y / 24) * 100}%`,
    width: `${(item.w / 24) * 100}%`,
  });
  const contentIcon = (c: any) => {
    if (!c) return null;
    if (c.type === "chat") return <MessageCircle className="size-6" />;
    if (c.video?.type === "twitch") return <Radio className="size-6" />;
    if (c.type === "video") return <ChannelImg channel={c.video?.channel} noLink rounded />;
    return null;
  };
  return (
    <div className="flex justify-center p-3">
      <AspectRatio
        ref={container}
        ratio={isMobile ? 9 / 16 : 16 / 9}
        className="w-[384px] max-w-full overflow-hidden rounded-lg bg-muted/30 max-[640px]:w-[216px]"
      >
        {store.layout.map((item: any, idx: number) => (
          <div
            key={item.i}
            className="absolute p-1"
            style={tileStyle(item)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const start = Number(e.dataTransfer.getData("index"));
              store.swapGridPosition({ id1: start, id2: idx });
              setDraggingIdx(-1);
            }}
          >
            <div
              className={cn(
                "flex size-full items-center justify-center overflow-hidden rounded-md bg-background/80 text-foreground shadow-sm",
                store.layoutContent[item.i]?.type === "chat" && "bg-secondary/80",
              )}
            >
              {store.layoutContent[item.i] ? (
                <div
                  draggable
                  className={cn(
                    "flex size-full cursor-move items-center justify-center p-3 [&_*]:cursor-move",
                    draggingIdx === idx && "opacity-0",
                  )}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("index", String(idx));
                    setDraggingIdx(idx);
                  }}
                  onDragEnd={() => setDraggingIdx(-1)}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    setDraggingIdx(idx);
                    onTouchMove(e);
                  }}
                  onTouchEnd={(e) => onTouchEnd(e, idx)}
                  onTouchMove={onTouchMove}
                  onTouchCancel={() => setDraggingIdx(-1)}
                >
                  {contentIcon(store.layoutContent[item.i])}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </AspectRatio>
    </div>
  );
}
