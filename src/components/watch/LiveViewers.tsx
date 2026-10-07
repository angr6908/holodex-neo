"use client";

import { useLocale } from "next-intl";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { formatCount } from "@/lib/functions";
import * as icons from "@/lib/icons";
import {
  fetchTwitchViewerCounts,
  readLastKnownTwitchViewerCounts,
  subscribeTwitchViewerCounts,
} from "@/lib/twitch-viewers";
import {
  fetchYoutubeViewerCounts,
  readLastKnownYoutubeViewerCounts,
  subscribeYoutubeViewerCounts,
} from "@/lib/youtube-viewers";

const SOURCES = {
  youtube: {
    seed: readLastKnownYoutubeViewerCounts,
    fetch: fetchYoutubeViewerCounts,
    subscribe: subscribeYoutubeViewerCounts,
  },
  twitch: {
    seed: readLastKnownTwitchViewerCounts,
    fetch: fetchTwitchViewerCounts,
    subscribe: subscribeTwitchViewerCounts,
  },
} as const;

// Live concurrent-viewer badge for the watch page, sourced only from the platform itself
// (YouTube InnerTube / Twitch GQL), never Holodex. Isolated: owns its own 60s poll + state so
// only this badge re-renders. Seeds from the last-known cache so it paints immediately, holds
// the last good value across a miss, and pauses while the tab is hidden — never blanks/flickers.
export function LiveViewers({ platform, id }: { platform: "youtube" | "twitch"; id: string }) {
  const locale = useLocale();
  const src = SOURCES[platform];
  const [count, setCount] = useState<number | null>(() => {
    const c = src.seed([id])[id];
    return typeof c === "number" && c > 0 ? c : null;
  });

  useEffect(() => {
    let cancelled = false;
    const apply = (counts: Record<string, number>) => {
      const n = counts[id];
      if (typeof n === "number" && n >= 0) setCount(n);
    };
    const unsubscribe = src.subscribe((counts) => {
      if (!cancelled) apply(counts);
    });
    const tick = async () => {
      if (document.visibilityState === "hidden") return;
      const counts = await src.fetch([id]);
      if (cancelled) return;
      apply(counts);
    };
    tick();
    const timer = setInterval(tick, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      unsubscribe();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [src, id]);

  if (count == null || count <= 0) return null;
  return (
    <Badge variant="destructive" className="shrink-0 gap-1.5">
      <icons.BroadcastIcon className="size-3.5" />
      <span className="font-ibm-digits">{formatCount(count, locale)}</span>
    </Badge>
  );
}
