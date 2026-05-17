"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CircleUser } from "@/lib/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
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

  const onImgError = () => sourceIndex < photoSources.length - 1 ? setSourceIndex((index) => index + 1) : setErr(true);
  const avatar = (
    <Avatar title={title} className={cn("ring-1 ring-white/10", className)} style={style}>
      {!err && photo ? (
        <AvatarImage key={photo} src={photo} decoding="async" width={px} height={px} className="object-cover" onError={onImgError} alt="" />
      ) : null}
      <AvatarFallback>
        <CircleUser className="size-6" />
      </AvatarFallback>
    </Avatar>
  );

  if (noLink) return avatar;
  return <a
    href={channel?.id ? `/channel/${channel.id}` : undefined}
    title={title}
    className="inline-flex shrink-0"
    onClick={(e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      e.stopPropagation();
      if (channel?.id) router.push(`/channel/${channel.id}`);
    }}
  >{avatar}</a>;
}
