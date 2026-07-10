"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "@/lib/icons";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

type SectionPanelProps = {
  title: ReactNode;
  count?: number;
  meta?: ReactNode;
  actions?: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
};

// Shared collapsible panel shell: muted header strip (chevron, title, count pill, actions) over
// a rounded bordered card. Used by the watch-page sections (comments, related videos, songs,
// playlist, quick editor) and the channels-tab groups so sectioned content reads as one system.
export function SectionPanel({ title, count, meta, actions, open, defaultOpen = true, onOpenChange, className, contentClassName, children }: SectionPanelProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isOpen = open ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  return (
    <Collapsible open={isOpen} onOpenChange={setOpen}>
      <section className={cn("overflow-hidden rounded-xl border border-border/60 bg-card/50", className)}>
        <div className="flex items-center gap-2 bg-muted/30 pr-2">
          <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-foreground outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/40">
            <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", !isOpen && "-rotate-90")} />
            <span className="truncate first-letter:uppercase">{title}</span>
            {typeof count === "number" ? (
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-normal tabular-nums text-muted-foreground">{count}</span>
            ) : null}
            {meta ? <span className="min-w-0 truncate text-xs font-normal text-muted-foreground">{meta}</span> : null}
          </CollapsibleTrigger>
          {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
        </div>
        <CollapsibleContent className="border-t border-border/60">
          <div className={contentClassName}>{children}</div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
