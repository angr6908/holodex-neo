import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { getUILang, getLang } from "@/utils/functions";

const userLanguage = (navigator as any).language || (navigator as any).userLanguage || "en";
const englishNamePrefs = new Set(["en", "es", "fr", "id", "pt", "de", "ru", "it"]);
const lang = getLang(userLanguage);

export const useSettingsStore = defineStore("settings", () => {
    // ── State ──
    // Language
    const langSetting = ref(getUILang(userLanguage));
    const foolsLang = ref("");
    const clipLangs = ref<string[]>([lang]);

    // Site
    const darkMode = ref(true);
    const followSystemTheme = ref(false);
    const defaultOpen = ref("home");

    // Content
    const redirectMode = ref(false);
    const autoplayVideo = ref(false);
    const scrollMode = ref(true);
    const hideThumbnail = ref(false);
    const hidePlaceholder = ref(false);
    const hideMissing = ref(false);
    const nameProperty = ref(englishNamePrefs.has(lang) ? "english_name" : "name");
    const hideCollabStreams = ref(false);
    const hiddenGroups = ref<Record<string, string[]>>({});
    const ignoredTopicsList = ref<string[]>([]);
    const homeViewMode = ref("grid");

    // Live TL Window Settings
    const liveTlStickBottom = ref(false);
    const liveTlLang = ref(lang);
    const liveTlFontSize = ref(14);
    const liveTlShowVerified = ref(true);
    const liveTlShowModerator = ref(true);
    const liveTlShowVtuber = ref(true);
    const liveTlShowLocalTime = ref(false);
    const liveTlWindowSize = ref(0);
    const liveTlShowSubtitle = ref(true);
    const liveTlHideSpoiler = ref(false);
    const liveTlBlocked = ref<string[]>([]);

    const blockedChannels = ref<any[]>([]);

    // ── Getters ──
    const useEnName = computed(() => nameProperty.value === "english_name");
    const blockedChannelIDs = computed(() => new Set(blockedChannels.value.map((x) => x.id)));
    const liveTlBlockedNames = computed(() => new Set(liveTlBlocked.value));
    const ignoredTopics = computed(() => new Set(ignoredTopicsList.value));

    // ── Actions ──
    function setDarkMode(val: boolean) {
        darkMode.value = val;
        localStorage.setItem("darkMode", val ? "true" : "false");
    }

    function setRedirectMode(val: boolean) {
        redirectMode.value = val;
    }

    function setAutoplayVideo(val: boolean) {
        autoplayVideo.value = val;
    }

    function setUseEnName(payload: boolean) {
        nameProperty.value = payload ? "english_name" : "name";
    }

    function setHideThumbnail(val: boolean) {
        hideThumbnail.value = val;
    }

    function setLanguage(val: string) {
        langSetting.value = val;
    }

    function setClipLangs(val: string[]) {
        clipLangs.value = val;
    }

    function setIgnoredTopics(val: string[]) {
        ignoredTopicsList.value = val;
    }

    function setScrollMode(val: boolean) {
        scrollMode.value = val;
    }

    function setDefaultOpen(val: string) {
        defaultOpen.value = val;
    }

    function setFollowSystemTheme(val: boolean) {
        followSystemTheme.value = val;
    }

    function setLiveTlStickBottom(val: boolean) {
        liveTlStickBottom.value = val;
    }

    function setLiveTlLang(val: string) {
        liveTlLang.value = val;
    }

    function setLiveTlFontSize(val: number) {
        liveTlFontSize.value = val;
    }

    function setLiveTlShowVerified(val: boolean) {
        liveTlShowVerified.value = val;
    }

    function setLiveTlShowModerator(val: boolean) {
        liveTlShowModerator.value = val;
    }

    function setLiveTlShowLocalTime(val: boolean) {
        liveTlShowLocalTime.value = val;
    }

    function setLiveTlWindowSize(val: number) {
        liveTlWindowSize.value = val;
    }

    function setHideCollabStreams(val: boolean) {
        hideCollabStreams.value = val;
    }

    function setLiveTlShowVtuber(val: boolean) {
        liveTlShowVtuber.value = val;
    }

    function setLiveTlShowSubtitle(val: boolean) {
        liveTlShowSubtitle.value = val;
    }

    function setLiveTlHideSpoiler(val: boolean) {
        liveTlHideSpoiler.value = val;
    }

    function setHidePlaceholder(val: boolean) {
        hidePlaceholder.value = val;
    }

    function setHideMissing(val: boolean) {
        hideMissing.value = val;
    }

    function setHomeViewMode(val: string) {
        homeViewMode.value = val;
    }

    function resetState() {
        langSetting.value = getUILang(userLanguage);
        foolsLang.value = "";
        clipLangs.value = [lang];
        darkMode.value = true;
        followSystemTheme.value = false;
        defaultOpen.value = "home";
        redirectMode.value = false;
        autoplayVideo.value = false;
        scrollMode.value = true;
        hideThumbnail.value = false;
        hidePlaceholder.value = false;
        hideMissing.value = false;
        nameProperty.value = englishNamePrefs.has(lang) ? "english_name" : "name";
        hideCollabStreams.value = false;
        hiddenGroups.value = {};
        ignoredTopicsList.value = [];
        homeViewMode.value = "grid";
        liveTlStickBottom.value = false;
        liveTlLang.value = lang;
        liveTlFontSize.value = 14;
        liveTlShowVerified.value = true;
        liveTlShowModerator.value = true;
        liveTlShowVtuber.value = true;
        liveTlShowLocalTime.value = false;
        liveTlWindowSize.value = 0;
        liveTlShowSubtitle.value = true;
        liveTlHideSpoiler.value = false;
        liveTlBlocked.value = [];
        blockedChannels.value = [];
        localStorage.removeItem("theme");
        localStorage.removeItem("darkMode");
        localStorage.removeItem("holodex-theme-bg");
    }

    function toggleBlocked(channel: { id: string }) {
        if (!blockedChannels.value) blockedChannels.value = [];
        const index = blockedChannels.value.findIndex((x) => x.id === channel.id);
        if (index >= 0) {
            blockedChannels.value.splice(index, 1);
        } else {
            blockedChannels.value.push(channel);
        }
    }

    function toggleGroupDisplay(group: { title: string; org: string }) {
        const groupName = `${group.title}`.toLowerCase();
        const orgName = `${group.org}`;
        if (!hiddenGroups.value) hiddenGroups.value = {};
        if (!hiddenGroups.value[orgName]) hiddenGroups.value[orgName] = [];

        const index = hiddenGroups.value[orgName].findIndex((x) => x.toLowerCase() === groupName);
        if (index >= 0) {
            hiddenGroups.value[orgName].splice(index, 1);
        } else {
            hiddenGroups.value[orgName].push(groupName);
        }
    }

    function toggleLiveTlBlocked(name: string) {
        if (!liveTlBlocked.value) liveTlBlocked.value = [];
        const index = liveTlBlocked.value.indexOf(name);
        if (index !== -1) {
            liveTlBlocked.value.splice(index, 1);
        } else {
            liveTlBlocked.value.push(name);
        }
    }

    return {
        // state — note: `lang` is exposed as `langSetting` to avoid conflict with the local const
        lang: langSetting,
        foolsLang,
        clipLangs,
        darkMode,
        followSystemTheme,
        defaultOpen,
        redirectMode,
        autoplayVideo,
        scrollMode,
        hideThumbnail,
        hidePlaceholder,
        hideMissing,
        nameProperty,
        hideCollabStreams,
        hiddenGroups,
        ignoredTopics: ignoredTopicsList,
        homeViewMode,
        liveTlStickBottom,
        liveTlLang,
        liveTlFontSize,
        liveTlShowVerified,
        liveTlShowModerator,
        liveTlShowVtuber,
        liveTlShowLocalTime,
        liveTlWindowSize,
        liveTlShowSubtitle,
        liveTlHideSpoiler,
        liveTlBlocked,
        blockedChannels,
        // getters
        useEnName,
        blockedChannelIDs,
        liveTlBlockedNames,
        ignoredTopicsSet: ignoredTopics,
        // actions
        setDarkMode,
        setRedirectMode,
        setAutoplayVideo,
        setUseEnName,
        setHideThumbnail,
        setLanguage,
        setClipLangs,
        setIgnoredTopics,
        setScrollMode,
        setDefaultOpen,
        setFollowSystemTheme,
        setLiveTlStickBottom,
        setLiveTlLang,
        setLiveTlFontSize,
        setLiveTlShowVerified,
        setLiveTlShowModerator,
        setLiveTlShowLocalTime,
        setLiveTlWindowSize,
        setHideCollabStreams,
        setLiveTlShowVtuber,
        setLiveTlShowSubtitle,
        setLiveTlHideSpoiler,
        setHidePlaceholder,
        setHideMissing,
        setHomeViewMode,
        resetState,
        toggleBlocked,
        toggleGroupDisplay,
        toggleLiveTlBlocked,
    };
}, {
    persist: {
        key: "holodex-v2-settings",
    },
});
