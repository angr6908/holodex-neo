import { defineStore } from "pinia";
import { ref, computed } from "vue";
import backendApi from "@/utils/backend-api";
import type { Playlist } from "@/utils/types";
import { useAppStore } from "./app";

export const usePlaylistStore = defineStore("playlist", () => {
    // ── State ──
    const active = ref<{
        id?: number | string;
        user_id?: number | string;
        name: string;
        videos: any[];
        updated_at?: string;
    }>({
        id: undefined,
        user_id: undefined,
        name: "Unnamed Playlist",
        videos: [],
        updated_at: undefined,
    });
    const isSaved = ref(false);

    // ── Getters ──
    const videoIds = computed(() => new Set(active.value.videos.map((x) => x.id)));
    const contains = computed(() => (id: string) => videoIds.value.has(id));

    // ── Actions (formerly mutations) ──
    function saved() {
        isSaved.value = true;
    }

    function modified() {
        isSaved.value = false;
    }

    function setPlaylist(playlist: Playlist) {
        active.value = { videos: [], ...playlist } as any;
        isSaved.value = false;
    }

    function addVideo(video: any) {
        if (active.value.videos.findIndex((x) => x.id === video.id) >= 0) return;
        active.value.videos.push(video);
        isSaved.value = false;
    }

    function addVideos(videos: any[]) {
        const ids = new Set(active.value.videos.map((x) => x.id));
        videos.forEach((video) => {
            if (ids.has(video.id)) return;
            ids.add(video.id);
            active.value.videos.push(video);
            isSaved.value = false;
        });
    }

    function reorder({ from, to }: { from: number; to: number }) {
        active.value.videos = active.value.videos.reduce((prev: any[], current, idx, self) => {
            if (from === to) {
                prev.push(current);
            }
            if (idx === from) {
                return prev;
            }
            if (from < to) {
                prev.push(current);
            }
            if (idx === to) {
                prev.push(self[from]);
            }
            if (from > to) {
                prev.push(current);
            }
            return prev;
        }, []);
        isSaved.value = false;
    }

    function removeVideoByIndex(idx: number) {
        active.value.videos = active.value.videos.filter((_, i) => i !== idx);
    }

    function removeVideoByID(videoId: string) {
        active.value.videos = active.value.videos.filter((x) => x.id !== videoId);
        isSaved.value = false;
    }

    function resetPlaylist() {
        active.value = {
            id: undefined,
            user_id: undefined,
            name: "Unnamed Playlist",
            videos: [],
        };
    }

    function $reset() {
        active.value = {
            id: undefined,
            user_id: undefined,
            name: "Unnamed Playlist",
            videos: [],
            updated_at: undefined,
        };
        isSaved.value = false;
    }

    // ── Async Actions ──
    async function saveActivePlaylist() {
        const appStore = useAppStore();
        const playlist = { ...active.value };
        if (!active.value.user_id || !active.value.id) {
            playlist.user_id = appStore.userdata.user.id;
        } else if (active.value.user_id !== appStore.userdata.user.id) {
            delete (playlist as any).id;
            playlist.user_id = appStore.userdata.user.id;
        }
        setPlaylist(playlist as Playlist);

        if (!active.value.id) {
            const res = await backendApi.savePlaylist(
                { ...active.value, videos: [], video_ids: playlist.videos.map((x) => x.id) } as any,
                appStore.userdata.jwt,
            );
            const returnedId = res.data;
            if (returnedId) {
                setPlaylist({ ...playlist, id: returnedId } as Playlist);
                saved();
            }
        } else {
            const res = await backendApi.savePlaylist(
                { ...active.value, videos: [], video_ids: playlist.videos.map((x) => x.id) } as any,
                appStore.userdata.jwt,
            );
            if (res.data) {
                saved();
            }
        }
    }

    async function setActivePlaylistByID(playlistId: number | string) {
        const res = await backendApi.getPlaylist(playlistId);
        const pl = res.data;
        setPlaylist(pl);
        saved();
    }

    async function deleteActivePlaylist() {
        const appStore = useAppStore();
        if (active.value.id && appStore.userdata.jwt && +active.value.user_id! === +appStore.userdata.user.id) {
            await backendApi.deletePlaylist(active.value.id, appStore.userdata.jwt);
        }
        resetPlaylist();
    }

    return {
        active,
        isSaved,
        videoIds,
        contains,
        saved,
        modified,
        setPlaylist,
        addVideo,
        addVideos,
        reorder,
        removeVideoByIndex,
        removeVideoByID,
        resetPlaylist,
        $reset,
        saveActivePlaylist,
        setActivePlaylistByID,
        deleteActivePlaylist,
    };
}, {
    persist: {
        key: "holodex-v2-playlist",
        pick: ["active", "isSaved"],
    },
});
