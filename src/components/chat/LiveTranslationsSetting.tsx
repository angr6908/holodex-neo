"use client";

import { useEffect, useState } from "react";
import { TL_LANGS } from "@/lib/consts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription } from "@/components/ui/empty";

import { Input } from "@/components/ui/input";
import { Item, ItemActions, ItemTitle } from "@/components/ui/item";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { useAppState } from "@/lib/store";
import { useTranslations } from "next-intl";
import * as icons from "@/lib/icons";

export function LiveTranslationsSetting() {
  const app = useAppState();
  const t = useTranslations();
  const [dialog, setDialog] = useState(false);
  const [showBlockedList, setShowBlockedList] = useState(false);
  const blockedList = app.settings.liveTlBlocked || [];
  useEffect(() => { if (!dialog) setShowBlockedList(false); }, [dialog]);
  const patch = (p: any) => app.patchSettings(p);
  const toggleBlockName = (name: string) => patch({ liveTlBlocked: blockedList.filter((item: string) => item !== name) });
  const toggleSettings = [
    { checked: app.settings.liveTlShowVerified, label: t("views.watch.chat.showVerifiedMessages"), onChange: (value: boolean) => patch({ liveTlShowVerified: value }) },
    { checked: app.settings.liveTlShowModerator, label: t("views.watch.chat.showModeratorMessages"), onChange: (value: boolean) => patch({ liveTlShowModerator: value }) },
    { checked: app.settings.liveTlShowVtuber, label: t("views.watch.chat.showVtuberMessages"), onChange: (value: boolean) => patch({ liveTlShowVtuber: value }) },
    { checked: app.settings.liveTlShowLocalTime, label: t("views.watch.chat.showLocalTime"), onChange: (value: boolean) => patch({ liveTlShowLocalTime: value }) },
    { checked: app.settings.liveTlShowSubtitle, label: t("views.watch.chat.showSubtitle"), onChange: (value: boolean) => patch({ liveTlShowSubtitle: value }) },
    { checked: app.settings.liveTlHideSpoiler, label: t("views.watch.chat.hideSpoiler"), onChange: (value: boolean) => patch({ liveTlHideSpoiler: value }) },
    { checked: app.settings.liveTlStickBottom, label: t("views.watch.chat.StickBottomSettingLabel"), description: t("views.watch.chat.StickBottomSettingsDesc"), onChange: (value: boolean) => patch({ liveTlStickBottom: value }) },
  ];
  return (
    <div className="relative inline-flex">
      <Button variant="ghost" size="icon-sm" title={t("views.watch.chat.TLSettingsTitle")} onClick={() => setDialog(!dialog)}><icons.Settings className="size-4" /></Button>
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="flex flex-row items-center gap-3 space-y-0">
            {showBlockedList ? <Button variant="ghost" size="icon-sm" onClick={() => setShowBlockedList(false)}><icons.ArrowLeft className="size-4" /></Button> : null}
            <div>
              <DialogTitle>{showBlockedList ? t("views.channels.tabs.Blocked") : t("views.watch.chat.TLSettingsTitle")}</DialogTitle>
              <DialogDescription>{showBlockedList ? t("views.watch.chat.manageBlockedTranslators") : t("views.watch.chat.tuneTlBehavior")}</DialogDescription>
            </div>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
              {!showBlockedList ? (
                <div className="space-y-5">
	                  <div className="flex flex-col gap-2 text-sm"><Label htmlFor="live-tl-lang">{t("views.settings.tlLanguageSelection")}</Label><Select value={app.settings.liveTlLang} onValueChange={(value) => patch({ liveTlLang: value })}><SelectTrigger id="live-tl-lang" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{TL_LANGS.map((item) => <SelectItem key={item.value} value={item.value}>{item.text}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-3">
                    {toggleSettings.map((setting) => (
                      <Toggle key={setting.label} pressed={setting.checked} variant="outline" className="h-auto w-full justify-start whitespace-normal px-4 py-3" aria-label={setting.label} onPressedChange={setting.onChange}>
                        <span className="min-w-0 text-left">
                          <span className="block text-sm font-medium">{setting.label}</span>
                          {setting.description ? <span className="mt-1 block text-xs text-muted-foreground">{setting.description}</span> : null}
                        </span>
                      </Toggle>
                    ))}
                  </div>
                  <Button variant="outline" onClick={() => setShowBlockedList(true)}>{t("views.watch.chat.editBlockedList")}</Button>
                  <div className="grid gap-4 sm:grid-cols-2">
	                    <div className="flex flex-col gap-2 text-sm"><Label htmlFor="live-tl-font-size">{t("views.watch.chat.tlFontSize")}</Label><div className="flex items-center gap-2"><Input id="live-tl-font-size" value={app.settings.liveTlFontSize} type="number" className="flex-1" onChange={(event) => patch({ liveTlFontSize: Number(event.target.value) })} /><span className="text-sm text-muted-foreground">px</span></div></div>
	                    <div className="flex flex-col gap-2 text-sm"><Label htmlFor="live-tl-window-size">{t("views.watch.chat.tlWindowSize")}</Label><div className="flex items-center gap-2"><Input id="live-tl-window-size" value={app.settings.liveTlWindowSize} type="number" className="flex-1" onChange={(event) => patch({ liveTlWindowSize: Number(event.target.value) })} /><span className="text-sm text-muted-foreground">%</span></div></div>
                  </div>
                </div>
	              ) : blockedList.length ? <div className="space-y-2">{blockedList.map((name: string) => <Item key={name} className="justify-between px-4 py-3"><ItemTitle>{name}</ItemTitle><ItemActions><Button variant="secondary" size="sm" onClick={() => toggleBlockName(name)}>{t("component.channelSocials.unblock")}</Button></ItemActions></Item>)}</div> : <Empty className="px-4 py-8 md:px-4 md:py-8"><EmptyDescription>{t("views.watch.chat.noBlockedNames")}</EmptyDescription></Empty>}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
