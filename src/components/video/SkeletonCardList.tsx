"use client";

import { cn, getBreakpoint } from "@/lib/utils";
import { useAppState } from "@/lib/store";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const gridColumnClasses: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
  7: "grid-cols-7",
  8: "grid-cols-8",
  9: "grid-cols-9",
  10: "grid-cols-10",
  11: "grid-cols-11",
  12: "grid-cols-12",
};

export function SkeletonCardList({
  count,
  expectedSize = 24,
  cols = { xs: 1, sm: 2, md: 3, lg: 4, xl: 5 },
  denseList = false,
  horizontal = false,
  autoFit = false,
  autoFitMin = "13rem",
  includeAvatar = false,
  includeChannel = false,
  hideThumbnail = false,
}: {
  count?: number;
  expectedSize?: number | string;
  cols?: { xs: number; sm: number; md: number; lg: number; xl: number };
  dense?: boolean;
  denseList?: boolean;
  horizontal?: boolean;
  autoFit?: boolean;
  autoFitMin?: string;
  includeAvatar?: boolean;
  includeChannel?: boolean;
  hideThumbnail?: boolean;
  [key: string]: any;
}) {
  const app = useAppState();
  const [keyBase] = useState(() => Date.now());
  const itemCount = Number(count ?? expectedSize);
  const width =
    app.windowWidth ||
    (typeof window !== "undefined" ? window.innerWidth : 1440);
  const isFlat = horizontal || denseList;
  const autoFitGrid = autoFit && !isFlat;
  const colSize = isFlat ? 1 : autoFit ? 2 : cols[getBreakpoint(width)];
  const showGridAvatar = includeAvatar && !isFlat;
  // Match the real card meta row height: a channel-name button renders at text-sm
  // (20px line) + 2px border = 22px; the plain metric row is min-h-4 (16px).
  const metaMinH = includeChannel ? "min-h-[22px]" : "min-h-4";
  const showDenseAvatar = denseList;
  const articleClass = cn(
    "group relative flex w-full",
    horizontal && "flex-row",
    denseList && "min-h-12 flex-row",
    !isFlat && "flex-col",
  );
  const shellClass = cn(
    "video-card-shell flex w-full gap-0 overflow-hidden p-0 transition-all duration-200",
    isFlat ? "flex-row" : "flex-col",
    denseList && "min-h-12",
  );
  const thumbnailClass = cn(
    "relative flex w-full shrink-0 overflow-hidden bg-muted",
    horizontal && "my-1.5 ml-1.5 h-[72px] w-[128px] self-center rounded-lg",
  );
  const textClass = cn(
    "video-card-text flex flex-1 flex-row gap-2.5",
    denseList ? "items-center gap-2 overflow-hidden py-0 pr-2 pl-1" : horizontal ? "px-2 py-1.5" : "px-2.5 pt-2.5 pb-1.5",
  );
  const linesClass = cn(
    "flex min-w-0 flex-1",
    denseList ? "flex-row flex-nowrap items-center gap-2.5" : horizontal ? "flex-col gap-0.5" : "flex-col gap-1.5",
    horizontal && "justify-around",
  );

  return (
    <div className="relative py-0">
      <div
        className={cn(
          "grid gap-x-2 gap-y-2.5",
          !autoFitGrid && (gridColumnClasses[colSize] || "grid-cols-1"),
          isFlat && "overflow-hidden rounded-xl border gap-y-0 empty:border-0",
        )}
        style={autoFitGrid ? { gridTemplateColumns: `repeat(auto-fit, minmax(min(${autoFitMin}, 100%), 1fr))` } : undefined}
      >
        {Array.from({ length: itemCount }).map((_, index) => (
          <div key={`${index}-${keyBase + index}`} className={cn("min-w-0 overflow-visible", isFlat && "[&:not(:last-child)]:border-b")}>
            <article className={articleClass}>
              <Card className={shellClass}>
                {!denseList ? (
                  <div className={thumbnailClass}>
                    {!horizontal && hideThumbnail ? (
                      <Skeleton className="pointer-events-none aspect-[60/9] w-full rounded-none" />
                    ) : horizontal ? (
                      <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
                    ) : (
                      <Skeleton className="pointer-events-none aspect-video w-full rounded-none" />
                    )}
                  </div>
                ) : null}
                <div className={textClass}>
                  {showDenseAvatar ? (
                    <div className="mx-2 flex self-center flex-col">
                      <Skeleton className="size-10 rounded-full" />
                    </div>
                  ) : null}
                  {showGridAvatar ? (
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex flex-row items-center gap-2.5">
                        <Skeleton className="size-10 shrink-0 rounded-full" />
                        <div className="flex min-h-[2.75rem] min-w-0 flex-1 flex-col justify-center gap-1.5">
                          <Skeleton className="h-4 w-11/12" />
                          <Skeleton className="h-4 w-3/5" />
                        </div>
                      </div>
                      <div className={cn("flex items-center gap-1.5 text-sm leading-none tabular-nums text-muted-foreground", metaMinH, includeChannel && "justify-between gap-3")}>
                        <Skeleton className={cn("h-3.5", includeChannel ? "w-2/5" : "w-24")} />
                        {includeChannel ? <Skeleton className="h-3.5 w-14 shrink-0" /> : null}
                      </div>
                    </div>
                  ) : (
                    <div className={linesClass}>
                      {denseList ? (
                        <>
                          <Skeleton className="h-4 min-w-0 flex-1" />
                          {includeChannel ? <Skeleton className="hidden h-4 w-[min(180px,24vw)] shrink sm:block" /> : null}
                          <Skeleton className="h-4 w-20 shrink-0" />
                        </>
                      ) : (
                        <>
                          <div className="flex-none">
                            <div className="flex min-h-[2.75rem] flex-col gap-1.5">
                              <Skeleton className="h-4 w-11/12" />
                              <Skeleton className="h-4 w-3/5" />
                            </div>
                          </div>
                          <div className="flex min-h-0 flex-1 flex-col justify-end">
                            <div className={cn("flex items-center gap-1.5 text-sm leading-none tabular-nums text-muted-foreground", metaMinH, includeChannel && "justify-between gap-3")}>
                              <Skeleton className={cn("h-3.5", includeChannel ? "w-2/5" : "w-24")} />
                              {includeChannel ? <Skeleton className="h-3.5 w-14 shrink-0" /> : null}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            </article>
          </div>
        ))}
      </div>
    </div>
  );
}
