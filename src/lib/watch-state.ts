export type WatchControlsState = {
  showTL: boolean;
  showLiveChat: boolean;
  theaterMode: boolean;
};

const WATCH_STATE_KEY = "holodex-v2-watch";
export const defaultWatchControlsState: WatchControlsState = {
  showTL: false,
  showLiveChat: true,
  theaterMode: false,
};

export function readWatchControlsState(): WatchControlsState {
  if (typeof window === "undefined") return defaultWatchControlsState;
  try {
    const raw = localStorage.getItem(WATCH_STATE_KEY);
    if (!raw) return defaultWatchControlsState;
    const parsed = JSON.parse(raw) || {};
    return {
      showTL: parsed.showTL ?? defaultWatchControlsState.showTL,
      showLiveChat: parsed.showLiveChat ?? defaultWatchControlsState.showLiveChat,
      theaterMode: parsed.theaterMode ?? defaultWatchControlsState.theaterMode,
    };
  } catch {
    return defaultWatchControlsState;
  }
}

export function writeWatchControlsState(state: WatchControlsState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(WATCH_STATE_KEY, JSON.stringify(state));
  } catch {}
}
