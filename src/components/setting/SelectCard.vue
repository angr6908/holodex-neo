<template>
  <div
    ref="rootEl"
    class="select-card"
  >
    <div class="flex flex-col gap-[0.45rem]">
      <div v-if="$slots.title || title || description" class="space-y-1">
        <slot name="title">
          <div class="select-card-title">
            {{ title }}
          </div>
        </slot>
        <div v-if="description" class="select-card-description">
          {{ description }}
        </div>
      </div>
      <div v-if="showSearch || showClear" class="select-card-controls">
        <UiInput
          v-if="showSearch"
          :model-value="searchValue"
          :placeholder="searchPlaceholder"
          class-name="select-card-search-input"
          @update:modelValue="emit('update:searchValue', $event)"
          @focus="emit('search-focus', $event)"
        />
        <UiButton
          v-if="showClear"
          type="button"
          variant="ghost"
          size="icon"
          class-name="select-card-clear-btn"
          :disabled="clearDisabled"
          :aria-label="clearAriaLabel"
          @click="emit('clear')"
        >
          <UiIcon :icon="mdiBroom" size="sm" />
        </UiButton>
      </div>

      <slot v-if="$slots.selectedTags" name="selectedTags" />

      <UiScrollArea
        v-if="scrollOptions"
        :class-name="scrollClassName"
        :native-scrollbar="scrollNative"
      >
        <slot name="options">
          <slot />
        </slot>
      </UiScrollArea>
      <template v-else>
        <slot name="options">
          <slot />
        </slot>
      </template>

      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUpdated, onBeforeUnmount } from "vue";
import UiButton from "@/components/ui/button/Button.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import UiInput from "@/components/ui/input/Input.vue";
import UiScrollArea from "@/components/ui/scroll-area/ScrollArea.vue";
import { mdiBroom } from "@mdi/js";

withDefaults(defineProps<{
  title?: string;
  description?: string;
  showSearch?: boolean;
  searchValue?: string;
  searchPlaceholder?: string;
  showClear?: boolean;
  clearDisabled?: boolean;
  clearAriaLabel?: string;
  scrollOptions?: boolean;
  scrollClassName?: string;
  scrollNative?: boolean;
}>(), {
  title: "",
  description: "",
  showSearch: false,
  searchValue: "",
  searchPlaceholder: "",
  showClear: false,
  clearDisabled: false,
  clearAriaLabel: "Clear",
  scrollOptions: false,
  scrollClassName: "max-h-40 pr-3",
  scrollNative: true,
});

const emit = defineEmits<{
  (e: "update:searchValue", value: string): void;
  (e: "search-focus", event: FocusEvent): void;
  (e: "clear"): void;
}>();

const rootEl = ref<HTMLElement | null>(null);
let layoutRaf = 0;
let resizeObserver: ResizeObserver | null = null;

function refreshChipGridLayout() {
  const root = rootEl.value;
  if (!root || !(root instanceof HTMLElement)) return;
  const explicitGroups = root.querySelectorAll(".select-card-chip-grid");
  const groups = explicitGroups.length ? explicitGroups : root.querySelectorAll("div");
  groups.forEach((group) => {
    const children = [...group.children];
    if (!children.length) return;
    const chips = children.filter(
      (child) => child.classList.contains("settings-check-chip") || child.classList.contains("stream-check-chip"),
    );
    if (!chips.length || chips.length !== children.length) return;
    let maxLabelWidth = 0;
    chips.forEach((chip) => {
      const label = chip.querySelector(".select-card-chip-label")
        || chip.querySelector("span:nth-of-type(2)")
        || chip.querySelector("span:last-child");
      if (!(label instanceof HTMLElement)) return;
      const meta = chip.querySelector(".select-card-chip-meta");
      const metaWidth = meta instanceof HTMLElement ? Math.ceil(meta.scrollWidth) + 8 : 0;
      maxLabelWidth = Math.max(maxLabelWidth, Math.ceil(label.scrollWidth) + metaWidth);
    });
    const indicatorWidth = 14;
    const chipGap = 9;
    const horizontalPadding = 26;
    const borderWidth = 2;
    const minWidth = Math.max(132, maxLabelWidth + indicatorWidth + chipGap + horizontalPadding + borderWidth);
    (group as HTMLElement).style.setProperty("--select-card-chip-min-width", `${minWidth}px`);
  });
}

