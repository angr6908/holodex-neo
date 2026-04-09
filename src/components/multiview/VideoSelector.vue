<template>
  <UiCard v-if="!horizontal" class-name="flex h-[80vh] flex-col p-3">
    <!-- Selector bar: same style as horizontal strip -->
    <div class="mb-3 flex items-center gap-1.5 border-b border-white/10 pb-3">
      <HomeOrgMultiSelect
        class="min-w-0 flex-1"
        manual-apply
        :selected-names-override="selectedHomeOrgsForPicker"
        :fallback-selection="[hololiveName]"
        button-class="h-9 w-full justify-between rounded-xl px-3 text-sm font-normal"
        @apply="handleOrgApply"
      />
      <button
        type="button"
        class="mv-quick-btn inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl border transition"
        :class="selectedOrg.name === 'Favorites'
          ? 'border-rose-400/40 bg-rose-500/20 text-rose-300'
          : 'border-[color:var(--color-border)] bg-[color:var(--surface-soft)] text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--surface-soft-hover)] hover:text-rose-300'"
        title="Favorites"
        @click="handlePicker(favTab)"
      >
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
      </button>
      <button
        type="button"
        class="mv-quick-btn inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl border transition"
        :class="selectedOrg.name === 'Playlist'
          ? 'border-sky-400/40 bg-sky-500/20 text-sky-300'
          : 'border-[color:var(--color-border)] bg-[color:var(--surface-soft)] text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--surface-soft-hover)] hover:text-sky-300'"
        title="Playlist"
        @click="handlePicker(playlistTab)"
      >
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/></svg>
      </button>
      <!-- Inline URL input (always expanded) -->
      <form
        class="relative flex h-8 min-w-[8rem] flex-1 items-center"
        @submit.prevent="handleInlineUrl"
      >
        <input
          v-model="inlineUrl"
          type="url"
          placeholder="YouTube / Twitch URL…"
          class="h-8 w-full rounded-xl border border-white/10 bg-slate-900 px-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-sky-500/50 focus:bg-slate-800 transition"
          :class="[inlineUrlError ? 'border-amber-400/50' : '', inlineUrl ? 'rounded-r-none' : '']"
        />
        <button
          v-if="inlineUrl"
          type="submit"
          class="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-r-xl border border-l-0 transition"
          :class="inlineUrlError ? 'border-amber-400/30 bg-slate-900 text-amber-400' : 'border-sky-400/40 bg-sky-500 text-white hover:brightness-110'"
          title="Add URL"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        </button>
      </form>
      <UiButton
        v-if="!isUrl"
        type="button"
        size="icon"
        variant="secondary"
        :class-name="`${isLoading ? 'refresh-spin ' : ''}h-8 w-8 shrink-0 cursor-pointer`"
        title="Refresh"
        @click="loadSelection(true)"
      >
        <UiIcon :icon="icons.mdiRefresh" />
      </UiButton>
    </div>

    <div
      ref="container"
      class="video-list min-h-0 flex-1 px-1 sm:px-2"
    >
      <template v-if="isUrl">
        <div class="px-2 py-1 text-sm font-semibold uppercase tracking-[0.18em] text-sky-200/70">
          {{ $t("views.multiview.video.addCustomVideo") }}
        </div>
        <CustomUrlField
          :twitch="selectedOrg.name === 'TwitchURL'"
          @onSuccess="handleVideoClick"
        />
      </template>

      <template v-else-if="selectedOrg.name === 'Favorites' && !isLoggedIn">
        <div class="px-3 py-6 text-center">
          <div class="text-sm text-slate-300" v-html="$t('views.favorites.promptForAction')" />
          <UiButton
            as="router-link"
            class-name="mt-4 favorites-login-button"
            :to="isLoggedIn ? '/channels' : '/user'"
          >
            {{ isLoggedIn ? $t("views.favorites.manageFavorites") : $t("component.mainNav.login") }}
          </UiButton>
        </div>
      </template>

      <template v-else>
        <div
          v-if="selectedOrg.name !== 'Playlist'"
          class="mb-3 flex flex-wrap items-center gap-2 px-1"
        >
          <UiButton
            type="button"
            size="sm"
            :variant="tab === 0 ? 'default' : 'ghost'"
            @click="tab = 0"
          >
            {{ $t("views.home.liveOrUpcomingHeading") }}
          </UiButton>
          <UiButton
            type="button"
            size="sm"
            :variant="tab === 1 ? 'default' : 'ghost'"
            @click="tab = 1"
          >
            {{ $t("views.home.recentVideoToggles.official") }}
          </UiButton>
          <div id="date-selector-multiview" class="ml-auto" />
        </div>

        <VideoCardList
          v-if="selectedOrg.name === 'Playlist'"
          :videos="savedVideosList"
          include-channel
          horizontal
          dense
          disable-default-click
          in-multi-view-selector
          @videoClicked="handleVideoClick"
        />
        <ConnectedVideoList
          v-else
          :tab="tab"
          :is-fav-page="selectedOrg.name === 'Favorites'"
          :hide-placeholder="false"
          :live-content="baseFilteredLive"
          :org-targets-override="connectedListOrgTargets"
          disable-default-click
          dense
          date-portal-name="date-selector-multiview"
          in-multi-view-selector
          @videoClicked="handleVideoClick"
        />
        <div class="block h-[120px]" />
      </template>
    </div>
  </UiCard>

  <div
    v-else
    class="flex w-full min-w-0 items-center gap-1"
  >
    <!-- Standalone quick-action buttons -->
    <template v-if="!compact">
      <HomeOrgMultiSelect
        class="shrink-0 self-center"
        manual-apply
        icon-only
        inline
        :selected-names-override="selectedHomeOrgsForPicker"
        :fallback-selection="[hololiveName]"
        button-class="h-8 w-8 gap-0 overflow-hidden rounded-xl px-0"
        @apply="handleOrgApply"
      />
      <button
        type="button"
        class="mv-quick-btn inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition"
        :class="selectedOrg.name === 'Favorites'
          ? 'border-rose-400/40 bg-rose-500/20 text-rose-300'
          : 'border-[color:var(--color-border)] bg-[color:var(--surface-soft)] text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--surface-soft-hover)] hover:text-rose-300'"
        title="Favorites"
        @click="selectQuickTab(favTab)"
      >
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
      </button>
      <div ref="playlistMenuRoot" class="relative shrink-0 self-center">
        <button
          type="button"
          class="mv-quick-btn inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition"
          :class="selectedOrg.name === 'Playlist'
            ? 'border-sky-400/40 bg-sky-500/20 text-sky-300'
            : 'border-[color:var(--color-border)] bg-[color:var(--surface-soft)] text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--surface-soft-hover)] hover:text-sky-300'"
          title="Playlist"
          @click="showPlaylistMenu = !showPlaylistMenu"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/></svg>
        </button>
        <UiCard
          v-if="showPlaylistMenu"
          class-name="absolute left-0 top-full z-[120] mt-2 min-w-[13rem] border border-[color:var(--color-border)] bg-[color:var(--surface-nav)] p-1.5 shadow-2xl shadow-black/60 backdrop-blur-xl"
        >
          <button
            type="button"
            class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-white/8"
            :class="selectedOrg.name === 'Playlist' ? 'text-sky-300' : 'text-[color:var(--color-foreground)]'"
            @click="showPlaylistMenu = false; selectQuickTab(playlistTab)"
          >
            <svg class="h-4 w-4 shrink-0 text-sky-400" viewBox="0 0 24 24" fill="currentColor"><path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/></svg>
            <span>{{ $t("component.mainNav.playlist") }}</span>
          </button>
        </UiCard>
      </div>
      <MvUrlInput
        class="shrink-0 self-center"
        @on-success="handleVideoClick"
      />
      <button
        v-if="!isUrlTab"
        type="button"
        class="mv-quick-btn inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[color:var(--color-border)] bg-[color:var(--surface-soft)] text-[color:var(--color-muted-foreground)] transition hover:bg-[color:var(--surface-soft-hover)] hover:text-[color:var(--color-foreground)]"
        :class="isLoading ? 'refresh-spin' : ''"
        title="Refresh"
        @click="loadSelection(true)"
      >
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
      </button>
    </template>

    <template v-if="selectedOrg.name === 'Favorites' && !isLoggedIn">
      <div class="flex items-center gap-2 self-center text-sm text-slate-300">
        <span v-html="$t('views.app.loginCallToAction')" />
        <UiButton
          as="router-link"
          variant="ghost"
          size="sm"
          :to="isLoggedIn ? '/channels' : '/user'"
        >
          {{ $t("component.mainNav.login") }}
        </UiButton>
      </div>
    </template>

    <template v-else>
      <div class="videos-strip min-w-0 flex-1" :class="compact ? 'compact' : ''" @wheel="scrollHandler">
        <!-- Skeleton loading circles -->
        <div
          v-if="isLoading && topFilteredLive.length === 0"
          class="flex items-center gap-2 px-1"
        >
          <div
            v-for="n in 6"
            :key="n"
            class="animate-pulse shrink-0 rounded-full bg-white/8"
            :style="{ width: `${compact ? 34 : 46}px`, height: `${compact ? 34 : 46}px` }"
          />
        </div>
        <UiScrollArea
          v-else
          ref="videosBar"
          orientation="horizontal"
          fade-edges="horizontal"
          :class-name="compact ? 'mv-video-scroll mv-video-scroll-compact' : 'mv-video-scroll'"
          viewport-class-name="mv-video-scroll-vp"
          :content-class-name="compact ? 'videos-bar flex items-center gap-1.5' : 'videos-bar flex items-center gap-2'"
        >
          <div
            v-for="video in topFilteredLive"
            :key="video.id"
            class="group relative flex shrink-0 items-center"
            :title="video.title"
            draggable="true"
            @dragstart="(ev) => dragVideo(ev, video)"
          >
            <button
              type="button"
              class="relative inline-flex items-center justify-center rounded-full transition-transform group-hover:scale-[1.02]"
              @click="handleVideoClick(video)"
            >
              <UiBadge
                v-if="video && video.link && !compact"
                class-name="mv-avatar-badge absolute left-0 top-0 z-10 min-w-[20px] justify-center rounded-full px-1 py-0 text-[9px] tracking-normal shadow-md"
              >
                <UiIcon :icon="mdiTwitch" size="xs" />
              </UiBadge>

              <UiBadge
                v-if="!compact"
                variant="secondary"
                class-name="mv-avatar-badge absolute bottom-[-2px] right-[-2px] z-10 rounded-full px-1.5 py-0 text-[9px] normal-case tracking-normal shadow-md"
              >
                {{ formatDurationLive(video) }}
              </UiBadge>

              <ChannelImg
                v-if="video.channel && video.channel.id"
                :channel="video.channel"
                :size="compact ? 28 : 36"
                no-link
                class="bg-slate-900/85 ring-1 ring-white/10"
              />
              <div
                v-else
                class="flex items-center justify-center overflow-hidden rounded-full bg-slate-800 ring-1 ring-white/10"
                :style="{ width: `${compact ? 28 : 36}px`, height: `${compact ? 28 : 36}px` }"
              >
                <UiIcon :icon="icons.mdiAccountCircleOutline" size="sm" />
              </div>
            </button>
          </div>
        </UiScrollArea>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import VideoCardList from "@/components/video/VideoCardList.vue";
