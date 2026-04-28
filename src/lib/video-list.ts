import { videoTemporalComparator } from "@/lib/functions";
import { videoEndTimestamp } from "@/lib/video-format";

export function extractItems(payload: any) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  return (
    (Object.values(payload).find((value) => Array.isArray(value)) as any[]) || []
  );
}

export function extractListPayload(payload: any) {
  return {
    items: extractItems(payload),
    total: typeof payload?.total === "number" ? payload.total : null,
    offset: typeof payload?.offset === "number" ? payload.offset : null,
  };
}

export function dedupeVideos(videos: any[]) {
  return Array.from(new Map((videos || []).map((video) => [video.id, video])).values());
}

export function sortVideosForTab(items: any[], isArchive: boolean) {
  if (!isArchive) return [...(items || [])].sort((a, b) => videoTemporalComparator(b, a));
  return (items || [])
    .map((item, index) => ({ item, index, endTime: videoEndTimestamp(item), id: String(item?.id || "") }))
    .sort((a, b) => b.endTime - a.endTime || b.id.localeCompare(a.id) || a.index - b.index)
    .map(({ item }) => item);
}
