"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getChannelPhoto, resizeChannelPhoto } from "@/lib/functions";
import { preloadImage } from "@/lib/image-preload";

export function channelAvatarSizeClass(size: string | number | undefined) {
  const px = Number(size) || 40;
  const classes: Record<number, string> = {
    24: "size-6",
    28: "size-7",
    36: "size-9",
    40: "size-10",
    42: "size-[42px]",
    48: "size-12",
    52: "size-[52px]",
    55: "size-[55px]",
    56: "size-14",
    60: "size-[60px]",
    72: "size-[72px]",
  };
  return classes[px] || "size-10";
}

export function ChannelImg({ channel, size = 40, noLink = false, className = "", onReady }: { channel: any; size?: string | number; noLink?: boolean; className?: string; rounded?: boolean; onReady?: () => void }) {
  const router = useRouter();
  const channelId = channel?.id;
  const channelPhoto = channel?.photo;
  const [err, setErr] = useState(false);
  const [sourceIndex, setSourceIndex] = useState(0);
  const onReadyRef = useRef(onReady);
  useEffect(() => { onReadyRef.current = onReady; });
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
  const hasImage = !err && !!photo;
  useEffect(() => { if (hasImage) void preloadImage(photo); }, [hasImage, photo]);
  useEffect(() => {
    if (!hasImage) onReadyRef.current?.();
  }, [hasImage]);

  const onImgError = () => sourceIndex < photoSources.length - 1 ? setSourceIndex((index) => index + 1) : setErr(true);
  const avatar = (
    <Avatar title={title} className={cn(channelAvatarSizeClass(size), className)}>
      {hasImage ? (
        <img key={photo} src={photo} loading="eager" fetchPriority="high" decoding="sync" width={px} height={px} className="aspect-square size-full rounded-full object-cover" ref={(el) => { if (el?.complete) { if (el.naturalWidth > 0) onReadyRef.current?.(); else onImgError(); } }} onLoad={() => onReadyRef.current?.()} onError={onImgError} alt="" />
      ) : null}

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