import ConnectedVideoList from "@/components/video/ConnectedVideoList.vue";
import ChannelImg from "@/components/channel/ChannelImg.vue";
import backendApi from "@/utils/backend-api";
import { dayjs, formatDurationShort } from "@/utils/time";
import HomeOrgMultiSelect from "@/components/common/HomeOrgMultiSelect.vue";
import { useFilterVideos } from "@/composables/useFilterVideos";
import { mdiTwitch } from "@mdi/js";
import * as icons from "@/utils/icons";
import { getVideoIDFromUrl } from "@/utils/functions";
import { videoTemporalComparator } from "@/utils/functions";
import { formatOrgDisplayName } from "@/utils/functions";
import CustomUrlField from "./CustomUrlField.vue";
import MvUrlInput from "./MvUrlInput.vue";
import UiBadge from "@/components/ui/badge/Badge.vue";
import UiButton from "@/components/ui/button/Button.vue";
import UiCard from "@/components/ui/card/Card.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import UiScrollArea from "@/components/ui/scroll-area/ScrollArea.vue";
import { useMultiviewStore } from "@/stores/multiview";
import { useAppStore } from "@/stores/app";
import { useFavoritesStore } from "@/stores/favorites";
import { usePlaylistStore } from "@/stores/playlist";
import { useSettingsStore } from "@/stores/settings";
import { useOrgsStore } from "@/stores/orgs";

