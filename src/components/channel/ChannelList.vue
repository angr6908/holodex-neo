<template>
  <!-- Show channel list as cards -->
  <div v-if="cardView">
    <!-- Add headers if it's grouped channels -->
    <div v-if="grouped" class="space-y-4">
      <template v-for="(group, index) in channelsByGroup" :key="`card-group-${index}`">
        <div class="px-2 py-3 text-xl font-medium tracking-tight text-[color:var(--color-foreground)]">
          {{ group.title }}
        </div>
        <div class="channel-card-grid" :style="gridStyle">
          <div
            v-for="channel in group.items"
            :key="channel.id"
            :style="[channel.inactive ? {'opacity' : 0.5} : {'opacity' : 1}]"
          >
            <ChannelCard :channel="channel" />
          </div>
        </div>
      </template>
    </div>
    <!-- Or show normally -->
    <div v-else class="channel-card-grid" :style="gridStyle">
      <div
        v-for="channel in channels"
        :key="channel.id"
        :style="[channel.inactive ? {'opacity' : 0.5} : {'opacity' : 1}]"
      >
        <ChannelCard :channel="channel" />
      </div>
    </div>
  </div>
  <!-- Grouped channel list with headers and a favorite by group button -->
  <div v-else-if="grouped" class="space-y-3">
    <!-- channelsByGroup has group title and group items, nested loop -->
    <template v-for="(group, index) in channelsByGroup" :key="`list-group-${index}`">
      <details open class="channel-list-container">
        <!-- Header with group name and a favorite all button + tooltip -->
        <summary class="flex cursor-pointer list-none justify-between gap-3 px-4 py-3">
          <div class="flex-1 text-lg font-medium tracking-tight text-[color:var(--color-foreground)]">
            {{ group.title }}
          </div>
          <!-- TODO ADD CONFIRMATION DIALOG -->
          <div class="flex items-center gap-2">
            <UiButton
              variant="ghost"
              size="icon"
              :title="group.hide ? t('component.channelList.enableGroupDisplay') : t('component.channelList.disableGroupDisplay')"
              @click.prevent.stop="toggleGroupDisplay(group)"
            >
              <UiIcon
                :icon="group.hide ? mdiEyeOffOutline : mdiEyeOutline"
                size="sm"
                :class-name="group.hide ? 'text-rose-400' : 'text-slate-400'"
              />
            </UiButton>
            <UiButton
              variant="outline"
              size="sm"
              :title="!isLoggedIn ? t('component.channelList.signInToFavorite') : group.allFavorited ? t('component.channelList.unfavoriteAllInGroup') : t('component.channelList.favoriteAllInGroup')"
              @click.prevent.stop="toggleFavoriteAll(index)"
            >
              <UiIcon
                :icon="icons.mdiHeart"
                size="sm"
                :class-name="group.allFavorited && isLoggedIn ? 'text-rose-400' : 'text-slate-400'"
              />
              {{ t("views.search.type.all") }}
            </UiButton>
          </div>
        </summary>
        <!-- Channel list -->
        <template v-for="(channel, index2) in group.items" :key="channel.id || index2">
          <div class="channel-list-divider" />
          <div :style="[channel.inactive ? {'opacity' : 0.5} : {'opacity' : 1}]">
            <router-link
              v-if="channel"
              :to="`/channel/${channel.id}`"
              class="flex items-start gap-3 px-4 py-3 no-underline hover:bg-white/5"
            >
              <div class="shrink-0">
                <ChannelImg :channel="channel" size="55" />
              </div>
              <ChannelInfo :channel="channel" :include-video-count="includeVideoCount" style="width: 80px">
                <ChannelSocials
                  v-if="isXs"
                  :channel="channel"
                  class="justify-start p-0"
                  show-delete
                />
              </ChannelInfo>
              <ChannelSocials v-if="!isXs" :channel="channel" show-delete />
            </router-link>
          </div>
        </template>
      </details>
    </template>
  </div>
  <!-- Normal channel list -->
  <div v-else-if="channels.length > 0" class="channel-list-container">
    <template v-for="(channel, index) in channels" :key="channel.id || index">
      <div v-if="index > 0" class="channel-list-divider" />
      <div :style="[channel.inactive ? {'opacity' : 0.5} : {'opacity' : 1}]">
        <router-link
          v-if="channel"
          :to="`/channel/${channel.id}`"
          class="flex items-start gap-3 px-4 py-3 no-underline hover:bg-white/5"
        >
          <div class="shrink-0">
            <ChannelImg :channel="channel" size="55" />
          </div>
          <ChannelInfo :channel="channel" :include-video-count="includeVideoCount">
            <slot v-if="isXs" name="action" :channel="channel">
              <ChannelSocials :channel="channel" class="justify-start p-0" show-delete />
            </slot>
          </ChannelInfo>
          <slot v-if="!isXs" name="action" :channel="channel">
            <ChannelSocials :channel="channel" show-delete />
          </slot>
        </router-link>
      </div>
    </template>
  </div>
  <!-- Loading skeleton -->
  <template v-else-if="loading">
    <!-- Card skeleton -->
    <div v-if="cardView" class="channel-card-grid" :style="gridStyle">
      <div v-for="i in skeletonCount" :key="i" class="channel-skeleton-card">
        <div class="flex flex-col items-center gap-1.5 px-3 pt-4 pb-2.5">
          <div class="h-[52px] w-[52px] animate-pulse rounded-full bg-[color:var(--skeleton-fill)]" />
          <div class="h-3.5 w-3/4 animate-pulse rounded bg-[color:var(--skeleton-fill)]" />
          <div class="h-2.5 w-1/2 animate-pulse rounded bg-[color:var(--skeleton-fill)]" />
        </div>
        <div class="mx-0 h-px bg-[color:var(--color-border)]" />
        <div class="flex items-center justify-center gap-3 px-2 py-2">
          <div class="h-2.5 w-12 animate-pulse rounded bg-[color:var(--skeleton-fill)]" />
          <div class="h-2.5 w-10 animate-pulse rounded bg-[color:var(--skeleton-fill)]" />
        </div>
        <div class="mx-0 h-px bg-[color:var(--color-border)]" />
        <div class="flex items-center justify-center gap-1 px-1 py-1.5">
          <div class="h-5 w-5 animate-pulse rounded bg-[color:var(--skeleton-fill)]" />
          <div class="h-5 w-5 animate-pulse rounded bg-[color:var(--skeleton-fill)]" />
          <div class="h-5 w-5 animate-pulse rounded bg-[color:var(--skeleton-fill)]" />
        </div>
      </div>
    </div>
    <!-- List skeleton -->
    <div v-else class="channel-list-container">
      <template v-for="i in 12" :key="i">
        <div v-if="i > 1" class="channel-list-divider" />
        <div class="flex items-start gap-3 px-4 py-3">
          <div class="h-[55px] w-[55px] shrink-0 animate-pulse rounded-full bg-[color:var(--skeleton-fill)]" />
          <div class="flex min-w-0 flex-1 flex-col gap-2 pt-1">
            <div class="h-4 w-3/5 animate-pulse rounded bg-[color:var(--skeleton-fill)]" />
            <div class="h-3 w-2/5 animate-pulse rounded bg-[color:var(--skeleton-fill)]" />
            <div class="h-3 w-1/3 animate-pulse rounded bg-[color:var(--skeleton-fill)]" />
          </div>
        </div>
      </template>
    </div>
  </template>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from "vue";
