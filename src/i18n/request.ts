import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
const messageLocales = new Set([
  "en", "en-CA", "en-GB", "lol-UWU", "lol-PEKO", "ja", "zh", "zh-CN", "ko",
  "es-ES", "es", "ms", "id", "ru", "pt", "de", "it", "fr", "tr", "vi", "hu", "th",
]);

const intlLocaleOverrides: Record<string, string> = {
  "lol-UWU": "en",
  "lol-PEKO": "en",
};

export default getRequestConfig(async () => {
  const requested = (await cookies()).get("locale")?.value;
  const messageLocale = requested && messageLocales.has(requested) ? requested : "en";
  return {
    locale: intlLocaleOverrides[messageLocale] || messageLocale,
    messages: (await import(`../../messages/${messageLocale}.json`)).default,
  };
});
