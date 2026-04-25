"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import * as icons from "@/lib/icons";
import { pullToRefresh } from "@/lib/mobile-pull-to-refresh";
import { useAppState } from "@/lib/store";

export function PullToRefresh() {
  const pathname = usePathname();
  const app = useAppState();
  const appRef = useRef(app);

  useEffect(() => {
    appRef.current = app;
  }, [app]);

  useEffect(() => {
    const container = document.querySelector("main") || document.body;
    if (!container || !("ontouchstart" in window)) return undefined;
    const disabledRoute = pathname.startsWith("/watch") || pathname.startsWith("/edit/video") || pathname.startsWith("/multiview");
    return pullToRefresh({
      container,
      shouldPullToRefresh: () => !window.scrollY && !disabledRoute && !appRef.current.navDrawer,
      async refresh() {
        const handledRefresh = await appRef.current.reloadCurrentPage({ source: "ptr", consumed: false });
        if (!handledRefresh.consumed) location.reload();
        await new Promise((resolve) => setTimeout(resolve, 300));
      },
    });
  }, [pathname]);

  return <div className="pull-to-refresh-material__control" style={{ zIndex: 4 }}><svg className="pull-to-refresh-material__icon" fill="#4285f4" width="24" height="24" viewBox="0 0 24 24"><path d={icons.mdiRefresh} /></svg><svg className="pull-to-refresh-material__spinner" width="24" height="24" viewBox="25 25 50 50"><circle className="pull-to-refresh-material__path" cx="50" cy="50" r="20" fill="none" stroke="#4285f4" strokeWidth="4" strokeMiterlimit="10" /></svg></div>;
}