import { useI18n } from "vue-i18n";
import { mdiEyeOffOutline, mdiEyeOutline } from "@mdi/js";
import * as icons from "@/utils/icons";
import { useAppStore } from "@/stores/app";
import { useFavoritesStore } from "@/stores/favorites";
import { useSettingsStore } from "@/stores/settings";
import ChannelImg from "./ChannelImg.vue";
import ChannelInfo from "./ChannelInfo.vue";
import ChannelSocials from "./ChannelSocials.vue";
import UiButton from "@/components/ui/button/Button.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";

const ChannelCard = defineAsyncComponent(() => import("./ChannelCard.vue"));

const props = withDefaults(defineProps<{
  channels: any[];
  cardView?: boolean;
  includeVideoCount?: boolean;
  grouped?: boolean;
  groupKey?: string;
  showDelete?: boolean;
  loading?: boolean;
}>(), {
  cardView: false,
  includeVideoCount: false,
  grouped: false,
  groupKey: "group",
  showDelete: false,
  loading: false,
});

const { t } = useI18n();
const appStore = useAppStore();
const favoritesStore = useFavoritesStore();
const settingsStore = useSettingsStore();

const isXs = computed(() => window.innerWidth <= 420);

const isLoggedIn = computed(() => appStore.isLoggedIn);

