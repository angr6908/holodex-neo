import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
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

// Dragging or resizing one cell of the 24x24 multiview grid.
export type Interaction = {
  type: "drag" | "resize";
  id: string;
  direction?: string;
  startClientX: number;
  startClientY: number;
  startItem: any;
  startPixel: { left: number; top: number; width: number; height: number };
};

// Pointer-downs on controls inside a cell don't start a drag.
const ignoreDrag = (t: EventTarget | null) =>
  t instanceof Element &&
  !!t.closest("a,button,input,textarea,select,option,[data-resize-handle],iframe");

function sizeLimits(item: any) {
  return {
    minW: Number(item.minW ?? 1),
    minH: Number(item.minH ?? 1),
    maxW: Number.isFinite(item.maxW) ? Number(item.maxW) : 24,
    maxH: Number.isFinite(item.maxH) ? Number(item.maxH) : Infinity,
  };
}

function clampItem(item: any) {
  const { minW, minH, maxW, maxH } = sizeLimits(item);
  const n = { ...item };
  n.w = Math.max(minW, Math.min(maxW, n.w));
  n.h = Math.max(minH, Math.min(maxH, n.h));
  n.x = Math.max(0, Math.min(24 - n.w, n.x));
  n.y = Math.max(0, n.y);
  return n;
}

// The cell's pixel box relative to its positioned parent (the stage), or from grid math when it
// isn't laid out.
function pixelRect(el: HTMLElement, item: any, stage: HTMLElement | null, cw: number, grh: number) {
  const parent = el.offsetParent instanceof HTMLElement ? el.offsetParent : stage;
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

// Resizes the pixel box from the dragged edges, kept within the item's min/max size; dragging a
// west/north edge past a limit moves the opposite edge instead of the box.
function resizedBox(i: Interaction, dx: number, dy: number, cw: number, grh: number) {
  const dir = i.direction || "";
  const { minW, minH, maxW, maxH } = sizeLimits(i.startItem);
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
  return np;
}

// The grid item an interaction has moved/resized to for the pointer at (cx, cy).
function interactionItem(i: Interaction, cx: number, cy: number, cw: number, grh: number) {
  const dx = cx - i.startClientX,
    dy = cy - i.startClientY;
  const s = i.startItem;
  if (i.type === "drag") {
    const np = { ...i.startPixel, left: i.startPixel.left + dx, top: i.startPixel.top + dy };
    const p = calcGridXY(np.top, np.left, s.w, s.h, Math.max(cw, 1), Math.max(grh, 1), 24);
    return clampItem({ ...s, x: p.x, y: p.y });
  }
  const np = resizedBox(i, dx, dy, cw, grh);
  const wh = calcGridWH(np.height, np.width, s.x, s.y, Math.max(cw, 1), Math.max(grh, 1), 24);
  return clampItem({
    ...s,
    ...calcGridXY(np.top, np.left, wh.w, wh.h, Math.max(cw, 1), Math.max(grh, 1), 24),
    w: wh.w,
    h: wh.h,
  });
}

// The layout with `next` applied: a drag moves the item (pushing others), a resize stops at the
// nearest cells to the right/below instead of overlapping them. Then everything floats up.
function layoutWith(layout: any[], next: any, mode: "drag" | "resize") {
  const src = layout.map(cloneLayoutItem);
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

// Pointer dragging and resizing of grid cells. `cw`/`grh` are the stage's column width and row
// height in pixels.
export function useLayoutInteraction({
  layout,
  setLayout,
  stage,
  cw,
  grh,
}: {
  layout: any[];
  setLayout: (layout: any[]) => void;
  stage: React.RefObject<HTMLDivElement | null>;
  cw: number;
  grh: number;
}) {
  const layoutRef = useRef(layout);
  const intRef = useRef<Interaction | null>(null);
  const [activeInt, setActiveInt] = useState<Interaction | null>(null);

  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  function applyItem(next: any, mode: "drag" | "resize") {
    const nl = layoutWith(layoutRef.current, next, mode);
    if (!nl) return;
    layoutRef.current = nl;
    setLayout(nl);
  }

  function startInt(e: ReactPointerEvent, item: any, type: "drag" | "resize", direction?: string) {
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
      startPixel: pixelRect(target, item, stage.current, cw, grh),
    };
    intRef.current = i;
    setActiveInt(i);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  const onInteractionMove = useEffectEvent((e: PointerEvent) => {
    const i = intRef.current;
    if (!i) return;
    e.preventDefault();
    applyItem(interactionItem(i, e.clientX, e.clientY, cw, grh), i.type);
  });
  useEffect(() => {
    if (!activeInt) return;
    const onMove = (e: PointerEvent) => onInteractionMove(e);
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
  }, [activeInt]);

  return { activeInt, startInt };
}
