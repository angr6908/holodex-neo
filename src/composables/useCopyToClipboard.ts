import { ref } from "vue";

/**
 * Composable replacement for the copyToClipboard mixin.
 * Provides a clipboard-write helper with a transient success flag.
 */
export function useCopyToClipboard() {
  const doneCopy = ref(false);
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function copyToClipboard(data: string): Promise<void> {
    await navigator.clipboard.writeText(data);
    doneCopy.value = true;

    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      doneCopy.value = false;
      timer = null;
    }, 2000);
  }

  return { doneCopy, copyToClipboard };
}
