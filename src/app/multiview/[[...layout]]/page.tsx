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
import {
  type PointerEvent as ReactPointerEvent,
  Suspense,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { ChatCell } from "@/components/multiview/ChatCell";
import { MediaControls } from "@/components/multiview/MediaControls";
import { MultiviewSyncBar } from "@/components/multiview/MultiviewSyncBar";
import { MultiviewToolbar, ToolbarTooltip } from "@/components/multiview/MultiviewToolbar";
import { gridAreaClass } from "@/components/multiview/grid-area";
import {
  CellContainer,
  EmptyCell,
  LayoutChangePrompt,
  PresetEditor,
  PresetSelector,
  ReorderLayout,
} from "@/components/multiview/page-parts";
import { VideoCell } from "@/components/multiview/VideoCell";
import {
  type Interaction,
  useLayoutInteraction,
} from "@/components/multiview/use-layout-interaction";
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
import { TooltipProvider } from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import {
  addCellAutoLayout,
  addVideoAutoLayout,
  addVideoWithId,
  deleteVideoAutoLayout,
  findEmptyCell,
  isStackedScreen,
  reflowAutoLayout,
  STACKED_SCREEN_QUERY,
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

// Pointer hit areas: small squares in the corners, thin strips along the edges between them.
const RESIZE_HIT_CLASSES: Record<string, string> = {
  nw: "left-0 top-0 h-4 w-4 cursor-nw-resize",
  ne: "right-0 top-0 h-4 w-4 cursor-ne-resize",
  sw: "left-0 bottom-0 h-4 w-4 cursor-sw-resize",
  se: "right-0 bottom-0 h-4 w-4 cursor-se-resize",
  w: "left-0 bottom-2.5 top-2.5 h-auto w-2.5 cursor-w-resize",
  e: "right-0 bottom-2.5 top-2.5 h-auto w-2.5 cursor-e-resize",
  n: "top-0 left-2.5 right-2.5 h-2.5 w-auto cursor-n-resize",
  s: "bottom-0 left-2.5 right-2.5 h-2.5 w-auto cursor-s-resize",
};

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
  const hitClassName = RESIZE_HIT_CLASSES[direction] ?? RESIZE_HIT_CLASSES[corner ? "se" : "s"];
  const visible = cn(
    "pointer-events-none opacity-0 transition-opacity peer-hover/resize:opacity-100 peer-focus-visible/resize:opacity-100",
    active && "opacity-100",
  );
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
        {corner ? (
          <div className={visible}>
            <CornerGrip direction={direction} />
          </div>
        ) : (
          <span
            className={cn(
              "absolute rounded-full bg-muted-foreground/70 shadow-sm",
              visible,
              visualClassName,
            )}
          />
        )}
      </div>
    </>
  );
}

function decodeLayoutParam(parts?: string[]) {
  if (!Array.isArray(parts)) return "";
  const raw = parts.join("/");
  try {
    return decodeURIComponent(raw);
  } catch {
    // A malformed escape (e.g. a lone "%") is still worth trying as a raw layout string.
    return raw;
  }
}

export default function MultiViewPage() {
  const params = useParams<{ layout?: string[] }>();
  const layoutParam = decodeLayoutParam(params.layout);
  return (
    <MultiviewProvider>
      <MultiviewVideoCellsProvider>
        <Suspense fallback={null}>
          <Content routeLayout={layoutParam} />
        </Suspense>
      </MultiviewVideoCellsProvider>
    </MultiviewProvider>
  );
}

// A toolbar icon button opening a popover (its PopoverContent is `children`), with a tooltip.
function ToolbarPopover({
  open,
  onOpenChange,
  label,
  icon,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <ToolbarTooltip
        label={label}
        render={
          <PopoverTrigger
            render={<Button type="button" variant="ghost" size="icon" aria-label={label} />}
          />
        }
      >
        {icon}
      </ToolbarTooltip>
      {children}
    </Popover>
  );
}

type PanelState = { open: boolean; setOpen: (open: boolean) => void };

