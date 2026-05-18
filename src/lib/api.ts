import axios from "axios";
import { dayjs } from "@/lib/time";
import { ALL_VTUBERS_ORG, CACHE_TTL_MS, CHANNEL_URL_REGEX, VIDEO_URL_REGEX } from "@/lib/consts";
const MCHATX = "https://repo.mchatx.org";
const MAX_CONCURRENT = 6;

function qs(obj: Record<string, any> = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== null) p.append(k, String(v));
  return p.toString();
}

const isLiveInWindow = (live: any) => !!live.start_actual || !dayjs().isAfter(dayjs(live.start_scheduled).add(2, "h"));

let active = 0;
const queue: Array<() => void> = [];
const cache = new Map<string, { data: any; ts: number }>();
const inflight = new Map<string, Promise<any>>();

const drain = () => { while (active < MAX_CONCURRENT && queue.length) queue.shift()!(); };

const enqueue = <T,>(fn: () => Promise<T>) => new Promise<T>((resolve, reject) => {
  const run = () => { active++; fn().then(resolve, reject).finally(() => { active--; drain(); }); };
  if (active < MAX_CONCURRENT) run(); else queue.push(run);
});

function dedupGet<T>(url: string, config?: any): Promise<T> {
  const key = url + (config ? JSON.stringify(config) : "");
  const e = cache.get(key);
  if (e) {
    if (Date.now() - e.ts <= CACHE_TTL_MS) return Promise.resolve(e.data);
    cache.delete(key);
  }
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = enqueue(() => ax.get(url, config))
    .then((res: any) => { cache.set(key, { data: res, ts: Date.now() }); return res; })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

const ax = axios.create({ baseURL: "/api/v2", timeout: 30000 });
const H = (jwt?: string | null) => (jwt ? { Authorization: `BEARER ${jwt}` } : {});

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
    const cb = `itunes_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const w = window as any;
    const p = new URLSearchParams({ term: query, entity: "musicTrack", country, limit: String(limit), callback: cb });
    if (lang) p.set("lang", lang);
    const script = document.createElement("script");
    const cleanup = () => { delete w[cb]; script.remove(); };
    w[cb] = (data: ItunesResponse) => { resolve(data); cleanup(); };
    script.onerror = () => { cleanup(); reject(new Error("iTunes search failed")); };
    script.src = `https://itunes.apple.com/search?${p.toString()}`;
    document.head.appendChild(script);
  });
}

