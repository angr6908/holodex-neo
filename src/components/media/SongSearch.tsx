"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Command, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { useTranslations } from "next-intl";
import { jsonpItunes, type ItunesTrack } from "@/lib/api";
import { formatDuration } from "@/lib/time";
import * as icons from "@/lib/icons";

type SongSearchItem = ItunesTrack & {
  index?: string;
  src?: string;
};

type SongSearchProps = {
  value?: SongSearchItem | null;
  id?: number | null;
  autofocus?: boolean;
  onInput?: (value: SongSearchItem | null) => void;
};

export function SongSearch({ value, autofocus = false, onInput }: SongSearchProps) {
  const t = useTranslations();
  const [query, setQuery] = useState<SongSearchItem | null>(value || null);
  const [search, setSearch] = useState("");
  const [fromApi, setFromApi] = useState<SongSearchItem[]>([]);
  const [openMenu, setOpenMenu] = useState(false);
  const [isComposing, setIsComposing] = useState(false);

  const results = fromApi.concat(query ? [query] : []);
  useEffect(() => { setQuery(value || null); }, [value]);
  useEffect(() => {
    if (isComposing) return;
    const val = search;
    const timer = setTimeout(() => void performSearch(val), 500);
    return () => clearTimeout(timer);
  }, [search, isComposing]);
  useEffect(() => { if (query) onInput?.(query); }, [query]);

  async function performSearch(val: string) {
    if (!val) return;
    setOpenMenu(true);
    setFromApi([]);
    if (encodeURIComponent(val).length <= 2) return;

    const [md, res] = await Promise.all([searchMusicdex(val), searchRegionsAlternative(val, "JP")]);

    setFromApi([
      ...md.slice(0, 3),
      ...(res || []).map((track) => ({
        trackId: track.trackId,
        trackTimeMillis: track.trackTimeMillis,
        collectionName: track.collectionName,
        releaseDate: track.releaseDate,
        artistName: track.artistName,
        trackName: track.trackCensoredName || track.trackName,
        artworkUrl100: track.artworkUrl100,
        trackViewUrl: track.trackViewUrl,
        src: "iTunes",
        index: `iTunes${track.trackId}`,
      })),
    ]);
  }

  async function searchRegionsAlternative(queryStr: string, country = "JP", regions: string[] = ["ja_jp", "en_us"]) {
    const ids = new Set<number>();
    const responses = await Promise.all(regions.map((lang) => jsonpItunes(queryStr, { country, lang, limit: 10 })));

    return responses.flatMap((data) => data.results || []).filter((song) => {
      if (ids.has(song.trackId)) return false;
      ids.add(song.trackId);
      return true;
    });
  }

  async function searchMusicdex(queryStr: string): Promise<SongSearchItem[]> {
    try {
      const searchBody = {
        query: {
          bool: {
            must: [{
              bool: {
                must: [
                  {
                    multi_match: {
                      query: queryStr,
                      fields: ["general^3", "general.romaji^0.5", "original_artist^2", "original_artist.romaji^0.5"],
                      type: "most_fields",
                    },
                  },
                  {
                    multi_match: {
                      query: queryStr,
                      fields: ["name.ngram", "name"],
                      type: "most_fields",
                    },
                  },
                ],
              },
            }],
          },
        },
        size: 12,
        _source: { includes: ["*"], excludes: [] },
        from: 0,
        sort: [{ _score: { order: "desc" } }],
      };
      const resp = await fetch("/api/v2/musicdex/elasticsearch/search", {
        method: "POST",
        headers: { "Content-Type": "application/x-ndjson", Accept: "application/json, text/plain, */*" },
        body: `{"preference":"results"}\n${JSON.stringify(searchBody)}\n`,
      });
      const data = await resp.json();

      return data?.responses?.[0]?.hits?.hits?.map(({ _source }: any) => ({
        trackId: _source.itunesid,
        artistName: _source.original_artist,
        trackName: _source.name,
        trackTimeMillis: (_source.end - _source.start) * 1000,
        trackViewUrl: _source.amUrl,
        artworkUrl100: _source.art,
        src: "Musicdex",
        index: `Musicdex${_source.itunesid}`,
      })) || [];
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  function clearSelection() { setQuery(null); onInput?.(null); }
  function selectItem(item: SongSearchItem) {
    setQuery(item);
    setSearch("");
    setFromApi([]);
    setOpenMenu(false);
  }

  function renderSongSummary(item: SongSearchItem, showSource = false) {
    return (
      <>
        {item.artworkUrl100 ? <img src={item.artworkUrl100} className="h-12 w-12 rounded-lg object-cover" alt="" /> : null}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-[color:var(--color-foreground)]">
            🎵 {item.trackName} [{formatDuration(item.trackTimeMillis)}]
          </div>
          <div className="truncate text-xs text-[color:var(--color-muted-foreground)]">
            🎤 {item.artistName}
            {item.collectionName ? ` / ${item.collectionName}` : ""}
            {item.releaseDate ? ` / ${item.releaseDate.slice(0, 7)}` : ""}
            {showSource && item.src ? (
              <Badge variant="outline" className="ml-1 border-white/10 px-1.5 text-[10px] font-normal text-current uppercase opacity-60">
                {item.src}
              </Badge>
            ) : null}
          </div>
        </div>
      </>
    );
  }

  return (
    <Popover open={openMenu && results.length > 0} onOpenChange={setOpenMenu}>
      <PopoverTrigger
        nativeButton={false}
        render={<Card className="gap-0 rounded-[calc(var(--radius)+4px)] border-white/10 bg-white/6 p-2 shadow-xl shadow-slate-950/20" />}
      >
          {query ? (
            <div className="mb-2 flex items-center gap-3 rounded-xl border border-white/10 bg-white/6 px-3 py-2">
              {renderSongSummary(query)}
              <Button type="button" variant="ghost" size="icon-xs" className="text-[color:var(--color-primary)] hover:bg-white/6" onClick={clearSelection}>
                <icons.XIcon className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
          <Input
            value={search}
            autoFocus={autofocus}
            placeholder={t("editor.music.itunesLookupPlaceholder")}
            className="border-0 bg-transparent shadow-none focus:ring-0"
            onFocus={() => setOpenMenu(true)}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => {
              setIsComposing(false);
              void performSearch(search);
            }}
          />
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-[var(--anchor-width)] p-0">
        <Command shouldFilter={false}>
          <CommandList>
            {results.map((item, index) => (
              <CommandItem
                key={item.index || item.trackId || index}
                value={`${item.index || item.trackId || index}`}
                onSelect={() => selectItem(item)}
              >
                {renderSongSummary(item, true)}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
