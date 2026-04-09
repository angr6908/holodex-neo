<template>
  <div ref="root" class="relative">
    <UiButton
      v-if="!hideTrigger"
      type="button"
      :variant="buttonVariant"
      :class-name="resolvedButtonClass"
      :aria-haspopup="inline ? 'listbox' : 'dialog'"
      :aria-expanded="isOpen ? 'true' : 'false'"
      @click="handleTriggerClick"
    >
      <template v-if="iconOnly">
        <UiIcon :icon="mdiDomain" size="sm" class-name="home-org-trigger-icon" />
      </template>
      <template v-else>
        <span class="min-w-0 flex flex-1 items-center gap-2">
          <UiIcon :icon="mdiDomain" size="sm" class-name="home-org-trigger-icon" />
          <span class="min-w-0 truncate text-left">{{ triggerLabel }}</span>
        </span>
        <span class="shrink-0 flex items-center gap-2">
          <UiIcon
            :icon="mdiChevronDown"
            size="sm"
            :class-name="`home-org-trigger-chevron ${isOpen ? 'home-org-trigger-chevron-open' : ''}`"
          />
        </span>
      </template>
    </UiButton>

    <teleport to="body" :disabled="inline">
      <transition :name="inline ? 'home-org-inline' : 'home-org-backdrop'">
        <div
          v-if="isOpen"
          :class="inline
            ? 'home-org-inline-panel absolute left-0 top-[calc(100%+0.5rem)] z-[360] w-[min(94vw,58rem)] max-w-[58rem]'
            : 'fixed inset-0 z-[110] flex items-center justify-center overflow-hidden p-4 backdrop-blur-sm'"
          :style="inline ? undefined : 'background-color: var(--overlay-backdrop);'"
          @click.self="!inline && closeDialog()"
        >
          <transition name="home-org-panel" appear>
            <div :class="inline ? 'w-full' : 'w-full max-w-[min(94vw,58rem)]'">
              <SelectCard
                class="home-org-select-card"
                :show-search="true"
                :search-value="search"
                search-placeholder="Search organizations"
                :show-clear="true"
                :clear-disabled="workingSelectedNames.length === 0"
                :clear-aria-label="`Reset to ${clearSelectionLabel}`"
                :scroll-options="false"
                @update:searchValue="search = $event"
                @clear="clearSelection"
              >
                <template #selectedTags>
                  <transition-group
                    v-if="workingSelectedNames.length > 0"
                    name="home-org-chip"
                    tag="div"
                    class="select-card-chip-flow"
                  >
                    <div
                      v-for="name in workingSelectedNames"
                      :key="name"
                      class="settings-check-chip settings-check-chip-selected select-card-chip-compact"
                    >
                      <span class="settings-check-chip-indicator" />
                      <span class="select-card-chip-label">{{ displayOrgName(name) }}</span>
                      <button
                        type="button"
                        class="select-card-chip-meta select-card-chip-remove select-card-chip-remove-btn"
                        :aria-label="`Remove ${name}`"
                        @click.stop="toggleName(name)"
                      >
                        <UiIcon :icon="mdiClose" size="xs" />
                      </button>
                    </div>
                  </transition-group>
                </template>

                <template #options>
                  <div class="space-y-0">
                    <div
                      v-if="quickSelectOptions.length > 0"
                      class="home-org-quick-select px-1 py-2"
                    >
                      <div class="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--color-muted-foreground)]">
                        Quick Select
                      </div>
                      <div class="select-card-chip-flow">
                        <button
                          v-if="quickSelectAllOption"
                          :key="quickSelectAllOption.key"
                          type="button"
                          class="settings-check-chip select-card-chip-compact"
                          :class="{ 'settings-check-chip-selected': isQuickSelected(quickSelectAllOption) }"
                          @click="toggleQuickSelect(quickSelectAllOption)"
                        >
                          <span class="settings-check-chip-indicator" />
                          <span class="select-card-chip-label">{{ quickSelectAllOption.label }}</span>
                        </button>
                        <UiSeparator
                          v-if="quickSelectAllOption && quickSelectOrgOptions.length"
                          orientation="vertical"
                          class-name="home-org-quick-separator"
                        />
                        <button
                          v-for="option in quickSelectOrgOptions"
                          :key="option.key"
                          type="button"
                          class="settings-check-chip select-card-chip-compact"
                          :class="{ 'settings-check-chip-selected': isQuickSelected(option) }"
                          @click="toggleQuickSelect(option)"
                        >
                          <span class="settings-check-chip-indicator" />
                          <span class="select-card-chip-label">{{ option.label }}</span>
                        </button>
                      </div>
                      <div class="home-org-quick-select-divider" aria-hidden="true" />
                    </div>
                    <UiScrollArea
                      class-name="home-org-select-scroll h-[40vh] md:h-[44vh]"
                      :native-scrollbar="true"
                    >
                      <transition-group
                        name="home-org-option"
                        tag="div"
                        class="select-card-chip-flow pr-1 pt-2"
                      >
                        <button
                          v-for="org in filteredOrgs"
                          :key="org.name"
                          type="button"
                          class="settings-check-chip select-card-chip-compact"
                          :class="{ 'settings-check-chip-selected': isSelected(org.name) }"
                          @click="toggleName(org.name)"
                        >
                          <span class="settings-check-chip-indicator" />
                          <span class="select-card-chip-label">{{ displayOrgName(org.name) }}</span>
                        </button>
                      </transition-group>
                    </UiScrollArea>
                  </div>
                </template>

                <template #footer>
                  <div v-if="filteredOrgs.length === 0" class="text-xs text-[color:var(--color-muted-foreground)]">
                    No organizations found
                  </div>
                </template>
              </SelectCard>
            </div>
          </transition>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import UiButton from "@/components/ui/button/Button.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import UiScrollArea from "@/components/ui/scroll-area/ScrollArea.vue";
