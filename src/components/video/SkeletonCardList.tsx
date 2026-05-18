"use client";

import { cn, getBreakpoint } from "@/lib/utils";
import { useAppState } from "@/lib/store";
import { useState } from "react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
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
  const [keyBase] = useState(() => Date.now());
  const itemCount = Number(count ?? expectedSize);
  const width =
    app.windowWidth ||
    (typeof window !== "undefined" ? window.innerWidth : 1440);
  const isFlat = horizontal || denseList;
  const colSize = isFlat ? 1 : cols[getBreakpoint(width)];

  return (
    <div className="relative py-0">
      <div
        className={cn(
          "grid gap-x-1 gap-y-1.5",
          gridColumnClasses[colSize] || "grid-cols-1",
          isFlat && "overflow-hidden rounded-xl border gap-y-0 empty:border-0",
        )}
      >
        {Array.from({ length: itemCount }).map((_, index) => (
          <div key={`${index}-${keyBase + index}`} className={cn("min-w-0 overflow-visible", isFlat && "[&:not(:last-child)]:border-b")}>
            {denseList ? (
              <div className="flex h-12 items-center gap-2 px-2">
                <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-3 w-3/4" />
                </div>
                <Skeleton className="h-3 w-16 shrink-0" />
                <Skeleton className="h-3 w-12 shrink-0" />
              </div>
            ) : horizontal ? (
              <div className="flex items-center py-1.5">
                <Skeleton className="m-1.5 h-[72px] w-[128px] shrink-0 rounded-lg" />
                <div className="flex min-w-0 flex-1 flex-col gap-2 p-2">
                  <Skeleton className="h-3.5 w-4/5" />
                  <Skeleton className="h-3 w-2/5" />
                </div>
              </div>
            ) : (
              <Card className="gap-0 overflow-hidden p-0">
                <AspectRatio ratio={16 / 9} className="w-full">
                  <Skeleton className="size-full rounded-t-[1rem] rounded-b-none" />
                </AspectRatio>
                <div className="flex items-start gap-[0.625rem] border-t px-[0.625rem] py-2">
                  {includeAvatar ? <Skeleton className="h-[48px] w-[48px] shrink-0 rounded-full" /> : null}
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-0.5">
                    <Skeleton className="h-3.5 w-11/12" />
                    <Skeleton className="h-3 w-3/5" />
                    <Skeleton className="h-2.5 w-2/5" />
                  </div>
                </div>
              </Card>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
