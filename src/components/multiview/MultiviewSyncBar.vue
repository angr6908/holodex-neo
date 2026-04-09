<template>
  <div class="sync-bar flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-2">
    <div class="mr-2 flex w-[120px] flex-col items-center" style="height: 100%">
      <!-- Left side play button time cluster -->
      <div v-if="minTs" class="text-center text-body-2">
        {{ currentDuration }}
        /
        {{ totalDuration }}
      </div>
      <div class="flex items-center justify-between">
        <UiButton variant="ghost" size="icon" @click="setTime(currentTs - 10)">
          <UiIcon :icon="mdiRewind10" size="sm" />
        </UiButton>
        <UiButton variant="ghost" size="icon" @click="paused = !paused">
          <UiIcon :icon="paused ?icons.mdiPlay : mdiPause" size="lg" />
        </UiButton>
        <UiButton variant="ghost" size="icon" @click="setTime(currentTs + 10)">
          <UiIcon :icon="mdiFastForward10" size="sm" />
        </UiButton>
      </div>
      <div class="flex items-center">
        <UiButton variant="ghost" size="icon" @click="showConfiguration = !showConfiguration">
          <UiIcon :icon="icons.mdiCog" size="sm" />
        </UiButton>
        <label class="relative inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl text-slate-300 hover:bg-white/8">
          <UiIcon :icon="mdiPlaySpeed" size="sm" />
          <select
            v-model.number="playbackRate"
            class="absolute inset-0 cursor-pointer opacity-0"
          >
            <option
              v-for="availablePlaybackRate in availablePlaybackRates"
              :key="`playbackRateSelector-${availablePlaybackRate}`"
              :value="availablePlaybackRate"
            >
              {{ availablePlaybackRate }}
            </option>
          </select>
        </label>
        <UiButton variant="ghost" size="icon" @click="onShareClick">
          <UiIcon :icon="mdiLinkVariant" size="sm" />
        </UiButton>
      </div>
    </div>
    <!-- Main slider and progress -->
    <div class="grow self-start" style="position: relative">
      <!-- Hovering time, must be outside of overflowed container  -->
      <div class="time-tooltip-wrapper">
        <div
          v-show="hovering"
          class="time-tooltip"
          :style="{ marginLeft: timeTooltipLeft }"
        >
          {{ timeTooltipText }}
        </div>
      </div>
      <!-- Container with overflow scroll -->
      <div class="progressSlider pr-2">
        <div v-if="!hasVideosToSync">
          {{ $t("views.multiview.sync.nothingToSync") }}
        </div>
        <div v-show="hasVideosToSync" style="position: relative">
          <!-- Slider -->
          <div ref="sliderContainer" class="slider-container">
            <input
              ref="slider"
              type="range"
              min="0"
              max="100"
              :value="currentProgress"
              class="sync-slider"
              step="0.01"
              @input="onSliderInput"
            >
          </div>
          <!-- List of progress bars with icons -->
          <div
            v-for="v in splitProgressBarData"
            :key="v.id"
            class="my-1 flex items-center"
          >
            <channel-img
              :channel="v.channel"
              :size="24"
              class="px-1"
              rounded
              no-link
              no-alt
            />
            <!-- IMPORTANT flex, this makes left: x% correspond to the correct dimensions-->
            <!-- If you see the slider desync with progress bars, make sure x% is accurate to the slider-container -->
            <div class="flex">
              <div
                style="z-index: 1;"
                class="rounded-full bg-[color:var(--color-secondary)]"
                color="secondary"
                :style="{
                  marginLeft: (v.offset*100).toFixed(2) + '%',
                  width: (v.width*100).toFixed(2) + '%',
                  height: '8px',
                  background: `linear-gradient(to right, var(--color-secondary) 0%, var(--color-secondary) ${(currentProgressByVideo[v.id] || 0)}%, rgba(255,255,255,0.08) ${(currentProgressByVideo[v.id] || 0)}%, rgba(255,255,255,0.08) 100%)`,
                }"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
    <UiDialog :open="showConfiguration" class-name="max-w-lg p-0" @update:open="showConfiguration = $event">
      <UiCard class-name="space-y-5 p-5">
        <div class="text-lg font-semibold text-white">
          {{ $t("views.multiview.sync.syncSettings") }}
        </div>
        <div class="text-sm text-slate-200">
          {{ $t("views.multiview.sync.syncSettingsDetail") }}
          <div
            v-for="v in overlapVideos"
            :key="v.id"
            class="my-3 flex justify-between gap-3"
          >
            <channel-img
              :channel="v.channel"
              :size="40"
              rounded
              no-link
              no-alt
            />
            <div class="flex items-center gap-2">
              <UiButton variant="outline" size="sm" @click="setOffset(v.id, (offsets[v.id] || 0) - 0.5)">
                -0.5
              </UiButton>
              <UiInput
                :value="offsets[v.id] || '0'"
                class-name="w-24"
                type="number"
                @input="setOffset(v.id, +$event)"
              />
              <span class="text-xs text-slate-400">sec</span>
              <UiButton variant="outline" size="sm" @click="setOffset(v.id, (offsets[v.id] || 0) + 0.5)">
                +0.5
              </UiButton>
            </div>
          </div>
        </div>
      </UiCard>
    </UiDialog>
    <div
      v-if="doneCopy"
      class="fixed bottom-4 left-1/2 z-[120] -translate-x-1/2 rounded-2xl border border-emerald-400/30 bg-emerald-500/20 px-4 py-3 text-sm text-white backdrop-blur"
    >
      {{ $t("component.videoCard.copiedToClipboard") }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, inject, type Ref } from "vue";