import UiSeparator from "@/components/ui/separator/Separator.vue";
import SelectCard from "@/components/setting/SelectCard.vue";
import { formatOrgDisplayName } from "@/utils/functions";
import { mdiChevronDown, mdiClose, mdiDomain } from "@mdi/js";
import { useOrgsStore } from "@/stores/orgs";
import { useAppStore } from "@/stores/app";

defineOptions({ name: "HomeOrgMultiSelect" });

const props = withDefaults(defineProps<{
  hideTrigger?: boolean;
  buttonVariant?: string;
  buttonClass?: string;
  iconOnly?: boolean;
  emptySelectionLabel?: string;
  clearSelectionLabel?: string;
  fallbackSelection?: string[];
  selectedNamesOverride?: string[] | null;
  manualApply?: boolean;
  inline?: boolean;
}>(), {
  hideTrigger: false,
  buttonVariant: "secondary",
  buttonClass: "h-10 min-w-[12rem] px-3",
  iconOnly: false,
  emptySelectionLabel: "All Vtubers",
  clearSelectionLabel: "All Vtubers",
  fallbackSelection: () => [],
  selectedNamesOverride: null,
  manualApply: false,
  inline: false,
});

const emit = defineEmits<{
  (e: "apply", value: string[]): void;
}>();

const root = ref<HTMLElement | null>(null);
const allSelectionKey = "__all_selection__";
const isOpen = ref(false);
const search = ref("");
const draftSelectedNames = ref<string[]>([]);
const bodyScrollLocked = ref(false);
const previousHtmlOverflow = ref("");
const previousBodyOverflow = ref("");
const previousBodyPaddingRight = ref("");

const orgs = computed(() =>
  (useOrgsStore().orgs || []).filter((org) => org.name !== "All Vtubers"),
);

const selectedNames = computed(() =>
  props.selectedNamesOverride || useAppStore().selectedHomeOrgs || [],
);

const workingSelectedNames = computed(() =>
  isOpen.value ? draftSelectedNames.value : selectedNames.value,
);

const quickSelectOrgNames = computed(() => {
  const preferred = ["Hololive", "Nijisanji", "VSpo", "Neo-Porte", "774inc", "RK Music", "Riot Music"];
  const available = new Set(orgs.value.map((org) => org.name));
  return preferred.filter((name) => available.has(name));
});

