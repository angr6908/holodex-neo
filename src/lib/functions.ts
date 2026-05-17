import { TL_LANGS, VIDEO_URL_REGEX, TWITCH_VIDEO_URL_REGEX, langConversion, langs } from "@/lib/consts";
const validUiLangs = new Set<string>(langs.map((x) => x.val));
const validTlLangs = new Set(TL_LANGS.map((x) => x.value));
const STATIC_BASE = "https://holodex.net/statics";

export const formatOrgDisplayName = (name: string) => name === "VSpo" ? "VSPO" : (name || "");

export const getChannelPhoto = (channelId?: string, size = 150) =>
  channelId ? `${STATIC_BASE}/channelImg/${channelId}/${size}.png` : "";

export const resizeChannelPhoto = (url: string) =>
  typeof url === "string" && url.includes("ggpht.com")
    ? `${url.split("=s")[0]}=s176-c-k-c0x00ffffff-no-rj-mo` : url;

export function getVideoThumbnails(ytVideoKey: string, useWebP = false) {
  const base = `https://i.ytimg.com/vi${useWebP ? "_webp" : ""}/${ytVideoKey}`;
  const ext = useWebP ? "webp" : "jpg";
  const src = (q: string) => `${base}/${q}.${ext}`;
  return { default: src("default"), medium: src("mqdefault"), standard: src("sddefault"), maxres: src("maxresdefault"), hq720: src("hq720") };
}

export function getUILang(weblang?: string) {
  const value = String(weblang || "en");
  if (validUiLangs.has(value)) return value;
  const short = value.split("-")[0].toLowerCase();
  return validUiLangs.has(short) ? short : "en";
}

export function getLang(weblang?: string) {
  const short = String(weblang || "en").split("-")[0].toLowerCase();
  return validTlLangs.has(short) ? short : "en";
}

export function getYTLangFromState(state: any) {
  const lang = state?.settings?.lang || "en";
  return (langConversion as any)[lang] || lang.split("-")[0].toLowerCase();
}

export function getBannerImages(url: string) {
  const base = `${url.split("=")[0]}=`;
  const crop = (w: string, c: string) => `${base}${w}-fcrop64=1,${c}-k-c0xffffffff-no-nd-rj`;
  return {
    tablet: crop("w1707", "00005a57ffffa5a8"),
    mobile: crop("w960", "32b75a57cd48a5a8"),
    banner: crop("w2276", "00005a57ffffa5a8"),
    tv: crop("w2560", "00005a57ffffa5a8"),
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
  const num = typeof n === "string" ? +n : n;
  return formatters[converted].format(num);
}

const toFiniteNumber = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const getKnownLiveViewerCount = (v?: Record<string, any> | null) =>
  toFiniteNumber(v?.live_viewers) ?? toFiniteNumber(v?.ccv);

export const getLiveViewerCount = (v?: Record<string, any> | null) => getKnownLiveViewerCount(v) ?? 0;

export const decodeHTMLEntities = (str = "") => str.replaceAll("&amp;", "&").replaceAll("&quot;", '"');

export const videoTemporalComparator = (a: any, b: any) =>
  a.available_at === b.available_at
    ? String(a.id).localeCompare(String(b.id))
    : new Date(a.available_at).getTime() - new Date(b.available_at).getTime();

export function getVideoIDFromUrl(url: string) {
  const yt = url?.match?.(VIDEO_URL_REGEX);
  if (yt?.groups?.id) return { id: yt.groups.id, custom: true, channel: { name: yt.groups.id } };
  const tw = url?.match?.(TWITCH_VIDEO_URL_REGEX);
  if (tw?.groups?.id) return { id: tw.groups.id, type: "twitch", custom: true, channel: { name: tw.groups.id } };
  return undefined;
}

export const videoCodeParser = (code: string) =>
  code?.slice(0, 3) === "YT_" ? `https://www.youtube.com/watch?v=${code.slice(3)}` : code;

export function checkIOS() {
  if (typeof navigator === "undefined") return false;
  if (/iPad|iPhone|iPod/.test(navigator.platform)) return true;
  return navigator.userAgent.includes("Mac") && typeof document !== "undefined" && "ontouchend" in document;
}

export function forwardTransformSearchToAPIQuery(obj: any[], initialObject: any) {
  return (obj || []).reduceRight((req, item) => {
    const text = String(item.text || "").trim();
    if (item.type === "title & desc") req.conditions.push({ text });
    else if (item.type === "comments") req.comment = [text];
    else if (item.type === "channel") req.vch.push(item.value);
    else if (item.type === "topic") req.topic.push(item.value);
    else if (item.type === "org") req.org.push(item.value);
    return req;
  }, initialObject);
}

export async function buildSearchUrl(query: any[]) {
  const { json2csv } = await import("json-2-csv");
  return `/search?q=${encodeURIComponent(await json2csv(query))}`;
}

const NUMERIC_CHANNEL_FIELDS = new Set(["video_count", "subscriber_count", "clip_count"]);

export function localSortChannels(
  channels: any[],
  { sort, order = "asc" }: { sort?: string; order?: string },
) {
  if (!sort) return channels;
  const dir = order === "desc" ? -1 : 1;
  const isNumeric = NUMERIC_CHANNEL_FIELDS.has(sort);
  channels.sort((a, b) => {
    const aVal = isNumeric ? Number(a?.[sort]) : (a?.[sort] ?? "");
    const bVal = isNumeric ? Number(b?.[sort]) : (b?.[sort] ?? "");
    const cmp = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    return cmp * dir;
  });
  return channels;
}
