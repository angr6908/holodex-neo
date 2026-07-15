"use client";

import {
  ChevronUp,
  ClipboardCheck,
  ClipboardPlus,
  type LucideIcon,
  Menu,
  MoreVertical,
  Share2,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMultiviewStore } from "@/lib/multiview-store";
import { encodeLayout } from "@/lib/mv-utils";

type ToolbarButton = { icon: LucideIcon; tooltip: string; onClick: () => void; collapse?: boolean };

export function MultiviewToolbar({
  compact = false,
  buttons = [],
  onCollapse,
  children,
  left,
  extraButtons,
}: {
  compact?: boolean;
  buttons?: readonly ToolbarButton[];
  onCollapse?: () => void;
  children?: React.ReactNode;
  left?: React.ReactNode;
  extraButtons?: React.ReactNode;
}) {
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
    navigator.clipboard
      ?.writeText(txt)
      .then(() => {
        setDoneCopy(true);
        setTimeout(() => setDoneCopy(false), 1200);
        setTimeout(() => setShareDialog(false), 200);
      })
      .catch(console.error);
  }
  function handleCollapsedButton(button: ToolbarButton) {
    setCollapsedMenuOpen(false);
    button.onClick();
  }
  return (
    <div className="relative z-20 border-b bg-background px-3">
      <div className="flex min-h-14 items-center gap-2 py-1">
        <div className="shrink-0 self-center">
          <Popover open={navMenuOpen} onOpenChange={setNavMenuOpen}>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title={t("views.multiview.openNavigation")}
                />
              }
            >
              <span className="sr-only">{t("views.multiview.openNavigation")}</span>
              <Menu />
            </PopoverTrigger>
            <PopoverContent align="start" sideOffset={8} className="w-auto min-w-[14rem] p-2">
              {navItems.map((item) => (
                <Button
                  key={item.to}
                  nativeButton={false}
                  variant="ghost"
                  render={<Link href={item.to} onClick={() => setNavMenuOpen(false)} />}
                >
                  {item.label}
                </Button>
              ))}
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex min-w-0 flex-1 items-center self-stretch">{left || children}</div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 self-center">
          {extraButtons}
          {buttons
            .filter((button) => !button.collapse)
            .map((button, index) => (
              <Button
                key={`mv-button-${index}`}
                type="button"
                variant="ghost"
                size="icon"
                title={button.tooltip}
                onClick={button.onClick}
              >
                <button.icon />
              </Button>
            ))}
          {!compact ? (
            <Popover open={shareDialog} onOpenChange={setShareDialog}>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    title={t("views.multiview.shareLayout")}
                  />
                }
              >
                <Share2 />
              </PopoverTrigger>
              <PopoverContent align="end" sideOffset={8} className="w-[min(80vw,24rem)]">
                <div className="relative flex items-center">
                  <Input readOnly value={exportURL} className="pr-10" />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => startCopyToClipboard(exportURL)}
                    >
                      {doneCopy ? <ClipboardCheck /> : <ClipboardPlus />}
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          ) : null}
          {collapseButtons.length ? (
            <Popover open={collapsedMenuOpen} onOpenChange={setCollapsedMenuOpen}>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    title={t("component.common.moreActions")}
                  />
                }
              >
                <MoreVertical />
              </PopoverTrigger>
              <PopoverContent align="end" sideOffset={8} className="w-auto min-w-[15rem] p-2">
                {collapseButtons.map((button, index) => (
                  <Button
                    key={`mv-collapsed-${index}`}
                    type="button"
                    variant="ghost"
                    onClick={() => handleCollapsedButton(button)}
                  >
                    <button.icon />
                    <span>{button.tooltip}</span>
                  </Button>
                ))}
              </PopoverContent>
            </Popover>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title={t("views.multiview.collapseToolbar")}
            onClick={onCollapse}
          >
            <ChevronUp />
          </Button>
        </div>
      </div>
    </div>
  );
}
