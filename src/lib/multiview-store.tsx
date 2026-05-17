"use client";

import axios from "axios";
import equal from "fast-deep-equal";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import api from "@/lib/api";
import { CHANNEL_URL_REGEX } from "@/lib/consts";
import { Content, LayoutItem, decodeLayout, desktopPresets, getDesktopDefaults, mobilePresets } from "@/lib/mv-utils";
import { checkIOS } from "@/lib/functions";
import { readJSON, writeJSON } from "@/lib/browser";
const STORAGE_KEY = "holodex-v2-multiview";
const BATCH = 25;
const DEBOUNCE = 140;

const MultiviewContext = createContext<any>(null);

const rectsCollide = (a: LayoutItem, b: LayoutItem) =>
  a.i !== b.i && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const missingVideoData = (x: Content) =>
  x?.type === "video" && x.video?.type !== "twitch" && x.video?.id === x.video?.channel?.name && !(x.video as any)?.noData;

const isLiveContent = (x: Content) => x?.video?.status === "live" || x?.video?.status === "upcoming";

const decodePreset = (preset: any) => ({ ...preset, ...decodeLayout(preset.layout) });

export function MultiviewProvider({ children, initialLayout = [], initialContent = {} }: { children: React.ReactNode; initialLayout?: LayoutItem[]; initialContent?: Record<string, Content> }) {
  const [layout, setLayoutState] = useState<LayoutItem[]>(initialLayout);
  const [layoutContent, setLayoutContentState] = useState<Record<string, Content>>(initialContent);
  const [presetLayout, setPresetLayout] = useState<Array<{ name: string; layout: string }>>([]);
  const [autoLayout, setAutoLayoutState] = useState<Array<string | null>>(getDesktopDefaults());
  const [ytUrlHistory, setYtUrlHistory] = useState<string[]>([]);
  const [twUrlHistory, setTwUrlHistory] = useState<string[]>([]);
  const [muteOthers, setMuteOthersState] = useState(checkIOS);
  const [syncOffsets, setSyncOffsetsState] = useState<Record<string, any>>({});
  const initialized = useRef(false);
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchQueued = useRef<{ refreshLive?: boolean }>({});
  const fetchResolvers = useRef<Array<() => void>>([]);
  const fetchRejectors = useRef<Array<(e: unknown) => void>>([]);

  useEffect(() => {
    const s = readJSON<any>(STORAGE_KEY, {});
    if (s.autoLayout) setAutoLayoutState(s.autoLayout);
    if (s.ytUrlHistory) setYtUrlHistory(s.ytUrlHistory);
    if (s.twUrlHistory) setTwUrlHistory(s.twUrlHistory);
    if (typeof s.muteOthers === "boolean") setMuteOthersState(s.muteOthers);
    if (s.presetLayout) setPresetLayout(s.presetLayout);
    initialized.current = true;
  }, []);

  useEffect(() => {
    if (initialized.current) writeJSON(STORAGE_KEY, { autoLayout, ytUrlHistory, twUrlHistory, muteOthers, presetLayout });
  }, [autoLayout, ytUrlHistory, twUrlHistory, muteOthers, presetLayout]);

  const activeVideos = useMemo(
    () => layout.filter((i) => layoutContent[i.i]?.type === "video").map((i) => layoutContent[i.i].video),
    [layout, layoutContent],
  );
  const nonChatCellCount = useMemo(
    () => layout.reduce((n, i) => n + ((!layoutContent[i.i] || layoutContent[i.i]?.type === "video") ? 1 : 0), 0),
    [layout, layoutContent],
  );
  const decodedCustomPresets = useMemo(() => presetLayout.map(decodePreset), [presetLayout]);
  const decodedDesktopPresets = useMemo(() => desktopPresets.map(decodePreset), []);
  const decodedMobilePresets = useMemo(() => mobilePresets.map(decodePreset), []);
  const desktopGroups = useMemo(() => {
    const groups: any[][] = [];
    const seen = new Set<string>();
    const customIds = new Set(decodedCustomPresets.map((p: any) => p.id));
    decodedCustomPresets.concat(decodedDesktopPresets).forEach((p: any) => {
      if (seen.has(p.id)) return;
      seen.add(p.id);
      const next = { ...p, ...(customIds.has(p.id) && { custom: true }) };
      (groups[next.videoCellCount] ||= []).push(next);
    });
    return groups;
  }, [decodedCustomPresets, decodedDesktopPresets]);

  const deleteContent = (prev: Record<string, Content>, id: string | number) => {
    const next = { ...prev };
    delete next[String(id)];
    return next;
  };

  const setItemLock = (id: string | number, locked: boolean) =>
    setLayoutState((prev) => prev.map((item) =>
      item.i === String(id) && (item.isResizable !== !locked || item.isDraggable !== !locked)
        ? { ...item, isResizable: !locked, isDraggable: !locked } : item,
    ));

  const setVideoData = (videos: any[]) => {
    if (!videos) return;
    setLayoutContentState((prev) => {
      let changed = false;
      const next: Record<string, Content> = { ...prev };
      const byId = new Map(videos.map((v: any) => [v.id, v]));
      for (const key of Object.keys(next)) {
        const c = next[key];
        const match = byId.get(c.video?.id);
        if (match && c.video !== match) { next[key] = { ...c, video: match }; changed = true; }
        if (missingVideoData(next[key])) { next[key] = { ...next[key], video: { ...next[key].video, noData: true } }; changed = true; }
      }
      return changed ? next : prev;
    });
  };

  const runFetchVideoData = async (options?: { refreshLive?: boolean }) => {
    const snapshot = layoutContent;
    const ids = new Set<string>(Object.values(snapshot)
      .filter((x) => missingVideoData(x) || (options?.refreshLive && isLiveContent(x)))
      .map((x) => x.video?.id).filter(Boolean));
    if (!ids.size) return;

    const chunks: string[][] = [];
    const arr = [...ids];
    for (let i = 0; i < arr.length; i += BATCH) chunks.push(arr.slice(i, i + BATCH));
    const backendRes = await Promise.allSettled(chunks.map((c) => api.videos({ include: "live_info", id: c.join(",") })));
    const backendVideos = backendRes.flatMap((r) => r.status === "fulfilled" ? ((r.value as any)?.data || []) : (console.error(r.reason), []));
    backendVideos.forEach((v: any) => ids.delete(v.id));

    const rest = [...ids];
    const ytRes = await Promise.allSettled(rest.map((id) => axios.get(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}`, { timeout: 10000 })));
    const ytVideos = ytRes.flatMap((r, idx) => {
      if (r.status !== "fulfilled") { console.error(r.reason); return []; }
      const { data, config } = r.value;
      const ch = data.author_url?.match(CHANNEL_URL_REGEX);
      const channelId = ch?.groups?.id || (ch?.length >= 2 && ch[1]);
      const videoId = String(config.url || "").replace("https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=", "");
      return [{ id: videoId || rest[idx], title: data.title, channel: { name: data.author_name, id: channelId || data.author_name } }];
    });
    setVideoData([...backendVideos, ...ytVideos]);
  };

  const fetchVideoData = (options?: { refreshLive?: boolean }) => {
    fetchQueued.current = { refreshLive: fetchQueued.current.refreshLive || options?.refreshLive };
    return new Promise<void>((resolve, reject) => {
      fetchResolvers.current.push(resolve);
      fetchRejectors.current.push(reject);
      if (fetchTimer.current) clearTimeout(fetchTimer.current);
      fetchTimer.current = setTimeout(async () => {
        const rs = fetchResolvers.current, fs = fetchRejectors.current;
        fetchResolvers.current = []; fetchRejectors.current = []; fetchTimer.current = null;
        const opts = fetchQueued.current; fetchQueued.current = {};
        try { await runFetchVideoData(opts); rs.forEach((r) => r()); }
        catch (e) { fs.forEach((f) => f(e)); }
      }, options?.refreshLive ? 0 : DEBOUNCE);
    });
  };

  const store = {
    layout,
    setLayout: (l: LayoutItem[]) => setLayoutState(l.map((i) => ({ ...i, i: String(i.i) }))),
    layoutContent,
    setLayoutContent: setLayoutContentState,
    setLayoutContentById: ({ id, content }: { id: string | number; content: Content }) =>
      setLayoutContentState((prev) => prev[String(id)] === content ? prev : { ...prev, [String(id)]: content }),
    setLayoutContentWithKey: ({ id, key, value }: { id: string | number; key: string; value: any }) =>
      setLayoutContentState((prev) => {
        const c = prev[String(id)];
        if (!c || equal((c as any)[key], value)) return prev;
        return { ...prev, [String(id)]: { ...c, [key]: value } };
      }),
    deleteLayoutContent: (id: string | number) => setLayoutContentState((prev) => deleteContent(prev, id)),
    removeLayoutItem: (id: string | number) => {
      setLayoutState((prev) => prev.filter((i) => i.i !== String(id)));
      setLayoutContentState((prev) => deleteContent(prev, id));
    },
    addLayoutItem: () => setLayoutState((prev) => {
      const id = String(Date.now());
      for (let y = 0; y < 24; y += 1) for (let x = 0; x < 21; x += 1) {
        const item: LayoutItem = { x, y, w: 4, h: 6, i: id, isResizable: true, isDraggable: true };
        if (!prev.find((p) => rectsCollide(p, item))) return [...prev, item];
      }
      return [...prev, { x: 0, y: 24, w: 4, h: 6, i: id, isResizable: true, isDraggable: true }];
    }),
    freezeLayoutItem: (id: string | number) => setItemLock(id, true),
    unfreezeLayoutItem: (id: string | number) => setItemLock(id, false),
    reset: () => { setLayoutState([]); setLayoutContentState({}); },
    activeVideos,
    nonChatCellCount,
    presetLayout,
    addPresetLayout: (content: { name: string; layout: string }) => setPresetLayout((prev) => [...prev, content]),
    removePresetLayout: (name: string) => setPresetLayout((prev) => prev.filter((i) => i.name !== name)),
    autoLayout,
    setAutoLayout: ({ index, encodedLayout }: { index: number; encodedLayout: string | null }) =>
      setAutoLayoutState((prev) => { const n = [...prev]; n[index] = encodedLayout; return n; }),
    resetAutoLayout: () => setAutoLayoutState(getDesktopDefaults()),
    ytUrlHistory,
    twUrlHistory,
    addUrlHistory: ({ twitch = false, url }: { twitch?: boolean; url: string }) => {
      (twitch ? setTwUrlHistory : setYtUrlHistory)((prev) => {
        const n = [...prev, url];
        if (n.length > 8) n.shift();
        return n;
      });
    },
    muteOthers,
    setMuteOthers: (value: boolean) => {
      setMuteOthersState(value);
      if (!value) return;
      setLayoutContentState((prev) => {
        let i = 0;
        const next: Record<string, Content> = {};
        for (const k of Object.keys(prev)) next[k] = prev[k]?.type === "video" ? { ...prev[k], muted: i++ !== 0 } : prev[k];
        return next;
      });
    },
    muteOthersAction: (currentKey: string | number) => {
      if (!muteOthers) return;
      const target = String(currentKey);
      setLayoutContentState((prev) => {
        const next: Record<string, Content> = {};
        for (const k of Object.keys(prev)) next[k] = k === target
          ? { ...prev[k], muted: false }
          : prev[k]?.type === "video" ? { ...prev[k], muted: true } : prev[k];
        return next;
      });
    },
    syncOffsets,
    setSyncOffsets: ({ id, value }: { id: string; value: any }) =>
      setSyncOffsetsState((prev) => ({ ...prev, [id]: value })),
    swapGridPosition: ({ id1, id2 }: { id1: number; id2: number }) =>
      setLayoutState((prev) => {
        if (!prev[id1] || !prev[id2]) return prev;
        const next = prev.map((i) => ({ ...i }));
        const a = next[id1], b = next[id2];
        [a.x, a.y, a.w, a.h, b.x, b.y, b.w, b.h] = [b.x, b.y, b.w, b.h, a.x, a.y, a.w, a.h];
        return next;
      }),
    fetchVideoData,
    decodedCustomPresets,
    decodedDesktopPresets,
    decodedMobilePresets,
    desktopGroups,
  };

  return <MultiviewContext.Provider value={store}>{children}</MultiviewContext.Provider>;
}

export function useMultiviewStore() {
  const store = useContext(MultiviewContext);
  if (!store) throw new Error("useMultiviewStore must be used within MultiviewProvider");
  return store;
}

export const useOptionalMultiviewStore = () => useContext(MultiviewContext);