const quickSelectOptions = computed(() => {
  const options = quickSelectOrgNames.value.map((name) => ({
    key: name,
    type: "org",
    value: name,
    label: getOrgLabel(name),
  }));
  if (props.fallbackSelection.length === 0) {
    return [{
      key: allSelectionKey,
      type: "all",
      value: null as string | null,
      label: props.clearSelectionLabel,
    }, ...options];
  }
  return options;
});

const quickSelectAllOption = computed(() =>
  quickSelectOptions.value.find((option) => option.type === "all") || null,
);

const quickSelectOrgOptions = computed(() =>
  quickSelectOptions.value.filter((option) => option.type === "org"),
);

const filteredOrgs = computed(() => {
  const query = search.value.trim().toLowerCase();
  if (!query) return orgs.value;
  return orgs.value.filter((org) =>
    [org.name, org.short, org.name_jp]
      .filter(Boolean)
      .some((value) => (value as string).toLowerCase().includes(query)),
  );
});

const triggerLabel = computed(() => {
  if (selectedNames.value.length === 0) return props.emptySelectionLabel;
  if (selectedNames.value.length === 1) return displayOrgName(selectedNames.value[0]);
  if (selectedNames.value.length === 2) {
    return selectedNames.value.map((name) => displayOrgName(name)).join(" + ");
  }
  return `${selectedNames.value.length} Groups`;
});

const resolvedButtonClass = computed(() => [
  "home-org-trigger rounded-xl",
  props.iconOnly ? "justify-center" : "justify-between",
  isOpen.value ? "home-org-trigger-open" : "",
  props.buttonClass,
].join(" "));

function handleTriggerClick() {
  if (props.inline && isOpen.value) {
    closeDialog();
    return;
  }
  openDialog();
}

function lockPageScroll() {
  if (bodyScrollLocked.value || typeof window === "undefined" || !document?.body) return;
  const html = document.documentElement;
  const body = document.body;
  previousHtmlOverflow.value = html.style.overflow;
  previousBodyOverflow.value = body.style.overflow;
  previousBodyPaddingRight.value = body.style.paddingRight;
  const scrollbarWidth = Math.max(0, window.innerWidth - html.clientWidth);
  html.style.overflow = "hidden";
  body.style.overflow = "hidden";
  if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
  bodyScrollLocked.value = true;
}

function unlockPageScroll() {
  if (!bodyScrollLocked.value || !document?.body) return;
  const html = document.documentElement;
  const body = document.body;
  html.style.overflow = previousHtmlOverflow.value;
  body.style.overflow = previousBodyOverflow.value;
  body.style.paddingRight = previousBodyPaddingRight.value;
  bodyScrollLocked.value = false;
}

function handleWindowKeydown(event: KeyboardEvent) {
  if (!isOpen.value) return;
  if (event.key === "Escape") closeDialog();
}

function handleWindowPointerDown(event: PointerEvent) {
  if (!props.inline || !isOpen.value) return;
  if (root.value && !root.value.contains(event.target as Node)) closeDialog();
}

async function openDialog() {
  if (!orgs.value.length) await useOrgsStore().fetchOrgs();
  draftSelectedNames.value = selectedNames.value.length
    ? [...selectedNames.value]
    : [...props.fallbackSelection];
  isOpen.value = true;
  if (!props.inline) lockPageScroll();
}

function closeDialog() {
  applySelection();
  isOpen.value = false;
  search.value = "";
  if (!props.inline) unlockPageScroll();
}

function isSelected(name: string) {
  return workingSelectedNames.value.includes(name);
}

function isQuickSelected(option: { type: string; value: string | null }) {
  if (option.type === "all") return workingSelectedNames.value.length === 0;
  return isSelected(option.value as string);
}

function getOrgLabel(name: string) {
  const org = orgs.value.find((item) => item.name === name);
  return displayOrgName(org?.name || name);
}

function displayOrgName(name: string) {
  return formatOrgDisplayName(name);
}

function toggleQuickSelect(option: { type: string; value: string | null }) {
  if (option.type === "all") {
    clearSelection();
    return;
  }
  toggleName(option.value as string);
}

