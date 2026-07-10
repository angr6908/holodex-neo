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

export function preloadImage(url?: string | null) {
  if (!url || typeof window === "undefined") return Promise.resolve();
  if (decoded.has(url)) return Promise.resolve();
  const pending = inflight.get(url);
  if (pending) return pending;
  const img = new Image();
  img.loading = "eager";
  img.decoding = "sync";
  img.fetchPriority = "high";
  let resolvePromise: () => void = () => {};
  let settled = false;
  const promise = new Promise<void>((resolve) => { resolvePromise = resolve; });
  inflight.set(url, promise);
  const done = () => {
    if (settled) return;
    settled = true;
    decoded.add(url);
    remember(url, img);
    inflight.delete(url);
    resolvePromise();
  };
  img.onload = done;
  img.onerror = done;
  img.src = url;
  if (img.complete) queueMicrotask(done);
  else void img.decode?.().then(done, () => {});
  return promise;
}
