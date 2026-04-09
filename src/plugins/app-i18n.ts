import { createI18n } from "vue-i18n";
import enTL from "@/locales/en/ui.yml";
import { dayjs } from "@/utils/time";

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
];

const possibleChars = [768, 769, 770, 771, 772, 773, 774, 775, 776, 777, 778, 779, 780, 781, 782, 783, 784, 785, 786, 787, 788, 789, 794, 795, 829, 830, 831, 832, 833, 834, 835, 836, 838, 842, 843, 844, 848, 849, 850, 855, 856, 859, 861, 862, 864, 865, 867, 868, 869, 870, 871, 872, 873, 874, 875, 876, 877, 878, 879, 820, 821, 822, 823, 824, 790, 791, 792, 793, 796, 797, 798, 799, 800, 801, 802, 803, 804, 805, 806, 807, 808, 809, 810, 811, 812, 813, 814, 815, 816, 817, 818, 819, 825, 826, 827, 828, 837, 839, 840, 841, 845, 846, 851, 852, 853, 854, 857, 858, 860, 863, 866];
const randInt = (upperBound) => Math.floor(Math.random() * upperBound);
const combiningChars = () => () => String.fromCharCode(possibleChars[randInt(possibleChars.length)]);
const repeat = (fn, count) => Array.from({ length: count }, fn);

export const zalgo = (str) => {
    const randomCombiningChar = combiningChars();
    return str.split("").map((char) => `${char}${repeat(randomCombiningChar, 1).join("")}`).join("");
};

export const asyncLang = {
    async en() { await import("dayjs/locale/en"); return Promise.resolve({ default: enTL }); },
    "en-GB": async () => { await import("dayjs/locale/en-gb"); return Promise.resolve({ default: enTL }); },
    "en-CA": async () => { await import("dayjs/locale/en-ca"); return Promise.resolve({ default: enTL }); },
    async ja() { await import("dayjs/locale/ja"); return import("@/locales/ja-JP/ui.yml"); },
    async zh() { await import("dayjs/locale/zh-tw"); return import("@/locales/zh-TW/ui.yml"); },
    "zh-CN": async () => { await import("dayjs/locale/zh-cn"); return import("@/locales/zh-CN/ui.yml"); },
    async es() { await import("dayjs/locale/es"); return import("@/locales/es-MX/ui.yml"); },
    "es-ES": async () => { await import("dayjs/locale/es"); return import("@/locales/es-ES/ui.yml"); },
    async ms() { await import("dayjs/locale/ms"); return import("@/locales/ms-MY/ui.yml"); },
    async id() { await import("dayjs/locale/id"); return import("@/locales/id-ID/ui.yml"); },
    async ru() { await import("dayjs/locale/ru"); return import("@/locales/ru-RU/ui.yml"); },
    async fr() { await import("dayjs/locale/fr"); return import("@/locales/fr-FR/ui.yml"); },
    async pt() { await import("dayjs/locale/pt-br"); return import("@/locales/pt-BR/ui.yml"); },
    async de() { await import("dayjs/locale/de"); return import("@/locales/de-DE/ui.yml"); },
    async it() { await import("dayjs/locale/it"); return import("@/locales/it-IT/ui.yml"); },
    async ko() { await import("dayjs/locale/ko"); return import("@/locales/ko-KR/ui.yml"); },
    async tr() { await import("dayjs/locale/tr"); return import("@/locales/tr-TR/ui.yml"); },
    async vi() { await import("dayjs/locale/vi"); return import("@/locales/vi-VN/ui.yml"); },
    async hu() { await import("dayjs/locale/hu"); return import("@/locales/hu-HU/ui.yml"); },
    "lol-UWU": async () => { await import("dayjs/locale/en"); return import("@/locales/lol-UWU/ui.yml"); },
    "lol-PEKO": async () => { await import("dayjs/locale/en"); return import("@/locales/lol-PEKO/ui.yml"); },
    async th() { await import("dayjs/locale/th"); return import("@/locales/th-TH/ui.yml"); },
};

export const i18n = createI18n({
    legacy: false,
    globalInjection: true,
    locale: "en",
    fallbackLocale: "en",
    messages: { en: enTL },
    pluralRules: {
        ru(choice, choicesLength) {
            if (choice === 0) return 0;
            const teen = choice > 10 && choice < 20;
            const endsWithOne = choice % 10 === 1;
            if (choicesLength < 4) return !teen && endsWithOne ? 1 : 2;
            if (!teen && endsWithOne) return 1;
            if (!teen && choice % 10 >= 2 && choice % 10 <= 4) return 2;
            return choicesLength < 4 ? 2 : 3;
        },
    },
});

const loadedLanguages = ["en"];
const dayjsName = {
    "en-CA": "en-ca",
    "en-GB": "en-gb",
    zh: "zh-tw",
    "zh-CN": "zh-cn",
    "es-ES": "es",
    pt: "pt-br",
    "lol-UWU": "en",
    "lol-PEKO": "en",
};

function setLocale(lang) {
    i18n.global.locale.value = lang;
}

function getLocale() {
    return i18n.global.locale.value;
}

function setI18nLanguage(lang) {
    setLocale(lang);
    dayjs.locale(dayjsName[lang] || lang || "en");
    if (typeof document !== "undefined") document.documentElement.lang = lang;
}

export function loadLanguageAsync(lang) {
    if (getLocale() === lang) return Promise.resolve();
    if (loadedLanguages.includes(lang)) return Promise.resolve(setI18nLanguage(lang));
    return asyncLang[lang]().then((msg) => {
        i18n.global.setLocaleMessage(lang, msg.default);
        loadedLanguages.push(lang);
        return setI18nLanguage(lang);
    });
}