defineOptions({ name: "VideoSelector" });

const props = withDefaults(defineProps<{
  horizontal?: boolean;
  isActive?: boolean;
  compact?: boolean;
  hidePlaceholder?: boolean;
  hideMissing?: boolean;
}>(), {
  isActive: true,
});

const emit = defineEmits<{
  (e: "videoClicked", video: any): void;
}>();

const { filterVideos } = useFilterVideos();
const multiviewStore = useMultiviewStore();
const appStore = useAppStore();
const favoritesStore = useFavoritesStore();
const playlistStore = usePlaylistStore();
const settingsStore = useSettingsStore();
const orgsStore = useOrgsStore();

function makeMultiOrgLabel(names: string[]) {
  if (!names || names.length === 0) return "Hololive";
  if (names.length === 1) return formatOrgDisplayName(names[0]);
  if (names.length === 2) return `${formatOrgDisplayName(names[0])} + ${formatOrgDisplayName(names[1])}`;
  return `${formatOrgDisplayName(names[0])} +${names.length - 1}`;
}

function makeMultiOrgTab(names: string[]) {
  return {
    name: "MultiOrg",
    text: makeMultiOrgLabel(names),
  };
}

function getHololiveOrg() {
  return (orgsStore.orgs || []).find((org: any) => org.name === "Hololive") || { name: "Hololive", short: "Holo" };
}

