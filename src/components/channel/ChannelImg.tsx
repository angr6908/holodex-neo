"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { channelAvatarSizeClass } from "@/components/channel/avatar-size";
import { Avatar } from "@/components/ui/avatar";
import { getChannelPhoto, resizeChannelPhoto } from "@/lib/functions";
import { preloadImage } from "@/lib/image-preload";
import { cn } from "@/lib/utils";

export function ChannelImg({
  channel,
  size = 40,
  noLink = false,
  className = "",
}: {
  channel: any;
  size?: string | number;
  noLink?: boolean;
  className?: string;
  rounded?: boolean;
}) {
  const router = useRouter();
  const channelId = channel?.id;
  const channelPhoto = channel?.photo;
  // Which photo source to try, tracked per channel photo so a new channel starts over.
  const photoKey = `${channelId ?? ""}|${channelPhoto ?? ""}`;
  const [fallback, setFallback] = useState({ photoKey, sourceIndex: 0, err: false });
  const { sourceIndex, err } =
    fallback.photoKey === photoKey ? fallback : { sourceIndex: 0, err: false };
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
  useEffect(() => {
    if (hasImage) void preloadImage(photo);
  }, [hasImage, photo]);

  const onImgError = () =>
    setFallback(
      sourceIndex < photoSources.length - 1
        ? { photoKey, sourceIndex: sourceIndex + 1, err: false }
        : { photoKey, sourceIndex, err: true },
    );
  const avatar = (
    <Avatar title={title} className={cn(channelAvatarSizeClass(size), className)}>
      {hasImage ? (
        <img
          key={photo}
          src={photo}
          loading="eager"
          fetchPriority="high"
          decoding="sync"
          width={px}
          height={px}
          className="aspect-square size-full rounded-full object-cover"
          ref={(el) => {
            // A cached image can fail before React attaches onError.
            if (el?.complete && el.naturalWidth === 0) onImgError();
          }}
          onError={onImgError}
          alt=""
        />
      ) : null}
    </Avatar>
  );

  if (noLink) return avatar;
  return (
    <a
      href={channel?.id ? `/channel/${channel.id}` : undefined}
      title={title}
      className="inline-flex shrink-0"
      onClick={(e) => {
        if (
          e.defaultPrevented ||
          e.button !== 0 ||
          e.metaKey ||
          e.altKey ||
          e.ctrlKey ||
          e.shiftKey
        )
          return;
        e.preventDefault();
        e.stopPropagation();
        if (channel?.id) router.push(`/channel/${channel.id}`);
      }}
    >
      {avatar}
    </a>
  );
}
