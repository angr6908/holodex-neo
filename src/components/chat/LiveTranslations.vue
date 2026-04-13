<template>
  <UiCard class-name="tl-overlay relative w-full overflow-hidden border-0 bg-transparent p-0 text-sm shadow-none">
    <div
      v-if="showOverlay || (!forceCloseOverlay && socketDisconnected)"
      class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-slate-950/90 px-4 text-center backdrop-blur-sm"
    >
      <div v-if="isLoading" class="text-sm text-slate-300">
        {{ $t("views.watch.chat.loading") }}
      </div>
      <template v-else>
        <div class="text-sm text-slate-400">
          {{ overlayMessage }}
        </div>
        <div class="flex flex-wrap items-center justify-center gap-2">
          <UiButton
            v-if="socketDisconnected"
            variant="outline"
            size="sm"
            class-name="h-7 rounded-lg text-xs"
            @click="tlJoin()"
          >
            {{ $t("views.watch.chat.retryBtn") }}
          </UiButton>
          <UiButton
            variant="ghost"
            size="sm"
            class-name="h-7 rounded-lg text-xs text-slate-500"
            @click="() => { forceCloseOverlay = true; showOverlay = false; }"
          >
            {{ $t("views.app.close_btn") }}
          </UiButton>
        </div>
      </template>
    </div>
    <div class="flex items-center justify-between gap-2 border-b border-white/8 px-3 py-1.5">
      <div class="flex items-center gap-1.5 text-xs font-medium" :class="connected ? 'text-emerald-400' : 'text-rose-400'">
        <span class="inline-block h-1.5 w-1.5 rounded-full" :class="connected ? 'bg-emerald-400' : 'bg-rose-400'" />
        TLdex [{{ liveTlLang }}]
      </div>
      <div class="flex items-center gap-0.5">
        <UiButton
          v-if="!tlClient"
          variant="ghost"
          size="icon"
          class-name="h-6 w-6 rounded-full text-slate-400 hover:text-white"
          :title="$t('views.watch.chat.showSubtitle')"
          @click="showSubtitle = !showSubtitle"
        >
          <UiIcon
            :icon="mdiSubtitlesOutline"
            size="xs"
            :class-name="showSubtitle ? 'text-[color:var(--color-primary)]' : ''"
          />
        </UiButton>
        <UiButton
          v-if="!tlClient"
          variant="ghost"
          size="icon"
          class-name="h-6 w-6 rounded-full text-slate-400 hover:text-white"
          :title="$t('views.watch.chat.expandTL')"
          @click="expanded = true"
        >
          <UiIcon :icon="mdiArrowExpand" size="xs" />
        </UiButton>
        <UiDialog
          v-if="!tlClient"
          :open="expanded"
          class-name="max-w-4xl p-0"
          @update:open="expanded = $event"
        >
          <UiCard class-name="p-0">
            <div :id="expandedMsgId" class="flex tl-expanded" />
            <div class="flex justify-end border-t border-white/10 px-4 py-3">
              <UiButton variant="destructive" size="sm" @click="expanded = false">
                {{ $t("views.app.close_btn") }}
              </UiButton>
            </div>
          </UiCard>
        </UiDialog>
        <WatchLiveTranslationsSetting />
      </div>
    </div>
    <Teleport :to="`#${expandedMsgId}`" :disabled="!expanded">
      <message-renderer
        ref="tlBody"
        :tl-history="filteredMessages"
        :font-size="liveTlFontSize"
      >
        <div
          v-if="tlHistory.length - filteredMessages.length > 0"
          class="text-caption"
        >
          {{ tlHistory.length - filteredMessages.length }} Blocked Messages
        </div>
        <UiButton
          v-if="!completed && !historyLoading && expanded"
          variant="ghost"
          size="sm"
          @click="loadMessages(false, true)"
        >
          Load All
        </UiButton>
      </message-renderer>
    </Teleport>
    <Teleport v-if="showSubtitle" :to="`#overlay-${video.id}`">
      <WatchSubtitleOverlay :messages="toDisplay" />
    </Teleport>
  </UiCard>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick, getCurrentInstance } from "vue";
import { dayjs } from "@/utils/time";
import { mdiArrowExpand, mdiSubtitlesOutline } from "@mdi/js";
import { useI18n } from "vue-i18n";
import { useSettingsStore } from "@/stores/settings";
import { useAppStore } from "@/stores/app";
import { useChatMixin } from "@/composables/useChatMixin";
import UiButton from "@/components/ui/button/Button.vue";
import UiCard from "@/components/ui/card/Card.vue";
import UiDialog from "@/components/ui/dialog/Dialog.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import WatchLiveTranslationsSetting from "./LiveTranslationsSetting.vue";
import MessageRenderer from "./MessageRenderer.vue";
import WatchSubtitleOverlay from "../watch/WatchSubtitleOverlay.vue";

