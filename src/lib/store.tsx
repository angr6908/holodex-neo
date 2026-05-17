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
  lang: string;
  foolsLang: string;
  clipLangs: string[];
  darkMode: boolean;
  followSystemTheme: boolean;
  defaultOpen: "home" | "favorites" | "multiview";
  redirectMode: boolean;
  autoplayVideo: boolean;
  scrollMode: boolean;
  hideThumbnail: boolean;
  hidePlaceholder: boolean;
  hideMissing: boolean;
  hideUpcoming: boolean;
  hideLive: boolean;
  useEnglishName: boolean;
  hideCollabStreams: boolean;
  hiddenGroups: Record<string, string[]>;
  ignoredTopics: string[];
  homeViewMode: "grid" | "list" | "denseList";
  liveTlStickBottom: boolean;
  liveTlLang: string;
  liveTlFontSize: number;
  liveTlShowVerified: boolean;
  liveTlShowModerator: boolean;
  liveTlShowVtuber: boolean;
  liveTlShowLocalTime: boolean;
  liveTlWindowSize: number;
  liveTlShowSubtitle: boolean;
  liveTlHideSpoiler: boolean;
  liveTlBlocked: string[];
  blockedChannels: any[];
};

const emptyPlaylist = () => ({ id: undefined, user_id: undefined, name: "Unnamed Playlist", videos: [] as any[], updated_at: undefined });

type State = {
  hydrated: boolean;
  settings: Settings;
  userdata: { user: any; jwt: string | null };
  isMobile: boolean;
  windowWidth: number;
  currentGridSize: number;
  currentOrg: Org;
  selectedHomeOrgs: string[];
  orgFavorites: Org[];
  orgs: Org[];
  homeLive: any[];
  homeLoading: boolean;
  homeError: boolean;
  homeLastLiveUpdate: number;
  homeLiveCacheKey: string;
  favorites: any[];
  favoritesLive: any[];
  favoritesLoading: boolean;
  favoritesError: boolean;
  favoritesLastLiveUpdate: number;
  stagedFavorites: Record<string, string>;
  savedVideos: Record<string, any>;
  playlist: any[];
  playlistActive: any;
  playlistIsSaved: boolean;
  reportVideo: any;
  navDrawer: boolean;
  uploadPanel: boolean;
  visibilityState: string;
  reloadTrigger: { source?: string; consumed?: boolean; timestamp: number; defaultOpen?: string } | null;
  firstVisit: boolean;
  showOrgTip: boolean;
  showUpdateDetails: boolean;
  firstVisitMugen: boolean;
  lastShownInstallPrompt: number;
  activeSockets: number;
  showExtension: boolean;
  TPCookieEnabled: number | boolean | null;
  TPCookieAlertDismissed: boolean;
};

