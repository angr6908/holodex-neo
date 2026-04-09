<template>
  <div :id="elementId" />
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount, onMounted, useAttrs } from "vue";
import { usePlayer } from "@/composables/usePlayer";

defineOptions({ name: "TwitchPlayer" });

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = (e) => reject(e);
    document.head.appendChild(s);
  });
}

let pid = 0;

const props = withDefaults(defineProps<{
  height?: number | string;
  width?: number | string;
  mute?: boolean;
  refreshRate?: number;
  manualUpdate?: boolean;
  quality?: string;
  playsInline?: boolean;
  channel?: string;
  video?: string;
}>(), {
  height: 720,
  width: 1280,
  mute: false,
  refreshRate: 500,
  quality: "medium",
  playsInline: false,
  channel: "",
  video: "",
});

const emit = defineEmits<{
  (e: "ready", player: unknown): void;
  (e: "error", error: unknown): void;
  (e: "currentTime", value: number): void;
  (e: "playbackRate", value: number): void;
  (e: "mute", value: boolean): void;
  (e: "volume", value: number): void;
  (e: "ended"): void;
  (e: "paused"): void;
  (e: "playing"): void;
}>();

const attrs = useAttrs();
const activeListeners = new Set(
  Object.keys(attrs)
    .filter((k) => k.startsWith("on"))
    .map((k) => k[2].toLowerCase() + k.slice(3)),
);

const { playerReady, playerError, setMethods } = usePlayer(props, emit, activeListeners);

pid += 1;
const elementId = ref(`twitch-player-${pid}`);
const twitchPlayer = ref<any>(null);

watch(() => props.channel, (newChannel) => {
  twitchPlayer.value?.setChannel(newChannel);
});

watch(() => props.video, (newVideo) => {
  twitchPlayer.value?.setVideo(newVideo);
});

watch(() => props.mute, (value) => {
  twitchPlayer.value?.setMuted(value);
});

onBeforeUnmount(() => {
  if (twitchPlayer.value !== null) {
    emit("paused");
    twitchPlayer.value = null;
  }
});

onMounted(() => {
  loadScript("https://player.twitch.tv/js/embed/v1.js")
    .then(() => {
      const options: Record<string, any> = {
        width: props.width,
        height: props.height,
        parent: [window.location.hostname],
        autoplay: false,
      };
      if (props.playsInline) {
        options.playsinline = true;
      }
      if (props.channel) {
        options.channel = props.channel;
      } else if (props.video) {
        options.video = props.video;
      } else {
        emit("error", "no source specified");
      }
      const tp = new (window as any).Twitch.Player(elementId.value, options);
      twitchPlayer.value = tp;
      tp.addEventListener("ended", () => emit("ended"));
      tp.addEventListener("pause", () => emit("paused"));
      tp.addEventListener("play", () => emit("playing"));
      tp.addEventListener("ready", () => {
        tp.setQuality(props.quality);
        setMethods({
          getCurrentTime: () => tp.getCurrentTime(),
          getVolume: () => tp.getVolume() * 100,
          isMuted: () => tp.getMuted(),
          setMute: (value: boolean) => tp.setMuted(value),
          setPlaying: (playing: boolean) => {
            if (!tp) return;
            if (!playing) { tp.pause(); } else { tp.play(); }
          },
        });
        playerReady(tp);
      });
    })
    .catch((e) => playerError(e));
});

function play() {
  twitchPlayer.value?.play();
}

function pause() {
  twitchPlayer.value?.pause();
}

function getCurrentTime() {
  return twitchPlayer.value?.getCurrentTime();
}

function getVolume() {
  return (twitchPlayer.value?.getVolume() ?? 0) * 100;
}

function isMuted() {
  return twitchPlayer.value?.getMuted();
}

function setMute(value: boolean) {
  twitchPlayer.value?.setMuted(value);
}

function setPlaying(playing: boolean) {
  if (!twitchPlayer.value) return;
  if (!playing) { twitchPlayer.value.pause(); } else { twitchPlayer.value.play(); }
}

defineExpose({ play, pause, getCurrentTime, getVolume, isMuted, setMute, setPlaying });
</script>
