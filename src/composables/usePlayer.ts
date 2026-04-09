import { ref, onBeforeUnmount } from "vue";

export interface PlayerProps {
  height?: number | string;
  width?: number | string;
  mute?: boolean;
  /** Interval in ms to poll player state. Default 500. */
  refreshRate?: number;
  /** If true, the composable will not start the polling interval automatically. */
  manualUpdate?: boolean;
}

export interface PlayerEmit {
  (event: "ready", player: unknown): void;
  (event: "error", error: unknown): void;
  (event: "currentTime", value: number): void;
  (event: "playbackRate", value: number): void;
  (event: "mute", value: boolean): void;
  (event: "volume", value: number): void;
}

export interface PlayerMethods {
  getCurrentTime: () => number | Promise<number>;
  getPlaybackRate: () => number | Promise<number>;
  getVolume: () => number | Promise<number>;
  isMuted: () => boolean | Promise<boolean>;
  setPlaying: (playing: boolean) => void;
  setMute: (muted: boolean) => void;
}

/**
 * Composable replacement for PlayerMixin.
 * Provides player lifecycle helpers and an interval-based listener
 * that emits player state changes at a configurable refresh rate.
 *
 * The consumer should provide concrete implementations of the player
 * methods via `setMethods()` once the actual player instance is available.
 *
 * @param props - Reactive player props (height, width, mute, etc.).
 * @param emit  - The component's emit function.
 * @param activeListeners - Set of event names the parent is listening for.
 */
export function usePlayer(
  props: PlayerProps,
  emit: PlayerEmit,
  activeListeners: Set<string> = new Set(),
) {
  const player = ref<unknown>(null);
  const retryForMengen = ref(false);
  let updateTimer: ReturnType<typeof setInterval> | null = null;

  // Methods to be provided by the concrete player implementation.
  const methods: PlayerMethods = {
    getCurrentTime: () => 0,
    getPlaybackRate: () => 1,
    getVolume: () => 100,
    isMuted: () => false,
    setPlaying: () => {},
    setMute: () => {},
  };

  /** Override default no-op player methods with real implementations. */
  function setMethods(impl: Partial<PlayerMethods>) {
    Object.assign(methods, impl);
  }

  async function updateListeners() {
    if (activeListeners.has("mute")) {
      emit("mute", await methods.isMuted());
    }
    if (activeListeners.has("playbackRate")) {
      emit("playbackRate", await methods.getPlaybackRate());
    }
    if (activeListeners.has("currentTime")) {
      emit("currentTime", await methods.getCurrentTime());
    }
    if (activeListeners.has("volume")) {
      emit("volume", await methods.getVolume());
    }
  }

  function initListeners() {
    if (props.manualUpdate) return;
    if (
      activeListeners.has("currentTime")
      || activeListeners.has("playbackRate")
      || activeListeners.has("mute")
      || activeListeners.has("volume")
    ) {
      updateTimer = setInterval(updateListeners, props.refreshRate ?? 500);
    }
  }

  function playerReady(playerInstance: unknown) {
    player.value = playerInstance;
    methods.setMute(props.mute ?? false);
    initListeners();
    emit("ready", playerInstance);
    retryForMengen.value = false;
  }

  function playerError(e: any) {
    console.error("[PLAYER ERROR]", e);
    // Mengen retry: error code 150
    if (!retryForMengen.value && e.data === "150") {
      e.target?.loadVideoById?.(e.target?.getVideoData?.().video_id);
      retryForMengen.value = true;
    } else {
      emit("error", e);
    }
  }

  onBeforeUnmount(() => {
    if (updateTimer) {
      clearInterval(updateTimer);
      updateTimer = null;
    }
  });

  return {
    player,
    retryForMengen,

    // Lifecycle
    playerReady,
    playerError,
    initListeners,
    updateListeners,

    // Allow the concrete player to plug in its methods
    setMethods,

    // Expose delegated methods for direct use in templates
    getCurrentTime: () => methods.getCurrentTime(),
    getPlaybackRate: () => methods.getPlaybackRate(),
    getVolume: () => methods.getVolume(),
    isMuted: () => methods.isMuted(),
    setPlaying: (playing: boolean) => methods.setPlaying(playing),
    setMute: (muted: boolean) => methods.setMute(muted),
  };
}
