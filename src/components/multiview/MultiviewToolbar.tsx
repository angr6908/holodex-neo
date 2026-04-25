"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { mdiClipboardCheckOutline, mdiClipboardPlusOutline, mdiLinkVariant } from "@mdi/js";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { useI18n } from "@/lib/i18n";
import { encodeLayout } from "@/lib/mv-utils";
import { useMultiviewStore } from "@/lib/multiview-store";
import * as icons from "@/lib/icons";

type ToolbarButton = { icon: string; tooltip: string; onClick: () => void; color?: string; collapse?: boolean };

export function MultiviewToolbar({ compact = false, buttons = [], onCollapse, children, left, extraButtons }: { compact?: boolean; buttons?: ToolbarButton[]; onCollapse?: () => void; children?: React.ReactNode; left?: React.ReactNode; extraButtons?: React.ReactNode }) {
  const { t } = useI18n();
  const store = useMultiviewStore();
  const [shareDialog, setShareDialog] = useState(false);
  const [collapsedMenuOpen, setCollapsedMenuOpen] = useState(false);
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const [doneCopy, setDoneCopy] = useState(false);
  const navMenuRoot = useRef<HTMLDivElement | null>(null);
  const shareRoot = useRef<HTMLDivElement | null>(null);
  const collapsedRoot = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    function handleWindowClick(event: MouseEvent) {
      if (navMenuOpen && navMenuRoot.current && !navMenuRoot.current.contains(event.target as Node)) setNavMenuOpen(false);
      if (shareDialog && shareRoot.current && !shareRoot.current.contains(event.target as Node)) setShareDialog(false);
      if (collapsedMenuOpen && collapsedRoot.current && !collapsedRoot.current.contains(event.target as Node)) setCollapsedMenuOpen(false);
    }
    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, [navMenuOpen, shareDialog, collapsedMenuOpen]);

  function startCopyToClipboard(txt: string) {
    navigator.clipboard?.writeText(txt).then(() => {
      setDoneCopy(true);
      setTimeout(() => setDoneCopy(false), 1200);
      setTimeout(() => setShareDialog(false), 200);
    }).catch(console.error);
  }
  function handleCollapsedButton(button: ToolbarButton) { setCollapsedMenuOpen(false); button.onClick(); }

  return (
    <div className="mv-toolbar relative z-20 border-b border-white/10 bg-slate-950 px-3">
      <div className="flex h-[52px] items-stretch gap-2">
        <div ref={navMenuRoot} className="relative shrink-0 self-center">
          <Button variant="outline" size="icon" type="button" className="mv-toolbar-button h-8 w-8 rounded-xl" title="Open navigation" onClick={() => setNavMenuOpen(!navMenuOpen)}>
            <span className="sr-only">Open navigation</span><svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z" /></svg>
          </Button>
          {navMenuOpen ? <Card className="absolute left-0 top-full z-[120] mt-2 min-w-[14rem] border border-white/10 bg-slate-950 p-2 shadow-2xl shadow-slate-950/80">{navItems.map((item) => <Link key={item.to} href={item.to} className="block rounded-xl px-3 py-2 text-sm text-slate-200 transition hover:bg-white/8 hover:text-white" onClick={() => setNavMenuOpen(false)}>{item.label}</Link>)}</Card> : null}
        </div>
        <div className="flex min-w-0 flex-1 items-center self-stretch">{left || children}</div>
        <div className="flex items-center justify-end gap-2 self-center">
          {extraButtons}
          {buttons.filter((button) => !button.collapse).map((button, index) => <Button key={`mv-button-${index}`} type="button" size="icon" variant="secondary" title={button.tooltip} className="mv-toolbar-button h-8 w-8 rounded-xl" onClick={button.onClick}><Icon icon={button.icon} /></Button>)}
          {!compact ? (
            <div ref={shareRoot} className="relative">
              <Button type="button" size="icon" variant="secondary" className="mv-toolbar-button h-8 w-8 rounded-xl" title="Share layout" onClick={() => setShareDialog(!shareDialog)}><Icon icon={mdiLinkVariant} /></Button>
              {shareDialog ? <Card className="absolute right-0 top-full z-[90] mt-2 w-[min(80vw,24rem)] border border-white/10 bg-slate-950 p-3 shadow-2xl shadow-slate-950/80"><div className="relative flex items-center"><Input readOnly value={exportURL} className={doneCopy ? "border-emerald-400/40 bg-emerald-500/10 pr-10" : "pr-10"} /><button type="button" className={`mv-share-copy-btn ${doneCopy ? "text-emerald-400" : ""}`} onClick={() => startCopyToClipboard(exportURL)}><Icon icon={doneCopy ? mdiClipboardCheckOutline : mdiClipboardPlusOutline} size="sm" /></button></div></Card> : null}
            </div>
          ) : null}
          {collapseButtons.length ? (
            <div ref={collapsedRoot} className="relative">
              <Button type="button" size="icon" variant="ghost" className="mv-toolbar-button h-8 w-8 rounded-xl" title="More actions" onClick={() => setCollapsedMenuOpen(!collapsedMenuOpen)}><Icon icon={icons.mdiDotsVertical} /></Button>
              {collapsedMenuOpen ? <Card className="absolute right-0 top-full z-[90] mt-2 min-w-[15rem] border border-white/10 bg-slate-950 p-2 shadow-2xl shadow-slate-950/80">{collapseButtons.map((button, index) => <button key={`mv-collapsed-${index}`} type="button" className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/8" onClick={() => handleCollapsedButton(button)}><Icon icon={button.icon} /><span>{button.tooltip}</span></button>)}</Card> : null}
            </div>
          ) : null}
          <Button type="button" size="icon" variant="ghost" className="mv-toolbar-button h-8 w-8 rounded-xl" title="Collapse toolbar" onClick={onCollapse}><Icon icon={icons.mdiChevronUp} /></Button>
        </div>
      </div>
    </div>
  );
}