function scheduleChipGridLayout() {
  if (layoutRaf) cancelAnimationFrame(layoutRaf);
  layoutRaf = requestAnimationFrame(() => {
    layoutRaf = 0;
    refreshChipGridLayout();
  });
}

onMounted(() => {
  scheduleChipGridLayout();
  window.addEventListener("resize", scheduleChipGridLayout, { passive: true });
  if (typeof ResizeObserver !== "undefined" && rootEl.value) {
    resizeObserver = new ResizeObserver(() => {
      scheduleChipGridLayout();
    });
    resizeObserver.observe(rootEl.value);
  }
});

onUpdated(() => {
  scheduleChipGridLayout();
});

onBeforeUnmount(() => {
  if (layoutRaf) {
    cancelAnimationFrame(layoutRaf);
    layoutRaf = 0;
  }
  window.removeEventListener("resize", scheduleChipGridLayout);
  resizeObserver?.disconnect?.();
  resizeObserver = null;
});
</script>

<style scoped>
.select-card {
  --select-card-control-height: 2.5rem;
}

.select-card-title {
  font-size: 0.68rem;
  font-weight: 400;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--color-muted-foreground);
}

.select-card-description {
  font-size: 0.75rem;
  color: var(--color-muted-foreground);
}

.select-card-controls {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

/* Match search input font size to chip font size */
.select-card :deep(.select-card-search-input) {
  font-size: 0.8rem;
  height: var(--select-card-control-height);
}

/* Add gap between content and native scrollbar so chips aren't clipped */
.select-card :deep(.scroll-area-viewport-native) {
  --scroll-area-native-gap: 6px;
}

.select-card :deep(div:has(> .settings-check-chip, > .stream-check-chip):not(.select-card-chip-flow)) {
  display: grid;
  gap: 0.5rem;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, var(--select-card-chip-min-width, 10.5rem)), 1fr));
  align-items: stretch;
}

.select-card :deep(.select-card-chip-grid) {
  display: grid;
  gap: 0.5rem;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, var(--select-card-chip-min-width, 10.5rem)), 1fr));
  align-items: stretch;
}

.select-card :deep(.select-card-chip-flow) {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: flex-start;
}

.select-card :deep(.settings-check-chip),
.select-card :deep(.stream-check-chip) {
  display: inline-flex;
  width: 100%;
  max-width: 100%;
  align-items: center;
  gap: 0.55rem;
  height: 2.2rem;
  min-height: 2.2rem;
  border-radius: 0.75rem;
  border: none;
  background: var(--color-base);
  padding: 0 0.625rem;
  color: var(--color-muted-foreground);
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 500;
  transition: background-color 160ms ease, color 160ms ease;
}

.select-card :deep(.settings-check-chip.select-card-chip-compact),
.select-card :deep(.stream-check-chip.select-card-chip-compact) {
  width: auto;
  max-width: 100%;
}

.select-card :deep(.settings-check-chip.select-card-chip-compact .select-card-chip-label),
.select-card :deep(.stream-check-chip.select-card-chip-compact .select-card-chip-label) {
  display: inline-block;
  flex: 0 1 auto;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: clip;
}

.select-card :deep(.settings-check-chip.select-card-chip-compact .select-card-chip-meta),
.select-card :deep(.stream-check-chip.select-card-chip-compact .select-card-chip-meta) {
  margin-left: 0.5rem;
  flex-shrink: 0;
}

.select-card :deep(.settings-check-chip-indicator),
.select-card :deep(.stream-check-chip-indicator) {
  height: 0.75rem;
  width: 0.75rem;
  min-width: 0.75rem;
  flex-shrink: 0;
  border-radius: 999px;
  border: 1.5px solid var(--color-muted-foreground);
  background: transparent;
  transition: background-color 160ms ease, border-color 160ms ease, transform 160ms ease;
  pointer-events: none;
}

.select-card :deep(.peer:checked + .settings-check-chip-indicator),
.select-card :deep(.peer:checked + .stream-check-chip-indicator) {
  border-color: currentColor;
  background: currentColor;
  transform: scale(1.05);
}

.select-card :deep(.settings-check-chip:hover),
.select-card :deep(.stream-check-chip:hover) {
  background: var(--color-bold);
  color: white;
}

