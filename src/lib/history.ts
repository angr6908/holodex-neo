"use client";

type HistoryDb = {
  get: (key: string) => Promise<unknown>;
  put: (key: string, value: unknown) => Promise<boolean>;
  clear: () => Promise<boolean>;
};

let dbPromise: Promise<HistoryDb | null> | null = null;

const getDb = () => {
  if (typeof window === "undefined" || !window.indexedDB) return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = import("kv-idb")
      .then((module: any) => (module.default || module)("watch-history") as Promise<HistoryDb>)
      .catch(() => null);
  }
  return dbPromise;
};

export async function hasWatched(videoId: string) {
  const db = await getDb();
  if (!db || !videoId) return false;
  try { return !!(await db.get(videoId)); } catch { return false; }
}

export function addWatchedVideo(video: { id?: string | null }) {
  return getDb().then((db) => {
    if (db && video?.id) db.put(video.id, 1).catch(() => {});
  });
}
