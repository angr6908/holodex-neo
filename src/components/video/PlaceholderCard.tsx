"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { ChannelChip } from "@/components/channel/ChannelChip";
import { ChannelImg } from "@/components/channel/ChannelImg";
import { ChannelInfo } from "@/components/channel/ChannelInfo";
import { ChannelSocials } from "@/components/channel/ChannelSocials";
import { api } from "@/lib/api";
import { absoluteTime, formattedDuration, formattedVideoTime, thumbnailImage, videoTitle } from "@/lib/video-format";
import { useAppState } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import * as icons from "@/lib/icons";

function externalHref(link = "") {
  if (!link) return "";
  if (/^https?:\/\//i.test(link)) return link;
  return `https://${link.replace(/^\/+/, "")}`;
}

function sourceHost(link = "") {
  try {
    return new URL(externalHref(link)).hostname.replace(/^www\./, "");
  } catch {
    return link;
  }
}

export function PlaceholderCard({ open, video, onOpenChange }: { open: boolean; video: any; onOpenChange?: (value: boolean) => void }) {
  const app = useAppState();
  const { t, lang } = useI18n();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [discordCredits, setDiscordCredits] = useState<any>({});
  const [mentions, setMentions] = useState<any[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) {
      setShowDeleteConfirm(false);
      return;
    }
    function closeOnOutsidePointer(event: PointerEvent) {
      if (panelRef.current?.contains(event.target as Node)) return;
      onOpenChange?.(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange?.(false);
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open || !video?.id) return;
    setMentions([]);
    setDiscordCredits({});
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

  if (!open || !mounted || !video) return null;
  const title = videoTitle(video, app.settings.useEnglishName);
  const preview = video.thumbnail ? thumbnailImage(video.thumbnail, "standard") : "";
  const typeLabel = video.placeholderType === "scheduled-yt-stream"
    ? t("component.videoCard.typeScheduledYT")
    : video.placeholderType === "external-stream"
      ? t("component.videoCard.typeExternalStream")
      : t("component.videoCard.typeEventPlaceholder");
  const durationText = formattedDuration(video, t);
  const timeText = formattedVideoTime(video, lang, t);
  const absoluteTimeText = absoluteTime(video, lang);
  const canEdit = app.userdata.user && app.userdata.user.role !== "user";
  const sourceButtonText = video.placeholderType === "scheduled-yt-stream"
    ? t("component.placeholderVideo.scheduledEvent")
    : video.placeholderType === "external-stream"
      ? t("component.placeholderVideo.streamPageBtn")
      : t("component.placeholderVideo.eventPageBtn");
  const sourceUrl = externalHref(video.link);
  const hasCredits = !!(video.credits?.discord || video.credits?.datasource || video.credits?.bot || video.credits?.editor);
  const timeClassName = cn(
    video.status === "live" && "font-medium text-red-400",
    video.status === "upcoming" && "text-sky-300",
    video.status === "past" && "text-[color:var(--color-muted-foreground)]",
  );
  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      className="glass-panel fixed left-1/2 top-1/2 z-[120] max-h-[72vh] w-[calc(100vw-2rem)] max-w-[42rem] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[calc(var(--radius)+8px)] border border-[color:var(--color-border)] bg-[color:var(--color-card)] shadow-2xl shadow-slate-950/60 sm:w-[min(82vw,42rem)]"
    >
      <div className="max-h-[72vh] overflow-y-auto bg-[color:var(--color-card)]">
        <div className="flex items-start gap-3 border-b border-[color:var(--color-border)] p-4">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{video.status || "draft"}</Badge>
              <Badge variant="secondary">{typeLabel}</Badge>
              {video.certainty && video.certainty !== "certain" ? <Badge variant="secondary">{video.certainty}</Badge> : null}
            </div>
            <div className="line-clamp-3 text-lg font-semibold leading-snug text-[color:var(--color-foreground)]">{title}</div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[color:var(--color-muted-foreground)]">
              <span className={timeClassName} title={absoluteTimeText}>{timeText}</span>
              {durationText ? <span>{durationText}</span> : null}
              {video.topic_id ? <span className="capitalize">{video.topic_id}</span> : null}
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => onOpenChange?.(false)}><Icon icon={icons.mdiClose} /></Button>
        </div>
        <div className="space-y-4 p-4">
          <div className="grid gap-4 sm:grid-cols-[11rem_minmax(0,1fr)]">
            <div className="overflow-hidden rounded-lg border border-[color:var(--color-border)] bg-[color:var(--surface-soft)]">
              {preview ? <img src={preview} className="aspect-video w-full object-cover" alt="" /> : (
                <div className="flex aspect-video items-center justify-center">
                  <ChannelImg channel={video.channel} size={72} noLink />
                </div>
              )}
            </div>
            <div className="min-w-0 space-y-3">
              <div className="flex items-center gap-3 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--surface-soft)] p-3">
                <ChannelImg channel={video.channel} size={48} noLink />
                <ChannelInfo channel={video.channel} noSubscriberCount />
              </div>
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--color-muted-foreground)]">
                <ChannelSocials channel={video.channel} className="mr-1" />
                {sourceUrl ? <a className="min-w-0 truncate text-[color:var(--color-foreground)]" href={sourceUrl} target="_blank" rel="noopener noreferrer">{sourceHost(video.link)}</a> : null}
              </div>
            </div>
          </div>
          {mentions.length ? (
            <div className="space-y-3 rounded-lg border border-[color:var(--color-border)] p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--color-muted-foreground)]">{t("views.watch.mentionIconLabel")}</div>
              <div className="flex flex-wrap gap-2">{mentions.map((mention: any, index) => <ChannelChip key={`${mention.id || "mention"}-${index}`} channel={mention} size={40} />)}</div>
            </div>
          ) : null}
          {hasCredits ? (
            <div className="space-y-2 rounded-lg border border-[color:var(--color-border)] p-3 text-sm text-[color:var(--color-muted-foreground)]">
              <div className="text-xs font-semibold uppercase tracking-[0.18em]">{t("component.placeholderVideo.creditTitleText")}</div>
              {video.credits?.discord && discordCredits?.data ? <div>{t("component.placeholderVideo.discordCredit", [video.credits.discord.user, discordCredits.data.guild.name])} <a className="inline-flex items-center gap-1 text-sky-300" href={`https://discord.gg/${video.credits.discord.link}`} target="_blank" rel="noopener noreferrer"><Icon icon={icons.mdiDiscord} size="sm" />{discordCredits.data.guild.name}</a></div> : null}
              {video.credits?.datasource ? <div>{t("component.placeholderVideo.datasourceCredit", [video.credits.datasource.name])} <a className="inline-flex items-center gap-1 text-sky-300" href={externalHref(video.credits.datasource.link)} target="_blank" rel="noopener noreferrer"><Icon icon={icons.mdiOpenInNew} size="sm" />{sourceHost(video.credits.datasource.link)}</a></div> : null}
              {video.credits?.bot ? <div>{t("component.placeholderVideo.botCredit", [video.credits.bot.name, video.credits.bot.user])} <a className="inline-flex items-center gap-1 text-sky-300" href={externalHref(video.credits.bot.link)} target="_blank" rel="noopener noreferrer"><Icon icon={icons.mdiOpenInNew} size="sm" />{sourceHost(video.credits.bot.link)}</a></div> : null}
              {video.credits?.editor ? <div>{t("component.placeholderVideo.editorCredit", [video.credits.editor.name])}</div> : null}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-3 border-t border-[color:var(--color-border)] px-4 py-3 sm:flex-row sm:items-center">
          <code className="min-w-0 truncate rounded-md border border-[color:var(--color-border)] bg-[color:var(--surface-soft)] px-2 py-1 text-xs text-[color:var(--color-muted-foreground)]">{video.id}</code>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            {sourceUrl ? <Button as="a" href={sourceUrl} target="_blank" rel="noopener noreferrer"><Icon icon={video.placeholderType === "scheduled-yt-stream" ? icons.mdiYoutube : icons.mdiOpenInNew} />{sourceButtonText}</Button> : null}
            {canEdit ? (
              <>
                <Button variant="outline" as="a" href={`/add_placeholder?id=${video.id}`}><Icon icon={icons.mdiPencil} />Edit</Button>
                <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}><Icon icon={icons.mdiDelete} />Delete</Button>
              </>
            ) : null}
          </div>
        </div>
        {showDeleteConfirm ? (
          <div className="border-t border-[color:var(--color-border)] p-4">
            <Card className="space-y-3 border border-[color:var(--color-border)] bg-[color:var(--surface-soft)] p-4">
              <div>
                <div className="text-sm font-semibold text-[color:var(--color-foreground)]">Delete draft stream?</div>
                <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">This removes the placeholder from Holodex.</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
                <Button variant="destructive" size="sm" onClick={deletePlaceholder}>Delete</Button>
              </div>
            </Card>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
