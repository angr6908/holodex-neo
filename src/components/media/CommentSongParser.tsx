"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import { jsonpItunes, type ItunesTrack } from "@/lib/api";
import { formatDuration, secondsToHuman } from "@/lib/time";
import { useTranslations } from "next-intl";
import * as icons from "@/lib/icons";

const TS_PARSING_REGEX = /(?<pre>.*?)(?:(?<s_h>[0-5]?[0-9]):)?(?<s_m>[0-5]?[0-9]):(?<s_s>[0-5][0-9])(?:(?<mid>.*?)(?:(?:(?<e_h>[0-5]?[0-9]):)?(?<e_m>[0-5]?[0-9]):(?<e_s>[0-5][0-9])))?(?<post>.*?)?$/gm;

type TimestampGroups = {
  e_h?: string;
  e_m?: string;
  e_s?: string;
  mid?: string;
  post?: string;
  pre?: string;
  s_h?: string;
  s_m?: string;
  s_s?: string;
};

type CommentCandidate = {
  comment_key: string | number;
  message?: string;
};

type TimeframeSelection = {
  end_human?: string;
  end_time?: number;
  index: number;
  start_human: string;
  start_time: number;
  tokens: string[];
};

type ItunesLookupResult = ItunesTrack;

function capgroupToSecs(hours?: string, minutes?: string, seconds?: string) {
  if (!hours && !minutes && !seconds) return undefined;
  return Number(hours || 0) * 3600 + Number(minutes || 0) * 60 + Number(seconds || 0);
}

function tokensFrom(groups: TimestampGroups) {
  return [groups.pre, groups.mid, groups.post]
    .join(" ")
    .split(/[-,~|/／\u3000\s]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 1)
    .slice(0, 12);
}

function buildSelection(match: RegExpMatchArray): TimeframeSelection {
  const groups = (match.groups || {}) as TimestampGroups;
  const start = capgroupToSecs(groups.s_h, groups.s_m, groups.s_s) || 0;
  const end = capgroupToSecs(groups.e_h, groups.e_m, groups.e_s);

  return {
    index: match.index || 0,
    start_time: start,
    end_time: end,
    start_human: secondsToHuman(start).replace(/^0:/, ""),
    end_human: end ? secondsToHuman(end).replace(/^0:/, "") : undefined,
    tokens: tokensFrom(groups),
  };
}

export function CommentSongParser({
  comments,
  onSongSelected,
}: {
  comments: CommentCandidate[];
  onSongSelected?: (timeframe: TimeframeSelection, songdata?: ItunesLookupResult) => void;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(true);
  const [selection, setSelection] = useState<TimeframeSelection[]>([]);
  const [searchResult, setSearchResult] = useState<ItunesLookupResult[]>([]);
  const [searchResultIdx, setSearchResultIdx] = useState(-1);

  useEffect(() => {
    if (!comments?.length) return;

    const chosen = comments
      .map(({ comment_key, message = "" }) => ({
        comment_key,
        message,
        size: [...message.matchAll(TS_PARSING_REGEX)].length,
      }))
      .sort((a, b) => b.size - a.size)[0];

    if (!chosen?.size) return;
    setSelection([...chosen.message.matchAll(TS_PARSING_REGEX)].map(buildSelection));
  }, [comments]);

  async function tryLooking(token: string, idx: number) {
    setSearchResultIdx(idx);

    const [jp, us] = await Promise.all([
      jsonpItunes(token, { country: "JP", limit: 12 }),
      jsonpItunes(token, { country: "US", limit: 12 }),
    ]);
    const lookupEn = us.results || [];

    setSearchResult(
      (jp.results || []).map((track) => {
        const foundEn = lookupEn.find((item) => item.trackId === track.trackId);

        return {
          ...track,
          trackName: foundEn?.trackCensoredName || foundEn?.trackName || track.trackCensoredName || track.trackName,
        };
      }),
    );
  }

  return (
    <Card className="p-4">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger
          render={
            <Button type="button" variant="ghost" className="h-auto w-full justify-start p-0 text-base font-medium" />
          }
        >
          {t("component.media.automatedSongHelper")}
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4">
          <h5 className="mb-3 text-sm font-semibold">{t("component.media.clickSearchableTimestamp")}</h5>

          {selection.map((timeframe, idx) => (
            <div key={`s${timeframe.index}`} className="mb-4">
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => onSongSelected?.(timeframe)}>
                  [{timeframe.start_human + (timeframe.end_time ? `\t- ${timeframe.end_human}` : "\t- ?")}]
                </Button>

                {timeframe.tokens.map((token, tokenidx) => (
                  <Button
                    key={`s${timeframe.index}t${tokenidx}`}
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => void tryLooking(token, idx)}
                  >
                    {token}
                  </Button>
                ))}
              </div>

              {idx === searchResultIdx ? (
                <div className="mt-3">
                  <div className="flex justify-end">
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setSearchResultIdx(-1)}>
                      <icons.XIcon className="size-4" />
                    </Button>
                  </div>
                  <h5 className="px-2 py-2 text-sm font-medium">{t("editor.music.pickItunesResult")}</h5>
                  <div className="mt-2 space-y-2">
                    {searchResult.map((song) => (
                      <Button
                        key={`itn${song.trackId}`}
                        type="button"
                        variant="ghost"
                        className="h-auto w-full justify-start gap-3 px-3 py-2 text-left font-normal"
                        onClick={() => onSongSelected?.(timeframe, song)}
                      >
                        <img src={song.artworkUrl100} alt="" className="h-12 w-12 rounded-md object-cover" />
                        <div className="min-w-0">
                          <div className="truncate text-sm">
                            🎵 {song.trackName} [{formatDuration(song.trackTimeMillis)}]
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            🎤 {song.artistName} / {song.collectionName} / {song.releaseDate ? song.releaseDate.slice(0, 7) : ""}
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
