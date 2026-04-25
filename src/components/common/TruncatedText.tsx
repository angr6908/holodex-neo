"use client";

import { useMemo, useState } from "react";
import { vueLinkifyHtml } from "@/lib/linkify";

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
  const linkedHtml = useMemo(() => vueLinkifyHtml(html || escapeHtml(text)), [html, text]);
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
      {shouldTruncate && renderButton ? (
        <span
          role="button"
          tabIndex={0}
          className="mt-3 inline-flex items-center"
          onClick={() => setExpanded((value) => !value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            setExpanded((value) => !value);
          }}
        >
          {renderButton(expanded)}
        </span>
      ) : shouldTruncate ? <button type="button" className="mt-3 inline-flex items-center" onClick={() => setExpanded((value) => !value)}><span>{expanded ? "Show less" : "Show more"}</span></button> : null}
    </div>
  );
}
