<template>
  <section
    ref="homeRoot"
    class="flex min-h-full"
    @touchstart.passive="handleTouchStart"
    @touchend.passive="handleTouchEnd"
  >
    <!-- Floating side panel -->
    <aside
      ref="asideRef"
      class="home-fave-side-panel sticky z-[80] mr-8 hidden w-60 shrink-0 flex-col overflow-y-auto rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--surface-nav)] p-3 shadow-2xl backdrop-blur-3xl min-[960px]:flex"
      :style="{
        top: 'var(--nav-total-height, 80px)',
        height: 'calc(100vh - 2 * var(--nav-total-height, 80px) + var(--nav-header-height, 64px))',
      }"
    >
      <div class="flex min-h-0 flex-1 flex-col gap-3" :style="{ minHeight: panelMinHeight }">
      <!-- Home / Favorite tabs -->
      <div class="flex items-center gap-1 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-0.5">
        <button
          type="button"
          class="flex-1 cursor-pointer rounded-lg px-2.5 py-1.5 text-[0.8rem] font-medium transition"
          :class="!isFavPage ? 'bg-[color:var(--color-bold)] text-white' : 'text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]'"
          @click="switchToHome"
        >
          {{ $t("component.mainNav.home") }}
        </button>
        <button
          type="button"
          class="flex-1 cursor-pointer rounded-lg px-2.5 py-1.5 text-[0.8rem] font-medium transition"
          :class="isFavPage ? 'bg-[color:var(--color-bold)] text-white' : 'text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]'"
          @click="switchToFavorites"
        >
          <span class="flex items-center gap-1">
            <UiIcon :icon="isFavPage ? mdiHeart : mdiHeartOutline" class-name="h-3.5 w-3.5" />
            {{ $t("component.mainNav.favorites") }}
          </span>
        </button>
      </div>

      <!-- Tab buttons -->
      <div class="flex flex-col gap-1">
        <button
          type="button"
          class="flex cursor-pointer items-center gap-1.5 rounded-xl px-2.5 py-2 text-[0.8rem] font-medium whitespace-nowrap transition"
          :class="viewMode === 'streams' && tab === Tabs.LIVE_UPCOMING ? activeTabClass : inactiveTabClass"
          @click="switchToStreams(Tabs.LIVE_UPCOMING)"
        >
          {{ liveUpcomingHeaderSplit[1] }}
          <span class="stream-count-chip inline-grid h-5 min-w-5 place-items-center rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-1.5 text-[10px] text-[color:var(--color-muted-foreground)]">{{ lives.length }}</span>
          {{ liveUpcomingHeaderSplit[2] }}
          <span class="stream-count-chip inline-grid h-5 min-w-5 place-items-center rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-1.5 text-[10px] text-[color:var(--color-muted-foreground)]">{{ upcoming.length }}</span>
        </button>
        <button
          type="button"
          class="cursor-pointer rounded-xl px-2.5 py-2 text-left text-[0.8rem] font-medium whitespace-nowrap transition"
          :class="viewMode === 'streams' && tab === Tabs.ARCHIVE ? activeTabClass : inactiveTabClass"
          @click="switchToStreams(Tabs.ARCHIVE)"
        >
          {{ $t("views.home.recentVideoToggles.official") }}
        </button>
        <button
          type="button"
          class="cursor-pointer rounded-xl px-2.5 py-2 text-left text-[0.8rem] font-medium whitespace-nowrap transition"
          :class="viewMode === 'streams' && tab === Tabs.CLIPS ? activeTabClass : inactiveTabClass"
          @click="switchToStreams(Tabs.CLIPS)"
        >
          {{ $t("views.home.recentVideoToggles.subber") }}
        </button>
        <button
          type="button"
          class="cursor-pointer rounded-xl px-2.5 py-2 text-left text-[0.8rem] font-medium whitespace-nowrap transition"
          :class="viewMode === 'channels' ? activeTabClass : inactiveTabClass"
          @click="switchToChannels()"
        >
          {{ $t("component.mainNav.channels") }}
        </button>
      </div>

      <hr class="border-t border-[color:var(--color-border)]" />

      <!-- Streams filter controls (teleported from ConnectedVideoList) -->
      <div v-if="!isMobile && viewMode === 'streams'" class="relative flex min-h-0 flex-1 flex-col gap-3">
        <div :id="`date-selector${isFavPage}`" class="flex min-h-0 flex-1 flex-col" />
      </div>

      <!-- Channels controls (teleported from Channels.vue) -->
      <div v-if="!isMobile && viewMode === 'channels'" id="channels-panel-portal" class="flex flex-col gap-2" />
      </div>
    </aside>

    <!-- Mobile tab bar (kept for small screens) -->
    <Teleport v-if="isActive && isMobile && viewMode === 'streams'" to="#mainNavExt">
      <div class="home-fave-tab-stack">
        <div class="home-fave-tab-cover home-fave-tab-cover-top" aria-hidden="true" />
        <div class="home-fave-tab-cover home-fave-tab-cover-left" aria-hidden="true" />
        <div class="home-fave-tab-cover home-fave-tab-cover-right" aria-hidden="true" />
        <div
          class="home-fave-tab-bar flex w-full items-center justify-between gap-2 overflow-visible rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--surface-nav)] px-2 py-1.5 backdrop-blur-xl"
        >
          <div class="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              class="inline-flex cursor-pointer items-center rounded-xl px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition sm:text-sm"
              :class="tab === Tabs.LIVE_UPCOMING ? activeTabClass : inactiveTabClass"
              @click="setTab(Tabs.LIVE_UPCOMING)"
            >
              {{ liveUpcomingHeaderSplit[1] }}
              <span class="stream-count-chip mx-1 inline-flex h-5 items-center rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-1.5 text-[10px] text-[color:var(--color-muted-foreground)] sm:text-[11px]">
                {{ lives.length }}
              </span>
              {{ liveUpcomingHeaderSplit[2] }}
              <span class="stream-count-chip ml-1 inline-flex h-5 items-center rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-1.5 text-[10px] text-[color:var(--color-muted-foreground)] sm:text-[11px]">
                {{ upcoming.length }}
              </span>
            </button>
            <button
              type="button"
              class="cursor-pointer rounded-xl px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition sm:text-sm"
              :class="tab === Tabs.ARCHIVE ? activeTabClass : inactiveTabClass"
              @click="setTab(Tabs.ARCHIVE)"
            >
              {{ $t("views.home.recentVideoToggles.official") }}
            </button>
            <button
              type="button"
              class="cursor-pointer rounded-xl px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition sm:text-sm"
              :class="tab === Tabs.CLIPS ? activeTabClass : inactiveTabClass"
              @click="setTab(Tabs.CLIPS)"
            >
              {{ $t("views.home.recentVideoToggles.subber") }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <div class="flex min-w-0 flex-1 flex-col">
      <template v-if="viewMode === 'streams'">
        <template v-if="isFavPage && !(isLoggedIn && favoriteChannelIDs.size > 0)">
          <div class="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <UiIcon :icon="mdiHeartOutline" class-name="h-12 w-12 text-[color:var(--color-muted-foreground)] opacity-40" />
            <p class="text-sm text-[color:var(--color-muted-foreground)]" v-html="$t('views.favorites.promptForAction')" />
            <UiButton
              variant="outline"
              as="router-link"
              :to="isLoggedIn ? '#' : '/user'"
              class-name="fav-login-btn"
              @click.prevent="isLoggedIn ? switchToChannels() : undefined"
            >
              {{ isLoggedIn ? $t("views.favorites.manageFavorites") : "Login" }}
            </UiButton>
          </div>
        </template>

        <LoadingOverlay :is-loading="false" :show-error="hasError" />
        <connected-video-list
          ref="videoList"
          :is-fav-page="isFavPage"
          :tab="tab"
          :is-active="isActive"
        />
      </template>

      <ChannelsView v-else-if="viewMode === 'channels'" embedded />
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onActivated, onDeactivated, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useHomeStore } from "@/stores/home";
import { useFavoritesStore } from "@/stores/favorites";
import { useAppStore } from "@/stores/app";
import { useMetaTitle } from "@/composables/useMetaTitle";
import { useReloadable } from "@/composables/useReloadable";
import { useRoute } from "vue-router";
import ConnectedVideoList from "@/components/video/ConnectedVideoList.vue";
import ChannelsView from "@/views/Channels.vue";
import LoadingOverlay from "@/components/common/LoadingOverlay.vue";
import UiButton from "@/components/ui/button/Button.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import { mdiHeart, mdiHeartOutline } from "@mdi/js";
import * as icons from "@/utils/icons";

