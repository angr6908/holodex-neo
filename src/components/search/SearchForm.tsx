"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { mdiBroom, mdiCheck, mdiChevronDown, mdiClose, mdiMagnify } from "@mdi/js";
import { api } from "@/lib/api";
import { getChannelPhoto } from "@/lib/functions";
import { useI18n } from "@/lib/i18n";
import { HomeOrgMultiSelect } from "@/components/common/HomeOrgMultiSelect";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

type SearchOption = { text: string; value: string; query_value?: Record<string, any> };

export function SearchForm({
  sortBy = "newest",
  typeValue = "all",
  sortOptions = [],
  typeOptions = [],
  onSortByChange,
  onTypeValueChange,
}: {
  sortBy?: string;
  typeValue?: string;
  sortOptions?: SearchOption[];
  typeOptions?: SearchOption[];
  onSortByChange?: (value: string) => void;
  onTypeValueChange?: (value: string) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const orgFieldWrapper = useRef<HTMLDivElement | null>(null);
  const channelPanelRoot = useRef<HTMLDivElement | null>(null);
  const channelInput = useRef<HTMLInputElement | null>(null);
  const [selectedOrgs, setSelectedOrgs] = useState<string[]>([]);
  const [topic, setTopic] = useState("");
  const [comment, setComment] = useState("");
  const [title, setTitle] = useState("");
  const [channels, setChannels] = useState<any[]>([]);
  const [channelPanelOpen, setChannelPanelOpen] = useState(false);
  const [channelResults, setChannelResults] = useState<any[]>([]);
  const [channelSearch, setChannelSearch] = useState("");
  const [topics, setTopics] = useState<any[]>([]);

  const topicOptions = useMemo(() => [{ value: "", text: "Any topic" }, ...topics], [topics]);
  const selectedValues = useMemo(() => new Set(channels.map((item) => item.value)), [channels]);
  const selectedTexts = useMemo(() => new Set(channels.map((item) => `${item.text}`.toLowerCase())), [channels]);
  const channelSuggestions = useMemo(() => {
    const seen = new Set();
    const suggestions: any[] = [];
    channelResults.forEach((item) => {
      const value = item.value || item.text;
      const text = item.text || item.value;
      if (!value || !text || selectedValues.has(value)) return;
      if (selectedTexts.has(`${text}`.toLowerCase())) return;
      if (seen.has(value)) return;
      seen.add(value);
      suggestions.push({ type: "channel", value, text, fromApi: true });
    });
    return suggestions;
  }, [channelResults, selectedValues, selectedTexts]);
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!channelSearch) {
        setChannelResults([]);
        return;
      }
      try {
        const res: any = await api.searchAutocomplete(channelSearch);
        const data = (res.data || []).map((x: any) => ({ ...x, text: x.text || x.value })).filter((x: any) => x.type === "channel");
        setChannelResults(data);
      } catch {
        setChannelResults([]);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [channelSearch]);

  useEffect(() => {
    api.topics().then(({ data }: any) => setTopics((data || []).map(({ id, count }: { id: string; count: number }) => ({ value: id, text: id, count })))).catch(() => setTopics([]));
  }, []);

  useEffect(() => {
    const q = searchParams.get("q");
    void processQuery(q || "");
  }, [searchParams]);

  useEffect(() => {
    function handleWindowPointerDown(event: PointerEvent) {
      if (!channelPanelOpen) return;
      if (channelPanelRoot.current && !channelPanelRoot.current.contains(event.target as Node)) setChannelPanelOpen(false);
    }
    function updateOrgPanelPosition() {
      const el = orgFieldWrapper.current;
      if (el) el.style.setProperty("--org-field-left", `${el.getBoundingClientRect().left}px`);
    }
    window.addEventListener("pointerdown", handleWindowPointerDown);
    window.addEventListener("resize", updateOrgPanelPosition);
    updateOrgPanelPosition();
    return () => {
      window.removeEventListener("pointerdown", handleWindowPointerDown);
      window.removeEventListener("resize", updateOrgPanelPosition);
    };
  }, [channelPanelOpen]);

  function topicSearchFilter(option: any, query: string) {
    return (option.text || option.value || "").toLowerCase().includes(query);
  }

  async function processQuery(q: string) {
    let queryArray: any[] = [];
    if (q) {
      const { csv2json } = await import("json-2-csv");
      try { queryArray = await csv2json(q); } catch { queryArray = []; }
    }
    const topicOpt = queryArray.find((v) => v.type === "topic");
    setTopic(topicOpt?.value || "");
    setChannels(queryArray.filter((v) => v.type === "channel"));
    const titleOpt = queryArray.find((v) => v.type === "title & desc");
    setTitle(titleOpt?.text || "");
    const commentOpt = queryArray.find((v) => v.type === "comments");
    setComment(commentOpt?.text || "");
    const orgOpts = queryArray.filter((v) => v.type === "org");
    setSelectedOrgs(orgOpts.map((v) => v.value));
  }

  function openChannelInput() {
    setChannelPanelOpen(true);
    setTimeout(() => channelInput.current?.focus(), 0);
  }

  function addFirstChannelSuggestion() {
    if (channelSuggestions.length > 0) addChannelCandidate(channelSuggestions[0]);
    else if (channelSearch.trim()) addChannelCandidate(null);
  }

  function handleChannelBackspace() {
    if (channelSearch === "" && channels.length > 0) setChannels((value) => value.slice(0, -1));
  }

  function addChannelCandidate(candidate: any) {
    if (candidate && candidate.value) {
      setChannels((value) => value.find((item) => item.value === candidate.value) ? value : [...value, { type: "channel", value: candidate.value, text: candidate.text || candidate.value }]);
      setChannelSearch("");
      setChannelResults([]);
      return;
    }
    const search = (channelSearch || "").trim();
    if (!search) return;
    const existing = channelResults.find((item) => item.text === search || item.value === search) || { type: "channel", value: search, text: search };
    setChannels((value) => value.find((item) => item.value === existing.value) ? value : [...value, existing]);
    setChannelSearch("");
    setChannelResults([]);
  }

  function removeChannel(value: string) {
    setChannels((current) => current.filter((item) => item.value !== value));
  }

  function clearAll() {
    setSelectedOrgs([]);
    setTopic("");
    setComment("");
    setTitle("");
    setChannels([]);
    setChannelSearch("");
    setChannelResults([]);
  }

  async function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const reconstruction: any[] = [];
    if (selectedOrgs) selectedOrgs.forEach((org) => reconstruction.push({ type: "org", value: `${org}`, text: org }));
    if (topic) reconstruction.push({ type: "topic", value: `${topic}`, text: topic });
    if (channels) reconstruction.push(...channels);
    if (title) reconstruction.push({ type: "title & desc", value: `${title}title & desc`, text: title });
    if (comment) reconstruction.push({ type: "comments", value: `${comment}comments`, text: comment });
    const { json2csv } = await import("json-2-csv");
    const params = new URLSearchParams(searchParams.toString());
    params.set("q", await json2csv(reconstruction));
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <form className="search-form-wrapper" onSubmit={submitSearch}>
      <div className="search-inline-grid">
        <div ref={orgFieldWrapper} className="search-inline-field">
          <span className="search-inline-label">{t("component.search.type.org")}</span>
          <HomeOrgMultiSelect className="search-inline-org-select" inline manualApply selectedNamesOverride={selectedOrgs} fallbackSelection={[]} buttonClass="h-10 w-full justify-between rounded-xl px-3 font-normal" onApply={setSelectedOrgs} />
        </div>

        <label className="search-inline-field">
          <span className="search-inline-label">{t("views.search.typeDropdownLabel")}</span>
          <Select value={typeValue} options={typeOptions} labelKey="text" valueKey="value" className="h-10" fluid onChange={(value) => onTypeValueChange?.(value)} />
        </label>

        <label className="search-inline-field">
          <span className="search-inline-label">{t("component.search.type.topic")}</span>
          <Select value={topic} options={topicOptions} labelKey="text" valueKey="value" className="h-10" fluid searchable searchPlaceholder="Search topic" searchFilterFn={topicSearchFilter} onChange={setTopic} renderOption={({ option, selected }: any) => (
            <>
              <span className="truncate">{option.text}</span>
              {option.count !== undefined ? <span className="search-topic-count">{option.count}</span> : null}
              {selected ? <Icon icon={mdiCheck} size="sm" className="ml-auto shrink-0 text-[color:var(--color-foreground)]" /> : null}
            </>
          )} />
        </label>

        <div className="search-inline-field">
          <span className="search-inline-label">{t("component.search.type.channel")}</span>
          <div ref={channelPanelRoot} className={cn("search-channel-combobox", channelPanelOpen && "search-channel-combobox-open")} onClick={openChannelInput}>
            <div className="search-channel-inner">
              {!channelPanelOpen ? channels.map((channel) => (
                <span key={channel.value} className="search-channel-chip">
                  <span className="search-channel-chip-text">{channel.text}</span>
                  <button type="button" className="search-channel-chip-remove" aria-label={`Remove ${channel.text}`} onClick={(event) => { event.stopPropagation(); removeChannel(channel.value); }}>
                    <Icon icon={mdiClose} size="xs" />
                  </button>
                </span>
              )) : null}
              <input ref={channelInput} value={channelSearch} className="search-channel-text-input" placeholder="" autoComplete="off" onChange={(event) => setChannelSearch(event.target.value)} onFocus={() => setChannelPanelOpen(true)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addFirstChannelSuggestion(); } else if (event.key === "Escape") setChannelPanelOpen(false); else if (event.key === "Backspace") handleChannelBackspace(); }} />
            </div>
            <span className="search-channel-chevron"><Icon icon={mdiChevronDown} size="sm" className={cn("shrink-0 transition-transform", channelPanelOpen && "rotate-180")} /></span>

            {channelPanelOpen ? (
              <div className="search-channel-panel">
                {channels.length ? (
                  <div className={cn("search-channel-selected-section", !channelSuggestions.length && "search-channel-selected-no-divider")}>
                    {channels.map((channel) => (
                      <span key={`sel-${channel.value}`} className="search-channel-selected-tag">
                        {channel.value && channel.value.length > 10 ? <img src={getChannelPhoto(channel.value)} className="search-channel-tag-avatar" loading="lazy" onError={(event) => { (event.currentTarget as HTMLImageElement).style.display = "none"; }} alt="" /> : null}
                        <span className="search-channel-tag-text">{channel.text}</span>
                        <button type="button" className="search-channel-tag-remove" onMouseDown={(event) => { event.preventDefault(); removeChannel(channel.value); }}><Icon icon={mdiClose} size="xs" /></button>
                      </span>
                    ))}
                  </div>
                ) : null}
                {channelSuggestions.length ? (
                  <div className="search-channel-suggestions">
                    {channelSuggestions.map((item) => (
                      <button key={item.value} type="button" className="search-channel-suggestion" onMouseDown={(event) => { event.preventDefault(); addChannelCandidate(item); }}>
                        {item.value && item.value.length > 10 ? <img src={getChannelPhoto(item.value)} className="search-channel-suggestion-avatar" loading="lazy" onError={(event) => { (event.currentTarget as HTMLImageElement).style.display = "none"; }} alt="" /> : <svg viewBox="0 0 24 24" className="search-channel-suggestion-icon fill-current"><path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5z" /></svg>}
                        <span className="search-channel-suggestion-text">{item.text}</span>
                      </button>
                    ))}
                  </div>
                ) : channelSearch.trim().length > 0 ? <div className="search-channel-empty">No channels found</div> : !channels.length ? <div className="search-channel-empty">Type to search channels</div> : null}
              </div>
            ) : null}
          </div>
        </div>

        <label className="search-inline-field">
          <span className="search-inline-label">{t("component.search.type.titledesc")}</span>
          <Input value={title} disabled={!!comment} placeholder="" className="h-10" onChange={(event) => setTitle(event.target.value)} />
        </label>

        <label className="search-inline-field">
          <span className="search-inline-label">{t("component.search.type.comments")}</span>
          <Input value={comment} disabled={!!title} placeholder="" className="h-10" onChange={(event) => setComment(event.target.value)} />
        </label>

        <label className="search-inline-field">
          <span className="search-inline-label">{t("views.search.sortByLabel")}</span>
          <Select value={sortBy} options={sortOptions} labelKey="text" valueKey="value" className="h-10" fluid onChange={(value) => onSortByChange?.(value)} />
        </label>

        <div className="search-inline-actions">
          <button type="submit" className="search-btn-submit" title={t("views.search.searchBtn") || "Search"}>
            <Icon icon={mdiMagnify} size="sm" />
            <span className="sr-only">{t("views.search.searchBtn") || "Search"}</span>
          </button>
          <button type="button" className="search-btn-reset" title="Reset filters" onClick={clearAll}>
            <Icon icon={mdiBroom} size="sm" />
            <span className="sr-only">Reset</span>
          </button>
        </div>
      </div>
    </form>
  );
}
