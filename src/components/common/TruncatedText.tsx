"use client";

import linkifyHtml from "linkify-html";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function escapeHtml(value: string) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const lineClampClasses: Record<number, string> = {
  1: "line-clamp-1",
  2: "line-clamp-2",
  3: "line-clamp-3",
  4: "line-clamp-4",
  5: "line-clamp-5",
  6: "line-clamp-6",
};

export function TruncatedText({
  html = "",
  text = "",
  lines = 5,
  className = "",
  renderButton,
}: {
  html?: string;
  text?: string;
  lines?: number | string;
  className?: string;
  renderButton?: (expanded: boolean) => React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const lineCount = useMemo(
    () => html.split(/\r\n|\r|\n/).length || text.split(/\r\n|\r|\n/).length,
    [html, text],
  );
  const linkedHtml = useMemo(() => linkifyHtml(html || escapeHtml(text)), [html, text]);
  const lineLimit = Number(lines);
  const shouldTruncate = lineCount > lineLimit;
  return (
    <div className={className}>
      <div
        className={cn(
          "whitespace-pre-wrap break-words",
          !expanded && shouldTruncate && lineClampClasses[lineLimit],
        )}
      >
        <span dangerouslySetInnerHTML={{ __html: linkedHtml }} />
      </div>
      {shouldTruncate ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-3 h-auto p-0"
          onClick={() => setExpanded((value) => !value)}
        >
          {renderButton ? (
            renderButton(expanded)
          ) : (
            <span>{expanded ? "Show less" : "Show more"}</span>
          )}
        </Button>
      ) : null}
    </div>
  );
}
