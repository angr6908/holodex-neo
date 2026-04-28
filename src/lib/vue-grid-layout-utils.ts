export type VueGridLayoutItem = {
  w: number;
  h: number;
  x: number;
  y: number;
  i: string | number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  moved?: boolean;
  static?: boolean;
  isDraggable?: boolean;
  isResizable?: boolean;
  [key: string]: any;
};

export type VueGridLayout = VueGridLayoutItem[];

export function cloneLayoutItem(layoutItem: VueGridLayoutItem): VueGridLayoutItem {
  return JSON.parse(JSON.stringify(layoutItem));
}

export function collides(l1: VueGridLayoutItem, l2: VueGridLayoutItem): boolean {
  if (l1 === l2 || String(l1.i) === String(l2.i)) return false;
  if (l1.x + l1.w <= l2.x) return false;
  if (l1.x >= l2.x + l2.w) return false;
  if (l1.y + l1.h <= l2.y) return false;
  if (l1.y >= l2.y + l2.h) return false;
  return true;
}

export function sortLayoutItemsByRowCol(layout: VueGridLayout): VueGridLayout {
  return [...layout].sort((a, b) => {
    if (a.y === b.y && a.x === b.x) return 0;
    return a.y > b.y || (a.y === b.y && a.x > b.x) ? 1 : -1;
  });
}

export function getLayoutItem(layout: VueGridLayout, id: string | number): VueGridLayoutItem | undefined {
  return layout.find((item) => String(item.i) === String(id));
}

export function getFirstCollision(layout: VueGridLayout, layoutItem: VueGridLayoutItem): VueGridLayoutItem | undefined {
  return layout.find((item) => collides(item, layoutItem));
}

export function getAllCollisions(layout: VueGridLayout, layoutItem: VueGridLayoutItem): VueGridLayoutItem[] {
  return layout.filter((item) => collides(item, layoutItem));
}

export function compact(layout: VueGridLayout, verticalCompact: boolean): VueGridLayout {
  const compareWith = layout.filter((item) => item.static);
  const sorted = sortLayoutItemsByRowCol(layout);
  const out = Array(layout.length) as VueGridLayout;
  sorted.forEach((item) => {
    const l = item;
    if (!l.static) {
      if (verticalCompact) {
        while (l.y > 0 && !getFirstCollision(compareWith, l)) l.y -= 1;
      }
      let collision = getFirstCollision(compareWith, l);
      while (collision) {
        l.y = collision.y + collision.h;
        collision = getFirstCollision(compareWith, l);
      }
      compareWith.push(l);
    }
    out[layout.indexOf(l)] = l;
    l.moved = false;
  });
  return out;
}

export function moveElement(
  layout: VueGridLayout,
  l: VueGridLayoutItem,
  x: number | undefined,
  y: number | undefined,
  isUserAction: boolean,
  preventCollision: boolean,
): VueGridLayout {
  if (l.static) return layout;

  const oldX = l.x;
  const oldY = l.y;
  const movingUp = y !== undefined && l.y > y;
  if (typeof x === "number") l.x = x;
  if (typeof y === "number") l.y = y;
  l.moved = true;

  let sorted = sortLayoutItemsByRowCol(layout);
  if (movingUp) sorted = sorted.reverse();
  const collisions = getAllCollisions(sorted, l);

  if (preventCollision && collisions.length) {
    l.x = oldX;
    l.y = oldY;
    l.moved = false;
    return layout;
  }

  collisions.forEach((collision) => {
    if (collision.moved) return;
    if (l.y > collision.y && l.y - collision.y > collision.h / 4) return;
    if (collision.static) moveElementAwayFromCollision(layout, collision, l, isUserAction);
    else moveElementAwayFromCollision(layout, l, collision, isUserAction);
  });

  return layout;
}

export function moveElementAwayFromCollision(
  layout: VueGridLayout,
  collidesWith: VueGridLayoutItem,
  itemToMove: VueGridLayoutItem,
  isUserAction: boolean,
): VueGridLayout {
  const preventCollision = false;
  if (isUserAction) {
    const fakeItem: VueGridLayoutItem = {
      x: itemToMove.x,
      y: Math.max(collidesWith.y - itemToMove.h, 0),
      w: itemToMove.w,
      h: itemToMove.h,
      i: "-1",
    };
    if (!getFirstCollision(layout, fakeItem)) {
      return moveElement(layout, itemToMove, undefined, fakeItem.y, preventCollision, false);
    }
  }
  return moveElement(layout, itemToMove, undefined, itemToMove.y + 1, preventCollision, false);
}

export function calcGridPosition(x: number, y: number, w: number, h: number, colWidth: number, rowHeight: number) {
  return {
    left: Math.round(colWidth * x),
    top: Math.round(rowHeight * y),
    width: w === Infinity ? w : Math.round(colWidth * w),
    height: h === Infinity ? h : Math.round(rowHeight * h),
  };
}

export function calcGridXY(top: number, left: number, innerW: number, innerH: number, colWidth: number, rowHeight: number, cols = 24, maxRows = Infinity) {
  let x = Math.round(left / colWidth);
  let y = Math.round(top / rowHeight);
  x = Math.max(Math.min(x, cols - innerW), 0);
  y = Math.max(Math.min(y, maxRows - innerH), 0);
  return { x, y };
}

export function calcGridWH(height: number, width: number, innerX: number, innerY: number, colWidth: number, rowHeight: number, cols = 24, maxRows = Infinity, autoSizeFlag = false) {
  let w = Math.round(width / colWidth);
  let h = autoSizeFlag ? Math.ceil(height / rowHeight) : Math.round(height / rowHeight);
  w = Math.max(Math.min(w, cols - innerX), 0);
  h = Math.max(Math.min(h, maxRows - innerY), 0);
  return { w, h };
}
