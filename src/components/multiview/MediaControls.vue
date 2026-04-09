<template>
  <div v-if="modelValue" ref="panelRoot" class="media-controls-dropdown absolute right-0 top-full z-[90] mt-2 w-[min(92vw,24rem)]">
    <UiCard class-name="max-h-[60vh] overflow-y-auto border border-[color:var(--color-border)] bg-[color:var(--surface-nav)] p-4 shadow-2xl shadow-black/60 backdrop-blur-xl">
      <div class="text-base font-semibold text-[color:var(--color-foreground)]">
        {{ $t("views.multiview.mediaControls") }}
      </div>

      <div class="mt-3 space-y-2">
        <section class="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-2.5">
          <div class="flex flex-wrap items-center gap-1.5">
            <UiButton type="button" size="icon" variant="ghost" class-name="h-7 w-7" @click="allCellAction('play')">
              <UiIcon :icon="icons.mdiPlay" size="sm" class-name="text-sky-300" />
            </UiButton>
            <UiButton type="button" size="icon" variant="ghost" class-name="h-7 w-7" title="Sync" @click="allCellAction('sync')">
              <UiIcon :icon="mdiFastForward" size="sm" class-name="text-sky-300" />
            </UiButton>
            <UiButton type="button" size="icon" variant="ghost" class-name="h-7 w-7" @click="allCellAction('pause')">
              <UiIcon :icon="mdiPause" size="sm" class-name="text-sky-300" />
            </UiButton>
            <UiButton type="button" size="icon" variant="ghost" class-name="h-7 w-7" @click="allCellAction('refresh')">
              <UiIcon :icon="icons.mdiRefresh" size="sm" class-name="text-sky-300" />
            </UiButton>
            <UiButton type="button" size="icon" variant="ghost" class-name="h-7 w-7" @click="allCellAction('unmute')">
              <UiIcon :icon="icons.mdiVolumeHigh" size="sm" class-name="text-sky-300" />
            </UiButton>
            <UiButton type="button" size="icon" variant="ghost" class-name="h-7 w-7" @click="allCellAction('mute')">
              <UiIcon :icon="icons.mdiVolumeMute" size="sm" class-name="text-sky-300" />
            </UiButton>

            <input
              class="volume-slider ml-auto"
              type="range"
              min="0"
              max="100"
              step="1"
              :value="allVolume"
              @input="setAllVolume(Number(($event.target as HTMLInputElement).value))"
            >
          </div>
        </section>

        <template v-if="modelValue && videoCellsRef && videoCellsRef.length">
          <section
            v-for="(cellState, index) in cells"
            :key="index"
            class="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-2.5"
          >
            <div class="flex items-start gap-2.5">
              <router-link :to="cellState.video?.channel?.id?.startsWith('UC') ? `/channel/${cellState.video?.channel?.id}` : ''">
                <img
                  class="h-8 w-8 rounded-full border border-[color:var(--color-border)] object-cover"
                  :src="cellState.video?.channel?.id ? getChannelPhoto(cellState.video.channel.id) : ''"
                  alt=""
                >
              </router-link>

              <div class="min-w-0 flex-1">
                <div class="truncate text-xs font-medium text-sky-300">
                  {{ cellState.video.title || cellState.video.channel.name }}
                </div>

                <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <UiButton type="button" size="icon" variant="ghost" class-name="h-7 w-7" @click="cellState.setPlaying(cellState.editMode)">
                    <UiIcon :icon="cellState.editMode ? icons.mdiPlay : mdiPause" size="sm" class-name="text-slate-300" />
                  </UiButton>
                  <UiButton v-if="!cellState.isTwitchVideo" type="button" size="icon" variant="ghost" class-name="h-7 w-7" @click="cellState.togglePlaybackRate()">
                    <UiIcon :icon="mdiFastForward" size="sm" :class-name="cellState.isFastFoward ? 'text-sky-300' : 'text-slate-300'" />
                  </UiButton>
                  <UiButton type="button" size="icon" variant="ghost" class-name="h-7 w-7" @click="cellState.refresh()">
                    <UiIcon :icon="icons.mdiRefresh" size="sm" class-name="text-slate-300" />
                  </UiButton>
                  <UiButton type="button" size="icon" variant="ghost" class-name="h-7 w-7" @click="cellState.deleteCell()">
                    <UiIcon :icon="icons.mdiDelete" size="sm" class-name="text-slate-300" />
                  </UiButton>
                  <UiButton type="button" size="icon" variant="ghost" class-name="h-7 w-7" @click="cellState.setMuted(!cellState.muted)">
                    <UiIcon :icon="cellState.muted ? icons.mdiVolumeMute : icons.mdiVolumeHigh" size="sm" class-name="text-slate-300" />
                  </UiButton>

                  <input
                    class="volume-slider ml-auto"
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    :value="cellState.volume"
                    @input="cellState.setVolume(Number(($event.target as HTMLInputElement).value))"
                  >
                </div>
              </div>
            </div>
          </section>
        </template>

        <div
          v-else
          class="rounded-lg border border-dashed border-[color:var(--color-border)] px-3 py-4 text-center text-xs text-[color:var(--color-muted-foreground)]"
        >
          {{ $t("views.multiview.mediaControlsEmpty") }}
        </div>

        <label class="flex items-start gap-2.5 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-2.5 text-xs text-[color:var(--color-foreground)]">
          <input v-model="muteOthers" type="checkbox" class="mt-0.5 h-3.5 w-3.5">
          <span>
            <span class="block text-xs font-medium text-[color:var(--color-foreground)]">{{ $t("views.multiview.muteOthers") }}</span>
            <span class="block text-[color:var(--color-muted-foreground)]">{{ $t("views.multiview.muteOthersDetail") }}</span>
          </span>
        </label>
      </div>
    </UiCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, inject, type Ref } from "vue";
