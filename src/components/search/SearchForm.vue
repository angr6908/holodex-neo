<template>
  <form class="search-form-wrapper" @submit.prevent="submitSearch">
    <div class="search-inline-grid">
      <div ref="orgFieldWrapper" class="search-inline-field">
        <span class="search-inline-label">{{ $t("component.search.type.org") }}</span>
        <HomeOrgMultiSelect
          class="search-inline-org-select"
          :inline="true"
          :manual-apply="true"
          :selected-names-override="selectedOrgs"
          :fallback-selection="[]"
          button-class="h-10 w-full justify-between rounded-xl px-3 font-normal"
          @apply="selectedOrgs = $event"
        />
      </div>

      <label class="search-inline-field">
        <span class="search-inline-label">{{ $t("views.search.typeDropdownLabel") }}</span>
        <UiSelect
          v-model="typeModel"
          :options="typeOptions"
          label-key="text"
          value-key="value"
          class-name="h-10"
          :fluid="true"
        />
      </label>

      <label class="search-inline-field">
        <span class="search-inline-label">{{ $t("component.search.type.topic") }}</span>
        <UiSelect
          v-model="topic"
          :options="topicOptions"
          label-key="text"
          value-key="value"
          class-name="h-10"
          :fluid="true"
          :searchable="true"
          search-placeholder="Search topic"
          :search-filter-fn="topicSearchFilter"
        >
          <template #option="{ option, selected }">
            <span class="truncate">{{ option.text }}</span>
            <span v-if="option.count !== undefined" class="search-topic-count">{{ option.count }}</span>
            <UiIcon
              v-if="selected"
              :icon="mdiCheck"
              size="sm"
              class-name="ml-auto shrink-0 text-[color:var(--color-foreground)]"
            />
          </template>
        </UiSelect>
      </label>

      <!-- Channel inline chip-input -->
      <div class="search-inline-field">
        <span class="search-inline-label">{{ $t("component.search.type.channel") }}</span>
        <div
          ref="channelPanelRoot"
          class="search-channel-combobox"
          :class="{ 'search-channel-combobox-open': channelPanelOpen }"
          @click="openChannelInput"
        >
          <div class="search-channel-inner">
            <template v-if="!channelPanelOpen">
              <span
                v-for="channel in channels"
                :key="channel.value"
                class="search-channel-chip"
              >
                <span class="search-channel-chip-text">{{ channel.text }}</span>
                <button
                  type="button"
                  class="search-channel-chip-remove"
                  :aria-label="`Remove ${channel.text}`"
                  @click.stop="removeChannel(channel.value)"
                >
                  <UiIcon :icon="mdiClose" size="xs" />
                </button>
              </span>
            </template>
            <input
              ref="channelInput"
              v-model="channelSearch"
              class="search-channel-text-input"
              :placeholder="''"
              autocomplete="off"
              @focus="channelPanelOpen = true"
              @keydown.enter.prevent="addFirstChannelSuggestion"
              @keydown.escape="channelPanelOpen = false"
              @keydown.backspace="handleChannelBackspace"
            >
          </div>
          <span class="search-channel-chevron">
            <UiIcon
              :icon="mdiChevronDown"
              size="sm"
              :class-name="`shrink-0 transition-transform ${channelPanelOpen ? 'rotate-180' : ''}`"
            />
          </span>

          <div v-if="channelPanelOpen" class="search-channel-panel">
            <div v-if="channels.length" class="search-channel-selected-section" :class="{ 'search-channel-selected-no-divider': !hasRealChannelCandidates }">
              <span
                v-for="channel in channels"
                :key="'sel-' + channel.value"
                class="search-channel-selected-tag"
              >
                <img
                  v-if="channel.value && channel.value.length > 10"
                  :src="getChannelPhoto(channel.value)"
                  class="search-channel-tag-avatar"
                  loading="lazy"
                  @error="$event.target.style.display='none'"
                >
                <span class="search-channel-tag-text">{{ channel.text }}</span>
                <button
                  type="button"
                  class="search-channel-tag-remove"
                  @mousedown.prevent="removeChannel(channel.value)"
                >
                  <UiIcon :icon="mdiClose" size="xs" />
                </button>
              </span>
            </div>
            <div v-if="channelSuggestions.length" class="search-channel-suggestions">
              <button
                v-for="item in channelSuggestions"
                :key="item.value"
                type="button"
                class="search-channel-suggestion"
                @mousedown.prevent="addChannelCandidate(item)"
              >
                <img
                  v-if="item.value && item.value.length > 10"
                  :src="getChannelPhoto(item.value)"
                  class="search-channel-suggestion-avatar"
                  loading="lazy"
                  @error="$event.target.style.display='none'"
                >
                <svg v-else viewBox="0 0 24 24" class="search-channel-suggestion-icon fill-current">
                  <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5z" />
                </svg>
                <span class="search-channel-suggestion-text">{{ item.text }}</span>
              </button>
            </div>
            <div
              v-else-if="channelSearch.trim().length > 0"
              class="search-channel-empty"
            >
              No channels found
            </div>
            <div v-else-if="!channels.length" class="search-channel-empty">
              Type to search channels
            </div>
          </div>
        </div>
      </div>

      <label class="search-inline-field">
        <span class="search-inline-label">{{ $t("component.search.type.titledesc") }}</span>
        <UiInput
          v-model="title"
          :disabled="commentIsFilled"
          placeholder=""
          class-name="h-10"
        />
      </label>

      <label class="search-inline-field">
        <span class="search-inline-label">{{ $t("component.search.type.comments") }}</span>
        <UiInput
          v-model="comment"
          :disabled="titleIsFilled"
          placeholder=""
          class-name="h-10"
        />
      </label>

      <label class="search-inline-field">
        <span class="search-inline-label">{{ $t("views.search.sortByLabel") }}</span>
        <UiSelect
          v-model="sortByModel"
          :options="sortOptions"
          label-key="text"
          value-key="value"
          class-name="h-10"
          :fluid="true"
        />
      </label>

      <div class="search-inline-actions">
        <button type="submit" class="search-btn-submit" :title="$t('views.search.searchBtn')">
          <UiIcon :icon="mdiMagnify" size="sm" />
          <span class="sr-only">{{ $t("views.search.searchBtn") }}</span>
        </button>
        <button
          type="button"
          class="search-btn-reset"
          :title="'Reset filters'"
          @click="clearAll"
        >
          <UiIcon :icon="mdiBroom" size="sm" />
          <span class="sr-only">Reset</span>
        </button>
      </div>
    </div>
  </form>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick, useTemplateRef } from "vue";
