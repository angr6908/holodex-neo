<template>
  <div class="mv-toolbar relative z-20 border-b border-white/10 bg-slate-950 px-3">
    <div class="flex h-[52px] items-stretch gap-2">
      <div ref="navMenuRoot" class="relative shrink-0 self-center">
        <UiButton
          variant="outline"
          size="icon"
          type="button"
          class-name="mv-toolbar-button h-8 w-8 rounded-xl"
          title="Open navigation"
          @click="toggleNavMenu"
        >
          <span class="sr-only">Open navigation</span>
          <svg viewBox="0 0 24 24" class="h-4 w-4 fill-current">
            <path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z" />
          </svg>
        </UiButton>

        <UiCard
          v-if="navMenuOpen"
          class-name="absolute left-0 top-full z-[120] mt-2 min-w-[14rem] border border-white/10 bg-slate-950 p-2 shadow-2xl shadow-slate-950/80"
        >
          <router-link
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="block rounded-xl px-3 py-2 text-sm text-slate-200 transition hover:bg-white/8 hover:text-white"
            @click="navMenuOpen = false"
          >
            {{ item.label }}
          </router-link>
        </UiCard>
      </div>

      <div class="flex min-w-0 flex-1 items-center self-stretch">
        <slot name="left" />
      </div>

      <div class="flex items-center justify-end gap-2 self-center">
        <slot name="buttons" />

        <template v-for="(button, index) in buttons.filter((item) => !item.collapse)" :key="`mv-button-${index}`">
          <UiButton
            type="button"
            size="icon"
            variant="secondary"
            :title="button.tooltip"
            :class-name="`mv-toolbar-button h-8 w-8 rounded-xl`"
            @click="button.onClick"
          >
            <UiIcon :icon="button.icon" :class-name="iconColorClass(button.color)" />
          </UiButton>
        </template>

        <div v-if="!compact" ref="shareRoot" class="relative">
          <UiButton
            type="button"
            size="icon"
            variant="secondary"
            class-name="mv-toolbar-button h-8 w-8 rounded-xl"
            title="Share layout"
            @click="shareDialog = !shareDialog"
          >
            <UiIcon :icon="mdiLinkVariant" />
          </UiButton>

          <UiCard
            v-if="shareDialog"
            class-name="absolute right-0 top-full z-[90] mt-2 w-[min(80vw,24rem)] border border-white/10 bg-slate-950 p-3 shadow-2xl shadow-slate-950/80"
          >
            <div class="relative flex items-center">
              <UiInput
                readonly
                :value="exportURL"
                :class-name="doneCopy ? 'border-emerald-400/40 bg-emerald-500/10 pr-10' : 'pr-10'"
              />
              <button
                type="button"
                class="mv-share-copy-btn"
                :class="doneCopy ? 'text-emerald-400' : ''"
                @click="startCopyToClipboard(exportURL)"
              >
                <UiIcon :icon="doneCopy ? mdiClipboardCheckOutline : mdiClipboardPlusOutline" size="sm" />
              </button>
            </div>
          </UiCard>
        </div>

        <div v-if="collapseButtons.length" ref="collapsedRoot" class="relative">
          <UiButton
            type="button"
            size="icon"
            variant="ghost"
            class-name="mv-toolbar-button h-8 w-8 rounded-xl"
            title="More actions"
            @click="collapsedMenuOpen = !collapsedMenuOpen"
          >
            <UiIcon :icon="icons.mdiDotsVertical" />
          </UiButton>

          <UiCard
            v-if="collapsedMenuOpen"
            class-name="absolute right-0 top-full z-[90] mt-2 min-w-[15rem] border border-white/10 bg-slate-950 p-2 shadow-2xl shadow-slate-950/80"
          >
            <button
              v-for="(button, index) in collapseButtons"
              :key="`mv-collapsed-${index}`"
              type="button"
              class="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/8"
              @click="handleCollapsedButton(button)"
            >
              <UiIcon :icon="button.icon" :class-name="iconColorClass(button.color)" />
              <span>{{ button.tooltip }}</span>
            </button>
          </UiCard>
        </div>

        <UiButton
          type="button"
          size="icon"
          variant="ghost"
          class-name="mv-toolbar-button h-8 w-8 rounded-xl"
          title="Collapse toolbar"
          @click="collapseToolbar = true"
        >
          <UiIcon :icon="icons.mdiChevronUp" />
        </UiButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import { useCopyToClipboard } from "@/composables/useCopyToClipboard";
import { mdiLinkVariant, mdiClipboardPlusOutline, mdiClipboardCheckOutline } from "@mdi/js";
import { encodeLayout } from "@/utils/mv-utils";
import { useMultiviewStore } from "@/stores/multiview";
import UiButton from "@/components/ui/button/Button.vue";
import UiCard from "@/components/ui/card/Card.vue";
import UiInput from "@/components/ui/input/Input.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import { getCurrentInstance } from "vue";

defineOptions({ name: "MultiviewToolbar" });

const props = defineProps<{
  buttons?: any[];
  compact?: boolean;
  modelValue?: boolean;
  value?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "input", value: boolean): void;
}>();

const { t } = useI18n();
const multiviewStore = useMultiviewStore();
const { doneCopy, copyToClipboard } = useCopyToClipboard();
const instance = getCurrentInstance();

const shareDialog = ref(false);
const collapsedMenuOpen = ref(false);
const navMenuOpen = ref(false);
const navMenuRoot = ref<HTMLElement | null>(null);
const shareRoot = ref<HTMLElement | null>(null);
const collapsedRoot = ref<HTMLElement | null>(null);

