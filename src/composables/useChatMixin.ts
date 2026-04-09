import { ref, computed, watch, onMounted } from "vue";
import api from "@/utils/backend-api";
import { dayjs } from "@/utils/time";
import { useSettingsStore } from "@/stores/settings";

export interface ChatVideo {
  id: string;
  available_at?: string;
  isCustom?: boolean;
}

export interface ChatMessage {
  name: string;
  timestamp: number;
  message: string;
  parsed?: string;
  relativeMs?: number;
  key?: string;
  breakpoint?: boolean;
  [key: string]: unknown;
}

export interface UseChatOptions {
  /** The video object this chat is associated with. */
  video: ChatVideo;
  /** Reactive current playback time in seconds (for archive sync). */
  currentTime?: { value: number };
  /**
   * When true, the subtitle toggle uses a local ref instead of the
   * global settings store (for multiview panels).
   */
  useLocalSubtitleToggle?: boolean;
}

/**
 * Composable replacement for chatMixin.
 * Loads chat history from the API, parses messages with emoji handling,
 * and exposes reactive settings bound to the settings store.
 */
export function useChatMixin(options: UseChatOptions) {
  const settingsStore = useSettingsStore();

  // ──────────────────────────────────────────────
  // Reactive state
  // ──────────────────────────────────────────────

  const tlHistory = ref<ChatMessage[]>([]);
  const expanded = ref(false);
  const historyLoading = ref(false);
  const completed = ref(false);
  const limit = ref(20);
  const subtitleToggle = ref(true);
  const curIndex = ref(0);

  const MESSAGE_TYPES = Object.freeze({
    END: "end",
    ERROR: "error",
    INFO: "info",
    MESSAGE: "message",
    UPDATE: "update",
  });

  // ──────────────────────────────────────────────
  // Settings (two-way bound to store)
  // ──────────────────────────────────────────────

  const liveTlStickBottom = computed({
    get: () => settingsStore.liveTlStickBottom,
    set: (v: boolean) => { settingsStore.liveTlStickBottom = v; },
  });

  const liveTlLang = computed({
    get: () => settingsStore.liveTlLang,
    set: (v: string) => { settingsStore.liveTlLang = v; },
  });

  const liveTlFontSize = computed({
    get: () => settingsStore.liveTlFontSize,
    set: (v: number) => { settingsStore.liveTlFontSize = v; },
  });

  const liveTlShowVerified = computed({
    get: () => settingsStore.liveTlShowVerified,
    set: (v: boolean) => { settingsStore.liveTlShowVerified = v; },
  });

  const liveTlShowModerator = computed({
    get: () => settingsStore.liveTlShowModerator,
    set: (v: boolean) => { settingsStore.liveTlShowModerator = v; },
  });

  const liveTlWindowSize = computed({
    get: () => settingsStore.liveTlWindowSize,
    set: (v: number) => { settingsStore.liveTlWindowSize = v; },
  });

  const liveTlShowVtuber = computed({
    get: () => settingsStore.liveTlShowVtuber,
    set: (v: boolean) => { settingsStore.liveTlShowVtuber = v; },
  });

  const liveTlShowSubtitle = computed({
    get: () => settingsStore.liveTlShowSubtitle,
    set: (v: boolean) => { settingsStore.liveTlShowSubtitle = v; },
  });

  const liveTlHideSpoiler = computed({
    get: () => settingsStore.liveTlHideSpoiler,
    set: (v: boolean) => { settingsStore.liveTlHideSpoiler = v; },
  });

  const blockedNames = computed(() => settingsStore.liveTlBlockedNames);

  const lang = computed(() => settingsStore.lang);

  /** Subtitle toggle — local or global depending on context. */
  const showSubtitle = computed({
    get: () =>
      options.useLocalSubtitleToggle
        ? subtitleToggle.value
        : liveTlShowSubtitle.value,
    set: (val: boolean) => {
      if (options.useLocalSubtitleToggle) {
        subtitleToggle.value = val;
      } else {
        liveTlShowSubtitle.value = val;
      }
    },
  });

  /** Millisecond timestamp of the video's start time. */
  const startTimeMillis = computed(() => {
    if (!options.video.available_at) return null;
    return Number(dayjs(options.video.available_at));
  });

  // ──────────────────────────────────────────────
  // Watchers — reload history when filter changes
  // ──────────────────────────────────────────────

  watch(liveTlShowVerified, () => loadMessages(true, true));
  watch(liveTlShowModerator, () => loadMessages(true, true));
  watch(liveTlShowVtuber, () => loadMessages(true, true));

  // ──────────────────────────────────────────────
  // Methods
  // ──────────────────────────────────────────────

  function parseMessage(msg: ChatMessage): ChatMessage {
    msg.timestamp = +msg.timestamp;
    msg.relativeMs = startTimeMillis.value
      ? msg.timestamp - startTimeMillis.value
      : 0;
    msg.key = msg.name + msg.timestamp + msg.message;

    // Replace custom emoji URLs formatted by the backend.
    if (msg.message.includes("https://") && !msg.parsed) {
      const regex =
        /(\S+)(https:\/\/(yt\d+\.ggpht\.com\/[a-zA-Z0-9_\-=/]+-c-k-nd|www\.youtube\.com\/[a-zA-Z0-9_\-=/]+\.svg))/gi;
      msg.parsed = msg.message
        .replace(/<([^>]*)>/g, "($1)")
        .replace(regex, '<img src="$2" />');
    }

    return msg;
  }

  function loadMessages(
    firstLoad = false,
    loadAll = false,
    tlClient = false,
  ) {
    const { isCustom } = options.video;
    historyLoading.value = true;

    const lastTimestamp =
      !firstLoad && tlHistory.value[0]?.timestamp;

    const query: Record<string, unknown> = {
      lang: liveTlLang.value,
      verified: !tlClient && liveTlShowVerified.value,
      moderator: !tlClient && liveTlShowModerator.value,
      vtuber: !tlClient && liveTlShowVtuber.value,
      limit: loadAll ? 100_000 : limit.value,
      ...(lastTimestamp && { before: lastTimestamp }),
      ...(isCustom && { custom_video_id: options.video.id }),
    };

    api
      .chatHistory(isCustom ? "custom" : options.video.id, query)
      .then(({ data }: { data: ChatMessage[] }) => {
        completed.value = data.length !== limit.value || loadAll;
        if (firstLoad) {
          tlHistory.value = data.map(parseMessage);
        } else {
          tlHistory.value.unshift(...data.map(parseMessage));
        }

        if (tlHistory.value.length) {
          tlHistory.value[0].breakpoint = true;
        }
        curIndex.value = 0;
      })
      .catch((e: unknown) => {
        console.error(e);
      })
      .finally(() => {
        historyLoading.value = false;
      });
  }

  // ──────────────────────────────────────────────
  // Lifecycle
  // ──────────────────────────────────────────────

  onMounted(() => {
    showSubtitle.value = liveTlShowSubtitle.value;
  });

  return {
    // State
    tlHistory,
    expanded,
    historyLoading,
    completed,
    limit,
    curIndex,
    MESSAGE_TYPES,

    // Settings
    lang,
    liveTlStickBottom,
    liveTlLang,
    liveTlFontSize,
    liveTlShowVerified,
    liveTlShowModerator,
    liveTlWindowSize,
    liveTlShowVtuber,
    liveTlShowSubtitle,
    liveTlHideSpoiler,
    blockedNames,
    showSubtitle,
    startTimeMillis,

    // Methods
    loadMessages,
    parseMessage,
  };
}
