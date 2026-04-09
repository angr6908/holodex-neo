<template>
  <section
    class="flex min-h-full flex-col"
    @touchstart.passive="handleTouchStart"
    @touchend.passive="handleTouchEnd"
  >
    <!-- Teleport tabs to nav extension slot -->
    <Teleport v-if="isActive" to="#mainNavExt">
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
          <div v-if="!isMobile" class="shrink-0 pl-2">
            <div :id="`date-selector${isFavPage}`" />
          </div>
        </div>
      </div>
    </Teleport>

    <template v-if="isFavPage && !(isLoggedIn && favoriteChannelIDs.size > 0)">
      <div class="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <UiIcon :icon="mdiHeartOutline" class-name="h-12 w-12 text-[color:var(--color-muted-foreground)] opacity-40" />
        <p class="text-sm text-[color:var(--color-muted-foreground)]" v-html="$t('views.favorites.promptForAction')" />
        <UiButton
          variant="outline"
          as="router-link"
          :to="isLoggedIn ? '/channels' : '/user'"
          class-name="fav-login-btn"
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
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, onActivated, onDeactivated, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useHomeStore } from "@/stores/home";
import { useFavoritesStore } from "@/stores/favorites";
import { useAppStore } from "@/stores/app";
import { useMetaTitle } from "@/composables/useMetaTitle";
import { useReloadable } from "@/composables/useReloadable";
import ConnectedVideoList from "@/components/video/ConnectedVideoList.vue";
import LoadingOverlay from "@/components/common/LoadingOverlay.vue";
import UiButton from "@/components/ui/button/Button.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import { mdiHeartOutline } from "@mdi/js";
import * as icons from "@/utils/icons";

defineOptions({ name: "HomeFave" });

const props = withDefaults(defineProps<{
  isFavPage?: boolean;
}>(), {
  isFavPage: false,
});

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

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

const tab = ref(0);
let refreshTimer: ReturnType<typeof setInterval> | null = null;
const touchStartX = ref<number | null>(null);
const videoList = ref<InstanceType<typeof ConnectedVideoList> | null>(null);

const { isActive } = useReloadable(reload);

useMetaTitle(() => {
  if (props.isFavPage) return `${t("component.mainNav.favorites")} - Holodex`;
  return "Holodex";
});

// Computed
const isLoggedIn = computed(() => appStore.isLoggedIn);
const live = computed(() => (props.isFavPage ? f_live.value : h_live.value));
const hasError = computed(() => (props.isFavPage ? f_hasError.value : h_hasError.value));
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
  if (props.isFavPage && isActive.value) init(false);
}, { deep: true });

watch(() => route.fullPath, () => {
  if (!isActive.value) return;
  const nextTab = getTabFromRoute();
  if (nextTab !== tab.value) tab.value = nextTab;
});

watch(() => appStore.visibilityState, () => {
  if (isActive.value && appStore.visibilityState === "visible") {
    if (props.isFavPage) {
      favoritesStore.fetchLive({ force: false });
    } else {
      homeStore.fetchLive({ force: false });
    }
  }
});

// Methods
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
  const nextPath = getTabPath(nextTab);
  if (nextTab === tab.value && nextPath === route.path) return;
  tab.value = nextTab;
  changeTab(false);
}

function getTabPath(t: number) {
  const basePath = props.isFavPage ? "/favorites" : "/";
  switch (t) {
    case Tabs.ARCHIVE:
      return `${basePath.replace(/\/$/, "")}/archive`;
    case Tabs.CLIPS:
      return `${basePath.replace(/\/$/, "")}/clips`;
    default:
      return basePath;
  }
}

function getTabFromRoute() {
  switch (route.name) {
    case "home_archive":
    case "favorites_archive":
      return Tabs.ARCHIVE;
    case "home_clips":
    case "favorites_clips":
      return Tabs.CLIPS;
    case "home":
    case "favorites":
      return Tabs.LIVE_UPCOMING;
    default:
      break;
  }
  if (route.path.endsWith("/archive")) return Tabs.ARCHIVE;
  if (route.path.endsWith("/clips")) return Tabs.CLIPS;
  switch (route.hash) {
    case "#archive":
      return Tabs.ARCHIVE;
    case "#clips":
      return Tabs.CLIPS;
    case "#list":
      return Tabs.LIST;
    default:
      return Tabs.LIVE_UPCOMING;
  }
}

function setAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    if (props.isFavPage) {
      favoritesStore.fetchLive({ force: false });
    } else {
      homeStore.fetchLive({ force: false });
    }
  }, 2 * 60 * 1000);
}

function changeTab(preservePage = true) {
  const path = getTabPath(tab.value);
  const hash = tab.value === Tabs.LIST ? "#list" : "";
  const query = preservePage ? { ...route.query } : undefined;
  const currentQuery = preservePage ? route.query : {};
  const sameQuery = JSON.stringify(currentQuery || {}) === JSON.stringify(query || {});
  if (route.path === path && route.hash === hash && sameQuery) return;
  router
    .replace({
      path,
      ...(query ? { query } : {}),
      hash,
    })
    .catch(() => {
      // Navigation duplication error expected, catch it and move on
    });
}

function init(updateFavorites = false) {
  tab.value = getTabFromRoute();
  // Always fetch live data regardless of active tab, since the tab bar
  // always shows live/upcoming counts.
  if (props.isFavPage) {
    if (updateFavorites) favoritesStore.fetchFavorites();
    if (favoriteChannelIDs.value.size > 0 && isLoggedIn.value) {
      favoritesStore.fetchLive({ force: updateFavorites || f_live.value.length === 0, minutes: 2 });
    }
  } else {
    homeStore.fetchLive({ force: updateFavorites || h_live.value.length === 0, minutes: 2 });
  }
  videoList.value?.init(updateFavorites);
}

function reload() {
  init();
}

// Lifecycle (created equivalent)
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
