type VideoLike = { channel_id?: string; channel?: any; topic_id?: string; type?: string; status?: string; mentions?: any[] };
export function filterVideo(v: VideoLike | null | undefined, app: any, options: any = {}) {
  if (!v || typeof v !== "object") return false;
  const { ignoreBlock = false, hideCollabs = false, hideIgnoredTopics = true, forOrg, forOrgs, hidePlaceholder = false, hideMissing = false, hideUpcoming = false, hideGroups = false } = options;
  const blockedChannels: Set<string> = app.blockedChannelIDs || new Set();
  const ignoredTopics: Set<string> = app.ignoredTopicsSet || new Set();
  const favoriteChannels: Set<string> = app.favoriteChannelIDs || new Set();
  const targetOrg = forOrg || app.currentOrg.name;
  const targetOrgs = new Set(
    (Array.isArray(forOrgs) && forOrgs.length
      ? forOrgs
      : Array.isArray(forOrg)
        ? forOrg
        : [targetOrg]
    ).filter(Boolean),
  );
  const matchesTargetOrg = (org?: string) =>
    targetOrgs.has("All Vtubers") || targetOrgs.has(org || "");
  const hiddenGroups: Record<string, string[]> = app.settings.hiddenGroups || {};
  const validOrgs = Object.keys(hiddenGroups);
  const channel = v.channel || {};
  const channelOrg = channel.org || "";
  const channelId = v.channel_id || channel.id;
  if (!channelId) return false;
  let keep = true;
  const isFavoritedOrInOrg = matchesTargetOrg(channelOrg) || favoriteChannels.has(channelId);
  const channelGroup = (channel.group || (`${channel.suborg}`).slice(2) || "Other").toLowerCase();
  const hideViaGroup = validOrgs.includes(channelOrg) && hiddenGroups[channelOrg].includes(channelGroup);
  if (!ignoreBlock) keep &&= !blockedChannels.has(channelId);
  if (!isFavoritedOrInOrg) keep &&= !hideCollabs && !v.mentions?.every(({ id, org, suborg }) => blockedChannels.has(id) || (hideGroups && validOrgs.includes(org ?? "") && hiddenGroups[org!].includes((`${suborg}`).slice(2) || "Other")) || (!matchesTargetOrg(org) && !favoriteChannels.has(id)));
  if (hideIgnoredTopics && v.topic_id) keep &&= !ignoredTopics.has(v.topic_id);
  if (hidePlaceholder) keep &&= v.type !== "placeholder";
  if (hideMissing) keep &&= v.status !== "missing";
  if (hideUpcoming) keep &&= v.status !== "upcoming";
  if (hideGroups && validOrgs.includes(channelOrg)) keep &&= !hideViaGroup;
  return keep;
}
