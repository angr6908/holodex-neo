import { Content, LayoutItem, decodeLayout, generateContentId, sortLayout } from "@/lib/mv-utils";

export interface DecodedPreset {
  id: string;
  layout: LayoutItem[];
  content: Record<string, Content>;
  videoCellCount: number;
  fillVideo?: any;
  [key: string]: any;
}

export interface MultiviewLayoutStoreLike {
  layout: LayoutItem[];
  layoutContent: Record<string, Content>;
  activeVideos: any[];
  nonChatCellCount: number;
  autoLayout: Array<string | null>;
  decodedDesktopPresets: DecodedPreset[];
  decodedMobilePresets: DecodedPreset[];
  setLayout: (layout: LayoutItem[]) => void;
  setLayoutContent: (content: Record<string, Content>) => void;
  setLayoutContentById: (payload: { id: string | number; content: Content }) => void;
  deleteLayoutContent: (id: string | number) => void;
  removeLayoutItem: (id: string | number) => void;
  addLayoutItem: () => void;
  reset: () => void;
  fetchVideoData: (options?: { refreshLive?: boolean }) => Promise<void>;
}

export function decodedAutoLayout(store: MultiviewLayoutStoreLike) {
  return store.autoLayout
    .filter((layout): layout is string => !!layout)
    .map((preset) => ({ id: preset, ...decodeLayout(preset) }));
}

function getPresets(store: MultiviewLayoutStoreLike, isMobile: boolean): DecodedPreset[] {
  return isMobile ? store.decodedMobilePresets : decodedAutoLayout(store) as DecodedPreset[];
}

export function isPreset(store: MultiviewLayoutStoreLike, currentLayout = store.layout, isMobile = false): boolean {
  const toCompare = isMobile
    ? store.decodedMobilePresets
    : (decodedAutoLayout(store) as DecodedPreset[]).concat(store.decodedDesktopPresets);
  const comparable = toCompare.filter((preset) => preset.layout.length === currentLayout.length);
  if (comparable.length === 0) return false;
  const clone = [...currentLayout].sort(sortLayout);
  return comparable.some((preset) => {
    for (let i = 0; i < currentLayout.length; i += 1) {
      const presetCell = preset.layout[i];
      const layoutCell = clone[i];
      if (presetCell.x !== layoutCell.x || presetCell.y !== layoutCell.y || presetCell.w !== layoutCell.w || presetCell.h !== layoutCell.h) return false;
    }
    return true;
  });
}

export function setMultiview(store: MultiviewLayoutStoreLike, { layout, content, mergeContent = false, hintAdd = false, fillVideo = null }: { layout: LayoutItem[]; content: Record<string, Content>; mergeContent?: boolean; hintAdd?: boolean; fillVideo?: any }) {
  const clonedLayout = layout.map((item) => ({ ...item, i: String(item.i) }));
  const clonedContent: Record<string, Content> = { ...content };
  let filledVideo = false;
  if (mergeContent) {
    const contentsToMerge: Record<string, Content> = {};
    let videoIndex = 0;
    const currentVideoContents = store.layout.filter(({ i }) => store.layoutContent[i]?.type === "video");
    const newVideoIdToIndex: Record<string, number> = {};

    clonedLayout.filter((item) => !clonedContent[item.i]).forEach((item) => {
      if (videoIndex < store.activeVideos.length && currentVideoContents[videoIndex]) {
        const key = currentVideoContents[videoIndex].i;
        item.i = key;
        contentsToMerge[key] = store.layoutContent[key];
        newVideoIdToIndex[store.layoutContent[key].video!.id] = videoIndex;
        videoIndex += 1;
      } else {
        const key = generateContentId();
        item.i = key;
        if (fillVideo && !filledVideo) {
          contentsToMerge[key] = { id: fillVideo.id, type: "video", video: fillVideo };
          filledVideo = true;
        }
      }
    });

    const activeChatsAsVideoId = Object.values(store.layoutContent)
      .filter((o) => o.type === "chat")
      .map((o) => store.activeVideos[o.currentTab ?? 0]?.id);
    let chatIndex = 0;
    const maxVideoLength = hintAdd ? videoIndex + 1 : videoIndex;
    const uniqueIndexes = new Set([...Array(maxVideoLength).keys()]);

    clonedLayout.filter((item) => clonedContent[item.i]?.type === "chat").forEach((item) => {
      if (chatIndex >= activeChatsAsVideoId.length) {
        const uniqueIndex = uniqueIndexes.values().next().value;
        clonedContent[item.i] = { ...clonedContent[item.i], currentTab: uniqueIndex };
        uniqueIndexes.delete(uniqueIndex!);
        return;
      }
      const videoId = activeChatsAsVideoId[chatIndex];
      clonedContent[item.i] = { ...clonedContent[item.i], currentTab: newVideoIdToIndex[videoId] };
      uniqueIndexes.delete(newVideoIdToIndex[videoId]);
      chatIndex += 1;
    });

    store.setLayoutContent({ ...contentsToMerge, ...clonedContent });
  } else {
    if (fillVideo) {
      const emptyCell = clonedLayout.find((item) => !clonedContent[item.i]);
      if (emptyCell) clonedContent[emptyCell.i] = { id: fillVideo.id, type: "video", video: fillVideo };
    }
    store.setLayoutContent(clonedContent);
  }
  store.setLayout(clonedLayout);
  store.fetchVideoData();
}

