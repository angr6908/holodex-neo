"use client";

import { useEffect, useRef, useState, type TouchEvent } from "react";
export function useDomElement<T extends HTMLElement = HTMLElement>(id: string) {
  const [element, setElement] = useState<T | null>(null);

  useEffect(() => {
    const update = () => setElement(document.getElementById(id) as T | null);
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
