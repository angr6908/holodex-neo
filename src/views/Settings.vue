<template>
  <section>
    <div class="min-w-0" :class="slim ? 'space-y-6' : 'grid gap-6 xl:grid-cols-2 xl:items-start'">
      <UiCard
        id="settings-main"
        class-name="min-w-0 space-y-6 border-[color:var(--color-border)] bg-[color:var(--color-card)] p-4 sm:p-6"
      >
        <header>
          <h1
            class="text-3xl font-semibold tracking-tight text-[color:var(--color-foreground)]"
          >
            {{ $t("views.settings.title") }}
          </h1>
        </header>

        <div class="space-y-6">
          <div class="space-y-3">
            <div class="settings-top-grid">
              <div class="settings-field min-w-0">
                <span class="settings-field-label">{{ $t("views.settings.languageSettings") }}</span>
                <UiSelect
                  v-model="language"
                  :options="langs"
                  :fluid="true"
                  label-key="display"
                  value-key="val"
                  placeholder="Select language"
                >
                  <template #trigger="{ selectedOption, open }">
                    <span class="flex w-full min-w-0 items-center justify-between gap-3 text-left">
                      <span class="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
                        <span class="min-w-0 truncate text-[color:var(--color-foreground)]">
                          {{ selectedOption?.display || "Select language" }}
                        </span>
                      </span>
                      <UiIcon
                        :icon="mdiChevronDown"
                        size="sm"
                        :class-name="`shrink-0 text-[color:var(--color-muted-foreground)] transition-transform ${open ? 'rotate-180' : ''}`"
                      />
                    </span>
                  </template>

                  <template #option="{ option, selected }">
                    <span class="flex w-full min-w-0 items-center justify-between gap-3">
                      <span class="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
                        <span class="min-w-0 truncate text-[color:var(--color-foreground)]">
                          {{ option.display }}
                        </span>
                      </span>
                      <UiIcon
                        v-if="selected"
                        :icon="mdiCheck"
                        size="sm"
                        class-name="ml-3 shrink-0 text-[color:var(--color-foreground)]"
                      />
                    </span>
                  </template>
                </UiSelect>
              </div>

              <div class="settings-field" :style="topFieldStyles.theme">
                <span class="settings-field-label">{{ $t("views.settings.theme") }}</span>
                <UiSelect
                  v-model="themeId"
                  :options="themeOptions"
                  :fluid="true"
                  label-key="name"
                  value-key="id"
                  placeholder="Select theme"
                >
                  <template #trigger="{ selectedOption, open }">
                    <span class="flex w-full min-w-0 items-center justify-between gap-2">
                      <span class="flex min-w-0 items-center gap-2">
                        <span class="flex shrink-0 items-center">
                          <span
                            class="theme-select-swatch"
                            :style="{ background: (selectedOption || themeOptions[0]).preview.accent }"
                          />
                        </span>
                        <span class="truncate">{{ (selectedOption || themeOptions[0]).name }}</span>
                      </span>
                      <UiIcon
                        :icon="mdiChevronDown"
                        size="sm"
                        :class-name="`shrink-0 text-[color:var(--color-muted-foreground)] transition-transform ${open ? 'rotate-180' : ''}`"
                      />
                    </span>
                  </template>
                  <template #option="{ option, selected }">
                    <span class="flex min-w-0 items-center gap-2">
                      <span class="flex shrink-0 items-center">
                        <span class="theme-select-swatch" :style="{ background: option.preview.accent }" />
                      </span>
                      <span class="truncate">{{ option.name }}</span>
                    </span>
                    <UiIcon
                      v-if="selected"
                      :icon="mdiCheck"
                      size="sm"
                      class-name="ml-3 shrink-0 text-[color:var(--color-foreground)]"
                    />
                  </template>
                </UiSelect>
              </div>

              <div class="settings-field" :style="topFieldStyles.grid">
                <span class="settings-field-label">{{ $t("views.settings.gridSizeLabel") }}</span>
                <UiSelect
                  v-model="currentGridSize"
                  :options="gridSizeOptions"
                  :fluid="true"
                  label-key="text"
                  value-key="value"
                  placeholder="Select grid size"
                />
              </div>

              <div v-if="!slim" class="settings-field" :style="topFieldStyles.defaultPage">
                <span class="settings-field-label">{{ $t("views.settings.defaultPage") }}</span>
                <UiSelect
                  v-model="defaultOpen"
                  :options="defaultOpenChoices"
                  :fluid="true"
                  label-key="text"
                  value-key="value"
                  placeholder="Select default page"
                />
              </div>
            </div>

            <div
              v-if="overrideLanguage"
              class="rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2.5 text-sm text-amber-50"
              @click="overrideLanguage = undefined"
            >
              Language override is active for
              <code>{{ langs.find((x) => x.val === overrideLanguage)?.display }}</code>.
              Click to clear it.
            </div>

            <SelectCard
              title="System Options"
            >
              <div>
                <label class="settings-check-chip" :class="{ 'settings-check-chip-selected': redirectMode }">
                  <input
                    :checked="redirectMode"
                    type="checkbox"
                    class="peer sr-only"
                    @change="redirectMode = $event.target.checked"
                  >
                  <span class="settings-check-chip-indicator" />
                  <span>{{ $t("views.settings.redirectModeLabel") }}</span>
                </label>
                <label class="settings-check-chip" :class="{ 'settings-check-chip-selected': useEnName }">
                  <input
                    :checked="useEnName"
                    type="checkbox"
                    class="peer sr-only"
                    @change="useEnName = $event.target.checked"
                  >
                  <span class="settings-check-chip-indicator" />
                  <span>{{ $t("views.settings.useEnglishNameLabel") }}</span>
                </label>
                <label class="settings-check-chip" :class="{ 'settings-check-chip-selected': darkMode, 'settings-check-chip-disabled': followSystemTheme && !darkMode }">
                  <input
                    :checked="darkMode"
                    :disabled="followSystemTheme"
                    type="checkbox"
                    class="peer sr-only"
                    @change="darkMode = $event.target.checked"
                  >
                  <span class="settings-check-chip-indicator" />
                  <span>{{ $t("views.settings.darkModeLabel") }}</span>
                </label>
                <label class="settings-check-chip" :class="{ 'settings-check-chip-selected': followSystemTheme }">
                  <input
                    :checked="followSystemTheme"
                    type="checkbox"
                    class="peer sr-only"
                    @change="followSystemTheme = $event.target.checked"
                  >
                  <span class="settings-check-chip-indicator" />
                  <span>Follow System Theme</span>
                </label>
                <label class="settings-check-chip" :class="{ 'settings-check-chip-selected': scrollMode }">
                  <input
                    :checked="scrollMode"
                    type="checkbox"
                    class="peer sr-only"
                    @change="scrollMode = $event.target.checked"
                  >
                  <span class="settings-check-chip-indicator" />
                  <span>{{ $t("views.settings.scrollModeLabel") }}</span>
                </label>
              </div>
            </SelectCard>

            <SelectCard
              title="Clip Languages"
            >
              <div>
                <label
                  v-for="lang in TL_LANGS"
                  :key="`${lang.value}-clip`"
                  class="settings-check-chip"
                  :class="{ 'settings-check-chip-selected': clipLangs.includes(lang.value) }"
                >
                  <input
                    :checked="clipLangs.includes(lang.value)"
                    type="checkbox"
                    class="peer sr-only"
                    @change="toggleClipLang(lang.value, $event.target.checked)"
                  >
                  <span class="settings-check-chip-indicator" />
                  <span>{{ lang.text }}</span>
                </label>
              </div>
            </SelectCard>

            <div>
              <video-list-filters compact :show-descriptions="false" />
            </div>
          </div>

          <div
            v-if="!slim"
            id="settings-updates"
            class="space-y-2"
          >
            <div class="settings-update-grid">
              <UiButton
                variant="outline"
                class-name="settings-update-btn settings-update-btn-check"
                @click="forceCheckUpdate"
              >
                <UiIcon :icon="mdiRefresh" size="sm" class-name="settings-update-btn-icon" />
                <span>Check For Update</span>
              </UiButton>
              <UiButton
                variant="outline"
                class-name="settings-update-btn settings-update-btn-force"
                @click="forceUninstall"
              >
                <UiIcon :icon="mdiReloadAlert" size="sm" class-name="settings-update-btn-icon" />
                <span>Force Refresh App</span>
              </UiButton>
            </div>
          </div>
        </div>
      </UiCard>

      <AboutSection v-if="!slim" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useAppStore } from "@/stores/app";
