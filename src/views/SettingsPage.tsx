"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { mdiCheck, mdiChevronDown } from "@mdi/js";
import { langs } from "@/lib/langs";
import themeSet, { readStoredThemeId, resolveThemeById } from "@/lib/themes";
import { useAppState } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { SelectCard } from "@/components/setting/SelectCard";
import { Select } from "@/components/ui/Select";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

function useTextMeasure() {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  return (text: string, font = "400 14px sans-serif") => {
    if (typeof document === "undefined") return `${text || ""}`.length * 8;
    if (!canvas.current) canvas.current = document.createElement("canvas");
    const ctx = canvas.current.getContext("2d");
    if (!ctx) return `${text || ""}`.length * 8;
    ctx.font = font;
    return Math.ceil(ctx.measureText(`${text || ""}`).width);
  };
}

export function SettingsPage({ className = "" }: { className?: string }) {
  const app = useAppState();
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [themeId, setThemeId] = useState<number | string>(() => readStoredThemeId());
  const measureTextWidthPx = useTextMeasure();
  const overrideLanguage = searchParams.get("lang") || undefined;

  const themeOptions = useMemo(() => themeSet.map((theme) => ({ ...theme, preview: resolveThemeById(theme.id).themes.light })), []);
  const defaultOpenChoices = useMemo(() => [
    { text: t("component.mainNav.home"), value: "home" },
    { text: t("component.mainNav.favorites"), value: "favorites" },
    { text: t("component.mainNav.multiview"), value: "multiview" },
  ], [t]);

  const currentThemeLabel = themeOptions.find((item) => item.id === Number(themeId))?.name || "";
  const defaultOpenLabel = defaultOpenChoices.find((item) => item.value === app.settings.defaultOpen)?.text || app.settings.defaultOpen;

  function estimateTopFieldWidthPx(label: string, value: string, extra = 0) {
    const labelWidth = measureTextWidthPx(label || "", "400 11px sans-serif") + (label || "").length * 1.4;
    const triggerTextWidth = measureTextWidthPx(value || "", "400 14px sans-serif") + 46 + extra;
    return Math.max(136, Math.min(420, Math.ceil(Math.max(labelWidth, triggerTextWidth) + 10)));
  }

  const topFieldStyles = {
    theme: fieldStyle(estimateTopFieldWidthPx(t("views.settings.theme"), currentThemeLabel, 18)),
    defaultPage: fieldStyle(estimateTopFieldWidthPx(t("views.settings.defaultPage"), defaultOpenLabel)),
  };

  useEffect(() => { api.topics().catch(() => {}); }, []);
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    requestAnimationFrame(() => {
      document.querySelector(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);
  useEffect(() => {
    try { localStorage.setItem("theme", `${themeId}`); } catch {}
    window.dispatchEvent(new CustomEvent("holodex-theme-change", { detail: themeId }));
  }, [themeId]);

  function clearOverrideLanguage() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("lang");
    window.dispatchEvent(new Event("holodex-clear-lang-override"));
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
  }

  function checkChip(label: string, checked: boolean, onChange: (checked: boolean) => void, disabled = false, disabledClass = disabled) {
    return <label className={cn("settings-check-chip", checked && "settings-check-chip-selected", disabledClass && "settings-check-chip-disabled")}>
      <input checked={checked} disabled={disabled} type="checkbox" className="peer sr-only" onChange={(e) => onChange(e.target.checked)} />
      <span className="settings-check-chip-indicator" />
      <span>{label}</span>
    </label>;
  }

  return <div className={cn("settings-scroll space-y-6 p-4 sm:p-5", className)}>
    <div className="space-y-3">
      <div className="settings-top-grid">
        <div className="settings-field min-w-0">
          <span className="settings-field-label">{t("views.settings.languageSettings")}</span>
          <Select
            value={app.settings.lang}
            options={[...langs]}
            labelKey="display"
            valueKey="val"
            placeholder="Select language"
            className="lang-select"
            onChange={(value) => {
              app.patchSettings({ lang: value });
              if (overrideLanguage) clearOverrideLanguage();
            }}
            renderTrigger={({ selectedOption, open }) => <span className="flex w-full min-w-0 items-center justify-between gap-3 text-left">
              <span className="flex min-w-0 flex-1 flex-col"><span className="min-w-0 truncate">{(selectedOption as any)?.display || "Select language"}</span>{(selectedOption as any)?.credit ? <span className="lang-credit text-[color:var(--color-muted-foreground)] text-xs">{(selectedOption as any).credit}</span> : null}</span>
              <Icon icon={mdiChevronDown} size="sm" className={cn("shrink-0 text-[color:var(--color-muted-foreground)] transition-transform", open && "rotate-180")} />
            </span>}
            renderOption={({ option, selected }) => <span className="flex w-full min-w-0 items-center justify-between gap-3">
              <span className="flex min-w-0 flex-1 flex-col overflow-hidden"><span className="min-w-0 truncate">{(option as any).display}</span>{(option as any).credit ? <span className="lang-credit min-w-0 truncate text-[color:var(--color-muted-foreground)] text-xs">{(option as any).credit}</span> : null}</span>
              {selected ? <Icon icon={mdiCheck} size="sm" className="ml-3 shrink-0 text-[color:var(--color-foreground)]" /> : null}
            </span>}
          />
        </div>

        <div className="settings-field" style={topFieldStyles.theme}>
          <span className="settings-field-label">{t("views.settings.theme")}</span>
          <Select
            value={Number(themeId)}
            options={themeOptions}
            labelKey="name"
            valueKey="id"
            placeholder="Select theme"
            onChange={(value) => setThemeId(value)}
            renderTrigger={({ selectedOption, open }) => {
              const opt: any = selectedOption || themeOptions[0];
              return <span className="flex w-full min-w-0 items-center justify-between gap-2"><span className="flex min-w-0 items-center gap-2"><span className="flex shrink-0 items-center"><span className="theme-select-swatch" style={{ background: opt.preview.accent }} /></span><span className="truncate">{opt.name}</span></span><Icon icon={mdiChevronDown} size="sm" className={cn("shrink-0 text-[color:var(--color-muted-foreground)] transition-transform", open && "rotate-180")} /></span>;
            }}
            renderOption={({ option, selected }) => <><span className="flex min-w-0 items-center gap-2"><span className="flex shrink-0 items-center"><span className="theme-select-swatch" style={{ background: (option as any).preview.accent }} /></span><span className="truncate">{(option as any).name}</span></span>{selected ? <Icon icon={mdiCheck} size="sm" className="ml-3 shrink-0 text-[color:var(--color-foreground)]" /> : null}</>}
          />
        </div>

        <div className="settings-field" style={topFieldStyles.defaultPage}>
          <span className="settings-field-label">{t("views.settings.defaultPage")}</span>
          <Select value={app.settings.defaultOpen} options={defaultOpenChoices} labelKey="text" valueKey="value" placeholder="Select default page" onChange={(value) => app.patchSettings({ defaultOpen: value })} />
        </div>
      </div>

      {overrideLanguage ? <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2.5 text-sm text-amber-50" onClick={clearOverrideLanguage}>
        Language override is active for <code>{langs.find((x) => x.val === overrideLanguage)?.display}</code>. Click to clear it.
      </div> : null}

      <SelectCard title="System Options">
        <div className="select-card-chip-flow">
          {checkChip(t("views.settings.redirectModeLabel"), app.settings.redirectMode, (v) => app.patchSettings({ redirectMode: v }))}
          {checkChip(t("views.settings.darkModeLabel"), app.settings.darkMode, (v) => app.patchSettings({ darkMode: v }), app.settings.followSystemTheme, app.settings.followSystemTheme && !app.settings.darkMode)}
          {checkChip(t("views.settings.scrollModeLabel"), app.settings.scrollMode, (v) => app.patchSettings({ scrollMode: v }))}
          {checkChip("Hide Upcoming", app.settings.hideUpcoming, (v) => app.patchSettings({ hideUpcoming: v }))}
          {checkChip("Follow System Theme", app.settings.followSystemTheme, (v) => app.patchSettings({ followSystemTheme: v }))}
          {checkChip(t("views.settings.useEnglishNameLabel"), app.settings.useEnglishName, (v) => app.patchSettings({ useEnglishName: v }))}
        </div>
      </SelectCard>
    </div>
  </div>;
}

const fieldStyle = (widthPx: number) => ({ flex: `${Math.max(1, Math.round(widthPx))} 1 0`, minWidth: `${Math.max(136, Math.round(widthPx))}px` });
