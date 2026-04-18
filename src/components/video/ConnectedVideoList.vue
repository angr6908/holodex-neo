<template>
  <div
    v-show="
      !(isFavPage && !(isLoggedIn && favoriteChannelIDs.size > 0))
    "
  >
    <div v-show="!isMobile" class="m-0 pb-0 pt-0">
      <Teleport
        v-if="teleportReady && !isMobile"
        :to="`#${portalName}`"
      >
        <div class="absolute top-0 right-0">
          <UiButton
            type="button"
            variant="ghost"
            size="icon"
            class-name="h-8 w-8"
            @click="toggleDisplayMode"
          >
            <UiIcon :icon="displayIcon" />
          </UiButton>
        </div>
        <div class="flex min-h-0 flex-1 flex-col gap-3">
          <div
            v-if="tab === Tabs.LIVE_UPCOMING"
            class="flex flex-col gap-[0.45rem]"
          >
            <span class="filter-panel-label">Sort By</span>
            <div class="inline-flex w-fit items-center gap-1 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-0.5">
              <button
                v-for="opt in sortOptions"
                :key="opt.value"
                type="button"
                class="cursor-pointer rounded-lg px-2.5 py-1.5 text-[0.8rem] font-medium transition"
                :class="sortBy === opt.value ? 'bg-[color:var(--color-bold)] text-white' : 'text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]'"
                @click="sortBy = opt.value"
              >
                {{ opt.text }}
              </button>
            </div>
          </div>
          <div
            v-if="tab !== Tabs.LIVE_UPCOMING && isActive"
            class="flex flex-col gap-[0.45rem]"
          >
            <span class="filter-panel-label">Uploaded Before</span>
            <div class="filter-panel-datepicker">
              <DatePicker
                :model-value="toDate ?? ''"
                placeholder="Pick a date"
                @update:model-value="toDate = $event || null"
              />
            </div>
          </div>
          <div v-if="tab === Tabs.CLIPS && isActive" class="filter-panel-filters">
            <SelectCard title="Clip Languages">
              <div class="select-card-chip-flow">
                <label
                  v-for="lang in TL_LANGS"
                  :key="`${lang.value}-clip`"
                  class="stream-check-chip"
                  :class="{ 'stream-check-chip-selected': clipLangs.includes(lang.value) }"
                >
                  <input
                    :checked="clipLangs.includes(lang.value)"
                    type="checkbox"
                    class="peer sr-only"
                    @change="toggleClipLang(lang.value, ($event.target as HTMLInputElement).checked)"
                  >
                  <span class="stream-check-chip-indicator" />
                  <span>{{ lang.text }}</span>
                </label>
              </div>
            </SelectCard>
          </div>
          <video-list-filters v-if="tab !== Tabs.CLIPS" class="filter-panel-filters" :show-descriptions="false" :compact="true" />
        </div>
      </Teleport>
    </div>
    <template v-if="tab === Tabs.LIVE_UPCOMING">
      <template v-if="hasError">
        <div class="m-auto p-5 text-center text-red-400">
          {{ $t("views.home.apiError") || "Failed to load live data. Please try again." }}
        </div>
      </template>
      <template v-else>
        <SkeletonCardList
        v-if="showLiveLoading"
        :cols="colSizes"
        :dense="currentGridSize > 0"
        :dense-list="homeViewMode === 'denseList'"
        :horizontal="homeViewMode === 'list'"
      />
      <div v-if="lives.length || upcoming.length">
        <VideoCardList
          v-bind="$attrs"
          :videos="homeViewMode === 'grid' ? lives : live"
          include-channel
          :include-avatar="shouldIncludeAvatar"
          :cols="colSizes"
          :dense="currentGridSize > 0"
          :filter-config="filterConfig"
          :dense-list="homeViewMode === 'denseList'"
          :horizontal="homeViewMode === 'list'"
          :in-multi-view-selector="inMultiViewSelector"
          :fade-under-nav-ext="false"
        />
        <template v-if="homeViewMode === 'grid'">
          <div v-if="lives.length" class="my-3 h-px bg-[color:var(--color-border)]" />
          <VideoCardList
            v-bind="$attrs"
            :videos="upcoming"
            include-channel
            :include-avatar="shouldIncludeAvatar"
            :cols="colSizes"
            :dense="currentGridSize > 0"
            :filter-config="filterConfig"
            :dense-list="homeViewMode === 'denseList'"
            :horizontal="homeViewMode === 'list'"
            :in-multi-view-selector="inMultiViewSelector"
            :fade-under-nav-ext="false"
          />
        </template>
      </div>
      <div
        v-show="!showLiveLoading && lives.length == 0 && upcoming.length == 0"
        class="m-auto p-5 text-center"
      >
        {{ $t("views.home.noStreams") }}
      </div>
      </template>
    </template>

    <template v-else>
      <generic-list-loader
        v-slot="{ data, isLoading: lod }"
        :key="loaderCacheKey"
        :cache-key="loaderCacheKey"
        :infinite-load="scrollMode"
        :paginate="!scrollMode"
        :per-page="pageLength"
        :load-fn="getLoadFn()"
      >
        <!-- Loading overlay for paginate-mode page transitions (prev page data exists) -->
        <div v-if="lod && data.length > 0 && !scrollMode" class="relative pointer-events-none">
          <div class="absolute inset-0 z-10 flex items-center justify-center" style="background: rgba(var(--background-rgb, 2 6 23) / 0.35); backdrop-filter: blur(2px); border-radius: 1rem; min-height: 8rem;">
            <div class="loading-spinner-sm" aria-hidden="true" />
          </div>
        </div>
        <!-- only keep VideoCardList rendered if scrollMode OR it's not loading. -->
        <VideoCardList
          v-show="scrollMode || data.length > 0 || !lod"
          v-bind="$attrs"
          :videos="data"
          include-channel
          :include-avatar="shouldIncludeAvatar"
          :cols="colSizes"
          :dense="currentGridSize > 0"
          :filter-config="filterConfig"
          :dense-list="homeViewMode === 'denseList'"
          :horizontal="homeViewMode === 'list'"
          :in-multi-view-selector="inMultiViewSelector"
          :fade-under-nav-ext="false"
        />
        <!-- only show SkeletonCardList if it's loading and no previous data -->
        <SkeletonCardList
          v-if="lod && data.length === 0"
          :cols="colSizes"
          :dense="currentGridSize > 0"
          :dense-list="homeViewMode === 'denseList'"
          :horizontal="homeViewMode === 'list'"
        />
      </generic-list-loader>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import backendApi from "@/utils/backend-api";
