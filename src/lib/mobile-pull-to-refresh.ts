"use client";

type PanEvent = TouchEvent & { deltaX: number; deltaY: number };

function onTouchPan({ element, onpanstart, onpanmove, onpanend }: {
  element: Element;
  onpanstart?: (e: PanEvent) => void;
  onpanmove?: (e: PanEvent) => void;
  onpanend?: (e: PanEvent) => void;
}) {
  let id: number | null = null, sx = 0, sy = 0, started = false;

  const calc = (e: TouchEvent): PanEvent | false => {
    const t = [...e.changedTouches].find((x) => x.identifier === id);
    if (!t) return false;
    (e as PanEvent).deltaX = t.screenX - sx;
    (e as PanEvent).deltaY = t.screenY - sy;
    return e as PanEvent;
  };

  const start = (e: TouchEvent) => {
    const t = e.changedTouches[0];
    if (!t) return;
    id = t.identifier; sx = t.screenX; sy = t.screenY; started = false;
  };
  const move = (e: TouchEvent) => {
    const p = calc(e);
    if (!p) return;
    if (onpanstart && !started) { onpanstart(p); started = true; }
    onpanmove?.(p);
  };
  const end = (e: TouchEvent) => {
    const p = calc(e);
    if (p) onpanend?.(p);
  };

  element.addEventListener("touchstart", start);
  if (onpanmove) element.addEventListener("touchmove", move as EventListener, { passive: false });
  if (onpanend) element.addEventListener("touchend", end as EventListener);

  return () => {
    element.removeEventListener("touchstart", start);
    if (onpanmove) element.removeEventListener("touchmove", move as EventListener);
    if (onpanend) element.removeEventListener("touchend", end as EventListener);
  };
}

const material = {
  pulling(d: number, o: any) {
    if (!o.elControl) o.elControl = o.container.querySelector(".pull-to-refresh-material__control");
    const { threshold, elControl } = o;
    if (!elControl) return;
    let p = d / threshold;
    p = p > 1 ? 1 : p * p * p;
    const y = d / 2.5;
    elControl.style.opacity = String(p);
    elControl.style.transform = y ? `translate3d(-50%, ${y}px, 0) rotate(${360 * p}deg)` : "";
  },
  refreshing({ elControl, threshold }: any) {
    if (!elControl) return;
    elControl.style.transition = "transform 0.2s";
    elControl.style.transform = `translate3d(-50%, ${threshold / 2.5}px, 0)`;
  },
  aborting({ elControl }: any) {
    return new Promise<void>((resolve) => {
      if (!elControl?.style.transform) return resolve();
      elControl.style.transition = "transform 0.3s, opacity 0.15s";
      elControl.style.transform = "translate3d(-50%, 0, 0)";
      elControl.style.opacity = 0;
      elControl.addEventListener("transitionend", () => { elControl.style.transition = ""; resolve(); }, { once: true });
    });
  },
  restoring({ elControl }: any) {
    return new Promise<void>((resolve) => {
      if (!elControl) return resolve();
      elControl.style.transition = "transform 0.3s";
      elControl.style.transform += " scale(0.01)";
      elControl.addEventListener("transitionend", () => { elControl.style.transition = ""; resolve(); }, { once: true });
    });
  },
};

type State = "pulling" | "aborting" | "reached" | "refreshing" | "restoring" | null;

export function pullToRefresh(opts: any) {
  opts = { scrollable: document.body, threshold: 150, onStateChange() {}, shouldPullToRefresh: () => true, animates: material, ...opts };
  const { container, scrollable, threshold, refresh, onStateChange, animates, shouldPullToRefresh } = opts;
  let distance: number | null = null, offset: number | null = null, state: State = null;

  const cls = (op: "add" | "remove", c: string) => container.classList[op](`pull-to-refresh--${c}`);
  const scrollTop = () => {
    if (!scrollable || [window, document, document.body, document.documentElement].includes(scrollable))
      return document.documentElement.scrollTop || document.body.scrollTop;
    return scrollable.scrollTop;
  };

  return onTouchPan({
    element: container,
    onpanmove(event) {
      let d = event.deltaY;
      if (scrollTop() > 0 && state === "reached") {
        cls("remove", state); state = "pulling"; cls("add", state); onStateChange(state, opts);
      }
      if (!shouldPullToRefresh() || scrollTop() > 0 || (d < 0 && !state) || (state && ["aborting", "refreshing", "restoring"].includes(state))) return;
      if (event.cancelable) event.preventDefault();
      if (distance == null) { offset = d; state = "pulling"; cls("add", state); onStateChange(state, opts); }
      d -= offset || 0;
      if (d < 0) d = 0;
      distance = d;
      if ((d >= threshold && state !== "reached") || (d < threshold && state !== "pulling")) {
        if (state) cls("remove", state);
        state = state === "reached" ? "pulling" : "reached";
        cls("add", state); onStateChange(state, opts);
      }
      animates.pulling(d, opts);
    },
    onpanend() {
      if (!state) return;
      const reset = () => { if (state) cls("remove", state); distance = null; state = null; offset = null; onStateChange(state); };
      if (state === "pulling") {
        cls("remove", state); state = "aborting"; onStateChange(state); cls("add", state);
        animates.aborting(opts).then(reset);
      } else if (state === "reached") {
        cls("remove", state); state = "refreshing"; cls("add", state); onStateChange(state, opts);
        animates.refreshing(opts);
        Promise.resolve(refresh()).then(() => {
          if (state) cls("remove", state);
          state = "restoring"; cls("add", state); onStateChange(state);
          animates.restoring(opts).then(reset);
        });
      }
    },
  });
}