const layout = computed(() => multiviewStore.layout);
const layoutContent = computed(() => multiviewStore.layoutContent);

const navItems = computed(() => [
  { to: "/", label: t("component.mainNav.home") },
  { to: "/favorites", label: t("component.mainNav.favorites") },
  { to: "/channels", label: t("component.mainNav.channels") },
  { to: "/library", label: t("component.mainNav.library") },
  { to: "/search", label: t("component.search.searchLabel") },
]);

const exportURL = computed(() => {
  if (!shareDialog.value) return "";
  const layoutParam = `/${encodeURIComponent(
    encodeLayout({
      layout: layout.value,
      contents: layoutContent.value,
      includeVideo: true,
    }),
  )}`;
  return `${window.origin}/multiview${layoutParam}`;
});

const collapseToolbar = computed({
  get() {
    return props.modelValue ?? props.value;
  },
  set(value: boolean) {
    emit("update:modelValue", value);
    emit("input", value);
  },
});

const collapseButtons = computed(() => {
  return (props.buttons || []).filter((btn: any) => btn.collapse);
});

function buttonClass(color: string) {
  const colorMap: Record<string, string> = {
    green: "bg-emerald-500 hover:brightness-110",
    orange: "bg-amber-500 hover:brightness-110",
    red: "bg-rose-500 hover:brightness-110",
    secondary: "bg-[color:var(--color-secondary)] hover:brightness-110",
  };

  if (color?.includes("indigo")) return "bg-indigo-500 hover:brightness-110";
  if (color?.includes("purple")) return "bg-violet-500 hover:brightness-110";
  return colorMap[color] || "";
}

function buttonStyle(color: string) {
  const foreground = getButtonForegroundColor(color);
  return foreground ? { "--mv-toolbar-button-fg": foreground, color: foreground } : undefined;
}

function iconColorClass(color: string) {
  return "";
}

function getButtonForegroundColor(color: string) {
  if (color === "secondary") return "#f8fafc";
  const background = resolveButtonColor(color);
  if (!background) return null;
  return isColorNearWhite(background) ? "#0f172a" : "#f8fafc";
}

function resolveButtonColor(color: string) {
  const colorMap: Record<string, string> = {
    green: "#10b981",
    orange: "#f59e0b",
    red: "#f43f5e",
  };

  if (colorMap[color]) return colorMap[color];
  if (color?.includes("indigo")) return "#6366f1";
  if (color?.includes("purple")) return "#8b5cf6";
  if (color === "secondary" && typeof window !== "undefined") {
    return window.getComputedStyle(document.documentElement).getPropertyValue("--color-secondary").trim();
  }
  return null;
}

function isColorNearWhite(color: string) {
  const rgb = parseColor(color);
  if (!rgb) return false;
  const averageDistance = ((255 - rgb.r) + (255 - rgb.g) + (255 - rgb.b)) / 3;
  return averageDistance <= 84;
}

function parseColor(color: string) {
  if (!color) return null;
  if (color.startsWith("#")) {
    const normalized = color.slice(1);
    const value = normalized.length === 3
      ? normalized.split("").map((char) => char + char).join("")
      : normalized;
    if (value.length !== 6) return null;
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16),
    };
  }
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) return null;
  return {
    r: parseInt(match[1], 10),
    g: parseInt(match[2], 10),
    b: parseInt(match[3], 10),
  };
}

function handleCollapsedButton(button: any) {
  collapsedMenuOpen.value = false;
  button.onClick();
}

function startCopyToClipboard(txt: string) {
  instance?.proxy?.$gtag?.event("share-link-copied", {
    event_category: "multiview",
  });

  copyToClipboard(txt);
  setTimeout(() => {
    shareDialog.value = false;
  }, 200);
}

function toggleNavMenu() {
  navMenuOpen.value = !navMenuOpen.value;
}

function handleWindowClick(event: MouseEvent) {
  if (navMenuOpen.value && navMenuRoot.value && !navMenuRoot.value.contains(event.target as Node)) {
    navMenuOpen.value = false;
  }
  if (shareDialog.value && shareRoot.value && !shareRoot.value.contains(event.target as Node)) {
    shareDialog.value = false;
  }
  if (collapsedMenuOpen.value && collapsedRoot.value && !collapsedRoot.value.contains(event.target as Node)) {
    collapsedMenuOpen.value = false;
  }
}

onMounted(() => {
  window.addEventListener("click", handleWindowClick);
});

onBeforeUnmount(() => {
  window.removeEventListener("click", handleWindowClick);
});
</script>

<style scoped>
.mv-toolbar-button {
    transition:
        background-color 160ms ease,
        color 160ms ease,
        border-color 160ms ease;
}

.mv-toolbar-button-colored,
.mv-toolbar-button-colored:hover,
.mv-toolbar-button-colored:active,
.mv-toolbar-button-colored:focus-visible {
    color: var(--mv-toolbar-button-fg, currentColor) !important;
}

.mv-share-copy-btn {
    position: absolute;
    top: 50%;
    right: 0.35rem;
    transform: translateY(-50%);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.9rem;
    height: 1.9rem;
    border: 0;
    border-radius: 0.6rem;
    background: transparent;
    color: var(--color-primary);
    cursor: pointer;
    transition: color 160ms ease, background-color 160ms ease;
}

.mv-share-copy-btn:hover,
.mv-share-copy-btn:focus-visible {
    color: color-mix(in srgb, var(--color-primary) 90%, var(--color-foreground) 10%);
    background: color-mix(in srgb, var(--color-primary) 12%, transparent);
    outline: none;
}
</style>