defineOptions({ name: "LiveTranslations" });

const _self = getCurrentInstance();
const expandedMsgId = `tl-expanded-${_self?.uid ?? Math.random().toString(36).slice(2)}`;

const { t } = useI18n();
const settingsStore = useSettingsStore();
const appStore = useAppStore();

const props = withDefaults(defineProps<{
  video: Record<string, any>;
  currentTime?: number;
  useLocalSubtitleToggle?: boolean;
  tlLang?: string;
  tlClient?: boolean;
}>(), {
  currentTime: 0,
  tlLang: "",
  tlClient: false,
});

const emit = defineEmits<{
  (e: "videoUpdate", obj: any): void;
  (e: "timeJump", time: number, a: boolean, b: boolean): void;
}>();

const {
  tlHistory,
  expanded,
  historyLoading,
  completed,
  MESSAGE_TYPES,
  liveTlLang,
  liveTlFontSize,
  liveTlShowVerified,
  liveTlShowModerator,
  liveTlShowVtuber,
  showSubtitle,
  startTimeMillis,
  parseMessage,
  loadMessages,
} = useChatMixin({
  video: props.video,
  currentTime: computed(() => props.currentTime),
  useLocalSubtitleToggle: props.useLocalSubtitleToggle,
});

const overlayMessage = ref(t("views.watch.chat.loading"));
const showOverlay = ref(false);
const forceCloseOverlay = ref(false);
const isLoading = ref(true);
const success = ref(false);
const tlBody = ref<InstanceType<typeof MessageRenderer> | null>(null);

const instance = getCurrentInstance();
const socket = instance?.proxy?.$socket;

const hasSocketClient = computed(() => Boolean(socket?.client));
const connected = computed(() => !hasSocketClient.value || Boolean(socket?.connected));
const socketDisconnected = computed(() => hasSocketClient.value && Boolean(socket?.disconnected));

const blockedNames = computed(() => settingsStore.liveTlBlockedNames);

const filteredMessages = computed(() =>
  tlHistory.value.filter((m: any) => !blockedNames.value.has(m.name)),
);

const toDisplay = computed(() => {
  if (!filteredMessages.value.length || !showSubtitle.value) return [];
  const buffer = filteredMessages.value.slice(-2);
  return buffer.filter((m: any) => {
    const displayTime = +m.duration || m.message.length * 65 + 1800;
    const receivedRelativeSec = m.receivedAt
      ? m.receivedAt - (startTimeMillis.value ?? 0)
      : m.relativeMs;
    const curTime = Date.now() - (startTimeMillis.value ?? 0);
    return (
      props.currentTime
      && curTime >= receivedRelativeSec
      && curTime < receivedRelativeSec + displayTime
    );
  });
});

watch(() => props.tlLang, () => {
  liveTlLang.value = props.tlLang;
});

watch(liveTlLang, (nw, old) => {
  if (hasSocketClient.value) {
    switchLanguage(nw, old);
    return;
  }
  refreshFallbackHistory();
});

watch(connected, (nw) => {
  if (nw) {
    isLoading.value = false;
  }
});

watch(tlHistory, () => {
  nextTick(() => {
    tlBody.value?.scrollToBottom();
  });
});

function registerListener() {
  if (!socket?.client) return;
  socket.client.on(
    `${props.video.id}/${liveTlLang.value}`,
    handleMessage,
  );
}

function unregisterListener() {
  if (!socket?.client) return;
  socket.client.off(
    `${props.video.id}/${liveTlLang.value}`,
    handleMessage,
  );
}

function handleMessage(msg: any) {
  if (!msg.type) {
    if (blockedNames.value.has(msg.name)) return;

    if (props.tlClient) {
      if (
        msg.is_tl
        || msg.is_owner
        || (msg.is_vtuber && liveTlShowVtuber.value)
        || (msg.is_moderator && liveTlShowModerator.value)
        || (msg.is_verified && liveTlShowVerified.value)
      ) {
        const parsedMessage = parseMessage(msg);
        parsedMessage.receivedAt = Date.now();
        tlHistory.value.push(parsedMessage);
      }
    } else if (
      msg.is_tl
      || msg.is_owner
      || (msg.is_vtuber && liveTlShowVtuber.value)
      || (msg.is_moderator && liveTlShowModerator.value)
      || (msg.is_verified && liveTlShowVerified.value)
    ) {
      const parsedMessage = parseMessage(msg);
      parsedMessage.receivedAt = Date.now();
      tlHistory.value.push(parsedMessage);
    }
    return;
  }
  switch (msg.type) {
    case MESSAGE_TYPES.UPDATE:
      emit("videoUpdate", msg);
      break;
    case MESSAGE_TYPES.END:
      overlayMessage.value = msg.message;
      tlLeave();
      break;
    case MESSAGE_TYPES.ERROR:
      overlayMessage.value = "An unexpected error occured";
      tlLeave();
      break;
    default:
      break;
  }
}

