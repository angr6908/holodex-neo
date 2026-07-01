"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Building2, CornerDownLeft, Hash, PlayCircle, Search, Tv, X } from "lucide-react";
import { api } from "@/lib/api";
import { ALL_VTUBERS_ORG, CHANNEL_URL_REGEX, VIDEO_URL_REGEX } from "@/lib/consts";
import { formatOrgDisplayName } from "@/lib/functions";
import { useAppState } from "@/lib/store";
import { readJSON, writeJSON } from "@/lib/browser";
import { useTranslations } from "next-intl";
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TOPICS_STORAGE_KEY = "holodex-topics-cache";

type FilterItem = { type: string; value: string; text: string };
type TopicOption = { value: string };
type Suggestion = { id: string; type: "channel" | "topic" | "org" | "video" | "freeText"; value: string; text: string; org?: string };

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

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Suggestion[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [open, setOpen] = useState(false);
  const requestId = useRef(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // -- Filter state
  const [orgs, setOrgs] = useState<string[]>([]);
  const [channels, setChannels] = useState<FilterItem[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [filterType, setFilterType] = useState("all");
  const [filterSort, setFilterSort] = useState("newest");

  const [channelSearch, setChannelSearch] = useState("");
  const [channelOptions, setChannelOptions] = useState<FilterItem[]>([]);
  const [topicOptions, setTopicOptions] = useState<TopicOption[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);

  const orgAnchor = useComboboxAnchor();
  const channelAnchor = useComboboxAnchor();
  const topicAnchor = useComboboxAnchor();

  useEffect(() => { setTopicOptions(readJSON(TOPICS_STORAGE_KEY, [])); }, []);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => { if (!open) return; void app.fetchOrgs(); void fetchTopics(); }, [open]);

  // Hydrate filters from the URL when on /search
  useEffect(() => {
    if (!pathname.startsWith("/search")) return;
    setFilterSort(searchParams.get("sort") || "newest");
    setFilterType(routeSearchType(searchParams));
    const q = searchParams.get("q");
    const reset = () => { setOrgs([]); setChannels([]); setTopics([]); setQuery(""); };
    if (!q) { reset(); return; }
    (async () => {
      try {
        const { csv2json } = await import("json-2-csv");
        const items = (await csv2json(q)) as FilterItem[];
        setOrgs(items.filter((i) => i.type === "org").map((i) => i.value));
        setChannels(items.filter((i) => i.type === "channel"));
        setTopics(items.filter((i) => i.type === "topic").map((i) => i.value));
        setQuery(items.find((i) => i.type === "title & desc")?.text || "");
      } catch { reset(); }
    })();
  }, [pathname, searchParams]);

  // Top-bar autocomplete fetch (debounced)
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) { setResults([]); setLoadingResults(false); return; }
    setLoadingResults(true);
    const reqId = ++requestId.current;
    const timer = setTimeout(async () => {
      try {
        const res: any = await api.searchAutocomplete(trimmed, { n: 8 });
        if (reqId !== requestId.current) return;
        const items: Suggestion[] = (res.data || [])
          .map((item: any): Suggestion | null => {
            const value = String(item.value ?? "");
            const text = String(item.text ?? item.value ?? "");
            if (!value) return null;
            switch (item.type) {
              case "channel": return { id: `channel:${value}`, type: "channel", value, text, org: item.org };
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

  // Channel autocomplete inside the filter field
  useEffect(() => {
    const q = channelSearch.trim();
    if (q.length < 2) { setChannelOptions([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res: any = await api.searchAutocomplete(q, { type: "vtuber", n: 12 });
        setChannelOptions(
          (res.data || []).map((item: any) => ({ type: "channel", value: item.value, text: item.text || item.value })),
        );
      } catch { setChannelOptions([]); }
    }, 220);
    return () => clearTimeout(timer);
  }, [channelSearch]);

  // Close the merged dropdown on an outside click (ignoring portaled Select/Combobox menus).
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target) return;
      if (containerRef.current?.contains(target)) return;
      if (target.closest("[data-slot=combobox-content],[data-slot=combobox-list],[data-slot=select-content],[role=listbox],[role=option]")) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

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

  // -- Suggestions (autocomplete results + URL recognition + trailing free-text option)
  const suggestions = useMemo<Suggestion[]>(() => {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const list: Suggestion[] = [];
    const channelMatch = trimmed.match(CHANNEL_URL_REGEX);
    const videoMatch = trimmed.match(VIDEO_URL_REGEX);
    if (videoMatch?.groups?.id && !results.some((r) => r.type === "video"))
      list.push({ id: `video:${videoMatch.groups.id}`, type: "video", value: videoMatch.groups.id, text: videoMatch.groups.id });
    if (channelMatch?.groups?.id && !results.some((r) => r.type === "channel" && r.value === channelMatch.groups!.id))
      list.push({ id: `channel:${channelMatch.groups.id}`, type: "channel", value: channelMatch.groups.id, text: channelMatch.groups.id });
    // Org matches locally — v3 autocomplete has no org group.
    const ql = trimmed.toLowerCase();
    orgOptions
      .filter((name) => name.toLowerCase().includes(ql) || formatOrgDisplayName(name).toLowerCase().includes(ql))
      .slice(0, 4)
      .forEach((name) => list.push({ id: `org:${name}`, type: "org", value: name, text: formatOrgDisplayName(name) }));
    list.push(...results);
    list.push({ id: `freeText:${trimmed}`, type: "freeText", value: trimmed, text: trimmed });
    return list;
  }, [query, results, orgOptions]);

  const hasContent = !!(query.trim() || orgs.length || channels.length || topics.length);
  const focusInput = () => containerRef.current?.querySelector("input")?.focus();

  async function fetchTopics() {
    if (topicOptions.length || topicsLoading) return;
    setTopicsLoading(true);
    try {
      const { data }: any = await api.topics();
      const next = (data || []).map(({ id }: any) => ({ value: id }));
      setTopicOptions(next);
      writeJSON(TOPICS_STORAGE_KEY, next);
    } finally {
      setTopicsLoading(false);
    }
  }

  function updateChannels(values: string[]) {
    setChannels(unique(values).map((value) => ({ type: "channel", value, text: channelLabels.get(value) || value })));
    setChannelSearch("");
  }

  function clearAll() {
    setOrgs([]); setChannels([]); setTopics([]); setQuery(""); setResults([]);
    setChannelSearch(""); setFilterType("all"); setFilterSort("newest");
    focusInput();
  }

  async function runSearch() {
    const payload: FilterItem[] = [
      ...orgs.map((value) => ({ type: "org", value, text: value })),
      ...channels,
      ...topics.map((value) => ({ type: "topic", value, text: value })),
    ];
    const text = query.trim();
    if (text) payload.push({ type: "title & desc", value: text, text });
    if (!payload.length) return;
    router.push(await buildSearchUrl(payload, filterSort, filterType));
    setOpen(false);
  }

  function addSuggestion(s: Suggestion) {
    if (s.type === "video") { router.push(`/watch/${s.value}`); setQuery(""); setOpen(false); return; }
    if (s.type === "freeText") { void runSearch(); return; }
    if (s.type === "channel") setChannels((prev) => prev.some((c) => c.value === s.value) ? prev : [...prev, { type: "channel", value: s.value, text: s.text }]);
    else if (s.type === "topic") setTopics((prev) => unique([...prev, s.value]));
    else if (s.type === "org") setOrgs((prev) => unique([...prev, s.value]));
    setQuery("");
    setResults([]);
    focusInput();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") { setOpen(false); return; }
    if (event.key === "Enter") { event.preventDefault(); void runSearch(); }
  }

  function onFilterKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !event.defaultPrevented) { event.preventDefault(); void runSearch(); }
  }

  const typing = query.trim().length > 0;

  return (
    <div ref={containerRef} className="relative flex min-w-0 flex-1 items-center">
      <InputGroup className="h-9">
        <InputGroupInput
          value={query}
          placeholder={t("component.search.placeholder")}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        <InputGroupAddon align="inline-end" className="gap-0.5">
          {hasContent ? (
            <InputGroupButton size="icon-xs" variant="ghost" aria-label={t("component.search.clear")} onClick={clearAll}>
              <X className="size-4" />
            </InputGroupButton>
          ) : null}
          <InputGroupButton size="icon-xs" variant="ghost" aria-label={t("component.search.searchLabel")} onClick={() => void runSearch()}>
            <Search className="size-4" />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>

      {open ? (
        <div className="absolute left-0 top-full z-50 mt-1.5 max-h-[calc(100vh-6rem)] w-full overflow-y-auto rounded-lg border bg-popover p-2.5 pb-4 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 animate-in fade-in-0 slide-in-from-top-1">
          {typing ? (
            <div className="mb-2 border-b pb-2">
              {loadingResults && results.length === 0 ? (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">{t("component.search.loading")}</div>
              ) : null}
              {suggestions.map((s) => {
                const Icon = TYPE_ICON[s.type];
                return (
                  <button
                    key={s.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => addSuggestion(s)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    {s.type === "freeText" ? (
                      <>
                        <span className="truncate">{t("component.search.searchLabel")}: <span className="text-foreground">“{s.text}”</span></span>
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
          ) : null}

          <FieldGroup className="gap-3">
            <div className="grid gap-3 sm:grid-cols-3">
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
                    <ComboboxChipsInput onKeyDown={onFilterKeyDown} />
                  </ComboboxChips>
                  <ComboboxContent anchor={channelAnchor}>
                    <ComboboxEmpty className="justify-start px-2 text-left">
                      {channelSearch.trim().length < 2 ? t("component.search.typeTwoCharacters") : t("component.search.noChannelsFound")}
                    </ComboboxEmpty>
                    <ComboboxList>
                      {(value: string, index: number) => (
                        <ComboboxItem key={value} value={value} index={index}>{channelLabels.get(value) || value}</ComboboxItem>
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
                    <ComboboxChipsInput onFocus={() => { void fetchTopics(); }} onKeyDown={onFilterKeyDown} />
                  </ComboboxChips>
                  <ComboboxContent anchor={topicAnchor}>
                    <ComboboxEmpty>{topicsLoading ? t("component.search.loading") : t("component.search.noTopicsFound")}</ComboboxEmpty>
                    <ComboboxList>
                      {(value: string, index: number) => (
                        <ComboboxItem key={value} value={value} index={index}>{value}</ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </Field>

              <Field>
                <FieldLabel>{t("component.search.type.org")}</FieldLabel>
                <Combobox multiple items={orgOptions} value={orgs} onValueChange={(values) => setOrgs(unique(values))}>
                  <ComboboxChips ref={orgAnchor}>
                    {orgs.map((value) => (
                      <ComboboxChip key={value}>{formatOrgDisplayName(value)}</ComboboxChip>
                    ))}
                    <ComboboxChipsInput onFocus={() => { void app.fetchOrgs(); }} onKeyDown={onFilterKeyDown} />
                  </ComboboxChips>
                  <ComboboxContent anchor={orgAnchor}>
                    <ComboboxEmpty>{t("component.search.noOrganizationsFound")}</ComboboxEmpty>
                    <ComboboxList>
                      {(value: string, index: number) => (
                        <ComboboxItem key={value} value={value} index={index}>{formatOrgDisplayName(value)}</ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
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
            </div>
          </FieldGroup>
        </div>
      ) : null}
    </div>
  );
}
