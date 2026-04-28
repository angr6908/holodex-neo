import { TWITCH_VIDEO_URL_REGEX } from "@/lib/consts";

const TWITCH_GQL_ENDPOINTS = ["/twitch-gql", "https://gql.twitch.tv/gql"] as const;
const TWITCH_WEB_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";
const CACHE_TTL_MS = 60_000;
const STORAGE_KEY = "holodex-twitch-viewer-counts-v1";

function readPersistedCacheEntries(): Array<[string, { ts: number; value: number }]> {
    if (typeof window === "undefined") return [];
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as Record<string, { ts: number; value: number }>;
        return Object.entries(parsed || {})
            .filter(([, entry]) => entry && Number.isFinite(entry.ts) && Number.isFinite(entry.value))
            .map(([login, entry]) => [normalizeLogin(login), { ts: entry.ts, value: entry.value }]);
    } catch {
        return [];
    }
}

const viewerCountCache = new Map<string, { ts: number; value: number }>(readPersistedCacheEntries());
const inflightRequests = new Map<string, Promise<Record<string, number>>>();

function normalizeLogin(login: string) {
    return login.trim().toLowerCase();
}

function persistViewerCountCache() {
    if (typeof window === "undefined") return;
    try {
        const now = Date.now();
        const serializable = Object.fromEntries(
            Array.from(viewerCountCache.entries()).filter(([, entry]) => now - entry.ts <= CACHE_TTL_MS)
        );
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
    } catch {
        // Ignore storage failures; the in-memory cache still works.
    }
}

function fingerprintCounts(counts: Record<string, number>) {
    return Object.keys(counts)
        .sort()
        .map((login) => `${login}:${counts[login]}`)
        .join(",");
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

function buildViewerCountQuery(logins: string[]) {
    const fields = logins
        .map((login, index) => `u${index}: user(login: ${JSON.stringify(login)}) { stream { viewersCount } }`)
        .join("\n");
    return `query HolodexTwitchLiveViewerCounts {\n${fields}\n}`;
}

async function requestViewerCounts(logins: string[]) {
    const body = JSON.stringify({
        query: buildViewerCountQuery(logins),
    });

    let lastError: unknown = null;

    for (const endpoint of TWITCH_GQL_ENDPOINTS) {
        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Client-Id": TWITCH_WEB_CLIENT_ID,
                    "Content-Type": "application/json",
                },
                body,
            });

            if (!response.ok) {
                lastError = new Error(`Twitch GQL request failed: ${response.status}`);
                continue;
            }

            const payload = await response.json();
            const data = Array.isArray(payload) ? payload[0]?.data : payload?.data;
            const counts = logins.reduce((acc, login, index) => {
                const value = Number(data?.[`u${index}`]?.stream?.viewersCount ?? 0);
                acc[login] = Number.isFinite(value) ? value : 0;
                return acc;
            }, {} as Record<string, number>);

            return counts;
        } catch (error) {
            lastError = error;
        }
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
    return fingerprintCounts(counts);
}

export function readCachedTwitchViewerCounts(logins: string[]) {
    return [...new Set((logins || []).map((login) => normalizeLogin(login)))]
        .reduce((acc, login) => {
            const cached = getCachedViewerCount(login);
            if (cached !== null) acc[login] = cached;
            return acc;
        }, {} as Record<string, number>);
}

export function mergeTwitchViewerCountsIntoVideos(videos: any[], counts: Record<string, number>) {
    return (videos || []).map((video) => {
        const twitchLogin = getTwitchLogin(video);
        if (!twitchLogin) return video;
        const resolvedViewerCount = counts[twitchLogin];
        if (resolvedViewerCount === undefined) return video;
        if (video.live_viewers === resolvedViewerCount) return video;
        return {
            ...video,
            live_viewers: resolvedViewerCount,
        };
    });
}

export async function fetchTwitchViewerCounts(logins: string[]) {
    const normalized = [...new Set(
        (logins || [])
            .filter((login): login is string => typeof login === "string" && login.trim().length > 0)
            .map(normalizeLogin),
    )];

    if (normalized.length === 0) return {} as Record<string, number>;

    const cachedCounts = readCachedTwitchViewerCounts(normalized);

    const missing = normalized.filter((login) => cachedCounts[login] === undefined);
    if (missing.length === 0) return cachedCounts;

    const key = missing.join(",");
    let request = inflightRequests.get(key);
    if (!request) {
        request = requestViewerCounts(missing)
            .then((counts) => {
                Object.entries(counts).forEach(([login, value]) => {
                    setCachedViewerCount(login, value);
                });
                persistViewerCountCache();
                return counts;
            })
            .finally(() => {
                inflightRequests.delete(key);
            });
        inflightRequests.set(key, request);
    }

    try {
        const resolved = await request;
        return {
            ...cachedCounts,
            ...resolved,
        };
    } catch (error) {
        console.warn("Failed to resolve Twitch viewer counts", error);
        return cachedCounts;
    }
}

export async function enrichLiveVideosWithTwitchViewerCounts(videos: any[]) {
    const logins = [...new Set(
        (videos || [])
            .filter((video: any) => video?.status === "live")
            .map((video: any) => getTwitchLogin(video))
            .filter((login): login is string => !!login),
    )];

    if (logins.length === 0) return videos;

    const counts = await fetchTwitchViewerCounts(logins);
    return mergeTwitchViewerCountsIntoVideos(videos, counts);
}
