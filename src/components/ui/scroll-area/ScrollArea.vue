<template>
  <div ref="root" :class="rootClass">
    <div
      ref="viewport"
      :class="viewportClass"
      :style="viewportMaskStyle"
      @scroll="scheduleSync"
    >
      <div :class="contentClass">
        <slot />
      </div>
    </div>

    <div
      v-if="showVerticalScrollbar"
      ref="verticalTrack"
      class="scroll-area-track scroll-area-track-vertical"
      @mousedown.stop.prevent="jumpToTrack('vertical', $event)"
      @click.stop.prevent
    >
      <div
        class="scroll-area-thumb scroll-area-thumb-vertical"
        :style="verticalThumbStyle"
        @mousedown.stop.prevent="startThumbDrag('vertical', $event)"
        @click.stop.prevent
      />
    </div>

    <div
      v-if="showHorizontalScrollbar"
      ref="horizontalTrack"
      class="scroll-area-track scroll-area-track-horizontal"
      @mousedown.stop.prevent="jumpToTrack('horizontal', $event)"
      @click.stop.prevent
    >
      <div
        class="scroll-area-thumb scroll-area-thumb-horizontal"
        :style="horizontalThumbStyle"
        @mousedown.stop.prevent="startThumbDrag('horizontal', $event)"
        @click.stop.prevent
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUpdated, onBeforeUnmount } from "vue";
import { cn } from "@/utils/functions";

const props = withDefaults(defineProps<{
  className?: string;
  viewportClassName?: string;
  contentClassName?: string;
  orientation?: string;
  fadeEdges?: string;
  nativeScrollbar?: boolean;
}>(), {
  className: "",
  viewportClassName: "",
  contentClassName: "",
  orientation: "vertical",
  fadeEdges: "",
  nativeScrollbar: true,
});

const root = ref<HTMLElement | null>(null);
const viewport = ref<HTMLElement | null>(null);
const verticalTrack = ref<HTMLElement | null>(null);
const horizontalTrack = ref<HTMLElement | null>(null);

const metrics = ref({
  clientWidth: 0,
  clientHeight: 0,
  scrollWidth: 0,
  scrollHeight: 0,
  scrollLeft: 0,
  scrollTop: 0,
});
let frame: number | null = null;
let resizeObserver: ResizeObserver | null = null;
let dragState: { axis: string; startX: number; startY: number; startScrollLeft: number; startScrollTop: number } | null = null;

const supportsHorizontal = computed(() => ["horizontal", "both"].includes(props.orientation));
const supportsVertical = computed(() => ["vertical", "both"].includes(props.orientation));
const maxScrollLeft = computed(() => Math.max(0, metrics.value.scrollWidth - metrics.value.clientWidth));
const maxScrollTop = computed(() => Math.max(0, metrics.value.scrollHeight - metrics.value.clientHeight));

const horizontalThumbWidth = computed(() => {
  const trackWidth = metrics.value.clientWidth;
  if (!trackWidth || !metrics.value.scrollWidth) return 0;
  return Math.max(28, (trackWidth / metrics.value.scrollWidth) * trackWidth);
});
const verticalThumbHeight = computed(() => {
  const trackHeight = metrics.value.clientHeight;
  if (!trackHeight || !metrics.value.scrollHeight) return 0;
  return Math.max(28, (trackHeight / metrics.value.scrollHeight) * trackHeight);
});

const showHorizontalScrollbar = computed(() => !props.nativeScrollbar && supportsHorizontal.value && maxScrollLeft.value > 1);
const showVerticalScrollbar = computed(() => !props.nativeScrollbar && supportsVertical.value && maxScrollTop.value > 1);

const rootClass = computed(() => cn("relative", props.className));
const viewportClass = computed(() =>
  cn(
    "scroll-area-viewport h-full w-full",
    props.nativeScrollbar ? "scroll-area-viewport-native" : "scroll-area-viewport-custom",
    supportsHorizontal.value && supportsVertical.value
      ? "overflow-auto"
      : supportsHorizontal.value
        ? "overflow-x-auto overflow-y-hidden"
        : "overflow-y-auto overflow-x-hidden",
    props.viewportClassName,
  ),
);
const contentClass = computed(() =>
  cn(
    "min-h-full min-w-full",
    props.nativeScrollbar && supportsVertical.value ? "scroll-area-content-native" : "",
    props.contentClassName,
  ),
);

