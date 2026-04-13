<template>
  <div v-if="isLoading || hasError" class="watch-loading-shell">
    <LoadingOverlay
      :is-loading="isLoading"
      :show-error="hasError"
      variant="watch"
    />
  </div>
  <div
    v-else
    class="watch-page"
    :class="{
      'watch-page--cinema': theaterMode && !isMobile,
      'watch-page--chat': showChatWindow,
      'watch-page--mobile': isMobile,
    }"
    :style="{ '--player-stack-reserve': `${playerStackReserve}px` }"
  >
    <KeyPress
      key-event="keyup"
      :key-code="84"
      :modifiers="['altKey']"
      :prevent-default="true"
      @success="toggleTheaterMode"
    />
    <div ref="watchLayout" class="watch-content">
      <div class="watch-main">
        <!-- Player group: shared container for video + toolbar width matching -->
        <div class="watch-player-group">
          <div class="watch-screen" :class="{ 'watch-screen--cinema': theaterMode && !isMobile }">
            <div style="position: relative">
            <youtube
              v-if="video.id"
              ref="ytPlayer"
              class="video"
              :video-id="video.id"
              :player-vars="{
                ...(timeOffset && { start: timeOffset }),
                autoplay: isPlaylist ? 1 : 0,
                playsinline: 1,
                cc_lang_pref: getLang,
                hl: getLang,
              }"
              @ready="ready"
              @playing="playing"
              @ended="ended"
              @currentTime="handleCurrentTime"
            />
            <!-- <WatchVideoOverlay :video="video" /> -->
            <div :id="`overlay-${video.id}`" style="font-size: 16px; font-size: max(1.5vw, 16px);" />
          </div>
          </div>
          <WatchHighlights
            v-if="showHighlightsBar"
            key="highlights"
            :comments="comments"
            :video="video"
            :limit="isMobile ? 8 : 0"
            :player-width="playerRenderWidth"
            @timeJump="seekTo"
          />
          <WatchToolBar :video="video" :no-back-button="!isMobile">
            <template #buttons>
              <UiButton
                v-if="hasExtension"
                type="button"
                size="icon"
                variant="ghost"
                :title="$t('views.watch.likeOnYoutube')"
                @click="like()"
              >
                <UiIcon :icon="mdiThumbUp" />
              </UiButton>
              <UiButton
                v-if="!isMobile"
                type="button"
                size="icon"
                :variant="theaterMode ? 'default' : 'ghost'"
                :title="$t('views.watch.theaterMode')"
                @click="toggleTheaterMode"
              >
                <UiIcon :icon="mdiTheater" />
              </UiButton>
              <UiButton
                v-if="hasLiveTL"
                type="button"
                size="icon"
                :variant="showTL ? 'default' : 'ghost'"
                :title="showTL ? $t('views.watch.chat.hideTLBtn') : $t('views.watch.chat.showTLBtn')"
                @click="showTL = !showTL"
              >
                <UiIcon :icon="icons.tlChat" />
              </UiButton>
              <UiButton
                v-if="hasLiveChat"
                type="button"
                size="icon"
                :variant="showLiveChat ? 'default' : 'ghost'"
                @click="showLiveChat = !showLiveChat"
              >
                <UiIcon :icon="icons.ytChat" />
              </UiButton>
            </template>
          </WatchToolBar>
        </div>
        <WatchSideBar
          v-if="video?.songcount"
          key="songs"
          :video="video"
          class="watch-section"
          show-songs
          :show-relations="false"
          @timeJump="seekTo"
        />
        <WatchInfo key="info" :video="video" @timeJump="seekTo" />
        <div v-if="comments.length">
          <WatchComments
            key="comments"
            :comments="comments"
            :video="video"
            :limit="isMobile ? 5 : 0"
            @timeJump="seekTo"
          />
        </div>
        <WatchSideBar
          v-if="hasRelatedSections"
          key="related"
          :video="video"
          class="watch-section"
          :show-songs="false"
          show-relations
          @timeJump="seekTo"
        />
        <div v-if="showUtilityRail" class="watch-section flex flex-col gap-4">
          <WatchQuickEditor
            v-if="role === 'admin' || role === 'editor'"
            :video="video"
          />
          <WatchPlaylist
            v-if="isPlaylist"
            v-model="playlistIndex"
            @playNext="playNextPlaylist"
          />
        </div>
      </div>
    </div>
    <WatchLiveChat
      v-if="showChatWindow"
      v-model="chatStatus"
      class="watch-chat"
      :video="video"
      :current-time="currentTime"
      @timeJump="seekTo"
    />
    <UiDialog
      :open="showUpload"
      class-name="max-h-[500px] max-w-[80%]"
      @update:open="toggleUploadPanel"
    >
      <UiCard class-name="border-0 p-0 shadow-none">
        <UploadScript :video-data="video" @close="toggleUploadPanel(false)" />
      </UiCard>
    </UiDialog>
  </div>
