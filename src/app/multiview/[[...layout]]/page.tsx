"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { SquarePlus, Save, RefreshCw, SlidersVertical, Grid2x2, ReorderIcon } from "@/lib/icons";
import { api } from "@/lib/api";
import { TWITCH_VIDEO_URL_REGEX } from "@/lib/consts";
import { decodeLayout } from "@/lib/mv-utils";
import { useTranslations } from "next-intl";
import { useAppState } from "@/lib/store";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MultiviewProvider, useMultiviewStore } from "@/lib/multiview-store";
import { MultiviewVideoCellsProvider } from "@/lib/multiview-video-cells";
import { addCellAutoLayout, addVideoAutoLayout, addVideoWithId, deleteVideoAutoLayout, findEmptyCell, setMultiview, tryFillVideo } from "@/lib/multiview-layout";
import { ChatCell } from "@/components/multiview/ChatCell";
import { VideoCell } from "@/components/multiview/VideoCell";
import { MultiviewToolbar } from "@/components/multiview/MultiviewToolbar";
import { VideoSelector } from "@/components/multiview/VideoSelector";
import { MediaControls } from "@/components/multiview/MediaControls";
import { CellContainer, EmptyCell, LayoutChangePrompt, MultiviewBackground, PresetEditor, PresetSelector, ReorderLayout } from "@/components/multiview/page-parts";
import { MultiviewSyncBar } from "@/components/multiview/MultiviewSyncBar";
import * as icons from "@/lib/icons";
import { calcGridPosition, calcGridWH, calcGridXY, cloneLayoutItem, compact, getAllCollisions, getLayoutItem, moveElement } from "@/lib/vue-grid-layout-utils";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
const FIXED_CHAT_CELL_WIDTH = 300;
const RESIZE_DIRECTIONS = ["s", "w", "e", "n", "sw", "nw", "se", "ne"];

type GridInteraction = {
  type: "drag" | "resize";
  id: string;
  direction?: string;
  startClientX: number;
  startClientY: number;
  startItem: any;
  startPixel: { left: number; top: number; width: number; height: number };
};

export default function MultiViewPage() {
  const params = useParams<{ layout?: string[] }>();
  const layoutParam = Array.isArray(params.layout) ? decodeURIComponent(params.layout.join("/")) : "";
  return <MultiviewProvider><MultiviewVideoCellsProvider><MultiViewContent routeLayout={layoutParam} /></MultiviewVideoCellsProvider></MultiviewProvider>;
}

