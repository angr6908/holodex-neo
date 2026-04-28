"use client";

import { useRef } from "react";

export function useSwipeTabs(onSwipe: (direction: -1 | 1) => void, threshold = 50) {
  const touchStartX = useRef<number | null>(null);
  return {
    onTouchStart(event: React.TouchEvent<HTMLElement>) {
      touchStartX.current = event.changedTouches?.[0]?.clientX ?? null;
    },
    onTouchEnd(event: React.TouchEvent<HTMLElement>) {
      if (touchStartX.current === null) return;
      const endX = event.changedTouches?.[0]?.clientX ?? touchStartX.current;
      const delta = endX - touchStartX.current;
      touchStartX.current = null;
      if (Math.abs(delta) < threshold) return;
      onSwipe(delta > 0 ? -1 : 1);
    },
  };
}
