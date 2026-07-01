"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { jwtDecode } from "jwt-decode";
import api from "@/lib/api";
import { enrichLiveVideosWithTwitchViewerCounts } from "@/lib/twitch";
import { getLang, getLiveViewerCount, getUILang, videoTemporalComparator } from "@/lib/functions";
import { openUserMenu, readJSON, sendFavoritesToExtension, sendTokenToExtension, setCookieJWT, setLocaleCookie, writeJSON } from "@/lib/browser";
import { APP_BOOT_COOKIE, encodeCookieJson, type AppBootState } from "@/lib/cookie-codec";
import { ALL_VTUBERS_ORG, DEFAULT_ORG } from "@/lib/consts";
import { dedupeVideos } from "@/lib/video-format";
type Org = { name: string; short: string; [key: string]: any };
type Settings = {
  lang: string; foolsLang: string; clipLangs: string[];
  darkMode: boolean; followSystemTheme: boolean;
  defaultOpen: "home" | "favorites" | "multiview";
  redirectMode: boolean; autoplayVideo: boolean; scrollMode: boolean;
  hideThumbnail: boolean; hidePlaceholder: boolean; hideMissing: boolean;
  hideUpcoming: boolean; hideLive: boolean; useEnglishName: boolean;
  hideCollabStreams: boolean; hiddenGroups: Record<string, string[]>; ignoredTopics: string[];
  homeViewMode: "grid" | "list" | "denseList";
  liveTlStickBottom: boolean; liveTlLang: string; liveTlFontSize: number;
  liveTlShowVerified: boolean; liveTlShowModerator: boolean; liveTlShowVtuber: boolean;
  liveTlShowLocalTime: boolean; liveTlWindowSize: number;
  liveTlShowSubtitle: boolean; liveTlHideSpoiler: boolean; liveTlBlocked: string[];
  blockedChannels: any[];
};

const emptyPlaylist = () => ({ id: undefined, user_id: undefined, name: "Unnamed Playlist", videos: [] as any[], updated_at: undefined });

type State = {
  hydrated: boolean; settings: Settings;
  userdata: { user: any; jwt: string | null };
  isMobile: boolean; windowWidth: number; currentGridSize: number;
  currentOrg: Org; selectedHomeOrgs: string[]; orgFavorites: Org[]; orgs: Org[];
  homeLive: any[]; homeLoading: boolean; homeError: boolean;
  homeLastLiveUpdate: number; homeLiveCacheKey: string;
  favorites: any[]; favoritesLive: any[];
  favoritesLoading: boolean; favoritesError: boolean; favoritesLastLiveUpdate: number;
  stagedFavorites: Record<string, string>; savedVideos: Record<string, any>;
  playlist: any[]; playlistActive: any; playlistIsSaved: boolean;
  reportVideo: any; navDrawer: boolean; uploadPanel: boolean;
  visibilityState: string;
  reloadTrigger: { source?: string; consumed?: boolean; timestamp: number; defaultOpen?: string } | null;
  firstVisit: boolean; showOrgTip: boolean; showUpdateDetails: boolean; firstVisitMugen: boolean;
  activeSockets: number; showExtension: boolean;
  TPCookieEnabled: number | boolean | null; TPCookieAlertDismissed: boolean;
};

