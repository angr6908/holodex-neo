import {
  ref, onActivated, onDeactivated, watch,
} from "vue";
import { useAppStore } from "@/stores/app";

/**
 * Composable replacement for the reloadable mixin.
 * Listens for a reload trigger from the app store
 * and throttles reload requests to at most once per 30 seconds.
 *
 * @param reloadFn - Callback invoked when a reload is triggered.
 * @param options.throttleMs - Minimum interval between reloads (default 30000).
 */
export function useReloadable(
  reloadFn: () => void,
  options: { throttleMs?: number } = {},
) {
  const { throttleMs = 30_000 } = options;
  const isActive = ref(true);
  let lastFetch = 0;

  onActivated(() => {
    isActive.value = true;
  });

  onDeactivated(() => {
    isActive.value = false;
  });

  const appStore = useAppStore();

  watch(
    () => appStore.reloadTrigger,
    (trigger) => {
      if (!isActive.value || !trigger) return;

      const now = Date.now();

      // On desktop, skip the very first trigger and just record the timestamp.
      if (!lastFetch && !appStore.isMobile) {
        lastFetch = now;
        return;
      }

      // Throttle: only reload if enough time has elapsed since the last fetch,
      // unless it was a manual (non-scrollBehavior) trigger.
      if (
        trigger.source === "scrollBehavior"
        && now - lastFetch < throttleMs
      ) {
        return;
      }

      lastFetch = now;
      reloadFn();
    },
  );

  return { isActive };
}
