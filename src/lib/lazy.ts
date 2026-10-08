import { runWhenSettled } from "@/lib/idle";

// UI that isn't on the first screen (popovers, dialogs, menus, other views), split out of the
// startup bundle: each is loaded where it renders (via next/dynamic) and, once the page has
// settled, warmed so it opens without waiting for its code.

export const loadSettingsPage = () => import("@/components/setting/SettingsPage");
export const loadAboutSection = () => import("@/components/setting/AboutSection");
export const loadPlaylistPanel = () => import("@/components/nav/PlaylistPanel");
export const loadCalendarUsage = () => import("@/components/nav/CalendarUsage");
export const loadCalendar = () => import("@/components/ui/calendar");
export const loadReportDialog = () => import("@/components/app/ReportDialog");
export const loadVideoCardMenu = () => import("@/components/common/VideoCardMenu");
export const loadChannelsPage = () => import("@/components/channel/ChannelsPage");
// Only search results show comments, so their code isn't warmed on every page.
export const loadComment = () => import("@/components/video/Comment");

const loaders = [
  loadSettingsPage,
  loadAboutSection,
  loadPlaylistPanel,
  loadCalendarUsage,
  loadCalendar,
  loadReportDialog,
  loadVideoCardMenu,
  loadChannelsPage,
];

let warmed = false;

export function warmLazyComponentsWhenSettled() {
  if (warmed) return;
  warmed = true;
  runWhenSettled(() => {
    for (const load of loaders) void load().catch(() => {});
  }, 1000);
}
