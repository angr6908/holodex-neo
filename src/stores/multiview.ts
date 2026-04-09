import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { LayoutItem } from "@/external/vue-grid-layout/src/helpers/utils";
import { getFirstCollision } from "@/external/vue-grid-layout/src/helpers/utils";
import {
    getDesktopDefaults, desktopPresets, mobilePresets, decodeLayout,
} from "@/utils/mv-utils";
import type { Content } from "@/utils/mv-utils";
import api from "@/utils/backend-api";
import debounce from "lodash-es/debounce";
import axios from "axios";
import { CHANNEL_URL_REGEX } from "@/utils/consts";
import { checkIOS } from "@/utils/functions";

const isAppleDevice = navigator?.platform ? checkIOS() : false;

const missingVideoDataFilter = (x: Content) => x.type === "video" && x.video.type !== "twitch" && x.video.id === x.video.channel?.name && !(x?.video?.noData);
const videoIsLiveFilter = (x: Content) => x?.video?.status === "live" || x?.video?.status === "upcoming";
const MULTIVIEW_VIDEO_BATCH_SIZE = 25;
const MULTIVIEW_FETCH_DEBOUNCE_MS = 140;

let queuedFetchOptions: { refreshLive?: boolean } = {};
let pendingFetchTimer: ReturnType<typeof setTimeout> | null = null;
let pendingFetchResolvers: Array<() => void> = [];
let pendingFetchRejectors: Array<(error: unknown) => void> = [];

function chunkIds(ids: string[], chunkSize: number) {
    const chunks: string[][] = [];
    for (let index = 0; index < ids.length; index += chunkSize) {
        chunks.push(ids.slice(index, index + chunkSize));
    }
    return chunks;
}

