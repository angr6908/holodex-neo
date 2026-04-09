import { useSettingsStore } from "@/stores/settings";
import { useFavoritesStore } from "@/stores/favorites";
import { useAppStore } from "@/stores/app";

export interface FilterVideosOptions {
  /** When true, blocked-channel check is skipped. */
  ignoreBlock?: boolean;
  /** When true, videos that are only collab mentions are filtered out. */
  hideCollabs?: boolean;
  /** When true, videos with ignored topics are filtered out. */
  hideIgnoredTopics?: boolean;
  /** Override the org context (defaults to currentOrg.name). */
  forOrg?: string;
  /** Filter out placeholder-type videos. */
  hidePlaceholder?: boolean;
  /** Filter out videos with status "missing". */
  hideMissing?: boolean;
  /** Filter out videos whose channel belongs to a hidden group. */
  hideGroups?: boolean;
}

interface VideoLike {
  channel_id?: string;
  channel?: {
    id?: string;
    org?: string;
    group?: string;
    suborg?: string;
  };
  topic_id?: string;
  type?: string;
  status?: string;
  mentions?: Array<{
    id: string;
    org?: string;
    suborg?: string;
  }>;
}

/**
 * Composable replacement for the filterVideos mixin.
 * Returns a `filterVideos` function that determines whether a video
 * should be kept (true) or filtered out (false) based on settings.
 */
export function useFilterVideos() {
  const settingsStore = useSettingsStore();
  const favoritesStore = useFavoritesStore();
  const appStore = useAppStore();

  function filterVideos(
    v: VideoLike | null | undefined,
    options: FilterVideosOptions = {},
  ): boolean {
    const {
      ignoreBlock = false,
      hideCollabs = false,
      hideIgnoredTopics = true,
      forOrg: forOrgParam,
      hidePlaceholder = false,
      hideMissing = false,
      hideGroups = false,
    } = options;

    if (!v || typeof v !== "object") return false;

    const blockedChannels: Set<string> = settingsStore.blockedChannelIDs;
    const ignoredTopicsRaw = settingsStore.ignoredTopicsSet;
    const ignoredTopics: Set<string> = ignoredTopicsRaw instanceof Set ? ignoredTopicsRaw : new Set(Array.isArray(ignoredTopicsRaw) ? ignoredTopicsRaw as string[] : []);
    const favoriteChannels: Set<string> = favoritesStore.favoriteChannelIDs;

    const forOrg = forOrgParam || appStore.currentOrg.name;
    const hiddenGroups: Record<string, string[]> = settingsStore.hiddenGroups;
    const validOrgs = Object.keys(hiddenGroups);

    const channel = v.channel || {};
    const channelOrg = channel.org || "";
    const channelId = v.channel_id || channel.id;

    if (!channelId) return false;

    const orgGroupsHidden = validOrgs.includes(channelOrg);

    let keep = true;

    const isFavoritedOrInOrg =
      channelOrg === forOrg
      || favoriteChannels.has(channelId)
      || forOrg === "All Vtubers";

    const channelGroup = (
      channel.group || (`${channel.suborg}`).slice(2) || "Other"
    ).toLowerCase();

    let hideViaGroup = false;
    if (orgGroupsHidden) {
      hideViaGroup = hiddenGroups[channelOrg].includes(channelGroup);
    }

    // Blocked channels
    if (!ignoreBlock) {
      keep &&= !blockedChannels.has(channelId);
    }

    // Collab / mention filtering
    if (!isFavoritedOrInOrg) {
      keep &&=
        !hideCollabs
        && !v.mentions?.every(
          ({ id, org, suborg }) =>
            blockedChannels.has(id)
            || (
              hideGroups
              && validOrgs.includes(org ?? "")
              && hiddenGroups[org!].includes(
                (`${suborg}`).slice(2) || "Other",
              )
            )
            || (org !== forOrg && !favoriteChannels.has(id)),
        );
    }

    // Topics
    if (hideIgnoredTopics && v.topic_id) {
      keep &&= !ignoredTopics.has(v.topic_id);
    }

    // Placeholder
    if (hidePlaceholder) {
      keep &&= v.type !== "placeholder";
    }

    // Missing
    if (hideMissing) {
      keep &&= v.status !== "missing";
    }

    // Group visibility
    if (hideGroups && orgGroupsHidden) {
      keep &&= !hideViaGroup;
    }

    return keep;
  }

  return { filterVideos };
}
