"use client";

// How far a touch moves before it counts as a pull or not; browsers wait about as long before
// they start scrolling.
const PULL_SLOP = 10;

// Pulling down in a popup or dialog, or in a list scrolled down under the finger, scrolls that
// instead of reloading the page behind it.
function claimedByElement(target: EventTarget | null) {
  for (let el = target instanceof Element ? target : null; el; el = el.parentElement) {
    if (el.scrollTop > 0) return true;
    const role = el.getAttribute("role");
    if (role === "dialog" || role === "alertdialog" || role === "menu" || role === "listbox")
      return true;
  }
  return false;
}

// Follows touches for downward pulls from the top of the page. A touch becomes a pull once it
// has moved PULL_SLOP, mostly downward, with the page at its top and `canPull()` true. From then
// the page doesn't scroll under it, `onPull` gets the distance pulled on each move and
// `onRelease` the final distance when the finger lifts (0 when the touch is cancelled). Any
// other touch is left alone, so sideways swipes and scrolling work as usual.
export function watchPulls({
  canPull,
  onPull,
  onRelease,
}: {
  canPull: () => boolean;
  onPull: (distance: number) => void;
  onRelease: (distance: number) => void;
}) {
  let id: number | null = null,
    startX = 0,
    startY = 0,
    // Unknown until the touch passes PULL_SLOP, then fixed until the finger lifts.
    pulling: boolean | null = null,
    distance = 0;

  const trackedTouch = (e: TouchEvent) =>
    id === null ? undefined : [...e.changedTouches].find((t) => t.identifier === id);

  const start = (e: TouchEvent) => {
    // A second finger doesn't take over a pull, and two fingers before one is a pinch.
    if (pulling) return;
    const t = e.changedTouches[0];
    id = t && e.touches.length === 1 ? t.identifier : null;
    startX = t?.clientX ?? 0;
    startY = t?.clientY ?? 0;
    pulling = null;
  };
  const move = (e: TouchEvent) => {
    const t = trackedTouch(e);
    if (!t || pulling === false) return;
    if (pulling === null) {
      const dx = Math.abs(t.clientX - startX);
      const dy = t.clientY - startY;
      if (Math.max(dx, Math.abs(dy)) < PULL_SLOP) return;
      pulling = dy > dx && window.scrollY <= 0 && canPull() && !claimedByElement(e.target);
      if (!pulling) return;
      // Measured from here, the pull starts at 0.
      startY = t.clientY;
    }
    if (e.cancelable) e.preventDefault();
    distance = Math.max(0, t.clientY - startY);
    onPull(distance);
  };
  const end = (e: TouchEvent) => {
    if (!trackedTouch(e)) return;
    if (pulling) onRelease(e.type === "touchcancel" ? 0 : distance);
    id = null;
    pulling = null;
    distance = 0;
  };

  document.addEventListener("touchstart", start, { passive: true });
  document.addEventListener("touchmove", move, { passive: false });
  document.addEventListener("touchend", end, { passive: true });
  document.addEventListener("touchcancel", end, { passive: true });
  return () => {
    document.removeEventListener("touchstart", start);
    document.removeEventListener("touchmove", move);
    document.removeEventListener("touchend", end);
    document.removeEventListener("touchcancel", end);
  };
}