function normalizeSettings(input: Partial<Settings> = {}): Settings {
  return {
    lang: getUILang(input.lang),
    foolsLang: input.foolsLang || "",
    clipLangs: input.clipLangs?.length ? input.clipLangs : ["en"],
    darkMode: input.darkMode ?? true,
    followSystemTheme: input.followSystemTheme ?? false,
    defaultOpen: input.defaultOpen || "home",
    redirectMode: input.redirectMode ?? false,
    autoplayVideo: input.autoplayVideo ?? false,
    scrollMode: input.scrollMode ?? true,
    hideThumbnail: !!input.hideThumbnail,
    hidePlaceholder: !!input.hidePlaceholder,
    hideMissing: !!input.hideMissing,
    hideUpcoming: input.hideUpcoming ?? false,
    hideLive: input.hideLive ?? false,
    useEnglishName: input.useEnglishName ?? true,
    hideCollabStreams: input.hideCollabStreams ?? false,
    hiddenGroups: input.hiddenGroups || {},
    ignoredTopics: input.ignoredTopics || [],
    homeViewMode: input.homeViewMode || "grid",
    liveTlStickBottom: input.liveTlStickBottom ?? false,
    liveTlLang: input.liveTlLang || "en",
    liveTlFontSize: input.liveTlFontSize ?? 14,
    liveTlShowVerified: input.liveTlShowVerified ?? true,
    liveTlShowModerator: input.liveTlShowModerator ?? true,
    liveTlShowVtuber: input.liveTlShowVtuber ?? true,
    liveTlShowLocalTime: input.liveTlShowLocalTime ?? false,
    liveTlWindowSize: input.liveTlWindowSize ?? 0,
    liveTlShowSubtitle: input.liveTlShowSubtitle ?? true,
    liveTlHideSpoiler: input.liveTlHideSpoiler ?? false,
    liveTlBlocked: input.liveTlBlocked || [],
    blockedChannels: Array.isArray(input.blockedChannels) ? input.blockedChannels : [],
  };
}

const englishPrefs = new Set(["en", "es", "fr", "id", "pt", "de", "ru", "it"]);

function buildDefaultSettings(weblang = "en"): Settings {
  const lang = getLang(weblang);
  return normalizeSettings({ lang: getUILang(weblang), clipLangs: [lang], liveTlLang: lang, useEnglishName: englishPrefs.has(lang) });
}

const defaultState: State = {
  hydrated: false,
  settings: buildDefaultSettings("en"),
  userdata: { user: null, jwt: null },
  isMobile: true, windowWidth: 1440, currentGridSize: 1,
  currentOrg: { name: DEFAULT_ORG, short: "Holo" },
  selectedHomeOrgs: [DEFAULT_ORG],
  orgFavorites: [
    { name: ALL_VTUBERS_ORG, short: "Vtuber" },
    { name: DEFAULT_ORG, short: "Holo" },
    { name: "Nijisanji", short: "Niji" },
    { name: "Independents", short: "Indie" },
  ],
  orgs: [], homeLive: [], homeLoading: false, homeError: false,
  homeLastLiveUpdate: 0, homeLiveCacheKey: JSON.stringify([DEFAULT_ORG]),
  favorites: [], favoritesLive: [], favoritesLoading: false, favoritesError: false, favoritesLastLiveUpdate: 0,
  stagedFavorites: {}, savedVideos: {},
  playlist: [], playlistActive: emptyPlaylist(), playlistIsSaved: false,
  reportVideo: null, navDrawer: false, uploadPanel: false,
  visibilityState: "visible", reloadTrigger: null,
  firstVisit: true, showOrgTip: true, showUpdateDetails: false, firstVisitMugen: true,
  activeSockets: 0, showExtension: false,
  TPCookieEnabled: null, TPCookieAlertDismissed: false,
};

const StoreContext = createContext<any>(null);

const KEYS = { SETTINGS: "holodex-v2-settings", APP: "holodex-v2-app", ORGS: "holodex-v2-orgs", HOME: "holodex-v2-home", FAVS: "holodex-v2-favorites", LIB: "holodex-v2-library", PLAYLIST: "holodex-v2-playlist" };

const appPersist = (s: State) => ({
  firstVisit: s.firstVisit, showOrgTip: s.showOrgTip, showUpdateDetails: s.showUpdateDetails, firstVisitMugen: s.firstVisitMugen,
  userdata: s.userdata, currentOrg: s.currentOrg, selectedHomeOrgs: s.selectedHomeOrgs,
  orgFavorites: s.orgFavorites, currentGridSize: s.currentGridSize,
  TPCookieEnabled: s.TPCookieEnabled, TPCookieAlertDismissed: s.TPCookieAlertDismissed,
});

const normSelectedOrgs = (orgs: string[]) => [...new Set((orgs || []).filter((n) => n && n !== ALL_VTUBERS_ORG))];

