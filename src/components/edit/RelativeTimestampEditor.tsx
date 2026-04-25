"use client";

import { useRef, useState } from "react";
import { formatDuration } from "@/lib/time";

export function RelativeTimestampEditor({ value, test, upTo = false, onInput, onSeekTo }: { value: number; test: number; upTo?: boolean; onInput?: (value: number) => void; onSeekTo?: (value: number) => void }) {
  const [newVal, setNewVal] = useState(value);
  const [mousex, setMousex] = useState(0);
  const tl = useRef<HTMLDivElement | null>(null);
  const min = Math.max(0, value - 6);
  const max = Math.max(0, value + 6);
  function setNewValue(n: number) { setNewVal(n); onInput?.(n); }
  function tryPlay(e: React.MouseEvent) { const rect = tl.current!.getBoundingClientRect(); const val = ((e.clientX - rect.left) / rect.width) * (max - min) + min; onSeekTo?.(val); }
  return <div className={`rel-ts ${upTo ? "rel-end" : "rel-start"} mb-4`}>
    <div ref={tl} className="timeline" onMouseMove={(e) => setMousex(e.clientX)} onClick={tryPlay}><div className="ts-progress overflow-hidden rounded-full bg-white/10"><div className="h-full bg-rose-500" style={{ width: `${((Number(test) - min) * 100.0) / (max - min)}%` }} /></div><div className="rel-current" style={{ transform: `translateX(${mousex}px)` }}>Play from here</div></div>
    <div className="relative mb-2"><input value={newVal} min={min} max={max} step="1" type="range" className="rel-slider h-5 w-full cursor-ew-resize accent-rose-500" onChange={(e) => setNewValue(+e.target.value)} /><div className="mt-1 text-center text-xs text-slate-300">{newVal === value ? formatDuration(value * 1000) : `${(newVal - value) > 0 ? "+" : ""}${newVal - value}s`}</div></div>
    <span className="showOnHover float-right font-weight-light" style={{ fontSize: 12 }}>Click to test, drag to change time.</span>
  </div>;
}