import { useSettingsStore } from "@/stores/settings";
import { useMetaTitle } from "@/composables/useMetaTitle";
import { mdiCheck, mdiChevronDown, mdiRefresh, mdiReloadAlert } from "@mdi/js";
import { langs } from "@/plugins/app-i18n";
import { TL_LANGS } from "@/utils/consts";
import themeSet, { readStoredThemeId, resolveThemeById } from "@/utils/themes";
import backendApi from "@/utils/backend-api";
import AboutSection from "@/components/setting/AboutSection.vue";
import SelectCard from "@/components/setting/SelectCard.vue";
import VideoListFilters from "@/components/setting/VideoListFilters.vue";
import UiCard from "@/components/ui/card/Card.vue";
import UiButton from "@/components/ui/button/Button.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import UiSelect from "@/components/ui/select/Select.vue";
import * as SW from "../sw";

defineOptions({ name: "Settings" });

withDefaults(defineProps<{
  slim?: boolean;
}>(), {
  slim: false,
});

defineEmits<{
  close: [];
}>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const appStore = useAppStore();
const settingsStore = useSettingsStore();

const { darkMode, followSystemTheme, redirectMode, scrollMode, defaultOpen } = storeToRefs(settingsStore);

useMetaTitle(() => `${t("component.mainNav.settings")} - Holodex`);