const selectedOrgsFor = (s: State, org: Org) =>
  (s.selectedHomeOrgs?.length || 0) > 1 ? s.selectedHomeOrgs
    : org?.name && org.name !== ALL_VTUBERS_ORG ? [org.name] : [];

const liveCacheKey = (orgs: string[]) => {
  const t = (orgs || []).filter(Boolean);
  return JSON.stringify(t.length ? [...t].sort() : [ALL_VTUBERS_ORG]);
};

const countLiveVideos = (videos: any[]) => (videos || []).filter((v) => v?.status === "live").length;

function writeBootCookie(s: State) {
  if (typeof document === "undefined") return;
  const enc = encodeCookieJson({
    isMobile: s.isMobile, windowWidth: s.windowWidth, currentOrg: s.currentOrg,
    selectedHomeOrgs: s.selectedHomeOrgs, orgFavorites: s.orgFavorites, currentGridSize: s.currentGridSize,
    homeLiveCount: countLiveVideos(s.homeLive),
    favoritesLiveCount: countLiveVideos(s.favoritesLive),
    settings: {
      lang: s.settings.lang, defaultOpen: s.settings.defaultOpen,
      homeViewMode: s.settings.homeViewMode, scrollMode: s.settings.scrollMode,
      hideUpcoming: s.settings.hideUpcoming, hideLive: s.settings.hideLive,
      darkMode: s.settings.darkMode, followSystemTheme: s.settings.followSystemTheme,
    },
  });
  if (!enc) return;
  document.cookie = `${APP_BOOT_COOKIE}=${enc}; Path=/; Max-Age=31536000; SameSite=Lax`;
  setLocaleCookie(s.settings.lang);
}

function buildBootState(boot?: AppBootState | null): State {
  const selectedHomeOrgs = boot?.selectedHomeOrgs?.filter(Boolean) ?? defaultState.selectedHomeOrgs;
  return {
    ...defaultState,
    isMobile: boot?.isMobile ?? defaultState.isMobile,
    windowWidth: boot?.windowWidth ?? defaultState.windowWidth,
    settings: normalizeSettings({ ...defaultState.settings, ...(boot?.settings || {}) }),
    currentGridSize: boot?.currentGridSize ?? defaultState.currentGridSize,
    currentOrg: boot?.currentOrg?.name ? { ...boot.currentOrg, short: boot.currentOrg.short || boot.currentOrg.name } : defaultState.currentOrg,
    selectedHomeOrgs,
    orgFavorites: boot?.orgFavorites ?? defaultState.orgFavorites,
    homeLoading: true,
    homeLiveCacheKey: liveCacheKey(selectedHomeOrgs),
  };
}

