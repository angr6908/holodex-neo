"use client";

import { usePathname } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { RotateCw } from "@/lib/icons";
import { watchPulls } from "@/lib/mobile-pull-to-refresh";
import { hasTopNav } from "@/lib/top-nav";

// Pages with gestures of their own (the player, the video editor) don't pull to refresh, and
// neither do pages without the top nav, which the indicator comes out from under.
const OWN_GESTURE_PATHS = ["/watch", "/edit/video"];

// How far (px) the indicator comes out from under the nav at most, and how far out letting go
// reloads the page; it waits there while the page reloads.
const MAX_OFFSET = 128;
const REFRESH_OFFSET = 72;

type Phase = "idle" | "pulling" | "armed" | "refreshing";

// A small round chip slides out from under the nav with the finger, its icon turning as it goes.
// Once far enough out the icon turns from grey to full contrast: letting go there reloads the
// page, the icon spinning until it does; letting go sooner slides the chip back. Only touch
// screens pull.
export function PullToRefresh() {
  const pathname = usePathname();
  const chipRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const canPull = useEffectEvent(
    () => hasTopNav(pathname) && !OWN_GESTURE_PATHS.some((p) => pathname.startsWith(p)),
  );

  useEffect(() => {
    const chip = chipRef.current;
    if (!chip || !("ontouchstart" in window)) return;
    let refreshing = false;
    // Position and turn change on every move, so they go straight to CSS variables on the chip
    // rather than through state.
    const show = (offset: number, progress: number) => {
      chip.style.setProperty("--ptr-offset", `${offset}px`);
      chip.style.setProperty("--ptr-progress", String(progress));
    };
    // Each pixel of finger travel pulls the indicator out a little less than the last.
    const offsetFor = (distance: number) => MAX_OFFSET * (1 - Math.exp(-distance / MAX_OFFSET));
    return watchPulls({
      canPull: () => !refreshing && canPull(),
      onPull(distance) {
        const offset = offsetFor(distance);
        const progress = Math.min(offset / REFRESH_OFFSET, 1);
        show(offset, progress);
        setPhase(progress < 1 ? "pulling" : "armed");
      },
      onRelease(distance) {
        if (offsetFor(distance) < REFRESH_OFFSET) {
          show(0, 0);
          setPhase("idle");
          return;
        }
        refreshing = true;
        show(REFRESH_OFFSET, 1);
        setPhase("refreshing");
        location.reload();
      },
    });
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-[var(--nav-total-height,0px)] z-30 flex justify-center"
    >
      {/* Put away, it sits 3rem up behind the nav and is hidden outright, so it can't show on a
          page without the nav. It tracks the finger exactly while pulled and eases into place
          otherwise, staying visible until it has slid back. */}
      <div
        ref={chipRef}
        data-phase={phase}
        className="group/ptr flex size-9 [transform:translate3d(0,calc(var(--ptr-offset,0px)_-_3rem),0)] items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition-all duration-300 ease-out data-[phase=armed]:text-foreground data-[phase=armed]:transition-colors data-[phase=idle]:invisible data-[phase=pulling]:transition-none data-[phase=refreshing]:text-foreground motion-reduce:transition-none"
      >
        <RotateCw className="size-4 [rotate:calc(var(--ptr-progress,0)*270deg)] group-data-[phase=refreshing]/ptr:animate-spin" />
      </div>
    </div>
  );
}
