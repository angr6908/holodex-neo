import { dayjs } from "@/utils/time";
import axios, { AxiosResponse } from "axios";
import { CHANNEL_URL_REGEX, VIDEO_URL_REGEX } from "./consts";
import type { Playlist, PlaylistList } from "./types";

/** Drop-in replacement for `qs` using the native URLSearchParams API. */
function qs(obj: Record<string, any>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null) {
      params.append(key, String(value));
    }
  }
  return params.toString();
}

// ── Concurrency-limited fetch pool ──────────────────────────────────────────
const MAX_CONCURRENT = 6;
let activeRequests = 0;
const requestQueue: Array<{ run: () => void }> = [];

function enqueueRequest<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      activeRequests++;
      fn()
        .then(resolve, reject)
        .finally(() => {
          activeRequests--;
          drainQueue();
        });
    };
    if (activeRequests < MAX_CONCURRENT) {
      run();
    } else {
      requestQueue.push({ run });
    }
  });
}

function drainQueue() {
  while (activeRequests < MAX_CONCURRENT && requestQueue.length > 0) {
    requestQueue.shift()!.run();
  }
}

// ── Response cache with TTL ─────────────────────────────────────────────────
// Caches GET responses for CACHE_TTL_MS so tab switches / re-renders hit memory.
const CACHE_TTL_MS = 60_000;
const responseCache = new Map<string, { data: any; ts: number }>();

function getCached(key: string): any | undefined {
  const entry = responseCache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    responseCache.delete(key);
    return undefined;
  }
  return entry.data;
}

function setCache(key: string, data: any) {
  responseCache.set(key, { data, ts: Date.now() });
}

// ── In-flight dedup + response cache ────────────────────────────────────────
const inflightGets = new Map<string, Promise<any>>();

function deduplicatedGet<T>(url: string, config?: any): Promise<T> {
  const key = url + (config ? JSON.stringify(config) : "");

  // Return from cache if fresh
  const cached = getCached(key);
  if (cached !== undefined) return Promise.resolve(cached);

  // Deduplicate concurrent identical requests
  const existing = inflightGets.get(key);
  if (existing) return existing;

  const promise = enqueueRequest(() => axiosInstance.get(url, config))
    .then((res: any) => { setCache(key, res); return res; })
    .finally(() => { inflightGets.delete(key); });
  inflightGets.set(key, promise);
  return promise;
}

// Need full domain for socket.io to work!!
export const API_BASE_URL = `${window.location.origin}/api`;
export const SITE_BASE_URL = `${window.location.origin}`;
export const axiosInstance = (() => {
  const instance = axios.create({
    baseURL: `${API_BASE_URL}/v2`,
    timeout: 30000,
  });
  return instance;
})();