</template>

<script setup lang="ts">
import {
  ref, computed, watch, defineAsyncComponent, nextTick, getCurrentInstance, onMounted, onBeforeUnmount,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useWatchStore } from "@/stores/watch";
import { useAppStore } from "@/stores/app";
import { useSettingsStore } from "@/stores/settings";
import { useHistoryStore } from "@/stores/history";
import { useMetaTitle } from "@/composables/useMetaTitle";
import Youtube from "@/components/player/YoutubePlayer.vue";
import LoadingOverlay from "@/components/common/LoadingOverlay.vue";
import WatchInfo from "@/components/watch/WatchInfo.vue";
import WatchSideBar from "@/components/watch/WatchSideBar.vue";
import WatchLiveChat from "@/components/watch/WatchLiveChat.vue";
import WatchHighlights from "@/components/watch/WatchHighlights.vue";
import WatchToolBar from "@/components/watch/WatchToolbar.vue";
import WatchComments from "@/components/watch/WatchComments.vue";
import UploadScript from "@/components/tlscriptmanager/UploadScript.vue";
import UiButton from "@/components/ui/button/Button.vue";
import UiCard from "@/components/ui/card/Card.vue";
import UiDialog from "@/components/ui/dialog/Dialog.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import { decodeHTMLEntities, getYTLangFromState } from "@/utils/functions";
import * as icons from "@/utils/icons";
import { mdiTheater, mdiThumbUp } from "@mdi/js";

defineOptions({ name: "Watch" });

const WatchQuickEditor = defineAsyncComponent(() => import("@/components/watch/WatchQuickEditor.vue"));
const WatchPlaylist = defineAsyncComponent(() => import("@/components/watch/WatchPlaylist.vue"));
const KeyPress = defineAsyncComponent(() => import("vue-keypress"));

const route = useRoute();
const router = useRouter();
useI18n();
const instance = getCurrentInstance();

const watchStore = useWatchStore();
const appStore = useAppStore();
const settingsStore = useSettingsStore();
const historyStore = useHistoryStore();

const { video, isLoading, hasError } = storeToRefs(watchStore);
const { showTL, showLiveChat, theaterMode } = storeToRefs(watchStore);

// Data
const startTime = ref(0);
const playlistIndex = ref(-1);
const currentTime = ref(0);
const player = ref<any>(null);
const ytPlayer = ref<any>(null);
const watchLayout = ref<HTMLElement | null>(null);
const playerRenderWidth = ref<number | null>(null);
const playerStackReserve = ref(52);
let hintConnectLiveTL = false;
let playerWidthRaf: number | null = null;

// Computed
const chatStatus = computed({
  get() {
    return {
      showTlChat: showTL.value,
      showYtChat: showLiveChat.value && hasLiveChat.value,
    };
  },
  set(val: any) {
    showTL.value = val.showTlChat;
    showLiveChat.value = val.showYtChat;
  },
});

const videoId = computed(() => route.params.id as string || route.query.v as string);
const timeOffset = computed(() => +(route.query.t as string) || startTime.value);
const title = computed(() => (video.value.title && decodeHTMLEntities(video.value.title)) || "");

useMetaTitle(() => title.value);

