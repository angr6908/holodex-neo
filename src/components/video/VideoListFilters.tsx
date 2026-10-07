"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo } from "react";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import { Toggle } from "@/components/ui/toggle";
import { type AnyIcon, Clock, Eye } from "@/lib/icons";
import { useAppState } from "@/lib/store";
import { useTopicsCache } from "@/lib/topics";
import { cn } from "@/lib/utils";

type VideoListFiltersProps = {
  topicFilter?: boolean;
  liveFilter?: boolean;
  upcomingFilter?: boolean;
  collabFilter?: boolean;
  placeholderFilter?: boolean;
  missingFilter?: boolean;
  showDescriptions?: boolean;
  compact?: boolean;
  className?: string;
  sortBy?: string;
  onSortByChange?: (value: string) => void;
};

const SORT_OPTIONS: { value: string; icon: AnyIcon; labelKey: string }[] = [
  { value: "viewers", icon: Eye, labelKey: "views.home.controls.viewers" },
  { value: "latest", icon: Clock, labelKey: "views.home.controls.latest" },
];

const SECTION_LABEL_CLASS =
  "text-[0.68rem] font-normal uppercase tracking-[0.16em] text-muted-foreground";

function FilterChip({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <Toggle
      pressed={checked}
      variant="outline"
      className="w-full justify-start"
      aria-label={label}
      onPressedChange={onChange}
    >
      <span className="truncate">{label}</span>
    </Toggle>
  );
}

function SortOptions({
  sortBy,
  onSortByChange,
}: {
  sortBy: string;
  onSortByChange: (value: string) => void;
}) {
  const t = useTranslations();
  return (
    <div className="flex flex-col gap-[0.45rem]">
      <span className={SECTION_LABEL_CLASS}>{t("views.home.controls.sortBy")}</span>
      <div className="grid grid-cols-2 gap-2">
        {SORT_OPTIONS.map((option) => {
          const Icon = option.icon;
          const label = t(option.labelKey as any);
          return (
            <Toggle
              key={option.value}
              pressed={sortBy === option.value}
              variant="outline"
              className="w-full justify-start"
              aria-label={label}
              onPressedChange={() => onSortByChange(option.value)}
            >
              <Icon className="size-4" />
              <span className="truncate">{label}</span>
            </Toggle>
          );
        })}
      </div>
    </div>
  );
}

// Topics to hide, picked from the (lazily fetched) topic list.
function TopicFilter({ showDescriptions }: { showDescriptions: boolean }) {
  const app = useAppState();
  const t = useTranslations();
  const { topics, topicsLoading, fetchTopics } = useTopicsCache();
  const topicComboboxAnchor = useComboboxAnchor();

  useEffect(() => {
    void fetchTopics();
  }, [fetchTopics]);

  const ignoredTopics = app.settings.ignoredTopics || [];
  const topicValues = useMemo(() => topics.map((topic) => topic.value), [topics]);
  const loadingText = t("component.search.loading");

  function updateIgnoredTopics(values: string[]) {
    app.patchSettings({ ignoredTopics: [...new Set(values)].sort() });
  }

  return (
    <div className="flex flex-col gap-[0.45rem]">
      <div className="space-y-1">
        <div className={SECTION_LABEL_CLASS}>{t("views.settings.filters.blockedTopics")}</div>
        {showDescriptions ? (
          <div className="text-xs text-muted-foreground">
            {topicsLoading ? loadingText : t("views.settings.filters.blockedTopicsDescription")}
          </div>
        ) : null}
      </div>
      <Combobox
        multiple
        items={topicValues}
        value={ignoredTopics}
        onOpenChange={(open) => {
          if (open) void fetchTopics();
        }}
        onValueChange={updateIgnoredTopics}
      >
        <ComboboxChips ref={topicComboboxAnchor}>
          {ignoredTopics.map((topicValue) => (
            <ComboboxChip key={topicValue}>{topicValue}</ComboboxChip>
          ))}
          <ComboboxChipsInput
            placeholder={
              ignoredTopics.length
                ? undefined
                : topicsLoading
                  ? loadingText
                  : t("views.settings.filters.searchTopics")
            }
            onFocus={() => {
              void fetchTopics();
            }}
          />
        </ComboboxChips>
        <ComboboxContent anchor={topicComboboxAnchor}>
          <ComboboxEmpty>
            {topicsLoading ? loadingText : t("component.search.noTopicsFound")}
          </ComboboxEmpty>
          <ComboboxList>
            {(topicValue: string, index: number) => (
              <ComboboxItem key={topicValue} value={topicValue} index={index}>
                {topicValue}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}

const HIDE_FILTERS = [
  { prop: "liveFilter", setting: "hideLive", labelKey: "views.home.liveLabel" },
  { prop: "upcomingFilter", setting: "hideUpcoming", labelKey: "views.home.upcomingLabel" },
  {
    prop: "collabFilter",
    setting: "hideCollabStreams",
    labelKey: "views.settings.filters.collab",
  },
  {
    prop: "placeholderFilter",
    setting: "hidePlaceholder",
    labelKey: "views.settings.filters.placeholder",
  },
  { prop: "missingFilter", setting: "hideMissing", labelKey: "views.settings.filters.missing" },
] as const;

type HideFilterProp = (typeof HIDE_FILTERS)[number]["prop"];

// Toggles for the kinds of streams to hide; `shown` picks which toggles appear.
function HideStreamFilters({ shown }: { shown: Record<HideFilterProp, boolean> }) {
  const app = useAppState();
  const t = useTranslations();
  return (
    <div className="flex flex-col gap-[0.45rem]">
      <span className={SECTION_LABEL_CLASS}>{t("views.settings.filters.hideStreams")}</span>
      <div className="grid grid-cols-2 gap-2">
        {HIDE_FILTERS.filter((filter) => shown[filter.prop]).map((filter) => (
          <FilterChip
            key={filter.prop}
            checked={app.settings[filter.setting]}
            label={t(filter.labelKey)}
            onChange={(v) => app.patchSettings({ [filter.setting]: v })}
          />
        ))}
      </div>
    </div>
  );
}

export function VideoListFilters({
  topicFilter = true,
  liveFilter = true,
  upcomingFilter = true,
  collabFilter = true,
  placeholderFilter = true,
  missingFilter = true,
  showDescriptions = true,
  compact = false,
  className = "",
  sortBy,
  onSortByChange,
}: VideoListFiltersProps) {
  const shown = { liveFilter, upcomingFilter, collabFilter, placeholderFilter, missingFilter };
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        compact ? "" : "max-h-[60vh] overflow-y-auto pr-1",
        className,
      )}
    >
      {sortBy !== undefined && onSortByChange !== undefined ? (
        <SortOptions sortBy={sortBy} onSortByChange={onSortByChange} />
      ) : null}
      {topicFilter ? <TopicFilter showDescriptions={showDescriptions} /> : null}
      {Object.values(shown).some(Boolean) ? <HideStreamFilters shown={shown} /> : null}
    </div>
  );
}
