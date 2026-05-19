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

const collides = (a: LayoutItem, b: LayoutItem) =>
  a.i !== b.i && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const missing = (x: Content) =>
  x?.type === "video" && x.video?.type !== "twitch" && x.video?.id === x.video?.channel?.name && !(x.video as any)?.noData;

const isLive = (x: Content) => x?.video?.status === "live" || x?.video?.status === "upcoming";

const decodePreset = (p: any) => ({ ...p, ...decodeLayout(p.layout) });

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
  const resolvers = useRef<Array<() => void>>([]);
  const rejectors = useRef<Array<(e: unknown) => void>>([]);

  useEffect(() => {
    const s = readJSON<any>(STORAGE_KEY, {});
    if (s.autoLayout) setAutoLayoutState(s.autoLayout);
    if (s.ytUrlHistory) setYtUrlHistory(s.ytUrlHistory);
    if (s.twUrlHistory) setTwUrlHistory(s.twUrlHistory);
    if (typeof s.muteOthers === "boolean") setMuteOthersState(s.muteOthers);
    if (s.presetLayout) setPresetLayout(s.presetLayout);
    if (Array.isArray(s.layout) && s.layout.length && !initialLayout.length) setLayoutState(s.layout);
    if (s.layoutContent && typeof s.layoutContent === "object" && !Object.keys(initialContent).length) setLayoutContentState(s.layoutContent);
    initialized.current = true;
  }, []);

  useEffect(() => {
    if (!initialized.current) return;
    const handle = setTimeout(() => {
      writeJSON(STORAGE_KEY, { autoLayout, ytUrlHistory, twUrlHistory, muteOthers, presetLayout, layout, layoutContent });
    }, 500);
    return () => clearTimeout(handle);
  }, [autoLayout, ytUrlHistory, twUrlHistory, muteOthers, presetLayout, layout, layoutContent]);

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

  const delContent = (prev: Record<string, Content>, id: string | number) => {
    const next = { ...prev };
    delete next[String(id)];
    return next;
  };

  const setItemLock = (id: string | number, locked: boolean) => {
    const key = String(id);
    const unlocked = !locked;
    setLayoutState((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        if (String(item.i) !== key || (item.isResizable === unlocked && item.isDraggable === unlocked)) return item;
        changed = true;
        return { ...item, isResizable: unlocked, isDraggable: unlocked };
      });
      return changed ? next : prev;
    });
  };

  const setVideoData = (videos: any[]) => {
    if (!videos) return;
    setLayoutContentState((prev) => {
      let changed = false;
      const next: Record<string, Content> = { ...prev };
      const byId = new Map(videos.map((v: any) => [v.id, v]));
      for (const k of Object.keys(next)) {
        const c = next[k];
        const m = byId.get(c.video?.id);
        if (m && c.video !== m) { next[k] = { ...c, video: m }; changed = true; }
        if (missing(next[k])) { next[k] = { ...next[k], video: { ...next[k].video, noData: true } }; changed = true; }
      }
      return changed ? next : prev;
    });
  };

  const runFetch = async (opts?: { refreshLive?: boolean }) => {
    const snap = layoutContent;
    const ids = new Set<string>(Object.values(snap)
      .filter((x) => missing(x) || (opts?.refreshLive && isLive(x)))
      .map((x) => x.video?.id).filter(Boolean));
    if (!ids.size) return;

    const arr = [...ids];
    const chunks: string[][] = [];
    for (let i = 0; i < arr.length; i += BATCH) chunks.push(arr.slice(i, i + BATCH));
    const res = await Promise.allSettled(chunks.map((c) => api.videos({ include: "live_info", id: c.join(",") })));
    const backend = res.flatMap((r) => r.status === "fulfilled" ? ((r.value as any)?.data || []) : (console.error(r.reason), []));
    backend.forEach((v: any) => ids.delete(v.id));

    const rest = [...ids];
    const ytRes = await Promise.allSettled(rest.map((id) => axios.get(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}`, { timeout: 10000 })));
    const yt = ytRes.flatMap((r, i) => {
      if (r.status !== "fulfilled") { console.error(r.reason); return []; }
      const { data, config } = r.value;
      const ch = data.author_url?.match(CHANNEL_URL_REGEX);
      const channelId = ch?.groups?.id || (ch?.length >= 2 && ch[1]);
      const videoId = String(config.url || "").replace("https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=", "");
      return [{ id: videoId || rest[i], title: data.title, channel: { name: data.author_name, id: channelId || data.author_name } }];
    });
    setVideoData([...backend, ...yt]);
  };

  const fetchVideoData = (opts?: { refreshLive?: boolean }) => {
    fetchQueued.current = { refreshLive: fetchQueued.current.refreshLive || opts?.refreshLive };
    return new Promise<void>((resolve, reject) => {
      resolvers.current.push(resolve);
      rejectors.current.push(reject);
      if (fetchTimer.current) clearTimeout(fetchTimer.current);
      fetchTimer.current = setTimeout(async () => {
        const rs = resolvers.current, fs = rejectors.current;
        resolvers.current = []; rejectors.current = []; fetchTimer.current = null;
        const o = fetchQueued.current; fetchQueued.current = {};
        try { await runFetch(o); rs.forEach((r) => r()); }
        catch (e) { fs.forEach((f) => f(e)); }
      }, opts?.refreshLive ? 0 : DEBOUNCE);
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
    deleteLayoutContent: (id: string | number) => setLayoutContentState((prev) => delContent(prev, id)),
    removeLayoutItem: (id: string | number) => {
      setLayoutState((prev) => prev.filter((i) => i.i !== String(id)));
      setLayoutContentState((prev) => delContent(prev, id));
    },
    addLayoutItem: () => setLayoutState((prev) => {
      const id = String(Date.now());
      for (let y = 0; y < 24; y++) for (let x = 0; x < 21; x++) {
        const item: LayoutItem = { x, y, w: 4, h: 6, i: id, isResizable: true, isDraggable: true };
        if (!prev.find((p) => collides(p, item))) return [...prev, item];
      }
      return [...prev, { x: 0, y: 24, w: 4, h: 6, i: id, isResizable: true, isDraggable: true }];
    }),
    freezeLayoutItem: (id: string | number) => setItemLock(id, true),
    unfreezeLayoutItem: (id: string | number) => setItemLock(id, false),
    reset: () => { setLayoutState([]); setLayoutContentState({}); },
    activeVideos,
    nonChatCellCount,
    presetLayout,
    addPresetLayout: (c: { name: string; layout: string }) => setPresetLayout((p) => [...p, c]),
    removePresetLayout: (name: string) => setPresetLayout((p) => p.filter((i) => i.name !== name)),
    autoLayout,
    setAutoLayout: ({ index, encodedLayout }: { index: number; encodedLayout: string | null }) =>
      setAutoLayoutState((p) => { const n = [...p]; n[index] = encodedLayout; return n; }),
    resetAutoLayout: () => setAutoLayoutState(getDesktopDefaults()),
    ytUrlHistory, twUrlHistory,
    addUrlHistory: ({ twitch = false, url }: { twitch?: boolean; url: string }) =>
      (twitch ? setTwUrlHistory : setYtUrlHistory)((p) => {
        const n = [...p, url];
        if (n.length > 8) n.shift();
        return n;
      }),
    muteOthers,
    setMuteOthers: (v: boolean) => {
      setMuteOthersState(v);
      if (!v) return;
      setLayoutContentState((prev) => {
        let i = 0;
        const next: Record<string, Content> = {};
        for (const k of Object.keys(prev)) next[k] = prev[k]?.type === "video" ? { ...prev[k], muted: i++ !== 0 } : prev[k];
        return next;
      });
    },
    muteOthersAction: (cur: string | number) => {
      if (!muteOthers) return;
      const target = String(cur);
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
      setSyncOffsetsState((p) => ({ ...p, [id]: value })),
    swapGridPosition: ({ id1, id2 }: { id1: number; id2: number }) =>
      setLayoutState((prev) => {
        if (!prev[id1] || !prev[id2]) return prev;
        const n = prev.map((i) => ({ ...i }));
        const a = n[id1], b = n[id2];
        [a.x, a.y, a.w, a.h, b.x, b.y, b.w, b.h] = [b.x, b.y, b.w, b.h, a.x, a.y, a.w, a.h];
        return n;
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
  const s = useContext(MultiviewContext);
  if (!s) throw new Error("useMultiviewStore must be used within MultiviewProvider");
  return s;
}

export const useOptionalMultiviewStore = () => useContext(MultiviewContext);
