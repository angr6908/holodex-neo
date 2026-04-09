<template>
  <section>
    <div class="search-form-sticky">
      <SearchForm
        :sort-by="filter_sort"
        :type-value="filter_type"
        :sort-options="options.sort"
        :type-options="options.type"
        @update:sortBy="filter_sort = $event"
        @update:typeValue="filter_type = $event"
      />
    </div>

    <div class="search-content-area">
      <div
        v-if="searchVideo === null"
        class="relative z-0 flex flex-col items-center justify-center gap-2 py-16 text-center"
      >
        <UiIcon :icon="mdiMagnify" class-name="h-8 w-8 text-[color:var(--color-muted-foreground)]" />
        <p class="text-sm text-[color:var(--color-muted-foreground)]">
          Use the filters above or the search bar to find streams and clips.
        </p>
      </div>

      <generic-list-loader
        v-else
        v-slot="{ data, isLoading }"
        :key="filter_type + filter_sort + id + executedQuery"
        paginate
        :per-page="pageLength"
        :load-fn="searchVideo"
      >
        <div class="relative z-0">
          <LoadingOverlay
            v-if="isLoading"
            :is-loading="true"
            :show-error="false"
            label="Searching..."
          />
          <VideoCardList
            v-show="!isLoading"
            :videos="data"
            :horizontal="horizontal"
            include-channel
            dense
            :cols="{
              xs: 1,
              sm: 3,
              md: 4,
              lg: 5,
              xl: 6,
            }"
            show-comments
          />
        </div>
      </generic-list-loader>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { mdiMagnify } from "@mdi/js";
import UiIcon from "@/components/ui/icon/Icon.vue";
import VideoCardList from "@/components/video/VideoCardList.vue";
import api from "@/utils/backend-api";
import { forwardTransformSearchToAPIQuery } from "@/utils/functions";
import { csv2jsonAsync } from "json-2-csv";
import { useIsActive } from "@/composables/useIsActive";
import { useSettingsStore } from "@/stores/settings";
import { useMetaTitle } from "@/composables/useMetaTitle";
import SearchForm from "@/components/search/SearchForm.vue";
import GenericListLoader from "@/components/video/GenericListLoader.vue";
import LoadingOverlay from "@/components/common/LoadingOverlay.vue";

defineOptions({ name: "SearchView" });

const route = useRoute();
const { t } = useI18n();
const settingsStore = useSettingsStore();
const { isActive } = useIsActive();

const id = ref(Date.now());
const horizontal = ref(false);
const executedQuery = ref<string | null>(null);
const filter_sort = ref("newest");
const filter_type = ref("all");
const pageLength = 30;

const options = {
  defaults: {
    sort: "newest",
    type: "all",
  },
  sort: [
    {
      text: t("views.search.sort.newest"),
      value: "newest",
      query_value: { sort: "published_at", order: "desc" },
    },
    {
      text: t("views.search.sort.oldest"),
      value: "oldest",
      query_value: { sort: "published_at", order: "asc" },
    },
    {
      text: t("views.search.sort.longest"),
      value: "longest",
      query_value: { sort: "duration", order: "desc" },
    },
  ],
  type: [
    {
      text: t("views.search.type.all"),
      value: "all",
      query_value: {},
    },
    {
      text: t("views.search.type.official"),
      value: "stream",
      query_value: { channel_type: "vtuber" },
    },
    {
      text: t("views.search.type.clip"),
      value: "clip",
      query_value: { channel_type: "subber" },
    },
  ],
};

useMetaTitle(() => executedQuery.value ? "Search Results - Holodex" : "Search - Holodex");

// Computed
const query = computed(() => route.query);

watch(
  () => ({ q: route.query.q, active: isActive.value }),
  ({ q, active }) => {
    if (active) {
      executedQuery.value = q as string;
    }
  },
  { immediate: true },
);

const searchVideo = computed(() => {
  if (!executedQuery.value || executedQuery.value.length < 5) {
    return null;
  }

  return async (offset: number, limit: number) => {
    const parsedQuery = await csv2jsonAsync(executedQuery.value!);
    const searchQuery = forwardTransformSearchToAPIQuery(parsedQuery, {
      sort: filter_sort.value,
      lang: settingsStore.clipLangs,
      target:
        filter_type.value === "all"
          ? ["stream", "clip"]
          : [filter_type.value],
      conditions: [],
      topic: [],
      vch: [],
      org: [],
      comment: [],
    });

    if (searchQuery.comment.length === 0) {
      horizontal.value = false;
      return api
        .searchVideo({
          ...searchQuery,
          paginated: true,
          offset,
          limit,
        })
        .then((x: any) => x.data);
    }
    horizontal.value = true;
    return api
      .searchComments({
        ...searchQuery,
        paginated: true,
        offset,
        limit,
      })
      .then((x: any) => x.data);
  };
});

// Watchers
watch(() => route.query, (x) => {
  if (!isActive.value) return;
  syncFilters();
  if (x.q !== executedQuery.value && x.q) id.value = Date.now();
});

// Methods
function syncFilters() {
  filter_type.value = query.value.vtuber === "false"
    ? "clip"
    : (query.value.channelType as string) || options.defaults.type;
  filter_sort.value = (query.value.sort as string) || options.defaults.sort;
}

// Lifecycle (created equivalent)
syncFilters();
</script>

<style scoped>
.search-form-sticky {
  position: sticky;
  top: 64px;
  z-index: 50;
  background: var(--colorbg);
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
  /* Extend background upward slightly to prevent sub-pixel gap with fixed nav */
  margin-top: -1px;
  border-top: 1px solid transparent;
}

.search-content-area {
  padding-top: 0.75rem;
}
</style>