function MultiViewContent({ routeLayout }: { routeLayout: string }) {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const app = useAppState();
  const store = useMultiviewStore();
  const [showSelectorForId, setShowSelectorForId] = useState<string | number>(-1);
  const [showSyncBar, setShowSyncBar] = useState(false);
  const [showReorderLayout, setShowReorderLayout] = useState(false);
  const [overwriteDialog, setOverwriteDialog] = useState(false);
  const [overwriteMerge, setOverwriteMerge] = useState(false);
  const [overwriteLayoutPreview, setOverwriteLayoutPreview] = useState<any>({ layout: [], content: {} });
  const overwriteConfirm = useRef<((merge: boolean) => void) | null>(null);
  const overwriteCancel = useRef<((merge: boolean) => void) | null>(null);
  const [collapseToolbar, setCollapseToolbar] = useState(false);
  const [stageWidth, setStageWidth] = useState(1440);
  const [stageHeight, setStageHeight] = useState(900);
  const [showPresetSelectorMenu, setShowPresetSelectorMenu] = useState(false);
  const [showPresetEditor, setShowPresetEditor] = useState(false);
  const [showMediaControls, setShowMediaControls] = useState(false);
  const gridStage = useRef<HTMLDivElement | null>(null);
  const layoutRef = useRef(store.layout);
  const interactionRef = useRef<GridInteraction | null>(null);
  const [activeInteraction, setActiveInteraction] = useState<GridInteraction | null>(null);
  const [activePixel, setActivePixel] = useState<{ id: string; style: React.CSSProperties } | null>(null);

  const viewportWidth = app.windowWidth || (typeof window !== "undefined" ? window.innerWidth : 1440);
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 900;
  const isXs = viewportWidth < 600;
  const isSmAndDown = viewportWidth < 960;
  const isMdAndDown = viewportWidth < 1264;
  const rowHeight = (stageHeight || viewportHeight) / 24.0;
  const gridRowHeight = Math.max(rowHeight, 1);
  const columnWidth = (stageWidth || viewportWidth) / 24.0;
  const showVideoSelector = showSelectorForId !== -1;

  useEffect(() => {
    layoutRef.current = store.layout;
  }, [store.layout]);

  const chatColumnSpans = useMemo(() => {
    const baseStageWidth = stageWidth || viewportWidth || 0;
    const spans: any[] = [];
    const seen = new Set<string>();
    store.layout.forEach((item) => {
      if (store.layoutContent[item.i]?.type !== "chat" || !item.w) return;
      const key = `${item.x}:${item.w}`;
      if (seen.has(key)) return;
      seen.add(key);
      spans.push({ key, x: item.x, w: item.w });
    });
    if (!spans.length) return [];
    const perSpanWidth = Math.min(FIXED_CHAT_CELL_WIDTH, Math.floor(baseStageWidth / Math.max(spans.length + 1, 2)));
    return spans.map((span) => ({ ...span, width: perSpanWidth }));
  }, [store.layout, store.layoutContent, stageWidth, viewportWidth]);

  const remappedColumnWidths = useMemo(() => {
    const widths = Array.from({ length: 24 }, () => columnWidth);
    if (!chatColumnSpans.length) return widths;
    const reservedCols = chatColumnSpans.reduce((sum, span) => sum + span.w, 0);
    const reservedWidth = chatColumnSpans.reduce((sum, span) => sum + span.width, 0);
    const flexibleCols = Math.max(24 - reservedCols, 1);
    const flexibleWidth = Math.max((stageWidth || viewportWidth || 0) - reservedWidth, 0);
    const baseWidth = flexibleWidth / flexibleCols;
    for (let col = 0; col < 24; col += 1) widths[col] = baseWidth;
    chatColumnSpans.forEach((span) => {
      const colWidth = span.width / span.w;
      for (let col = span.x; col < span.x + span.w; col += 1) widths[col] = colWidth;
    });
    return widths;
  }, [columnWidth, chatColumnSpans, stageWidth, viewportWidth]);

  useEffect(() => { document.title = `${t("component.mainNav.multiview")} - Holodex`; }, [t]);
  useEffect(() => {
    if (routeLayout) {
      try {
        const parsed = decodeLayout(routeLayout);
        if (parsed.layout && parsed.content) {
          try {
            api.trackMultiviewLink(routeLayout).catch(console.error);
          } catch {}
          promptLayoutChange(parsed, null, () => history.pushState({}, "", "/multiview"));
        }
      } catch (e) {
        console.error(e);
      }
      if (searchParams.get("t") || searchParams.get("offsets")) setShowSyncBar(true);
    } else {
      store.fetchVideoData({ refreshLive: true });
    }
  }, []);
  useEffect(() => {
    function syncStageMetrics() {
      const stage = gridStage.current;
      if (!stage) return;
      setStageWidth(stage.clientWidth || viewportWidth);
      setStageHeight(stage.clientHeight || viewportHeight);
    }
    syncStageMetrics();
    if (!window.ResizeObserver || !gridStage.current) return;
    const observer = new ResizeObserver(syncStageMetrics);
    observer.observe(gridStage.current);
    return () => observer.disconnect();
  }, [viewportWidth, viewportHeight, collapseToolbar]);
  const itemPixelWidth = (item: any) => remappedColumnWidths.slice(item.x, item.x + item.w).reduce((a, b) => a + b, 0);
  const itemPixelLeft = (item: any) => remappedColumnWidths.slice(0, item.x).reduce((a, b) => a + b, 0);
  const posStyle = (left: number, top: number, width: number, height: number): React.CSSProperties =>
    ({ left: "0px", top: "0px", width: `${Math.round(width)}px`, height: `${Math.round(height)}px`, transform: `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`, position: "absolute" });
  const itemStyle = (item: any) => posStyle(itemPixelLeft(item), rowHeight * item.y, itemPixelWidth(item), gridRowHeight * item.h);
  const equalGridItemStyle = (item: any) => posStyle(columnWidth * item.x, gridRowHeight * item.y, columnWidth * item.w, gridRowHeight * item.h);
  const pixelStyle = (rect: { left: number; top: number; width: number; height: number }) => posStyle(rect.left, rect.top, rect.width, rect.height);
  const resizeHandlePositions: Record<string, string> = {
    n: "top-0 left-[35%] h-5 w-[30%]", s: "bottom-0 left-[35%] h-5 w-[30%]",
    w: "left-0 top-[35%] h-[30%] w-5", e: "right-0 top-[35%] h-[30%] w-5",
    nw: "left-0 top-0 h-5 w-5", ne: "right-0 top-0 h-5 w-5",
    sw: "bottom-0 left-0 h-5 w-5", se: "bottom-0 right-0 h-5 w-5",
  };
  const resizeHandleClass = (direction: string) => cn("absolute box-border min-h-5 min-w-5 bg-primary bg-clip-content p-1 opacity-30", resizeHandlePositions[direction]);
  function getElementPixelRect(element: HTMLElement, item: any) {
    const parent = element.offsetParent instanceof HTMLElement ? element.offsetParent : gridStage.current;
    if (parent) {
      const rect = element.getBoundingClientRect();
      const parentRect = parent.getBoundingClientRect();
      return {
        left: rect.left - parentRect.left + parent.scrollLeft,
        top: rect.top - parentRect.top + parent.scrollTop,
        width: rect.width,
        height: rect.height,
      };
    }
    const pos = calcGridPosition(item.x, item.y, item.w, item.h, columnWidth, gridRowHeight);
    return { left: itemPixelLeft(item), top: pos.top, width: itemPixelWidth(item), height: pos.height };
  }
  function nextLayoutWithItem(nextItem: any, mode: "drag" | "resize") {
    const sourceLayout = layoutRef.current.map((item) => cloneLayoutItem(item));
    const layoutItem = getLayoutItem(sourceLayout, nextItem.i);
    if (!layoutItem) return null;
    if (mode === "resize") {
      const collisions = getAllCollisions(sourceLayout, { ...layoutItem, ...nextItem }).filter((item) => String(item.i) !== String(layoutItem.i));
      if (collisions.length) {
        let leastX = Infinity;
        let leastY = Infinity;
        collisions.forEach((col) => {
          if (col.x > nextItem.x) leastX = Math.min(leastX, col.x);
          if (col.y > nextItem.y) leastY = Math.min(leastY, col.y);
        });
        if (Number.isFinite(leastX)) layoutItem.w = Math.max(Number(layoutItem.minW ?? 1), leastX - layoutItem.x);
        if (Number.isFinite(leastY)) layoutItem.h = Math.max(Number(layoutItem.minH ?? 1), leastY - layoutItem.y);
      } else {
        Object.assign(layoutItem, { w: nextItem.w, h: nextItem.h, x: nextItem.x, y: nextItem.y });
      }
      return compact(sourceLayout, false).map((item) => ({ ...item, i: String(item.i) }));
    }
    moveElement(sourceLayout, layoutItem, nextItem.x, nextItem.y, true, true);
    return compact(sourceLayout, false).map((item) => ({ ...item, i: String(item.i) }));
  }
  function applyGridItem(nextItem: any, mode: "drag" | "resize") {
    const nextLayout = nextLayoutWithItem(nextItem, mode);
    if (!nextLayout) return;
    layoutRef.current = nextLayout;
    store.setLayout(nextLayout);
  }
  function shouldIgnoreDrag(target: EventTarget | null) {
    if (!(target instanceof Element)) return false;
    return !!target.closest("a,button,input,textarea,select,option,[data-resize-handle],iframe");
  }
  function startInteraction(event: React.PointerEvent, item: any, type: "drag" | "resize", direction?: string) {
    if (event.button !== 0 || item.static) return;
    if (type === "drag" && (item.isDraggable === false || shouldIgnoreDrag(event.target))) return;
    if (type === "resize" && item.isResizable === false) return;
    event.preventDefault();
    if (type === "resize") event.stopPropagation();
    const target = type === "drag" ? (event.currentTarget as HTMLElement) : (event.currentTarget.parentElement as HTMLElement);
    const startPixel = getElementPixelRect(target, item);
    const interaction: GridInteraction = { type, id: String(item.i), direction, startClientX: event.clientX, startClientY: event.clientY, startItem: { ...item }, startPixel };
    interactionRef.current = interaction;
    setActiveInteraction(interaction);
    setActivePixel({ id: String(item.i), style: pixelStyle(startPixel) });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }
  const beginDrag = (event: React.PointerEvent, item: any) => startInteraction(event, item, "drag");
  const beginResize = (event: React.PointerEvent, item: any, direction: string) => startInteraction(event, item, "resize", direction);
  function clampGridItem(item: any) {
    const minW = Number(item.minW ?? 1);
    const minH = Number(item.minH ?? 1);
    const maxW = Number.isFinite(item.maxW) ? Number(item.maxW) : 24;
    const maxH = Number.isFinite(item.maxH) ? Number(item.maxH) : Infinity;
    const next = { ...item };
    next.w = Math.max(minW, Math.min(maxW, next.w));
    next.h = Math.max(minH, Math.min(maxH, next.h));
    next.x = Math.max(0, Math.min(24 - next.w, next.x));
    next.y = Math.max(0, next.y);
    return next;
  }
  function interactionItem(interaction: GridInteraction, clientX: number, clientY: number) {
    const dxPx = clientX - interaction.startClientX;
    const dyPx = clientY - interaction.startClientY;
    const start = interaction.startItem;
    if (interaction.type === "drag") {
      const nextPixel = { ...interaction.startPixel, left: interaction.startPixel.left + dxPx, top: interaction.startPixel.top + dyPx };
      setActivePixel({ id: interaction.id, style: pixelStyle(nextPixel) });
      const pos = calcGridXY(nextPixel.top, nextPixel.left, start.w, start.h, Math.max(columnWidth, 1), Math.max(gridRowHeight, 1), 24);
      return clampGridItem({ ...start, x: pos.x, y: pos.y });
    }
    const direction = interaction.direction || "";
    const minW = Number(start.minW ?? 1);
    const minH = Number(start.minH ?? 1);
    const maxW = Number.isFinite(start.maxW) ? Number(start.maxW) : 24;
    const maxH = Number.isFinite(start.maxH) ? Number(start.maxH) : Infinity;
    const minPixel = calcGridPosition(0, 0, minW, minH, Math.max(columnWidth, 1), Math.max(gridRowHeight, 1));
    const maxPixel = calcGridPosition(0, 0, maxW, maxH, Math.max(columnWidth, 1), Math.max(gridRowHeight, 1));
    const nextPixel = { ...interaction.startPixel };
    if (direction.includes("e")) nextPixel.width = interaction.startPixel.width + dxPx;
    if (direction.includes("s")) nextPixel.height = interaction.startPixel.height + dyPx;
    if (direction.includes("w")) {
      nextPixel.left = interaction.startPixel.left + dxPx;
      nextPixel.width = interaction.startPixel.width - dxPx;
    }
    if (direction.includes("n")) {
      nextPixel.top = interaction.startPixel.top + dyPx;
      nextPixel.height = interaction.startPixel.height - dyPx;
    }
    if (nextPixel.width < minPixel.width) {
      if (direction.includes("w")) nextPixel.left += nextPixel.width - minPixel.width;
      nextPixel.width = minPixel.width;
    }
    if (nextPixel.width > maxPixel.width) {
      if (direction.includes("w")) nextPixel.left += nextPixel.width - maxPixel.width;
      nextPixel.width = maxPixel.width;
    }
    if (nextPixel.height < minPixel.height) {
      if (direction.includes("n")) nextPixel.top += nextPixel.height - minPixel.height;
      nextPixel.height = minPixel.height;
    }
    if (nextPixel.height > maxPixel.height) {
      if (direction.includes("n")) nextPixel.top += nextPixel.height - maxPixel.height;
      nextPixel.height = maxPixel.height;
    }
    setActivePixel({ id: interaction.id, style: pixelStyle(nextPixel) });
    const wh = calcGridWH(nextPixel.height, nextPixel.width, start.x, start.y, Math.max(columnWidth, 1), Math.max(gridRowHeight, 1), 24);
    const snapped = { ...start, ...calcGridXY(nextPixel.top, nextPixel.left, wh.w, wh.h, Math.max(columnWidth, 1), Math.max(gridRowHeight, 1), 24), w: wh.w, h: wh.h };
    return clampGridItem(snapped);
  }
  function endInteraction() {
    interactionRef.current = null;
    setActiveInteraction(null);
    setActivePixel(null);
  }
  function promptLayoutChange(layoutWithContent: any, confirmFunction?: (() => void) | null, cancelFunction?: (() => void) | null) {
    if (overwriteDialog) return;
    if (!store.layout || store.layout.length === 0) {
      setMultiview(store, layoutWithContent);
      return;
    }
    setOverwriteLayoutPreview(layoutWithContent);
    overwriteConfirm.current = (dialogMerge: boolean) => {
      setOverwriteDialog(false);
      setMultiview(store, { ...layoutWithContent, mergeContent: dialogMerge });
      confirmFunction?.();
    };
    overwriteCancel.current = () => {
      setOverwriteDialog(false);
      cancelFunction?.();
    };
    setOverwriteDialog(true);
  }
  function checkStreamType(v: any) {
    if (v.type !== "placeholder") return v;
    const twitchChannel = v.link?.match(TWITCH_VIDEO_URL_REGEX)?.groups?.id;
    return twitchChannel ? { ...v, id: twitchChannel, type: "twitch" } : null;
  }
  function handleToolbarClick(v: any) {
    const video = checkStreamType(v);
    if (!video) return;
    const hasEmptyCell = findEmptyCell(store);
    if (!hasEmptyCell) {
      addVideoAutoLayout(store, video, app.isMobile, (newLayout) => {
        setOverwriteMerge(true);
        promptLayoutChange(newLayout);
      });
    } else {
      tryFillVideo(store, video);
    }
  }
  function handleVideoClicked(v: any) {
    if (Number(showSelectorForId) < -1) {
      handleToolbarClick(v);
      return;
    }
    const video = checkStreamType(v);
    if (!video) return;
    addVideoWithId(store, video, showSelectorForId);
    setShowSelectorForId(-1);
  }
  function handlePresetClicked(preset: any) {
    setShowPresetSelectorMenu(false);
    setMultiview(store, { ...structuredClone(preset), mergeContent: true });
  }
  function handleDelete(id: string) { deleteVideoAutoLayout(store, id, app.isMobile); }
  function toggleFullScreen() { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen?.(); }

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      const interaction = interactionRef.current;
      if (!interaction) return;
      event.preventDefault();
      applyGridItem(interactionItem(interaction, event.clientX, event.clientY), interaction.type);
    }
    function onPointerUp() {
      if (interactionRef.current) endInteraction();
    }
    if (!activeInteraction) return;
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [activeInteraction, columnWidth, rowHeight, store]);

  const buttons = Object.freeze([
    { icon: Grid2x2, tooltip: t("views.multiview.addframe"), onClick: () => addCellAutoLayout(store, app.isMobile), color: "green", collapse: isSmAndDown },
    { icon: RefreshCw, tooltip: t("views.multiview.archiveSync"), onClick: () => setShowSyncBar((value) => !value), color: "deep-purple lighten-2", collapse: isXs },
    { icon: icons.Trash2, tooltip: t("component.music.clearPlaylist"), onClick: () => { store.reset(); setShowSyncBar(false); }, color: "red", collapse: isSmAndDown },
    { icon: icons.Maximize2, tooltip: t("views.multiview.fullScreen"), onClick: toggleFullScreen, collapse: isMdAndDown },
  ]);
  const mediaControlsLabel = t("views.multiview.mediaControls");
  const layoutPresetLabel = "Change layout preset";
  const reorderLayoutLabel = t("views.multiview.reorderLayout");
  const presetEditorLabel = t("views.multiview.presetEditor.title");

  return (
    <div className={cn("relative flex h-[100dvh] min-h-[100dvh] w-full flex-col overflow-hidden", app.isMobile && "select-none")}>
      {!collapseToolbar ? (
        <MultiviewToolbar compact={isSmAndDown} buttons={buttons as any} onCollapse={() => setCollapseToolbar(true)} left={isXs ? <div className="flex min-w-0 flex-1 items-center gap-2"><Button type="button" size="icon" variant="secondary" className="h-8 w-8 shrink-0 rounded-xl" onClick={() => setShowSelectorForId(-2)}><SquarePlus className="size-6" /></Button><VideoSelector horizontal compact onVideoClicked={handleToolbarClick} /></div> : <VideoSelector horizontal onVideoClicked={handleToolbarClick} />} extraButtons={<TooltipProvider>
          <div className="relative"><Tooltip><TooltipTrigger render={<Button type="button" size="icon" variant="secondary" className="h-8 w-8 rounded-xl transition-colors" aria-label={mediaControlsLabel} onClick={(event) => { event.stopPropagation(); setShowMediaControls(!showMediaControls); }} />}><SlidersVertical className="size-5 text-orange-400" /></TooltipTrigger><TooltipContent>{mediaControlsLabel}</TooltipContent></Tooltip><MediaControls open={showMediaControls} /></div>
          <Popover open={showPresetSelectorMenu} onOpenChange={setShowPresetSelectorMenu}>
            <Tooltip><TooltipTrigger render={<PopoverTrigger render={<Button type="button" size="icon" variant="secondary" className="h-8 w-8 rounded-xl transition-colors" aria-label={layoutPresetLabel} />} />}><icons.Grid2x2 className="size-5" /></TooltipTrigger><TooltipContent>{layoutPresetLabel}</TooltipContent></Tooltip>
            <PopoverContent align="end" sideOffset={8} className="z-[90] p-0"><PresetSelector onSelected={handlePresetClicked} /></PopoverContent>
          </Popover>
          <Popover open={showReorderLayout} onOpenChange={setShowReorderLayout}>
            <Tooltip><TooltipTrigger render={<PopoverTrigger render={<Button type="button" size="icon" variant="secondary" className="h-8 w-8 rounded-xl transition-colors" aria-label={reorderLayoutLabel} />} />}><ReorderIcon className="size-5" /></TooltipTrigger><TooltipContent>{reorderLayoutLabel}</TooltipContent></Tooltip>
            <PopoverContent align="end" sideOffset={8} className="z-[90] p-3"><ReorderLayout isActive={showReorderLayout} /></PopoverContent>
          </Popover>
          <Popover open={showPresetEditor} onOpenChange={setShowPresetEditor}>
            <Tooltip><TooltipTrigger render={<PopoverTrigger render={<Button type="button" size="icon" variant="secondary" className="h-8 w-8 rounded-xl transition-colors" aria-label={presetEditorLabel} />} />}><Save className="size-5" /></TooltipTrigger><TooltipContent>{presetEditorLabel}</TooltipContent></Tooltip>
            <PopoverContent align="end" sideOffset={8} className="z-[90] w-[min(92vw,22rem)] p-4"><PresetEditor layout={store.layout} content={store.layoutContent} onClose={() => setShowPresetEditor(false)} /></PopoverContent>
          </Popover>
        </TooltipProvider>} />
      ) : <Button className="absolute right-0 top-0 z-10 m-1.5 opacity-70" type="button" size="icon" variant="secondary" onClick={() => setCollapseToolbar(false)}><icons.ChevronDown className="size-5" /></Button>}

      <div ref={gridStage} className="relative min-h-0 w-full flex-1 overflow-hidden">
        <div className="relative h-full min-h-full min-w-full">
          <MultiviewBackground showTips={store.layout.length === 0} collapseToolbar={collapseToolbar} style={{ backgroundSize: `${columnWidth}px ${rowHeight}px` }} />
          <div className="absolute inset-0 h-full w-full transition-none">
            {store.layout.map((item) => {
              const content = store.layoutContent[item.i];
              const isDragging = activeInteraction?.type === "drag" && activeInteraction.id === String(item.i);
              const isResizing = activeInteraction?.type === "resize" && activeInteraction.id === String(item.i);
              const gridClassName = cn(
                "absolute left-0 right-auto transition-transform duration-200",
                item.static && "static",
                isDragging && "z-30 cursor-none select-none transition-none",
                isResizing && "z-30 opacity-60",
              );
              return (
                <div key={`mvgrid${item.i}`} className={gridClassName} style={{ ...(activePixel?.id === String(item.i) ? activePixel.style : itemStyle(item)), ...(showReorderLayout ? { pointerEvents: "none" } : {}) }} onPointerDown={(event) => beginDrag(event, item)}>
                  <CellContainer item={item} disablePointerEvents={isDragging || isResizing}>
                    {content?.type === "chat" ? <ChatCell item={item} tl={content.initAsTL} cellWidth={itemPixelWidth(item)} onDelete={handleDelete} /> : content?.type === "video" ? <VideoCell item={item} onDelete={handleDelete} /> : <EmptyCell item={item} onShowSelector={(id) => setShowSelectorForId(id)} onDelete={handleDelete} />}
                  </CellContainer>
                  {item.isResizable !== false && !item.static ? RESIZE_DIRECTIONS.map((direction, index) => (
                    <span
                      key={`handle${direction}${index}`}
                      className={resizeHandleClass(direction)}
                      data-resize-handle="true"
                      style={{ cursor: `${direction}-resize` }}
                      onPointerDown={(event) => beginResize(event, item, direction)}
                    />
                  )) : null}
                </div>
              );
            })}
            {store.layout.filter((item) => activeInteraction && String(item.i) === activeInteraction.id).map((p) => (
              <div key="placeholder" className="absolute left-0 right-auto z-20 select-none bg-red-500/20 transition-transform duration-100" style={equalGridItemStyle(p)} />
            ))}
          </div>
        </div>
      </div>
      <Dialog open={showVideoSelector} onOpenChange={(open) => { if (!open) setShowSelectorForId(-1); }}><DialogContent className="w-[min(94vw,30rem)] p-0 sm:w-auto sm:max-w-[75vw]"><VideoSelector isActive={showVideoSelector} onVideoClicked={handleVideoClicked} /></DialogContent></Dialog>
      <LayoutChangePrompt open={overwriteDialog} onOpenChange={setOverwriteDialog} cancelFn={(merge) => overwriteCancel.current?.(merge)} confirmFn={(merge) => overwriteConfirm.current?.(merge)} defaultOverwrite={overwriteMerge} layoutPreview={overwriteLayoutPreview} />
      {showSyncBar ? <MultiviewSyncBar className="mt-auto" /> : null}
    </div>
  );
}