import { TL_LANGS } from "@/utils/consts";

import GenericListLoader from "@/components/video/GenericListLoader.vue";
import SkeletonCardList from "@/components/video/SkeletonCardList.vue";
import VideoCardList from "@/components/video/VideoCardList.vue";
import { getLiveViewerCount, videoTemporalComparator } from "@/utils/functions";
import { dayjs } from "@/utils/time";
import {
  mdiFormatListBulleted,
  mdiViewList,
} from "@mdi/js";
import { mdiViewGrid, mdiViewComfy, mdiViewModule } from "@/utils/icons";
import { useSettingsStore } from "@/stores/settings";
import { useHomeStore } from "@/stores/home";
import { useFavoritesStore } from "@/stores/favorites";
import { useAppStore } from "@/stores/app";
import {
  fetchTwitchViewerCounts,
  getTwitchLogin,
  getTwitchViewerCountFingerprint,
  mergeTwitchViewerCountsIntoVideos,
  readCachedTwitchViewerCounts,
} from "@/utils/twitch";
import VideoListFilters from "../setting/VideoListFilters.vue";
import SelectCard from "@/components/setting/SelectCard.vue";
import UiButton from "@/components/ui/button/Button.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import UiSelect from "@/components/ui/select/Select.vue";
import DatePicker from "@/components/ui/date-picker/DatePicker.vue";

defineOptions({ name: "ConnectedVideoList" });