// Channel grid uses the HomeFave default grid degree (gridSize=1) but stays independent
// — it does NOT change when the user adjusts the homepage grid slider.
const CHANNEL_GRID_SIZE = 1;
const colSize = computed(() => {
  const width = appStore.windowWidth || window.innerWidth;
  if (width < 600)  return 1 + CHANNEL_GRID_SIZE;
  if (width < 960)  return 2 + CHANNEL_GRID_SIZE;
  if (width < 1264) return 3 + CHANNEL_GRID_SIZE;
  if (width < 1904) return 4 + CHANNEL_GRID_SIZE;
  return 5 + CHANNEL_GRID_SIZE;
});

const gridStyle = computed(() => ({
  "--channel-grid-columns": colSize.value,
}));

const skeletonCount = computed(() => colSize.value * 3);

function isFavorited(id: string) {
  return favoritesStore.isFavorited(id);
}

function isHidden(groupName: string) {
  const org = appStore.currentOrg.name;
  const hiding = settingsStore.hiddenGroups;
  if (!hiding) return false;
  if (!Object.keys(hiding).includes(org)) return false;
  return settingsStore.hiddenGroups[org].includes(groupName.toLowerCase());
}

const channelsByGroup = computed(() => {
  const groupedChannels: any[] = [];
  let lastGroup = "";
  props.channels.forEach((c) => {
    const group = c[props.groupKey] || "Other";
    if (group !== lastGroup) {
      groupedChannels.push({
        title: group,
        items: [],
        allFavorited: true,
        hide: isHidden(group),
        org: appStore.currentOrg.name,
      });
      lastGroup = group;
    }
    groupedChannels[groupedChannels.length - 1].items.push(c);
    if (!isFavorited(c.id)) {
      groupedChannels[groupedChannels.length - 1].allFavorited = false;
    }
  });
  return groupedChannels;
});

function toggleFavoriteAll(index: number) {
  if (!isLoggedIn.value) return;
  const allFav = channelsByGroup.value[index].allFavorited;
  channelsByGroup.value[index].items.forEach((c: any) => {
    if ((!isFavorited(c.id) && !allFav) || (isFavorited(c.id) && allFav)) {
      favoritesStore.toggleFavorite(c.id);
    }
  });
  if (Object.keys(favoritesStore.stagedFavorites).length > 0) {
    favoritesStore.updateFavorites();
  }
}

function toggleGroupDisplay(group: any) {
  settingsStore.toggleGroupDisplay(group);
}
</script>

<style>
/* Dynamic columns driven by JS-computed --channel-grid-columns, matching video grid */
.channel-card-grid {
  display: grid;
  column-gap: 0.25rem;
  row-gap: 0.35rem;
  grid-template-columns: repeat(var(--channel-grid-columns, 1), minmax(140px, 1fr));
}

.channel-skeleton-card {
  border-radius: 1rem;
  overflow: hidden;
  border: 1px solid var(--color-border, rgba(255, 255, 255, 0.07));
  background: var(--color-card);
}

.channel-list-container {
  border: 1px solid var(--color-border, rgba(255, 255, 255, 0.07));
  border-radius: 0.75rem;
  overflow: hidden;
}

.channel-list-divider {
  height: 1px;
  background: var(--color-border, rgba(255, 255, 255, 0.07));
}
</style>
