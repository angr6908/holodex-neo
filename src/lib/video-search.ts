// Requests to Holodex's v3 video search. Shared by the client (api.searchVideo) and the server
// route that searches one org at a time (app/api/search/multi-org), so both page and read
// results the same way.

// v3 returns at most 50 videos per request and pages no further than its first 5000 results.
export const VIDEO_SEARCH_MAX_LIMIT = 50;
export const VIDEO_SEARCH_RESULT_WINDOW = 5000;

// `q` holds the filters (search, vtuber, topic, org, type); `sort` is a v3 sort name.
export type VideoSearchQuery = { q: Record<string, any>; sort: string };
export type VideoSearchPage = { items: any[]; total: number | null };

// The request body for one page, with its size trimmed to what v3 serves, or null when the page
// lies past the results v3 can reach.
export function videoSearchBody(query: VideoSearchQuery, offset: number, limit: number) {
  const size = Math.min(limit, VIDEO_SEARCH_MAX_LIMIT, VIDEO_SEARCH_RESULT_WINDOW - offset);
  return size > 0 ? { ...query, offset, limit: size } : null;
}

// v3 answers with raw Elasticsearch hits; reduce them to the videos and a total no larger than
// the results that can be paged to.
export function videoSearchPage(data: any): VideoSearchPage {
  const hits = data?.hits;
  const total = typeof hits?.total === "number" ? hits.total : hits?.total?.value;
  return {
    items: Array.isArray(hits?.hits)
      ? hits.hits.map((hit: any) => hit?._source).filter(Boolean)
      : [],
    total: typeof total === "number" ? Math.min(total, VIDEO_SEARCH_RESULT_WINDOW) : null,
  };
}
