import { Content, LayoutItem, decodeLayout, generateContentId, sortLayout } from "@/lib/mv-utils";
interface DecodedPreset {
  id: string;
  layout: LayoutItem[];
  content: Record<string, Content>;
  videoCellCount: number;
  fillVideo?: any;
  [key: string]: any;
}

interface MultiviewLayoutStoreLike {
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

const decodedAutoLayout = (store: MultiviewLayoutStoreLike) =>
  store.autoLayout.filter((l): l is string => !!l).map((p) => ({ id: p, ...decodeLayout(p) }));

const getPresets = (store: MultiviewLayoutStoreLike, isMobile: boolean) =>
  isMobile ? store.decodedMobilePresets : (decodedAutoLayout(store) as DecodedPreset[]).concat(store.decodedDesktopPresets as DecodedPreset[]);

const findPresetForCount = (presets: DecodedPreset[], target: number) =>
  presets.find((p) => p.videoCellCount === target) ?? presets.find((p) => p.videoCellCount >= target);

function isPreset(store: MultiviewLayoutStoreLike, currentLayout = store.layout, isMobile = false): boolean {
  const comparable = getPresets(store, isMobile).filter((p) => p.layout.length === currentLayout.length);
  if (!comparable.length) return false;
  const clone = [...currentLayout].sort(sortLayout);
  return comparable.some((preset) =>
    preset.layout.every((c, i) => c.x === clone[i].x && c.y === clone[i].y && c.w === clone[i].w && c.h === clone[i].h));
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
  const newLayout = findPresetForCount(isMobile ? store.decodedMobilePresets : decodedAutoLayout(store), store.activeVideos.length + 1);
  if (!newLayout) return;
  const cloned = structuredClone(newLayout);
  if (!store.layout.length || isPreset(store, store.layout, isMobile)) {
    setMultiview(store, { ...cloned, mergeContent: true, hintAdd: true, fillVideo: video });
  } else {
    onConflict({ ...cloned, fillVideo: video });
  }
}

export function addCellAutoLayout(store: MultiviewLayoutStoreLike, isMobile: boolean) {
  const newLayout = findPresetForCount(isMobile ? store.decodedMobilePresets : decodedAutoLayout(store), store.nonChatCellCount + 1);
  if (newLayout && (!store.layout.length || isPreset(store, store.layout, isMobile))) {
    setMultiview(store, { ...structuredClone(newLayout), mergeContent: true, hintAdd: false });
  } else {
    store.addLayoutItem();
  }
}

export function deleteVideoAutoLayout(store: MultiviewLayoutStoreLike, id: string, isMobile: boolean) {
  if (!(isPreset(store, store.layout, isMobile) && store.layoutContent[id]?.type !== "chat")) {
    store.removeLayoutItem(id);
    return;
  }
  if (store.nonChatCellCount === 1) { store.reset(); return; }
  const presets = isMobile ? store.decodedMobilePresets : decodedAutoLayout(store);
  const newLayout = presets.find((p) => p.videoCellCount === store.nonChatCellCount - 1);
  if (!newLayout) { store.removeLayoutItem(id); return; }
  store.deleteLayoutContent(id);
  setMultiview(store, { ...structuredClone(newLayout), mergeContent: true });
}