defineOptions({ name: "HomeFave" });

const { t } = useI18n();
const route = useRoute();

const homeStore = useHomeStore();
const favoritesStore = useFavoritesStore();
const appStore = useAppStore();

const { live: h_live, hasError: h_hasError } = storeToRefs(homeStore);
const {
  live: f_live,
  hasError: f_hasError,
  favoriteChannelIDs,
} = storeToRefs(favoritesStore);

const Tabs = Object.freeze({
  LIVE_UPCOMING: 0,
  ARCHIVE: 1,
  CLIPS: 2,
  LIST: 3,
});

// Restore persisted state immediately to avoid flicker
const STORAGE_KEY = "holodex-home-state";
const _savedState = (() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
})();

const tab = ref(typeof _savedState.tab === "number" && _savedState.tab >= 0 && _savedState.tab <= 3 ? _savedState.tab : 0);
const isFavPage = ref(typeof _savedState.isFavPage === "boolean" ? _savedState.isFavPage : false);
const viewMode = ref<"streams" | "channels">(_savedState.viewMode === "channels" ? "channels" : "streams");
let refreshTimer: ReturnType<typeof setInterval> | null = null;
const touchStartX = ref<number | null>(null);
const videoList = ref<InstanceType<typeof ConnectedVideoList> | null>(null);
const asideRef = ref<HTMLElement | null>(null);
const homeRoot = ref<HTMLElement | null>(null);
const panelMinHeight = ref("0px");
let _asideMo: MutationObserver | null = null;

