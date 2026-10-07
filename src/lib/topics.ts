"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { readJSON, writeJSON } from "@/lib/browser";

const TOPICS_STORAGE_KEY = "holodex-topics-cache";

export type TopicOption = { value: string; count?: number };

// Topic list shaped for select/combobox options: value + "id (count)" label.
export async function fetchTopicOptions() {
  const { data } = await api.topics();
  return (data || []).map((topic: any) => ({
    value: topic.id,
    text: `${topic.id} (${topic.count ?? 0})`,
  }));
}

// localStorage-backed cache of the /topics list, shared by the nav filters and the search dropdown.
// The list is only shown once a topic picker opens (which calls fetchTopics), so the cache is
// read lazily there instead of in a mount effect: cached topics show immediately, then refresh.
export function useTopicsCache() {
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const requested = useRef(false);

  async function fetchTopics() {
    if (requested.current) return;
    requested.current = true;
    const cached = readJSON<TopicOption[]>(TOPICS_STORAGE_KEY, []);
    if (cached.length) setTopics(cached);
    else setTopicsLoading(true);
    try {
      const { data }: any = await api.topics();
      const next = (data || []).map(({ id, count }: any) => ({ value: id, count }));
      setTopics(next);
      writeJSON(TOPICS_STORAGE_KEY, next);
    } catch (e) {
      requested.current = false;
      throw e;
    } finally {
      setTopicsLoading(false);
    }
  }

  return { topics, topicsLoading, fetchTopics };
}