const hasLiveChat = computed(() =>
  video.value.type === "stream" && (
    ["upcoming", "live"].includes(video.value.status)
    || (video.value.status === "past" && !isMobile.value)
  ),
);
const hasLiveTL = computed(() => video.value.type === "stream");
const showChatWindow = computed(() =>
  (hasLiveChat.value && showLiveChat.value)
  || (showTL.value && hasLiveTL.value),
);
const isMobile = computed(() => appStore.isMobile);
const comments = computed(() => video.value.comments || []);
const isPlaylist = computed(() => route.query.playlist);
const role = computed(() => appStore.userdata?.user?.role);
const hasRelatedSections = computed(() => Boolean(
  video.value?.simulcasts?.length
    || video.value?.clips?.length
    || video.value?.sources?.length
    || video.value?.same_source_clips?.length
    || video.value?.recommendations?.length
    || video.value?.refers?.length,
));
const showUtilityRail = computed(() => Boolean(
  role.value === "admin"
    || role.value === "editor"
    || isPlaylist.value,
));
const hasExtension = computed(() => !!(window as any).HOLODEX_PLUS_INSTALLED);
const showHighlightsBar = computed(() =>
  (comments.value.length || video.value.songcount) && (!isMobile.value || !showTL.value),
);
const showUpload = computed(() => appStore.uploadPanel);
const getLang = computed(() => getYTLangFromState({ settings: { lang: settingsStore.lang } }));

// Watchers
watch(() => route.params.id, () => { init(); });
watch(() => route.query.v, () => { init(); });
watch(theaterMode, () => { schedulePlayerWidthMeasure(); });
watch(isMobile, () => { schedulePlayerWidthMeasure(); });
watch(showChatWindow, () => { schedulePlayerWidthMeasure(); });
watch(showHighlightsBar, () => { schedulePlayerWidthMeasure(); });

// Methods
function measurePlayerWidth() {
  const playerSurface = document.querySelector(".watch-screen .video");
  if (!(playerSurface instanceof HTMLElement)) {
    playerRenderWidth.value = null;
    return;
  }
  const width = Math.round(playerSurface.getBoundingClientRect().width);
  playerRenderWidth.value = width > 0 ? width : null;

  const toolbarEl = document.querySelector(".watch-toolbar");
  const highlightsEl = document.querySelector(".watch-highlights");
  const toolbarHeight = toolbarEl instanceof HTMLElement
    ? Math.ceil(toolbarEl.getBoundingClientRect().height)
    : 52;
  const highlightsHeight = highlightsEl instanceof HTMLElement
    ? Math.ceil(highlightsEl.getBoundingClientRect().height)
    : 0;
  const nextReserve = toolbarHeight + highlightsHeight;
  const reserveChanged = playerStackReserve.value !== nextReserve;
  playerStackReserve.value = nextReserve;
  if (reserveChanged) {
    nextTick(() => {
      schedulePlayerWidthMeasure();
    });
  }
}

function schedulePlayerWidthMeasure() {
  if (playerWidthRaf) cancelAnimationFrame(playerWidthRaf);
  playerWidthRaf = requestAnimationFrame(() => {
    playerWidthRaf = null;
    measurePlayerWidth();
  });
}

function init() {
  window.scrollTo(0, 0);
  startTime.value = 0;
  watchStore.$reset();
  watchStore.setId(videoId.value);
  watchStore.fetchVideo()?.then(() => {
    nextTick(() => {
      schedulePlayerWidthMeasure();
    });
    historyStore.addWatchedVideo(video.value);
  });
}

function ready(event: any) {
  player.value = event;
  nextTick(() => {
    schedulePlayerWidthMeasure();
  });
}

function playing() {
  instance?.proxy?.$gtag?.event("start/resume", {
    event_category: "video",
    event_label: video.value.type,
  });
}

function seekTo(time: number) {
  if (!player.value) return;
  window.scrollTo(0, 0);
  player.value.seekTo(time);
  player.value.playVideo();
}

function playNextPlaylist({ video: nextVideo }: { video: any }) {
  instance?.proxy?.$gtag?.event("playlist-next", {
    event_category: "video",
    event_label: nextVideo.type || "untyped",
  });
  router.push({
    path: `/watch/${nextVideo.id}`,
    query: {
      playlist: route.query.playlist as string,
    },
  });
}

