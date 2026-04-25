import type { ReactNode } from "react";

export function WatchFrame({ fluid = false, children }: { video?: Record<string, any>; fluid?: boolean; children: ReactNode }) {
  return (
    <div>
      <div className={`video ${fluid ? "video-fluid" : ""}`.trim()}>
        {children}
      </div>
    </div>
  );
}
