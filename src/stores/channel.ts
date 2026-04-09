import { defineStore } from "pinia";
import { ref } from "vue";
import api from "@/utils/backend-api";

export const useChannelStore = defineStore("channel", () => {
    // ── State ──
    const id = ref<string | null>(null);
    const channel = ref<Record<string, any>>({});
    const isLoading = ref(true);
    const hasError = ref(false);

    // ── Actions ──
    function fetchChannel() {
        if (!id.value) {
            hasError.value = true;
            isLoading.value = false;
            return;
        }

        isLoading.value = true;
        return api
            .channel(id.value)
            .then(({ data }: any) => {
                channel.value = data;
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

    function setChannel(ch: Record<string, any>) {
        channel.value = ch;
    }

    function $reset() {
        id.value = null;
        channel.value = {};
        isLoading.value = true;
        hasError.value = false;
    }

    return {
        id,
        channel,
        isLoading,
        hasError,
        fetchChannel,
        setId,
        setChannel,
        $reset,
    };
});