function handleVideoUpdate(update: any) {
  if (!update?.status || !update?.start_actual) return;
  video.value.live_viewers = update.live_viewers;
  video.value.status = update.status;
  if (typeof update.start_actual === "string") {
    video.value.start_actual = update.start_actual;
  }
}

function handleCurrentTime(time: number) {
  currentTime.value = time;
}

function ended() {
  if (playlistIndex.value >= 0) {
    playlistIndex.value += 1;
  }
}

function toggleTheaterMode() {
  theaterMode.value = !theaterMode.value;
  nextTick(() => {
    schedulePlayerWidthMeasure();
    if (watchLayout.value) watchLayout.value.scrollTop = 0;
  });
}

function like() {
  ytPlayer.value?.sendLikeEvent();
}

function toggleUploadPanel(open: boolean) {
  appStore.setUploadPanel(open);
}

// Lifecycle (created equivalent)
init();
if (showTL.value && !hintConnectLiveTL) {
  hintConnectLiveTL = true;
}

onMounted(() => {
  window.addEventListener("resize", schedulePlayerWidthMeasure, { passive: true });
  nextTick(() => {
    schedulePlayerWidthMeasure();
  });
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", schedulePlayerWidthMeasure);
  if (playerWidthRaf) cancelAnimationFrame(playerWidthRaf);
});
</script>

<style>
/* ═══════════════════════════════════════════════════════
   Watch Page — Cinema/Theater Mode
   ═══════════════════════════════════════════════════════ */

/* ── Custom Properties ── */
.watch-page {
  --nav-h: 65px;
  --pad-y: 10px;
  --pad-x: clamp(12px, 1.8vw, 24px);
  --gap: clamp(12px, 1.6vw, 20px);
  --chat-w: clamp(320px, 24vw, 360px);
  --toolbar-h: 52px;
}

/* ── YouTube Embed (required for iframe sizing) ── */
.video {
  position: relative;
  aspect-ratio: 16 / 9;
  width: 100%;
  height: auto;
  overflow: hidden;
  background: #000;
}
.video > iframe,
.video > div {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.video > div > iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  transform: none;
}

