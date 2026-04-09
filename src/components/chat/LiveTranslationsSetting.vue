<template>
  <div ref="root" class="relative inline-flex">
    <UiButton
      variant="ghost"
      size="icon"
      class-name="h-7 w-7 rounded-full"
      :title="$t('views.watch.chat.TLSettingsTitle')"
      @click="dialog = !dialog"
    >
      <UiIcon :icon="icons.mdiCog" size="sm" />
    </UiButton>

    <teleport to="body">
      <div
        v-if="dialog"
        class="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
        @click.self="dialog = false"
      >
        <UiCard class-name="max-h-[85vh] w-full max-w-lg overflow-hidden border border-white/10 p-0">
          <div class="flex items-center gap-3 border-b border-white/10 px-5 py-4">
            <UiButton
              v-if="showBlockedList"
              variant="ghost"
              size="icon"
              class-name="h-8 w-8"
              @click="showBlockedList = false"
            >
              <UiIcon :icon="icons.mdiArrowLeft" size="sm" />
            </UiButton>
            <div>
              <div class="text-lg font-semibold text-white">
                {{ showBlockedList ? $t("views.channels.tabs.Blocked") : $t("views.watch.chat.TLSettingsTitle") }}
              </div>
              <div class="text-sm text-slate-400">
                {{ showBlockedList ? "Manage blocked translator names." : "Tune live translation behavior and layout." }}
              </div>
            </div>
          </div>

          <div class="max-h-[70vh] overflow-y-auto px-5 py-4">
            <template v-if="!showBlockedList">
              <div class="space-y-5">
                <label class="flex flex-col gap-2 text-sm">
                  <span class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    {{ $t("views.settings.tlLanguageSelection") }}
                  </span>
                  <select
                    v-model="liveTlLang"
                    class="h-11 rounded-2xl border border-white/12 bg-white/6 px-3 text-sm text-white outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20"
                  >
                    <option
                      v-for="item in TL_LANGS"
                      :key="item.value"
                      :value="item.value"
                      class="bg-slate-900"
                    >
                      {{ item.text }}
                    </option>
                  </select>
                </label>

                <div class="space-y-3">
                  <SettingToggle v-model="liveTlShowVerified" :label="$t('views.watch.chat.showVerifiedMessages')" />
                  <SettingToggle v-model="liveTlShowModerator" :label="$t('views.watch.chat.showModeratorMessages')" />
                  <SettingToggle v-model="liveTlShowVtuber" :label="$t('views.watch.chat.showVtuberMessages')" />
                  <SettingToggle v-model="liveTlShowLocalTime" :label="$t('views.watch.chat.showLocalTime')" />
                  <SettingToggle v-model="liveTlShowSubtitle" :label="$t('views.watch.chat.showSubtitle')" />
                  <SettingToggle v-model="liveTlHideSpoiler" :label="$t('views.watch.chat.hideSpoiler')" />
                  <SettingToggle
                    v-model="liveTlStickBottom"
                    :label="$t('views.watch.chat.StickBottomSettingLabel')"
                    :description="$t('views.watch.chat.StickBottomSettingsDesc')"
                  />
                </div>

                <UiButton variant="outline" @click="showBlockedList = true">
                  Edit Blocked List
                </UiButton>

                <div class="grid gap-4 sm:grid-cols-2">
                  <label class="flex flex-col gap-2 text-sm">
                    <span class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      {{ $t("views.watch.chat.tlFontSize") }}
                    </span>
                    <div class="flex items-center gap-2">
                      <UiInput v-model="liveTlFontSize" type="number" class-name="flex-1" />
                      <span class="text-sm text-slate-400">px</span>
                    </div>
                  </label>

                  <label class="flex flex-col gap-2 text-sm">
                    <span class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      {{ $t("views.watch.chat.tlWindowSize") }}
                    </span>
                    <div class="flex items-center gap-2">
                      <UiInput v-model="liveTlWindowSize" type="number" class-name="flex-1" />
                      <span class="text-sm text-slate-400">%</span>
                    </div>
                  </label>
                </div>
              </div>
            </template>

            <template v-else>
              <div v-if="blockedList.length" class="space-y-2">
                <div
                  v-for="name in blockedList"
                  :key="name"
                  class="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                >
                  <span class="text-sm text-white">{{ name }}</span>
                  <UiButton variant="secondary" size="sm" @click="toggleBlockName(name)">
                    Unblock
                  </UiButton>
                </div>
              </div>
              <div v-else class="rounded-2xl border border-dashed border-white/12 px-4 py-8 text-center text-sm text-slate-400">
                No blocked names.
              </div>
            </template>
          </div>
        </UiCard>
      </div>
    </teleport>
  </div>
