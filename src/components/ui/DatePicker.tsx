"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { POPOVER_MOTION_CLASS, useAnimatedPresence } from "@/lib/useAnimatedPresence";

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type CalendarDay = { label: string; date: string | null; isToday: boolean; isSelected: boolean };

export function DatePicker({ value = "", placeholder = "Pick a date", onChange }: { value?: string | null; placeholder?: string; onChange?: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const menuPresence = useAnimatedPresence(open, 180);
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => ({ year: today.getFullYear(), month: today.getMonth() }));
  const root = useRef<HTMLDivElement | null>(null);
  const modelValue = value || "";

  useEffect(() => {
    if (!modelValue) return;
    const d = new Date(`${modelValue}T12:00:00`);
    if (!Number.isNaN(d.getTime())) setCursor({ year: d.getFullYear(), month: d.getMonth() });
  }, [modelValue]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const monthYearLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const displayValue = (() => {
    if (!modelValue) return placeholder;
    const d = new Date(`${modelValue}T12:00:00`);
    if (Number.isNaN(d.getTime())) return placeholder;
    return d.toLocaleDateString(undefined, { month: "2-digit", day: "2-digit", year: "numeric" });
  })();
  const calendarDays = useMemo<CalendarDay[]>(() => {
    const firstDay = new Date(cursor.year, cursor.month, 1).getDay();
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const todayStr = toISODate(today);
    const days: CalendarDay[] = [];
    for (let i = 0; i < firstDay; i += 1) days.push({ label: "", date: null, isToday: false, isSelected: false });
    for (let d = 1; d <= daysInMonth; d += 1) {
      const date = toISODate(new Date(cursor.year, cursor.month, d));
      days.push({ label: String(d), date, isToday: date === todayStr, isSelected: date === modelValue });
    }
    return days;
  }, [cursor, modelValue, today]);

  function prevMonth() {
    setCursor(({ year, month }) => (month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }));
  }

  function nextMonth() {
    setCursor(({ year, month }) => (month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }));
  }

  function selectDay(date: string) {
    onChange?.(date);
    setOpen(false);
  }

  return (
    <div ref={root} className="relative inline-block">
      <button
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-lg border border-[color:var(--color-border)] px-3",
          "bg-[color:var(--surface-soft)] text-[0.8rem] font-medium text-[color:var(--color-foreground)]",
          "cursor-pointer transition-colors hover:bg-[color:var(--surface-elevated)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ring)]",
          !modelValue && "text-[color:var(--color-muted-foreground)]",
        )}
        type="button"
        onClick={() => setOpen((v) => !v)}
      >
        <svg className="h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>
        <span>{displayValue}</span>
      </button>
      {menuPresence.present ? (
        <div
          data-state={menuPresence.state}
          data-side="bottom"
          className={cn(
            "popover-content absolute left-0 top-[calc(100%+0.375rem)] z-[200] w-auto rounded-[calc(var(--radius)+6px)] border border-[color:var(--color-border)] bg-[color:var(--surface-elevated)] p-0 shadow-2xl outline-none backdrop-blur-xl",
            POPOVER_MOTION_CLASS,
            menuPresence.state === "closed" && "pointer-events-none",
          )}
          onAnimationEnd={menuPresence.onAnimationEnd}
        >
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <button type="button" className="rounded-md p-1 transition-colors hover:bg-[color:var(--surface-soft)]" onClick={prevMonth}><svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg></button>
            <span className="select-none text-sm font-semibold">{monthYearLabel}</span>
            <button type="button" className="rounded-md p-1 transition-colors hover:bg-[color:var(--surface-soft)]" onClick={nextMonth}><svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg></button>
          </div>
          <div className="grid grid-cols-7 px-3 pb-1">{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => <div key={d} className="flex h-8 items-center justify-center text-xs font-medium text-[color:var(--color-muted-foreground)]">{d}</div>)}</div>
          <div className="grid grid-cols-7 gap-y-0.5 px-3 pb-3">
            {calendarDays.map((day, i) => <button key={`${day.date || "empty"}-${i}`} type="button" disabled={!day.date} className={cn("flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors", !day.date && "cursor-default", day.date && "cursor-pointer select-none", day.isSelected && "bg-[color:var(--color-primary)] font-semibold text-[color:var(--color-primary-foreground)]", !day.isSelected && day.isToday && "border border-[color:var(--color-primary)] font-semibold text-[color:var(--color-primary)] hover:bg-[color:var(--surface-soft)]", !day.isSelected && !day.isToday && day.date && "hover:bg-[color:var(--surface-soft)]")} onClick={() => day.date && selectDay(day.date)}>{day.label}</button>)}
          </div>
          {modelValue ? <div className="px-3 pt-0 pb-3"><button type="button" className="h-8 w-full rounded-md border border-[color:var(--color-border)] text-xs text-[color:var(--color-muted-foreground)] transition-colors hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--color-foreground)]" onClick={() => { onChange?.(""); setOpen(false); }}>Clear</button></div> : null}
        </div>
      ) : null}
    </div>
  );
}
