"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { langs } from "@/lib/consts";
import themeSet, { readStoredThemeId, applyThemeColor } from "@/lib/themes";
import { useAppState } from "@/lib/store";
import { useTranslations } from "next-intl";
import { setLocaleCookie } from "@/lib/browser";
import { api } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
const sectionLabelClass = "text-[0.68rem] font-normal uppercase leading-normal tracking-[0.16em] text-muted-foreground";
const settingControlClass = "flex min-w-[min(100%,14rem)] max-w-full flex-1 flex-col gap-[0.45rem]";

export function SettingsPage({ className = "" }: { className?: string }) {
  const app = useAppState();
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [themeId, setThemeId] = useState<number | string>(() => readStoredThemeId());
  const overrideLanguage = searchParams.get("lang") || undefined;

  const themeOptions = useMemo(() => themeSet, []);
  const selectedTheme = themeOptions.find((theme) => theme.id === Number(themeId)) || themeOptions[0];
  const themeName = (name?: string) => name === "Default" ? t("views.settings.defaultTheme") : name || t("views.settings.defaultTheme");
  const defaultOpenChoices = useMemo(() => [
    { text: t("component.mainNav.home"), value: "home" },
    { text: t("component.mainNav.favorites"), value: "favorites" },
    { text: t("component.mainNav.multiview"), value: "multiview" },
  ] as const, [t]);

  useEffect(() => { api.topics().catch(() => {}); }, []);
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    requestAnimationFrame(() => {
      document.querySelector(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);
  useEffect(() => {
    try {
      const theme = themeOptions.find((t) => t.id === Number(themeId));
      localStorage.setItem("theme", `${themeId}`);
      if (theme) {
        localStorage.setItem("theme-color", theme.computedColor);
        applyThemeColor(theme.computedColor);
      }
    } catch {}
  }, [themeId, themeOptions]);

  function clearOverrideLanguage() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("lang");
    window.dispatchEvent(new Event("holodex-clear-lang-override"));
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
  }

  function checkChip(label: string, checked: boolean, onChange: (checked: boolean) => void, disabled = false, disabledClass = disabled) {
    return <Toggle pressed={checked} disabled={disabled} variant="outline" className={cn("min-w-fit flex-1 justify-center", disabledClass && "opacity-60")} aria-label={label} onPressedChange={onChange}>
      <span>{label}</span>
    </Toggle>;
  }

  return <div className={cn("min-h-0 flex-1 space-y-6 overflow-y-auto overflow-x-hidden p-4 sm:p-5", className)}>
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className={settingControlClass}>
          <Label className={sectionLabelClass}>{t("views.settings.languageSettings")}</Label>
          <Select
            modal={false}
            value={app.settings.lang}
            onValueChange={(value) => {
              app.patchSettings({ lang: value });
              setLocaleCookie(value);
              if (overrideLanguage) clearOverrideLanguage();
              router.refresh();
            }}
          >
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
            {langs.map((lang) => (
              <SelectItem key={lang.val} value={lang.val}>
                {(lang as any).credit ? `${(lang as any).display} - ${(lang as any).credit}` : (lang as any).display}
              </SelectItem>
            ))}
            </SelectContent>
          </Select>
        </div>

        <div className={settingControlClass}>
          <Label className={sectionLabelClass}>{t("views.settings.theme")}</Label>
          <Select modal={false} value={String(themeId)} onValueChange={(value) => setThemeId(value)}>
            <SelectTrigger>
              <span className="flex min-w-0 items-center gap-2">
                <ThemeSwatch color={selectedTheme?.computedColor} />
                <span className="truncate">{themeName(selectedTheme?.name)}</span>
              </span>
            </SelectTrigger>
            <SelectContent>
              {themeOptions.map((theme) => (
                <SelectItem key={theme.id} value={String(theme.id)}>
                  <span className="flex min-w-0 items-center gap-2">
                    <ThemeSwatch color={theme.computedColor} />
                    <span className="truncate">{themeName(theme.name)}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className={settingControlClass}>
          <Label className={sectionLabelClass}>{t("views.settings.defaultPage")}</Label>
          <ToggleGroup
            variant="outline"
            size="sm"
            value={[app.settings.defaultOpen]}
            onValueChange={(value) => value[0] && app.patchSettings({ defaultOpen: value[0] as any })}
          >
            {defaultOpenChoices.map((opt) => (
              <ToggleGroupItem key={opt.value} value={opt.value}>
                {opt.text}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      {overrideLanguage ? <Alert onClick={clearOverrideLanguage}>
        <AlertDescription>
	          {t("views.settings.languageOverrideActive", { language: langs.find((x) => x.val === overrideLanguage)?.display || overrideLanguage })}
	        </AlertDescription>
	      </Alert> : null}

	      <div className="flex flex-col gap-[0.45rem]">
	        <Label className={sectionLabelClass}>{t("views.settings.systemOptions")}</Label>
	        <div className="flex flex-wrap items-stretch gap-2">
	          {checkChip(t("views.settings.openOnHolodexLabel"), !app.settings.redirectMode, (v) => app.patchSettings({ redirectMode: !v }))}
	          {checkChip(t("views.settings.darkModeLabel"), app.settings.darkMode, (v) => app.patchSettings({ darkMode: v }), app.settings.followSystemTheme, app.settings.followSystemTheme && !app.settings.darkMode)}
	          {checkChip(t("views.settings.scrollModeLabel"), app.settings.scrollMode, (v) => app.patchSettings({ scrollMode: v }))}
	          {checkChip(t("views.settings.followSystemThemeLabel"), app.settings.followSystemTheme, (v) => app.patchSettings({ followSystemTheme: v }))}
	          {checkChip(t("views.settings.useEnglishNameLabel"), app.settings.useEnglishName, (v) => app.patchSettings({ useEnglishName: v }))}
	        </div>
      </div>
    </div>
  </div>;
}

function ThemeSwatch({ color }: { color?: string }) {
  return (
    <span
      className="size-3 shrink-0 rounded-full border border-border shadow-sm"
      style={{ backgroundColor: color ?? "var(--primary)" }}
    />
  );
}