import { useRouter, useRoute } from "vue-router";
import { mdiChevronDown, mdiClose, mdiMagnify, mdiBroom, mdiCheck } from "@mdi/js";
import debounce from "lodash-es/debounce";
import backendApi from "@/utils/backend-api";
import { csv2jsonAsync, json2csvAsync } from "json-2-csv";
import { getChannelPhoto } from "@/utils/functions";
import UiInput from "@/components/ui/input/Input.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import UiSelect from "@/components/ui/select/Select.vue";
import HomeOrgMultiSelect from "@/components/common/HomeOrgMultiSelect.vue";

const props = withDefaults(defineProps<{
  sortBy?: string;
  typeValue?: string;
  sortOptions?: any[];
  typeOptions?: any[];
}>(), {
  sortBy: "newest",
  typeValue: "all",
  sortOptions: () => [],
  typeOptions: () => [],
});

const emit = defineEmits<{
  (e: "update:sortBy", value: string): void;
  (e: "update:typeValue", value: string): void;
}>();

const router = useRouter();
const route = useRoute();

const orgFieldWrapper = useTemplateRef<HTMLElement>("orgFieldWrapper");
const channelPanelRoot = useTemplateRef<HTMLElement>("channelPanelRoot");
const channelInput = useTemplateRef<HTMLInputElement>("channelInput");

