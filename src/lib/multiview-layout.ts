import { Content, LayoutItem, decodeLayout, generateContentId, sortLayout } from "@/lib/mv-utils";

interface DecodedPreset {
  id: string;
  layout: LayoutItem[];
  content: Record<string, Content>;
  videoCellCount: number;
  fillVideo?: any;
  [key: string]: any;
}

interface Store {
  layout: LayoutItem[];
  layoutContent: Record<string, Content>;
  activeVideos: any[];
  nonChatCellCount: number;
  autoLayout: Array<string | null>;
  decodedDesktopPresets: DecodedPreset[];
  decodedMobilePresets: DecodedPreset[];
  setLayout: (l: LayoutItem[]) => void;
  setLayoutContent: (c: Record<string, Content>) => void;
  setLayoutContentById: (p: { id: string | number; content: Content }) => void;
  deleteLayoutContent: (id: string | number) => void;
  removeLayoutItem: (id: string | number) => void;
  addLayoutItem: () => void;
  reset: () => void;
  fetchVideoData: (opts?: { refreshLive?: boolean }) => Promise<void>;
}

const decodedAuto = (s: Store) =>
  s.autoLayout.filter((l): l is string => !!l).map((p) => ({ id: p, ...decodeLayout(p) }));

const presetsFor = (s: Store, mobile: boolean) =>
  mobile ? s.decodedMobilePresets : (decodedAuto(s) as DecodedPreset[]).concat(s.decodedDesktopPresets as DecodedPreset[]);

const findForCount = (presets: DecodedPreset[], n: number) =>
  presets.find((p) => p.videoCellCount === n) ?? presets.find((p) => p.videoCellCount >= n);

function isPreset(s: Store, layout = s.layout, mobile = false) {
  const cmp = presetsFor(s, mobile).filter((p) => p.layout.length === layout.length);
  if (!cmp.length) return false;
  const sorted = [...layout].sort(sortLayout);
  return cmp.some((p) => p.layout.every((c, i) => c.x === sorted[i].x && c.y === sorted[i].y && c.w === sorted[i].w && c.h === sorted[i].h));
}

export function setMultiview(s: Store, { layout, content, mergeContent = false, hintAdd = false, fillVideo = null, excludeId = null }: { layout: LayoutItem[]; content: Record<string, Content>; mergeContent?: boolean; hintAdd?: boolean; fillVideo?: any; excludeId?: string | null }) {
  const cl = layout.map((i) => ({ ...i, i: String(i.i) }));
  const cc: Record<string, Content> = { ...content };
  let filled = false;
  if (mergeContent) {
    const merge: Record<string, Content> = {};
    let vi = 0;
    const curVids = s.layout.filter(({ i }) => s.layoutContent[i]?.type === "video" && i !== excludeId);
    const newIdx: Record<string, number> = {};

    cl.filter((i) => !cc[i.i]).forEach((i) => {
      if (vi < s.activeVideos.length && curVids[vi]) {
        const k = curVids[vi].i;
        i.i = k;
        merge[k] = s.layoutContent[k];
        newIdx[s.layoutContent[k].video!.id] = vi++;
      } else {
        const k = generateContentId();
        i.i = k;
        if (fillVideo && !filled) { merge[k] = { id: fillVideo.id, type: "video", video: fillVideo }; filled = true; }
      }
    });

    const chats = Object.values(s.layoutContent).filter((o) => o.type === "chat").map((o) => s.activeVideos[o.currentTab ?? 0]?.id);
    let ci = 0;
    const max = hintAdd ? vi + 1 : vi;
    const free = new Set([...Array(max).keys()]);

    cl.filter((i) => cc[i.i]?.type === "chat").forEach((i) => {
      if (ci >= chats.length) {
        const u = free.values().next().value;
        cc[i.i] = { ...cc[i.i], currentTab: u };
        free.delete(u!);
        return;
      }
      const vid = chats[ci++];
      cc[i.i] = { ...cc[i.i], currentTab: newIdx[vid] };
      free.delete(newIdx[vid]);
    });

    s.setLayoutContent({ ...merge, ...cc });
  } else {
    if (fillVideo) {
      const empty = cl.find((i) => !cc[i.i]);
      if (empty) cc[empty.i] = { id: fillVideo.id, type: "video", video: fillVideo };
    }
    s.setLayoutContent(cc);
  }
  s.setLayout(cl);
  s.fetchVideoData();
}

export function addVideoWithId(s: Store, video: any, id: string | number) {
  s.setLayoutContentById({ id, content: { id: video.id, type: "video", video } });
  s.fetchVideoData();
}

export const findEmptyCell = (s: Store) => s.layout.find((i) => !s.layoutContent[i.i]);

export function tryFillVideo(s: Store, video: any) {
  if (!video) return;
  const empties = s.layout.filter((l) => !s.layoutContent[l.i]).sort(sortLayout);
  if (empties.length) addVideoWithId(s, video, empties[0].i);
}

export function addVideoAutoLayout(s: Store, video: any, mobile: boolean, onConflict: (l: DecodedPreset) => void) {
  const next = findForCount(mobile ? s.decodedMobilePresets : decodedAuto(s), s.activeVideos.length + 1);
  if (!next) return;
  const cloned = structuredClone(next);
  if (!s.layout.length || isPreset(s, s.layout, mobile)) {
    setMultiview(s, { ...cloned, mergeContent: true, hintAdd: true, fillVideo: video });
  } else onConflict({ ...cloned, fillVideo: video });
}

export function addCellAutoLayout(s: Store, mobile: boolean) {
  const next = findForCount(mobile ? s.decodedMobilePresets : decodedAuto(s), s.nonChatCellCount + 1);
  if (next && (!s.layout.length || isPreset(s, s.layout, mobile))) {
    setMultiview(s, { ...structuredClone(next), mergeContent: true, hintAdd: false });
  } else s.addLayoutItem();
}

export function deleteVideoAutoLayout(s: Store, id: string, mobile: boolean) {
  if (!(isPreset(s, s.layout, mobile) && s.layoutContent[id]?.type !== "chat")) {
    s.removeLayoutItem(id); return;
  }
  if (s.nonChatCellCount === 1) { s.reset(); return; }
  const next = (mobile ? s.decodedMobilePresets : decodedAuto(s)).find((p) => p.videoCellCount === s.nonChatCellCount - 1);
  if (!next) { s.removeLayoutItem(id); return; }
  setMultiview(s, { ...structuredClone(next), mergeContent: true, excludeId: id });
}