// Precise min-height: content area top to first blocked topic option bottom
function measurePanelMinHeight() {
  const aside = asideRef.value;
  if (!aside) return;
  // Find the last select-card (blocked topics section)
  const selectCards = aside.querySelectorAll(".select-card");
  const blockedTopicsCard = selectCards[selectCards.length - 1];
  if (!blockedTopicsCard) return;

  const asideRect = aside.getBoundingClientRect();
  const paddingTop = parseFloat(getComputedStyle(aside).paddingTop) || 0;
  const contentTop = asideRect.top + paddingTop;
  // Try first option chip inside blocked topics scroll area
  const firstOption = blockedTopicsCard.querySelector(
    ".scroll-area-viewport-native .settings-check-chip",
  );
  if (firstOption) {
    const optionRect = (firstOption as HTMLElement).getBoundingClientRect();
    const contentDist = optionRect.bottom - contentTop + aside.scrollTop;
    panelMinHeight.value = `${Math.ceil(contentDist)}px`;
    return;
  }
  // Fallback: measure to bottom of search bar
  const searchBar = blockedTopicsCard.querySelector(".select-card-controls");
  if (searchBar) {
    const searchRect = (searchBar as HTMLElement).getBoundingClientRect();
    const contentDist = searchRect.bottom - contentTop + aside.scrollTop;
    panelMinHeight.value = `${Math.ceil(contentDist)}px`;
  }
}

watch(asideRef, (el) => {
  _asideMo?.disconnect();
  if (!el) return;
  _asideMo = new MutationObserver(() => nextTick(measurePanelMinHeight));
  _asideMo.observe(el, { childList: true, subtree: true });
  nextTick(measurePanelMinHeight);
});
onBeforeUnmount(() => _asideMo?.disconnect());

// Per-tab scroll positions: key is "streams-{tabIndex}" or "channels"
const scrollPositions = new Map<string, number>();

