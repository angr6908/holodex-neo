<template>
  <div
    class="relative z-0 min-h-screen"
    :style="appThemeStyle"
  >
    <MainNav />

    <main :class="mainClass" :style="mainStyle">
      <PullToRefresh />
      <router-view v-slot="{ Component }">
        <keep-alive
          max="4"
          exclude="Watch,MugenClips,EditVideo,MultiView,Channel,About"
        >
          <component :is="Component" :key="viewKey" />
        </keep-alive>
      </router-view>
    </main>

    <transition name="twitter-banner">
      <div
        v-if="showTwitter"
        class="fixed inset-x-3 top-20 z-50 mx-auto max-w-lg"
      >
        <UiCard class-name="border border-amber-300/20 bg-amber-300/12 p-4 text-amber-50">
          <div class="text-sm font-semibold">
            {{ $t("views.login.twitterMsg.0") }}
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            <UiButton
              as="router-link"
              size="sm"
              to="/user"
              @click="showTwitter = false"
            >
              {{ $t("views.login.linkAcc") }}
            </UiButton>
            <UiButton variant="ghost" size="sm" @click="showTwitter = false">
              {{ $t("views.app.close_btn") }}
            </UiButton>
          </div>
        </UiCard>
      </div>
    </transition>

    <ReportDialog />
    <InstallPrompt v-if="appStore.isMobile" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { event as gtagEvent, exception as gtagException } from "vue-gtag";
import MainNav from "@/components/nav/MainNav.vue";
import ReportDialog from "@/components/common/ReportDialog.vue";
import PullToRefresh from "@/components/common/PullToRefresh.vue";
import InstallPrompt from "@/components/common/InstallPrompt.vue";
import UiCard from "@/components/ui/card/Card.vue";
import UiButton from "@/components/ui/button/Button.vue";
import { loadLanguageAsync } from "./plugins/app-i18n";
import { DEFAULT_THEME_ID, readStoredThemeId, resolveThemeById } from "@/utils/themes";
import { axiosInstance } from "./utils/backend-api";
import { useAppStore } from "@/stores/app";
import { useSettingsStore } from "@/stores/settings";
import { useFavoritesStore } from "@/stores/favorites";
import { useOrgsStore } from "@/stores/orgs";
import { useMetaTitle } from "@/composables/useMetaTitle";

const route = useRoute();
const router = useRouter();
const { locale } = useI18n({ useScope: "global" });
const appStore = useAppStore();
const settingsStore = useSettingsStore();
const favoritesStore = useFavoritesStore();
const orgsStore = useOrgsStore();

useMetaTitle(() => {
  // Don't set default title during initial navigation (START_LOCATION).
  // Preserves the HTML <title>Holodex</title> and prevents flashing
  // "Holodex" before the route component sets its own title.
  if (!route.name) return "";
  return "Holodex";
});

// ── Data ──
let favoritesUpdateTask: ReturnType<typeof setInterval> | null = null;
let visibilityChangeHandler: (() => void) | null = null;
let axiosInterceptorId: number | null = null;
const showTwitter = ref(false);
const themeId = ref(readStoredThemeId());
const windowWidth = ref(typeof window !== "undefined" ? window.innerWidth : 1440);
const systemPrefersDark = ref(
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : true,
);
let colorSchemeMediaQuery: MediaQueryList | null = null;
const themeVarsCache: Record<string, Record<string, string>> = Object.create(null);
let lastAppliedThemeKey = "";
let themeSwitchRafPrimary: number | null = null;
let themeSwitchRafSecondary: number | null = null;
let initialLoadDone = false;

// ── Computed ──
const viewKey = computed(() => {
  // During initial navigation, route is at START_LOCATION (path: "/").
  // Use window.location.pathname to avoid keep-alive using the wrong key.
  const key = (!route.name && route.path === "/") ? window.location.pathname : route.path;
  if (key.match(/^\/channel\/.{16}/)) {
    return key.substring(0, 33);
  }
  return key;
});

