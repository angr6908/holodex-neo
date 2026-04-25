"use client";

import { Icon } from "@/components/ui/Icon";
import { LayoutPreviewCard } from "@/components/multiview/LayoutPreviewCard";
import { useI18n } from "@/lib/i18n";
import { useMultiviewStore } from "@/lib/multiview-store";
import * as icons from "@/lib/icons";

export function PresetSelector({ onSelected }: { onSelected?: (preset: any) => void }) {
  const { t } = useI18n();
  const store = useMultiviewStore();
  const autoLayoutSet = new Set(store.autoLayout);
  function presetInAuto(preset: any) { return autoLayoutSet.has(preset.id); }
  function removePresetLayout(preset: any) {
    const idx = store.autoLayout.findIndex((layout) => layout === preset.id);
    if (idx >= 0) store.setAutoLayout({ index: idx, encodedLayout: null });
    store.removePresetLayout(preset.name);
  }
  return (
    <div className="preset-dropdown-menu">
      {store.desktopGroups.length ? store.desktopGroups.map((group, index) => group?.length ? (
        <div key={`group-${index}`} className="mb-1">
          <div className="px-2 pb-1.5 pt-2 text-[0.68rem] font-medium uppercase tracking-widest text-[color:var(--color-muted-foreground)]">{t("component.channelInfo.videoCount", [index])}</div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-1.5 px-1">
            {group.map((preset: any) => (
              <div key={preset.id || preset.name} className="relative">
                <button type="button" className={`w-full cursor-pointer rounded-lg border p-1 transition ${presetInAuto(preset) ? "border-sky-400/40 bg-sky-500/10" : "border-white/8 bg-white/3 hover:border-white/14 hover:bg-white/7"}`} onClick={() => onSelected?.(preset)}>
                  <LayoutPreviewCard preset={preset} active={presetInAuto(preset)} scale={0.55} />
                </button>
                {preset.custom ? <button type="button" className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-md bg-black/40 text-slate-400 transition hover:bg-red-500/30 hover:text-red-300" onClick={(event) => { event.stopPropagation(); removePresetLayout(preset); }}><Icon icon={icons.mdiDelete} size="xs" /></button> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null) : null}
      {store.decodedCustomPresets.length ? (
        <div className="mb-1">
          <div className="px-2 pb-1.5 pt-2 text-[0.68rem] font-medium uppercase tracking-widest text-[color:var(--color-muted-foreground)]">{t("views.multiview.preset.custom")}</div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-1.5 px-1">
            {store.decodedCustomPresets.map((preset: any) => <div key={preset.id || preset.name} className="relative"><button type="button" className={`w-full cursor-pointer rounded-lg border p-1 transition ${presetInAuto(preset) ? "border-sky-400/40 bg-sky-500/10" : "border-white/8 bg-white/3 hover:border-white/14 hover:bg-white/7"}`} onClick={() => onSelected?.(preset)}><LayoutPreviewCard preset={preset} active={presetInAuto(preset)} scale={0.55} /></button><button type="button" className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-md bg-black/40 text-slate-400 transition hover:bg-red-500/30 hover:text-red-300" onClick={(event) => { event.stopPropagation(); removePresetLayout(preset); }}><Icon icon={icons.mdiDelete} size="xs" /></button></div>)}
          </div>
        </div>
      ) : null}
      {!store.desktopGroups.length && !store.decodedCustomPresets.length ? <div className="px-3 py-4 text-center text-sm text-slate-400">No presets available</div> : null}
    </div>
  );
}
