import { defineStore } from "pinia";
import { ref } from "vue";
import api from "@/utils/backend-api";
import { getLiveViewerCount, videoTemporalComparator } from "@/utils/functions";
import { enrichLiveVideosWithTwitchViewerCounts } from "@/utils/twitch";
import { useAppStore } from "./app";

function dedupeVideos(videos: any[]) {
    return Array.from(new Map(videos.map((video) => [video.id, video])).values());
}

function makeLiveCacheKey(orgTargets: string[]) {
    const targets = (orgTargets || []).filter(Boolean);
    return JSON.stringify(targets.length ? [...targets].sort() : ["All Vtubers"]);
}

/** Quick fingerprint: IDs + statuses. If unchanged, skip the reactive update. */
function liveFingerprint(arr: any[]): string {
    return arr.map((v) => `${v.id}:${v.status}:${getLiveViewerCount(v)}`).join(",");
}

export const useHomeStore = defineStore("home", () => {
    // ── State ──
    const live = ref<any[]>([]);
    const isLoading = ref(false);
    const hasError = ref(false);
    const lastLiveUpdate = ref(0);
    const liveCacheKey = ref(JSON.stringify(["Hololive"]));

    // Deduplicate concurrent fetchLive calls — return the same promise if one is in-flight.
    let inflightFetch: Promise<void> | null = null;
    // AbortController for cancelling stale requests on org change
    let currentAbort: AbortController | null = null;

    // ── Actions ──
    function fetchLive({ force = false, minutes = 5 }: { force?: boolean; minutes?: number } = {}) {
        const appStore = useAppStore();
        const selectedOrgs = appStore.selectedHomeOrgs || [];
        const orgTargets = selectedOrgs.length ? selectedOrgs : ["All Vtubers"];
        const nextCacheKey = makeLiveCacheKey(orgTargets);

        if (liveCacheKey.value !== nextCacheKey) {
            live.value = [];
            lastLiveUpdate.value = 0;
            liveCacheKey.value = nextCacheKey;
        }

        if (appStore.visibilityState === "hidden" && !force) {
            return null;
        }
        if (
            hasError.value
            || force
            || !lastLiveUpdate.value
            || Date.now() - lastLiveUpdate.value > minutes * 60 * 1000
        ) {
            // Return existing in-flight promise to avoid duplicate API calls
            if (inflightFetch) return inflightFetch;

            // Cancel any previous in-flight request (e.g. from previous org selection)
            if (currentAbort) {
                currentAbort.abort();
                currentAbort = null;
            }

            const abort = new AbortController();
            currentAbort = abort;

            // Only show loading state when there's no existing data to display.
            // With persisted data, the user sees stale content instantly (stale-while-revalidate).
            const hasStaleData = live.value.length > 0;
            if (!hasStaleData) {
                isLoading.value = true;
            }
            inflightFetch = api
                .allLive(orgTargets, {
                    type: "placeholder,stream",
                    include: "mentions",
                })
                .then(async (res: any) => {
                    // Ignore result if this request was aborted (org changed)
                    if (abort.signal.aborted) return;
                    const merged = dedupeVideos(await enrichLiveVideosWithTwitchViewerCounts(res));
                    merged.sort(videoTemporalComparator);
                    if (liveFingerprint(merged) !== liveFingerprint(live.value)) {
                        live.value = merged;
                    }
                    lastLiveUpdate.value = Date.now();
                    isLoading.value = false;
                    hasError.value = false;
                })
                .catch((e: any) => {
                    if (abort.signal.aborted) return;
                    console.error(e);
                    hasError.value = true;
                    isLoading.value = false;
                })
                .finally(() => {
                    inflightFetch = null;
                    if (currentAbort === abort) currentAbort = null;
                });
            return inflightFetch;
        }
        return null;
    }

    /** Cancel any in-flight fetch (called when org selection changes) */
    function cancelInflight() {
        if (currentAbort) {
            currentAbort.abort();
            currentAbort = null;
        }
        inflightFetch = null;
    }

    function $reset() {
        live.value = [];
        isLoading.value = false;
        hasError.value = false;
        lastLiveUpdate.value = 0;
        liveCacheKey.value = JSON.stringify(["Hololive"]);
    }

    return {
        live,
        isLoading,
        hasError,
        lastLiveUpdate,
        liveCacheKey,
        fetchLive,
        cancelInflight,
        $reset,
    };
}, {
    persist: {
        key: "holodex-v2-home",
        pick: ["live", "lastLiveUpdate", "liveCacheKey"],
    },
});
