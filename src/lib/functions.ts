import { json2csv } from "json-2-csv";
import {
  TL_LANGS,
  VIDEO_URL_REGEX,
  TWITCH_VIDEO_URL_REGEX,
  langConversion,
} from "@/lib/consts";
import { langs } from "@/lib/langs";

const validUiLangs = new Set<string>(langs.map((x) => x.val));
const validTlLangs = new Set(TL_LANGS.map((x) => x.value));

export function formatOrgDisplayName(name: string): string {
  return name === "VSpo" ? "VSPO" : name || "";
}
export function getChannelPhoto(channelId?: string, size = 150) {
  return channelId ? `/statics/channelImg/${channelId}/${size}.png` : "";
}
export function resizeChannelPhoto(photoUrl: string) {
  return typeof photoUrl === "string" && photoUrl.includes("ggpht.com")
    ? `${photoUrl.split("=s")[0]}=s176-c-k-c0x00ffffff-no-rj-mo`
    : photoUrl;
}
export function getVideoThumbnails(ytVideoKey: string, useWebP = false) {
  const base = useWebP
    ? "https://i.ytimg.com/vi_webp"
    : "https://i.ytimg.com/vi";
  const ext = useWebP ? "webp" : "jpg";
  return {
    default: `${base}/${ytVideoKey}/default.${ext}`,
    medium: `${base}/${ytVideoKey}/mqdefault.${ext}`,
    standard: `${base}/${ytVideoKey}/sddefault.${ext}`,
    maxres: `${base}/${ytVideoKey}/maxresdefault.${ext}`,
    hq720: `${base}/${ytVideoKey}/hq720.${ext}`,
  };
}
export function getUILang(weblang?: string) {
  const value = String(weblang || "en");
  if (validUiLangs.has(value)) return value;
  const short = value.split("-")[0].toLowerCase();
  if (validUiLangs.has(short)) return short;
  return "en";
}
export function getLang(weblang?: string) {
  const value = String(weblang || "en")
    .split("-")[0]
    .toLowerCase();
  return validTlLangs.has(value) ? value : "en";
}
export function getYTLangFromState(state: any) {
  const lang = state?.settings?.lang || "en";
  return (langConversion as any)[lang] || lang.split("-")[0].toLowerCase();
}
export function getBannerImages(url: string) {
  const base = `${url.split("=")[0]}=`;
  return {
    tablet: `${base}w1707-fcrop64=1,00005a57ffffa5a8-k-c0xffffffff-no-nd-rj`,
    mobile: `${base}w960-fcrop64=1,32b75a57cd48a5a8-k-c0xffffffff-no-nd-rj`,
    banner: `${base}w2276-fcrop64=1,00005a57ffffa5a8-k-c0xffffffff-no-nd-rj`,
    tv: `${base}w2560-fcrop64=1,00005a57ffffa5a8-k-c0xffffffff-no-nd-rj`,
  };
}
const formatters: Record<string, Intl.NumberFormat> = {};
const numberFormatAdjust: Record<string, string> = {
  "lol-UWU": "en",
  "lol-PEKO": "en",
};
export function formatCount(n: any, lang = "en") {
  const converted = numberFormatAdjust[lang] ?? lang;
  formatters[converted] ||= new Intl.NumberFormat(converted, {
    compactDisplay: "short",
    notation: "compact",
    maximumSignificantDigits: 3,
  });
  let num = n;
  if (typeof n === "string") num = +n;
  return formatters[converted].format(num);
}
function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}
export function getKnownLiveViewerCount(video?: Record<string, any> | null) {
  return toFiniteNumber(video?.live_viewers) ?? toFiniteNumber(video?.ccv);
}
export function getLiveViewerCount(video?: Record<string, any> | null) {
  return getKnownLiveViewerCount(video) ?? 0;
}
export function decodeHTMLEntities(str = "") {
  return str.split("&amp;").join("&").split("&quot;").join('"');
}
export function videoTemporalComparator(a: any, b: any) {
  if (a.available_at === b.available_at)
    return String(a.id).localeCompare(String(b.id));
  return (
    new Date(a.available_at).getTime() - new Date(b.available_at).getTime()
  );
}
export function getVideoIDFromUrl(url: string) {
  const yt = url?.match?.(VIDEO_URL_REGEX);
  if (yt?.groups?.id)
    return { id: yt.groups.id, custom: true, channel: { name: yt.groups.id } };
  const tw = url?.match?.(TWITCH_VIDEO_URL_REGEX);
  if (tw?.groups?.id)
    return {
      id: tw.groups.id,
      type: "twitch",
      custom: true,
      channel: { name: tw.groups.id },
    };
  return undefined;
}
export function videoCodeParser(videoCode: string) {
  return videoCode?.slice(0, 3) === "YT_"
    ? `https://www.youtube.com/watch?v=${videoCode.slice(3)}`
    : videoCode;
}
export function checkIOS() {
  if (typeof navigator === "undefined") return false;
  return (
    [
      "iPad Simulator",
      "iPhone Simulator",
      "iPod Simulator",
      "iPad",
      "iPhone",
      "iPod",
    ].includes(navigator.platform) ||
    (navigator.userAgent.includes("Mac") &&
      typeof document !== "undefined" &&
      "ontouchend" in document)
  );
}
export function forwardTransformSearchToAPIQuery(
  obj: any[],
  initialObject: any,
) {
  return (obj || []).reduceRight((req, item) => {
    switch (item.type) {
      case "title & desc":
        req.conditions.push({ text: String(item.text || "").trim() });
        break;
      case "comments":
        req.comment = [String(item.text || "").trim()];
        break;
      case "channel":
        req.vch.push(item.value);
        break;
      case "topic":
        req.topic.push(item.value);
        break;
      case "org":
        req.org.push(item.value);
        break;
      default:
        break;
    }
    return req;
  }, initialObject);
}

export async function buildSearchUrl(query: any[]) {
  return `/search?q=${encodeURIComponent(await json2csv(query))}`;
}

export function localSortChannels(
  channels: any[],
  { sort, order = "asc" }: { sort?: string; order?: string },
) {
  if (!sort) return channels;
  const dir = order === "desc" ? -1 : 1;
  const isNumeric = (field: string) =>
    field === "video_count" ||
    field === "subscriber_count" ||
    field === "clip_count";
  channels.sort((a, b) => {
    const aVal = isNumeric(sort) ? Number(a?.[sort]) : (a?.[sort] ?? "");
    const bVal = isNumeric(sort) ? Number(b?.[sort]) : (b?.[sort] ?? "");
    const cmp = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    return cmp * dir;
  });
  return channels;
}
export function waitForElement(
  selector: string,
  parent: ParentNode = document.body,
  waitTime = 90e3,
) {
  return new Promise<Element>((resolve, reject) => {
    const elem = parent.querySelector(selector);
    if (elem) {
      resolve(elem);
    }
    const observer = new MutationObserver(() => {
      const elem2 = parent.querySelector(selector);
      if (elem2) {
        clearTimeout(timeout);
        observer.disconnect();
        resolve(elem2);
      }
    });
    observer.observe(parent, {
      childList: true,
      subtree: true,
    });
    const timeout = setTimeout(() => {
      observer.disconnect();
      return reject(new Error(`${selector} timed out`));
    }, waitTime);
  });
}