const manualDarkMode = computed(() => settingsStore.darkMode);

const followSystemTheme = computed(() => settingsStore.followSystemTheme);

const darkMode = computed(() =>
  followSystemTheme.value ? systemPrefersDark.value : manualDarkMode.value,
);

const lang = computed(() =>
  (route.query.lang as string) || settingsStore.lang,
);

const appThemeStyle = computed(() => ({
  backgroundColor: "var(--colorbg)",
  color: "var(--color-foreground)",
}));

const mainClass = computed(() => {
  const base = "mx-auto min-h-screen max-w-[1600px] px-3 pb-28 sm:px-5 lg:pb-10";
  // During initial navigation, route.path is "/" (START_LOCATION) even for deep URLs.
  // Fall back to window.location.pathname for the first render.
  const resolvedPath = (route.path === "/" && !route.name) ? window.location.pathname : route.path;
  if (route.name === "watch" || resolvedPath.startsWith("/watch")) {
    return "min-h-screen w-full overflow-x-hidden px-0 pt-[65px]";
  }
  if (route.name === "multiview" || resolvedPath.startsWith("/multiview")) {
    return "h-screen w-full overflow-hidden p-0";
  }
  if (route.name === "settings") {
    return `${base} pt-[76px] sm:pt-[84px]`;
  }
  if (route.name === "search") {
    return `${base} pt-[76px] sm:pt-[80px]`;
  }
  // All other pages use dynamic padding-top via mainStyle
  return base;
});

/** Dynamic padding-top driven by measured fixed-header height (set by MainNav ResizeObserver) */
const mainStyle = computed(() => {
  const resolvedPath = (route.path === "/" && !route.name) ? window.location.pathname : route.path;
  // Pages that set their own padding-top via class
  if (
    route.name === "watch" || resolvedPath.startsWith("/watch") ||
    route.name === "multiview" || resolvedPath.startsWith("/multiview") ||
    route.name === "settings" || route.name === "search"
  ) {
    return {};
  }
  return { paddingTop: "var(--nav-total-height, 120px)" };
});

// ── Watchers ──
watch(darkMode, () => {
  applyTheme();
});

watch(followSystemTheme, () => {
  applyTheme();
});

watch(lang, (v) => {
  loadLanguageAsync(v);
});

watch(() => appStore.visibilityState, () => {
  if (appStore.visibilityState === "visible") {
    favoritesStore.fetchLive({ force: false, minutes: 5 });
  }
});

// ── Theme utility functions ──
function getThemeModeKey() {
  return `${themeId.value}:${darkMode.value ? "dark" : "light"}`;
}

function getActiveTheme(mode = darkMode.value ? "dark" : "light") {
  return resolveThemeById(themeId.value).themes[mode];
}

