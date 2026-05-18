import { dayjs, formatDistance, formatDuration, titleTimeString } from "@/lib/time";
import { getChannelPhoto, getLiveViewerCount, getVideoThumbnails, decodeHTMLEntities, formatCount, videoTemporalComparator } from "@/lib/functions";
import { TWITCH_VIDEO_URL_REGEX } from "@/lib/consts";

const TS_REGEX = /(?:([0-5]?[0-9]):)?([0-5]?[0-9]):([0-5][0-9])/gm;
type ThumbnailSize = "default" | "medium" | "standard" | "maxres";
const TWITCH_HOST = "static-cdn.jtvnw.net";
const TWITCH_SIZES: Record<ThumbnailSize, [number, number]> = {
  default: [320, 180], medium: [320, 180], standard: [640, 360], maxres: [1920, 1080],
};

export const channelDisplayName = (c: any, useEnglish = true) =>
  (useEnglish ? c?.english_name : null) || c?.name || "";

export const channelGroup = (c: any) =>
  c?.group || (c?.suborg ? String(c.suborg).slice(2) : null);

const isTwitchPreview = (t: string) => {
  try {
    const u = new URL(t);
    return u.hostname === TWITCH_HOST && u.pathname.startsWith("/previews-ttv/live_user_");
  } catch { return false; }
};

const twitchPreviewUrl = (login: string, size: ThumbnailSize) => {
  const [w, h] = TWITCH_SIZES[size];
  return `https://${TWITCH_HOST}/previews-ttv/live_user_${encodeURIComponent(login.trim().toLowerCase())}-${w}x${h}.jpg`;
};

const resizeTwitchPreview = (t: string, size: ThumbnailSize) => {
  const [w, h] = TWITCH_SIZES[size];
  return t.replace(/-\d+x\d+(\.jpg)(?=([?#]|$))/i, `-${w}x${h}$1`);
};

const getTwitchLogin = (v: any) => {
  if (v?.type === "twitch" && v.id) return String(v.id);
  return v?.link?.match?.(TWITCH_VIDEO_URL_REGEX)?.groups?.id || "";
};

const sizeForVideo = (opts: { horizontal?: boolean; colSize?: number } = {}): ThumbnailSize => {
  if (opts.horizontal) return "medium";
  const cs = opts.colSize || 1;
  if (cs > 2 && cs <= 8 && typeof window !== "undefined") return window.devicePixelRatio > 1 ? "standard" : "medium";
  return "standard";
};

const thumbnailImage = (t: string, size: ThumbnailSize = "default") => {
  if (isTwitchPreview(t)) return resizeTwitchPreview(t, size);
  if (typeof btoa === "undefined") return t;
  const n = btoa(t).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  return `/statics/thumbnail/${size === "maxres" ? "maxres" : "default"}/${n}.jpg`;
};

export function linkifyVideoTimestamps(message: string, videoId: string, redirectMode = false) {
  const raw = String(message || "");
  let sanitized: string;
  if (typeof document !== "undefined") {
    const d = document.createElement("div");
    d.innerHTML = raw;
    sanitized = d.textContent || "";
  } else sanitized = raw.replace(/<[^>]*>/g, "");
  const url = (redirectMode ? "https://youtu.be/" : "/watch/") + videoId;
  return sanitized.replace(TS_REGEX, (m, hr, min, sec) => {
    const t = Number(hr ?? 0) * 3600 + Number(min) * 60 + Number(sec);
    return `<a class="comment-chip inline-block rounded px-0.5 py-px no-underline hover:bg-primary hover:text-primary-foreground" href="${url}?t=${t}" data-time="${t}"> ${m} </a>`;
  });
}

export function videoTitle(v: any, useEnglish = true) {
  if (!v) return "";
  const t = v.type === "placeholder"
    ? (useEnglish ? v.title ?? v.jp_name : v.jp_name ?? v.title)
    : v.title;
  return decodeHTMLEntities(t || "");
}

export function videoImage(v: any, opts: { horizontal?: boolean; colSize?: number; forceJpg?: boolean } = {}) {
  if (!v) return "";
  const size = sizeForVideo(opts);
  if (v.thumbnail) return thumbnailImage(v.thumbnail, size);
  const login = getTwitchLogin(v);
  if (login) return twitchPreviewUrl(login, size);
  if (v.type === "placeholder") return getChannelPhoto(v.channel_id || v.channel?.id);
  return getVideoThumbnails(v.id, !opts.forceJpg)[size];
}

export function formattedVideoTime(v: any, lang: string, t: any, now = Date.now()) {
  if (!v) return "";
  if (v.status === "upcoming") return formatDistance(v.start_scheduled || v.available_at, lang, t, false, dayjs(now));
  if (v.status === "live") return t("component.videoCard.liveNow");
  return formatDistance(videoDisplayTime(v), lang, t);
}

export function formattedDuration(v: any, t: any, now = Date.now()) {
  if (!v) return "";
  if (v.start_actual && v.status === "live") return elapsedLiveDuration(v.start_actual, now);
  if (v.status === "upcoming" && v.duration) return t("component.videoCard.premiere");
  return v.duration ? formatDuration(v.duration * 1000) : "";
}

const isExtendablePast = (v: any) => v?.status === "past" && v?.type === "stream" && Number(v?.duration) > 0;

function videoEndTimestamp(v: any) {
  if (!v) return 0;
  const t = dayjs(v.start_actual || v.available_at || v.start_scheduled);
  if (!t.isValid()) return 0;
  return isExtendablePast(v) ? t.add(Number(v.duration), "second").valueOf() : t.valueOf();
}

function videoDisplayTime(v: any) {
  if (!v) return "";
  if (isExtendablePast(v)) {
    const t = dayjs(v.start_actual || v.available_at);
    if (t.isValid()) return t.add(Number(v.duration), "second").toISOString();
  }
  return v.available_at || v.start_scheduled;
}

export function extractItems(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  return (Object.values(payload).find(Array.isArray) as any[]) || [];
}

export const extractListPayload = (p: any) => {
  const num = (v: any) => typeof v === "number" ? v : null;
  return { items: extractItems(p), total: num(p?.total), offset: num(p?.offset) };
};

export const dedupeVideos = (videos: any[]) =>
  Array.from(new Map((videos || []).map((v) => [v.id, v])).values());

export function sortVideosForTab(items: any[], isArchive: boolean) {
  if (!isArchive) return [...(items || [])].sort((a, b) => videoTemporalComparator(b, a));
  return (items || [])
    .map((item, i) => ({ item, i, endTime: videoEndTimestamp(item), id: String(item?.id || "") }))
    .sort((a, b) => b.endTime - a.endTime || b.id.localeCompare(a.id) || a.i - b.i)
    .map(({ item }) => item);
}

export const absoluteTime = (v: any, lang: string) => titleTimeString(videoDisplayTime(v), lang);

export const elapsedLiveDuration = (start: string | number | Date, now = Date.now()) =>
  formatDuration(dayjs(now).diff(dayjs(start)));

export const viewerCountText = (v: any, lang: string) => {
  const n = getLiveViewerCount(v);
  return n > 0 ? formatCount(n, lang) : "";
};
