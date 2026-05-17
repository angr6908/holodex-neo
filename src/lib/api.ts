import axios from "axios";
import { dayjs } from "@/lib/time";
import { ALL_VTUBERS_ORG, CACHE_TTL_MS, CHANNEL_URL_REGEX, VIDEO_URL_REGEX } from "@/lib/consts";
const MCHATX_BASE = "https://repo.mchatx.org";
const API_BASE_URL = "/api";
const MAX_CONCURRENT = 6;

function qs(obj: Record<string, any> = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null) params.append(key, String(value));
  }
  return params.toString();
}

function isLiveInsideScheduleWindow(live: any): boolean {
  if (live.start_actual) return true;
  return !dayjs().isAfter(dayjs(live.start_scheduled).add(2, "h"));
}

let activeRequests = 0;
const requestQueue: Array<() => void> = [];
const responseCache = new Map<string, { data: any; ts: number }>();
const inflightGets = new Map<string, Promise<any>>();

function drainQueue() {
  while (activeRequests < MAX_CONCURRENT && requestQueue.length) {
    requestQueue.shift()!();
  }
}

function enqueueRequest<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      activeRequests++;
      fn().then(resolve, reject).finally(() => {
        activeRequests--;
        drainQueue();
      });
    };
    if (activeRequests < MAX_CONCURRENT) run();
    else requestQueue.push(run);
  });
}

function getCached(key: string) {
  const entry = responseCache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    responseCache.delete(key);
    return undefined;
  }
  return entry.data;
}

function deduplicatedGet<T>(url: string, config?: any): Promise<T> {
  const key = url + (config ? JSON.stringify(config) : "");
  const cached = getCached(key);
  if (cached !== undefined) return Promise.resolve(cached);
  const existing = inflightGets.get(key);
  if (existing) return existing;
  const promise = enqueueRequest(() => axiosInstance.get(url, config))
    .then((res: any) => {
      responseCache.set(key, { data: res, ts: Date.now() });
      return res;
    })
    .finally(() => inflightGets.delete(key));
  inflightGets.set(key, promise);
  return promise;
}

const axiosInstance = axios.create({ baseURL: `${API_BASE_URL}/v2`, timeout: 30000 });
const authH = (jwt?: string | null) => (jwt ? { Authorization: `BEARER ${jwt}` } : {});

export type ItunesTrack = {
  artistName: string;
  artworkUrl100: string;
  collectionName?: string;
  releaseDate?: string;
  trackCensoredName?: string;
  trackId: number;
  trackName: string;
  trackTimeMillis: number;
  trackViewUrl?: string;
};
type ItunesResponse = { results?: ItunesTrack[] };

export function jsonpItunes(query: string, { country = "JP", lang, limit = 10 }: { country?: string; lang?: string; limit?: number } = {}): Promise<ItunesResponse> {
  return new Promise((resolve, reject) => {
    const callbackName = `itunes_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const cbWindow = window as any;
    const params = new URLSearchParams({ term: query, entity: "musicTrack", country, limit: String(limit), callback: callbackName });
    if (lang) params.set("lang", lang);
    const script = document.createElement("script");
    const cleanup = () => { delete cbWindow[callbackName]; script.remove(); };
    cbWindow[callbackName] = (data: ItunesResponse) => { resolve(data); cleanup(); };
    script.onerror = () => { cleanup(); reject(new Error("iTunes search failed")); };
    script.src = `https://itunes.apple.com/search?${params.toString()}`;
    document.head.appendChild(script);
  });
}

