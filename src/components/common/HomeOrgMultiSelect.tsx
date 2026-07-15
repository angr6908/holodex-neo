"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ALL_VTUBERS_ORG, DEFAULT_ORG } from "@/lib/consts";
import { formatOrgDisplayName } from "@/lib/functions";
import { Building, ChevronDown, RotateCcw } from "@/lib/icons";
import { useAppState } from "@/lib/store";
import { cn } from "@/lib/utils";

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
  "Aogiri Highschool",
  "Varium",
  "MillionProduction",
  "Mixstgirls",
  "Phase Connect",
  "KAMITSUBAKI",
  "RK Music",
  "Riot Music",
  "REJECT",
  "Independents",
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
  const [draftSelectedNames, setDraftSelectedNames] = useState<string[]>([]);
  const draftSelectedNamesRef = useRef<string[]>([]);
  const allVtubersLabel = t("component.search.allVtubers");

  const formatSelectionLabel = (name: string) =>
    name === ALL_VTUBERS_ORG ? allVtubersLabel : formatOrgDisplayName(name);

  useEffect(() => {
    if (!app.orgs.length) void app.fetchOrgs();
  }, [app.orgs.length]);

  const orgs = useMemo(
    () => (app.orgs || []).filter((org) => org.name !== ALL_VTUBERS_ORG),
    [app.orgs],
  );
  const selectedNames = selectedNamesOverride || app.selectedHomeOrgs || [];
  const workingSelectedNames = open ? draftSelectedNames : selectedNames;
  const selectedSet = useMemo(() => new Set(workingSelectedNames), [workingSelectedNames]);
  const quickSelectOrgNames = useMemo(() => {
    const available = new Set(orgs.map((org) => org.name));
    return preferredOrgNames.filter((name) => available.has(name));
  }, [orgs]);
  const showQuickSelectAll = fallbackSelection.length === 0;
  const filteredOrgs = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return orgs;
    return orgs.filter((org) =>
      [org.name, org.short, org.name_jp]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [orgs, search]);

  const triggerLabel = useMemo(() => {
    if (selectedNames.length === 0) {
      return emptySelectionLabel === ALL_VTUBERS_ORG ? allVtubersLabel : emptySelectionLabel;
    }
    if (selectedNames.length === 1) return formatSelectionLabel(selectedNames[0]);
    return t("component.search.selectedOrgCount", { count: selectedNames.length });
  }, [selectedNames, emptySelectionLabel, allVtubersLabel, t]);

  const clearLabel =
    clearSelectionLabel === ALL_VTUBERS_ORG ? allVtubersLabel : clearSelectionLabel;

  function applySelection(nextRaw: string[]) {
    const nextSelection = [...new Set(nextRaw)];
    const prevSelection = [...selectedNames];
    const changed =
      nextSelection.length !== prevSelection.length ||
      nextSelection.some((name, index) => name !== prevSelection[index]);
    if (!changed) return;
    if (manualApply) onApply?.(nextSelection);
    else app.setSelectedHomeOrgs(nextSelection);
  }

  function setDraftSelection(next: string[] | ((prev: string[]) => string[])) {
    setDraftSelectedNames((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      draftSelectedNamesRef.current = value;
      return value;
    });
  }

  async function openSelector() {
    if (!app.orgs.length) await app.fetchOrgs();
    const nextDraft = selectedNames.length ? [...selectedNames] : [...fallbackSelection];
    draftSelectedNamesRef.current = nextDraft;
    setDraftSelectedNames(nextDraft);
    setSearch("");
    setOpen(true);
  }

  function closeSelector(nextOpen: boolean) {
    if (nextOpen) {
      void openSelector();
      return;
    }
    applySelection(draftSelectedNamesRef.current);
    setOpen(false);
    setSearch("");
  }

  function toggleName(name: string) {
    setDraftSelection((prev) =>
      prev.includes(name) ? prev.filter((value) => value !== name) : [...prev, name],
    );
  }

  function clearSelection() {
    setDraftSelection([...fallbackSelection]);
  }

  if (hideTrigger) return null;

  return (
    <Popover open={open} onOpenChange={closeSelector}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant={buttonVariant as any}
            className={cn(
              "justify-between transition-colors",
              buttonClass,
              className,
              selectedNames.length > 0 && buttonVariant !== "outline" && "bg-muted dark:bg-muted",
            )}
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
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        positionMethod="fixed"
        initialFocus={false}
        className="w-[min(92vw,26.5rem)] p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={t("component.search.searchOrganizations")}
          />
          <CommandGroup heading={t("component.search.quickSelect")} className="pb-2">
            <div className="flex flex-wrap gap-1.5">
              {showQuickSelectAll ? (
                <Button
                  type="button"
                  size="sm"
                  variant={workingSelectedNames.length === 0 ? "default" : "secondary"}
                  onClick={clearSelection}
                >
                  {clearLabel}
                </Button>
              ) : null}
              {quickSelectOrgNames.map((name) => {
                const label = formatOrgDisplayName(name);
                const selected = selectedSet.has(name);
                return (
                  <Button
                    key={name}
                    type="button"
                    size="sm"
                    variant={selected ? "default" : "secondary"}
                    onClick={() => toggleName(name)}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>
          </CommandGroup>

          <CommandSeparator />

          <div className="px-3 pt-2 pb-1.5 text-xs font-medium text-muted-foreground">
            {workingSelectedNames.length
              ? t("component.search.selectedCount", { count: workingSelectedNames.length })
              : t("component.search.organizations")}
          </div>

          <CommandList className="max-h-[16rem] overscroll-contain">
            <CommandGroup className="pt-0">
              {filteredOrgs.length === 0 ? (
                <CommandEmpty>{t("component.search.noOrganizationsFound")}</CommandEmpty>
              ) : null}
              {filteredOrgs.map((org) => {
                const selected = selectedSet.has(org.name);
                return (
                  <CommandItem
                    key={org.name}
                    value={org.name}
                    data-checked={selected}
                    onSelect={() => toggleName(org.name)}
                  >
                    <Checkbox checked={selected} aria-label={org.name} />
                    {formatOrgDisplayName(org.name)}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          <div className="flex items-center justify-between gap-2 border-t p-2">
            <Button type="button" size="sm" variant="ghost" onClick={clearSelection}>
              <RotateCcw className="size-4" />
              {clearLabel}
            </Button>
            <Button type="button" size="sm" onClick={() => closeSelector(false)}>
              {t("component.common.apply")}
            </Button>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