const horizontalThumbStyle = computed(() => {
  const trackWidth = metrics.value.clientWidth;
  if (!trackWidth || !metrics.value.scrollWidth) return {};
  const thumbWidth = horizontalThumbWidth.value;
  const left = maxScrollLeft.value > 0
    ? ((trackWidth - thumbWidth) * metrics.value.scrollLeft) / maxScrollLeft.value
    : 0;
  return {
    width: `${thumbWidth}px`,
    transform: `translateX(${left}px)`,
  };
});

const verticalThumbStyle = computed(() => {
  const trackHeight = metrics.value.clientHeight;
  if (!trackHeight || !metrics.value.scrollHeight) return {};
  const thumbHeight = verticalThumbHeight.value;
  const top = maxScrollTop.value > 0
    ? ((trackHeight - thumbHeight) * metrics.value.scrollTop) / maxScrollTop.value
    : 0;
  return {
    height: `${thumbHeight}px`,
    transform: `translateY(${top}px)`,
  };
});

const viewportMaskStyle = computed(() => {
  if (props.fadeEdges !== "horizontal" || !supportsHorizontal.value || !metrics.value.clientWidth) return {};
  const fadeSize = 18;
  const leftFade = metrics.value.scrollLeft > 1 ? fadeSize : 0;
  const rightFade = maxScrollLeft.value - metrics.value.scrollLeft > 1 ? fadeSize : 0;

  if (!leftFade && !rightFade) return {};

  const mask = `linear-gradient(to right,
        rgba(0, 0, 0, 0) 0px,
        rgba(0, 0, 0, 1) ${leftFade}px,
        rgba(0, 0, 0, 1) calc(100% - ${rightFade}px),
        rgba(0, 0, 0, 0) 100%)`;

  return {
    maskImage: mask,
    WebkitMaskImage: mask,
  };
});

function syncMetrics() {
  const vp = viewport.value;
  if (!vp) return;
  metrics.value = {
    clientWidth: vp.clientWidth,
    clientHeight: vp.clientHeight,
    scrollWidth: vp.scrollWidth,
    scrollHeight: vp.scrollHeight,
    scrollLeft: vp.scrollLeft,
    scrollTop: vp.scrollTop,
  };
}

function scheduleSync() {
  if (props.nativeScrollbar) return;
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = null;
    syncMetrics();
  });
}

function scrollViewportBy(options: ScrollToOptions) {
  viewport.value?.scrollBy?.(options);
  scheduleSync();
}

function scrollViewportTo(options: ScrollToOptions) {
  viewport.value?.scrollTo?.(options);
  scheduleSync();
}

function jumpToTrack(axis: string, event: MouseEvent) {
  if (axis === "horizontal") {
    const track = horizontalTrack.value;
    if (!track || !maxScrollLeft.value) return;
    const rect = track.getBoundingClientRect();
    const thumbWidth = horizontalThumbWidth.value;
    const offset = Math.max(0, Math.min(rect.width - thumbWidth, event.clientX - rect.left - thumbWidth / 2));
    const ratio = rect.width > thumbWidth ? offset / (rect.width - thumbWidth) : 0;
    scrollViewportTo({ left: ratio * maxScrollLeft.value, behavior: "auto" });
    return;
  }

  const track = verticalTrack.value;
  if (!track || !maxScrollTop.value) return;
  const rect = track.getBoundingClientRect();
  const thumbHeight = verticalThumbHeight.value;
  const offset = Math.max(0, Math.min(rect.height - thumbHeight, event.clientY - rect.top - thumbHeight / 2));
  const ratio = rect.height > thumbHeight ? offset / (rect.height - thumbHeight) : 0;
  scrollViewportTo({ top: ratio * maxScrollTop.value, behavior: "auto" });
}

function startThumbDrag(axis: string, event: MouseEvent) {
  dragState = {
    axis,
    startX: event.clientX,
    startY: event.clientY,
    startScrollLeft: metrics.value.scrollLeft,
    startScrollTop: metrics.value.scrollTop,
  };
}

