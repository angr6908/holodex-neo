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
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMultiviewStore } from "@/lib/multiview-store";
import { encodeLayout } from "@/lib/mv-utils";

type ToolbarButton = { icon: LucideIcon; tooltip: string; onClick: () => void; collapse?: boolean };

// Labels a toolbar icon button with a tooltip. `render` is the button, or a popover trigger
// rendering one; `children` is its icon.
export function ToolbarTooltip({
  label,
  render,
  children,
}: {
  label: string;
  render: React.ReactElement;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={render}>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

// Below 600px the live strip has a row of its own, so the button row has room to spare: this
// measures how many more icon buttons fit beside the ones that always show (marked by not
// carrying data-overflow). Wider, the strip shares the row and it returns null.
function useSpareButtonSlots() {
  const rowRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [slots, setSlots] = useState<number | null>(null);
  useLayoutEffect(() => {
    const row = rowRef.current;
    const actions = actionsRef.current;
    if (!row || !actions) return;
    const narrow = window.matchMedia("(max-width: 599.98px)");
    const measure = () => {
      if (!narrow.matches) return setSlots(null);
      const rowGap = parseFloat(getComputedStyle(row).columnGap) || 0;
      const gap = parseFloat(getComputedStyle(actions).columnGap) || 0;
      const fixed = [...actions.children].filter(
        (el): el is HTMLElement => el instanceof HTMLElement && !el.hasAttribute("data-overflow"),
      );
      const nav = row.firstElementChild as HTMLElement | null;
      const room = row.clientWidth - (nav?.offsetWidth ?? 0) - rowGap;
      const used = fixed.reduce((w, el) => w + el.offsetWidth + gap, 0);
      const slot = (fixed.at(-1)?.offsetWidth ?? 32) + gap;
      setSlots(Math.max(0, Math.floor((room - used + gap) / slot)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    observer.observe(actions);
    narrow.addEventListener("change", measure);
    return () => {
      observer.disconnect();
      narrow.removeEventListener("change", measure);
    };
  }, []);
  return { rowRef, actionsRef, slots };
}

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
  const { rowRef, actionsRef, slots } = useSpareButtonSlots();
  // With room measured, the buttons take the spare slots in order and More (itself a slot) holds
  // the rest; otherwise the page's collapse flags decide.
  const collapseButtons =
    slots === null
      ? buttons.filter((button) => button.collapse)
      : buttons.length <= slots
        ? []
        : buttons.slice(Math.max(slots - 1, 0));
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
      {/* Below 600px the left side (the live strip) takes a full row under the buttons, rather
          than the sliver they leave beside them. */}
      <div ref={rowRef} className="flex min-h-14 flex-wrap items-center gap-x-2 gap-y-1 py-1">
        <div className="shrink-0 self-center">
          <Popover open={navMenuOpen} onOpenChange={setNavMenuOpen}>
            <ToolbarTooltip
              label={t("views.multiview.openNavigation")}
              render={
                <PopoverTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("views.multiview.openNavigation")}
                    />
                  }
                />
              }
            >
              <Menu />
            </ToolbarTooltip>
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
        <div className="flex min-w-0 flex-1 items-center self-stretch max-[600px]:order-last max-[600px]:basis-full">
          {left || children}
        </div>
        <div
          ref={actionsRef}
          className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2 self-center"
        >
          {extraButtons}
          {buttons
            .filter((button) => !collapseButtons.includes(button))
            .map((button) => (
              <ToolbarTooltip
                key={button.tooltip}
                label={button.tooltip}
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={button.tooltip}
                    onClick={button.onClick}
                    data-overflow
                  />
                }
              >
                <button.icon />
              </ToolbarTooltip>
            ))}
          {!compact ? (
            <Popover open={shareDialog} onOpenChange={setShareDialog}>
              <ToolbarTooltip
                label={t("views.multiview.shareLayout")}
                render={
                  <PopoverTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t("views.multiview.shareLayout")}
                      />
                    }
                  />
                }
              >
                <Share2 />
              </ToolbarTooltip>
              <PopoverContent align="end" sideOffset={8} className="w-[min(80vw,24rem)]">
                <div className="relative flex items-center">
                  <Input readOnly value={exportURL} className="pr-10" />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("component.common.copyToClipboard")}
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
              <ToolbarTooltip
                label={t("component.common.moreActions")}
                render={
                  <PopoverTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t("component.common.moreActions")}
                        data-overflow
                      />
                    }
                  />
                }
              >
                <MoreVertical />
              </ToolbarTooltip>
              <PopoverContent align="end" sideOffset={8} className="w-auto min-w-[15rem] p-2">
                {collapseButtons.map((button) => (
                  <Button
                    key={button.tooltip}
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
          <ToolbarTooltip
            label={t("views.multiview.collapseToolbar")}
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("views.multiview.collapseToolbar")}
                onClick={onCollapse}
              />
            }
          >
            <ChevronUp />
          </ToolbarTooltip>
        </div>
      </div>
    </div>
  );
}
