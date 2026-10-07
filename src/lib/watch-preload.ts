"use client";

import { api } from "@/lib/api";
import { loadTwitchEmbedApi } from "@/lib/twitch-embed-api";
import { twitchLoginOf } from "@/lib/twitch-viewers";
import { loadYoutubeIframeApi } from "@/lib/youtube-iframe-api";

// Opening a video from a card starts the watch page's work before its route has rendered: the
// card's own data seeds the first paint (player, title, channel, chat), the full video request
// runs alongside the route navigation, and the player's script (YouTube IFrame API or Twitch
// embed) is loaded ahead of time so the player can be created the moment the page mounts.

const MAX_ENTRIES = 32;
// Card data only stands in until the full video arrives, so it may be a little old.
const SEED_TTL_MS = 10 * 60_000;
// A video prefetched on press is reused if the watch page asks for it soon after.
const VIDEO_TTL_MS = 30_000;

type Entry<T> = { ts: number; value: T };

const seeds = new Map<string, Entry<Record<string, any>>>();
const videos = new Map<string, Entry<Promise<Record<string, any>>>>();

function remember<T>(map: Map<string, Entry<T>>, key: string, value: T) {
  map.delete(key);
  map.set(key, { ts: Date.now(), value });
  if (map.size > MAX_ENTRIES) map.delete(map.keys().next().value as string);
}

function readFresh<T>(map: Map<string, Entry<T>>, key: string, ttl: number) {
  const entry = map.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts < ttl) return entry.value;
  map.delete(key);
  return undefined;
}

// The card data a watch page can render first, if the video was opened from a card.
export function readWatchSeed(id: string) {
  return id ? readFresh(seeds, id, SEED_TTL_MS) : undefined;
}

// The full video (description, comments, songs, related videos) for the watch page. A request
// already started for the same video, e.g. when its card was pressed, is shared.
export function loadWatchVideo(id: string, langs: string) {
  const key = `${id}?${langs}`;
  const pending = readFresh(videos, key, VIDEO_TTL_MS);
  if (pending) return pending;
  const request = api.video(id, langs, 1).then(({ data }: any) => data as Record<string, any>);
  remember(videos, key, request);
  request.catch(() => {
    if (videos.get(key)?.value === request) videos.delete(key);
  });
  return request;
}

// Loads the script of the player a video plays in (see the watch page's WatchPlayer).
export function preloadWatchPlayer(video: Record<string, any>) {
  const isTwitch = video?.type === "twitch" || video?.link?.includes?.("twitch");
  if (isTwitch && twitchLoginOf(video)) void loadTwitchEmbedApi().catch(() => {});
  else void loadYoutubeIframeApi().catch(() => {});
}

// Starts the watch page's requests for a video that is about to be opened.
export function preloadWatchVideo(video: Record<string, any>, langs: string) {
  if (!video?.id) return;
  remember(seeds, video.id, video);
  void loadWatchVideo(video.id, langs).catch(() => {});
  preloadWatchPlayer(video);
}

let warmed = false;

// Once per session, a page listing videos warms the watch page when the browser is idle, as
// opening a video is likely: `prefetchRoute` fetches the route (and with it the page's code) and
// the YouTube IFrame API is loaded.
export function warmWatchPageWhenIdle(prefetchRoute: () => void) {
  if (warmed) return;
  warmed = true;
  const warm = () => {
    prefetchRoute();
    void loadYoutubeIframeApi().catch(() => {});
  };
  if ("requestIdleCallback" in window) requestIdleCallback(warm, { timeout: 4000 });
  else setTimeout(warm, 2000);
}
