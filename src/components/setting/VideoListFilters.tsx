"use client";

import { useEffect, useMemo, useState } from "react";
import { mdiClose } from "@mdi/js";
import { api } from "@/lib/api";
import { readJSON, writeJSON } from "@/lib/storage";
import { useAppState } from "@/lib/store";

const TOPICS_STORAGE_KEY = "holodex-topics-cache";
import { SelectCard } from "@/components/setting/SelectCard";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";


export function VideoListFilters({ topicFilter = true, collabFilter = true, placeholderFilter = true, missingFilter = true, showDescriptions = true, compact = false, className = "" }: any) {
  const app = useAppState();
  const [search, setSearch] = useState("");
  const [topics, setTopics] = useState<any[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);

  useEffect(() => { setTopics(readJSON(TOPICS_STORAGE_KEY, [])); }, []);
  useEffect(() => { if (topicFilter) void fetchTopics(); }, [topicFilter]);

  const ignoredTopics = app.settings.ignoredTopics || [];
  const filteredTopics = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = !query ? topics : topics.filter((topic) => `${topic.value}`.toLowerCase().includes(query));
    return [...filtered].sort((a, b) => Number(ignoredTopics.includes(b.value)) - Number(ignoredTopics.includes(a.value)) || `${a.value}`.localeCompare(`${b.value}`));
  }, [topics, search, ignoredTopics.join("\0")]);

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
      <input checked={checked} type="checkbox" className="peer sr-only" onChange={(e) => onChange(e.target.checked)} />
      <span className="stream-check-chip-indicator" />
      <span>{label}</span>
    </label>;
  }

  return <div className={cn("flex flex-col gap-3", compact ? "" : "max-h-[60vh] overflow-y-auto pr-1", className)}>
    {(collabFilter || placeholderFilter || missingFilter) ? <SelectCard title="Hide Streams">
      <div className="stream-check-grid">
        {collabFilter ? chip({ checked: app.settings.hideCollabStreams, label: "Collab Streams", onChange: (v) => app.patchSettings({ hideCollabStreams: v }) }) : null}
        {placeholderFilter ? chip({ checked: app.settings.hidePlaceholderStreams, label: "Placeholder Streams", onChange: (v) => app.patchSettings({ hidePlaceholderStreams: v }) }) : null}
        {missingFilter ? chip({ checked: app.settings.hideMissingStreams, label: "Missing Streams", onChange: (v) => app.patchSettings({ hideMissingStreams: v }) }) : null}
      </div>
    </SelectCard> : null}

    {topicFilter ? <SelectCard title="Blocked Topics" description={!showDescriptions ? "" : topicsLoading ? "Loading..." : "Videos with these topics are hidden from your home and favorites feeds."} showSearch searchValue={search} searchPlaceholder="Search topics" onSearchChange={setSearch} showClear clearDisabled={ignoredTopics.length === 0} clearAriaLabel="Clear blocked topics" onClear={() => app.patchSettings({ ignoredTopics: [] })}>
      {ignoredTopics.length > 0 ? <div className="select-card-chip-flow">
        {ignoredTopics.map((topicValue) => <div key={topicValue} className="settings-check-chip settings-check-chip-selected select-card-chip-compact">
          <span className="settings-check-chip-indicator" />
          <span className="select-card-chip-label">{topicValue}</span>
          <button type="button" className="select-card-chip-meta select-card-chip-remove select-card-chip-remove-btn" aria-label={`Remove ${topicValue}`} onClick={(e) => { e.stopPropagation(); toggleTopic(topicValue); }}><Icon icon={mdiClose} className="h-3 w-3" /></button>
        </div>)}
      </div> : null}
      <div className={cn("select-card-chip-flow overflow-y-auto pr-3", compact ? "h-32" : "h-72")} onFocus={fetchTopics as any}>
        {filteredTopics.map((topic) => <button key={topic.value} type="button" className={cn("settings-check-chip select-card-chip-compact", ignoredTopics.includes(topic.value) && "settings-check-chip-selected")} onClick={() => toggleTopic(topic.value)}>
          <span className="settings-check-chip-indicator" />
          <span className="select-card-chip-label truncate">{topic.value}</span>
          {topic.count !== undefined ? <Badge className="select-card-chip-meta select-card-chip-count">{topic.count}</Badge> : null}
        </button>)}
      </div>
      {!topicsLoading && topics.length && filteredTopics.length === 0 ? <span className="text-xs text-[color:var(--color-muted-foreground)]">No topics found</span> : null}
    </SelectCard> : null}
  </div>;
}
