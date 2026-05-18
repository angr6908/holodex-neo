"use client";

import { useEffect, useRef, useState } from "react";
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
import { CellContainer, EmptyCell, gridAreaClass, LayoutChangePrompt, MultiviewBackground, PresetEditor, PresetSelector, ReorderLayout } from "@/components/multiview/page-parts";
import { MultiviewSyncBar } from "@/components/multiview/MultiviewSyncBar";
import * as icons from "@/lib/icons";
import { calcGridPosition, calcGridWH, calcGridXY, cloneLayoutItem, compact, getAllCollisions, getLayoutItem, moveElement } from "@/lib/vue-grid-layout-utils";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const RESIZE_DIRS = ["s", "w", "e", "n", "sw", "nw", "se", "ne"];
const HANDLE_POS: Record<string, string> = {
  n: "top-0 left-[35%] h-5 w-[30%]", s: "bottom-0 left-[35%] h-5 w-[30%]",
  w: "left-0 top-[35%] h-[30%] w-5", e: "right-0 top-[35%] h-[30%] w-5",
  nw: "left-0 top-0 h-5 w-5", ne: "right-0 top-0 h-5 w-5",
  sw: "bottom-0 left-0 h-5 w-5", se: "bottom-0 right-0 h-5 w-5",
};

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
  const layoutParam = Array.isArray(params.layout) ? decodeURIComponent(params.layout.join("/")) : "";
  return <MultiviewProvider><MultiviewVideoCellsProvider><Content routeLayout={layoutParam} /></MultiviewVideoCellsProvider></MultiviewProvider>;
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
  const isXs = vw < 600, isSm = vw < 960, isMd = vw < 1264;
  const rh = (stageH || vh) / 24, grh = Math.max(rh, 1);
  const cw = (stageW || vw) / 24;
  const showSelector = showSelectorForId !== -1;

  useEffect(() => { layoutRef.current = store.layout; }, [store.layout]);
  useEffect(() => { document.title = `${t("component.mainNav.multiview")} - Holodex`; }, [t]);

  useEffect(() => {
    if (routeLayout) {
      try {
        const parsed = decodeLayout(routeLayout);
        if (parsed.layout && parsed.content) {
          try { api.trackMultiviewLink(routeLayout).catch(console.error); } catch {}
          promptLayoutChange(parsed, null, () => history.pushState({}, "", "/multiview"));
        }
      } catch (e) { console.error(e); }
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

  const handleClass = (d: string) =>
    cn("absolute box-border min-h-5 min-w-5 bg-primary bg-clip-content p-1 opacity-30", HANDLE_POS[d], `cursor-${d}-resize`);

  function pixelRect(el: HTMLElement, item: any) {
    const parent = el.offsetParent instanceof HTMLElement ? el.offsetParent : stage.current;
    if (parent) {
      const r = el.getBoundingClientRect(), pr = parent.getBoundingClientRect();
      return { left: r.left - pr.left + parent.scrollLeft, top: r.top - pr.top + parent.scrollTop, width: r.width, height: r.height };
    }
    const p = calcGridPosition(item.x, item.y, item.w, item.h, cw, grh);
    return { left: cw * item.x, top: p.top, width: cw * item.w, height: p.height };
  }

  function nextLayout(next: any, mode: "drag" | "resize") {
    const src = layoutRef.current.map(cloneLayoutItem);
    const item = getLayoutItem(src, next.i);
    if (!item) return null;
    if (mode === "resize") {
      const cs = getAllCollisions(src, { ...item, ...next }).filter((x) => String(x.i) !== String(item.i));
      if (cs.length) {
        let lx = Infinity, ly = Infinity;
        cs.forEach((c) => { if (c.x > next.x) lx = Math.min(lx, c.x); if (c.y > next.y) ly = Math.min(ly, c.y); });
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
    t instanceof Element && !!t.closest("a,button,input,textarea,select,option,[data-resize-handle],iframe");

  function startInt(e: React.PointerEvent, item: any, type: "drag" | "resize", direction?: string) {
    if (e.button !== 0 || item.static) return;
    if (type === "drag" && (item.isDraggable === false || ignoreDrag(e.target))) return;
    if (type === "resize" && item.isResizable === false) return;
    e.preventDefault();
    if (type === "resize") e.stopPropagation();
    const target = (type === "drag" ? e.currentTarget : e.currentTarget.parentElement) as HTMLElement;
    const i: Interaction = { type, id: String(item.i), direction, startClientX: e.clientX, startClientY: e.clientY, startItem: { ...item }, startPixel: pixelRect(target, item) };
    intRef.current = i;
    setActiveInt(i);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function clamp(item: any) {
    const minW = Number(item.minW ?? 1), minH = Number(item.minH ?? 1);
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
    const dx = cx - i.startClientX, dy = cy - i.startClientY;
    const s = i.startItem;
    if (i.type === "drag") {
      const np = { ...i.startPixel, left: i.startPixel.left + dx, top: i.startPixel.top + dy };
      const p = calcGridXY(np.top, np.left, s.w, s.h, Math.max(cw, 1), Math.max(grh, 1), 24);
      return clamp({ ...s, x: p.x, y: p.y });
    }
    const dir = i.direction || "";
    const minW = Number(s.minW ?? 1), minH = Number(s.minH ?? 1);
    const maxW = Number.isFinite(s.maxW) ? Number(s.maxW) : 24;
    const maxH = Number.isFinite(s.maxH) ? Number(s.maxH) : Infinity;
    const minP = calcGridPosition(0, 0, minW, minH, Math.max(cw, 1), Math.max(grh, 1));
    const maxP = calcGridPosition(0, 0, maxW, maxH, Math.max(cw, 1), Math.max(grh, 1));
    const np = { ...i.startPixel };
    if (dir.includes("e")) np.width = i.startPixel.width + dx;
    if (dir.includes("s")) np.height = i.startPixel.height + dy;
    if (dir.includes("w")) { np.left = i.startPixel.left + dx; np.width = i.startPixel.width - dx; }
    if (dir.includes("n")) { np.top = i.startPixel.top + dy; np.height = i.startPixel.height - dy; }
    if (np.width < minP.width) { if (dir.includes("w")) np.left += np.width - minP.width; np.width = minP.width; }
    if (np.width > maxP.width) { if (dir.includes("w")) np.left += np.width - maxP.width; np.width = maxP.width; }
    if (np.height < minP.height) { if (dir.includes("n")) np.top += np.height - minP.height; np.height = minP.height; }
    if (np.height > maxP.height) { if (dir.includes("n")) np.top += np.height - maxP.height; np.height = maxP.height; }
    const wh = calcGridWH(np.height, np.width, s.x, s.y, Math.max(cw, 1), Math.max(grh, 1), 24);
    return clamp({ ...s, ...calcGridXY(np.top, np.left, wh.w, wh.h, Math.max(cw, 1), Math.max(grh, 1), 24), w: wh.w, h: wh.h });
  }

  function promptLayoutChange(lc: any, confirmFn?: (() => void) | null, cancelFn?: (() => void) | null) {
    if (overwriteDialog) return;
    if (!store.layout?.length) { setMultiview(store, lc); return; }
    setOverwritePreview(lc);
    overwriteConfirm.current = (m: boolean) => { setOverwriteDialog(false); setMultiview(store, { ...lc, mergeContent: m }); confirmFn?.(); };
    overwriteCancel.current = () => { setOverwriteDialog(false); cancelFn?.(); };
    setOverwriteDialog(true);
  }

  function checkStream(v: any) {
    if (v.type !== "placeholder") return v;
    const tw = v.link?.match(TWITCH_VIDEO_URL_REGEX)?.groups?.id;
    return tw ? { ...v, id: tw, type: "twitch" } : null;
  }

  function toolbarClick(v: any) {
    const video = checkStream(v);
    if (!video) return;
    if (findEmptyCell(store)) tryFillVideo(store, video);
    else addVideoAutoLayout(store, video, app.isMobile, (l) => { setOverwriteMerge(true); promptLayoutChange(l); });
  }

  function videoClick(v: any) {
    if (Number(showSelectorForId) < -1) return toolbarClick(v);
    const video = checkStream(v);
    if (!video) return;
    addVideoWithId(store, video, showSelectorForId);
    setShowSelectorForId(-1);
  }

  const presetClick = (p: any) => { setShowPresetMenu(false); setMultiview(store, { ...structuredClone(p), mergeContent: true }); };
  const onDelete = (id: string) => deleteVideoAutoLayout(store, id, app.isMobile);
  const toggleFull = () => document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen();

  useEffect(() => {
    if (!activeInt) return;
    const onMove = (e: PointerEvent) => {
      const i = intRef.current;
      if (!i) return;
      e.preventDefault();
      applyItem(intItem(i, e.clientX, e.clientY), i.type);
    };
    const onUp = () => { if (intRef.current) { intRef.current = null; setActiveInt(null); } };
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
    { icon: Grid2x2, tooltip: t("views.multiview.addframe"), onClick: () => addCellAutoLayout(store, app.isMobile), color: "green", collapse: isSm },
    { icon: RefreshCw, tooltip: t("views.multiview.archiveSync"), onClick: () => setShowSyncBar((v) => !v), color: "deep-purple lighten-2", collapse: isXs },
    { icon: icons.Trash2, tooltip: t("component.music.clearPlaylist"), onClick: () => { store.reset(); setShowSyncBar(false); }, color: "red", collapse: isSm },
    { icon: icons.Maximize2, tooltip: t("views.multiview.fullScreen"), onClick: toggleFull, collapse: isMd },
  ]);
  const mediaLbl = t("views.multiview.mediaControls"), presetLbl = t("views.multiview.changeLayout");
  const reorderLbl = t("views.multiview.reorderLayout"), editorLbl = t("views.multiview.presetEditor.title");

  return (
    <div className={cn("relative flex h-[100dvh] min-h-[100dvh] w-full flex-col overflow-hidden", app.isMobile && "select-none")}>
      {!collapsed ? (
        <MultiviewToolbar compact={isSm} buttons={buttons as any} onCollapse={() => setCollapsed(true)} left={isXs ? <div className="flex min-w-0 flex-1 items-center gap-2"><Button type="button" size="icon" variant="secondary" onClick={() => setShowSelectorForId(-2)}><SquarePlus className="size-6" /></Button><VideoSelector horizontal compact onVideoClicked={toolbarClick} /></div> : <VideoSelector horizontal onVideoClicked={toolbarClick} />} extraButtons={<TooltipProvider>
          <div className="relative"><Tooltip><TooltipTrigger render={<Button type="button" size="icon" variant="secondary" aria-label={mediaLbl} onClick={(e) => { e.stopPropagation(); setShowMedia(!showMedia); }} />}><SlidersVertical className="size-5" /></TooltipTrigger><TooltipContent>{mediaLbl}</TooltipContent></Tooltip><MediaControls open={showMedia} /></div>
          <Popover open={showPresetMenu} onOpenChange={setShowPresetMenu}>
            <Tooltip><TooltipTrigger render={<PopoverTrigger render={<Button type="button" size="icon" variant="secondary" className="h-8 w-8 rounded-xl transition-colors" aria-label={presetLbl} />} />}><icons.Grid2x2 className="size-5" /></TooltipTrigger><TooltipContent>{presetLbl}</TooltipContent></Tooltip>
            <PopoverContent align="end" sideOffset={8} className="p-0"><PresetSelector onSelected={presetClick} /></PopoverContent>
          </Popover>
          <Popover open={showReorder} onOpenChange={setShowReorder}>
            <Tooltip><TooltipTrigger render={<PopoverTrigger render={<Button type="button" size="icon" variant="secondary" className="h-8 w-8 rounded-xl transition-colors" aria-label={reorderLbl} />} />}><ReorderIcon className="size-5" /></TooltipTrigger><TooltipContent>{reorderLbl}</TooltipContent></Tooltip>
            <PopoverContent align="end" sideOffset={8} className="p-3"><ReorderLayout isActive={showReorder} /></PopoverContent>
          </Popover>
          <Popover open={showPresetEditor} onOpenChange={setShowPresetEditor}>
            <Tooltip><TooltipTrigger render={<PopoverTrigger render={<Button type="button" size="icon" variant="secondary" className="h-8 w-8 rounded-xl transition-colors" aria-label={editorLbl} />} />}><Save className="size-5" /></TooltipTrigger><TooltipContent>{editorLbl}</TooltipContent></Tooltip>
            <PopoverContent align="end" sideOffset={8} className="w-[min(92vw,22rem)] p-4"><PresetEditor layout={store.layout} content={store.layoutContent} onClose={() => setShowPresetEditor(false)} /></PopoverContent>
          </Popover>
        </TooltipProvider>} />
      ) : <Button className="absolute right-0 top-0 z-10 m-1.5 opacity-70" type="button" size="icon" variant="secondary" onClick={() => setCollapsed(false)}><icons.ChevronDown className="size-5" /></Button>}

      <div ref={stage} className="relative min-h-0 w-full flex-1 overflow-hidden">
        <div className="relative h-full min-h-full min-w-full">
          <MultiviewBackground showTips={store.layout.length === 0} collapseToolbar={collapsed} />
          <div className="absolute inset-0 grid h-full w-full grid-cols-[repeat(24,minmax(0,1fr))] grid-rows-[repeat(24,minmax(0,1fr))] transition-none">
            {store.layout.map((item) => {
              const c = store.layoutContent[item.i];
              const drag = activeInt?.type === "drag" && activeInt.id === String(item.i);
              const resize = activeInt?.type === "resize" && activeInt.id === String(item.i);
              return (
                <div key={`mvgrid${item.i}`} className={cn("transition-transform duration-200", gridAreaClass(item), drag && "z-30 cursor-none select-none transition-none", resize && "z-30 opacity-60", showReorder && "pointer-events-none")} onPointerDown={(e) => startInt(e, item, "drag")}>
                  <CellContainer item={item} disablePointerEvents={drag || resize}>
                    {c?.type === "chat" ? <ChatCell item={item} tl={c.initAsTL} cellWidth={cw * item.w} onDelete={onDelete} />
                      : c?.type === "video" ? <VideoCell item={item} onDelete={onDelete} />
                      : <EmptyCell item={item} onShowSelector={(id) => setShowSelectorForId(id)} onDelete={onDelete} />}
                  </CellContainer>
                  {item.isResizable !== false && !item.static ? RESIZE_DIRS.map((d, i) => (
                    <span key={`handle${d}${i}`} className={handleClass(d)} data-resize-handle="true" onPointerDown={(e) => startInt(e, item, "resize", d)} />
                  )) : null}
                </div>
              );
            })}
            {store.layout.filter((i) => activeInt && String(i.i) === activeInt.id).map((p) => (
              <div key="placeholder" className={cn("z-20 select-none bg-destructive/20 transition-transform duration-100", gridAreaClass(p))} />
            ))}
          </div>
        </div>
      </div>
      <Dialog open={showSelector} onOpenChange={(o) => { if (!o) setShowSelectorForId(-1); }}><DialogContent className="w-[min(94vw,30rem)] p-0 sm:w-auto sm:max-w-[75vw]"><VideoSelector isActive={showSelector} onVideoClicked={videoClick} /></DialogContent></Dialog>
      <LayoutChangePrompt open={overwriteDialog} onOpenChange={setOverwriteDialog} cancelFn={(m) => overwriteCancel.current?.(m)} confirmFn={(m) => overwriteConfirm.current?.(m)} defaultOverwrite={overwriteMerge} layoutPreview={overwritePreview} />
      {showSyncBar ? <MultiviewSyncBar className="mt-auto" /> : null}
    </div>
  );
}
