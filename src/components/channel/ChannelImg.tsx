"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { mdiAccountCircleOutline } from "@mdi/js";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { getChannelPhoto, resizeChannelPhoto } from "@/lib/functions";

export function ChannelImg({ channel, size = 40, noLink = false, className = "" }: { channel: any; size?: string | number; noLink?: boolean; className?: string; rounded?: boolean }) {
  const router = useRouter();
  const channelId = channel?.id;
  const channelPhoto = channel?.photo;
  const [err, setErr] = useState(false);
  const [sourceIndex, setSourceIndex] = useState(0);
  useEffect(() => {
    setErr(false);
    setSourceIndex(0);
  }, [channelId, channelPhoto]);
  const px = Number(size) || 40;
  const title = `${channel?.name || ""}${channel?.english_name ? `\nEN: ${channel.english_name}` : ""}${channel?.org ? `\n> ${channel.org}` : ""}${channel?.group ? `\n> ${channel.group}` : ""}`;
  const photoSources = useMemo(() => {
    const sources = [
      channelId ? getChannelPhoto(channelId) : "",
      channelPhoto ? resizeChannelPhoto(channelPhoto) : "",
    ].filter(Boolean);
    return Array.from(new Set(sources));
  }, [channelId, channelPhoto]);
  const photo = photoSources[sourceIndex] || "";
  const style = { width: `${px}px`, height: `${px}px`, minWidth: `${px}px` };

  function onImgMounted(el: HTMLImageElement | null) {
    if (!el || el.dataset.fadeInit) return;
    el.dataset.fadeInit = "1";
    if (el.complete && el.naturalHeight > 0) {
      el.classList.add("loaded");
    } else {
      el.classList.add("img-pending");
      el.dataset.fadeReady = "1";
    }
  }

  function onImgLoad(event: React.SyntheticEvent<HTMLImageElement>) {
    event.currentTarget.classList.add("loaded");
  }

  function onImgError() {
    if (sourceIndex < photoSources.length - 1) {
      setSourceIndex((index) => index + 1);
      return;
    }
    setErr(true);
  }

  if (err || !photo) {
    return <div title={channel?.name} className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[color:var(--color-secondary)] text-white ring-1 ring-white/10", className)} style={style}><Icon icon={mdiAccountCircleOutline} size="lg" /></div>;
  }
  const img = <img key={photo} ref={onImgMounted} src={photo} decoding="async" width={px} height={px} className="block h-full w-full rounded-full object-cover ring-1 ring-white/10 img-fade-in" onError={onImgError} onLoad={onImgLoad} alt="" />;
  const cls = cn("inline-flex shrink-0 overflow-hidden rounded-full", className);
  if (noLink) return <span title={title} className={cls} style={style}>{img}</span>;
  return <a
    href={channel?.id ? `/channel/${channel.id}` : undefined}
    title={title}
    className={cls}
    style={style}
    onClick={(e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      e.stopPropagation();
      if (channel?.id) router.push(`/channel/${channel.id}`);
    }}
  >{img}</a>;
}
