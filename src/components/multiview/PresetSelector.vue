<template>
  <!-- Dropdown preset menu: shows all groups in a scrollable panel -->
  <div class="preset-dropdown-menu">
    <!-- Desktop groups -->
    <template v-if="desktopGroups.length">
      <div
        v-for="(group, index) in desktopGroups"
        :key="`group-${index}`"
      >
        <div v-if="group && group.length" class="mb-1">
          <div class="px-2 pb-1.5 pt-2 text-[0.68rem] font-medium uppercase tracking-widest text-[color:var(--color-muted-foreground)]">
            {{ $t("component.channelInfo.videoCount", [index]) }}
          </div>
          <div class="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-1.5 px-1">
            <div
              v-for="preset in group"
              :key="preset.id || preset.name"
              class="relative"
            >
              <button
                type="button"
                class="w-full cursor-pointer rounded-lg border p-1 transition"
                :class="presetInAuto(preset) ? 'border-sky-400/40 bg-sky-500/10' : 'border-white/8 bg-white/3 hover:border-white/14 hover:bg-white/7'"
                @click="handleSelected(preset)"
              >
                <LayoutPreviewCard :preset="preset" :active="presetInAuto(preset)" :scale="0.55" />
              </button>
              <button
                v-if="preset.custom"
                type="button"
                class="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-md bg-black/40 text-slate-400 transition hover:bg-red-500/30 hover:text-red-300"
                @click.stop="removePresetLayout(preset)"
              >
                <UiIcon :icon="icons.mdiDelete" size="xs" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Custom presets -->
    <div v-if="decodedCustomPresets.length" class="mb-1">
      <div class="px-2 pb-1.5 pt-2 text-[0.68rem] font-medium uppercase tracking-widest text-[color:var(--color-muted-foreground)]">
        {{ $t("views.multiview.preset.custom") }}
      </div>
      <div class="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-1.5 px-1">
        <div
          v-for="preset in decodedCustomPresets"
          :key="preset.id || preset.name"
          class="relative"
        >
          <button
            type="button"
            class="w-full cursor-pointer rounded-lg border p-1 transition"
            :class="presetInAuto(preset) ? 'border-sky-400/40 bg-sky-500/10' : 'border-white/8 bg-white/3 hover:border-white/14 hover:bg-white/7'"
            @click="handleSelected(preset)"
          >
            <LayoutPreviewCard :preset="preset" :active="presetInAuto(preset)" :scale="0.55" />
          </button>
          <button
            type="button"
            class="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-md bg-black/40 text-slate-400 transition hover:bg-red-500/30 hover:text-red-300"
            @click.stop="removePresetLayout(preset)"
          >
            <UiIcon :icon="icons.mdiDelete" size="xs" />
          </button>
        </div>
      </div>
    </div>

    <div v-if="!desktopGroups.length && !decodedCustomPresets.length" class="px-3 py-4 text-center text-sm text-slate-400">
      No presets available
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import UiIcon from "@/components/ui/icon/Icon.vue";
import LayoutPreviewCard from "./LayoutPreviewCard.vue";
import { useMultiviewStore } from "@/stores/multiview";
import * as icons from "@/utils/icons";

defineOptions({ name: "PresetSelector" });

const emit = defineEmits<{
  (e: "selected", preset: any): void;
}>();

const { t } = useI18n();
const multiviewStore = useMultiviewStore();

const autoLayout = computed(() => multiviewStore.autoLayout);
const decodedCustomPresets = computed(() => multiviewStore.decodedCustomPresets);
const desktopGroups = computed(() => multiviewStore.desktopGroups);
const autoLayoutSet = computed(() => new Set(autoLayout.value));

function setAutoLayout(index: number, encodedLayout: any) {
  multiviewStore.setAutoLayout({ index, encodedLayout });
}

function handleSelected(preset: any) {
  emit("selected", preset);
}

function removePresetLayout(preset: any) {
  const presetIdx = autoLayout.value.findIndex((l: any) => l === preset.id);
  if (presetIdx >= 0) setAutoLayout(presetIdx, null);
  multiviewStore.removePresetLayout(preset.name);
}

function presetInAuto(preset: any) {
  return autoLayoutSet.value.has(preset.id);
}
</script>

<style scoped>
.preset-dropdown-menu {
  width: min(36rem, calc(100vw - 2rem));
  max-height: min(80vh, 600px);
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0.5rem;
}
</style>
