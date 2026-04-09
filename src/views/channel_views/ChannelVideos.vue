<template>
  <Teleport v-if="teleportReady" to="#channelTabControls">
    <div class="flex items-center gap-1">
      <UiButton
        variant="ghost"
        size="icon"
        class-name="h-8 w-8"
        :title="sortOrder === 'desc' ? 'Newest first' : 'Oldest first'"
        @click="toggleSort"
      >
        <UiIcon :icon="sortOrder === 'desc' ? mdiSortDescending : mdiSortAscending" />
      </UiButton>
      <UiButton
        variant="ghost"
        size="icon"
        class-name="h-8 w-8"
        title="Toggle grid size"
        @click="cycleGridSize"
      >
        <UiIcon :icon="gridIcon" />
      </UiButton>
    </div>
  </Teleport>

  <generic-list-loader
    v-slot="{ data, isLoading }"
    :key="loaderKey"
    paginate
    :per-page="pageLength"
    :load-fn="getLoadFn()"
  >
    <VideoCardList
      v-show="!isLoading"
      :videos="data"
      :include-channel="hasChannelInfo"
      :cols="colSizes"
      dense
    />
    <!-- Render skeleton items when data hasn't loaded yet -->
    <SkeletonCardList v-if="isLoading" :cols="colSizes" :include-avatar="hasChannelInfo" dense />
  </generic-list-loader>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import VideoCardList from "@/components/video/VideoCardList.vue";
import backendApi from "@/utils/backend-api";
import GenericListLoader from "@/components/video/GenericListLoader.vue";
import SkeletonCardList from "@/components/video/SkeletonCardList.vue";
import { useChannelStore } from "@/stores/channel";
import { useSettingsStore } from "@/stores/settings";
import { useAppStore } from "@/stores/app";
import { useMetaTitle } from "@/composables/useMetaTitle";
import UiButton from "@/components/ui/button/Button.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import { mdiSortAscending, mdiSortDescending } from "@mdi/js";
import { mdiViewGrid, mdiViewComfy, mdiViewModule } from "@/utils/icons";

const route = useRoute();
const { t } = useI18n();
const channelStore = useChannelStore();
const settingsStore = useSettingsStore();
const appStore = useAppStore();
const { id, channel } = storeToRefs(channelStore);

const pageLength = ref(24);
const sortOrder = ref<"desc" | "asc">("desc");
const teleportReady = ref(false);

const currentGridSize = computed({
  get: () => appStore.currentGridSize,
  set: (val) => appStore.setCurrentGridSize(val),
});

const loaderKey = computed(() => `${id.value}-${type.value}-${sortOrder.value}`);

const colSizes = computed(() => ({
  xs: 1 + currentGridSize.value,
  sm: 2 + currentGridSize.value,
  md: 3 + currentGridSize.value,
  lg: 4 + currentGridSize.value,
  xl: 5 + currentGridSize.value,
}));

const gridIcon = computed(() => {
  if (currentGridSize.value === 1) return mdiViewComfy;
  if (currentGridSize.value === 2) return mdiViewModule;
  return mdiViewGrid;
});

const hasChannelInfo = computed(() => (
  route.name === "channel_clips" || route.name === "channel_collabs"
));

const type = computed(() => {
  switch (route.name) {
    case "channel_clips": return "clips";
    case "channel_collabs": return "collabs";
    default: return "videos";
  }
});

const channelName = computed(() => {
  const prop = settingsStore.nameProperty;
  return channel.value[prop] || channel.value.name;
});

useMetaTitle(() => {
  let tab = "Videos";
  switch (type.value) {
    case "clips": tab = t("views.channel.clips"); break;
    case "collabs": tab = t("views.channel.collabs"); break;
    default: tab = t("views.channel.video");
  }
  return channelName.value ? `${channelName.value} - ${tab} - Holodex` : "Loading...";
});

watch(() => route.name, async () => {
  teleportReady.value = false;
  await nextTick();
  teleportReady.value = true;
});

function toggleSort() {
  sortOrder.value = sortOrder.value === "desc" ? "asc" : "desc";
}

function cycleGridSize() {
  currentGridSize.value = (currentGridSize.value + 1) % 3;
}

function getLoadFn() {
  const order = sortOrder.value;
  return async (offset: number, limit: number) => {
    const res = await backendApi.channelVideos(id.value, {
      type: type.value,
      query: {
        ...(channel.value.type !== "subber" && {
          lang: settingsStore.clipLangs.join(","),
          type: "stream,placeholder",
        }),
        ...(type.value === "clips" && { status: "past" }),
        include: "clips,live_info",
        sort: "available_at",
        order,
        limit,
        offset,
        paginated: true,
      },
    });
    return res.data;
  };
}

onMounted(async () => {
  await nextTick();
  teleportReady.value = true;
});

onBeforeUnmount(() => {
  teleportReady.value = false;
});
</script>

<style></style>
