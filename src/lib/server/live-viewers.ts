import { TWITCH_VIDEO_URL_REGEX } from "@/lib/consts";

// Server-side concurrent-viewer counts, read straight from YouTube and Twitch (never from
// Holodex) and injected into the live list by the API proxy so the client receives videos
// already carrying `_ccv`. Runs close to the sources, in parallel, with a short shared TTL
// cache + in-flight de-dupe so a stream is fetched at most once per window no matter how
// many clients or requests hit it. Node runtime only.

// ===================== YouTube (InnerTube updated_metadata) =====================
// Public web InnerTube key baked into youtube.com — the same endpoint the watch page polls
// for its live "N watching now" counter. No Data API key, no quota.
const INNERTUBE_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
const YT_CLIENT = { clientName: "WEB", clientVersion: "2.20241201.00.00", hl: "en", gl: "US" };
const YT_TTL_MS = 10_000;

// `found` = we located YouTube's view-count renderer, i.e. we got a real answer. It lets a
// callers tell "YouTube says this ended" (found && !isLive) apart from "couldn't read it"
// (members-gated / private / transient), so only the former is treated as an ended stream.
type YoutubeViewerResult = { live_viewers: number | null; isLive: boolean; found: boolean };

// The count nests inside a `videoViewCountRenderer`; find it wherever InnerTube puts it.
function findViewCountRenderer(node: any): any {
  if (!node || typeof node !== "object") return null;
  if (node.videoViewCountRenderer) return node.videoViewCountRenderer;
  for (const key in node) {
    const found = findViewCountRenderer(node[key]);
    if (found) return found;
  }
  return null;
}

function extractYoutube(data: any): YoutubeViewerResult {
  const r = findViewCountRenderer(data);
  if (!r) return { live_viewers: null, isLive: false, found: false };
  const count = Number(r.originalViewCount); // concurrent viewers for a live stream
  return { live_viewers: Number.isFinite(count) ? count : null, isLive: !!r.isLive, found: true };
}

const ytCache = new Map<string, { at: number; data: YoutubeViewerResult }>();
const ytInflight = new Map<string, Promise<YoutubeViewerResult>>();

async function fetchYoutube(videoId: string): Promise<YoutubeViewerResult> {
  const upstream = await fetch(
    `https://www.youtube.com/youtubei/v1/updated_metadata?key=${INNERTUBE_KEY}&prettyPrint=false`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://www.youtube.com",
        Referer: `https://www.youtube.com/watch?v=${videoId}`,
      },
      body: JSON.stringify({ context: { client: YT_CLIENT }, videoId }),
      cache: "no-store",
    },
  );
  if (!upstream.ok) throw new Error(`youtube ${upstream.status}`);
  return extractYoutube(await upstream.json());
}

export function getYoutubeViewers(videoId: string): Promise<YoutubeViewerResult> {
  const hit = ytCache.get(videoId);
  if (hit && Date.now() - hit.at < YT_TTL_MS) return Promise.resolve(hit.data);
  const pending = ytInflight.get(videoId);
  if (pending) return pending;
  const p = fetchYoutube(videoId)
    .then((data) => {
      ytCache.set(videoId, { at: Date.now(), data });
      if (ytCache.size > 512)
        for (const [k, v] of ytCache) if (Date.now() - v.at >= YT_TTL_MS) ytCache.delete(k);
      return data;
    })
    .finally(() => ytInflight.delete(videoId));
  ytInflight.set(videoId, p);
  return p;
}

// ============================ Twitch (public GQL) ============================
const TWITCH_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";
const TW_TTL_MS = 10_000;
const TW_OFFLINE = -1;
const normLogin = (l: string) => l.trim().toLowerCase();

const twCache = new Map<string, { at: number; value: number }>();
const twInflight = new Map<string, Promise<Record<string, number>>>();