import { useRoute } from "vue-router";
import { formatDuration, dayjs } from "@/utils/time";
import throttle from "lodash-es/throttle";
import { useCopyToClipboard } from "@/composables/useCopyToClipboard";
import {
  mdiPause, mdiFastForward10, mdiRewind10, mdiLinkVariant, mdiPlaySpeed,
} from "@mdi/js";
import { encodeLayout } from "@/utils/mv-utils";
import UiButton from "@/components/ui/button/Button.vue";
import UiCard from "@/components/ui/card/Card.vue";
import UiDialog from "@/components/ui/dialog/Dialog.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import UiInput from "@/components/ui/input/Input.vue";
import ChannelImg from "../channel/ChannelImg.vue";
import { useMultiviewStore } from "@/stores/multiview";

defineOptions({ name: "MultiviewSyncBar" });

const route = useRoute();
const multiviewStore = useMultiviewStore();
const { doneCopy, copyToClipboard } = useCopyToClipboard();
const videoCellsRef = inject<Ref<any[]>>("videoCells", ref([]));

const availablePlaybackRates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const lastSyncTimeMillis = ref(Date.now());
const paused = ref(true);
const hovering = ref(false);
const hoverTs = ref(0);
const currentTs = ref(0);
const currentProgressByVideo = ref<Record<string, number>>({});
const playbackRate = ref(1);
const timeTooltipLeft = ref<string | number>(0);
const timeTooltipText = ref("");
const timer = ref<ReturnType<typeof setInterval> | null>(null);
const firstPlay = ref(true);
const showConfiguration = ref(false);

const sliderContainer = ref<HTMLElement | null>(null);
const slider = ref<HTMLInputElement | null>(null);

const layout = computed(() => multiviewStore.layout);
const layoutContent = computed(() => multiviewStore.layoutContent);
const activeVideos = computed(() => multiviewStore.activeVideos);

const pastVideos = computed(() => activeVideos.value.filter((v: any) => v.status === "past"));

const videoWithTs = computed(() => {
  const videos = pastVideos.value.map((v: any) => ({
    ...v,
    startTs: dayjs(v.available_at).unix(),
    endTs: dayjs(v.available_at).unix() + v.duration,
  }));
  videos.sort((a: any, b: any) => a.startTs - b.startTs);
  return videos;
});

const overlapVideos = computed(() => {
  const ol: any[] = [];
  videoWithTs.value.forEach((v: any) => {
    if (!ol.length) {
      ol.push(v);
      return;
    }
    if (v.startTs - ol[ol.length - 1].endTs < 60 * 60) {
      ol.push(v);
    } else if (ol.length === 1) {
      ol.splice(0, 1, v);
    }
  });
  return ol;
});

const minTs = computed(() => {
  if (!hasVideosToSync.value) return 0;
  return Math.min(...overlapVideos.value.map((v: any) => v.startTs));
});

const maxTs = computed(() => {
  if (!hasVideosToSync.value) return 0;
  return Math.max(...overlapVideos.value.map((v: any) => v.endTs));
});

const splitProgressBarData = computed(() => {
  const totalTime = maxTs.value - minTs.value;
  return overlapVideos.value.map((v: any) => ({
    id: v.id,
    channel: v.channel,
    offset: (v.startTs - minTs.value) / totalTime,
    width: (v.endTs - v.startTs) / totalTime,
  }));
});

const currentProgress = computed(() => getPercentForTime(currentTs.value));

const currentDuration = computed(() => formatDuration(Math.round(currentTs.value - minTs.value) * 1000));

const totalDuration = computed(() => formatDuration((maxTs.value - minTs.value) * 1000));

const hasVideosToSync = computed(() => overlapVideos.value.length >= 1);

const routeCurrentTs = computed(() => route.query.t as string | undefined);

const routeOffsets = computed(() => (route.query.offsets as string)?.split(","));