function nearestUTCDate(date: any) {
  return date.add(1, "day").toDate().toISOString();
}

function dedupeVideos(videos: any[]) {
  return Array.from(new Map(videos.map((video) => [video.id, video])).values());
}

function extractVideoItems(payload: any) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  return Object.values(payload).find((value) => Array.isArray(value)) as any[] || [];
}

function videoTemporalComparatorDesc(a: any, b: any) {
  return videoTemporalComparator(b, a);
}

const props = withDefaults(defineProps<{
  liveContent?: any[] | null;
  isFavPage?: boolean;
  tab?: number;
  isActive?: boolean;
  datePortalName?: string;
  inMultiViewSelector?: boolean;
  orgTargetsOverride?: any[] | null;
}>(), {
  liveContent: null,
  isFavPage: false,
  tab: 0,
  isActive: true,
  datePortalName: "",
  inMultiViewSelector: undefined,
  orgTargetsOverride: null,
});

const route = useRoute();
const router = useRouter();

const pageLength = ref(24);
const Tabs = Object.freeze({ LIVE_UPCOMING: 0, ARCHIVE: 1, CLIPS: 2 });
const toDate = ref<string | null>(null);
const sortBy = ref("viewers");
const sortOptions = [
  { text: "Viewers", value: "viewers" },
  { text: "Latest", value: "latest" },
];

const settingsStore = useSettingsStore();
const homeStore = useHomeStore();
const favoritesStore = useFavoritesStore();
const appStore = useAppStore();

const clipLangs = computed(() => settingsStore.clipLangs);
function toggleClipLang(value: string, checked: boolean) {
  const next = new Set(clipLangs.value);
  if (checked) next.add(value);
  else next.delete(value);
  settingsStore.setClipLangs([...next].sort());
}

// Per-key cache for multi-org fetches: avoids re-fetching on every page change.
// Keyed by loaderCacheKey so it auto-invalidates when filters / orgs / tab change.
// Two tiers: 'page1' resolves after first pages (fast), 'full' after page-2 fetches.
interface MultiOrgCache {
  page1: Promise<any[]>;
  full: Promise<any[]>;
}
const multiOrgDataCache = new Map<string, MultiOrgCache>();

const homeViewMode = computed({
  get: () => settingsStore.homeViewMode,
  set: (v: string) => { settingsStore.homeViewMode = v; },
});

const favoriteChannelIDs = computed(() => favoritesStore.favoriteChannelIDs);
const isLoggedIn = computed(() => appStore.isLoggedIn);
const twitchViewerCounts = ref<Record<string, number>>({});
let twitchRefreshTimer: ReturnType<typeof setInterval> | null = null;

function getLiveSourceList() {
  return ((props.liveContent?.length && props.liveContent)
    || (props.isFavPage ? favoritesStore.live : homeStore.live)) as any[];
}

function getLiveTwitchLogins(videos: any[]) {
  return [...new Set(
    (videos || [])
      .filter((video: any) => video?.status === "live")
      .map((video: any) => getTwitchLogin(video))
      .filter((login): login is string => !!login),
  )];
}

async function refreshTwitchViewerCounts() {
  if (!props.isActive) return;
  if (props.tab !== Tabs.LIVE_UPCOMING) return;

  const source = getLiveSourceList();
  const logins = getLiveTwitchLogins(source);

  if (logins.length === 0) {
    if (Object.keys(twitchViewerCounts.value).length > 0) {
      twitchViewerCounts.value = {};
    }
    return;
  }

  const counts = await fetchTwitchViewerCounts(logins);
  if (
    getTwitchViewerCountFingerprint(counts)
    !== getTwitchViewerCountFingerprint(twitchViewerCounts.value)
  ) {
    twitchViewerCounts.value = counts;
  }
}

function stopTwitchViewerRefresh() {
  if (!twitchRefreshTimer) return;
  clearInterval(twitchRefreshTimer);
  twitchRefreshTimer = null;
}

