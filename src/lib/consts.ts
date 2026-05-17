export const musicdexURL = typeof window !== "undefined" && window.location.origin === "https://holodex.net"
  ? "https://music.holodex.net"
  : "https://music-staging.holodex.net";

export const CHANNEL_TYPES = Object.freeze({ VTUBER: "vtuber", SUBBER: "subber" });
export const CHANNEL_URL_REGEX = /(?:(?:https?:|)\/\/|)(?:www\.|)(?:youtube\.com\/|\/?)channel\/(?<id>[\w-]+)/i;
export const VIDEO_URL_REGEX = /(?:(?:https?:|)\/\/|)((?:www|m)\.|)(?<domain>youtube\.com|youtu\.be|holodex\.net)\/(?:[\w-]+\?v=|embed|v|watch|live|)\/?(?<id>[\w-]{11})/i;
export const TWITCH_VIDEO_URL_REGEX = /(?:(?:https?:|)\/\/|)(?:www\.)?twitch\.tv\/(?<id>[\w-]+)/i;
export const TL_LANGS = Object.freeze([
  { text: "English", value: "en" }, { text: "日本語", value: "ja" }, { text: "Español", value: "es" }, { text: "中文", value: "zh" },
  { text: "Bahasa", value: "id" }, { text: "Русский", value: "ru" }, { text: "한국어", value: "ko" }, { text: "Tiếng Việt", value: "vi" },
]);
export const langConversion = Object.freeze({ "lol-PEKO": "en", "lol-UWU": "en", zh: "zh-Hant", "zh-CN": "zh-Hans", "en-GB": "enm" });
export const companionExtensionId = "jkdnofimdhpbhdjbcdlgnccfjjkidlgp";
export const MESSAGE_TYPES = Object.freeze({ TOKEN: "token", FAVORITES: "favorites" });
export const MAX_PLAYLIST_LENGTH = 500;
export const CACHE_TTL_MS = 60_000;
export const ALL_VTUBERS_ORG = "All Vtubers";
export const DEFAULT_ORG = "Hololive";

// Source-derived from holodex-neo/src/plugins/app-i18n.ts
export const langs = [
  { val: "en", display: "English", credit: "@Holodex" },
  { val: "en-CA", display: "English (Canadian)", credit: "@Holodex" },
  { val: "en-GB", display: "English (British)", credit: "@Holodex" },
  { val: "lol-UWU", display: "English (UwU)", credit: "Doubleturtle#3660" },
  { val: "lol-PEKO", display: "English (PEKO)", credit: "Doubleturtle#3660" },
  { val: "ja", display: "日本語", credit: "Yourein#3960,Saginomiya#2353" },
  { val: "zh", display: "繁體中文", credit: "angel84326#7887" },
  { val: "zh-CN", display: "简体中文", credit: "ttg#6038" },
  { val: "ko", display: "한국어", credit: "AlexKoala#0253" },
  { val: "es-ES", display: "Español España", credit: "TraduSquare (Darkc0m y D3fau4)" },
  { val: "es", display: "Español Latino", credit: "Aldo#3682" },
  { val: "ms", display: "Bahasa Melayu", credit: "Admiy#8261" },
  { val: "id", display: "Bahasa Indonesia", credit: "alcyneous#2803" },
  { val: "ru", display: "Русский язык", credit: "kirillbarnaul#8499" },
  { val: "pt", display: "Português Brasileiro", credit: "Ash Niartis#5090" },
  { val: "de", display: "Deutsch", credit: "DatJocab#1803, Doubleturtle#3660" },
  { val: "it", display: "Italiano", credit: "テオさん#0139" },
  { val: "fr", display: "Français", credit: "pinembour#7770,Derasiel △#0002" },
  { val: "tr", display: "Türkçe", credit: "creeperkafasipw#1861" },
  { val: "vi", display: "Tiếng Việt", credit: "Pooh#6666,Dead xda member#4848,#Hiraoka Yukio#3042" },
  { val: "hu", display: "Magyar", credit: "kuroihikikomori#7216" },
  { val: "th", display: "ไทย", credit: "SnowNeko#0282" },
] as const;
