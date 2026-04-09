<template>
  <div
    :key="`uid-${uniqueId}`"
    class="cell-content video-cell"
  >
    <div
      class="mv-frame"
      :class="{ 'elevation-4': editMode }"
    >
      <!-- Twitch Player -->
      <TwitchPlayer
        v-if="isTwitchVideo"
        ref="player"
        :channel="cellContent.id"
        :plays-inline="true"
        :mute="muted"
        manual-update
        @ready="onReady"
        @ended="editMode = true"
        @playing="onPlayPause(false)"
        @paused="onPlayPause(true)"
        @error="editMode = true"
        @mute="setMuted($event)"
        @volume="volume = $event"
      />
      <!-- Youtube Player -->
      <YoutubePlayer
        v-else
        ref="player"
        :key="cellContent.id"
        :video-id="cellContent.id"
        :player-vars="{
          playsinline: 1,
          cc_lang_pref: getLang,
          hl: getLang,
        }"
        :mute="muted"
        manual-update
        @ready="onReady"
        @ended="editMode = true"
        @playing="onPlayPause(false)"
        @paused="onPlayPause(true)"

        @cued="editMode = true"
        @error="editMode = true"
        @playbackRate="playbackRate = $event"
        @mute="setMuted($event)"
        @volume="volume = $event"
      />
      <div :id="`overlay-${video.id}`" style="font-size: 18px;" />
    </div>
    <cell-control
      v-if="editMode"
      @reset="uniqueId = Date.now()"
      @back="resetCell"
      @delete="deleteCell"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, defineAsyncComponent } from "vue";
import { getYTLangFromState } from "@/utils/functions";
import YoutubePlayer from "../player/YoutubePlayer.vue";
import CellControl from "./CellControl.vue";
import { useMultiviewCell, type CellItem } from "@/composables/useMultiviewCell";
import { useMultiviewStore } from "@/stores/multiview";
import { useSettingsStore } from "@/stores/settings";

defineOptions({ name: "VideoCell" });

const TwitchPlayer = defineAsyncComponent(() => import("../player/TwitchPlayer.vue"));

const props = defineProps<{
  item: CellItem;
}>();

const emit = defineEmits<{
  (e: "delete", id: string): void;
}>();

const multiviewStore = useMultiviewStore();
const settingsStore = useSettingsStore();

const { uniqueId, cellContent, editMode, resetCell, deleteCell } = useMultiviewCell(props.item, emit);

const ytPlayer = ref<any>(null);
const twPlayer = ref<any>(null);
const playbackRate = ref(1);
const volume = ref(50);
const firstPlay = ref(true);
const timer = ref<ReturnType<typeof setInterval> | null>(null);
const player = ref<any>(null);

const isTwitchVideo = computed(() => cellContent.value?.video?.type === "twitch");

const muted = computed({
  get() {
    if (!cellContent.value) return false;
    return cellContent.value.muted;
  },
  set(value: boolean) {
    if (value !== cellContent.value?.muted) {
      multiviewStore.setLayoutContentWithKey({
        id: props.item.i,
        key: "muted",
        value,
      });
    }
  },
});

const currentTime = computed({
  get() {
    if (!cellContent.value) return 0;
    return cellContent.value.currentTime;
  },
  set(value: number) {
    if (value !== cellContent.value?.currentTime) {
      multiviewStore.setLayoutContentWithKey({
        id: props.item.i,
        key: "currentTime",
        value,
      });
    }
  },
});

const video = computed(() => {
  if (!cellContent.value) return null;
  return cellContent.value.video;
});

const isFastFoward = computed(() => playbackRate.value !== 1);

const getLang = computed(() => {
  return getYTLangFromState({ settings: settingsStore.$state });
});

function refresh() {
  uniqueId.value = Date.now();
  editMode.value = true;
}

function setPlaying(val: boolean) {
  if (editMode.value !== val) return;
  if (ytPlayer.value) {
    if (!editMode.value) { ytPlayer.value.pauseVideo(); } else { ytPlayer.value.playVideo(); }
  }
  if (twPlayer.value) {
    if (!editMode.value) { twPlayer.value.pause(); } else { twPlayer.value.play(); }
  }
}

function setMuted(val: boolean) {
  if (val === !!muted.value) return;
  if (!val) multiviewStore.muteOthersAction(props.item.i);
  muted.value = val;
}

function setVolume(val: number) {
  if (ytPlayer.value) ytPlayer.value.setVolume(val);
  if (twPlayer.value) twPlayer.value.setVolume(val / 100);
  volume.value = val;
}

function togglePlaybackRate() {
  if (!ytPlayer.value) return;
  ytPlayer.value.setPlaybackRate(isFastFoward.value ? 1 : 2);
}

function setPlaybackRate(val: number) {
  if (!ytPlayer.value) return;
  ytPlayer.value.setPlaybackRate(val);
}

function updatePausedState(paused = false) {
  if (editMode.value === paused) return;
  editMode.value = paused;
  if (firstPlay.value && !paused) {
    multiviewStore.muteOthersAction(props.item.i);
    firstPlay.value = false;
  }
}

function onPlayPause(paused = false) {
  if (ytPlayer.value && (!ytPlayer.value.getVideoData().isLive || ytPlayer.value.getVideoData().allowLiveDvr)) {
    setTimeout(() => {
      const recheck = ytPlayer.value.getPlayerState() === 2;
      updatePausedState(recheck);
    }, 200);
  } else {
    updatePausedState(paused);
  }
}

function onReady(p: any) {
  if (p && isTwitchVideo.value) {
    twPlayer.value = p;
  } else if (p) {
    ytPlayer.value = p;
  }
}

function manualRefresh() {
  if (!player.value) return;
  player.value.updateListeners();
}

async function manualCheckMuted() {
  if (!player.value) return;
  setMuted(await player.value.isMuted());
}

function setTimer() {
  if (timer.value) clearInterval(timer.value);
  timer.value = setInterval(async () => {
    if (player.value) {
      currentTime.value = await player.value.getCurrentTime();
    }
  }, 500);
}

function seekTo(t: number) {
  player.value?.seekTo(t);
}

watch(cellContent, (nw, old) => {
  if (nw?.id !== old?.id && !editMode.value) editMode.value = true;
  if (!isTwitchVideo.value) twPlayer.value = null;
  else ytPlayer.value = null;

  if (editMode.value) multiviewStore.unfreezeLayoutItem(props.item.i);
  else multiviewStore.freezeLayoutItem(props.item.i);
  setTimer();
});

watch(() => video.value?.id, () => {
  setTimer();
});

onMounted(() => {
  if (!editMode.value) editMode.value = true;
  setTimer();
});

onBeforeUnmount(() => {
  if (timer.value) clearInterval(timer.value);
});

defineExpose({
  video,
  editMode,
  muted,
  volume,
  isTwitchVideo,
  isFastFoward,
  currentTime,
  refresh,
  setPlaying,
  setMuted,
  setVolume,
  togglePlaybackRate,
  setPlaybackRate,
  manualRefresh,
  manualCheckMuted,
  seekTo,
  deleteCell,
});
</script>

<style>
.mv-frame > div > iframe {
    position: absolute;
    width: 100%;
    height: 100%;
}

.mv-frame {
    position: relative;
    width: 100%;
    flex: 1 1 auto;
    min-height: 0;
    height: auto;
}

.video-cell {
    min-height: 0;
}

.video-cell .cell-control {
    flex-shrink: 0;
}
</style>
