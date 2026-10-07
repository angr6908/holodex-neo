"use client";

import {
  type TouchEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

// `useLayoutEffect` is a no-op during SSR, so fall back to `useEffect` there to
// silence the React warning. Client-side it runs synchronously after DOM
// mutations but before paint, which lets portal targets settle before the
// browser shows the page (no "segments appear one frame later" flicker).
export const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const subscribeNever = () => () => {};

// true in the browser, false on the server *and* while hydrating, so a branch on it renders the
// same markup as the server first and switches right after hydration.
export function useIsClient() {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}

// The page hostname ("" on the server and while hydrating), e.g. for Twitch embeds' `parent`.
export function useHostname() {
  return useSyncExternalStore(
    subscribeNever,
    () => window.location.hostname,
    () => "",
  );
}

// The page origin, e.g. "https://holodex.net" ("" on the server and while hydrating).
export function useOrigin() {
  return useSyncExternalStore(
    subscribeNever,
    () => window.location.origin,
    () => "",
  );
}

// Whether a media query matches; false on the server and while hydrating.
export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

// Schedules callbacks for the next macrotask, after the current render and effects settle.
// Callbacks still pending when the component unmounts are dropped.
export function useDeferredCallbacks() {
  const pending = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const timers = pending.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);
  return useCallback((callback: () => void) => {
    const id = setTimeout(() => {
      pending.current.delete(id);
      callback();
    }, 0);
    pending.current.add(id);
  }, []);
}

export function useDomElement<T extends HTMLElement = HTMLElement>(id: string) {
  const [element, setElement] = useState<T | null>(null);

  useIsomorphicLayoutEffect(() => {
    const update = () =>
      setElement((prev) => {
        const next = document.getElementById(id) as T | null;
        return prev === next ? prev : next;
      });
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [id]);

  return element;
}

export function useSwipeTabs(onSwipe: (direction: -1 | 1) => void, threshold = 50) {
  const touchStartX = useRef<number | null>(null);

  return {
    onTouchStart(event: TouchEvent<HTMLElement>) {
      touchStartX.current = event.changedTouches?.[0]?.clientX ?? null;
    },
    onTouchEnd(event: TouchEvent<HTMLElement>) {
      if (touchStartX.current === null) return;
      const endX = event.changedTouches?.[0]?.clientX ?? touchStartX.current;
      const delta = endX - touchStartX.current;
      touchStartX.current = null;
      if (Math.abs(delta) < threshold) return;
      onSwipe(delta > 0 ? -1 : 1);
    },
  };
}
