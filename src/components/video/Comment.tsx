"use client";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { TruncatedText } from "@/components/common/TruncatedText";
import { useAppState } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { linkifyVideoTimestamps } from "@/lib/video-format";
import * as icons from "@/lib/icons";

export function Comment({ comment, videoId }: { comment: Record<string, any>; videoId: string }) {
  const app = useAppState();
  const { t } = useI18n();
  const processedMessage = linkifyVideoTimestamps(comment.message, videoId, app.settings.redirectMode);
  return (
    <div className="comment my-3 block">
      <TruncatedText style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }} className="text-sm text-slate-300" html={processedMessage} lines={5} renderButton={(expanded) => <Button type="button" variant="ghost" size="sm">{expanded ? t("component.description.showLess") : t("component.description.showMore")}</Button>} />
      <a className="openOnYoutube" href={`https://www.youtube.com/watch?v=${videoId}&lc=${comment.comment_key}`} target="_blank" rel="noopener noreferrer"><Icon icon={icons.mdiOpenInNew} size="sm" /></a>
    </div>
  );
}
