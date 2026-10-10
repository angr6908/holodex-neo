"use client";

import {
  Broom,
  Building2,
  CornerDownLeft,
  Film,
  Hash,
  PlayCircle,
  Search,
  Tv,
  X,
} from "lucide-react";
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
import { Button } from "@/components/ui/button";
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
import { api } from "@/lib/api";
import { ALL_VTUBERS_ORG, VIDEO_URL_REGEX } from "@/lib/consts";
import { buildSearchUrl, formatOrgDisplayName, searchTypeFromParams } from "@/lib/functions";
import { Building } from "@/lib/icons";
import { useAppState } from "@/lib/store";
import { useTopicsCache } from "@/lib/topics";

type FilterItem = { type: string; value: string; text: string };
type FilterChip = { id: string; icon: typeof Tv; label: string; onRemove: () => void };
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

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function formatOrgLabel(name: string, t: ReturnType<typeof useTranslations>) {
  return name === ALL_VTUBERS_ORG ? t("component.search.allVtubers") : formatOrgDisplayName(name);
}

const TYPE_LABEL_KEY: Record<string, string> = {
  stream: "views.search.type.official",
  clip: "views.search.type.clip",
};

function suggestionFromAutocomplete(item: any): Suggestion | null {
  const value = String(item.value ?? "");
  const text = String(item.text ?? item.value ?? "");
  if (!value) return null;
  switch (item.type) {
    case "channel":
      return { id: `channel:${value}`, type: "channel", value, text, org: item.org };
    case "topic":
      return { id: `topic:${value}`, type: "topic", value, text: text || value };
    default:
      return null;
  }
}

