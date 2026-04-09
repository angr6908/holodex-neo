<template>
  <div><div :id="elementId" /></div>
</template>

<script lang="ts">
// Module-level counter — must be outside <script setup> so it persists
// across component instances instead of resetting for each one.
let pid = 0;
</script>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, useAttrs } from "vue";
import youtubePlayer from "youtube-player";
import { usePlayer } from "@/composables/usePlayer";

defineOptions({ name: "YoutubePlayer" });

const UNSTARTED = -1;
const ENDED = 0;
const PLAYING = 1;
const PAUSED = 2;
const BUFFERING = 3;
const CUED = 5;

const events: Record<number, string> = {
  [UNSTARTED]: "unstarted",
  [PLAYING]: "playing",
  [PAUSED]: "paused",
  [ENDED]: "ended",
  [BUFFERING]: "buffering",
  [CUED]: "cued",
};

const props = withDefaults(defineProps<{
  height?: number | string;
  width?: number | string;
  mute?: boolean;
  refreshRate?: number;
  manualUpdate?: boolean;
  videoId?: string;
  playerVars?: Record<string, any>;
}>(), {
  height: 720,
  width: 1280,
  mute: false,
  refreshRate: 500,
  playerVars: () => ({}),
});

const emit = defineEmits<{
  (e: "ready", player: unknown): void;
  (e: "error", error: unknown): void;
  (e: "currentTime", value: number): void;
  (e: "playbackRate", value: number): void;
  (e: "mute", value: boolean): void;
  (e: "volume", value: number): void;
  (e: "unstarted", target: unknown): void;
  (e: "playing", target: unknown): void;
  (e: "paused", target: unknown): void;
  (e: "ended", target: unknown): void;
  (e: "buffering", target: unknown): void;
  (e: "cued", target: unknown): void;
}>();

const attrs = useAttrs();
const activeListeners = new Set(
  Object.keys(attrs)
    .filter((k) => k.startsWith("on"))
    .map((k) => k[2].toLowerCase() + k.slice(3)),
);

const { playerReady, playerError, setMethods } = usePlayer(props, emit, activeListeners);

pid += 1;
const elementId = ref(`youtube-player-${pid}`);
const ytPlayer = ref<any>(null);

watch(() => props.videoId, (val) => updatePlayer(val));
watch(() => props.mute, (val) => setMutePlayer(val));

onBeforeUnmount(() => {
  if (ytPlayer.value !== null && ytPlayer.value.destroy) {
    ytPlayer.value.destroy();
    ytPlayer.value = null;
  }
});

onMounted(async () => {
  (window as any).YTConfig = {
    host: "https://www.youtube.com/iframe_api",
  };

  const host = "https://www.youtube.com";

  ytPlayer.value = youtubePlayer(elementId.value, {
    host,
    width: props.width as number,
    height: props.height as number,
    videoId: props.videoId,
    playerVars: props.playerVars,
    origin: window.origin,
  });

  ytPlayer.value.on("ready", (e: any) => {
    setMethods({
      getCurrentTime: () => ytPlayer.value?.getCurrentTime(),
      getPlaybackRate: () => ytPlayer.value?.getPlaybackRate(),
      getVolume: () => ytPlayer.value?.getVolume(),
      isMuted: () => ytPlayer.value?.isMuted(),
      setMute: (value: boolean) => {
        if (!ytPlayer.value) return;
        if (value) { ytPlayer.value.mute(); } else { ytPlayer.value.unMute(); }
      },
      setPlaying: (playing: boolean) => {
        if (!ytPlayer.value) return;
        if (!playing) { ytPlayer.value.pauseVideo(); } else { ytPlayer.value.playVideo(); }
      },
    });
    playerReady(e.target);
  });
  ytPlayer.value.on("stateChange", playerStateChange);
  ytPlayer.value.on("error", playerError);
});

function playerStateChange(e: any) {
  if (e.data !== null && e.data !== UNSTARTED) {
    emit(events[e.data] as any, e.target);
  }
}

function updatePlayer(videoId?: string) {
  if (!videoId) {
    ytPlayer.value?.stopVideo();
    return;
  }

  const params: Record<string, any> = { videoId };

  if (typeof props.playerVars.start === "number") {
    params.startSeconds = props.playerVars.start;
  }

  if (typeof props.playerVars.end === "number") {
    params.endSeconds = props.playerVars.end;
  }

  if (props.playerVars.autoplay === 1) {
    ytPlayer.value?.loadVideoById(params);
    return;
  }

  ytPlayer.value?.cueVideoById(params);
}

function setMutePlayer(value?: boolean) {
  if (!ytPlayer.value) return;
  if (value) { ytPlayer.value.mute(); } else { ytPlayer.value.unMute(); }
}

function getCurrentTime() {
  return ytPlayer.value?.getCurrentTime();
}

function getPlaybackRate() {
  return ytPlayer.value?.getPlaybackRate();
}

function getVolume() {
  return ytPlayer.value?.getVolume();
}

function isMuted() {
  return ytPlayer.value?.isMuted();
}

function seekTo(t: number) {
  ytPlayer.value?.seekTo(t);
}

function setPlaying(playing: boolean) {
  if (!ytPlayer.value) return;
  if (!playing) { ytPlayer.value.pauseVideo(); } else { ytPlayer.value.playVideo(); }
}

async function sendLikeEvent() {
  const iframe = await ytPlayer.value?.getIframe();
  iframe?.contentWindow?.postMessage({ event: "likeVideo" }, "*");
}

defineExpose({ getCurrentTime, getPlaybackRate, getVolume, isMuted, seekTo, setPlaying, sendLikeEvent, setMute: setMutePlayer });
</script>
