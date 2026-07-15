"use client";

import {
  ArrowDownUp,
  BrushCleaning,
  ChevronDown,
  Grid2x2,
  Grid2x2Plus,
  Maximize2,
  RefreshCw,
  Save,
  SlidersVertical,
  Video,
} from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { ChatCell } from "@/components/multiview/ChatCell";
import { MediaControls } from "@/components/multiview/MediaControls";
import { MultiviewSyncBar } from "@/components/multiview/MultiviewSyncBar";
import { MultiviewToolbar } from "@/components/multiview/MultiviewToolbar";
import {
  CellContainer,
  EmptyCell,
  gridAreaClass,
  LayoutChangePrompt,
  PresetEditor,
  PresetSelector,
  ReorderLayout,
} from "@/components/multiview/page-parts";
import { VideoCell } from "@/components/multiview/VideoCell";
import { VideoSelector } from "@/components/multiview/VideoSelector";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import {
  addCellAutoLayout,
  addVideoAutoLayout,
  addVideoWithId,
  deleteVideoAutoLayout,
  findEmptyCell,
  setMultiview,
  tryFillVideo,
} from "@/lib/multiview-layout";
import { MultiviewProvider, useMultiviewStore } from "@/lib/multiview-store";
import { MultiviewVideoCellsProvider } from "@/lib/multiview-video-cells";
import {
  asTwitchVideo,
  decodeLayout,
  generateContentId,
  type Content as MultiviewContent,
} from "@/lib/mv-utils";
import { useAppState } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  calcGridPosition,
  calcGridWH,
  calcGridXY,
  cloneLayoutItem,
  compact,
  getAllCollisions,
  getLayoutItem,
  moveElement,
} from "@/lib/vue-grid-layout-utils";

type ResizeHandleConfig = {
  direction: string;
  className: string;
  visualClassName?: string;
};

const STREAM_SELECTOR_POPOVER_CLASS = "w-[min(96vw,46rem)] gap-0 p-0";
const EMPTY_STAGE_ID = "__empty_multiview_stage__";

const RESIZE_HANDLES: readonly ResizeHandleConfig[] = [
  {
    direction: "s",
    className: "-bottom-1.5 left-2.5 right-2.5 h-3 w-auto cursor-s-resize",
    visualClassName: "left-1/2 top-1/2 h-1.5 w-10 -translate-x-1/2 -translate-y-1/2",
  },
  {
    direction: "w",
    className: "-left-1.5 bottom-2.5 top-2.5 h-auto w-3 cursor-w-resize",
    visualClassName: "left-1/2 top-1/2 h-10 w-1.5 -translate-x-1/2 -translate-y-1/2",
  },
  {
    direction: "e",
    className: "-right-1.5 bottom-2.5 top-2.5 h-auto w-3 cursor-e-resize",
    visualClassName: "left-1/2 top-1/2 h-10 w-1.5 -translate-x-1/2 -translate-y-1/2",
  },
  {
    direction: "n",
    className: "-top-1.5 left-2.5 right-2.5 h-3 w-auto cursor-n-resize",
    visualClassName: "left-1/2 top-1/2 h-1.5 w-10 -translate-x-1/2 -translate-y-1/2",
  },
  { direction: "sw", className: "-bottom-4 -left-4 h-8 w-8 cursor-sw-resize" },
  { direction: "nw", className: "-left-4 -top-4 h-8 w-8 cursor-nw-resize" },
  { direction: "se", className: "-bottom-4 -right-4 h-8 w-8 cursor-se-resize" },
  { direction: "ne", className: "-right-4 -top-4 h-8 w-8 cursor-ne-resize" },
];

