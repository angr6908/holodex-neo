"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { dayjs } from "@/lib/time";
import { useAppState } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { Icon } from "@/components/ui/Icon";
import { VideoQuickPlaylist } from "@/components/playlist/VideoQuickPlaylist";
import { WatchQuickEditor } from "@/components/watch/WatchQuickEditor";
import * as icons from "@/lib/icons";
import { openUserMenu } from "@/lib/navigation-events";

export function VideoCardMenu({ video, close }: { video: any; close: () => void }) {
  const appStore = useAppState();
  const router = useRouter();
  const { t } = useI18n();
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [doneCopy, setDoneCopy] = useState(false);

  const isLive = !!(video && video.status !== "past" && (video.status === "live" || Date.parse(video.start_scheduled) < Date.now()));
  const isPast = video?.status === "past";
  const isChattable = !!(video && video.status !== "past" && video.type === "stream");

  function openGoogleCalendar() {
    const fmt = "YYYYMMDD[T]HHmmss[Z]";
    const start = dayjs.utc(video.start_scheduled);
    window.open(`https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(video.title)}&dates=${start.format(fmt)}/${start.add(1, "hour").format(fmt)}&details=${encodeURIComponent(`<a href="${window.origin}/watch/${video.id}">Open Video</a>`)}`, "_blank");
  }

  function copyLink() {
    navigator.clipboard?.writeText(`${window.origin}/watch/${video.id}`);
    setDoneCopy(true);
  }

  function openTlClient() {
    if (appStore.userdata?.user) {
      if (isLive || video.status === "upcoming") {
        router.push(`/tlclient?video=${encodeURIComponent(video.type === "placeholder" ? video.link : `YT_${video.id}`)}`);
      } else {
        router.push(`/scripteditor?video=${encodeURIComponent(`YT_${video.id}`)}`);
      }
    } else {
      openUserMenu();
    }
  }

  function openChatPopout() {
    window.open(`https://youtube.com/live_chat?is_popout=1&v=${video.id}`, "_blank", `width=400,height=${window.innerHeight * 0.6}`);
  }

  function scriptUploadPanel() { if (appStore.userdata?.user) appStore.setUploadPanel(true); else openUserMenu(); }

  function renderGoogleCalendarButton() {
    return (
      <button
        type="button"
        className="video-card-menu-item"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          openGoogleCalendar();
          close();
        }}
      >
        <Icon icon={icons.mdiCalendar} className="h-4 w-4" />
        {t("component.videoCard.googleCalendar")}
      </button>
    );
  }

  if (!video) return null;

  return (
    <div className="space-y-1 p-1 text-sm">
      {video.type !== "placeholder" ? (
        <>
          <a
            target="_blank"
            href={`https://youtu.be/${video.id}`}
            className="video-card-menu-item"
            onClick={(event) => { event.stopPropagation(); close(); }}
          >
            <Icon icon={icons.mdiYoutube} className="h-4 w-4" />
            {t("views.settings.redirectModeLabel")}
          </a>

          {video.status === "upcoming" ? renderGoogleCalendarButton() : null}
          <Link
            href={`/edit/video/${video.id}${video.type !== "stream" ? "/mentions" : "/"}`}
            className="video-card-menu-item"
            onClick={close}
          >
            <Icon icon={icons.mdiPencil} className="h-4 w-4" />
            {t("component.videoCard.edit")}
          </Link>
          {video.type !== "clip" ? (
            <Link
              href={`/multiview/AAUY${video.id}%2CUAEYchat`}
              className="video-card-menu-item"
              onClick={close}
            >
              <Icon icon={icons.mdiViewDashboard} className="h-4 w-4" />
              {t("component.mainNav.multiview")}
            </Link>
          ) : null}
          <button
            type="button"
            className="video-card-menu-item"
            onClick={() => setShowPlaylist(!showPlaylist)}
          >
            <Icon icon={icons.mdiPlaylistPlus} className="h-4 w-4" />
            {t("component.mainNav.playlist")}
            <Icon icon={icons.mdiChevronRight} className={`ml-auto h-4 w-4 transition ${showPlaylist ? "rotate-90" : ""}`} />
          </button>
          {showPlaylist ? (
            <div className="video-card-menu-playlist open">
              <VideoQuickPlaylist key={`${video.id}-${Date.now()}`} videoId={video.id} video={video} />
            </div>
          ) : null}
          <button
            type="button"
            className={`video-card-menu-item ${doneCopy ? "video-card-menu-item-done" : ""}`}
            onClick={(event) => {
              event.stopPropagation();
              copyLink();
              close();
            }}
          >
            <Icon icon={icons.mdiClipboardPlusOutline} className="h-4 w-4" />
            {t("component.videoCard.copyLink")}
          </button>
        </>
      ) : (
        <>
          {video.status === "upcoming" ? renderGoogleCalendarButton() : null}
        </>
      )}
      <button
        type="button"
        className="video-card-menu-item"
        onClick={() => {
          openTlClient();
          close();
        }}
      >
        <Icon icon={icons.mdiTypewriter} className="h-4 w-4" />
        {isLive || video.status === "upcoming"
          ? t("component.videoCard.openClient")
          : t("component.videoCard.openScriptEditor")}
      </button>
      {isPast ? (
        <button
          type="button"
          className="video-card-menu-item"
          onClick={() => {
            scriptUploadPanel();
            close();
          }}
        >
          <Icon icon={icons.mdiClipboardArrowUpOutline} className="h-4 w-4" />
          {t("component.videoCard.uploadScript")}
        </button>
      ) : null}
      {isChattable ? (
        <button
          type="button"
          className="video-card-menu-item"
          onClick={() => {
            openChatPopout();
            close();
          }}
        >
          <Icon icon={icons.mdiOpenInNew} className="h-4 w-4" />
          {t("component.videoCard.popoutChat")}
        </button>
      ) : null}
      <button
        type="button"
        className="video-card-menu-item"
        onClick={() => {
          appStore.setReportVideo(video);
          close();
        }}
      >
        <Icon icon={icons.mdiFlag} className="h-4 w-4" />
        {t("component.reportDialog.title")}
      </button>
      {appStore.isSuperuser ? (
        <div className="pt-1">
          <WatchQuickEditor video={video} />
        </div>
      ) : null}
    </div>
  );
}
