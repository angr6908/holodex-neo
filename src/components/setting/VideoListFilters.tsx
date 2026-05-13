"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { mdiBroom, mdiClose } from "@mdi/js";
import { api } from "@/lib/api";
import { readJSON, writeJSON } from "@/lib/storage";
import { useAppState } from "@/lib/store";
import { SelectCard } from "@/components/setting/SelectCard";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

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
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [topicSearch, setTopicSearch] = useState("");
  const [topicMenuOpen, setTopicMenuOpen] = useState(false);
  const topicInputRef = useRef<HTMLInputElement | null>(null);
  const topicMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { if (!topicFilter) return; setTopics(readJSON(TOPICS_STORAGE_KEY, [])); }, [topicFilter]);
  useEffect(() => { if (topicFilter) void fetchTopics(); }, [topicFilter]);

  useEffect(() => {
    if (!topicMenuOpen) return;
    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (topicInputRef.current?.contains(t) || topicMenuRef.current?.contains(t)) return;
      setTopicMenuOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") { setTopicMenuOpen(false); topicInputRef.current?.blur(); }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [topicMenuOpen]);

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

  const filteredTopics = useMemo(() => {
    const q = topicSearch.trim().toLowerCase();
    if (!q) return topics;
    return topics.filter((t) => t.value.toLowerCase().includes(q));
  }, [topics, topicSearch]);

  function getTopicMenuStyle(): React.CSSProperties {
    if (!topicInputRef.current) return {};
    const rect = topicInputRef.current.getBoundingClientRect();
    return { position: "fixed", top: rect.bottom + 6, left: rect.left, minWidth: rect.width, zIndex: 360 };
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
        <input
          ref={topicInputRef}
          type="text"
          value={topicSearch}
          placeholder="Search topics"
          disabled={topicsLoading}
          className="h-[var(--select-card-control-height)] min-w-0 flex-1 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-3 text-[0.8rem] text-[color:var(--color-foreground)] outline-none placeholder:text-[color:var(--color-muted-foreground)] focus:border-[color:var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-60"
          onChange={(e) => { setTopicSearch(e.target.value); setTopicMenuOpen(true); void fetchTopics(); }}
          onFocus={() => { setTopicMenuOpen(true); void fetchTopics(); }}
        />
        <Button type="button" variant="ghost" size="icon" className="select-card-clear-btn" disabled={ignoredTopics.length === 0} aria-label="Clear blocked topics" onClick={() => app.patchSettings({ ignoredTopics: [] })}><Icon icon={mdiBroom} className="h-4 w-4" /></Button>
      </div>
      {topicMenuOpen && typeof document !== "undefined" ? createPortal(
        <div
          ref={topicMenuRef}
          className="glass-panel ui-select-menu fixed z-[360] min-w-[max-content] overflow-hidden rounded-[calc(var(--radius)+6px)] border bg-[color:var(--color-card)] p-0"
          style={getTopicMenuStyle()}
        >
          <div className="ui-select-menu-scroll">
            <div className="scroll-area-viewport scroll-area-viewport-native h-full w-full overflow-x-hidden overflow-y-auto" style={{ maxHeight: 176 }}>
              <div className="scroll-area-content-native min-h-full min-w-full">
                {topicsLoading ? <div className="ui-select-empty">Loading…</div> : filteredTopics.length === 0 ? <div className="ui-select-empty">No topics found</div> : filteredTopics.map((topic) => (
                  <button
                    key={topic.value}
                    type="button"
                    className="ui-select-option flex w-full cursor-pointer items-center justify-between bg-transparent text-left text-[0.8rem] text-[color:var(--color-foreground)] transition-colors"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { toggleTopic(topic.value); setTopicSearch(""); setTopicMenuOpen(false); topicInputRef.current?.focus(); }}
                  >
                    <span className="truncate">{topic.value}</span>
                    {topic.count !== undefined ? <span className="stream-count-chip ml-3 inline-grid h-5 min-w-5 shrink-0 place-items-center rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-1.5 text-[10px] text-[color:var(--color-muted-foreground)]">{topic.count}</span> : null}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
      {ignoredTopics.length > 0 ? <div className="select-card-chip-flow">
        {ignoredTopics.map((topicValue) => <div key={topicValue} className="settings-check-chip settings-check-chip-selected select-card-chip-compact">
          <span className="select-card-chip-label">{topicValue}</span>
          <button type="button" className="select-card-chip-meta select-card-chip-remove select-card-chip-remove-btn" aria-label={`Remove ${topicValue}`} onClick={(e) => { e.stopPropagation(); toggleTopic(topicValue); }}><Icon icon={mdiClose} className="h-3 w-3" /></button>
        </div>)}
      </div> : null}
    </SelectCard> : null}

    {(liveFilter || upcomingFilter || collabFilter || placeholderFilter || missingFilter) ? <SelectCard title="Hide Streams">
      <div className="stream-check-grid grid grid-cols-2 gap-2" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
        {liveFilter ? chip({ checked: app.settings.hideLive, label: "Live", onChange: (v) => app.patchSettings({ hideLive: v }) }) : null}
        {upcomingFilter ? chip({ checked: app.settings.hideUpcoming, label: "Upcoming", onChange: (v) => app.patchSettings({ hideUpcoming: v }) }) : null}
        {collabFilter ? chip({ checked: app.settings.hideCollabStreams, label: "Collab", onChange: (v) => app.patchSettings({ hideCollabStreams: v }) }) : null}
        {placeholderFilter ? chip({ checked: app.settings.hidePlaceholderStreams, label: "Placeholder", onChange: (v) => app.patchSettings({ hidePlaceholderStreams: v }) }) : null}
        {missingFilter ? chip({ checked: app.settings.hideMissingStreams, label: "Missing", onChange: (v) => app.patchSettings({ hideMissingStreams: v }) }) : null}
      </div>
    </SelectCard> : null}
  </div>;
}
