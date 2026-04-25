"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { mdiChevronDown, mdiClose, mdiDomain } from "@mdi/js";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { SelectCard } from "@/components/setting/SelectCard";
import { useAppState } from "@/lib/store";
import { formatOrgDisplayName } from "@/lib/functions";
import { cn } from "@/lib/cn";
import { useAnimatedPresence } from "@/lib/useAnimatedPresence";

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
  inline?: boolean;
  className?: string;
  onApply?: (value: string[]) => void;
};

const allSelectionKey = "__all_selection__";
const preferredOrgNames = [
  "Hololive",
  "Nijisanji",
  "VSpo",
  "Neo-Porte",
  "774inc",
  "RK Music",
  "Riot Music",
];

export function HomeOrgMultiSelect({
  hideTrigger = false,
  buttonVariant = "secondary",
  buttonClass = "h-10 min-w-[12rem] px-3",
  iconOnly = false,
  emptySelectionLabel = "All Vtubers",
  clearSelectionLabel = "All Vtubers",
  fallbackSelection = [],
  selectedNamesOverride = null,
  manualApply = false,
  inline = false,
  className = "",
  onApply,
}: HomeOrgMultiSelectProps) {
  const app = useAppState();
  const root = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [draftSelectedNames, setDraftSelectedNames] = useState<string[]>([]);
  const panelPresence = useAnimatedPresence(isOpen, 220);
  const bodyScrollLocked = useRef(false);
  const previousHtmlOverflow = useRef("");
  const previousBodyOverflow = useRef("");
  const previousBodyPaddingRight = useRef("");

  useEffect(() => {
    if (!app.orgs.length) app.fetchOrgs();
  }, [app.orgs.length]);

  const orgs = useMemo(
    () => (app.orgs || []).filter((org) => org.name !== "All Vtubers"),
    [app.orgs],
  );

  const selectedNames = selectedNamesOverride || app.selectedHomeOrgs || [];
  const workingSelectedNames = isOpen ? draftSelectedNames : selectedNames;

  const quickSelectOrgNames = useMemo(() => {
    const available = new Set(orgs.map((org) => org.name));
    return preferredOrgNames.filter((name) => available.has(name));
  }, [orgs]);

  const quickSelectOptions = useMemo(() => {
    const options = quickSelectOrgNames.map((name) => ({
      key: name,
      type: "org",
      value: name,
      label: formatOrgDisplayName(name),
    }));
    if (fallbackSelection.length === 0)
      return [
        {
          key: allSelectionKey,
          type: "all",
          value: null as string | null,
          label: clearSelectionLabel,
        },
        ...options,
      ];
    return options;
  }, [quickSelectOrgNames, fallbackSelection.length, clearSelectionLabel]);

  const quickSelectAllOption =
    quickSelectOptions.find((option) => option.type === "all") || null;
  const quickSelectOrgOptions = quickSelectOptions.filter(
    (option) => option.type === "org",
  );

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
    if (selectedNames.length === 0) return emptySelectionLabel;
    if (selectedNames.length === 1) return formatOrgDisplayName(selectedNames[0]);
    if (selectedNames.length === 2)
      return selectedNames.map((name) => formatOrgDisplayName(name)).join(" + ");
    return `${selectedNames.length} Orgs`;
  }, [selectedNames, emptySelectionLabel]);

  const resolvedButtonClass = cn(
    "home-org-trigger rounded-xl",
    iconOnly ? "justify-center" : "justify-between",
    isOpen && "home-org-trigger-open",
    buttonClass,
  );

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (!isOpen) return;
      if (event.key === "Escape") closeDialog();
    }
    function handlePointerDown(event: PointerEvent) {
      if (!inline || !isOpen) return;
      if (root.current && !root.current.contains(event.target as Node))
        closeDialog();
    }
    window.addEventListener("keydown", handleKeydown);
    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("pointerdown", handlePointerDown);
      unlockPageScroll();
    };
  });

  function handleTriggerClick() {
    if (inline && isOpen) {
      closeDialog();
      return;
    }
    openDialog();
  }

  function lockPageScroll() {
    if (
      inline ||
      bodyScrollLocked.current ||
      typeof window === "undefined" ||
      typeof document === "undefined" ||
      !document.body
    )
      return;
    const html = document.documentElement;
    const body = document.body;
    previousHtmlOverflow.current = html.style.overflow;
    previousBodyOverflow.current = body.style.overflow;
    previousBodyPaddingRight.current = body.style.paddingRight;
    const scrollbarWidth = Math.max(0, window.innerWidth - html.clientWidth);
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
    bodyScrollLocked.current = true;
  }

  function unlockPageScroll() {
    if (
      inline ||
      !bodyScrollLocked.current ||
      typeof document === "undefined" ||
      !document.body
    )
      return;
    const html = document.documentElement;
    const body = document.body;
    html.style.overflow = previousHtmlOverflow.current;
    body.style.overflow = previousBodyOverflow.current;
    body.style.paddingRight = previousBodyPaddingRight.current;
    bodyScrollLocked.current = false;
  }

  async function openDialog() {
    if (!app.orgs.length) await app.fetchOrgs();
    setDraftSelectedNames(
      selectedNames.length ? [...selectedNames] : [...fallbackSelection],
    );
    setIsOpen(true);
    if (!inline) lockPageScroll();
  }

  function closeDialog() {
    applySelection(draftSelectedNames);
    setIsOpen(false);
    setSearch("");
    if (!inline) unlockPageScroll();
  }

  function isSelected(name: string) {
    return workingSelectedNames.includes(name);
  }

  function isQuickSelected(option: { type: string; value: string | null }) {
    if (option.type === "all") return workingSelectedNames.length === 0;
    return isSelected(option.value as string);
  }

  function toggleQuickSelect(option: { type: string; value: string | null }) {
    if (option.type === "all") {
      clearSelection();
      return;
    }
    toggleName(option.value as string);
  }

  function toggleName(name: string) {
    const next = draftSelectedNames.includes(name)
      ? draftSelectedNames.filter((value) => value !== name)
      : [...draftSelectedNames, name];
    setDraftSelectedNames(next);
    if (inline) applySelection(next);
  }

  function clearSelection() {
    const next = [...fallbackSelection];
    setDraftSelectedNames(next);
    if (inline) applySelection(next);
  }

  function applySelection(nextRaw: string[]) {
    const nextSelection = [...new Set(nextRaw)];
    const prevSelection = [...selectedNames];
    const changed =
      nextSelection.length !== prevSelection.length ||
      nextSelection.some((name, index) => name !== prevSelection[index]);
    if (!changed) return;
    if (manualApply) {
      onApply?.(nextSelection);
      return;
    }
    app.setSelectedHomeOrgs(nextSelection);
  }

  const panel = panelPresence.present ? (
    <div
      data-state={panelPresence.state}
      className={cn(
        inline
          ? "home-org-inline-panel absolute left-0 top-[calc(100%+0.5rem)] z-[360] w-[min(94vw,58rem)] max-w-[58rem] rounded-2xl p-3"
          : "home-org-backdrop fixed inset-0 z-[110] flex items-center justify-center overflow-hidden p-4 backdrop-blur-sm",
        panelPresence.state === "closed" && "pointer-events-none",
      )}
      style={
        inline ? undefined : { backgroundColor: "var(--overlay-backdrop)" }
      }
      onClick={(event) => {
        if (!inline && event.target === event.currentTarget) closeDialog();
      }}
      onAnimationEnd={inline ? panelPresence.onAnimationEnd : undefined}
    >
      <div
        data-state={panelPresence.state}
        className={
          inline
            ? "home-org-panel w-full"
            : "home-org-panel w-full max-w-[min(94vw,58rem)]"
        }
        onAnimationEnd={!inline ? panelPresence.onAnimationEnd : undefined}
      >
        <SelectCard
          className="home-org-select-card"
          showSearch
          searchValue={search}
          searchPlaceholder="Search organizations"
          showClear
          clearDisabled={workingSelectedNames.length === 0}
          clearAriaLabel={`Reset to ${clearSelectionLabel}`}
          onSearchChange={setSearch}
          onClear={clearSelection}
        >
          {workingSelectedNames.length > 0 ? (
            <div className="select-card-chip-flow">
              {workingSelectedNames.map((name) => (
                <div
                  key={name}
                  className="settings-check-chip settings-check-chip-selected select-card-chip-compact"
                >
                  <span className="settings-check-chip-indicator" />
                  <span className="select-card-chip-label">
                    {formatOrgDisplayName(name)}
                  </span>
                  <button
                    type="button"
                    className="select-card-chip-meta select-card-chip-remove select-card-chip-remove-btn"
                    aria-label={`Remove ${name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleName(name);
                    }}
                  >
                    <Icon icon={mdiClose} size="xs" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="space-y-0">
            {quickSelectOptions.length > 0 ? (
              <div className="home-org-quick-select px-1 py-2">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--color-muted-foreground)]">
                  Quick Select
                </div>
                <div className="select-card-chip-flow">
                  {quickSelectAllOption ? (
                    <button
                      key={quickSelectAllOption.key}
                      type="button"
                      className={cn(
                        "settings-check-chip select-card-chip-compact",
                        isQuickSelected(quickSelectAllOption) &&
                          "settings-check-chip-selected",
                      )}
                      onClick={() => toggleQuickSelect(quickSelectAllOption)}
                    >
                      <span className="settings-check-chip-indicator" />
                      <span className="select-card-chip-label">
                        {quickSelectAllOption.label}
                      </span>
                    </button>
                  ) : null}
                  {quickSelectAllOption && quickSelectOrgOptions.length ? (
                    <div
                      role="none"
                      className="home-org-quick-separator h-full w-px shrink-0 bg-[color:var(--color-border)]"
                    />
                  ) : null}
                  {quickSelectOrgOptions.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      className={cn(
                        "settings-check-chip select-card-chip-compact",
                        isQuickSelected(option) &&
                          "settings-check-chip-selected",
                      )}
                      onClick={() => toggleQuickSelect(option)}
                    >
                      <span className="settings-check-chip-indicator" />
                      <span className="select-card-chip-label">
                        {option.label}
                      </span>
                    </button>
                  ))}
                </div>
                <div
                  className="home-org-quick-select-divider"
                  aria-hidden="true"
                />
              </div>
            ) : null}
            <div className="home-org-select-scroll h-[40vh] overflow-y-auto md:h-[44vh]">
              <div className="select-card-chip-flow pr-1 pt-2">
                {filteredOrgs.map((org) => (
                  <button
                    key={org.name}
                    type="button"
                    className={cn(
                      "settings-check-chip select-card-chip-compact",
                      isSelected(org.name) && "settings-check-chip-selected",
                    )}
                    onClick={() => toggleName(org.name)}
                  >
                    <span className="settings-check-chip-indicator" />
                    <span className="select-card-chip-label">
                      {formatOrgDisplayName(org.name)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          {filteredOrgs.length === 0 ? (
            <div className="text-xs text-[color:var(--color-muted-foreground)]">
              No organizations found
            </div>
          ) : null}
        </SelectCard>
      </div>
    </div>
  ) : null;

  return (
    <div ref={root} className={cn("relative", className)}>
      {!hideTrigger ? (
        <Button
          type="button"
          variant={buttonVariant as any}
          className={resolvedButtonClass}
          aria-haspopup={inline ? "listbox" : "dialog"}
          aria-expanded={isOpen ? "true" : "false"}
          onClick={handleTriggerClick}
        >
          {iconOnly ? (
            <Icon
              icon={mdiDomain}
              size="sm"
              className="home-org-trigger-icon"
            />
          ) : (
            <>
              <span className="min-w-0 flex flex-1 items-center gap-2">
                <Icon
                  icon={mdiDomain}
                  size="sm"
                  className="home-org-trigger-icon"
                />
                <span className="min-w-0 truncate text-left">
                  {triggerLabel}
                </span>
              </span>
              <span className="shrink-0 flex items-center gap-2">
                <Icon
                  icon={mdiChevronDown}
                  size="sm"
                  className={cn(
                    "home-org-trigger-chevron",
                    isOpen && "home-org-trigger-chevron-open",
                  )}
                />
              </span>
            </>
          )}
        </Button>
      ) : null}
      {panel}
    </div>
  );
}