function getSingleSelectionOrg() {
  const selectedName = (appStore.selectedHomeOrgs || [])[0];
  if (selectedName) {
    return (orgsStore.orgs || []).find((org: any) => org.name === selectedName)
      || appStore.currentOrg
      || { name: selectedName, short: selectedName.slice(0, 4) };
  }
  return getHololiveOrg();
}

const initialSelectedHomeOrgs = appStore.selectedHomeOrgs || [];

const live = ref<any[]>([]);
const selectedOrg = ref<any>(
  initialSelectedHomeOrgs.length > 1
    ? makeMultiOrgTab(initialSelectedHomeOrgs)
    : getSingleSelectionOrg(),
);
const isLoading = ref(false);
const hasError = ref(false);
const tick = ref(Date.now());
const ticker = ref<ReturnType<typeof setInterval> | null>(null);
const refreshTimer = ref<ReturnType<typeof setInterval> | null>(null);
const loadRequestId = ref(0);
const tab = ref(0);
const inlineUrl = ref("");
const inlineUrlError = ref(false);
const showPlaylistMenu = ref(false);

const container = ref<HTMLElement | null>(null);
const videosBar = ref<any>(null);
const playlistMenuRoot = ref<HTMLElement | null>(null);

const activeVideos = computed(() => multiviewStore.activeVideos);
const favUpdateTick = computed(() => favoritesStore.lastLiveUpdate);
const active = computed(() => playlistStore.active);

const selectedHomeOrgs = computed(() => appStore.selectedHomeOrgs || []);

const hololiveName = computed(() => getHololiveOrg().name);

