import { createViewerCountClient } from "@/lib/viewer-counts";

// Shared client-side YouTube concurrent-viewer counts for cards and the watch-page badge,
// fetched from YouTube's updated_metadata endpoint via /youtube-live-viewers. Holodex CCV
// is never used.

const isYtId = (v: unknown): v is string => typeof v === "string" && /^[\w-]{11}$/.test(v);

const client = createViewerCountClient({
  storageKey: "holodex-youtube-viewer-counts-v1",
  endpoint: "/youtube-live-viewers",
  bodyKey: "videoIds",
  label: "YouTube",
  isValidKey: isYtId,
});

export const readLastKnownYoutubeViewerCounts = client.readLastKnown;
export const fetchYoutubeViewerCounts = client.fetchCounts;
export const primeYoutubeViewerCounts = client.primeCounts;
export const subscribeYoutubeViewerCounts = client.subscribe;
