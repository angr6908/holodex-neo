"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { getVideoIDFromUrl } from "@/lib/functions";
import { useOptionalMultiviewStore } from "@/lib/multiview-store";
import * as icons from "@/lib/icons";

function readHistory(key: string) {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
}

function writeHistory(key: string, value: string[]) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function CustomUrlField({ twitch = false, slim = false, onSuccess }: { twitch?: boolean; slim?: boolean; onSuccess?: (content: any) => void }) {
  const store = useOptionalMultiviewStore();
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);
  const localKey = twitch ? "holodex-v2-multiview-tw-url-history" : "holodex-v2-multiview-yt-url-history";
  const [localHistory, setLocalHistory] = useState<string[]>([]);
  const historyId = twitch ? "multiview-twitch-history" : "multiview-youtube-history";
  const hint = twitch ? "https://www.twitch.tv/..." : "https://www.youtube.com/watch?v=...";
  const label = twitch ? "Twitch Channel Link" : "Youtube Video Link";
  const history = useMemo(() => [...(store ? (twitch ? store.twUrlHistory : store.ytUrlHistory) : localHistory)].reverse(), [store, twitch, localHistory]);

  useEffect(() => { if (!store) setLocalHistory(readHistory(localKey)); }, [store, localKey]);
  useEffect(() => { setUrl(""); setError(false); }, [twitch]);

  function addHistory(value: string) {
    if (store) {
      store.addUrlHistory({ twitch, url: value });
      return;
    }
    setLocalHistory((prev) => {
      const next = prev.filter((item) => item !== value);
      next.push(value);
      while (next.length > 8) next.shift();
      writeHistory(localKey, next);
      return next;
    });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const content = getVideoIDFromUrl(url) as any;
    if (content?.id) {
      setError(false);
      onSuccess?.(content);
      if (!history.includes(url)) addHistory(url);
      setUrl("");
    } else {
      setError(true);
    }
  }

  return (
    <form className="flex w-full items-center gap-2 px-3" onSubmit={handleSubmit}>
      <Input value={url} list={historyId} placeholder={slim ? hint : label} className={error ? "border-amber-400/60 focus:border-amber-400/70 focus:ring-amber-400/20" : ""} onChange={(event) => { setUrl(event.target.value); if (error) setError(false); }} />
      <datalist id={historyId}>{history.map((item) => <option key={item} value={item} />)}</datalist>
      <Button type="submit" size="icon" variant={(url && !error) ? "default" : "outline"}><Icon icon={icons.mdiCheck} /></Button>
    </form>
  );
}
