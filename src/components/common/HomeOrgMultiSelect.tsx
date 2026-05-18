"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Building } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Toggle } from "@/components/ui/toggle";
import { ALL_VTUBERS_ORG, DEFAULT_ORG } from "@/lib/consts";
import { formatOrgDisplayName } from "@/lib/functions";
import { useAppState } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
type HomeOrgMultiSelectProps = {
  hideTrigger?: boolean;
  buttonVariant?: string;
  buttonClass?: string;
  iconOnly?: boolean;
  emptySelectionLabel?: string;
  clearSelectionLabel?: string;
  fallbackSelection?: string[];
  selectedNamesOverride?: string[] | null;
  manualApply?: boolean;
  className?: string;
  onApply?: (value: string[]) => void;
};

const preferredOrgNames = [
  DEFAULT_ORG,
  "Nijisanji",
  "VSpo",
  "Neo-Porte",
  "774inc",
  "Varium",
  "RK Music",
  "Riot Music",
];

export function HomeOrgMultiSelect({
  hideTrigger = false,
  buttonVariant = "secondary",
  buttonClass = "",
  iconOnly = false,
  emptySelectionLabel = ALL_VTUBERS_ORG,
  clearSelectionLabel = ALL_VTUBERS_ORG,
  fallbackSelection = [],
  selectedNamesOverride = null,
  manualApply = false,
  className = "",
  onApply,
}: HomeOrgMultiSelectProps) {
  const app = useAppState();
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const allVtubersLabel = t("component.search.allVtubers");

  const formatSelectionLabel = (name: string) => name === ALL_VTUBERS_ORG ? allVtubersLabel : formatOrgDisplayName(name);

  useEffect(() => {
    if (!app.orgs.length) void app.fetchOrgs();
  }, [app.orgs.length]);

  const orgs = useMemo(
    () => (app.orgs || []).filter((org) => org.name !== ALL_VTUBERS_ORG),
    [app.orgs],
  );
  const selectedNames = selectedNamesOverride || app.selectedHomeOrgs || [];
  const workingSelectedNames = selectedNames.length ? selectedNames : fallbackSelection;
  const selectedSet = useMemo(() => new Set(workingSelectedNames), [workingSelectedNames]);
  const quickSelectOrgNames = useMemo(() => {
    const available = new Set(orgs.map((org) => org.name));
    return preferredOrgNames.filter((name) => available.has(name));
  }, [orgs]);
  const filteredOrgs = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return orgs;
    return orgs.filter((org) =>
      [org.name, org.short, org.name_jp]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [orgs, search]);
  const triggerLabel = (() => {
    if (selectedNames.length === 0) {
      return emptySelectionLabel === ALL_VTUBERS_ORG
        ? allVtubersLabel
        : emptySelectionLabel;
    }
    if (selectedNames.length === 1) return formatSelectionLabel(selectedNames[0]);
    if (selectedNames.length === 2) return selectedNames.map(formatSelectionLabel).join(" + ");
    return t("component.search.selectedOrgCount", { count: selectedNames.length });
  })();

  const clearLabel =
    clearSelectionLabel === ALL_VTUBERS_ORG ? allVtubersLabel : clearSelectionLabel;

  function applySelection(nextRaw: string[]) {
    const nextSelection = [...new Set(nextRaw)];
    if (manualApply) onApply?.(nextSelection);
    else app.setSelectedHomeOrgs(nextSelection);
  }

  function toggleName(name: string, checked: boolean) {
    const base = workingSelectedNames;
    applySelection(checked ? [...base, name] : base.filter((value) => value !== name));
  }

  function clearSelection() {
    applySelection([...fallbackSelection]);
  }

  if (hideTrigger) return null;

  return (
    <DropdownMenu open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (nextOpen) void app.fetchOrgs(); }}>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant={buttonVariant as any}
            className={cn("justify-between", buttonClass, className)}
          />
        }
      >
        {iconOnly ? (
          <Building className="size-4" />
        ) : (
          <>
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <Building className="size-4 shrink-0" />
              <span className="truncate">{triggerLabel}</span>
            </span>
            <ChevronDown className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="w-[min(92vw,24rem)]">
        <div className="p-1">
          <Input
            tabIndex={-1}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
            placeholder={t("component.search.searchOrganizations")}
          />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("component.search.quickSelect")}</DropdownMenuLabel>
          <div className="flex flex-wrap gap-1.5 px-2 pb-1.5">
            <Toggle
              pressed={workingSelectedNames.length === 0}
              variant="outline"
              size="sm"
              aria-label={clearLabel}
              onPressedChange={(checked) => { if (checked) clearSelection(); }}
            >
              <span className="truncate">{clearLabel}</span>
            </Toggle>
            {quickSelectOrgNames.map((name) => {
              const label = formatOrgDisplayName(name);
              return (
                <Toggle
                  key={name}
                  pressed={selectedSet.has(name)}
                  variant="outline"
                  size="sm"
                  aria-label={label}
                  onPressedChange={(checked) => toggleName(name, checked)}
                >
                  <span className="truncate">{label}</span>
                </Toggle>
              );
            })}
          </div>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[min(45vh,22rem)]">
          {filteredOrgs.map((org) => (
            <DropdownMenuCheckboxItem
              key={org.name}
              checked={selectedSet.has(org.name)}
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={(checked) => toggleName(org.name, checked === true)}
            >
              {formatOrgDisplayName(org.name)}
            </DropdownMenuCheckboxItem>
          ))}
          {filteredOrgs.length === 0 ? (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">{t("component.search.noOrganizationsFound")}</div>
          ) : null}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