// Data
const themeId = ref(readStoredThemeId());
const defaultOpenChoices = Object.freeze([
  { text: t("component.mainNav.home"), value: "home" },
  { text: t("component.mainNav.favorites"), value: "favorites" },
  { text: t("component.mainNav.multiview"), value: "multiview" },
]);

let textMeasureCanvas: HTMLCanvasElement | null = null;

// Computed
const currentGridSize = computed({
  get() {
    return appStore.currentGridSize;
  },
  set(val: number) {
    appStore.setCurrentGridSize(Number(val));
  },
});

const useEnName = computed({
  get() {
    return settingsStore.useEnName;
  },
  set(val: boolean) {
    settingsStore.setUseEnName(val);
  },
});

const language = computed({
  get() {
    return settingsStore.lang;
  },
  set(val: string) {
    settingsStore.setLanguage(val);
    if (overrideLanguage.value) {
      overrideLanguage.value = undefined;
    }
  },
});

const overrideLanguage = computed({
  get() {
    return route.query.lang as string | undefined;
  },
  set(v: string | undefined) {
    const newQuery = { ...route.query, lang: v };
    const r = router.resolve({
      name: route.name!,
      params: route.params,
      query: newQuery,
      hash: route.hash,
    });
    window.location.assign(r.href);
  },
});

const clipLangs = computed({
  get() {
    return settingsStore.clipLangs;
  },
  set(val: string[]) {
    settingsStore.setClipLangs(val.sort());
  },
});

const currentThemeLabel = computed(() =>
  themeOptions.value.find((item) => item.id === themeId.value)?.name || "",
);

const themeOptions = computed(() =>
  themeSet.map((theme) => ({
    ...theme,
    preview: resolveThemeById(theme.id).themes.light,
  })),
);

const gridSizeOptions = computed(() => [
  { text: t("views.settings.gridSize[0]"), value: 0 },
  { text: t("views.settings.gridSize[1]"), value: 1 },
  { text: t("views.settings.gridSize[2]"), value: 2 },
]);

const defaultOpenLabel = computed(() =>
  defaultOpenChoices.find((item) => item.value === defaultOpen.value)?.text || defaultOpen.value,
);

const currentGridLabel = computed(() =>
  t(`views.settings.gridSize[${currentGridSize.value}]`),
);

const topFieldStyles = computed(() => {
  const themeWidth = estimateTopFieldWidthPx(t("views.settings.theme"), currentThemeLabel.value, 18);
  const gridWidth = estimateTopFieldWidthPx(t("views.settings.gridSizeLabel"), currentGridLabel.value);
  const defaultPageWidth = estimateTopFieldWidthPx(t("views.settings.defaultPage"), defaultOpenLabel.value);
  const toStyle = (widthPx: number) => ({
    flex: `${Math.max(1, Math.round(widthPx))} 1 0`,
    minWidth: `${Math.max(136, Math.round(widthPx))}px`,
  });
  return {
    theme: toStyle(themeWidth),
    grid: toStyle(gridWidth),
    defaultPage: toStyle(defaultPageWidth),
  };
});

// Watchers
watch(themeId, (nw) => {
  localStorage.setItem("theme", `${nw}`);
  window.dispatchEvent(new CustomEvent("holodex-theme-change", { detail: nw }));
});

// Methods
function measureTextWidthPx(text: string, font = "400 14px sans-serif"): number {
  if (typeof document === "undefined") return `${text || ""}`.length * 8;
  if (!textMeasureCanvas) {
    textMeasureCanvas = document.createElement("canvas");
  }
  const ctx = textMeasureCanvas.getContext("2d");
  if (!ctx) return `${text || ""}`.length * 8;
  ctx.font = font;
  return Math.ceil(ctx.measureText(`${text || ""}`).width);
}

