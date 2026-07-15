"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { VideoQuickPlaylist } from "@/components/video/VideoQuickPlaylist";
import { WatchQuickEditor } from "@/components/watch/WatchQuickEditor";
import { openUserMenu } from "@/lib/browser";
import * as icons from "@/lib/icons";
import { useAppState } from "@/lib/store";
import { dayjs } from "@/lib/time";
import { cn } from "@/lib/utils";

const ITEM_CLASS = "h-auto w-full justify-start px-2 py-1.5 font-normal whitespace-normal";

export function VideoCardMenu({ video, close }: { video: any; close: () => void }) {
  const app = useAppState();
  const router = useRouter();
  const t = useTranslations();
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [doneCopy, setDoneCopy] = useState(false);

  if (!video) return null;

  const isLive = !!(
    video.status !== "past" &&
    (video.status === "live" || Date.parse(video.start_scheduled) < Date.now())
  );
  const isPast = video.status === "past";
  const isChattable = !!(video.status !== "past" && video.type === "stream");

  const openGCal = () => {
    const fmt = "YYYYMMDD[T]HHmmss[Z]";
    const start = dayjs.utc(video.start_scheduled);
    window.open(
      `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(video.title)}&dates=${start.format(fmt)}/${start.add(1, "hour").format(fmt)}&details=${encodeURIComponent(`<a href="${window.origin}/watch/${video.id}">Open video</a>`)}`,
      "_blank",
    );
  };

  const copyLink = () => {
    navigator.clipboard?.writeText(`${window.origin}/watch/${video.id}`);
    setDoneCopy(true);
  };

  const openTl = () => {
    if (!app.userdata?.user) return openUserMenu();
    if (isLive || video.status === "upcoming")
      router.push(
        `/tlclient?video=${encodeURIComponent(video.type === "placeholder" ? video.link : `YT_${video.id}`)}`,
      );
    else router.push(`/scripteditor?video=${encodeURIComponent(`YT_${video.id}`)}`);
  };

  const openChatPopout = () =>
    window.open(
      `https://youtube.com/live_chat?is_popout=1&v=${video.id}`,
      "_blank",
      `width=400,height=${window.innerHeight * 0.6}`,
    );
  const openUpload = () => (app.userdata?.user ? app.setUploadPanel(true) : openUserMenu());

  // Youtube videos and twitch streams open on the Holodex watch page; "Open on Holodex" off
  // (redirectMode) sends them to their source instead. Other placeholders only have a source.
  const isTwitch = video.type === "twitch" || (video.link || "").includes("twitch");
  const isPlaceholder = video.type === "placeholder";
  const externalUrl =
    isPlaceholder || isTwitch
      ? video.link || (isTwitch ? `https://twitch.tv/${video.id}` : "")
      : `https://youtu.be/${video.id}`;
  const openExternal = app.settings.redirectMode || (isPlaceholder && !isTwitch);
  const newTabHref = openExternal ? externalUrl || `/watch/${video.id}` : `/watch/${video.id}`;

  const gCalBtn = (
    <Button
      type="button"
      variant="ghost"
      className={ITEM_CLASS}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openGCal();
        close();
      }}
    >
      <icons.Calendar className="h-4 w-4" />
      {t("component.videoCard.googleCalendar")}
    </Button>
  );

  return (
    <div className="space-y-1 p-1 text-sm">
      <Button
        nativeButton={false}
        render={
          <a
            target="_blank"
            rel="noopener noreferrer"
            href={newTabHref}
            onClick={(e) => {
              e.stopPropagation();
              close();
            }}
          />
        }
        variant="ghost"
        className={ITEM_CLASS}
      >
        <icons.ExternalLink className="h-4 w-4" />
        {t("component.videoCard.openInNewTab")}
      </Button>
      {video.type !== "placeholder" ? (
        <>
          <Button
            nativeButton={false}
            render={
              <a
                target="_blank"
                href={`https://youtu.be/${video.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  close();
                }}
                rel="noopener"
              />
            }
            variant="ghost"
            className={ITEM_CLASS}
          >
            <icons.YoutubeIcon className="h-4 w-4" />
            {t("views.settings.redirectModeLabel")}
          </Button>
          {video.status === "upcoming" ? gCalBtn : null}
          <Button
            nativeButton={false}
            render={
              <Link
                href={`/edit/video/${video.id}${video.type !== "stream" ? "/mentions" : "/"}`}
                onClick={close}
              />
            }
            variant="ghost"
            className={ITEM_CLASS}
          >
            <icons.Pencil className="h-4 w-4" />
            {t("component.videoCard.edit")}
          </Button>
          {video.type !== "clip" ? (
            <Button
              nativeButton={false}
              render={<Link href={`/multiview/AAUY${video.id}%2CUAEYchat`} onClick={close} />}
              variant="ghost"
              className={ITEM_CLASS}
            >
              <icons.LayoutDashboard className="h-4 w-4" />
              {t("component.mainNav.multiview")}
            </Button>
          ) : null}
          <Collapsible open={showPlaylist} onOpenChange={setShowPlaylist}>
            <CollapsibleTrigger
              render={<Button type="button" variant="ghost" className={ITEM_CLASS} />}
            >
              <icons.ListPlus className="h-4 w-4" />
              {t("component.mainNav.playlist")}
              <icons.ChevronRight
                className={cn("size-5 ml-auto h-4 w-4 transition", showPlaylist && "rotate-90")}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="ml-4 border-l border-border pl-2">
              <VideoQuickPlaylist
                key={`${video.id}-${Date.now()}`}
                videoId={video.id}
                video={video}
              />
            </CollapsibleContent>
          </Collapsible>
          <Button
            type="button"
            variant={doneCopy ? "default" : "ghost"}
            className={ITEM_CLASS}
            onClick={(e) => {
              e.stopPropagation();
              copyLink();
              close();
            }}
          >
            <icons.ClipboardPlus className="h-4 w-4" />
            {t("component.videoCard.copyLink")}
          </Button>
        </>
      ) : video.status === "upcoming" ? (
        gCalBtn
      ) : null}
      <Button
        type="button"
        variant="ghost"
        className={ITEM_CLASS}
        onClick={() => {
          openTl();
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
          className={ITEM_CLASS}
          onClick={() => {
            openUpload();
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
          className={ITEM_CLASS}
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
        className={ITEM_CLASS}
        onClick={() => {
          app.setReportVideo(video);
          close();
        }}
      >
        <icons.Flag className="h-4 w-4" />
        {t("component.reportDialog.title")}
      </Button>
      {app.isSuperuser ? (
        <div className="pt-1">
          <WatchQuickEditor video={video} />
        </div>
      ) : null}
    </div>
  );
}
