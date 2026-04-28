"use client";

import axios from "axios";
import equal from "fast-deep-equal";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import api from "@/lib/api";
import { CHANNEL_URL_REGEX } from "@/lib/consts";
import {
  Content,
  LayoutItem,
  decodeLayout,
  desktopPresets,
  getDesktopDefaults,
  mobilePresets,
} from "@/lib/mv-utils";
import { checkIOS } from "@/lib/functions";

const MULTIVIEW_STORAGE_KEY = "holodex-v2-multiview";
const MULTIVIEW_VIDEO_BATCH_SIZE = 25;
const MULTIVIEW_FETCH_DEBOUNCE_MS = 140;

type PersistedMultiview = {
  autoLayout?: Array<string | null>;
  ytUrlHistory?: string[];
  twUrlHistory?: string[];
  muteOthers?: boolean;
  syncOffsets?: Record<string, any>;
  presetLayout?: Array<{ name: string; layout: string }>;
};

type MultiviewStore = {
  layout: LayoutItem[];
  setLayout: (layout: LayoutItem[]) => void;
  layoutContent: Record<string, Content>;
  setLayoutContent: (content: Record<string, Content>) => void;
  setLayoutContentById: (payload: { id: string | number; content: Content }) => void;
  setLayoutContentWithKey: (payload: { id: string | number; key: string; value: any }) => void;
  deleteLayoutContent: (id: string | number) => void;
  removeLayoutItem: (id: string | number) => void;
  addLayoutItem: () => void;
  freezeLayoutItem: (id: string | number) => void;
  unfreezeLayoutItem: (id: string | number) => void;
  reset: () => void;
  activeVideos: any[];
  nonChatCellCount: number;
  presetLayout: Array<{ name: string; layout: string }>;
  addPresetLayout: (content: { name: string; layout: string }) => void;
  removePresetLayout: (name: string) => void;
  autoLayout: Array<string | null>;
  setAutoLayout: (payload: { index: number; encodedLayout: string | null }) => void;
  resetAutoLayout: () => void;
  ytUrlHistory: string[];
  twUrlHistory: string[];
  addUrlHistory: (payload: { twitch?: boolean; url: string }) => void;
  muteOthers: boolean;
  setMuteOthers: (value: boolean) => void;
  muteOthersAction: (currentKey: string | number) => void;
  syncOffsets: Record<string, any>;
  setSyncOffsets: (payload: { id: string; value: any }) => void;
  swapGridPosition: (payload: { id1: number; id2: number }) => void;
  fetchVideoData: (options?: { refreshLive?: boolean }) => Promise<void>;
  decodedCustomPresets: any[];
  decodedDesktopPresets: any[];
  decodedMobilePresets: any[];
  desktopGroups: any[][];
};

const MultiviewContext = createContext<MultiviewStore | null>(null);

