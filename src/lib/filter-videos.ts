import { ALL_VTUBERS_ORG } from "@/lib/consts";
type VideoLike = {
  channel_id?: string;
  channel?: any;
  topic_id?: string;
  type?: string;
  status?: string;
  mentions?: any[];
};

type FilterOptions = {
  ignoreBlock?: boolean;
  hideCollabs?: boolean;
  hideIgnoredTopics?: boolean;
  forOrg?: string | string[];
  forOrgs?: string[];
  hidePlaceholder?: boolean;
  hideMissing?: boolean;
  hideUpcoming?: boolean;
  hideLive?: boolean;
  hideGroups?: boolean;
};

const channelGroupKey = (channel: any) =>
  (channel.group || String(channel.suborg ?? "").slice(2) || "Other").toLowerCase();

export function filterVideo(v: VideoLike | null | undefined, app: any, options: FilterOptions = {}) {
  if (!v || typeof v !== "object") return false;
  const { ignoreBlock = false, hideCollabs = false, hideIgnoredTopics = true,
    forOrg, forOrgs, hidePlaceholder = false, hideMissing = false,
    hideUpcoming = false, hideLive = false, hideGroups = false } = options;

  const channel = v.channel || {};
  const channelId = v.channel_id || channel.id;
  if (!channelId) return false;

  const blockedChannels: Set<string> = app.blockedChannelIDs || new Set();
  if (!ignoreBlock && blockedChannels.has(channelId)) return false;
  if (hideIgnoredTopics && v.topic_id && (app.ignoredTopicsSet as Set<string>)?.has(v.topic_id)) return false;
  if (hidePlaceholder && v.type === "placeholder") return false;
  if (hideMissing && v.status === "missing") return false;
  if (hideUpcoming && v.status === "upcoming") return false;
  if (hideLive && v.status === "live") return false;

  const targetOrgs = new Set(
    (forOrgs?.length ? forOrgs : Array.isArray(forOrg) ? forOrg : [forOrg || app.currentOrg.name]).filter(Boolean),
  );
  const matchesTargetOrg = (org?: string) => targetOrgs.has(ALL_VTUBERS_ORG) || targetOrgs.has(org || "");

  const hiddenGroups: Record<string, string[]> = app.settings.hiddenGroups || {};
  const channelOrg: string = channel.org || "";
  if (hideGroups && hiddenGroups[channelOrg]?.includes(channelGroupKey(channel))) return false;

  const favoriteChannels: Set<string> = app.favoriteChannelIDs || new Set();
  if (matchesTargetOrg(channelOrg) || favoriteChannels.has(channelId)) return true;

  if (hideCollabs) return false;
  return !!v.mentions?.some(({ id, org, suborg }) => {
    if (blockedChannels.has(id)) return false;
    if (hideGroups && hiddenGroups[org ?? ""]?.includes(String(suborg ?? "").slice(2) || "Other")) return false;
    return matchesTargetOrg(org) || favoriteChannels.has(id);
  });
}
