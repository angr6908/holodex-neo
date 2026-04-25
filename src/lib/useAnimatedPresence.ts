"use client";

import { useEffect, useState } from "react";
import type { AnimationEvent } from "react";

export const POPOVER_MOTION_CLASS =
  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2";

export function useAnimatedPresence(open: boolean, timeout = 220) {
  const [present, setPresent] = useState(open);
  const [state, setState] = useState<"open" | "closed">(
    open ? "open" : "closed",
  );

  useEffect(() => {
    if (open) {
      setPresent(true);
      setState("open");
      return undefined;
    }
    setState("closed");
    const timer = window.setTimeout(() => setPresent(false), timeout + 50);
    return () => window.clearTimeout(timer);
  }, [open, timeout]);

  function onAnimationEnd(event: AnimationEvent<HTMLElement>) {
    if (event.target !== event.currentTarget) return;
    if (state === "closed") setPresent(false);
  }

  return { present, state, onAnimationEnd };
}
