import Link from "next/link";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)] shadow-lg shadow-sky-950/30 hover:brightness-110",
        secondary: "border border-[color:var(--color-border)] bg-[color:var(--surface-soft)] text-[color:var(--color-foreground)] hover:bg-[color:var(--surface-soft)]",
        ghost: "text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--color-foreground)]",
        outline: "border border-[color:var(--color-border)] bg-transparent text-[color:var(--color-foreground)] hover:bg-[color:var(--surface-soft)]",
        destructive: "bg-[color:var(--color-destructive)] text-white hover:brightness-110",
      },
      size: { default: "h-10 px-4 py-2", sm: "h-8 rounded-lg px-3 text-xs", lg: "h-11 px-5 text-sm", icon: "h-10 w-10" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button(props: any) {
  const { as, variant, size, className, children, type, ...rest } = props;
  const merged = cn(buttonVariants({ variant, size }), className);
  if (as === "a") return <a className={merged} {...rest}>{children}</a>;
  if (as === Link) return <Link className={merged} {...rest}>{children}</Link>;
  return <button type={type || "button"} className={merged} {...rest}>{children}</button>;
}