function toggleName(name: string) {
  if (draftSelectedNames.value.includes(name)) {
    draftSelectedNames.value = draftSelectedNames.value.filter((v) => v !== name);
    if (props.inline) applySelection();
    return;
  }
  draftSelectedNames.value = [...draftSelectedNames.value, name];
  if (props.inline) applySelection();
}

function clearSelection() {
  draftSelectedNames.value = [...props.fallbackSelection];
  if (props.inline) applySelection();
}

function applySelection() {
  const nextSelection = [...new Set(draftSelectedNames.value)];
  const prevSelection = [...selectedNames.value];
  const changed = nextSelection.length !== prevSelection.length
    || nextSelection.some((name, index) => name !== prevSelection[index]);
  if (!changed) return;
  if (props.manualApply) {
    emit("apply", nextSelection);
    return;
  }
  useAppStore().setSelectedHomeOrgs(nextSelection);
}

onMounted(() => {
  window.addEventListener("keydown", handleWindowKeydown);
  window.addEventListener("pointerdown", handleWindowPointerDown);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleWindowKeydown);
  window.removeEventListener("pointerdown", handleWindowPointerDown);
  unlockPageScroll();
});
</script>

<style scoped>
.home-org-trigger {
  border-color: var(--color-light) !important;
  background: var(--color-card) !important;
  color: var(--color-muted-foreground) !important;
  cursor: pointer;
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
  transition: border-color 180ms ease, background-color 180ms ease, color 180ms ease, box-shadow 180ms ease;
}

.home-org-trigger:hover {
  border-color: var(--color-bold) !important;
  background: var(--color-base) !important;
  color: var(--color-foreground) !important;
}

.home-org-trigger-open {
  border-color: var(--color-bold) !important;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-bold) 22%, transparent);
}

.home-org-trigger-icon {
  color: var(--color-primary);
  opacity: 0.95;
}

.home-org-trigger-chevron {
  color: var(--color-muted-foreground);
  transition: transform 180ms ease, color 180ms ease;
}

.home-org-trigger-chevron-open {
  transform: rotate(180deg);
  color: var(--color-foreground);
}

.home-org-select-card {
  border-color: var(--color-border) !important;
  background: var(--surface-nav) !important;
  -webkit-backdrop-filter: blur(24px);
  backdrop-filter: blur(24px);
  box-shadow: 0 20px 56px rgb(2 6 23 / 0.34);
}

.home-org-select-card :deep(.select-card) {
  border-color: var(--color-border) !important;
  background: transparent !important;
}

.home-org-select-card :deep(.select-card-search-input) {
  background: color-mix(in srgb, var(--surface-nav) 78%, transparent) !important;
}

.home-org-quick-select {
  position: relative;
  background: transparent;
}

.home-org-quick-select-divider {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 1px;
  background: color-mix(in srgb, var(--color-border) 72%, transparent 28%);
  pointer-events: none;
}

.home-org-quick-separator {
  height: 1.25rem;
  align-self: center;
  opacity: 0.9;
}

.home-org-select-scroll :deep(.scroll-area-viewport) {
  overscroll-behavior: contain;
}

.home-org-backdrop-enter-active,
.home-org-backdrop-leave-active {
  transition: opacity 180ms ease;
}

.home-org-backdrop-enter-from,
.home-org-backdrop-leave-to {
  opacity: 0;
}

.home-org-inline-enter-active,
.home-org-inline-leave-active {
  transition: opacity 160ms ease;
}

.home-org-inline-enter-from,
.home-org-inline-leave-to {
  opacity: 0;
}

.home-org-panel-enter-active,
.home-org-panel-leave-active {
  transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms ease;
}

.home-org-panel-enter-from,
.home-org-panel-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.985);
}

.home-org-chip-enter-active,
.home-org-chip-leave-active {
  transition: transform 170ms ease, opacity 170ms ease;
}

.home-org-chip-enter-from,
.home-org-chip-leave-to {
  opacity: 0;
  transform: translateY(4px) scale(0.96);
}

.home-org-option-enter-active,
.home-org-option-leave-active {
  transition: transform 150ms ease, opacity 150ms ease;
}

.home-org-option-enter-from,
.home-org-option-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>
