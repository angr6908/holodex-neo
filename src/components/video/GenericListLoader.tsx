"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { mdiChevronLeft, mdiChevronRight } from "@mdi/js";
import { LoadingOverlay } from "@/components/common/LoadingOverlay";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/lib/i18n";
import { useAppState } from "@/lib/store";
import { extractListPayload } from "@/lib/video-list";

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
  const { t } = useI18n();
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
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    router.push(`${pathname}${params.toString() ? `?${params}` : ""}`);
    const jump = document.getElementById(`tjump${randomId}`);
    if (jump) window.scrollTo(0, jump.offsetTop - 100);
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
          <LoadingOverlay isLoading={status === STATUSES.LOADING} showError={status === STATUSES.ERROR} />
        </div>
      ) : null}
      {paginate ? (
        <div key={identifier} className="flex justify-center py-4" style={{ minHeight: 100 }}>
          {!pageLessMode ? (
            <div className={(status === STATUSES.READY || status === STATUSES.COMPLETED) ? "flex flex-wrap items-center justify-center gap-2" : "hidden"}>
              <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => goToPage(currentPage - 1)}><Icon icon={mdiChevronLeft} size="sm" /></Button>
              {visiblePages.map((pageNumber) => <Button key={`page-${pageNumber}`} variant={pageNumber === currentPage ? "default" : "outline"} size="sm" onClick={() => goToPage(pageNumber)}>{pageNumber}</Button>)}
              <Button variant="outline" size="sm" disabled={currentPage === pages} onClick={() => goToPage(currentPage + 1)}><Icon icon={mdiChevronRight} size="sm" /></Button>
            </div>
          ) : (
            <div className={(status === STATUSES.READY || status === STATUSES.COMPLETED) ? "" : "hidden"}>
              <Button className="m-2 pr-6" variant="outline" disabled={currentPage === 1} onClick={() => goToPage(currentPage - 1)}><Icon icon={mdiChevronLeft} size="sm" />{t("component.paginateLoad.newer")}</Button>
              <Button className="m-2 pl-6" variant="outline" disabled={status === STATUSES.COMPLETED} onClick={() => goToPage(currentPage + 1)}>{t("component.paginateLoad.older")}<Icon icon={mdiChevronRight} size="sm" /></Button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
