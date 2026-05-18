import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import relativeTime from "dayjs/plugin/relativeTime";
import timezone from "dayjs/plugin/timezone";
import advancedFormat from "dayjs/plugin/advancedFormat";
import localizedFormat from "dayjs/plugin/localizedFormat";
import isTomorrow from "dayjs/plugin/isTomorrow";
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

[localizedFormat, isTomorrow, advancedFormat, utc, timezone].forEach((p) => dayjs.extend(p));

const dayjsLocaleMap: Record<string, string> = { zh: "zh-tw", "zh-CN": "zh-cn", "es-ES": "es", pt: "pt-br", "lol-UWU": "en", "lol-PEKO": "en" };
const getDayjsLocale = (l?: string) => dayjsLocaleMap[l || ""] || l || "en";

export function formatRelativeTime(target: ReturnType<typeof dayjs>, lang?: string, now = dayjs()) {
  const diff = target.valueOf() - now.valueOf();
  const abs = Math.abs(diff);
  const supported = Intl.RelativeTimeFormat.supportedLocalesOf([lang || "", getDayjsLocale(lang)].filter(Boolean));
  const fmt = new Intl.RelativeTimeFormat(supported[0] || "en", { numeric: "auto" });
  const [unit, div]: [Intl.RelativeTimeFormatUnit, number] =
    abs < 45_000 ? ["second", 1000]
    : abs < 45 * 60_000 ? ["minute", 60_000]
    : abs < 22 * 3_600_000 ? ["hour", 3_600_000]
    : abs < 25 * 86_400_000 ? ["day", 86_400_000]
    : abs < 345 * 86_400_000 ? ["month", 30 * 86_400_000]
    : ["year", 365 * 86_400_000];
  return fmt.format(Math.round(diff / div), unit);
}

export const configureDayjsLocale = (l?: string) => dayjs.locale(getDayjsLocale(l));

dayjs.extend(relativeTime, { thresholds: [
  { l: "s", r: 1 }, { l: "m", r: 1 }, { l: "mm", r: 59, d: "minute" },
  { l: "h", r: 1 }, { l: "hh", r: 24, d: "hour" },
  { l: "d", r: 1 }, { l: "dd", r: 29, d: "day" },
  { l: "M", r: 1 }, { l: "MM", r: 11, d: "month" },
  { l: "y" }, { l: "yy", d: "year" },
]});

export function formatDuration(ms: number) {
  const s = Math.abs(ms) / 1000;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${ms < 0 ? "-" : ""}${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

export function titleTimeString(at: string, lang?: string) {
  const loc = getDayjsLocale(lang);
  const ts = dayjs(at).locale(loc);
  const fmt = `${ts.isTomorrow() ? "ddd " : ""}LT zzz`;
  const a = ts.format(fmt), b = ts.tz("Asia/Tokyo").locale(loc).format(fmt);
  return a === b ? a : `${a}\n${b}`;
}

export function formatDistance(time: string | null, lang: string | undefined, $t: (k: string, a?: Record<string, string | number | Date>) => string, allowNeg = true, now = dayjs()) {
  if (!time) return "?";
  const loc = getDayjsLocale(lang);
  const n = now.locale(loc);
  const t = dayjs(time).locale(loc);
  const minDiff = n.diff(t, "minutes");
  if (Math.abs(minDiff) < 1 || (!allowNeg && minDiff > 0)) return $t("time.soon");
  const hrDiff = n.diff(t, "hour");
  if (hrDiff < -23) return $t("time.diff_future_date", { arg0: t.format("l"), arg1: t.format("LT") });
  if (hrDiff > 23) return `${t.format("l")} (${t.format("LT")})`;
  if (t.isAfter(n)) return $t("time.diff_future_date", { arg0: formatRelativeTime(t, lang, n), arg1: t.format(`${t.isTomorrow() ? "ddd " : ""}LT`) });
  return $t("time.distance_past_date", { arg0: formatRelativeTime(t, lang, n) });
}

export const secondsToHuman = (s: number) => new Date(s * 1000).toISOString().slice(11, 19);

export const formatDurationShort = (s: number) =>
  s < 0 ? "0m" : s >= 3600 ? `${Math.round(s / 3600)}h` : `${Math.round(s / 60)}m`;

export { dayjs };