function currentScrollKey() {
  return viewMode.value === "channels" ? "channels" : `streams-${tab.value}`;
}

function resetScrollableElement(element: Element | null | undefined) {
  if (!(element instanceof HTMLElement)) return;
  element.scrollTop = 0;
  element.scrollLeft = 0;
}

function resetAllHomeScrollbars() {
  scrollPositions.clear();
  resetScrollableElement(asideRef.value);
  resetScrollableElement(homeRoot.value);

  const root = homeRoot.value;
  if (!root) return;

  root.querySelectorAll<HTMLElement>("*").forEach((element) => {
    const style = window.getComputedStyle(element);
    const canScrollY = ["auto", "scroll", "overlay"].includes(style.overflowY)
      && element.scrollHeight > element.clientHeight;
    const canScrollX = ["auto", "scroll", "overlay"].includes(style.overflowX)
      && element.scrollWidth > element.clientWidth;
    if (!canScrollY && !canScrollX) return;
    resetScrollableElement(element);
  });
}

const { isActive } = useReloadable(reload);

useMetaTitle(() => {
  if (isFavPage.value) return `${t("component.mainNav.favorites")} - Holodex`;
  return "Holodex";
});

// Computed
const isLoggedIn = computed(() => appStore.isLoggedIn);
const live = computed(() => (isFavPage.value ? f_live.value : h_live.value));
const hasError = computed(() => (isFavPage.value ? f_hasError.value : h_hasError.value));
const lives = computed(() => live.value.filter((v: any) => v.status === "live"));
const upcoming = computed(() => live.value.filter((v: any) => v.status === "upcoming"));
const liveUpcomingHeaderSplit = computed(() =>
  t("views.home.liveOrUpcomingHeading").match(/(.+)([\\/／・].+)/),
);
const isMobile = computed(() => appStore.isMobile);
const activeTabClass = "bg-[color:var(--color-bold)] text-white";
const inactiveTabClass = "text-[color:var(--color-muted-foreground)] hover:bg-white/8 hover:text-[color:var(--color-foreground)]";

// Watchers
watch(favoriteChannelIDs, () => {
  if (isFavPage.value && isActive.value) init(false);
}, { deep: true });

watch(() => appStore.visibilityState, () => {
  if (isActive.value && appStore.visibilityState === "visible") {
    if (isFavPage.value) {
      favoritesStore.fetchLive({ force: false });
    } else {
      homeStore.fetchLive({ force: false });
    }
  }
});

function applyLogoHomeReset(trigger = appStore.reloadTrigger) {
  if (!trigger || trigger.consumed || route.name !== "home" || trigger.source !== "logo-home") {
    return false;
  }
  trigger.consumed = true;
  resetAllHomeScrollbars();
  isFavPage.value = false;
  viewMode.value = "streams";
  tab.value = Tabs.LIVE_UPCOMING;
  saveState();
  return true;
}

watch(() => appStore.reloadTrigger, (trigger) => {
  if (!applyLogoHomeReset(trigger)) return;
  nextTick(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    init(true);
  });
});

// Persist state to localStorage
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      viewMode: viewMode.value,
      isFavPage: isFavPage.value,
      tab: tab.value,
    }));
  } catch {}
}

function handleTouchStart(event: TouchEvent) {
  touchStartX.value = event.changedTouches?.[0]?.clientX ?? null;
}

function handleTouchEnd(event: TouchEvent) {
  if (touchStartX.value === null) return;
  const endX = event.changedTouches?.[0]?.clientX ?? touchStartX.value;
  const delta = endX - touchStartX.value;
  touchStartX.value = null;
  if (Math.abs(delta) < 50) return;
  if (delta > 0) {
    setTab(Math.max(tab.value - 1, 0));
  } else {
    setTab(Math.min(tab.value + 1, 2));
  }
}

function setTab(nextTab: number) {
  if (nextTab === tab.value) return;
  scrollPositions.set(currentScrollKey(), window.scrollY);
  tab.value = nextTab;
  saveState();
  nextTick(() => {
    window.scrollTo(0, scrollPositions.get(currentScrollKey()) || 0);
  });
}

function setAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    if (isFavPage.value) {
      favoritesStore.fetchLive({ force: false });
    } else {
      homeStore.fetchLive({ force: false });
    }
  }, 2 * 60 * 1000);
}

function init(updateFavorites = false) {
  if (isFavPage.value) {
    if (updateFavorites) favoritesStore.fetchFavorites();
    if (favoriteChannelIDs.value.size > 0 && isLoggedIn.value) {
      favoritesStore.fetchLive({ force: updateFavorites || f_live.value.length === 0, minutes: 2 });
    }
  } else {
    homeStore.fetchLive({ force: updateFavorites || h_live.value.length === 0, minutes: 2 });
  }
  videoList.value?.init(updateFavorites);
}

function switchToHome() {
  if (!isFavPage.value && viewMode.value === "streams") return;
  isFavPage.value = false;
  viewMode.value = "streams";
  saveState();
  init(true);
}

function switchToFavorites() {
  if (isFavPage.value && viewMode.value === "streams") return;
  isFavPage.value = true;
  viewMode.value = "streams";
  saveState();
  init(true);
}

function switchToStreams(nextTab: number) {
  scrollPositions.set(currentScrollKey(), window.scrollY);
  viewMode.value = "streams";
  tab.value = nextTab;
  saveState();
  nextTick(() => {
    window.scrollTo(0, scrollPositions.get(currentScrollKey()) || 0);
  });
}

function switchToChannels() {
  scrollPositions.set(currentScrollKey(), window.scrollY);
  viewMode.value = "channels";
  saveState();
  nextTick(() => {
    window.scrollTo(0, scrollPositions.get(currentScrollKey()) || 0);
  });
}

function reload() {
  init();
}

// Lifecycle (created equivalent)
applyLogoHomeReset();
init(true);
setAutoRefresh();

onActivated(() => {
  init(false);
  setAutoRefresh();
});

onDeactivated(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
});

onBeforeUnmount(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
});
</script>

<style scoped>
.home-fave-tab-stack {
    --home-fave-bar-radius: 1rem;
    --home-fave-bar-cover-rise: 16px;
    position: relative;
}

.home-fave-tab-bar {
    position: relative;
    z-index: 1;
}

.home-fave-tab-cover {
    position: absolute;
    background: var(--color-background);
    pointer-events: none;
    z-index: 0;
}

.home-fave-tab-cover-top {
    top: calc(-1 * var(--home-fave-bar-cover-rise));
    right: 0;
    left: 0;
    height: var(--home-fave-bar-cover-rise);
}

.home-fave-tab-cover-left,
.home-fave-tab-cover-right {
    top: 0;
    width: calc(var(--home-fave-bar-radius) + 1px);
    height: calc(var(--home-fave-bar-radius) + 1px);
}

.home-fave-tab-cover-left {
    left: 0;
    background:
        radial-gradient(circle at bottom right, transparent calc(var(--home-fave-bar-radius) - 1px), var(--color-background) var(--home-fave-bar-radius));
}

.home-fave-tab-cover-right {
    right: 0;
    background:
        radial-gradient(circle at bottom left, transparent calc(var(--home-fave-bar-radius) - 1px), var(--color-background) var(--home-fave-bar-radius));
}
</style>

<style>
/* shared with favorites.vue */
.stream-count-chip {
    align-items: center;
    justify-content: center;
    letter-spacing: normal;
    line-height: 1;
    min-width: 24px;
}

/* Login/manage button — matches org selector colors exactly */
.fav-login-btn {
    border-color: var(--color-light) !important;
    background: var(--color-card) !important;
    color: var(--color-muted-foreground) !important;
    transition: border-color 180ms ease, background-color 180ms ease, color 180ms ease;
}

.fav-login-btn:hover {
    border-color: var(--color-bold) !important;
    background: var(--color-base) !important;
    color: var(--color-foreground) !important;
}
</style>