import {
  mdiPause, mdiFastForward,
} from "@mdi/js";
import { getChannelPhoto } from "@/utils/functions";
import UiButton from "@/components/ui/button/Button.vue";
import UiCard from "@/components/ui/card/Card.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import { useMultiviewStore } from "@/stores/multiview";

defineOptions({ name: "MediaControls" });

const props = defineProps<{
  modelValue?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();

const multiviewStore = useMultiviewStore();
const videoCellsRef = inject<Ref<any[]>>("videoCells", ref([]));
const panelRoot = ref<HTMLElement | null>(null);

const timerRef = ref<ReturnType<typeof setInterval> | null>(null);
const isMounted = ref(false);

const muteOthers = computed({
  get: () => multiviewStore.muteOthers,
  set: (v: boolean) => { multiviewStore.setMuteOthers(v); },
});

const activeVideos = computed(() => multiviewStore.activeVideos);

const allVolume = computed(() => {
  const cells = videoCellsRef.value;
  if (!isMounted.value || !props.modelValue || !cells || !cells.length) return 0;
  const vol = cells[0].volume;
  return cells.every((c: any) => c.volume === vol) ? vol : 0;
});

const cells = computed(() => {
  const alwaysTrue = props.modelValue || !props.modelValue || activeVideos.value;
  if (!videoCellsRef.value) return [];
  return alwaysTrue && videoCellsRef.value.filter((c: any) => c.video);
});

watch(() => props.modelValue, (val) => {
  if (val && isMounted.value) {
    cells.value.forEach((c: any) => c.manualRefresh());
  }
});

// created
if (!timerRef.value) {
  timerRef.value = setInterval(() => {
    if (cells.value) cells.value.forEach((c: any) => c.manualCheckMuted());
  }, 1000);
}

onMounted(() => {
  isMounted.value = true;
});

onBeforeUnmount(() => {
  if (timerRef.value) {
    clearInterval(timerRef.value);
  }
});

function setAllVolume(val: number) {
  cells.value.forEach((c: any) => c.setVolume(val));
}

function allCellAction(fnName: string) {
  const cellsList = videoCellsRef.value;
  if (!cellsList) return;
  cellsList.forEach((c: any) => {
    switch (fnName) {
      case "mute": c.setMuted(true); break;
      case "play": c.setPlaying(true); break;
      case "pause": c.setPlaying(false); break;
      case "unmute": c.setMuted(false); break;
      case "refresh": c.refresh(); break;
      case "sync":
        if (c.video.status === "live") {
          c.setPlaybackRate(2);
        } else {
          c.togglePlaybackRate();
        }
        break;
      default: break;
    }
  });
}
</script>

<style>
.volume-slider {
  flex-basis: 96px;
  accent-color: rgb(56 189 248);
  box-sizing: border-box;
}
</style>
