"use client";

import { useMemo, useState } from "react";
import { mdiContentSave } from "@mdi/js";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { LayoutPreview } from "@/components/multiview/LayoutPreview";
import { encodeLayout } from "@/lib/mv-utils";
import { useI18n } from "@/lib/i18n";
import { useMultiviewStore } from "@/lib/multiview-store";

export function PresetEditor({ layout, content, onClose }: { layout: any[]; content: Record<string, any>; onClose?: () => void }) {
  const { t } = useI18n();
  const store = useMultiviewStore();
  const [name, setName] = useState("");
  const [autoLayout, setAutoLayout] = useState(false);
  const videoCells = useMemo(() => layout.filter((item) => !content[item.i] || content[item.i].type !== "chat").length, [layout, content]);
  const canSave = name.length > 0 && !store.presetLayout.find((item) => item.name === name) && layout.length > 0;
  function addPresetLayout() {
    const contentData = { layout: encodeLayout({ layout, contents: content }), name };
    store.addPresetLayout(contentData);
    if (autoLayout) store.setAutoLayout({ index: videoCells, encodedLayout: contentData.layout });
    onClose?.();
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">{t("views.multiview.presetEditor.title")}<span className="text-xs font-normal text-slate-400">{t("component.channelInfo.videoCount", [videoCells])}</span></div>
      <div className="flex justify-center"><LayoutPreview layout={layout} content={content} /></div>
      <div className="flex items-center gap-2"><Input value={name} className="min-w-0 flex-1" placeholder={t("views.multiview.presetEditor.name")} onChange={(event) => setName(event.target.value)} /><Button size="icon" className="h-9 w-9 shrink-0 rounded-xl" disabled={!canSave} title={t("views.multiview.presetEditor.title")} onClick={addPresetLayout}><Icon icon={mdiContentSave} size="sm" /></Button></div>
      <label className="flex items-center gap-2 text-sm text-slate-200"><input checked={autoLayout} type="checkbox" className="h-4 w-4 rounded border-white/20 bg-transparent" onChange={(event) => setAutoLayout(event.target.checked)} /><span>{t("views.multiview.presetEditor.autoLayout")}</span></label>
    </div>
  );
}
