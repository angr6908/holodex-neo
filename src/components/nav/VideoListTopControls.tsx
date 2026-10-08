"use client";

import dayjs from "dayjs";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Toggle } from "@/components/ui/toggle";
import { VideoListFilters } from "@/components/video/VideoListFilters";
import { TL_LANGS } from "@/lib/consts";
import { HOME_TABS } from "@/lib/cookie-codec";
import type { DisplayMode } from "@/lib/display-mode";
import {
  type AnyIcon,
  Calendar as CalendarIcon,
  Check,
  Grid2x2,
  Languages,
  LayoutDashboard,
  LayoutGrid,
  List,
  ListFilter,
  Rows3,
} from "@/lib/icons";
import { loadCalendar } from "@/lib/lazy";

// The date picker (react-day-picker) loads with its popover.
const Calendar = dynamic(() => loadCalendar().then((m) => m.Calendar), { ssr: false });

// Nav buttons dip on press even when they open a popup (the Button base skips aria-haspopup).
const NAV_BUTTON_PRESS_CLASS = "active:translate-y-px";

const DISPLAY_OPTIONS: { value: DisplayMode; icon: AnyIcon; labelKey: string; fallback: string }[] =
  [
    {
      value: "grid-0",
      icon: LayoutGrid,
      labelKey: "views.settings.gridSize.0",
      fallback: "Large grid",
    },
    {
      value: "grid-1",
      icon: LayoutDashboard,
      labelKey: "views.settings.gridSize.1",
      fallback: "Medium grid",
    },
    {
      value: "grid-2",
      icon: Grid2x2,
      labelKey: "views.settings.gridSize.2",
      fallback: "Small grid",
    },
    { value: "list", icon: List, labelKey: "views.home.controls.list", fallback: "List" },
    {
      value: "denseList",
      icon: Rows3,
      labelKey: "views.home.controls.denseList",
      fallback: "Dense list",
    },
  ];

function DisplayModeIcon({ displayMode }: { displayMode: DisplayMode }) {
  const Icon = (
    DISPLAY_OPTIONS.find((option) => option.value === displayMode) ?? DISPLAY_OPTIONS[0]
  ).icon;
  return <Icon className="size-4" />;
}

// The display modes as a checked menu; picking one applies it and closes the menu.
function DisplayModeMenu({
  displayMode,
  onSelect,
}: {
  displayMode: DisplayMode;
  onSelect: (value: DisplayMode) => void;
}) {
  const t = useTranslations();
  const labelFor = (option: (typeof DISPLAY_OPTIONS)[number]) => {
    const label = t(option.labelKey as any);
    return label === option.labelKey ? option.fallback : label;
  };
  return DISPLAY_OPTIONS.map((option) => {
    const Icon = option.icon;
    return (
      <button
        key={option.value}
        type="button"
        onClick={() => onSelect(option.value)}
        className="relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
      >
        <Icon className="size-4" />
        <span className="flex-1 text-left whitespace-nowrap">{labelFor(option)}</span>
        {displayMode === option.value ? <Check className="absolute right-2 size-4" /> : null}
      </button>
    );
  });
}

function ClipLangToggles({
  clipLangs,
  onToggleClipLang,
}: {
  clipLangs: string[];
  onToggleClipLang: (value: string, checked: boolean) => void;
}) {
  return (
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
  );
}

// Outline nav button that opens one of the list's control popovers.
function controlTrigger(label: string, selected: boolean) {
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className={NAV_BUTTON_PRESS_CLASS}
      pressHighlight
      selected={selected}
      aria-pressed={selected}
      aria-label={label}
      title={label}
    />
  );
}

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
  const [displayOpen, setDisplayOpen] = useState(false);
  const showDate = tab !== HOME_TABS.LIVE_UPCOMING && isActive;
  const showClipLangs = tab === HOME_TABS.CLIPS && isActive;
  const selectedDate = toDate ? new Date(`${toDate}T12:00:00`) : undefined;
  // Sorting only applies to the live/upcoming list.
  const sortProps = tab === HOME_TABS.LIVE_UPCOMING ? { sortBy, onSortByChange } : {};
  const dateSelected = dateOpen || !!toDate;
  const displayLabel = t("views.home.controls.displayMode") || "Display mode";

  return (
    <ButtonGroup className="shrink-0">
      {tab !== HOME_TABS.CLIPS ? (
        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <PopoverTrigger
            render={controlTrigger(t("views.settings.filters.hideStreams"), filterOpen)}
          >
            <ListFilter className="size-4" />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[min(92vw,22rem)]">
            <VideoListFilters showDescriptions={false} compact {...sortProps} />
          </PopoverContent>
        </Popover>
      ) : null}

      {showClipLangs ? (
        <Popover open={clipOpen} onOpenChange={setClipOpen}>
          <PopoverTrigger render={controlTrigger(t("views.home.controls.clipLanguages"), clipOpen)}>
            <Languages className="size-4" />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[min(92vw,22rem)]">
            <ClipLangToggles clipLangs={clipLangs} onToggleClipLang={onToggleClipLang} />
          </PopoverContent>
        </Popover>
      ) : null}

      {showDate ? (
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger render={controlTrigger(t("views.home.controls.pickDate"), dateSelected)}>
            <CalendarIcon className="size-4" />
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

      <Popover open={displayOpen} onOpenChange={setDisplayOpen}>
        <PopoverTrigger render={controlTrigger(displayLabel, displayOpen)}>
          <DisplayModeIcon displayMode={displayMode} />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto min-w-36 gap-0 p-1">
          <DisplayModeMenu
            displayMode={displayMode}
            onSelect={(value) => {
              onDisplayModeChange(value);
              setDisplayOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </ButtonGroup>
  );
}
