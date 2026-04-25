"use client";

import { useEffect, useRef } from "react";
import { mdiBroom } from "@mdi/js";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

export function SelectCard({ title, description, showSearch, searchValue = "", searchPlaceholder = "Search...", showClear, clearDisabled, clearAriaLabel = "Clear", onSearchChange, onClear, children, className }: {
  title?: string;
  description?: string;
  showSearch?: boolean;
  searchValue?: string;
  searchPlaceholder?: string;
  showClear?: boolean;
  clearDisabled?: boolean;
  clearAriaLabel?: string;
  onSearchChange?: (value: string) => void;
  onClear?: () => void;
  children?: React.ReactNode;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const refresh = () => {
      const el = root.current;
      if (!el) return;
      el.querySelectorAll<HTMLElement>(".select-card-chip-grid, .select-card-chip-flow").forEach((group) => {
        let max = 0;
        group.querySelectorAll<HTMLElement>(".settings-check-chip, .stream-check-chip").forEach((chip) => {
          const label = chip.querySelector<HTMLElement>(".select-card-chip-label") || chip.querySelector<HTMLElement>("span:last-child");
          if (label) max = Math.max(max, label.scrollWidth);
        });
        group.style.setProperty("--select-card-chip-min-width", `${Math.max(132, max + 52)}px`);
      });
    };
    refresh();
    window.addEventListener("resize", refresh, { passive: true });
    return () => window.removeEventListener("resize", refresh);
  }, [children]);
  return <div ref={root} className={cn("select-card", className)}><div className="flex flex-col gap-[0.45rem]">
    {(title || description) ? <div className="space-y-1">{title ? <div className="select-card-title">{title}</div> : null}{description ? <div className="select-card-description">{description}</div> : null}</div> : null}
    {(showSearch || showClear) ? <div className="select-card-controls">{showSearch ? <Input value={searchValue} onChange={(e) => onSearchChange?.(e.target.value)} placeholder={searchPlaceholder} className="select-card-search-input" /> : null}{showClear ? <Button type="button" variant="ghost" size="icon" className="select-card-clear-btn" disabled={clearDisabled} aria-label={clearAriaLabel} onClick={onClear}><Icon icon={mdiBroom} className="h-4 w-4" /></Button> : null}</div> : null}
    {children}
  </div></div>;
}