const selectedHomeOrgsForPicker = computed(() => {
  if (selectedOrg.value?.name === "MultiOrg") return selectedHomeOrgs.value;
  if (isRealOrg.value) return [selectedOrg.value.name];
  return selectedHomeOrgs.value;
});

const selectedOrgNames = computed(() => {
  if (selectedOrg.value?.name === "MultiOrg") {
    return selectedHomeOrgs.value.length
      ? selectedHomeOrgs.value
      : [appStore.currentOrg?.name || "Hololive"];
  }
  if (isRealOrg.value) return [selectedOrg.value.name];
  return [];
});

const baseFilteredLive = computed(() => {
  const filterConfig = {
    ignoreBlock: false,
    hideCollabs: shouldHideCollabs.value,
    forOrg: selectedOrgNames.value.length === 1 ? selectedOrgNames.value[0] : "none",
    hideIgnoredTopics: true,
    hidePlaceholder: props.hidePlaceholder ?? true,
    hideMissing: props.hideMissing ?? true,
    hideGroups: true,
  };
  const isTwitchPlaceholder = (v: any) => (v.type === "placeholder" && v.link?.includes("twitch.tv"));
  const isPlayable = (v: any) => (v.type === "stream" || isTwitchPlaceholder(v));
  return live.value.filter((l: any) => filterVideos(l, filterConfig) && isPlayable(l));
});

const topFilteredLive = computed(() => {
  let count = 0;
  const limitCount = baseFilteredLive.value.filter((l: any) => {
    count += 1;
    return (
      l.status === "live"
      || dayjs().isAfter(dayjs(l.start_scheduled).subtract(2, "h"))
      || (count < 8 && dayjs().isAfter(dayjs(l.start_scheduled).subtract(6, "h")))
    );
  })
    .filter((l: any) => !activeVideos.value.find((v: any) => v.id === l.id || (v.link && l.link && v.link === l.link)));

  return limitCount;
});

const isLoggedIn = computed(() => appStore.isLoggedIn);

const savedVideosList = computed(() => active.value.videos);

const shouldHideCollabs = computed(() => {
  return (selectedOrg.value?.name === "Favorites" || isRealOrg.value || isMultiOrg.value) && settingsStore.hideCollabStreams;
});

const isMultiOrg = computed(() => selectedOrg.value?.name === "MultiOrg");

const isRealOrg = computed(() => {
  return !["Favorites", "Playlist", "YouTubeURL", "TwitchURL", "MultiOrg"].includes(selectedOrg.value.name);
});

const isUrl = computed(() => {
  return ["YouTubeURL", "TwitchURL"].includes(selectedOrg.value.name);
});

const isQuickTabOrUrl = computed(() =>
  ["Favorites", "Playlist", "YouTubeURL", "TwitchURL"].includes(selectedOrg.value.name),
);
const isUrlTab = computed(() =>
  ["YouTubeURL", "TwitchURL"].includes(selectedOrg.value.name),
);

// Quick-tab constants (mirrored from OrgPanelPicker for direct selection)
const favTab = { name: "Favorites", text: "Favorites" };
const playlistTab = { name: "Playlist", text: "Playlist" };

function selectQuickTab(tab: { name: string; text: string }) {
  const currentName = selectedOrg.value?.name;
  selectedOrg.value = tab;
  if (currentName !== tab.name || live.value.length === 0 || hasError.value) {
    loadSelection(true);
  }
}

const connectedListOrgTargets = computed(() => {
  if (isMultiOrg.value) return selectedOrgNames.value;
  return isRealOrg.value ? [selectedOrg.value.name] : null;
});


watch(inlineUrl, () => {
  if (inlineUrlError.value) inlineUrlError.value = false;
});

watch(favUpdateTick, () => {
  if (selectedOrg.value.name === "Favorites") live.value = favoritesStore.live;
});

watch(() => appStore.visibilityState, () => {
  if (appStore.visibilityState === "visible") {
    loadSelection();
  }
});

