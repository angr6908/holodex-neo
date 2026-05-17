"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ClipboardCheck, ClipboardPlus, Link as LinkIcon, type AnyIcon } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTranslations } from "next-intl";
import { encodeLayout } from "@/lib/mv-utils";
import { useMultiviewStore } from "@/lib/multiview-store";
import * as icons from "@/lib/icons";

type ToolbarButton = { icon: AnyIcon; tooltip: string; onClick: () => void; color?: string; collapse?: boolean };

export function MultiviewToolbar({ compact = false, buttons = [], onCollapse, children, left, extraButtons }: { compact?: boolean; buttons?: ToolbarButton[]; onCollapse?: () => void; children?: React.ReactNode; left?: React.ReactNode; extraButtons?: React.ReactNode }) {
  const t = useTranslations();
  const store = useMultiviewStore();
  const [shareDialog, setShareDialog] = useState(false);
  const [collapsedMenuOpen, setCollapsedMenuOpen] = useState(false);
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const [doneCopy, setDoneCopy] = useState(false);
  const collapseButtons = buttons.filter((button) => button.collapse);
  const exportURL = useMemo(() => {
    if (!shareDialog || typeof window === "undefined") return "";
    const layoutParam = `/${encodeURIComponent(encodeLayout({ layout: store.layout, contents: store.layoutContent, includeVideo: true }))}`;
    return `${window.origin}/multiview${layoutParam}`;
  }, [shareDialog, store.layout, store.layoutContent]);
  const navItems = [
    { to: "/", label: t("component.mainNav.home") },
    { to: "/library", label: t("component.mainNav.library") },
    { to: "/search", label: t("component.search.searchLabel") },
  ];

  function startCopyToClipboard(txt: string) {
    navigator.clipboard?.writeText(txt).then(() => {
      setDoneCopy(true);
      setTimeout(() => setDoneCopy(false), 1200);
      setTimeout(() => setShareDialog(false), 200);
    }).catch(console.error);
  }
  function handleCollapsedButton(button: ToolbarButton) { setCollapsedMenuOpen(false); button.onClick(); }
  return (
    <div className="relative z-20 border-b border-white/10 bg-slate-950 px-3">
      <div className="flex h-[52px] items-stretch gap-2">
        <div className="shrink-0 self-center">
	          <Popover open={navMenuOpen} onOpenChange={setNavMenuOpen}>
	            <PopoverTrigger
                render={<Button variant="outline" size="icon" type="button" className="h-8 w-8 rounded-xl transition-colors" title={t("views.multiview.openNavigation")} />}
              >
	              <span className="sr-only">{t("views.multiview.openNavigation")}</span><icons.Menu className="h-4 w-4" />
            </PopoverTrigger>
            <PopoverContent align="start" sideOffset={8} className="z-[120] w-auto min-w-[14rem] rounded-xl border-white/10 bg-slate-950 p-2 shadow-2xl shadow-slate-950/80">
              {navItems.map((item) => <Link key={item.to} href={item.to} className="block rounded-xl px-3 py-2 text-sm text-slate-200 transition hover:bg-white/8 hover:text-white" onClick={() => setNavMenuOpen(false)}>{item.label}</Link>)}
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex min-w-0 flex-1 items-center self-stretch">{left || children}</div>
        <div className="flex items-center justify-end gap-2 self-center">
          {extraButtons}
          {buttons.filter((button) => !button.collapse).map((button, index) => <Button key={`mv-button-${index}`} type="button" size="icon" variant="secondary" title={button.tooltip} className="h-8 w-8 rounded-xl transition-colors" onClick={button.onClick}><button.icon className="size-5" /></Button>)}
          {!compact ? (
            <Popover open={shareDialog} onOpenChange={setShareDialog}>
              <PopoverTrigger
                render={<Button type="button" size="icon" variant="secondary" className="h-8 w-8 rounded-xl transition-colors" title={t("views.multiview.shareLayout")} />}
              >
                <LinkIcon className="size-5" />
              </PopoverTrigger>
              <PopoverContent align="end" sideOffset={8} className="z-[90] w-[min(80vw,24rem)] rounded-xl border-white/10 bg-slate-950 p-3 shadow-2xl shadow-slate-950/80">
                <div className="relative flex items-center">
                  <Input readOnly value={exportURL} className={doneCopy ? "border-emerald-400/40 bg-emerald-500/10 pr-10" : "pr-10"} />
                  <Button type="button" variant="ghost" size="icon" className={`absolute right-1.5 top-1/2 h-7 w-7 -translate-y-1/2 rounded-lg border-0 text-primary hover:bg-primary/10 hover:text-primary focus-visible:border-0 focus-visible:bg-primary/10 focus-visible:ring-0 ${doneCopy ? "text-emerald-400 hover:text-emerald-400" : ""}`} onClick={() => startCopyToClipboard(exportURL)}>{doneCopy ? <ClipboardCheck className="size-4" /> : <ClipboardPlus className="size-4" />}</Button>
                </div>
              </PopoverContent>
            </Popover>
          ) : null}
          {collapseButtons.length ? (
            <Popover open={collapsedMenuOpen} onOpenChange={setCollapsedMenuOpen}>
              <PopoverTrigger
                render={<Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-xl transition-colors" title={t("component.common.moreActions")} />}
              >
                <icons.MoreVertical className="size-5" />
              </PopoverTrigger>
              <PopoverContent align="end" sideOffset={8} className="z-[90] w-auto min-w-[15rem] rounded-xl border-white/10 bg-slate-950 p-2 shadow-2xl shadow-slate-950/80">
                {collapseButtons.map((button, index) => <Button key={`mv-collapsed-${index}`} type="button" variant="ghost" className="h-auto w-full justify-start gap-3 rounded-xl px-3 py-2 text-left text-sm font-normal text-slate-200 hover:bg-white/8 hover:text-white" onClick={() => handleCollapsedButton(button)}><button.icon className="size-5" /><span>{button.tooltip}</span></Button>)}
              </PopoverContent>
            </Popover>
          ) : null}
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-xl transition-colors" title={t("views.multiview.collapseToolbar")} onClick={onCollapse}><icons.ChevronUp className="size-5" /></Button>
        </div>
      </div>
    </div>
  );
}
