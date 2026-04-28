import { dayjs, formatDistance, formatDuration, titleTimeString } from "@/lib/time";
import { getChannelPhoto, getLiveViewerCount, getVideoThumbnails, decodeHTMLEntities, formatCount } from "@/lib/functions";
import { TWITCH_VIDEO_URL_REGEX } from "@/lib/consts";

const COMMENT_TIMESTAMP_REGEX = /(?:([0-5]?[0-9]):)?([0-5]?[0-9]):([0-5][0-9])/gm;
type ThumbnailSize = "default" | "medium" | "standard" | "maxres";
const TWITCH_PREVIEW_HOST = "static-cdn.jtvnw.net";
const TWITCH_THUMBNAIL_SIZES: Record<ThumbnailSize, { width: number; height: number }> = {
  default: { width: 320, height: 180 },
  medium: { width: 320, height: 180 },
  standard: { width: 640, height: 360 },
  maxres: { width: 1920, height: 1080 },
};

export function channelDisplayName(channel: any, useEnglish = true) { return (useEnglish ? channel?.english_name : null) || channel?.name || ""; }
export function channelGroup(channel: any) { return channel?.group || (channel?.suborg ? String(channel.suborg).slice(2) : null); }
export function staticThumbnailPath(thumbnail: string, size: "default" | "maxres" = "default") { const n = btoa(thumbnail).replace("+", "-").replace("/", "_").replace(/=+$/, ""); return `/statics/thumbnail/${size}/${n}.jpg`; }
function isTwitchPreviewThumbnail(thumbnail: string) {
  try {
    const url = new URL(thumbnail);
    return url.hostname === TWITCH_PREVIEW_HOST && url.pathname.startsWith("/previews-ttv/live_user_");
  } catch {
    return false;
  }
}
function twitchPreviewThumbnail(login: string, size: ThumbnailSize) {
  const { width, height } = TWITCH_THUMBNAIL_SIZES[size];
  return `https://${TWITCH_PREVIEW_HOST}/previews-ttv/live_user_${encodeURIComponent(login.trim().toLowerCase())}-${width}x${height}.jpg`;
}
function resizeTwitchPreviewThumbnail(thumbnail: string, size: ThumbnailSize) {
  const { width, height } = TWITCH_THUMBNAIL_SIZES[size];
  return thumbnail.replace(/-\d+x\d+(\.jpg)(?=([?#]|$))/i, `-${width}x${height}$1`);
}
function getVideoTwitchLogin(video: any) {
  if (video?.type === "twitch" && video.id) return String(video.id);
  return video?.link?.match?.(TWITCH_VIDEO_URL_REGEX)?.groups?.id || "";
}
function thumbnailSizeForVideo(opts: { horizontal?: boolean; colSize?: number; forceJpg?: boolean } = {}): ThumbnailSize {
  if (opts.horizontal) return "medium";
  if ((opts.colSize || 1) > 2 && (opts.colSize || 1) <= 8 && typeof window !== "undefined") return window.devicePixelRatio > 1 ? "standard" : "medium";
  return "standard";
}
export function thumbnailImage(thumbnail: string, size: ThumbnailSize = "default") {
  if (isTwitchPreviewThumbnail(thumbnail)) return resizeTwitchPreviewThumbnail(thumbnail, size);
  if (typeof btoa === "undefined") return thumbnail;
  return staticThumbnailPath(thumbnail, size === "maxres" ? "maxres" : "default");
}
export function linkifyVideoTimestamps(message: string, videoId: string, redirectMode = false) {
  const decoder = typeof document !== "undefined" ? document.createElement("div") : null;
  if (decoder) decoder.innerHTML = String(message || "");
  const sanitized = decoder ? decoder.textContent || "" : String(message || "").replace(/<[^>]*>/g, "");
  const vidUrl = (redirectMode ? "https://youtu.be/" : "/watch/") + videoId;
  return sanitized.replace(COMMENT_TIMESTAMP_REGEX, (match, hr, min, sec) => {
    const time = Number(hr ?? 0) * 3600 + Number(min) * 60 + Number(sec);
    return `<a class="comment-chip" href="${vidUrl}?t=${time}" data-time="${time}"> ${match} </a>`;
  });
}
export function videoTitle(video: any, useEnglish = true) { if (!video) return ""; if (video.type === "placeholder") return decodeHTMLEntities((useEnglish ? video.title ?? video.jp_name : video.jp_name ?? video.title) || ""); return decodeHTMLEntities(video.title || ""); }
export function videoImage(video: any, opts: { horizontal?: boolean; colSize?: number; forceJpg?: boolean } = {}) {
  if (!video) return "";
  const thumbnailSize = thumbnailSizeForVideo(opts);
  if (video.thumbnail) return thumbnailImage(video.thumbnail, thumbnailSize);
  const twitchLogin = getVideoTwitchLogin(video);
  if (twitchLogin) return twitchPreviewThumbnail(twitchLogin, thumbnailSize);
  if (video.type === "placeholder") return getChannelPhoto(video.channel_id || video.channel?.id);
  const srcs = getVideoThumbnails(video.id, !opts.forceJpg);
  return srcs[thumbnailSize];
}
export function formattedVideoTime(video: any, lang: string, t: any, now = Date.now()) {
  if (!video) return "";
  if (video.status === "upcoming") return formatDistance(video.start_scheduled || video.available_at, lang, t, false, dayjs(now));
  if (video.status === "live") return t("component.videoCard.liveNow");
  return formatDistance(videoDisplayTime(video), lang, t);
}
export function formattedDuration(video: any, t: any, now = Date.now()) {
  if (!video) return "";
  if (video.start_actual && video.status === "live") return elapsedLiveDuration(video.start_actual, now);
  if (video.status === "upcoming" && video.duration) return t("component.videoCard.premiere");
  return video.duration ? formatDuration(video.duration * 1000) : "";
}
export function videoEndTimestamp(video: any) {
  if (!video) return 0;
  const start = video.start_actual || video.available_at || video.start_scheduled;
  const startTime = dayjs(start);
  if (
    video.status === "past" &&
    video.type === "stream" &&
    Number(video.duration) > 0 &&
    startTime.isValid()
  )
    return startTime.add(Number(video.duration), "second").valueOf();
  return startTime.isValid() ? startTime.valueOf() : 0;
}
export function videoDisplayTime(video: any) {
  if (!video) return "";
  if (
    video.status === "past" &&
    video.type === "stream" &&
    Number(video.duration) > 0
  ) {
    const start = video.start_actual || video.available_at;
    const startTime = dayjs(start);
    if (startTime.isValid())
      return startTime.add(Number(video.duration), "second").toISOString();
  }
  return video.available_at || video.start_scheduled;
}
export function absoluteTime(video: any, lang: string) { return titleTimeString(videoDisplayTime(video), lang); }
export function elapsedLiveDuration(startActual: string | number | Date, now = Date.now()) {
  return formatDuration(dayjs(now).diff(dayjs(startActual)));
}
export function viewerCountText(video: any, lang: string) { const n = getLiveViewerCount(video); return n > 0 ? formatCount(n, lang) : ""; }