function normalizeSettings(input: Partial<Settings> = {}): Settings {
  return {
    lang: input.lang || "en",
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

const englishNamePrefs = new Set(["en", "es", "fr", "id", "pt", "de", "ru", "it"]);

function buildDefaultSettings(userLanguage = "en"): Settings {
  const lang = getLang(userLanguage);
  return normalizeSettings({
    lang: getUILang(userLanguage),
    clipLangs: [lang],
    liveTlLang: lang,
    useEnglishName: englishNamePrefs.has(lang),
  });
}

const defaultState: State = {
  hydrated: false,
  settings: buildDefaultSettings("en"),
  userdata: { user: null, jwt: null },
  isMobile: true,
  windowWidth: 1440,
  currentGridSize: 0,
  currentOrg: { name: DEFAULT_ORG, short: "Holo" },
  selectedHomeOrgs: [DEFAULT_ORG],
  orgFavorites: [
    { name: ALL_VTUBERS_ORG, short: "Vtuber" },
    { name: DEFAULT_ORG, short: "Holo" },
    { name: "Nijisanji", short: "Niji" },
    { name: "Independents", short: "Indie" },
  ],
  orgs: [],
  homeLive: [],
  homeLoading: false,
  homeError: false,
  homeLastLiveUpdate: 0,
  homeLiveCacheKey: JSON.stringify([DEFAULT_ORG]),
  favorites: [],
  favoritesLive: [],
  favoritesLoading: false,
  favoritesError: false,
  favoritesLastLiveUpdate: 0,
  stagedFavorites: {},
  savedVideos: {},
  playlist: [],
  playlistActive: emptyPlaylist(),
  playlistIsSaved: false,
  reportVideo: null,
  navDrawer: false,
  uploadPanel: false,
  visibilityState: "visible",
  reloadTrigger: null,
  firstVisit: true,
  showOrgTip: true,
  showUpdateDetails: false,
  firstVisitMugen: true,
  lastShownInstallPrompt: 0,
  activeSockets: 0,
  showExtension: false,
  TPCookieEnabled: null,
  TPCookieAlertDismissed: false,
};

const StoreContext = createContext<any>(null);

const KEY_SETTINGS = "holodex-v2-settings";
const KEY_APP = "holodex-v2-app";
const KEY_ORGS = "holodex-v2-orgs";
const KEY_HOME = "holodex-v2-home";
const KEY_FAVS = "holodex-v2-favorites";
const KEY_LIB = "holodex-v2-library";
const KEY_PLAYLIST = "holodex-v2-playlist";

const appPersist = (s: State) => ({
  firstVisit: s.firstVisit, showOrgTip: s.showOrgTip, showUpdateDetails: s.showUpdateDetails,
  firstVisitMugen: s.firstVisitMugen, lastShownInstallPrompt: s.lastShownInstallPrompt,
  userdata: s.userdata, currentOrg: s.currentOrg, selectedHomeOrgs: s.selectedHomeOrgs,
  orgFavorites: s.orgFavorites, currentGridSize: s.currentGridSize,
  TPCookieEnabled: s.TPCookieEnabled, TPCookieAlertDismissed: s.TPCookieAlertDismissed,
});

const normSelectedOrgs = (orgs: string[]) =>
  [...new Set((orgs || []).filter((n) => n && n !== ALL_VTUBERS_ORG))];

const selectedOrgsFor = (state: State, org: Org) =>
  (state.selectedHomeOrgs?.length || 0) > 1 ? state.selectedHomeOrgs
    : org?.name && org.name !== ALL_VTUBERS_ORG ? [org.name] : [];

const liveCacheKey = (orgs: string[]) => {
  const t = (orgs || []).filter(Boolean);
  return JSON.stringify(t.length ? [...t].sort() : [ALL_VTUBERS_ORG]);
};

function writeBootCookie(state: State) {
  if (typeof document === "undefined") return;
  const encoded = encodeCookieJson({
    isMobile: state.isMobile, windowWidth: state.windowWidth, currentOrg: state.currentOrg,
    selectedHomeOrgs: state.selectedHomeOrgs, orgFavorites: state.orgFavorites,
    currentGridSize: state.currentGridSize,
    settings: {
      lang: state.settings.lang, defaultOpen: state.settings.defaultOpen,
      homeViewMode: state.settings.homeViewMode, scrollMode: state.settings.scrollMode,
      hideUpcoming: state.settings.hideUpcoming, hideLive: state.settings.hideLive,
      darkMode: state.settings.darkMode, followSystemTheme: state.settings.followSystemTheme,
    },
  });
  if (!encoded) return;
  document.cookie = `${APP_BOOT_COOKIE}=${encoded}; Path=/; Max-Age=31536000; SameSite=Lax`;
  setLocaleCookie(state.settings.lang);
}

function buildBootState(boot?: AppBootState | null): State {
  const selectedHomeOrgs = boot?.selectedHomeOrgs?.filter(Boolean) ?? defaultState.selectedHomeOrgs;
  return {
    ...defaultState,
    isMobile: boot?.isMobile ?? defaultState.isMobile,
    windowWidth: boot?.windowWidth ?? defaultState.windowWidth,
    settings: normalizeSettings({ ...defaultState.settings, ...(boot?.settings || {}) }),
    currentGridSize: boot?.currentGridSize ?? defaultState.currentGridSize,
    currentOrg: boot?.currentOrg?.name
      ? { ...boot.currentOrg, short: boot.currentOrg.short || boot.currentOrg.name }
      : defaultState.currentOrg,
    selectedHomeOrgs,
    orgFavorites: boot?.orgFavorites ?? defaultState.orgFavorites,
    homeLoading: true,
    homeLiveCacheKey: liveCacheKey(selectedHomeOrgs),
  };
}

function loadBrowserPersistedState(base: State): State {
  if (typeof window === "undefined") return base;
  const settings = normalizeSettings(readJSON(KEY_SETTINGS, buildDefaultSettings(navigator.language)));
  const home = readJSON(KEY_HOME, { live: [], lastLiveUpdate: 0, liveCacheKey: JSON.stringify([DEFAULT_ORG]) });
  const fav = readJSON(KEY_FAVS, { favorites: [], live: [], lastLiveUpdate: 0 });
  const app = readJSON(KEY_APP, defaultState as any);
  const orgsPersisted = readJSON(KEY_ORGS, { orgs: [] as any[] });
  const library = readJSON(KEY_LIB, { savedVideos: {} });
  const pl = readJSON(KEY_PLAYLIST, { active: emptyPlaylist(), isSaved: false });
  const playlistActive = { ...emptyPlaylist(), ...(pl.active || {}), videos: pl.active?.videos || [] };
  const selectedHomeOrgs = Array.isArray(app.selectedHomeOrgs) ? app.selectedHomeOrgs : base.selectedHomeOrgs;
  return {
    ...base, hydrated: true, settings,
    isMobile: window.innerWidth < 960,
    windowWidth: window.innerWidth,
    visibilityState: document.visibilityState,
    currentGridSize: app.currentGridSize || 0,
    currentOrg: app.currentOrg || base.currentOrg,
    selectedHomeOrgs,
    orgFavorites: app.orgFavorites || base.orgFavorites,
    userdata: app.userdata || base.userdata,
    firstVisit: app.firstVisit ?? base.firstVisit,
    showOrgTip: app.showOrgTip ?? base.showOrgTip,
    showUpdateDetails: app.showUpdateDetails ?? base.showUpdateDetails,
    firstVisitMugen: app.firstVisitMugen ?? base.firstVisitMugen,
    lastShownInstallPrompt: app.lastShownInstallPrompt || 0,
    TPCookieEnabled: app.TPCookieEnabled ?? base.TPCookieEnabled,
    TPCookieAlertDismissed: app.TPCookieAlertDismissed ?? base.TPCookieAlertDismissed,
    orgs: orgsPersisted.orgs || [],
    homeLive: home.live || [],
    homeLoading: !(home.live || []).length,
    homeLastLiveUpdate: home.lastLiveUpdate || 0,
    homeLiveCacheKey: home.liveCacheKey || liveCacheKey(selectedHomeOrgs),
    favorites: fav.favorites || [],
    favoritesLive: fav.live || [],
    favoritesLoading: !!(app.userdata?.jwt && !(fav.live || []).length),
    favoritesLastLiveUpdate: fav.lastLiveUpdate || 0,
    savedVideos: library.savedVideos || {},
    playlist: playlistActive.videos || [],
    playlistActive,
    playlistIsSaved: !!pl.isSaved,
  };
}

const liveFingerprint = (arr: any[]) =>
  (arr || []).map((v) => `${v.id}:${v.status}:${getLiveViewerCount(v)}`).join(",");

export function AppStateProvider({ children, initialBootState }: { children: React.ReactNode; initialBootState?: AppBootState | null }) {
  const [state, setState] = useState<State>(() => buildBootState(initialBootState));
  const [homeInflight, setHomeInflight] = useState<Promise<void> | null>(null);
  const [favsInflight, setFavsInflight] = useState<Promise<void> | null>(null);
  const stateRef = useRef(state);
  const favoriteFlushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const homeFetchSeq = useRef(0);
  const orgsInflight = useRef<Promise<any[]> | null>(null);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => () => { if (favoriteFlushTimer.current) clearTimeout(favoriteFlushTimer.current); }, []);

  useLayoutEffect(() => {
    if (stateRef.current.hydrated) return;
    const next = loadBrowserPersistedState(stateRef.current);
    stateRef.current = next;
    writeBootCookie(next);
    setState(next);
  }, []);

  const { hydrated } = state;
  useEffect(() => { if (hydrated) { writeJSON(KEY_SETTINGS, state.settings); writeBootCookie(state); } }, [hydrated, state.settings]);
  useEffect(() => { if (hydrated) { writeJSON(KEY_APP, appPersist(state)); writeBootCookie(state); } }, [hydrated, state.firstVisit, state.showOrgTip, state.showUpdateDetails, state.firstVisitMugen, state.lastShownInstallPrompt, state.currentOrg, state.selectedHomeOrgs, state.orgFavorites, state.currentGridSize, state.userdata, state.TPCookieEnabled, state.TPCookieAlertDismissed]);
  useEffect(() => { if (hydrated) writeBootCookie(state); }, [hydrated, state.isMobile, state.windowWidth]);
  useEffect(() => { if (hydrated) writeJSON(KEY_ORGS, { orgs: state.orgs }); }, [hydrated, state.orgs]);
  useEffect(() => { if (hydrated) writeJSON(KEY_HOME, { live: state.homeLive, lastLiveUpdate: state.homeLastLiveUpdate, liveCacheKey: state.homeLiveCacheKey }); }, [hydrated, state.homeLive, state.homeLastLiveUpdate, state.homeLiveCacheKey]);
  useEffect(() => { if (hydrated) writeJSON(KEY_FAVS, { favorites: state.favorites, live: state.favoritesLive, lastLiveUpdate: state.favoritesLastLiveUpdate }); }, [hydrated, state.favorites, state.favoritesLive, state.favoritesLastLiveUpdate]);
  useEffect(() => { if (hydrated) writeJSON(KEY_LIB, { savedVideos: state.savedVideos }); }, [hydrated, state.savedVideos]);
  useEffect(() => { if (hydrated) writeJSON(KEY_PLAYLIST, { active: { ...state.playlistActive, videos: state.playlist }, isSaved: state.playlistIsSaved }); }, [hydrated, state.playlist, state.playlistActive, state.playlistIsSaved]);

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
    const { jwt } = state.userdata;
    if (!jwt || (state.visibilityState === "hidden" && !opts.force)) return null;
    if (favsInflight) return favsInflight;
    const { force = false, minutes = 2 } = opts;
    if (!state.favoritesError && !force && state.favoritesLastLiveUpdate && Date.now() - state.favoritesLastLiveUpdate <= minutes * 60_000) {
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
      .finally(() => setFavsInflight(null));
    setFavsInflight(p);
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
    isFavorited: (channelId: string) =>
      state.stagedFavorites[channelId] === "add"
      || (favoriteChannelIDs.has(channelId) && state.stagedFavorites[channelId] !== "remove"),

    patchSettings: (patch: Partial<Settings>) => setState((s) => {
      const settings = normalizeSettings({ ...s.settings, ...patch });
      writeJSON(KEY_SETTINGS, settings);
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
          const sorted = [...arr].sort((a: any, b: any) => a.name.toLowerCase().charCodeAt(0) - b.name.toLowerCase().charCodeAt(0));
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
      if (state.visibilityState === "hidden" && !opts.force) return null;
      const { force = false, minutes = 5 } = opts;
      const orgTargets = state.selectedHomeOrgs.length ? state.selectedHomeOrgs : [ALL_VTUBERS_ORG];
      const nextKey = liveCacheKey(orgTargets);
      const cacheChanged = state.homeLiveCacheKey !== nextKey;
      if (homeInflight && !cacheChanged) return homeInflight;
      const lastUpdate = cacheChanged ? 0 : state.homeLastLiveUpdate;
      if (!force && lastUpdate && Date.now() - lastUpdate < minutes * 60_000 && !state.homeError) return null;
      setState((s) => ({
        ...s,
        homeLive: cacheChanged ? [] : s.homeLive,
        homeLastLiveUpdate: cacheChanged ? 0 : s.homeLastLiveUpdate,
        homeLiveCacheKey: nextKey,
        homeLoading: cacheChanged || s.homeLive.length === 0,
        homeError: false,
      }));
      const seq = ++homeFetchSeq.current;
      const stillCurrent = () => seq === homeFetchSeq.current;
      const p = api.allLive(orgTargets, { type: "placeholder,stream", include: "mentions" })
        .then(async (res: any[]) => {
          if (!stillCurrent()) return;
          const merged = dedupeVideos(await enrichLiveVideosWithTwitchViewerCounts(res));
          merged.sort(videoTemporalComparator);
          if (!stillCurrent()) return;
          setState((s) => ({
            ...s,
            homeLive: liveFingerprint(merged) !== liveFingerprint(s.homeLive) ? merged : s.homeLive,
            homeLastLiveUpdate: Date.now(), homeLoading: false, homeError: false,
          }));
        })
        .catch((e) => { if (!stillCurrent()) return; console.error(e); setState((s) => ({ ...s, homeError: true, homeLoading: false })); })
        .finally(() => { if (stillCurrent()) setHomeInflight(null); });
      setHomeInflight(p);
      return p;
    },

    fetchFavorites: () => {
      if (!state.userdata.jwt) return null;
      return api.favorites(state.userdata.jwt)
        .then((res: any) => setState((s) => ({ ...s, favorites: res.data || [] })))
        .catch((e) => console.error(e));
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

    toggleFavorite: (channelId: string) => {
      setState((s) => {
        const stagedFavorites = { ...s.stagedFavorites };
        if (stagedFavorites[channelId]) delete stagedFavorites[channelId];
        else if (s.favorites.some((f) => f.id === channelId)) stagedFavorites[channelId] = "remove";
        else stagedFavorites[channelId] = "add";
        return { ...s, stagedFavorites };
      });
      if (favoriteFlushTimer.current) clearTimeout(favoriteFlushTimer.current);
      favoriteFlushTimer.current = setTimeout(() => {
        favoriteFlushTimer.current = null;
        const current = stateRef.current;
        const operations = Object.entries(current.stagedFavorites || {}).map(([channel_id, op]) => ({ op, channel_id }));
        if (!operations.length || !current.userdata.jwt) return;
        api.patchFavorites(current.userdata.jwt, operations)
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
    removeSavedVideo: (videoId: string) => setState((s) => {
      const next = { ...s.savedVideos };
      delete next[videoId];
      return { ...s, savedVideos: next };
    }),

    addToPlaylist: (video: any) => video?.id && setPlaylist((p) => p.some((v) => v.id === video.id) ? p : [...p, video]),
    removeFromPlaylist: (videoId: string) => setPlaylist((p) => p.filter((v) => v.id !== videoId)),
    removeFromPlaylistByIndex: (index: number) => setPlaylist((p) => p.filter((_, i) => i !== index), false),
    reorderPlaylist: ({ from, to }: { from: number; to: number }) => setPlaylist((p) => {
      if (from === to || from < 0 || to < 0 || from >= p.length || to >= p.length) return p;
      const next = [...p];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    }),
    clearPlaylist: () => setPlaylist(() => []),
    setActivePlaylist: (playlist: any, saved = false) => setState((s) => {
      const active = { ...emptyPlaylist(), ...playlist, videos: playlist?.videos || [] };
      return { ...s, playlist: active.videos, playlistActive: active, playlistIsSaved: saved };
    }),
    setPlaylistName: (name: string) => name && setState((s) => ({ ...s, playlistActive: { ...s.playlistActive, name }, playlistIsSaved: false })),
    resetPlaylist: () => setState((s) => ({ ...s, playlist: [], playlistActive: emptyPlaylist() })),
    markPlaylistModified: () => setState((s) => ({ ...s, playlistIsSaved: false })),
    saveActivePlaylist: async () => {
      const { jwt, user } = state.userdata;
      if (!jwt || !user) return;
      const playlist = { ...state.playlistActive, videos: state.playlist };
      if (!playlist.user_id || !playlist.id) playlist.user_id = user.id;
      else if (`${playlist.user_id}` !== `${user.id}`) { delete playlist.id; playlist.user_id = user.id; }
      setState((s) => ({ ...s, playlistActive: playlist, playlistIsSaved: false }));
      const res = await api.savePlaylist({ ...playlist, videos: [], video_ids: playlist.videos.map((x: any) => x.id) }, jwt);
      if (res.data) setState((s) => ({ ...s, playlistActive: { ...playlist, id: playlist.id || res.data }, playlistIsSaved: true }));
    },
    setActivePlaylistByID: async (playlistId: number | string) => {
      const res = await api.getPlaylist(playlistId);
      const active = { ...emptyPlaylist(), ...res.data, videos: res.data?.videos || [] };
      setState((s) => ({ ...s, playlist: active.videos, playlistActive: active, playlistIsSaved: true }));
    },
    deleteActivePlaylist: async () => {
      const { jwt, user } = state.userdata;
      const active = state.playlistActive;
      if (active?.id && jwt && `${active.user_id}` === `${user?.id}`) await api.deletePlaylist(active.id, jwt);
      setState((s) => ({ ...s, playlist: [], playlistActive: emptyPlaylist() }));
    },

    setReportVideo: (video: any) => setState((s) => ({ ...s, reportVideo: video })),
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
      const valid: any = await api.loginIsValid(jwt);
      if (valid?.status === 200) {
        setCookieJWT(valid.data.jwt);
        setState((s) => ({ ...s, userdata: { user: valid.data.user, jwt: valid.data.jwt } }));
      } else if (valid?.status === 401) {
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
    installPromptShown: () => setState((s) => ({ ...s, lastShownInstallPrompt: Date.now() })),
    setShowUpdatesDetail: (v: boolean) => setState((s) => ({ ...s, showUpdateDetails: v })),
  };

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useAppState must be used under AppStateProvider");
  return ctx;
}