async function fetchTwitch(logins: string[]): Promise<Record<string, number>> {
  const fields = logins
    .map((l, i) => `u${i}: user(login: ${JSON.stringify(l)}) { stream { viewersCount } }`)
    .join("\n");
  const body = JSON.stringify({ query: `query HolodexTwitchLiveViewerCounts {\n${fields}\n}` });
  const r = await fetch("https://gql.twitch.tv/gql", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Client-Id": TWITCH_CLIENT_ID,
      "Content-Type": "application/json",
      Origin: "https://www.twitch.tv",
      Referer: "https://www.twitch.tv/",
    },
    body,
  });
  if (!r.ok) throw new Error(`twitch ${r.status}`);
  const payload = await r.json();
  const data = Array.isArray(payload) ? payload[0]?.data : payload?.data;
  return logins.reduce(
    (acc, l, i) => {
      const stream = data?.[`u${i}`]?.stream;
      const v = Number(stream?.viewersCount ?? 0);
      acc[l] = stream ? (Number.isFinite(v) ? v : 0) : TW_OFFLINE;
      return acc;
    },
    {} as Record<string, number>,
  );
}

export async function getTwitchViewers(logins: string[]): Promise<Record<string, number>> {
  const uniq = [...new Set(logins.map(normLogin))].filter(Boolean);
  const out: Record<string, number> = {};
  const missing: string[] = [];
  for (const l of uniq) {
    const hit = twCache.get(l);
    if (hit && Date.now() - hit.at < TW_TTL_MS) out[l] = hit.value;
    else missing.push(l);
  }
  if (!missing.length) return out;
  const key = missing.join(",");
  let req = twInflight.get(key);
  if (!req) {
    req = fetchTwitch(missing)
      .then((counts) => {
        const now = Date.now();
        for (const [l, v] of Object.entries(counts)) twCache.set(l, { at: now, value: v });
        return counts;
      })
      .finally(() => twInflight.delete(key));
    twInflight.set(key, req);
  }
  try {
    return { ...out, ...(await req) };
  } catch {
    return out;
  }
}

// ===================== Twitch stream info (title/category/bio) =====================
// Holodex placeholder streams (external Twitch streams) carry an auto-generated bot
// `description` that is internal junk, not something worth showing. The real "description"
// for a Twitch stream lives on Twitch: the channel bio plus the current title/category.
// Fetch it from the same public GQL endpoint used for viewer counts. Longer TTL than the
// count — bio/category barely change during a stream.
export type TwitchStreamInfo = { title: string; category: string; description: string };
const TW_INFO_TTL_MS = 60_000;
const twInfoCache = new Map<string, { at: number; value: TwitchStreamInfo | null }>();
const twInfoInflight = new Map<string, Promise<TwitchStreamInfo | null>>();

async function fetchTwitchInfo(login: string): Promise<TwitchStreamInfo | null> {
  const query = `query HolodexTwitchStreamInfo { user(login: ${JSON.stringify(login)}) { description broadcastSettings { title } stream { game { displayName } } lastBroadcast { game { displayName } } } }`;
  const r = await fetch("https://gql.twitch.tv/gql", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Client-Id": TWITCH_CLIENT_ID,
      "Content-Type": "application/json",
      Origin: "https://www.twitch.tv",
      Referer: "https://www.twitch.tv/",
    },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) throw new Error(`twitch ${r.status}`);
  const payload = await r.json();
  const user = (Array.isArray(payload) ? payload[0]?.data : payload?.data)?.user;
  if (!user) return null;
  const game = user.stream?.game?.displayName || user.lastBroadcast?.game?.displayName || "";
  return {
    title: String(user.broadcastSettings?.title ?? "").trim(),
    category: String(game ?? "").trim(),
    description: String(user.description ?? "").trim(),
  };
}