export const api = {
  orgs: () => fetch(`/statics/orgs.json`).then((r) => r.json()),
  stats: () => axios.get(`/statics/stats.json`),
  channels: (q: Record<string, any> = {}) => dedupGet(`/channels?${qs(q)}`),
  videos: (q: Record<string, any> = {}) => dedupGet(`/videos?${qs(q)}`),
  live: (q: Record<string, any> = {}) => dedupGet<any>(`/live?${qs(q)}`, { timeout: 10000 }).then((res: any) => res.data.filter(isLiveInWindow)),
  channel: (id: string) => ax.get(`/channels/${id}`),
  video: (id: string, lang?: string, c?: number) => ax.get(`/videos/${id}?${qs({ lang, c })}`),
  searchAutocomplete(query: string) {
    const ch = query.match(CHANNEL_URL_REGEX);
    if (ch?.groups?.id) return ax.get(`/search/autocomplete?${qs({ q: ch.groups.id })}`);
    const vid = query.match(VIDEO_URL_REGEX);
    if (vid?.groups?.id) return Promise.resolve({ data: [{ type: "video url", value: vid.groups.id }] });
    return ax.get(`/search/autocomplete?${qs({ q: query })}`);
  },
  searchVideo: (q: any) => ax.post("/search/videoSearch", q),
  searchComments: (q: any) => ax.post("/search/commentSearch", q),
  searchChannel: (q: any) => ax.post("/search/channelSearch", q),
  channelVideos: (id: string, { type = "videos", query = {} }: { type?: string; query?: Record<string, any> }) =>
    ax.get(`/channels/${id}/${type}?${qs(query)}`),
  login: (jwt: string | null, token: string, service: string) => ax.post("/user/login", { token, service }, { headers: H(jwt) }),
  loginIsValid: (jwt: string | null) => ax.get("/user/refresh", { headers: H(jwt) })
    .then((r) => r.status === 200 && r.data.jwt && r.data.user ? r : false).catch((e) => e.response || false),
  changeUsername: (jwt: string | null, name: string) => ax.post("/user", { name }, { headers: H(jwt) }).catch(() => false),
  resetAPIKey: (jwt: string | null) => ax.get("/user/createKey", { headers: H(jwt) }).catch(() => alert("something went wrong creating your key...")),
  favorites: (jwt: string | null) => ax.get("/users/favorites", { headers: H(jwt) }),
  favoritesVideos: (jwt: string | null, q: Record<string, any> = {}) => ax.get(`/users/videos?${qs(q)}`, { headers: H(jwt) }),
  favoritesLive({ includePlaceholder = false } = {}, jwt: string | null) {
    return ax.get(`/users/live?includePlaceholder=${includePlaceholder}`, { headers: H(jwt), timeout: 20000 })
      .then((r) => r.data.filter(isLiveInWindow).filter((l: any) => l.start_actual || dayjs(l.start_scheduled).isBefore(dayjs().add(3, "w"))));
  },
  allLive(orgs: string[] = [], q: Record<string, any> = {}) {
    const t = (orgs || []).filter(Boolean);
    if (!t.length || t.includes(ALL_VTUBERS_ORG)) return api.live({ ...q, org: ALL_VTUBERS_ORG });
    return Promise.all(t.map((org) => api.live({ ...q, org }))).then((r) => r.flat());
  },
  patchFavorites: (jwt: string | null, ops: any[]) => ax.patch("/users/favorites", ops, { headers: H(jwt) }),
  topics: () => ax.get("/topics"),
  getVideoTopic: (id: string) => ax.get(`/videos/${id}/topic`),
  topicSet: (topicId: string, videoId: string, jwt?: string | null) => ax.post("/topics/video", { videoId, topicId }, { headers: H(jwt) }),
  tryCreateSong: (song: any, jwt?: string | null) => ax.put("/songs", song, { headers: H(jwt) }),
  deleteSong: (song: any, jwt?: string | null) => ax.delete("/songs", { data: { ...song }, headers: H(jwt) }),
  deleteMentions: (id: string, channelIds: string[], jwt?: string | null) => ax.delete(`videos/${id}/mentions`, { data: { channel_ids: channelIds }, headers: H(jwt) }),
  addMention: (id: string, channel_id: string, jwt?: string | null) => ax.post(`videos/${id}/mentions`, { channel_id }, { headers: H(jwt) }),
  songListByVideo: (channel_id: string, video_id: string, allowCache = true) =>
    ax.post(`/songs/latest?c=${allowCache ? "_" : Math.floor(Math.random() * 100)}`, { channel_id, video_id, limit: 1000 }),
  chatHistory: (id: string, q: Record<string, any> = {}) => ax.get(`videos/${id}/chats?${qs(q)}`),
  getMentions: (id: string) => ax.get(`videos/${id}/mentions`),
  getPlaylistList: (jwt: string) => ax.get("/users/playlists", { headers: H(jwt) }),
  getPlaylist: (id: string | number) => ax.get(`/playlist/${id}`),
  savePlaylist: (obj: any, jwt: string) => ax.post("/playlist/", obj, { headers: H(jwt) }),
  deletePlaylist: (id: string | number, jwt: string) => ax.delete(`/playlist/${id}`, { headers: H(jwt) }),
  reportVideo: (id: string, body: any[], jwt: string) => ax.post(`/reports/video/${id}`, body, { headers: H(jwt) }),
  trackMultiviewLink: (link: string) => ax.get(`/multiview/record/${link}`),
  discordServerInfo: (invite: string) => ax.get(`https://discord.com/api/v8/invites/${invite}`),
  addPlaceholderStream: (body: any, jwt?: string | null, token?: string) =>
    ax.post(`videos/placeholder${token ? `?token=${token}` : ""}`, body, { headers: H(jwt) }),
  getPlaylistState: (id: string, jwt?: string | null) => ax.get(`/video-playlist/${id}`, { headers: H(jwt) }),
  addVideoToPlaylist: (id: string, plId: string | number, jwt?: string | null) => ax.put(`/video-playlist/${plId}/${id}`, null, { headers: H(jwt) }),
  deleteVideoFromPlaylist: (id: string, plId: string | number, jwt?: string | null) => ax.delete(`/video-playlist/${plId}/${id}`, { headers: H(jwt) }),
  postTL: (a: any) => ax.post(`/videos/${a.videoId}/chats?${qs({ lang: a.lang, custom_video_id: a.custom_video_id })}`, a.body, { headers: H(a.jwt) }),
  getTLStats: (jwt: string, q: any) => ax.get(`/tlutil?${qs(q)}`, { headers: H(jwt) }),
  postTLLog(a: { videoId: string; jwt?: string; body: any; lang: string; custom_video_id?: string; override?: boolean }) {
    const headers: Record<string, string> = { ...H(a.jwt) };
    if (a.override) headers.Override = "true";
    return ax.post(`/videos/${a.videoId}/scripteditor/log?${qs({ lang: a.lang, custom_video_id: a.custom_video_id })}`, a.body, { headers });
  },
  postChangeLink: (a: { jwt?: string; body: any }) => ax.post("/tlutil/updateCustomLink", a.body, { headers: H(a.jwt) }),
  checkMchadMigrate: (Room: string, Pass: string) => ax.post("/tlutil/migrate/check", { Room, Pass }),
  claimMchadMigrate: (jwt: string, Room: string, Pass: string) => ax.post("/tlutil/migrate/claim", { Room, Pass }, { headers: H(jwt) }),
  relayBotLogin: (code: string, mode: any) => axios.post(`${MCHATX}/holodexproxybot/user`, { code, mode }),
  relayBotCheckBotPresence: (ids: string[]) => axios.post(`${MCHATX}/holodexproxybot/guild`, { ids }),
  relayBotGetChannels: (guild: string) => axios.post(`${MCHATX}/holodexproxybot/channel`, { guild }),
  relayBotGetSettingChannel: (channel: string) => axios.post(`${MCHATX}/holodexproxybot/data`, { channel }),
  relayBotSubmitData: (Address: string, SubChannel: any) => axios.post(`${MCHATX}/holodexproxybot/submit`, { Address, SubChannel }),
  relayBotTrigger: (Address: string, mode: any, link: string, lang: string) => axios.post(`${MCHATX}/holodexproxybot/trigger`, { Address, mode, link, lang }),
  requestChannel: (obj: any) => ax.post("/reports/channel", obj),
};

export default api;
