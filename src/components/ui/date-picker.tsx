"use client";

import * as React from "react";
import dayjs from "dayjs";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
export function DatePicker({
  value,
  placeholder = "",
  onChange,
}: {
  value?: string | null;
  placeholder?: string;
  onChange?: (value: string) => void;
}) {
  const selected = React.useMemo(() => {
    if (!value) return undefined;
    const date = new Date(`${value}T12:00:00`);
    return isNaN(date.getTime()) ? undefined : date;
  }, [value]);

  function handleSelect(date: Date | undefined) {
    onChange?.(date ? dayjs(date).format("YYYY-MM-DD") : "");
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            data-empty={!selected}
            className="justify-start text-left font-normal data-[empty=true]:text-muted-foreground"
          />
        }
      >
        <CalendarIcon />
        {selected ? dayjs(selected).format("MMMM D, YYYY") : <span>{placeholder}</span>}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar mode="single" selected={selected} onSelect={handleSelect} />
      </PopoverContent>
    </Popover>
  );
}
