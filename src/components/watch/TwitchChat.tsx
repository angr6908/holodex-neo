"use client";

import { useState } from "react";
import { useAppState } from "@/lib/store";
import { cn } from "@/lib/utils";

// Twitch's chat embed, styled to match the YouTube chat panel (WatchLiveChat) so the watch
// page's chat toggle behaves the same for Twitch streams. `parent` must match the embedding
// host, read at runtime.
export function TwitchChat({ channel, className = "" }: { channel: string; className?: string }) {
  const app = useAppState();
  const [parent] = useState(() => (typeof window !== "undefined" ? window.location.hostname : ""));
  if (!parent || !channel) return null;

  const src = `https://www.twitch.tv/embed/${channel}/chat?parent=${parent}${app.settings.darkMode ? "&darkpopout" : ""}`;
  return (
    <div
      className={cn(
        "relative z-0 flex min-h-0 flex-col overflow-hidden rounded-[inherit] text-base",
        className,
      )}
    >
      <div className="relative min-h-0 w-full flex-1 [&>iframe]:absolute [&>iframe]:z-[3] [&>iframe]:h-full [&>iframe]:w-full">
        <iframe src={src} title="Twitch chat" frameBorder={0} />
      </div>
    </div>
  );
}