const selectedOrgs = ref<string[]>([]);
const topic = ref("");
const comment = ref("");
const title = ref("");
const channels = ref<any[]>([]);
const channelPanelOpen = ref(false);
const channelLoading = ref(false);
const channelResults = ref<any[]>([]);
const channelSearch = ref("");
const topics = ref<any[]>([]);

const sortByModel = computed({
  get() {
    return props.sortBy;
  },
  set(value: string) {
    emit("update:sortBy", value);
  },
});

const typeModel = computed({
  get() {
    return props.typeValue;
  },
  set(value: string) {
    emit("update:typeValue", value);
  },
});

const topicOptions = computed(() => [
  { value: "", text: "Any topic" },
  ...topics.value,
]);

const channelSuggestions = computed(() => {
  const selectedValues = new Set(channels.value.map((item) => item.value));
  const selectedTexts = new Set(channels.value.map((item) => `${item.text}`.toLowerCase()));
  const seen = new Set();
  const suggestions: any[] = [];

  channelResults.value.forEach((item) => {
    const value = item.value || item.text;
    const text = item.text || item.value;
    if (!value || !text || selectedValues.has(value)) return;
    if (selectedTexts.has(`${text}`.toLowerCase())) return;
    if (seen.has(value)) return;
    seen.add(value);
    suggestions.push({
      type: "channel",
      value,
      text,
      fromApi: true,
    });
  });

  return suggestions;
});

const hasRealChannelCandidates = computed(() => channelSuggestions.value.length > 0);

const commentIsFilled = computed(() => (comment.value && comment.value.length > 0) || false);

const titleIsFilled = computed(() => (title.value && title.value.length > 0) || false);

watch(channelSearch, debounce(async (val: string) => {
  if (!val) {
    channelResults.value = [];
    return;
  }
  channelLoading.value = true;
  const res = await backendApi.searchAutocomplete(val);
  res.data = res.data
    .map((x: any) => {
      if (!x.text) x.text = x.value;
      return x;
    })
    .filter((x: any) => x.type === "channel");

  channelResults.value = [...res.data];
  channelLoading.value = false;
}, 200));

watch(() => route.query, async () => {
  processQuery(
    route.query.q ? await csv2jsonAsync(route.query.q as string) : [],
  );
});

function topicSearchFilter(option: any, query: string) {
  return (option.text || option.value || "").toLowerCase().includes(query);
}

function processQuery(queryArray: any[]) {
  const topicOpt = queryArray.find((v) => v.type === "topic");
  topic.value = (topicOpt && topicOpt.value) || "";
  channels.value = queryArray.filter((v) => v.type === "channel");
  const titleOpt = queryArray.find((v) => v.type === "title & desc");
  title.value = (titleOpt && titleOpt.text) || "";
  const commentOpt = queryArray.find((v) => v.type === "comments");
  comment.value = (commentOpt && commentOpt.text) || "";
  const orgOpts = queryArray.filter((v) => v.type === "org");
  selectedOrgs.value = orgOpts.map((v) => v.value);
}

function openChannelInput() {
  channelPanelOpen.value = true;
  nextTick(() => {
    channelInput.value?.focus();
  });
}

function addFirstChannelSuggestion() {
  if (channelSuggestions.value.length > 0) {
    addChannelCandidate(channelSuggestions.value[0]);
  } else if (channelSearch.value.trim()) {
    addChannelCandidate(null);
  }
}

function handleChannelBackspace() {
  if (channelSearch.value === "" && channels.value.length > 0) {
    channels.value = channels.value.slice(0, -1);
  }
}

function handleWindowPointerDown(event: PointerEvent) {
  if (!channelPanelOpen.value) return;
  if (channelPanelRoot.value && !channelPanelRoot.value.contains(event.target as Node)) {
    channelPanelOpen.value = false;
  }
}

