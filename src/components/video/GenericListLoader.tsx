"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "@/lib/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Pagination, PaginationContent, PaginationItem, PaginationLink } from "@/components/ui/pagination";
import { Spinner } from "@/components/ui/spinner";
import { useTranslations } from "next-intl";
import { useAppState } from "@/lib/store";
import { extractListPayload } from "@/lib/video-format";
const CACHE_PREFIX = "gll:";
const STATUSES = Object.freeze({ READY: 0, LOADING: 1, ERROR: 2, COMPLETED: 3 });
type PagePayload = { items: any[]; total: number | null; offset: number | null };
type StoredSnapshot = { items: any[]; total?: number | null; page?: number | null; nextPage?: number | null };
const pageCacheStore = new Map<string, Map<number, PagePayload>>();

function parsePage(value: string | null | undefined) {
  return Math.max(1, Number.parseInt(value || "1", 10) || 1);
}

function getPageCache(cacheKey: string) {
  if (!cacheKey) return new Map<number, PagePayload>();
  let cache = pageCacheStore.get(cacheKey);
  if (!cache) {
    cache = new Map<number, PagePayload>();
    pageCacheStore.set(cacheKey, cache);
  }
  return cache;
}

function readCache(cacheKey: string): StoredSnapshot | null {
  if (!cacheKey || typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return { items: parsed };
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.items)) return parsed as StoredSnapshot;
    return null;
  } catch {
    return null;
  }
}

function cachedSnapshotForPage(cacheKey: string, page: number, paginate: boolean) {
  const payload = paginate ? getPageCache(cacheKey).get(page) : undefined;
  if (payload) return { items: payload.items, total: payload.total, page };
  const stored = readCache(cacheKey);
  if (!stored) return null;
  if (paginate && stored.page && stored.page !== page) return null;
  if (paginate && !stored.page && page !== 1) return null;
  return stored;
}

