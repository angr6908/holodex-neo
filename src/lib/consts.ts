export const musicdexURL = typeof window !== "undefined" && window.location.origin === "https://holodex.net"
  ? "https://music.holodex.net"
  : "https://music-staging.holodex.net";

export const CHANNEL_TYPES = Object.freeze({ VTUBER: "vtuber", SUBBER: "subber" });
export const CHANNEL_URL_REGEX = /(?:(?:https?:|)\/\/|)(?:www\.|)(?:youtube\.com\/|\/?)channel\/(?<id>[\w-]+)/i;
export const VIDEO_URL_REGEX = /(?:(?:https?:|)\/\/|)((?:www|m)\.|)(?<domain>youtube\.com|youtu\.be|holodex\.net)\/(?:[\w-]+\?v=|embed|v|watch|live|)\/?(?<id>[\w-]{11})/i;
export const TWITCH_VIDEO_URL_REGEX = /(?:(?:https?:|)\/\/|)twitch\.tv\/(?<id>[\w-]+)/i;
export const TL_LANGS = Object.freeze([
  { text: "English", value: "en" }, { text: "日本語", value: "ja" }, { text: "Español", value: "es" }, { text: "中文", value: "zh" },
  { text: "Bahasa", value: "id" }, { text: "Русский", value: "ru" }, { text: "한국어", value: "ko" }, { text: "Tiếng Việt", value: "vi" },
]);
export const langConversion = Object.freeze({ "lol-PEKO": "en", "lol-UWU": "en", zh: "zh-Hant", "zh-CN": "zh-Hans", "en-GB": "enm" });
export const companionExtensionId = "jkdnofimdhpbhdjbcdlgnccfjjkidlgp";
export const MESSAGE_TYPES = Object.freeze({ TOKEN: "token", FAVORITES: "favorites" });
export const MAX_PLAYLIST_LENGTH = 500;
