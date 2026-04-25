"use client";

type HistoryDb = {
  get: (key: string) => Promise<unknown>;
  put: (key: string, value: unknown) => Promise<boolean>;
  clear: () => Promise<boolean>;
};

let dbPromise: Promise<HistoryDb | null> | null = null;

function getDb() {
  if (typeof window === "undefined" || !window.indexedDB) return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = import("kv-idb")
      .then((module: any) => {
        const createDb = module.default || module;
        return createDb("watch-history") as Promise<HistoryDb>;
      })
      .catch(() => {
        return null;
      });
  }
  return dbPromise;
}

export async function hasWatched(videoId: string) {
  const db = await getDb();
  if (!db || !videoId) return false;
  try {
    return !!(await db.get(videoId));
  } catch {
    return false;
  }
}

export async function addWatchedVideo(video: { id?: string | null }) {
  const db = await getDb();
  if (!db || !video?.id) return;
  try { await db.put(video.id, 1); } catch {}
}