function readPersisted(): PersistedMultiview {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(MULTIVIEW_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writePersisted(value: PersistedMultiview) {
  try { localStorage.setItem(MULTIVIEW_STORAGE_KEY, JSON.stringify(value)); } catch {}
}

function rectsCollide(a: LayoutItem, b: LayoutItem) {
  if (a.i === b.i) return false;
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function missingVideoDataFilter(x: Content) {
  return x?.type === "video" && x.video?.type !== "twitch" && x.video?.id === x.video?.channel?.name && !(x.video as any)?.noData;
}

function videoIsLiveFilter(x: Content) {
  return x?.video?.status === "live" || x?.video?.status === "upcoming";
}

function chunkIds(ids: string[], chunkSize: number) {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += chunkSize) chunks.push(ids.slice(index, index + chunkSize));
  return chunks;
}

function decodePreset(preset: any) {
  return {
    ...preset,
    ...decodeLayout(preset.layout),
  };
}

export function MultiviewProvider({ children, initialLayout = [], initialContent = {} }: { children: React.ReactNode; initialLayout?: LayoutItem[]; initialContent?: Record<string, Content> }) {
  const [layout, setLayoutState] = useState<LayoutItem[]>(initialLayout);
  const [layoutContent, setLayoutContentState] = useState<Record<string, Content>>(initialContent);
  const [presetLayout, setPresetLayout] = useState<Array<{ name: string; layout: string }>>([]);
  const [autoLayout, setAutoLayoutState] = useState<Array<string | null>>(getDesktopDefaults());
  const [ytUrlHistory, setYtUrlHistory] = useState<string[]>([]);
  const [twUrlHistory, setTwUrlHistory] = useState<string[]>([]);
  const [muteOthers, setMuteOthersState] = useState(() => (typeof navigator !== "undefined" && navigator?.platform ? checkIOS() : false));
  const [syncOffsets, setSyncOffsetsState] = useState<Record<string, any>>({});
  const initialized = useRef(false);
  const pendingFetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queuedFetchOptions = useRef<{ refreshLive?: boolean }>({});
  const pendingFetchResolvers = useRef<Array<() => void>>([]);
  const pendingFetchRejectors = useRef<Array<(error: unknown) => void>>([]);

  useEffect(() => {
    const saved = readPersisted();
    if (Array.isArray(saved.autoLayout)) setAutoLayoutState(saved.autoLayout);
    if (Array.isArray(saved.ytUrlHistory)) setYtUrlHistory(saved.ytUrlHistory);
    if (Array.isArray(saved.twUrlHistory)) setTwUrlHistory(saved.twUrlHistory);
    if (typeof saved.muteOthers === "boolean") setMuteOthersState(saved.muteOthers);
    if (saved.syncOffsets && typeof saved.syncOffsets === "object") setSyncOffsetsState(saved.syncOffsets);
    if (Array.isArray(saved.presetLayout)) setPresetLayout(saved.presetLayout);
    initialized.current = true;
  }, []);

  useEffect(() => {
    if (!initialized.current) return;
    writePersisted({ autoLayout, ytUrlHistory, twUrlHistory, muteOthers, syncOffsets, presetLayout });
  }, [autoLayout, ytUrlHistory, twUrlHistory, muteOthers, syncOffsets, presetLayout]);

  const activeVideos = useMemo(() => layout
    .filter((item) => layoutContent[item.i] && layoutContent[item.i].type === "video")
    .map((item) => layoutContent[item.i].video), [layout, layoutContent]);

  const nonChatCellCount = useMemo(() => layout.reduce((acc, item) => acc + ((!layoutContent[item.i] || layoutContent[item.i]?.type === "video") ? 1 : 0), 0), [layout, layoutContent]);

  const decodedCustomPresets = useMemo(() => presetLayout.map(decodePreset), [presetLayout]);
  const decodedDesktopPresets = useMemo(() => desktopPresets.map(decodePreset), []);
  const decodedMobilePresets = useMemo(() => mobilePresets.map(decodePreset), []);
  const desktopGroups = useMemo(() => {
    const groups: any[][] = [];
    const seen = new Set<string>();
    const customIds = new Set(decodedCustomPresets.map((preset: any) => preset.id));
    decodedCustomPresets.concat(decodedDesktopPresets).forEach((preset: any) => {
      if (seen.has(preset.id)) return;
      seen.add(preset.id);
      const next = { ...preset };
      if (customIds.has(next.id)) next.custom = true;
      if (!groups[next.videoCellCount]) groups[next.videoCellCount] = [];
      groups[next.videoCellCount].push(next);
    });
    return groups;
  }, [decodedCustomPresets, decodedDesktopPresets]);

  const setLayout = useCallback((newLayout: LayoutItem[]) => {
    setLayoutState(newLayout.map((item) => ({ ...item, i: String(item.i) })));
  }, []);

  const setLayoutContent = useCallback((content: Record<string, Content>) => {
    setLayoutContentState({ ...content });
  }, []);

  const setLayoutContentById = useCallback(({ id, content }: { id: string | number; content: Content }) => {
    setLayoutContentState((prev) => prev[String(id)] === content ? prev : ({ ...prev, [String(id)]: content }));
  }, []);

  const setLayoutContentWithKey = useCallback(({ id, key, value }: { id: string | number; key: string; value: any }) => {
    setLayoutContentState((prev) => {
      const content = prev[String(id)];
      if (!content || equal((content as any)[key], value)) return prev;
      return { ...prev, [String(id)]: { ...content, [key]: value } };
    });
  }, []);

  const deleteLayoutContent = useCallback((id: string | number) => {
    setLayoutContentState((prev) => {
      const next = { ...prev };
      delete next[String(id)];
      return next;
    });
  }, []);

  const removeLayoutItem = useCallback((id: string | number) => {
    setLayoutState((prev) => prev.filter((item) => item.i !== String(id)));
    setLayoutContentState((prev) => {
      const next = { ...prev };
      delete next[String(id)];
      return next;
    });
  }, []);

  const addLayoutItem = useCallback(() => {
    setLayoutState((prev) => {
      let newLayoutItem: LayoutItem | undefined;
      let foundGoodSpot = false;
      for (let y = 0; !foundGoodSpot && y < 24; y += 1) {
        for (let x = 0; !foundGoodSpot && x < 24 - 3; x += 1) {
          newLayoutItem = { x, y, w: 4, h: 6, i: String(Date.now()), isResizable: true, isDraggable: true };
          if (!prev.find((item) => rectsCollide(item, newLayoutItem!))) foundGoodSpot = true;
        }
      }
      if (!newLayoutItem || !foundGoodSpot) newLayoutItem = { x: 0, y: 24, w: 4, h: 6, i: String(Date.now()), isResizable: true, isDraggable: true };
      return [...prev, newLayoutItem];
    });
  }, []);

  const setLayoutItemLock = useCallback((id: string | number, locked: boolean) => {
    setLayoutState((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        if (item.i !== String(id)) return item;
        if (item.isResizable === !locked && item.isDraggable === !locked) return item;
        changed = true;
        return { ...item, isResizable: !locked, isDraggable: !locked };
      });
      return changed ? next : prev;
    });
  }, []);

  const freezeLayoutItem = useCallback((id: string | number) => setLayoutItemLock(id, true), [setLayoutItemLock]);
  const unfreezeLayoutItem = useCallback((id: string | number) => setLayoutItemLock(id, false), [setLayoutItemLock]);

  const reset = useCallback(() => {
    setLayoutState([]);
    setLayoutContentState({});
  }, []);

  const addPresetLayout = useCallback((content: { name: string; layout: string }) => {
    setPresetLayout((prev) => [...prev, content]);
  }, []);

  const removePresetLayout = useCallback((name: string) => {
    setPresetLayout((prev) => prev.filter((item) => item.name !== name));
  }, []);

  const setAutoLayout = useCallback(({ index, encodedLayout }: { index: number; encodedLayout: string | null }) => {
    setAutoLayoutState((prev) => {
      const next = [...prev];
      next[index] = encodedLayout;
      return next;
    });
  }, []);

  const resetAutoLayout = useCallback(() => setAutoLayoutState(getDesktopDefaults()), []);

  const addUrlHistory = useCallback(({ twitch = false, url }: { twitch?: boolean; url: string }) => {
    const setter = twitch ? setTwUrlHistory : setYtUrlHistory;
    setter((prev) => {
      const next = [...prev];
      if (next.length >= 8) next.shift();
      next.push(url);
      return next;
    });
  }, []);

  const setMuteOthers = useCallback((value: boolean) => {
    setMuteOthersState(value);
    if (!value) return;
    setLayoutContentState((prev) => {
      const next: Record<string, Content> = { ...prev };
      Object.keys(next).filter((key) => next[key]?.type === "video").forEach((key, idx) => {
        next[key] = { ...next[key], muted: idx !== 0 };
      });
      return next;
    });
  }, []);

  const muteOthersAction = useCallback((currentKey: string | number) => {
    if (!muteOthers) return;
    setLayoutContentState((prev) => {
      const next: Record<string, Content> = { ...prev };
      Object.keys(next).forEach((key) => {
        if (key === String(currentKey)) next[key] = { ...next[key], muted: false };
        else if (next[key]?.type === "video") next[key] = { ...next[key], muted: true };
      });
      return next;
    });
  }, [muteOthers]);

  const setSyncOffsets = useCallback(({ id, value }: { id: string; value: any }) => {
    setSyncOffsetsState((prev) => ({ ...prev, [id]: value }));
  }, []);

  const swapGridPosition = useCallback(({ id1, id2 }: { id1: number; id2: number }) => {
    setLayoutState((prev) => {
      if (!prev[id1] || !prev[id2]) return prev;
      const next = prev.map((item) => ({ ...item }));
      const { x: tX, y: tY, w: tW, h: tH } = next[id1];
      const { x, y, w, h } = next[id2];
      Object.assign(next[id1], { x, y, w, h });
      Object.assign(next[id2], { x: tX, y: tY, w: tW, h: tH });
      return next;
    });
  }, []);

  const setVideoData = useCallback((videos: any[]) => {
    if (!videos) return;
    setLayoutContentState((prev) => {
      let changed = false;
      const next: Record<string, Content> = { ...prev };
      const videosById = new Map(videos.map((video: any) => [video.id, video]));
      Object.keys(next).forEach((key) => {
        const content = next[key];
        const match = videosById.get(content.video?.id);
        if (match && content.video !== match) {
          next[key] = { ...content, video: match };
          changed = true;
        }
      });
      Object.keys(next).forEach((key) => {
        if (missingVideoDataFilter(next[key])) {
          next[key] = { ...next[key], video: { ...next[key].video, noData: true } };
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, []);

  const runFetchVideoData = useCallback(async (options?: { refreshLive?: boolean }) => {
    const snapshot = layoutContent;
    const videoIds = new Set<string>(Object.values(snapshot)
      .filter((x) => missingVideoDataFilter(x) || (options?.refreshLive && videoIsLiveFilter(x)))
      .map((x) => x.video?.id)
      .filter(Boolean));
    if (!videoIds.size) return;

    const backendResponses = await Promise.allSettled(chunkIds([...videoIds], MULTIVIEW_VIDEO_BATCH_SIZE).map((ids) => api.videos({ include: "live_info", id: ids.join(",") })));
    const backendVideos = backendResponses.flatMap((result) => {
      if (result.status !== "fulfilled") {
        console.error(result.reason);
        return [];
      }
      return (result.value as any)?.data || [];
    });
    backendVideos.forEach((video: any) => videoIds.delete(video.id));

    const remainingIds = [...videoIds];
    const youtubeFallbacks = await Promise.allSettled(remainingIds.map((id) => axios.get(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}`, { timeout: 10000 })));
    const dataFromYt = youtubeFallbacks.flatMap((result, idx) => {
      if (result.status !== "fulfilled") {
        console.error(result.reason);
        return [];
      }
      const { data, config } = result.value;
      const channel = data.author_url?.match(CHANNEL_URL_REGEX);
      const channelId = channel?.groups?.id || (channel?.length >= 2 && channel[1]);
      const videoId = String(config.url || "").replace("https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=", "");
      return [{ id: videoId || remainingIds[idx], title: data.title, channel: { name: data.author_name, id: channelId || data.author_name } }];
    });
    setVideoData([...backendVideos, ...dataFromYt]);
  }, [layoutContent, setVideoData]);

  const fetchVideoData = useCallback((options?: { refreshLive?: boolean }) => {
    queuedFetchOptions.current = { refreshLive: queuedFetchOptions.current.refreshLive || options?.refreshLive };
    return new Promise<void>((resolve, reject) => {
      pendingFetchResolvers.current.push(resolve);
      pendingFetchRejectors.current.push(reject);
      if (pendingFetchTimer.current) clearTimeout(pendingFetchTimer.current);
      pendingFetchTimer.current = setTimeout(async () => {
        const resolvers = pendingFetchResolvers.current;
        const rejectors = pendingFetchRejectors.current;
        pendingFetchResolvers.current = [];
        pendingFetchRejectors.current = [];
        pendingFetchTimer.current = null;
        const runOptions = queuedFetchOptions.current;
        queuedFetchOptions.current = {};
        try {
          await runFetchVideoData(runOptions);
          resolvers.forEach((done) => done());
        } catch (error) {
          rejectors.forEach((fail) => fail(error));
        }
      }, options?.refreshLive ? 0 : MULTIVIEW_FETCH_DEBOUNCE_MS);
    });
  }, [runFetchVideoData]);

  const store = useMemo<MultiviewStore>(() => ({
    layout,
    setLayout,
    layoutContent,
    setLayoutContent,
    setLayoutContentById,
    setLayoutContentWithKey,
    deleteLayoutContent,
    removeLayoutItem,
    addLayoutItem,
    freezeLayoutItem,
    unfreezeLayoutItem,
    reset,
    activeVideos,
    nonChatCellCount,
    presetLayout,
    addPresetLayout,
    removePresetLayout,
    autoLayout,
    setAutoLayout,
    resetAutoLayout,
    ytUrlHistory,
    twUrlHistory,
    addUrlHistory,
    muteOthers,
    setMuteOthers,
    muteOthersAction,
    syncOffsets,
    setSyncOffsets,
    swapGridPosition,
    fetchVideoData,
    decodedCustomPresets,
    decodedDesktopPresets,
    decodedMobilePresets,
    desktopGroups,
  }), [layout, setLayout, layoutContent, setLayoutContent, setLayoutContentById, setLayoutContentWithKey, deleteLayoutContent, removeLayoutItem, addLayoutItem, freezeLayoutItem, unfreezeLayoutItem, reset, activeVideos, nonChatCellCount, presetLayout, addPresetLayout, removePresetLayout, autoLayout, setAutoLayout, resetAutoLayout, ytUrlHistory, twUrlHistory, addUrlHistory, muteOthers, setMuteOthers, muteOthersAction, syncOffsets, setSyncOffsets, swapGridPosition, fetchVideoData, decodedCustomPresets, decodedDesktopPresets, decodedMobilePresets, desktopGroups]);

  return <MultiviewContext.Provider value={store}>{children}</MultiviewContext.Provider>;
}

export function useMultiviewStore() {
  const store = useContext(MultiviewContext);
  if (!store) throw new Error("useMultiviewStore must be used within MultiviewProvider");
  return store;
}

export function useOptionalMultiviewStore() {
  return useContext(MultiviewContext);
}
