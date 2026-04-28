"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { LayoutPreview } from "@/components/multiview/LayoutPreview";
import { useI18n } from "@/lib/i18n";

export function LayoutChangePrompt({ open, onOpenChange, cancelFn = () => {}, confirmFn = () => {}, defaultOverwrite = false, layoutPreview = { layout: [], content: {} } }: { open: boolean; onOpenChange?: (value: boolean) => void; cancelFn?: (overwriteMerge: boolean) => void; confirmFn?: (overwriteMerge: boolean) => void; defaultOverwrite?: boolean; layoutPreview?: { layout: any[]; content: Record<string, any> } }) {
  const { t } = useI18n();
  const [overwriteMerge, setOverwriteMerge] = useState(defaultOverwrite);
  useEffect(() => { setOverwriteMerge(defaultOverwrite); }, [defaultOverwrite, open]);
  return (
    <Dialog open={open} className="max-w-[400px]" onOpenChange={onOpenChange}>
      <Card className="border-0 bg-transparent p-5 shadow-none">
        <div className="text-lg font-semibold text-white">{t("views.multiview.confirmOverwrite")}</div>
        <div className="mt-4 flex flex-col items-center justify-center gap-4 text-sm text-slate-200">
          <LayoutPreview layout={layoutPreview.layout} content={layoutPreview.content} />
          <label className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-left"><input checked={overwriteMerge} type="checkbox" className="h-4 w-4 rounded border-white/15 bg-slate-950/80 text-sky-400" onChange={(event) => setOverwriteMerge(event.target.checked)} /><span>Fill empty cells with current videos</span></label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => confirmFn(overwriteMerge)}>{t("views.multiview.confirmOverwriteYes")}</Button>
          <Button type="button" variant="ghost" onClick={() => cancelFn(overwriteMerge)}>{t("views.library.deleteConfirmationCancel")}</Button>
        </div>
      </Card>
    </Dialog>
  );
}
