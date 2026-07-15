"use client";

import { useEffect, useState } from "react";
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
export function useTopicsCache() {
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);

  useEffect(() => {
    setTopics(readJSON(TOPICS_STORAGE_KEY, []));
  }, []);

  async function fetchTopics() {
    if (topics.length || topicsLoading) return;
    setTopicsLoading(true);
    try {
      const { data }: any = await api.topics();
      const next = (data || []).map(({ id, count }: any) => ({ value: id, count }));
      setTopics(next);
      writeJSON(TOPICS_STORAGE_KEY, next);
    } finally {
      setTopicsLoading(false);
    }
  }

  return { topics, topicsLoading, fetchTopics };
}
