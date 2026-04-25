"use client";

export function EnhancedEntry({ stext = "", cc = "", oc = "", className = "", onMouseDown }: { stext?: string; cc?: string; oc?: string; className?: string; onMouseDown?: React.MouseEventHandler<HTMLSpanElement> }) {
  const textStyle = { WebkitTextFillColor: cc === "" ? "unset" : cc, WebkitTextStrokeColor: oc === "" ? "unset" : oc, WebkitTextStrokeWidth: oc === "" ? "0px" : "1px" } as React.CSSProperties;
  return <span className={`EntryContainer2 ${className}`.trim()} style={textStyle} onMouseDown={onMouseDown}>{stext}</span>;
}
