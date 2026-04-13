<template>
  <div
    class="watch-live-chat"
    :class="{
      'show-tl-overlay': showTlChat,
      'fluid': fluid,
      'mobile-live-chat': appStore.isMobile,
    }"
  >
    <span v-if="showYtChat && !needExtension && !chatLoaded" class="loading-text">
      {{ $t("views.watch.chat.loading") }}
    </span>
    <!-- Live translations -->
    <template v-if="showTlChat && isLiveTLVideo">
      <LiveTranslations
        v-show="showTlChat"
        :video="video!"
        :class="{
          'stick-bottom': settingsStore.liveTlStickBottom,
          'tl-full-height': !showYtChat,
        }"
        :style="{ height: tlChatHeight }"
        :current-time="currentTime"
        :use-local-subtitle-toggle="useLocalSubtitleToggle"
        @videoUpdate="(obj) => emit('videoUpdate', obj)"
        @timeJump="time => emit('timeJump', time)"
      />
    </template>
    <!-- Archive translations -->
    <template v-else-if="canShowTLChat && showTlChat">
      <ArchiveTranslations
        v-show="showTlChat"
        v-if="showTlChat"
        :video="video"
        :class="{
          'stick-bottom': settingsStore.liveTlStickBottom,
          'tl-full-height': !showYtChat,
        }"
        :style="{ height: tlChatHeight }"
        :current-time="currentTime"
        :use-local-subtitle-toggle="useLocalSubtitleToggle"
        @timeJump="time => $emit('timeJump', time)"
      />
    </template>
    <template v-else-if="showTlChat">
      <UiCard
        class-name="tl-overlay border-0 bg-slate-950/90 p-0 text-sm text-slate-200 shadow-none"
      >
        <div
          :class="{
            'stick-bottom': settingsStore.liveTlStickBottom,
            'tl-full-height': !showYtChat,
          }"
          class="tl-body"
          :style="{ height: tlChatHeight }"
        >
          This video is members only, please play the video to see TLdex and translations.
        </div>
      </UiCard>
    </template>
    <!-- Youtube scalable embedded window -->
    <div
      v-if="showYtChat && !needExtension"
      class="embedded-chat"
      :style="{ height: ytChatHeight }"
    >
      <iframe
        ref="ytChat"
        :src="liveChatUrl"
        frameborder="0"
        :style="scaledStyle"
        @load="handleChatLoad"
      />
    </div>
    <div v-if="needExtension" class="p-5 text-sm text-slate-300">
      Archive chat does not work without the
      <router-link to="/extension" class="text-sky-300 hover:text-sky-200">
        Holodex+
      </router-link>
      extension or other third party extensions.
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, defineAsyncComponent } from "vue";
import UiCard from "@/components/ui/card/Card.vue";
import { replayTimedContinuation } from "@/utils/chat";
import { useSettingsStore } from "@/stores/settings";
import { useAppStore } from "@/stores/app";

const ArchiveTranslations = defineAsyncComponent(() => import("@/components/chat/ArchiveTranslations.vue"));
const LiveTranslations = defineAsyncComponent(() => import("@/components/chat/LiveTranslations.vue"));

defineOptions({ name: "WatchLiveChat" });

const props = withDefaults(defineProps<{
  video?: Record<string, any> | null;
  fluid?: boolean;
  currentTime?: number;
  scale?: number;
  modelValue: {
    showTlChat: boolean;
    showYtChat: boolean;
  };
  useLocalSubtitleToggle?: boolean;
}>(), {
  video: null,
  fluid: false,
  currentTime: 0,
  scale: 1,
  useLocalSubtitleToggle: false,
});

const emit = defineEmits<{
  (e: "videoUpdate", obj: any): void;
  (e: "timeJump", time: any): void;
}>();

const settingsStore = useSettingsStore();
const appStore = useAppStore();

const ytChat = ref<HTMLIFrameElement | null>(null);
const chatLoaded = ref(false);
// @ts-expect-error ARCHIVE_CHAT_OVERRIDE is a global injected property
const needExtension = ref(!window.ARCHIVE_CHAT_OVERRIDE && props.video?.status === "past");