.select-card :deep(.settings-check-chip:hover .settings-check-chip-indicator),
.select-card :deep(.stream-check-chip:hover .stream-check-chip-indicator) {
  border-color: currentColor;
}

.select-card :deep(.settings-check-chip-selected),
.select-card :deep(.stream-check-chip-selected) {
  background: var(--color-bold);
  color: white;
}

.select-card :deep(.settings-check-chip-selected:hover),
.select-card :deep(.stream-check-chip-selected:hover) {
  background: var(--color-bold);
  color: white;
}

.select-card :deep(.settings-check-chip-selected .settings-check-chip-indicator),
.select-card :deep(.stream-check-chip-selected .stream-check-chip-indicator) {
  border-color: currentColor;
  background: currentColor;
  transform: scale(1.05);
}

.select-card :deep(.settings-check-chip-selected > span:nth-of-type(2)),
.select-card :deep(.stream-check-chip-selected > span:nth-of-type(2)),
.select-card :deep(.settings-check-chip-selected .select-card-chip-label),
.select-card :deep(.stream-check-chip-selected .select-card-chip-label) {
  color: white;
}

.select-card :deep(.settings-check-chip-disabled) {
  cursor: not-allowed;
}

.select-card :deep(.settings-check-chip-disabled > span:nth-of-type(2)),
.select-card :deep(.settings-check-chip-disabled .select-card-chip-label) {
  color: var(--color-muted-foreground);
}

.select-card :deep(.settings-check-chip-disabled:hover) {
  background: var(--color-card);
}

.select-card :deep(.settings-check-chip-disabled:hover > span:nth-of-type(2)),
.select-card :deep(.settings-check-chip-disabled:hover .select-card-chip-label) {
  color: var(--color-muted-foreground);
}

.select-card :deep(.settings-check-chip > span:nth-of-type(2)),
.select-card :deep(.stream-check-chip > span:nth-of-type(2)),
.select-card :deep(.select-card-chip-label) {
  white-space: nowrap;
  min-width: 0;
}

.select-card :deep(.select-card-chip-meta) {
  margin-left: auto;
  color: var(--color-muted-foreground);
  flex-shrink: 0;
  transition: border-color 140ms ease, background-color 140ms ease, color 140ms ease;
}

.select-card :deep(.select-card-chip-remove) {
  display: inline-flex;
  height: 1.1rem;
  width: 1.1rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  box-sizing: border-box;
  border: 1px solid var(--color-bold);
  background: color-mix(in srgb, var(--color-card) 90%, transparent);
}

.select-card :deep(.select-card-chip-count) {
  margin-left: 0.45rem;
  max-width: 100%;
  height: 1.25rem;
  min-width: 1.25rem;
  background-color: var(--color-card);
  border-color: var(--color-border);
  color: var(--color-muted-foreground);
  font-weight: 400;
  text-transform: none;
  letter-spacing: normal;
  font-size: 10px;
  line-height: 1;
  padding: 0 0.375rem;
}

.select-card :deep(.select-card-chip-remove-btn) {
  appearance: none;
  -webkit-appearance: none;
  padding: 0;
  border-width: 1px;
  line-height: 1;
  cursor: pointer;
}

.select-card :deep(.select-card-clear-btn) {
  appearance: none;
  -webkit-appearance: none;
  box-sizing: border-box;
  height: var(--select-card-control-height) !important;
  width: var(--select-card-control-height) !important;
  flex-shrink: 0;
  border: 1px solid var(--color-bold) !important;
  background: color-mix(in srgb, var(--color-card) 90%, transparent) !important;
  color: var(--color-muted-foreground) !important;
  cursor: pointer;
  transition: background-color 140ms ease, border-color 140ms ease, color 140ms ease;
}

.select-card :deep(.select-card-clear-btn:hover),
.select-card :deep(.select-card-clear-btn:focus-visible) {
  border-color: #ef4444 !important;
  background: #ef4444 !important;
  color: #ffffff !important;
}

.select-card :deep(.select-card-chip-remove-btn:hover),
.select-card :deep(.select-card-chip-remove-btn:focus-visible) {
  border-color: #ef4444;
  background: #ef4444;
  color: #ffffff;
}
</style>
