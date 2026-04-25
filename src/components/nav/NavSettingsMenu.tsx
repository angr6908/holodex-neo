"use client";

import { useEffect, useRef, useState } from "react";
import { SettingsSvgIcon } from "@/components/nav/NavSvgIcons";
import { Button } from "@/components/ui/Button";
import { SettingsPage } from "@/views/SettingsPage";
import { AboutSection } from "@/components/setting/AboutSection";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { POPOVER_MOTION_CLASS, useAnimatedPresence } from "@/lib/useAnimatedPresence";

export function NavSettingsMenu() {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuPresence = useAnimatedPresence(menuOpen, 180);
  const [tab, setTab] = useState<"settings" | "about">("settings");
  const root = useRef<HTMLDivElement | null>(null);
  const tabs = [
    { key: "settings" as const, label: t("component.mainNav.settings") },
    { key: "about" as const, label: t("component.mainNav.about") },
  ];

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (target.closest(".ui-select-menu")) return;
      if (root.current?.contains(target)) return;
      setMenuOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return <div ref={root} className="relative">
    <Button type="button" variant="ghost" size="icon" className="menu-action-btn" title={t("component.mainNav.settings")} onClick={() => setMenuOpen((v) => !v)}>
      <SettingsSvgIcon className="menu-theme-icon h-5 w-5" aria-hidden="true" />
      <span className="sr-only">{t("component.mainNav.settings")}</span>
    </Button>
    {menuPresence.present ? <div data-state={menuPresence.state} data-side="bottom" className={cn("popover-content absolute right-0 top-[calc(100%+0.5rem)] z-[160] flex max-h-[min(80vh,700px)] w-[26rem] flex-col overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--surface-nav-solid)] p-0 shadow-2xl", POPOVER_MOTION_CLASS, menuPresence.state === "closed" && "pointer-events-none")} onAnimationEnd={menuPresence.onAnimationEnd}>
      <div className="flex items-center border-b border-[color:var(--color-border)] px-3 py-2">
        <div className="inline-flex items-center gap-1 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-0.5">
          {tabs.map((item) => <button key={item.key} type="button" className={cn("cursor-pointer rounded-lg px-3 py-1.5 text-[0.8rem] font-medium transition", tab === item.key ? "bg-[color:var(--color-bold)] text-white" : "text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]")} onClick={() => setTab(item.key)}>{item.label}</button>)}
        </div>
      </div>
      {tab === "settings" ? <SettingsPage /> : <div className="scroll-area-viewport-native min-h-0 flex-1 overflow-y-auto"><AboutSection /></div>}
    </div> : null}
  </div>;
}
