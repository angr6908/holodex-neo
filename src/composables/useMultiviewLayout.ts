import { computed } from "vue";
import { useMultiviewStore } from "@/stores/multiview";
import type { Content } from "@/utils/mv-utils";
import { decodeLayout, generateContentId, sortLayout } from "@/utils/mv-utils";

interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  [key: string]: unknown;
}

interface DecodedPreset {
  id: string;
  layout: LayoutItem[];
  content: Record<string, Content>;
  videoCellCount: number;
}

interface SetMultiviewOptions {
  layout: LayoutItem[];
  content: Record<string, Content>;
  mergeContent?: boolean;
  /** Hint that a new video will be added after the layout switch. */
  hintAdd?: boolean;
}

/**
 * Composable replacement for MultiviewLayoutMixin.
 * Provides layout preset detection, auto-layout switching,
 * content merging, and cell management methods.
 *
 * @param layoutRef   - Computed or ref to the current layout array.
 * @param autoLayoutRef - Computed or ref to the autoLayout encoded strings array.
 * @param isMobileRef - Computed or ref indicating mobile mode.
 */
export function useMultiviewLayout(
  layoutRef: { value: LayoutItem[] },
  autoLayoutRef: { value: (string | null)[] },
  isMobileRef: { value: boolean },
) {
  const multiviewStore = useMultiviewStore();

  // ──────────────────────────────────────────────
  // Computed getters
  // ──────────────────────────────────────────────

  const layoutContent = computed(() => multiviewStore.layoutContent);
  const activeVideos = computed(() => multiviewStore.activeVideos);
  const nonChatCellCount = computed(() => multiviewStore.nonChatCellCount);

  const decodedCustomPresets = computed<DecodedPreset[]>(
    () => multiviewStore.decodedCustomPresets,
  );
  const decodedDesktopPresets = computed<DecodedPreset[]>(
    () => multiviewStore.decodedDesktopPresets,
  );
  const decodedMobilePresets = computed<DecodedPreset[]>(
    () => multiviewStore.decodedMobilePresets,
  );
  const desktopGroups = computed(() => multiviewStore.desktopGroups);

  const decodedAutoLayout = computed<DecodedPreset[]>(() =>
    autoLayoutRef.value
      .filter((l): l is string => !!l)
      .map((preset) => ({
        id: preset,
        ...decodeLayout(preset),
      })),
  );

  // ──────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────

  function getLayout(): LayoutItem[] {
    return layoutRef.value;
  }

  function getPresets(): DecodedPreset[] {
    return isMobileRef.value
      ? decodedMobilePresets.value
      : decodedAutoLayout.value;
  }

  // ──────────────────────────────────────────────
  // Cell management
  // ──────────────────────────────────────────────

  function removeItemById(id: string) {
    multiviewStore.removeLayoutItem(id);
  }

  function clearAllItems() {
    multiviewStore.$reset();
  }

  function addItem() {
    multiviewStore.addLayoutItem();
  }

  function addVideoWithId(video: any, id: string) {
    multiviewStore.setLayoutContentById({
      id,
      content: {
        id: video.id,
        type: "video",
        video,
      },
    });
    multiviewStore.fetchVideoData();
  }

  function findEmptyCell(): LayoutItem | undefined {
    return getLayout().find((l) => !layoutContent.value[l.i]);
  }

  function tryFillVideo(video: any) {
    if (!video) return;
    const emptyCells = getLayout()
      .filter((l) => !layoutContent.value[l.i])
      .sort(sortLayout);

    if (emptyCells.length) {
      addVideoWithId(video, emptyCells[0].i);
    }
  }

  // ──────────────────────────────────────────────
  // Preset detection
  // ──────────────────────────────────────────────

  function isPreset(currentLayout: LayoutItem[]): boolean {
    const toCompare = isMobileRef.value
      ? decodedMobilePresets.value
      : decodedAutoLayout.value.concat(decodedDesktopPresets.value);

    const comparable = toCompare.filter(
      (preset) => preset.layout.length === currentLayout.length,
    );
    if (comparable.length === 0) return false;

    const clone = [...currentLayout].sort(sortLayout);

    return comparable.some((preset) => {
      for (let i = 0; i < currentLayout.length; i += 1) {
        const presetCell = preset.layout[i];
        const layoutCell = clone[i];
        if (
          presetCell.x !== layoutCell.x
          || presetCell.y !== layoutCell.y
          || presetCell.w !== layoutCell.w
          || presetCell.h !== layoutCell.h
        ) {
          return false;
        }
      }
      return true;
    });
  }

  // ──────────────────────────────────────────────
  // Content merging / layout switching
  // ──────────────────────────────────────────────

  function setMultiview({
    layout,
    content,
    mergeContent = false,
    hintAdd = false,
  }: SetMultiviewOptions) {
    if (mergeContent) {
      const contentsToMerge: Record<string, Content> = {};
      let videoIndex = 0;

      // Maintain the original layout ordering when choosing new videos.
      const currentVideoContents = getLayout().filter(
        ({ i }) => layoutContent.value[i]?.type === "video",
      );
      const newVideoIdToIndex: Record<string, number> = {};

      // Fill incoming empty cells with existing video content.
      layout
        .filter((item) => !content[item.i])
        .forEach((item) => {
          if (videoIndex < activeVideos.value.length) {
            const key = currentVideoContents[videoIndex].i;
            // Re-use the original cell id so Vue doesn't re-mount the component.
            item.i = key;
            contentsToMerge[key] = layoutContent.value[key];
            newVideoIdToIndex[layoutContent.value[key].video!.id] = videoIndex;
            videoIndex += 1;
          } else {
            item.i = generateContentId();
          }
        });

      // Remap chat currentTab indices to keep pointing at the same video.
      const activeChatsAsVideoId = Object.values(
        layoutContent.value as Record<string, Content>,
      )
        .filter((o) => o.type === "chat")
        .map((o) => activeVideos.value[o.currentTab ?? 0]?.id);
      let chatIndex = 0;

      const maxVideoLength = hintAdd ? videoIndex + 1 : videoIndex;
      const uniqueIndexes = new Set([...Array(maxVideoLength).keys()]);

      layout
        .filter((item) => content[item.i]?.type === "chat")
        .forEach((item) => {
          if (chatIndex >= activeChatsAsVideoId.length) {
            const uniqueIndex = uniqueIndexes.values().next().value;
            content[item.i] = {
              ...content[item.i],
              currentTab: uniqueIndex,
            };
            uniqueIndexes.delete(uniqueIndex!);
            return;
          }

          const videoId = activeChatsAsVideoId[chatIndex];
          content[item.i] = {
            ...content[item.i],
            currentTab: newVideoIdToIndex[videoId],
          };
          uniqueIndexes.delete(newVideoIdToIndex[videoId]);
          chatIndex += 1;
        });

      const merged: Record<string, Content> = {
        ...contentsToMerge,
        ...content,
      };
      multiviewStore.setLayoutContent(merged);
    } else {
      multiviewStore.setLayoutContent(content);
    }

    multiviewStore.setLayout(layout);
    multiviewStore.fetchVideoData();
  }

  // ──────────────────────────────────────────────
  // Auto-layout operations
  // ──────────────────────────────────────────────

  /**
   * Find the best preset for one more video and apply it.
   * @param video     - The video to add after the layout switch.
   * @param onConflict - Called when the current layout is custom and a
   *                     new preset was found; the consumer should prompt the user.
   */
  function addVideoAutoLayout(
    video: any,
    onConflict: (clonedLayout: DecodedPreset) => void,
  ) {
    const presets = getPresets();
    const targetCount = activeVideos.value.length + 1;

    const newLayout =
      presets.find((p) => p.videoCellCount === targetCount)
      ?? presets.find((p) => p.videoCellCount >= targetCount);

    if (!newLayout) return;

    const clonedLayout: DecodedPreset = JSON.parse(JSON.stringify(newLayout));

    if (!getLayout().length || isPreset(getLayout())) {
      setMultiview({
        ...clonedLayout,
        mergeContent: true,
        hintAdd: true,
      });
      tryFillVideo(video);
      return;
    }

    onConflict(clonedLayout);
  }

  /** Find the next preset with space for one more non-chat cell. */
  function addCellAutoLayout() {
    const presets = getPresets();
    const targetCount = nonChatCellCount.value + 1;

    const newLayout =
      presets.find((p) => p.videoCellCount === targetCount)
      ?? presets.find((p) => p.videoCellCount >= targetCount);

    if (newLayout) {
      const clonedLayout: DecodedPreset = JSON.parse(JSON.stringify(newLayout));

      if (!getLayout().length || isPreset(getLayout())) {
        setMultiview({
          ...clonedLayout,
          mergeContent: true,
          hintAdd: false,
        });
        return;
      }
    }

    addItem();
  }

  /** Remove a video/cell and downgrade to a smaller preset if applicable. */
  function deleteVideoAutoLayout(id: string) {
    if (
      isPreset(getLayout())
      && layoutContent.value[id]?.type !== "chat"
    ) {
      // Clear everything when removing the last video.
      if (nonChatCellCount.value === 1) {
        clearAllItems();
        return;
      }

      const presets = getPresets();
      const targetCount = nonChatCellCount.value - 1;
      const newLayout = presets.find(
        (p) => p.videoCellCount === targetCount,
      );

      if (!newLayout) {
        multiviewStore.removeLayoutItem(id);
        return;
      }

      const clonedLayout: DecodedPreset = JSON.parse(
        JSON.stringify(newLayout),
      );
      multiviewStore.deleteLayoutContent(id);
      setMultiview({
        ...clonedLayout,
        mergeContent: true,
      });
    } else {
      multiviewStore.removeLayoutItem(id);
    }
  }

  /** Find the layout cell key that contains a given video id. */
  function findKeyByVideoId(videoId: string): string | undefined {
    return Object.keys(layoutContent.value).find(
      (k) => layoutContent.value[k].id === videoId,
    );
  }

  return {
    // Computed
    layoutContent,
    activeVideos,
    nonChatCellCount,
    decodedAutoLayout,
    decodedCustomPresets,
    decodedDesktopPresets,
    decodedMobilePresets,
    desktopGroups,

    // Methods
    removeItemById,
    clearAllItems,
    addItem,
    addVideoWithId,
    findEmptyCell,
    tryFillVideo,
    isPreset,
    setMultiview,
    addVideoAutoLayout,
    addCellAutoLayout,
    deleteVideoAutoLayout,
    findKeyByVideoId,
  };
}