function hexToRgb(color: string) {
  if (!color || !color.startsWith("#")) return null;
  const normalized = color.slice(1);
  const value = normalized.length === 3
    ? normalized.split("").map((char) => char + char).join("")
    : normalized;
  if (value.length !== 6) return null;
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function withAlpha(color: string, alpha: number) {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

// Composite an rgba layer over a solid hex background → solid hex
function compositeOver(bgHex: string, fgR: number, fgG: number, fgB: number, fgA: number) {
  const bg = hexToRgb(bgHex);
  if (!bg) return bgHex;
  const r = Math.round(fgR * fgA + bg.r * (1 - fgA));
  const g = Math.round(fgG * fgA + bg.g * (1 - fgA));
  const b = Math.round(fgB * fgA + bg.b * (1 - fgA));
  return rgbToHex(r, g, b);
}

function mixColors(baseColor: string, tintColor: string, tintWeight = 0.5) {
  const baseRgb = hexToRgb(baseColor);
  const tintRgb = hexToRgb(tintColor);
  if (!baseRgb || !tintRgb) return baseColor;
  const clampedWeight = Math.max(0, Math.min(1, tintWeight));
  const mixChannel = (base: number, tint: number) => Math.round(base * (1 - clampedWeight) + tint * clampedWeight);
  const r = mixChannel(baseRgb.r, tintRgb.r);
  const g = mixChannel(baseRgb.g, tintRgb.g);
  const b = mixChannel(baseRgb.b, tintRgb.b);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function rgbToHex(r: number, g: number, b: number) {
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function rgbToHsl({ r, g, b }: { r: number; g: number; b: number }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  const l = (max + min) / 2;
  const delta = max - min;
  let s = 0;
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rn:
        h = ((gn - bn) / delta) % 6;
        break;
      case gn:
        h = ((bn - rn) / delta) + 2;
        break;
      default:
        h = ((rn - gn) / delta) + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

function hslToRgb({ h, s, l }: { h: number; s: number; l: number }) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (h < 60) [r1, g1, b1] = [c, x, 0];
  else if (h < 120) [r1, g1, b1] = [x, c, 0];
  else if (h < 180) [r1, g1, b1] = [0, c, x];
  else if (h < 240) [r1, g1, b1] = [0, x, c];
  else if (h < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  return {
    r: (r1 + m) * 255,
    g: (g1 + m) * 255,
    b: (b1 + m) * 255,
  };
}

function getComplementaryColor(color: string) {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  const { h, s, l } = rgbToHsl(rgb);
  const complementaryHue = (h + 180) % 360;
  const normalized = {
    h: complementaryHue,
    s: Math.min(1, Math.max(0.34, s)),
    l: Math.min(0.72, Math.max(0.3, l)),
  };
  const compRgb = hslToRgb(normalized);
  return rgbToHex(compRgb.r, compRgb.g, compRgb.b);
}

function getContrastColor(color: string) {
  const rgb = hexToRgb(color);
  if (!rgb) return darkMode.value ? "#020617" : "#ffffff";
  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return luminance > 0.6 ? "#0f172a" : "#f8fafc";
}

function buildThemeVars() {
  const cacheKey = getThemeModeKey();
  // Clear stale cache entry so new variables are always included
  delete themeVarsCache[cacheKey];

  const resolvedTheme = resolveThemeById(themeId.value);
  const theme = resolvedTheme.themes[darkMode.value ? "dark" : "light"];
  const primaryColor = theme.accent;
  const primaryRgb = hexToRgb(primaryColor);
  const primaryHsl = primaryRgb ? rgbToHsl(primaryRgb) : { h: 220, s: 0.5, l: 0.5 };
  const secondaryColor = darkMode.value
    ? mixColors("#1e293b", primaryColor, 0.62)
    : mixColors("#e2e8f0", primaryColor, 0.5);
  const isDark = darkMode.value;
  const modeBaseBackground = theme.background || (isDark ? "#0b0d11" : "#fcfcfd");
  let background = mixColors(modeBaseBackground, primaryColor, isDark ? 0.08 : 0.03);
  if (isDark) {
    const hue = primaryHsl.h;
    const sat = Math.max(0.24, Math.min(0.52, primaryHsl.s * 0.62));
    const midToneRgb = hslToRgb({ h: hue, s: sat, l: 0.094 });
    const midTone = rgbToHex(midToneRgb.r, midToneRgb.g, midToneRgb.b);
    background = mixColors(modeBaseBackground, midTone, 0.76);
  } else {
    background = mixColors(modeBaseBackground, primaryColor, 0.055);
  }
  const foreground = isDark ? "#ffffff" : "#0f172a";
  const lightCardBase = mixColors("#ffffff", primaryColor, 0.045);
  const lightPopoverBase = mixColors("#ffffff", primaryColor, 0.07);
  const lightMutedBase = mixColors("#e2e8f0", primaryColor, 0.18);
  const lightBorderBase = mixColors("#94a3b8", primaryColor, 0.26);
  const lightInputBase = mixColors("#ffffff", primaryColor, 0.08);
  const lightSurfaceSoftBase = mixColors("#f1f5f9", primaryColor, 0.15);
  const lightSurfaceSoftHoverBase = mixColors("#e2e8f0", primaryColor, 0.22);
  const lightSurfaceNavBase = mixColors("#ffffff", primaryColor, 0.12);
  const lightSurfaceElevatedBase = mixColors("#ffffff", primaryColor, 0.08);
  const lightOverlayBase = mixColors("#cbd5e1", primaryColor, 0.24);
  const lightSkeletonBase = mixColors("#cbd5e1", primaryColor, 0.24);
  const accent = mixColors(secondaryColor, primaryColor, 0.58);
  const card = isDark ? "rgba(15, 23, 42, 0.72)" : withAlpha(lightCardBase, 0.95);
  const colorbg = isDark
    ? mixColors(background, "#0f172a", 0.72)
    : mixColors(background, lightCardBase, 0.95);
  const popover = isDark ? "rgba(2, 6, 23, 0.96)" : withAlpha(lightPopoverBase, 0.98);
  const muted = isDark ? "rgba(30, 41, 59, 0.82)" : withAlpha(lightMutedBase, 0.9);
  const border = isDark ? "rgba(255, 255, 255, 0.1)" : withAlpha(lightBorderBase, 0.32);
  const input = isDark ? "rgba(255, 255, 255, 0.06)" : withAlpha(lightInputBase, 0.94);
  const surfaceSoft = isDark ? "rgba(255, 255, 255, 0.06)" : withAlpha(lightSurfaceSoftBase, 0.94);
  const surfaceSoftHover = isDark ? "rgba(255, 255, 255, 0.08)" : withAlpha(lightSurfaceSoftHoverBase, 0.98);
  const surfaceNav = isDark ? "rgba(2, 6, 23, 0.78)" : withAlpha(lightSurfaceNavBase, 0.84);
  // Solid version of surface-nav for components that can't use backdrop-blur
  const surfaceNavSolid = isDark
    ? compositeOver(background, 2, 6, 23, 0.78)
    : (() => {
        const rgb = hexToRgb(lightSurfaceNavBase);
        return rgb ? compositeOver(background, rgb.r, rgb.g, rgb.b, 0.84) : background;
      })();
  const surfaceElevated = isDark ? "rgba(2, 6, 23, 0.94)" : withAlpha(lightSurfaceElevatedBase, 0.98);
  const overlayBackdrop = isDark ? "rgba(2, 6, 23, 0.74)" : withAlpha(lightOverlayBase, 0.66);
  const skeletonFill = isDark ? "rgba(255, 255, 255, 0.08)" : withAlpha(lightSkeletonBase, 0.58);

  const accentTone = mixColors(primaryColor, secondaryColor, 0.35);
  const supportTone = mixColors(secondaryColor, primaryColor, 0.2);
  const baseBg = isDark ? "#0b1020" : "#ffffff";
  const normalizedBaseWeight = isDark ? 0.12 : 0.12;
  const colorBase = mixColors(baseBg, supportTone, normalizedBaseWeight);
  const colorLight = isDark
    ? mixColors(colorBase, accentTone, 0.42)
    : mixColors(colorBase, accentTone, 0.34);
  const colorBold = isDark
    ? mixColors(colorBase, accentTone, 0.68)
    : mixColors(colorBase, accentTone, 0.58);
  const oppositeColor = getComplementaryColor(primaryColor);
  const socialMotherStart = isDark
    ? mixColors("#0b0d11", oppositeColor, 0.08)
    : mixColors("#ffffff", oppositeColor, 0.16);
  const socialMotherEnd = isDark ? "#0b0d11" : "#ffffff";
  const socialMotherMid = isDark
    ? mixColors(socialMotherStart, socialMotherEnd, 0.62)
    : mixColors(socialMotherStart, socialMotherEnd, 0.38);

  const themeVars: Record<string, string> = {
    "--color-background": background,
    "--colorbg": colorbg,
    "--color-foreground": foreground,
    "--color-card": card,
    "--color-card-foreground": foreground,
    "--color-popover": popover,
    "--color-popover-foreground": foreground,
    "--color-primary": primaryColor,
    "--color-primary-foreground": getContrastColor(primaryColor),
    "--color-secondary": secondaryColor,
    "--color-secondary-foreground": getContrastColor(secondaryColor),
    "--color-muted": muted,
    "--color-muted-foreground": isDark ? "#94a3b8" : mixColors("#475569", primaryColor, 0.16),
    "--color-accent": accent,
    "--color-accent-foreground": getContrastColor(accent),
    "--color-destructive": isDark ? "#ef4444" : "#dc2626",
    "--color-border": border,
    "--color-input": input,
    "--color-ring": accent,
    "--surface-soft": surfaceSoft,
    "--surface-soft-hover": surfaceSoftHover,
    "--surface-nav": surfaceNav,
    "--surface-nav-solid": surfaceNavSolid,
    "--surface-elevated": surfaceElevated,
    "--overlay-backdrop": overlayBackdrop,
    "--skeleton-fill": skeletonFill,
    "--color-bold": colorBold,
    "--color-light": colorLight,
    "--color-base": colorBase,
    "--social-mother-start": socialMotherStart,
    "--social-mother-mid": socialMotherMid,
    "--social-mother-end": socialMotherEnd,
    "--app-body-background": background,
  };
  themeVarsCache[cacheKey] = themeVars;
  return themeVars;
}

function suspendTransitionsDuringThemeSwitch() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.add("theme-switching");
  // During initial load, keep the class until onMounted handles removal
  if (!initialLoadDone) return;
  if (themeSwitchRafPrimary !== null) {
    cancelAnimationFrame(themeSwitchRafPrimary);
  }
  if (themeSwitchRafSecondary !== null) {
    cancelAnimationFrame(themeSwitchRafSecondary);
  }
  themeSwitchRafPrimary = requestAnimationFrame(() => {
    themeSwitchRafSecondary = requestAnimationFrame(() => {
      root.classList.remove("theme-switching");
      themeSwitchRafPrimary = null;
      themeSwitchRafSecondary = null;
    });
  });
}

function syncThemeColor() {
  const themeColor = getActiveTheme().accent;
  const themeMeta = window.document.head.querySelector<HTMLMetaElement>(
    "meta[name=theme-color]",
  );
  if (themeMeta) themeMeta.content = themeColor;
}

function applyTheme() {
  if (typeof document === "undefined") return;
  const themeKey = getThemeModeKey();
  if (themeKey === lastAppliedThemeKey) return;
  const root = document.documentElement;
  suspendTransitionsDuringThemeSwitch();
  const themeVars = buildThemeVars();
  Object.entries(themeVars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  const mode = darkMode.value ? "dark" : "light";
  root.setAttribute("data-theme", mode);
  root.style.colorScheme = mode;
  const viewportBackground = themeVars["--colorbg"]
    || themeVars["--color-background"]
    || themeVars["--app-body-background"];
  if (viewportBackground) {
    root.style.backgroundColor = viewportBackground;
    if (document.body) {
      document.body.style.backgroundColor = viewportBackground;
    }
  }
  lastAppliedThemeKey = themeKey;
  syncThemeColor();
  // Cache colorbg so the inline script in index.html can apply it before Vue loads
  try { localStorage.setItem("holodex-theme-bg", themeVars["--colorbg"]); } catch {}
}

function handleResize() {
  windowWidth.value = window.innerWidth;
  appStore.setWindowWidth(windowWidth.value);
  updateIsMobile();
}

function handleThemeChange(event: Event) {
  const nextThemeId = Number((event as CustomEvent).detail);
  themeId.value = Number.isFinite(nextThemeId) ? nextThemeId : DEFAULT_THEME_ID;
  applyTheme();
}

function handleSystemThemeChange(event: MediaQueryListEvent) {
  systemPrefersDark.value = event.matches;
  if (followSystemTheme.value) {
    applyTheme();
  }
}

function updateIsMobile() {
  appStore.setIsMobile(windowWidth.value < 960);
}

function interceptError(error: any) {
  if (error.response) {
    gtagException({
      description: `${error.response.config.method} ${error.response.config.url}->${error.response.status}`,
      fatal: true,
    });
    gtagEvent(`xhr:${error.response.status}`, {
      event_category: "xhrError",
      event_label: `${error.response.config.method} ${error.response.config.url} -> ${error.response.status}`,
    });
  } else if (error.request) {
    gtagException({
      description: "No Response Received",
      fatal: true,
    });
  } else {
    gtagException({
      description: `Generic: ${error.message}`,
      fatal: true,
    });
  }
  return Promise.reject(error);
}

// ── Lifecycle: created ──
appStore.setVisiblityState(document.visibilityState);
visibilityChangeHandler = () => {
  appStore.setVisiblityState(document.visibilityState);
};
document.addEventListener("visibilitychange", visibilityChangeHandler);
axiosInterceptorId = axiosInstance.interceptors.response.use(undefined, interceptError);

applyTheme();
locale.value = settingsStore.lang;
orgsStore.fetchOrgs();

if (
  (!appStore.selectedHomeOrgs || appStore.selectedHomeOrgs.length === 0)
  && appStore.currentOrg?.name === "All Vtubers"
) {
  appStore.setSelectedHomeOrgs(["Hololive"]);
  appStore.setCurrentOrg({ name: "Hololive", short: "Holo" });
}

appStore.loginCheck();

if (favoritesUpdateTask) clearInterval(favoritesUpdateTask);

favoritesUpdateTask = setInterval(() => {
  favoritesStore.fetchLive({ minutes: 5 });
}, 6 * 60 * 1000);

setTimeout(() => {
  favoritesStore.fetchLive({ force: false, minutes: 2 });
}, 5000);

updateIsMobile();

// ── Lifecycle: mounted ──
onMounted(async () => {
  window.addEventListener("resize", handleResize, { passive: true });
  window.addEventListener("holodex-theme-change", handleThemeChange);
  if (typeof window.matchMedia === "function") {
    colorSchemeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    systemPrefersDark.value = colorSchemeMediaQuery.matches;
    colorSchemeMediaQuery.addEventListener("change", handleSystemThemeChange);
  }
  if (appStore.userdata?.user?.twitter_id
    && !appStore.userdata?.user?.discord_id
    && !appStore.userdata?.user?.google_id) {
    showTwitter.value = true;
  }

  // Wait for the initial route to resolve and all components to render,
  // then remove theme-switching to enable CSS transitions.
  await router.isReady();
  await nextTick();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      initialLoadDone = true;
      document.documentElement.classList.remove("theme-switching");
    });
  });
});

// ── Lifecycle: beforeUnmount ──
onBeforeUnmount(() => {
  if (favoritesUpdateTask) clearInterval(favoritesUpdateTask);
  window.removeEventListener("resize", handleResize);
  window.removeEventListener("holodex-theme-change", handleThemeChange);
  colorSchemeMediaQuery?.removeEventListener("change", handleSystemThemeChange);
  if (visibilityChangeHandler) {
    document.removeEventListener("visibilitychange", visibilityChangeHandler);
  }
  if (axiosInterceptorId !== null) {
    axiosInstance.interceptors.response.eject(axiosInterceptorId);
  }
  if (themeSwitchRafPrimary !== null) {
    cancelAnimationFrame(themeSwitchRafPrimary);
    themeSwitchRafPrimary = null;
  }
  if (themeSwitchRafSecondary !== null) {
    cancelAnimationFrame(themeSwitchRafSecondary);
    themeSwitchRafSecondary = null;
  }
  document.documentElement.classList.remove("theme-switching");
});
</script>

<style>
.twitter-banner-enter-active,
.twitter-banner-leave-active {
  transition: all 0.18s ease;
}

.twitter-banner-enter-from,
.twitter-banner-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}
</style>
