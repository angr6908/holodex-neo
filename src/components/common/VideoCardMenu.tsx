"use client";

import Link from "next/link";
import { mergeProps } from "@base-ui/react/merge-props";
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

// Youtube videos and twitch streams open on the Holodex watch page; "Open on Holodex" off
// (redirectMode) sends them to their source instead. Other placeholders only have a source.
function newTabHrefFor(video: any, redirectMode: boolean) {
  const isTwitch = video.type === "twitch" || (video.link || "").includes("twitch");
  const isPlaceholder = video.type === "placeholder";
  const externalUrl =
    isPlaceholder || isTwitch
      ? video.link || (isTwitch ? `https://twitch.tv/${video.id}` : "")
      : `https://youtu.be/${video.id}`;
  const openExternal = redirectMode || (isPlaceholder && !isTwitch);
  return openExternal ? externalUrl || `/watch/${video.id}` : `/watch/${video.id}`;
}

// Upcoming/live (or past their scheduled start) streams go to the live TL client, the rest to
// the script editor.
function isLiveOrDue(video: any) {
  return (
    video.status !== "past" &&
    (video.status === "live" ||
      video.status === "upcoming" ||
      Date.parse(video.start_scheduled) < Date.now())
  );
}

function tlEditorPath(video: any) {
  if (!isLiveOrDue(video)) return `/scripteditor?video=${encodeURIComponent(`YT_${video.id}`)}`;
  const id = video.type === "placeholder" ? video.link : `YT_${video.id}`;
  return `/tlclient?video=${encodeURIComponent(id)}`;
}

function googleCalendarUrl(video: any) {
  const fmt = "YYYYMMDD[T]HHmmss[Z]";
  const start = dayjs.utc(video.start_scheduled);
  return `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(video.title)}&dates=${start.format(fmt)}/${start.add(1, "hour").format(fmt)}&details=${encodeURIComponent(`<a href="${window.origin}/watch/${video.id}">Open video</a>`)}`;
}

// A menu row that opens `href` in a new tab and closes the menu.
function MenuLink({
  href,
  rel,
  close,
  children,
}: {
  href: string;
  rel: string;
  close: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      nativeButton={false}
      render={(props) => (
        <a
          {...mergeProps<"a">(props, {
            onClick: (e) => {
              e.stopPropagation();
              close();
            },
          })}
          target="_blank"
          rel={rel}
          href={href}
        />
      )}
      variant="ghost"
      className={ITEM_CLASS}
    >
      {children}
    </Button>
  );
}

function GoogleCalendarItem({ video, close }: { video: any; close: () => void }) {
  const t = useTranslations();
  return (
    <Button
      type="button"
      variant="ghost"
      className={ITEM_CLASS}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        window.open(googleCalendarUrl(video), "_blank");
        close();
      }}
    >
      <icons.Calendar className="h-4 w-4" />
      {t("component.videoCard.googleCalendar")}
    </Button>
  );
}

// Items for real YouTube videos (placeholders have no YouTube page, edit page or playlist entry).
function VideoSourceItems({ video, close }: { video: any; close: () => void }) {
  const t = useTranslations();
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [doneCopy, setDoneCopy] = useState(false);

  const copyLink = () => {
    navigator.clipboard?.writeText(`${window.origin}/watch/${video.id}`);
    setDoneCopy(true);
  };

  return (
    <>
      <MenuLink href={`https://youtu.be/${video.id}`} rel="noopener" close={close}>
        <icons.YoutubeIcon className="h-4 w-4" />
        {t("views.settings.redirectModeLabel")}
      </MenuLink>
      {video.status === "upcoming" ? <GoogleCalendarItem video={video} close={close} /> : null}
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
          {/* The panel unmounts while collapsed, so each opening starts fresh. */}
          <VideoQuickPlaylist key={video.id} videoId={video.id} video={video} />
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
  );
}

// Plain menu row running `action` then closing the menu.
function MenuAction({
  icon: Icon,
  label,
  action,
  close,
}: {
  icon: icons.AnyIcon;
  label: string;
  action: () => void;
  close: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      className={ITEM_CLASS}
      onClick={() => {
        action();
        close();
      }}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Button>
  );
}

export function VideoCardMenu({ video, close }: { video: any; close: () => void }) {
  const app = useAppState();
  const router = useRouter();
  const t = useTranslations();

  if (!video) return null;

  const isPast = video.status === "past";
  const isChattable = !isPast && video.type === "stream";

  const openTl = () => {
    if (!app.userdata?.user) return openUserMenu();
    router.push(tlEditorPath(video));
  };
  const openChatPopout = () =>
    window.open(
      `https://youtube.com/live_chat?is_popout=1&v=${video.id}`,
      "_blank",
      `width=400,height=${window.innerHeight * 0.6}`,
    );
  const openUpload = () => (app.userdata?.user ? app.setUploadPanel(true) : openUserMenu());

  return (
    <div className="space-y-1 p-1 text-sm">
      <MenuLink
        href={newTabHrefFor(video, app.settings.redirectMode)}
        rel="noopener noreferrer"
        close={close}
      >
        <icons.ExternalLink className="h-4 w-4" />
        {t("component.videoCard.openInNewTab")}
      </MenuLink>
      {video.type !== "placeholder" ? <VideoSourceItems video={video} close={close} /> : null}
      {video.type === "placeholder" && video.status === "upcoming" ? (
        <GoogleCalendarItem video={video} close={close} />
      ) : null}
      <MenuAction
        icon={icons.Pencil}
        label={
          isLiveOrDue(video)
            ? t("component.videoCard.openClient")
            : t("component.videoCard.openScriptEditor")
        }
        action={openTl}
        close={close}
      />
      {isPast ? (
        <MenuAction
          icon={icons.ClipboardCopy}
          label={t("component.videoCard.uploadScript")}
          action={openUpload}
          close={close}
        />
      ) : null}
      {isChattable ? (
        <MenuAction
          icon={icons.ExternalLink}
          label={t("component.videoCard.popoutChat")}
          action={openChatPopout}
          close={close}
        />
      ) : null}
      <MenuAction
        icon={icons.Flag}
        label={t("component.reportDialog.title")}
        action={() => app.setReportVideo(video)}
        close={close}
      />
      {app.isSuperuser ? (
        <div className="pt-1">
          <WatchQuickEditor video={video} />
        </div>
      ) : null}
    </div>
  );
}
