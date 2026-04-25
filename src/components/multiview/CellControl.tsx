"use client";

import { useState } from "react";
import { mdiArrowLeftCircle, mdiDeleteEmpty } from "@mdi/js";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import * as icons from "@/lib/icons";

export function CellControl({ playIcon, className = "", onBack, onPlaypause, onReset, onDelete }: { playIcon?: string; className?: string; onBack?: () => void; onPlaypause?: () => void; onReset?: () => void; onDelete?: () => void }) {
  const [hoverDelete, setHoverDelete] = useState(false);
  return (
    <div className={`cell-control flex flex-wrap items-center gap-2 ${className}`}>
      {onBack ? <Button type="button" size="sm" className="return-btn mr-auto bg-amber-600 text-slate-950 hover:brightness-110" onClick={onBack}><Icon icon={mdiArrowLeftCircle} /></Button> : null}
      {onPlaypause ? <Button type="button" size="sm" className="ml-2 h-8 w-8 min-w-8 rounded-lg p-0" onClick={onPlaypause}><Icon icon={playIcon} /></Button> : null}
      {onReset ? <Button type="button" size="sm" variant="secondary" className="ml-2 mr-0 h-8 w-8 min-w-8 rounded-lg p-0" onClick={onReset}><Icon icon={icons.mdiRefresh} /></Button> : null}
      <Button type="button" size="sm" variant="destructive" className="ml-auto h-8 w-8 min-w-8 rounded-lg p-0" title="Delete cell" onMouseEnter={() => setHoverDelete(true)} onMouseLeave={() => setHoverDelete(false)} onClick={onDelete}><Icon icon={hoverDelete ? mdiDeleteEmpty : icons.mdiDelete} /></Button>
    </div>
  );
}
