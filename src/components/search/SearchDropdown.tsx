"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { api } from "@/lib/api";
import { ALL_VTUBERS_ORG } from "@/lib/consts";
import { formatOrgDisplayName } from "@/lib/functions";
import { useAppState } from "@/lib/store";
import { readJSON, writeJSON } from "@/lib/browser";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox, ComboboxChip, ComboboxChips, ComboboxChipsInput, ComboboxContent, ComboboxEmpty, ComboboxItem, ComboboxList, useComboboxAnchor } from "@/components/ui/combobox";
import { Field, FieldContent, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
const TOPICS_STORAGE_KEY = "holodex-topics-cache";

type FilterItem = { type: string; value: string; text: string };
type TopicOption = { value: string; count?: number };

function routeSearchType(searchParams: Pick<URLSearchParams, "get">) {
  const channelType = searchParams.get("channelType");
  if (searchParams.get("vtuber") === "false" || channelType === "subber" || channelType === "clip") return "clip";
  if (channelType === "vtuber" || channelType === "stream") return "stream";
  return "all";
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export function SearchDropdown() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const app = useAppState();
  const t = useTranslations();

  const orgAnchor = useComboboxAnchor();
  const channelAnchor = useComboboxAnchor();
  const topicAnchor = useComboboxAnchor();

  const [open, setOpen] = useState(false);
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

  useEffect(() => { setTopicOptions(readJSON(TOPICS_STORAGE_KEY, [])); }, []);
  useEffect(() => { if (!open) return; void app.fetchOrgs(); void fetchTopics(); }, [open]);
  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!pathname.startsWith("/search")) return;
    const q = searchParams.get("q");
    setFilterSort(searchParams.get("sort") || "newest");
    setFilterType(routeSearchType(searchParams));
    const resetFilters = () => {
      setOrgs([]); setChannels([]); setTopics([]); setTitle(""); setComment("");
    };
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

  useEffect(() => {
    const query = channelSearch.trim();
    if (query.length < 2) {
      setChannelOptions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res: any = await api.searchAutocomplete(query);
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
  const triggerText = activeFilters.length ? activeFilters[0].text : t("component.search.placeholder");

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
    setOrgs([]);
    setChannels([]);
    setTopics([]);
    setTitle("");
    setComment("");
    setChannelSearch("");
    setFilterType("all");
    setFilterSort("newest");
  }

  async function submit() {
    const payload: FilterItem[] = [
      ...orgs.map((value) => ({ type: "org", value, text: value })),
      ...channels,
      ...topics.map((value) => ({ type: "topic", value, text: value })),
    ];
    const text = title.trim();
    const commentText = comment.trim();
    if (text) payload.push({ type: "title & desc", value: text, text });
    if (commentText) payload.push({ type: "comments", value: commentText, text: commentText });
    if (!payload.length) {
      router.push("/search");
      setOpen(false);
      return;
    }
    const { json2csv } = await import("json-2-csv");
    const params = new URLSearchParams();
    params.set("q", await json2csv(payload));
    if (filterSort !== "newest") params.set("sort", filterSort);
    if (filterType === "stream") params.set("channelType", "vtuber");
    if (filterType === "clip") params.set("channelType", "subber");
    router.push(`/search?${params.toString()}`);
    setOpen(false);
  }

  return (
    <div className="min-w-0 flex-1">
      <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button type="button" variant="outline" className="h-9 w-full min-w-0 justify-start overflow-hidden" />}
      >
        <Search className="size-4 shrink-0" />
        <span className={`min-w-0 flex-1 truncate text-left ${activeFilters.length ? "" : "text-muted-foreground"}`}>{triggerText}</span>
        {activeFilters.length > 1 ? <Badge variant="secondary" className="shrink-0">+{activeFilters.length - 1}</Badge> : null}
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="max-h-[calc(100vh-5rem)] w-[calc(100vw-1rem)] max-w-[48rem] overflow-y-auto sm:w-[min(92vw,48rem)]">
        <FieldGroup>
          <Field>
            <FieldLabel>{t("component.search.searchLabel")}</FieldLabel>
            <FieldContent>
              <Input
                autoFocus
                placeholder={t("component.search.type.titledesc")}
                value={title}
                disabled={!!comment}
                onChange={(event) => setTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void submit();
                }}
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
                  <ComboboxEmpty>{channelSearch.trim().length < 2 ? t("component.search.typeTwoCharacters") : t("component.search.noChannelsFound")}</ComboboxEmpty>
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
                  <ComboboxChipsInput placeholder={topicsLoading ? t("component.search.loading") : t("component.search.type.topic")} onFocus={() => { void fetchTopics(); }} />
                </ComboboxChips>
                <ComboboxContent anchor={topicAnchor}>
                  <ComboboxEmpty>{topicsLoading ? t("component.search.loading") : t("component.search.noTopicsFound")}</ComboboxEmpty>
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
                <ComboboxChipsInput placeholder={t("component.search.type.org")} onFocus={() => { void app.fetchOrgs(); }} />
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

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={clearAll}>
              <X className="size-4" />
              {t("component.search.clear")}
            </Button>
            <Button type="button" onClick={() => void submit()}>
              <Search className="size-4" />
              {t("component.search.searchLabel")}
            </Button>
          </div>
        </FieldGroup>
      </PopoverContent>
      </Popover>
    </div>
  );
}
