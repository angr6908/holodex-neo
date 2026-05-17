"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash } from "@/lib/icons";
import { api } from "@/lib/api";
import { readJSON, writeJSON } from "@/lib/browser";
import { useAppState } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Combobox, ComboboxChip, ComboboxChips, ComboboxChipsInput, ComboboxContent, ComboboxEmpty, ComboboxItem, ComboboxList, useComboboxAnchor } from "@/components/ui/combobox";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
const TOPICS_STORAGE_KEY = "holodex-topics-cache";

type TopicOption = { value: string; count?: number };

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
};

export function VideoListFilters({ topicFilter = true, liveFilter = true, upcomingFilter = true, collabFilter = true, placeholderFilter = true, missingFilter = true, showDescriptions = true, compact = false, className = "" }: VideoListFiltersProps) {
  const app = useAppState();
  const t = useTranslations();
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const topicComboboxAnchor = useComboboxAnchor();

  useEffect(() => { if (!topicFilter) return; setTopics(readJSON(TOPICS_STORAGE_KEY, [])); }, [topicFilter]);
  useEffect(() => { if (topicFilter) void fetchTopics(); }, [topicFilter]);

  const ignoredTopics = app.settings.ignoredTopics || [];
  const topicValues = useMemo(() => topics.map((topic) => topic.value), [topics]);
  const topicCounts = useMemo(() => new Map(topics.map((topic) => [topic.value, topic.count])), [topics]);

  async function fetchTopics() {
    if (topics.length || topicsLoading) return;
    setTopicsLoading(true);
    try {
      const { data }: any = await api.topics();
      const next = (data || []).map(({ id, count }: any) => ({ value: id, count }));
      setTopics(next);
      writeJSON(TOPICS_STORAGE_KEY, next);
    } finally { setTopicsLoading(false); }
  }

  function updateIgnoredTopics(values: string[]) {
    app.patchSettings({ ignoredTopics: [...new Set(values)].sort() });
  }

  function chip({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
    return <Toggle pressed={checked} variant="outline" className="w-full justify-start" aria-label={label} onPressedChange={onChange}>
      <span className="truncate">{label}</span>
    </Toggle>;
  }

  return <div className={cn("flex flex-col gap-3", compact ? "" : "max-h-[60vh] overflow-y-auto pr-1", className)}>
	    {topicFilter ? <div className="flex flex-col gap-[0.45rem]">
	      <div className="space-y-1">
	        <div className="text-[0.68rem] font-normal uppercase tracking-[0.16em] text-muted-foreground">{t("views.settings.filters.blockedTopics")}</div>
	        {showDescriptions ? (
	          <div className="text-xs text-muted-foreground">
	            {topicsLoading ? t("component.search.loading") : t("views.settings.filters.blockedTopicsDescription")}
	          </div>
	        ) : null}
      </div>
      <Combobox
        multiple
        items={topicValues}
        value={ignoredTopics}
        onOpenChange={(open) => { if (open) void fetchTopics(); }}
        onValueChange={updateIgnoredTopics}
      >
        <div className="flex items-start gap-2">
          <ComboboxChips ref={topicComboboxAnchor} className="min-h-10 flex-1">
            {ignoredTopics.map((topicValue) => (
              <ComboboxChip key={topicValue}>{topicValue}</ComboboxChip>
	            ))}
	            <ComboboxChipsInput
	              placeholder={topicsLoading ? t("component.search.loading") : t("views.settings.filters.searchTopics")}
	              onFocus={() => { void fetchTopics(); }}
	            />
	          </ComboboxChips>
	          <Button type="button" variant="ghost" size="icon" className="size-10 shrink-0" disabled={ignoredTopics.length === 0} aria-label={t("views.settings.filters.clearBlockedTopics")} onClick={() => updateIgnoredTopics([])}><Trash className="h-4 w-4" /></Button>
	        </div>
	        <ComboboxContent anchor={topicComboboxAnchor}>
	          <ComboboxEmpty>{topicsLoading ? t("component.search.loading") : t("component.search.noTopicsFound")}</ComboboxEmpty>
          <ComboboxList>
            {(topicValue: string, index: number) => {
              const count = topicCounts.get(topicValue);
              return (
                <ComboboxItem key={topicValue} value={topicValue} index={index}>
                  <span className="truncate">{topicValue}</span>
                  {count !== undefined ? <span className="ml-auto text-xs text-muted-foreground">{count}</span> : null}
                </ComboboxItem>
              );
            }}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div> : null}

	    {(liveFilter || upcomingFilter || collabFilter || placeholderFilter || missingFilter) ? <div className="flex flex-col gap-[0.45rem]">
	      <span className="text-[0.68rem] font-normal uppercase tracking-[0.16em] text-muted-foreground">{t("views.settings.filters.hideStreams")}</span>
	      <div className="grid grid-cols-2 gap-2">
	        {liveFilter ? chip({ checked: app.settings.hideLive, label: t("views.home.liveLabel"), onChange: (v) => app.patchSettings({ hideLive: v }) }) : null}
	        {upcomingFilter ? chip({ checked: app.settings.hideUpcoming, label: t("views.home.upcomingLabel"), onChange: (v) => app.patchSettings({ hideUpcoming: v }) }) : null}
	        {collabFilter ? chip({ checked: app.settings.hideCollabStreams, label: t("views.settings.filters.collab"), onChange: (v) => app.patchSettings({ hideCollabStreams: v }) }) : null}
	        {placeholderFilter ? chip({ checked: app.settings.hidePlaceholder, label: t("views.settings.filters.placeholder"), onChange: (v) => app.patchSettings({ hidePlaceholder: v }) }) : null}
	        {missingFilter ? chip({ checked: app.settings.hideMissing, label: t("views.settings.filters.missing"), onChange: (v) => app.patchSettings({ hideMissing: v }) }) : null}
	      </div>
	    </div> : null}
  </div>;
}
