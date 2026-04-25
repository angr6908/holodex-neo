import { cn } from "@/lib/cn";
import { cva } from "class-variance-authority";
import type { HTMLAttributes } from "react";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em]",
  {
    variants: {
      variant: {
        default: "border-sky-600 bg-sky-500 text-white",
        secondary: "border-[color:var(--color-border)] bg-[color:var(--surface-soft)] text-[color:var(--color-foreground)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "secondary";
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
