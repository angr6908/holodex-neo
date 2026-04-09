import { defineStore } from "pinia";
import { ref, computed } from "vue";
import api from "@/utils/backend-api";
import { sendFavoritesToExtension, sendTokenToExtension } from "@/utils/messaging";
import debounce from "lodash-es/debounce";
import fdequal from "fast-deep-equal";
import { videoTemporalComparator } from "@/utils/functions";
import { useAppStore } from "./app";

export const useFavoritesStore = defineStore("favorites", () => {
    // ── State ──
    const live = ref<any[]>([]);
    const isLoading = ref(false);
    const hasError = ref(false);
    const stagedFavorites = ref<Record<string, string>>({});
    const lastLiveUpdate = ref(0);
    const favorites = ref<any[]>([]);

    // ── Getters ──
    const isFavorited = computed(() => (channelId: string) =>
        stagedFavorites.value[channelId] === "add"
        || (favorites.value.find((f) => f.id === channelId) && stagedFavorites.value[channelId] !== "remove"),
    );

    const favoriteChannelIDs = computed(() => new Set(favorites.value?.map((f) => f.id) || []));

    // ── Actions ──
    function fetchFavorites() {
        const appStore = useAppStore();
        if (!(appStore.userdata && appStore.userdata.jwt)) {
            return null;
        }
        return api
            .favorites(appStore.userdata.jwt)
            .then((res: any) => {
                if (!fdequal(res.data, favorites.value)) {
                    favorites.value = res.data;
                }
            })
            .catch((e: any) => {
                console.error(e);
                appStore.loginVerify();
            });
    }

    // Deduplicate concurrent fetchLive calls — return the same promise if one is in-flight.
    let inflightFetch: Promise<void> | null = null;

    function fetchLive({ force = false, minutes = 2 }: { force?: boolean; minutes?: number } = {}) {
        const appStore = useAppStore();
        if (!(appStore.userdata && appStore.userdata.jwt) || (appStore.visibilityState === "hidden" && !force)) {
            return null;
        }
        if (
            hasError.value
            || force
            || !lastLiveUpdate.value
            || Date.now() - lastLiveUpdate.value > minutes * 60 * 1000
        ) {
            if (inflightFetch) return inflightFetch;

            if (live.value.length === 0) {
                isLoading.value = true;
            }
            hasError.value = false;
            inflightFetch = api
                .favoritesLive({ includePlaceholder: true }, appStore.userdata.jwt)
                .then((res: any) => {
                    res.sort(videoTemporalComparator);
                    // Only update when data changed to avoid re-rendering with stale persisted data
                    const fp = (arr: any[]) => arr.map((v: any) => `${v.id}:${v.status}`).join(",");
                    if (fp(res) !== fp(live.value)) {
                        live.value = res;
                    }
                    lastLiveUpdate.value = Date.now();
                    isLoading.value = false;
                    hasError.value = false;
                })
                .catch((e: any) => {
                    appStore.loginCheck();
                    console.error(e);
                    hasError.value = true;
                    isLoading.value = false;
                })
                .finally(() => {
                    inflightFetch = null;
                });
            return inflightFetch;
        }
        hasError.value = false;
        isLoading.value = false;
        return null;
    }

    const updateFavorites = debounce(() => {
        const appStore = useAppStore();
        const operations = Object.keys(stagedFavorites.value).map((key) => ({
            op: stagedFavorites.value[key],
            channel_id: key,
        }));

        if (operations.length === 0) return;

        api.patchFavorites(appStore.userdata.jwt, operations)
            .catch((e: any) => {
                console.error(e);
                appStore.loginVerify();
            })
            .then((res: any) => {
                if (res.status === 200) {
                    favorites.value = res.data;
                    fetchLive({ force: true });
                    sendFavoritesToExtension(res.data);
                } else {
                    throw new Error("Error while adding favorite");
                }
            })
            .finally(() => {
                stagedFavorites.value = {};
            });
    }, 2000);

    async function resetFavorites() {
        const appStore = useAppStore();
        // Reset non-persisted state
        live.value = [];
        isLoading.value = true;
        hasError.value = false;
        stagedFavorites.value = {};
        lastLiveUpdate.value = 0;

        if (appStore.userdata && appStore.userdata.jwt) {
            await fetchFavorites();
            sendTokenToExtension(appStore.userdata.jwt);
        }
        if (appStore.userdata && appStore.userdata.jwt) {
            await fetchLive({ force: true });
        } else {
            favorites.value = [];
            sendTokenToExtension(null);
        }
    }

    function toggleFavorite(channelId: string) {
        if (stagedFavorites.value[channelId]) {
            delete stagedFavorites.value[channelId];
            return;
        }
        if (favorites.value.find((f) => f.id === channelId)) {
            stagedFavorites.value[channelId] = "remove";
        } else {
            stagedFavorites.value[channelId] = "add";
        }
    }

    function setFavorites(favs: any[]) {
        favorites.value = favs;
    }

    function setLive(liveData: any[]) {
        live.value = liveData;
        lastLiveUpdate.value = Date.now();
    }

    function $reset() {
        live.value = [];
        isLoading.value = true;
        hasError.value = false;
        stagedFavorites.value = {};
        lastLiveUpdate.value = 0;
    }

    return {
        live,
        isLoading,
        hasError,
        stagedFavorites,
        lastLiveUpdate,
        favorites,
        isFavorited,
        favoriteChannelIDs,
        fetchFavorites,
        fetchLive,
        updateFavorites,
        resetFavorites,
        toggleFavorite,
        setFavorites,
        setLive,
        $reset,
    };
}, {
    persist: {
        key: "holodex-v2-favorites",
        pick: ["favorites", "live", "lastLiveUpdate"],
    },
});