function ensureTwitchViewerRefresh() {
  stopTwitchViewerRefresh();
  if (!props.isActive || props.tab !== Tabs.LIVE_UPCOMING) return;
  const cached = readCachedTwitchViewerCounts(getLiveTwitchLogins(getLiveSourceList()));
  if (
    getTwitchViewerCountFingerprint(cached)
    !== getTwitchViewerCountFingerprint(twitchViewerCounts.value)
  ) {
    twitchViewerCounts.value = cached;
  }
  refreshTwitchViewerCounts();
  twitchRefreshTimer = setInterval(() => {
    refreshTwitchViewerCounts();
  }, 60_000);
}

const live = computed(() => {
  let liveList = getLiveSourceList();
  liveList = mergeTwitchViewerCountsIntoVideos(liveList, twitchViewerCounts.value);
  if (sortBy.value === "viewers") {
    liveList = [...liveList].sort((a, b) => getLiveViewerCount(b) - getLiveViewerCount(a));
  }
  return liveList;
});

const waitingForTwitchViewerCounts = computed(() => {
  if (props.tab !== Tabs.LIVE_UPCOMING || sortBy.value !== "viewers") return false;
  return getLiveSourceList()
    .some((video: any) => video?.status === "live" && !!getTwitchLogin(video) && getLiveViewerCount(video) <= 0
      && twitchViewerCounts.value[getTwitchLogin(video)!] === undefined);
});

const isLoading = computed(() => props.isFavPage ? favoritesStore.isLoading : homeStore.isLoading);
const hasError = computed(() => props.isFavPage ? favoritesStore.hasError : homeStore.hasError);
const showLiveLoading = computed(() => isLoading.value || waitingForTwitchViewerCounts.value);

const scrollMode = computed(() => settingsStore.scrollMode);

const currentGridSize = computed({
  get: () => appStore.currentGridSize,
  set: (val: number) => { appStore.setCurrentGridSize(val); },
});

const colSizes = computed(() => ({
  xs: 1 + currentGridSize.value,
  sm: 2 + currentGridSize.value,
  md: 3 + currentGridSize.value,
  lg: 4 + currentGridSize.value,
  xl: 5 + currentGridSize.value,
}));

const breakpointName = computed(() => {
  const width = appStore.windowWidth || window.innerWidth;
  if (width < 600) return "xs";
  if (width < 960) return "sm";
  if (width < 1264) return "md";
  if (width < 1904) return "lg";
  return "xl";
});

const shouldIncludeAvatar = computed(() => {
  if (breakpointName.value === "md" && currentGridSize.value > 1) return false;
  if (breakpointName.value === "sm" && currentGridSize.value > 0) return false;
  if (breakpointName.value === "xs" && currentGridSize.value > 0) return false;
  return true;
});

const activeHomeOrgNames = computed(() =>
  props.isFavPage ? [] : (appStore.selectedHomeOrgs || []),
);

const shouldHideCollabs = computed(() =>
  props.tab !== Tabs.CLIPS
  && settingsStore.hideCollabStreams
  && (props.isFavPage ? true : activeHomeOrgNames.value.length > 0),
);

const resolvedOrgTargets = computed(() => {
  if (props.orgTargetsOverride?.length) return props.orgTargetsOverride;
  return activeHomeOrgNames.value.length ? activeHomeOrgNames.value : ["All Vtubers"];
});

const filterOrg = computed(() => {
  if (props.isFavPage) return "none";
  return resolvedOrgTargets.value.length > 1
    ? "All Vtubers"
    : (resolvedOrgTargets.value[0] || appStore.currentOrg.name);
});

const lives = computed(() => live.value.filter((v: any) => v.status === "live"));

const upcoming = computed(() => {
  const up = live.value.filter((v: any) => v.status === "upcoming");
  up.sort((v1: any, v2: any) => {
    if (v1.available_at !== v2.available_at) return 0;
    const v1IsPlaceholder = v1.type === "placeholder";
    const v2IsPlaceholder = v2.type === "placeholder";
    if (v1IsPlaceholder && v2IsPlaceholder) return 0;
    return v1IsPlaceholder ? 1 : -1;
  });
  return up;
});

