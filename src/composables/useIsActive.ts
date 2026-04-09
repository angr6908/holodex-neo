import { ref, onActivated, onDeactivated } from "vue";

/**
 * Composable replacement for the isActive mixin.
 * Tracks whether the component is currently active via
 * the keep-alive activated / deactivated hooks.
 */
export function useIsActive() {
  const isActive = ref(true);

  onActivated(() => {
    isActive.value = true;
  });

  onDeactivated(() => {
    isActive.value = false;
  });

  return { isActive };
}