function handleDragMove(event: MouseEvent) {
  if (!dragState) return;
  event.preventDefault();
  if (dragState.axis === "horizontal") {
    const track = horizontalTrack.value;
    if (!track || !maxScrollLeft.value) return;
    const rect = track.getBoundingClientRect();
    const usableTrack = rect.width - horizontalThumbWidth.value;
    if (usableTrack <= 0) return;
    const delta = event.clientX - dragState.startX;
    const nextLeft = dragState.startScrollLeft + (delta / usableTrack) * maxScrollLeft.value;
    scrollViewportTo({ left: nextLeft, behavior: "auto" });
    return;
  }

  const track = verticalTrack.value;
  if (!track || !maxScrollTop.value) return;
  const rect = track.getBoundingClientRect();
  const usableTrack = rect.height - verticalThumbHeight.value;
  if (usableTrack <= 0) return;
  const delta = event.clientY - dragState.startY;
  const nextTop = dragState.startScrollTop + (delta / usableTrack) * maxScrollTop.value;
  scrollViewportTo({ top: nextTop, behavior: "auto" });
}

function handleDragEnd() {
  dragState = null;
}

onMounted(() => {
  if (props.nativeScrollbar) return;
  syncMetrics();
  if (window.ResizeObserver && viewport.value) {
    resizeObserver = new ResizeObserver(() => {
      scheduleSync();
    });
    resizeObserver.observe(viewport.value);
  }
  window.addEventListener("resize", scheduleSync, { passive: true });
  window.addEventListener("mousemove", handleDragMove, { passive: false });
  window.addEventListener("mouseup", handleDragEnd, { passive: true });
});

onUpdated(() => {
  if (props.nativeScrollbar) return;
  scheduleSync();
});

onBeforeUnmount(() => {
  if (frame) cancelAnimationFrame(frame);
  resizeObserver?.disconnect?.();
  window.removeEventListener("resize", scheduleSync);
  window.removeEventListener("mousemove", handleDragMove);
  window.removeEventListener("mouseup", handleDragEnd);
});

defineExpose({ scrollViewportBy, scrollViewportTo });
</script>

<style scoped>
.scroll-area-viewport {
  overscroll-behavior: contain;
}

.scroll-area-viewport-custom {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.scroll-area-viewport-custom::-webkit-scrollbar {
  display: none;
}

.scroll-area-viewport-native {
  --scroll-area-native-size: 12px;
  --scroll-area-native-gap: 0px;
  scrollbar-width: thin;
  scrollbar-gutter: auto;
  padding-inline-end: var(--scroll-area-native-gap);
  margin-inline-end: calc(var(--scroll-area-native-gap) * -1);
  scrollbar-color: color-mix(in srgb, var(--color-bold) 72%, var(--color-light) 28%) color-mix(in srgb, var(--color-light) 42%, transparent);
  background: transparent;
}

.scroll-area-viewport-native::-webkit-scrollbar {
  width: var(--scroll-area-native-size);
  height: var(--scroll-area-native-size);
}

.scroll-area-viewport-native::-webkit-scrollbar-track {
  border-radius: 9999px;
  background: transparent;
}

.scroll-area-viewport-native::-webkit-scrollbar-thumb {
  border-radius: 9999px;
  border: 1px solid color-mix(in srgb, var(--color-bold) 38%, transparent);
  background: color-mix(in srgb, var(--color-bold) 72%, var(--color-light) 28%);
}

.scroll-area-viewport-native::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--color-bold) 78%, var(--color-light) 22%);
}

.scroll-area-content-native {
  box-sizing: border-box;
  padding-inline-end: var(--scroll-area-native-gap);
  background: transparent;
}

.scroll-area-track {
  position: absolute;
  z-index: 10;
  cursor: pointer;
  border-radius: 9999px;
  background: color-mix(in srgb, var(--color-light) 42%, transparent);
  transition: background-color 160ms ease;
}

.scroll-area-track:hover {
  background: color-mix(in srgb, var(--color-bold) 34%, transparent);
}

.scroll-area-track-vertical {
  inset-block: 0.45rem;
  right: 0;
  width: 0.38rem;
}

.scroll-area-track-horizontal {
  inset-inline: 0.35rem;
  bottom: 0.2rem;
  height: 0.38rem;
}

.scroll-area-thumb {
  position: absolute;
  border-radius: 9999px;
  background: color-mix(in srgb, var(--color-bold) 72%, var(--color-light) 28%);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-bold) 38%, transparent);
}

.scroll-area-thumb-vertical {
  left: 0;
  right: 0;
}

.scroll-area-thumb-horizontal {
  top: 0;
  bottom: 0;
}
</style>
