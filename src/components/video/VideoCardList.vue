<template>
  <div ref="listRoot" class="relative py-0" :class="{ 'video-list--fade-under-nav': fadeUnderNavExt }">
    <div
      class="video-grid"
      :class="{
        'video-grid--compact': dense || denseList || horizontal,
        'video-grid--list': denseList || horizontal,
      }"
      :style="gridStyle"
    >
      <div
        v-for="(video, index) in processedVideos"
        :key="video.id"
        :ref="(el) => setVideoItemRef(video.id, el)"
        class="video-grid-item"
      >
        <VideoCard
          :video="video"
          fluid
          :include-channel="includeChannel"
          :horizontal="horizontal"
          :include-avatar="includeAvatar"
          :col-size="colSize"
          :active="video.id === activeId"
          :disable-default-click="disableDefaultClick"
          :dense-list="denseList"
          :hide-thumbnail="shouldHideThumbnail"
          :in-multi-view-selector="inMultiViewSelector"
          @videoClicked="handleVideoClick"
        >
          <!-- pass slot to each individual video card -->
          <template #action>
            <slot name="action" :video="video" />
          </template>
        </VideoCard>
        <!-- Append comment item for Comment Search -->
        <div
          v-if="showComments && video.comments"
          style="max-height: 400px"
          class="overflow-y-auto overflow-x-hidden bg-transparent text-xs"
        >
          <div class="mx-4 h-px bg-white/10" />
          <!-- Render Channel Avatar if necessary -->
          <div v-for="comment in video.comments" :key="comment.comment_key" class="p-0">
            <comment :comment="comment" :video-id="video.id" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUpdated, onBeforeUnmount, nextTick, defineAsyncComponent } from "vue";
import VideoCard from "@/components/video/VideoCard.vue";
import { useFilterVideos } from "@/composables/useFilterVideos";
import { useSettingsStore } from "@/stores/settings";
import { useAppStore } from "@/stores/app";

const Comment = defineAsyncComponent(() => import("./Comment.vue"));

const { filterVideos } = useFilterVideos();
const settingsStore = useSettingsStore();
const appStore = useAppStore();

const emit = defineEmits<{
  (e: "videoClicked", video: any): void;
}>();

const props = withDefaults(defineProps<{
  videos: any[];
  includeChannel?: boolean;
  includeAvatar?: boolean;
  hideThumbnail?: boolean;
  horizontal?: boolean;
  denseList?: boolean;
  cols?: { xs: number; sm: number; md: number; lg: number; xl: number };
  activeId?: string;
  dense?: boolean;
  disableDefaultClick?: boolean;
  filterConfig?: Record<string, any>;
  sortFn?: (v: any) => any;
  showComments?: boolean;
  inMultiViewSelector?: boolean;
  fadeUnderNavExt?: boolean;
}>(), {
  cols: () => ({ xs: 1, sm: 2, md: 3, lg: 4, xl: 5 }),
  activeId: "",
  dense: false,
  disableDefaultClick: false,
  filterConfig: () => ({}),
  hideThumbnail: false,
  showComments: false,
  fadeUnderNavExt: false,
});

const itemRefs = ref<Record<string, any>>({});
const itemMetrics = ref<any[]>([]);
const activeFadeIds = ref(new Set<string>());
let fadeFrame: number | null = null;
let navResizeObserver: ResizeObserver | null = null;
const navExtTop = ref(94);
const navExtBottom = ref(150);
const maxItemHeight = ref(0);
let needsMetricRefresh = false;

const processedVideos = computed(() => {
  const config = {
    ...settingsStore.$state,
    ignoreBlock: false,
    hideCollabs: false,
    hideIgnoredTopics: true,
    hideGroups: props.includeChannel,
    forOrg: "",
    ...props.filterConfig,
  };
  const filtered = props.videos
    .filter((v) => v && typeof v === "object" && v.id && v.channel)
    .filter((v) => filterVideos(v, config));
  return props.sortFn ? filtered.map(props.sortFn) : filtered;
});

const colSize = computed(() => {
  if (props.horizontal || props.denseList) return 1;
  const width = appStore.windowWidth || window.innerWidth;
  if (width < 600) return props.cols.xs;
  if (width < 960) return props.cols.sm;
  if (width < 1264) return props.cols.md;
  if (width < 1904) return props.cols.lg;
  return props.cols.xl;
});

const shouldHideThumbnail = computed(() => settingsStore.hideThumbnail || props.hideThumbnail);