const offsets = computed(() => {
  const local = multiviewStore.syncOffsets;
  if (routeOffsets.value && overlapVideos.value.length) {
    return overlapVideos.value.map((v: any, index: number) => ({
      [v.id]: local[v.id] ?? +routeOffsets.value[index],
    })).reduce((a: any, c: any) => ({ ...a, ...c }), {});
  }
  return local;
});

watch(paused, (pause) => {
  videoCellsRef.value
    .forEach((cell: any) => {
      const { video } = cell;
      const olVideo = video && overlapVideos.value.find((v: any) => v.id === video.id);
      if (olVideo && pause) cell.setPlaying(false);
      else setTime(currentTs.value);
    });
});

watch(playbackRate, (rate) => {
  videoCellsRef.value
    .forEach((cell: any) => {
      const { video } = cell;
      const olVideo = video && overlapVideos.value.find((v: any) => v.id === video.id);
      if (olVideo) {
        cell.setPlaybackRate(rate);
      }
    });
});

onMounted(() => {
  startTimer();
  sliderContainer.value!.addEventListener("mouseenter", onMouseEnter, false);
  sliderContainer.value!.addEventListener("mousemove", onMouseOver, false);
  sliderContainer.value!.addEventListener("mouseout", onMouseLeave, false);
  slider.value!.addEventListener("mousewheel", function (this: HTMLElement) { this.blur(); }, false);
});

onBeforeUnmount(() => {
  if (timer.value) clearInterval(timer.value);
  sliderContainer.value?.removeEventListener("mouseenter", onMouseEnter);
  sliderContainer.value?.removeEventListener("mousemove", onMouseOver);
  sliderContainer.value?.removeEventListener("mouseout", onMouseLeave);
});

function onMouseEnter() {
  hovering.value = true;
}

const onMouseOver = throttle(function (e: MouseEvent) {
  const offsetLeft = (e.target as HTMLElement).getBoundingClientRect().x;
  const percent = ((e.clientX - offsetLeft) / (e.target as HTMLElement).clientWidth) * 100;
  if (!(percent >= 0 && percent <= 100)) return;
  hoverTs.value = getTimeForPercent(percent);
  timeTooltipLeft.value = `${percent}%`;
  timeTooltipText.value = `${formatUnixTime(hoverTs.value)}\n${formatDuration((hoverTs.value - minTs.value) * 1000)}/${totalDuration.value}`;
}, 10);

function onMouseLeave() {
  hovering.value = false;
}

const onSliderInput = throttle(function (e: Event) {
  const ts = getTimeForPercent(Number((e.target as HTMLInputElement).value));
  setTime(ts);
}, 50);

function getTimeForPercent(percent: number) {
  return ((percent / 100) * (maxTs.value - minTs.value)) + minTs.value;
}

function getPercentForTime(ts: number) {
  return ((ts - minTs.value) / (maxTs.value - minTs.value)) * 100;
}

function sync() {
  if (!videoCellsRef.value || !hasVideosToSync.value) return;

  const currentSyncTimeMillis = Date.now();
  const syncDeltaTime = (currentSyncTimeMillis - lastSyncTimeMillis.value) / 1000;
  lastSyncTimeMillis.value = currentSyncTimeMillis;

  if (currentTs.value <= 0 || currentTs.value < minTs.value || currentTs.value > maxTs.value) {
    currentTs.value = findStartTime();
  } else if (!paused.value) {
    currentTs.value = Math.min(Math.max(currentTs.value + syncDeltaTime * playbackRate.value, minTs.value), maxTs.value);
  }

  const DELTA_THRESHOLD = 1.5 * playbackRate.value;
  videoCellsRef.value
    .forEach((cell: any) => {
      const { video, currentTime } = cell;
      const olVideo = video && overlapVideos.value.find((v: any) => v.id === video.id);
      if (!olVideo) return;

      const percentProgress = currentTs.value > olVideo.endTs ? 100 : ((currentTime / olVideo.duration) * 100).toFixed(2);
      currentProgressByVideo.value[olVideo.id] = Number(percentProgress);

      const expectedDuration = currentTs.value - olVideo.startTs + (offsets.value[olVideo.id] ?? 0);
      const delta = Math.abs(expectedDuration - currentTime);
      const isBefore = expectedDuration < 0;
      const isAfter = expectedDuration / olVideo.duration > 1;
      if (isBefore || isAfter) {
        cell.setPlaying(false);
      } else if (expectedDuration > 0 && delta > DELTA_THRESHOLD) {
        cell.setPlaying(!paused.value);
        cell.seekTo(expectedDuration);
        cell.setPlaybackRate(playbackRate.value);
      }
    });
}

