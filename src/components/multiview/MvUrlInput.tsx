"use client";

import { useEffect, useRef, useState } from "react";
import { mdiCheck, mdiChevronLeft, mdiLinkVariant } from "@mdi/js";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { getVideoIDFromUrl } from "@/lib/functions";
import { useOptionalMultiviewStore } from "@/lib/multiview-store";

export function MvUrlInput({ className = "", onSuccess }: { className?: string; onSuccess?: (content: any) => void }) {
  const store = useOptionalMultiviewStore();
  const [expanded, setExpanded] = useState(false);
  const [url, setUrl] = useState("");
  const [hasError, setHasError] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { if (hasError) setHasError(false); }, [url]);
  useEffect(() => { if (expanded) setTimeout(() => inputRef.current?.focus(), 0); }, [expanded]);

  function expand() { setExpanded(true); }
  function collapse() { setExpanded(false); setUrl(""); setHasError(false); }
  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const content = getVideoIDFromUrl(url) as any;
    if (content?.id) {
      setHasError(false);
      store?.addUrlHistory({ twitch: content.type === "twitch", url });
      onSuccess?.(content);
      collapse();
    } else {
      setHasError(true);
    }
  }

  return (
    <div className={`mv-url-input flex items-center gap-1 ${className}`}>
      {!expanded ? (
        <Button type="button" size="icon" variant="secondary" className="h-8 w-8 shrink-0 rounded-xl" title="Add YouTube / Twitch URL" onClick={expand}>
          <Icon icon={mdiLinkVariant} />
        </Button>
      ) : (
        <form className="flex items-center gap-1 animate-in fade-in slide-in-from-right-1 duration-150" onSubmit={handleSubmit}>
          <Button type="button" size="icon" variant="secondary" className="h-8 w-8 shrink-0 rounded-xl" title="Collapse" onClick={collapse}><Icon icon={mdiChevronLeft} /></Button>
          <div className="relative flex h-8 min-w-0 flex-1 items-center">
            <Input ref={inputRef as any} value={url} type="text" placeholder="YouTube or Twitch URL..." className={`h-8 rounded-xl text-sm ${hasError ? "border-amber-400/50 focus:border-amber-400/60" : ""} ${url ? "rounded-r-none" : ""}`} onChange={(event) => setUrl(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") collapse(); }} />
            {url ? (
              <Button type="submit" size="icon" variant="ghost" className={`h-8 w-8 shrink-0 rounded-l-none rounded-r-xl border border-l-0 ${hasError ? "border-amber-400/30 text-amber-400 hover:bg-amber-400/12" : "border-[color:var(--color-light)] text-[color:var(--color-primary)] hover:bg-[color:color-mix(in_srgb,var(--color-primary)_12%,transparent)]"}`} title="Confirm">
                <Icon icon={mdiCheck} />
              </Button>
            ) : null}
          </div>
        </form>
      )}
    </div>
  );
}
