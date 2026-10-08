"use client";

import axios from "axios";
import equal from "fast-deep-equal";
import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import api from "@/lib/api";
import { readJSON, writeJSON } from "@/lib/browser";
import { CHANNEL_URL_REGEX } from "@/lib/consts";
import { checkIOS } from "@/lib/functions";
import {
  type Content,
  decodeLayout,
  desktopPresets,
  getDesktopDefaults,
  type LayoutItem,
  mobilePresets,
} from "@/lib/mv-utils";
import { MultiviewContext } from "@/lib/multiview-context";

const STORAGE_KEY = "holodex-v2-multiview";
const BATCH = 25;
const DEBOUNCE = 140;

const collides = (a: LayoutItem, b: LayoutItem) =>
  a.i !== b.i && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const missing = (x: Content) =>
  x?.type === "video" &&
  x.video?.type !== "twitch" &&
  x.video?.id === x.video?.channel?.name &&
  !(x.video as any)?.noData;

const isLive = (x: Content) => x?.video?.status === "live" || x?.video?.status === "upcoming";

const decodePreset = (p: any) => ({ ...p, ...decodeLayout(p.layout) });

const delContent = (prev: Record<string, Content>, id: string | number) => {
  const next = { ...prev };
  delete next[String(id)];
  return next;
};

// Lock (or unlock) one cell against dragging and resizing.
function withItemLock(prev: LayoutItem[], id: string | number, locked: boolean) {
  const key = String(id);
  const unlocked = !locked;
  let changed = false;
  const next = prev.map((item) => {
    if (String(item.i) !== key || (item.isResizable === unlocked && item.isDraggable === unlocked))
      return item;
    changed = true;
    return { ...item, isResizable: unlocked, isDraggable: unlocked };
  });
  return changed ? next : prev;
}

// Swap in fetched video data, and flag videos that still have none so they aren't refetched.
function withVideoData(prev: Record<string, Content>, videos: any[]) {
  let changed = false;
  const next: Record<string, Content> = { ...prev };
  const byId = new Map(videos.map((v: any) => [v.id, v]));
  for (const k of Object.keys(next)) {
    const c = next[k];
    const m = byId.get(c.video?.id);
    if (m && c.video !== m) {
      next[k] = { ...c, video: m };
      changed = true;
    }
    if (missing(next[k])) {
      next[k] = { ...next[k], video: { ...next[k].video, noData: true } };
      changed = true;
    }
  }
  return changed ? next : prev;
}

