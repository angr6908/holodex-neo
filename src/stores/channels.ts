import { defineStore } from "pinia";
import { ref } from "vue";

export const useChannelsStore = defineStore("channels", () => {
    // ── State ──
    const category = ref(0);
    const sort = ref<Record<number, string>>({
        0: "subscribers",
        1: "video_count",
        2: "subscribers",
    });
    const cardView = ref<Record<number, boolean>>({
        0: false,
        1: false,
        2: false,
    });
    const isLoading = ref(true);
    const hasError = ref(false);
    const currentOffset = ref(0);

    // ── Actions ──
    function setCategory(cat: number) {
        category.value = cat;
    }

    function setSort(val: string) {
        sort.value[category.value] = val;
    }

    function setCardView(val: boolean) {
        cardView.value[category.value] = val;
    }

    function $reset() {
        isLoading.value = true;
        hasError.value = false;
        currentOffset.value = 0;
    }

    return {
        category,
        sort,
        cardView,
        isLoading,
        hasError,
        currentOffset,
        setCategory,
        setSort,
        setCardView,
        $reset,
    };
}, {
    persist: {
        key: "holodex-v2-channels",
        pick: ["category", "sort", "cardView"],
    },
});
