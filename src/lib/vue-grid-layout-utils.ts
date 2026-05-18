type Item = {
  w: number; h: number; x: number; y: number; i: string | number;
  minW?: number; minH?: number; maxW?: number; maxH?: number;
  moved?: boolean; static?: boolean; isDraggable?: boolean; isResizable?: boolean;
  [key: string]: any;
};

type Layout = Item[];

export const cloneLayoutItem = (i: Item): Item => structuredClone(i);

const collides = (a: Item, b: Item) =>
  a !== b && String(a.i) !== String(b.i) && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const sortByRowCol = (l: Layout) => [...l].sort((a, b) => a.y - b.y || a.x - b.x);

export const getLayoutItem = (l: Layout, id: string | number) => l.find((i) => String(i.i) === String(id));

const firstCollision = (l: Layout, i: Item) => l.find((x) => collides(x, i));

export const getAllCollisions = (l: Layout, i: Item) => l.filter((x) => collides(x, i));

export function compact(layout: Layout, verticalCompact: boolean): Layout {
  const cmp = layout.filter((i) => i.static);
  const sorted = sortByRowCol(layout);
  const out = Array(layout.length) as Layout;
  sorted.forEach((l) => {
    if (!l.static) {
      if (verticalCompact) while (l.y > 0 && !firstCollision(cmp, l)) l.y -= 1;
      let c = firstCollision(cmp, l);
      while (c) { l.y = c.y + c.h; c = firstCollision(cmp, l); }
      cmp.push(l);
    }
    out[layout.indexOf(l)] = l;
    l.moved = false;
  });
  return out;
}

export function moveElement(layout: Layout, l: Item, x: number | undefined, y: number | undefined, isUserAction: boolean, preventCollision: boolean): Layout {
  if (l.static) return layout;
  const oldX = l.x, oldY = l.y;
  const movingUp = y !== undefined && l.y > y;
  if (typeof x === "number") l.x = x;
  if (typeof y === "number") l.y = y;
  l.moved = true;
  let sorted = sortByRowCol(layout);
  if (movingUp) sorted = sorted.reverse();
  const cs = getAllCollisions(sorted, l);
  if (preventCollision && cs.length) {
    l.x = oldX; l.y = oldY; l.moved = false;
    return layout;
  }
  cs.forEach((c) => {
    if (c.moved) return;
    if (l.y > c.y && l.y - c.y > c.h / 4) return;
    if (c.static) moveAway(layout, c, l, isUserAction);
    else moveAway(layout, l, c, isUserAction);
  });
  return layout;
}

function moveAway(layout: Layout, collidesWith: Item, toMove: Item, isUserAction: boolean): Layout {
  if (isUserAction) {
    const fake: Item = { x: toMove.x, y: Math.max(collidesWith.y - toMove.h, 0), w: toMove.w, h: toMove.h, i: "-1" };
    if (!firstCollision(layout, fake)) return moveElement(layout, toMove, undefined, fake.y, false, false);
  }
  return moveElement(layout, toMove, undefined, toMove.y + 1, false, false);
}

export const calcGridPosition = (x: number, y: number, w: number, h: number, cw: number, rh: number) => ({
  left: Math.round(cw * x),
  top: Math.round(rh * y),
  width: w === Infinity ? w : Math.round(cw * w),
  height: h === Infinity ? h : Math.round(rh * h),
});

export const calcGridXY = (top: number, left: number, innerW: number, innerH: number, cw: number, rh: number, cols = 24, maxRows = Infinity) => ({
  x: Math.max(Math.min(Math.round(left / cw), cols - innerW), 0),
  y: Math.max(Math.min(Math.round(top / rh), maxRows - innerH), 0),
});

export const calcGridWH = (height: number, width: number, innerX: number, innerY: number, cw: number, rh: number, cols = 24, maxRows = Infinity, autoSize = false) => ({
  w: Math.max(Math.min(Math.round(width / cw), cols - innerX), 0),
  h: Math.max(Math.min(autoSize ? Math.ceil(height / rh) : Math.round(height / rh), maxRows - innerY), 0),
});