function estimateTopFieldWidthPx(label: string, value: string, extra = 0): number {
  const labelText = `${label || ""}`;
  const valueText = `${value || ""}`;
  const labelWidth = measureTextWidthPx(labelText, "400 11px sans-serif") + labelText.length * 1.4;
  const triggerTextWidth = measureTextWidthPx(valueText, "400 14px sans-serif") + 46 + extra;
  const pixelWidth = Math.max(labelWidth, triggerTextWidth) + 10;
  return Math.max(136, Math.min(420, Math.ceil(pixelWidth)));
}

function toggleClipLang(value: string, checked: boolean) {
  const next = new Set(clipLangs.value);
  if (checked) next.add(value);
  else next.delete(value);
  clipLangs.value = [...next];
}

function forceUninstall() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg) {
        reg.unregister().then(() => { window.location.reload(); });
      } else {
        window.location.reload();
      }
    });
  }
}

function forceCheckUpdate() {
  const reg = SW.getRegistration();
  if (!reg || !reg.waiting) {
    window.location.reload();
  } else {
    SW.updateServiceWorker();
    SW.getRegistration()?.update();
  }
}

function scrollToHash(hash: string) {
  if (!hash) return;
  nextTick(() => {
    document.querySelector(hash)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });
}

// Lifecycle
onMounted(async () => {
  backendApi.topics().then(() => {});
  nextTick(() => {
    scrollToHash(route.hash);
  });
});
</script>

<style scoped>
.settings-field {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.settings-top-grid {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.5rem;
}

.settings-top-grid .settings-field {
  max-width: 100%;
}

.settings-field-label {
  font-size: 0.68rem;
  font-weight: 400;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--color-muted-foreground);
}

.settings-help {
  font-size: 0.75rem;
  line-height: 1.35;
  color: var(--color-muted-foreground);
}

.theme-select-swatch {
  width: 0.85rem;
  height: 0.85rem;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.25);
}

.settings-update-grid {
  display: grid;
  gap: 0.55rem;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.settings-update-btn {
  width: 100%;
  justify-content: flex-start;
  gap: 0.55rem;
  height: 2.7rem;
  border-radius: 0.85rem;
  padding-inline: 0.9rem;
  font-size: 0.82rem;
  font-weight: 400;
  cursor: pointer;
  transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
}

.settings-update-btn-icon {
  opacity: 0.95;
}

.settings-update-btn-check {
  border-color: var(--color-border) !important;
  background: color-mix(in srgb, var(--color-card) 84%, var(--color-primary) 16%) !important;
  color: var(--color-foreground) !important;
}

.settings-update-btn-check:hover {
  border-color: var(--color-primary) !important;
  background: color-mix(in srgb, var(--color-card) 74%, var(--color-primary) 26%) !important;
}

.settings-update-btn-check :deep(.settings-update-btn-icon) {
  color: color-mix(in srgb, var(--color-primary) 86%, var(--color-foreground) 14%);
}

.settings-update-btn-check:focus-visible {
  border-color: var(--color-primary) !important;
}

.settings-update-btn-force {
  border: 1px solid color-mix(in srgb, var(--color-destructive) 32%, transparent) !important;
  background: color-mix(in srgb, var(--color-card) 84%, var(--color-destructive) 16%) !important;
  color: var(--color-foreground) !important;
}

.settings-update-btn-force:hover {
  border-color: color-mix(in srgb, var(--color-destructive) 86%, transparent) !important;
  background: color-mix(in srgb, var(--color-card) 74%, var(--color-destructive) 26%) !important;
}

html[data-theme="light"] .settings-update-btn-check {
  background: color-mix(in srgb, #ffffff 90%, var(--color-primary) 10%) !important;
}

html[data-theme="light"] .settings-update-btn-check:hover {
  background: color-mix(in srgb, #ffffff 82%, var(--color-primary) 18%) !important;
}

html[data-theme="light"] .settings-update-btn-force {
  background: color-mix(in srgb, #ffffff 90%, var(--color-destructive) 10%) !important;
}

html[data-theme="light"] .settings-update-btn-force:hover {
  background: color-mix(in srgb, #ffffff 82%, var(--color-destructive) 18%) !important;
}

:deep(#settings-main.glass-panel),
:deep(#about.glass-panel) {
  -webkit-backdrop-filter: none !important;
  backdrop-filter: none !important;
  box-shadow: none !important;
}

</style>