const portalName = computed(() =>
  props.datePortalName || `date-selector${props.isFavPage}`,
);

// Delay teleport activation by one tick so HomeFave's portal target has time to render.
const teleportReady = ref(false);
watch(() => props.isActive, async (active) => {
  if (!active) { teleportReady.value = false; return; }
  await nextTick();
  teleportReady.value = true;
}, { immediate: true });

const filterConfig = computed(() => ({
  forOrg: filterOrg.value,
  hideCollabs: shouldHideCollabs.value,
  hidePlaceholder: settingsStore.hidePlaceholder,
  hideMissing: settingsStore.hideMissing,
}));

const displayIcon = computed(() => {
  switch (true) {
    case homeViewMode.value === "list":
      return mdiFormatListBulleted;
    case homeViewMode.value === "denseList":
      return mdiViewGrid;
    case currentGridSize.value === 1:
      return mdiViewComfy;
    case currentGridSize.value === 2:
      return mdiViewList;
    default:
      return mdiViewModule;
  }
});

const isMobile = computed(() => appStore.isMobile);

const selectedHomeOrgsKey = computed(() =>
  JSON.stringify(appStore.selectedHomeOrgs || []),
);
const orgTargetsOverrideKey = computed(() =>
  JSON.stringify(props.orgTargetsOverride || []),
);
const clipLangsKey = computed(() =>
  JSON.stringify(settingsStore.clipLangs || []),
);
const loaderCacheKey = computed(() => [
  "vlx",
  props.isFavPage ? "fav" : "home",
  props.tab,
  scrollMode.value ? "scroll" : "page",
  selectedHomeOrgsKey.value,
  orgTargetsOverrideKey.value,
  toDate.value || "",
  clipLangsKey.value,
].join("-"));

watch(selectedHomeOrgsKey, () => {
  if (!props.isActive) return;
  if (props.isFavPage) return;
  // Invalidate multi-org cache when org selection changes
  multiOrgDataCache.clear();
  if (props.tab === Tabs.LIVE_UPCOMING) init(false);
});

watch(() => props.tab, (newTab, oldTab) => {
  if (!props.isActive) return;
  if (newTab !== oldTab && newTab === Tabs.LIVE_UPCOMING) init(false);
  ensureTwitchViewerRefresh();
});

watch(scrollMode, (newValue, oldValue) => {
  if (!props.isActive || newValue === oldValue) return;
  syncRouteWithScrollMode(newValue);
});

watch(
  [
    () => props.isActive,
    () => props.isFavPage,
    () => props.liveContent,
    () => homeStore.live,
    () => favoritesStore.live,
  ],
  () => {
    ensureTwitchViewerRefresh();
  },
  { deep: true },
);

// Equivalent to created()
init(true);
ensureTwitchViewerRefresh();

// Eagerly prefetch archive & clips data for multi-org so tab switches are instant.
// Starts immediately in parallel with live fetch — concurrency pool handles rate limiting.
{
  const orgs = resolvedOrgTargets.value;
  if (orgs.length > 1 && !props.isFavPage) {
    for (const tabVal of [Tabs.ARCHIVE, Tabs.CLIPS]) {
      const key = cacheKeyForTab(tabVal);
      startMultiOrgFetch(key, buildTabQuery(tabVal), orgs);
    }
  }
}

function toggleDisplayMode() {
  const viewModes = ["grid", "list", "denseList"];
  const nextViewMode = viewModes[
    (viewModes.indexOf(homeViewMode.value) + 1) % viewModes.length
  ];
  if (homeViewMode.value === "grid" && currentGridSize.value < 2) {
    currentGridSize.value += 1;
  } else {
    homeViewMode.value = nextViewMode;
    currentGridSize.value = 0;
  }
}

function init(updateFavorites: boolean) {
  if (props.isFavPage) {
    if (updateFavorites) favoritesStore.fetchFavorites();
    if (favoriteChannelIDs.value.size > 0 && isLoggedIn.value) {
      favoritesStore.fetchLive({
        force: updateFavorites || live.value.length === 0,
        minutes: 2,
      });
    }
  } else if (!props.liveContent?.length) {
    homeStore.fetchLive({
      force: live.value.length === 0,
      minutes: 2,
    });
  }
}

