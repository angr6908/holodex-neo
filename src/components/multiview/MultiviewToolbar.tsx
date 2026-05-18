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
    <div className="relative z-20 border-b bg-background px-3">
      <div className="flex min-h-14 items-center gap-2 py-1">
        <div className="shrink-0 self-center">
	          <Popover open={navMenuOpen} onOpenChange={setNavMenuOpen}>
	            <PopoverTrigger
                render={<Button variant="outline" size="icon-sm" type="button" title={t("views.multiview.openNavigation")} />}
              >
	              <span className="sr-only">{t("views.multiview.openNavigation")}</span><icons.Menu className="h-4 w-4" />
            </PopoverTrigger>
            <PopoverContent align="start" sideOffset={8} className="w-auto min-w-[14rem] p-2">
              {navItems.map((item) => <Button key={item.to} nativeButton={false} render={<Link href={item.to} onClick={() => setNavMenuOpen(false)} />} variant="ghost" className="w-full justify-start">{item.label}</Button>)}
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex min-w-0 flex-1 items-center self-stretch">{left || children}</div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 self-center">
          {extraButtons}
          {buttons.filter((button) => !button.collapse).map((button, index) => <Button key={`mv-button-${index}`} type="button" size="icon-sm" variant="secondary" title={button.tooltip} onClick={button.onClick}><button.icon className="size-5" /></Button>)}
          {!compact ? (
            <Popover open={shareDialog} onOpenChange={setShareDialog}>
              <PopoverTrigger
                render={<Button type="button" size="icon-sm" variant="secondary" title={t("views.multiview.shareLayout")} />}
              >
                <LinkIcon className="size-5" />
              </PopoverTrigger>
              <PopoverContent align="end" sideOffset={8} className="w-[min(80vw,24rem)]">
                <div className="relative flex items-center">
                  <Input readOnly value={exportURL} className="pr-10" />
                  <Button type="button" variant={doneCopy ? "secondary" : "ghost"} size="icon-sm" className="absolute right-1.5 top-1/2 -translate-y-1/2" onClick={() => startCopyToClipboard(exportURL)}>{doneCopy ? <ClipboardCheck className="size-4" /> : <ClipboardPlus className="size-4" />}</Button>
                </div>
              </PopoverContent>
            </Popover>
          ) : null}
          {collapseButtons.length ? (
            <Popover open={collapsedMenuOpen} onOpenChange={setCollapsedMenuOpen}>
              <PopoverTrigger
                render={<Button type="button" size="icon-sm" variant="ghost" title={t("component.common.moreActions")} />}
              >
                <icons.MoreVertical className="size-5" />
              </PopoverTrigger>
              <PopoverContent align="end" sideOffset={8} className="w-auto min-w-[15rem] p-2">
                {collapseButtons.map((button, index) => <Button key={`mv-collapsed-${index}`} type="button" variant="ghost" className="w-full justify-start" onClick={() => handleCollapsedButton(button)}><button.icon className="size-5" /><span>{button.tooltip}</span></Button>)}
              </PopoverContent>
            </Popover>
          ) : null}
          <Button type="button" size="icon-sm" variant="ghost" title={t("views.multiview.collapseToolbar")} onClick={onCollapse}><icons.ChevronUp className="size-5" /></Button>
        </div>
      </div>
    </div>
  );
}
