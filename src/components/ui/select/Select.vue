<template>
  <div
    ref="root"
    :class="rootClass"
    tabindex="-1"
    @click.stop
    @keydown.escape.stop="closeMenu"
  >
    <button
      ref="trigger"
      type="button"
      :disabled="disabled"
      :aria-expanded="open ? 'true' : 'false'"
      aria-haspopup="listbox"
      :class="triggerClass"
      @click="toggleMenu"
    >
      <slot
        name="trigger"
        :selected-option="selectedOption"
        :open="open"
      >
        <span class="truncate">{{ selectedLabel }}</span>
        <UiIcon :icon="mdiChevronDown" size="sm" :class-name="`ui-select-trigger-chevron ml-2 shrink-0 ${open ? 'ui-select-trigger-chevron-open' : ''}`" />
      </slot>
    </button>

    <Teleport to="body">
      <transition name="ui-select-menu" appear>
        <UiCard
          v-if="open"
          :class-name="menuClass"
          :style="menuStyle"
          role="listbox"
          @click.stop
          @mousedown.stop
        >
          <div v-if="searchable" class="ui-select-search-wrap">
            <input
              ref="searchInput"
              v-model="searchQuery"
              type="text"
              class="ui-select-search-input"
              :placeholder="searchPlaceholder"
            >
          </div>
          <UiScrollArea class-name="ui-select-menu-scroll" :native-scrollbar="true" :style="scrollEdgeStyle">
            <button
              v-for="(option, index) in visibleOptions"
              :key="option.key || index"
              type="button"
              role="option"
              :aria-selected="isSelected(option.raw) ? 'true' : 'false'"
              :class="getOptionClass(option.raw, index)"
              @mouseenter="hoveredIndex = index"
              @mouseleave="hoveredIndex = -1"
              @focus="focusedIndex = index"
              @blur="focusedIndex = -1"
              @click="selectOption(option.raw)"
            >
              <slot
                name="option"
                :option="option.raw"
                :selected="isSelected(option.raw)"
              >
                <span class="truncate">{{ option.label }}</span>
                <UiIcon
                  v-if="isSelected(option.raw)"
                  :icon="mdiCheck"
                  size="sm"
                  class-name="ml-3 shrink-0 text-[color:var(--color-foreground)]"
                />
              </slot>
            </button>
            <div v-if="visibleOptions.length === 0" class="ui-select-empty">
              No options found
            </div>
          </UiScrollArea>
        </UiCard>
      </transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from "vue";
import { mdiCheck, mdiChevronDown } from "@mdi/js";
import { cn } from "@/utils/functions";
import UiCard from "@/components/ui/card/Card.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import UiScrollArea from "@/components/ui/scroll-area/ScrollArea.vue";

function hasOwn(obj: unknown, key: string) {
  return !!obj && typeof obj === "object" && Object.prototype.hasOwnProperty.call(obj, key);
}

const props = withDefaults(defineProps<{
  modelValue?: any;
  options?: any[];
  placeholder?: string;
  labelKey?: string;
  valueKey?: string;
  className?: string;
  menuClassName?: string;
  optionClassName?: string;
  disabled?: boolean;
  align?: string;
  returnObject?: boolean;
  matchTriggerWidth?: boolean;
  fluid?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchFilterFn?: ((option: any, query: string) => boolean) | null;
}>(), {
  modelValue: undefined,
  options: () => [],
  placeholder: "Select an option",
  labelKey: "label",
  valueKey: "value",
  className: "",
  menuClassName: "",
  optionClassName: "",
  disabled: false,
  align: "left",
  returnObject: false,
  matchTriggerWidth: true,
  fluid: true,
  searchable: false,
  searchPlaceholder: "Search...",
  searchFilterFn: null,
});

const emit = defineEmits<{
  (e: "update:modelValue", value: any): void;
  (e: "open-change", value: boolean): void;
}>();

const root = ref<HTMLElement | null>(null);
const trigger = ref<HTMLElement | null>(null);
const searchInput = ref<HTMLInputElement | null>(null);

const open = ref(false);
const menuWidth = ref(0);
const searchQuery = ref("");
const hoveredIndex = ref(-1);
const focusedIndex = ref(-1);

function getOptionValue(option: any) {
  if (hasOwn(option, props.valueKey)) return option[props.valueKey];
  if (hasOwn(option, "value")) return option.value;
  return option;
}

function getOptionLabel(option: any) {
  if (hasOwn(option, props.labelKey)) return `${option[props.labelKey]}`;
  if (hasOwn(option, "text")) return `${option.text}`;
  if (hasOwn(option, "label")) return `${option.label}`;
  if (hasOwn(option, "name")) return `${option.name}`;
  return `${option ?? ""}`;
}

function isSelected(option: any) {
  const currentValue = props.returnObject ? getOptionValue(props.modelValue) : props.modelValue;
  return getOptionValue(option) === currentValue;
}