// Autocomplete results (VTubers and topics) plus a recognised video URL, matching orgs and a
// trailing free-text search option. A channel URL is suggested only when autocomplete knows it
// as a VTuber, the only channels video search filters by.
function buildSuggestions(query: string, results: Suggestion[], orgOptions: string[]) {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const list: Suggestion[] = [];
  const videoMatch = trimmed.match(VIDEO_URL_REGEX);
  if (videoMatch?.groups?.id)
    list.push({
      id: `video:${videoMatch.groups.id}`,
      type: "video",
      value: videoMatch.groups.id,
      text: videoMatch.groups.id,
    });
  // Autocomplete suggests no orgs; match them from the org list.
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
    setFilterType(searchTypeFromParams(searchParams));
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

// Top-bar autocomplete fetch (debounced); only the latest request's results are kept. A video
// URL needs no request: buildSuggestions recognises it.
function useSearchAutocomplete(query: string) {
  const [results, setResults] = useState<Suggestion[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const requestId = useRef(0);
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2 || VIDEO_URL_REGEX.test(trimmed)) {
      requestId.current++;
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

// Orgs to search in; the button fills them with the navigation bar's org selection.
function OrgFilterField({
  orgOptions,
  orgs,
  onOrgs,
  onKeyDown,
}: {
  orgOptions: string[];
  orgs: string[];
  onOrgs: (orgs: string[]) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const t = useTranslations();
  const app = useAppState();
  const orgAnchor = useComboboxAnchor();
  // Listed options include the chosen orgs, so an "All VTubers" chip from the navigation bar
  // still has its label.
  const displayedOrgOptions = useMemo(() => unique([...orgOptions, ...orgs]), [orgOptions, orgs]);
  const orgLabel = (name: string) => formatOrgLabel(name, t);
  return (
    <Field>
      <FieldLabel>{t("component.search.type.org")}</FieldLabel>
      <div className="flex min-w-0 items-start gap-1.5">
        <div className="min-w-0 flex-1">
          <Combobox
            multiple
            items={displayedOrgOptions}
            value={orgs}
            onValueChange={(values) => onOrgs(unique(values))}
          >
            <ComboboxChips ref={orgAnchor} className="gap-1.5">
              {orgs.map((value) => (
                <ComboboxChip key={value}>{orgLabel(value)}</ComboboxChip>
              ))}
              <ComboboxChipsInput
                className="px-1"
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
        <Button
          type="button"
          variant="outline"
          size="icon"
          pressHighlight
          onClick={() =>
            onOrgs(app.selectedHomeOrgs?.length ? unique(app.selectedHomeOrgs) : [ALL_VTUBERS_ORG])
          }
          aria-label={t("component.search.useMainOrgFilter")}
          title={t("component.search.useMainOrgFilter")}
        >
          <Building className="size-4" aria-hidden="true" />
        </Button>
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

// The dropdown's filters as removable chips at the start of the search bar; they scroll
// sideways once they fill most of it, keeping the newest chip in view.
function FilterChips({ chips }: { chips: FilterChip[] }) {
  const t = useTranslations();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const count = chips.length;
  const prevCount = useRef(count);
  useEffect(() => {
    const el = scrollRef.current;
    if (el && count > prevCount.current) el.scrollLeft = el.scrollWidth;
    prevCount.current = count;
  }, [count]);
  if (!count) return null;
  return (
    <InputGroupAddon align="inline-start" className="min-w-0 max-w-[60%] justify-start">
      <div ref={scrollRef} className="no-scrollbar flex min-w-0 items-center gap-1 overflow-x-auto">
        {chips.map(({ id, icon: Icon, label, onRemove }) => (
          <span
            key={id}
            className="flex h-[calc(--spacing(5.25))] shrink-0 items-center gap-1 rounded-sm bg-muted pl-1.5 text-xs font-medium whitespace-nowrap text-foreground"
          >
            <Icon className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="max-w-40 truncate">{label}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="-ml-1 opacity-50 hover:opacity-100"
              aria-label={`${t("component.common.remove")} ${label}`}
              onClick={onRemove}
            >
              <X className="pointer-events-none" />
            </Button>
          </span>
        ))}
      </div>
    </InputGroupAddon>
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
  // Suggestions load only while the dropdown is open, not for a query restored from the URL.
  const { results, setResults, loadingResults } = useSearchAutocomplete(open ? query : "");
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

  const { filterType, setFilterType } = filters;
  const chips = useMemo(() => {
    const list: FilterChip[] = [
      ...channels.map((channel) => ({
        id: `channel:${channel.value}`,
        icon: Tv,
        label: channel.text || channel.value,
        onRemove: () => setChannels((prev) => prev.filter((c) => c.value !== channel.value)),
      })),
      ...(topic
        ? [{ id: `topic:${topic}`, icon: Hash, label: topic, onRemove: () => setTopic("") }]
        : []),
      ...orgs.map((org) => ({
        id: `org:${org}`,
        icon: Building2,
        label: formatOrgLabel(org, t),
        onRemove: () => setOrgs((prev) => prev.filter((o) => o !== org)),
      })),
    ];
    if (TYPE_LABEL_KEY[filterType])
      list.push({
        id: `type:${filterType}`,
        icon: Film,
        label: t(TYPE_LABEL_KEY[filterType]),
        onRemove: () => setFilterType("all"),
      });
    return list;
  }, [channels, topic, orgs, filterType, setChannels, setTopic, setOrgs, setFilterType, t]);

  const hasContent = !!(query.trim() || chips.length);
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
    // Refocus the input without changing whether the dropdown is open.
    suppressOpenRef.current = true;
    focusInput();
    // Clear the flag in case focus was already on the input (no onFocus fired).
    setTimeout(() => {
      suppressOpenRef.current = false;
    }, 0);
  }

  async function runSearch() {
    const payload: FilterItem[] = [
      ...orgs.map((value) => ({ type: "org", value, text: value })),
      ...channels,
      ...(topic ? [{ type: "topic", value: topic, text: topic }] : []),
    ];
    const text = query.trim();
    if (text) payload.push({ type: "title & desc", value: text, text });
    if (!payload.length) return;
    router.push(
      await buildSearchUrl(payload, { sort: filters.filterSort, type: filters.filterType }),
    );
    setOpen(false);
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
    // Backspace in the empty input removes the last filter chip.
    if (event.key === "Backspace" && !query && chips.length) {
      event.preventDefault();
      chips[chips.length - 1].onRemove();
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
        <FilterChips chips={chips} />
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
              <Broom className="size-4" />
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
