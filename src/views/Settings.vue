<template>
  <div class="settings-scroll space-y-6 p-4 sm:p-5">
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
                  class="lang-select"
                >
                  <template #trigger="{ selectedOption, open }">
                    <span class="flex w-full min-w-0 items-center justify-between gap-3 text-left">
                      <span class="flex min-w-0 flex-1 flex-col">
                        <span class="min-w-0 truncate">
                          {{ selectedOption?.display || "Select language" }}
                        </span>
                        <span v-if="selectedOption?.credit" class="lang-credit text-[color:var(--color-muted-foreground)] text-xs">
                          {{ selectedOption.credit }}
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
                      <span class="flex min-w-0 flex-1 flex-col overflow-hidden">
                        <span class="min-w-0 truncate">
                          {{ option.display }}
                        </span>
                        <span v-if="option.credit" class="lang-credit min-w-0 truncate text-[color:var(--color-muted-foreground)] text-xs">
                          {{ option.credit }}
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

              <div class="settings-field" :style="topFieldStyles.defaultPage">
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
              <div class="select-card-chip-flow">
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
              </div>
            </SelectCard>
      </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useSettingsStore } from "@/stores/settings";
import { mdiCheck, mdiChevronDown } from "@mdi/js";
import { langs } from "@/plugins/app-i18n";
import themeSet, { readStoredThemeId, resolveThemeById } from "@/utils/themes";
import backendApi from "@/utils/backend-api";
import SelectCard from "@/components/setting/SelectCard.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import UiSelect from "@/components/ui/select/Select.vue";


defineOptions({ name: "Settings" });

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const settingsStore = useSettingsStore();

const { darkMode, followSystemTheme, redirectMode, scrollMode, defaultOpen } = storeToRefs(settingsStore);

// Data
const themeId = ref(readStoredThemeId());
const defaultOpenChoices = Object.freeze([
  { text: t("component.mainNav.home"), value: "home" },
  { text: t("component.mainNav.favorites"), value: "favorites" },
  { text: t("component.mainNav.multiview"), value: "multiview" },
]);

let textMeasureCanvas: HTMLCanvasElement | null = null;

// Computed
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

const currentThemeLabel = computed(() =>
  themeOptions.value.find((item) => item.id === themeId.value)?.name || "",
);

const themeOptions = computed(() =>
  themeSet.map((theme) => ({
    ...theme,
    preview: resolveThemeById(theme.id).themes.light,
  })),
);

const defaultOpenLabel = computed(() =>
  defaultOpenChoices.find((item) => item.value === defaultOpen.value)?.text || defaultOpen.value,
);

const topFieldStyles = computed(() => {
  const themeWidth = estimateTopFieldWidthPx(t("views.settings.theme"), currentThemeLabel.value, 18);
  const defaultPageWidth = estimateTopFieldWidthPx(t("views.settings.defaultPage"), defaultOpenLabel.value);
  const toStyle = (widthPx: number) => ({
    flex: `${Math.max(1, Math.round(widthPx))} 1 0`,
    minWidth: `${Math.max(136, Math.round(widthPx))}px`,
  });
  return {
    theme: toStyle(themeWidth),
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
.select-card-chip-flow {
  align-items: stretch !important;
}

.select-card-chip-flow > .settings-check-chip {
  width: auto;
  flex: 1 1 0;
  min-width: fit-content;
}

.settings-scroll {
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  flex: 1;
}

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

.lang-select {
  min-width: min-content;
}

.lang-select :deep(.lang-credit) {
  min-width: max-content;
}

</style>