const normalizedOptions = computed(() =>
  (props.options || []).map((option, index) => ({
    raw: option,
    label: getOptionLabel(option),
    key: hasOwn(option, props.valueKey) ? `${getOptionValue(option)}` : `${index}-${getOptionLabel(option)}`,
  })),
);

const selectedOption = computed(() =>
  normalizedOptions.value.find((option) => isSelected(option.raw))?.raw || null,
);

const visibleOptions = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return normalizedOptions.value;
  if (props.searchFilterFn) {
    return normalizedOptions.value.filter((option) => props.searchFilterFn!(option.raw, query));
  }
  return normalizedOptions.value.filter((option) => option.label.toLowerCase().includes(query));
});

const selectedLabel = computed(() =>
  selectedOption.value
    ? getOptionLabel(selectedOption.value)
    : props.placeholder,
);

const selectedVisibleIndex = computed(() =>
  visibleOptions.value.findIndex((option) => isSelected(option.raw)),
);

const edgeTopActive = computed(() =>
  visibleOptions.value.length > 0
  && (hoveredIndex.value === 0 || focusedIndex.value === 0 || selectedVisibleIndex.value === 0),
);

const edgeBottomActive = computed(() => {
  const lastIndex = visibleOptions.value.length - 1;
  return lastIndex >= 0
    && (hoveredIndex.value === lastIndex || focusedIndex.value === lastIndex || selectedVisibleIndex.value === lastIndex);
});

const scrollEdgeStyle = computed(() => ({
  "--edge-top": edgeTopActive.value ? "var(--color-base)" : "var(--colorbg)",
  "--edge-bottom": edgeBottomActive.value ? "var(--color-base)" : "var(--colorbg)",
}));

const triggerClass = computed(() =>
  cn(
    "ui-select-trigger flex h-11 items-center justify-between rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-3 text-left text-[0.8rem] text-[color:var(--color-foreground)] transition outline-none disabled:cursor-not-allowed disabled:opacity-60",
    open.value && "ui-select-trigger-open",
    props.fluid ? "w-full" : "w-auto",
    props.className,
  ),
);

const rootClass = computed(() => cn(props.fluid ? "relative w-full" : "relative inline-block", "outline-none"));

const menuClass = computed(() =>
  cn(
    "ui-select-menu fixed z-[360] min-w-[max-content] overflow-hidden border bg-[color:var(--color-card)] p-0",
    props.searchable && "ui-select-menu-searchable",
    props.menuClassName,
  ),
);

const menuStyle = computed(() => {
  if (!open.value) return undefined;
  const rect = trigger.value?.getBoundingClientRect();
  if (!rect) return undefined;
  const style: Record<string, string> = {
    top: `${rect.bottom + 6}px`,
  };
  if (props.align === "right") {
    style.right = `${window.innerWidth - rect.right}px`;
  } else {
    style.left = `${rect.left}px`;
  }
  if (props.matchTriggerWidth && menuWidth.value) {
    style.minWidth = `${menuWidth.value}px`;
  }
  return style;
});

function isOptionActive(option: any, index: number) {
  return hoveredIndex.value === index || focusedIndex.value === index || isSelected(option);
}

function getOptionClass(option: any, index: number) {
  const lastIndex = visibleOptions.value.length - 1;
  const active = isOptionActive(option, index);
  const nextActive = active
    && index < lastIndex
    && isOptionActive(visibleOptions.value[index + 1].raw, index + 1);
  return cn(
    "ui-select-option flex w-full cursor-pointer items-center justify-between bg-transparent text-left text-[0.8rem] text-[color:var(--color-foreground)] transition-colors",
    isSelected(option) && "ui-select-option-selected",
    active && "ui-select-option-active",
    nextActive && "ui-select-option-active-join-next",
    active && index === 0 && "ui-select-option-active-first",
    active && index === lastIndex && "ui-select-option-active-last",
    props.optionClassName,
  );
}

function syncMenuWidth() {
  menuWidth.value = trigger.value?.offsetWidth || 0;
}

function setOpen(value: boolean) {
  if (value) {
    syncMenuWidth();
  }
  open.value = value;
  if (value) {
    nextTick(() => {
      if (props.searchable && searchInput.value) {
        searchInput.value.focus();
      } else if (root.value) {
        root.value.focus();
      }
    });
  } else {
    searchQuery.value = "";
    hoveredIndex.value = -1;
    focusedIndex.value = -1;
  }
  emit("open-change", value);
}

function toggleMenu() {
  if (props.disabled) return;
  setOpen(!open.value);
}

function closeMenu() {
  if (!open.value) return;
  setOpen(false);
}

function handleOutsideClick(event: MouseEvent) {
  if (!root.value?.contains(event.target as Node)) {
    closeMenu();
  }
}

function handleWindowScroll(event: Event) {
  if (!open.value) return;
  const target = event?.target;
  if (target instanceof Node && target !== document) {
    // Allow scroll from inside the select, from an ancestor, or from the teleported menu
    if (root.value?.contains(target) || target.contains(root.value)) return;
    if (target instanceof Element && target.closest?.(".ui-select-menu")) return;
  }
  closeMenu();
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement && root.value?.contains(activeElement)) {
    activeElement.blur();
  }
}