function loadPersisted(base: State): State {
  if (typeof window === "undefined") return base;
  const settings = normalizeSettings(readJSON(KEYS.SETTINGS, buildDefaultSettings(navigator.language)));
  const home = readJSON(KEYS.HOME, { live: [], lastLiveUpdate: 0, liveCacheKey: JSON.stringify([DEFAULT_ORG]) });
  const fav = readJSON(KEYS.FAVS, { favorites: [], live: [], lastLiveUpdate: 0 });
  const app = readJSON(KEYS.APP, defaultState as any);
  const orgs = readJSON(KEYS.ORGS, { orgs: [] as any[] });
  const lib = readJSON(KEYS.LIB, { savedVideos: {} });
  const pl = readJSON(KEYS.PLAYLIST, { active: emptyPlaylist(), isSaved: false });
  const playlistActive = { ...emptyPlaylist(), ...(pl.active || {}), videos: pl.active?.videos || [] };
  const selectedHomeOrgs = Array.isArray(app.selectedHomeOrgs) ? app.selectedHomeOrgs : base.selectedHomeOrgs;
  return {
    ...base, hydrated: true, settings,
    isMobile: window.innerWidth < 960,
    windowWidth: window.innerWidth,
    visibilityState: document.visibilityState,
    currentGridSize: app.currentGridSize ?? defaultState.currentGridSize,
    currentOrg: app.currentOrg || base.currentOrg,
    selectedHomeOrgs,
    orgFavorites: app.orgFavorites || base.orgFavorites,
    userdata: app.userdata || base.userdata,
    firstVisit: app.firstVisit ?? base.firstVisit,
    showOrgTip: app.showOrgTip ?? base.showOrgTip,
    showUpdateDetails: app.showUpdateDetails ?? base.showUpdateDetails,
    firstVisitMugen: app.firstVisitMugen ?? base.firstVisitMugen,
    TPCookieEnabled: app.TPCookieEnabled ?? base.TPCookieEnabled,
    TPCookieAlertDismissed: app.TPCookieAlertDismissed ?? base.TPCookieAlertDismissed,
    orgs: orgs.orgs || [],
    homeLive: home.live || [],
    homeLoading: !(home.live || []).length,
    homeLastLiveUpdate: home.lastLiveUpdate || 0,
    homeLiveCacheKey: home.liveCacheKey || liveCacheKey(selectedHomeOrgs),
    favorites: fav.favorites || [],
    favoritesLive: fav.live || [],
    favoritesLoading: !!(app.userdata?.jwt && !(fav.live || []).length),
    favoritesLastLiveUpdate: fav.lastLiveUpdate || 0,
    savedVideos: lib.savedVideos || {},
    playlist: playlistActive.videos || [],
    playlistActive,
    playlistIsSaved: !!pl.isSaved,
  };
}

const liveFingerprint = (arr: any[]) => (arr || []).map((v) => `${v.id}:${v.status}:${getLiveViewerCount(v)}`).join(",");

