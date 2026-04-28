"use client";

import { useEffect, useState } from "react";
import { TL_LANGS } from "@/lib/consts";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { useAppState } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import * as icons from "@/lib/icons";

function SettingToggle({ checked, label, description = "", onChange }: { checked: boolean; label: string; description?: string; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div><div className="text-sm font-medium text-white">{label}</div>{description ? <div className="mt-1 text-xs text-slate-400">{description}</div> : null}</div>
      <input checked={checked} type="checkbox" className="h-4 w-4 rounded border-white/20 bg-transparent" onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

export function LiveTranslationsSetting() {
  const app = useAppState();
  const { t } = useI18n();
  const [dialog, setDialog] = useState(false);
  const [showBlockedList, setShowBlockedList] = useState(false);
  const blockedList = app.settings.liveTlBlocked || [];
  useEffect(() => { if (!dialog) setShowBlockedList(false); }, [dialog]);
  const patch = (p: any) => app.patchSettings(p);
  const toggleBlockName = (name: string) => patch({ liveTlBlocked: blockedList.filter((item: string) => item !== name) });
  return (
    <div className="relative inline-flex">
      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" title={t("views.watch.chat.TLSettingsTitle")} onClick={() => setDialog(!dialog)}><Icon icon={icons.mdiCog} size="sm" /></Button>
      {dialog ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" onClick={(event) => { if (event.target === event.currentTarget) setDialog(false); }}>
          <Card className="max-h-[85vh] w-full max-w-lg overflow-hidden border border-white/10 p-0">
            <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
              {showBlockedList ? <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowBlockedList(false)}><Icon icon={icons.mdiArrowLeft} size="sm" /></Button> : null}
              <div><div className="text-lg font-semibold text-white">{showBlockedList ? t("views.channels.tabs.Blocked") : t("views.watch.chat.TLSettingsTitle")}</div><div className="text-sm text-slate-400">{showBlockedList ? "Manage blocked translator names." : "Tune live translation behavior and layout."}</div></div>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
              {!showBlockedList ? (
                <div className="space-y-5">
                  <label className="flex flex-col gap-2 text-sm"><span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t("views.settings.tlLanguageSelection")}</span><select value={app.settings.liveTlLang} className="h-11 rounded-2xl border border-white/12 bg-white/6 px-3 text-sm text-white outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20" onChange={(event) => patch({ liveTlLang: event.target.value })}>{TL_LANGS.map((item) => <option key={item.value} value={item.value} className="bg-slate-900">{item.text}</option>)}</select></label>
                  <div className="space-y-3">
                    <SettingToggle checked={app.settings.liveTlShowVerified} label={t("views.watch.chat.showVerifiedMessages")} onChange={(value) => patch({ liveTlShowVerified: value })} />
                    <SettingToggle checked={app.settings.liveTlShowModerator} label={t("views.watch.chat.showModeratorMessages")} onChange={(value) => patch({ liveTlShowModerator: value })} />
                    <SettingToggle checked={app.settings.liveTlShowVtuber} label={t("views.watch.chat.showVtuberMessages")} onChange={(value) => patch({ liveTlShowVtuber: value })} />
                    <SettingToggle checked={app.settings.liveTlShowLocalTime} label={t("views.watch.chat.showLocalTime")} onChange={(value) => patch({ liveTlShowLocalTime: value })} />
                    <SettingToggle checked={app.settings.liveTlShowSubtitle} label={t("views.watch.chat.showSubtitle")} onChange={(value) => patch({ liveTlShowSubtitle: value })} />
                    <SettingToggle checked={app.settings.liveTlHideSpoiler} label={t("views.watch.chat.hideSpoiler")} onChange={(value) => patch({ liveTlHideSpoiler: value })} />
                    <SettingToggle checked={app.settings.liveTlStickBottom} label={t("views.watch.chat.StickBottomSettingLabel")} description={t("views.watch.chat.StickBottomSettingsDesc")} onChange={(value) => patch({ liveTlStickBottom: value })} />
                  </div>
                  <Button variant="outline" onClick={() => setShowBlockedList(true)}>Edit Blocked List</Button>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-2 text-sm"><span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t("views.watch.chat.tlFontSize")}</span><div className="flex items-center gap-2"><Input value={app.settings.liveTlFontSize} type="number" className="flex-1" onChange={(event) => patch({ liveTlFontSize: Number(event.target.value) })} /><span className="text-sm text-slate-400">px</span></div></label>
                    <label className="flex flex-col gap-2 text-sm"><span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t("views.watch.chat.tlWindowSize")}</span><div className="flex items-center gap-2"><Input value={app.settings.liveTlWindowSize} type="number" className="flex-1" onChange={(event) => patch({ liveTlWindowSize: Number(event.target.value) })} /><span className="text-sm text-slate-400">%</span></div></label>
                  </div>
                </div>
              ) : blockedList.length ? <div className="space-y-2">{blockedList.map((name: string) => <div key={name} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"><span className="text-sm text-white">{name}</span><Button variant="secondary" size="sm" onClick={() => toggleBlockName(name)}>Unblock</Button></div>)}</div> : <div className="rounded-2xl border border-dashed border-white/12 px-4 py-8 text-center text-sm text-slate-400">No blocked names.</div>}
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
