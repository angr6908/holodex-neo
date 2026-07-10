import { TWITCH_VIDEO_URL_REGEX } from "@/lib/consts";
import { createViewerCountClient } from "@/lib/viewer-counts";

// Shared client-side Twitch concurrent-viewer counts for cards and the watch-page badge,
// fetched via /twitch-live-viewers (server -> Twitch GQL). Holodex CCV is never used.

const norm = (l: string) => l.trim().toLowerCase();
const isLogin = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

const client = createViewerCountClient({
  storageKey: "holodex-twitch-viewer-counts-v1",
  endpoint: "/twitch-live-viewers",
  bodyKey: "logins",
  label: "Twitch",
  isValidKey: isLogin,
  normalizeKey: norm,
});

// The Twitch login for a video (link, channel, or a `twitch`-typed id), lowercased, else "".
export function twitchLoginOf(v: any): string {
  if (!v || typeof v !== "object") return "";
  const fromLink = v.link?.match?.(TWITCH_VIDEO_URL_REGEX)?.groups?.id;
  const l = fromLink || v.channel?.twitch || (v.type === "twitch" ? v.id : "");
  return isLogin(l) ? norm(l) : "";
}

export const readLastKnownTwitchViewerCounts = client.readLastKnown;
export const fetchTwitchViewerCounts = client.fetchCounts;
export const primeTwitchViewerCounts = client.primeCounts;
export const subscribeTwitchViewerCounts = client.subscribe;
