"use client";

const decoded = new Set<string>();
const inflight = new Map<string, Promise<void>>();
const retained = new Map<string, HTMLImageElement>();
const MAX_RETAINED = 500;

function remember(url: string, img: HTMLImageElement) {
  retained.delete(url);
  retained.set(url, img);
  while (retained.size > MAX_RETAINED) {
    const first = retained.keys().next().value;
    if (!first) break;
    retained.delete(first);
  }
}

// `responsive` mirrors an <img>'s srcset/sizes, so the preload fetches the same candidate the
// element picks rather than its larger fallback `src`.
export function preloadImage(
  src?: string | null,
  responsive?: { srcSet: string; sizes: string } | null,
) {
  if (!src || typeof window === "undefined") return Promise.resolve();
  const key = responsive?.srcSet ? `${src} ${responsive.srcSet} ${responsive.sizes}` : src;
  if (decoded.has(key)) return Promise.resolve();
  const pending = inflight.get(key);
  if (pending) return pending;
  const img = new Image();
  img.loading = "eager";
  img.decoding = "sync";
  // Default priority: a list preloads every mounted card's image, and the on-screen <img>s
  // (which the browser raises to high priority) must not queue behind off-screen ones.
  if (responsive?.srcSet) {
    img.sizes = responsive.sizes;
    img.srcset = responsive.srcSet;
  }
  let resolvePromise: () => void = () => {};
  let settled = false;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });
  inflight.set(key, promise);
  const done = () => {
    if (settled) return;
    settled = true;
    decoded.add(key);
    remember(key, img);
    inflight.delete(key);
    resolvePromise();
  };
  img.onload = done;
  img.onerror = done;
  img.src = src;
  if (img.complete) queueMicrotask(done);
  else void img.decode?.().then(done, () => {});
  return promise;
}
