import {
  langConversion,
  langs,
  TL_LANGS,
  TWITCH_VIDEO_URL_REGEX,
  VIDEO_URL_REGEX,
} from "@/lib/consts";

const validUiLangs = new Set<string>(langs.map((x) => x.val));
const validTlLangs = new Set(TL_LANGS.map((x) => x.value));
const STATIC_BASE = "https://holodex.net/statics";

const orgDisplayNameOverrides: Record<string, string> = {
  VSpo: "VSPO",
  Nijisanji: "NIJISANJI",
  "Aogiri Highschool": "Aogiri HS",
  MillionProduction: "Million Pro",
};

export const formatOrgDisplayName = (name: string) => orgDisplayNameOverrides[name] || name || "";

export const getChannelPhoto = (channelId?: string, size = 150) =>
  channelId ? `${STATIC_BASE}/channelImg/${channelId}/${size}.png` : "";

export const resizeChannelPhoto = (url: string) =>
  typeof url === "string" && url.includes("ggpht.com")
    ? `${url.split("=s")[0]}=s176-c-k-c0x00ffffff-no-rj-mo`
    : url;

export function getVideoThumbnails(key: string, webp = false) {
  const base = `https://i.ytimg.com/vi${webp ? "_webp" : ""}/${key}`;
  const ext = webp ? "webp" : "jpg";
  const src = (q: string) => `${base}/${q}.${ext}`;
  return {
    default: src("default"),
    medium: src("mqdefault"),
    standard: src("sddefault"),
    maxres: src("maxresdefault"),
    hq720: src("hq720"),
  };
}

export function getUILang(weblang?: string) {
  const v = String(weblang || "en");
  if (validUiLangs.has(v)) return v;
  const s = v.split("-")[0].toLowerCase();
  return validUiLangs.has(s) ? s : "en";
}

export function getLang(weblang?: string) {
  const s = String(weblang || "en")
    .split("-")[0]
    .toLowerCase();
  return validTlLangs.has(s) ? s : "en";
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
const numFmtAdjust: Record<string, string> = { "lol-UWU": "en", "lol-PEKO": "en" };

export function formatCount(n: any, lang = "en") {
  const k = numFmtAdjust[lang] ?? lang;
  formatters[k] ||= new Intl.NumberFormat(k, {
    compactDisplay: "short",
    notation: "compact",
    maximumSignificantDigits: 3,
  });
  return formatters[k].format(typeof n === "string" ? +n : n);
}

const toNum = (v: unknown) => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Concurrent viewers come ONLY from the live platform (YouTube / Twitch), merged onto
// videos as `_ccv`. Holodex's own live_viewers/ccv are intentionally never read.
export const getKnownLiveViewerCount = (v?: Record<string, any> | null) => toNum(v?._ccv);
export const getLiveViewerCount = (v?: Record<string, any> | null) =>
  getKnownLiveViewerCount(v) ?? 0;
export const decodeHTMLEntities = (s = "") => s.replaceAll("&amp;", "&").replaceAll("&quot;", '"');

export const videoTemporalComparator = (a: any, b: any) =>
  a.available_at === b.available_at
    ? String(a.id).localeCompare(String(b.id))
    : new Date(a.available_at).getTime() - new Date(b.available_at).getTime();

export function getVideoIDFromUrl(url: string) {
  const yt = url?.match?.(VIDEO_URL_REGEX);
  if (yt?.groups?.id) return { id: yt.groups.id, custom: true, channel: { name: yt.groups.id } };
  const tw = url?.match?.(TWITCH_VIDEO_URL_REGEX);
  if (tw?.groups?.id)
    return { id: tw.groups.id, type: "twitch", custom: true, channel: { name: tw.groups.id } };
}

export const videoCodeParser = (c: string) =>
  c?.slice(0, 3) === "YT_" ? `https://www.youtube.com/watch?v=${c.slice(3)}` : c;

export function checkIOS() {
  if (typeof navigator === "undefined") return false;
  if (/iPad|iPhone|iPod/.test(navigator.platform)) return true;
  return (
    navigator.userAgent.includes("Mac") &&
    typeof document !== "undefined" &&
    "ontouchend" in document
  );
}

export async function buildSearchUrl(query: any[]) {
  const { json2csv } = await import("json-2-csv");
  return `/search?q=${encodeURIComponent(await json2csv(query))}`;
}

const NUMERIC_FIELDS = new Set(["video_count", "subscriber_count", "clip_count"]);

export function localSortChannels(
  channels: any[],
  { sort, order = "asc" }: { sort?: string; order?: string },
) {
  if (!sort) return channels;
  const dir = order === "desc" ? -1 : 1;
  const numeric = NUMERIC_FIELDS.has(sort);
  channels.sort((a, b) => {
    const av = numeric ? Number(a?.[sort]) : (a?.[sort] ?? "");
    const bv = numeric ? Number(b?.[sort]) : (b?.[sort] ?? "");
    return (av > bv ? 1 : av < bv ? -1 : 0) * dir;
  });
  return channels;
}