// Data for the cells' videos that lack it (and, with `refreshLive`, the live ones): from the
// API in batches, then YouTube's oEmbed for videos the API doesn't know.
async function fetchCellVideos(snap: Record<string, Content>, opts?: { refreshLive?: boolean }) {
  const ids = new Set<string>(
    Object.values(snap)
      .filter((x) => missing(x) || (opts?.refreshLive && isLive(x)))
      .map((x) => x.video?.id)
      .filter(Boolean),
  );
  if (!ids.size) return null;

  const arr = [...ids];
  const chunks: string[][] = [];
  for (let i = 0; i < arr.length; i += BATCH) chunks.push(arr.slice(i, i + BATCH));
  const res = await Promise.allSettled(
    chunks.map((c) => api.videos({ include: "live_info", id: c.join(",") })),
  );
  const backend = res.flatMap((r) => {
    if (r.status === "fulfilled") return (r.value as any)?.data?.items || [];
    console.error(r.reason);
    return [];
  });
  backend.forEach((v: any) => {
    ids.delete(v.id);
  });

  const rest = [...ids];
  const ytRes = await Promise.allSettled(
    rest.map((id) =>
      axios.get(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}`, {
        timeout: 10000,
      }),
    ),
  );
  const yt = ytRes.flatMap((r, i) => {
    if (r.status !== "fulfilled") {
      console.error(r.reason);
      return [];
    }
    const { data, config } = r.value;
    const ch = data.author_url?.match(CHANNEL_URL_REGEX);
    const channelId = ch?.groups?.id || (ch?.length >= 2 && ch[1]);
    const videoId = String(config.url || "").replace(
      "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=",
      "",
    );
    return [
      {
        id: videoId || rest[i],
        title: data.title,
        channel: { name: data.author_name, id: channelId || data.author_name },
      },
    ];
  });
  return [...backend, ...yt];
}

// A new 4x6 cell at the first free spot of the 24-column grid, else below everything.
function withNewCell(prev: LayoutItem[]) {
  const id = String(Date.now());
  for (let y = 0; y < 24; y++)
    for (let x = 0; x < 21; x++) {
      const item: LayoutItem = { x, y, w: 4, h: 6, i: id, isResizable: true, isDraggable: true };
      if (!prev.find((p) => collides(p, item))) return [...prev, item];
    }
  return [...prev, { x: 0, y: 24, w: 4, h: 6, i: id, isResizable: true, isDraggable: true }];
}

// Mute every video but the first.
function mutedAllButFirst(prev: Record<string, Content>) {
  let i = 0;
  const next: Record<string, Content> = {};
  for (const k of Object.keys(prev))
    next[k] = prev[k]?.type === "video" ? { ...prev[k], muted: i++ !== 0 } : prev[k];
  return next;
}

// Unmute `target` and mute every other video.
function mutedAllBut(prev: Record<string, Content>, target: string) {
  const next: Record<string, Content> = {};
  for (const k of Object.keys(prev))
    next[k] =
      k === target
        ? { ...prev[k], muted: false }
        : prev[k]?.type === "video"
          ? { ...prev[k], muted: true }
          : prev[k];
  return next;
}

function withSwappedCells(prev: LayoutItem[], id1: number, id2: number) {
  if (!prev[id1] || !prev[id2]) return prev;
  const n = prev.map((i) => ({ ...i }));
  const a = n[id1],
    b = n[id2];
  [a.x, a.y, a.w, a.h, b.x, b.y, b.w, b.h] = [b.x, b.y, b.w, b.h, a.x, a.y, a.w, a.h];
  return n;
}

// Desktop presets (custom ones first, flagged) grouped by their video cell count.
function groupDesktopPresets(custom: any[], builtIn: any[]) {
  const groups: any[][] = [];
  const seen = new Set<string>();
  const customIds = new Set(custom.map((p: any) => p.id));
  custom.concat(builtIn).forEach((p: any) => {
    if (seen.has(p.id)) return;
    seen.add(p.id);
    const next = { ...p, ...(customIds.has(p.id) && { custom: true }) };
    groups[next.videoCellCount] ||= [];
    groups[next.videoCellCount].push(next);
  });
  return groups;
}

// The multiview state, restored from localStorage on mount and saved back (debounced) as it
// changes. Sync offsets are per session.
function useMultiviewState() {
  const [layout, setLayoutState] = useState<LayoutItem[]>([]);
  const [layoutContent, setLayoutContentState] = useState<Record<string, Content>>({});
  const [presetLayout, setPresetLayout] = useState<Array<{ name: string; layout: string }>>([]);
  const [autoLayout, setAutoLayoutState] = useState<Array<string | null>>(getDesktopDefaults);
  const [ytUrlHistory, setYtUrlHistory] = useState<string[]>([]);
  const [twUrlHistory, setTwUrlHistory] = useState<string[]>([]);
  const [muteOthers, setMuteOthersState] = useState(checkIOS);
  const [syncOffsets, setSyncOffsetsState] = useState<Record<string, any>>({});
  const initialized = useRef(false);

  useEffect(() => {
    const s = readJSON<any>(STORAGE_KEY, {});
    if (s.autoLayout) setAutoLayoutState(s.autoLayout);
    if (s.ytUrlHistory) setYtUrlHistory(s.ytUrlHistory);
    if (s.twUrlHistory) setTwUrlHistory(s.twUrlHistory);
    if (typeof s.muteOthers === "boolean") setMuteOthersState(s.muteOthers);
    if (s.presetLayout) setPresetLayout(s.presetLayout);
    if (Array.isArray(s.layout) && s.layout.length) setLayoutState(s.layout);
    if (s.layoutContent && typeof s.layoutContent === "object")
      setLayoutContentState(s.layoutContent);
    initialized.current = true;
  }, []);

  useEffect(() => {
    if (!initialized.current) return;
    const handle = setTimeout(() => {
      writeJSON(STORAGE_KEY, {
        autoLayout,
        ytUrlHistory,
        twUrlHistory,
        muteOthers,
        presetLayout,
        layout,
        layoutContent,
      });
    }, 500);
    return () => clearTimeout(handle);
  }, [autoLayout, ytUrlHistory, twUrlHistory, muteOthers, presetLayout, layout, layoutContent]);

  // The setters never change, so the store's actions can be rebuilt from them freely.
  const setters = useMemo(
    () => ({
      setLayoutState,
      setLayoutContentState,
      setPresetLayout,
      setAutoLayoutState,
      setYtUrlHistory,
      setTwUrlHistory,
      setMuteOthersState,
      setSyncOffsetsState,
    }),
    [],
  );
  return {
    setters,
    layout,
    layoutContent,
    presetLayout,
    autoLayout,
    ytUrlHistory,
    twUrlHistory,
    muteOthers,
    syncOffsets,
  };
}

// Debounced video data fetches for the cells. Calls made in the same window share one fetch
// (a `refreshLive` call runs it right away) and each caller's promise settles with it.
function useCellVideoFetcher(
  layoutContentRef: React.RefObject<Record<string, Content>>,
  setLayoutContent: React.Dispatch<React.SetStateAction<Record<string, Content>>>,
) {
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchQueued = useRef<{ refreshLive?: boolean }>({});
  const resolvers = useRef<Array<() => void>>([]);
  const rejectors = useRef<Array<(e: unknown) => void>>([]);

  const runFetch = useCallback(
    async (opts?: { refreshLive?: boolean }) => {
      const videos = await fetchCellVideos(layoutContentRef.current, opts);
      if (videos) setLayoutContent((prev) => withVideoData(prev, videos));
    },
    [layoutContentRef, setLayoutContent],
  );

  return useCallback(
    (opts?: { refreshLive?: boolean }) => {
      fetchQueued.current = { refreshLive: fetchQueued.current.refreshLive || opts?.refreshLive };
      return new Promise<void>((resolve, reject) => {
        resolvers.current.push(resolve);
        rejectors.current.push(reject);
        if (fetchTimer.current) clearTimeout(fetchTimer.current);
        fetchTimer.current = setTimeout(
          async () => {
            const rs = resolvers.current,
              fs = rejectors.current;
            resolvers.current = [];
            rejectors.current = [];
            fetchTimer.current = null;
            const o = fetchQueued.current;
            fetchQueued.current = {};
            try {
              await runFetch(o);
              rs.forEach((r) => {
                r();
              });
            } catch (e) {
              fs.forEach((f) => {
                f(e);
              });
            }
          },
          opts?.refreshLive ? 0 : DEBOUNCE,
        );
      });
    },
    [runFetch],
  );
}

// The store's actions over the state setters; `muteOthers` gates muteOthersAction.
function multiviewActions(
  setters: ReturnType<typeof useMultiviewState>["setters"],
  muteOthers: boolean,
) {
  const {
    setLayoutState,
    setLayoutContentState,
    setPresetLayout,
    setAutoLayoutState,
    setYtUrlHistory,
    setTwUrlHistory,
    setMuteOthersState,
    setSyncOffsetsState,
  } = setters;
  return {
    setLayout: (l: LayoutItem[]) => setLayoutState(l.map((i) => ({ ...i, i: String(i.i) }))),
    setLayoutContent: setLayoutContentState,
    setLayoutContentById: ({ id, content }: { id: string | number; content: Content }) =>
      setLayoutContentState((prev) =>
        prev[String(id)] === content ? prev : { ...prev, [String(id)]: content },
      ),
    setLayoutContentWithKey: ({
      id,
      key,
      value,
    }: {
      id: string | number;
      key: string;
      value: any;
    }) =>
      setLayoutContentState((prev) => {
        const c = prev[String(id)];
        if (!c || equal((c as any)[key], value)) return prev;
        return { ...prev, [String(id)]: { ...c, [key]: value } };
      }),
    deleteLayoutContent: (id: string | number) =>
      setLayoutContentState((prev) => delContent(prev, id)),
    removeLayoutItem: (id: string | number) => {
      setLayoutState((prev) => prev.filter((i) => i.i !== String(id)));
      setLayoutContentState((prev) => delContent(prev, id));
    },
    addLayoutItem: () => setLayoutState(withNewCell),
    freezeLayoutItem: (id: string | number) =>
      setLayoutState((prev) => withItemLock(prev, id, true)),
    unfreezeLayoutItem: (id: string | number) =>
      setLayoutState((prev) => withItemLock(prev, id, false)),
    reset: () => {
      setLayoutState([]);
      setLayoutContentState({});
    },
    addPresetLayout: (c: { name: string; layout: string }) => setPresetLayout((p) => [...p, c]),
    removePresetLayout: (name: string) => setPresetLayout((p) => p.filter((i) => i.name !== name)),
    setAutoLayout: ({ index, encodedLayout }: { index: number; encodedLayout: string | null }) =>
      setAutoLayoutState((p) => {
        const n = [...p];
        n[index] = encodedLayout;
        return n;
      }),
    resetAutoLayout: () => setAutoLayoutState(getDesktopDefaults()),
    addUrlHistory: ({ twitch = false, url }: { twitch?: boolean; url: string }) =>
      (twitch ? setTwUrlHistory : setYtUrlHistory)((p) => {
        const n = [...p, url];
        if (n.length > 8) n.shift();
        return n;
      }),
    setMuteOthers: (v: boolean) => {
      setMuteOthersState(v);
      if (!v) return;
      setLayoutContentState(mutedAllButFirst);
    },
    muteOthersAction: (cur: string | number) => {
      if (!muteOthers) return;
      const target = String(cur);
      setLayoutContentState((prev) => mutedAllBut(prev, target));
    },
    setSyncOffsets: ({ id, value }: { id: string; value: any }) =>
      setSyncOffsetsState((p) => ({ ...p, [id]: value })),
    swapGridPosition: ({ id1, id2 }: { id1: number; id2: number }) =>
      setLayoutState((prev) => withSwappedCells(prev, id1, id2)),
  };
}

export function MultiviewProvider({ children }: { children: React.ReactNode }) {
  const {
    setters,
    layout,
    layoutContent,
    presetLayout,
    autoLayout,
    ytUrlHistory,
    twUrlHistory,
    muteOthers,
    syncOffsets,
  } = useMultiviewState();
  // Callers set content and then queue a fetch in the same handler, so the debounced fetch
  // must read the committed content rather than the snapshot from the calling render.
  const layoutContentRef = useRef(layoutContent);

  useLayoutEffect(() => {
    layoutContentRef.current = layoutContent;
  }, [layoutContent]);

  const activeVideos = useMemo(
    () =>
      layout
        .filter((i) => layoutContent[i.i]?.type === "video")
        .map((i) => layoutContent[i.i].video),
    [layout, layoutContent],
  );
  const nonChatCellCount = useMemo(
    () =>
      layout.reduce(
        (n, i) => n + (!layoutContent[i.i] || layoutContent[i.i]?.type === "video" ? 1 : 0),
        0,
      ),
    [layout, layoutContent],
  );
  const decodedCustomPresets = useMemo(() => presetLayout.map(decodePreset), [presetLayout]);
  const decodedDesktopPresets = useMemo(() => desktopPresets.map(decodePreset), []);
  const decodedMobilePresets = useMemo(() => mobilePresets.map(decodePreset), []);
  const desktopGroups = useMemo(
    () => groupDesktopPresets(decodedCustomPresets, decodedDesktopPresets),
    [decodedCustomPresets, decodedDesktopPresets],
  );
  const fetchVideoData = useCellVideoFetcher(layoutContentRef, setters.setLayoutContentState);

  const store = useMemo(
    () => ({
      ...multiviewActions(setters, muteOthers),
      layout,
      layoutContent,
      activeVideos,
      nonChatCellCount,
      presetLayout,
      autoLayout,
      ytUrlHistory,
      twUrlHistory,
      muteOthers,
      syncOffsets,
      fetchVideoData,
      decodedCustomPresets,
      decodedDesktopPresets,
      decodedMobilePresets,
      desktopGroups,
    }),
    [
      setters,
      layout,
      layoutContent,
      activeVideos,
      nonChatCellCount,
      presetLayout,
      autoLayout,
      ytUrlHistory,
      twUrlHistory,
      muteOthers,
      syncOffsets,
      fetchVideoData,
      decodedCustomPresets,
      decodedDesktopPresets,
      decodedMobilePresets,
      desktopGroups,
    ],
  );

  return <MultiviewContext.Provider value={store}>{children}</MultiviewContext.Provider>;
}

export function useMultiviewStore() {
  const s = useContext(MultiviewContext);
  if (!s) throw new Error("useMultiviewStore must be used within MultiviewProvider");
  return s;
}

export { useOptionalMultiviewStore } from "@/lib/multiview-context";