function reload() {
  init(false);
  refreshTwitchViewerCounts();
}

function syncRouteWithScrollMode(isScrollMode: boolean) {
  if (!isScrollMode || !route.query.page) return;
  const nextQuery = { ...route.query };
  delete (nextQuery as any).page;
  router.replace({
    path: route.path,
    query: nextQuery,
    hash: route.hash,
  }).catch(() => {});
}

onBeforeUnmount(() => {
  stopTwitchViewerRefresh();
});

const API_MAX_LIMIT = 100;

/** Build the API query object for a given tab value */
function buildTabQuery(tabValue: number): Record<string, any> {
  const inclusion = ({
    [Tabs.ARCHIVE]: "mentions,clips",
    [Tabs.LIVE_UPCOMING]: "mentions",
    [Tabs.CLIPS]: "mentions",
  } as Record<number, string>)[tabValue] ?? "";

  return {
    status: tabValue === Tabs.ARCHIVE ? "past,missing" : "past",
    type: tabValue === Tabs.ARCHIVE ? "stream" : "clip",
    include: inclusion,
    lang: settingsStore.clipLangs.join(","),
    paginated: false,
    ...(toDate.value && {
      to: nearestUTCDate(dayjs(toDate.value ?? undefined)),
    }),
    max_upcoming_hours: 1,
  };
}

/** Compute the cache key for a given tab */
function cacheKeyForTab(tabValue: number): string {
  return [
    "vlx",
    props.isFavPage ? "fav" : "home",
    tabValue,
    scrollMode.value ? "scroll" : "page",
    selectedHomeOrgsKey.value,
    orgTargetsOverrideKey.value,
    toDate.value || "",
    clipLangsKey.value,
  ].join("-");
}

/** Start multi-org fetch for a given cache key + query + orgs. No-ops if already cached. */
function startMultiOrgFetch(cacheKey: string, query: Record<string, any>, orgTargets: string[]) {
  if (multiOrgDataCache.has(cacheKey)) return;

  const baseQuery = { ...query, paginated: false };

  const orgPage1Promises = orgTargets.map((org) =>
    backendApi
      .videos({ ...baseQuery, org, limit: API_MAX_LIMIT, offset: 0 })
      .then((res: any) => extractVideoItems(res.data))
      .catch(() => [] as any[]),
  );

  const page1Promise = Promise.all(orgPage1Promises).then((page1Items) => {
    const merged = dedupeVideos(page1Items.flat());
    merged.sort(videoTemporalComparatorDesc);
    return merged;
  });

  const fullPromise = Promise.all(orgPage1Promises).then(async (page1Items) => {
    const needsPage2 = orgTargets
      .map((org, i) => ({ org, index: i }))
      .filter(({ index }) => page1Items[index].length >= API_MAX_LIMIT);

    let page2Flat: any[] = [];
    if (needsPage2.length > 0) {
      const page2Results = await Promise.allSettled(
        needsPage2.map(({ org }) =>
          backendApi.videos({ ...baseQuery, org, limit: API_MAX_LIMIT, offset: API_MAX_LIMIT }),
        ),
      );
      page2Flat = page2Results.flatMap((r) =>
        r.status === "fulfilled" ? extractVideoItems(r.value.data) : [],
      );
    }

    if (page2Flat.length === 0) {
      const merged = dedupeVideos(page1Items.flat());
      merged.sort(videoTemporalComparatorDesc);
      return merged;
    }

    const allItems = page1Items.flat().concat(page2Flat);
    const merged = dedupeVideos(allItems);
    merged.sort(videoTemporalComparatorDesc);
    return merged;
  });

  multiOrgDataCache.set(cacheKey, { page1: page1Promise, full: fullPromise });
}

