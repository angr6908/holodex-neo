import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import relativeTime from "dayjs/plugin/relativeTime";
import timezone from "dayjs/plugin/timezone";
import advancedFormat from "dayjs/plugin/advancedFormat";
import localizedFormat from "dayjs/plugin/localizedFormat";
import isTomorrow from "dayjs/plugin/isTomorrow";
import "dayjs/locale/en-ca";
import "dayjs/locale/en-gb";
import "dayjs/locale/ja";
import "dayjs/locale/zh-tw";
import "dayjs/locale/zh-cn";
import "dayjs/locale/es";
import "dayjs/locale/ms";
import "dayjs/locale/id";
import "dayjs/locale/ru";
import "dayjs/locale/fr";
import "dayjs/locale/pt-br";
import "dayjs/locale/de";
import "dayjs/locale/it";
import "dayjs/locale/ko";
import "dayjs/locale/tr";
import "dayjs/locale/vi";
import "dayjs/locale/hu";
import "dayjs/locale/th";

dayjs.extend(localizedFormat);
dayjs.extend(isTomorrow);
dayjs.extend(advancedFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

const dayjsLocaleByAppLocale: Record<string, string> = {
    "en-CA": "en-ca",
    "en-GB": "en-gb",
    zh: "zh-tw",
    "zh-CN": "zh-cn",
    "es-ES": "es",
    pt: "pt-br",
    "lol-UWU": "en",
    "lol-PEKO": "en",
};

function getDayjsLocale(locale?: string): string {
    return dayjsLocaleByAppLocale[locale || ""] || locale || "en";
}

export function formatRelativeTime(target: ReturnType<typeof dayjs>, lang?: string, now = dayjs()): string {
    const diffMs = target.valueOf() - now.valueOf();
    const absMs = Math.abs(diffMs);
    const supported = Intl.RelativeTimeFormat.supportedLocalesOf([lang || "", getDayjsLocale(lang)].filter(Boolean));
    const formatter = new Intl.RelativeTimeFormat(supported[0] || "en", { numeric: "auto" });
    const [unit, divisor]: [Intl.RelativeTimeFormatUnit, number] =
        absMs < 45_000 ? ["second", 1000]
        : absMs < 45 * 60_000 ? ["minute", 60_000]
        : absMs < 22 * 3_600_000 ? ["hour", 3_600_000]
        : absMs < 25 * 86_400_000 ? ["day", 86_400_000]
        : absMs < 345 * 86_400_000 ? ["month", 30 * 86_400_000]
        : ["year", 365 * 86_400_000];
    return formatter.format(Math.round(diffMs / divisor), unit);
}

export function configureDayjsLocale(locale?: string): void {
    dayjs.locale(getDayjsLocale(locale));
}

const thresholds = [
    { l: "s", r: 1 },
    { l: "m", r: 1 },
    { l: "mm", r: 59, d: "minute" },
    { l: "h", r: 1 },
    { l: "hh", r: 24, d: "hour" },
    { l: "d", r: 1 },
    { l: "dd", r: 29, d: "day" },
    { l: "M", r: 1 },
    { l: "MM", r: 11, d: "month" },
    { l: "y" },
    { l: "yy", d: "year" },
];
dayjs.extend(relativeTime, { thresholds });

export function formatDuration(millisecs: number): string {
    const negate = millisecs < 0;
    const secs = millisecs / 1000;
    const h = Math.floor(secs / (60 * 60));
    const m = Math.floor((secs % (60 * 60)) / 60);
    const s = Math.floor((secs % (60 * 60)) % 60);
    const hStr = h ? `${h}:` : "";
    const mStr = String(m).padStart(h ? 2 : 1, "0");
    const sStr = String(s).padStart(2, "0");
    return `${negate ? "-" : ""}${hStr}${mStr}:${sStr}`;
}

export function titleTimeString(available_at: string, lang?: string): string {
    const locale = getDayjsLocale(lang);
    const ts = dayjs(available_at).locale(locale);
    const fmt = `${ts.isTomorrow() ? "ddd " : ""}LT zzz`;
    const ts1 = ts.format(fmt);
    const ts2 = ts.tz("Asia/Tokyo").locale(locale).format(fmt);
    return ts1 === ts2 ? ts1 : `${ts1}\n${ts2}`;
}

export function formatDistance(time: string | null, lang: string | undefined, $t: (key: string, args?: Record<string, string | number | Date>) => string, allowNegative = true, now = dayjs()): string {
    if (!time) return "?";
    const locale = getDayjsLocale(lang);
    const nowObj = now.locale(locale);
    const timeObj = dayjs(time).locale(locale);
    const minutesDiff = nowObj.diff(timeObj, "minutes");
    if (Math.abs(minutesDiff) < 1 || (!allowNegative && minutesDiff > 0)) return $t("time.soon");
    const hourDiff = nowObj.diff(timeObj, "hour");
    if (hourDiff < -23) return $t("time.diff_future_date", { arg0: timeObj.format("l"), arg1: timeObj.format("LT") });
    if (hourDiff > 23) return `${timeObj.format("l")} (${timeObj.format("LT")})`;
    if (timeObj.isAfter(nowObj)) return $t("time.diff_future_date", { arg0: formatRelativeTime(timeObj, lang, nowObj), arg1: timeObj.format(`${timeObj.isTomorrow() ? "ddd " : ""}LT`) });
    return $t("time.distance_past_date", { arg0: formatRelativeTime(timeObj, lang, nowObj) });
}

export function secondsToHuman(s: number): string {
    return new Date(s * 1000).toISOString().slice(11, 19);
}

export function formatDurationShort(secs: number): string {
    if (secs < 0) return "0m";
    const h = secs / (60 * 60);
    const m = (secs % (60 * 60)) / 60;
    return h >= 1 ? `${Math.round(h)}h` : `${Math.round(m)}m`;
}

export { dayjs };