function addChannelCandidate(candidate: any) {
  if (candidate && candidate.value) {
    if (!channels.value.find((item) => item.value === candidate.value)) {
      channels.value.push({
        type: "channel",
        value: candidate.value,
        text: candidate.text || candidate.value,
      });
    }
    channelSearch.value = "";
    channelResults.value = [];
    return;
  }
  const search = (channelSearch.value || "").trim();
  if (!search) return;
  const existing = channelResults.value.find((item) => item.text === search || item.value === search)
    || { type: "channel", value: search, text: search };
  if (!channels.value.find((item) => item.value === existing.value)) {
    channels.value.push(existing);
  }
  channelSearch.value = "";
  channelResults.value = [];
}

function removeChannel(value: string) {
  channels.value = channels.value.filter((item) => item.value !== value);
}

function updateOrgPanelPosition() {
  const el = orgFieldWrapper.value;
  if (el) {
    el.style.setProperty("--org-field-left", `${el.getBoundingClientRect().left}px`);
  }
}

function clearAll() {
  selectedOrgs.value = [];
  topic.value = "";
  comment.value = "";
  title.value = "";
  channels.value = [];
  channelSearch.value = "";
  channelResults.value = [];
}

async function submitSearch() {
  const reconstruction: any[] = [];
  if (selectedOrgs.value) {
    selectedOrgs.value.forEach((org) => {
      reconstruction.push({ type: "org", value: `${org}`, text: org });
    });
  }
  if (topic.value) reconstruction.push({ type: "topic", value: `${topic.value}`, text: topic.value });
  if (channels.value) reconstruction.push(...channels.value);
  if (title.value) {
    reconstruction.push({ type: "title & desc", value: `${title.value}title & desc`, text: title.value });
  }
  if (comment.value) {
    reconstruction.push({ type: "comments", value: `${comment.value}comments`, text: comment.value });
  }

  router.push({
    path: "/search",
    query: {
      ...route.query,
      q: await json2csvAsync(reconstruction),
      page: undefined,
    },
  });
}

onMounted(async () => {
  backendApi.topics().then(({ data }) => {
    topics.value = data.map(({ id, count }: { id: string; count: number }) => ({ value: id, text: id, count }));
  });
  processQuery(
    route.query.q ? await csv2jsonAsync(route.query.q as string) : [],
  );
  window.addEventListener("pointerdown", handleWindowPointerDown);
  window.addEventListener("resize", updateOrgPanelPosition);
  nextTick(() => updateOrgPanelPosition());
});

onBeforeUnmount(() => {
  window.removeEventListener("pointerdown", handleWindowPointerDown);
  window.removeEventListener("resize", updateOrgPanelPosition);
});
</script>

<style scoped>
/* ─── Layout ─── */
.search-form-wrapper {
  padding: 0;
}

.search-inline-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: flex-end;
}

.search-inline-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
  flex: 1 1 120px;
  position: relative;
}

/* Descending z-indexes: earlier fields above later fields so their menus overlap correctly */
.search-inline-field:nth-child(1) { z-index: 8; } /* org */
.search-inline-field:nth-child(2) { z-index: 7; } /* type */
.search-inline-field:nth-child(3) { z-index: 6; } /* topic */
.search-inline-field:nth-child(4) { z-index: 5; } /* channel */
.search-inline-field:nth-child(5) { z-index: 4; } /* title */
.search-inline-field:nth-child(6) { z-index: 3; } /* comment */
.search-inline-field:nth-child(7) { z-index: 2; } /* sort */

.search-inline-actions {
  display: flex;
  align-items: flex-end;
  gap: 0.35rem;
  flex: 0 0 auto;
  padding-bottom: 0.05rem;
}

.search-inline-label {
  font-size: 0.68rem;
  font-weight: 400;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--color-muted-foreground);
  white-space: nowrap;
}