const gridStyle = computed(() => ({
  "--video-grid-columns": props.horizontal || props.denseList ? 1 : colSize.value,
}));

function setVideoItemRef(id: string, el: any) {
  if (!props.fadeUnderNavExt) return;
  if (el) {
    itemRefs.value[id] = el;
    needsMetricRefresh = true;
    return;
  }
  clearFadeStyle(itemRefs.value[id]);
  delete itemRefs.value[id];
  activeFadeIds.value.delete(id);
  itemMetrics.value = itemMetrics.value.filter((metric) => metric.id !== id);
}

function observeNavExt() {
  if (!props.fadeUnderNavExt) return;
  const navExt = document.querySelector(".main-nav-ext");
  if (!navExt || navResizeObserver) return;
  if (!window.ResizeObserver) return;
  navResizeObserver = new window.ResizeObserver(() => {
    scheduleFadeUpdate(true);
  });
  navResizeObserver.observe(navExt);
}

function handleFadeViewportChange() {
  if (!props.fadeUnderNavExt) return;
  scheduleFadeUpdate(true);
}

function scheduleFadeUpdate(refreshMetrics = false) {
  if (!props.fadeUnderNavExt) return;
  if (refreshMetrics) needsMetricRefresh = true;
  if (fadeFrame) return;
  fadeFrame = requestAnimationFrame(() => {
    fadeFrame = null;
    if (needsMetricRefresh) refreshFadeMetrics();
    updateFadeStyles();
  });
}

function refreshFadeMetrics() {
  if (!props.fadeUnderNavExt) return;
  needsMetricRefresh = false;
  const scrollTop = window.scrollY || window.pageYOffset || 0;
  const navSurfaceRect = document.querySelector(".main-nav-ext > div")?.getBoundingClientRect?.()
    || document.querySelector(".main-nav-ext")?.getBoundingClientRect?.();
  navExtTop.value = navSurfaceRect?.top || 94;
  navExtBottom.value = navSurfaceRect?.bottom || 150;

  const metrics: any[] = [];
  let localMaxItemHeight = 0;
  Object.entries(itemRefs.value).forEach(([id, element]) => {
    if (!element?.getBoundingClientRect) return;
    const rect = element.getBoundingClientRect();
    const top = rect.top + scrollTop;
    const height = rect.height;
    metrics.push({ id, top, bottom: top + height, height });
    localMaxItemHeight = Math.max(localMaxItemHeight, height);
  });

  metrics.sort((a, b) => (a.top === b.top ? a.bottom - b.bottom : a.top - b.top));
  itemMetrics.value = metrics;
  maxItemHeight.value = localMaxItemHeight;
}

function findFirstMetricIndex(minTop: number) {
  let low = 0;
  let high = itemMetrics.value.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (itemMetrics.value[mid].top < minTop) low = mid + 1;
    else high = mid;
  }
  return low;
}

function getFadeSurface(element: any) {
  return element?.querySelector?.(".video-card-shell") || null;
}

function clearFadeStyle(element: any) {
  if (!element?.style) return;
  const fadeSurface = getFadeSurface(element);
  element.style.opacity = "";
  element.style.pointerEvents = "";
  element.style.clipPath = "";
  element.style.WebkitClipPath = "";
  element.style.maskImage = "";
  element.style.WebkitMaskImage = "";
  if (!fadeSurface?.style) return;
  fadeSurface.style.clipPath = "";
  fadeSurface.style.WebkitClipPath = "";
  fadeSurface.style.maskImage = "";
  fadeSurface.style.WebkitMaskImage = "";
}

