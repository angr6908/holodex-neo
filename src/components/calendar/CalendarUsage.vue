<template>
  <div ref="rootEl" class="space-y-4">
    <div class="relative">
      <SelectCard>
        <template #title>
          <div class="flex items-center gap-2 text-sm text-[color:var(--color-muted-foreground)]">
            <UiIcon :icon="mdiFilter" class-name="h-4 w-4" />
            <span>Filter by Topic, Org, Channel ...</span>
          </div>
        </template>

        <template #options>
          <div v-if="query.length" class="select-card-chip-flow">
            <div
              v-for="item in query"
              :key="item.value"
              class="settings-check-chip settings-check-chip-selected select-card-chip-compact"
            >
              <span class="settings-check-chip-indicator" />
              <span class="select-card-chip-meta">{{ i18nItem(item.type) }}</span>
              <span class="select-card-chip-label truncate">{{ item.text }}</span>
              <button
                type="button"
                class="select-card-chip-meta select-card-chip-remove select-card-chip-remove-btn"
                @click.stop="deleteChip(item)"
              >
                <UiIcon :icon="icons.mdiClose" class-name="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <UiInput
            v-model="searchInput"
            placeholder="Topic, org, or channel"
            class-name="h-9 border-[color:var(--color-light)] bg-[color:var(--color-card)]"
            @focus="openMenu = true"
          />
        </template>
      </SelectCard>

      <div
        v-if="openMenu && (results.length || isLoading)"
        class="absolute inset-x-0 top-[calc(100%+0.35rem)] z-30 overflow-hidden rounded-[calc(var(--radius)+4px)] border border-[color:var(--color-border)] bg-[color:var(--color-popover)] shadow-2xl shadow-slate-950/30"
      >
        <div
          v-if="isLoading"
          class="px-4 py-2 text-xs text-[color:var(--color-muted-foreground)]"
        >
          Loading...
        </div>
        <button
          v-for="item in results"
          :key="item.value"
          type="button"
          class="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-[color:var(--color-foreground)] transition hover:bg-[color:var(--surface-soft)]"
          @click="addItem(item)"
        >
          <UiIcon v-if="getItemIcon(item.type)" :icon="getItemIcon(item.type)" class-name="h-4 w-4 text-[color:var(--color-muted-foreground)]" />
          <span class="text-[color:var(--color-muted-foreground)]">{{ i18nItem(item.type) }}</span>
          <span>{{ item.text }}</span>
        </button>
      </div>
    </div>

    <div class="space-y-2">
      <label class="text-sm text-[color:var(--color-muted-foreground)]">Live Calendar (iCal)</label>
      <button
        type="button"
        class="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-left text-sm text-[color:var(--color-foreground)]"
        @click.stop="copyToClipboard(liveCalendarURL)"
      >
        <span class="truncate">{{ liveCalendarURL }}</span>
        <UiIcon :icon="mdiClipboardPlusOutline" class-name="ml-3 h-4 w-4 shrink-0 text-[color:var(--color-primary)]" />
      </button>
    </div>

    <div v-if="isLoggedIn && showFavoritesCalendar" class="space-y-2">
      <label class="text-sm text-[color:var(--color-muted-foreground)]">Favorites Calendar (iCal)</label>
      <button
        type="button"
        class="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-left text-sm text-[color:var(--color-foreground)]"
        @click.stop="copyToClipboard(favoritesCalendarURL)"
      >
        <span class="truncate">{{ favoritesCalendarURL }}</span>
        <UiIcon :icon="mdiClipboardPlusOutline" class-name="ml-3 h-4 w-4 shrink-0 text-[color:var(--color-primary)]" />
      </button>
    </div>

    <div
      v-if="snackbar"
      class="fixed bottom-6 right-6 z-50 rounded-xl border border-emerald-400/25 bg-emerald-500/20 px-4 py-3 text-sm text-emerald-100 shadow-xl"
    >
      {{ t("component.videoCard.copiedToClipboard") }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import backendApi from "@/utils/backend-api";
import debounce from "lodash-es/debounce";
import {
  mdiAccountMultiple,
  mdiTextSearch,
  mdiFilter,
  mdiCommentSearch,
  mdiClipboardPlusOutline,
} from "@mdi/js";
import * as icons from "@/utils/icons";
import { useAppStore } from "@/stores/app";
import { useSettingsStore } from "@/stores/settings";
import UiIcon from "@/components/ui/icon/Icon.vue";
import UiInput from "@/components/ui/input/Input.vue";
import SelectCard from "@/components/setting/SelectCard.vue";

const props = withDefaults(defineProps<{
  initialQuery?: any[];
  showFavoritesCalendar?: boolean;
}>(), {
  initialQuery: undefined,
  showFavoritesCalendar: true,
});

const { t } = useI18n();
const appStore = useAppStore();
const settingsStore = useSettingsStore();

const rootEl = ref<HTMLElement | null>(null);
const query = ref<any[]>([]);
const fromApi = ref<any[]>([]);
const searchInput = ref<string | null>(null);
const isLoading = ref(false);
const snackbar = ref(false);
const openMenu = ref(false);
let searchRequestId = 0;

const results = computed(() => {
  const selected = new Set((query.value || []).map((item) => item.value));
  return (fromApi.value || []).filter((item) => !selected.has(item.value));
});

const isLoggedIn = computed(() => appStore.isLoggedIn);

const preferEnglishName = computed({
  get() {
    return settingsStore.useEnName;
  },
  set(val: boolean) {
    settingsStore.setUseEnName(val);
  },
});

const liveCalendarURL = computed(() => {
  const bucket = query.value.reduce((b: any, { type, value }: any) => {
    b[type] ||= [];
    b[type].push(value);
    return b;
  }, {});

  const params = {
    ...bucket,
    ...(preferEnglishName.value ? { preferEnglishName: 1 } : null),
  };
  return `https://holodex.net/live.ics?${new URLSearchParams(
    params,
  ).toString()}`;
});

const favoritesCalendarURL = computed(() => {
  const jwt = appStore.userdata?.jwt;
  if (!jwt) {
    return "Login required to use favorites calendar feed.";
  }
  const params = {
    jwt,
    ...(preferEnglishName.value ? { preferEnglishName: 1 } : null),
  };
  return `https://holodex.net/favorites.ics?${new URLSearchParams(
    params,
  ).toString()}`;
});

async function runSearch(formatted: string) {
  const requestId = ++searchRequestId;
  try {
    const channels = await fetchAutocomplete(formatted);
    if (requestId !== searchRequestId) return;
    fromApi.value = channels.filter(
      (x: any) => x.type === "topic" || x.type === "channel" || x.type === "org",
    );
  } catch (e) {
    if (requestId === searchRequestId) {
      fromApi.value = [];
    }
    console.error(e);
  } finally {
    if (requestId === searchRequestId) {
      isLoading.value = false;
      openMenu.value = fromApi.value.length > 0;
    }
  }
}

const debouncedSearch = debounce(runSearch, 300);

function handleSearchInput(val: string | null) {
  const formatted = (val || "").trim().replace("#", "");
  if (!formatted) {
    fromApi.value = [];
    openMenu.value = false;
    isLoading.value = false;
    debouncedSearch?.cancel?.();
    return;
  }
  if (encodeURIComponent(formatted).length <= 1) {
    fromApi.value = [];
    openMenu.value = false;
    isLoading.value = false;
    debouncedSearch?.cancel?.();
    return;
  }
  isLoading.value = true;
  openMenu.value = true;
  debouncedSearch(formatted);
}

watch(searchInput, (val) => {
  handleSearchInput(val);
});

function handleOutsideClick(event: MouseEvent) {
  if (!rootEl.value?.contains(event.target as Node)) {
    openMenu.value = false;
  }
}

function getItemIcon(type: string) {
  switch (type) {
    case "channel":
    case "video url":
      return icons.mdiYoutube;
    case "topic":
      return icons.mdiAnimationPlay;
    case "org":
      return mdiAccountMultiple;
    case "title & desc":
      return mdiTextSearch;
    case "comments":
      return mdiCommentSearch;
    default:
      return null;
  }
}

function constrainQuery() {
  if (query.value.filter((x) => x.type === "org").length > 1) {
    query.value.splice(
      query.value.findIndex((x) => x.type === "org"),
      1,
    );
  }
}

async function copyToClipboard(url: string) {
  await navigator.clipboard.writeText(url);
  snackbar.value = true;
  setTimeout(() => {
    snackbar.value = false;
  }, 1000);
}

function addItem(item: any) {
  if (!query.value.find((entry) => entry.value === item.value)) {
    query.value.push({ ...item });
    constrainQuery();
  }
  searchInput.value = "";
  fromApi.value = [];
  openMenu.value = false;
}

async function fetchAutocomplete(q: string) {
  const res = await backendApi.searchAutocomplete(q);
  const result = res.data.map((x: any) => {
    if (!x.text) x.text = x.value;
    return x;
  });
  return result;
}

function deleteChip(item: any) {
  query.value.splice(query.value.map((q) => q.value).indexOf(item.value), 1);
}

function i18nItem(item: string) {
  switch (item) {
    case "channel":
      return t("component.search.type.channel");
    case "video url":
      return t("component.search.type.videourl");
    case "topic":
      return t("component.search.type.topic");
    case "org":
      return t("component.search.type.org");
    case "title & desc":
      return t("component.search.type.titledesc");
    case "comments":
      return t("component.search.type.comments");
    default:
      return "";
  }
}

onMounted(async () => {
  document.addEventListener("click", handleOutsideClick);
  if (props.initialQuery) {
    query.value = props.initialQuery;
  }
});

onBeforeUnmount(() => {
  document.removeEventListener("click", handleOutsideClick);
  debouncedSearch?.cancel?.();
});
</script>
