"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { api } from "@/lib/api";
import { CHANNEL_TYPES } from "@/lib/consts";
export function ChannelAutocomplete({
  value,
  onChange,
  label,
}: {
  value?: any;
  onChange?: (value: any) => void;
  label?: string;
}) {
  const t = useTranslations();
  const [search, setSearch] = useState(() => channelLabel(value));
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    if (value?.id) setSearch(channelLabel(value));
  }, [value]);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!search) {
        setResults([]);
        return;
      }
      api
        .searchChannel({ type: CHANNEL_TYPES.VTUBER, queryText: search })
        .then(({ data }: any) => {
          setResults(
            (data || []).map((d: any) => ({
              text: `${d.english_name ? `${d.english_name},` : ""} ${d.name} (${d.id})`,
              value: d,
            })),
          );
        })
        .catch(() => setResults([]));
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const selectedValue = value?.id || "";
  const options = useMemo(() => {
    const merged = [...results];
    if (value?.id && !merged.some((item) => item.value.id === value.id)) {
      merged.unshift({ text: channelLabel(value), value });
    }
    return merged;
  }, [results, value]);
  const optionValues = useMemo(() => options.map((item) => item.value.id), [options]);
  const labels = useMemo(
    () => new Map(options.map((item) => [item.value.id, item.text])),
    [options],
  );
  const byId = useMemo(
    () => new Map(options.map((item) => [item.value.id, item.value])),
    [options],
  );

  function selectChannel(next: string | null) {
    if (!next) {
      setSearch("");
      onChange?.("");
      return;
    }
    const channel = byId.get(next);
    setSearch(labels.get(next) || next);
    onChange?.(channel || next);
  }

  return (
    <Combobox
      items={optionValues}
      value={selectedValue}
      inputValue={search}
      itemToStringLabel={(item) => labels.get(item) || item}
      onInputValueChange={setSearch}
      onValueChange={selectChannel}
    >
      <ComboboxInput
        placeholder={label ?? t("component.search.searchChannels")}
        showClear={!!selectedValue || !!search}
      />
      <ComboboxContent>
        <ComboboxEmpty>
          {search.trim().length < 2
            ? t("component.search.typeTwoCharacters")
            : t("component.search.noChannelsFound")}
        </ComboboxEmpty>
        <ComboboxList>
          {(item: string, index: number) => (
            <ComboboxItem key={item} value={item} index={index}>
              {labels.get(item) || item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

function channelLabel(channel: any) {
  if (!channel?.id) return "";
  return `${channel.english_name ? `${channel.english_name},` : ""} ${channel.name || channel.id} (${channel.id})`;
}
