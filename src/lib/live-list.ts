import { ALL_VTUBERS_ORG } from "@/lib/consts";
import { dayjs } from "@/lib/time";

// The requests that load a live list. Shared by the client (api.live, the store's home list)
// and the server, which starts loading the home list along with the page (app/page.tsx), so
// both build exactly the same request paths.

// The home page's live list: streams and placeholders with their mentions.
export const HOME_LIVE_QUERY = { type: "placeholder,stream", include: "mentions" };

export function queryString(obj: Record<string, any> = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj))
    if (v !== undefined && v !== null) p.append(k, String(v));
  return p.toString();
}

// The API path (under /api/v2) of one org's live list, or of every org's.
export function liveListPath(org: string | undefined, q: Record<string, any> = {}) {
  const scoped = org && org !== ALL_VTUBERS_ORG;
  return `/live?${queryString({ limit: 3000, ...(scoped ? { org } : {}), ...q })}`;
}

// The orgs a live list is requested for: one request for all orgs, else one per org.
export function liveListOrgs(orgs: string[] = []): (string | undefined)[] {
  const t = orgs.filter(Boolean);
  return !t.length || t.includes(ALL_VTUBERS_ORG) ? [undefined] : t;
}

// Live lists keep a stream that hasn't started for up to two hours past its scheduled time.
export const isLiveInWindow = (live: any) =>
  !!live.start_actual || !dayjs().isAfter(dayjs(live.start_scheduled).add(2, "h"));

// The orgs the home list shows: the selected ones, or all of them.
export const homeLiveTargets = (selectedHomeOrgs: string[]) =>
  selectedHomeOrgs.length ? selectedHomeOrgs : [ALL_VTUBERS_ORG];

// A live list the server started loading with the page, handed to the client to use in place
// of its first request for the same path.
export type LiveListSeed = { path: string; data: Promise<any[]> };