export const useMultiviewStore = defineStore("multiview", () => {
    // ── State ──
    const layout = ref<LayoutItem[]>([]);
    const index = ref(1);
    const layoutContent = ref<Record<string | number, Content>>({});
    const presetLayout = ref<any[]>([]);
    const autoLayout = ref(getDesktopDefaults());
    const ytUrlHistory = ref<string[]>([]);
    const twUrlHistory = ref<string[]>([]);
    const muteOthers = ref(isAppleDevice);
    const syncOffsets = ref<Record<string, any>>({});

    // ── Getters ──
    const nonChatCellCount = computed(() =>
        layout.value.reduce((a, c) => a + ((!layoutContent.value[c.i] || layoutContent.value[c.i]?.type === "video") ? 1 : 0), 0),
    );

    const activeVideos = computed(() =>
        layout.value
            .filter((item) => layoutContent.value[item.i] && layoutContent.value[item.i].type === "video")
            .map((item) => layoutContent.value[item.i].video),
    );

    const decodedCustomPresets = computed(() =>
        presetLayout.value.map((preset) => ({
            ...preset,
            ...decodeLayout(preset.layout),
        })),
    );

    const decodedDesktopPresets = computed(() =>
        desktopPresets.map((preset) => ({
            ...preset,
            ...decodeLayout(preset.layout),
        })),
    );

    const decodedMobilePresets = computed(() =>
        mobilePresets.map((preset) => ({
            ...preset,
            ...decodeLayout(preset.layout),
        })),
    );

    const desktopGroups = computed(() => {
        const groups: any[][] = [];
        const seen = new Set<string>();
        const customId = new Set(decodedCustomPresets.value.map((p: any) => p.id));
        decodedCustomPresets.value.concat(decodedDesktopPresets.value).forEach((preset: any) => {
            if (seen.has(preset.id)) return;
            seen.add(preset.id);
            if (customId.has(preset.id)) preset.custom = true;
            if (!groups[preset.videoCellCount]) groups[preset.videoCellCount] = [];
            groups[preset.videoCellCount].push(preset);
        });
        return groups;
    });

    // ── Internal helpers ──
    async function runFetchVideoData(options: { refreshLive?: boolean } | undefined) {
        const videoIds = new Set<string>(
            Object.values<Content>(layoutContent.value)
                .filter((x) => missingVideoDataFilter(x) || (options?.refreshLive && videoIsLiveFilter(x)))
                .map((x) => x.video.id),
        );

        if (!videoIds.size) return;

        const backendResponses = await Promise.allSettled(
            chunkIds([...videoIds], MULTIVIEW_VIDEO_BATCH_SIZE).map((ids) => api.videos({
                include: "live_info",
                id: ids.join(","),
            })),
        );

        const backendVideos = backendResponses.flatMap((result) => {
            if (result.status !== "fulfilled") {
                console.error(result.reason);
                return [];
            }
            return result.value?.data || [];
        });

        backendVideos.forEach((video: any) => {
            videoIds.delete(video.id);
        });

        const remainingIds = [...videoIds];
        const youtubeFallbacks = await Promise.allSettled(remainingIds.map((id) => {
            const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}`;
            return axios.get(url, { timeout: 10000 });
        }));

        const dataFromYt = youtubeFallbacks.flatMap((result, idx) => {
            if (result.status !== "fulfilled") {
                console.error(result.reason);
                return [];
            }

            const { data, config } = result.value;
            const channel = data.author_url.match(CHANNEL_URL_REGEX);
            const channelId = channel?.length >= 2 && channel[1];
            const videoId = config.url.replace("https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=", "");
            return [{
                id: videoId || remainingIds[idx],
                title: data.title,
                channel: {
                    name: data.author_name,
                    id: channelId || data.author_name,
                },
            }];
        });

        setVideoData([...backendVideos, ...dataFromYt]);
    }

    // ── Actions ──
    function fetchVideoData(options?: { refreshLive: boolean }) {
        queuedFetchOptions = {
            refreshLive: queuedFetchOptions.refreshLive || options?.refreshLive,
        };

        return new Promise<void>((resolve, reject) => {
            pendingFetchResolvers.push(resolve);
            pendingFetchRejectors.push(reject);

            if (pendingFetchTimer) clearTimeout(pendingFetchTimer);
            pendingFetchTimer = setTimeout(async () => {
                const resolvers = pendingFetchResolvers;
                const rejectors = pendingFetchRejectors;
                pendingFetchResolvers = [];
                pendingFetchRejectors = [];
                pendingFetchTimer = null;

                const runOptions = queuedFetchOptions;
                queuedFetchOptions = {};

                try {
                    await runFetchVideoData(runOptions);
                    resolvers.forEach((done) => done());
                } catch (error) {
                    rejectors.forEach((fail) => fail(error));
                }
            }, options?.refreshLive ? 0 : MULTIVIEW_FETCH_DEBOUNCE_MS);
        });
    }

    function setLayout(newLayout: LayoutItem[]) {
        layout.value = newLayout;
    }

    function setLayoutContentById(payload: { id: string | number; content: Content }) {
        layoutContent.value[payload.id] = payload.content;
    }

    function setLayoutContent(content: Record<string | number, Content>) {
        layoutContent.value = content;
    }

    function addLayoutItem() {
        index.value = new Date().getTime();
        let newLayoutItem: LayoutItem | undefined;

        let foundGoodSpot = false;
        for (let y = 0; !foundGoodSpot && y < 24; y += 1) {
            for (let x = 0; !foundGoodSpot && x < 24 - 3; x += 1) {
                newLayoutItem = {
                    x,
                    y,
                    w: 4,
                    h: 6,
                    i: String(index.value),
                    isResizable: true,
                    isDraggable: true,
                };

                const collision = getFirstCollision(layout.value, newLayoutItem);
                if (!collision) {
                    foundGoodSpot = true;
                }
            }
        }

        if (!newLayoutItem || !foundGoodSpot) {
            newLayoutItem = {
                x: 0,
                y: 24,
                w: 4,
                h: 6,
                i: String(index.value),
                isResizable: true,
                isDraggable: true,
            };
        }
        layout.value.push(newLayoutItem);
    }

    function setLayoutContentWithKey({ id, key, value }: { id: string | number; key: string; value: any }) {
        if (layoutContent.value[id]) (layoutContent.value[id] as any)[key] = value;
    }

    function removeLayoutItem(id: string | number) {
        const idx = layout.value.map((item) => item.i).indexOf(String(id));
        layout.value.splice(idx, 1);
        if (layoutContent.value[id]) delete layoutContent.value[id];
    }

    function freezeLayoutItem(id: string | number) {
        const idx = layout.value.findIndex((x: any) => x.i === id);
        layout.value[idx].isResizable = false;
        layout.value[idx].isDraggable = false;
    }

    function unfreezeLayoutItem(id: string | number) {
        const idx = layout.value.findIndex((x: any) => x.i === id);
        layout.value[idx].isResizable = true;
        layout.value[idx].isDraggable = true;
    }

    function deleteLayoutContent(id: string | number) {
        delete layoutContent.value[id];
    }

    function addPresetLayout(content: any) {
        presetLayout.value.push(content);
    }

    function removePresetLayout(name: string) {
        const idx = presetLayout.value.findIndex((x) => x.name === name);
        presetLayout.value.splice(idx, 1);
    }

    function $reset() {
        layout.value = [];
        index.value = 1;
        layoutContent.value = {};
        // preserve presetLayout on reset, matching original behavior
        // presetLayout is NOT reset
    }

    function setAutoLayout({ index: idx, encodedLayout }: { index: number; encodedLayout: any }) {
        autoLayout.value[idx] = encodedLayout;
    }

    function resetAutoLayout() {
        autoLayout.value = getDesktopDefaults();
    }

    function addUrlHistory({ twitch = false, url }: { twitch?: boolean; url: string }) {
        const history = twitch ? twUrlHistory.value : ytUrlHistory.value;
        if (history.length >= 8) history.shift();
        history.push(url);
    }

    function setMuteOthers(val: boolean) {
        muteOthers.value = val;
        if (val) {
            Object.keys(layoutContent.value)
                .filter((key) => layoutContent.value[key]?.type === "video")
                .forEach((key, idx) => {
                    (layoutContent.value[key] as any).muted = idx !== 0;
                });
        }
    }

    const muteOthersAction = debounce((currentKey: string | number) => {
        if (!muteOthers.value) return;
        Object.keys(layoutContent.value).forEach((key) => {
            if (key === `${currentKey}`) {
                (layoutContent.value[key] as any).muted = false;
                return;
            }
            if (layoutContent.value[key]?.type === "video") {
                (layoutContent.value[key] as any).muted = true;
            }
        });
    }, 0, { trailing: true });

    function setVideoData(videos: any[]) {
        if (!videos) return;
        videos.forEach((video: any) => {
            Object.values<Content>(layoutContent.value).forEach((x) => {
                if (x.video?.id === video.id) {
                    x.video = video;
                }
            });
        });
        // Mark videos still missing data, so it doesn't attempt to fetch again
        Object.values<Content>(layoutContent.value).filter(missingVideoDataFilter).forEach((x) => { x.video.noData = true; });
    }

    function setSyncOffsets({ id, value }: { id: string; value: any }) {
        syncOffsets.value[id] = value;
    }

    function swapGridPosition({ id1, id2 }: { id1: number; id2: number }) {
        const { x: tX, y: tY, w: tW, h: tH } = layout.value[id1];
        const { x, y, w, h } = layout.value[id2];
        Object.assign(layout.value[id1], { ...layout.value[id1], x, y, w, h });
        Object.assign(layout.value[id2], { ...layout.value[id2], x: tX, y: tY, w: tW, h: tH });
    }

    function togglePresetAutoLayout() {
        // placeholder for synced mutation
    }

    return {
        // state
        layout,
        index,
        layoutContent,
        presetLayout,
        autoLayout,
        ytUrlHistory,
        twUrlHistory,
        muteOthers,
        syncOffsets,
        // getters
        nonChatCellCount,
        activeVideos,
        decodedCustomPresets,
        decodedDesktopPresets,
        decodedMobilePresets,
        desktopGroups,
        // actions
        fetchVideoData,
        setLayout,
        setLayoutContentById,
        setLayoutContent,
        addLayoutItem,
        setLayoutContentWithKey,
        removeLayoutItem,
        freezeLayoutItem,
        unfreezeLayoutItem,
        deleteLayoutContent,
        addPresetLayout,
        removePresetLayout,
        $reset,
        setAutoLayout,
        resetAutoLayout,
        addUrlHistory,
        setMuteOthers,
        muteOthersAction,
        setVideoData,
        setSyncOffsets,
        swapGridPosition,
        togglePresetAutoLayout,
    };
}, {
    persist: {
        key: "holodex-v2-multiview",
        pick: [
            "autoLayout",
            "ytUrlHistory",
            "twUrlHistory",
            "muteOthers",
            "syncOffsets",
            "presetLayout",
        ],
    },
});