/* ─── Buttons (coherent pair: bordered square icons matching nav buttons) ─── */
.search-btn-submit,
.search-btn-reset {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.75rem;
  border: 1px solid var(--color-light);
  background: var(--color-card);
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color 140ms ease, border-color 140ms ease, color 140ms ease;
}

.search-btn-submit {
  color: var(--color-muted-foreground);
}

.search-btn-submit:hover,
.search-btn-submit:focus-visible {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: #ffffff;
  outline: none;
}

.search-btn-reset {
  color: var(--color-muted-foreground);
}

.search-btn-reset:hover,
.search-btn-reset:focus-visible {
  border-color: #ef4444;
  background: #ef4444;
  color: #ffffff;
  outline: none;
}

/* ─── Org panel overrides ─── */
.search-inline-org-select :deep(.home-org-inline-panel) {
  width: min(92vw, 42rem) !important;
  max-width: calc(100vw - 1.5rem) !important;
  max-height: calc(100vh - 10rem) !important;
  overflow: auto;
  left: 0 !important;
  box-shadow: 0 20px 56px rgb(2 6 23 / 0.34) !important;
  border: 1px solid var(--color-border) !important;
  border-radius: 1rem !important;
  background: var(--surface-nav-solid) !important;
}

/* At narrow widths, shift panel left to align with viewport left edge */
@media (max-width: 960px) {
  .search-inline-org-select :deep(.home-org-inline-panel) {
    left: calc(-1 * var(--org-field-left, 0px) + 0.75rem) !important;
    right: auto !important;
    width: calc(100vw - 1.5rem) !important;
    max-width: calc(100vw - 1.5rem) !important;
  }
}

@media (max-width: 640px) {
  .search-inline-org-select :deep(.home-org-inline-panel) {
    left: calc(-1 * var(--org-field-left, 0px) + 0.75rem) !important;
    right: auto !important;
    width: calc(100vw - 1.5rem) !important;
    max-width: calc(100vw - 1.5rem) !important;
  }
}

.search-inline-org-select :deep(.home-org-trigger) {
  border-color: var(--color-light) !important;
  background: var(--color-card) !important;
  min-width: 0 !important;
  max-width: 100% !important;
}

.search-inline-org-select :deep(.home-org-trigger-open) {
  box-shadow: none !important;
  outline: none !important;
}

.search-inline-org-select :deep(.home-org-select-card) {
  border: none !important;
  background: transparent !important;
  -webkit-backdrop-filter: none !important;
  backdrop-filter: none !important;
  box-shadow: none !important;
}

.search-inline-org-select :deep(.home-org-select-card .select-card) {
  background: transparent !important;
}

.search-inline-org-select :deep(.home-org-select-card .select-card-content),
.search-inline-org-select :deep(.home-org-select-card .select-card-body),
.search-inline-org-select :deep(.home-org-quick-select),
.search-inline-org-select :deep(.home-org-select-scroll .scroll-area-viewport-native),
.search-inline-org-select :deep(.home-org-select-scroll .scroll-area-viewport) {
  background: transparent !important;
}

.search-inline-org-select :deep(.home-org-select-scroll) {
  height: auto !important;
  max-height: min(40vh, 22rem) !important;
}

.search-inline-org-select :deep(.home-org-select-scroll .scroll-area-viewport) {
  height: auto !important;
  max-height: min(40vh, 22rem) !important;
}

.search-inline-org-select :deep(.home-org-select-card .select-card-search-input) {
  background: var(--colorbg) !important;
}

/* ─── Channel chip-input combobox ─── */
.search-channel-combobox {
  position: relative;
  display: flex;
  align-items: center;
  height: 2.5rem;
  border: 1px solid var(--color-light);
  border-radius: 0.75rem;
  background: var(--color-card);
  padding: 0 0.5rem;
  cursor: text;
  gap: 0.25rem;
  transition: border-color 150ms ease;
}

