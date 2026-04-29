"use client";

import { useEffect, useState } from "react";
import { mdiBroom, mdiClose } from "@mdi/js";
import { api } from "@/lib/api";
import { readJSON, writeJSON } from "@/lib/storage";
import { useAppState } from "@/lib/store";
import { Select } from "@/components/ui/Select";
import { SelectCard } from "@/components/setting/SelectCard";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

const TOPICS_STORAGE_KEY = "holodex-topics-cache";

type TopicOption = { value: string; count?: number };

type VideoListFiltersProps = {
  topicFilter?: boolean;
  collabFilter?: boolean;
  placeholderFilter?: boolean;
  missingFilter?: boolean;
  showDescriptions?: boolean;
  compact?: boolean;
  className?: string;
};

export function VideoListFilters({ topicFilter = true, collabFilter = true, placeholderFilter = true, missingFilter = true, showDescriptions = true, compact = false, className = "" }: VideoListFiltersProps) {
  const app = useAppState();
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);

  useEffect(() => { if (!topicFilter) return; setTopics(readJSON(TOPICS_STORAGE_KEY, [])); }, [topicFilter]);
  useEffect(() => { if (topicFilter) void fetchTopics(); }, [topicFilter]);

  const ignoredTopics = app.settings.ignoredTopics || [];
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
  function toggleTopic(topicValue: string) {
    const next = new Set(ignoredTopics);
    if (next.has(topicValue)) next.delete(topicValue); else next.add(topicValue);
    app.patchSettings({ ignoredTopics: [...next].sort() });
  }
  function chip({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
    return <label className={cn("stream-check-chip", checked && "stream-check-chip-selected")}>
      <input checked={checked} type="checkbox" className="sr-only" onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>;
  }

  return <div className={cn("flex flex-col gap-3", compact ? "" : "max-h-[60vh] overflow-y-auto pr-1", className)}>
    {topicFilter ? <SelectCard title="Blocked Topics" description={!showDescriptions ? "" : topicsLoading ? "Loading..." : "Videos with these topics are hidden from your home and favorites feeds."}>
      <div className="select-card-controls">
        <Select
          value=""
          options={topics}
          labelKey="value"
          valueKey="value"
          placeholder="Search topics"
          searchable
          searchPlaceholder="Search topics"
          disabled={topicsLoading}
          className="h-[var(--select-card-control-height)]"
          placement="bottom"
          menuMaxHeight={176}
          onOpenChange={(open) => { if (open) void fetchTopics(); }}
          onChange={(value) => toggleTopic(value)}
          renderTrigger={() => <span className="truncate text-[color:var(--color-muted-foreground)]">Search topics</span>}
          renderOption={({ option }) => <>
            <span className="truncate">{option.value}</span>
            {option.count !== undefined ? <span className="stream-count-chip ml-3 inline-grid h-5 min-w-5 shrink-0 place-items-center rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-1.5 text-[10px] text-[color:var(--color-muted-foreground)]">{option.count}</span> : null}
          </>}
        />
        <Button type="button" variant="ghost" size="icon" className="select-card-clear-btn" disabled={ignoredTopics.length === 0} aria-label="Clear blocked topics" onClick={() => app.patchSettings({ ignoredTopics: [] })}><Icon icon={mdiBroom} className="h-4 w-4" /></Button>
      </div>
      {ignoredTopics.length > 0 ? <div className="select-card-chip-flow">
        {ignoredTopics.map((topicValue) => <div key={topicValue} className="settings-check-chip settings-check-chip-selected select-card-chip-compact">
          <span className="select-card-chip-label">{topicValue}</span>
          <button type="button" className="select-card-chip-meta select-card-chip-remove select-card-chip-remove-btn" aria-label={`Remove ${topicValue}`} onClick={(e) => { e.stopPropagation(); toggleTopic(topicValue); }}><Icon icon={mdiClose} className="h-3 w-3" /></button>
        </div>)}
      </div> : null}
    </SelectCard> : null}

    {(collabFilter || placeholderFilter || missingFilter) ? <SelectCard title="Hide Streams">
      <div className="stream-check-grid">
        {collabFilter ? chip({ checked: app.settings.hideCollabStreams, label: "Collab Streams", onChange: (v) => app.patchSettings({ hideCollabStreams: v }) }) : null}
        {placeholderFilter ? chip({ checked: app.settings.hidePlaceholderStreams, label: "Placeholder Streams", onChange: (v) => app.patchSettings({ hidePlaceholderStreams: v }) }) : null}
        {missingFilter ? chip({ checked: app.settings.hideMissingStreams, label: "Missing Streams", onChange: (v) => app.patchSettings({ hideMissingStreams: v }) }) : null}
        {missingFilter ? chip({ checked: app.settings.hideUpcoming, label: "Upcoming Streams", onChange: (v) => app.patchSettings({ hideUpcoming: v }) }) : null}
      </div>
    </SelectCard> : null}
  </div>;
}
