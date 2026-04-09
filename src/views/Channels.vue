<template>
  <section
    class="flex min-h-[70vh] flex-col"
    @touchstart.passive="handleTouchStart"
    @touchend.passive="handleTouchEnd"
  >
    <Teleport to="#mainNavExt" :disabled="!isActive">
      <div v-if="isActive" class="channels-tab-stack">
        <div class="channels-tab-cover channels-tab-cover-top" aria-hidden="true" />
        <div class="channels-tab-cover channels-tab-cover-left" aria-hidden="true" />
        <div class="channels-tab-cover channels-tab-cover-right" aria-hidden="true" />
        <div
          class="channels-tabs relative z-1 flex w-full items-center gap-2 overflow-visible rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--surface-nav)] px-2 py-1.5 backdrop-blur-xl"
        >
        <!-- Category tabs (left-aligned, fill available space) -->
        <div class="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto overflow-y-visible">
          <button
            v-for="tab in tabOptions"
            :key="tab.value"
            type="button"
            class="cursor-pointer rounded-xl px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors sm:text-sm"
            :class="category === tab.value ? 'bg-[color:var(--color-bold)] text-white' : 'text-[color:var(--color-muted-foreground)] hover:bg-white/8 hover:text-[color:var(--color-foreground)]'"
            @click="category = tab.value"
          >
            {{ tab.label }}
          </button>
        </div>

        <!-- Sort + grid toggle (right-aligned, only when not blocked) -->
        <div v-if="category !== Tabs.BLOCKED" class="ml-auto flex shrink-0 items-center gap-1 pl-2">
          <UiSelect
            v-model="sort"
            :options="sortOptions"
            label-key="text"
            value-key="value"
            class-name="h-8 text-sm"
            :fluid="false"
          />
          <span
            class="inline-flex items-center text-xs text-[color:var(--color-muted-foreground)] opacity-40"
            :class="{ 'rotate-asc': currentSortValue.query_value.order === 'asc' }"
          >
            <UiIcon :icon="mdiArrowDown" class-name="h-4 w-4" />
          </span>
          <UiButton
            type="button"
            variant="ghost"
            size="icon"
            class-name="h-8 w-8"
            @click="cardView = !cardView"
          >
            <UiIcon :icon="cardView ? mdiViewModule : mdiViewList" />
          </UiButton>
        </div>
        </div>
      </div>
    </Teleport>

    <div>

      <!-- Static channel list with no loading for locally stored blocked/favorites list -->
      <ChannelList
        v-if="category === Tabs.BLOCKED || category === Tabs.FAVORITES"
        :channels="channelList"
        include-video-count
        :grouped="currentSortValue.value === 'group' || currentSortValue.value === 'org'"
        :group-key="groupKey"
        :card-view="cardView"
        :show-delete="category === Tabs.BLOCKED"
      />
      <!-- API retrieved channels list -->
      <generic-list-loader
        v-else
        v-slot="{ data, isLoading: lod }"
        :key="`channel-list-${category}-${identifier}`"
        infinite-load
        :per-page="category === Tabs.VTUBER ? 100 : 25"
        :load-fn="getLoadFn()"
      >
        <ChannelList
          :channels="data"
          :loading="lod && data.length === 0"
          include-video-count
          :grouped="currentSortValue.value === 'group' || currentSortValue.value === 'org'"
          :group-key="groupKey"
          :card-view="cardView"
          :show-delete="category === Tabs.SUBBER"
        />
      </generic-list-loader>
    </div>
    <!-- Favorites specific view items: -->
    <template v-if="category === Tabs.FAVORITES">
      <div v-if="!favorites || favorites.length === 0" class="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <UiIcon :icon="mdiHeartOutline" class-name="h-12 w-12 text-[color:var(--color-muted-foreground)] opacity-40" />
        <p class="text-sm text-[color:var(--color-muted-foreground)]">
          {{ $t("views.channels.favoritesAreEmpty") }}
        </p>
      </div>
    </template>
    <!-- Blocked list specific view items -->
    <template v-if="category === Tabs.BLOCKED">
      <div v-if="!blockedChannels || blockedChannels.length === 0" class="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <UiIcon :icon="mdiAccountOff" class-name="h-12 w-12 text-[color:var(--color-muted-foreground)] opacity-40" />
        <p class="text-sm text-[color:var(--color-muted-foreground)]">
          {{ $t("views.channels.blockedAreEmpty") }}
        </p>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import ChannelList from "@/components/channel/ChannelList.vue";