const canShowTLChat = computed(() =>
  (props.video?.topic_id === "membersonly" && props.currentTime > 0) || (props.video?.topic_id !== "membersonly"),
);
const isLiveTLVideo = computed(() => ["live", "upcoming"].includes(props.video?.status ?? ""));

const showTlChat = computed(() => props.modelValue.showTlChat);
const showYtChat = computed(() => props.modelValue.showYtChat);

const liveChatUrl = computed(() => {
  if (!props.video) return null;
  const query: Record<string, string> = {
    v: props.video.id,
    embed_domain: window.location.hostname,
    dark_theme: settingsStore.darkMode ? "1" : "0",
    ...props.video.status === "past" && { c: props.video.channel?.id },
  };

  if (props.video.status === "past") {
    const cont = query.v && query.c && replayTimedContinuation({ videoId: query.v, channelId: query.c });
    if (cont) query.continuation = cont;
  }
  const q = new URLSearchParams(query).toString();
  if (props.video.status === "past") {
    // @ts-expect-error HOLODEX_PLUS_INSTALLED_V3 is a global injected property
    if (window.HOLODEX_PLUS_INSTALLED_V3) {
      return `https://www.youtube.com/live_chat_replay?${q}`;
    }
    return `https://www.youtube.com/redirect_replay_chat?${q}`;
  }
  return `https://www.youtube.com/live_chat?${q}`;
});

const scaledStyle = computed(() =>
  props.scale !== 1 ? {
    transform: `scale(${props.scale})`,
    height: `${100 / props.scale}%`,
    width: `${100 / props.scale}%`,
    "transform-origin": "top left",
  } : {},
);

const ytChatHeight = computed(() =>
  settingsStore.liveTlWindowSize > 0
  && showTlChat.value
    ? `${(100 - settingsStore.liveTlWindowSize)}%`
    : "",
);

const tlChatHeight = computed(() =>
  showYtChat.value
  && settingsStore.liveTlWindowSize > 0
    ? `${settingsStore.liveTlWindowSize}%`
    : "",
);

watch(showYtChat, () => {
  chatLoaded.value = false;
});

watch(liveChatUrl, () => {
  chatLoaded.value = false;
});

watch(() => props.currentTime, () => {
  updateFrameTime();
});

function handleChatLoad() {
  chatLoaded.value = true;
  updateFrameTime();
}

function updateFrameTime(t = props.currentTime) {
  if (props.video?.status === "past") {
    ytChat.value?.contentWindow?.postMessage({ "yt-player-video-progress": t }, "*");
  }
}
</script>

<style>
/* ── Watch Live Chat Container ── */
.watch-live-chat {
  min-height: min(calc((75vw - 24px) * 0.5625), calc(100vh - 120px));
  height: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
  font-size: 16px;
  z-index: 0;
  overflow: hidden;
  border-radius: inherit;
}

.watch-live-chat.fluid {
  width: 100%;
  height: 100%;
  min-height: 0 !important;
  min-width: 0;
}

/* ── Loading text ── */
.watch-live-chat .loading-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 0.875rem;
  color: rgb(148 163 184); /* slate-400 */
}

/* ── Embedded chat iframe ── */
.embedded-chat {
  position: relative;
  width: 100%;
  height: 100%;
}
.embedded-chat > iframe {
  position: absolute;
  width: 100%;
  height: 100%;
  z-index: 3;
}

/* ── TL overlay sizing ── */
.watch-live-chat.show-tl-overlay .embedded-chat {
  height: calc(100% - clamp(140px, 24%, 210px));
}
.watch-live-chat.show-tl-overlay .tl-overlay {
  height: clamp(140px, 24%, 210px);
}
.watch-live-chat.show-tl-overlay .tl-overlay.tl-full-height {
  position: absolute;
  height: 100% !important;
  max-height: 100%;
  padding-bottom: 0;
  padding-bottom: calc(env(safe-area-inset-bottom) / 1.75);
}

/* ── TL body ── */
.watch-live-chat .tl-body {
  font-size: 16px;
  line-height: 1.5;
  overflow: auto;
}

.stick-bottom {
  order: 2;
}

/* ── Mobile ── */
.watch-live-chat.mobile-live-chat {
  margin-right: 0;
}
</style>
