"use client";

import { LayoutPreview } from "@/components/multiview/LayoutPreview";
import { cn } from "@/lib/cn";

export function LayoutPreviewCard({ preset, custom = false, active = false, scale = 1, children, pre, post, onClick }: { preset: Record<string, any>; custom?: boolean; active?: boolean; scale?: number; children?: React.ReactNode; pre?: React.ReactNode; post?: React.ReactNode; onClick?: (event: React.MouseEvent) => void }) {
  return (
    <div className="layout-btn rounded-[calc(var(--radius)+4px)] p-2 transition" onClick={onClick}>
      <LayoutPreview layout={preset.layout} content={preset.content} mobile={preset.portrait} scale={scale} />
      <div className="layout-card-text mt-2 flex items-center justify-center gap-2 text-center text-sm">
        {pre}
        <span className={cn("min-w-0 truncate", custom && "flex-grow", active && "text-sky-300")}>{children || preset.name}</span>
        {post}
      </div>
    </div>
  );
}
