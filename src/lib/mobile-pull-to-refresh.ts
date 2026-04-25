"use client";

type TouchPanEvent = TouchEvent & { deltaX: number; deltaY: number };

function onTouchPan({
  element,
  onpanstart,
  onpanmove,
  onpanend,
}: {
  element: Element;
  onpanstart?: (event: TouchPanEvent) => void;
  onpanmove?: (event: TouchPanEvent) => void;
  onpanend?: (event: TouchPanEvent) => void;
}) {
  let touchId: number | null = null;
  let startX = 0;
  let startY = 0;
  let panstartCalled = false;

  function calcMovement(event: TouchEvent): TouchPanEvent | false {
    const touch = Array.prototype.slice.call(event.changedTouches).filter((item: Touch) => item.identifier === touchId)[0] as Touch | undefined;
    if (!touch) return false;
    (event as TouchPanEvent).deltaX = touch.screenX - startX;
    (event as TouchPanEvent).deltaY = touch.screenY - startY;
    return event as TouchPanEvent;
  }

  function touchstart(event: TouchEvent) {
    const touch = event.changedTouches[0];
    if (!touch) return;
    touchId = touch.identifier;
    startX = touch.screenX;
    startY = touch.screenY;
    panstartCalled = false;
  }

  function touchmove(event: TouchEvent) {
    const panEvent = calcMovement(event);
    if (!panEvent) return;
    if (onpanstart && !panstartCalled) {
      onpanstart(panEvent);
      panstartCalled = true;
    }
    onpanmove?.(panEvent);
  }

  function touchend(event: TouchEvent) {
    const panEvent = calcMovement(event);
    if (panEvent) onpanend?.(panEvent);
  }

  element.addEventListener("touchstart", touchstart);
  if (onpanmove) element.addEventListener("touchmove", touchmove as EventListener, { passive: false });
  if (onpanend) element.addEventListener("touchend", touchend as EventListener);

  return function destroy() {
    element.removeEventListener("touchstart", touchstart);
    if (onpanmove) element.removeEventListener("touchmove", touchmove as EventListener);
    if (onpanend) element.removeEventListener("touchend", touchend as EventListener);
  };
}

const ptrAnimatesMaterial = {
  pulling(d: number, opts: any) {
    if (!opts.elControl) opts.elControl = opts.container.querySelector(".pull-to-refresh-material__control");
    const { threshold, elControl } = opts;
    if (!elControl) return;
    let p = d / threshold;
    if (p > 1) p = 1;
    else p = p * p * p;
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
      if (elControl?.style.transform) {
        elControl.style.transition = "transform 0.3s, opacity 0.15s";
        elControl.style.transform = "translate3d(-50%, 0, 0)";
        elControl.style.opacity = 0;
        elControl.addEventListener("transitionend", () => {
          elControl.style.transition = "";
          resolve();
        }, { once: true });
      } else {
        resolve();
      }
    });
  },
  restoring({ elControl }: any) {
    return new Promise<void>((resolve) => {
      if (!elControl) {
        resolve();
        return;
      }
      elControl.style.transition = "transform 0.3s";
      elControl.style.transform += " scale(0.01)";
      elControl.addEventListener("transitionend", () => {
        elControl.style.transition = "";
        resolve();
      }, { once: true });
    });
  },
};

export function pullToRefresh(opts: any) {
  opts = Object.assign({
    scrollable: document.body,
    threshold: 150,
    onStateChange() {},
    shouldPullToRefresh: () => true,
    animates: ptrAnimatesMaterial,
  }, opts);

  const { container, scrollable, threshold, refresh, onStateChange, animates, shouldPullToRefresh } = opts;
  let distance: number | null;
  let offset: number | null;
  let state: "pulling" | "aborting" | "reached" | "refreshing" | "restoring" | null;

  function addClass(cls: string) { container.classList.add(`pull-to-refresh--${cls}`); }
  function removeClass(cls: string) { container.classList.remove(`pull-to-refresh--${cls}`); }
  function scrollTop() {
    if (!scrollable || [window, document, document.body, document.documentElement].includes(scrollable)) {
      return document.documentElement.scrollTop || document.body.scrollTop;
    }
    return scrollable.scrollTop;
  }

  return onTouchPan({
    element: container,
    onpanmove(event) {
      let d = event.deltaY;

      if (scrollTop() > 0 && state === "reached") {
        removeClass(state);
        state = "pulling";
        addClass(state);
        onStateChange(state, opts);
      }

      if (
        !shouldPullToRefresh()
        || scrollTop() > 0
        || (d < 0 && !state)
        || (state && ["aborting", "refreshing", "restoring"].includes(state))
      ) return;

      if (event.cancelable) event.preventDefault();

      if (distance == null) {
        offset = d;
        state = "pulling";
        addClass(state);
        onStateChange(state, opts);
      }

      d -= offset || 0;
      if (d < 0) d = 0;
      distance = d;

      if ((d >= threshold && state !== "reached") || (d < threshold && state !== "pulling")) {
        if (state) removeClass(state);
        state = state === "reached" ? "pulling" : "reached";
        addClass(state);
        onStateChange(state, opts);
      }

      animates.pulling(d, opts);
    },
    onpanend() {
      if (state == null) return;
      if (state === "pulling") {
        removeClass(state);
        state = "aborting";
        onStateChange(state);
        addClass(state);
        animates.aborting(opts).then(() => {
          if (state) removeClass(state);
          distance = null;
          state = null;
          offset = null;
          onStateChange(state);
        });
      } else if (state === "reached") {
        removeClass(state);
        state = "refreshing";
        addClass(state);
        onStateChange(state, opts);
        animates.refreshing(opts);

        Promise.resolve(refresh()).then(() => {
          if (state) removeClass(state);
          state = "restoring";
          addClass(state);
          onStateChange(state);
          animates.restoring(opts).then(() => {
            if (state) removeClass(state);
            distance = null;
            state = null;
            offset = null;
            onStateChange(state);
          });
        });
      }
    },
  });
}
