<template>
  <section v-if="!isLoading && !hasError" class="video-editor">
    <div class="grid gap-4 lg:grid-cols-12">
      <div class="px-0 pt-0 lg:col-span-4">
        <WatchFrame :video="video">
          <template #youtube>
            <youtube
              v-if="video.id"
              :video-id="video.id"
              :player-vars="{
                ...(timeOffset && { start: timeOffset }),
                autoplay: 1,
                playsinline: 1,
                cc_lang_pref: getLang,
                hl: getLang,
              }"
              @ready="ready"
            />
          </template>
        </WatchFrame>
        <WatchToolbar :video="video">
          <template #buttons>
            <UiButton
              v-if="isLive"
              type="button"
              size="icon"
              :variant="showTL ? 'default' : 'ghost'"
              :title="showTL ? $t('views.watch.chat.hideTLBtn') : $t('views.watch.chat.showTLBtn')"
              @click="showTL = !showTL"
            >
              <UiIcon :icon="icons.tlChat" />
            </UiButton>
            <UiButton
              v-if="isLive"
              type="button"
              size="icon"
              :variant="showLiveChat ? 'default' : 'ghost'"
              @click="showLiveChat = !showLiveChat"
            >
              <UiIcon :icon="icons.ytChat" />
            </UiButton>
          </template>
        </WatchToolbar>
        <div v-if="isLive" ref="watchLayout" class="flex flex-row grow">
          <WatchLiveChat
            v-model="chatStatus"
            class="sidebar chat grow"
            :video="video"
            :current-time="currentTime"
            @videoUpdate="handleVideoUpdate"
            @timeJump="seekTo"
          />
        </div>
        <div v-if="video.comments.length" class="comment-scroller">
          <CommentSongParser
            v-if="currentTab === 1"
            :comments="video.comments"
            @songSelected="selectSongCandidate"
          />
          <WatchComments
            v-if="video && video.comments && video.comments.length"
            key="comments"
            hide-buckets
            default-expanded
            :comments="video.comments"
            :video="video"
            :limit="appStore.isMobile ? 5 : 0"
            @timeJump="seekTo"
          />
        </div>
      </div>
      <div class="related-videos pt-0 lg:col-span-8">
        <div
          v-if="!appStore.userdata || !appStore.userdata.jwt"
          class="mb-4 rounded-xl border border-red-400/30 bg-red-500/15 px-4 py-3 text-sm text-red-100"
          v-html="$t('views.editor.needlogin')"
        />
        <div class="rounded-2xl border border-white/10 bg-white/4 p-4">
          <div class="mb-4 flex flex-wrap items-center gap-2">
            <UiButton
              type="button"
              variant="ghost"
              size="icon"
              :title="$t('editor.exitMode')"
              @click="router.go(-1);"
            >
              <UiIcon :icon="icons.mdiArrowLeft" />
            </UiButton>
            <button
              type="button"
              class="rounded-xl px-3 py-2 text-sm transition"
              :class="currentTab === TABS.TOPIC ? activeTabClass : inactiveTabClass"
              :disabled="video.type !== 'stream'"
              @click="currentTab = TABS.TOPIC"
            >
              {{ $t("component.search.type.topic") }}
            </button>
            <button
              type="button"
              class="rounded-xl px-3 py-2 text-sm transition"
              :class="currentTab === TABS.MUSIC ? activeTabClass : inactiveTabClass"
              :disabled="video.type !== 'stream'"
              @click="currentTab = TABS.MUSIC"
            >
              {{ $t("component.mainNav.music") }}
            </button>
            <button
              type="button"
              class="rounded-xl px-3 py-2 text-sm transition"
              :class="currentTab === TABS.MENTIONS ? activeTabClass : inactiveTabClass"
              @click="currentTab = TABS.MENTIONS"
            >
              {{ $t("views.editor.channelMentions.title") }}
            </button>
            <button type="button" disabled class="rounded-xl px-3 py-2 text-sm text-[color:var(--color-muted-foreground)] opacity-50">
              {{ $t("views.editor.sources.title") }}
            </button>
          </div>

          <div class="p-1">
            <div v-show="currentTab === TABS.TOPIC">
              <div class="mb-3 flex items-center gap-2 text-lg font-semibold text-[color:var(--color-foreground)]">
                <UiIcon :icon="icons.mdiAnimationPlay" />
                <h5>{{ $t("views.editor.changeTopic.title") }}</h5>
              </div>
              <div class="space-y-3">
                <p>
                  {{ $t("views.editor.changeTopic.info") }}
                </p>
                <select
                  v-model="newTopic"
                  class="w-full rounded-xl border border-white/12 bg-slate-950/70 px-3 py-2 text-sm text-[color:var(--color-foreground)] outline-none"
                />
                <option :value="null">
                  Topic (leave empty to unset)
                </option>
                <option v-for="topic in topics" :key="topic.value" :value="topic.value">
                  {{ topic.text }}
                </option>
                <UiButton type="button" @click="saveTopic">
                  {{ $t("views.editor.changeTopic.button") }}
                </UiButton>
              </div>
            </div>
            <div v-show="currentTab === TABS.MUSIC">
              <VideoEditSongs
                id="musicEditor"
                ref="musicEditor"
                :video="video"
                :current-time="currentTime"
                @timeJump="seekTo"
              />
            </div>
            <div v-if="currentTab === TABS.MENTIONS">
              <VideoEditMentions :video="video" />
            </div>
          </div>
          <div class="mt-4">
            <WatchInfo key="info" :video="video" />
          </div>
        </div>
      </div>
    </div>
  </section>
  <LoadingOverlay v-else :is-loading="isLoading" :show-error="hasError" />
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import * as icons from "@/utils/icons";
import Youtube from "@/components/player/YoutubePlayer.vue";
import LoadingOverlay from "@/components/common/LoadingOverlay.vue";
import WatchInfo from "@/components/watch/WatchInfo.vue";
import WatchFrame from "@/components/watch/WatchFrame.vue";
import WatchToolbar from "@/components/watch/WatchToolbar.vue";
import WatchLiveChat from "@/components/watch/WatchLiveChat.vue";
import WatchComments from "@/components/watch/WatchComments.vue";
import VideoEditSongs from "@/components/edit/VideoEditSongs.vue";
import VideoEditMentions from "@/components/edit/VideoEditMentions.vue";
import CommentSongParser from "@/components/media/CommentSongParser.vue";
import UiButton from "@/components/ui/button/Button.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import { decodeHTMLEntities, getYTLangFromState } from "@/utils/functions";
import api from "@/utils/backend-api";
import { useAppStore } from "@/stores/app";
import { useWatchStore } from "@/stores/watch";
import { useSettingsStore } from "@/stores/settings";
import { useMetaTitle } from "@/composables/useMetaTitle";

