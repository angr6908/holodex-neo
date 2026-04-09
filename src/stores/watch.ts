import { defineStore } from "pinia";
import { ref } from "vue";
import api from "@/utils/backend-api";
import { useSettingsStore } from "./settings";

export const useWatchStore = defineStore("watch", () => {
    // ── State ──
    const id = ref<string | null>(null);
    const video = ref<Record<string, any>>({
        channel: {},
        id: null,
        title: "Loading...",
        description: "",
    });
    const isLoading = ref(true);
    const hasError = ref(false);
    const showTL = ref(false);
    const showLiveChat = ref(true);
    const theaterMode = ref(false);

    // ── Actions ──
    function fetchVideo() {
        if (!id.value) {
            hasError.value = true;
            isLoading.value = false;
            return;
        }

        isLoading.value = true;
        const settingsStore = useSettingsStore();
        return api
            .video(id.value, settingsStore.clipLangs.join(","), 1)
            .then(({ data }: any) => {
                video.value = data;
                isLoading.value = false;
            })
            .catch((e: any) => {
                console.error(e);
                hasError.value = true;
                isLoading.value = false;
            });
    }

    function setId(newId: string | null) {
        id.value = newId;
    }

    function setVideo(v: Record<string, any>) {
        video.value = v;
    }

    function setShowTL(val: boolean) {
        showTL.value = val;
    }

    function setShowLiveChat(val: boolean) {
        showLiveChat.value = val;
    }

    function setTheaterMode(val: boolean) {
        theaterMode.value = val;
    }

    function $reset() {
        id.value = null;
        video.value = {
            channel: {},
            id: null,
            title: "Loading...",
            description: "",
        };
        isLoading.value = true;
        hasError.value = false;
        showTL.value = false;
        showLiveChat.value = true;
        theaterMode.value = false;
    }

    return {
        id,
        video,
        isLoading,
        hasError,
        showTL,
        showLiveChat,
        theaterMode,
        fetchVideo,
        setId,
        setVideo,
        setShowTL,
        setShowLiveChat,
        setTheaterMode,
        $reset,
    };
}, {
    persist: {
        key: "holodex-v2-watch",
        pick: ["showTL", "showLiveChat", "theaterMode"],
    },
});