import GenericListLoader from "@/components/video/GenericListLoader.vue";
import UiButton from "@/components/ui/button/Button.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import UiSelect from "@/components/ui/select/Select.vue";
import api from "@/utils/backend-api";
import { CHANNEL_TYPES } from "@/utils/consts";
import { localSortChannels } from "@/utils/functions";
import { mdiArrowDown, mdiViewList, mdiViewModule } from "@mdi/js";
import { mdiHeartOutline, mdiAccountOff } from "@mdi/js";
import { useAppStore } from "@/stores/app";
import { useSettingsStore } from "@/stores/settings";
import { useFavoritesStore } from "@/stores/favorites";
import { useChannelsStore } from "@/stores/channels";
import { useMetaTitle } from "@/composables/useMetaTitle";
import { useReloadable } from "@/composables/useReloadable";
import { useIsActive } from "@/composables/useIsActive";

const { t } = useI18n();

const appStore = useAppStore();
const settingsStore = useSettingsStore();
const favoritesStore = useFavoritesStore();
const channelsStore = useChannelsStore();

const { favorites } = storeToRefs(favoritesStore);
const { blockedChannels } = storeToRefs(settingsStore);

const identifier = ref(+new Date());
const touchStartX = ref<number | null>(null);

const Tabs = Object.freeze({
  VTUBER: 0,
  SUBBER: 1,
  FAVORITES: 2,
  BLOCKED: 3,
});

const defaultSort = "subscribers";

// Meta title
useMetaTitle(() => `${t("component.mainNav.channels")} - Holodex`);

// Composables
const { isActive } = useIsActive();
useReloadable(reload);

// ── Org mode helpers ──
// "All Vtubers" → selectedHomeOrgs is [] or currentOrg.name is "All Vtubers"
// Multi-org     → selectedHomeOrgs.length > 1
// Single org    → selectedHomeOrgs.length === 1 (and not "All Vtubers")

const selectedOrgs = computed(() => appStore.selectedHomeOrgs || []);

const isMultiOrg = computed(() => selectedOrgs.value.length > 1);

const isAllVtubers = computed(() =>
  appStore.currentOrg.name === "All Vtubers"
  || (selectedOrgs.value.length === 0),
);

// True when a single specific org is selected (not "All Vtubers", not multi)
const isSingleOrg = computed(() =>
  !isAllVtubers.value && !isMultiOrg.value,
);

// For grouping: single org → group by sub-group; multi/all → group by org
const groupKey = computed(() => isSingleOrg.value ? "group" : "org");

// Writable computed for store-backed state
const category = computed({
  get: () => channelsStore.category,
  set: (val: number) => channelsStore.setCategory(val),
});

const sort = computed({
  get: () => channelsStore.sort[category.value],
  set: (val: string) => {
    if (findSortValue(val)) {
      channelsStore.setSort(val);
    } else {
      channelsStore.setSort(defaultSort);
    }
  },
});

const cardView = computed({
  get: () => channelsStore.cardView[category.value],
  set: (val: boolean) => channelsStore.setCardView(val),
});

const sortOptions = computed(() => [
  {
    text: t("views.channels.sortOptions.subscribers"),
    value: "subscribers",
    query_value: {
      sort: "subscriber_count",
      order: "desc",
    },
  },
  // Single org: "Group" sorts by suborg (sub-groups within the org)
  ...((category.value === Tabs.VTUBER || category.value === Tabs.FAVORITES)
    && isSingleOrg.value
    ? [
      {
        text: t("views.channels.sortOptions.group"),
        value: "group",
        query_value: {
          sort: "suborg",
          order: "asc",
        },
      },
    ]
    : []),
  // Multi-org or All Vtubers: "Org" sorts by org, with group order within each org
  ...((isMultiOrg.value || isAllVtubers.value)
    ? [
      {
        text: t("views.channels.sortOptions.org"),
        value: "org",
        query_value: {
          sort: "suborg",
          order: "asc",
          // Flag: after fetching, stable-group by org to cluster orgs together
          groupByOrg: true,
        },
      },
    ]
    : []),
  {
    text: t("views.channels.sortOptions.videoCount"),
    value: "video_count",
    query_value: {
      sort: "video_count",
      order: "desc",
    },
  },
  ...(category.value === Tabs.VTUBER || category.value === Tabs.FAVORITES
    ? [
      {
        text: t("views.channels.sortOptions.clipCount"),
        value: "clip_count",
        query_value: {
          sort: "clip_count",
          order: "desc",
        },
      },
    ]
    : []),
  ...(category.value === Tabs.VTUBER || category.value === Tabs.SUBBER
    ? [{
      text: t("views.channels.sortOptions.recentUpload"),
      value: "recently_added",
      query_value: {
        sort: "created_at",
        order: "desc",
      },
    }]
    : []),
]);

const currentSortValue = computed(() => findSortValue(sort.value) || findSortValue(defaultSort));

const sortedFavorites = computed(() =>
  localSortChannels(favoritesStore.favorites, currentSortValue.value!.query_value),
);

const channelList = computed(() => {
  if (category.value === Tabs.FAVORITES) return sortedFavorites.value;
  if (category.value === Tabs.BLOCKED) return blockedChannels.value;
  return [];
});

