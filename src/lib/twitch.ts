import { CACHE_TTL_MS, TWITCH_VIDEO_URL_REGEX } from "@/lib/consts";
import { readJSON, writeJSON } from "@/lib/browser";
const TWITCH_GQL_ENDPOINTS = ["/twitch-gql", "https://gql.twitch.tv/gql"] as const;
const TWITCH_WEB_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";
const STORAGE_KEY = "holodex-twitch-viewer-counts-v1";

const normalizeLogin = (login: string) => login.trim().toLowerCase();

const viewerCountCache = new Map<string, { ts: number; value: number }>(
    Object.entries(readJSON<Record<string, { ts: number; value: number }>>(STORAGE_KEY, {}))
        .filter(([, e]) => e && Number.isFinite(e.ts) && Number.isFinite(e.value))
        .map(([login, e]) => [normalizeLogin(login), { ts: e.ts, value: e.value }])
);
const inflightRequests = new Map<string, Promise<Record<string, number>>>();

function persistViewerCountCache() {
    const now = Date.now();
    writeJSON(STORAGE_KEY, Object.fromEntries([...viewerCountCache].filter(([, e]) => now - e.ts <= CACHE_TTL_MS)));
}

function getCachedViewerCount(login: string) {
    const normalized = normalizeLogin(login);
    const cached = viewerCountCache.get(normalized);
    if (!cached) return null;
    if (Date.now() - cached.ts > CACHE_TTL_MS) {
        viewerCountCache.delete(normalized);
        persistViewerCountCache();
        return null;
    }
    return cached.value;
}

function setCachedViewerCount(login: string, value: number) {
    viewerCountCache.set(normalizeLogin(login), {
        ts: Date.now(),
        value: Number.isFinite(value) ? value : 0,
    });
}

async function requestViewerCounts(logins: string[]) {
    const fields = logins.map((login, i) => `u${i}: user(login: ${JSON.stringify(login)}) { stream { viewersCount } }`).join("\n");
    const body = JSON.stringify({ query: `query HolodexTwitchLiveViewerCounts {\n${fields}\n}` });
    let lastError: unknown = null;
    for (const endpoint of TWITCH_GQL_ENDPOINTS) {
        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { Accept: "application/json", "Client-Id": TWITCH_WEB_CLIENT_ID, "Content-Type": "application/json" },
                body,
            });
            if (!response.ok) { lastError = new Error(`Twitch GQL request failed: ${response.status}`); continue; }
            const payload = await response.json();
            const data = Array.isArray(payload) ? payload[0]?.data : payload?.data;
            return logins.reduce((acc, login, i) => {
                const v = Number(data?.[`u${i}`]?.stream?.viewersCount ?? 0);
                acc[login] = Number.isFinite(v) ? v : 0;
                return acc;
            }, {} as Record<string, number>);
        } catch (error) { lastError = error; }
    }
    throw lastError ?? new Error("Unable to resolve Twitch viewer counts");
}

export function getTwitchLogin(video?: Record<string, any> | null) {
    if (!video || typeof video !== "object") return null;
    const loginFromLink = video.link?.match?.(TWITCH_VIDEO_URL_REGEX)?.groups?.id;
    const login = loginFromLink || video.channel?.twitch || (video.type === "twitch" ? video.id : null);
    if (!login || typeof login !== "string") return null;
    return normalizeLogin(login);
}

export function getTwitchViewerCountFingerprint(counts: Record<string, number>) {
    return Object.keys(counts).sort().map((login) => `${login}:${counts[login]}`).join(",");
}

export function readCachedTwitchViewerCounts(logins: string[]) {
    const out: Record<string, number> = {};
    for (const login of new Set((logins || []).map(normalizeLogin))) {
        const cached = getCachedViewerCount(login);
        if (cached !== null) out[login] = cached;
    }
    return out;
}

export function mergeTwitchViewerCountsIntoVideos(videos: any[], counts: Record<string, number>) {
    return (videos || []).map((video) => {
        const login = getTwitchLogin(video);
        if (!login) return video;
        const v = counts[login];
        return v === undefined || video.live_viewers === v ? video : { ...video, live_viewers: v };
    });
}

export async function fetchTwitchViewerCounts(logins: string[]) {
    const normalized = [...new Set((logins || []).filter((l): l is string => typeof l === "string" && l.trim().length > 0).map(normalizeLogin))];
    if (!normalized.length) return {} as Record<string, number>;
    const cached = readCachedTwitchViewerCounts(normalized);
    const missing = normalized.filter((l) => cached[l] === undefined);
    if (!missing.length) return cached;
    const key = missing.join(",");
    let request = inflightRequests.get(key);
    if (!request) {
        request = requestViewerCounts(missing)
            .then((counts) => {
                Object.entries(counts).forEach(([l, v]) => setCachedViewerCount(l, v));
                persistViewerCountCache();
                return counts;
            })
            .finally(() => inflightRequests.delete(key));
        inflightRequests.set(key, request);
    }
    try { return { ...cached, ...(await request) }; }
    catch (error) { console.error("Failed to resolve Twitch viewer counts", error); return cached; }
}

export async function enrichLiveVideosWithTwitchViewerCounts(videos: any[]) {
    const logins = (videos || []).filter((v) => v?.status === "live").map(getTwitchLogin).filter((l): l is string => !!l);
    if (!logins.length) return videos;
    return mergeTwitchViewerCountsIntoVideos(videos, await fetchTwitchViewerCounts(logins));
}