// Media controls, layout presets, reorder and the preset editor.
function MultiviewExtraButtons({
  media,
  presets,
  reorder,
  presetEditor,
  onPreset,
}: {
  media: PanelState;
  presets: PanelState;
  reorder: PanelState;
  presetEditor: PanelState;
  onPreset: (preset: any) => void;
}) {
  const t = useTranslations();
  const store = useMultiviewStore();
  const mediaLbl = t("views.multiview.mediaControls");
  const presetLbl = t("views.multiview.changeLayout");
  const reorderLbl = t("views.multiview.reorderLayout");
  return (
    <TooltipProvider>
      <ToolbarPopover
        open={media.open}
        onOpenChange={media.setOpen}
        label={mediaLbl}
        icon={<SlidersVertical />}
      >
        <PopoverContent align="end" sideOffset={8} className="w-[min(92vw,26rem)] gap-0 p-0">
          <PopoverHeader className="border-b px-3 py-2.5">
            <PopoverTitle>{mediaLbl}</PopoverTitle>
          </PopoverHeader>
          <div className="p-3">
            <MediaControls open={media.open} />
          </div>
        </PopoverContent>
      </ToolbarPopover>
      <ToolbarPopover
        open={presets.open}
        onOpenChange={presets.setOpen}
        label={presetLbl}
        icon={<Grid2x2 />}
      >
        <PopoverContent
          align="end"
          sideOffset={8}
          className="w-[min(92vw,20rem)] gap-0 overflow-hidden p-0"
        >
          <PopoverHeader className="border-b px-3 py-2">
            <PopoverTitle>{presetLbl}</PopoverTitle>
          </PopoverHeader>
          <PresetSelector onSelected={onPreset} />
        </PopoverContent>
      </ToolbarPopover>
      <ToolbarPopover
        open={reorder.open}
        onOpenChange={reorder.setOpen}
        label={reorderLbl}
        icon={<ArrowDownUp />}
      >
        <PopoverContent align="end" sideOffset={8} className="w-[min(92vw,28rem)] gap-0 p-0">
          <PopoverHeader className="border-b px-3 py-2.5">
            <PopoverTitle>{reorderLbl}</PopoverTitle>
            <PopoverDescription>{t("views.multiview.reorderLayoutDetail")}</PopoverDescription>
          </PopoverHeader>
          <ReorderLayout isActive={reorder.open} />
        </PopoverContent>
      </ToolbarPopover>
      <ToolbarPopover
        open={presetEditor.open}
        onOpenChange={presetEditor.setOpen}
        label={t("views.multiview.presetEditor.title")}
        icon={<Save />}
      >
        <PopoverContent align="end" sideOffset={8} className="w-[min(92vw,22rem)] p-4">
          <PresetEditor
            layout={store.layout}
            content={store.layoutContent}
            onClose={() => presetEditor.setOpen(false)}
          />
        </PopoverContent>
      </ToolbarPopover>
    </TooltipProvider>
  );
}

// The 24x24 grid of cells, each draggable and (unless static) resizable from its edges, plus a
// placeholder showing where the cell being moved will land.
function LayoutGrid({
  activeInt,
  startInt,
  cw,
  reordering,
  streamSelector,
  onDelete,
}: {
  activeInt: Interaction | null;
  startInt: (e: ReactPointerEvent, item: any, type: "drag" | "resize", direction?: string) => void;
  cw: number;
  reordering: boolean;
  streamSelector: (id: string | number) => React.ReactNode;
  onDelete: (id: string) => void;
}) {
  const store = useMultiviewStore();
  return (
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
              reordering && "pointer-events-none",
            )}
            onPointerDown={(e) => startInt(e, item, "drag")}
          >
            <CellContainer
              item={item}
              editMode={c?.type === "chat" ? true : undefined}
              disablePointerEvents={drag || resize}
            >
              {c?.type === "chat" ? (
                <ChatCell item={item} tl={c.initAsTL} cellWidth={cw * item.w} onDelete={onDelete} />
              ) : c?.type === "video" ? (
                <VideoCell item={item} onDelete={onDelete} />
              ) : (
                <EmptyCell
                  item={item}
                  streamSelector={streamSelector(item.i)}
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
  );
}

// Applying a layout over a non-empty one asks first (overwrite or merge content); the dialog's
// buttons resolve the pending change.
function useLayoutChangePrompt() {
  const store = useMultiviewStore();
  const [open, setOpen] = useState(false);
  const [defaultMerge, setDefaultMerge] = useState(false);
  const [preview, setPreview] = useState<any>({ layout: [], content: {} });
  const confirm = useRef<((m: boolean) => void) | null>(null);
  const cancel = useRef<((m: boolean) => void) | null>(null);

  function prompt(lc: any, confirmFn?: (() => void) | null, cancelFn?: (() => void) | null) {
    if (open) return;
    if (!store.layout?.length) {
      setMultiview(store, lc);
      return;
    }
    setPreview(lc);
    confirm.current = (m: boolean) => {
      setOpen(false);
      setMultiview(store, { ...lc, mergeContent: m });
      confirmFn?.();
    };
    cancel.current = () => {
      setOpen(false);
      cancelFn?.();
    };
    setOpen(true);
  }

  const dialog = (
    <LayoutChangePrompt
      open={open}
      onOpenChange={setOpen}
      cancelFn={(m) => cancel.current?.(m)}
      confirmFn={(m) => confirm.current?.(m)}
      defaultOverwrite={defaultMerge}
      layoutPreview={preview}
    />
  );
  return { prompt, setDefaultMerge, dialog };
}