function CornerGrip({ direction }: { direction: string }) {
  const west = direction.includes("w");
  const north = direction.includes("n");
  const path =
    west && north
      ? "M16 30 V16 H30"
      : !west && north
        ? "M2 16 H16 V30"
        : west && !north
          ? "M16 2 V16 H30"
          : "M2 16 H16 V2";
  return (
    <svg
      className="absolute inset-0 size-8 overflow-visible text-muted-foreground/70 drop-shadow-sm"
      viewBox="0 0 32 32"
      aria-hidden="true"
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FrameResizeHandle({
  active,
  direction,
  className,
  visualClassName,
  onPointerDown,
}: {
  active?: boolean;
  direction: string;
  className: string;
  visualClassName?: string;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  const corner = direction.length > 1;
  const hitClassName = corner
    ? direction === "nw"
      ? "left-0 top-0 h-4 w-4 cursor-nw-resize"
      : direction === "ne"
        ? "right-0 top-0 h-4 w-4 cursor-ne-resize"
        : direction === "sw"
          ? "left-0 bottom-0 h-4 w-4 cursor-sw-resize"
          : "right-0 bottom-0 h-4 w-4 cursor-se-resize"
    : direction === "w"
      ? "left-0 bottom-2.5 top-2.5 h-auto w-2.5 cursor-w-resize"
      : direction === "e"
        ? "right-0 bottom-2.5 top-2.5 h-auto w-2.5 cursor-e-resize"
        : direction === "n"
          ? "top-0 left-2.5 right-2.5 h-2.5 w-auto cursor-n-resize"
          : "bottom-0 left-2.5 right-2.5 h-2.5 w-auto cursor-s-resize";
  const visible = cn(
    "pointer-events-none opacity-0 transition-opacity peer-hover/resize:opacity-100 peer-focus-visible/resize:opacity-100",
    active && "opacity-100",
  );
  if (corner) {
    return (
      <>
        <div
          data-resize-handle="true"
          className={cn("peer/resize absolute z-40 bg-transparent", hitClassName)}
          onPointerDown={onPointerDown}
        />
        <div
          aria-hidden
          className={cn("pointer-events-none absolute z-40 bg-transparent", className)}
        >
          <div className={visible}>
            <CornerGrip direction={direction} />
          </div>
        </div>
      </>
    );
  }
  return (
    <>
      <div
        data-resize-handle="true"
        className={cn("peer/resize absolute z-40 bg-transparent", hitClassName)}
        onPointerDown={onPointerDown}
      />
      <div
        aria-hidden
        className={cn("pointer-events-none absolute z-40 bg-transparent", className)}
      >
        <span
          className={cn(
            "absolute rounded-full bg-muted-foreground/70 shadow-sm",
            visible,
            visualClassName,
          )}
        />
      </div>
    </>
  );
}

type Interaction = {
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
  const layoutParam = Array.isArray(params.layout)
    ? decodeURIComponent(params.layout.join("/"))
    : "";
  return (
    <MultiviewProvider>
      <MultiviewVideoCellsProvider>
        <Content routeLayout={layoutParam} />
      </MultiviewVideoCellsProvider>
    </MultiviewProvider>
  );
}

function Content({ routeLayout }: { routeLayout: string }) {
  const t = useTranslations();
  const sp = useSearchParams();
  const app = useAppState();
  const store = useMultiviewStore();
  const [showSelectorForId, setShowSelectorForId] = useState<string | number>(-1);
  const [showSyncBar, setShowSyncBar] = useState(false);
  const [showReorder, setShowReorder] = useState(false);
  const [overwriteDialog, setOverwriteDialog] = useState(false);
  const [overwriteMerge, setOverwriteMerge] = useState(false);
  const [overwritePreview, setOverwritePreview] = useState<any>({ layout: [], content: {} });
  const overwriteConfirm = useRef<((m: boolean) => void) | null>(null);
  const overwriteCancel = useRef<((m: boolean) => void) | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [stageW, setStageW] = useState(1440);
  const [stageH, setStageH] = useState(900);
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [showPresetEditor, setShowPresetEditor] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const stage = useRef<HTMLDivElement | null>(null);
  const layoutRef = useRef(store.layout);
  const intRef = useRef<Interaction | null>(null);
  const [activeInt, setActiveInt] = useState<Interaction | null>(null);

  const vw = app.windowWidth || (typeof window !== "undefined" ? window.innerWidth : 1440);
  const vh = typeof window !== "undefined" ? window.innerHeight : 900;
  const isXs = vw < 600,
    isSm = vw < 960,
    isMd = vw < 1264;
  const rh = (stageH || vh) / 24,
    grh = Math.max(rh, 1);
  const cw = (stageW || vw) / 24;
  const showToolbarSelector = showSelectorForId === -2;

  useEffect(() => {
    layoutRef.current = store.layout;
  }, [store.layout]);
  useEffect(() => {
    document.title = `${t("component.mainNav.multiview")} - Holodex`;
  }, [t]);

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
      if (sp.get("t") || sp.get("offsets")) setShowSyncBar(true);
    } else store.fetchVideoData({ refreshLive: true });
  }, []);

  useEffect(() => {
    const sync = () => {
      if (!stage.current) return;
      setStageW(stage.current.clientWidth || vw);
      setStageH(stage.current.clientHeight || vh);
    };
    sync();
    if (!window.ResizeObserver || !stage.current) return;
    const obs = new ResizeObserver(sync);
    obs.observe(stage.current);
    return () => obs.disconnect();
  }, [vw, vh, collapsed]);

  function pixelRect(el: HTMLElement, item: any) {
    const parent = el.offsetParent instanceof HTMLElement ? el.offsetParent : stage.current;
    if (parent) {
      const r = el.getBoundingClientRect(),
        pr = parent.getBoundingClientRect();
      return {
        left: r.left - pr.left + parent.scrollLeft,
        top: r.top - pr.top + parent.scrollTop,
        width: r.width,
        height: r.height,
      };
    }
    const p = calcGridPosition(item.x, item.y, item.w, item.h, cw, grh);
    return { left: cw * item.x, top: p.top, width: cw * item.w, height: p.height };
  }

  function nextLayout(next: any, mode: "drag" | "resize") {
    const src = layoutRef.current.map(cloneLayoutItem);
    const item = getLayoutItem(src, next.i);
    if (!item) return null;
    if (mode === "resize") {
      const cs = getAllCollisions(src, { ...item, ...next }).filter(
        (x) => String(x.i) !== String(item.i),
      );
      if (cs.length) {
        let lx = Infinity,
          ly = Infinity;
        cs.forEach((c) => {
          if (c.x > next.x) lx = Math.min(lx, c.x);
          if (c.y > next.y) ly = Math.min(ly, c.y);
        });
        if (Number.isFinite(lx)) item.w = Math.max(Number(item.minW ?? 1), lx - item.x);
        if (Number.isFinite(ly)) item.h = Math.max(Number(item.minH ?? 1), ly - item.y);
      } else Object.assign(item, { w: next.w, h: next.h, x: next.x, y: next.y });
    } else moveElement(src, item, next.x, next.y, true, true);
    return compact(src, false).map((i) => ({ ...i, i: String(i.i) }));
  }

  function applyItem(next: any, mode: "drag" | "resize") {
    const nl = nextLayout(next, mode);
    if (!nl) return;
    layoutRef.current = nl;
    store.setLayout(nl);
  }

  const ignoreDrag = (t: EventTarget | null) =>
    t instanceof Element &&
    !!t.closest("a,button,input,textarea,select,option,[data-resize-handle],iframe");

  function startInt(e: React.PointerEvent, item: any, type: "drag" | "resize", direction?: string) {
    if (e.button !== 0 || item.static) return;
    if (type === "drag" && (item.isDraggable === false || ignoreDrag(e.target))) return;
    if (type === "resize" && item.isResizable === false) return;
    e.preventDefault();
    if (type === "resize") e.stopPropagation();
    const target = (
      type === "drag" ? e.currentTarget : e.currentTarget.parentElement
    ) as HTMLElement;
    const i: Interaction = {
      type,
      id: String(item.i),
      direction,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startItem: { ...item },
      startPixel: pixelRect(target, item),
    };
    intRef.current = i;
    setActiveInt(i);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function clamp(item: any) {
    const minW = Number(item.minW ?? 1),
      minH = Number(item.minH ?? 1);
    const maxW = Number.isFinite(item.maxW) ? Number(item.maxW) : 24;
    const maxH = Number.isFinite(item.maxH) ? Number(item.maxH) : Infinity;
    const n = { ...item };
    n.w = Math.max(minW, Math.min(maxW, n.w));
    n.h = Math.max(minH, Math.min(maxH, n.h));
    n.x = Math.max(0, Math.min(24 - n.w, n.x));
    n.y = Math.max(0, n.y);
    return n;
  }

  function intItem(i: Interaction, cx: number, cy: number) {
    const dx = cx - i.startClientX,
      dy = cy - i.startClientY;
    const s = i.startItem;
    if (i.type === "drag") {
      const np = { ...i.startPixel, left: i.startPixel.left + dx, top: i.startPixel.top + dy };
      const p = calcGridXY(np.top, np.left, s.w, s.h, Math.max(cw, 1), Math.max(grh, 1), 24);
      return clamp({ ...s, x: p.x, y: p.y });
    }
    const dir = i.direction || "";
    const minW = Number(s.minW ?? 1),
      minH = Number(s.minH ?? 1);
    const maxW = Number.isFinite(s.maxW) ? Number(s.maxW) : 24;
    const maxH = Number.isFinite(s.maxH) ? Number(s.maxH) : Infinity;
    const minP = calcGridPosition(0, 0, minW, minH, Math.max(cw, 1), Math.max(grh, 1));
    const maxP = calcGridPosition(0, 0, maxW, maxH, Math.max(cw, 1), Math.max(grh, 1));
    const np = { ...i.startPixel };
    if (dir.includes("e")) np.width = i.startPixel.width + dx;
    if (dir.includes("s")) np.height = i.startPixel.height + dy;
    if (dir.includes("w")) {
      np.left = i.startPixel.left + dx;
      np.width = i.startPixel.width - dx;
    }
    if (dir.includes("n")) {
      np.top = i.startPixel.top + dy;
      np.height = i.startPixel.height - dy;
    }
    if (np.width < minP.width) {
      if (dir.includes("w")) np.left += np.width - minP.width;
      np.width = minP.width;
    }
    if (np.width > maxP.width) {
      if (dir.includes("w")) np.left += np.width - maxP.width;
      np.width = maxP.width;
    }
    if (np.height < minP.height) {
      if (dir.includes("n")) np.top += np.height - minP.height;
      np.height = minP.height;
    }
    if (np.height > maxP.height) {
      if (dir.includes("n")) np.top += np.height - maxP.height;
      np.height = maxP.height;
    }
    const wh = calcGridWH(np.height, np.width, s.x, s.y, Math.max(cw, 1), Math.max(grh, 1), 24);
    return clamp({
      ...s,
      ...calcGridXY(np.top, np.left, wh.w, wh.h, Math.max(cw, 1), Math.max(grh, 1), 24),
      w: wh.w,
      h: wh.h,
    });
  }

  function promptLayoutChange(
    lc: any,
    confirmFn?: (() => void) | null,
    cancelFn?: (() => void) | null,
  ) {
    if (overwriteDialog) return;
    if (!store.layout?.length) {
      setMultiview(store, lc);
      return;
    }
    setOverwritePreview(lc);
    overwriteConfirm.current = (m: boolean) => {
      setOverwriteDialog(false);
      setMultiview(store, { ...lc, mergeContent: m });
      confirmFn?.();
    };
    overwriteCancel.current = () => {
      setOverwriteDialog(false);
      cancelFn?.();
    };
    setOverwriteDialog(true);
  }

  function toolbarClick(v: any) {
    const video = asTwitchVideo(v);
    if (!video) return;
    if (findEmptyCell(store)) tryFillVideo(store, video);
    else
      addVideoAutoLayout(store, video, app.isMobile, (l) => {
        setOverwriteMerge(true);
        promptLayoutChange(l);
      });
  }

  function toolbarDropdownClick(v: any) {
    toolbarClick(v);
    setShowSelectorForId(-1);
  }

  function cellDropdownClick(id: string | number, v: any) {
    const video = asTwitchVideo(v);
    if (!video) return;
    if (store.layout.length) addVideoWithId(store, video, id);
    else createInitialCell({ id: video.id, type: "video", video });
    setShowSelectorForId(-1);
  }

  function createInitialCell(content: MultiviewContent) {
    const id = generateContentId();
    store.setLayout([
      { x: 0, y: 0, w: 24, h: 24, i: id, isResizable: true, isDraggable: true, moved: false },
    ]);
    store.setLayoutContent({ [id]: content });
    if (content.type === "video") store.fetchVideoData();
  }

  const presetClick = (p: any) => {
    setShowPresetMenu(false);
    setMultiview(store, { ...structuredClone(p), mergeContent: true });
  };
  const onDelete = (id: string) => deleteVideoAutoLayout(store, id, app.isMobile);
  const toggleFull = () =>
    document.fullscreenElement
      ? document.exitFullscreen?.()
      : document.documentElement.requestFullscreen();

  useEffect(() => {
    if (!activeInt) return;
    const onMove = (e: PointerEvent) => {
      const i = intRef.current;
      if (!i) return;
      e.preventDefault();
      applyItem(intItem(i, e.clientX, e.clientY), i.type);
    };
    const onUp = () => {
      if (intRef.current) {
        intRef.current = null;
        setActiveInt(null);
      }
    };
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [activeInt, cw, rh, store]);

  const buttons = Object.freeze([
    {
      icon: Grid2x2Plus,
      tooltip: t("views.multiview.addframe"),
      onClick: () => addCellAutoLayout(store, app.isMobile),
      collapse: isSm,
    },
    {
      icon: RefreshCw,
      tooltip: t("views.multiview.archiveSync"),
      onClick: () => setShowSyncBar((v) => !v),
      collapse: isXs,
    },
    {
      icon: BrushCleaning,
      tooltip: t("component.music.clearPlaylist"),
      onClick: () => {
        store.reset();
        setShowSyncBar(false);
      },
      collapse: isSm,
    },
    {
      icon: Maximize2,
      tooltip: t("views.multiview.fullScreen"),
      onClick: toggleFull,
      collapse: isMd,
    },
  ]);
  const mediaLbl = t("views.multiview.mediaControls"),
    presetLbl = t("views.multiview.changeLayout");
  const reorderLbl = t("views.multiview.reorderLayout"),
    editorLbl = t("views.multiview.presetEditor.title");
  const selectLiveLbl = t("views.multiview.video.selectLive");
  const streamLbl = "Stream";
  const renderStreamSelectorContent = (open: boolean, onVideoClicked: (video: any) => void) => (
    <PopoverContent align="start" sideOffset={8} className={STREAM_SELECTOR_POPOVER_CLASS}>
      <VideoSelector embedded isActive={open} onVideoClicked={onVideoClicked} />
    </PopoverContent>
  );
  const selectLiveButton = (
    <Popover
      open={showToolbarSelector}
      onOpenChange={(open) => setShowSelectorForId(open ? -2 : -1)}
    >
      <PopoverTrigger
        render={<Button type="button" variant="ghost" size="icon" aria-label={selectLiveLbl} />}
      >
        <Video />
      </PopoverTrigger>
      {renderStreamSelectorContent(showToolbarSelector, toolbarDropdownClick)}
    </Popover>
  );
  const renderCellStreamSelector = (id: string | number) => {
    const open = String(showSelectorForId) === String(id);
    return (
      <Popover open={open} onOpenChange={(nextOpen) => setShowSelectorForId(nextOpen ? id : -1)}>
        <PopoverTrigger
          render={<Button type="button" variant="outline" size="lg" aria-label={streamLbl} />}
        >
          <Video />
          {streamLbl}
        </PopoverTrigger>
        {renderStreamSelectorContent(open, (video) => cellDropdownClick(id, video))}
      </Popover>
    );
  };
  const emptyStageItem = {
    x: 0,
    y: 0,
    w: 24,
    h: 24,
    i: EMPTY_STAGE_ID,
    isResizable: true,
    isDraggable: true,
    moved: false,
  };

  return (
    <div
      className={cn(
        "relative flex h-[100dvh] min-h-[100dvh] w-full flex-col overflow-hidden",
        app.isMobile && "select-none",
      )}
    >
      {!collapsed ? (
        <MultiviewToolbar
          compact={isSm}
          buttons={buttons}
          onCollapse={() => setCollapsed(true)}
          left={
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {selectLiveButton}
              <VideoSelector
                horizontal
                compact={isXs}
                hideOrgSelector
                hideFavorites
                hidePlaylist
                hideUrlInput
                onVideoClicked={toolbarClick}
              />
            </div>
          }
          extraButtons={
            <TooltipProvider>
              <Popover open={showMedia} onOpenChange={setShowMedia}>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <PopoverTrigger
                        render={
                          <Button type="button" variant="ghost" size="icon" aria-label={mediaLbl} />
                        }
                      />
                    }
                  >
                    <SlidersVertical />
                  </TooltipTrigger>
                  <TooltipContent>{mediaLbl}</TooltipContent>
                </Tooltip>
                <PopoverContent
                  align="end"
                  sideOffset={8}
                  className="w-[min(92vw,26rem)] gap-0 p-0"
                >
                  <PopoverHeader className="border-b px-3 py-2.5">
                    <PopoverTitle>{mediaLbl}</PopoverTitle>
                  </PopoverHeader>
                  <div className="p-3">
                    <MediaControls open={showMedia} />
                  </div>
                </PopoverContent>
              </Popover>
              <Popover open={showPresetMenu} onOpenChange={setShowPresetMenu}>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <PopoverTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={presetLbl}
                          />
                        }
                      />
                    }
                  >
                    <Grid2x2 />
                  </TooltipTrigger>
                  <TooltipContent>{presetLbl}</TooltipContent>
                </Tooltip>
                <PopoverContent
                  align="end"
                  sideOffset={8}
                  className="w-[min(92vw,20rem)] gap-0 overflow-hidden p-0"
                >
                  <PopoverHeader className="border-b px-3 py-2">
                    <PopoverTitle>{presetLbl}</PopoverTitle>
                  </PopoverHeader>
                  <PresetSelector onSelected={presetClick} />
                </PopoverContent>
              </Popover>
              <Popover open={showReorder} onOpenChange={setShowReorder}>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <PopoverTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={reorderLbl}
                          />
                        }
                      />
                    }
                  >
                    <ArrowDownUp />
                  </TooltipTrigger>
                  <TooltipContent>{reorderLbl}</TooltipContent>
                </Tooltip>
                <PopoverContent
                  align="end"
                  sideOffset={8}
                  className="w-[min(92vw,28rem)] gap-0 p-0"
                >
                  <PopoverHeader className="border-b px-3 py-2.5">
                    <PopoverTitle>{reorderLbl}</PopoverTitle>
                    <PopoverDescription>
                      {t("views.multiview.reorderLayoutDetail")}
                    </PopoverDescription>
                  </PopoverHeader>
                  <ReorderLayout isActive={showReorder} />
                </PopoverContent>
              </Popover>
              <Popover open={showPresetEditor} onOpenChange={setShowPresetEditor}>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <PopoverTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={editorLbl}
                          />
                        }
                      />
                    }
                  >
                    <Save />
                  </TooltipTrigger>
                  <TooltipContent>{editorLbl}</TooltipContent>
                </Tooltip>
                <PopoverContent align="end" sideOffset={8} className="w-[min(92vw,22rem)] p-4">
                  <PresetEditor
                    layout={store.layout}
                    content={store.layoutContent}
                    onClose={() => setShowPresetEditor(false)}
                  />
                </PopoverContent>
              </Popover>
            </TooltipProvider>
          }
        />
      ) : (
        <div className="absolute right-0 top-0 z-10 m-1.5">
          <Button type="button" variant="ghost" size="icon" onClick={() => setCollapsed(false)}>
            <ChevronDown />
          </Button>
        </div>
      )}

      <div ref={stage} className="relative min-h-0 w-full flex-1 overflow-hidden">
        <div className="relative h-full min-h-full min-w-full">
          <div className="absolute inset-0 grid h-full w-full grid-cols-[repeat(24,minmax(0,1fr))] grid-rows-[repeat(24,minmax(0,1fr))] transition-none">
            {store.layout.map((item) => {
              const c = store.layoutContent[item.i];
              const drag = activeInt?.type === "drag" && activeInt.id === String(item.i);
              const resize = activeInt?.type === "resize" && activeInt.id === String(item.i);
              return (
                <div
                  key={`mvgrid${item.i}`}
                  className={cn(
                    "relative h-full min-h-0 w-full min-w-0 overflow-visible transition-transform duration-200",
                    gridAreaClass(item),
                    drag && "z-30 cursor-none select-none transition-none",
                    resize && "z-30 transition-none",
                    showReorder && "pointer-events-none",
                  )}
                  onPointerDown={(e) => startInt(e, item, "drag")}
                >
                  <CellContainer
                    item={item}
                    editMode={c?.type === "chat" ? true : undefined}
                    disablePointerEvents={drag || resize}
                  >
                    {c?.type === "chat" ? (
                      <ChatCell
                        item={item}
                        tl={c.initAsTL}
                        cellWidth={cw * item.w}
                        onDelete={onDelete}
                      />
                    ) : c?.type === "video" ? (
                      <VideoCell item={item} onDelete={onDelete} />
                    ) : (
                      <EmptyCell
                        item={item}
                        streamSelector={renderCellStreamSelector(item.i)}
                        onDelete={onDelete}
                      />
                    )}
                  </CellContainer>
                  {item.isResizable !== false && !item.static
                    ? RESIZE_HANDLES.map(({ direction, className, visualClassName }) => (
                        <FrameResizeHandle
                          key={`handle${direction}`}
                          active={resize && activeInt?.direction === direction}
                          direction={direction}
                          className={className}
                          visualClassName={visualClassName}
                          onPointerDown={(e) => startInt(e, item, "resize", direction)}
                        />
                      ))
                    : null}
                </div>
              );
            })}
            {store.layout
              .filter((i) => activeInt && String(i.i) === activeInt.id)
              .map((p) => (
                <div
                  key="placeholder"
                  className={cn(
                    "z-20 select-none bg-destructive/20 transition-transform duration-100",
                    gridAreaClass(p),
                  )}
                />
              ))}
          </div>
          {!store.layout.length ? (
            <div className="absolute inset-0 z-10">
              <CellContainer
                item={emptyStageItem}
                editMode
                onSetContent={(_, content) => createInitialCell(content)}
              >
                <EmptyCell
                  item={emptyStageItem}
                  streamSelector={renderCellStreamSelector(EMPTY_STAGE_ID)}
                  onSetChat={(_, initAsTL) => createInitialCell({ type: "chat", initAsTL })}
                  showDeleteControl={false}
                />
              </CellContainer>
            </div>
          ) : null}
        </div>
      </div>
      <LayoutChangePrompt
        open={overwriteDialog}
        onOpenChange={setOverwriteDialog}
        cancelFn={(m) => overwriteCancel.current?.(m)}
        confirmFn={(m) => overwriteConfirm.current?.(m)}
        defaultOverwrite={overwriteMerge}
        layoutPreview={overwritePreview}
      />
      {showSyncBar ? (
        <MultiviewSyncBar className="mt-auto" onClose={() => setShowSyncBar(false)} />
      ) : null}
    </div>
  );
}