const tabOptions = computed(() => [
  { value: Tabs.VTUBER, label: t("views.channels.tabs.Vtuber") },
  { value: Tabs.SUBBER, label: t("views.channels.tabs.Subber") },
  { value: Tabs.FAVORITES, label: t("views.channels.tabs.Favorites") },
  { value: Tabs.BLOCKED, label: t("views.channels.tabs.Blocked") },
]);

// Watchers
watch(category, () => {
  resetChannels();
  if (category.value === Tabs.FAVORITES && appStore.isLoggedIn) {
    favoritesStore.fetchFavorites();
  }
});

watch(sort, () => {
  if (category.value !== Tabs.FAVORITES) resetChannels();
});

watch(() => appStore.currentOrg, () => {
  // If current sort is no longer available for the new org mode, reset to subscribers
  if (!findSortValue(sort.value)) {
    channelsStore.setSort(defaultSort);
  }
  resetChannels();
});

watch(() => JSON.stringify(appStore.selectedHomeOrgs), () => {
  if (!findSortValue(sort.value)) {
    channelsStore.setSort(defaultSort);
  }
  resetChannels();
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
    category.value = Math.max(category.value - 1, 0);
  } else {
    category.value = Math.min(category.value + 1, 3);
  }
}

function init() {
  channelsStore.$reset();
}

function reload() {
  init();
}

function getLoadFn() {
  return async (offset: number, limit: number) => {
    const type = category.value === Tabs.SUBBER ? CHANNEL_TYPES.SUBBER : CHANNEL_TYPES.VTUBER;
    const sortVal = currentSortValue.value!.query_value;
    // Strip non-API fields from the query
    const { secondarySort, secondaryOrder, groupByOrg, ...apiSortVal } = sortVal;
    const baseQuery: Record<string, any> = {
      limit,
      offset,
      type,
      ...(type === CHANNEL_TYPES.SUBBER && { lang: settingsStore.clipLangs.join(",") }),
      ...apiSortVal,
    };

    if (type === CHANNEL_TYPES.VTUBER) {
      const orgs = selectedOrgs.value;
      if (orgs.length > 1) {
        // Multi-org: fetch each org with suborg sort, then concat (preserves group order)
        const results = await Promise.all(
          orgs.map((org: string) =>
            api.channels({ ...baseQuery, org }).then((r: any) => r.data),
          ),
        );
        // If groupByOrg, just concat (each org's channels are already in group order)
        // Otherwise sort merged results
        if (groupByOrg) {
          return results.flat();
        }
        return localSortChannels(results.flat(), sortVal);
      }
      // Single org: use selectedOrgs[0]; empty = "All Vtubers"
      baseQuery.org = orgs.length === 1 ? orgs[0] : "All Vtubers";
    }

    const res = await api.channels(baseQuery);
    // For "All Vtubers" org sort: API returns in suborg order, stable-group by org
    if (groupByOrg) {
      return stableGroupByOrg(res.data);
    }
    return res.data;
  };
}

/** Stable-group channels by org, preserving the within-org order (group order from API). */
function stableGroupByOrg(channels: any[]) {
  const orgBuckets = new Map<string, any[]>();
  for (const ch of channels) {
    const org = ch.org || "Other";
    if (!orgBuckets.has(org)) orgBuckets.set(org, []);
    orgBuckets.get(org)!.push(ch);
  }
  // Flatten buckets in insertion order (first-seen org)
  return Array.from(orgBuckets.values()).flat();
}

function resetChannels() {
  identifier.value = +new Date();
}

function findSortValue(sortVal: string) {
  return sortOptions.value.find((opt) => opt.value === sortVal);
}

// Initialize
init();
</script>

<style scoped>
.channels-tab-stack {
    --channels-bar-radius: 1rem;
    --channels-bar-cover-rise: 16px;
    position: relative;
}

.channels-tab-cover {
    position: absolute;
    background: var(--color-background);
    pointer-events: none;
    z-index: 0;
}

.channels-tab-cover-top {
    top: calc(-1 * var(--channels-bar-cover-rise));
    right: 0;
    left: 0;
    height: var(--channels-bar-cover-rise);
}

.channels-tab-cover-left,
.channels-tab-cover-right {
    top: 0;
    width: calc(var(--channels-bar-radius) + 1px);
    height: calc(var(--channels-bar-radius) + 1px);
}

.channels-tab-cover-left {
    left: 0;
    background:
        radial-gradient(circle at bottom right, transparent calc(var(--channels-bar-radius) - 1px), var(--color-background) var(--channels-bar-radius));
}

.channels-tab-cover-right {
    right: 0;
    background:
        radial-gradient(circle at bottom left, transparent calc(var(--channels-bar-radius) - 1px), var(--color-background) var(--channels-bar-radius));
}
</style>

<style>
.channel-card-grid::after {
    content: "";
    flex: auto;
}

.rotate-asc {
    transform: rotate(180deg);
}
</style>