let fallbackPollTimer: ReturnType<typeof setInterval> | null = null;

function refreshFallbackHistory() {
  loadMessages(true, false, props.tlClient);
  showOverlay.value = false;
  forceCloseOverlay.value = false;
  isLoading.value = false;
}

function stopFallbackPolling() {
  if (!fallbackPollTimer) return;
  clearInterval(fallbackPollTimer);
  fallbackPollTimer = null;
}

function startFallbackPolling() {
  stopFallbackPolling();
  refreshFallbackHistory();
  fallbackPollTimer = setInterval(() => {
    refreshFallbackHistory();
  }, 15000);
}

function tlJoin() {
  if (!hasSocketClient.value) {
    refreshFallbackHistory();
    return;
  }
  if (!initSocket()) return;
  if (!socket?.client) return;

  loadMessages(true, false, props.tlClient);

  if (
    socket.client.listeners(`${props.video.id}/${liveTlLang.value}`)
      .length > 0
  ) {
    registerListener();
    success.value = true;
    appStore.incrementActiveSockets();
  } else {
    socket.client.emit("subscribe", {
      video_id: props.video.id,
      lang: liveTlLang.value,
    });
  }
}

function tlLeave() {
  if (!socket?.client) return;
  if (success.value) {
    appStore.decrementActiveSockets();
    if (
      socket.client.listeners(`${props.video.id}/${liveTlLang.value}`)
        .length <= 1
    ) {
      socket.client.emit("unsubscribe", {
        video_id: props.video.id,
        lang: liveTlLang.value,
      });
    }
    unregisterListener();
    success.value = false;
  }
}

function switchLanguage(newLang: string, oldLang: string) {
  if (!socket?.client) return;
  socket.client.emit("unsubscribe", {
    video_id: props.video.id,
    lang: oldLang,
  });
  socket.client.off(
    `${props.video.id}/${oldLang}`,
    handleMessage,
  );
  success.value = false;
  tlJoin();
}

function initSocket(): boolean {
  if (
    props.video.status
    && props.video.status !== "live"
    && !dayjs().isAfter(
      dayjs(props.video.start_scheduled).subtract(15, "minutes"),
    )
  ) {
    overlayMessage.value = t("views.watch.chat.status.notLive");
    isLoading.value = false;
    showOverlay.value = true;
    return false;
  }
  isLoading.value = true;

  if (!socket?.client) {
    overlayMessage.value = t("views.watch.chat.status.reconnectFailed");
    isLoading.value = false;
    showOverlay.value = true;
    return false;
  }
  if (socket.disconnected) {
    socket.client.connect();
  }
  return true;
}

// Register socket event handlers
onMounted(() => {
  if (socket) {
    socket.client?.on("reconnect_attempt", (attempt: number) => {
      overlayMessage.value = `${t("views.watch.chat.status.reconnecting")} ${attempt}/10`;
    });
    socket.client?.on("reconnect_failed", () => {
      overlayMessage.value = t("views.watch.chat.status.reconnectFailed");
    });
    socket.client?.on("connect_error", () => {
      console.error("[TLdex] Connect Errored...");
      overlayMessage.value = t("views.watch.chat.status.reconnectFailed");
    });
    socket.client?.on("connect", () => {
      tlJoin();
    });
    socket.client?.on("disconnect", () => {
      tlLeave();
    });
    socket.client?.on("subscribeSuccess", (obj: any) => {
      if (obj.id === props.video.id && !success.value) {
        success.value = true;
        registerListener();
        appStore.incrementActiveSockets();
      }
      emit("videoUpdate", obj);
      showOverlay.value = false;
      isLoading.value = false;
    });
    socket.client?.on("subscribeError", (obj: any) => {
      if (obj.id === props.video.id) {
        overlayMessage.value = obj.message;
        isLoading.value = false;
        showOverlay.value = true;
      }
    });
  }

  if (!hasSocketClient.value) {
    startFallbackPolling();
  } else if (socket?.connected) {
    tlJoin();
  } else {
    initSocket();
  }
});

onBeforeUnmount(() => {
  stopFallbackPolling();
  tlLeave();
});
</script>

<style>
.tl-body {
  overflow-y: auto;
  overscroll-behavior: contain;
  height: calc(100% - 32px);
  display: flex;
  flex-direction: column-reverse;
  line-height: 1.35;
  letter-spacing: 0.018em;
}

.tl-expanded {
  overscroll-behavior: auto !important;
  height: 75vh;
}

.tl-expanded > .tl-body {
  height: 75vh;
  width: 100%;
}

.tl-overlay {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}
</style>