watch(() => props.isActive, (nw) => {
  if (nw) loadSelection();
});

watch(selectedHomeOrgs, (newVal) => {
  if (newVal.length > 1) {
    selectedOrg.value = makeMultiOrgTab(newVal);
    loadSelection(true);
  } else if (selectedOrg.value?.name === "MultiOrg") {
    selectedOrg.value = getSingleSelectionOrg();
    loadSelection(true);
  }
});

// created
setAutoRefresh();
ticker.value = setInterval(() => {
  tick.value = Date.now();
}, 60000);

onMounted(() => {
  if (props.isActive && selectedOrg.value?.name) {
    loadSelection(true);
  }
  document.addEventListener("click", onDocClickPlaylist);
});

onBeforeUnmount(() => {
  if (ticker.value) clearInterval(ticker.value);
  if (refreshTimer.value) {
    clearInterval(refreshTimer.value);
    refreshTimer.value = null;
  }
  document.removeEventListener("click", onDocClickPlaylist);
});

function onDocClickPlaylist(e: MouseEvent) {
  if (showPlaylistMenu.value && playlistMenuRoot.value && !playlistMenuRoot.value.contains(e.target as Node)) {
    showPlaylistMenu.value = false;
  }
}

function scrollHandler(e: WheelEvent) {
  const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  if (Math.abs(delta) < 1) return;
  if (Math.abs(e.deltaY) >= Math.abs(e.deltaX) && e.cancelable) e.preventDefault();
  videosBar.value?.scrollViewportBy?.({
    left: delta,
    behavior: "auto",
  });
}

function setAutoRefresh() {
  if (refreshTimer.value) clearInterval(refreshTimer.value);
  refreshTimer.value = setInterval(() => {
    loadSelection();
  }, 2 * 60 * 1000);
}

function formatDurationLive(video: any) {
  const scheduled = dayjs(video.start_actual || video.start_scheduled);
  const secs = dayjs(scheduled).diff(dayjs()) / 1000;
  return formatDurationShort(Math.abs(secs));
}

function handleVideoClick(video: any) {
  emit("videoClicked", video);
}

function loadSelection(force?: boolean) {
  if (!props.isActive) return;
  const requestId = ++loadRequestId.value;
  hasError.value = false;
  if (selectedOrg.value.name === "YouTubeURL" || selectedOrg.value.name === "TwitchURL") {
    isLoading.value = false;
    return;
  }
  if (selectedOrg.value.name === "Favorites") {
    isLoading.value = true;
    favoritesStore.fetchLive({ minutes: 2, force }).finally(() => {
      if (requestId === loadRequestId.value && selectedOrg.value.name === "Favorites") {
        isLoading.value = false;
        live.value = favoritesStore.live;
      }
    });
    return;
  }
  if (selectedOrg.value.name === "Playlist") {
    live.value = active.value.videos;
    isLoading.value = false;
    return;
  }

  if (isMultiOrg.value) {
    isLoading.value = true;
    Promise.allSettled(selectedOrgNames.value.map((name: string) => backendApi.live({
      org: name,
      type: "placeholder,stream",
      include: "mentions,channels",
    }))).then((results) => {
      if (requestId !== loadRequestId.value) return;
      const merged: any[] = [];
      const seen = new Set();
      results.forEach((result) => {
        if (result.status !== "fulfilled") return;
        result.value.forEach((video: any) => {
          const key = video.id || video.link;
          if (seen.has(key)) return;
          seen.add(key);
          merged.push(video);
        });
      });
      merged.sort(videoTemporalComparator);
      live.value = merged;
      isLoading.value = false;
    }).catch((error) => {
      if (requestId !== loadRequestId.value) return;
      console.error(error);
      hasError.value = true;
      isLoading.value = false;
    });
    return;
  }

  isLoading.value = true;
  backendApi.live({
    org: selectedOrg.value.name,
    type: "placeholder,stream",
    include: "mentions,channels",
  }).then((liveData: any) => {
    if (requestId !== loadRequestId.value) return;
    live.value = liveData;
    isLoading.value = false;
  }).catch((error: any) => {
    if (requestId !== loadRequestId.value) return;
    console.error(error);
    hasError.value = true;
    isLoading.value = false;
  });
}