function findStartTime() {
  if (routeCurrentTs.value) return +routeCurrentTs.value;
  const times: number[] = [];
  let firstOverlap = minTs.value;
  if (!videoCellsRef.value) return minTs.value;
  videoCellsRef.value
    .forEach((cell: any, index: number) => {
      const { video, currentTime } = cell;
      const olVideo = video && overlapVideos.value.find((v: any) => v.id === video.id);
      if (!olVideo) return;
      const t = currentTime + olVideo.startTs;
      if (index === 0 || Math.abs(times[index - 1] - t) < 2000) {
        times.push(t);
      }
      if (olVideo.startTs > firstOverlap && olVideo.endTs > firstOverlap) {
        firstOverlap = olVideo.startTs;
      }
    });
  if (times.length === overlapVideos.value.length) {
    return times.reduce((a, c) => a + c, 0) / times.length;
  }
  return firstOverlap;
}

function setTime(ts: number) {
  currentTs.value = ts;
  videoCellsRef.value
    .forEach((cell: any) => {
      const { video } = cell;
      const olVideo = video && overlapVideos.value.find((v: any) => v.id === video.id);
      if (!olVideo) return;

      const nextTime = ts - olVideo.startTs;
      const isBefore = nextTime < 0;
      const isAfter = nextTime / olVideo.duration > 1;
      if (isBefore || isAfter) {
        cell.setPlaying(false);
        cell.seekTo(isBefore ? 0 : olVideo.duration - 1);
        return;
      }

      if (firstPlay.value) {
        paused.value = false;
        firstPlay.value = false;
      }
      cell.setPlaying(!paused.value);
      cell.seekTo(nextTime);
    });
}

function startTimer() {
  if (timer.value) clearInterval(timer.value);
  timer.value = setInterval(sync, 500);
}

function formatUnixTime(ts: number) {
  return dayjs.unix(ts).format("LTS");
}

function setOffset(id: string, value: number) {
  multiviewStore.setSyncOffsets({ id, value });
}

function onShareClick() {
  const layoutParam = encodeURIComponent(
    encodeLayout({
      layout: layout.value,
      contents: layoutContent.value,
      includeVideo: true,
    }),
  );
  const params = new URLSearchParams();
  if (currentTs.value) params.append("t", String(Math.round(currentTs.value)));
  const offsetArr = overlapVideos.value.map((v: any) => offsets.value[v.id] ?? 0);
  if (offsetArr.find((o: any) => +o)) params.append("offsets", offsetArr.join(","));
  copyToClipboard(`${window.origin}/multiview/${layoutParam}${params.toString() ? `?${params.toString()}` : ""}`);
}
</script>

<style lang="scss">
// Offsets the slider by 32px for channel icons
$slider-left-offset: 32px;
// Offests the slider by width of scrollbar
$slider-right-offset: 8px;
// Slider height
$slider-height: 90px;

.sync-bar {
    width: 100%;
    height: 100px;
    position: sticky;
    bottom: 0;
    box-shadow: 0px 11px 15px -7px rgb(0 0 0 / 20%), 0px 24px 38px 3px rgb(0 0 0 / 14%), 0px 9px 46px 8px rgb(0 0 0 / 12%) !important;
}
.progressSlider {
    overflow-y: scroll; overflow-x: hidden; height: $slider-height
}
.slider-container {
    position: sticky;
    margin-top: -$slider-height;
    left: $slider-left-offset;
    top: 0;
    width: calc(100% - #{$slider-left-offset});
    height: $slider-height;
    z-index: 5;
    border: none;
}
.sync-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 100%;
  background: none;
  outline: none;
  opacity: 0.7;
  -webkit-transition: .2s;
  transition: opacity .2s;
}

.sync-slider::-webkit-slider-thumb {
  -webkit-appearance: none; /* Override default look */
  appearance: none;
  width: 3px; /* Set a specific slider handle width */
  height: $slider-height; /* Slider handle height */
  background: var(--v-primary-base); /* Green background */
  cursor: pointer; /* Cursor on hover */
  opacity: 0.8;
  display: flex;
}
.sync-slider::-moz-range-thumb {
  -webkit-appearance: none; /* Override default look */
  appearance: none;
  width: 3px; /* Set a specific slider handle width */
  height: $slider-height; /* Slider handle height */
  background: var(--v-primary-base); /* Green background */
  cursor: pointer; /* Cursor on hover */
  opacity: 0.8;
  display: flex;
}

.sync-slider:focus {
    outline: none;
}

.time-tooltip-wrapper {
    position: absolute;
    margin-left: $slider-left-offset;
    width: calc(100% - #{$slider-right-offset} - #{$slider-left-offset});
    z-index: 5;
    top: -30px;
}
.time-tooltip {
    display: inline-block;
    white-space: pre;
    text-align: center;
    opacity: 0.7;
    background: black;
    color: white;
    padding: 4px;
    border-radius: 0.25em;
    transform: translate(-50%, -50%);
}
</style>
