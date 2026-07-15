"use client";

import { CircleArrowLeft, type LucideIcon, RefreshCw, Trash, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function CellControl({
  playIcon,
  className = "",
  onBack,
  onPlaypause,
  onReset,
  onDelete,
}: {
  playIcon?: LucideIcon;
  className?: string;
  onBack?: () => void;
  onPlaypause?: () => void;
  onReset?: () => void;
  onDelete?: () => void;
}) {
  const t = useTranslations();
  const [hoverDelete, setHoverDelete] = useState(false);
  const PlayIcon = playIcon;
  return (
    <TooltipProvider>
      <div
        className={`flex shrink-0 flex-wrap items-center gap-2 p-[0.35rem_0.35rem_0.4rem] ${className}`}
      >
        {onBack ? (
          <div className="mr-auto">
            <Button type="button" variant="ghost" size="icon" onClick={onBack}>
              <CircleArrowLeft />
            </Button>
          </div>
        ) : null}
        {onPlaypause && PlayIcon ? (
          <Button type="button" variant="ghost" size="icon" onClick={onPlaypause}>
            <PlayIcon />
          </Button>
        ) : null}
        {onReset ? (
          <Button type="button" variant="ghost" size="icon" onClick={onReset}>
            <RefreshCw />
          </Button>
        ) : null}
        <div className="ml-auto">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("views.multiview.deleteCell")}
                  onMouseEnter={() => setHoverDelete(true)}
                  onMouseLeave={() => setHoverDelete(false)}
                  onClick={onDelete}
                />
              }
            >
              {hoverDelete ? <Trash /> : <Trash2 />}
            </TooltipTrigger>
            <TooltipContent>{t("views.multiview.deleteCell")}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
