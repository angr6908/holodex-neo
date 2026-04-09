<template>
  <div ref="menuRoot" class="relative" :class="horizontal ? 'w-auto' : 'w-full'">
    <UiButton
      type="button"
      :variant="horizontal ? 'secondary' : 'outline'"
      :class-name="buttonClass"
      :title="simpleMode ? 'Select organization' : undefined"
      @click="toggleMenu"
    >
      <template v-if="simpleMode && horizontal">
        <UiIcon :icon="icons.mdiDomain" size="sm" />
      </template>
      <template v-else>
        <span class="flex min-w-0 items-center gap-2 truncate">
          <UiIcon v-if="currentTab.name === 'Favorites'" :icon="icons.mdiHeart" size="sm" />
          <UiIcon v-else-if="currentTab.name === 'Playlist'" :icon="icons.mdiPlaylistPlay" size="sm" />
          <UiIcon v-else-if="currentTab.name === 'YouTubeURL'" :icon="icons.mdiYoutube" size="sm" />
          <UiIcon v-else-if="currentTab.name === 'TwitchURL'" :icon="mdiTwitch" size="sm" />
          <UiIcon v-else-if="currentTab.name === 'MultiOrg'" :icon="icons.mdiViewGridPlus" size="sm" />
          <span class="truncate">{{ currentLabel }}</span>
        </span>
        <UiIcon :icon="icons.mdiMenuDown" size="sm" class-name="text-slate-400" />
      </template>
    </UiButton>

    <UiCard
      v-if="menuOpen"
      class-name="absolute left-0 top-full z-[130] mt-2 w-[min(92vw,24rem)] border border-white/10 bg-slate-950 p-3 shadow-2xl shadow-slate-950/85 backdrop-blur-none"
    >
      <div class="grid gap-2 sm:grid-cols-2">
        <button
          v-for="tab in quickTabs"
          :key="tab.name"
          type="button"
          class="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition"
          :class="isCurrentTab(tab)
            ? 'border-sky-400/50 bg-sky-400/12 text-white'
            : 'border-white/10 bg-slate-900 text-slate-100 hover:bg-slate-800'"
          @click="selectTab(tab)"
        >
          <UiIcon
            :icon="tab.name === 'Favorites'
              ? icons.mdiHeart
              : tab.name === 'Playlist'
                ? icons.mdiPlaylistPlay
                : tab.name === 'YouTubeURL'
                  ? icons.mdiYoutube
                  : mdiTwitch"
            size="sm"
          />
          <span class="truncate">{{ tab.text }}</span>
        </button>
      </div>

      <button
        type="button"
        class="mt-3 flex w-full items-center justify-between rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-left transition hover:bg-slate-800"
        @click="openFeedDialog"
      >
        <div class="min-w-0">
          <div class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Feed organizations
          </div>
          <div class="truncate text-sm text-white">
            {{ feedLabel }}
          </div>
        </div>
        <UiIcon :icon="icons.mdiChevronRight" size="sm" class-name="text-slate-400" />
      </button>
    </UiCard>
    <HomeOrgMultiSelect
      ref="feedSelector"
      hide-trigger
      manual-apply
      :selected-names-override="selectedHomeOrgs"
      :fallback-selection="[hololiveName]"
      empty-selection-label="Hololive"
      clear-selection-label="Hololive"
      dialog-description="Combine one or more orgs into the multiview source list."
      @apply="applyFeedSelection"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import { mdiTwitch } from "@mdi/js";
import HomeOrgMultiSelect from "@/components/common/HomeOrgMultiSelect.vue";
import UiButton from "@/components/ui/button/Button.vue";
import UiCard from "@/components/ui/card/Card.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import { formatOrgDisplayName } from "@/utils/functions";
import { useAppStore } from "@/stores/app";
import { useOrgsStore } from "@/stores/orgs";

defineOptions({ name: "OrgPanelPicker" });

const props = defineProps<{
  horizontal?: boolean;
  /** When true, hides quick-tab shortcuts (Fav/Playlist/URL) from the dropdown — they live as separate buttons. */
  simpleMode?: boolean;
}>();

const emit = defineEmits<{
  (e: "changed", tab: any): void;
}>();

const { t } = useI18n();
const appStore = useAppStore();
const orgsStore = useOrgsStore();

const SPECIAL_TAB_NAMES = new Set(["Favorites", "Playlist", "YouTubeURL", "TwitchURL", "MultiOrg"]);

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