function selectOption(option: any) {
  emit("update:modelValue", props.returnObject ? option : getOptionValue(option));
  closeMenu();
}

onMounted(() => {
  document.addEventListener("mousedown", handleOutsideClick);
  window.addEventListener("resize", syncMenuWidth);
  window.addEventListener("scroll", handleWindowScroll, true);
});

onBeforeUnmount(() => {
  document.removeEventListener("mousedown", handleOutsideClick);
  window.removeEventListener("resize", syncMenuWidth);
  window.removeEventListener("scroll", handleWindowScroll, true);
});
</script>

<style scoped>
.ui-select-search-wrap {
  position: relative;
  padding: 0.5rem 0.75rem;
  background: var(--colorbg);
  border-top: 0 !important;
  border-bottom: 1px solid var(--color-light);
  box-shadow: none;
}

.ui-select-search-input {
  width: 100%;
  height: 1.95rem;
  border-radius: 0;
  border: 0;
  background: transparent;
  color: var(--color-foreground);
  padding: 0;
  font-size: 0.83rem;
  outline: none;
  box-shadow: none;
}

.ui-select-search-input:focus {
  border-color: transparent;
  box-shadow: none;
}

.ui-select-menu-scroll {
  position: relative;
  max-height: 18rem;
  overflow: hidden;
  background: var(--colorbg);
}

.ui-select-menu-scroll :deep(.scroll-area-viewport-native) {
  max-height: 18rem;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
  background: linear-gradient(
    to bottom,
    var(--edge-top, var(--colorbg)) 0%,
    var(--edge-bottom, var(--colorbg)) 100%
  );
}

.ui-select-menu-scroll :deep(.scroll-area-content-native) {
  background: transparent;
  width: 100%;
}

.ui-select-empty {
  padding: 0.65rem 0.95rem;
  color: var(--color-muted-foreground);
  font-size: 0.8rem;
}

.ui-select-menu {
  border-color: var(--color-light) !important;
  background: var(--colorbg) !important;
  -webkit-backdrop-filter: none !important;
  backdrop-filter: none !important;
  box-shadow: 0 20px 56px rgb(2 6 23 / 0.34);
}

.ui-select-menu-enter-active,
.ui-select-menu-leave-active {
  transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms ease;
}

.ui-select-menu-enter-from,
.ui-select-menu-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

.ui-select-trigger {
  border-color: var(--color-light) !important;
  background: var(--color-card) !important;
  color: var(--color-muted-foreground) !important;
  cursor: pointer;
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
  transition: border-color 180ms ease, background-color 180ms ease, color 180ms ease, box-shadow 180ms ease;
}

.ui-select-trigger:hover {
  border-color: var(--color-bold) !important;
  background: var(--color-base) !important;
  color: var(--color-foreground) !important;
}

.ui-select-trigger-open {
  border-color: var(--color-bold) !important;
  background: var(--color-base) !important;
  color: var(--color-foreground) !important;
  box-shadow: none;
}

.ui-select-trigger-chevron {
  color: var(--color-muted-foreground);
  transition: transform 180ms ease, color 180ms ease;
}

.ui-select-trigger-chevron-open {
  transform: rotate(180deg);
  color: var(--color-foreground);
}

.ui-select-trigger:focus {
  border-color: var(--color-bold);
  box-shadow: none;
}

.ui-select-option {
  --ui-select-line-top: transparent;
  --ui-select-line-bottom: transparent;
  width: 100%;
  white-space: nowrap;
  margin-inline: 0;
  position: relative;
  z-index: 1;
  border-radius: 0;
  padding: 0.68rem 0.75rem;
  background: var(--colorbg) !important;
  border: 0 !important;
  outline: none;
  box-shadow: inset 0 1px 0 var(--ui-select-line-top), inset 0 -1px 0 var(--ui-select-line-bottom);
}

.ui-select-option + .ui-select-option {
  margin-top: 0;
}

.ui-select-option-active,
.ui-select-option:hover,
.ui-select-option:focus,
.ui-select-option:focus-visible,
.ui-select-option:active {
  --ui-select-line-top: var(--color-light);
  --ui-select-line-bottom: var(--color-light);
  background: var(--color-base) !important;
  outline: none;
}

.ui-select-option-selected {
  --ui-select-line-top: var(--color-light);
  --ui-select-line-bottom: var(--color-light);
  background: var(--color-base) !important;
}

/* join/edge classes use doubled class selector to beat :hover specificity (0,2,0 > 0,1,1) */
.ui-select-option.ui-select-option-active-join-next {
  --ui-select-line-bottom: transparent;
}

.ui-select-option.ui-select-option-active-first {
  --ui-select-line-top: transparent;
}

.ui-select-option.ui-select-option-active-last {
  --ui-select-line-bottom: transparent;
}

</style>
