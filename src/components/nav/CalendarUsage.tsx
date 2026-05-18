"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Users, ClipboardPlus, MessageSquare, Filter, SearchCheck } from "@/lib/icons";
import { api } from "@/lib/api";
import { useAppState } from "@/lib/store";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Combobox, ComboboxChip, ComboboxChips, ComboboxChipsInput, ComboboxContent, ComboboxEmpty, ComboboxItem, ComboboxList, useComboboxAnchor } from "@/components/ui/combobox";
import { toast } from "sonner";
import * as icons from "@/lib/icons";

export function CalendarUsage({ initialQuery, showFavoritesCalendar = true }: { initialQuery?: any[] | false; showFavoritesCalendar?: boolean }) {
  const t = useTranslations();
  const app = useAppState();
  const filterAnchor = useComboboxAnchor();
  const [query, setQuery] = useState<any[]>(Array.isArray(initialQuery) ? initialQuery : []);
  const [fromApi, setFromApi] = useState<any[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const requestId = useRef(0);

  const results = useMemo(() => {
    const selected = new Set((query || []).map((item) => item.value));
    return (fromApi || []).filter((item) => !selected.has(item.value));
  }, [fromApi, query]);
  const resultValues = useMemo(() => results.map((item) => item.value), [results]);
  const itemsByValue = useMemo(() => new Map([...query, ...fromApi].map((item) => [item.value, item])), [fromApi, query]);

  const preferEnglishName = app.settings.useEnglishName;
  const liveCalendarURL = useMemo(() => {
    const bucket = query.reduce((b: any, { type, value }: any) => { b[type] ||= []; b[type].push(value); return b; }, {});
    const params = { ...bucket, ...(preferEnglishName ? { preferEnglishName: 1 } : null) } as any;
    return `https://holodex.net/live.ics?${new URLSearchParams(params).toString()}`;
  }, [query, preferEnglishName]);
  const favoritesCalendarURL = useMemo(() => {
    const jwt = app.userdata?.jwt;
    if (!jwt) return t("component.calendar.favoritesLoginRequired");
    const params = { jwt, ...(preferEnglishName ? { preferEnglishName: 1 } : null) } as any;
    return `https://holodex.net/favorites.ics?${new URLSearchParams(params).toString()}`;
  }, [app.userdata?.jwt, preferEnglishName, t]);

  async function runSearch(formatted: string) {
    const current = ++requestId.current;
    try {
      const res = await api.searchAutocomplete(formatted);
      if (current !== requestId.current) return;
      const next = (res.data || []).map((x: any) => ({ ...x, text: x.text || x.value })).filter((x: any) => x.type === "topic" || x.type === "channel" || x.type === "org");
      setFromApi(next);
    } catch (e) { if (current === requestId.current) setFromApi([]); console.error(e); }
    finally { if (current === requestId.current) setIsLoading(false); }
  }

  useEffect(() => { if (Array.isArray(initialQuery)) setQuery(initialQuery); }, [initialQuery]);
  useEffect(() => {
    const formatted = (searchInput || "").trim().replace("#", "");
    if (!formatted || encodeURIComponent(formatted).length <= 1) { setFromApi([]); setIsLoading(false); return; }
    setIsLoading(true);
    const timer = setTimeout(() => runSearch(formatted), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);
  function getItemIcon(type: string) { switch (type) { case "channel": case "video url": return icons.YoutubeIcon; case "topic": return icons.CirclePlay; case "org": return Users; case "title & desc": return SearchCheck; case "comments": return MessageSquare; default: return null; } }
  function constrainQuery(next: any[]) { if (next.filter((x) => x.type === "org").length > 1) next.splice(next.findIndex((x) => x.type === "org"), 1); return next; }
  async function copyToClipboard(url: string) { await navigator.clipboard.writeText(url); toast.success(t("component.videoCard.copiedToClipboard")); }
  function updateQuery(values: string[]) {
    setQuery(constrainQuery(values.map((value) => itemsByValue.get(value)).filter(Boolean)));
    setSearchInput("");
    setFromApi([]);
  }
  function i18nItem(item: string) { switch (item) { case "channel": return t("component.search.type.channel"); case "video url": return t("component.search.type.videourl"); case "topic": return t("component.search.type.topic"); case "org": return t("component.search.type.org"); case "title & desc": return t("component.search.type.titledesc"); case "comments": return t("component.search.type.comments"); default: return ""; } }

  return <div className="space-y-4">
    <div className="relative">
      <div className="flex flex-col gap-[0.45rem]">
	        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Filter className="h-4 w-4" /><span>{t("component.search.filterByTopicOrgChannel")}</span></div>
        <Combobox multiple items={resultValues} value={query.map((item) => item.value)} inputValue={searchInput} filter={null} onInputValueChange={setSearchInput} onValueChange={updateQuery}>
          <ComboboxChips ref={filterAnchor}>
            {query.map((item) => <ComboboxChip key={item.value} className="max-w-full"><span className="shrink-0 text-muted-foreground">{i18nItem(item.type)}</span><span className="min-w-0 truncate whitespace-nowrap">{item.text}</span></ComboboxChip>)}
	            <ComboboxChipsInput placeholder={t("component.search.topicOrgChannelPlaceholder")} />
	          </ComboboxChips>
	          <ComboboxContent anchor={filterAnchor}>
	            <ComboboxEmpty>{isLoading ? t("component.search.loading") : searchInput.trim().length < 2 ? t("component.search.typeTwoCharacters") : t("component.search.noResultsFound")}</ComboboxEmpty>
            <ComboboxList>
              {(value: string, index: number) => {
                const item = itemsByValue.get(value);
                if (!item) return null;
                const itemIcon = getItemIcon(item.type);
                return (
                  <ComboboxItem key={value} value={value} index={index}>
                    {itemIcon ? (() => { const C = itemIcon; return <C className="size-4 text-muted-foreground" />; })() : null}
                    <span className="text-muted-foreground">{i18nItem(item.type)}</span>
                    <span>{item.text}</span>
                  </ComboboxItem>
                );
              }}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>
    </div>
    <div className="space-y-2">
      <Label className="text-sm text-muted-foreground">{t("component.calendar.liveCalendar")}</Label>
      <Button type="button" variant="outline" className="h-auto w-full justify-between text-left font-normal whitespace-normal" onClick={(e) => { e.stopPropagation(); copyToClipboard(liveCalendarURL); }}>
        <span className="truncate">{liveCalendarURL}</span>
        <ClipboardPlus className="ml-3 size-4 shrink-0 text-primary" />
      </Button>
    </div>
    {app.isLoggedIn && showFavoritesCalendar ? (
      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">{t("component.calendar.favoritesCalendar")}</Label>
      <Button type="button" variant="outline" className="h-auto w-full justify-between text-left font-normal whitespace-normal" onClick={(e) => { e.stopPropagation(); copyToClipboard(favoritesCalendarURL); }}>
          <span className="truncate">{favoritesCalendarURL}</span>
          <ClipboardPlus className="ml-3 size-4 shrink-0 text-primary" />
        </Button>
      </div>
    ) : null}
  </div>;
}