function dragVideo(ev: DragEvent, video: any) {
  ev.dataTransfer!.setData("text", `https://holodex.net/watch/${video.id}`);
  ev.dataTransfer!.setData("application/json", JSON.stringify(video));
}

function handleInlineUrl() {
  const content = getVideoIDFromUrl(inlineUrl.value);
  if (content?.id) {
    inlineUrlError.value = false;
    multiviewStore.addUrlHistory({ twitch: content.type === "twitch", url: inlineUrl.value });
    emit("videoClicked", content);
    inlineUrl.value = "";
  } else {
    inlineUrlError.value = true;
  }
}

function handlePicker(panel: any) {
  const currentName = selectedOrg.value?.name;
  const nextName = panel?.name;
  selectedOrg.value = panel;
  if (nextName && (currentName !== nextName || live.value.length === 0 || hasError.value)) {
    loadSelection(true);
  }
  if (container.value) container.value.scrollTop = 0;
}

function handleOrgApply(names: string[]) {
  const unique = [...new Set(names)].filter(Boolean);
  const fallback = getHololiveOrg();
  if (unique.length > 1) {
    appStore.setSelectedHomeOrgs(unique);
    appStore.setCurrentOrg((orgsStore.orgs || []).find((o: any) => o.name === unique[0]) || fallback);
    handlePicker(makeMultiOrgTab(unique));
  } else {
    const name = unique[0] || fallback.name;
    const org = (orgsStore.orgs || []).find((o: any) => o.name === name) || fallback;
    appStore.setSelectedHomeOrgs([org.name]);
    appStore.setCurrentOrg(org);
    handlePicker(org);
  }
}
</script>

<style scoped>
.favorites-login-button {
    color: #f8fafc !important;
}

.mv-quick-btn {
    transition: background-color 150ms ease, color 150ms ease, border-color 150ms ease, transform 150ms ease;
}

.mv-quick-btn:hover {
    transform: translateY(-1px);
}

.mv-quick-btn:active {
    transform: translateY(0) scale(0.96);
}

.mv-avatar-badge {
    border-color: rgba(2, 6, 23, 0.9);
    background: rgba(2, 6, 23, 0.95);
    color: #f8fafc;
}

:global(html[data-theme="light"] .mv-avatar-badge) {
    border-color: var(--color-border);
    background: color-mix(in srgb, var(--surface-elevated) 92%, white 8%);
    color: var(--color-foreground);
    box-shadow: 0 8px 18px rgb(148 163 184 / 0.24);
}
</style>

<style>
.video-list {
    flex: 1 1 auto;
    min-height: 0px;
    overflow-y: auto;
}

.refresh-spin {
    animation: spin 1.1s infinite linear;
}

.videos-bar {
    padding: 0 6px 0 2px;
}

.videos-strip {
    overflow: hidden;
    height: 52px;
}

.videos-strip.compact {
    height: 40px;
}

.mv-video-scroll {
    position: relative;
    overflow: hidden;
    height: 52px;
}

.mv-video-scroll-compact {
    min-width: 0;
    height: 40px;
}

.mv-video-scroll-vp {
    height: 49px;
    width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
}

.mv-video-scroll-compact .mv-video-scroll-vp,
.mv-video-scroll-compact .scroll-area-viewport {
    height: 40px;
}

.mv-video-scroll > div:last-child:not(.scroll-area-viewport) {
    left: 0;
    right: 0;
    bottom: 0;
    height: 3px;
    border-radius: 0;
    background: rgb(255 255 255 / 0.10);
}

.mv-video-scroll > div:last-child:not(.scroll-area-viewport) > div {
    border-radius: 0;
    background: rgb(255 255 255 / 0.34);
}
</style>
