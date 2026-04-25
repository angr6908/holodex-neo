"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { useAnimatedPresence } from "@/lib/useAnimatedPresence";

export function Dialog({ open, onOpenChange, children, className = "" }: { open: boolean; onOpenChange?: (open: boolean) => void; children: React.ReactNode; className?: string }) {
  const [mounted, setMounted] = useState(false);
  const presence = useAnimatedPresence(open, 180);

  useEffect(() => setMounted(true), []);

  if (!presence.present || !mounted) return null;

  return createPortal(
    <div data-state={presence.state} className={cn("dialog-overlay fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm", presence.state === "closed" && "pointer-events-none")} onAnimationEnd={presence.onAnimationEnd} onClick={(event) => { if (event.target === event.currentTarget) onOpenChange?.(false); }}>
      <div className={cn("glass-panel max-h-[90vh] w-full overflow-hidden rounded-[calc(var(--radius)+8px)] border border-white/10 shadow-2xl shadow-slate-950/50", className)}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
