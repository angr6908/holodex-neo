<template>
  <div
    class="flex flex-col gap-3"
    :class="compact ? '' : 'max-h-[60vh] overflow-y-auto pr-1'"
  >
    <slot />
    <SelectCard
      v-if="collabFilter || placeholderFilter || missingFilter"
      title="Hide Streams"
    >
      <div class="stream-check-grid">
        <label
          v-if="collabFilter"
          class="stream-check-chip"
          :class="{ 'stream-check-chip-selected': hideCollabStreams }"
        >
          <input v-model="hideCollabStreams" type="checkbox" class="peer sr-only">
          <span class="stream-check-chip-indicator" />
          <span>Collab Streams</span>
        </label>
        <label
          v-if="placeholderFilter"
          class="stream-check-chip"
          :class="{ 'stream-check-chip-selected': hidePlaceholder }"
        >
          <input v-model="hidePlaceholder" type="checkbox" class="peer sr-only">
          <span class="stream-check-chip-indicator" />
          <span>Placeholder Streams</span>
        </label>
        <label
          v-if="missingFilter"
          class="stream-check-chip"
          :class="{ 'stream-check-chip-selected': hideMissing }"
        >
          <input v-model="hideMissing" type="checkbox" class="peer sr-only">
          <span class="stream-check-chip-indicator" />
          <span>Missing Streams</span>
        </label>
      </div>
    </SelectCard>
    <SelectCard
      v-if="topicFilter"
      title="Blocked Topics"
      :description="blockedTopicsDescription"
      :show-search="true"
      :search-value="search"
      search-placeholder="Search topics"
      :show-clear="true"
      :clear-disabled="ignoredTopics.length === 0"
      clear-aria-label="Clear blocked topics"
      :scroll-options="true"
      :scroll-class-name="compact ? 'h-32 pr-3' : 'h-72 pr-3'"
      @update:searchValue="search = $event"
      @search-focus="fetchTopics"
      @clear="clearIgnoredTopics"
    >
      <template #selectedTags>
        <div v-if="ignoredTopics.length > 0" class="select-card-chip-flow">
          <div
            v-for="topicValue in ignoredTopics"
            :key="topicValue"
            class="settings-check-chip settings-check-chip-selected select-card-chip-compact"
          >
            <span class="settings-check-chip-indicator" />
            <span class="select-card-chip-label">
              {{ getTopicLabel(topicValue) }}
            </span>
            <button
              type="button"
              class="select-card-chip-meta select-card-chip-remove select-card-chip-remove-btn"
              :aria-label="`Remove ${getTopicLabel(topicValue)}`"
              @click.stop="toggleTopic(topicValue)"
            >
              <UiIcon :icon="mdiClose" size="xs" />
            </button>
          </div>
        </div>
      </template>

      <template #options>
        <div class="select-card-chip-flow">
          <button
            v-for="topic in displayedTopics"
            :key="topic.value"
            type="button"
            class="settings-check-chip select-card-chip-compact"
            :class="{ 'settings-check-chip-selected': isTopicSelected(topic.value) }"
            @click="toggleTopic(topic.value)"
          >
            <span class="settings-check-chip-indicator" />
            <span class="select-card-chip-label truncate">
              {{ topic.value }}
            </span>
            <UiBadge
              v-if="topic.count !== undefined"
              variant="secondary"
              class-name="select-card-chip-meta select-card-chip-count"
            >
              {{ topic.count }}
            </UiBadge>
          </button>
        </div>
      </template>

      <template #footer>
        <span v-if="showDescriptions && !topicsLoading && !topics.length" class="text-xs text-[color:var(--color-muted-foreground)]">
          No topic list loaded from the backend yet.
        </span>
        <span v-if="!topicsLoading && topics.length && filteredTopics.length === 0" class="text-xs text-[color:var(--color-muted-foreground)]">
          No topics found
        </span>
      </template>
    </SelectCard>
  </div>
</template>

<script lang="ts">
// Module-level cache so topics survive component remounts and page refreshes
const TOPICS_STORAGE_KEY = "holodex-topics-cache";
let cachedTopics: any[] = (() => {
  try {
    const raw = localStorage.getItem(TOPICS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
})();
</script>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import backendApi from "@/utils/backend-api";
import { useSettingsStore } from "@/stores/settings";
import UiBadge from "@/components/ui/badge/Badge.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import SelectCard from "@/components/setting/SelectCard.vue";
import { mdiClose } from "@mdi/js";

const props = withDefaults(defineProps<{
  topicFilter?: boolean;
  collabFilter?: boolean;
  placeholderFilter?: boolean;
  missingFilter?: boolean;
  showDescriptions?: boolean;
  compact?: boolean;
}>(), {
  topicFilter: true,
  collabFilter: true,
  placeholderFilter: true,
  missingFilter: true,
  showDescriptions: true,
  compact: false,
});

const { t } = useI18n();
const settingsStore = useSettingsStore();

const search = ref("");
const topics = ref<any[]>(cachedTopics);
const topicsLoading = ref(false);

const hideCollabStreams = computed({
  get() { return settingsStore.hideCollabStreams; },
  set(val: boolean) { settingsStore.setHideCollabStreams(val); },
});

const hidePlaceholder = computed({
  get() { return settingsStore.hidePlaceholder; },
  set(val: boolean) { settingsStore.setHidePlaceholder(val); },
});

const hideMissing = computed({
  get() { return settingsStore.hideMissing; },
  set(val: boolean) { settingsStore.setHideMissing(val); },
});

const ignoredTopics = computed({
  get() { return settingsStore.ignoredTopics as unknown as string[]; },
  set(val: string[]) { settingsStore.setIgnoredTopics(val.sort()); },
});

const filteredTopics = computed(() => {
  const query = search.value.trim().toLowerCase();
  const filtered = !query
    ? topics.value
    : topics.value.filter((topic) => topic.value.toLowerCase().includes(query));
  return [...filtered].sort((a, b) => {
    const aSelected = isTopicSelected(a.value) ? 1 : 0;
    const bSelected = isTopicSelected(b.value) ? 1 : 0;
    return bSelected - aSelected || a.value.localeCompare(b.value);
  });
});

const displayedTopics = computed(() => filteredTopics.value);

const blockedTopicsDescription = computed(() => {
  if (!props.showDescriptions) return "";
  return topicsLoading.value ? "Loading..." : t("views.settings.ignoredTopicsMsg");
});

function isTopicSelected(topicValue: string) {
  return ignoredTopics.value.includes(topicValue);
}

function getTopicLabel(topicValue: string) {
  return topics.value.find((topic) => topic.value === topicValue)?.value || topicValue;
}

function toggleTopic(topicValue: string) {
  const next = new Set(ignoredTopics.value);
  if (next.has(topicValue)) next.delete(topicValue);
  else next.add(topicValue);
  ignoredTopics.value = [...next];
}

function clearIgnoredTopics() {
  ignoredTopics.value = [];
}

async function fetchTopics() {
  if (!topics.value.length && !topicsLoading.value) {
    topicsLoading.value = true;
    const { data } = await backendApi.topics();
    topics.value = data.map(({ id, count }: any) => ({ value: id, count }));
    cachedTopics = topics.value;
    try { localStorage.setItem(TOPICS_STORAGE_KEY, JSON.stringify(topics.value)); } catch {}
    topicsLoading.value = false;
  }
}

onMounted(() => {
  if (props.topicFilter) {
    fetchTopics().catch(() => {
      topicsLoading.value = false;
    });
  }
});
</script>

<style scoped>
.stream-check-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.5rem;
}
</style>
