"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { dayjs } from "@/lib/time";
import { useAppState } from "@/lib/store";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import { VideoQuickPlaylist } from "@/components/video/VideoQuickPlaylist";
import { WatchQuickEditor } from "@/components/watch/WatchQuickEditor";
import * as icons from "@/lib/icons";
import { openUserMenu } from "@/lib/browser";
const menuItemClass = "h-auto w-full justify-start px-2 py-1.5 font-normal whitespace-normal";

export function VideoCardMenu({ video, close }: { video: any; close: () => void }) {
  const appStore = useAppState();
  const router = useRouter();
  const t = useTranslations();
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
      <Button
        type="button"
        variant="ghost"
        className={menuItemClass}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          openGoogleCalendar();
          close();
        }}
      >
        <icons.Calendar className="h-4 w-4" />
        {t("component.videoCard.googleCalendar")}
      </Button>
    );
  }

  if (!video) return null;

  return (
    <div className="space-y-1 p-1 text-sm">
      {video.type !== "placeholder" ? (
        <>
          <Button nativeButton={false}
            render={
              <a
                target="_blank"
                href={`https://youtu.be/${video.id}`}
                onClick={(event) => { event.stopPropagation(); close(); }}
              />
            }
            variant="ghost"
            className={menuItemClass}
          >
            <icons.YoutubeIcon className="h-4 w-4" />
            {t("views.settings.redirectModeLabel")}
          </Button>

          {video.status === "upcoming" ? renderGoogleCalendarButton() : null}
          <Button nativeButton={false}
            render={
              <Link
                href={`/edit/video/${video.id}${video.type !== "stream" ? "/mentions" : "/"}`}
                onClick={close}
              />
            }
            variant="ghost"
            className={menuItemClass}
          >
            <icons.Pencil className="h-4 w-4" />
            {t("component.videoCard.edit")}
          </Button>
          {video.type !== "clip" ? (
            <Button nativeButton={false}
              render={
                <Link
                  href={`/multiview/AAUY${video.id}%2CUAEYchat`}
                  onClick={close}
                />
              }
              variant="ghost"
              className={menuItemClass}
            >
              <icons.LayoutDashboard className="h-4 w-4" />
              {t("component.mainNav.multiview")}
            </Button>
          ) : null}
          <Collapsible open={showPlaylist} onOpenChange={setShowPlaylist}>
            <CollapsibleTrigger
              render={<Button type="button" variant="ghost" className={menuItemClass} />}
            >
              <icons.ListPlus className="h-4 w-4" />
              {t("component.mainNav.playlist")}
              <icons.ChevronRight className={cn("size-5", `ml-auto h-4 w-4 transition ${showPlaylist ? "rotate-90" : ""}`)} />
            </CollapsibleTrigger>
            <CollapsibleContent className="ml-4 border-l border-border pl-2">
              <VideoQuickPlaylist key={`${video.id}-${Date.now()}`} videoId={video.id} video={video} />
            </CollapsibleContent>
          </Collapsible>
          <Button
            type="button"
            variant={doneCopy ? "default" : "ghost"}
            className={menuItemClass}
            onClick={(event) => {
              event.stopPropagation();
              copyLink();
              close();
            }}
          >
            <icons.ClipboardPlus className="h-4 w-4" />
            {t("component.videoCard.copyLink")}
          </Button>
        </>
      ) : (
        <>
          {video.status === "upcoming" ? renderGoogleCalendarButton() : null}
        </>
      )}
      <Button
        type="button"
        variant="ghost"
        className={menuItemClass}
        onClick={() => {
          openTlClient();
          close();
        }}
      >
        <icons.Pencil className="h-4 w-4" />
        {isLive || video.status === "upcoming"
          ? t("component.videoCard.openClient")
          : t("component.videoCard.openScriptEditor")}
      </Button>
      {isPast ? (
        <Button
          type="button"
          variant="ghost"
          className={menuItemClass}
          onClick={() => {
            scriptUploadPanel();
            close();
          }}
        >
          <icons.ClipboardCopy className="h-4 w-4" />
          {t("component.videoCard.uploadScript")}
        </Button>
      ) : null}
      {isChattable ? (
        <Button
          type="button"
          variant="ghost"
          className={menuItemClass}
          onClick={() => {
            openChatPopout();
            close();
          }}
        >
          <icons.ExternalLink className="h-4 w-4" />
          {t("component.videoCard.popoutChat")}
        </Button>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        className={menuItemClass}
        onClick={() => {
          appStore.setReportVideo(video);
          close();
        }}
      >
        <icons.Flag className="h-4 w-4" />
        {t("component.reportDialog.title")}
      </Button>
      {appStore.isSuperuser ? (
        <div className="pt-1">
          <WatchQuickEditor video={video} />
        </div>
      ) : null}
    </div>
  );
}