/* ── Loading Shell ── */
.watch-loading-shell {
  width: 100%;
  box-sizing: border-box;
  min-height: calc(100vh - 65px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
}
@media (min-width: 960px) {
  .watch-loading-shell {
    padding: calc(10px + 8rem) clamp(12px, 1.8vw, 24px) 0;
  }
}
@media (max-width: 959px) {
  .watch-loading-shell {
    padding: calc(10px + 5.5rem) 1rem 0;
  }
}

/* ── Base Layout ── */
.watch-page {
  box-sizing: border-box;
  position: relative;
  z-index: 0;
  display: flex;
  flex-direction: row;
  overflow-x: clip;
}

.watch-content {
  min-width: 0;
  overflow: visible;
  width: 100%;
  display: flex;
  flex-direction: row;
  flex-grow: 1;
  align-items: flex-start;
  position: relative;
  z-index: 1;
}

.watch-main {
  flex: 1 1 auto;
  min-width: 0;
  max-width: min(100%, 1080px);
  display: flex;
  flex-direction: column;
}

.watch-section {
  margin-top: clamp(12px, 1.4vw, 18px);
}

/* ── Player Group (video + highlights + toolbar) ──
   In non-cinema / mobile: display:contents so children
   flow directly in watch-main (sticky toolbar works).
   In cinema: display:block with negative margins so
   video and toolbar share the same extended container. */
.watch-player-group {
  display: contents;
}

/* ── Cinema Screen ── */
.watch-screen {
  position: relative;
  transition: background 0.35s ease;
}

.watch-screen--cinema {
  margin-top: calc(-1 * var(--pad-y));
}

/* Video constrained by viewport height (nav + toolbar + top padding), centered */
.watch-screen--cinema .video {
  max-width: calc((100dvh - var(--nav-h) - var(--player-stack-reserve)) * 16 / 9);
  margin-inline: auto;
  box-shadow: 0 28px 80px rgb(2 6 23 / 0.38);
}

/* Toolbar matches video width in cinema */
.watch-page--cinema .watch-toolbar {
  max-width: calc((100dvh - var(--nav-h) - var(--player-stack-reserve)) * 16 / 9);
  margin-inline: auto;
  width: 100%;
}

/* Cinema: content flows vertically, items stretch */
.watch-page--cinema .watch-content {
  flex-direction: column;
  align-items: stretch;
}
.watch-page--cinema .watch-main {
  max-width: none;
  width: 100%;
}

/* Cinema: player group becomes a real box with edge-to-edge margins */
.watch-page--cinema .watch-player-group {
  display: block;
}

/* Dim content below video */
.watch-page--cinema .watch-section {
  opacity: 0.9;
  transition: opacity 0.3s ease;
}
.watch-page--cinema .watch-section:hover {
  opacity: 1;
}

/* Cinema chat styling */
.watch-page--cinema .watch-chat {
  border-left: 1px solid rgb(255 255 255 / 0.06);
  background: rgb(2 6 23 / 0.95);
}

/* ── Chat Sidebar ── */
.watch-chat {
  flex: 0 0 var(--chat-w);
  width: 100%;
  min-width: 320px;
  position: relative;
  z-index: 1;
}

/* ══════ Desktop (≥960px) ══════ */
@media (min-width: 960px) {
  .watch-page {
    padding: var(--pad-y) var(--pad-x) clamp(1.5rem, 3vw, 3rem);
    gap: var(--gap);
    align-items: flex-start;
  }

  /* Player group extends to viewport edges in cinema */
  .watch-page--cinema .watch-player-group {
    margin-left: calc(-1 * var(--pad-x));
    margin-right: calc(-1 * var(--pad-x));
  }

  /* Sticky toolbar on desktop (range limited by player-group in cinema) */
  .watch-toolbar {
    position: sticky;
    top: var(--nav-h);
    z-index: 40;
  }

  /* Fixed chat sidebar */
  .watch-chat {
    position: fixed;
    top: calc(var(--nav-h) + var(--pad-y));
    right: var(--pad-x);
    width: var(--chat-w);
    height: calc(100vh - var(--nav-h) - var(--pad-y));
    min-height: 0;
    overflow-y: auto;
    border-radius: 0.75rem;
  }

  /* Reserve space for fixed chat */
  .watch-page--chat:not(.watch-page--mobile) {
    padding-right: calc(var(--chat-w) + var(--gap) + var(--pad-x));
  }

  /* Cinema+chat: no gap between player group and chat */
  .watch-page--cinema.watch-page--chat:not(.watch-page--mobile) {
    padding-right: calc(var(--chat-w) + var(--pad-x));
  }

  /* Cinema chat: flush to right edge */
  .watch-page--cinema .watch-chat {
    border-radius: 0;
    right: 0;
    top: var(--nav-h);
    height: calc(100dvh - var(--nav-h));
  }
}

/* Narrow desktop */
@media (min-width: 960px) and (max-width: 1320px) {
  .watch-page {
    --chat-w: 300px;
  }
}

/* ══════ Mobile (<960px) ══════ */
@media (max-width: 959px) {
  .watch-page {
    flex-direction: column;
    padding-top: var(--pad-y);
  }

  .watch-content {
    width: 100%;
    flex-direction: column;
  }

  .watch-main {
    width: 100%;
    min-width: 0;
    flex-basis: auto;
  }

  /* Sticky toolbar on mobile */
  .watch-toolbar {
    position: sticky;
    top: calc(var(--nav-h) + var(--pad-y));
    z-index: 35;
  }

  .video {
    border-radius: 0;
  }

  /* Chat inline below video */
  .watch-chat {
    position: relative;
    width: 100%;
    height: auto;
    min-height: min(56vh, 420px);
    max-height: 65vh;
    margin-top: var(--gap);
    overflow: hidden;
    flex: 1 1 auto;
    min-width: 0;
  }

  /* Mobile TL overlay */
  .watch-page .watch-chat .tl-overlay {
    width: 100%;
    position: absolute;
    z-index: 5;
    top: 0;
    height: 50%;
  }
  .watch-page .watch-chat .embedded-chat {
    height: 100% !important;
  }
  .watch-page .watch-chat .tl-overlay.stick-bottom {
    bottom: 0;
    top: initial;
  }
}
</style>
