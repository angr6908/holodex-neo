import { defineStore } from "pinia";
import { ref } from "vue";

export const useLibraryStore = defineStore("library", () => {
    const savedVideos = ref<Record<string, any>>({});

    function addSavedVideo(video: { id: string; added_at?: string }) {
        if (!video?.id) return;
        savedVideos.value[video.id] = {
            ...video,
            added_at: video.added_at || new Date().toISOString(),
        };
    }

    function removeSavedVideo(id: string) {
        if (!id) return;
        delete savedVideos.value[id];
    }

    function resetState() {
        savedVideos.value = {};
    }

    return {
        savedVideos,
        addSavedVideo,
        removeSavedVideo,
        resetState,
    };
}, {
    persist: {
        key: "holodex-v2-library",
        pick: ["savedVideos"],
    },
});
