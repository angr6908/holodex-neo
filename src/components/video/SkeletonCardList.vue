<template>
  <div class="py-0" style="position: relative">
    <div
      class="video-skeleton-grid"
      :class="{
        'video-skeleton-grid--compact': dense || horizontal || denseList,
        'video-skeleton-grid--list': denseList || horizontal,
      }"
      :style="gridStyle"
    >
      <div
        v-for="(video, index) in processedVideos"
        :key="`${index}-${video.id}`"
        class="video-skeleton-item"
      >
        <!-- Dense list: flat row matching min-height: 48px -->
        <div v-if="denseList" class="flex items-center gap-2 px-2" style="height: 48px">
          <div class="h-7 w-7 shrink-0 animate-pulse rounded-full bg-[color:var(--skeleton-fill)]" />
          <div class="min-w-0 flex-1">
            <div class="h-3 w-3/4 animate-pulse rounded bg-[color:var(--skeleton-fill)]" />
          </div>
          <div class="h-3 w-16 shrink-0 animate-pulse rounded bg-[color:var(--skeleton-fill)]" />
          <div class="h-3 w-12 shrink-0 animate-pulse rounded bg-[color:var(--skeleton-fill)]" />
        </div>

        <!-- Horizontal list: thumbnail 128×72 on left + text on right -->
        <div v-else-if="horizontal" class="flex items-center" style="min-height: 84px">
          <div class="m-1.5 h-[72px] w-[128px] shrink-0 animate-pulse rounded-lg bg-[color:var(--skeleton-fill)]" />
          <div class="flex min-w-0 flex-1 flex-col gap-2 p-2">
            <div class="h-3.5 w-4/5 animate-pulse rounded bg-[color:var(--skeleton-fill)]" />
            <div class="h-3 w-2/5 animate-pulse rounded bg-[color:var(--skeleton-fill)]" />
          </div>
        </div>

        <!-- Grid card: shell with 16:9 thumbnail + text area -->
        <div v-else class="video-skeleton-card">
          <div style="position: relative; width: 100%; padding-bottom: 56.25%">
            <div class="absolute inset-0 animate-pulse bg-[color:var(--skeleton-fill)]" style="border-radius: 1rem 1rem 0 0" />
          </div>
          <!-- Text area: match .video-card-text padding (0.5rem 0.625rem) and gap (0.625rem) -->
          <div class="flex items-start" style="padding: 0.5rem 0.625rem; gap: 0.625rem; min-height: 88px; border-top: 1px solid color-mix(in srgb, var(--color-border, rgba(255,255,255,0.07)) 72%, transparent 28%)">
            <div v-if="includeAvatar" class="h-[48px] w-[48px] shrink-0 animate-pulse rounded-full bg-[color:var(--skeleton-fill)]" />
            <div class="flex min-w-0 flex-1 flex-col gap-1.5 pt-0.5">
              <div class="h-3.5 w-11/12 animate-pulse rounded bg-[color:var(--skeleton-fill)]" />
              <div class="h-3 w-3/5 animate-pulse rounded bg-[color:var(--skeleton-fill)]" />
              <div class="h-2.5 w-2/5 animate-pulse rounded bg-[color:var(--skeleton-fill)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useAppStore } from "@/stores/app";

defineEmits<{
  (e: "videoClicked", video: any): void;
}>();

const props = withDefaults(defineProps<{
  horizontal?: boolean;
  denseList?: boolean;
  cols?: { xs: number; sm: number; md: number; lg: number; xl: number };
  dense?: boolean;
  useSkeleton?: boolean;
  expectedSize?: number | string;
  includeAvatar?: boolean;
}>(), {
  cols: () => ({ xs: 1, sm: 2, md: 3, lg: 4, xl: 5 }),
  dense: false,
  useSkeleton: false,
  expectedSize: 24,
  includeAvatar: true,
});

const appStore = useAppStore();

const processedVideos = computed(() => {
  const currentTime = new Date();
  return [...new Array(Number(props.expectedSize))].map((el, index) => ({
    id: +currentTime + index,
  }));
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

const gridStyle = computed(() => ({
  "--video-grid-columns": colSize.value,
}));

</script>

<style lang="scss">
.video-skeleton-grid {
    display: grid;
    column-gap: 0.25rem;
    row-gap: 0.35rem;
    grid-template-columns: repeat(var(--video-grid-columns, 1), minmax(0, 1fr));
}

.video-skeleton-grid--compact {
    column-gap: 0.25rem;
    row-gap: 0.35rem;
}

.video-skeleton-grid--list {
  border: 1px solid var(--color-border, rgba(255, 255, 255, 0.07));
  border-radius: 0.75rem;
  overflow: hidden;
  row-gap: 0 !important;
}

.video-skeleton-grid--list:empty {
  border: none;
}

.video-skeleton-grid--list .video-skeleton-item {
    border-bottom: 1px solid var(--color-border, rgba(255, 255, 255, 0.07));
}

.video-skeleton-grid--list .video-skeleton-item:last-child {
    border-bottom: none;
}

.video-skeleton-item {
    min-width: 0;
    background: transparent;
    overflow: visible;
    box-shadow: none;
    contain: layout style;
}

/* Grid card skeleton: match .video-card-shell border-radius, bg, shadow */
.video-skeleton-card {
  border-radius: 1rem;
  overflow: hidden;
  border: 1px solid var(--color-border, rgba(255, 255, 255, 0.07));
  background: var(--color-card, rgba(255, 255, 255, 0.04));
}
</style>
