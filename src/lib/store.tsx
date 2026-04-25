"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { jwtDecode } from "jwt-decode";
import api from "@/lib/api";
import { enrichLiveVideosWithTwitchViewerCounts } from "@/lib/twitch";
import {
  getLang,
  getLiveViewerCount,
  getUILang,
  videoTemporalComparator,
} from "@/lib/functions";
import { openUserMenu } from "@/lib/navigation-events";
import {
  sendFavoritesToExtension,
  sendTokenToExtension,
  setCookieJWT,
} from "@/lib/messaging";
import {
  APP_BOOT_COOKIE,
  encodeBootCookie,
  type AppBootState,
} from "@/lib/persist-cookie";

export type Org = { name: string; short: string; [key: string]: any };
export type Settings = {
  // Mirrors holodex-neo/src/stores/settings.ts persisted shape.
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
  nameProperty: "name" | "english_name";
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
  // React-port aliases only; values are derived from the holodex-neo keys above.
  useEnglishName: boolean;
  hideThumbnails: boolean;
  hidePlaceholderStreams: boolean;
  hideMissingStreams: boolean;
  blockedChannelIDs: string[];
  tlLangs: string[];
  gridSize: number;
};

type UserData = { user: any; jwt: string | null };
const emptyPlaylist = () => ({
  id: undefined,
  user_id: undefined,
  name: "Unnamed Playlist",
  videos: [] as any[],
  updated_at: undefined,
});

