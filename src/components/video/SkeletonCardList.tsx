"use client";

import { cn } from "@/lib/cn";
import { useAppState } from "@/lib/store";
import { useMemo } from "react";

export function SkeletonCardList({
  count,
  expectedSize = 24,
  cols = { xs: 1, sm: 2, md: 3, lg: 4, xl: 5 },
  dense = false,
  denseList = false,
  horizontal = false,
  includeAvatar = true,
}: {
  count?: number;
  expectedSize?: number | string;
  cols?: { xs: number; sm: number; md: number; lg: number; xl: number };
  dense?: boolean;
  denseList?: boolean;
  horizontal?: boolean;
  includeAvatar?: boolean;
  [key: string]: any;
}) {
  const app = useAppState();
  const keyBase = useMemo(() => Date.now(), []);
  const itemCount = Number(count ?? expectedSize);
  const width =
    app.windowWidth ||
    (typeof window !== "undefined" ? window.innerWidth : 1440);
  const isFlat = horizontal || denseList;
  const cssCols = isFlat ? { xs: 1, sm: 1, md: 1, lg: 1, xl: 1 } : cols;
  const colSize = isFlat ? 1 : width < 600 ? cols.xs : width < 960 ? cols.sm : width < 1264 ? cols.md : width < 1904 ? cols.lg : cols.xl;
  const gridStyle = {
    "--video-grid-columns": colSize,
    "--video-grid-xs": cssCols.xs,
    "--video-grid-sm": cssCols.sm,
    "--video-grid-md": cssCols.md,
    "--video-grid-lg": cssCols.lg,
    "--video-grid-xl": cssCols.xl,
  } as React.CSSProperties;

  return (
    <div className="py-0" style={{ position: "relative" }}>
      <div
        className={cn(
          "video-skeleton-grid",
          (dense || isFlat) && "video-skeleton-grid--compact",
          isFlat && "video-skeleton-grid--list",
        )}
        style={gridStyle}
      >
        {Array.from({ length: itemCount }).map((_, index) => (
          <div key={`${index}-${keyBase + index}`} className="video-skeleton-item">
            {denseList ? (
              <div className="flex items-center gap-2 px-2" style={{ height: 48 }}>
                <div className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-[color:var(--skeleton-fill)]" />
                <div className="min-w-0 flex-1">
                  <div className="h-3 w-3/4 animate-pulse rounded bg-[color:var(--skeleton-fill)]" />
                </div>
                <div className="h-3 w-16 shrink-0 animate-pulse rounded bg-[color:var(--skeleton-fill)]" />
                <div className="h-3 w-12 shrink-0 animate-pulse rounded bg-[color:var(--skeleton-fill)]" />
              </div>
            ) : horizontal ? (
              <div className="flex items-center" style={{ minHeight: 84 }}>
                <div className="m-1.5 h-[72px] w-[128px] shrink-0 animate-pulse rounded-lg bg-[color:var(--skeleton-fill)]" />
                <div className="flex min-w-0 flex-1 flex-col gap-2 p-2">
                  <div className="h-3.5 w-4/5 animate-pulse rounded bg-[color:var(--skeleton-fill)]" />
                  <div className="h-3 w-2/5 animate-pulse rounded bg-[color:var(--skeleton-fill)]" />
                </div>
              </div>
            ) : (
              <div className="video-skeleton-card">
                <div style={{ position: "relative", width: "100%", paddingBottom: "56.25%" }}>
                  <div className="absolute inset-0 animate-pulse bg-[color:var(--skeleton-fill)]" style={{ borderRadius: "1rem 1rem 0 0" }} />
                </div>
                <div
                  className="flex items-start"
                  style={{
                    padding: "0.5rem 0.625rem",
                    gap: "0.625rem",
                    minHeight: 88,
                    borderTop: "1px solid color-mix(in srgb, var(--color-border, rgba(255,255,255,0.07)) 72%, transparent 28%)",
                  }}
                >
                  {includeAvatar ? <div className="h-[48px] w-[48px] shrink-0 animate-pulse rounded-full bg-[color:var(--skeleton-fill)]" /> : null}
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-0.5">
                    <div className="h-3.5 w-11/12 animate-pulse rounded bg-[color:var(--skeleton-fill)]" />
                    <div className="h-3 w-3/5 animate-pulse rounded bg-[color:var(--skeleton-fill)]" />
                    <div className="h-2.5 w-2/5 animate-pulse rounded bg-[color:var(--skeleton-fill)]" />
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
