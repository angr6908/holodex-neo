"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Command, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { useTranslations } from "next-intl";
import { api, jsonpItunes, type ItunesTrack } from "@/lib/api";
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
      const hits = await api.searchMusicdexSongs(queryStr);
      return hits.map(({ _source }: any) => ({
        trackId: _source.itunesid,
        artistName: _source.original_artist,
        trackName: _source.name,
        trackTimeMillis: (_source.end - _source.start) * 1000,
        trackViewUrl: _source.amUrl,
        artworkUrl100: _source.art,
        src: "Musicdex",
        index: `Musicdex${_source.itunesid}`,
      }));
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
          <div className="truncate text-sm text-foreground">
            🎵 {item.trackName} [{formatDuration(item.trackTimeMillis)}]
          </div>
          <div className="truncate text-xs text-muted-foreground">
            🎤 {item.artistName}
            {item.collectionName ? ` / ${item.collectionName}` : ""}
            {item.releaseDate ? ` / ${item.releaseDate.slice(0, 7)}` : ""}
            {showSource && item.src ? (
              <Badge variant="outline" className="ml-1">
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
        render={<Card className="gap-0 p-2" />}
      >
          {query ? (
            <div className="mb-2 flex items-center gap-3 rounded-xl border px-3 py-2">
              {renderSongSummary(query)}
              <Button type="button" variant="ghost" size="icon-xs" onClick={clearSelection}>
                <icons.XIcon className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
          <Input
            value={search}
            autoFocus={autofocus}
            placeholder={t("editor.music.itunesLookupPlaceholder")}
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
