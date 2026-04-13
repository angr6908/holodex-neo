import { TL_LANGS,
    VIDEO_URL_REGEX,
    TWITCH_VIDEO_URL_REGEX,
    langConversion,
} from "@/utils/consts";

import { langs } from "@/plugins/app-i18n";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Tailwind class name merge utility (consolidated from lib/utils.ts)
export function cn(...inputs: Parameters<typeof clsx>) {
    return twMerge(clsx(inputs));
}

// Org display name aliases (consolidated from utils/org-display.ts)
const ORG_DISPLAY_ALIASES: Record<string, string> = Object.freeze({
    VSpo: "VSPO",
});

export function formatOrgDisplayName(name: string): string {
    if (!name) return "";
    return ORG_DISPLAY_ALIASES[name] || name;
}

export function resizeArtwork(artworkUrl, size = 400) {
    // https://is5-ssl.mzstatic.com/image/thumb/Music125/v4/9c/39/27/9c392780-3f34-d322-9dde-002618154f40/source/400x400bb.jpg
    const adjustedSize = Math.floor(window.devicePixelRatio * size);
    const match = /^https:\/\/(.+?)\.mzstatic\.com\/image\/thumb\/(.+?)\/source\//.exec(artworkUrl);
    if (!match) return artworkUrl;
    const serv = match[1];
    const thumb = match[2];
    return `https://${serv}.mzstatic.com/image/thumb/${thumb}/source/${adjustedSize}x${adjustedSize}bb.jpg`;
}

/**
 * Get a channel avatar URL from the Holodex static proxy.
 */
export function getChannelPhoto(channelId, size: number = 150) {
    if (!channelId) return "";
    return `/statics/channelImg/${channelId}/${size}.png`;
}

/**
 * @deprecated Use getChannelPhoto(channelId) instead.
 * Kept for backward compat — now just delegates to getChannelPhoto.
 */
export function resizeChannelPhoto(photoUrl, _size?) {
    // Extract channel ID from ggpht/googleusercontent URL if possible,
    // otherwise return the original URL as-is.
    if (typeof photoUrl === "string" && photoUrl.includes("ggpht.com")) {
        // Can't extract channelId from ggpht URL, return as-is with size param
        const split = photoUrl.split("=s");
        return `${split[0]}=s176-c-k-c0x00ffffff-no-rj-mo`;
    }
    return photoUrl;
}

export function getVideoThumbnails(ytVideoKey, useWebP) {
    const base = useWebP ? "https://i.ytimg.com/vi_webp" : "https://i.ytimg.com/vi";
    const ext = useWebP ? "webp" : "jpg";
    return {
        // 120w
        default: `${base}/${ytVideoKey}/default.${ext}`,
        // 320w
        medium: `${base}/${ytVideoKey}/mqdefault.${ext}`,
        // 640w
        standard: `${base}/${ytVideoKey}/sddefault.${ext}`,
        // 1280w
        maxres: `${base}/${ytVideoKey}/maxresdefault.${ext}`,
        hq720: `${base}/${ytVideoKey}/hq720.${ext}`,
    };
}

export function getUILang(weblang) {
    const validLangs = new Set(langs.map((x) => x.val));
    if (validLangs.has(String(weblang))) {
        return String(weblang);
    }
    if (validLangs.has(String(weblang).split("-")[0].toLowerCase())) {
        return String(weblang).split("-")[0].toLowerCase();
    }
    return "en";
}

export function getLang(weblang) {
    const Langs = new Set(TL_LANGS.map((x) => x.value));
    if (Langs.has(String(weblang).split("-")[0].toLowerCase())) {
        return String(weblang).split("-")[0].toLowerCase();
    }
    return "en";
}

export function getYTLangFromState(state) {
    const { lang } = state.settings;
    return langConversion[lang] || lang.split("-")[0].toLowerCase();
}

