"use client";

import { useEffect, useId, useState } from "react";
import { api } from "@/lib/api";
import { CHANNEL_TYPES } from "@/lib/consts";
import { Input } from "@/components/ui/Input";

export function ChannelAutocomplete({ value, onChange, label = "Search Channels" }: { value?: any; onChange?: (value: any) => void; label?: string }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const reactId = useId();
  const datalistId = `channel-autocomplete-${reactId.replace(/:/g, "")}`;
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!search) { setResults([]); return; }
      api.searchChannel({ type: CHANNEL_TYPES.VTUBER, queryText: search }).then(({ data }: any) => {
        setResults((data || []).map((d: any) => ({ text: `${d.english_name ? `${d.english_name},` : ""} ${d.name} (${d.id})`, value: d })));
      }).catch(() => setResults([]));
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);
  function handleInput(next: string) {
    setSearch(next);
    const match = results.find((item) => item.text === next);
    onChange?.(match ? match.value : next);
  }
  return <div className="space-y-2"><Input value={search} list={datalistId} placeholder={label} onChange={(e) => handleInput(e.target.value)} /><datalist id={datalistId}>{results.map((item, index) => <option key={`${item.value.id}-${index}`} value={item.text} />)}</datalist></div>;
}
