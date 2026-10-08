// Images on screen, or about to be (lazy loading starts them a little below the fold).
const onScreen = (img: HTMLImageElement) => {
  const r = img.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight * 1.25 && r.width > 0;
};

// Resolves once the images on screen have loaded or failed, or after `maxMs`.
function onScreenImagesLoaded(maxMs: number) {
  const pending = Array.from(document.images).filter((img) => !img.complete && onScreen(img));
  if (!pending.length) return Promise.resolve();
  const loaded = pending.map(
    (img) =>
      new Promise<void>((resolve) => {
        img.addEventListener("load", () => resolve(), { once: true });
        img.addEventListener("error", () => resolve(), { once: true });
      }),
  );
  return Promise.race([
    Promise.all(loaded),
    new Promise<void>((resolve) => setTimeout(resolve, maxMs)),
  ]);
}

// Runs `callback` once the page has settled: after `delayMs`, once the images on screen have
// loaded, in the browser's next idle period. Background warm-ups (other tabs' lists, the watch
// page, lazily loaded UI) use it so they start as soon as what is on screen has finished
// loading, and never compete with it. Returns a cancel function.
export function runWhenSettled(callback: () => void, delayMs = 300) {
  let cancelled = false;
  let idle: number | undefined;
  const timer = setTimeout(() => {
    void onScreenImagesLoaded(5000).then(() => {
      if (cancelled) return;
      if ("requestIdleCallback" in window) idle = requestIdleCallback(callback, { timeout: 1000 });
      else callback();
    });
  }, delayMs);
  return () => {
    cancelled = true;
    clearTimeout(timer);
    if (idle !== undefined) cancelIdleCallback(idle);
  };
}