export function getBannerImages(url) {
    const base = `${url.split("=")[0]}=`;
    return {
        tablet: `${base}w1707-fcrop64=1,00005a57ffffa5a8-k-c0xffffffff-no-nd-rj`,
        mobile: `${base}w960-fcrop64=1,32b75a57cd48a5a8-k-c0xffffffff-no-nd-rj`,
        banner: `${base}w2276-fcrop64=1,00005a57ffffa5a8-k-c0xffffffff-no-nd-rj`,
        tv: `${base}w2560-fcrop64=1,00005a57ffffa5a8-k-c0xffffffff-no-nd-rj`,
    };
}

const formatters = {};
const numberFormatAdjust = {
    "lol-UWU": "en",
    "lol-PEKO": "en",
};

function toFiniteNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    const num = typeof value === "number" ? value : Number(value);
    return Number.isFinite(num) ? num : null;
}

export function formatCount(n, lang = "en") {
    const converted = numberFormatAdjust[lang] ?? lang;
    if (!formatters[converted]) {
        formatters[converted] = new Intl.NumberFormat(converted, {
            compactDisplay: "short",
            notation: "compact",
            maximumSignificantDigits: 3,
        });
    }
    let num = n;
    if (typeof n === "string") num = +n;
    return formatters[converted].format(num);
}

export function getLiveViewerCount(video?: Record<string, any> | null) {
    if (!video || typeof video !== "object") return 0;
    return toFiniteNumber(video.live_viewers) ?? toFiniteNumber(video.ccv) ?? 0;
}

export function decodeHTMLEntities(str) {
    return str.split("&amp;").join("&").split("&quot;").join('"');
}

export function forwardTransformSearchToAPIQuery(obj, initialObject) {
    return obj.reduceRight((req, item) => {
        switch (item.type) {
            case "title & desc":
                req.conditions.push({
                    text: item.text.trim(),
                });
                break;
            case "comments":
                req.comment = [item.text.trim()];
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

export function localSortChannels(channels, { sort, order = "asc" }) {
    if (!sort) return channels;
    const dir = order === "desc" ? -1 : 1;
    const isNumeric = (field) => field === "video_count" || field === "subscriber_count" || field === "clip_count";
    channels.sort((a, b) => {
        const aVal = isNumeric(sort) ? Number(a[sort]) : (a[sort] ?? "");
        const bVal = isNumeric(sort) ? Number(b[sort]) : (b[sort] ?? "");
        const cmp = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        return cmp * dir;
    });
    return channels;
}

export function videoTemporalComparator(a, b) {
    if (a.available_at === b.available_at) {
        return a.id.localeCompare(b.id);
    }
    const dateA = new Date(a.available_at).getTime();
    const dateB = new Date(b.available_at).getTime();
    return dateA - dateB;
}

/**
 * Returns a layout content object by parsing URL
 * @param {String} url - A video url
 * @returns {Object}
 */
 export function getVideoIDFromUrl(url) {
    {
        const match = url.match(VIDEO_URL_REGEX);
        if (match) {
            return {
                id: match.groups.id,
                custom: true,
                channel: {
                    name: match.groups.id,
                },
            };
        }
    }
    {
        const match = url.match(TWITCH_VIDEO_URL_REGEX);
        if (match) {
            return {
                id: match.groups.id,
                type: "twitch",
                custom: true,
                channel: {
                    name: match.groups.id,
                },
            };
        }
    }

    return undefined;
}

export function videoCodeParser(videoCode) {
    switch (videoCode.slice(0, 3)) {
        case "YT_":
            return (`https://www.youtube.com/watch?v=${videoCode.slice(3)}`);

        default:
            return (videoCode);
    }
}

export function checkIOS() {
    return (
        ["iPad Simulator", "iPhone Simulator", "iPod Simulator", "iPad", "iPhone", "iPod"].includes(
            navigator.platform,
        )
        // iPad on iOS 13 detection
        || (navigator.userAgent.includes("Mac") && "ontouchend" in document)
    );
}

export function waitForElement(selector, parent = document.body, waitTime = 90e3) {
    return new Promise((resolve, reject) => {
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
