import { watch, onMounted, onUpdated, onActivated, type Ref } from "vue";

type TitleSource = Ref<string> | (() => string);

/**
 * Composable replacement for the global metaInfo mixin.
 * Reactively sets `document.title` from a ref or getter function.
 * Updates on mount, update, and keep-alive activation — matching
 * the original behaviour of the global mixin hooks.
 */
export function useMetaTitle(title: TitleSource) {
  function applyTitle() {
    const value = typeof title === "function" ? title() : title.value;
    if (typeof value === "string" && value.trim()) {
      document.title = value;
    }
  }

  // Reactive watch covers most cases.
  watch(
    typeof title === "function" ? title : () => title.value,
    applyTitle,
    { immediate: true },
  );

  // Mirror the original mixin which called on mounted, updated, and activated.
  onMounted(applyTitle);
  onUpdated(applyTitle);
  onActivated(applyTitle);
}
