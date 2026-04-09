import { defineStore } from "pinia";
import { ref, computed } from "vue";
import kvidb from "kv-idb";

const db = kvidb("watch-history");

export const useHistoryStore = defineStore("history", () => {
    // ── State ──
    const lastCheck = ref(Date.now());

    // ── Getters ──
    // Original getter returns a function that returns a Promise
    const hasWatched = computed(() =>
        lastCheck.value
        && ((videoId: string) => new Promise((res, rej) => {
            db.get(videoId, (e: any, x: any) => {
                if (e) res(0);
                if (x) res(x);
                rej(new Error("weird"));
            });
        })),
    );

    // ── Actions ──
    function addWatchedVideo(video: { id: string }) {
        db.put(video.id, 1, (e: any, x: any) => {
            if (x) lastCheck.value = Date.now();
        });
    }

    function resetWatchHistory() {
        db.clear((e: any, x: any) => {
            if (x) lastCheck.value = Date.now();
        });
    }

    function $reset() {
        lastCheck.value = Date.now();
    }

    return {
        lastCheck,
        hasWatched,
        addWatchedVideo,
        resetWatchHistory,
        $reset,
    };
}, {
    persist: {
        key: "holodex-v2-history",
        pick: ["lastCheck"],
    },
});
