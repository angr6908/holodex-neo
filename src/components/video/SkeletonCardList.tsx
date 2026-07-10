"use client";

import { cn, getBreakpoint, GRID_COLUMN_CLASSES } from "@/lib/utils";
import { useAppState } from "@/lib/store";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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
  // The channel avatar now renders inline (24px) in the meta row, to the left of
  // the channel name — only when a channel and its avatar are both requested.
  const showChannelAvatar = includeAvatar && includeChannel && !denseList;
  // Meta row height: the inline avatar makes it ~24px; a channel-name button is
  // text-sm (~22px); the plain metric row is min-h-4 (16px).
  const metaMinH = showChannelAvatar ? "min-h-6" : includeChannel ? "min-h-[22px]" : "min-h-4";
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
    denseList ? "items-center gap-2 overflow-hidden py-0 pr-2 pl-1" : horizontal ? "px-2 py-1.5" : "px-2.5 pt-2 pb-1.5",
  );
  const linesClass = cn(
    "flex min-w-0 flex-1",
    denseList ? "flex-row flex-nowrap items-center gap-2.5" : horizontal ? "flex-col gap-0.5" : "flex-col gap-1.5",
    horizontal && "justify-around",
  );
  const metaRow = (
    <div className={cn("flex items-center gap-1.5 text-sm leading-none tabular-nums text-muted-foreground", metaMinH, includeChannel && "justify-between gap-2")}>
      {includeChannel ? (
        <>
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            {showChannelAvatar ? <Skeleton className="size-6 shrink-0 rounded-full" /> : null}
            <Skeleton className="h-3.5 w-2/5" />
          </div>
          <Skeleton className="h-3.5 w-14 shrink-0" />
        </>
      ) : (
        <Skeleton className="h-3.5 w-24" />
      )}
    </div>
  );

  return (
    <div className="relative py-0">
      <div
        className={cn(
          "grid gap-x-2 gap-y-2.5",
          !autoFitGrid && (GRID_COLUMN_CLASSES[colSize] || "grid-cols-1"),
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
                          {metaRow}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            </article>
          </div>
        ))}
      </div>
    </div>
  );
}
