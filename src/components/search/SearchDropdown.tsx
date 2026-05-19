"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  CornerDownLeft,
  Hash,
  PlayCircle,
  Search,
  SlidersHorizontal,
  Tv,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { ALL_VTUBERS_ORG, CHANNEL_URL_REGEX, VIDEO_URL_REGEX } from "@/lib/consts";
import { formatOrgDisplayName } from "@/lib/functions";
import { useAppState } from "@/lib/store";
import { readJSON, writeJSON } from "@/lib/browser";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  ComboboxSeparator,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import { Field, FieldContent, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const TOPICS_STORAGE_KEY = "holodex-topics-cache";

type FilterItem = { type: string; value: string; text: string };
type TopicOption = { value: string; count?: number };
type Suggestion = { id: string; type: "channel" | "topic" | "org" | "video" | "freeText"; value: string; text: string };

const TYPE_ICON: Record<Suggestion["type"], typeof Tv> = {
  channel: Tv,
  topic: Hash,
  org: Building2,
  video: PlayCircle,
  freeText: Search,
};

function routeSearchType(searchParams: Pick<URLSearchParams, "get">) {
  const channelType = searchParams.get("channelType");
  if (searchParams.get("vtuber") === "false" || channelType === "subber" || channelType === "clip") return "clip";
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

export function SearchDropdown() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const app = useAppState();
  const t = useTranslations();

  // -- Autocomplete state (top-level search bar)
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Suggestion[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const requestId = useRef(0);

  // -- Advanced filter state
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const orgAnchor = useComboboxAnchor();
  const channelAnchor = useComboboxAnchor();
  const topicAnchor = useComboboxAnchor();

  const [orgs, setOrgs] = useState<string[]>([]);
  const [channels, setChannels] = useState<FilterItem[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterSort, setFilterSort] = useState("newest");

  const [channelSearch, setChannelSearch] = useState("");
  const [channelOptions, setChannelOptions] = useState<FilterItem[]>([]);
  const [topicOptions, setTopicOptions] = useState<TopicOption[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);

  // -- Hydrate from URL (when on /search)
  useEffect(() => { setTopicOptions(readJSON(TOPICS_STORAGE_KEY, [])); }, []);
  useEffect(() => { if (!advancedOpen) return; void app.fetchOrgs(); void fetchTopics(); }, [advancedOpen]);
  useEffect(() => { setSuggestOpen(false); setAdvancedOpen(false); }, [pathname]);

  useEffect(() => {
    if (!pathname.startsWith("/search")) return;
    const q = searchParams.get("q");
    setFilterSort(searchParams.get("sort") || "newest");
    setFilterType(routeSearchType(searchParams));
    const resetFilters = () => { setOrgs([]); setChannels([]); setTopics([]); setTitle(""); setComment(""); };
    if (!q) { resetFilters(); return; }
    (async () => {
      try {
        const { csv2json } = await import("json-2-csv");
        const items = (await csv2json(q)) as FilterItem[];
        setOrgs(items.filter((i) => i.type === "org").map((i) => i.value));
        setChannels(items.filter((i) => i.type === "channel"));
        setTopics(items.filter((i) => i.type === "topic").map((i) => i.value));
        setTitle(items.find((i) => i.type === "title & desc")?.text || "");
        setComment(items.find((i) => i.type === "comments")?.text || "");
      } catch { resetFilters(); }
    })();
  }, [pathname, searchParams]);

  // -- Autocomplete fetch (debounced)
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
        const res: any = await api.searchAutocomplete(trimmed);
        if (reqId !== requestId.current) return;
        const items: Suggestion[] = (res.data || [])
          .map((item: any): Suggestion | null => {
            const value = String(item.value ?? "");
            const text = String(item.text ?? item.value ?? "");
            if (!value) return null;
            switch (item.type) {
              case "channel": return { id: `channel:${value}`, type: "channel", value, text };
              case "topic": return { id: `topic:${value}`, type: "topic", value, text: text || value };
              case "org": return { id: `org:${value}`, type: "org", value, text: text || value };
              case "video url": return { id: `video:${value}`, type: "video", value, text: text || value };
              default: return null;
            }
          })
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

  // -- Channel autocomplete inside the advanced filter
  useEffect(() => {
    const q = channelSearch.trim();
    if (q.length < 2) { setChannelOptions([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res: any = await api.searchAutocomplete(q);
        setChannelOptions(
          (res.data || [])
            .filter((item: any) => item.type === "channel")
            .map((item: any) => ({ type: "channel", value: item.value, text: item.text || item.value }))
            .slice(0, 12),
        );
      } catch {
        setChannelOptions([]);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [channelSearch]);

  const orgOptions = useMemo(
    () => (app.orgs || []).filter((org) => org.name !== ALL_VTUBERS_ORG).map((org) => org.name),
    [app.orgs],
  );
  const selectedChannelValues = useMemo(() => channels.map((channel) => channel.value), [channels]);
  const channelLabels = useMemo(() => {
    const labels = new Map<string, string>();
    [...channels, ...channelOptions].forEach((channel) => labels.set(channel.value, channel.text || channel.value));
    return labels;
  }, [channels, channelOptions]);
  const channelValues = useMemo(
    () => unique([...selectedChannelValues, ...channelOptions.map((channel) => channel.value)]),
    [selectedChannelValues, channelOptions],
  );
  const topicValues = useMemo(() => topicOptions.map((topic) => topic.value), [topicOptions]);
  const topicCounts = useMemo(() => new Map(topicOptions.map((topic) => [topic.value, topic.count])), [topicOptions]);

  const activeFilters = useMemo(() => [
    ...orgs.map((value) => ({ key: `org-${value}`, text: formatOrgDisplayName(value) })),
    ...channels.map((value) => ({ key: `channel-${value.value}`, text: value.text })),
    ...topics.map((value) => ({ key: `topic-${value}`, text: value })),
    ...(title ? [{ key: "title", text: title }] : []),
    ...(comment ? [{ key: "comment", text: comment }] : []),
  ], [orgs, channels, topics, title, comment]);

  // -- Suggestion list (results + leading free-text option)
  const suggestions = useMemo<Suggestion[]>(() => {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const list: Suggestion[] = [];

    // Recognize a pasted channel URL or video URL even before the API responds.
    const channelMatch = trimmed.match(CHANNEL_URL_REGEX);
    const videoMatch = trimmed.match(VIDEO_URL_REGEX);
    if (videoMatch?.groups?.id && !results.some((r) => r.type === "video")) {
      list.push({ id: `video:${videoMatch.groups.id}`, type: "video", value: videoMatch.groups.id, text: videoMatch.groups.id });
    }
    if (channelMatch?.groups?.id && !results.some((r) => r.type === "channel" && r.value === channelMatch.groups!.id)) {
      list.push({ id: `channel:${channelMatch.groups.id}`, type: "channel", value: channelMatch.groups.id, text: channelMatch.groups.id });
    }

    list.push(...results);
    list.push({ id: `freeText:${trimmed}`, type: "freeText", value: trimmed, text: trimmed });
    return list;
  }, [query, results]);

  const suggestionMap = useMemo(() => new Map(suggestions.map((s) => [s.id, s])), [suggestions]);
  const suggestionIds = useMemo(() => suggestions.map((s) => s.id), [suggestions]);

  async function fetchTopics() {
    if (topicOptions.length || topicsLoading) return;
    setTopicsLoading(true);
    try {
      const { data }: any = await api.topics();
      const next = (data || []).map(({ id, count }: any) => ({ value: id, count }));
      setTopicOptions(next);
      writeJSON(TOPICS_STORAGE_KEY, next);
    } finally {
      setTopicsLoading(false);
    }
  }

  function updateChannels(values: string[]) {
    setChannels(unique(values).map((value) => ({
      type: "channel",
      value,
      text: channelLabels.get(value) || value,
    })));
    setChannelSearch("");
  }

  function clearAll() {
    setOrgs([]); setChannels([]); setTopics([]); setTitle(""); setComment("");
    setChannelSearch(""); setFilterType("all"); setFilterSort("newest");
  }

  // -- Suggestion actions
  async function handleSuggestion(id: string | null) {
    if (!id) return;
    const s = suggestionMap.get(id);
    if (!s) return;
    setSuggestOpen(false);

    if (s.type === "video") { router.push(`/watch/${s.value}`); setQuery(""); return; }
    if (s.type === "channel") { router.push(`/channel/${s.value}`); setQuery(""); return; }

    let payload: FilterItem[] = [];
    if (s.type === "topic") payload = [{ type: "topic", value: s.value, text: s.value }];
    else if (s.type === "org") payload = [{ type: "org", value: s.value, text: s.value }];
    else if (s.type === "freeText") payload = [{ type: "title & desc", value: s.value, text: s.value }];

    const url = await buildSearchUrl(payload, "newest", "all");
    router.push(url);
    setQuery("");
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    // Allow the combobox to handle Enter when an item is highlighted; if nothing's
    // highlighted but text exists, fall through to a free-text search.
    if (event.key === "Enter" && !event.defaultPrevented) {
      const text = query.trim();
      if (!text) return;
      // Small timeout so the combobox can claim the event first if it selected an item.
      setTimeout(() => {
        if (suggestOpen) return;
        void handleSuggestion(`freeText:${text}`);
      }, 0);
    }
  }

  async function submitAdvanced() {
    const payload: FilterItem[] = [
      ...orgs.map((value) => ({ type: "org", value, text: value })),
      ...channels,
      ...topics.map((value) => ({ type: "topic", value, text: value })),
    ];
    const text = title.trim();
    const commentText = comment.trim();
    if (text) payload.push({ type: "title & desc", value: text, text });
    if (commentText) payload.push({ type: "comments", value: commentText, text: commentText });

    const url = await buildSearchUrl(payload, filterSort, filterType);
    router.push(url);
    setAdvancedOpen(false);
  }

  const filterSummary = activeFilters.length
    ? `${activeFilters[0].text}${activeFilters.length > 1 ? ` +${activeFilters.length - 1}` : ""}`
    : "";

  return (
    <TooltipProvider>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {/* Autocomplete combobox */}
        <Combobox
          items={suggestionIds}
          value={null}
          inputValue={query}
          onInputValueChange={(value) => { setQuery(value); if (value) setSuggestOpen(true); }}
          onValueChange={(value: string | null) => void handleSuggestion(value)}
          filter={null}
          open={suggestOpen && query.trim().length > 0}
          onOpenChange={setSuggestOpen}
        >
          <ComboboxInput
            placeholder={t("component.search.placeholder")}
            showTrigger={false}
            showClear={!!query}
            onKeyDown={onInputKeyDown}
            className="h-9 w-full min-w-0"
          />
          <ComboboxContent className="max-h-[min(70vh,28rem)]">
            <ComboboxEmpty>
              {query.trim().length < 2
                ? t("component.search.typeTwoCharacters")
                : loadingResults
                  ? t("component.search.loading")
                  : t("component.search.noResultsFound")}
            </ComboboxEmpty>
            <ComboboxList>
              {(id: string, index: number) => {
                const s = suggestionMap.get(id);
                if (!s) return null;
                const Icon = TYPE_ICON[s.type];
                const prev = index > 0 ? suggestions[index - 1] : null;
                const showSeparator = !!prev && prev.type !== s.type;
                const showHeader =
                  s.type !== "freeText" && (!prev || prev.type !== s.type);

                return (
                  <Fragment key={id}>
                    {showSeparator ? <ComboboxSeparator /> : null}
                    {showHeader ? (
                      <div className="px-2 pb-0.5 pt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {s.type === "channel" && t("component.search.type.channel")}
                        {s.type === "topic" && t("component.search.type.topic")}
                        {s.type === "org" && t("component.search.type.org")}
                        {s.type === "video" && t("component.search.type.videourl")}
                      </div>
                    ) : null}
                    <ComboboxItem value={id} index={index}>
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      {s.type === "freeText" ? (
                        <>
                          <span className="truncate">
                            {t("component.search.searchLabel")}: <span className="text-foreground">“{s.text}”</span>
                          </span>
                          <CornerDownLeft className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
                        </>
                      ) : (
                        <span className="truncate">{s.text || s.value}</span>
                      )}
                    </ComboboxItem>
                  </Fragment>
                );
              }}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>

        {/* Advanced filter trigger */}
        <Popover open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <Tooltip>
            <TooltipTrigger
              render={
                <PopoverTrigger
                  render={
                    <Button
                      type="button"
                      size="icon"
                      variant={activeFilters.length ? "secondary" : "outline"}
                      aria-label={t("component.search.filterByTopicOrgChannel")}
                      className="relative h-9 w-9 shrink-0"
                    />
                  }
                />
              }
            >
              <SlidersHorizontal className="size-4" />
              {activeFilters.length ? (
                <Badge
                  variant="default"
                  className="absolute -right-1 -top-1 h-4 min-w-4 px-1 text-[10px]"
                >
                  {activeFilters.length}
                </Badge>
              ) : null}
            </TooltipTrigger>
            <TooltipContent>
              {filterSummary || t("component.search.filterByTopicOrgChannel")}
            </TooltipContent>
          </Tooltip>
          <PopoverContent
            align="end"
            sideOffset={8}
            className="max-h-[calc(100vh-5rem)] w-[calc(100vw-1rem)] max-w-[44rem] overflow-y-auto sm:w-[min(92vw,44rem)]"
          >
            <FieldGroup>
              <Field>
                <FieldLabel>{t("component.search.type.titledesc")}</FieldLabel>
                <FieldContent>
                  <Input
                    autoFocus
                    placeholder={t("component.search.type.titledesc")}
                    value={title}
                    disabled={!!comment}
                    onChange={(event) => setTitle(event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter") void submitAdvanced(); }}
                  />
                </FieldContent>
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel>{t("component.search.type.channel")}</FieldLabel>
                  <Combobox
                    multiple
                    items={channelValues}
                    value={selectedChannelValues}
                    inputValue={channelSearch}
                    filter={null}
                    onInputValueChange={setChannelSearch}
                    onValueChange={updateChannels}
                  >
                    <ComboboxChips ref={channelAnchor}>
                      {selectedChannelValues.map((value) => (
                        <ComboboxChip key={value}>{channelLabels.get(value) || value}</ComboboxChip>
                      ))}
                      <ComboboxChipsInput placeholder={t("component.search.type.channel")} />
                    </ComboboxChips>
                    <ComboboxContent anchor={channelAnchor}>
                      <ComboboxEmpty>
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

                <Field>
                  <FieldLabel>{t("component.search.type.topic")}</FieldLabel>
                  <Combobox
                    multiple
                    items={topicValues}
                    value={topics}
                    onOpenChange={(nextOpen) => { if (nextOpen) void fetchTopics(); }}
                    onValueChange={(values) => setTopics(unique(values))}
                  >
                    <ComboboxChips ref={topicAnchor}>
                      {topics.map((value) => (
                        <ComboboxChip key={value}>{value}</ComboboxChip>
                      ))}
                      <ComboboxChipsInput
                        placeholder={topicsLoading ? t("component.search.loading") : t("component.search.type.topic")}
                        onFocus={() => { void fetchTopics(); }}
                      />
                    </ComboboxChips>
                    <ComboboxContent anchor={topicAnchor}>
                      <ComboboxEmpty>
                        {topicsLoading ? t("component.search.loading") : t("component.search.noTopicsFound")}
                      </ComboboxEmpty>
                      <ComboboxList>
                        {(value: string, index: number) => {
                          const count = topicCounts.get(value);
                          return (
                            <ComboboxItem key={value} value={value} index={index}>
                              <span>{value}</span>
                              {count !== undefined ? <span className="ml-auto text-muted-foreground">{count}</span> : null}
                            </ComboboxItem>
                          );
                        }}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                </Field>
              </div>

              <Field>
                <FieldLabel>{t("component.search.type.org")}</FieldLabel>
                <Combobox multiple items={orgOptions} value={orgs} onValueChange={(values) => setOrgs(unique(values))}>
                  <ComboboxChips ref={orgAnchor}>
                    {orgs.map((value) => (
                      <ComboboxChip key={value}>{formatOrgDisplayName(value)}</ComboboxChip>
                    ))}
                    <ComboboxChipsInput
                      placeholder={t("component.search.type.org")}
                      onFocus={() => { void app.fetchOrgs(); }}
                    />
                  </ComboboxChips>
                  <ComboboxContent anchor={orgAnchor}>
                    <ComboboxEmpty>{t("component.search.noOrganizationsFound")}</ComboboxEmpty>
                    <ComboboxList>
                      {(value: string, index: number) => (
                        <ComboboxItem key={value} value={value} index={index}>
                          {formatOrgDisplayName(value)}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </Field>

              <div className="grid gap-4 md:grid-cols-3">
                <Field>
                  <FieldLabel>{t("views.search.typeDropdownLabel")}</FieldLabel>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("views.search.type.all")}</SelectItem>
                      <SelectItem value="stream">{t("views.search.type.official")}</SelectItem>
                      <SelectItem value="clip">{t("views.search.type.clip")}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>{t("views.search.sortByLabel")}</FieldLabel>
                  <Select value={filterSort} onValueChange={setFilterSort}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">{t("views.search.sort.newest")}</SelectItem>
                      <SelectItem value="oldest">{t("views.search.sort.oldest")}</SelectItem>
                      <SelectItem value="longest">{t("views.search.sort.longest")}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>{t("component.search.type.comments")}</FieldLabel>
                  <Input value={comment} disabled={!!title} onChange={(event) => setComment(event.target.value)} />
                </Field>
              </div>

              <Separator />

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-muted-foreground">
                  {activeFilters.length
                    ? activeFilters.slice(0, 4).map((f) => (
                        <Badge key={f.key} variant="secondary" className="max-w-[10rem] truncate">{f.text}</Badge>
                      ))
                    : null}
                  {activeFilters.length > 4 ? <span>+{activeFilters.length - 4}</span> : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button type="button" variant="outline" onClick={clearAll}>
                    <X className="size-4" />
                    {t("component.search.clear")}
                  </Button>
                  <Button type="button" onClick={() => void submitAdvanced()}>
                    <Search className="size-4" />
                    {t("component.search.searchLabel")}
                  </Button>
                </div>
              </div>
            </FieldGroup>
          </PopoverContent>
        </Popover>
      </div>
    </TooltipProvider>
  );
}