// How long the expand tab stays after the mouse stops moving.
const EXPAND_TAB_LINGER_MS = 2000;

// With the toolbar collapsed, a tab hanging from the top edge brings it back. It shows while the
// mouse moves and fades once it stops (or stays while hovered or focused); touch screens, which
// can't hover, always show it. Moves over a video stay inside its frame, so a thin strip along the
// top edge picks up the mouse heading there. Both sit above the cells, their resize handles and
// the empty-stage panel.
function ExpandToolbarTab({ onExpand }: { onExpand: () => void }) {
  const t = useTranslations();
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reveal = () => {
      setMoving(true);
      clearTimeout(timer);
      timer = setTimeout(() => setMoving(false), EXPAND_TAB_LINGER_MS);
    };
    // Shown at first too, so whoever just collapsed the toolbar sees where it went.
    reveal();
    document.addEventListener("mousemove", reveal, { passive: true });
    return () => {
      document.removeEventListener("mousemove", reveal);
      clearTimeout(timer);
    };
  }, []);

  return (
    <>
      <div aria-hidden="true" className="absolute inset-x-0 top-0 z-50 h-3" />
      <Button
        type="button"
        variant="outline"
        size="xs"
        aria-label={t("views.multiview.expandToolbar")}
        title={t("views.multiview.expandToolbar")}
        onClick={onExpand}
        data-visible={moving || undefined}
        className="absolute left-1/2 top-0 z-50 w-14 -translate-x-1/2 rounded-t-none border-t-0 opacity-0 shadow-sm backdrop-blur-sm duration-300 hover:opacity-100 dark:bg-muted/80 dark:hover:bg-muted focus-visible:opacity-100 data-visible:opacity-100 pointer-coarse:opacity-100"
      >
        <ChevronDown className="size-4" />
      </Button>
    </>
  );
}

// The stream picker in a popover: an icon button in the toolbar, a labeled button in empty cells.
function StreamSelectorPopover({
  open,
  onOpenChange,
  label,
  compact = false,
  onVideoClicked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  compact?: boolean;
  onVideoClicked: (video: any) => void;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {compact ? (
        <ToolbarTooltip
          label={label}
          render={
            <PopoverTrigger
              render={<Button type="button" variant="ghost" size="icon" aria-label={label} />}
            />
          }
        >
          <Video />
        </ToolbarTooltip>
      ) : (
        <PopoverTrigger
          render={<Button type="button" variant="outline" size="lg" aria-label={label} />}
        >
          <Video />
          {label}
        </PopoverTrigger>
      )}
      <PopoverContent align="start" sideOffset={8} className={STREAM_SELECTOR_POPOVER_CLASS}>
        <VideoSelector embedded isActive={open} onVideoClicked={onVideoClicked} />
      </PopoverContent>
    </Popover>
  );
}

const EMPTY_STAGE_ITEM = {
  x: 0,
  y: 0,
  w: 24,
  h: 24,
  i: EMPTY_STAGE_ID,
  isResizable: true,
  isDraggable: true,
  moved: false,
};