export function AppStateProvider({ children, initialBootState }: { children: React.ReactNode; initialBootState?: AppBootState | null }) {
  const [state, setState] = useState<State>(() => buildBootState(initialBootState));
  const stateRef = useRef(state);
  const homeInflight = useRef<Promise<void> | null>(null);
  const favsInflight = useRef<Promise<void> | null>(null);
  const favTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const homeSeq = useRef(0);
  const orgsInflight = useRef<Promise<any[]> | null>(null);

  useLayoutEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => () => { if (favTimer.current) clearTimeout(favTimer.current); }, []);

  useLayoutEffect(() => {
    if (stateRef.current.hydrated) return;
    const next = loadPersisted(stateRef.current);
    stateRef.current = next;
    writeBootCookie(next);
    setState(next);
  }, []);

  const { hydrated } = state;
  useEffect(() => { if (hydrated) { writeJSON(KEYS.SETTINGS, state.settings); writeBootCookie(state); } }, [hydrated, state.settings]);
  useEffect(() => { if (hydrated) { writeJSON(KEYS.APP, appPersist(state)); writeBootCookie(state); } }, [hydrated, state.firstVisit, state.showOrgTip, state.showUpdateDetails, state.firstVisitMugen, state.currentOrg, state.selectedHomeOrgs, state.orgFavorites, state.currentGridSize, state.userdata, state.TPCookieEnabled, state.TPCookieAlertDismissed]);
  useEffect(() => { if (hydrated) writeBootCookie(state); }, [hydrated, state.isMobile, state.windowWidth]);
  useEffect(() => { if (hydrated) writeJSON(KEYS.ORGS, { orgs: state.orgs }); }, [hydrated, state.orgs]);
  useEffect(() => {
    if (hydrated) {
      writeJSON(KEYS.HOME, { live: state.homeLive, lastLiveUpdate: state.homeLastLiveUpdate, liveCacheKey: state.homeLiveCacheKey });
      writeBootCookie(state);
    }
  }, [hydrated, state.homeLive, state.homeLastLiveUpdate, state.homeLiveCacheKey]);
  useEffect(() => {
    if (hydrated) {
      writeJSON(KEYS.FAVS, { favorites: state.favorites, live: state.favoritesLive, lastLiveUpdate: state.favoritesLastLiveUpdate });
      writeBootCookie(state);
    }
  }, [hydrated, state.favorites, state.favoritesLive, state.favoritesLastLiveUpdate]);
  useEffect(() => { if (hydrated) writeJSON(KEYS.LIB, { savedVideos: state.savedVideos }); }, [hydrated, state.savedVideos]);
  useEffect(() => { if (hydrated) writeJSON(KEYS.PLAYLIST, { active: { ...state.playlistActive, videos: state.playlist }, isSaved: state.playlistIsSaved }); }, [hydrated, state.playlist, state.playlistActive, state.playlistIsSaved]);

  const orgUpdate = (s: State, patch: Partial<State>): State => ({ ...s, ...patch, homeLastLiveUpdate: 0 });

  const setPlaylist = (updater: (videos: any[], s: State) => any[], markUnsaved = true) =>
    setState((s) => {
      const videos = updater(s.playlist, s);
      return { ...s, playlist: videos, playlistActive: { ...s.playlistActive, videos }, ...(markUnsaved && { playlistIsSaved: false }) };
    });

  const logout = () => {
    setCookieJWT(null);
    sendTokenToExtension(null);
    const reset = { userdata: { user: null, jwt: null }, favorites: [], favoritesLive: [], favoritesLastLiveUpdate: 0 };
    stateRef.current = { ...stateRef.current, ...reset };
    setState((s) => ({ ...s, ...reset }));
  };

  const fetchFavoritesLive = (opts: { force?: boolean; minutes?: number } = {}) => {
    const current = stateRef.current;
    const { jwt } = current.userdata;
    if (!jwt || (current.visibilityState === "hidden" && !opts.force)) return null;
    if (favsInflight.current) return favsInflight.current;
    const { force = false, minutes = 2 } = opts;
    if (!current.favoritesError && !force && current.favoritesLastLiveUpdate && Date.now() - current.favoritesLastLiveUpdate <= minutes * 60_000) {
      setState((s) => ({ ...s, favoritesError: false, favoritesLoading: false }));
      return null;
    }
    setState((s) => ({ ...s, favoritesLoading: s.favoritesLive.length === 0, favoritesError: false }));
    const p = api.favoritesLive({ includePlaceholder: true }, jwt)
      .then(async (res: any[]) => {
        const merged = await enrichLiveVideosWithTwitchViewerCounts(res);
        merged.sort(videoTemporalComparator);
        setState((s) => ({
          ...s,
          favoritesLive: liveFingerprint(merged) !== liveFingerprint(s.favoritesLive) ? merged : s.favoritesLive,
          favoritesLastLiveUpdate: Date.now(), favoritesLoading: false, favoritesError: false,
        }));
      })
      .catch((e) => { console.error(e); setState((s) => ({ ...s, favoritesError: true, favoritesLoading: false })); })
      .finally(() => { favsInflight.current = null; });
    favsInflight.current = p;
    return p;
  };

  const favoriteChannelIDs = new Set(state.favorites.map((f) => f.id));
  const store = {
    ...state,
    isLoggedIn: !!state.userdata.jwt,
    isSuperuser: ["admin", "editor"].includes(state.userdata.user?.role),
    favoriteChannelIDs,
    blockedChannelIDs: new Set(state.settings.blockedChannels.map((x: any) => x.id).filter(Boolean)),
    ignoredTopicsSet: new Set(state.settings.ignoredTopics || []),
    isFavorited: (id: string) =>
      state.stagedFavorites[id] === "add" || (favoriteChannelIDs.has(id) && state.stagedFavorites[id] !== "remove"),

    patchSettings: (patch: Partial<Settings>) => setState((s) => {
      const settings = normalizeSettings({ ...s.settings, ...patch });
      writeJSON(KEYS.SETTINGS, settings);
      const next = { ...s, settings };
      if (next.hydrated) writeBootCookie(next);
      return next;
    }),
    setIsMobile: (v: boolean) => setState((s) => { const n = { ...s, isMobile: v }; if (n.hydrated) writeBootCookie(n); return n; }),
    setWindowWidth: (v: number) => setState((s) => { const n = { ...s, windowWidth: v }; if (n.hydrated) writeBootCookie(n); return n; }),
    setCurrentGridSize: (v: number) => setState((s) => ({ ...s, currentGridSize: v })),
    setCurrentOrg: (org: Org) => setState((s) => orgUpdate(s, { currentOrg: org, selectedHomeOrgs: selectedOrgsFor(s, org) })),
    setSelectedHomeOrgs: (orgs: string[]) => setState((s) => orgUpdate(s, { selectedHomeOrgs: normSelectedOrgs(orgs) })),
    toggleSelectedHomeOrg: (org: string) => setState((s) => {
      const selectedHomeOrgs = !org || org === ALL_VTUBERS_ORG ? []
        : s.selectedHomeOrgs.includes(org) ? s.selectedHomeOrgs.filter((x) => x !== org)
        : [...s.selectedHomeOrgs, org];
      return orgUpdate(s, { selectedHomeOrgs });
    }),

    fetchOrgs: async () => {
      const current = stateRef.current.orgs || [];
      const loadFresh = () => orgsInflight.current ?? (orgsInflight.current = api.orgs()
        .then((fresh: any) => {
          const arr = Array.isArray(fresh) ? fresh : Object.values(fresh || {}) as any[];
          const sorted = [...arr].sort((a, b) => a.name.toLowerCase().charCodeAt(0) - b.name.toLowerCase().charCodeAt(0));
          return [{ name: ALL_VTUBERS_ORG, short: "Vtuber", name_jp: null }, ...sorted];
        })
        .finally(() => { orgsInflight.current = null; }));
      if (current.length > 0) {
        loadFresh().then((withAll) => {
          if (JSON.stringify(withAll.map((o: any) => o.name)) !== JSON.stringify(stateRef.current.orgs.map((o: any) => o.name))) {
            setState((s) => ({ ...s, orgs: withAll }));
          }
        }).catch(() => {});
        return current;
      }
      try {
        const withAll = await loadFresh();
        setState((s) => ({ ...s, orgs: withAll }));
        stateRef.current = { ...stateRef.current, orgs: withAll };
        return withAll;
      } catch { return []; }
    },

    fetchHomeLive: (opts: { force?: boolean; minutes?: number } = {}) => {
      const current = stateRef.current;
      if (current.visibilityState === "hidden" && !opts.force) return null;
      const { force = false, minutes = 5 } = opts;
      const orgTargets = current.selectedHomeOrgs.length ? current.selectedHomeOrgs : [ALL_VTUBERS_ORG];
      const nextKey = liveCacheKey(orgTargets);
      const cacheChanged = current.homeLiveCacheKey !== nextKey;
      if (homeInflight.current && !cacheChanged) return homeInflight.current;
      const lastUpdate = cacheChanged ? 0 : current.homeLastLiveUpdate;
      if (!force && lastUpdate && Date.now() - lastUpdate < minutes * 60_000 && !current.homeError) return null;
      setState((s) => ({
        ...s,
        homeLive: cacheChanged ? [] : s.homeLive,
        homeLastLiveUpdate: cacheChanged ? 0 : s.homeLastLiveUpdate,
        homeLiveCacheKey: nextKey,
        homeLoading: cacheChanged || s.homeLive.length === 0,
        homeError: false,
      }));
      const seq = ++homeSeq.current;
      const isCurrent = () => seq === homeSeq.current;
      const p = api.allLive(orgTargets, { type: "placeholder,stream", include: "mentions" })
        .then(async (res: any[]) => {
          if (!isCurrent()) return;
          const merged = dedupeVideos(await enrichLiveVideosWithTwitchViewerCounts(res));
          merged.sort(videoTemporalComparator);
          if (!isCurrent()) return;
          setState((s) => ({
            ...s,
            homeLive: liveFingerprint(merged) !== liveFingerprint(s.homeLive) ? merged : s.homeLive,
            homeLastLiveUpdate: Date.now(), homeLoading: false, homeError: false,
          }));
        })
        .catch((e) => { if (!isCurrent()) return; console.error(e); setState((s) => ({ ...s, homeError: true, homeLoading: false })); })
        .finally(() => { if (isCurrent()) homeInflight.current = null; });
      homeInflight.current = p;
      return p;
    },

    fetchFavorites: () => {
      if (!state.userdata.jwt) return null;
      return api.favorites(state.userdata.jwt)
        .then((res: any) => setState((s) => ({ ...s, favorites: res.data || [] })))
        .catch(console.error);
    },

    fetchFavoritesLive,

    resetFavorites: async () => {
      setState((s) => ({ ...s, favoritesLive: [], favoritesLoading: true, favoritesError: false, favoritesLastLiveUpdate: 0, stagedFavorites: {} }));
      const jwt = stateRef.current.userdata.jwt;
      if (!jwt) {
        setState((s) => ({ ...s, favorites: [], favoritesLive: [], favoritesLastLiveUpdate: 0, favoritesLoading: false }));
        sendTokenToExtension(null);
        return;
      }
      sendTokenToExtension(jwt);
      try {
        const [fav, live] = await Promise.all([api.favorites(jwt), api.favoritesLive({ includePlaceholder: true }, jwt)]);
        setState((s) => ({ ...s, favorites: fav.data || [] }));
        const merged = await enrichLiveVideosWithTwitchViewerCounts(live);
        merged.sort(videoTemporalComparator);
        setState((s) => ({ ...s, favoritesLive: merged, favoritesLastLiveUpdate: Date.now(), favoritesLoading: false, favoritesError: false }));
      } catch (e) {
        console.error(e);
        setState((s) => ({ ...s, favoritesLoading: false, favoritesError: true }));
      }
    },

    toggleFavorite: (id: string) => {
      setState((s) => {
        const staged = { ...s.stagedFavorites };
        if (staged[id]) delete staged[id];
        else if (s.favorites.some((f) => f.id === id)) staged[id] = "remove";
        else staged[id] = "add";
        return { ...s, stagedFavorites: staged };
      });
      if (favTimer.current) clearTimeout(favTimer.current);
      favTimer.current = setTimeout(() => {
        favTimer.current = null;
        const cur = stateRef.current;
        const ops = Object.entries(cur.stagedFavorites || {}).map(([channel_id, op]) => ({ op, channel_id }));
        if (!ops.length || !cur.userdata.jwt) return;
        api.patchFavorites(cur.userdata.jwt, ops)
          .catch((e: any) => { console.error(e); return e?.response || false; })
          .then((res: any) => {
            if (res?.status === 200) {
              setState((s) => ({ ...s, favorites: res.data, stagedFavorites: {} }));
              fetchFavoritesLive({ force: true });
              sendFavoritesToExtension(res.data);
            } else if (res) throw new Error("Error while adding favorite");
          })
          .finally(() => setState((s) => ({ ...s, stagedFavorites: {} })));
      }, 2000);
    },

    addSavedVideo: (video: any) => video?.id && setState((s) => ({
      ...s, savedVideos: { ...s.savedVideos, [video.id]: { ...video, added_at: video.added_at || new Date().toISOString() } },
    })),
    removeSavedVideo: (id: string) => setState((s) => { const n = { ...s.savedVideos }; delete n[id]; return { ...s, savedVideos: n }; }),

    addToPlaylist: (v: any) => v?.id && setPlaylist((p) => p.some((x) => x.id === v.id) ? p : [...p, v]),
    removeFromPlaylist: (id: string) => setPlaylist((p) => p.filter((v) => v.id !== id)),
    removeFromPlaylistByIndex: (i: number) => setPlaylist((p) => p.filter((_, idx) => idx !== i), false),
    reorderPlaylist: ({ from, to }: { from: number; to: number }) => setPlaylist((p) => {
      if (from === to || from < 0 || to < 0 || from >= p.length || to >= p.length) return p;
      const n = [...p];
      const [moved] = n.splice(from, 1);
      n.splice(to, 0, moved);
      return n;
    }),
    clearPlaylist: () => setPlaylist(() => []),
    setActivePlaylist: (pl: any, saved = false) => setState((s) => {
      const active = { ...emptyPlaylist(), ...pl, videos: pl?.videos || [] };
      return { ...s, playlist: active.videos, playlistActive: active, playlistIsSaved: saved };
    }),
    setPlaylistName: (name: string) => name && setState((s) => ({ ...s, playlistActive: { ...s.playlistActive, name }, playlistIsSaved: false })),
    resetPlaylist: () => setState((s) => ({ ...s, playlist: [], playlistActive: emptyPlaylist() })),
    markPlaylistModified: () => setState((s) => ({ ...s, playlistIsSaved: false })),
    saveActivePlaylist: async () => {
      const { jwt, user } = state.userdata;
      if (!jwt || !user) return;
      const pl = { ...state.playlistActive, videos: state.playlist };
      if (!pl.user_id || !pl.id) pl.user_id = user.id;
      else if (`${pl.user_id}` !== `${user.id}`) { delete pl.id; pl.user_id = user.id; }
      setState((s) => ({ ...s, playlistActive: pl, playlistIsSaved: false }));
      const res = await api.savePlaylist({ ...pl, videos: [], video_ids: pl.videos.map((x: any) => x.id) }, jwt);
      if (res.data) setState((s) => ({ ...s, playlistActive: { ...pl, id: pl.id || res.data }, playlistIsSaved: true }));
    },
    setActivePlaylistByID: async (id: number | string) => {
      const res = await api.getPlaylist(id);
      const active = { ...emptyPlaylist(), ...res.data, videos: res.data?.videos || [] };
      setState((s) => ({ ...s, playlist: active.videos, playlistActive: active, playlistIsSaved: true }));
    },
    deleteActivePlaylist: async () => {
      const { jwt, user } = state.userdata;
      const a = state.playlistActive;
      if (a?.id && jwt && `${a.user_id}` === `${user?.id}`) await api.deletePlaylist(a.id, jwt);
      setState((s) => ({ ...s, playlist: [], playlistActive: emptyPlaylist() }));
    },

    setReportVideo: (v: any) => setState((s) => ({ ...s, reportVideo: v })),
    setNavDrawer: (v: boolean) => setState((s) => ({ ...s, navDrawer: v })),
    setUploadPanel: (v: boolean) => setState((s) => ({ ...s, uploadPanel: v })),

    loginCheck: async () => {
      const jwt = state.userdata.jwt;
      if (!jwt) return null;
      const { exp } = jwtDecode<{ exp: number }>(jwt);
      if (exp - Date.now() / 1000 < 0) logout();
      else { sendTokenToExtension(jwt); setCookieJWT(jwt); }
    },
    loginVerify: async (opts?: { bounceToLogin?: boolean }) => {
      const jwt = state.userdata.jwt;
      if (!jwt) return;
      const v: any = await api.loginIsValid(jwt);
      if (v?.status === 200) {
        setCookieJWT(v.data.jwt);
        setState((s) => ({ ...s, userdata: { user: v.data.user, jwt: v.data.jwt } }));
      } else if (v?.status === 401) {
        logout();
        if (opts?.bounceToLogin) { openUserMenu(); window.location.href = "/"; }
      } else console.error("Login credentials did not respond with a good message? Maybe server is down.");
    },
    logout,
    setUser: (data: { user: any; jwt: string | null }) => {
      setCookieJWT(data.jwt);
      const userdata = { user: data.user, jwt: data.jwt };
      stateRef.current = { ...stateRef.current, userdata };
      setState((s) => ({ ...s, userdata }));
    },
    setVisibilityState: (v: string) => setState((s) => ({ ...s, visibilityState: v })),
    reloadCurrentPage: async (consumed: any = {}) => {
      setState((s) => ({ ...s, reloadTrigger: { ...(consumed || {}), timestamp: Date.now() } }));
      return consumed;
    },
    setShowUpdatesDetail: (v: boolean) => setState((s) => ({ ...s, showUpdateDetails: v })),
  };

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useAppState must be used under AppStateProvider");
  return ctx;
}
