"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { WatchInfo } from "@/components/watch/WatchInfo";
import { api } from "@/lib/api";
import { staticThumbnailPath } from "@/lib/video-format";
import { useAppState } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import * as icons from "@/lib/icons";

export function PlaceholderCard({ open, video, onOpenChange }: { open: boolean; video: any; onOpenChange?: (value: boolean) => void }) {
  const app = useAppState();
  const { t } = useI18n();
  const [discordCredits, setDiscordCredits] = useState<any>({});
  const [mentions, setMentions] = useState<any[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isTooSmall, setIsTooSmall] = useState(false);
  const videoWithMentions = useMemo(() => ({ ...video, mentions }), [video, mentions]);

  useEffect(() => {
    const update = () => setIsTooSmall(window.innerWidth < 700);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  useEffect(() => {
    if (!open || !video?.id) return;
    api.getMentions(video.id).then(({ data }: any) => setMentions(data || [])).catch(console.error);
    if (video?.credits?.discord) api.discordServerInfo(video.credits.discord.link).then((res: any) => setDiscordCredits(res)).catch(console.error);
  }, [open, video?.id]);

  async function deletePlaceholder() {
    try {
      await api.deletePlaceholderStream(video.id, app.userdata.jwt);
      alert("Successfully deleted, probably.");
    } catch (e) {
      console.error(e);
      alert("Failed to delete");
    }
    setShowDeleteConfirm(false);
  }

  if (!video) return null;
  return (
    <Dialog open={open} className={isTooSmall ? "max-w-[96%] p-0" : "max-w-[980px] w-[80%] p-0"} onOpenChange={onOpenChange}>
      <Card className="relative p-0">
        {video.thumbnail ? <img src={staticThumbnailPath(video.thumbnail, "maxres")} className="placeholder-img" alt="" /> : null}
        <div className="absolute right-5 z-30 mt-[15px]">
          {video.placeholderType === "scheduled-yt-stream" ? (
            <Button size="lg" className="placeholder-punchout" as="a" href={video.link} target="_blank"><Icon icon={icons.mdiYoutube} size="sm" />{t("component.placeholderVideo.scheduledEvent")}</Button>
          ) : (
            <Button size="lg" className="placeholder-punchout" as="a" href={video.link} target="_blank"><Icon icon={icons.mdiOpenInNew} size="sm" />{video.placeholderType === "external-stream" ? t("component.placeholderVideo.streamPageBtn") : t("component.placeholderVideo.eventPageBtn")}</Button>
          )}
        </div>
        <WatchInfo video={videoWithMentions} noSubCount />
        {app.userdata.user && app.userdata.user.role !== "user" ? (
          <div className="pl-6">
            <code className="text-h6">{video.id}</code>
            <Button variant="secondary" className="m-2" as="a" href={`/add_placeholder?id=${video.id}`}>Edit</Button>
            <Button variant="destructive" className="m-2" onClick={() => setShowDeleteConfirm(true)}>Delete</Button>
            <Dialog open={showDeleteConfirm} className="max-w-[290px] p-0" onOpenChange={setShowDeleteConfirm}><Card className="space-y-4 p-5"><div className="text-lg font-semibold text-white">Are you sure?</div><div className="flex justify-end"><Button variant="destructive" size="sm" onClick={deletePlaceholder}>Delete</Button></div></Card></Dialog>
          </div>
        ) : null}
        <div style={{ height: 12 }} />
        <div className="mt-n4 pl-7 pb-5 text-left text-body-2">
          <div className="space-y-1">
            <span>{t("component.placeholderVideo.creditTitleText")}</span>
            {video.credits?.discord && discordCredits?.data ? <span> {t("component.placeholderVideo.discordCredit", [video.credits.discord.user, discordCredits.data.guild.name])} <strong><a href={`https://discord.gg/${video.credits.discord.link}`} style={{ display: "inline-block" }}><Icon icon={icons.mdiDiscord} size="sm" />{discordCredits.data.guild.name}</a></strong></span> : null}
            {video.credits?.datasource ? <span> {t("component.placeholderVideo.datasourceCredit", [video.credits.datasource.name])} <strong><a href={video.credits.datasource.link}><Icon icon={icons.mdiOpenInNew} size="sm" />{video.credits.datasource.link}</a></strong></span> : null}
            {video.credits?.bot ? <span> {t("component.placeholderVideo.botCredit", [video.credits.bot.name, video.credits.bot.user])} <strong><a href={video.credits.bot.link}><Icon icon={icons.mdiOpenInNew} size="sm" />{video.credits.bot.link}</a></strong></span> : null}
            {video.credits?.editor ? <span> {t("component.placeholderVideo.editorCredit", [video.credits.editor.name])}</span> : null}
          </div>
        </div>
      </Card>
    </Dialog>
  );
}