export function addVideoWithId(store: MultiviewLayoutStoreLike, video: any, id: string | number) {
  store.setLayoutContentById({ id, content: { id: video.id, type: "video", video } });
  store.fetchVideoData();
}

export function findEmptyCell(store: MultiviewLayoutStoreLike): LayoutItem | undefined {
  return store.layout.find((item) => !store.layoutContent[item.i]);
}

export function tryFillVideo(store: MultiviewLayoutStoreLike, video: any) {
  if (!video) return;
  const emptyCells = store.layout.filter((l) => !store.layoutContent[l.i]).sort(sortLayout);
  if (emptyCells.length) addVideoWithId(store, video, emptyCells[0].i);
}

export function addVideoAutoLayout(store: MultiviewLayoutStoreLike, video: any, isMobile: boolean, onConflict: (layout: DecodedPreset) => void) {
  const presets = getPresets(store, isMobile);
  const targetCount = store.activeVideos.length + 1;
  const newLayout = presets.find((p) => p.videoCellCount === targetCount) ?? presets.find((p) => p.videoCellCount >= targetCount);
  if (!newLayout) return;
  const clonedLayout = JSON.parse(JSON.stringify(newLayout));
  if (!store.layout.length || isPreset(store, store.layout, isMobile)) {
    setMultiview(store, { ...clonedLayout, mergeContent: true, hintAdd: true, fillVideo: video });
    return;
  }
  onConflict({ ...clonedLayout, fillVideo: video });
}

export function addCellAutoLayout(store: MultiviewLayoutStoreLike, isMobile: boolean) {
  const presets = getPresets(store, isMobile);
  const targetCount = store.nonChatCellCount + 1;
  const newLayout = presets.find((p) => p.videoCellCount === targetCount) ?? presets.find((p) => p.videoCellCount >= targetCount);
  if (newLayout) {
    const clonedLayout = JSON.parse(JSON.stringify(newLayout));
    if (!store.layout.length || isPreset(store, store.layout, isMobile)) {
      setMultiview(store, { ...clonedLayout, mergeContent: true, hintAdd: false });
      return;
    }
  }
  store.addLayoutItem();
}

export function deleteVideoAutoLayout(store: MultiviewLayoutStoreLike, id: string, isMobile: boolean) {
  if (isPreset(store, store.layout, isMobile) && store.layoutContent[id]?.type !== "chat") {
    if (store.nonChatCellCount === 1) {
      store.reset();
      return;
    }
    const presets = getPresets(store, isMobile);
    const targetCount = store.nonChatCellCount - 1;
    const newLayout = presets.find((p) => p.videoCellCount === targetCount);
    if (!newLayout) {
      store.removeLayoutItem(id);
      return;
    }
    const clonedLayout = JSON.parse(JSON.stringify(newLayout));
    store.deleteLayoutContent(id);
    setMultiview(store, { ...clonedLayout, mergeContent: true });
  } else {
    store.removeLayoutItem(id);
  }
}