function Content({ routeLayout }: { routeLayout: string }) {
  const t = useTranslations();
  const sp = useSearchParams();
  const app = useAppState();
  const store = useMultiviewStore();
  const [showSelectorForId, setShowSelectorForId] = useState<string | number>(-1);
  const [showSyncBar, setShowSyncBar] = useState(false);
  const [showReorder, setShowReorder] = useState(false);
  const layoutPrompt = useLayoutChangePrompt();
  const [collapsed, setCollapsed] = useState(false);
  const [stageW, setStageW] = useState(1440);
  const [stageH, setStageH] = useState(900);
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [showPresetEditor, setShowPresetEditor] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const stage = useRef<HTMLDivElement | null>(null);

  const vw = app.windowWidth || (typeof window !== "undefined" ? window.innerWidth : 1440);
  const vh = typeof window !== "undefined" ? window.innerHeight : 900;
  const isXs = vw < 600,
    isSm = vw < 960,
    isMd = vw < 1264;
  const rh = (stageH || vh) / 24,
    grh = Math.max(rh, 1);
  const cw = (stageW || vw) / 24;
  const showToolbarSelector = showSelectorForId === -2;
  const { activeInt, startInt } = useLayoutInteraction({
    layout: store.layout,
    setLayout: store.setLayout,
    stage,
    cw,
    grh,
  });

  useEffect(() => {
    document.title = `${t("component.mainNav.multiview")} - Holodex`;
  }, [t]);

  // Applies the layout from the URL (or refreshes stored videos) once, on mount.
  const applyRouteLayout = useEffectEvent(() => {
    if (routeLayout) {
      try {
        const parsed = decodeLayout(routeLayout);
        if (parsed.layout && parsed.content) {
          try {
            api.trackMultiviewLink(routeLayout).catch(console.error);
          } catch {}
          layoutPrompt.prompt(parsed, null, () => history.pushState({}, "", "/multiview"));
        }
      } catch (e) {
        console.error(e);
      }
      if (sp.get("t") || sp.get("offsets")) setShowSyncBar(true);
    } else store.fetchVideoData({ refreshLive: true });
  });
  useEffect(() => {
    applyRouteLayout();
  }, []);

  // Turning the screen re-lays out an automatic layout for its new shape.
  const reflowForScreen = useEffectEvent((stacked: boolean) =>
    reflowAutoLayout(store, !stacked, stacked),
  );
  useEffect(() => {
    const mql = window.matchMedia(STACKED_SCREEN_QUERY);
    const onChange = (e: MediaQueryListEvent) => reflowForScreen(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
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

  function toolbarClick(v: any) {
    const video = asTwitchVideo(v);
    if (!video) return;
    if (findEmptyCell(store)) tryFillVideo(store, video);
    else
      addVideoAutoLayout(store, video, isStackedScreen(), (l) => {
        layoutPrompt.setDefaultMerge(true);
        layoutPrompt.prompt(l);
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
  const onDelete = (id: string) => deleteVideoAutoLayout(store, id, isStackedScreen());
  const toggleFull = () =>
    document.fullscreenElement
      ? document.exitFullscreen?.()
      : document.documentElement.requestFullscreen();

  const buttons = Object.freeze([
    {
      icon: Grid2x2Plus,
      tooltip: t("views.multiview.addframe"),
      onClick: () => addCellAutoLayout(store, isStackedScreen()),
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
  const renderCellStreamSelector = (id: string | number) => (
    <StreamSelectorPopover
      open={String(showSelectorForId) === String(id)}
      onOpenChange={(nextOpen) => setShowSelectorForId(nextOpen ? id : -1)}
      label="Stream"
      onVideoClicked={(video) => cellDropdownClick(id, video)}
    />
  );

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
              <StreamSelectorPopover
                compact
                open={showToolbarSelector}
                onOpenChange={(open) => setShowSelectorForId(open ? -2 : -1)}
                label={t("views.multiview.video.selectLive")}
                onVideoClicked={toolbarDropdownClick}
              />
              <VideoSelector
                horizontal
                hideOrgSelector
                hideFavorites
                hidePlaylist
                hideUrlInput
                onVideoClicked={toolbarClick}
              />
            </div>
          }
          extraButtons={
            <MultiviewExtraButtons
              media={{ open: showMedia, setOpen: setShowMedia }}
              presets={{ open: showPresetMenu, setOpen: setShowPresetMenu }}
              reorder={{ open: showReorder, setOpen: setShowReorder }}
              presetEditor={{ open: showPresetEditor, setOpen: setShowPresetEditor }}
              onPreset={presetClick}
            />
          }
        />
      ) : (
        <ExpandToolbarTab onExpand={() => setCollapsed(false)} />
      )}

      <div ref={stage} className="relative min-h-0 w-full flex-1 overflow-hidden">
        <div className="relative h-full min-h-full min-w-full">
          <LayoutGrid
            activeInt={activeInt}
            startInt={startInt}
            cw={cw}
            reordering={showReorder}
            streamSelector={renderCellStreamSelector}
            onDelete={onDelete}
          />
          {!store.layout.length ? (
            <div className="absolute inset-0 z-10">
              <CellContainer
                item={EMPTY_STAGE_ITEM}
                editMode
                onSetContent={(_, content) => createInitialCell(content)}
              >
                <EmptyCell
                  item={EMPTY_STAGE_ITEM}
                  streamSelector={renderCellStreamSelector(EMPTY_STAGE_ID)}
                  onSetChat={(_, initAsTL) => createInitialCell({ type: "chat", initAsTL })}
                  showDeleteControl={false}
                />
              </CellContainer>
            </div>
          ) : null}
        </div>
      </div>
      {layoutPrompt.dialog}
      {showSyncBar ? (
        <MultiviewSyncBar
          className="mt-auto"
          routeTime={sp.get("t")}
          routeOffsets={sp.get("offsets")}
          onClose={() => setShowSyncBar(false)}
        />
      ) : null}
    </div>
  );
}