export function GenericListLoader({
  infiniteLoad = false,
  paginate = false,
  preloadAdjacent = false,
  keepPreviousData = false,
  getCachedPage,
  loadFn,
  perPage = 24,
  cacheKey = "",
  children,
}: {
  infiniteLoad?: boolean;
  paginate?: boolean;
  preloadAdjacent?: boolean;
  keepPreviousData?: boolean;
  getCachedPage?: (cacheKey: string, page: number, limit: number) => any | null | undefined;
  loadFn: (offset: number, limit: number) => Promise<any>;
  perPage?: number;
  cacheKey?: string;
  children: (state: { data: any[]; isLoading: boolean; isFetching: boolean }) => React.ReactNode;
}) {
  const app = useAppState();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routePage = parsePage(searchParams.get("page"));
  const [currentPage, setCurrentPage] = useState(routePage);
  const readExternalPage = useCallback((page: number) => {
    if (!getCachedPage) return undefined;
    const raw = getCachedPage(cacheKey, page, perPage);
    if (raw === null || raw === undefined) return undefined;
    return extractListPayload(raw);
  }, [cacheKey, getCachedPage, perPage]);
  const [initialCache] = useState<StoredSnapshot | null>(() => {
    const cached = app.hydrated ? cachedSnapshotForPage(cacheKey, currentPage, paginate) : null;
    const external = readExternalPage(currentPage);
    return external ? { items: external.items, total: external.total, page: currentPage } : cached;
  });
  const [data, setData] = useState<any[]>(initialCache?.items || []);
  const [total, setTotal] = useState<number | null>(initialCache?.total ?? null);
  const [isLoading, setIsLoading] = useState(!initialCache);
  const [isFetching, setIsFetching] = useState(false);
  const [status, setStatus] = useState<number>(STATUSES.READY);
  const [nextPage, setNextPage] = useState(initialCache?.nextPage || (initialCache && infiniteLoad ? Math.ceil(initialCache.items.length / perPage) + 1 : 1));
  const [identifier, setIdentifier] = useState(0);
  const restoredFromCache = useRef(!!initialCache);
  const dataLenRef = useRef(initialCache?.items.length || 0);
  const currentPageRef = useRef(currentPage);
  const requestSeq = useRef(0);
  const pageCacheRef = useRef<Map<number, PagePayload>>(getPageCache(cacheKey));
  const inflightRef = useRef<Map<number, Promise<PagePayload>>>(new Map());
  const sentinel = useRef<HTMLDivElement | null>(null);
  const t = useTranslations();
  const pages = total ? Math.ceil(total / perPage) : 1;
  const pageLessMode = total === null;

  const currentSearchParams = useCallback(() => {
    if (typeof window !== "undefined") return new URLSearchParams(window.location.search);
    return new URLSearchParams(searchParams.toString());
  }, [searchParams]);

  const writeCache = useCallback((next: any[], meta: Omit<StoredSnapshot, "items"> = {}) => {
    if (!cacheKey || next.length === 0) return;
    try { sessionStorage.setItem(CACHE_PREFIX + cacheKey, JSON.stringify({ ...meta, items: next })); } catch {}
  }, [cacheKey]);

  const fetchPage = useCallback((page: number) => {
    const pending = inflightRef.current.get(page);
    if (pending) return pending;
    const targetCache = pageCacheRef.current;
    const targetInflight = inflightRef.current;
    const promise = Promise.resolve(loadFn((page - 1) * perPage, perPage)).then(extractListPayload);
    targetInflight.set(page, promise);
    promise.then((payload) => { targetCache.set(page, payload); }).catch(() => {}).finally(() => { targetInflight.delete(page); });
    return promise;
  }, [loadFn, perPage]);

  const prefetchNeighbors = useCallback((page: number, totalCount: number | null) => {
    for (const target of [page - 1, page + 1]) {
      if (target < 1) continue;
      if (totalCount !== null && (target - 1) * perPage >= totalCount) continue;
      if (pageCacheRef.current.has(target) || inflightRef.current.has(target)) continue;
      void fetchPage(target);
    }
  }, [fetchPage, perPage]);

  const applyPaginatedPayload = useCallback((page: number, payload: PagePayload) => {
    setData(payload.items);
    setTotal(payload.total);
    setIsLoading(false);
    setIsFetching(false);
    restoredFromCache.current = false;
    writeCache(payload.items, { page, total: payload.total });
    const resolvedOffset = payload.offset ?? (page - 1) * perPage;
    if (payload.total === null) {
      setStatus(payload.items.length === 0 ? STATUSES.COMPLETED : STATUSES.READY);
    } else if (resolvedOffset + perPage >= payload.total) {
      setStatus(STATUSES.COMPLETED);
    } else {
      setStatus(STATUSES.READY);
    }
    if (preloadAdjacent) prefetchNeighbors(page, payload.total);
  }, [perPage, preloadAdjacent, prefetchNeighbors, writeCache]);

  const runLoad = useCallback(async (page: number, mode: "infinite" | "paginate") => {
    const usePageCache = mode === "paginate";
    const external = usePageCache ? readExternalPage(page) : undefined;
    if (external && usePageCache) pageCacheRef.current.set(page, external);
    const cached = usePageCache ? (pageCacheRef.current.get(page) || external) : undefined;
    const requestId = ++requestSeq.current;
    if (cached) {
      setIsLoading(false);
      setIsFetching(false);
      setStatus(STATUSES.READY);
    } else {
      setIsFetching(true);
      setIsLoading(dataLenRef.current === 0);
      setStatus(STATUSES.LOADING);
    }
    try {
      const payload = cached ?? (usePageCache ? await fetchPage(page) : extractListPayload(await loadFn((page - 1) * perPage, perPage)));
      if (requestId !== requestSeq.current) return;
      if (usePageCache) pageCacheRef.current.set(page, payload);
      if (mode === "infinite") {
        const { items, total: nextTotal } = payload;
        setIsLoading(false);
        setIsFetching(false);
        setTotal(nextTotal);
        setData((prev) => {
          const next = restoredFromCache.current && page === 1 ? items : prev.concat(items);
          restoredFromCache.current = false;
          writeCache(next, { nextPage: page + 1 });
          return next;
        });
        if (items.length === 0) setStatus(STATUSES.COMPLETED);
        else { setNextPage(page + 1); setStatus(STATUSES.READY); }
      } else {
        applyPaginatedPayload(page, payload);
      }
    } catch (e) {
      console.error(e);
      if (requestId !== requestSeq.current) return;
      setIsLoading(false);
      setIsFetching(false);
      setStatus(STATUSES.ERROR);
    }
  }, [applyPaginatedPayload, fetchPage, loadFn, perPage, readExternalPage, writeCache]);

  useEffect(() => { dataLenRef.current = data.length; }, [data.length]);
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);

  useEffect(() => {
    if (!paginate) return;
    const onPopState = () => setCurrentPage(parsePage(new URLSearchParams(window.location.search).get("page")));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [paginate]);

  useEffect(() => {
    if (!paginate || routePage === currentPageRef.current) return;
    setCurrentPage(routePage);
  }, [paginate, routePage]);

  useLayoutEffect(() => {
    requestSeq.current++;
    pageCacheRef.current = getPageCache(cacheKey);
    inflightRef.current.clear();
    const page = parsePage(typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("page") : undefined);
    currentPageRef.current = page;
    setCurrentPage(page);
    const external = readExternalPage(page);
    if (external && paginate) pageCacheRef.current.set(page, external);
    const cached = external ? { items: external.items, total: external.total, page } : cachedSnapshotForPage(cacheKey, page, paginate);
    if (cached) setData(cached.items);
    else if (!keepPreviousData || dataLenRef.current === 0) setData([]);
    setTotal(cached?.total ?? null);
    setIsLoading(!cached && (!keepPreviousData || dataLenRef.current === 0));
    setIsFetching(false);
    setStatus(STATUSES.READY);
    setNextPage(cached?.nextPage || (cached && infiniteLoad ? Math.ceil(cached.items.length / perPage) + 1 : 1));
    setIdentifier((value) => value + 1);
    restoredFromCache.current = !!cached;
  }, [cacheKey, infiniteLoad, keepPreviousData, paginate, perPage, readExternalPage]);

  useEffect(() => {
    if (!paginate) return;
    if (!identifier) return;
    void runLoad(currentPage, "paginate");
  }, [paginate, currentPage, identifier, runLoad]);

  useEffect(() => {
    if (!infiniteLoad) return;
    if (identifier && !restoredFromCache.current) void runLoad(1, "infinite");
  }, [infiniteLoad, identifier]);

  useEffect(() => {
    if (!infiniteLoad || !("IntersectionObserver" in window) || !sentinel.current) return;
    let frame = 0;
    const loadIfSentinelReached = () => {
      if (status !== STATUSES.READY || !sentinel.current) return;
      const rect = sentinel.current.getBoundingClientRect();
      if (rect.top <= window.innerHeight + 200) void runLoad(nextPage, "infinite");
    };
    const scheduleLoadCheck = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(loadIfSentinelReached);
    };
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && status === STATUSES.READY) void runLoad(nextPage, "infinite");
    }, { root: null, rootMargin: "200px 0px", threshold: 0 });
    observer.observe(sentinel.current);
    scheduleLoadCheck();
    window.addEventListener("scroll", scheduleLoadCheck, { passive: true });
    window.addEventListener("resize", scheduleLoadCheck, { passive: true });
    window.addEventListener("pageshow", scheduleLoadCheck);
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleLoadCheck);
      window.removeEventListener("resize", scheduleLoadCheck);
      window.removeEventListener("pageshow", scheduleLoadCheck);
    };
  }, [infiniteLoad, nextPage, runLoad, status]);

  function goToPage(page: number) {
    if (page < 1) return;
    const external = paginate ? readExternalPage(page) : undefined;
    if (external && paginate) pageCacheRef.current.set(page, external);
    const cached = paginate ? (pageCacheRef.current.get(page) || external) : undefined;
    if (cached) {
      requestSeq.current++;
      applyPaginatedPayload(page, cached);
    }
    setCurrentPage(page);
    const params = currentSearchParams();
    params.set("page", String(page));
    if (typeof window !== "undefined") {
      const nextUrl = `${pathname}${params.toString() ? `?${params}` : ""}${window.location.hash || ""}`;
      window.history.pushState(null, "", nextUrl);
    }
    // Repeat after the next frame so the new page's (possibly shorter) content can't clamp or
    // anchor the scroll position back down.
    const scroll = () => window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    scroll();
    requestAnimationFrame(scroll);
  }
  function pageHref(page: number) {
    const params = currentSearchParams();
    params.set("page", String(page));
    return `${pathname}${params.toString() ? `?${params}` : ""}`;
  }
  function handlePageClick(event: MouseEvent<HTMLAnchorElement>, page: number, disabled = false) {
    event.preventDefault();
    if (!disabled) goToPage(page);
  }

  const visiblePages = useMemo(() => {
    const width = app.windowWidth || 1440;
    const totalVisible = width < 640 ? 5 : width < 768 ? 8 : width < 1024 ? 12 : width < 1280 ? 14 : 16;
    const half = Math.floor(totalVisible / 2);
    let start = Math.max(1, currentPage - half);
    const end = Math.min(pages, start + totalVisible - 1);
    start = Math.max(1, end - totalVisible + 1);
    return Array.from({ length: end - start + 1 }, (_, idx) => start + idx);
  }, [app.windowWidth, currentPage, pages]);

  return (
    <div>
      {children({ data, isLoading, isFetching })}
      {infiniteLoad ? (
        <div ref={sentinel} key={identifier} className="flex min-h-[100px] justify-center py-4">
          {status === STATUSES.LOADING ? <Spinner className="mt-8" /> : null}
          {status === STATUSES.ERROR ? (
            <Alert variant="destructive" className="mt-4 max-w-md">
              <AlertDescription>{t("component.apiError.title")}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      ) : null}
      {paginate ? (
        <div key={identifier} className="flex min-h-[100px] justify-center py-4">
          {!pageLessMode ? (
            <Pagination className={(status === STATUSES.READY || status === STATUSES.COMPLETED || data.length > 0) ? "" : "hidden"}>
	              <PaginationContent className="flex-wrap justify-center gap-2">
	                <PaginationItem>
	                  <PaginationLink href={pageHref(currentPage - 1)} size="sm" aria-label={t("component.pagination.previousPage")} aria-disabled={currentPage === 1} className={currentPage === 1 ? "pointer-events-none opacity-50" : ""} onClick={(event) => handlePageClick(event, currentPage - 1, currentPage === 1)}><ChevronLeft className="size-4" /></PaginationLink>
	                </PaginationItem>
	                {visiblePages.map((pageNumber) => (
	                  <PaginationItem key={`page-${pageNumber}`}>
	                    <PaginationLink href={pageHref(pageNumber)} size="sm" isActive={pageNumber === currentPage} onClick={(event) => handlePageClick(event, pageNumber)}>{pageNumber}</PaginationLink>
	                  </PaginationItem>
	                ))}
	                <PaginationItem>
	                  <PaginationLink href={pageHref(currentPage + 1)} size="sm" aria-label={t("component.pagination.nextPage")} aria-disabled={currentPage === pages} className={currentPage === pages ? "pointer-events-none opacity-50" : ""} onClick={(event) => handlePageClick(event, currentPage + 1, currentPage === pages)}><ChevronRight className="size-4" /></PaginationLink>
	                </PaginationItem>
	              </PaginationContent>
            </Pagination>
          ) : (
            <Pagination className={(status === STATUSES.READY || status === STATUSES.COMPLETED || data.length > 0) ? "" : "hidden"}>
	              <PaginationContent className="flex-wrap justify-center gap-0">
	                <PaginationItem>
	                  <PaginationLink href={pageHref(currentPage - 1)} size="default" aria-disabled={currentPage === 1} className={`m-2 pr-6 ${currentPage === 1 ? "pointer-events-none opacity-50" : ""}`} onClick={(event) => handlePageClick(event, currentPage - 1, currentPage === 1)}><ChevronLeft className="size-4" />{t("component.paginateLoad.newer")}</PaginationLink>
	                </PaginationItem>
	                <PaginationItem>
	                  <PaginationLink href={pageHref(currentPage + 1)} size="default" aria-disabled={status === STATUSES.COMPLETED} className={`m-2 pl-6 ${status === STATUSES.COMPLETED ? "pointer-events-none opacity-50" : ""}`} onClick={(event) => handlePageClick(event, currentPage + 1, status === STATUSES.COMPLETED)}>{t("component.paginateLoad.older")}<ChevronRight className="size-4" /></PaginationLink>
	                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      ) : null}
    </div>
  );
}
