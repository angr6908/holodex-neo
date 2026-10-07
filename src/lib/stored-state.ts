"use client";

import { type SetStateAction, useCallback, useSyncExternalStore } from "react";
import { readJSON, writeJSON } from "@/lib/browser";

// localStorage-backed state. Reads go through useSyncExternalStore, so the server render and
// hydration use `fallback` and the stored value shows right after, without a load effect.
const listeners = new Map<string, Set<() => void>>();
const snapshots = new Map<string, { raw: string | null; value: unknown }>();

function readRaw(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readSnapshot<T>(key: string, fallback: T, normalize?: (value: T) => T): T {
  const raw = readRaw(key);
  const cached = snapshots.get(key);
  if (cached && cached.raw === raw) return cached.value as T;
  const parsed = readJSON(key, fallback);
  const value = normalize ? normalize(parsed) : parsed;
  snapshots.set(key, { raw, value });
  return value;
}

/**
 * Like useState, but persisted to localStorage under `key`. `fallback` and `normalize` should be
 * stable (module-level) values.
 */
export function useStoredState<T>(key: string, fallback: T, normalize?: (value: T) => T) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      let keyListeners = listeners.get(key);
      if (!keyListeners) {
        keyListeners = new Set();
        listeners.set(key, keyListeners);
      }
      keyListeners.add(onChange);
      return () => {
        keyListeners.delete(onChange);
      };
    },
    [key],
  );
  const value = useSyncExternalStore(
    subscribe,
    () => readSnapshot(key, fallback, normalize),
    () => fallback,
  );
  const setValue = useCallback(
    (next: SetStateAction<T>) => {
      const prev = readSnapshot(key, fallback, normalize);
      const resolved = typeof next === "function" ? (next as (prev: T) => T)(prev) : next;
      if (Object.is(resolved, prev)) return;
      writeJSON(key, resolved);
      // Cache the new value even if storage is unavailable, so the UI still updates.
      snapshots.set(key, { raw: readRaw(key), value: resolved });
      listeners.get(key)?.forEach((listener) => {
        listener();
      });
    },
    [key, fallback, normalize],
  );
  return [value, setValue] as const;
}