type State = {
  hydrated: boolean;
  settings: Settings;
  userdata: UserData;
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
  reloadTrigger: {
    source?: string;
    consumed?: boolean;
    timestamp: number;
    defaultOpen?: string;
  } | null;
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

type Actions = {
  patchSettings: (patch: Partial<Settings>) => void;
  setIsMobile: (value: boolean) => void;
  setWindowWidth: (value: number) => void;
  setCurrentGridSize: (value: number) => void;
  setCurrentOrg: (org: Org) => void;
  setSelectedHomeOrgs: (orgs: string[]) => void;
  toggleSelectedHomeOrg: (org: string) => void;
  fetchOrgs: () => Promise<any[]>;
  fetchHomeLive: (opts?: {
    force?: boolean;
    minutes?: number;
  }) => Promise<void> | null;
  fetchFavorites: () => Promise<void> | null;
  fetchFavoritesLive: (opts?: {
    force?: boolean;
    minutes?: number;
  }) => Promise<void> | null;
  resetFavorites: () => Promise<void>;
  toggleFavorite: (channelId: string) => void;
  addSavedVideo: (video: any) => void;
  removeSavedVideo: (videoId: string) => void;
  addToPlaylist: (video: any) => void;
  removeFromPlaylist: (videoId: string) => void;
  removeFromPlaylistByIndex: (index: number) => void;
  reorderPlaylist: (payload: { from: number; to: number }) => void;
  clearPlaylist: () => void;
  setActivePlaylist: (playlist: any, saved?: boolean) => void;
  setPlaylistName: (name: string) => void;
  resetPlaylist: () => void;
  markPlaylistModified: () => void;
  saveActivePlaylist: () => Promise<void>;
  setActivePlaylistByID: (playlistId: number | string) => Promise<void>;
  deleteActivePlaylist: () => Promise<void>;
  setReportVideo: (video: any) => void;
  setNavDrawer: (value: boolean) => void;
  setUploadPanel: (value: boolean) => void;
  loginCheck: () => Promise<void | null>;
  loginVerify: (opts?: { bounceToLogin?: boolean }) => Promise<void>;
  logout: () => void;
  setUser: (data: { user: any; jwt: string | null }) => void;
  setVisibilityState: (value: string) => void;
  reloadCurrentPage: (consumed?: any) => Promise<any>;
  installPromptShown: () => void;
  setShowUpdatesDetail: (value: boolean) => void;
};

type Store = State &
  Actions & {
    isLoggedIn: boolean;
    isSuperuser: boolean;
    favoriteChannelIDs: Set<string>;
    blockedChannelIDs: Set<string>;
    ignoredTopicsSet: Set<string>;
    isFavorited: (channelId: string) => boolean;
  };

function normalizeSettings(
  input: Partial<Settings> & Record<string, any>,
): Settings {
  const source = input || {};
  const nameProperty = (source.nameProperty ||
    (source.useEnglishName === false ? "name" : "english_name")) as
    | "name"
    | "english_name";
  const hideThumbnail = Boolean(
    source.hideThumbnail ?? source.hideThumbnails ?? false,
  );
  const hidePlaceholder = Boolean(
    source.hidePlaceholder ?? source.hidePlaceholderStreams ?? false,
  );
  const hideMissing = Boolean(
    source.hideMissing ?? source.hideMissingStreams ?? false,
  );
  const blockedChannels = Array.isArray(source.blockedChannels)
    ? source.blockedChannels
    : Array.isArray(source.blockedChannelIDs)
      ? source.blockedChannelIDs.map((id: string) => ({ id }))
      : [];
  const liveTlLang = source.liveTlLang || source.tlLangs?.[0] || "en";
  const base = {
    lang: source.lang || "en",
    foolsLang: source.foolsLang || "",
    clipLangs:
      Array.isArray(source.clipLangs) && source.clipLangs.length
        ? source.clipLangs
        : ["en"],
    darkMode: source.darkMode ?? true,
    followSystemTheme: source.followSystemTheme ?? false,
    defaultOpen: source.defaultOpen || "home",
    redirectMode: source.redirectMode ?? false,
    autoplayVideo: source.autoplayVideo ?? false,
    scrollMode: source.scrollMode ?? true,
    hideThumbnail,
    hidePlaceholder,
    hideMissing,
    hideUpcoming: source.hideUpcoming ?? false,
    nameProperty,
    hideCollabStreams: source.hideCollabStreams ?? false,
    hiddenGroups: source.hiddenGroups || {},
    ignoredTopics: Array.isArray(source.ignoredTopics)
      ? source.ignoredTopics
      : [],
    homeViewMode: source.homeViewMode || "grid",
    liveTlStickBottom: source.liveTlStickBottom ?? false,
    liveTlLang,
    liveTlFontSize: source.liveTlFontSize ?? 14,
    liveTlShowVerified: source.liveTlShowVerified ?? true,
    liveTlShowModerator: source.liveTlShowModerator ?? true,
    liveTlShowVtuber: source.liveTlShowVtuber ?? true,
    liveTlShowLocalTime: source.liveTlShowLocalTime ?? false,
    liveTlWindowSize: source.liveTlWindowSize ?? 0,
    liveTlShowSubtitle: source.liveTlShowSubtitle ?? true,
    liveTlHideSpoiler: source.liveTlHideSpoiler ?? false,
    liveTlBlocked: Array.isArray(source.liveTlBlocked)
      ? source.liveTlBlocked
      : [],
    blockedChannels,
    gridSize: Number(source.gridSize ?? 0) || 0,
  } as Settings;
  base.useEnglishName = base.nameProperty === "english_name";
  base.hideThumbnails = base.hideThumbnail;
  base.hidePlaceholderStreams = base.hidePlaceholder;
  base.hideMissingStreams = base.hideMissing;
  base.blockedChannelIDs = base.blockedChannels
    .map((x: any) => x.id)
    .filter(Boolean);
  base.tlLangs =
    Array.isArray(source.tlLangs) && source.tlLangs.length
      ? source.tlLangs
      : [base.liveTlLang, "ja", "es", "zh", "id", "ru", "ko", "vi"].filter(
          (v, i, a) => a.indexOf(v) === i,
        );
  return base;
}

function normalizeSettingsPatch(
  patch: Partial<Settings> & Record<string, any>,
) {
  const next: Record<string, any> = { ...patch };
  if ("useEnglishName" in next)
    next.nameProperty = next.useEnglishName ? "english_name" : "name";
  if ("hideThumbnails" in next) next.hideThumbnail = next.hideThumbnails;
  if ("hidePlaceholderStreams" in next)
    next.hidePlaceholder = next.hidePlaceholderStreams;
  if ("hideMissingStreams" in next) next.hideMissing = next.hideMissingStreams;
  if ("blockedChannelIDs" in next && !Array.isArray(next.blockedChannels))
    next.blockedChannels = (next.blockedChannelIDs || []).map((id: string) => ({
      id,
    }));
  return next;
}

const englishNamePrefs = new Set([
  "en",
  "es",
  "fr",
  "id",
  "pt",
  "de",
  "ru",
  "it",
]);

function getBrowserLanguage() {
  if (typeof navigator === "undefined") return "en";
  return (navigator as any).language || (navigator as any).userLanguage || "en";
}

function buildDefaultSettings(userLanguage = "en"): Settings {
  const lang = getLang(userLanguage);
  return normalizeSettings({
    lang: getUILang(userLanguage),
    foolsLang: "",
    clipLangs: [lang],
    darkMode: true,
    followSystemTheme: false,
    defaultOpen: "home",
    redirectMode: false,
    autoplayVideo: false,
    scrollMode: true,
    hideThumbnail: false,
    hidePlaceholder: false,
    hideMissing: false,
    hideUpcoming: false,
    nameProperty: englishNamePrefs.has(lang) ? "english_name" : "name",
    hideCollabStreams: false,
    hiddenGroups: {},
    ignoredTopics: [],
    homeViewMode: "grid",
    liveTlStickBottom: false,
    liveTlLang: lang,
    liveTlFontSize: 14,
    liveTlShowVerified: true,
    liveTlShowModerator: true,
    liveTlShowVtuber: true,
    liveTlShowLocalTime: false,
    liveTlWindowSize: 0,
    liveTlShowSubtitle: true,
    liveTlHideSpoiler: false,
    liveTlBlocked: [],
    blockedChannels: [],
    gridSize: 0,
  });
}

function buildBrowserDefaultSettings(): Settings {
  return buildDefaultSettings(getBrowserLanguage());
}

const defaultSettings: Settings = buildDefaultSettings("en");

const defaultState: State = {
  hydrated: false,
  settings: defaultSettings,
  userdata: { user: null, jwt: null },
  isMobile: true,
  windowWidth: 1440,
  currentGridSize: 0,
  currentOrg: { name: "Hololive", short: "Holo" },
  selectedHomeOrgs: ["Hololive"],
  orgFavorites: [
    { name: "All Vtubers", short: "Vtuber" },
    { name: "Hololive", short: "Holo" },
    { name: "Nijisanji", short: "Niji" },
    { name: "Independents", short: "Indie" },
  ],
  orgs: [],
  homeLive: [],
  homeLoading: false,
  homeError: false,
  homeLastLiveUpdate: 0,
  homeLiveCacheKey: JSON.stringify(["Hololive"]),
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

const StoreContext = createContext<Store | null>(null);

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...(fallback as any), ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key: string, value: any) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
function appPersistedState(state: State) {
  return {
    firstVisit: state.firstVisit,
    showOrgTip: state.showOrgTip,
    showUpdateDetails: state.showUpdateDetails,
    firstVisitMugen: state.firstVisitMugen,
    lastShownInstallPrompt: state.lastShownInstallPrompt,
    userdata: state.userdata,
    currentOrg: state.currentOrg,
    selectedHomeOrgs: state.selectedHomeOrgs,
    orgFavorites: state.orgFavorites,
    currentGridSize: state.currentGridSize,
    TPCookieEnabled: state.TPCookieEnabled,
    TPCookieAlertDismissed: state.TPCookieAlertDismissed,
  };
}

function makeLiveCacheKey(orgTargets: string[]) {
  const targets = (orgTargets || []).filter(Boolean);
  return JSON.stringify(targets.length ? [...targets].sort() : ["All Vtubers"]);
}

function bootCookieState(state: State): AppBootState {
  return {
    isMobile: state.isMobile,
    windowWidth: state.windowWidth,
    currentOrg: state.currentOrg,
    selectedHomeOrgs: state.selectedHomeOrgs,
    orgFavorites: state.orgFavorites,
    currentGridSize: state.currentGridSize,
    settings: {
      lang: state.settings.lang,
      defaultOpen: state.settings.defaultOpen,
      homeViewMode: state.settings.homeViewMode,
      scrollMode: state.settings.scrollMode,
      hideUpcoming: state.settings.hideUpcoming,
      darkMode: state.settings.darkMode,
      followSystemTheme: state.settings.followSystemTheme,
    },
  };
}

function writeBootCookie(state: State) {
  if (typeof document === "undefined") return;
  const encoded = encodeBootCookie(bootCookieState(state));
  if (!encoded) return;
  document.cookie = `${APP_BOOT_COOKIE}=${encoded}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

function normalizeBootOrg(org: AppBootState["currentOrg"], fallback: Org): Org {
  if (!org?.name) return fallback;
  return { ...org, short: org.short || fallback.short || org.name };
}

function buildBootState(initialBootState?: AppBootState | null): State {
  const selectedHomeOrgs = Array.isArray(initialBootState?.selectedHomeOrgs)
    ? initialBootState.selectedHomeOrgs.filter(Boolean)
    : defaultState.selectedHomeOrgs;
  return {
    ...defaultState,
    hydrated: false,
    isMobile:
      typeof initialBootState?.isMobile === "boolean"
        ? initialBootState.isMobile
        : defaultState.isMobile,
    windowWidth:
      typeof initialBootState?.windowWidth === "number"
        ? initialBootState.windowWidth
        : defaultState.windowWidth,
    settings: normalizeSettings({
      ...defaultState.settings,
      ...(initialBootState?.settings || {}),
    }),
    currentGridSize:
      typeof initialBootState?.currentGridSize === "number"
        ? initialBootState.currentGridSize
        : defaultState.currentGridSize,
    currentOrg: normalizeBootOrg(
      initialBootState?.currentOrg,
      defaultState.currentOrg,
    ),
    selectedHomeOrgs,
    orgFavorites: Array.isArray(initialBootState?.orgFavorites)
      ? initialBootState.orgFavorites
      : defaultState.orgFavorites,
    homeLoading: true,
    homeLiveCacheKey: makeLiveCacheKey(selectedHomeOrgs),
  };
}

function loadBrowserPersistedState(base: State): State {
  if (typeof window === "undefined") return base;
  const settings = normalizeSettings(
    readJSON("holodex-v2-settings", buildBrowserDefaultSettings()),
  );
  const home = readJSON("holodex-v2-home", {
    live: [],
    lastLiveUpdate: 0,
    liveCacheKey: JSON.stringify(["Hololive"]),
  });
  const fav = readJSON("holodex-v2-favorites", {
    favorites: [],
    live: [],
    lastLiveUpdate: 0,
  });
  const app = readJSON("holodex-v2-app", {
    currentOrg: defaultState.currentOrg,
    selectedHomeOrgs: defaultState.selectedHomeOrgs,
    orgFavorites: defaultState.orgFavorites,
    currentGridSize: defaultState.currentGridSize,
    userdata: defaultState.userdata,
    firstVisit: defaultState.firstVisit,
    showOrgTip: defaultState.showOrgTip,
    showUpdateDetails: defaultState.showUpdateDetails,
    firstVisitMugen: defaultState.firstVisitMugen,
    lastShownInstallPrompt: defaultState.lastShownInstallPrompt,
    TPCookieEnabled: defaultState.TPCookieEnabled,
    TPCookieAlertDismissed: defaultState.TPCookieAlertDismissed,
  });
  const orgsPersisted = readJSON("holodex-v2-orgs", { orgs: [] as any[] });
  const library = readJSON("holodex-v2-library", { savedVideos: {} });
  const playlistPersisted = readJSON("holodex-v2-playlist", {
    active: emptyPlaylist(),
    isSaved: false,
    videos: [],
  });
  const playlistActive = {
    ...emptyPlaylist(),
    ...(playlistPersisted.active || {}),
    videos: playlistPersisted.active?.videos || playlistPersisted.videos || [],
  };
  const selectedHomeOrgs = Array.isArray(app.selectedHomeOrgs)
    ? app.selectedHomeOrgs
    : base.selectedHomeOrgs;
  return {
    ...base,
    hydrated: true,
    settings,
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
    homeLiveCacheKey: home.liveCacheKey || makeLiveCacheKey(selectedHomeOrgs),
    favorites: fav.favorites || [],
    favoritesLive: fav.live || [],
    favoritesLoading: Boolean(app.userdata?.jwt && !(fav.live || []).length),
    favoritesLastLiveUpdate: fav.lastLiveUpdate || 0,
    savedVideos: library.savedVideos || {},
    playlist: playlistActive.videos || [],
    playlistActive,
    playlistIsSaved: !!playlistPersisted.isSaved,
  };
}
function dedupeVideos(videos: any[]) {
  return Array.from(
    new Map((videos || []).map((video) => [video.id, video])).values(),
  );
}
function liveFingerprint(arr: any[]) {
  return (arr || [])
    .map((v) => `${v.id}:${v.status}:${getLiveViewerCount(v)}`)
    .join(",");
}
export function AppStateProvider({
  children,
  initialBootState,
}: {
  children: React.ReactNode;
  initialBootState?: AppBootState | null;
}) {
  const [state, setState] = useState<State>(() =>
    buildBootState(initialBootState),
  );
  const [homeInflight, setHomeInflight] = useState<Promise<void> | null>(null);
  const [favoritesInflight, setFavoritesInflight] =
    useState<Promise<void> | null>(null);
  const stateRef = useRef(state);
  const favoriteFlushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const homeFetchSeq = useRef(0);
  const orgsInflight = useRef<Promise<any[]> | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(
    () => () => {
      if (favoriteFlushTimer.current) clearTimeout(favoriteFlushTimer.current);
    },
    [],
  );

  useLayoutEffect(() => {
    if (stateRef.current.hydrated) return;
    const nextState = loadBrowserPersistedState(stateRef.current);
    stateRef.current = nextState;
    writeBootCookie(nextState);
    setState(nextState);
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    writeJSON("holodex-v2-settings", state.settings);
    writeBootCookie(state);
  }, [state.hydrated, state.settings]);
  useEffect(() => {
    if (!state.hydrated) return;
    writeJSON("holodex-v2-app", appPersistedState(state));
    writeBootCookie(state);
  }, [
    state.hydrated,
    state.firstVisit,
    state.showOrgTip,
    state.showUpdateDetails,
    state.firstVisitMugen,
    state.lastShownInstallPrompt,
    state.currentOrg,
    state.selectedHomeOrgs,
    state.orgFavorites,
    state.currentGridSize,
    state.userdata,
    state.TPCookieEnabled,
    state.TPCookieAlertDismissed,
  ]);
  useEffect(() => {
    if (!state.hydrated) return;
    writeBootCookie(state);
  }, [state.hydrated, state.isMobile, state.windowWidth]);
  useEffect(() => {
    if (!state.hydrated) return;
    writeJSON("holodex-v2-orgs", { orgs: state.orgs });
  }, [state.hydrated, state.orgs]);
  useEffect(() => {
    if (!state.hydrated) return;
    writeJSON("holodex-v2-home", {
      live: state.homeLive,
      lastLiveUpdate: state.homeLastLiveUpdate,
      liveCacheKey: state.homeLiveCacheKey,
    });
  }, [state.hydrated, state.homeLive, state.homeLastLiveUpdate, state.homeLiveCacheKey]);
  useEffect(() => {
    if (!state.hydrated) return;
    writeJSON("holodex-v2-favorites", {
      favorites: state.favorites,
      live: state.favoritesLive,
      lastLiveUpdate: state.favoritesLastLiveUpdate,
    });
  }, [state.hydrated, state.favorites, state.favoritesLive, state.favoritesLastLiveUpdate]);
  useEffect(() => {
    if (!state.hydrated) return;
    writeJSON("holodex-v2-library", { savedVideos: state.savedVideos });
  }, [state.hydrated, state.savedVideos]);
  useEffect(() => {
    if (!state.hydrated) return;
    writeJSON("holodex-v2-playlist", {
      active: { ...state.playlistActive, videos: state.playlist },
      isSaved: state.playlistIsSaved,
    });
  }, [state.hydrated, state.playlist, state.playlistActive, state.playlistIsSaved]);

  const patchSettings = useCallback(
    (patch: Partial<Settings>) =>
      setState((s) => {
        const normalizedPatch = normalizeSettingsPatch(patch as any);
        const settings = normalizeSettings({
          ...s.settings,
          ...normalizedPatch,
        });
        const nextState = { ...s, settings };
        writeJSON("holodex-v2-settings", settings);
        if (nextState.hydrated) writeBootCookie(nextState);
        return nextState;
      }),
    [],
  );
  const setCurrentOrg = useCallback(
    (org: Org) =>
      setState((s) => {
        const nextState = {
          ...s,
          currentOrg: org,
          selectedHomeOrgs:
            (s.selectedHomeOrgs?.length || 0) <= 1
              ? org?.name && org.name !== "All Vtubers"
                ? [org.name]
                : []
              : s.selectedHomeOrgs,
          homeLastLiveUpdate: 0,
        };
        if (nextState.hydrated) {
          writeJSON("holodex-v2-app", appPersistedState(nextState));
          writeBootCookie(nextState);
        }
        return nextState;
      }),
    [],
  );
  const setSelectedHomeOrgs = useCallback(
    (orgs: string[]) =>
      setState((s) => {
        const nextState = {
          ...s,
          selectedHomeOrgs: [
            ...new Set(
              (orgs || []).filter((name) => name && name !== "All Vtubers"),
            ),
          ],
          homeLastLiveUpdate: 0,
        };
        if (nextState.hydrated) {
          writeJSON("holodex-v2-app", appPersistedState(nextState));
          writeBootCookie(nextState);
        }
        return nextState;
      }),
    [],
  );
  const toggleSelectedHomeOrg = useCallback(
    (org: string) =>
      setState((s) => {
        if (!org || org === "All Vtubers") {
          const nextState = {
            ...s,
            selectedHomeOrgs: [],
            homeLastLiveUpdate: 0,
          };
          if (nextState.hydrated) {
            writeJSON("holodex-v2-app", appPersistedState(nextState));
            writeBootCookie(nextState);
          }
          return nextState;
        }
        const exists = s.selectedHomeOrgs.includes(org);
        const nextState = {
          ...s,
          selectedHomeOrgs: exists
            ? s.selectedHomeOrgs.filter((x) => x !== org)
            : [...s.selectedHomeOrgs, org],
          homeLastLiveUpdate: 0,
        };
        if (nextState.hydrated) {
          writeJSON("holodex-v2-app", appPersistedState(nextState));
          writeBootCookie(nextState);
        }
        return nextState;
      }),
    [],
  );

  const fetchOrgs = useCallback(async () => {
    const current = stateRef.current.orgs || [];
    const normalizeOrgs = (freshOrgs: any[]) => {
      const sorted = [...(freshOrgs || [])].sort(
        (a: any, b: any) =>
          a.name.toLowerCase().charCodeAt(0) -
          b.name.toLowerCase().charCodeAt(0),
      );
      return [
        { name: "All Vtubers", short: "Vtuber", name_jp: null },
        ...sorted,
      ];
    };
    const loadFresh = () => {
      if (orgsInflight.current) return orgsInflight.current;
      orgsInflight.current =
      api
        .orgs()
        .then((fresh: any) =>
          normalizeOrgs(
            Array.isArray(fresh)
              ? fresh
              : (Object.values(fresh || {}) as any[]),
          ),
        )
        .finally(() => {
          orgsInflight.current = null;
        });
      return orgsInflight.current;
    };
    if (current.length > 0) {
      loadFresh()
        .then((withAll) => {
          if (
            JSON.stringify(withAll.map((o: any) => o.name)) !==
            JSON.stringify(stateRef.current.orgs.map((o: any) => o.name))
          ) {
            setState((s) => ({ ...s, orgs: withAll }));
          }
        })
        .catch(() => {});
      return current;
    }
    try {
      const withAll = await loadFresh();
      setState((s) => ({ ...s, orgs: withAll }));
      stateRef.current = { ...stateRef.current, orgs: withAll };
      return withAll;
    } catch {
      return [];
    }
  }, []);

  const fetchHomeLive = useCallback(
    (opts: { force?: boolean; minutes?: number } = {}) => {
      if (state.visibilityState === "hidden" && !opts.force) return null;
      const { force = false, minutes = 5 } = opts;
      const orgTargets = state.selectedHomeOrgs.length
        ? state.selectedHomeOrgs
        : ["All Vtubers"];
      const nextCacheKey = makeLiveCacheKey(orgTargets);
      const cacheChanged = state.homeLiveCacheKey !== nextCacheKey;
      if (homeInflight && !cacheChanged) return homeInflight;
      const effectiveLastUpdate = cacheChanged ? 0 : state.homeLastLiveUpdate;
      if (
        !force &&
        effectiveLastUpdate &&
        Date.now() - effectiveLastUpdate < minutes * 60_000 &&
        !state.homeError
      )
        return null;
      setState((s) => ({
        ...s,
        homeLive: cacheChanged ? [] : s.homeLive,
        homeLastLiveUpdate: cacheChanged ? 0 : s.homeLastLiveUpdate,
        homeLiveCacheKey: nextCacheKey,
        homeLoading: cacheChanged || s.homeLive.length === 0,
        homeError: false,
      }));
      const seq = ++homeFetchSeq.current;
      const p = api
        .allLive(orgTargets, {
          type: "placeholder,stream",
          include: "mentions",
        })
        .then(async (res: any[]) => {
          if (seq !== homeFetchSeq.current) return;
          const merged = dedupeVideos(
            await enrichLiveVideosWithTwitchViewerCounts(res),
          );
          merged.sort(videoTemporalComparator);
          if (seq !== homeFetchSeq.current) return;
          setState((s) => ({
            ...s,
            homeLive:
              liveFingerprint(merged) !== liveFingerprint(s.homeLive)
                ? merged
                : s.homeLive,
            homeLastLiveUpdate: Date.now(),
            homeLoading: false,
            homeError: false,
          }));
        })
        .catch((e) => {
          if (seq === homeFetchSeq.current) {
            console.error(e);
            setState((s) => ({ ...s, homeError: true, homeLoading: false }));
          }
        })
        .finally(() => {
          if (seq === homeFetchSeq.current) setHomeInflight(null);
        });
      setHomeInflight(p);
      return p;
    },
    [
      homeInflight,
      state.homeError,
      state.homeLastLiveUpdate,
      state.homeLiveCacheKey,
      state.selectedHomeOrgs,
      state.visibilityState,
    ],
  );

  const fetchFavorites = useCallback(() => {
    if (!state.userdata.jwt) return null;
    return api
      .favorites(state.userdata.jwt)
      .then((res: any) =>
        setState((s) => ({ ...s, favorites: res.data || [] })),
      )
      .catch((e) => console.error(e));
  }, [state.userdata.jwt]);

  const fetchFavoritesLive = useCallback(
    (opts: { force?: boolean; minutes?: number } = {}) => {
      if (
        !state.userdata.jwt ||
        (state.visibilityState === "hidden" && !opts.force)
      )
        return null;
      if (favoritesInflight) return favoritesInflight;
      const { force = false, minutes = 2 } = opts;
      if (
        !state.favoritesError &&
        !force &&
        state.favoritesLastLiveUpdate &&
        Date.now() - state.favoritesLastLiveUpdate <= minutes * 60_000
      ) {
        setState((s) => ({
          ...s,
          favoritesError: false,
          favoritesLoading: false,
        }));
        return null;
      }
      setState((s) => ({
        ...s,
        favoritesLoading: s.favoritesLive.length === 0,
        favoritesError: false,
      }));
      const p = api
        .favoritesLive({ includePlaceholder: true }, state.userdata.jwt)
        .then(async (res: any[]) => {
          const merged = await enrichLiveVideosWithTwitchViewerCounts(res);
          merged.sort(videoTemporalComparator);
          setState((s) => ({
            ...s,
            favoritesLive:
              liveFingerprint(merged) !== liveFingerprint(s.favoritesLive)
                ? merged
                : s.favoritesLive,
            favoritesLastLiveUpdate: Date.now(),
            favoritesLoading: false,
            favoritesError: false,
          }));
        })
        .catch((e) => {
          console.error(e);
          setState((s) => ({
            ...s,
            favoritesError: true,
            favoritesLoading: false,
          }));
        })
        .finally(() => setFavoritesInflight(null));
      setFavoritesInflight(p);
      return p;
    },
    [
      favoritesInflight,
      state.favoritesError,
      state.favoritesLastLiveUpdate,
      state.favoritesLive.length,
      state.userdata.jwt,
      state.visibilityState,
    ],
  );

  const flushFavoriteUpdates = useCallback(() => {
    const current = stateRef.current;
    const operations = Object.keys(current.stagedFavorites || {}).map(
      (key) => ({
        op: current.stagedFavorites[key],
        channel_id: key,
      }),
    );
    if (operations.length === 0 || !current.userdata.jwt) return;
    api
      .patchFavorites(current.userdata.jwt, operations)
      .catch((e: any) => {
        console.error(e);
        return e?.response || false;
      })
      .then((res: any) => {
        if (res && res.status === 200) {
          setState((s) => ({ ...s, favorites: res.data, stagedFavorites: {} }));
          fetchFavoritesLive({ force: true });
          sendFavoritesToExtension(res.data);
        } else if (res) {
          throw new Error("Error while adding favorite");
        }
      })
      .finally(() => {
        setState((s) => ({ ...s, stagedFavorites: {} }));
      });
  }, [fetchFavoritesLive]);

  const scheduleFavoriteUpdate = useCallback(() => {
    if (favoriteFlushTimer.current) clearTimeout(favoriteFlushTimer.current);
    favoriteFlushTimer.current = setTimeout(() => {
      favoriteFlushTimer.current = null;
      flushFavoriteUpdates();
    }, 2000);
  }, [flushFavoriteUpdates]);

  const toggleFavorite = useCallback(
    (channelId: string) => {
      setState((s) => {
        const stagedFavorites = { ...s.stagedFavorites };
        if (stagedFavorites[channelId]) {
          delete stagedFavorites[channelId];
        } else if (s.favorites.find((f) => f.id === channelId)) {
          stagedFavorites[channelId] = "remove";
        } else {
          stagedFavorites[channelId] = "add";
        }
        return { ...s, stagedFavorites };
      });
      scheduleFavoriteUpdate();
    },
    [scheduleFavoriteUpdate],
  );

  const logout = useCallback(() => {
    setCookieJWT(null);
    sendTokenToExtension(null);
    stateRef.current = {
      ...stateRef.current,
      userdata: { user: null, jwt: null },
      favorites: [],
      favoritesLive: [],
      favoritesLastLiveUpdate: 0,
    };
    setState((s) => ({
      ...s,
      userdata: { user: null, jwt: null },
      favorites: [],
      favoritesLive: [],
      favoritesLastLiveUpdate: 0,
    }));
  }, []);

  const loginCheck = useCallback(async () => {
    const jwt = state.userdata.jwt;
    if (!jwt) return null;
    const { exp } = jwtDecode<{ exp: number }>(jwt);
    const dist = exp - Date.now() / 1000;
    if (dist < 0) {
      logout();
    } else {
      sendTokenToExtension(jwt);
      setCookieJWT(jwt);
    }
  }, [logout, state.userdata.jwt]);

  const loginVerify = useCallback(
    async (opts?: { bounceToLogin?: boolean }) => {
      const { bounceToLogin = false } = opts || {};
      await loginCheck();
      const jwt = state.userdata.jwt;
      if (state.userdata && jwt) {
        const valid: any = await api.loginIsValid(jwt);
        if (valid && valid.status === 200) {
          setCookieJWT(valid.data.jwt);
          setState((s) => ({
            ...s,
            userdata: { user: valid.data.user, jwt: valid.data.jwt },
          }));
        } else if (valid && valid.status === 401) {
          logout();
          if (bounceToLogin) {
            openUserMenu();
            window.location.href = "/";
          }
        } else {
          console.error(
            "Login credentials did not respond with a good message? Maybe server is down.",
          );
        }
      }
    },
    [loginCheck, logout, state.userdata],
  );

  const resetFavorites = useCallback(async () => {
    setState((s) => ({
      ...s,
      favoritesLive: [],
      favoritesLoading: true,
      favoritesError: false,
      favoritesLastLiveUpdate: 0,
      stagedFavorites: {},
    }));
    const jwt = stateRef.current.userdata.jwt;
    if (jwt) {
      try {
        const fav = await api.favorites(jwt);
        setState((s) => ({ ...s, favorites: fav.data || [] }));
      } catch (e) {
        console.error(e);
      }
      sendTokenToExtension(jwt);
      try {
        const live = await api.favoritesLive({ includePlaceholder: true }, jwt);
        const merged = await enrichLiveVideosWithTwitchViewerCounts(live);
        merged.sort(videoTemporalComparator);
        setState((s) => ({
          ...s,
          favoritesLive: merged,
          favoritesLastLiveUpdate: Date.now(),
          favoritesLoading: false,
          favoritesError: false,
        }));
      } catch (e) {
        console.error(e);
        setState((s) => ({
          ...s,
          favoritesLoading: false,
          favoritesError: true,
        }));
      }
    } else {
      setState((s) => ({
        ...s,
        favorites: [],
        favoritesLive: [],
        favoritesLastLiveUpdate: 0,
        favoritesLoading: false,
      }));
      sendTokenToExtension(null);
    }
  }, []);

  const value = useMemo<Store>(() => {
    const favoriteChannelIDs = new Set(state.favorites.map((f) => f.id));
    const isFavorited = (channelId: string) =>
      state.stagedFavorites[channelId] === "add" ||
      (state.favorites.find((f) => f.id === channelId) &&
        state.stagedFavorites[channelId] !== "remove");
    return {
      ...state,
      isLoggedIn: !!state.userdata.jwt,
      isSuperuser: ["admin", "editor"].includes(state.userdata.user?.role),
      favoriteChannelIDs,
      blockedChannelIDs: new Set(
        (state.settings.blockedChannels || [])
          .map((x: any) => x.id)
          .filter(Boolean),
      ),
      ignoredTopicsSet: new Set(state.settings.ignoredTopics || []),
      isFavorited: (channelId: string) => Boolean(isFavorited(channelId)),
      patchSettings,
      setIsMobile: (value) =>
        setState((s) => {
          const nextState = { ...s, isMobile: value };
          if (nextState.hydrated) writeBootCookie(nextState);
          return nextState;
        }),
      setWindowWidth: (value) =>
        setState((s) => {
          const nextState = { ...s, windowWidth: value };
          if (nextState.hydrated) writeBootCookie(nextState);
          return nextState;
        }),
      setCurrentGridSize: (value) =>
        setState((s) => {
          const nextState = { ...s, currentGridSize: value };
          if (nextState.hydrated) {
            writeJSON("holodex-v2-app", appPersistedState(nextState));
            writeBootCookie(nextState);
          }
          return nextState;
        }),
      setCurrentOrg,
      setSelectedHomeOrgs,
      toggleSelectedHomeOrg,
      fetchOrgs,
      fetchHomeLive,
      fetchFavorites,
      fetchFavoritesLive,
      resetFavorites,
      toggleFavorite,
      addSavedVideo: (video) =>
        video?.id &&
        setState((s) => ({
          ...s,
          savedVideos: {
            ...s.savedVideos,
            [video.id]: {
              ...video,
              added_at: video.added_at || new Date().toISOString(),
            },
          },
        })),
      removeSavedVideo: (videoId) =>
        setState((s) => {
          const next = { ...s.savedVideos };
          delete next[videoId];
          return { ...s, savedVideos: next };
        }),
      addToPlaylist: (video) =>
        video?.id &&
        setState((s) => {
          if (s.playlist.some((v) => v.id === video.id)) return s;
          const videos = [...s.playlist, video];
          return {
            ...s,
            playlist: videos,
            playlistActive: { ...s.playlistActive, videos },
            playlistIsSaved: false,
          };
        }),
      removeFromPlaylist: (videoId) =>
        setState((s) => {
          const videos = s.playlist.filter((v) => v.id !== videoId);
          return {
            ...s,
            playlist: videos,
            playlistActive: { ...s.playlistActive, videos },
            playlistIsSaved: false,
          };
        }),
      removeFromPlaylistByIndex: (index) =>
        setState((s) => {
          const videos = s.playlist.filter((_, idx) => idx !== index);
          return {
            ...s,
            playlist: videos,
            playlistActive: { ...s.playlistActive, videos },
          };
        }),
      reorderPlaylist: ({ from, to }) =>
        setState((s) => {
          if (
            from === to ||
            from < 0 ||
            to < 0 ||
            from >= s.playlist.length ||
            to >= s.playlist.length
          )
            return s;
          const videos = [...s.playlist];
          const [moved] = videos.splice(from, 1);
          videos.splice(to, 0, moved);
          return {
            ...s,
            playlist: videos,
            playlistActive: { ...s.playlistActive, videos },
            playlistIsSaved: false,
          };
        }),
      clearPlaylist: () =>
        setState((s) => ({
          ...s,
          playlist: [],
          playlistActive: { ...s.playlistActive, videos: [] },
          playlistIsSaved: false,
        })),
      setActivePlaylist: (playlist, saved = false) =>
        setState((s) => {
          const active = {
            ...emptyPlaylist(),
            ...playlist,
            videos: playlist?.videos || [],
          };
          return {
            ...s,
            playlist: active.videos,
            playlistActive: active,
            playlistIsSaved: saved,
          };
        }),
      setPlaylistName: (name) =>
        name &&
        setState((s) => ({
          ...s,
          playlistActive: { ...s.playlistActive, name },
          playlistIsSaved: false,
        })),
      resetPlaylist: () =>
        setState((s) => ({
          ...s,
          playlist: [],
          playlistActive: emptyPlaylist(),
        })),
      markPlaylistModified: () =>
        setState((s) => ({ ...s, playlistIsSaved: false })),
      saveActivePlaylist: async () => {
        const jwt = state.userdata.jwt;
        const user = state.userdata.user;
        if (!jwt || !user) return;
        const playlist = { ...state.playlistActive, videos: state.playlist };
        if (!playlist.user_id || !playlist.id) playlist.user_id = user.id;
        else if (`${playlist.user_id}` !== `${user.id}`) {
          delete playlist.id;
          playlist.user_id = user.id;
        }
        setState((s) => ({
          ...s,
          playlistActive: playlist,
          playlistIsSaved: false,
        }));
        const res = await api.savePlaylist(
          {
            ...playlist,
            videos: [],
            video_ids: playlist.videos.map((x: any) => x.id),
          },
          jwt,
        );
        const returnedId = res.data;
        if (returnedId) {
          setState((s) => ({
            ...s,
            playlistActive: { ...playlist, id: playlist.id || returnedId },
            playlistIsSaved: true,
          }));
        }
      },
      setActivePlaylistByID: async (playlistId) => {
        const res = await api.getPlaylist(playlistId);
        const active = {
          ...emptyPlaylist(),
          ...res.data,
          videos: res.data?.videos || [],
        };
        setState((s) => ({
          ...s,
          playlist: active.videos,
          playlistActive: active,
          playlistIsSaved: true,
        }));
      },
      deleteActivePlaylist: async () => {
        const jwt = state.userdata.jwt;
        const user = state.userdata.user;
        const active = state.playlistActive;
        if (active?.id && jwt && `${active.user_id}` === `${user?.id}`)
          await api.deletePlaylist(active.id, jwt);
        setState((s) => ({
          ...s,
          playlist: [],
          playlistActive: emptyPlaylist(),
        }));
      },
      setReportVideo: (video) =>
        setState((s) => ({ ...s, reportVideo: video })),
      setNavDrawer: (value) => setState((s) => ({ ...s, navDrawer: value })),
      setUploadPanel: (value) =>
        setState((s) => ({ ...s, uploadPanel: value })),
      loginCheck,
      loginVerify,
      logout,
      setUser: (data) => {
        setCookieJWT(data.jwt);
        stateRef.current = {
          ...stateRef.current,
          userdata: { user: data.user, jwt: data.jwt },
        };
        setState((s) => ({
          ...s,
          userdata: { user: data.user, jwt: data.jwt },
        }));
      },
      setVisibilityState: (value) =>
        setState((s) => ({ ...s, visibilityState: value })),
      reloadCurrentPage: async (consumed = {}) => {
        const trigger = { ...(consumed || {}), timestamp: Date.now() };
        setState((s) => ({ ...s, reloadTrigger: trigger }));
        return consumed;
      },
      installPromptShown: () =>
        setState((s) => ({
          ...s,
          lastShownInstallPrompt: new Date().getTime(),
        })),
      setShowUpdatesDetail: (value) =>
        setState((s) => ({ ...s, showUpdateDetails: value })),
    };
  }, [
    state,
    patchSettings,
    setCurrentOrg,
    setSelectedHomeOrgs,
    toggleSelectedHomeOrg,
    fetchOrgs,
    fetchHomeLive,
    fetchFavorites,
    fetchFavoritesLive,
    resetFavorites,
    toggleFavorite,
    loginCheck,
    loginVerify,
    logout,
  ]);

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useAppState must be used under AppStateProvider");
  return ctx;
}
