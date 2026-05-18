"use client";

import dayjs from "dayjs";
import { useState } from "react";
import { TL_LANGS } from "@/lib/consts";
import { HOME_TABS } from "@/lib/cookie-codec";
import { Calendar as CalendarIcon, Grid2x2, Languages, LayoutDashboard, LayoutGrid, List, ListFilter, Rows3, type AnyIcon } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { VideoListFilters } from "@/components/setting/VideoListFilters";
import { useTranslations } from "next-intl";

export type DisplayMode = "grid-0" | "grid-1" | "grid-2" | "list" | "denseList";

const DISPLAY_OPTIONS: { value: DisplayMode; icon: AnyIcon; labelKey: string; fallback: string }[] = [
  { value: "grid-0", icon: LayoutGrid, labelKey: "views.settings.gridSize.0", fallback: "Large grid" },
  { value: "grid-1", icon: LayoutDashboard, labelKey: "views.settings.gridSize.1", fallback: "Medium grid" },
  { value: "grid-2", icon: Grid2x2, labelKey: "views.settings.gridSize.2", fallback: "Small grid" },
  { value: "list", icon: List, labelKey: "views.home.controls.list", fallback: "List" },
  { value: "denseList", icon: Rows3, labelKey: "views.home.controls.denseList", fallback: "Dense list" },
];

export function VideoListTopControls({
  tab,
  isActive,
  sortBy,
  displayMode,
  toDate,
  clipLangs,
  onSortByChange,
  onDisplayModeChange,
  onToDateChange,
  onToggleClipLang,
}: {
  tab: number;
  isActive: boolean;
  sortBy: string;
  displayMode: DisplayMode;
  toDate: string | null;
  clipLangs: string[];
  onSortByChange: (value: string) => void;
  onDisplayModeChange: (value: DisplayMode) => void;
  onToDateChange: (value: string | null) => void;
  onToggleClipLang: (value: string, checked: boolean) => void;
}) {
  const t = useTranslations();
  const [dateOpen, setDateOpen] = useState(false);
  const [clipOpen, setClipOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const labelFor = (option: typeof DISPLAY_OPTIONS[number]) => {
    const label = t(option.labelKey as any);
    return label === option.labelKey ? option.fallback : label;
  };
  const iconFor = (value: DisplayMode) =>
    DISPLAY_OPTIONS.find((option) => option.value === value)?.icon ?? LayoutGrid;

  const showDate = tab !== HOME_TABS.LIVE_UPCOMING && isActive;
  const showClipLangs = tab === HOME_TABS.CLIPS && isActive;
  const showFilter = tab !== HOME_TABS.CLIPS;
  const selectedDate = toDate ? new Date(`${toDate}T12:00:00`) : undefined;

  const hasAny = showDate || showClipLangs || showFilter;

  return (
    <ButtonGroup className="shrink-0">
      {showDate ? (
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger
            render={
              <Toggle
                variant="outline"
                size="sm"
                pressed={dateOpen || !!toDate}
                aria-label={t("views.home.controls.pickDate")}
                title={t("views.home.controls.pickDate")}
              />
            }
          >
            <CalendarIcon className="size-3.5" />
            {toDate ? <span>{dayjs(selectedDate).format("MMM D")}</span> : null}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto p-0">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                onToDateChange(date ? dayjs(date).format("YYYY-MM-DD") : null);
                setDateOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      ) : null}

      {showClipLangs ? (
        <Popover open={clipOpen} onOpenChange={setClipOpen}>
          <PopoverTrigger
            render={
              <Toggle
                variant="outline"
                size="sm"
                pressed={clipOpen}
                aria-label={t("views.home.controls.clipLanguages")}
                title={t("views.home.controls.clipLanguages")}
              />
            }
          >
            <Languages className="size-3.5" />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[min(92vw,22rem)]">
            <div className="grid grid-cols-2 gap-2">
              {TL_LANGS.map((lang) => (
                <Toggle
                  key={`${lang.value}-clip`}
                  pressed={clipLangs.includes(lang.value)}
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  aria-label={lang.text}
                  onPressedChange={(pressed) => onToggleClipLang(lang.value, pressed)}
                >
                  <span className="truncate">{lang.text}</span>
                </Toggle>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      ) : null}

      {showFilter ? (
        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <PopoverTrigger
            render={
              <Toggle
                variant="outline"
                size="sm"
                pressed={filterOpen}
                aria-label={t("views.settings.filters.hideStreams")}
                title={t("views.settings.filters.hideStreams")}
              />
            }
          >
            <ListFilter className="size-3.5" />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[min(92vw,22rem)]">
            <VideoListFilters
              showDescriptions={false}
              compact
              sortBy={tab === HOME_TABS.LIVE_UPCOMING ? sortBy : undefined}
              onSortByChange={tab === HOME_TABS.LIVE_UPCOMING ? onSortByChange : undefined}
            />
          </PopoverContent>
        </Popover>
      ) : null}

      <Select value={displayMode} onValueChange={(value) => onDisplayModeChange(value as DisplayMode)}>
        <SelectTrigger
          size="sm"
          aria-label={t("views.home.controls.displayMode") || "Display mode"}
          className={hasAny ? "gap-1 px-2" : "gap-1 px-2"}
        >
          <SelectValue>
            {(value: DisplayMode) => {
              const Icon = iconFor(value);
              return <Icon className="size-3.5" />;
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="end" alignItemWithTrigger={false}>
          {DISPLAY_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <SelectItem key={option.value} value={option.value}>
                <Icon className="size-4" />
                <span>{labelFor(option)}</span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </ButtonGroup>
  );
}
