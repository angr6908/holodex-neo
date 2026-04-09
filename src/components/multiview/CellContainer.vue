<template>
  <div
    class="mv-cell relative"
    :class="{
      'edit-mode': editMode,
    }"
    @drop="drop"
    @dragover="allowDrop"
    @dragleave="dragLeave"
    @dragenter="dragEnter"
  >
    <transition name="fade">
      <div
        v-if="showDropOverlay"
        class="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/72 backdrop-blur-sm"
      >
        <UiIcon :icon="mdiSelectionEllipseArrowInside" size="xl" class-name="text-sky-200" />
      </div>
    </transition>

    <slot />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { getVideoIDFromUrl } from "@/utils/functions";
import {
  mdiSelectionEllipseArrowInside,
} from "@mdi/js";
import { TWITCH_VIDEO_URL_REGEX } from "@/utils/consts";
import UiIcon from "@/components/ui/icon/Icon.vue";
import { useMultiviewStore } from "@/stores/multiview";

defineOptions({ name: "CellContainer" });

const props = withDefaults(defineProps<{
  item: Record<string, any>;
  index?: number;
}>(), {
  index: -1,
});

const multiviewStore = useMultiviewStore();

const showDropOverlay = ref(false);
const enterTarget = ref<EventTarget | null>(null);

const editMode = computed(() =>
  multiviewStore.layoutContent[props.item.i]?.editMode ?? true,
);

watch(editMode, (newMode) => {
  setLayoutFreeze(newMode);
});

function setLayoutFreeze(newMode = editMode.value) {
  if (newMode) multiviewStore.unfreezeLayoutItem(props.item.i);
  else multiviewStore.freezeLayoutItem(props.item.i);
}

function dragEnter(ev: DragEvent) {
  enterTarget.value = ev.target;
  showDropOverlay.value = true;
}

function dragLeave(ev: DragEvent) {
  if (enterTarget.value === ev.target) {
    showDropOverlay.value = false;
  }
}

function allowDrop(ev: DragEvent) {
  ev.preventDefault();
}

function drop(ev: DragEvent) {
  ev.preventDefault();
  showDropOverlay.value = false;
  const json: string = ev.dataTransfer!.getData("application/json");
  if (json) {
    const video = JSON.parse(json);

    if (video.id.length === 11 && video.channel.name) {
      let v = video;
      if (video.type === "placeholder") {
        const twitchChannel = video.link.match(TWITCH_VIDEO_URL_REGEX)?.groups?.id;
        if (!twitchChannel) return;
        v = {
          ...video,
          id: twitchChannel,
          type: "twitch",
        };
      }
      multiviewStore.setLayoutContentById({
        id: props.item.i,
        content: {
          type: "video",
          id: v.id,
          video: v,
        },
      });
      multiviewStore.fetchVideoData();
    }
    return;
  }

  const text: string = ev.dataTransfer!.getData("text");
  const video = getVideoIDFromUrl(text);
  if (!video || !video.id) return;

  multiviewStore.setLayoutContentById({
    id: props.item.i,
    content: {
      id: video.id,
      type: "video",
      video,
    },
  });
  multiviewStore.fetchVideoData();
}
</script>

<style lang="scss">
.mv-cell {
    display: flex;
    background-size: contain;
    background-position: center;
    height: 100%;
    border: 1px solid rgb(240 98 145 / 0.09);
    justify-content: flex-start;
    align-content: stretch;
    flex-direction: column;
    background: rgb(15 23 42 / 0.55);
    backdrop-filter: blur(8px);

    .cell-content {
        display: flex;
        flex-grow: 1;
        flex-basis: 100%;
        flex-shrink: 1;
        min-height: 0;
        max-height: 100%;
        height: 100%;
        width: 100%;
        flex-direction: column;
        overflow: hidden;
    }
}

.mv-cell.edit-mode {
    border: 1px solid transparent;
    box-shadow: inset 0 0 0 2px var(--color-secondary);
}

.vue-grid-item.vue-draggable-dragging .mv-cell,
.vue-grid-item.resizing .mv-cell {
    pointer-events: none;
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>
