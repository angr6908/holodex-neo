"use client";

import { Building2, CornerDownLeft, Hash, PlayCircle, Search, Tv, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { api } from "@/lib/api";
import { ALL_VTUBERS_ORG, CHANNEL_URL_REGEX, VIDEO_URL_REGEX } from "@/lib/consts";
import { formatOrgDisplayName } from "@/lib/functions";
import { Building } from "@/lib/icons";
import { useAppState } from "@/lib/store";
import { useTopicsCache } from "@/lib/topics";

type FilterItem = { type: string; value: string; text: string };
type Suggestion = {
  id: string;
  type: "channel" | "topic" | "org" | "video" | "freeText";
  value: string;
  text: string;
  org?: string;
};

const TYPE_ICON: Record<Suggestion["type"], typeof Tv> = {
  channel: Tv,
  topic: Hash,
  org: Building2,
  video: PlayCircle,
  freeText: Search,
};

function routeSearchType(searchParams: Pick<URLSearchParams, "get">) {
  const channelType = searchParams.get("channelType");
  if (searchParams.get("vtuber") === "false" || channelType === "subber" || channelType === "clip")
    return "clip";
  if (channelType === "vtuber" || channelType === "stream") return "stream";
  return "all";
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

async function buildSearchUrl(payload: FilterItem[], sort: string, type: string) {
  if (!payload.length) return "/search";
  const { json2csv } = await import("json-2-csv");
  const params = new URLSearchParams();
  params.set("q", await json2csv(payload));
  if (sort !== "newest") params.set("sort", sort);
  if (type === "stream") params.set("channelType", "vtuber");
  if (type === "clip") params.set("channelType", "subber");
  return `/search?${params.toString()}`;
}

function suggestionFromAutocomplete(item: any): Suggestion | null {
  const value = String(item.value ?? "");
  const text = String(item.text ?? item.value ?? "");
  if (!value) return null;
  switch (item.type) {
    case "channel":
      return { id: `channel:${value}`, type: "channel", value, text, org: item.org };
    case "topic":
      return { id: `topic:${value}`, type: "topic", value, text: text || value };
    case "org":
      return { id: `org:${value}`, type: "org", value, text: text || value };
    case "video url":
      return { id: `video:${value}`, type: "video", value, text: text || value };
    default:
      return null;
  }
}

// Autocomplete results plus recognised video/channel URLs, local org matches and a trailing
// free-text search option.
function buildSuggestions(query: string, results: Suggestion[], orgOptions: string[]) {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const list: Suggestion[] = [];
  const channelMatch = trimmed.match(CHANNEL_URL_REGEX);
  const videoMatch = trimmed.match(VIDEO_URL_REGEX);
  if (videoMatch?.groups?.id && !results.some((r) => r.type === "video"))
    list.push({
      id: `video:${videoMatch.groups.id}`,
      type: "video",
      value: videoMatch.groups.id,
      text: videoMatch.groups.id,
    });
  if (
    channelMatch?.groups?.id &&
    !results.some((r) => r.type === "channel" && r.value === channelMatch.groups!.id)
  )
    list.push({
      id: `channel:${channelMatch.groups.id}`,
      type: "channel",
      value: channelMatch.groups.id,
      text: channelMatch.groups.id,
    });
  // Include local organization matches even when autocomplete omits its org group.
  const ql = trimmed.toLowerCase();
  orgOptions
    .filter(
      (name) =>
        name.toLowerCase().includes(ql) || formatOrgDisplayName(name).toLowerCase().includes(ql),
    )
    .slice(0, 4)
    .forEach((name) => {
      list.push({
        id: `org:${name}`,
        type: "org",
        value: name,
        text: formatOrgDisplayName(name),
      });
    });
  list.push(...results);
  list.push({ id: `freeText:${trimmed}`, type: "freeText", value: trimmed, text: trimmed });
  return list;
}

// The query and filters; on /search they follow the URL's `q`, `sort` and channel type.
function useSearchFilters(pathname: string, searchParams: ReturnType<typeof useSearchParams>) {
  const [query, setQuery] = useState("");
  const [orgs, setOrgs] = useState<string[]>([]);
  const [channels, setChannels] = useState<FilterItem[]>([]);
  const [topic, setTopic] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterSort, setFilterSort] = useState("newest");

  // Hydrate filters from the URL when on /search
  useEffect(() => {
    if (!pathname.startsWith("/search")) return;
    setFilterSort(searchParams.get("sort") || "newest");
    setFilterType(routeSearchType(searchParams));
    const q = searchParams.get("q");
    const reset = () => {
      setOrgs([]);
      setChannels([]);
      setTopic("");
      setQuery("");
    };
    if (!q) {
      reset();
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { csv2json } = await import("json-2-csv");
        const items = (await csv2json(q)) as FilterItem[];
        if (cancelled) return;
        setOrgs(items.filter((i) => i.type === "org").map((i) => i.value));
        setChannels(items.filter((i) => i.type === "channel"));
        const selectedTopic = items.find((i) => i.type === "topic")?.value || "";
        setTopic(selectedTopic);
        setQuery(String(items.find((i) => i.type === "title & desc")?.text ?? ""));
      } catch {
        if (!cancelled) reset();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, searchParams]);

  return {
    query,
    setQuery,
    orgs,
    setOrgs,
    channels,
    setChannels,
    topic,
    setTopic,
    filterType,
    setFilterType,
    filterSort,
    setFilterSort,
  };
}

// Top-bar autocomplete fetch (debounced); only the latest request's results are kept.
function useSearchAutocomplete(query: string) {
  const [results, setResults] = useState<Suggestion[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const requestId = useRef(0);
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoadingResults(false);
      return;
    }
    setLoadingResults(true);
    const reqId = ++requestId.current;
    const timer = setTimeout(async () => {
      try {
        const res: any = await api.searchAutocomplete(trimmed, { n: 8 });
        if (reqId !== requestId.current) return;
        const items = (res.data || [])
          .map(suggestionFromAutocomplete)
          .filter(Boolean) as Suggestion[];
        setResults(items.slice(0, 16));
      } catch {
        if (reqId === requestId.current) setResults([]);
      } finally {
        if (reqId === requestId.current) setLoadingResults(false);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [query]);
  return { results, setResults, loadingResults };
}

// Channel autocomplete inside the filter field (debounced).
function useChannelAutocomplete(channelSearch: string) {
  const [channelOptions, setChannelOptions] = useState<FilterItem[]>([]);
  useEffect(() => {
    const q = channelSearch.trim();
    if (q.length < 2) {
      setChannelOptions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res: any = await api.searchAutocomplete(q, { type: "vtuber", n: 12 });
        setChannelOptions(
          (res.data || []).map((item: any) => ({
            type: "channel",
            value: item.value,
            text: item.text || item.value,
          })),
        );
      } catch {
        setChannelOptions([]);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [channelSearch]);
  return channelOptions;
}

// Close the merged dropdown on an outside click (ignoring portaled Select/Combobox menus).
function useCloseOnOutsideClick(
  open: boolean,
  containerRef: React.RefObject<HTMLDivElement | null>,
  close: () => void,
) {
  const onClose = useEffectEvent(close);
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target) return;
      if (containerRef.current?.contains(target)) return;
      if (
        target.closest(
          "[data-slot=combobox-content],[data-slot=combobox-list],[data-slot=select-content],[data-slot=popover-content],[data-slot=command],[data-slot=command-item],[role=listbox],[role=option]",
        )
      )
        return;
      onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, containerRef]);
}

function SuggestionList({
  loading,
  hasResults,
  suggestions,
  onPick,
}: {
  loading: boolean;
  hasResults: boolean;
  suggestions: Suggestion[];
  onPick: (suggestion: Suggestion) => void;
}) {
  const t = useTranslations();
  return (
    <div className="mb-2 border-b pb-2">
      {loading && !hasResults ? (
        <div className="px-2 py-1.5 text-sm text-muted-foreground">
          {t("component.search.loading")}
        </div>
      ) : null}
      {suggestions.map((s) => {
        const Icon = TYPE_ICON[s.type];
        return (
          <button
            key={s.id}
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onPick(s)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
          >
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            {s.type === "freeText" ? (
              <>
                <span className="truncate">
                  {t("component.search.searchLabel")}:{" "}
                  <span className="text-foreground">“{s.text}”</span>
                </span>
                <CornerDownLeft className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
              </>
            ) : (
              <>
                <span className="truncate">{s.text || s.value}</span>
                <span className="ml-auto shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {s.org || t(`component.search.type.${s.type === "video" ? "videourl" : s.type}`)}
                </span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ChannelFilterField({
  channels,
  channelOptions,
  channelSearch,
  onChannelSearch,
  onChannels,
  onKeyDown,
}: {
  channels: FilterItem[];
  channelOptions: FilterItem[];
  channelSearch: string;
  onChannelSearch: (value: string) => void;
  onChannels: (channels: FilterItem[]) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const t = useTranslations();
  const channelAnchor = useComboboxAnchor();
  const selectedChannelValues = useMemo(() => channels.map((channel) => channel.value), [channels]);
  const channelLabels = useMemo(() => {
    const labels = new Map<string, string>();
    [...channels, ...channelOptions].forEach((channel) => {
      labels.set(channel.value, channel.text || channel.value);
    });
    return labels;
  }, [channels, channelOptions]);
  const channelValues = useMemo(
    () => unique([...selectedChannelValues, ...channelOptions.map((channel) => channel.value)]),
    [selectedChannelValues, channelOptions],
  );

  function updateChannels(values: string[]) {
    onChannels(
      unique(values).map((value) => ({
        type: "channel",
        value,
        text: channelLabels.get(value) || value,
      })),
    );
    onChannelSearch("");
  }

  return (
    <Field>
      <FieldLabel>{t("component.search.type.channel")}</FieldLabel>
      <Combobox
        multiple
        items={channelValues}
        value={selectedChannelValues}
        inputValue={channelSearch}
        filter={null}
        onInputValueChange={onChannelSearch}
        onValueChange={updateChannels}
      >
        <ComboboxChips ref={channelAnchor} className="gap-1.5">
          {selectedChannelValues.map((value) => (
            <ComboboxChip key={value}>{channelLabels.get(value) || value}</ComboboxChip>
          ))}
          <ComboboxChipsInput className="px-1" onKeyDown={onKeyDown} />
        </ComboboxChips>
        <ComboboxContent anchor={channelAnchor}>
          <ComboboxEmpty className="justify-start px-2 text-left">
            {channelSearch.trim().length < 2
              ? t("component.search.typeTwoCharacters")
              : t("component.search.noChannelsFound")}
          </ComboboxEmpty>
          <ComboboxList>
            {(value: string, index: number) => (
              <ComboboxItem key={value} value={value} index={index}>
                {channelLabels.get(value) || value}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </Field>
  );
}

function TopicFilterField({
  topics,
  topicsLoading,
  topic,
  onTopic,
  onOpen,
  onKeyDown,
}: {
  topics: { value: string }[];
  topicsLoading: boolean;
  topic: string;
  onTopic: (topic: string) => void;
  onOpen: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const t = useTranslations();
  const topicValues = useMemo(() => topics.map((option) => option.value), [topics]);
  return (
    <Field>
      <FieldLabel>{t("component.search.type.topic")}</FieldLabel>
      <Combobox
        items={topicValues}
        value={topic || null}
        itemToStringLabel={(value) => value || ""}
        onOpenChange={(nextOpen) => {
          if (nextOpen) onOpen();
        }}
        onValueChange={(value) => {
          const next = typeof value === "string" ? value : "";
          onTopic(next);
        }}
      >
        <ComboboxInput
          placeholder={t("component.search.searchTopics")}
          showClear={!!topic}
          onKeyDown={onKeyDown}
        />
        <ComboboxContent>
          <ComboboxEmpty>
            {topicsLoading ? t("component.search.loading") : t("component.search.noTopicsFound")}
          </ComboboxEmpty>
          <ComboboxList>
            {(value: string, index: number) => (
              <ComboboxItem key={value} value={value} index={index}>
                {value}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </Field>
  );
}

// Orgs to search in, or (toggled) the home page's org selection.
function OrgFilterField({
  orgOptions,
  orgs,
  onOrgs,
  onToggleMainOrgFilter,
  onKeyDown,
}: {
  orgOptions: string[];
  orgs: string[];
  onOrgs: (orgs: string[]) => void;
  onToggleMainOrgFilter: (next?: boolean) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const t = useTranslations();
  const app = useAppState();
  const orgAnchor = useComboboxAnchor();
  const useMainOrgs = app.searchUseMainOrgFilter;
  const mainOrgValues = useMemo(
    () => (app.selectedHomeOrgs?.length ? unique(app.selectedHomeOrgs) : [ALL_VTUBERS_ORG]),
    [app.selectedHomeOrgs],
  );
  const displayedOrgs = useMainOrgs ? mainOrgValues : orgs;
  const displayedOrgOptions = useMemo(
    () => unique([...orgOptions, ...displayedOrgs]),
    [orgOptions, displayedOrgs],
  );
  const orgLabel = (name: string) =>
    name === ALL_VTUBERS_ORG ? t("component.search.allVtubers") : formatOrgDisplayName(name);
  return (
    <Field>
      <FieldLabel>{t("component.search.type.org")}</FieldLabel>
      <div className="flex min-w-0 items-start gap-1.5">
        <div className="min-w-0 flex-1">
          <Combobox
            multiple
            items={displayedOrgOptions}
            value={displayedOrgs}
            disabled={useMainOrgs}
            onValueChange={(values) => onOrgs(unique(values))}
          >
            <ComboboxChips
              ref={orgAnchor}
              className="gap-1.5 data-disabled:cursor-not-allowed data-disabled:opacity-60"
            >
              {displayedOrgs.map((value) => (
                <ComboboxChip key={value} showRemove={!useMainOrgs}>
                  {orgLabel(value)}
                </ComboboxChip>
              ))}
              <ComboboxChipsInput
                className="px-1"
                disabled={useMainOrgs}
                onFocus={() => {
                  void app.fetchOrgs();
                }}
                onKeyDown={onKeyDown}
              />
            </ComboboxChips>
            <ComboboxContent anchor={orgAnchor}>
              <ComboboxEmpty>{t("component.search.noOrganizationsFound")}</ComboboxEmpty>
              <ComboboxList>
                {(value: string, index: number) => (
                  <ComboboxItem key={value} value={value} index={index}>
                    {orgLabel(value)}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>
        <Toggle
          type="button"
          pressed={useMainOrgs}
          onPressedChange={onToggleMainOrgFilter}
          aria-label={t("component.search.useMainOrgFilter")}
          title={t("component.search.useMainOrgFilter")}
          variant="outline"
          size="default"
          className="size-8 p-0"
        >
          <Building className="size-4" aria-hidden="true" />
        </Toggle>
      </div>
    </Field>
  );
}

function TypeAndSortFields({
  filterType,
  onFilterType,
  filterSort,
  onFilterSort,
}: {
  filterType: string;
  onFilterType: (value: string) => void;
  filterSort: string;
  onFilterSort: (value: string) => void;
}) {
  const t = useTranslations();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field>
        <FieldLabel>{t("views.search.typeDropdownLabel")}</FieldLabel>
        <Select value={filterType} onValueChange={onFilterType}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("views.search.type.all")}</SelectItem>
            <SelectItem value="stream">{t("views.search.type.official")}</SelectItem>
            <SelectItem value="clip">{t("views.search.type.clip")}</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel>{t("views.search.sortByLabel")}</FieldLabel>
        <Select value={filterSort} onValueChange={onFilterSort}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">{t("views.search.sort.newest")}</SelectItem>
            <SelectItem value="oldest">{t("views.search.sort.oldest")}</SelectItem>
            <SelectItem value="longest">{t("views.search.sort.longest")}</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}

export function SearchDropdown() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const app = useAppState();
  const t = useTranslations();

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const suppressOpenRef = useRef(false);
  const [channelSearch, setChannelSearch] = useState("");
  const { topics: topicOptions, topicsLoading, fetchTopics } = useTopicsCache();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  const { fetchOrgs } = app;
  useEffect(() => {
    if (!open) return;
    void fetchOrgs();
    void fetchTopics();
  }, [open, fetchOrgs, fetchTopics]);

  const filters = useSearchFilters(pathname, searchParams);
  const { query, setQuery, orgs, setOrgs, channels, setChannels, topic, setTopic } = filters;
  const { results, setResults, loadingResults } = useSearchAutocomplete(query);
  const channelOptions = useChannelAutocomplete(channelSearch);
  useCloseOnOutsideClick(open, containerRef, () => setOpen(false));

  const orgOptions = useMemo(
    () => (app.orgs || []).filter((org) => org.name !== ALL_VTUBERS_ORG).map((org) => org.name),
    [app.orgs],
  );
  const suggestions = useMemo(
    () => buildSuggestions(query, results, orgOptions),
    [query, results, orgOptions],
  );

  const hasContent = !!(query.trim() || orgs.length || channels.length || topic);
  const focusInput = () => containerRef.current?.querySelector("input")?.focus();

  function clearAll() {
    setOrgs([]);
    setChannels([]);
    setTopic("");
    setQuery("");
    setResults([]);
    setChannelSearch("");
    filters.setFilterType("all");
    filters.setFilterSort("newest");
    app.setSearchUseMainOrgFilter(false);
    setOpen(false);
    // Refocus the input without reopening the dropdown.
    suppressOpenRef.current = true;
    focusInput();
    // Clear the flag in case focus was already on the input (no onFocus fired).
    setTimeout(() => {
      suppressOpenRef.current = false;
    }, 0);
  }

  async function runSearch() {
    const payload: FilterItem[] = [
      ...(app.searchUseMainOrgFilter
        ? []
        : orgs.map((value) => ({ type: "org", value, text: value }))),
      ...channels,
      ...(topic ? [{ type: "topic", value: topic, text: topic }] : []),
    ];
    const text = query.trim();
    if (text) payload.push({ type: "title & desc", value: text, text });
    if (!payload.length) return;
    router.push(await buildSearchUrl(payload, filters.filterSort, filters.filterType));
    setOpen(false);
  }

  function toggleMainOrgFilter(next = !app.searchUseMainOrgFilter) {
    app.setSearchUseMainOrgFilter(next);
    if (!pathname.startsWith("/search") || !searchParams.get("page")) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    router.replace(`${pathname}${params.toString() ? `?${params}` : ""}`);
  }

  function addSuggestion(s: Suggestion) {
    if (s.type === "video") {
      router.push(`/watch/${s.value}`);
      setQuery("");
      setOpen(false);
      return;
    }
    if (s.type === "freeText") {
      void runSearch();
      return;
    }
    if (s.type === "channel")
      setChannels((prev) =>
        prev.some((c) => c.value === s.value)
          ? prev
          : [...prev, { type: "channel", value: s.value, text: s.text }],
      );
    else if (s.type === "topic") setTopic(s.value);
    else if (s.type === "org") setOrgs((prev) => unique([...prev, s.value]));
    setQuery("");
    setResults([]);
    focusInput();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      void runSearch();
    }
  }

  function onFilterKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !event.defaultPrevented) {
      event.preventDefault();
      void runSearch();
    }
  }

  return (
    <div ref={containerRef} className="relative flex min-w-0 flex-1 items-center">
      <InputGroup className="h-9">
        <InputGroupInput
          value={query}
          placeholder={t("component.search.placeholder")}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (suppressOpenRef.current) {
              suppressOpenRef.current = false;
              return;
            }
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
        <InputGroupAddon align="inline-end" className="gap-0.5">
          {hasContent ? (
            <InputGroupButton
              size="icon-xs"
              variant="ghost"
              aria-label={t("component.search.clear")}
              onClick={clearAll}
            >
              <X className="size-4" />
            </InputGroupButton>
          ) : null}
          <InputGroupButton
            size="icon-xs"
            variant="ghost"
            aria-label={t("component.search.searchLabel")}
            onClick={() => void runSearch()}
          >
            <Search className="size-4" />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>

      {open ? (
        <div className="absolute left-0 top-full z-50 mt-1.5 max-h-[calc(100vh-6rem)] w-full overflow-y-auto rounded-lg border bg-popover p-2.5 pb-4 text-popover-foreground shadow-md duration-100 animate-in fade-in-0 slide-in-from-top-1">
          {query.trim().length > 0 ? (
            <SuggestionList
              loading={loadingResults}
              hasResults={results.length > 0}
              suggestions={suggestions}
              onPick={addSuggestion}
            />
          ) : null}

          <FieldGroup className="gap-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <ChannelFilterField
                channels={channels}
                channelOptions={channelOptions}
                channelSearch={channelSearch}
                onChannelSearch={setChannelSearch}
                onChannels={setChannels}
                onKeyDown={onFilterKeyDown}
              />
              <TopicFilterField
                topics={topicOptions}
                topicsLoading={topicsLoading}
                topic={topic}
                onTopic={setTopic}
                onOpen={() => void fetchTopics()}
                onKeyDown={onFilterKeyDown}
              />
              <OrgFilterField
                orgOptions={orgOptions}
                orgs={orgs}
                onOrgs={setOrgs}
                onToggleMainOrgFilter={toggleMainOrgFilter}
                onKeyDown={onFilterKeyDown}
              />
            </div>
            <TypeAndSortFields
              filterType={filters.filterType}
              onFilterType={filters.setFilterType}
              filterSort={filters.filterSort}
              onFilterSort={filters.setFilterSort}
            />
          </FieldGroup>
        </div>
      ) : null}
    </div>
  );
}