export default {
  orgs() {
    // Use fetch api to take advantage of pre-fetch
    return fetch(`${SITE_BASE_URL}/statics/orgs.json`).then((r) => r.json());
  },
  stats() {
    return axiosInstance({
      url: "/statics/stats.json",
      baseURL: SITE_BASE_URL,
    });
  },
  channels(query) {
    const q = qs(query);
    return deduplicatedGet(`/channels?${q}`);
  },
  videos(query) {
    const q = qs(query);
    return deduplicatedGet(`/videos?${q}`);
  },
  live(query) {
    const q = qs(query);
    return deduplicatedGet(`/live?${q}`, { timeout: 10000 }).then((res: any) => res.data
        .filter(
          (live) => !(
              !live.start_actual
              && dayjs().isAfter(dayjs(live.start_scheduled).add(2, "h"))
            ),
        ));
  },
  channel(id) {
    return axiosInstance.get(`/channels/${id}`);
  },
  /**
   * Fetches a video
   * @param id the ID of the video
   * @param lang the acceptable subtitle languages
   * @param c whether to also provide comments, 1 to activate
   * @returns
   */
  video(id: string, lang?: string, c?: number) {
    const q = qs({ lang, c });
    return axiosInstance.get(`/videos/${id}?${q}`);
  },
  comments(videoId) {
    return axiosInstance.get(`/videos/${videoId}/comments`);
  },
  clips(query) {
    const q = qs(query);
    return deduplicatedGet(`/clips?${q}`);
  },
  searchAutocomplete(query) {
    const channelMatch = query.match(CHANNEL_URL_REGEX);
    const videoMatch = query.match(VIDEO_URL_REGEX);

    if (channelMatch) {
      const q = qs({ q: channelMatch.groups.id });
      return axiosInstance.get(`/search/autocomplete?${q}`);
    }

    if (videoMatch) {
      return { data: [{ type: "video url", value: videoMatch.groups.id }] };
    }

    const q = qs({ q: query });
    return axiosInstance.get(`/search/autocomplete?${q}`);
  },
  searchVideo(queryObject) {
    return axiosInstance.post("/search/videoSearch", queryObject);
  },
  searchComments(queryObject) {
    return axiosInstance.post("/search/commentSearch", queryObject);
  },
  searchChannel(queryObject) {
    return axiosInstance.post("/search/channelSearch", queryObject);
  },
  channelVideos(channelId, { type = "videos", query }) {
    const q = qs(query);
    return axiosInstance.get(`/channels/${channelId}/${type}?${q}`);
  },
  login(jwt, authToken, service) {
    return axiosInstance.post(
      "/user/login",
      { token: authToken, service },
      {
        headers: jwt ? { Authorization: `BEARER ${jwt}` } : {},
      },
    );
  },
  loginIsValid(jwt): Promise<false | AxiosResponse<any>> {
    return axiosInstance
      .get("/user/refresh", {
        headers: jwt ? { Authorization: `BEARER ${jwt}` } : {},
      })
      .then((resp) => {
        // catching irregular responses, such as URL being offline or something wrong with the backend that causes index.html to be returned.
        if (resp.status === 200 && resp.data.jwt && resp.data.user) return resp;
        return false; // network error?
      })
      .catch((e) => {
        if (e.response) return e.response;
        return false;
      });
  },
  changeUsername(jwt, newUsername): Promise<false | AxiosResponse<any>> {
    return axiosInstance
      .post(
        "/user",
        { name: newUsername },
        {
          headers: jwt ? { Authorization: `BEARER ${jwt}` } : {},
        },
      )
      .catch(() => false);
  },
  resetAPIKey(jwt) {
    return axiosInstance
      .get("/user/createKey", {
        headers: jwt ? { Authorization: `BEARER ${jwt}` } : {},
      })
      .catch(() => alert("something went wrong creating your key..."));
  },
  favorites(jwt) {
    return axiosInstance.get("/users/favorites", {
      headers: jwt ? { Authorization: `BEARER ${jwt}` } : {},
    });
  },
  favoritesVideos(jwt, query) {
    const q = qs(query);
    return axiosInstance.get(`/users/videos?${q}`, {
      headers: jwt ? { Authorization: `BEARER ${jwt}` } : {},
    });
  },
  favoritesLive({ includePlaceholder = false }, jwt) {
    return axiosInstance
      .get(`/users/live?includePlaceholder=${includePlaceholder}`, {
        headers: jwt ? { Authorization: `BEARER ${jwt}` } : {},
        timeout: 20000,
      })
      .then((res) => res.data
          // .concat(res.data.upcoming)
          // filter out streams that was goes unlisted if stream hasn't gone live 2 hours after scheduled
          .filter(
            (live) => !(
                !live.start_actual
                && dayjs().isAfter(dayjs(live.start_scheduled).add(2, "h"))
              ),
          )
          // get currently live and upcoming lives within the next 3 weeks
          .filter(
            (live) => (
                live.start_actual
                || dayjs(live.start_scheduled).isBefore(dayjs().add(3, "w"))
              ),
          ));
  },
  allLive(orgs, query) {
    const targets = (orgs || []).filter(Boolean);
    if (targets.length === 0 || targets.includes("All Vtubers")) {
      return this.live({ ...query, org: "All Vtubers" });
    }
    // Requests flow through the concurrency pool (MAX_CONCURRENT),
    // so even many orgs won't overwhelm the backend.
    return Promise.all(
      targets.map((org) => this.live({ ...query, org })),
    ).then((responses) => responses.flat());
  },
  patchFavorites(jwt, operations) {
    return axiosInstance.patch("/users/favorites", operations, {
      headers: jwt ? { Authorization: `BEARER ${jwt}` } : {},
    });
  },
  getVideoTopic(videoId) {
    return axiosInstance.get(`/videos/${videoId}/topic`);
  },
  topics() {
    // gets topics from backend
    return axiosInstance.get("/topics");
  },
  topicSet(topicId, videoId, jwt) {
    return axiosInstance.post(
      "/topics/video",
      { videoId, topicId },
      {
        headers: jwt ? { Authorization: `BEARER ${jwt}` } : {},
      },
    );
  },
  rotation() {
    return axiosInstance.get("/rotation");
  },
  songListByVideo(channelId, videoId, allowCache) {
    const dt = allowCache ? "_" : Math.floor(Math.random() * 100);
    return axiosInstance.post(`/songs/latest?c=${dt}`, {
      channel_id: channelId,
      video_id: videoId,
      limit: 1000,
    });
  },
  tryCreateSong(songObj, jwt) {
    return axiosInstance.put("/songs", songObj, {
      headers: jwt ? { Authorization: `BEARER ${jwt}` } : {},
    });
  },
  deleteSong(songObj, jwt) {
    return axiosInstance.delete("/songs", {
      data: { ...songObj },

      headers: jwt ? { Authorization: `BEARER ${jwt}` } : {},
    });
  },
  chatHistory(videoId, query) {
    const q = qs(query);
    return axiosInstance.get(`videos/${videoId}/chats?${q}`);
  },
  getMentions(videoId) {
    return axiosInstance.get(`videos/${videoId}/mentions`);
  },
  deleteMentions(videoId, channelIds, jwt) {
    return axiosInstance.delete(`videos/${videoId}/mentions`, {
      data: {
        channel_ids: channelIds,
      },

      headers: jwt ? { Authorization: `BEARER ${jwt}` } : {},
    });
  },
  addMention(videoId, channelId, jwt) {
    return axiosInstance.post(
      `videos/${videoId}/mentions`,
      {
        channel_id: channelId,
      },
      {
        headers: jwt ? { Authorization: `BEARER ${jwt}` } : {},
      },
    );
  },
  getPlaylistList(jwt: string) {
    if (!jwt) throw new Error("Not authorized");
    return axiosInstance.get<PlaylistList>("/users/playlists", {
      headers: jwt ? { Authorization: `BEARER ${jwt}` } : {},
    });
  },
  getPlaylist(id: string | number) {
    if (!id) throw new Error("Arg bad");
    return axiosInstance.get<Playlist>(`/playlist/${id}`);
  },
  savePlaylist(obj: Playlist, jwt: string) {
    return axiosInstance.post("/playlist/", obj, {
      headers: jwt ? { Authorization: `BEARER ${jwt}` } : {},
    });
  },
  deletePlaylist(id: string | number, jwt: string) {
    if (!id || !jwt) throw new Error("Arg bad");
    return axiosInstance.delete(`/playlist/${id}`, {
      headers: jwt ? { Authorization: `BEARER ${jwt}` } : {},
    });
  },
  reportVideo(id: string, body: Array<object>, jwt: string) {
    if (!id) throw new Error("Arg bad");
    return axiosInstance.post(`/reports/video/${id}`, body, {
      headers: jwt ? { Authorization: `BEARER ${jwt}` } : {},
    });
  },
  trackMultiviewLink(link) {
    return axiosInstance.get(`/multiview/record/${link}`);
  },
  discordServerInfo(inviteLink) {
    return axiosInstance.get(
      `https://discord.com/api/v8/invites/${inviteLink}`,
    );
  },
  addPlaceholderStream(body, jwt, token) {
    return axiosInstance.post(
      `videos/placeholder${token ? `?token=${token}` : ""}`,
      body,
      {
        headers: jwt ? { Authorization: `BEARER ${jwt}` } : {},
      },
    );
  },
  deletePlaceholderStream(videoId, jwt, _token) {
    return axiosInstance.delete(`videos/placeholder/${videoId}`, {
      headers: jwt ? { Authorization: `BEARER ${jwt}` } : {},
    });
  },
  getPlaylistState(videoId, jwt) {
    return axiosInstance.get<{ id: number; name: string; contains: boolean }[]>(
      `/video-playlist/${videoId}`,
      {
        headers: jwt ? { Authorization: `BEARER ${jwt}` } : {},
      },
    );
  },
  addVideoToPlaylist(videoId, playlistId, jwt) {
    return axiosInstance.put(`/video-playlist/${playlistId}/${videoId}`, null, {
      headers: jwt ? { Authorization: `BEARER ${jwt}` } : {},
    });
  },
  deleteVideoFromPlaylist(videoId, playlistId, jwt) {
    return axiosInstance.delete(`/video-playlist/${playlistId}/${videoId}`, {
      headers: jwt ? { Authorization: `BEARER ${jwt}` } : {},
    });
  },
  postTL({
    videoId,
    jwt,
    body,
    lang,
    custom_video_id,
  }: {
    videoId: string;
    jwt: string;
    body: any;
    lang: string;
    custom_video_id?: string;
  }) {
    const q = qs({ lang, custom_video_id });
    return axiosInstance.post(`/videos/${videoId}/chats?${q}`, body, {
      headers: jwt ? { Authorization: `BEARER ${jwt}` } : {},
    });
  },
  postBulkTL({
    videoId,
    jwt,
    body,
    lang,
    custom_video_id,
  }: {
    videoId: string;
    jwt: string;
    body: any;
    lang: string;
    custom_video_id?: string;
  }) {
    const q = qs({ lang, custom_video_id });
    return axiosInstance.post(`/videos/${videoId}/chatsBulk?${q}`, body, {
      headers: jwt ? { Authorization: `BEARER ${jwt}` } : {},
    });
  },
  getTLStats(jwt, query) {
    const q = qs(query);
    return axiosInstance.get(`/tlutil?${q}`, {
      headers: jwt ? { Authorization: `BEARER ${jwt}` } : {},
    });
  },
  postTLLog({
    videoId,
    jwt,
    body,
    lang,
    custom_video_id,
    override,
  }: {
    videoId: string;
    jwt: string;
    body: any;
    lang: string;
    custom_video_id?: string;
    override?: boolean;
  }) {
    const q = qs({ lang, custom_video_id });
    const head: any = {};
    if (jwt) {
      head.Authorization = `BEARER ${jwt}`;
    }
    if (override) {
      head.Override = "true";
    }
    return axiosInstance.post(
      `/videos/${videoId}/scripteditor/log?${q}`,
      body,
      {
        headers: head,
      },
    );
  },
  postChangeLink({
    jwt,
    body,
  }: {
    jwt: string;
    body: {
        oldId: string,
        newId: string,
        lang: string,
    };
    override?: boolean;
  }) {
    const head: any = {};
    if (jwt) {
      head.Authorization = `BEARER ${jwt}`;
    }
    return axiosInstance.post(
      "/tlutil/updateCustomLink",
      body,
      {
        headers: head,
      },
    );
  },
  fetchMChadData(room, pass) {
    return axios.post("https://repo.mchatx.org/v2/HolodexDahcM/data", {
      Room: room,
      Pass: pass,
    });
  },
  checkMchadMigrate(room, pass) {
    return axiosInstance.post("/tlutil/migrate/check", {
      Room: room,
      Pass: pass,
    });
  },
  claimMchadMigrate(jwt, room, pass) {
    return axiosInstance.post(
      "/tlutil/migrate/claim",
      {
        Room: room,
        Pass: pass,
      },
      {
        headers: jwt ? { Authorization: `BEARER ${jwt}` } : {},
      },
    );
  },
  requestChannel(obj) {
    return axiosInstance.post("/reports/channel", obj);
  },

  // ---------- RELAY BOT DISCORD LOGIN ----------
  relayBotLogin(code, mode) {
    return axios.post("https://repo.mchatx.org/holodexproxybot/user", {
      code,
      mode,
    });
  },
  relayBotCheckBotPresence(guildAddressList) {
    return axios.post("https://repo.mchatx.org/holodexproxybot/guild", {
      ids: guildAddressList,
    });
  },
  relayBotGetChannels(guildAddress) {
    return axios.post("https://repo.mchatx.org/holodexproxybot/channel", {
      guild: guildAddress,
    });
  },
  relayBotGetSettingChannel(channelAddress) {
    return axios.post("https://repo.mchatx.org/holodexproxybot/data", {
      channel: channelAddress,
    });
  },
  relayBotSubmitData(channelAddress, data) {
    return axios.post("https://repo.mchatx.org/holodexproxybot/submit", {
      Address: channelAddress,
      SubChannel: data,
    });
  },
  relayBotTrigger(channelAddress, mode, link, lang) {
    return axios.post("https://repo.mchatx.org/holodexproxybot/trigger", {
      Address: channelAddress,
      mode,
      link,
      lang,
    });
  },
  //= ========= RELAY BOT DISCORD LOGIN ==========
};