.search-channel-combobox:focus-within,
.search-channel-combobox-open {
  border-color: var(--color-primary);
}

.search-channel-inner {
  display: flex;
  flex: 1 1 auto;
  gap: 0.25rem;
  align-items: center;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
  white-space: nowrap;
}

.search-channel-inner::-webkit-scrollbar {
  display: none;
}

.search-channel-text-input {
  flex: 1 1 40px;
  min-width: 40px;
  background: transparent;
  border: none;
  outline: none;
  font-size: 0.8rem;
  color: var(--color-foreground);
  height: 1.5rem;
  padding: 0;
}

.search-channel-text-input::placeholder {
  color: var(--color-muted-foreground);
  font-size: 0.8rem;
}

.search-channel-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  background: var(--surface-soft);
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  padding: 0.05rem 0.2rem 0.05rem 0.35rem;
  font-size: 0.68rem;
  max-width: 7rem;
  flex-shrink: 0;
}

.search-channel-chip-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-foreground);
}

.search-channel-chip-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-muted-foreground);
  padding: 0;
  line-height: 1;
}

.search-channel-chip-remove:hover {
  color: var(--color-foreground);
}

.search-channel-chevron {
  flex-shrink: 0;
  color: var(--color-muted-foreground);
  display: flex;
  align-items: center;
}

.search-channel-panel {
  position: absolute;
  top: calc(100% + 0.35rem);
  left: 0;
  z-index: 360;
  background: var(--colorbg);
  border: 1px solid var(--color-light);
  border-radius: 0.75rem;
  box-shadow: none;
  max-height: 18rem;
  overflow-y: auto;
  padding: 0 0.3rem 0.5rem;
  min-width: 100%;
  width: max(100%, 20rem);
}

.search-channel-suggestions {
  display: flex;
  flex-direction: column;
  padding-top: 0.25rem;
}

.search-channel-suggestion {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.35rem 0.6rem;
  border-radius: 0.5rem;
  text-align: left;
  font-size: 0.8rem;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-foreground);
  transition: background-color 120ms ease;
}

.search-channel-suggestion:hover,
.search-channel-suggestion:focus {
  background: var(--color-base);
  outline: none;
}

.search-channel-suggestion-avatar {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 999px;
  object-fit: cover;
  flex-shrink: 0;
  background: var(--color-base);
}

.search-channel-suggestion-icon {
  width: 1.1rem;
  height: 1.1rem;
  flex-shrink: 0;
  color: var(--color-muted-foreground);
}

.search-channel-suggestion-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.search-channel-selected-section {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  padding: 0.5rem 0.35rem;
  border-bottom: 1px solid var(--color-light);
}

.search-channel-selected-section.search-channel-selected-no-divider {
  border-bottom: none;
}

.search-channel-selected-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  background: var(--surface-soft);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 0.25rem 0.5rem 0.25rem 0.3rem;
  font-size: 0.78rem;
  color: var(--color-foreground);
  max-width: 100%;
}

.search-channel-tag-avatar {
  width: 1.15rem;
  height: 1.15rem;
  border-radius: 999px;
  object-fit: cover;
  flex-shrink: 0;
  background: var(--color-base);
}

.search-channel-tag-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.search-channel-tag-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-muted-foreground);
  padding: 0;
  line-height: 1;
}

.search-channel-tag-remove:hover {
  color: var(--color-foreground);
}

.search-channel-empty {
  padding: 0.45rem 0.65rem;
  font-size: 0.8rem;
  color: var(--color-muted-foreground);
}

/* ─── Topic count badge ─── */
.search-topic-count {
  display: inline-flex;
  align-items: center;
  margin-left: auto;
  padding: 0 0.4rem;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--surface-soft);
  color: var(--color-foreground);
  font-size: 0.65rem;
  font-weight: 600;
  line-height: 1.5;
  letter-spacing: 0.04em;
  flex-shrink: 0;
}
</style>
