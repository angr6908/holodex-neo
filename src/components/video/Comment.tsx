"use client";

import { Button } from "@/components/ui/button";
import { ExternalLink } from "@/lib/icons";
import { TruncatedText } from "@/components/common/TruncatedText";
import { useAppState } from "@/lib/store";
import { useTranslations } from "next-intl";
import { linkifyVideoTimestamps } from "@/lib/video-format";
export function Comment({ comment, videoId }: { comment: Record<string, any>; videoId: string }) {
  const app = useAppState();
  const t = useTranslations();
  const processedMessage = linkifyVideoTimestamps(comment.message, videoId, app.settings.redirectMode);
  return (
    <div className="group/comment relative my-3 block border-l-2 py-1 pr-4 pl-4">
      <TruncatedText className="whitespace-pre-wrap break-words text-sm" html={processedMessage} lines={5} renderButton={(expanded) => expanded ? t("component.description.showLess") : t("component.description.showMore")} />
      <Button nativeButton={false}
        render={<a href={`https://www.youtube.com/watch?v=${videoId}&lc=${comment.comment_key}`} target="_blank" rel="noopener noreferrer" />}
        variant="ghost"
        size="icon-xs"
        className="absolute -right-1 -top-1 hidden group-focus-within/comment:inline-flex group-hover/comment:inline-flex"
      >
        <ExternalLink className="size-4" />
      </Button>
    </div>
  );
}