const route = useRoute();
const router = useRouter();
const { t: $t } = useI18n();
const appStore = useAppStore();
const watchStore = useWatchStore();
const settingsStore = useSettingsStore();

// --- Template refs ---
const musicEditor = ref<InstanceType<typeof VideoEditSongs> | null>(null);

// --- Reactive state ---
const isLoading = ref(true);
const hasError = ref(false);
const id = ref<string | number>(0);
const video = ref<any>(null);
const startTime = ref(0);
const currentTab = ref(0);
const TABS = Object.freeze({
  TOPIC: 0,
  MUSIC: 1,
  MENTIONS: 2,
  SOURCES_CLIPS: 3,
});
const newTopic = ref<string | null>(null);
const topics = ref<{ value: string; text: string }[]>([]);
const currentTime = ref(0);
const stopAt = ref<number | null>(null);

// Non-reactive locals
let player: any = null;
let timer: ReturnType<typeof setInterval> | null = null;

const showTL = computed({
  get: () => watchStore.showTL,
  set: (v: boolean) => watchStore.setShowTL(v),
});
const showLiveChat = computed({
  get: () => watchStore.showLiveChat,
  set: (v: boolean) => watchStore.setShowLiveChat(v),
});

const chatStatus = computed({
  get: () => ({
    showTlChat: showTL.value,
    showYtChat: showLiveChat.value,
  }),
  set: (val: any) => {
    showTL.value = val.showTlChat;
    showLiveChat.value = val.showYtChat;
  },
});

