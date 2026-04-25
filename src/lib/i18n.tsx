"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { locales, type LocaleCode } from "@/i18n/locales";
import { useAppState } from "@/lib/store";
import { dayjs } from "@/lib/time";
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

const I18nContext = createContext<{ lang: string; t: (key: string, args?: any) => string }>({ lang: "en", t: (key) => key });
const localePackByUILang = {
  en: "en",
  "en-CA": "en",
  "en-GB": "en",
  "lol-UWU": "lol-UWU",
  "lol-PEKO": "lol-PEKO",
  ja: "ja-JP",
  zh: "zh-TW",
  "zh-CN": "zh-CN",
  ko: "ko-KR",
  "es-ES": "es-ES",
  es: "es-MX",
  ms: "ms-MY",
  id: "id-ID",
  ru: "ru-RU",
  pt: "pt-BR",
  de: "de-DE",
  it: "it-IT",
  fr: "fr-FR",
  tr: "tr-TR",
  vi: "vi-VN",
  hu: "hu-HU",
  th: "th-TH",
} satisfies Record<string, LocaleCode>;
const dayjsName: Record<string, string> = {
  "en-CA": "en-ca",
  "en-GB": "en-gb",
  zh: "zh-tw",
  "zh-CN": "zh-cn",
  "es-ES": "es",
  pt: "pt-br",
  "lol-UWU": "en",
  "lol-PEKO": "en",
};
function resolveUILang(lang?: string | null) {
  return lang && lang in localePackByUILang ? lang : "en";
}
function resolveLocalePack(lang: string) {
  return localePackByUILang[lang as keyof typeof localePackByUILang] || "en";
}

function getByPath(obj: any, key: string) {
  const parts = key.replace(/\[(\w+)\]/g, ".$1").split(".").filter(Boolean);
  return parts.reduce((acc, part) => acc?.[part], obj);
}

function formatMessage(value: any, args?: any) {
  if (value === undefined || value === null) return "";
  let text = Array.isArray(value) ? value.join(" ") : String(value);
  const values = Array.isArray(args) ? args : args !== undefined ? [args] : [];
  values.forEach((arg, index) => { text = text.replaceAll(`{${index}}`, String(arg)); });
  if (args && typeof args === "object" && !Array.isArray(args)) {
    for (const [key, val] of Object.entries(args)) text = text.replaceAll(`{${key}}`, String(val));
  }
  if (values[0] !== undefined) text = text.replaceAll("{n}", String(values[0]));
  return text;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useAppState();
  const searchParams = useSearchParams();
  const routeLang = searchParams.get("lang");
  const lang = resolveUILang(routeLang || settings.lang);
  const localePack = resolveLocalePack(lang);
  useEffect(() => {
    dayjs.locale(dayjsName[lang] || lang || "en");
    document.documentElement.lang = lang;
  }, [lang]);
  const value = useMemo(() => ({
    lang,
    t(key: string, args?: any) {
      const pack = locales[localePack]?.ui || locales.en.ui;
      const fallback = locales.en.ui;
      return formatMessage(getByPath(pack, key) ?? getByPath(fallback, key) ?? key, args);
    },
  }), [lang, localePack]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() { return useContext(I18nContext); }