const menuOpen = ref(false);
const currentTab = ref<any>(
  initialSelectedHomeOrgs.length > 1
    ? makeMultiOrgTab(initialSelectedHomeOrgs)
    : getSingleSelectionOrg(),
);
const favTab = { name: "Favorites", text: t("component.mainNav.favorites") };
const playlistTab = { name: "Playlist", text: t("component.mainNav.playlist") };
const ytTab = { name: "YouTubeURL", text: "YouTube URL" };
const twitchTab = { name: "TwitchURL", text: "Twitch URL" };

const menuRoot = ref<HTMLElement | null>(null);
const feedSelector = ref<any>(null);

const buttonClass = computed(() => {
  if (props.simpleMode && props.horizontal) {
    return "h-8 w-8 justify-center gap-0 overflow-hidden rounded-xl px-0 text-sm";
  }
  return props.horizontal
    ? "h-9 min-w-[170px] max-w-[18rem] justify-between gap-2 overflow-hidden rounded-xl px-3 text-sm"
    : "h-9 w-full justify-between gap-2 overflow-hidden rounded-xl px-3 text-sm";
});

const currentOrg = computed(() => appStore.currentOrg);
const selectedHomeOrgs = computed(() => appStore.selectedHomeOrgs || []);

const currentLabel = computed(() => {
  if (currentTab.value.name === "YouTubeURL" || currentTab.value.name === "TwitchURL") return "URL";
  return currentTab.value.text || formatOrgDisplayName(currentTab.value.name);
});

const feedLabel = computed(() => {
  return makeMultiOrgLabel(selectedHomeOrgs.value.length ? selectedHomeOrgs.value : [getSingleSelectionOrg().name]);
});

const hololiveName = computed(() => getHololiveOrg().name);

const quickTabs = computed(() => props.simpleMode ? [] : [favTab, playlistTab, ytTab, twitchTab]);

const orgs = computed(() => (orgsStore.orgs || []).filter((org: any) => org.name !== "All Vtubers"));

watch(currentTab, (newVal, oldVal) => {
  const newKey = `${newVal?.name || ""}:${newVal?.text || ""}`;
  const oldKey = `${oldVal?.name || ""}:${oldVal?.text || ""}`;
  if (newKey !== oldKey) emit("changed", newVal);
}, { deep: true });

watch(selectedHomeOrgs, (newVal) => {
  if (newVal.length > 1) {
    currentTab.value = makeMultiOrgTab(newVal);
    return;
  }
  if (currentTab.value?.name === "MultiOrg") {
    currentTab.value = getSingleSelectionOrg();
  }
});

watch(currentOrg, () => {
  if (!SPECIAL_TAB_NAMES.has(currentTab.value?.name)) {
    currentTab.value = getSingleSelectionOrg();
  }
});

onMounted(() => {
  window.addEventListener("click", handleWindowClick);
  emit("changed", currentTab.value);
});

onBeforeUnmount(() => {
  window.removeEventListener("click", handleWindowClick);
});

function isCurrentTab(tab: any) {
  return currentTab.value?.name === tab.name;
}

async function toggleMenu() {
  if (!menuOpen.value) await ensureOrgsLoaded();
  menuOpen.value = !menuOpen.value;
}

function handleWindowClick(event: MouseEvent) {
  if (menuOpen.value && menuRoot.value && !menuRoot.value.contains(event.target as Node)) {
    menuOpen.value = false;
  }
}

async function ensureOrgsLoaded() {
  if (!orgs.value.length) {
    await orgsStore.fetchOrgs();
  }
}

function selectTab(tab: any) {
  currentTab.value = tab;
  menuOpen.value = false;
}

async function openFeedDialog() {
  await ensureOrgsLoaded();
  menuOpen.value = false;
  feedSelector.value?.openDialog?.();
}

function applyFeedSelection(nextSelectionInput: string[]) {
  const nextSelection = [...new Set(nextSelectionInput)].filter(Boolean);
  const fallbackOrg = getHololiveOrg();

  if (nextSelection.length > 1) {
    appStore.setSelectedHomeOrgs(nextSelection);
    appStore.setCurrentOrg(orgs.value.find((org: any) => org.name === nextSelection[0]) || fallbackOrg);
    currentTab.value = makeMultiOrgTab(nextSelection);
  } else {
    const nextName = nextSelection[0] || fallbackOrg.name;
    const nextOrg = orgs.value.find((org: any) => org.name === nextName) || fallbackOrg;
    appStore.setSelectedHomeOrgs([nextOrg.name]);
    appStore.setCurrentOrg(nextOrg);
    currentTab.value = nextOrg;
  }
}
</script>