export const api = {
  orgs() {
    return fetch(`/statics/orgs.json`).then((r) => r.json());
  },
  stats() {
    return axios.get(`/statics/stats.json`);
  },
  channels(query: Record<string, any> = {}) {
    return deduplicatedGet(`/channels?${qs(query)}`);
  },
  videos(query: Record<string, any> = {}) {
    return deduplicatedGet(`/videos?${qs(query)}`);
  },
  live(query: Record<string, any> = {}) {
    return deduplicatedGet<any>(`/live?${qs(query)}`, { timeout: 10000 })
      .then((res: any) => res.data.filter(isLiveInsideScheduleWindow));
  },
  channel(id: string) {
    return axiosInstance.get(`/channels/${id}`);
  },
  video(id: string, lang?: string, c?: number) {
    return axiosInstance.get(`/videos/${id}?${qs({ lang, c })}`);
  },
  searchAutocomplete(query: string) {
    const channelMatch = query.match(CHANNEL_URL_REGEX);
    if (channelMatch?.groups?.id) {
      return axiosInstance.get(`/search/autocomplete?${qs({ q: channelMatch.groups.id })}`);
    }
    const videoMatch = query.match(VIDEO_URL_REGEX);
    if (videoMatch?.groups?.id) {
      return Promise.resolve({ data: [{ type: "video url", value: videoMatch.groups.id }] });
    }
    return axiosInstance.get(`/search/autocomplete?${qs({ q: query })}`);
  },
  searchVideo(queryObject: any) {
    return axiosInstance.post("/search/videoSearch", queryObject);
  },
  searchComments(queryObject: any) {
    return axiosInstance.post("/search/commentSearch", queryObject);
  },
  searchChannel(queryObject: any) {
    return axiosInstance.post("/search/channelSearch", queryObject);
  },
  channelVideos(channelId: string, { type = "videos", query = {} }: { type?: string; query?: Record<string, any> }) {
    return axiosInstance.get(`/channels/${channelId}/${type}?${qs(query)}`);
  },
  login(jwt: string | null, authToken: string, service: string) {
    return axiosInstance.post("/user/login", { token: authToken, service }, { headers: authH(jwt) });
  },
  loginIsValid(jwt: string | null) {
    return axiosInstance
      .get("/user/refresh", { headers: authH(jwt) })
      .then((resp) => (resp.status === 200 && resp.data.jwt && resp.data.user ? resp : false))
      .catch((e) => e.response || false);
  },
  changeUsername(jwt: string | null, newUsername: string) {
    return axiosInstance
      .post("/user", { name: newUsername }, { headers: authH(jwt) })
      .catch(() => false);
  },
  resetAPIKey(jwt: string | null) {
    return axiosInstance
      .get("/user/createKey", { headers: authH(jwt) })
      .catch(() => alert("something went wrong creating your key..."));
  },
  favorites(jwt: string | null) {
    return axiosInstance.get("/users/favorites", { headers: authH(jwt) });
  },
  favoritesVideos(jwt: string | null, query: Record<string, any> = {}) {
    return axiosInstance.get(`/users/videos?${qs(query)}`, { headers: authH(jwt) });
  },
  favoritesLive({ includePlaceholder = false } = {}, jwt: string | null) {
    return axiosInstance
      .get(`/users/live?includePlaceholder=${includePlaceholder}`, { headers: authH(jwt), timeout: 20000 })
      .then((res) =>
        res.data
          .filter(isLiveInsideScheduleWindow)
          .filter((live: any) => live.start_actual || dayjs(live.start_scheduled).isBefore(dayjs().add(3, "w"))),
      );
  },
  allLive(orgs: string[] = [], query: Record<string, any> = {}) {
    const targets = (orgs || []).filter(Boolean);
    if (targets.length === 0 || targets.includes(ALL_VTUBERS_ORG)) {
      return api.live({ ...query, org: ALL_VTUBERS_ORG });
    }
    return Promise.all(targets.map((org) => api.live({ ...query, org }))).then((responses) => responses.flat());
  },
  patchFavorites(jwt: string | null, operations: any[]) {
    return axiosInstance.patch("/users/favorites", operations, { headers: authH(jwt) });
  },
  topics() {
    return axiosInstance.get("/topics");
  },
  getVideoTopic(videoId: string) {
    return axiosInstance.get(`/videos/${videoId}/topic`);
  },
  topicSet(topicId: string, videoId: string, jwt?: string | null) {
    return axiosInstance.post("/topics/video", { videoId, topicId }, { headers: authH(jwt) });
  },
  tryCreateSong(songObj: any, jwt?: string | null) {
    return axiosInstance.put("/songs", songObj, { headers: authH(jwt) });
  },
  deleteSong(songObj: any, jwt?: string | null) {
    return axiosInstance.delete("/songs", { data: { ...songObj }, headers: authH(jwt) });
  },
  deleteMentions(videoId: string, channelIds: string[], jwt?: string | null) {
    return axiosInstance.delete(`videos/${videoId}/mentions`, { data: { channel_ids: channelIds }, headers: authH(jwt) });
  },
  addMention(videoId: string, channelId: string, jwt?: string | null) {
    return axiosInstance.post(`videos/${videoId}/mentions`, { channel_id: channelId }, { headers: authH(jwt) });
  },
  songListByVideo(channelId: string, videoId: string, allowCache = true) {
    const dt = allowCache ? "_" : Math.floor(Math.random() * 100);
    return axiosInstance.post(`/songs/latest?c=${dt}`, { channel_id: channelId, video_id: videoId, limit: 1000 });
  },
  chatHistory(videoId: string, query: Record<string, any> = {}) {
    return axiosInstance.get(`videos/${videoId}/chats?${qs(query)}`);
  },
  getMentions(videoId: string) {
    return axiosInstance.get(`videos/${videoId}/mentions`);
  },
  getPlaylistList(jwt: string) {
    if (!jwt) throw new Error("Not authorized");
    return axiosInstance.get("/users/playlists", { headers: authH(jwt) });
  },
  getPlaylist(id: string | number) {
    if (!id) throw new Error("Arg bad");
    return axiosInstance.get(`/playlist/${id}`);
  },
  savePlaylist(obj: any, jwt: string) {
    return axiosInstance.post("/playlist/", obj, { headers: authH(jwt) });
  },
  deletePlaylist(id: string | number, jwt: string) {
    if (!id || !jwt) throw new Error("Arg bad");
    return axiosInstance.delete(`/playlist/${id}`, { headers: authH(jwt) });
  },
  reportVideo(id: string, body: any[], jwt: string) {
    if (!id) throw new Error("Arg bad");
    return axiosInstance.post(`/reports/video/${id}`, body, { headers: authH(jwt) });
  },
  trackMultiviewLink(link: string) {
    return axiosInstance.get(`/multiview/record/${link}`);
  },
  discordServerInfo(inviteLink: string) {
    return axiosInstance.get(`https://discord.com/api/v8/invites/${inviteLink}`);
  },
  addPlaceholderStream(body: any, jwt?: string | null, token?: string) {
    return axiosInstance.post(`videos/placeholder${token ? `?token=${token}` : ""}`, body, { headers: authH(jwt) });
  },
  getPlaylistState(videoId: string, jwt?: string | null) {
    return axiosInstance.get(`/video-playlist/${videoId}`, { headers: authH(jwt) });
  },
  addVideoToPlaylist(videoId: string, playlistId: string | number, jwt?: string | null) {
    return axiosInstance.put(`/video-playlist/${playlistId}/${videoId}`, null, { headers: authH(jwt) });
  },
  deleteVideoFromPlaylist(videoId: string, playlistId: string | number, jwt?: string | null) {
    return axiosInstance.delete(`/video-playlist/${playlistId}/${videoId}`, { headers: authH(jwt) });
  },
  postTL(args: any) {
    return axiosInstance.post(
      `/videos/${args.videoId}/chats?${qs({ lang: args.lang, custom_video_id: args.custom_video_id })}`,
      args.body,
      { headers: authH(args.jwt) },
    );
  },
  getTLStats(jwt: string, query: any) {
    return axiosInstance.get(`/tlutil?${qs(query)}`, { headers: authH(jwt) });
  },
  postTLLog(args: { videoId: string; jwt?: string; body: any; lang: string; custom_video_id?: string; override?: boolean }) {
    const headers: Record<string, string> = { ...authH(args.jwt) };
    if (args.override) headers.Override = "true";
    return axiosInstance.post(
      `/videos/${args.videoId}/scripteditor/log?${qs({ lang: args.lang, custom_video_id: args.custom_video_id })}`,
      args.body,
      { headers },
    );
  },
  postChangeLink(args: { jwt?: string; body: any }) {
    return axiosInstance.post("/tlutil/updateCustomLink", args.body, { headers: authH(args.jwt) });
  },
  checkMchadMigrate(room: string, pass: string) {
    return axiosInstance.post("/tlutil/migrate/check", { Room: room, Pass: pass });
  },
  claimMchadMigrate(jwt: string, room: string, pass: string) {
    return axiosInstance.post("/tlutil/migrate/claim", { Room: room, Pass: pass }, { headers: authH(jwt) });
  },
  relayBotLogin(code: string, mode: any) {
    return axios.post(`${MCHATX_BASE}/holodexproxybot/user`, { code, mode });
  },
  relayBotCheckBotPresence(guildAddressList: string[]) {
    return axios.post(`${MCHATX_BASE}/holodexproxybot/guild`, { ids: guildAddressList });
  },
  relayBotGetChannels(guildAddress: string) {
    return axios.post(`${MCHATX_BASE}/holodexproxybot/channel`, { guild: guildAddress });
  },
  relayBotGetSettingChannel(channelAddress: string) {
    return axios.post(`${MCHATX_BASE}/holodexproxybot/data`, { channel: channelAddress });
  },
  relayBotSubmitData(channelAddress: string, data: any) {
    return axios.post(`${MCHATX_BASE}/holodexproxybot/submit`, { Address: channelAddress, SubChannel: data });
  },
  relayBotTrigger(channelAddress: string, mode: any, link: string, lang: string) {
    return axios.post(`${MCHATX_BASE}/holodexproxybot/trigger`, { Address: channelAddress, mode, link, lang });
  },
  requestChannel(obj: any) {
    return axiosInstance.post("/reports/channel", obj);
  },
};

export default api;
