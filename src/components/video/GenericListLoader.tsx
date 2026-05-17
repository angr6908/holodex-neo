"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type MouseEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "@/lib/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Pagination, PaginationContent, PaginationItem, PaginationLink } from "@/components/ui/pagination";
import { Spinner } from "@/components/ui/spinner";
import { useTranslations } from "next-intl";
import { useAppState } from "@/lib/store";
import { extractListPayload } from "@/lib/video-format";
const CACHE_PREFIX = "gll:";
const STATUSES = Object.freeze({ READY: 0, LOADING: 1, ERROR: 2, COMPLETED: 3 });

function readCache(cacheKey: string) {
  if (!cacheKey || typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + cacheKey);
    return raw ? JSON.parse(raw) as any[] : null;
  } catch {
    return null;
  }
}

export function GenericListLoader({
  infiniteLoad = false,
  paginate = false,
  pageless = false,
  endIfPartialPage = false,
  loadFn,
  perPage = 24,
  cacheKey = "",
  children,
}: {
  infiniteLoad?: boolean;
  paginate?: boolean;
  pageless?: boolean;
  endIfPartialPage?: boolean;
  loadFn: (offset: number, limit: number) => Promise<any>;
  perPage?: number;
  cacheKey?: string;
  children: (state: { data: any[]; isLoading: boolean }) => React.ReactNode;
}) {
  const app = useAppState();
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<number>(STATUSES.READY);
  const [nextPage, setNextPage] = useState(1);
  const [identifier, setIdentifier] = useState(0);
  const restoredFromCache = useRef(false);
  const sentinel = useRef<HTMLDivElement | null>(null);
  const randomId = useId().replace(/:/g, "");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations();
  const currentPage = Number(searchParams.get("page") || 1);
  const pages = total ? Math.ceil(total / perPage) : 1;
  const pageLessMode = pageless || total === null;

  const writeCache = useCallback((next: any[]) => {
    if (!cacheKey || next.length === 0) return;
    try { sessionStorage.setItem(CACHE_PREFIX + cacheKey, JSON.stringify(next)); } catch {}
  }, [cacheKey]);

  const runLoad = useCallback(async (page: number, mode: "infinite" | "paginate") => {
    if (!restoredFromCache.current || data.length === 0) setIsLoading(true);
    setStatus(STATUSES.LOADING);
    try {
      const result = await loadFn((page - 1) * perPage, perPage);
      const { items, total: nextTotal, offset } = extractListPayload(result);
      setIsLoading(false);
      setTotal(nextTotal);
      if (mode === "infinite") {
        setData((prev) => {
          const next = restoredFromCache.current && page === 1 ? items : prev.concat(items);
          restoredFromCache.current = false;
          writeCache(next);
          return next;
        });
        if ((items.length < perPage && endIfPartialPage) || items.length === 0) setStatus(STATUSES.COMPLETED);
        else { setNextPage(page + 1); setStatus(STATUSES.READY); }
      } else {
        setData(items);
        restoredFromCache.current = false;
        writeCache(items);
        const resolvedOffset = offset ?? (page - 1) * perPage;
        if (pageless || nextTotal === null) {
          setStatus((items.length < perPage && endIfPartialPage) || items.length === 0 ? STATUSES.COMPLETED : STATUSES.READY);
        } else if (resolvedOffset + perPage >= nextTotal) {
          setStatus(STATUSES.COMPLETED);
        } else {
          setStatus(STATUSES.READY);
        }
      }
    } catch (e) {
      console.error(e);
      setIsLoading(false);
      setStatus(STATUSES.ERROR);
    }
  }, [data.length, endIfPartialPage, loadFn, pageless, perPage, writeCache]);

  useEffect(() => {
    const cached = readCache(cacheKey);
    setData(cached || []);
    setTotal(null);
    setIsLoading(!cached);
    setStatus(STATUSES.READY);
    setNextPage(1);
    setIdentifier((value) => value + 1);
    restoredFromCache.current = !!cached;
  }, [cacheKey]);

  useEffect(() => {
    if (!paginate) return;
    if (!identifier) return;
    void runLoad(currentPage, "paginate");
  }, [paginate, currentPage, identifier, runLoad]);

  useEffect(() => {
    if (!infiniteLoad) return;
    if (identifier) void runLoad(1, "infinite");
  }, [infiniteLoad, identifier]);

  useEffect(() => {
    if (!infiniteLoad || !("IntersectionObserver" in window) || !sentinel.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && status === STATUSES.READY) void runLoad(nextPage, "infinite");
    }, { root: null, rootMargin: "200px 0px", threshold: 0 });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [infiniteLoad, nextPage, runLoad, status]);

  function goToPage(page: number) {
    if (page < 1) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    router.push(`${pathname}${params.toString() ? `?${params}` : ""}`);
    const jump = document.getElementById(`tjump${randomId}`);
    if (jump) window.scrollTo(0, jump.offsetTop - 100);
  }
  function pageHref(page: number) {
    const params = new URLSearchParams(searchParams.toString());
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
      <div id={`tjump${randomId}`} />
      {children({ data, isLoading })}
      {infiniteLoad ? (
        <div ref={sentinel} key={identifier} className="flex justify-center py-4" style={{ minHeight: 100 }}>
          {status === STATUSES.LOADING ? <Spinner className="mt-8" /> : null}
          {status === STATUSES.ERROR ? (
            <Alert variant="destructive" className="mt-4 max-w-md">
              <AlertDescription>{t("component.apiError.title")}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      ) : null}
      {paginate ? (
        <div key={identifier} className="flex justify-center py-4" style={{ minHeight: 100 }}>
          {!pageLessMode ? (
            <Pagination className={(status === STATUSES.READY || status === STATUSES.COMPLETED) ? "" : "hidden"}>
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
            <Pagination className={(status === STATUSES.READY || status === STATUSES.COMPLETED) ? "" : "hidden"}>
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