function updateFadeStyles() {
  if (!props.fadeUnderNavExt) return;
  if (needsMetricRefresh) refreshFadeMetrics();

  const scrollTop = window.scrollY || window.pageYOffset || 0;
  const navTopPage = scrollTop + navExtTop.value;
  const navBottomPage = scrollTop + navExtBottom.value - 4;
  const activationBuffer = 10;
  const searchStart = Math.max(0, scrollTop - maxItemHeight.value - 32);
  const nextActiveIds = new Set<string>();
  let index = findFirstMetricIndex(searchStart);

  while (index < itemMetrics.value.length) {
    const metric = itemMetrics.value[index];
    if (metric.top >= navBottomPage) break;

    const element = itemRefs.value[metric.id];
    if (!element) { index += 1; continue; }
    const fadeSurface = getFadeSurface(element);
    if (metric.bottom <= scrollTop) { index += 1; continue; }

    if (metric.bottom <= navTopPage - activationBuffer) {
      element.style.opacity = "0";
      element.style.pointerEvents = "none";
      element.style.clipPath = "";
      element.style.WebkitClipPath = "";
      if (fadeSurface?.style) {
        fadeSurface.style.clipPath = "";
        fadeSurface.style.WebkitClipPath = "";
        fadeSurface.style.maskImage = "";
        fadeSurface.style.WebkitMaskImage = "";
      }
      nextActiveIds.add(metric.id);
      index += 1;
      continue;
    }

    const overlapBottom = Math.max(0, navBottomPage - metric.top - activationBuffer);
    if (overlapBottom <= 0) {
      clearFadeStyle(element);
      index += 1;
      continue;
    }

    const hiddenDepth = Math.max(0, navTopPage - metric.top);
    const fadeStart = Math.min(hiddenDepth, metric.height);
    const fadeEnd = Math.min(metric.height, Math.max(fadeStart + 0.5, overlapBottom));
    const mask = `linear-gradient(to bottom, rgba(0, 0, 0, 0) 0px, rgba(0, 0, 0, 0) ${fadeStart.toFixed(1)}px, rgba(0, 0, 0, 1) ${fadeEnd.toFixed(1)}px, rgba(0, 0, 0, 1) 100%)`;

    element.style.opacity = "";
    element.style.pointerEvents = "";
    element.style.clipPath = hiddenDepth > 0 ? `inset(${Math.min(hiddenDepth, metric.height).toFixed(1)}px 0 0 0)` : "";
    element.style.WebkitClipPath = hiddenDepth > 0 ? `inset(${Math.min(hiddenDepth, metric.height).toFixed(1)}px 0 0 0)` : "";
    element.style.maskImage = "";
    element.style.WebkitMaskImage = "";
    if (fadeSurface?.style) {
      fadeSurface.style.clipPath = hiddenDepth > 0 ? `inset(${Math.min(hiddenDepth, metric.height).toFixed(1)}px 0 0 0)` : "";
      fadeSurface.style.WebkitClipPath = hiddenDepth > 0 ? `inset(${Math.min(hiddenDepth, metric.height).toFixed(1)}px 0 0 0)` : "";
      fadeSurface.style.maskImage = mask;
      fadeSurface.style.WebkitMaskImage = mask;
    }
    nextActiveIds.add(metric.id);
    index += 1;
  }

  activeFadeIds.value.forEach((id) => {
    if (nextActiveIds.has(id)) return;
    clearFadeStyle(itemRefs.value[id]);
  });
  activeFadeIds.value = nextActiveIds;
}

function handleVideoClick(video: any) {
  emit("videoClicked", video);
}

onMounted(() => {
  if (!props.fadeUnderNavExt) return;
  window.addEventListener("scroll", () => scheduleFadeUpdate(), { passive: true });
  window.addEventListener("resize", handleFadeViewportChange, { passive: true });
  observeNavExt();
  nextTick(() => scheduleFadeUpdate(true));
});

onUpdated(() => {
  if (!props.fadeUnderNavExt) return;
  nextTick(() => {
    observeNavExt();
    scheduleFadeUpdate(true);
  });
});

onBeforeUnmount(() => {
  if (!props.fadeUnderNavExt) return;
  window.removeEventListener("scroll", () => scheduleFadeUpdate());
  window.removeEventListener("resize", handleFadeViewportChange);
  if (fadeFrame) cancelAnimationFrame(fadeFrame);
  navResizeObserver?.disconnect?.();
});
</script>

<style lang="scss">
.video-grid {
    display: grid;
    column-gap: 0.25rem;
    row-gap: 0.35rem;
    grid-template-columns: repeat(var(--video-grid-columns, 1), minmax(0, 1fr));
}

.video-grid--compact {
    column-gap: 0.25rem;
    row-gap: 0.35rem;
}

.video-grid-item {
    min-width: 0;
    background: transparent;
    overflow: visible;
    box-shadow: none;
    contain: layout style;
}

.video-grid--list {
  border: 1px solid var(--color-border, rgba(255, 255, 255, 0.07));
  border-radius: 0.75rem;
  overflow: hidden;
  row-gap: 0 !important;
}

/* Hide border when list container is empty (e.g. loading in scroll mode) */
.video-grid--list:empty {
  border: none;
}

.video-grid--list .video-grid-item {
    border-bottom: 1px solid var(--color-border, rgba(255, 255, 255, 0.07));
}

.video-grid--list .video-grid-item:last-child {
    border-bottom: none;
}
</style>
