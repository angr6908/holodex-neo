<template>
  <div v-if="isActive">
    <div class="text-sm font-semibold text-white">
      {{ $t("views.multiview.reorderLayout") }}
    </div>
    <div class="mt-2 text-xs text-slate-300">
      {{ $t("views.multiview.reorderLayoutDetail") }}
    </div>
    <div
      ref="container"
      class="layout-preview m-auto mt-3"
      :style="{
        width: `${size.width}px`,
        height: `${size.height}px`,
      }"
    >
        <template v-for="(l, idx) in layout" :key="l.i">
          <div
            class="layout-preview-cell"
            :style="getStyle(l)"
            @dragover="onDragOver"
            @drop="onDrop($event, idx)"
          >
            <div
              v-if="content && content[l.i]"
              draggable
              class="pa-3 grabbable"
              :style="{
                opacity: draggingIdx !== idx ? 1 : 0
              }"
              @dragstart="onDragStart($event, idx)"
              @touchstart="onTouchStart($event, idx)"
              @touchend="onTouchEnd($event, idx)"
              @touchmove="onTouchMove($event, idx)"
              @touchcancel="draggingIdx = -1"
            >
              <UiIcon v-if="content[l.i].type === 'chat'" :icon="icons.ytChat" size="lg" />
              <UiIcon
                v-if="content[l.i].type === 'video' && content[l.i].video.type === 'twitch'"
                :icon="mdiTwitch"
                size="lg"
              />
              <channel-img
                v-else-if="content[l.i].type === 'video'"
                :channel="content[l.i].video.channel"
                no-link
                rounded
              />
            </div>
          </div>
        </template>
        <div
          v-if="draggingIdx >= 0"
          style="position: absolute; touch-action: none"
          :style="draggableIconPos"
        >
          <UiIcon v-if="touchMoveContent.type === 'chat'" :icon="icons.ytChat" size="lg" />
          <UiIcon
            v-if="touchMoveContent.type === 'video' && touchMoveContent.video.type === 'twitch'"
            :icon="mdiTwitch"
            size="lg"
          />
          <channel-img
            v-else-if="touchMoveContent.type === 'video'"
            :channel="touchMoveContent.video.channel"
            no-link
            rounded
          />
        </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { mdiTwitch } from "@mdi/js";
import ChannelImg from "../channel/ChannelImg.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import { useMultiviewStore } from "@/stores/multiview";
import * as icons from "@/utils/icons";

defineOptions({ name: "RearrangeVideos" });

defineProps<{
  isActive?: boolean;
}>();

const multiviewStore = useMultiviewStore();

const draggableIconPos = ref<{ left: string | number; top: string | number }>({ left: 0, top: 0 });
const draggingIdx = ref(-1);
const container = ref<HTMLElement | null>(null);

const layout = computed(() => multiviewStore.layout);
const content = computed(() => multiviewStore.layoutContent);

const touchMoveContent = computed(() => {
  if (draggingIdx.value >= 0) return content.value[layout.value[draggingIdx.value].i];
  return null;
});

const size = computed(() => {
  const isXs = window.innerWidth < 640;
  const width = 2 * (isXs ? 108 : 192);
  const height = 2 * (isXs ? 192 : 108);
  return { width, height };
});

function onTouchStart(e: TouchEvent, idx: number) {
  e.preventDefault();
  draggingIdx.value = idx;
  onTouchMove(e);
}

function onTouchMove(e: TouchEvent) {
  e.preventDefault();
  const { x, y } = getRelativePoint(e.changedTouches[0]);
  draggableIconPos.value.left = `${x}px`;
  draggableIconPos.value.top = `${y}px`;
}

function onTouchEnd(e: TouchEvent, startIdx: number) {
  e.preventDefault();
  const { x, y } = getRelativePoint(e.changedTouches[0]);
  const { width, height } = size.value;
  const unitX = x / (width / 24);
  const unitY = y / (height / 24);
  const dropCellIdx = layout.value.findIndex((l: any) => unitX >= l.x && unitX < (l.x + l.w) && unitY >= l.y && unitY < (l.y + l.h));
  if (dropCellIdx !== undefined) {
    multiviewStore.swapGridPosition({ id1: startIdx, id2: dropCellIdx });
  }
  draggingIdx.value = -1;
}

function onDragStart(e: DragEvent, idx: number) {
  e.dataTransfer!.setData("index", String(idx));
}

function onDragOver(e: DragEvent) {
  e.preventDefault();
}

function onDrop(e: DragEvent, dropIdx: number) {
  e.preventDefault();
  const startIdx = Number(e.dataTransfer!.getData("index"));
  multiviewStore.swapGridPosition({ id1: startIdx, id2: dropIdx });
}

function getRelativePoint(touch: Touch) {
  const br = container.value!.getBoundingClientRect();
  const x = touch.clientX - br.left;
  const y = touch.clientY - br.top;
  return { x, y };
}

function getStyle(l: any) {
  function px(num: number) {
    return `${num * (100 / 24)}%`;
  }
  return {
    top: px(l.y),
    left: px(l.x),
    width: px(l.w),
    height: px(l.h),
    ...(content.value && content.value[l.i] && content.value[l.i].type === "chat"
      ? { "background-color": "rgba(245, 158, 11, 0.27)" }
      : { "background-color": "rgba(14, 165, 233, 0.27)" }),
  };
}
</script>
<style>
.grabbable, .grabbable *, .grabbable *:hover, .grabbable *:active {
    cursor: move !important; /* fallback if grab cursor is unsupported */
}
</style>