// --- Computed ---
const isLive = computed(() => video.value && ["live", "upcoming"].includes(video.value.status));

const videoId = computed(() => (route.params.id as string) || (route.query.v as string));

const timeOffset = computed(() => +(route.query.t as string) || startTime.value);

const title = computed(
  () => (video.value && video.value.title && decodeHTMLEntities(video.value.title)) || "",
);

const getLang = computed(() =>
  getYTLangFromState({ settings: { lang: settingsStore.langSetting } }),
);

const activeTabClass = "bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)]";
const inactiveTabClass =
  "bg-white/6 text-[color:var(--color-muted-foreground)] hover:bg-white/10 hover:text-[color:var(--color-foreground)]";

// --- Meta title ---
useMetaTitle(title);

// --- Methods ---
function initTab() {
  if (currentTab.value === TABS.TOPIC) {
    populateTopics();
  }
}

function init() {
  id.value = videoId.value;
  fetchVideo();
  initTab();
}

function ready(event: any) {
  player = event;
  setTimer();
}

function seekTo(time: number, playNow?: boolean, updateStartTime?: boolean, stopPlayingAt?: number) {
  if (!player) return;
  player.seekTo(time);
  stopAt.value = stopPlayingAt ?? null;
  if (playNow) player.playVideo();
  if (updateStartTime && currentTab.value === TABS.MUSIC) {
    musicEditor.value?.setStartTime(time);
  }
}

function fetchVideo() {
  if (!id.value) throw new Error("Invalid id");
  isLoading.value = true;
  return api
    .video(id.value, null, 1)
    .then(({ data }: any) => {
      video.value = data;
      isLoading.value = false;
    })
    .catch((e: any) => {
      hasError.value = true;
      console.error(e);
    });
}

function handleVideoUpdate(update: any) {
  if (!update?.status || !update?.start_actual) return;
  video.value.live_viewers = update.live_viewers;
  video.value.status = update.status;
  // papers over an issue with socket sending a placeholder object in start_actual
  if (typeof update.start_actual === "string") {
    video.value.start_actual = update.start_actual;
  }
}

async function populateTopics() {
  topics.value = (await api.topics()).data.map((topic: any) => ({
    value: topic.id,
    text: `${topic.id} (${topic.count ?? 0})`,
  }));
}

function saveTopic() {
  api.topicSet(newTopic.value, videoId.value, appStore.userdata.jwt);
}

function setTimer() {
  if (timer) clearInterval(timer);
  if (player) {
    timer = setInterval(() => {
      currentTime.value = player.getCurrentTime();
    }, 200);
  }
}

function selectSongCandidate(timeframe: any, songdata: any) {
  // timeframe has start_time and end_time plus tokens
  // songdata is the same as the selection output from a itunes dropdown. If song data is undefined, then the user only clicked on a timeframe.
  musicEditor.value?.setSongCandidate(timeframe, songdata);
  seekTo(timeframe.start_time, true);
}

// --- Watchers ---
watch(() => route.params.id, () => init());
watch(() => route.query.v, () => init());
watch(currentTab, () => initTab());

// --- Lifecycle ---
onMounted(() => {
  // Load specific tab if defined in the tab param
  if (route.params.tab) {
    const tabKey = (route.params.tab as string).toUpperCase();
    currentTab.value = (TABS as Record<string, number>)[tabKey] ?? 0;
  }
  init();
});

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});
</script>

<style>
.video-editor .comment-scroller {
    height: 400px;
    height: 60vh;
    overflow: hidden auto;
}

.video-editor .watch-card {
    border: none !important;
    box-shadow: none !important;
}

.video-editor .thumbnail-overlay {
    background-color: rgba(0, 0, 0, 0.5);
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
}

.video-editor .thumbnail {
    position: relative;
}
</style>
