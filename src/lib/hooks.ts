"use client";

import { type TouchEvent, useEffect, useLayoutEffect, useRef, useState } from "react";

// `useLayoutEffect` is a no-op during SSR, so fall back to `useEffect` there to
// silence the React warning. Client-side it runs synchronously after DOM
// mutations but before paint, which lets portal targets settle before the
// browser shows the page (no "segments appear one frame later" flicker).
export const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function useDomElement<T extends HTMLElement = HTMLElement>(id: string) {
  const [element, setElement] = useState<T | null>(null);

  useIsomorphicLayoutEffect(() => {
    const update = () =>
      setElement((prev) => {
        const next = document.getElementById(id) as T | null;
        return prev === next ? prev : next;
      });
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [id]);

  return element;
}

export function useSwipeTabs(onSwipe: (direction: -1 | 1) => void, threshold = 50) {
  const touchStartX = useRef<number | null>(null);

  return {
    onTouchStart(event: TouchEvent<HTMLElement>) {
      touchStartX.current = event.changedTouches?.[0]?.clientX ?? null;
    },
    onTouchEnd(event: TouchEvent<HTMLElement>) {
      if (touchStartX.current === null) return;
      const endX = event.changedTouches?.[0]?.clientX ?? touchStartX.current;
      const delta = endX - touchStartX.current;
      touchStartX.current = null;
      if (Math.abs(delta) < threshold) return;
      onSwipe(delta > 0 ? -1 : 1);
    },
  };
}
