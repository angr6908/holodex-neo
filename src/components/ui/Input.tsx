import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import type { InputHTMLAttributes } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn("ui-input-base flex h-10 w-full rounded-xl border px-3 py-2 text-sm text-[color:var(--color-foreground)] placeholder:text-[color:var(--color-muted-foreground)] outline-none", className)} {...props} />;
});