export function getTwitchStreamInfo(login: string): Promise<TwitchStreamInfo | null> {
  const l = normLogin(login);
  if (!l) return Promise.resolve(null);
  const hit = twInfoCache.get(l);
  if (hit && Date.now() - hit.at < TW_INFO_TTL_MS) return Promise.resolve(hit.value);
  const pending = twInfoInflight.get(l);
  if (pending) return pending;
  const p = fetchTwitchInfo(l)
    .then((value) => {
      twInfoCache.set(l, { at: Date.now(), value });
      return value;
    })
    .catch(() => hit?.value ?? null) // keep last good value on a transient failure
    .finally(() => twInfoInflight.delete(l));
  twInfoInflight.set(l, p);
  return p;
}

// ===================== id/login extraction (mirrors the client) =====================
const isYtId = (v: unknown): v is string => typeof v === "string" && /^[\w-]{11}$/.test(v);

function ytIdOf(v: any): string | null {
  if (!v || typeof v !== "object") return null;
  if (v.type === "placeholder" || v.link?.includes?.("twitch")) return null;
  return isYtId(v.id) ? v.id : null;
}

function twLoginOf(v: any): string | null {
  if (!v || typeof v !== "object") return null;
  const fromLink = v.link?.match?.(TWITCH_VIDEO_URL_REGEX)?.groups?.id;
  const l = fromLink || v.channel?.twitch || (v.type === "twitch" ? v.id : null);
  return l && typeof l === "string" ? normLogin(l) : null;
}

// ===================== inject _ccv into a holodex live array =====================
// Never let a slow source hold up the list: after this budget we inject whatever counts
// have landed and return, so the client still gets its videos promptly.
const INJECT_BUDGET_MS = 2500;

export async function injectLiveViewerCounts(videos: any[]): Promise<any[]> {
  if (!Array.isArray(videos) || !videos.length) return videos;
  const live = videos.filter((v) => v?.status === "live");
  if (!live.length) return videos;

  const ytIds = [...new Set(live.map(ytIdOf).filter((x): x is string => !!x))];
  const twLogins = [...new Set(live.map(twLoginOf).filter((x): x is string => !!x))];
  if (!ytIds.length && !twLogins.length) return videos;

  const ytResults: Record<string, YoutubeViewerResult> = {};
  const twMap: Record<string, number> = {};
  const done = Promise.all([
    // Every YouTube id in parallel, no concurrency cap — one wave, cache-backed. Only ids
    // that actually resolve land in ytResults; timeouts/errors stay absent (never removed).
    ...ytIds.map(async (id) => {
      try {
        ytResults[id] = await getYoutubeViewers(id);
      } catch {
        /* unreachable -> leave absent */
      }
    }),
    (async () => {
      try {
        Object.assign(twMap, await getTwitchViewers(twLogins));
      } catch {
        /* ignore */
      }
    })(),
  ]);
  await Promise.race([done, new Promise((r) => setTimeout(r, INJECT_BUDGET_MS))]);

  // A live entry is dropped only when the platform positively confirms it ended while
  // Holodex still lists it (stale data) — YouTube's renderer says not-live, or Twitch says
  // offline. Members-only streams (no public count by design) and streams we simply couldn't
  // reach are always kept, so we never drop something that's actually still live.
  const isMembersOnly = (v: any) => v?.topic_id === "membersonly";
  return videos.flatMap((v) => {
    if (v?.status !== "live") return [v];
    const y = ytIdOf(v);
    if (y != null) {
      const r = ytResults[y];
      if (r?.isLive && typeof r.live_viewers === "number" && r.live_viewers >= 0)
        return [{ ...v, _ccv: r.live_viewers }];
      if (r?.found && !r.isLive && !isMembersOnly(v)) return []; // YouTube confirms ended -> drop stale live
      return [v]; // live-but-no-count (members/just-started), unreadable, or unreached -> keep
    }
    const l = twLoginOf(v);
    if (l != null) {
      if (twMap[l] === TW_OFFLINE && !isMembersOnly(v)) return []; // Twitch confirms offline -> drop stale live
      if (twMap[l] >= 0) return [{ ...v, _ccv: twMap[l] }];
    }
    return [v];
  });
}