</template>


<script setup lang="ts">
import { ref, computed, watch, defineComponent } from "vue";
import { TL_LANGS } from "@/utils/consts";
import { useSettingsStore } from "@/stores/settings";
import UiButton from "@/components/ui/button/Button.vue";
import UiCard from "@/components/ui/card/Card.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import UiInput from "@/components/ui/input/Input.vue";
import * as icons from "@/utils/icons";

defineOptions({ name: "LiveTranslationsSettings" });

// Inline sub-component: available in template automatically via script setup
const SettingToggle = defineComponent({
  name: "SettingToggle",
  components: { UiButton },
  props: {
    modelValue: { type: Boolean, default: false },
    label: { type: String, required: true },
    description: { type: String, default: "" },
  },
  emits: ["update:modelValue"],
  template: `
      <label class="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
        <div>
          <div class="text-sm font-medium text-white">{{ label }}</div>
          <div v-if="description" class="mt-1 text-xs text-slate-400">{{ description }}</div>
        </div>
        <input
          :checked="modelValue"
          type="checkbox"
          class="h-4 w-4 rounded border-white/20 bg-transparent"
          @change="$emit('update:modelValue', $event.target.checked)"
        >
      </label>
    `,
});

const settingsStore = useSettingsStore();

const showBlockedList = ref(false);
const dialog = ref(false);

const liveTlStickBottom = computed({
  get: () => settingsStore.liveTlStickBottom,
  set: (v: boolean) => { settingsStore.liveTlStickBottom = v; },
});
const liveTlLang = computed({
  get: () => settingsStore.liveTlLang,
  set: (v: string) => { settingsStore.liveTlLang = v; },
});
const liveTlFontSize = computed({
  get: () => settingsStore.liveTlFontSize,
  set: (v: number) => { settingsStore.liveTlFontSize = v; },
});
const liveTlShowVerified = computed({
  get: () => settingsStore.liveTlShowVerified,
  set: (v: boolean) => { settingsStore.liveTlShowVerified = v; },
});
const liveTlShowModerator = computed({
  get: () => settingsStore.liveTlShowModerator,
  set: (v: boolean) => { settingsStore.liveTlShowModerator = v; },
});
const liveTlWindowSize = computed({
  get: () => settingsStore.liveTlWindowSize,
  set: (v: number) => { settingsStore.liveTlWindowSize = v; },
});
const liveTlShowLocalTime = computed({
  get: () => settingsStore.liveTlShowLocalTime,
  set: (v: boolean) => { settingsStore.liveTlShowLocalTime = v; },
});
const liveTlShowVtuber = computed({
  get: () => settingsStore.liveTlShowVtuber,
  set: (v: boolean) => { settingsStore.liveTlShowVtuber = v; },
});
const liveTlShowSubtitle = computed({
  get: () => settingsStore.liveTlShowSubtitle,
  set: (v: boolean) => { settingsStore.liveTlShowSubtitle = v; },
});
const liveTlHideSpoiler = computed({
  get: () => settingsStore.liveTlHideSpoiler,
  set: (v: boolean) => { settingsStore.liveTlHideSpoiler = v; },
});

const blockedNames = computed(() => settingsStore.liveTlBlockedNames);
const blockedList = computed(() => Array.from(blockedNames.value.values()));

watch(dialog, (nw) => {
  if (!nw) showBlockedList.value = false;
});

function toggleBlockName(name: string) {
  settingsStore.toggleLiveTlBlocked(name);
}
</script>
