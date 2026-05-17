"use client";

import { useMemo, useState } from "react";
import linkifyHtml from "linkifyjs/html";
import { Button } from "@/components/ui/button";
function escapeHtml(value: string) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function TruncatedText({ html = "", text = "", lines = 5, className = "", style, renderButton }: { html?: string; text?: string; lines?: number | string; className?: string; style?: React.CSSProperties; renderButton?: (expanded: boolean) => React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const lineCount = useMemo(() => (html.split(/\r\n|\r|\n/).length || text.split(/\r\n|\r|\n/).length), [html, text]);
  const linkedHtml = useMemo(() => linkifyHtml(html || escapeHtml(text)), [html, text]);
  const lineLimit = Number(lines);
  const shouldTruncate = lineCount > lineLimit;
  const contentStyle = {
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    WebkitLineClamp: lineLimit,
    ...(!expanded && shouldTruncate ? { display: "-webkit-box", WebkitBoxOrient: "vertical", overflow: "hidden" } : {}),
  } as React.CSSProperties;
  return (
    <div className={className} style={style}>
      <div style={contentStyle}><span dangerouslySetInnerHTML={{ __html: linkedHtml }} /></div>
      {shouldTruncate ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-3 h-auto p-0"
          onClick={() => setExpanded((value) => !value)}
        >
          {renderButton ? renderButton(expanded) : <span>{expanded ? "Show less" : "Show more"}</span>}
        </Button>
      ) : null}
    </div>
  );
}
