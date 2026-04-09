import { defineStore } from "pinia";
import { ref } from "vue";
import api from "@/utils/backend-api";
import { videoTemporalComparator } from "@/utils/functions";
import { useAppStore } from "./app";

function dedupeVideos(videos: any[]) {
    return Array.from(new Map(videos.map((video) => [video.id, video])).values());
}

/** Quick fingerprint: IDs + statuses. If unchanged, skip the reactive update. */
function liveFingerprint(arr: any[]): string {
    return arr.map((v) => `${v.id}:${v.status}`).join(",");
}

export const useHomeStore = defineStore("home", () => {
    // ── State ──
    const live = ref<any[]>([]);
    const isLoading = ref(false);
    const hasError = ref(false);
    const lastLiveUpdate = ref(0);

    // Deduplicate concurrent fetchLive calls — return the same promise if one is in-flight.
    let inflightFetch: Promise<void> | null = null;
    // AbortController for cancelling stale requests on org change
    let currentAbort: AbortController | null = null;

    // ── Actions ──
    function fetchLive({ force = false, minutes = 5 }: { force?: boolean; minutes?: number } = {}) {
        const appStore = useAppStore();

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
            const selectedOrgs = appStore.selectedHomeOrgs || [];
            const orgTargets = selectedOrgs.length ? selectedOrgs : ["All Vtubers"];
            inflightFetch = api
                .allLive(orgTargets, {
                    type: "placeholder,stream",
                    include: "mentions",
                })
                .then((res: any) => {
                    // Ignore result if this request was aborted (org changed)
                    if (abort.signal.aborted) return;
                    const merged = dedupeVideos(res);
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
    }

    return {
        live,
        isLoading,
        hasError,
        lastLiveUpdate,
        fetchLive,
        cancelInflight,
        $reset,
    };
}, {
    persist: {
        key: "holodex-v2-home",
        pick: ["live", "lastLiveUpdate"],
    },
});