/** Eagerly prefetch archive & clips data so tab switches are instant */
function prefetchOtherTabs(orgTargets: string[]) {
  if (props.isFavPage) return;
  for (const otherTab of [Tabs.ARCHIVE, Tabs.CLIPS]) {
    if (otherTab === props.tab) continue;
    const key = cacheKeyForTab(otherTab);
    if (multiOrgDataCache.has(key)) continue;
    startMultiOrgFetch(key, buildTabQuery(otherTab), orgTargets);
  }
}

function getLoadFn() {
  const query = buildTabQuery(props.tab);
  // Restore paginated flag for server-side pagination (buildTabQuery always sets false)
  query.paginated = !scrollMode.value;

  if (props.isFavPage) {
    return async (offset: number, limit: number) => {
      const res = await backendApi
        .favoritesVideos(appStore.userdata.jwt, { ...query, limit, offset })
        .catch((err: any) => {
          console.error(err);
          appStore.loginVerify({ bounceToLogin: true });
          throw err;
        });
      return res.data;
    };
  }

  const orgTargets = resolvedOrgTargets.value;

  if (orgTargets.length === 1) {
    // Single-org: delegate pagination to the server (fast path).
    return async (offset: number, limit: number) => {
      const res = await backendApi.videos({ ...query, org: orgTargets[0], limit, offset });
      return res.data;
    };
  }

  // ── Multi-org path ────────────────────────────────────────────────────────
  // Two-tier cache: page1 resolves fast (one request per org in parallel),
  // full resolves after page-2 fetches (only for orgs with 100+ results).
  // Fetch starts EAGERLY here — before InfiniteLoad/PaginateLoad even mount.
  const cacheKey = loaderCacheKey.value;
  startMultiOrgFetch(cacheKey, query, orgTargets);

  // Prefetch other tabs (archive / clips) in background so tab switching is instant
  prefetchOtherTabs(orgTargets);

  const cached = multiOrgDataCache.get(cacheKey)!;
  const page1Threshold = API_MAX_LIMIT * orgTargets.length;

  return async (offset: number, limit: number) => {
    // Use page-1 data for early pages (fast), full data for deep scrolling
    const all = (offset + limit <= page1Threshold)
      ? await cached.page1
      : await cached.full;

    const slice = all.slice(offset, offset + limit);
    if (!scrollMode.value) {
      // Paginate mode: try to use full data total if ready, else page1 total
      const fullData = await Promise.race([
        cached.full.then((d: any[]) => d),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 0)),
      ]);
      const total = fullData ? fullData.length : all.length;
      return { items: slice, total };
    }
    // Scroll mode: return plain array; GenericListLoader signals "completed" when empty.
    return slice;
  };
}

defineExpose({ init, reload });
</script>

<style>
.loading-spinner-sm {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 999px;
  border: 2px solid color-mix(in srgb, var(--color-border) 85%, transparent);
  border-top-color: var(--color-primary);
  animation: cv-spinner 0.8s linear infinite;
}

@keyframes cv-spinner {
  to { transform: rotate(360deg); }
}
</style>

<style scoped>
/* Match select-card-title style */
.filter-panel-label {
  font-size: 0.68rem;
  font-weight: 400;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--color-muted-foreground);
}

/* Strip SelectCard chrome and unify title color with other labels */
.filter-panel-filters :deep(.select-card) {
  border: 0 !important;
  background: transparent !important;
  padding: 0 !important;
  border-radius: 0;
}
.filter-panel-filters :deep(.select-card-title) {
  color: var(--color-muted-foreground);
}

/* Flex growth chain: blocked topics scroll area fills remaining aside space */
.filter-panel-filters {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.filter-panel-filters :deep(.select-card:last-child) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.filter-panel-filters :deep(.select-card:last-child > *) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.filter-panel-filters :deep(:has(> .scroll-area-viewport-native)) {
  height: auto !important;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.filter-panel-filters :deep(.scroll-area-viewport-native) {
  height: 100% !important;
  max-height: none;
}

/* Make grid layout single-column to match tab button list */
.filter-panel-filters :deep(.stream-check-grid) {
  display: flex !important;
  flex-direction: column;
  gap: 0.25rem;
}
</style>
