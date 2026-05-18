"use client";

import { useState } from "react";
import { CircleArrowLeft, Trash, type AnyIcon } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslations } from "next-intl";
import * as icons from "@/lib/icons";

export function CellControl({ playIcon, className = "", onBack, onPlaypause, onReset, onDelete }: { playIcon?: AnyIcon; className?: string; onBack?: () => void; onPlaypause?: () => void; onReset?: () => void; onDelete?: () => void }) {
  const t = useTranslations();
  const [hoverDelete, setHoverDelete] = useState(false);
  return (
    <TooltipProvider>
      <div className={`flex shrink-0 flex-wrap items-center gap-2 p-[0.35rem_0.35rem_0.4rem] ${className}`}>
        {onBack ? <Button type="button" size="sm" variant="secondary" className="mr-auto" onClick={onBack}><CircleArrowLeft className="size-5" /></Button> : null}
        {onPlaypause ? <Button type="button" size="icon-sm" className="ml-2" onClick={onPlaypause}>{(() => { const C = playIcon; return <C className="size-5"  />; })()}</Button> : null}
        {onReset ? <Button type="button" size="icon-sm" variant="secondary" className="ml-2 mr-0" onClick={onReset}><icons.RefreshCw className="size-5" /></Button> : null}
        <Tooltip>
          <TooltipTrigger
            render={<Button type="button" size="icon-sm" variant="destructive" className="ml-auto" aria-label={t("views.multiview.deleteCell")} onMouseEnter={() => setHoverDelete(true)} onMouseLeave={() => setHoverDelete(false)} onClick={onDelete} />}
          >
            {hoverDelete ? <Trash className="size-5" /> : <icons.Trash2 className="size-5" />}
          </TooltipTrigger>
          <TooltipContent>{t("views.multiview.deleteCell")}</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
