import { ALL_VTUBERS_ORG } from "@/lib/consts";
import { channelGroup } from "@/lib/video-format";

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

const channelGroupKey = (channel: any) => (channelGroup(channel) || "Other").toLowerCase();

// Builds a predicate with the option-derived sets computed once, so list passes don't
// re-allocate them per video. Use filterVideo for one-off checks.
export function makeVideoFilter(app: any, options: FilterOptions = {}) {
  const {
    ignoreBlock = false,
    hideCollabs = false,
    hideIgnoredTopics = true,
    forOrg,
    forOrgs,
    hidePlaceholder = false,
    hideMissing = false,
    hideUpcoming = false,
    hideLive = false,
    hideGroups = false,
  } = options;

  const blockedChannels: Set<string> = app.blockedChannelIDs || new Set();
  const favoriteChannels: Set<string> = app.favoriteChannelIDs || new Set();
  const hiddenGroups: Record<string, string[]> = app.settings.hiddenGroups || {};
  const noTargetOrgs = !forOrgs?.length && !forOrg;
  const targetOrgs = new Set(
    (forOrgs?.length ? forOrgs : Array.isArray(forOrg) ? forOrg : [forOrg]).filter(Boolean),
  );
  const matchesTargetOrg = (org?: string) =>
    targetOrgs.has(ALL_VTUBERS_ORG) || targetOrgs.has(org || "");

  return (v: VideoLike | null | undefined) => {
    if (!v || typeof v !== "object") return false;
    const channel = v.channel || {};
    const channelId = v.channel_id || channel.id;
    if (!channelId) return false;

    if (!ignoreBlock && blockedChannels.has(channelId)) return false;
    if (hideIgnoredTopics && v.topic_id && (app.ignoredTopicsSet as Set<string>)?.has(v.topic_id))
      return false;
    if (hidePlaceholder && v.type === "placeholder") return false;
    if (hideMissing && v.status === "missing") return false;
    if (hideUpcoming && v.status === "upcoming") return false;
    if (hideLive && v.status === "live") return false;

    const channelOrg: string = channel.org || "";
    if (hideGroups && hiddenGroups[channelOrg]?.includes(channelGroupKey(channel))) return false;
    if (noTargetOrgs) return true;

    if (matchesTargetOrg(channelOrg) || favoriteChannels.has(channelId)) return true;

    if (hideCollabs) return false;
    return !!v.mentions?.some(({ id, org, suborg }) => {
      if (blockedChannels.has(id)) return false;
      if (hideGroups && hiddenGroups[org ?? ""]?.includes(channelGroupKey({ suborg })))
        return false;
      return matchesTargetOrg(org) || favoriteChannels.has(id);
    });
  };
}

export const filterVideo = (
  v: VideoLike | null | undefined,
  app: any,
  options: FilterOptions = {},
) => makeVideoFilter(app, options)(v);
